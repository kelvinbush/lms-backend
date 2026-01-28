import { and, desc, eq, inArray, isNull, like, notInArray, or, sql } from "drizzle-orm";
import { db } from "../../db";
import {
  adminSMEAuditTrail,
  businessCountries,
  businessDocuments,
  businessPhotos,
  businessProfiles,
  businessUserGroups,
  businessVideoLinks,
  personalDocuments,
  smeOnboardingProgress,
  userGroups,
  users,
} from "../../db/schema";
import { emailService } from "../../services/email.service";
import { logger } from "../../utils/logger";
import { AdminSMEInvitationService } from "./admin-sme.invitation.service";
import type { AdminSMEModel } from "./admin-sme.model";
import { AdminSMEStep1Service } from "./admin-sme.step1.service";
import { AdminSMEStep2Service } from "./admin-sme.step2.service";
import { AdminSMEStep3Service } from "./admin-sme.step3.service";
import { AdminSMEStep4Service } from "./admin-sme.step4.service";
import { AdminSMEStep5Service } from "./admin-sme.step5.service";
import { AdminSMEStep6Service } from "./admin-sme.step6.service";
import { AdminSMEStep7Service } from "./admin-sme.step7.service";
import { httpError } from "./admin-sme.utils";

// Re-export step services for convenience
export { AdminSMEStep1Service } from "./admin-sme.step1.service";
export { AdminSMEStep2Service } from "./admin-sme.step2.service";
export { AdminSMEStep3Service } from "./admin-sme.step3.service";
export { AdminSMEStep4Service } from "./admin-sme.step4.service";
export { AdminSMEStep5Service } from "./admin-sme.step5.service";
export { AdminSMEStep6Service } from "./admin-sme.step6.service";
export { AdminSMEStep7Service } from "./admin-sme.step7.service";
export { AdminSMEInvitationService } from "./admin-sme.invitation.service";

/**
 * Main Admin SME Service
 * Contains shared utilities and orchestrates step services
 */
export abstract class AdminSMEService {
  /**
   * Get current onboarding state for a user
   */
  static async getOnboardingState(userId: string): Promise<AdminSMEModel.OnboardingStateResponse> {
    try {
      // Execute all queries in parallel for better performance
      const [user, progress, business] = await Promise.all([
        db.query.users.findFirst({
          where: eq(users.id, userId),
        }),
        db.query.smeOnboardingProgress.findFirst({
          where: eq(smeOnboardingProgress.userId, userId),
        }),
        db.query.businessProfiles.findFirst({
          where: eq(businessProfiles.userId, userId),
        }),
      ]);

      if (!user) {
        throw httpError(404, "[USER_NOT_FOUND] User not found");
      }

      return {
        userId: user.id,
        currentStep: progress?.currentStep ?? null,
        completedSteps: (progress?.completedSteps as number[]) ?? [],
        user: {
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phoneNumber,
          dob: user.dob,
          gender: user.gender,
          position: user.position,
          onboardingStatus: user.onboardingStatus as string,
          idNumber: user.idNumber,
          taxNumber: user.taxNumber,
          idType: user.idType,
        },
        business: business
          ? {
              id: business.id,
              name: business.name,
              averageMonthlyTurnover: business.avgMonthlyTurnover
                ? Number(business.avgMonthlyTurnover)
                : null,
              averageYearlyTurnover: business.avgYearlyTurnover
                ? Number(business.avgYearlyTurnover)
                : null,
              previousLoans: business.borrowingHistory ?? null,
              loanAmount: business.amountBorrowed ? Number(business.amountBorrowed) : null,
              defaultCurrency: business.currency ?? null,
              recentLoanStatus: business.loanStatus ?? null,
              defaultReason: business.defaultReason ?? null,
            }
          : null,
      };
    } catch (error: any) {
      logger.error("[AdminSME] Error getting onboarding state", {
        error: error?.message,
        userId,
      });
      if (error?.status) throw error;
      throw httpError(500, "[GET_STATE_ERROR] Failed to get onboarding state");
    }
  }

  // Convenience methods that delegate to step services
  static async createSMEUser(
    payload: AdminSMEModel.Step1UserInfoBody
  ): Promise<AdminSMEModel.CreateUserResponse> {
    return AdminSMEStep1Service.createSMEUser(payload);
  }

  static async updateSMEUser(
    userId: string,
    payload: AdminSMEModel.Step1UserInfoBody
  ): Promise<AdminSMEModel.OnboardingStateResponse> {
    return AdminSMEStep1Service.updateSMEUser(userId, payload);
  }

