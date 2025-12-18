import { and, eq, isNull } from "drizzle-orm";
import { db } from "../../db";
import { businessCountries, businessProfiles, smeOnboardingProgress, users } from "../../db/schema";
import { logger } from "../../utils/logger";
import type { AdminSMEModel } from "./admin-sme.model";
import { httpError } from "./admin-sme.utils";

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
    payload: AdminSMEModel.Step3LocationInfoBody
  ): Promise<AdminSMEModel.OnboardingStateResponse> {
    try {
      // Execute in transaction - all queries inside for consistency and performance
      const { updatedUser, updatedBusiness, progressResult } = await db.transaction(async (tx) => {
        // Verify user exists and get it
        const user = await tx.query.users.findFirst({
          where: eq(users.id, userId),
        });

        if (!user) {
          throw httpError(404, "[USER_NOT_FOUND] User not found");
        }

        // Get existing business (must exist from Step 2)
        const business = await tx.query.businessProfiles.findFirst({
          where: and(eq(businessProfiles.userId, userId), isNull(businessProfiles.deletedAt)),
        });

        if (!business) {
          throw httpError(
            404,
            "[BUSINESS_NOT_FOUND] Business not found. Please complete Step 2 first."
          );
        }

        // Get existing progress to compute completed steps
        const existingProgress = await tx.query.smeOnboardingProgress.findFirst({
          where: eq(smeOnboardingProgress.userId, userId),
        });

        const completedSteps = (existingProgress?.completedSteps as number[]) ?? [];
        if (!completedSteps.includes(3)) {
          completedSteps.push(3);
        }

        // Prepare parallel operations for independent tasks
        const parallelOps: Promise<any>[] = [];

        // Update business profile with location fields
        const businessUpdatePromise = tx
          .update(businessProfiles)
          .set({
            companyHQ: payload.companyHQ ?? null,
            city: payload.city ?? null,
            registeredOfficeAddress: payload.registeredOfficeAddress ?? null,
            registeredOfficeCity: payload.registeredOfficeCity ?? null,
            registeredOfficeZipCode: payload.registeredOfficeZipCode ?? null,
            updatedAt: new Date(),
          } as any)
          .where(eq(businessProfiles.id, business.id))
          .returning()
          .then(([result]) => result);

        parallelOps.push(businessUpdatePromise);

        // Handle countries of operation (replace existing)
        if (payload.countriesOfOperation && payload.countriesOfOperation.length > 0) {
          const countries = payload.countriesOfOperation; // Capture for closure
          parallelOps.push(
            (async () => {
              // Delete existing country associations
              await tx
                .delete(businessCountries)
                .where(eq(businessCountries.businessId, business.id));

              // Insert new country associations
              await tx.insert(businessCountries).values(
                countries.map((country) => ({
                  businessId: business.id,
                  country: country,
                })) as any
              );
            })()
          );
        }

        // Update onboarding progress - return the result
        const progressPromise = existingProgress
          ? tx
              .update(smeOnboardingProgress)
              .set({
                currentStep: 3,
                completedSteps: completedSteps as any,
                lastSavedAt: new Date(),
                updatedAt: new Date(),
              } as any)
              .where(eq(smeOnboardingProgress.userId, userId))
              .returning()
              .then(([result]) => result)
          : tx
              .insert(smeOnboardingProgress)
              .values({
                userId: userId,
                currentStep: 3,
                completedSteps: [3] as any,
                lastSavedAt: new Date(),
              } as any)
              .returning()
              .then(([result]) => result);

        // Update user onboarding step - return the result
        const userUpdatePromise = tx
          .update(users)
          .set({
            onboardingStep: 3,
            updatedAt: new Date(),
          })
          .where(eq(users.id, userId))
          .returning()
          .then(([result]) => result);

        // Execute all independent operations in parallel
        const [updatedBusiness, progressResult, updatedUser] = await Promise.all([
          businessUpdatePromise,
          progressPromise,
          userUpdatePromise,
          ...parallelOps.slice(1), // Skip business update (already first)
        ]);

        return { updatedUser, updatedBusiness, progressResult };
      });

      logger.info("[AdminSME Step3] Step 3 saved", {
        userId,
      });

      // Return onboarding state from data we already have (no extra queries!)
      return {
        userId: updatedUser.id,
        currentStep: progressResult?.currentStep ?? 3,
        completedSteps: (progressResult?.completedSteps as number[]) ?? [3],
        user: {
          email: updatedUser.email,
          firstName: updatedUser.firstName,
          lastName: updatedUser.lastName,
          phone: updatedUser.phoneNumber,
          dob: updatedUser.dob,
          gender: updatedUser.gender,
          position: updatedUser.position,
          onboardingStatus: updatedUser.onboardingStatus as string,
          idNumber: updatedUser.idNumber,
          taxNumber: updatedUser.taxNumber,
          idType: updatedUser.idType,
        },
        business: updatedBusiness
          ? {
              id: updatedBusiness.id,
              name: updatedBusiness.name,
              averageMonthlyTurnover: updatedBusiness.avgMonthlyTurnover
                ? Number(updatedBusiness.avgMonthlyTurnover)
                : null,
              averageYearlyTurnover: updatedBusiness.avgYearlyTurnover
                ? Number(updatedBusiness.avgYearlyTurnover)
                : null,
              previousLoans: updatedBusiness.borrowingHistory ?? null,
              loanAmount: updatedBusiness.amountBorrowed
                ? Number(updatedBusiness.amountBorrowed)
                : null,
              defaultCurrency: updatedBusiness.currency ?? null,
              recentLoanStatus: updatedBusiness.loanStatus ?? null,
              defaultReason: updatedBusiness.defaultReason ?? null,
            }
          : null,
      };
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
