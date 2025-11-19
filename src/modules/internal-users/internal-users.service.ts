import { clerkClient } from "@clerk/fastify";
import { logger } from "../../utils/logger";
import { db } from "../../db";
import {
  internalInvitations,
  internalInvitationStatusEnum,
  users,
} from "../../db/schema";
import { and, eq, isNotNull, isNull } from "drizzle-orm";
import type { InternalUsersModel } from "./internal-users.model";
import { emailService } from "../../services/email.service";

export class InternalUsersService {
  static async requireSuperAdminOrThrow(clerkUserId: string) {
    const current = await db.query.users.findFirst({
      where: eq(users.clerkId, clerkUserId),
    });
    if (!current || current.role !== "super-admin") {
      const err: any = new Error("Forbidden");
      err.status = 403;
      throw err;
    }
    return current;
  }

  static async createInvitation(params: {
    invitedByClerkUserId: string;
    body: InternalUsersModel.CreateInvitationBody;
  }): Promise<InternalUsersModel.CreateInvitationResponse> {
    const { body, invitedByClerkUserId } = params;

    await InternalUsersService.requireSuperAdminOrThrow(invitedByClerkUserId);

    const appUrl = process.env.APP_URL?.replace(/\/$/, "");
    if (!appUrl) {
      const err: any = new Error("APP_URL is not configured");
      err.status = 500;
      throw err;
    }
    const redirectUrl = `${appUrl}/internal/accept-invite`;

    let invitation: any;
    try {
      logger.info("[INVITE] Creating Clerk invitation", {
        email: body.email,
        role: body.role,
        redirectUrl,
      });
      invitation = await clerkClient.invitations.createInvitation({
        emailAddress: body.email,
        publicMetadata: { role: body.role, internal: true },
        redirectUrl,
      } as any);
      logger.info("[INVITE] Clerk invitation created", {
        email: body.email,
        invitationId: invitation?.id,
      });
    } catch (e: any) {
      const err: any = new Error(
        e?.errors?.[0]?.message || e?.message || "Failed to create invitation",
      );
      err.status = e?.status || 400;
      logger.error("[INVITE] Clerk invitation failed", {
        email: body.email,
        role: body.role,
        error: err.message,
      });
      throw err;
    }

    const now = new Date();
    await db.insert(internalInvitations).values({
      email: body.email,
      role: body.role,
      clerkInvitationId: (invitation as any).id,
      status:
        "pending" as (typeof internalInvitationStatusEnum.enumValues)[number],
      invitedByUserId: invitedByClerkUserId,
      lastSentAt: now,
      createdAt: now,
      updatedAt: now,
    });
    logger.info("[INVITE] Stored internal invitation record", {
      email: body.email,
      invitationId: invitation?.id,
    });

    return { success: true, invitationId: (invitation as any).id };
  }

  /**
   * Lists all internal users including pending invitations and active/inactive users
   * Combines data from local database, Clerk API, and pending invitations
   */
  static async listInternalUsers(): Promise<InternalUsersModel.ListUsersResponse> {
    // Step 1: Fetch pending invitations
    const pendingInvitations = await this.fetchPendingInvitations();

    // Step 2: Fetch local users with roles (internal users)
    const localUsers = await this.fetchLocalUsersWithRoles();

    // Step 3: Batch fetch Clerk user statuses (fixes N+1 query problem)
    const clerkUserStatuses = await this.batchFetchClerkUserStatuses(
      localUsers.map((u) => u.clerkId),
    );

    // Step 4: Transform invitations to items
    const invitationItems = this.transformInvitationsToItems(pendingInvitations);

    // Step 5: Transform local users to items with Clerk status
    const userItems = this.transformUsersToItems(localUsers, clerkUserStatuses);

    // Step 6: Combine and deduplicate by email
    const allItems = [...invitationItems, ...userItems];
    const deduplicatedItems = this.deduplicateItemsByEmail(allItems);

    return { items: deduplicatedItems };
  }

  /**
   * Fetches all pending internal invitations
   */
  private static async fetchPendingInvitations() {
    return await db.query.internalInvitations.findMany({
      where: eq(internalInvitations.status, "pending" as any),
    });
  }

  /**
   * Fetches all local users with roles who haven't been deleted
   */
  private static async fetchLocalUsersWithRoles() {
    return await db.query.users.findMany({
      where: and(isNotNull(users.role), isNull(users.deletedAt)),
    });
  }

