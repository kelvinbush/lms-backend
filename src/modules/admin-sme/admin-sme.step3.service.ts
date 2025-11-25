import type { AdminSMEModel } from "./admin-sme.model";
import { db } from "../../db";
import {
  users,
  businessProfiles,
  smeOnboardingProgress,
  businessCountries,
} from "../../db/schema";
import { logger } from "../../utils/logger";
import { eq, and, isNull } from "drizzle-orm";
import { httpError } from "./admin-sme.utils";
import { AdminSMEService } from "./admin-sme.service";

/**
 * Step 3: Location Info Service
 */
export abstract class AdminSMEStep3Service {
  /**
   * Save Location Info
   * Updates business profile with location data and countries of operation
   */
  static async saveLocationInfo(
    userId: string,
    payload: AdminSMEModel.Step3LocationInfoBody,
  ): Promise<AdminSMEModel.OnboardingStateResponse> {
    try {
      // Verify user exists
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
      });

      if (!user) {
        throw httpError(404, "[USER_NOT_FOUND] User not found");
      }

      // Get existing business (must exist from Step 2)
      const business = await db.query.businessProfiles.findFirst({
        where: and(
          eq(businessProfiles.userId, userId),
          isNull(businessProfiles.deletedAt)
        ),
      });

      if (!business) {
        throw httpError(404, "[BUSINESS_NOT_FOUND] Business not found. Please complete Step 2 first.");
      }

      // Execute in transaction
      await db.transaction(async (tx) => {
        // Update business profile with location fields
        await tx
          .update(businessProfiles)
          .set({
            companyHQ: payload.companyHQ ?? null,
            city: payload.city ?? null,
            registeredOfficeAddress: payload.registeredOfficeAddress ?? null,
            registeredOfficeCity: payload.registeredOfficeCity ?? null,
            registeredOfficeZipCode: payload.registeredOfficeZipCode ?? null,
            updatedAt: new Date(),
          } as any)
          .where(eq(businessProfiles.id, business.id));

        // Handle countries of operation (replace existing)
        if (payload.countriesOfOperation && payload.countriesOfOperation.length > 0) {
          // Delete existing country associations
          await tx
            .delete(businessCountries)
            .where(eq(businessCountries.businessId, business.id));

          // Insert new country associations
          await tx.insert(businessCountries).values(
            payload.countriesOfOperation.map((country) => ({
              businessId: business.id,
              country: country,
            })) as any
          );
        }

        // Update onboarding progress
        const progress = await tx.query.smeOnboardingProgress.findFirst({
          where: eq(smeOnboardingProgress.userId, userId),
        });

        const completedSteps = (progress?.completedSteps as number[]) ?? [];
        if (!completedSteps.includes(3)) {
          completedSteps.push(3);
        }

        if (progress) {
          await tx
            .update(smeOnboardingProgress)
            .set({
              currentStep: 3,
              completedSteps: completedSteps as any,
              lastSavedAt: new Date(),
              updatedAt: new Date(),
            } as any)
            .where(eq(smeOnboardingProgress.userId, userId));
        } else {
          await tx.insert(smeOnboardingProgress).values({
            userId: userId,
            currentStep: 3,
            completedSteps: [3] as any,
            lastSavedAt: new Date(),
          } as any);
        }

        // Update user onboarding step
        await tx
          .update(users)
          .set({
            onboardingStep: 3,
            updatedAt: new Date(),
          })
          .where(eq(users.id, userId));
      });

      logger.info("[AdminSME Step3] Step 3 saved", {
        userId,
      });

      // Return updated onboarding state
      return await AdminSMEService.getOnboardingState(userId);
    } catch (error: any) {
      logger.error("[AdminSME Step3] Error saving Step 3", {
        error: error?.message,
        userId,
      });
      if (error?.status) throw error;
      throw httpError(500, "[STEP3_ERROR] Failed to save location info");
    }
  }
}

