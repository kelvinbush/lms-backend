import { and, asc, count, desc, eq, inArray, isNull, like, or } from "drizzle-orm";
import type { FastifyRequest } from "fastify";
import { db } from "../../db";
import {
  businessProfiles,
  loanApplications,
  loanApplicationVersions,
  loanDocuments,
  loanProducts,
  organizations,
  users,
} from "../../db/schema";
import { logger } from "../../utils/logger";
import { isEntrepreneur } from "../../utils/authz";
import {
  generateLoanId,
  mapCreateLoanApplicationResponse,
  mapLoanApplicationDetail,
  mapLoanApplicationRow,
  toNumber,
} from "./loan-applications.mapper";
import type { LoanApplicationsModel } from "./loan-applications.model";
import { buildBaseWhereConditions, buildSearchConditions } from "./loan-applications.query-builder";
import { calculateStatsWithChanges } from "./loan-applications.stats";
import { validateLoanApplicationCreation } from "./loan-applications.validators";
import { LoanApplicationAuditService } from "./loan-applications-audit.service";
import { KycKybVerificationService } from "../kyc-kyb-verification/kyc-kyb-verification.service";
import { emailService } from "../../services/email.service";

function httpError(status: number, message: string) {
  const err: any = new Error(message);
  err.status = status;
  return err;
}

export abstract class LoanApplicationsService {
  /**
   * Create a new loan application
   *
   * @description Creates a new loan application with all required details.
   * Initial status is set to "kyc_kyb_verification".
   * Supports both admin users (can create for any business) and entrepreneurs (can only create for themselves).
   *
   * @param clerkId - The ID of the user creating the application
   * @param body - Loan application creation data
   * @returns Created loan application
   *
   * @throws {400} If application data is invalid
   * @throws {401} If user is not authorized
   * @throws {403} If entrepreneur tries to create for someone else
   * @throws {404} If business, entrepreneur, or loan product not found
   * @throws {500} If creation fails
   */
  static async create(
    clerkId: string,
    body: LoanApplicationsModel.CreateLoanApplicationBody
  ): Promise<LoanApplicationsModel.CreateLoanApplicationResponse> {
    try {
      // Get the user first to check if they're an entrepreneur
      const user = await db.query.users.findFirst({
        where: eq(users.clerkId, clerkId),
      });

      if (!user) {
        throw httpError(401, "[UNAUTHORIZED] User not found");
      }

      // If user is an entrepreneur, validate they can only create for themselves
      if (isEntrepreneur(user)) {
        // If entrepreneurId is provided, it must match the authenticated user
        if (body.entrepreneurId && body.entrepreneurId !== user.id) {
          throw httpError(
            403,
            "[FORBIDDEN] Entrepreneurs can only create loan applications for themselves"
          );
        }

        // Get entrepreneur's business profile
        const business = await db.query.businessProfiles.findFirst({
          where: and(eq(businessProfiles.userId, user.id), isNull(businessProfiles.deletedAt)),
        });

        if (!business) {
          throw httpError(
            400,
            "[BUSINESS_NOT_FOUND] You must have a business profile to create a loan application"
          );
        }

        // Auto-set businessId and entrepreneurId for entrepreneurs
        body.businessId = business.id;
        body.entrepreneurId = user.id;
        body.loanSource = body.loanSource || "SME Platform";
      } else {
        // Admin/member users - businessId and entrepreneurId are required
        if (!body.businessId) {
          throw httpError(400, "[MISSING_BUSINESS_ID] businessId is required for admin users");
        }
        if (!body.entrepreneurId) {
          throw httpError(
            400,
            "[MISSING_ENTREPRENEUR_ID] entrepreneurId is required for admin users"
          );
        }
        body.loanSource = body.loanSource || "Admin Platform";
      }

      // At this point, businessId and entrepreneurId are guaranteed to be set
      // (either auto-set for entrepreneurs or validated for admins)
      // Type assertion is safe here because we've ensured they're set above
      const validatedBody = {
        ...body,
        businessId: body.businessId!,
        entrepreneurId: body.entrepreneurId!,
      };

      // Validate all input data (this will validate business, entrepreneur, loan product, etc.)
      const { loanProduct } = await validateLoanApplicationCreation(clerkId, validatedBody);

      // Generate unique loan ID
      let loanId = generateLoanId();
      let attempts = 0;
      const maxAttempts = 10;

      // Ensure loanId is unique
      while (attempts < maxAttempts) {
        const existing = await db.query.loanApplications.findFirst({
          where: eq(loanApplications.loanId, loanId),
        });
        if (!existing) break;
        loanId = generateLoanId();
        attempts++;
      }

      if (attempts >= maxAttempts) {
        throw httpError(500, "[LOAN_ID_GENERATION_FAILED] Failed to generate unique loan ID");
      }

      // Create the loan application
      const [row] = await db
        .insert(loanApplications)
        .values({
          loanId,
          businessId: body.businessId,
          entrepreneurId: body.entrepreneurId,
          loanProductId: body.loanProductId,
          fundingAmount: body.fundingAmount as any,
          fundingCurrency: body.fundingCurrency,
          convertedAmount: body.convertedAmount ? (body.convertedAmount as any) : null,
          convertedCurrency: body.convertedCurrency || null,
          exchangeRate: body.exchangeRate ? (body.exchangeRate as any) : null,
          repaymentPeriod: body.repaymentPeriod,
          intendedUseOfFunds: body.intendedUseOfFunds,
          interestRate: body.interestRate as any,
          loanSource: body.loanSource || "Admin Platform",
          status: "kyc_kyb_verification" as any,
          createdBy: user.id,
          submittedAt: new Date(),
        })
        .returning();

      // Log audit event for loan application creation/submission
      await LoanApplicationAuditService.logEvent({
        loanApplicationId: row.id,
        clerkId,
        eventType: "submitted",
        title: LoanApplicationAuditService.getEventTitle("submitted"),
        description: `Loan application ${loanId} submitted successfully`,
        status: row.status,
        details: {
          loanId,
          fundingAmount: body.fundingAmount,
          fundingCurrency: body.fundingCurrency,
          repaymentPeriod: body.repaymentPeriod,
        },
      });

      return mapCreateLoanApplicationResponse(row);
    } catch (error: any) {
      logger.error("Error creating loan application:", error);
      if (error?.status) throw error;
      throw httpError(500, "[CREATE_LOAN_APPLICATION_ERROR] Failed to create loan application");
    }
  }

