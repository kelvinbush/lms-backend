import type { AdminSMEModel } from "./admin-sme.model";
import { db } from "../../db";
import { users, businessProfiles, smeOnboardingProgress } from "../../db/schema";
import { logger } from "../../utils/logger";
import { eq } from "drizzle-orm";
import { httpError } from "./admin-sme.utils";
import { AdminSMEStep1Service } from "./admin-sme.step1.service";
import { AdminSMEStep2Service } from "./admin-sme.step2.service";
import { AdminSMEStep3Service } from "./admin-sme.step3.service";
import { AdminSMEStep4Service } from "./admin-sme.step4.service";
import { AdminSMEStep5Service } from "./admin-sme.step5.service";

// Re-export step services for convenience
export { AdminSMEStep1Service } from "./admin-sme.step1.service";
export { AdminSMEStep2Service } from "./admin-sme.step2.service";
export { AdminSMEStep3Service } from "./admin-sme.step3.service";
export { AdminSMEStep4Service } from "./admin-sme.step4.service";
export { AdminSMEStep5Service } from "./admin-sme.step5.service";

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
}