  static async saveBusinessBasicInfo(
    userId: string,
    payload: AdminSMEModel.Step2BusinessBasicInfoBody
  ): Promise<AdminSMEModel.OnboardingStateResponse> {
    return AdminSMEStep2Service.saveBusinessBasicInfo(userId, payload);
  }

  static async saveLocationInfo(
    userId: string,
    payload: AdminSMEModel.Step3LocationInfoBody
  ): Promise<AdminSMEModel.OnboardingStateResponse> {
    return AdminSMEStep3Service.saveLocationInfo(userId, payload);
  }

  static async savePersonalDocuments(
    userId: string,
    payload: AdminSMEModel.Step4PersonalDocumentsBody
  ): Promise<AdminSMEModel.OnboardingStateResponse> {
    return AdminSMEStep4Service.savePersonalDocuments(userId, payload);
  }

  static async saveCompanyInfoDocuments(
    userId: string,
    payload: AdminSMEModel.Step5CompanyInfoDocumentsBody
  ): Promise<AdminSMEModel.OnboardingStateResponse> {
    return AdminSMEStep5Service.saveCompanyInfoDocuments(userId, payload);
  }

  static async saveFinancialDocuments(
    userId: string,
    payload: AdminSMEModel.Step6FinancialDocumentsBody
  ): Promise<AdminSMEModel.OnboardingStateResponse> {
    return AdminSMEStep6Service.saveFinancialDocuments(userId, payload);
  }

  static async savePermitAndPitchDocuments(
    userId: string,
    payload: AdminSMEModel.Step7PermitAndPitchDocumentsBody
  ): Promise<AdminSMEModel.OnboardingStateResponse> {
    return AdminSMEStep7Service.savePermitAndPitchDocuments(userId, payload);
  }

  static async sendSMEInvitation(
    userId: string,
    adminClerkId: string
  ): Promise<AdminSMEModel.InvitationResponse> {
    return AdminSMEInvitationService.sendSMEInvitation(userId, adminClerkId);
  }

