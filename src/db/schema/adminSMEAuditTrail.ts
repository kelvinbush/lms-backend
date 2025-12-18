import { createId } from "@paralleldrive/cuid2";
import { index, pgEnum, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { users } from "./users";

// Enum for admin SME audit actions
export const adminSMEAuditActionEnum = pgEnum("admin_sme_audit_action", [
  // User management actions
  "user_created",
  "user_updated",
  "user_details_updated",

  // Onboarding step actions
  "step_1_saved", // User info
  "step_2_saved", // Business basic info
  "step_3_saved", // Location info
  "step_4_saved", // Personal documents
  "step_5_saved", // Company info documents
  "step_6_saved", // Financial documents
  "step_7_saved", // Permits & pitch deck

  // Business actions
  "business_info_updated",
  "financial_details_updated",

  // Invitation actions
  "invitation_sent",
  "invitation_resent",

  // Document actions
  "documents_uploaded",
  "documents_updated",
  "documents_deleted",
]);

/**
 * Admin SME Audit Trail table
 *
 * Tracks all admin actions/mutations on SME user accounts
 * Provides complete audit trail for compliance and accountability
 */
export const adminSMEAuditTrail = pgTable(
  "admin_sme_audit_trail",
  {
    id: varchar("id", { length: 24 })
      .$defaultFn(() => createId())
      .primaryKey(),

    // Core relationships
    adminUserId: varchar("admin_user_id", { length: 24 })
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }), // Admin who performed the action
    smeUserId: varchar("sme_user_id", { length: 24 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }), // SME user affected by the action

    // Action details
    action: adminSMEAuditActionEnum("action").notNull(),
    description: text("description"), // Human-readable description of the action
    details: text("details"), // JSON string with additional details about the action

    // Change tracking (optional, for updates)
    beforeData: text("before_data"), // JSON string of state before action
    afterData: text("after_data"), // JSON string of state after action

    // Request metadata
    ipAddress: varchar("ip_address", { length: 45 }), // IPv4 or IPv6
    userAgent: text("user_agent"), // Browser/client user agent

    // Timestamp
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => {
    return {
      // Primary lookup indexes
      idxAdminSMEAuditAdminUser: index("idx_admin_sme_audit_admin_user").on(table.adminUserId),
      idxAdminSMEAuditSMEUser: index("idx_admin_sme_audit_sme_user").on(table.smeUserId),
      idxAdminSMEAuditAction: index("idx_admin_sme_audit_action").on(table.action),
      idxAdminSMEAuditCreatedAt: index("idx_admin_sme_audit_created_at").on(table.createdAt),

      // Composite indexes for common queries
      idxAdminSMEAuditSMEUserAction: index("idx_admin_sme_audit_sme_user_action").on(
        table.smeUserId,
        table.action
      ),
      idxAdminSMEAuditSMEUserCreated: index("idx_admin_sme_audit_sme_user_created").on(
        table.smeUserId,
        table.createdAt
      ),
      idxAdminSMEAuditAdminUserCreated: index("idx_admin_sme_audit_admin_user_created").on(
        table.adminUserId,
        table.createdAt
      ),
      idxAdminSMEAuditActionCreated: index("idx_admin_sme_audit_action_created").on(
        table.action,
        table.createdAt
      ),
    };
  }
);

// Type exports for use in application code
export type AdminSMEAuditAction = (typeof adminSMEAuditActionEnum.enumValues)[number];