  /**
   * Batch fetches Clerk user statuses to avoid N+1 query problem
   * Returns a map of clerkId -> { isActive: boolean, error?: string }
   */
  private static async batchFetchClerkUserStatuses(
    clerkIds: string[],
  ): Promise<Map<string, { isActive: boolean; error?: string }>> {
    const statusMap = new Map<string, { isActive: boolean; error?: string }>();

    if (clerkIds.length === 0) {
      return statusMap;
    }

    // Batch fetch all Clerk users in parallel
    const clerkUserPromises = clerkIds.map(async (clerkId) => {
      try {
        const clerkUser = await clerkClient.users.getUser(clerkId);
        const isActive =
          !(clerkUser as any)?.banned &&
          !(clerkUser as any)?.locked &&
          !Boolean((clerkUser as any)?.lockout_expires_at);

        return {
          clerkId,
          result: { isActive, error: undefined },
        };
      } catch (error: any) {
        logger.warn("[listInternalUsers] Failed to fetch Clerk user status", {
          clerkId,
          error: error?.message || "Unknown error",
        });
        return {
          clerkId,
          result: {
            isActive: false,
            error: error?.message || "Clerk lookup failed",
          },
        };
      }
    });

    // Wait for all requests to complete (using allSettled to handle failures gracefully)
    const results = await Promise.allSettled(clerkUserPromises);

    // Build status map from results
    results.forEach((result, index) => {
      const clerkId = clerkIds[index];
      if (result.status === "fulfilled") {
        statusMap.set(result.value.clerkId, result.value.result);
      } else {
        logger.error("[listInternalUsers] Unexpected error fetching Clerk user", {
          clerkId,
          error: result.reason,
        });
        statusMap.set(clerkId, {
          isActive: false,
          error: "Unexpected error",
        });
      }
    });

    return statusMap;
  }

  /**
   * Transforms pending invitations to ListedUserItem format
   */
  private static transformInvitationsToItems(
    invitations: Awaited<ReturnType<typeof this.fetchPendingInvitations>>,
  ): InternalUsersModel.ListedUserItem[] {
    return invitations.map((inv) => ({
      name: inv.email,
      email: inv.email,
      status: "pending" as const,
      invitationId: inv.clerkInvitationId || inv.id,
      role: inv.role as InternalUsersModel.Role,
      createdAt: inv.createdAt?.toISOString(),
      updatedAt: inv.updatedAt?.toISOString(),
    }));
  }

