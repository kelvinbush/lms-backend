import type { AdminSMEModel } from "./admin-sme.model";
import { db } from "../../db";
import {
  users,
  personalDocuments,
  smeOnboardingProgress,
} from "../../db/schema";
import { logger } from "../../utils/logger";
import { eq, and, inArray, isNull } from "drizzle-orm";
import { httpError } from "./admin-sme.utils";
import { AdminSMEService } from "./admin-sme.service";

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
      // Verify user exists
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
      });

      if (!user) {
        throw httpError(404, "[USER_NOT_FOUND] User not found");
      }

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

      // Execute in transaction
      await db.transaction(async (tx) => {
        // Find existing active documents for these types
        const existing = await tx.query.personalDocuments.findMany({
          where: and(
            eq(personalDocuments.userId, user.id),
            inArray(personalDocuments.docType, upserts.map((d) => d.docType)),
            isNull(personalDocuments.deletedAt)
          ),
          columns: { id: true, docType: true, docUrl: true },
        });

        const existingTypes = new Set(existing.map((e) => e.docType));
        const toUpdate = upserts.filter((d) => existingTypes.has(d.docType));
        const toInsert = upserts.filter((d) => !existingTypes.has(d.docType));

        // Perform updates per type
        for (const d of toUpdate) {
          await tx
            .update(personalDocuments)
            .set({ docUrl: d.docUrl, updatedAt: new Date() })
            .where(
              and(
                eq(personalDocuments.userId, user.id),
                eq(personalDocuments.docType, d.docType),
                isNull(personalDocuments.deletedAt)
              )
            );
        }

        // Perform bulk insert for new types
        if (toInsert.length > 0) {
          await tx.insert(personalDocuments).values(
            toInsert.map((d) => ({
              userId: user.id,
              docType: d.docType,
              docUrl: d.docUrl,
            }))
          );
        }

        // Update onboarding progress
        const progress = await tx.query.smeOnboardingProgress.findFirst({
          where: eq(smeOnboardingProgress.userId, userId),
        });

        const completedSteps = (progress?.completedSteps as number[]) ?? [];
        if (!completedSteps.includes(4)) {
          completedSteps.push(4);
        }

        if (progress) {
          await tx
            .update(smeOnboardingProgress)
            .set({
              currentStep: 4,
              completedSteps: completedSteps as any,
              lastSavedAt: new Date(),
              updatedAt: new Date(),
            } as any)
            .where(eq(smeOnboardingProgress.userId, userId));
        } else {
          await tx.insert(smeOnboardingProgress).values({
            userId: userId,
            currentStep: 4,
            completedSteps: [4] as any,
            lastSavedAt: new Date(),
          } as any);
        }

        // Update user onboarding step
        await tx
          .update(users)
          .set({
            onboardingStep: 4,
            updatedAt: new Date(),
          })
          .where(eq(users.id, userId));
      });

      logger.info("[AdminSME Step4] Step 4 saved", {
        userId,
      });

      // Return updated onboarding state
      return await AdminSMEService.getOnboardingState(userId);
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

