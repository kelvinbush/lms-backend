import type { AdminSMEModel } from "./admin-sme.model";
import { db } from "../../db";
import { users, businessProfiles, smeOnboardingProgress } from "../../db/schema";
import { logger } from "../../utils/logger";
import { eq, and, isNull, or, like, sql, inArray, desc } from "drizzle-orm";
import { httpError } from "./admin-sme.utils";
import { AdminSMEStep1Service } from "./admin-sme.step1.service";
import { AdminSMEStep2Service } from "./admin-sme.step2.service";
import { AdminSMEStep3Service } from "./admin-sme.step3.service";
import { AdminSMEStep4Service } from "./admin-sme.step4.service";
import { AdminSMEStep5Service } from "./admin-sme.step5.service";
import { AdminSMEStep6Service } from "./admin-sme.step6.service";
import { AdminSMEStep7Service } from "./admin-sme.step7.service";
import { AdminSMEInvitationService } from "./admin-sme.invitation.service";

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
  static async getOnboardingState(
    userId: string,
  ): Promise<AdminSMEModel.OnboardingStateResponse> {
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

      // Get business if it exists
      const business = await db.query.businessProfiles.findFirst({
        where: eq(businessProfiles.userId, userId),
      });

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
        },
        business: business
          ? {
              id: business.id,
              name: business.name,
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
    payload: AdminSMEModel.Step1UserInfoBody,
  ): Promise<AdminSMEModel.CreateUserResponse> {
    return AdminSMEStep1Service.createSMEUser(payload);
  }

  static async updateSMEUser(
    userId: string,
    payload: AdminSMEModel.Step1UserInfoBody,
  ): Promise<AdminSMEModel.OnboardingStateResponse> {
    return AdminSMEStep1Service.updateSMEUser(userId, payload);
  }

  static async saveBusinessBasicInfo(
    userId: string,
    payload: AdminSMEModel.Step2BusinessBasicInfoBody,
  ): Promise<AdminSMEModel.OnboardingStateResponse> {
    return AdminSMEStep2Service.saveBusinessBasicInfo(userId, payload);
  }

  static async saveLocationInfo(
    userId: string,
    payload: AdminSMEModel.Step3LocationInfoBody,
  ): Promise<AdminSMEModel.OnboardingStateResponse> {
    return AdminSMEStep3Service.saveLocationInfo(userId, payload);
  }

  static async savePersonalDocuments(
    userId: string,
    payload: AdminSMEModel.Step4PersonalDocumentsBody,
  ): Promise<AdminSMEModel.OnboardingStateResponse> {
    return AdminSMEStep4Service.savePersonalDocuments(userId, payload);
  }

  static async saveCompanyInfoDocuments(
    userId: string,
    payload: AdminSMEModel.Step5CompanyInfoDocumentsBody,
  ): Promise<AdminSMEModel.OnboardingStateResponse> {
    return AdminSMEStep5Service.saveCompanyInfoDocuments(userId, payload);
  }

  static async saveFinancialDocuments(
    userId: string,
    payload: AdminSMEModel.Step6FinancialDocumentsBody,
  ): Promise<AdminSMEModel.OnboardingStateResponse> {
    return AdminSMEStep6Service.saveFinancialDocuments(userId, payload);
  }

  static async savePermitAndPitchDocuments(
    userId: string,
    payload: AdminSMEModel.Step7PermitAndPitchDocumentsBody,
  ): Promise<AdminSMEModel.OnboardingStateResponse> {
    return AdminSMEStep7Service.savePermitAndPitchDocuments(userId, payload);
  }

  static async sendSMEInvitation(
    userId: string,
    adminClerkId: string,
  ): Promise<AdminSMEModel.InvitationResponse> {
    return AdminSMEInvitationService.sendSMEInvitation(userId, adminClerkId);
  }

  /**
   * List all SME users with optional filtering and pagination
   */
  static async listSMEUsers(
    query: AdminSMEModel.ListSMEUsersQuery,
  ): Promise<AdminSMEModel.ListSMEUsersResponse> {
    try {
      const page = query.page ? parseInt(query.page, 10) : 1;
      const limit = query.limit ? parseInt(query.limit, 10) : 50;
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
          like(users.lastName, searchTerm),
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
   * Get detailed information about a single SME user
   */
  static async getSMEUserDetail(
    userId: string,
  ): Promise<AdminSMEModel.GetSMEUserDetailResponse> {
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
                ? parseInt(business.yearOfIncorporation, 10)
                : null,
              city: business.city,
              country: business.country,
              companyHQ: business.companyHQ,
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
}