  /**
   * List loan applications with filtering, pagination, and search
   *
   * @description Retrieves a paginated, searchable, and filterable list of loan applications.
   * Supports filtering by status, loan product, loan source, and date ranges.
   * This is an admin-only endpoint - authorization is handled at the route level.
   *
   * @param query - Query parameters for filtering, pagination, and sorting
   * @returns Paginated list of loan applications
   *
   * @throws {500} If listing fails
   */
  static async list(
    query: LoanApplicationsModel.ListLoanApplicationsQuery = {}
  ): Promise<LoanApplicationsModel.ListLoanApplicationsResponse> {
    try {
      const page = query.page ? Number.parseInt(query.page) : 1;
      const limit = Math.min(query.limit ? Number.parseInt(query.limit) : 20, 100);
      const offset = (page - 1) * limit;

      // Build base where conditions
      const baseConditions = buildBaseWhereConditions(query);

      // Build search conditions and determine needed joins
      const {
        whereConditions: countWhereConditions,
        needsLoanProductJoin,
        needsBusinessJoin,
      } = buildSearchConditions(query, baseConditions);

      // Get total count (optimized - only join tables if needed for filtering)
      let countQuery = db.select({ total: count() }).from(loanApplications);

      if (needsLoanProductJoin) {
        countQuery = countQuery.leftJoin(
          loanProducts,
          eq(loanApplications.loanProductId, loanProducts.id)
        ) as any;
      }
      if (needsBusinessJoin) {
        countQuery = countQuery.leftJoin(
          businessProfiles,
          eq(loanApplications.businessId, businessProfiles.id)
        ) as any;
      }

      const [{ total }] = await countQuery.where(and(...countWhereConditions));

      // Build sort order
      const sortBy = query.sortBy || "createdAt";
      const sortOrder = query.sortOrder || "desc";

      let orderByClause;
      switch (sortBy) {
        case "applicationNumber":
          orderByClause =
            sortOrder === "asc" ? asc(loanApplications.loanId) : desc(loanApplications.loanId);
          break;
        case "amount":
          orderByClause =
            sortOrder === "asc"
              ? asc(loanApplications.fundingAmount)
              : desc(loanApplications.fundingAmount);
          break;
        case "applicantName":
          // Sort by entrepreneur's first name (we'll need to join users table)
          // For now, sort by entrepreneurId - will be refined after join
          orderByClause =
            sortOrder === "asc"
              ? asc(loanApplications.entrepreneurId)
              : desc(loanApplications.entrepreneurId);
          break;
        default: // createdAt
          orderByClause =
            sortOrder === "asc"
              ? asc(loanApplications.createdAt)
              : desc(loanApplications.createdAt);
      }

      // Build search conditions for main query (reuse same logic)
      const { whereConditions: searchWhereConditions } = buildSearchConditions(
        query,
        baseConditions
      );

      // Get applications with related data - optimized single query with joins
      // Join users table for entrepreneur data (name, email) which are needed for display and search
      const applicationRows = await db
        .select({
          loanApplication: loanApplications,
          businessName: businessProfiles.name,
          loanProductName: loanProducts.name,
          entrepreneurFirstName: users.firstName,
          entrepreneurLastName: users.lastName,
          entrepreneurEmail: users.email,
        })
        .from(loanApplications)
        .leftJoin(businessProfiles, eq(loanApplications.businessId, businessProfiles.id))
        .leftJoin(loanProducts, eq(loanApplications.loanProductId, loanProducts.id))
        .leftJoin(users, eq(loanApplications.entrepreneurId, users.id))
        .where(and(...searchWhereConditions))
        .orderBy(orderByClause)
        .limit(limit)
        .offset(offset);

      // Fetch creator data separately (only if needed for display)
      const creatorIds = [...new Set(applicationRows.map((r) => r.loanApplication.createdBy))];
      const creatorRows =
        creatorIds.length > 0
          ? await db
              .select({
                id: users.id,
                firstName: users.firstName,
                lastName: users.lastName,
              })
              .from(users)
              .where(and(inArray(users.id, creatorIds), isNull(users.deletedAt)))
          : [];

      // Build creator map for O(1) lookup
      const creatorMap = new Map(creatorRows.map((u) => [u.id, u]));

      // Fetch entrepreneur phone and image separately (not in main query to optimize)
      const entrepreneurIds = [
        ...new Set(applicationRows.map((r) => r.loanApplication.entrepreneurId)),
      ];
      const entrepreneurDetails =
        entrepreneurIds.length > 0
          ? await db
              .select({
                id: users.id,
                phoneNumber: users.phoneNumber,
                imageUrl: users.imageUrl,
              })
              .from(users)
              .where(and(inArray(users.id, entrepreneurIds), isNull(users.deletedAt)))
          : [];

      const entrepreneurDetailsMap = new Map(entrepreneurDetails.map((u) => [u.id, u]));

      // Map rows to response format and apply additional search filtering if needed
      let mappedRows = applicationRows.map((row) => {
        const entrepreneurDetails = entrepreneurDetailsMap.get(row.loanApplication.entrepreneurId);
        const creator = creatorMap.get(row.loanApplication.createdBy);

        return mapLoanApplicationRow(row.loanApplication, {
          business: row.businessName ? { name: row.businessName } : null,
          entrepreneur: {
            firstName: row.entrepreneurFirstName,
            lastName: row.entrepreneurLastName,
            email: row.entrepreneurEmail || "N/A",
            phoneNumber: entrepreneurDetails?.phoneNumber || null,
            imageUrl: entrepreneurDetails?.imageUrl || null,
          },
          loanProduct: row.loanProductName ? { name: row.loanProductName } : null,
          creator: creator
            ? {
                firstName: creator.firstName,
                lastName: creator.lastName,
              }
            : null,
        });
      });

      // Apply additional search filtering on applicant name and email (case-insensitive)
      // This is done after fetch since we can't efficiently search user names in SQL without complex joins
      if (query.search) {
        const searchLower = query.search.toLowerCase();
        mappedRows = mappedRows.filter((app) => {
          const applicantName = app.applicant.name.toLowerCase();
          const applicantEmail = app.applicant.email.toLowerCase();
          return (
            applicantName.includes(searchLower) ||
            applicantEmail.includes(searchLower) ||
            app.loanId.toLowerCase().includes(searchLower) ||
            app.businessName.toLowerCase().includes(searchLower) ||
            app.loanProduct.toLowerCase().includes(searchLower) ||
            app.loanSource.toLowerCase().includes(searchLower)
          );
        });
      }

      return {
        data: mappedRows,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error: any) {
      logger.error("Error listing loan applications:", error);
      if (error?.status) throw error;
      throw httpError(500, "[LIST_LOAN_APPLICATIONS_ERROR] Failed to list loan applications");
    }
  }

  /**
   * Get loan application statistics
   *
   * @description Get aggregated statistics for loan applications dashboard.
   * Supports the same filters as the list endpoint.
   * This is an admin-only endpoint - authorization is handled at the route level.
   *
   * @param query - Optional filter parameters
   * @returns Loan application statistics
   *
   * @throws {500} If statistics calculation fails
   */
  static async getStats(
    query: LoanApplicationsModel.LoanApplicationStatsQuery = {}
  ): Promise<LoanApplicationsModel.LoanApplicationStatsResponse> {
    try {
      return await calculateStatsWithChanges(query);
    } catch (error: any) {
      logger.error("Error getting loan application statistics:", error);
      if (error?.status) throw error;
      throw httpError(500, "[GET_LOAN_APPLICATION_STATS_ERROR] Failed to get statistics");
    }
  }

  /**
   * Get loan application by ID
   *
   * @description Retrieves a specific loan application by its ID with all related data.
   * This is an admin-only endpoint - authorization is handled at the route level.
   *
   * @param id - The loan application ID
   * @returns Detailed loan application information
   *
   * @throws {404} If loan application is not found
   * @throws {500} If retrieval fails
   */
  static async getById(id: string): Promise<LoanApplicationsModel.LoanApplicationDetail> {
    try {
      // Get loan application with related data in optimized queries
      const [application] = await db
        .select()
        .from(loanApplications)
        .where(and(eq(loanApplications.id, id), isNull(loanApplications.deletedAt)))
        .limit(1);

      if (!application) {
        throw httpError(404, "[LOAN_APPLICATION_NOT_FOUND] Loan application not found");
      }

      // Fetch related data in parallel for efficiency
      const [business, entrepreneur, loanProduct, creator, lastUpdatedByUser, activeVersion] = await Promise.all([
        // Business
        db.query.businessProfiles.findFirst({
          where: and(
            eq(businessProfiles.id, application.businessId),
            isNull(businessProfiles.deletedAt)
          ),
          columns: {
            id: true,
            name: true,
            description: true,
            sector: true,
            country: true,
            city: true,
            entityType: true,
          },
        }),
        // Entrepreneur
        db.query.users.findFirst({
          where: and(eq(users.id, application.entrepreneurId), isNull(users.deletedAt)),
          columns: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phoneNumber: true,
            imageUrl: true,
          },
        }),
        // Loan Product (with organizationId to fetch organization name)
        db.query.loanProducts.findFirst({
          where: and(
            eq(loanProducts.id, application.loanProductId),
            isNull(loanProducts.deletedAt)
          ),
          columns: {
            id: true,
            name: true,
            currency: true,
            minAmount: true,
            maxAmount: true,
            organizationId: true,
          },
        }),
        // Creator
        db.query.users.findFirst({
          where: and(eq(users.id, application.createdBy), isNull(users.deletedAt)),
          columns: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        }),
        // Last Updated By (if exists)
        application.lastUpdatedBy
          ? db.query.users.findFirst({
              where: and(eq(users.id, application.lastUpdatedBy), isNull(users.deletedAt)),
              columns: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            })
          : Promise.resolve(null),
        // Active Version (if exists)
        application.activeVersionId
          ? db.query.loanApplicationVersions.findFirst({
              where: eq(loanApplicationVersions.id, application.activeVersionId),
            })
          : Promise.resolve(null),
      ]);

      // Validate required related data exists
      if (!business) {
        throw httpError(
          404,
          "[BUSINESS_NOT_FOUND] Business associated with loan application not found"
        );
      }
      if (!entrepreneur) {
        throw httpError(
          404,
          "[ENTREPRENEUR_NOT_FOUND] Entrepreneur associated with loan application not found"
        );
      }
      if (!loanProduct) {
        throw httpError(
          404,
          "[LOAN_PRODUCT_NOT_FOUND] Loan product associated with loan application not found"
        );
      }
      if (!creator) {
        throw httpError(404, "[CREATOR_NOT_FOUND] Creator of loan application not found");
      }

      // Fetch organization name
      const organizationData = loanProduct.organizationId
        ? await db.query.organizations.findFirst({
            where: and(
              eq(organizations.id, loanProduct.organizationId),
              isNull(organizations.deletedAt)
            ),
            columns: {
              name: true,
            },
          })
        : null;

      return mapLoanApplicationDetail(application, {
        business,
        entrepreneur,
        loanProduct,
        creator,
        lastUpdatedByUser: lastUpdatedByUser || null,
        organizationName: organizationData?.name || "Unknown Organization",
        activeVersion: activeVersion || null,
      });
    } catch (error: any) {
      logger.error("Error getting loan application by ID:", error);
      if (error?.status) throw error;
      throw httpError(500, "[GET_LOAN_APPLICATION_ERROR] Failed to get loan application");
    }
  }