  /**
   * List all SME users with optional filtering and pagination
   */
  static async listSMEUsers(
    query: AdminSMEModel.ListSMEUsersQuery
  ): Promise<AdminSMEModel.ListSMEUsersResponse> {
    try {
      const page = query.page ? Number.parseInt(query.page, 10) : 1;
      const limit = query.limit ? Number.parseInt(query.limit, 10) : 50;
      const offset = (page - 1) * limit;

      // Build where conditions
      const conditions: any[] = [isNull(users.deletedAt)];

      // Filter by onboarding status
      if (query.onboardingStatus) {
        conditions.push(eq(users.onboardingStatus, query.onboardingStatus as any));
      }

      // Search by email, firstName, or lastName
      if (query.search) {
        const searchTerm = `%${query.search}%`;
        const searchCondition = or(
          like(users.email, searchTerm),
          like(users.firstName, searchTerm),
          like(users.lastName, searchTerm)
        );
        if (searchCondition) {
          conditions.push(searchCondition);
        }
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      // Get total count
      const totalResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(users)
        .where(whereClause);
      const total = Number(totalResult[0]?.count || 0);

      // Get users with pagination
      const userRows = await db
        .select()
        .from(users)
        .where(whereClause)
        .orderBy(desc(users.createdAt))
        .limit(limit)
        .offset(offset);

      // Get onboarding progress for all users
      const userIds = userRows.map((u) => u.id);
      const progressMap = new Map<string, typeof smeOnboardingProgress.$inferSelect>();
      if (userIds.length > 0) {
        const progressRows = await db.query.smeOnboardingProgress.findMany({
          where: inArray(smeOnboardingProgress.userId, userIds),
        });
        progressRows.forEach((p) => {
          progressMap.set(p.userId, p);
        });
      }

      // Get businesses for all users
      const businessMap = new Map<string, typeof businessProfiles.$inferSelect>();
      if (userIds.length > 0) {
        const businessRows = await db.query.businessProfiles.findMany({
          where: inArray(businessProfiles.userId, userIds),
        });
        businessRows.forEach((b) => {
          businessMap.set(b.userId, b);
        });
      }

      // Transform to response format
      const items: AdminSMEModel.SMEUserListItem[] = userRows.map((user) => {
        const progress = progressMap.get(user.id);
        const business = businessMap.get(user.id);

        return {
          userId: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phoneNumber,
          onboardingStatus: user.onboardingStatus as "draft" | "pending_invitation" | "active",
          onboardingStep: user.onboardingStep,
          currentStep: progress?.currentStep ?? null,
          completedSteps: (progress?.completedSteps as number[]) ?? [],
          business: business
            ? {
                id: business.id,
                name: business.name,
              }
            : null,
          createdAt: user.createdAt?.toISOString() || new Date().toISOString(),
          updatedAt: user.updatedAt?.toISOString() || new Date().toISOString(),
        };
      });

      return {
        items,
        total,
        page,
        limit,
      };
    } catch (error: any) {
      logger.error("[AdminSME] Error listing SME users", {
        error: error?.message,
        query,
      });
      if (error?.status) throw error;
      throw httpError(500, "[LIST_USERS_ERROR] Failed to list SME users");
    }
  }

  /**
   * List entrepreneurs for admin table view
   */
  static async listEntrepreneurs(
    query: AdminSMEModel.ListSMEUsersQuery
  ): Promise<AdminSMEModel.EntrepreneurListResponse> {
    try {
      const page = query.page ? Number.parseInt(query.page, 10) : 1;
      const limit = query.limit ? Number.parseInt(query.limit, 10) : 50;
      const offset = (page - 1) * limit;

      // Build where conditions (reuse logic from listSMEUsers)
      const conditions: any[] = [isNull(users.deletedAt)];

      if (query.onboardingStatus) {
        conditions.push(eq(users.onboardingStatus, query.onboardingStatus as any));
      }

      if (query.search) {
        const searchTerm = `%${query.search}%`;
        const searchCondition = or(
          like(users.email, searchTerm),
          like(users.firstName, searchTerm),
          like(users.lastName, searchTerm)
        );
        if (searchCondition) {
          conditions.push(searchCondition);
        }
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      // Total count
      const totalResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(users)
        .where(whereClause);
      const total = Number(totalResult[0]?.count || 0);

      // Users page
      const userRows = await db
        .select()
        .from(users)
        .where(whereClause)
        .orderBy(desc(users.createdAt))
        .limit(limit)
        .offset(offset);

      const userIds = userRows.map((u) => u.id);

      // Progress
      const progressMap = new Map<string, typeof smeOnboardingProgress.$inferSelect>();
      if (userIds.length > 0) {
        const progressRows = await db.query.smeOnboardingProgress.findMany({
          where: inArray(smeOnboardingProgress.userId, userIds),
        });
        progressRows.forEach((p) => {
          progressMap.set(p.userId, p);
        });
      }

      // Businesses
      const businessByUserId = new Map<string, typeof businessProfiles.$inferSelect>();
      const businessIds: string[] = [];
      if (userIds.length > 0) {
        const businessRows = await db.query.businessProfiles.findMany({
          where: inArray(businessProfiles.userId, userIds),
        });
        businessRows.forEach((b) => {
          businessByUserId.set(b.userId, b);
          businessIds.push(b.id);
        });
      }

      // User groups (programs) per business
      const userGroupsByBusinessId = new Map<string, { id: string; name: string }[]>();
      if (businessIds.length > 0) {
        const groupRows = await db
          .select({
            businessId: businessUserGroups.businessId,
            id: userGroups.id,
            name: userGroups.name,
          })
          .from(businessUserGroups)
          .innerJoin(userGroups, eq(businessUserGroups.groupId, userGroups.id))
          .where(inArray(businessUserGroups.businessId, businessIds));

        for (const row of groupRows) {
          const arr = userGroupsByBusinessId.get(row.businessId) ?? [];
          arr.push({ id: row.id, name: row.name });
          userGroupsByBusinessId.set(row.businessId, arr);
        }
      }

      const TOTAL_STEPS = 7;

      // Only include users that have at least one business profile
      const usersWithBusiness = userRows.filter((user) => businessByUserId.has(user.id));

      const items: AdminSMEModel.EntrepreneurListItem[] = usersWithBusiness.map((user) => {
        const progress = progressMap.get(user.id);
        const business = businessByUserId.get(user.id);
        const completedSteps = (progress?.completedSteps as number[]) ?? [];
        const completedCount = completedSteps.length;
        const businessProfileProgress =
          TOTAL_STEPS > 0 ? Math.round((completedCount / TOTAL_STEPS) * 100) : 0;

        const groups =
          business && userGroupsByBusinessId.get(business.id)
            ? userGroupsByBusinessId.get(business.id)!
            : [];

        return {
          userId: user.id,
          createdAt: user.createdAt?.toISOString() || new Date().toISOString(),
          imageUrl: user.imageUrl || null,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phoneNumber,
          onboardingStatus: user.onboardingStatus as "draft" | "pending_invitation" | "active",
          businessProfileProgress,
          business: business
            ? {
                id: business.id,
                name: business.name,
                sectors:
                  (business.sectors as string[]) ?? (business.sector ? [business.sector] : []),
                country: business.country,
              }
            : null,
          userGroups: groups,
          hasCompleteProfile: completedCount === TOTAL_STEPS,
          hasPendingActivation: user.onboardingStatus === "pending_invitation",
        };
      });

      return {
        items,
        total,
        page,
        limit,
      };
    } catch (error: any) {
      logger.error("[AdminSME] Error listing entrepreneurs", {
        error: error?.message,
        query,
      });
      if (error?.status) throw error;
      throw httpError(500, "[LIST_ENTREPRENEURS_ERROR] Failed to list entrepreneurs");
    }
  }

  /**
   * Update entrepreneur details (consolidated endpoint)
   * Updates all user personal details including core info and metadata fields in a single transaction
   */
  static async updateEntrepreneurDetails(
    userId: string,
    payload: AdminSMEModel.UpdateEntrepreneurDetailsBody
  ): Promise<AdminSMEModel.UpdateEntrepreneurDetailsResponse> {
    try {
      // Verify user exists
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
      });

      if (!user) {
        throw httpError(404, "[USER_NOT_FOUND] User not found");
      }

      // Check if email is being changed and if new email already exists
      if (payload.email !== user.email) {
        const existingWithEmail = await db.query.users.findFirst({
          where: eq(users.email, payload.email),
        });
        if (existingWithEmail && existingWithEmail.id !== userId) {
          throw httpError(409, "[EMAIL_EXISTS] User with this email already exists");
        }
      }

      // Ensure dob is a Date object or null
      const dob =
        payload.dob === undefined || payload.dob === null
          ? null
          : typeof payload.dob === "string"
            ? new Date(payload.dob)
            : payload.dob;

      // Validate dob is not in the future
      if (dob && dob > new Date()) {
        throw httpError(400, "[INVALID_DOB] Date of birth cannot be in the future");
      }

      // Update user in a single transaction
      const { updatedUser } = await db.transaction(async (tx) => {
        // Single update with all fields
        const [userResult] = await tx
          .update(users)
          .set({
            email: payload.email,
            firstName: payload.firstName,
            lastName: payload.lastName,
            phoneNumber: payload.phone || null,
            dob: dob,
            gender: payload.gender,
            position: payload.position ?? null,
            idNumber: payload.idNumber ?? null,
            taxNumber: payload.taxNumber ?? null,
            idType: payload.idType ?? null,
            updatedAt: new Date(),
          } as any)
          .where(eq(users.id, userId))
          .returning();

        return { updatedUser: userResult };
      });

      logger.info("[AdminSME] Entrepreneur details updated", {
        userId,
        email: updatedUser.email,
      });

      return {
        userId: updatedUser.id,
        user: {
          email: updatedUser.email,
          firstName: updatedUser.firstName || "",
          lastName: updatedUser.lastName || "",
          phone: updatedUser.phoneNumber,
          dob: updatedUser.dob,
          gender: updatedUser.gender,
          position: updatedUser.position,
          idNumber: updatedUser.idNumber,
          taxNumber: updatedUser.taxNumber,
          idType: updatedUser.idType,
          onboardingStatus: updatedUser.onboardingStatus as string,
        },
      };
    } catch (error: any) {
      logger.error("[AdminSME] Error updating entrepreneur details", {
        error: error?.message,
        userId,
      });
      if (error?.status) throw error;
      throw httpError(
        500,
        "[UPDATE_ENTREPRENEUR_DETAILS_ERROR] Failed to update entrepreneur details"
      );
    }
  }

