import { db } from "../db";
import { users, internalInvitations } from "../db/schema";
import { eq, desc } from "drizzle-orm";
import { logger } from "../utils/logger";
import { extractEmailUpdateFromWebhook, extractUserDataFromWebhook } from "../modules/user/user.utils";
import { sendWelcomeEmail } from "../utils/email.utils";
import { User } from "../modules/user/user.service";
import { emailService } from "./email.service";
import { UserDeletionService } from "./user-deletion.service";
import type { WebhookEvent } from "@clerk/fastify";

export interface ClerkWebhookHandlerResult {
  success: boolean;
  data?: any;
  error?: {
    message: string;
    code: string;
  };
}

export class ClerkWebhookService {
  /**
   * Handles user.created webhook event
   * Creates local user, updates role if internal, sends welcome email, and manages invitations
   */
  static async handleUserCreated(event: WebhookEvent): Promise<ClerkWebhookHandlerResult> {
    try {
      logger.info("[WEBHOOK user.created] received", {
        clerkId: (event as any)?.data?.id,
        primaryEmailId: (event as any)?.data?.primary_email_address_id,
        publicMeta: (event as any)?.data?.public_metadata,
        unsafeMetaKeys: Object.keys((event as any)?.data?.unsafe_metadata || {}),
      });

      // Extract and validate user data
      const userDataResult = extractUserDataFromWebhook(event);
      if (!userDataResult.success) {
        logger.warn("[WEBHOOK user.created] extraction failed", {
          error: userDataResult.error?.message,
          missing: userDataResult.missingFields,
        });
        return {
          success: false,
          error: {
            message: userDataResult.error?.message || `Missing required fields: ${userDataResult.missingFields?.join(", ")}`,
            code: userDataResult.error?.code || "INVALID_METADATA",
          },
        };
      }

      // Create local user
      let userResult;
      try {
        userResult = await User.signUp(userDataResult.userData!);
        logger.info("[WEBHOOK user.created] local user created", {
          email: userDataResult.userData!.email,
          clerkId: userDataResult.userData!.clerkId,
        });
      } catch (e: any) {
        logger.error("[WEBHOOK user.created] local user creation failed", {
          email: userDataResult.userData!.email,
          error: e?.message,
        });
        throw e;
      }

      // Extract metadata for internal user handling
      const publicMeta: any = (event as any)?.data?.public_metadata || (event as any)?.data?.publicMeta;
      const isInternal: boolean = publicMeta?.internal === true;
      const invitedRole: string | undefined = publicMeta?.role;

      // Fetch user once for all subsequent operations (performance optimization)
      const user = await User.findByEmail(userDataResult.userData!.email);
      if (!user) {
        logger.error("[WEBHOOK user.created] user not found after creation", {
          email: userDataResult.userData!.email,
        });
        return {
          success: false,
          error: {
            message: "User not found after creation",
            code: "USER_NOT_FOUND",
          },
        };
      }

      // Process role update and internal user operations in parallel where possible
      const operations: Promise<void>[] = [];

      // Update role if present
      if (invitedRole) {
        operations.push(
          db
            .update(users)
            .set({ role: invitedRole, updatedAt: new Date() })
            .where(eq(users.id, user.id))
            .then(() => {
              logger.info("[WEBHOOK user.created] role mirrored to local user", {
                email: user.email,
                role: invitedRole,
              });
            })
            .catch((e: any) => {
              logger.error("[WEBHOOK user.created] role mirror failed", {
                email: user.email,
                error: e?.message,
              });
            })
        );
      }

      // Delete all internal invitations if user is internal
      if (isInternal) {
        operations.push(
          db
            .delete(internalInvitations)
            .where(eq(internalInvitations.email, user.email))
            .then(() => {
              logger.info("[WEBHOOK user.created] deleted all internal invitations for email", {
                email: user.email,
              });
            })
            .catch((e: any) => {
              logger.error("[WEBHOOK user.created] failed to delete internal invitations", {
                email: user.email,
                error: e?.message,
              });
            })
        );
      }

      // Wait for all operations to complete
      await Promise.allSettled(operations);

      // Send welcome email and phone OTP for non-internal users (async, non-blocking)
      // Using Promise.allSettled to run in parallel without blocking on errors
      if (!isInternal) {
        Promise.allSettled([
          sendWelcomeEmail(userDataResult.userData!.firstName, userDataResult.userData!.email),
          User.sendPhoneVerificationOtp(user.clerkId),
        ]).then((results) => {
          results.forEach((result, index) => {
            if (result.status === "rejected") {
              const operation = index === 0 ? "welcome email" : "phone verification OTP";
              logger.error(`Unhandled error sending ${operation}:`, result.reason);
            }
          });
        });
      }

      return {
        success: true,
        data: userResult,
      };
    } catch (error: any) {
      logger.error("[WEBHOOK user.created] unexpected error", {
        error: error?.message,
        stack: error?.stack,
      });
      return {
        success: false,
        error: {
          message: error?.message || "Failed to handle user.created event",
          code: "USER_CREATED_HANDLER_ERROR",
        },
      };
    }
  }