  /**
   * Update loan application status
   *
   * @description Updates the status of a loan application with validation, timestamp updates, and audit logging.
   * This is an admin-only endpoint - authorization is handled at the route level.
   *
   * @param clerkId - The ID of the user updating the status
   * @param applicationId - The loan application ID
   * @param newStatus - The new status to set
   * @param reason - Optional reason for the status change
   * @param rejectionReason - Required if status is "rejected"
   * @param request - Optional Fastify request for extracting metadata
   * @returns Updated loan application detail
   *
   * @throws {400} If status transition is invalid or rejectionReason is missing for rejected status
   * @throws {404} If loan application is not found
   * @throws {500} If update fails
   */
  static async updateStatus(
    clerkId: string,
    applicationId: string,
    newStatus: LoanApplicationsModel.LoanApplicationStatus,
    reason?: string,
    rejectionReason?: string,
    request?: any
  ): Promise<LoanApplicationsModel.LoanApplicationDetail> {
    try {
      if (!clerkId) throw httpError(401, "[UNAUTHORIZED] Missing user context");

      // Get current application
      const [current] = await db
        .select()
        .from(loanApplications)
        .where(and(eq(loanApplications.id, applicationId), isNull(loanApplications.deletedAt)))
        .limit(1);

      if (!current) {
        throw httpError(404, "[LOAN_APPLICATION_NOT_FOUND] Loan application not found");
      }

      // Validate status transition
      const currentStatus = current.status;
      if (currentStatus === newStatus) {
        throw httpError(400, "[INVALID_TRANSITION] Status is already set to this value");
      }

      // Define valid status transitions
      // Terminal states cannot be changed from
      const terminalStates = ["approved", "rejected", "disbursed", "cancelled"];
      if (terminalStates.includes(currentStatus)) {
        throw httpError(
          400,
          `[INVALID_TRANSITION] Cannot change status from terminal state: ${currentStatus}`
        );
      }

      // Validate rejection reason if status is rejected
      if (newStatus === "rejected" && !rejectionReason) {
        throw httpError(
          400,
          "[MISSING_REJECTION_REASON] Rejection reason is required when rejecting an application"
        );
      }

      // Get user who is making the change
      const user = await db.query.users.findFirst({
        where: eq(users.clerkId, clerkId),
        columns: { id: true },
      });

      if (!user) {
        throw httpError(401, "[UNAUTHORIZED] User not found");
      }

      // Prepare update data
      const now = new Date();
      const updateData: any = {
        status: newStatus as any,
        lastUpdatedBy: user.id,
        lastUpdatedAt: now,
        updatedAt: now,
      };

      // Update appropriate timestamp fields based on status
      if (newStatus === "approved" && !current.approvedAt) {
        updateData.approvedAt = now;
      } else if (newStatus === "rejected" && !current.rejectedAt) {
        updateData.rejectedAt = now;
        updateData.rejectionReason = rejectionReason || null;
      } else if (newStatus === "disbursed" && !current.disbursedAt) {
        updateData.disbursedAt = now;
      } else if (newStatus === "cancelled" && !current.cancelledAt) {
        updateData.cancelledAt = now;
      }

      // Clear rejection reason if status is not rejected
      if (newStatus !== "rejected" && current.rejectionReason) {
        updateData.rejectionReason = null;
      }

      // Update the application
      const [_updated] = await db
        .update(loanApplications)
        .set(updateData)
        .where(eq(loanApplications.id, applicationId))
        .returning();

      // Log audit event
      const eventType = LoanApplicationAuditService.mapStatusToEventType(newStatus);
      if (eventType) {
        const eventTitle = LoanApplicationAuditService.getEventTitle(eventType, newStatus);
        const eventDescription = reason
          ? `${eventTitle}. Reason: ${reason}`
          : rejectionReason
            ? `${eventTitle}. Reason: ${rejectionReason}`
            : eventTitle;

        const requestMetadata = request
          ? LoanApplicationAuditService.extractRequestMetadata(request)
          : {};

        await LoanApplicationAuditService.logEvent({
          loanApplicationId: applicationId,
          clerkId,
          eventType,
          title: eventTitle,
          description: eventDescription,
          status: newStatus,
          previousStatus: currentStatus,
          newStatus: newStatus,
          details: {
            reason: reason || null,
            rejectionReason: rejectionReason || null,
          },
          ...requestMetadata,
        });
      }

      // Auto-create verification records when status changes to kyc_kyb_verification
      if (newStatus === "kyc_kyb_verification") {
        // This is non-blocking - errors are logged but don't fail the status update
        KycKybVerificationService.createVerificationRecordsForLoanApplication(applicationId).catch(
          (error) => {
            logger.error(
              `Failed to auto-create verification records for loan application ${applicationId}:`,
              error
            );
          }
        );
      }

      // Send rejection email to applicant if status is rejected
      if (newStatus === "rejected" && rejectionReason) {
        // This is non-blocking - errors are logged but don't fail the status update
        (async () => {
          try {
            const entrepreneur = await db.query.users.findFirst({
              where: and(eq(users.id, current.entrepreneurId), isNull(users.deletedAt)),
              columns: {
                email: true,
                firstName: true,
              },
            });

            if (entrepreneur?.email) {
              const appUrl = process.env.APP_URL || "#";
              await emailService.sendLoanRejectionEmail({
                to: entrepreneur.email,
                firstName: entrepreneur.firstName || undefined,
                rejectionReason,
                loginUrl: `${appUrl}/login`,
              });
            }
          } catch (error) {
            logger.error(
              `Failed to send rejection email for loan application ${applicationId}:`,
              error
            );
          }
        })();
      }

      // Return updated application detail
      return await LoanApplicationsService.getById(applicationId);
    } catch (error: any) {
      logger.error("Error updating loan application status:", error);
      if (error?.status) throw error;
      throw httpError(500, "[UPDATE_STATUS_ERROR] Failed to update loan application status");
    }
  }