  /**
   * Save financial details (business financial summary) for an SME user
   */
  static async saveFinancialDetails(
    userId: string,
    payload: AdminSMEModel.SaveFinancialDetailsBody
  ): Promise<AdminSMEModel.OnboardingStateResponse> {
    try {
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
      });

      if (!user) {
        throw httpError(404, "[USER_NOT_FOUND] User not found");
      }

      const business = await db.query.businessProfiles.findFirst({
        where: eq(businessProfiles.userId, userId),
      });

      if (!business) {
        throw httpError(404, "[BUSINESS_NOT_FOUND] Business not found for financial details");
      }

      await db
        .update(businessProfiles)
        .set({
          avgMonthlyTurnover:
            payload.averageMonthlyTurnover !== undefined && payload.averageMonthlyTurnover !== null
              ? (payload.averageMonthlyTurnover as any)
              : null,
          avgYearlyTurnover:
            payload.averageYearlyTurnover !== undefined && payload.averageYearlyTurnover !== null
              ? (payload.averageYearlyTurnover as any)
              : null,
          borrowingHistory:
            payload.previousLoans !== undefined ? payload.previousLoans : business.borrowingHistory,
          amountBorrowed:
            payload.loanAmount !== undefined && payload.loanAmount !== null
              ? (payload.loanAmount as any)
              : null,
          currency:
            payload.defaultCurrency !== undefined ? payload.defaultCurrency : business.currency,
          loanStatus:
            payload.recentLoanStatus !== undefined
              ? (payload.recentLoanStatus as string | null)
              : business.loanStatus,
          defaultReason:
            payload.defaultReason !== undefined ? payload.defaultReason : business.defaultReason,
          updatedAt: new Date(),
        } as any)
        .where(eq(businessProfiles.id, business.id));