  /**
   * Handles user.updated webhook event
   * Updates user email when it changes in Clerk
   */
  static async handleUserUpdated(event: WebhookEvent): Promise<ClerkWebhookHandlerResult> {
    try {
      const updateInfo = extractEmailUpdateFromWebhook(event);
      if (!updateInfo.success) {
        return {
          success: false,
          error: {
            message: updateInfo.error?.message || "Invalid webhook payload",
            code: updateInfo.error?.code || "EMAIL_UPDATE_EXTRACTION_FAILED",
          },
        };
      }

      const updateResult = await User.updateEmail(updateInfo.clerkId!, updateInfo.email!);
      return {
        success: true,
        data: updateResult,
      };
    } catch (error: any) {
      logger.error("[WEBHOOK user.updated] unexpected error", {
        error: error?.message,
        stack: error?.stack,
      });
      return {
        success: false,
        error: {
          message: error?.message || "Failed to handle user.updated event",
          code: "USER_UPDATED_HANDLER_ERROR",
        },
      };
    }
  }

  /**
   * Handles email.created webhook event
   * Processes verification code emails and invitation emails
   */
  static async handleEmailCreated(event: WebhookEvent): Promise<ClerkWebhookHandlerResult> {
    try {
      const payload: any = event?.data || {};
      const toEmail: string | undefined = payload?.to_email_address;

      if (!toEmail) {
        logger.warn("[WEBHOOK email.created] missing email address");
        return {
          success: true,
          data: { received: true, ignored: true },
        };
      }

      // Branch A: Verification code emails (OTP)
      const code: string | undefined = payload?.data?.otp_code;
      if (code) {
        return await this.handleVerificationCodeEmail(toEmail, code);
      }

      // Branch B: Invitation emails
      const inviteUrl: string | undefined =
        payload?.data?.action_url || payload?.data?.url || payload?.data?.links?.[0]?.url;
      if (inviteUrl) {
        return await this.handleInvitationEmail(toEmail, inviteUrl);
      }

      // If neither OTP nor invitation URL present, ignore
      logger.warn("[WEBHOOK email.created] payload not recognized (no otp_code or invite url)", {
        hasEmail: !!toEmail,
      });
      return {
        success: true,
        data: { received: true, ignored: true },
      };
    } catch (error: any) {
      logger.error("[WEBHOOK email.created] unexpected error", {
        error: error?.message,
        stack: error?.stack,
      });
      return {
        success: false,
        error: {
          message: error?.message || "Failed to handle email.created event",
          code: "EMAIL_CREATED_HANDLER_ERROR",
        },
      };
    }
  }