  /**
   * List loan applications for external users (entrepreneurs)
   * Returns only applications where the authenticated user is the entrepreneur
   *
   * @description Retrieves a paginated, searchable, and filterable list of loan applications
   * for the authenticated entrepreneur. Simplified format matching frontend requirements.
   *
   * @param clerkId - The Clerk ID of the authenticated entrepreneur
   * @param query - Query parameters for filtering, pagination, and sorting
   * @returns Paginated list of loan applications in simplified format
   *
   * @throws {401} If user is not authorized
   * @throws {404} If user not found
   * @throws {500} If listing fails
   */
  static async listForEntrepreneur(
    clerkId: string,
    query: LoanApplicationsModel.ExternalLoanApplicationListQuery = {}
  ): Promise<LoanApplicationsModel.ExternalLoanApplicationListResponse> {
    try {
      // Get the authenticated user
      const user = await db.query.users.findFirst({
        where: eq(users.clerkId, clerkId),
        columns: { id: true },
      });

      if (!user) {
        throw httpError(401, "[UNAUTHORIZED] User not found");
      }

      const page = query.page ? Number.parseInt(query.page) : 1;
      const limit = Math.min(query.limit ? Number.parseInt(query.limit) : 8, 50);
      const offset = (page - 1) * limit;

      // Build where conditions - only applications where user is the entrepreneur
      const whereConditions: any[] = [
        eq(loanApplications.entrepreneurId, user.id),
        isNull(loanApplications.deletedAt),
      ];

      // Status filter - map frontend status values to backend statuses
      if (query.status && query.status !== "all") {
        const statusMap: Record<string, string[]> = {
          pending: [
            "kyc_kyb_verification",
            "eligibility_check",
            "credit_analysis",
            "head_of_credit_review",
            "internal_approval_ceo",
            "committee_decision",
            "sme_offer_approval",
            "document_generation",
            "signing_execution",
            "awaiting_disbursement",
          ],
          approved: ["approved"],
          rejected: ["rejected"],
          disbursed: ["disbursed"],
          cancelled: ["cancelled"],
        };

        const backendStatuses = statusMap[query.status];
        if (backendStatuses) {
          whereConditions.push(
            or(...backendStatuses.map((s) => eq(loanApplications.status, s as any)))!
          );
        }
      }

      // Search filter
      if (query.search) {
        const searchTerm = `%${query.search}%`;
        whereConditions.push(
          or(
            like(loanApplications.loanId, searchTerm),
            like(loanProducts.name, searchTerm),
            like(loanApplications.fundingAmount, searchTerm)
          )!
        );
      }

      // Get total count
      const [{ total }] = await db
        .select({ total: count() })
        .from(loanApplications)
        .leftJoin(loanProducts, eq(loanApplications.loanProductId, loanProducts.id))
        .where(and(...whereConditions));

      // Build sort order
      let orderByClause;
      switch (query.sortBy || "newest") {
        case "oldest":
          orderByClause = asc(loanApplications.createdAt);
          break;
        case "ascending":
          orderByClause = asc(loanApplications.loanId);
          break;
        case "descending":
          orderByClause = desc(loanApplications.loanId);
          break;
        default: // newest
          orderByClause = desc(loanApplications.createdAt);
      }

      // Get applications with loan product data
      const applicationRows = await db
        .select({
          loanApplication: loanApplications,
          loanProductName: loanProducts.name,
          loanProductTermUnit: loanProducts.termUnit,
        })
        .from(loanApplications)
        .leftJoin(loanProducts, eq(loanApplications.loanProductId, loanProducts.id))
        .where(and(...whereConditions))
        .orderBy(orderByClause)
        .limit(limit)
        .offset(offset);

      // Map backend status to frontend status
      const mapStatusToFrontend = (
        backendStatus: string
      ): "pending" | "approved" | "rejected" | "disbursed" | "cancelled" => {
        const pendingStatuses = [
          "kyc_kyb_verification",
          "eligibility_check",
          "credit_analysis",
          "head_of_credit_review",
          "internal_approval_ceo",
          "committee_decision",
          "sme_offer_approval",
          "document_generation",
          "signing_execution",
          "awaiting_disbursement",
        ];
        if (pendingStatuses.includes(backendStatus)) return "pending";
        if (backendStatus === "approved") return "approved";
        if (backendStatus === "rejected") return "rejected";
        if (backendStatus === "disbursed") return "disbursed";
        if (backendStatus === "cancelled") return "cancelled";
        return "pending"; // Default fallback
      };

      // Format applications for external users
      const applications: LoanApplicationsModel.ExternalLoanApplicationListItem[] =
        applicationRows.map((row) => {
          const app = row.loanApplication;
          const termUnit = row.loanProductTermUnit || "months";
          const tenure = `${app.repaymentPeriod} ${termUnit}`;

          // Format amount with commas
          const amount = toNumber(app.fundingAmount) ?? 0;
          const formattedAmount = amount.toLocaleString("en-US", {
            maximumFractionDigits: 2,
            minimumFractionDigits: 0,
          });

          return {
            id: app.id,
            loanId: app.loanId,
            product: row.loanProductName || "Unknown Product",
            requestedAmount: formattedAmount,
            currency: app.fundingCurrency,
            tenure,
            status: mapStatusToFrontend(app.status),
            appliedOn: app.submittedAt?.toISOString() || app.createdAt.toISOString(),
          };
        });

      const totalPages = Math.ceil(total / limit);

      return {
        success: true,
        message: "Loan applications retrieved successfully",
        data: {
          applications,
          pagination: {
            currentPage: page,
            totalPages,
            totalItems: total,
            itemsPerPage: limit,
            hasNextPage: page < totalPages,
            hasPreviousPage: page > 1,
          },
        },
      };
    } catch (error: any) {
      logger.error("Error listing loan applications for entrepreneur:", error);
      if (error?.status) throw error;
      throw httpError(500, "[LIST_LOAN_APPLICATIONS_ERROR] Failed to list loan applications");
    }
  }