  /**
   * Transforms local users to ListedUserItem format with Clerk status
   */
  private static transformUsersToItems(
    localUsers: Awaited<ReturnType<typeof this.fetchLocalUsersWithRoles>>,
    clerkStatuses: Map<string, { isActive: boolean; error?: string }>,
  ): InternalUsersModel.ListedUserItem[] {
    return localUsers.map((user) => {
      // Get Clerk status (default to inactive if not found)
      const clerkStatus = clerkStatuses.get(user.clerkId) || {
        isActive: false,
        error: "Clerk status not found",
      };

      return {
        name:
          [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email,
        imageUrl: user.imageUrl || undefined,
        phoneNumber: user.phoneNumber || undefined,
        email: user.email,
        role: user.role as InternalUsersModel.Role,
        status: clerkStatus.isActive ? ("active" as const) : ("inactive" as const),
        clerkId: user.clerkId,
        createdAt: user.createdAt?.toISOString(),
        updatedAt: user.updatedAt?.toISOString(),
      };
    });
  }

  /**
   * Deduplicates items by email, preferring active/inactive users over pending invitations
   * Strategy: If a user exists in both invitations and as an active user, show the user status
   * This handles the case where an invitation was sent but the user already exists
   */
  private static deduplicateItemsByEmail(
    items: InternalUsersModel.ListedUserItem[],
  ): InternalUsersModel.ListedUserItem[] {
    const byEmail = new Map<string, InternalUsersModel.ListedUserItem>();

    // Status priority: active (2) > inactive (1) > pending (0)
    const getStatusPriority = (status: string): number => {
      if (status === "active") return 2;
      if (status === "inactive") return 1;
      return 0; // pending
    };

    for (const item of items) {
      const existing = byEmail.get(item.email);

      if (!existing) {
        byEmail.set(item.email, item);
        continue;
      }

      // Keep the item with higher priority status
      const currentPriority = getStatusPriority(item.status);
      const existingPriority = getStatusPriority(existing.status);

      if (currentPriority > existingPriority) {
        byEmail.set(item.email, item);
      }
      // If priorities are equal, prefer the one with more information (has clerkId)
      else if (
        currentPriority === existingPriority &&
        item.clerkId &&
        !existing.clerkId
      ) {
        byEmail.set(item.email, item);
      }
    }

    return Array.from(byEmail.values());
  }

  static async resendInvitation(params: {
    localInvitationId: string;
  }): Promise<InternalUsersModel.BasicSuccessResponse> {
    logger.info("[INVITE] Resend request received", {
      invitationId: params.localInvitationId,
    });
    let inv = await db.query.internalInvitations.findFirst({
      where: eq(internalInvitations.id, params.localInvitationId),
    });
    // Support passing Clerk invitation id as well
    if (!inv) {
      logger.info("[INVITE] Resend lookup by clerkInvitationId fallback", {
        clerkInvitationId: params.localInvitationId,
      });
      inv = await db.query.internalInvitations.findFirst({
        where: eq(
          internalInvitations.clerkInvitationId,
          params.localInvitationId,
        ),
      });
    }
    if (!inv) {
      const err: any = new Error("Invitation not found");
      err.status = 404;
      throw err;
    }
    // Create a fresh Clerk invitation; webhook will handle the email sending
    const redirectUrl = `${process.env.APP_URL?.replace(/\/$/, "") || ""}/internal/accept-invite`;
    const newInvite = await clerkClient.invitations.createInvitation({
      emailAddress: inv.email,
      publicMetadata: { role: inv.role, internal: true },
      redirectUrl,
    } as any);
    await db
      .update(internalInvitations)
      .set({
        lastSentAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(internalInvitations.id, inv.id));
    logger.info("[INVITE] Resent Clerk invitation", {
      email: inv.email,
      oldInvitationId: inv.clerkInvitationId,
      newInvitationId: (newInvite as any)?.id,
    });
    return { success: true };
  }

  static async revokeInvitation(params: {
    localInvitationId: string;
  }): Promise<InternalUsersModel.BasicSuccessResponse> {
    logger.info("[INVITE] Revoke request received", {
      invitationId: params.localInvitationId,
    });
    let inv = await db.query.internalInvitations.findFirst({
      where: eq(internalInvitations.id, params.localInvitationId),
    });
    // Support passing Clerk invitation id as well
    if (!inv) {
      logger.info("[INVITE] Revoke lookup by clerkInvitationId fallback", {
        clerkInvitationId: params.localInvitationId,
      });
      inv = await db.query.internalInvitations.findFirst({
        where: eq(
          internalInvitations.clerkInvitationId,
          params.localInvitationId,
        ),
      });
    }
    if (!inv || !inv.clerkInvitationId) {
      const err: any = new Error("Invitation not found");
      err.status = 404;
      throw err;
    }
    // Revoke via Clerk then remove local record
    await clerkClient.invitations.revokeInvitation(
      inv.clerkInvitationId as any,
    );
    await db
      .delete(internalInvitations)
      .where(eq(internalInvitations.id, inv.id));
    logger.info("[INVITE] Revoked Clerk invitation and deleted local record", {
      email: inv.email,
      invitationId: inv.clerkInvitationId,
    });
    return { success: true };
  }

  static async deactivateUser(params: {
    clerkUserId: string;
  }): Promise<InternalUsersModel.BasicSuccessResponse> {
    // Prefer locking the user instead of banning, so we can later unlock
    await clerkClient.users.lockUser(params.clerkUserId as any);
    try {
      const sessions = await clerkClient.sessions.getSessionList({
        userId: params.clerkUserId,
      } as any);
      for (const s of (sessions as any)?.data || []) {
        await clerkClient.sessions.revokeSession(s.id);
      }
    } catch {}

    // Send deactivation email non-blocking
    // Fetch user data in a single DB lookup to get both email and firstName
    db.query.users
      .findFirst({
        where: eq(users.clerkId, params.clerkUserId),
      })
      .then((user) => {
        if (user?.email) {
          emailService
            .sendAccountDeactivationEmail({
              email: user.email,
              firstName: user.firstName || undefined,
            })
            .catch((error) => {
              logger.error("Failed to send deactivation email:", error);
            });
        }
      })
      .catch((error) => {
        logger.error("Failed to fetch user for deactivation email:", error);
      });

    return { success: true };
  }

  static async removeUser(params: {
    clerkUserId: string;
  }): Promise<InternalUsersModel.BasicSuccessResponse> {
    await clerkClient.users.deleteUser(params.clerkUserId);
    try {
      const u = await db.query.users.findFirst({
        where: eq(users.clerkId, params.clerkUserId),
      });
      if (u) {
        await db
          .update(users)
          .set({ deletedAt: new Date(), updatedAt: new Date() })
          .where(eq(users.id, u.id));
      }
    } catch {}
    return { success: true };
  }

  static async activateUser(params: {
    clerkUserId: string;
  }): Promise<InternalUsersModel.BasicSuccessResponse> {
    // Unlock the user account in Clerk
    await clerkClient.users.unlockUser(params.clerkUserId as any);

    // Send reactivation email non-blocking
    // Fetch user data in a single DB lookup to get both email and firstName
    db.query.users
      .findFirst({
        where: eq(users.clerkId, params.clerkUserId),
      })
      .then((user) => {
        if (user?.email) {
          emailService
            .sendAccountReactivationEmail({
              email: user.email,
              firstName: user.firstName || undefined,
            })
            .catch((error) => {
              logger.error("Failed to send reactivation email:", error);
            });
        }
      })
      .catch((error) => {
        logger.error("Failed to fetch user for reactivation email:", error);
      });

    return { success: true };
  }
}
