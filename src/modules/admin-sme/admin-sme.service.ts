import type { AdminSMEModel } from "./admin-sme.model";
import { db } from "../../db";
import {
  users,
  businessProfiles,
  smeOnboardingProgress,
} from "../../db/schema";
import { logger } from "../../utils/logger";
import { eq } from "drizzle-orm";
import { clerkClient } from "@clerk/fastify";

// Lightweight HTTP error helper compatible with our route error handling
function httpError(status: number, message: string) {
  const err: any = new Error(message);
  err.status = status;
  return err;
}

export abstract class AdminSMEService {
  /**
   * Step 1: Create SME user with draft status
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

      logger.info("[AdminSME] User created", {
        userId: result.id,
        email: result.email,
      });

      // Get onboarding state
      const onboardingState = await this.getOnboardingState(result.id);

      return {
        userId: result.id,
        onboardingState,
      };
    } catch (error: any) {
      logger.error("[AdminSME] Error creating user", {
        error: error?.message,
        email: payload.email,
      });
      if (error?.status) throw error;
      throw httpError(500, "[CREATE_USER_ERROR] Failed to create SME user");
    }
  }

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
}

