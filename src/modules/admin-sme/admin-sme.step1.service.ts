import { eq } from "drizzle-orm";
import { db } from "../../db";
import { smeOnboardingProgress, users } from "../../db/schema";
import { logger } from "../../utils/logger";
import type { AdminSMEModel } from "./admin-sme.model";
import { httpError } from "./admin-sme.utils";

/**
 * Step 1: User Creation Service
 */
export abstract class AdminSMEStep1Service {
  /**
   * Create SME user with draft status
   * Creates user and initializes onboarding progress
   */
  static async createSMEUser(
    payload: AdminSMEModel.Step1UserInfoBody
  ): Promise<AdminSMEModel.CreateUserResponse> {
    try {
      // Check if user with email already exists
      const existingUser = await db.query.users.findFirst({
        where: eq(users.email, payload.email),
      });

      if (existingUser) {
        throw httpError(400, "[EMAIL_EXISTS] User with this email already exists");
      }

      // Ensure dob is a Date object when provided and non-empty
      const dob =
        !payload.dob || (typeof payload.dob === "string" && payload.dob.trim() === "")
          ? undefined
          : typeof payload.dob === "string"
            ? new Date(payload.dob)
            : payload.dob;

      // Create user in a transaction with onboarding progress
      const { createdUser, createdProgress } = await db.transaction(async (tx) => {
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

        // Create onboarding progress record and capture it
        const [progress] = await tx
          .insert(smeOnboardingProgress)
          .values({
            userId: user.id,
            currentStep: 1,
            completedSteps: [1] as any, // Step 1 is completed
            lastSavedAt: new Date(),
          } as any)
          .returning();

        return { createdUser: user, createdProgress: progress };
      });

      logger.info("[AdminSME Step1] User created", {
        userId: createdUser.id,
        email: createdUser.email,
      });

      // Return onboarding state from data we already have (no extra queries!)
      const onboardingState: AdminSMEModel.OnboardingStateResponse = {
        userId: createdUser.id,
        currentStep: createdProgress.currentStep ?? 1,
        completedSteps: (createdProgress.completedSteps as number[]) ?? [1],
        user: {
          email: createdUser.email,
          firstName: createdUser.firstName,
          lastName: createdUser.lastName,
          phone: createdUser.phoneNumber,
          dob: createdUser.dob,
          gender: createdUser.gender,
          position: createdUser.position,
          onboardingStatus: createdUser.onboardingStatus as string,
          idNumber: createdUser.idNumber,
          taxNumber: createdUser.taxNumber,
          idType: createdUser.idType,
        },
        business: null, // No business in Step 1
      };

      return {
        userId: createdUser.id,
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
    payload: AdminSMEModel.Step1UserInfoBody
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

      // Ensure dob is a Date object when provided and non-empty
      const dob =
        !payload.dob || (typeof payload.dob === "string" && payload.dob.trim() === "")
          ? undefined
          : typeof payload.dob === "string"
            ? new Date(payload.dob)
            : payload.dob;

      // Update user in transaction
      const { updatedUser, progress } = await db.transaction(async (tx) => {
        // Single update with all fields including onboardingStep (eliminates double update)
        const [userResult] = await tx
          .update(users)
          .set({
            email: payload.email,
            firstName: payload.firstName,
            lastName: payload.lastName,
            phoneNumber: payload.phone,
            dob: dob,
            gender: payload.gender,
            position: payload.position,
            onboardingStep: 1, // Include in single update - no second update needed!
            updatedAt: new Date(),
          } as any)
          .where(eq(users.id, userId))
          .returning();

        // Update onboarding progress (query + conditional update/insert)
        const existingProgress = await tx.query.smeOnboardingProgress.findFirst({
          where: eq(smeOnboardingProgress.userId, userId),
        });

        const completedSteps = (existingProgress?.completedSteps as number[]) ?? [];
        if (!completedSteps.includes(1)) {
          completedSteps.push(1);
        }

        let progressResult: typeof smeOnboardingProgress.$inferSelect;
        if (existingProgress) {
          const [result] = await tx
            .update(smeOnboardingProgress)
            .set({
              currentStep: 1,
              completedSteps: completedSteps as any,
              lastSavedAt: new Date(),
              updatedAt: new Date(),
            } as any)
            .where(eq(smeOnboardingProgress.userId, userId))
            .returning();
          progressResult = result;
        } else {
          const [result] = await tx
            .insert(smeOnboardingProgress)
            .values({
              userId: userId,
              currentStep: 1,
              completedSteps: [1] as any,
              lastSavedAt: new Date(),
            } as any)
            .returning();
          progressResult = result;
        }

        return { updatedUser: userResult, progress: progressResult };
      });

      logger.info("[AdminSME Step1] User updated", {
        userId,
      });

      // Return onboarding state from data we already have (no extra queries!)
      return {
        userId: updatedUser.id,
        currentStep: progress?.currentStep ?? 1,
        completedSteps: (progress?.completedSteps as number[]) ?? [1],
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
        business: null, // No business in Step 1
      };
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