  /**
   * Get loan application detail for external users (entrepreneurs)
   * Returns application only if the authenticated user is the entrepreneur
   *
   * @description Retrieves detailed information about a specific loan application
   * for the authenticated entrepreneur. Simplified format matching frontend requirements.
   *
   * @param clerkId - The Clerk ID of the authenticated entrepreneur
   * @param applicationId - The loan application ID
   * @returns Detailed loan application information in simplified format
   *
   * @throws {403} If user is not the entrepreneur for this application
   * @throws {404} If loan application is not found
   * @throws {500} If retrieval fails
   */
  static async getByIdForEntrepreneur(
    clerkId: string,
    applicationId: string
  ): Promise<LoanApplicationsModel.ExternalLoanApplicationDetailResponse> {
    try {
      // Get the authenticated user
      const user = await db.query.users.findFirst({
        where: eq(users.clerkId, clerkId),
        columns: { id: true },
      });

      if (!user) {
        throw httpError(401, "[UNAUTHORIZED] User not found");
      }

      // Get loan application
      const [application] = await db
        .select()
        .from(loanApplications)
        .where(and(eq(loanApplications.id, applicationId), isNull(loanApplications.deletedAt)))
        .limit(1);

      if (!application) {
        throw httpError(404, "[LOAN_APPLICATION_NOT_FOUND] Loan application not found");
      }

      // Verify user is the entrepreneur
      if (application.entrepreneurId !== user.id) {
        throw httpError(
          403,
          "[FORBIDDEN] You do not have permission to view this loan application"
        );
      }

      // Get loan product for termUnit
      const loanProduct = await db.query.loanProducts.findFirst({
        where: and(eq(loanProducts.id, application.loanProductId), isNull(loanProducts.deletedAt)),
        columns: {
          name: true,
          termUnit: true,
        },
      });

      const termUnit = loanProduct?.termUnit || "months";
      const tenure = `${application.repaymentPeriod} ${termUnit}`;

      // Format amount with commas
      const amount = toNumber(application.fundingAmount) ?? 0;
      const formattedAmount = amount.toLocaleString("en-US", {
        maximumFractionDigits: 2,
        minimumFractionDigits: 0,
      });

      // Map backend status to frontend status
      const mapStatusToFrontend = (
        backendStatus: string
      ): "pending" | "approved" | "rejected" | "disbursed" | "cancelled" => {
        const pendingStatuses = [
          "kyc_kyb_verification",
          "eligibility_check",
          "credit_analysis",
          "head_of_credit_review",
          "internal_approval_ceo",
          "committee_decision",
          "sme_offer_approval",
          "document_generation",
          "signing_execution",
          "awaiting_disbursement",
        ];
        if (pendingStatuses.includes(backendStatus)) return "pending";
        if (backendStatus === "approved") return "approved";
        if (backendStatus === "rejected") return "rejected";
        if (backendStatus === "disbursed") return "disbursed";
        if (backendStatus === "cancelled") return "cancelled";
        return "pending"; // Default fallback
      };

      return {
        success: true,
        message: "Loan application retrieved successfully",
        data: {
          id: application.id,
          loanId: application.loanId,
          product: loanProduct?.name || "Unknown Product",
          requestedAmount: formattedAmount,
          currency: application.fundingCurrency,
          tenure,
          status: mapStatusToFrontend(application.status),
          appliedOn: application.submittedAt?.toISOString() || application.createdAt.toISOString(),
          // Additional detail fields
          fundingAmount: amount,
          repaymentPeriod: application.repaymentPeriod,
          termUnit,
          intendedUseOfFunds: application.intendedUseOfFunds,
          interestRate: toNumber(application.interestRate) ?? 0,
          submittedAt: application.submittedAt?.toISOString(),
          approvedAt: application.approvedAt?.toISOString(),
          rejectedAt: application.rejectedAt?.toISOString(),
          disbursedAt: application.disbursedAt?.toISOString(),
          cancelledAt: application.cancelledAt?.toISOString(),
          rejectionReason: application.rejectionReason ?? undefined,
        },
      };
    } catch (error: any) {
      logger.error("Error getting loan application for entrepreneur:", error);
      if (error?.status) throw error;
      throw httpError(500, "[GET_LOAN_APPLICATION_ERROR] Failed to get loan application");
    }
  }

