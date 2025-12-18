import { clerkClient } from "@clerk/fastify";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { personalDocuments, users } from "../../db/schema";
import { smsService } from "../../services/sms.service";
import { logger } from "../../utils/logger";
import { OtpUtils } from "../../utils/otp.utils";
import type { UserModel } from "./user.model";

// Lightweight HTTP error helper compatible with our route error handling
function httpError(status: number, message: string) {
  const err: any = new Error(message);
  err.status = status;
  return err;
}

export abstract class User {
  static async signUp(userPayload: UserModel.SignUpBody): Promise<UserModel.SignUpResponse> {
    try {
      // Ensure dob is a Date object for the DB layer
      const values = {
        ...userPayload,
        dob: typeof userPayload.dob === "string" ? new Date(userPayload.dob) : userPayload.dob,
      } as any;
      const user = await db.insert(users).values(values).returning();
      return {
        email: user[0].email,
      };
    } catch (error: any) {
      logger.error(error);
      throw httpError(500, "[SIGNUP_ERROR] An error occurred while signing up");
    }
  }

  /**
   * Find a user by email
   * @param email User's email
   * @returns User object or null if not found
   */
  static async findByEmail(email: string) {
    try {
      const user = await db.query.users.findFirst({
        where: eq(users.email, email),
      });
      return user;
    } catch (error) {
      logger.error("Error finding user by email:", error);
      return null;
    }
  }

  /**
   * Generate and send OTP to user's phone number
   * @param clerkId User's Clerk ID
   * @returns Success status
   */
  static async sendPhoneVerificationOtp(clerkId: string): Promise<UserModel.OtpResponse> {
    try {
      // Get user details
      const user = await db.query.users.findFirst({
        where: eq(users.clerkId, clerkId),
      });

      if (!user) {
        throw httpError(404, "[USER_NOT_FOUND] User not found");
      }

      if (user.isPhoneVerified) {
        return {
          success: true,
          message: "Phone number already verified",
          isAlreadyVerified: true,
        };
      }

      if (!user.phoneNumber) {
        throw httpError(400, "[INVALID_PHONE] No phone number found for user");
      }

      // Generate OTP
      const otp = OtpUtils.generateOtp();
      const expiryTime = OtpUtils.calculateExpiryTime();

      // Update user with OTP and expiry
      await db
        .update(users)
        .set({
          phoneVerificationCode: otp,
          phoneVerificationExpiry: expiryTime,
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id));

      // Send OTP via SMS
      await smsService.sendOtp(user.phoneNumber, otp, user.firstName || "Customer");

      return {
        success: true,
        message: "OTP sent successfully",
        isAlreadyVerified: false,
      };
    } catch (error: any) {
      logger.error("Error sending OTP:", error);
      if (error.status) throw error;
      throw httpError(500, "[OTP_ERROR] Failed to send OTP");
    }
  }

  /**
   * Verify OTP sent to user's phone
   * @param clerkId User's Clerk ID
   * @param otp OTP code entered by user
   * @returns Success status
   */
  static async verifyPhoneOtp(
    clerkId: string,
    otp: string
  ): Promise<UserModel.OtpVerificationResponse> {
    try {
      // Get user details
      const user = await db.query.users.findFirst({
        where: eq(users.clerkId, clerkId),
      });

      if (!user) {
        throw httpError(404, "[USER_NOT_FOUND] User not found");
      }

      if (user.isPhoneVerified) {
        return {
          success: true,
          message: "Phone number already verified",
        };
      }

      // Validate OTP
      const isValid = OtpUtils.validateOtp(
        otp,
        user.phoneVerificationCode || null,
        user.phoneVerificationExpiry || null
      );

      if (!isValid) {
        return {
          success: false,
          message: "Invalid or expired OTP",
        };
      }

      // Update user as verified
      await db
        .update(users)
        .set({
          isPhoneVerified: true,
          phoneVerificationCode: null,
          phoneVerificationExpiry: null,
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id));

      return {
        success: true,
        message: "Phone number verified successfully",
      };
    } catch (error: any) {
      logger.error("Error verifying OTP:", error);
      if (error.status) throw error;
      throw httpError(500, "[VERIFICATION_ERROR] Failed to verify OTP");
    }
  }

