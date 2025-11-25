import type { AdminSMEModel } from "./admin-sme.model";
import { db } from "../../db";
import {
  users,
  businessProfiles,
  businessDocuments,
  businessDocumentTypeEnum,
  smeOnboardingProgress,
} from "../../db/schema";
import { logger } from "../../utils/logger";
import { eq, and, isNull } from "drizzle-orm";
import { httpError } from "./admin-sme.utils";
import { AdminSMEService } from "./admin-sme.service";

/**
 * Step 7: Permits & Pitch Deck Service
 * Handles business_permit, pitch_deck, business_plan, etc.
 */
export abstract class AdminSMEStep7Service {
  /**
   * Save Permit and Pitch Deck Documents
   * Upserts business documents for permits and pitch deck
   */
  static async savePermitAndPitchDocuments(
    userId: string,
    payload: AdminSMEModel.Step7PermitAndPitchDocumentsBody,
  ): Promise<AdminSMEModel.OnboardingStateResponse> {
    try {
      // Verify user exists
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
      });

      if (!user) {
        throw httpError(404, "[USER_NOT_FOUND] User not found");
      }

      // Get business (must exist from Step 2)
      const business = await db.query.businessProfiles.findFirst({
        where: and(
          eq(businessProfiles.userId, userId),
          isNull(businessProfiles.deletedAt)
        ),
      });

      if (!business) {
        throw httpError(404, "[BUSINESS_NOT_FOUND] Business not found. Please complete Step 2 first.");
      }

      // Normalize to array
      const docsArray = payload.documents;

      // Validate and normalize documents
      const normalized = docsArray.map((d) => ({
        docType: d.docType,
        docUrl: d.docUrl,
        isPasswordProtected: !!d.isPasswordProtected,
        docPassword: d.isPasswordProtected ? (d.docPassword ?? null) : null,
        docYear: null, // Permits and pitch decks don't typically have years
        docBankName: null, // Not applicable
      }));

      // Validate document types
      for (let i = 0; i < normalized.length; i++) {
        const d = normalized[i];
        if (!d.docType || !businessDocumentTypeEnum.enumValues.includes(d.docType as any)) {
          throw httpError(
            400,
            `[INVALID_DOC_TYPE] Document ${i}: docType "${d.docType}" is not a valid business document type`
          );
        }
        if (!d.docUrl || typeof d.docUrl !== "string" || d.docUrl.length === 0) {
          throw httpError(400, `[INVALID_DOC_URL] Document ${i}: docUrl is required`);
        }
        if (d.isPasswordProtected && (!d.docPassword || d.docPassword.length === 0)) {
          throw httpError(
            400,
            `[INVALID_DOC_PASSWORD] Document ${i}: docPassword is required when isPasswordProtected is true`
          );
        }
      }

      // Execute in transaction
      await db.transaction(async (tx) => {
        // Upsert documents (for permits/pitch deck, we use businessId + docType as unique key)
        for (const doc of normalized) {
          // Check if document exists
          const existing = await tx.query.businessDocuments.findFirst({
            where: and(
              eq(businessDocuments.businessId, business.id),
              eq(businessDocuments.docType, doc.docType as any),
              isNull(businessDocuments.deletedAt)
            ),
          });

          if (existing) {
            // Update existing
            await tx
              .update(businessDocuments)
              .set({
                docUrl: doc.docUrl,
                isPasswordProtected: doc.isPasswordProtected,
                docPassword: doc.docPassword,
                updatedAt: new Date(),
              } as any)
              .where(eq(businessDocuments.id, existing.id));
          } else {
            // Insert new
            await tx.insert(businessDocuments).values({
              businessId: business.id,
              docType: doc.docType as any,
              docUrl: doc.docUrl,
              isPasswordProtected: doc.isPasswordProtected,
              docPassword: doc.docPassword,
              docYear: null,
              docBankName: null,
            } as any);
          }
        }

        // Update onboarding progress
        const progress = await tx.query.smeOnboardingProgress.findFirst({
          where: eq(smeOnboardingProgress.userId, userId),
        });

        const completedSteps = (progress?.completedSteps as number[]) ?? [];
        if (!completedSteps.includes(7)) {
          completedSteps.push(7);
        }

        if (progress) {
          await tx
            .update(smeOnboardingProgress)
            .set({
              currentStep: 7,
              completedSteps: completedSteps as any,
              lastSavedAt: new Date(),
              updatedAt: new Date(),
            } as any)
            .where(eq(smeOnboardingProgress.userId, userId));
        } else {
          await tx.insert(smeOnboardingProgress).values({
            userId: userId,
            currentStep: 7,
            completedSteps: [7] as any,
            lastSavedAt: new Date(),
          } as any);
        }

        // Update user onboarding step
        await tx
          .update(users)
          .set({
            onboardingStep: 7,
            updatedAt: new Date(),
          })
          .where(eq(users.id, userId));
      });

      logger.info("[AdminSME Step7] Step 7 saved", {
        userId,
        businessId: business.id,
      });

      // Return updated onboarding state
      return await AdminSMEService.getOnboardingState(userId);
    } catch (error: any) {
      logger.error("[AdminSME Step7] Error saving Step 7", {
        error: error?.message,
        userId,
      });
      if (error?.status) throw error;
      throw httpError(500, "[STEP7_ERROR] Failed to save permit and pitch deck documents");
    }
  }
}