  /**
   * Cancel a loan application
   * Only allows canceling applications in pending stages
   * Entrepreneurs can only cancel their own applications
   * Admins can cancel any application
   *
   * @description Cancels a loan application that is in a pending status.
   * Terminal states (approved, rejected, disbursed, cancelled) cannot be cancelled.
   *
   * @param clerkId - The Clerk ID of the authenticated user
   * @param applicationId - The loan application ID to cancel
   * @param reason - Optional reason for cancellation
   * @param isAdmin - Whether the user is an admin/member (true) or entrepreneur (false)
   * @param request - Optional FastifyRequest for extracting metadata
   * @returns Updated loan application detail
   *
   * @throws {400} If application is already in a terminal state
   * @throws {403} If entrepreneur tries to cancel another user's application
   * @throws {404} If loan application is not found
   * @throws {500} If cancellation fails
   */
  static async cancel(
    clerkId: string,
    applicationId: string,
    reason?: string,
    isAdminOrMember = false,
    request?: FastifyRequest
  ): Promise<LoanApplicationsModel.LoanApplicationDetail> {
    try {
      // Get the authenticated user
      const user = await db.query.users.findFirst({
        where: eq(users.clerkId, clerkId),
        columns: { id: true },
      });

      if (!user) {
        throw httpError(401, "[UNAUTHORIZED] User not found");
      }

      // Get the loan application
      const [application] = await db
        .select()
        .from(loanApplications)
        .where(and(eq(loanApplications.id, applicationId), isNull(loanApplications.deletedAt)))
        .limit(1);

      if (!application) {
        throw httpError(404, "[LOAN_APPLICATION_NOT_FOUND] Loan application not found");
      }

      // For entrepreneurs: verify they own the application
      if (!isAdminOrMember && application.entrepreneurId !== user.id) {
        throw httpError(
          403,
          "[FORBIDDEN] You do not have permission to cancel this loan application"
        );
      }

      // Define pending statuses (can be cancelled)
      const pendingStatuses = [
        "kyc_kyb_verification",
        "eligibility_check",
        "credit_analysis",
        "head_of_credit_review",
        "internal_approval_ceo",
        "committee_decision",
        "sme_offer_approval",
        "document_generation",
        "signing_execution",
        "awaiting_disbursement",
      ];

      // Define terminal states (cannot be cancelled)
      const terminalStates = ["approved", "rejected", "disbursed", "cancelled"];

      // Check if application is already cancelled
      if (application.status === "cancelled") {
        throw httpError(400, "[ALREADY_CANCELLED] Loan application is already cancelled");
      }

      // Check if application is in a terminal state (cannot be cancelled)
      if (terminalStates.includes(application.status)) {
        throw httpError(
          400,
          `[CANNOT_CANCEL] Cannot cancel loan application in terminal state: ${application.status}. Only pending applications can be cancelled.`
        );
      }

      // Verify application is in a pending state
      if (!pendingStatuses.includes(application.status)) {
        throw httpError(
          400,
          `[INVALID_STATUS] Loan application status "${application.status}" cannot be cancelled. Only pending applications can be cancelled.`
        );
      }

      // Prepare update data
      const now = new Date();
      const updateData: any = {
        status: "cancelled" as any,
        cancelledAt: now,
        lastUpdatedBy: user.id,
        lastUpdatedAt: now,
        updatedAt: now,
      };

      // Clear rejection reason if it exists (since we're cancelling, not rejecting)
      if (application.rejectionReason) {
        updateData.rejectionReason = null;
      }

      // Update the application
      await db
        .update(loanApplications)
        .set(updateData)
        .where(eq(loanApplications.id, applicationId));

      // Log audit event
      const eventTitle = LoanApplicationAuditService.getEventTitle("cancelled");
      const eventDescription = reason ? `${eventTitle}. Reason: ${reason}` : eventTitle;

      const requestMetadata = request
        ? LoanApplicationAuditService.extractRequestMetadata(request)
        : {};

      await LoanApplicationAuditService.logEvent({
        loanApplicationId: applicationId,
        clerkId,
        eventType: "cancelled",
        title: eventTitle,
        description: eventDescription,
        status: "cancelled",
        previousStatus: application.status,
        newStatus: "cancelled",
        details: {
          reason: reason || null,
        },
        ...requestMetadata,
      });

      // Return updated application detail
      return await LoanApplicationsService.getById(applicationId);
    } catch (error: any) {
      logger.error("Error cancelling loan application:", error);
      if (error?.status) throw error;
      throw httpError(500, "[CANCEL_LOAN_APPLICATION_ERROR] Failed to cancel loan application");
    }
  }

