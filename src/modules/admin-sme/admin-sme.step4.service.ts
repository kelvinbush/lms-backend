import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "../../db";
import {
  businessProfiles,
  personalDocuments,
  smeOnboardingProgress,
  users,
} from "../../db/schema";
import { logger } from "../../utils/logger";
import type { AdminSMEModel } from "./admin-sme.model";
import { httpError } from "./admin-sme.utils";

/**
 * Step 4: Personal Documents Service
 */
export abstract class AdminSMEStep4Service {
  /**
   * Save Personal Documents
   * Upserts personal documents for the SME user (admin override - no clerkId required)
   */
  static async savePersonalDocuments(
    userId: string,
    payload: AdminSMEModel.Step4PersonalDocumentsBody,
  ): Promise<AdminSMEModel.OnboardingStateResponse> {
    try {
      // Normalize to array and dedupe by docType (last one wins)
      const docsArray = payload.documents;
      const byType = new Map<string, string>();
      for (const d of docsArray) {
        byType.set(d.docType, d.docUrl);
      }
      const upserts = Array.from(byType.entries()).map(([docType, docUrl]) => ({
        docType,
        docUrl,
      }));

      // Execute in transaction - all queries inside for consistency and performance
      const { updatedUser, progressResult } = await db.transaction(
        async (tx) => {
          // Verify user exists and get it
          const user = await tx.query.users.findFirst({
            where: eq(users.id, userId),
          });

          if (!user) {
            throw httpError(404, "[USER_NOT_FOUND] User not found");
          }

          // Get existing progress to compute completed steps
          const existingProgress =
            await tx.query.smeOnboardingProgress.findFirst({
              where: eq(smeOnboardingProgress.userId, userId),
            });

          const completedSteps =
            (existingProgress?.completedSteps as number[]) ?? [];
          if (!completedSteps.includes(4)) {
            completedSteps.push(4);
          }

          // Find existing active documents for these types
          const existing = await tx.query.personalDocuments.findMany({
            where: and(
              eq(personalDocuments.userId, user.id),
              inArray(
                personalDocuments.docType,
                upserts.map((d) => d.docType),
              ),
              isNull(personalDocuments.deletedAt),
            ),
            columns: { id: true, docType: true, docUrl: true },
          });

          const existingTypes = new Set(existing.map((e) => e.docType));
          const toUpdate = upserts.filter((d) => existingTypes.has(d.docType));
          const toInsert = upserts.filter((d) => !existingTypes.has(d.docType));

          // Prepare parallel operations
          const parallelOps: Promise<any>[] = [];

          // Perform updates per type
          for (const d of toUpdate) {
            parallelOps.push(
              tx
                .update(personalDocuments)
                .set({ docUrl: d.docUrl, updatedAt: new Date() })
                .where(
                  and(
                    eq(personalDocuments.userId, user.id),
                    eq(personalDocuments.docType, d.docType),
                    isNull(personalDocuments.deletedAt),
                  ),
                ),
            );
          }

          // Perform bulk insert for new types
          if (toInsert.length > 0) {
            parallelOps.push(
              tx.insert(personalDocuments).values(
                toInsert.map((d) => ({
                  userId: user.id,
                  docType: d.docType,
                  docUrl: d.docUrl,
                })),
              ),
            );
          }

          // Update onboarding progress - return the result
          const progressPromise = existingProgress
            ? tx
                .update(smeOnboardingProgress)
                .set({
                  currentStep: 4,
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
                  currentStep: 4,
                  completedSteps: [4] as any,
                  lastSavedAt: new Date(),
                } as any)
                .returning()
                .then(([result]) => result);

          // Update user onboarding step and ID fields - return the result
          const userUpdatePromise = tx
            .update(users)
            .set({
              onboardingStep: 4,
              idNumber: payload.idNumber ?? null,
              taxNumber: payload.taxNumber ?? null,
              idType: payload.idType ?? null,
              updatedAt: new Date(),
            } as any)
            .where(eq(users.id, userId))
            .returning()
            .then(([result]) => result);

          // Execute all operations in parallel
          const [progressResult, updatedUser] = await Promise.all([
            progressPromise,
            userUpdatePromise,
            ...parallelOps,
          ]);

          return { updatedUser, progressResult };
        },
      );

      logger.info("[AdminSME Step4] Step 4 saved", {
        userId,
      });

      // Get business for response (only if needed)
      const business = await db.query.businessProfiles.findFirst({
        where: eq(businessProfiles.userId, userId),
      });

      // Return onboarding state from data we already have (no extra getOnboardingState call!)
      return {
        userId: updatedUser.id,
        currentStep: progressResult?.currentStep ?? 4,
        completedSteps: (progressResult?.completedSteps as number[]) ?? [4],
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
              loanAmount: business.amountBorrowed
                ? Number(business.amountBorrowed)
                : null,
              defaultCurrency: business.currency ?? null,
              recentLoanStatus: business.loanStatus ?? null,
              defaultReason: business.defaultReason ?? null,
            }
          : null,
      };
    } catch (error: any) {
      logger.error("[AdminSME Step4] Error saving Step 4", {
        error: error?.message,
        userId,
      });
      if (error?.status) throw error;
      throw httpError(500, "[STEP4_ERROR] Failed to save personal documents");
    }
  }
}
