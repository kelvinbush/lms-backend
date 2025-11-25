import type { AdminSMEModel } from "./admin-sme.model";
import { db } from "../../db";
import { users, smeOnboardingProgress } from "../../db/schema";
import { logger } from "../../utils/logger";
import { eq } from "drizzle-orm";
import { httpError } from "./admin-sme.utils";
import { AdminSMEService } from "./admin-sme.service";

/**
 * Step 1: User Creation Service
 */
export abstract class AdminSMEStep1Service {
  /**
   * Create SME user with draft status
   * Creates user and initializes onboarding progress
   */
  static async createSMEUser(
    payload: AdminSMEModel.Step1UserInfoBody,
  ): Promise<AdminSMEModel.CreateUserResponse> {
    try {
      // Check if user with email already exists
      const existingUser = await db.query.users.findFirst({
        where: eq(users.email, payload.email),
      });

      if (existingUser) {
        throw httpError(400, "[EMAIL_EXISTS] User with this email already exists");
      }

      // Ensure dob is a Date object
      const dob = typeof payload.dob === "string" ? new Date(payload.dob) : payload.dob;

      // Create user in a transaction with onboarding progress
      const result = await db.transaction(async (tx) => {
        // Create user with draft status
        const [user] = await tx
          .insert(users)
          .values({
            email: payload.email,
            firstName: payload.firstName,
            lastName: payload.lastName,
            phoneNumber: payload.phone,
            dob: dob,
            gender: payload.gender,
            position: payload.position,
            onboardingStatus: "draft" as any,
            onboardingStep: 1,
            // clerkId is null for draft users
          } as any)
          .returning();

        // Create onboarding progress record
        await tx.insert(smeOnboardingProgress).values({
          userId: user.id,
          currentStep: 1,
          completedSteps: [1] as any, // Step 1 is completed
          lastSavedAt: new Date(),
        } as any);

        return user;
      });

      logger.info("[AdminSME Step1] User created", {
        userId: result.id,
        email: result.email,
      });

      // Get onboarding state
      const onboardingState = await AdminSMEService.getOnboardingState(result.id);

      return {
        userId: result.id,
        onboardingState,
      };
    } catch (error: any) {
      logger.error("[AdminSME Step1] Error creating user", {
        error: error?.message,
        email: payload.email,
      });
      if (error?.status) throw error;
      throw httpError(500, "[CREATE_USER_ERROR] Failed to create SME user");
    }
  }

  /**
   * Update Step 1: Update user information
   * Allows editing user info after initial creation
   */
  static async updateSMEUser(
    userId: string,
    payload: AdminSMEModel.Step1UserInfoBody,
  ): Promise<AdminSMEModel.OnboardingStateResponse> {
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
          throw httpError(400, "[EMAIL_EXISTS] User with this email already exists");
        }
      }

      // Ensure dob is a Date object
      const dob = typeof payload.dob === "string" ? new Date(payload.dob) : payload.dob;

      // Update user in transaction
      await db.transaction(async (tx) => {
        await tx
          .update(users)
          .set({
            email: payload.email,
            firstName: payload.firstName,
            lastName: payload.lastName,
            phoneNumber: payload.phone,
            dob: dob,
            gender: payload.gender,
            position: payload.position,
            updatedAt: new Date(),
          } as any)
          .where(eq(users.id, userId));

        // Update onboarding progress
        const progress = await tx.query.smeOnboardingProgress.findFirst({
          where: eq(smeOnboardingProgress.userId, userId),
        });

        const completedSteps = (progress?.completedSteps as number[]) ?? [];
        if (!completedSteps.includes(1)) {
          completedSteps.push(1);
        }

        if (progress) {
          await tx
            .update(smeOnboardingProgress)
            .set({
              currentStep: 1,
              completedSteps: completedSteps as any,
              lastSavedAt: new Date(),
              updatedAt: new Date(),
            } as any)
            .where(eq(smeOnboardingProgress.userId, userId));
        } else {
          await tx.insert(smeOnboardingProgress).values({
            userId: userId,
            currentStep: 1,
            completedSteps: [1] as any,
            lastSavedAt: new Date(),
          } as any);
        }

        // Update user onboarding step
        await tx
          .update(users)
          .set({
            onboardingStep: 1,
            updatedAt: new Date(),
          })
          .where(eq(users.id, userId));
      });

      logger.info("[AdminSME Step1] User updated", {
        userId,
      });

      // Get onboarding state
      return await AdminSMEService.getOnboardingState(userId);
    } catch (error: any) {
      logger.error("[AdminSME Step1] Error updating user", {
        error: error?.message,
        userId,
      });
      if (error?.status) throw error;
      throw httpError(500, "[UPDATE_USER_ERROR] Failed to update SME user");
    }
  }
}