  static async getLoanDocuments(
    loanApplicationId: string
  ): Promise<LoanApplicationsModel.GetLoanDocumentsResponse> {
    try {
      const loanApp = await db.query.loanApplications.findFirst({
        where: and(eq(loanApplications.id, loanApplicationId), isNull(loanApplications.deletedAt)),
        columns: {
          termSheetUrl: true,
        },
      });

      if (!loanApp) {
        throw httpError(404, "[LOAN_APPLICATION_NOT_FOUND] Loan application not found");
      }

      const docs = await db.query.loanDocuments.findMany({
        where: and(eq(loanDocuments.loanApplicationId, loanApplicationId), isNull(loanDocuments.deletedAt)),
        orderBy: asc(loanDocuments.createdAt),
        columns: {
          id: true,
          documentType: true,
          docUrl: true,
          docName: true,
          notes: true,
          uploadedBy: true,
          createdAt: true,
        },
      });

      return {
        termSheetUrl: loanApp.termSheetUrl,
        documents: docs.map((d) => ({
          id: d.id,
          documentType: d.documentType,
          docUrl: d.docUrl,
          docName: d.docName ?? null,
          notes: d.notes ?? null,
          uploadedBy: d.uploadedBy,
          createdAt: d.createdAt.toISOString(),
        })),
      };
    } catch (error: any) {
      logger.error("Error getting loan documents:", error);
      if (error?.status) throw error;
      throw httpError(500, "[GET_LOAN_DOCUMENTS_ERROR] Failed to fetch loan documents");
    }
  }

