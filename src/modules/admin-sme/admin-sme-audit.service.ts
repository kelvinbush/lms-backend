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

      // Helper to safely stringify objects (filters out undefined, keeps null)
      const stringifyObject = (obj: Record<string, any> | undefined): string | null => {
        if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
          logger.debug("[AdminSME Audit] stringifyObject: invalid input", {
            obj,
            objType: typeof obj,
            isArray: Array.isArray(obj),
          });
          return null;
        }
        
        logger.debug("[AdminSME Audit] stringifyObject: processing", {
          inputKeys: Object.keys(obj),
          inputEntries: Object.entries(obj).map(([k, v]) => ({
            key: k,
            value: v,
            type: typeof v,
            isUndefined: v === undefined,
          })),
        });
        
        // Filter out undefined values, keep null (null is meaningful)
        const cleaned: Record<string, any> = {};
        for (const [key, value] of Object.entries(obj)) {
          if (value !== undefined) {
            cleaned[key] = value;
          }
        }
        
        logger.debug("[AdminSME Audit] stringifyObject: after cleaning", {
          cleanedKeys: Object.keys(cleaned),
          cleanedEntries: Object.entries(cleaned),
          willStringify: Object.keys(cleaned).length > 0,
        });
        
        // Only stringify if there are actual properties
        const result = Object.keys(cleaned).length > 0 ? JSON.stringify(cleaned) : null;
        logger.debug("[AdminSME Audit] stringifyObject: result", {
          result,
          resultLength: result?.length,
        });
        return result;
      };

      const detailsJson = stringifyObject(params.details);
      
      logger.debug("[AdminSME Audit] About to insert", {
        action: params.action,
        hasDetails: !!params.details,
        detailsJson,
        detailsJsonLength: detailsJson?.length,
      });

      // Insert audit trail entry
      await db.insert(adminSMEAuditTrail).values({
        adminUserId: adminUser.id,
        smeUserId: params.smeUserId,
        action: params.action,
        description: params.description || null,
        details: detailsJson,
        beforeData: stringifyObject(params.beforeData),
        afterData: stringifyObject(params.afterData),
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


