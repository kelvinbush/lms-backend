import type { AdminSMEModel } from "./admin-sme.model";
import { db } from "../../db";
import { users } from "../../db/schema";
import { logger } from "../../utils/logger";
import { eq } from "drizzle-orm";
import { clerkClient } from "@clerk/fastify";
import { httpError } from "./admin-sme.utils";

/**
 * Invitation Service for SME Users
 * Sends Clerk invitations to SME users (can be called at any time)
 */
export abstract class AdminSMEInvitationService {
  /**
   * Send/Resend Clerk invitation to SME user
   * Can be called at any time, even before all steps are complete
   */
  static async sendSMEInvitation(
    userId: string,
    adminClerkId: string,
  ): Promise<AdminSMEModel.InvitationResponse> {
    try {
      // Verify user exists
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
      });

      if (!user) {
        throw httpError(404, "[USER_NOT_FOUND] User not found");
      }

      // Check if user already has an active Clerk account
      if (user.clerkId && user.onboardingStatus === "active") {
        throw httpError(400, "[USER_ACTIVE] User already has an active account");
      }

      // If user already has a pending invitation, we still allow resend.
      // Clerk may return a duplicate invitation error if one exists for this email.
      if (user.onboardingStatus === "pending_invitation") {
        logger.info(
          "[AdminSME Invitation] User already has pending invitation, will attempt to revoke/replace",
          {
            userId,
            email: user.email,
          },
        );
      }

      // Prepare Clerk invitation metadata
      const appUrl = process.env.APP_URL?.replace(/\/$/, "");
      if (!appUrl) {
        throw httpError(500, "[CONFIG_ERROR] APP_URL is not configured");
      }
      const redirectUrl = `${appUrl}/accept-invite`;

      // Create Clerk invitation with user metadata
      let invitation: any;
      try {
        logger.info("[AdminSME Invitation] Creating Clerk invitation", {
          email: user.email,
          userId,
          redirectUrl,
        });

        invitation = await clerkClient.invitations.createInvitation({
          emailAddress: user.email,
          publicMetadata: {
            // Don't mark as internal - these are SME users
            internal: false,
          },
          unsafeMetadata: {
            firstName: user.firstName,
            lastName: user.lastName,
            gender: user.gender,
            phoneNumber: user.phoneNumber,
            dob: user.dob ? user.dob.toISOString() : undefined,
          },
          redirectUrl,
        } as any);

        logger.info("[AdminSME Invitation] Clerk invitation created", {
          email: user.email,
          invitationId: invitation?.id,
        });
      } catch (e: any) {
        const clerkMessage: string =
          e?.errors?.[0]?.message || e?.message || "Failed to create invitation";

        // If Clerk reports a duplicate invitation, try to revoke existing and create a fresh one
        if (String(clerkMessage).toLowerCase().includes("duplicate invitation")) {
          logger.warn("[AdminSME Invitation] Duplicate invitation detected, attempting revoke + resend", {
            email: user.email,
            userId,
          });

          try {
            // Best-effort: list active invitations for this email and revoke them
            const list: any = await (clerkClient.invitations as any).getInvitationList?.({
              emailAddress: user.email,
            });

            if (list?.data?.length) {
              for (const inv of list.data) {
                try {
                  await clerkClient.invitations.revokeInvitation(inv.id as any);
                } catch (revokeErr: any) {
                  logger.warn("[AdminSME Invitation] Failed to revoke existing invitation", {
                    email: user.email,
                    invitationId: inv.id,
                    error: revokeErr?.message,
                  });
                }
              }
            }

            // Try creating a fresh invitation after revoking
            invitation = await clerkClient.invitations.createInvitation({
              emailAddress: user.email,
              publicMetadata: { internal: false },
              unsafeMetadata: {
                firstName: user.firstName,
                lastName: user.lastName,
                gender: user.gender,
                phoneNumber: user.phoneNumber,
                dob: user.dob ? user.dob.toISOString() : undefined,
              },
              redirectUrl,
            } as any);

            logger.info("[AdminSME Invitation] New Clerk invitation created after revocation", {
              email: user.email,
              invitationId: invitation?.id,
            });
          } catch (reissueError: any) {
            const err: any = new Error(
              reissueError?.errors?.[0]?.message ||
                reissueError?.message ||
                "Failed to reissue invitation",
            );
            err.status = reissueError?.status || 400;
            logger.error("[AdminSME Invitation] Failed to reissue invitation after duplicate", {
              email: user.email,
              error: err.message,
            });
            throw err;
          }
        } else {
          const err: any = new Error(clerkMessage);
          err.status = e?.status || 400;
          logger.error("[AdminSME Invitation] Clerk invitation failed", {
            email: user.email,
            error: err.message,
          });
          throw err;
        }
      }

      // Update user status to pending_invitation
      await db
        .update(users)
        .set({
          onboardingStatus: "pending_invitation" as any,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));

      logger.info("[AdminSME Invitation] Invitation sent and user status updated", {
        userId,
        email: user.email,
        invitationId: invitation?.id,
      });

      return {
        success: true,
        invitationId: (invitation as any).id,
        message: "Invitation sent successfully",
      };
    } catch (error: any) {
      logger.error("[AdminSME Invitation] Error sending invitation", {
        error: error?.message,
        userId,
      });
      if (error?.status) throw error;
      throw httpError(500, "[INVITATION_ERROR] Failed to send invitation");
    }
  }
}


