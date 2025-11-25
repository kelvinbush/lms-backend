import type { AdminSMEModel } from "./admin-sme.model";
import { db } from "../../db";
import {
  users,
  businessProfiles,
  smeOnboardingProgress,
  businessUserGroups,
  businessPhotos,
  businessVideoLinks,
} from "../../db/schema";
import { logger } from "../../utils/logger";
import { eq, and, isNull } from "drizzle-orm";
import { httpError } from "./admin-sme.utils";
import { AdminSMEService } from "./admin-sme.service";

/**
 * Step 2: Business Basic Info Service
 */
export abstract class AdminSMEStep2Service {
  /**
   * Save Business Basic Info
   * Creates or updates business profile with all Step 2 data
   */
  static async saveBusinessBasicInfo(
    userId: string,
    payload: AdminSMEModel.Step2BusinessBasicInfoBody,
  ): Promise<AdminSMEModel.OnboardingStateResponse> {
    try {
      // Verify user exists
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
      });

      if (!user) {
        throw httpError(404, "[USER_NOT_FOUND] User not found");
      }

      // Validate business photos (max 5)
      if (payload.businessPhotos && payload.businessPhotos.length > 5) {
        throw httpError(400, "[INVALID_PHOTOS] Maximum 5 business photos allowed");
      }

      // Get existing business if it exists
      const existingBusiness = await db.query.businessProfiles.findFirst({
        where: and(
          eq(businessProfiles.userId, userId),
          isNull(businessProfiles.deletedAt)
        ),
      });

      // Execute in transaction
      await db.transaction(async (tx) => {
        let businessId: string;

        if (existingBusiness) {
          // Update existing business
          const [updated] = await tx
            .update(businessProfiles)
            .set({
              name: payload.name,
              description: payload.description ?? null,
              logo: payload.logo ?? null,
              entityType: payload.entityType,
              yearOfIncorporation: String(payload.year),
              sectors: payload.sectors as any, // JSON array
              selectionCriteria: payload.criteria as any, // JSON array
              noOfEmployees: payload.noOfEmployees ?? null,
              website: payload.website ?? null,
              updatedAt: new Date(),
            } as any)
            .where(eq(businessProfiles.id, existingBusiness.id))
            .returning();

          businessId = updated.id;
        } else {
          // Create new business
          const [created] = await tx
            .insert(businessProfiles)
            .values({
              userId: userId,
              name: payload.name,
              description: payload.description ?? null,
              logo: payload.logo ?? null,
              entityType: payload.entityType,
              yearOfIncorporation: String(payload.year),
              sectors: payload.sectors as any, // JSON array
              selectionCriteria: payload.criteria as any, // JSON array
              noOfEmployees: payload.noOfEmployees ?? null,
              website: payload.website ?? null,
            } as any)
            .returning();

          businessId = created.id;
        }

        // Handle user groups (replace existing associations)
        if (payload.userGroupId) {
          // Delete existing user group associations for this business
          await tx
            .delete(businessUserGroups)
            .where(eq(businessUserGroups.businessId, businessId));

          // Insert new association
          await tx.insert(businessUserGroups).values({
            businessId: businessId,
            groupId: payload.userGroupId,
          } as any);
        }

        // Handle video links (replace existing - soft delete old ones)
        if (payload.videoLinks !== undefined) {
          // Soft delete existing video links
          await tx
            .update(businessVideoLinks)
            .set({ deletedAt: new Date() })
            .where(
              and(
                eq(businessVideoLinks.businessId, businessId),
                isNull(businessVideoLinks.deletedAt)
              )
            );

          // Insert new video links if provided
          if (payload.videoLinks.length > 0) {
            await tx.insert(businessVideoLinks).values(
              payload.videoLinks.map((link, index) => ({
                businessId: businessId,
                videoUrl: link.url,
                source: link.source ?? null,
                displayOrder: index,
              })) as any
            );
          }
        }

        // Handle business photos (replace existing - soft delete old ones, max 5)
        if (payload.businessPhotos !== undefined) {
          // Soft delete existing photos
          await tx
            .update(businessPhotos)
            .set({ deletedAt: new Date() })
            .where(
              and(
                eq(businessPhotos.businessId, businessId),
                isNull(businessPhotos.deletedAt)
              )
            );

          // Insert new photos if provided
          if (payload.businessPhotos.length > 0) {
            await tx.insert(businessPhotos).values(
              payload.businessPhotos.slice(0, 5).map((photoUrl, index) => ({
                businessId: businessId,
                photoUrl: photoUrl,
                displayOrder: index,
              })) as any
            );
          }
        }

        // Update onboarding progress
        const progress = await tx.query.smeOnboardingProgress.findFirst({
          where: eq(smeOnboardingProgress.userId, userId),
        });

        const completedSteps = (progress?.completedSteps as number[]) ?? [];
        if (!completedSteps.includes(2)) {
          completedSteps.push(2);
        }

        if (progress) {
          await tx
            .update(smeOnboardingProgress)
            .set({
              currentStep: 2,
              completedSteps: completedSteps as any,
              lastSavedAt: new Date(),
              updatedAt: new Date(),
            } as any)
            .where(eq(smeOnboardingProgress.userId, userId));
        } else {
          await tx.insert(smeOnboardingProgress).values({
            userId: userId,
            currentStep: 2,
            completedSteps: [2] as any,
            lastSavedAt: new Date(),
          } as any);
        }

        // Update user onboarding step
        await tx
          .update(users)
          .set({
            onboardingStep: 2,
            updatedAt: new Date(),
          })
          .where(eq(users.id, userId));
      });

      logger.info("[AdminSME Step2] Step 2 saved", {
        userId,
      });

      // Return updated onboarding state
      return await AdminSMEService.getOnboardingState(userId);
    } catch (error: any) {
      logger.error("[AdminSME Step2] Error saving Step 2", {
        error: error?.message,
        userId,
      });
      if (error?.status) throw error;
      throw httpError(500, "[STEP2_ERROR] Failed to save business basic info");
    }
  }
}