  static async createCounterOffer(
    clerkId: string,
    applicationId: string,
    body: LoanApplicationsModel.CreateCounterOfferBody
  ): Promise<LoanApplicationsModel.LoanApplicationDetail> {
    try {
      return await db.transaction(async (tx) => {
        const application = await tx.query.loanApplications.findFirst({
          where: and(eq(loanApplications.id, applicationId), isNull(loanApplications.deletedAt)),
        });

        if (!application) {
          throw httpError(404, "[LOAN_APPLICATION_NOT_FOUND] Loan application not found");
        }

        const user = await tx.query.users.findFirst({
          where: eq(users.clerkId, clerkId),
          columns: { id: true },
        });

        if (!user) {
          throw httpError(401, "[UNAUTHORIZED] User not found");
        }

        const [newVersion] = await tx
          .insert(loanApplicationVersions)
          .values({
            loanApplicationId: applicationId,
            status: "counter_offer",
            fundingAmount: body.fundingAmount.toString(),
            repaymentPeriod: body.repaymentPeriod,
            returnType: body.returnType,
            interestRate: body.interestRate.toString(),
            repaymentStructure: body.repaymentStructure,
            repaymentCycle: body.repaymentCycle,
            gracePeriod: body.gracePeriod,
            firstPaymentDate: body.firstPaymentDate ? new Date(body.firstPaymentDate) : undefined,
            customFees: body.customFees || [],
            createdBy: user.id,
          })
          .returning();

        // Only transition to document_generation if not already there
        const newStatus = application.status === "document_generation" ? application.status : "document_generation";
        const shouldUpdateStatus = application.status !== "document_generation";

        await tx
          .update(loanApplications)
          .set({
            activeVersionId: newVersion.id,
            ...(shouldUpdateStatus && { status: newStatus }),
            lastUpdatedBy: user.id,
            lastUpdatedAt: new Date(),
          })
          .where(eq(loanApplications.id, applicationId));

        await LoanApplicationAuditService.logEvent({
          loanApplicationId: applicationId,
          clerkId,
          eventType: "counter_offer_proposed",
          title: "Counter-offer Proposed",
          description: "A counter-offer with revised terms has been proposed.",
          status: newStatus,
          ...(shouldUpdateStatus && { newStatus, previousStatus: application.status }),
          details: { newVersionId: newVersion.id, terms: body },
        });

        return await LoanApplicationsService.getById(applicationId);
      });
    } catch (error: any) {
      logger.error("Error creating counter-offer:", error);
      if (error?.status) throw error;
      throw httpError(500, "[CREATE_COUNTER_OFFER_ERROR] Failed to create counter-offer");
    }
  }
}
