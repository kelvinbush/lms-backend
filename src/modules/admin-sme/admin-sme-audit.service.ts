import { db } from "../../db";
import { adminSMEAuditTrail, users } from "../../db/schema";
import { logger } from "../../utils/logger";
import { eq } from "drizzle-orm";
import type { AdminSMEAuditAction } from "../../db/schema/adminSMEAuditTrail";

export interface AuditLogParams {
  adminClerkId: string; // Clerk ID of the admin performing the action
  smeUserId: string; // Internal user ID of the SME user being affected
  action: AdminSMEAuditAction;
  description?: string;
  details?: Record<string, any>; // Additional details about the action
  beforeData?: Record<string, any>; // State before action (for updates)
  afterData?: Record<string, any>; // State after action (for updates)
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Audit Service for Admin SME Actions
 * Logs all admin mutations/activities on SME accounts
 */
export abstract class AdminSMEAuditService {
  /**
   * Log an admin action on an SME account
   * Non-blocking: errors are logged but don't throw
   */
  static async logAction(params: AuditLogParams): Promise<void> {
    try {
      // Resolve admin user ID from Clerk ID
      const adminUser = await db.query.users.findFirst({
        where: eq(users.clerkId, params.adminClerkId),
        columns: { id: true },
      });

      if (!adminUser) {
        logger.warn("[AdminSME Audit] Admin user not found for Clerk ID", {
          clerkId: params.adminClerkId,
        });
        return;
      }

      // Insert audit trail entry
      await db.insert(adminSMEAuditTrail).values({
        adminUserId: adminUser.id,
        smeUserId: params.smeUserId,
        action: params.action,
        description: params.description || null,
        details: params.details ? JSON.stringify(params.details) : null,
        beforeData: params.beforeData ? JSON.stringify(params.beforeData) : null,
        afterData: params.afterData ? JSON.stringify(params.afterData) : null,
        ipAddress: params.ipAddress || null,
        userAgent: params.userAgent || null,
      } as any);

      logger.debug("[AdminSME Audit] Action logged", {
        action: params.action,
        adminUserId: adminUser.id,
        smeUserId: params.smeUserId,
      });
    } catch (error: any) {
      // Non-blocking: log error but don't throw
      logger.error("[AdminSME Audit] Failed to log action", {
        error: error?.message,
        action: params.action,
        smeUserId: params.smeUserId,
      });
    }
  }

  /**
   * Helper to extract request metadata for audit logging
   */
  static extractRequestMetadata(request: any): {
    ipAddress?: string;
    userAgent?: string;
  } {
    return {
      ipAddress: request.ip || request.headers?.["x-forwarded-for"] || request.headers?.["x-real-ip"],
      userAgent: request.headers?.["user-agent"],
    };
  }
}


