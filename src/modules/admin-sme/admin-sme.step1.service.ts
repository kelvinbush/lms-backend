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
}

