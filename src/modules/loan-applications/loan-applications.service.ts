import { and, asc, count, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "../../db";
import {
  businessProfiles,
  loanApplications,
  loanProducts,
  organizations,
  users,
} from "../../db/schema";
import { logger } from "../../utils/logger";
import {
  generateLoanId,
  mapCreateLoanApplicationResponse,
  mapLoanApplicationDetail,
  mapLoanApplicationRow,
} from "./loan-applications.mapper";
import type { LoanApplicationsModel } from "./loan-applications.model";
import { buildBaseWhereConditions, buildSearchConditions } from "./loan-applications.query-builder";
import { calculateStatsWithChanges } from "./loan-applications.stats";
import { validateLoanApplicationCreation } from "./loan-applications.validators";
import { LoanApplicationAuditService } from "./loan-applications-audit.service";

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
   *
   * @param clerkId - The ID of the user creating the application
   * @param body - Loan application creation data
   * @returns Created loan application
   *
   * @throws {400} If application data is invalid
   * @throws {401} If user is not authorized
   * @throws {404} If business, entrepreneur, or loan product not found
   * @throws {500} If creation fails
   */
  static async create(
    clerkId: string,
    body: LoanApplicationsModel.CreateLoanApplicationBody
  ): Promise<LoanApplicationsModel.CreateLoanApplicationResponse> {
    try {
      // Validate all input data
      const { user, loanProduct } = await validateLoanApplicationCreation(clerkId, body);

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
      const [business, entrepreneur, loanProduct, creator, lastUpdatedByUser] = await Promise.all([
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

      // Return updated application detail
      return await LoanApplicationsService.getById(applicationId);
    } catch (error: any) {
      logger.error("Error updating loan application status:", error);
      if (error?.status) throw error;
      throw httpError(500, "[UPDATE_STATUS_ERROR] Failed to update loan application status");
    }
  }
}