      logger.info("[AdminSME] Financial details updated", {
        userId,
        businessId: business.id,
      });

      // Return updated onboarding state (used by admin screens)
      return await AdminSMEService.getOnboardingState(userId);
    } catch (error: any) {
      logger.error("[AdminSME] Error saving financial details", {
        error: error?.message,
        userId,
      });
      if (error?.status) throw error;
      throw httpError(500, "[SAVE_FINANCIAL_DETAILS_ERROR] Failed to save financial details");
    }
  }

  /**
   * Get aggregated stats for entrepreneurs (SMEs) for admin dashboard
   * For now, we compute stats for the current calendar month vs previous month.
   */
  static async getEntrepreneursStats(): Promise<AdminSMEModel.EntrepreneursStatsResponse> {
    try {
      const now = new Date();
      const currentStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const currentEnd = now;
      const previousStart = new Date(
        currentStart.getFullYear(),
        currentStart.getMonth() - 1,
        1,
        0,
        0,
        0,
        0
      );
      const previousEnd = new Date(currentStart.getTime() - 1);

      const formatPeriod = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

      const period = {
        current: formatPeriod(currentStart),
        previous: formatPeriod(previousStart),
      };

      const isEntrepreneurCondition = and(
        isNull(users.deletedAt),
      );

      const buildWhereForPeriod = (start: Date, end: Date) =>
        and(
          isEntrepreneurCondition,
          sql`users.created_at BETWEEN ${start.toISOString()} AND ${end.toISOString()}`
        );

      const [currentAgg, previousAgg] = await Promise.all([
        AdminSMEService.computeEntrepreneurAggregates(
          buildWhereForPeriod(currentStart, currentEnd)
        ),
        AdminSMEService.computeEntrepreneurAggregates(
          buildWhereForPeriod(previousStart, previousEnd)
        ),
      ]);

      function delta(current: number, previous: number): number {
        if (previous === 0) {
          return current > 0 ? 100 : 0;
        }
        return ((current - previous) / previous) * 100;
      }

      return {
        period,
        totalSMEs: {
          value: currentAgg.total,
          deltaPercent: delta(currentAgg.total, previousAgg.total),
        },
        completeProfiles: {
          value: currentAgg.completeProfiles,
          deltaPercent: delta(currentAgg.completeProfiles, previousAgg.completeProfiles),
        },
        incompleteProfiles: {
          value: currentAgg.incompleteProfiles,
          deltaPercent: delta(currentAgg.incompleteProfiles, previousAgg.incompleteProfiles),
        },
        pendingActivation: {
          value: currentAgg.pendingActivation,
          deltaPercent: delta(currentAgg.pendingActivation, previousAgg.pendingActivation),
        },
        smesWithLoans: {
          value: currentAgg.smesWithLoans,
          deltaPercent: delta(currentAgg.smesWithLoans, previousAgg.smesWithLoans),
        },
      };
    } catch (error: any) {
      logger.error("[AdminSME] Error getting entrepreneurs stats", {
        error: error?.message,
      });
      if (error?.status) throw error;
      throw httpError(500, "[GET_ENTREPRENEURS_STATS_ERROR] Failed to get entrepreneurs stats");
    }
  }

  /**
   * Helper to compute aggregates for a given period filter
   */
  private static async computeEntrepreneurAggregates(whereClause: any): Promise<{
    total: number;
    completeProfiles: number;
    incompleteProfiles: number;
    pendingActivation: number;
    smesWithLoans: number;
  }> {
    // Total, complete, pendingActivation in one aggregate query
    // Only count users that have at least one associated business profile
    const [row] = await db
      .select({
        total: sql<number>`count(distinct "users"."id")`,
        completeProfiles: sql<number>`count(distinct "users"."id") filter (
          where jsonb_array_length("sme_onboarding_progress"."completed_steps") = 7
        )`,
        pendingActivation: sql<number>`count(distinct "users"."id") filter (
          where "users"."onboarding_status" = 'pending_invitation'
        )`,
      })
      .from(users)
      .innerJoin(businessProfiles, eq(businessProfiles.userId, users.id))
      .leftJoin(smeOnboardingProgress, eq(smeOnboardingProgress.userId, users.id))
      .where(whereClause);

    const total = Number(row?.total || 0);
    const completeProfiles = Number(row?.completeProfiles || 0);
    const pendingActivation = Number(row?.pendingActivation || 0);
    const incompleteProfiles = Math.max(total - completeProfiles, 0);

    // TODO: Re-implement when loan applications are re-implemented
    // SMEs with loans: count distinct users that have at least one loan application
    // const [loanRow] = await db
    //   .select({
    //     count: sql<number>`count(distinct "users"."id")`,
    //   })
    //   .from(users)
    //   .innerJoin(
    //     loanApplications,
    //     and(eq(loanApplications.userId, users.id), isNull(loanApplications.deletedAt))
    //   )
    //   .where(whereClause);
    // const smesWithLoans = Number(loanRow?.count || 0);
    const smesWithLoans = 0; // TODO: Re-implement when loan applications are re-implemented

    return {
      total,
      completeProfiles,
      incompleteProfiles,
      pendingActivation,
      smesWithLoans,
    };
  }

  /**
   * Get detailed information about a single SME user
   */
  static async getSMEUserDetail(userId: string): Promise<AdminSMEModel.GetSMEUserDetailResponse> {
    try {
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
      });

      if (!user) {
        throw httpError(404, "[USER_NOT_FOUND] User not found");
      }

      const progress = await db.query.smeOnboardingProgress.findFirst({
        where: eq(smeOnboardingProgress.userId, userId),
      });

      const business = await db.query.businessProfiles.findFirst({
        where: eq(businessProfiles.userId, userId),
      });

      // If business exists, load related data needed for detailed response
      let userGroupNames: string[] = [];
      let countriesOfOperation: string[] = [];
      let videoLinks: { url: string; source: string | null }[] = [];
      let photos: string[] = [];

      if (business) {
        const [groupRows, countryRows, videoRows, photoRows] = await Promise.all([
          db
            .select({
              name: userGroups.name,
            })
            .from(businessUserGroups)
            .innerJoin(userGroups, eq(userGroups.id, businessUserGroups.groupId))
            .where(eq(businessUserGroups.businessId, business.id)),
          db.query.businessCountries.findMany({
            where: eq(businessCountries.businessId, business.id),
            columns: {
              country: true,
            },
          }),
          db.query.businessVideoLinks.findMany({
            where: and(
              eq(businessVideoLinks.businessId, business.id),
              isNull(businessVideoLinks.deletedAt)
            ),
            columns: {
              videoUrl: true,
              source: true,
              displayOrder: true,
            },
            orderBy: (tbl, { asc }) => [asc(tbl.displayOrder)],
          }),
          db.query.businessPhotos.findMany({
            where: and(
              eq(businessPhotos.businessId, business.id),
              isNull(businessPhotos.deletedAt)
            ),
            columns: {
              photoUrl: true,
              displayOrder: true,
            },
            orderBy: (tbl, { asc }) => [asc(tbl.displayOrder)],
          }),
        ]);

        userGroupNames = groupRows.map((g) => g.name);
        countriesOfOperation = countryRows.map((c) => c.country);
        videoLinks = videoRows.map((v) => ({
          url: v.videoUrl,
          source: v.source ?? null,
        }));
        photos = photoRows.map((p) => p.photoUrl);
      }

      return {
        userId: user.id,
        currentStep: progress?.currentStep ?? null,
        completedSteps: (progress?.completedSteps as number[]) ?? [],
        user: {
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phoneNumber,
          dob: user.dob,
          gender: user.gender,
          position: user.position,
          onboardingStatus: user.onboardingStatus as string,
          idNumber: user.idNumber,
          taxNumber: user.taxNumber,
          idType: user.idType,
        },
        business: business
          ? {
              id: business.id,
              name: business.name,
              entityType: business.entityType,
              logo: business.logo,
              sectors: (business.sectors as string[]) ?? null,
              description: business.description,
              yearOfIncorporation: business.yearOfIncorporation
                ? Number.parseInt(business.yearOfIncorporation, 10)
                : null,
              city: business.city,
              country: business.country,
              companyHQ: business.companyHQ,
              noOfEmployees: business.noOfEmployees ?? null,
              website: business.website ?? null,
              selectionCriteria: (business.selectionCriteria as string[]) ?? null,
              userGroupNames,
              // Financial details
              averageMonthlyTurnover: business.avgMonthlyTurnover
                ? Number(business.avgMonthlyTurnover)
                : null,
              averageYearlyTurnover: business.avgYearlyTurnover
                ? Number(business.avgYearlyTurnover)
                : null,
              previousLoans: business.borrowingHistory ?? null,
              loanAmount: business.amountBorrowed ? Number(business.amountBorrowed) : null,
              defaultCurrency: business.currency ?? null,
              recentLoanStatus: business.loanStatus ?? null,
              defaultReason: business.defaultReason ?? null,
              countriesOfOperation: countriesOfOperation.length > 0 ? countriesOfOperation : null,
              registeredOfficeAddress: business.registeredOfficeAddress ?? null,
              registeredOfficeCity: business.registeredOfficeCity ?? null,
              registeredOfficeZipCode: business.registeredOfficeZipCode ?? null,
              videoLinks,
              businessPhotos: photos,
              createdAt: business.createdAt?.toISOString() || null,
              updatedAt: business.updatedAt?.toISOString() || null,
            }
          : null,
      };
    } catch (error: any) {
      logger.error("[AdminSME] Error getting SME user detail", {
        error: error?.message,
        userId,
      });
      if (error?.status) throw error;
      throw httpError(500, "[GET_USER_DETAIL_ERROR] Failed to get SME user detail");
    }
  }

  /**
   * Send a direct email from an admin to an SME user using the standard email layout.
   */
  static async sendEmailToSMEUser(
    userId: string,
    body: AdminSMEModel.SendSMEEmailBody
  ): Promise<AdminSMEModel.SendSMEEmailResponse> {
    try {
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
      });

      if (!user) {
        throw httpError(404, "[USER_NOT_FOUND] User not found");
      }

      if (!user.email) {
        throw httpError(400, "[USER_EMAIL_MISSING] SME user does not have an email address");
      }

      const { subject, bodyHtml } = body;

      const result = await emailService.sendAdminSMEEmail({
        to: user.email,
        firstName: user.firstName,
        subject,
        bodyHtml,
      });

      if (!result.success) {
        throw httpError(
          500,
          result.error || "[EMAIL_SEND_FAILED] Failed to send email to SME user"
        );
      }

      return {
        success: true,
        messageId: result.messageId,
      };
    } catch (error: any) {
      logger.error("[AdminSME] Error sending email to SME user", {
        error: error?.message,
        userId,
      });
      if (error?.status) throw error;
      throw httpError(500, "[SEND_SME_EMAIL_ERROR] Failed to send email to SME user");
    }
  }

  /**
   * Get personal documents for an SME user
   */
  static async getPersonalDocuments(
    userId: string
  ): Promise<AdminSMEModel.ListPersonalDocumentsResponse> {
    try {
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
      });

      if (!user) {
        throw httpError(404, "[USER_NOT_FOUND] User not found");
      }

      const docs = await db.query.personalDocuments.findMany({
        where: and(eq(personalDocuments.userId, userId), isNull(personalDocuments.deletedAt)),
        columns: {
          id: true,
          docType: true,
          docUrl: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: (docs, { desc }) => [desc(docs.createdAt)],
      });

      return {
        success: true,
        message: "Personal documents retrieved successfully",
        data: docs.map((doc) => ({
          id: doc.id,
          docType: doc.docType || "",
          docUrl: doc.docUrl || "",
          createdAt: doc.createdAt?.toISOString() || "",
          updatedAt: doc.updatedAt?.toISOString() || "",
        })),
      };
    } catch (error: any) {
      logger.error("[AdminSME] Error getting personal documents", {
        error: error?.message,
        userId,
      });
      if (error?.status) throw error;
      throw httpError(500, "[GET_PERSONAL_DOCS_ERROR] Failed to get personal documents");
    }
  }

  /**
   * Get business documents for an SME user
   */
  static async getBusinessDocuments(
    userId: string
  ): Promise<AdminSMEModel.ListBusinessDocumentsResponse> {
    try {
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
      });

      if (!user) {
        throw httpError(404, "[USER_NOT_FOUND] User not found");
      }

      const business = await db.query.businessProfiles.findFirst({
        where: eq(businessProfiles.userId, userId),
      });

      if (!business) {
        return {
          success: true,
          message: "Business documents retrieved successfully",
          data: [],
        };
      }

      const docs = await db.query.businessDocuments.findMany({
        where: and(
          eq(businessDocuments.businessId, business.id),
          isNull(businessDocuments.deletedAt)
        ),
        columns: {
          id: true,
          docType: true,
          docUrl: true,
          isPasswordProtected: true,
          docPassword: true,
          docBankName: true,
          docYear: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: (docs, { desc }) => [desc(docs.createdAt)],
      });

      return {
        success: true,
        message: "Business documents retrieved successfully",
        data: docs.map((doc) => ({
          id: doc.id,
          docType: doc.docType,
          docUrl: doc.docUrl || "",
          isPasswordProtected: doc.isPasswordProtected || false,
          docPassword: doc.docPassword || null,
          docBankName: doc.docBankName || null,
          docYear: doc.docYear || null,
          createdAt: doc.createdAt?.toISOString() || "",
          updatedAt: doc.updatedAt?.toISOString() || "",
        })),
      };
    } catch (error: any) {
      logger.error("[AdminSME] Error getting business documents", {
        error: error?.message,
        userId,
      });
      if (error?.status) throw error;
      throw httpError(500, "[GET_BUSINESS_DOCS_ERROR] Failed to get business documents");
    }
  }

  /**
   * Get audit trail for a specific SME user
   */
  static async getAuditTrail(
    smeUserId: string,
    query: AdminSMEModel.ListAuditTrailQuery
  ): Promise<AdminSMEModel.ListAuditTrailResponse> {
    try {
      // Verify SME user exists
      const smeUser = await db.query.users.findFirst({
        where: eq(users.id, smeUserId),
        columns: { id: true },
      });

      if (!smeUser) {
        throw httpError(404, "[USER_NOT_FOUND] SME user not found");
      }

      const page = query.page ? Number.parseInt(query.page, 10) : 1;
      const limit = query.limit ? Number.parseInt(query.limit, 10) : 50;
      const offset = (page - 1) * limit;

      // Build where conditions
      const conditions: any[] = [eq(adminSMEAuditTrail.smeUserId, smeUserId)];

      // Filter by action type
      if (query.action) {
        conditions.push(eq(adminSMEAuditTrail.action, query.action as any));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      // Get total count
      const totalResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(adminSMEAuditTrail)
        .where(whereClause);
      const total = Number(totalResult[0]?.count || 0);

      // Get audit trail entries with pagination
      const auditRows = await db
        .select()
        .from(adminSMEAuditTrail)
        .where(whereClause)
        .orderBy(desc(adminSMEAuditTrail.createdAt))
        .limit(limit)
        .offset(offset);

      // Get admin users for all entries
      const adminUserIds = [...new Set(auditRows.map((a) => a.adminUserId))];
      const adminUserMap = new Map<
        string,
        { id: string; email: string; firstName: string | null; lastName: string | null }
      >();
      if (adminUserIds.length > 0) {
        const adminUsers = await db.query.users.findMany({
          where: inArray(users.id, adminUserIds),
          columns: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        });
        adminUsers.forEach((u) => {
          adminUserMap.set(u.id, u);
        });
      }

      // Helper to parse JSON and return null for empty objects
      const parseJsonOrNull = (jsonString: string | null): Record<string, any> | null => {
        if (!jsonString) return null;
        try {
          const parsed = JSON.parse(jsonString);
          // Return null for empty objects instead of {}
          if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
            return Object.keys(parsed).length > 0 ? parsed : null;
          }
          return parsed;
        } catch {
          return null;
        }
      };

      // Transform to response format
      const items: AdminSMEModel.AuditTrailItem[] = auditRows.map((entry) => {
        const adminUser = adminUserMap.get(entry.adminUserId);

        return {
          id: entry.id,
          action: entry.action,
          description: entry.description || null,
          details: parseJsonOrNull(entry.details),
          beforeData: parseJsonOrNull(entry.beforeData),
          afterData: parseJsonOrNull(entry.afterData),
          adminUser: {
            id: adminUser?.id || entry.adminUserId,
            email: adminUser?.email || "Unknown",
            firstName: adminUser?.firstName || null,
            lastName: adminUser?.lastName || null,
          },
          ipAddress: entry.ipAddress || null,
          userAgent: entry.userAgent || null,
          createdAt: entry.createdAt.toISOString(),
        };
      });

      const totalPages = Math.ceil(total / limit);

      return {
        items,
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
      };
    } catch (error: any) {
      logger.error("[AdminSME] Error getting audit trail", {
        error: error?.message,
        smeUserId,
      });
      if (error?.status) throw error;
      throw httpError(500, "[GET_AUDIT_TRAIL_ERROR] Failed to get audit trail");
    }
  }
}