  /**
   * Resend OTP to user's phone
   * @param clerkId User's Clerk ID
   * @returns Success status
   */
  static async resendPhoneVerificationOtp(clerkId: string): Promise<UserModel.OtpResponse> {
    return User.sendPhoneVerificationOtp(clerkId);
  }

  /**
   * Update a non verified user's phone number
   * @param clerkId User's Clerk ID
   * @param phoneNumber User's phone number
   * */
  static async updatePhoneNumber(
    clerkId: string,
    phoneNumber: string
  ): Promise<UserModel.EditPhoneResponse> {
    try {
      const user = await db.query.users.findFirst({
        where: eq(users.clerkId, clerkId),
      });

      if (!user) {
        throw httpError(404, "[USER_NOT_FOUND] User not found");
      }

      if (user.isPhoneVerified) {
        throw httpError(400, "[PHONE_VERIFIED] Phone number already verified");
      }

      if (!user.phoneNumber) {
        throw httpError(400, "[INVALID_PHONE] No phone number found for user");
      }

      await db
        .update(users)
        .set({
          phoneNumber,
        })
        .where(eq(users.id, user.id));

      // update clerk unsafe metadata phone number
      await clerkClient.users.updateUserMetadata(user.clerkId, {
        unsafeMetadata: {
          phoneNumber,
        },
      });

      return {
        success: true,
        message: "Phone number updated successfully",
      };
    } catch (error: any) {
      logger.error("Error updating phone number:", error);
      if (error.status) throw error;
      throw httpError(500, "[UPDATE_PHONE_ERROR] Failed to update phone number");
    }
  }

  /**
   * Update user core identity fields and attach personal documents
   * @param clerkId Clerk user id
   * @param payload Update body containing idNumber, taxNumber, idType and documents[]
   */
  static async updateUserAndDocuments(
    clerkId: string,
    payload: UserModel.UpdateUserAndDocumentsBody
  ): Promise<UserModel.BasicSuccessResponse> {
    try {
      // Resolve internal user
      const user = await db.query.users.findFirst({
        where: eq(users.clerkId, clerkId),
      });

      if (!user) {
        throw httpError(404, "[USER_NOT_FOUND] User not found");
      }

      await db.transaction(async (tx) => {
        // Update user identity fields
        await tx
          .update(users)
          .set({
            idNumber: payload.idNumber,
            taxNumber: payload.taxNumber,
            idType: payload.idType,
            updatedAt: new Date(),
          })
          .where(eq(users.id, user.id));

        if (Array.isArray(payload.documents) && payload.documents.length > 0) {
          // Insert documents (simple append; can be adjusted to upsert/replace if needed)
          await tx.insert(personalDocuments).values(
            payload.documents.map((doc) => ({
              userId: user.id,
              docType: doc.docType,
              docUrl: doc.docUrl,
            }))
          );
        }
      });

      return {
        success: true,
        message: "Updated user and documents successfully",
      };
    } catch (error: any) {
      logger.error("Error updating user and documents:", error);
      if (error?.status) throw error;
      throw httpError(500, "[UPDATE_USER_DOCS_ERROR] Failed to update user and documents");
    }
  }