  /**
   * Handles verification code email (OTP)
   */
  private static async handleVerificationCodeEmail(
    toEmail: string,
    code: string
  ): Promise<ClerkWebhookHandlerResult> {
    try {
      let firstName = "";
      try {
        const user = await User.findByEmail(toEmail);
        if (user?.firstName) {
          firstName = user.firstName;
        } else {
          logger.warn("[WEBHOOK email.created] user not found or missing firstName", { toEmail });
        }
      } catch (e) {
        logger.warn("[WEBHOOK email.created] lookup errored; proceeding without firstName", {
          toEmail,
          error: e instanceof Error ? e.message : e,
        });
      }

      const sendResult = await emailService.sendVerificationCodeEmail({
        firstName,
        email: toEmail,
        code,
      });

      if (!sendResult.success) {
        logger.error("[WEBHOOK email.created] failed to dispatch verification email", {
          toEmail,
          error: sendResult.error,
        });
        return {
          success: false,
          error: {
            message: "Failed to send verification email",
            code: "EMAIL_SEND_FAILED",
          },
        };
      }

      return {
        success: true,
        data: { received: true, messageId: sendResult.messageId },
      };
    } catch (error: any) {
      logger.error("[WEBHOOK email.created] verification code email handler error", {
        toEmail,
        error: error?.message,
      });
      return {
        success: false,
        error: {
          message: error?.message || "Failed to handle verification code email",
          code: "VERIFICATION_EMAIL_HANDLER_ERROR",
        },
      };
    }
  }

  /**
   * Handles invitation email
   */
  private static async handleInvitationEmail(
    toEmail: string,
    inviteUrl: string
  ): Promise<ClerkWebhookHandlerResult> {
    try {
      logger.info("[WEBHOOK email.created] invitation email detected", {
        toEmail,
        inviteUrlPresent: !!inviteUrl,
      });

      // Find latest pending internal invitation to get the intended role
      const record = await db.query.internalInvitations.findFirst({
        where: eq(internalInvitations.email, toEmail),
        orderBy: desc(internalInvitations.createdAt),
      });

      const role: "super-admin" | "admin" | "member" = (record?.role as any) || "member";
      logger.info("[WEBHOOK email.created] sending custom invite", { toEmail, role });

      const sendInvite = await emailService.sendInternalInviteEmail({
        email: toEmail,
        inviteUrl,
        role,
      });

      if (!sendInvite.success) {
        logger.error("[WEBHOOK email.created] failed to send custom internal invite email", {
          toEmail,
          error: sendInvite.error,
        });
        return {
          success: false,
          error: {
            message: "Failed to send invitation email",
            code: "INVITE_EMAIL_SEND_FAILED",
          },
        };
      }

      return {
        success: true,
        data: { received: true, messageId: sendInvite.messageId },
      };
    } catch (error: any) {
      logger.error("[WEBHOOK email.created] invitation email handler error", {
        toEmail,
        error: error?.message,
      });
      return {
        success: false,
        error: {
          message: error?.message || "Failed to handle invitation email",
          code: "INVITATION_EMAIL_HANDLER_ERROR",
        },
      };
    }
  }

  /**
   * Handles user.deleted webhook event
   * Deletes user and all related data
   */
  static async handleUserDeleted(event: WebhookEvent): Promise<ClerkWebhookHandlerResult> {
    try {
      const clerkId: string | undefined = event?.data?.id;

      if (!clerkId) {
        logger.warn("[WEBHOOK user.deleted] event missing clerk user ID");
        return {
          success: true,
          data: { received: true, ignored: true },
        };
      }

      logger.info("[WEBHOOK user.deleted] processing user deletion", { clerkId });
      await UserDeletionService.deleteUserAndAllRelatedData(clerkId);

      return {
        success: true,
        data: { received: true, deleted: true },
      };
    } catch (error: any) {
      logger.error("[WEBHOOK user.deleted] unexpected error", {
        error: error?.message,
        stack: error?.stack,
      });
      return {
        success: false,
        error: {
          message: error?.message || "Failed to handle user.deleted event",
          code: "USER_DELETED_HANDLER_ERROR",
        },
      };
    }
  }

  /**
   * Routes webhook events to appropriate handlers
   */
  static async handleWebhookEvent(event: WebhookEvent): Promise<ClerkWebhookHandlerResult> {
    const { type } = event;

    switch (type) {
      case "user.created":
        return await this.handleUserCreated(event);
      case "user.updated":
        return await this.handleUserUpdated(event);
      case "email.created":
        return await this.handleEmailCreated(event);
      case "user.deleted":
        return await this.handleUserDeleted(event);
      default:
        logger.info("[WEBHOOK] unhandled event type", { type });
        return {
          success: true,
          data: { received: true, ignored: true, type },
        };
    }
  }
}