  /**
   * Edit user profile fields (excluding email and phoneNumber)
   * @param clerkId User's Clerk ID
   * @param payload Partial profile fields to update
   */
  static async editProfile(
    clerkId: string,
    payload: UserModel.EditUserProfileBody
  ): Promise<UserModel.BasicSuccessResponse> {
    try {
      // Resolve internal user
      const user = await db.query.users.findFirst({
        where: eq(users.clerkId, clerkId),
      });

      if (!user) {
        throw httpError(404, "[USER_NOT_FOUND] User not found");
      }

      // Build update set with only provided fields (exclude email and phoneNumber by design)
      const allowedKeys: (keyof UserModel.EditUserProfileBody)[] = [
        "firstName",
        "lastName",
        "imageUrl",
        "gender",
        "idNumber",
        "taxNumber",
        "dob",
        "idType",
        "role",
        "position",
      ];

      const updateSet: Record<string, any> = {};
      for (const key of allowedKeys) {
        const value = (payload as any)[key];
        if (typeof value !== "undefined") {
          if (key === "dob") {
            updateSet.dob = typeof value === "string" ? new Date(value) : value;
          } else {
            updateSet[key] = value;
          }
        }
      }

      if (Object.keys(updateSet).length === 0) {
        return { success: true, message: "No changes to update" };
      }

      updateSet.updatedAt = new Date();

      await db.update(users).set(updateSet).where(eq(users.id, user.id));

      return { success: true, message: "Profile updated successfully" };
    } catch (error: any) {
      logger.error("Error updating user profile:", error);
      if (error?.status) throw error;
      throw httpError(500, "[UPDATE_PROFILE_ERROR] Failed to update profile");
    }
  }

  /**
   * Update user's email when a Clerk user.updated webhook is received
   * @param clerkId User's Clerk ID
   * @param email New primary email to set
   * @returns Object containing the updated email (for route schema compatibility)
   */
  static async updateEmail(clerkId: string, email: string): Promise<UserModel.SignUpResponse> {
    try {
      // Resolve target user
      const user = await db.query.users.findFirst({
        where: eq(users.clerkId, clerkId),
      });

      if (!user) {
        throw httpError(404, "[USER_NOT_FOUND] User not found");
      }

      // If email unchanged, no-op
      if (user.email === email) {
        return { email };
      }

      // Ensure email uniqueness (belongs to another user?)
      const existingWithEmail = await db.query.users.findFirst({
        where: eq(users.email, email),
      });
      if (existingWithEmail && existingWithEmail.id !== user.id) {
        throw httpError(400, "[EMAIL_TAKEN] Email already in use");
      }

      // Update
      await db.update(users).set({ email, updatedAt: new Date() }).where(eq(users.id, user.id));

      return { email };
    } catch (error: any) {
      logger.error("Error updating user email:", error);
      if (error?.status) throw error;
      throw httpError(500, "[UPDATE_EMAIL_ERROR] Failed to update email");
    }
  }

  /**
   * Get user profile fields (excluding some fields)
   * @param clerkId User's Clerk ID
   */
  static async getUserProfile(clerkId: string): Promise<UserModel.UserProfile> {
    try {
      // Resolve internal user
      const user = await db.query.users.findFirst({
        where: eq(users.clerkId, clerkId),
      });

      if (!user) {
        throw httpError(404, "[USER_NOT_FOUND] User not found");
      }

      return {
        success: true,
        message: "User profile retrieved successfully",
        data: {
          firstName: user.firstName ?? undefined,
          lastName: user.lastName ?? undefined,
          imageUrl: user.imageUrl ?? undefined,
          gender: user.gender ?? undefined,
          idNumber: user.idNumber ?? undefined,
          taxNumber: user.taxNumber ?? undefined,
          dob: user.dob ?? undefined,
          idType: (user.idType as UserModel.UserIdType) ?? undefined,
          role: user.role ?? undefined,
          position: user.position ?? undefined,
          email: user.email ?? undefined,
          phoneNumber: user.phoneNumber ?? undefined,
        },
      };
    } catch (error: any) {
      logger.error("Error getting user profile:", error);
      if (error?.status) throw error;
      throw httpError(500, "[GET_PROFILE_ERROR] Failed to get profile");
    }
  }
}
