import { createId } from "@paralleldrive/cuid2";
import { index, pgEnum, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { loanApplications } from "./loanApplications";
import { users } from "./users";

// Enum for loan application audit event types
export const loanApplicationAuditEventTypeEnum = pgEnum("loan_application_audit_event_type", [
  "submitted",
  "cancelled",
  "review_in_progress",
  "rejected",
  "approved",
  "awaiting_disbursement",
  "disbursed",
  "status_changed", // Generic status change for other statuses
  "document_verified_approved", // KYC/KYB document verification approved
  "document_verified_rejected", // KYC/KYB document verification rejected
  "kyc_kyb_completed", // KYC/KYB verification step completed
]);

/**
 * Loan Application Audit Trail table
 *
 * Tracks all events and status changes for loan applications
 * Provides complete audit trail for compliance and timeline display
 */
export const loanApplicationAuditTrail = pgTable(
  "loan_application_audit_trail",
  {
    id: varchar("id", { length: 24 })
      .$defaultFn(() => createId())
      .primaryKey(),

    // Core relationships
    loanApplicationId: varchar("loan_application_id", { length: 24 })
      .notNull()
      .references(() => loanApplications.id, { onDelete: "cascade" }), // Loan application being tracked
    performedById: varchar("performed_by_id", { length: 24 })
      .references(() => users.id, { onDelete: "set null" }), // User who performed the action (optional for system events)

    // Event details
    eventType: loanApplicationAuditEventTypeEnum("event_type").notNull(),
    title: text("title").notNull(), // Event title (e.g., "Loan submitted successfully")
    description: text("description"), // Event description
    status: varchar("status", { length: 50 }), // Current status at time of event (for reference)

    // Change tracking (optional, for status changes)
    previousStatus: varchar("previous_status", { length: 50 }), // Previous status (for status changes)
    newStatus: varchar("new_status", { length: 50 }), // New status (for status changes)
    details: text("details"), // JSON string with additional event details

    // Request metadata (optional)
    ipAddress: varchar("ip_address", { length: 45 }), // IPv4 or IPv6
    userAgent: text("user_agent"), // Browser/client user agent

    // Timestamp
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => {
    return {
      // Primary lookup indexes
      idxLoanApplicationAuditLoanApp: index("idx_loan_application_audit_loan_app").on(
        table.loanApplicationId
      ),
      idxLoanApplicationAuditPerformedBy: index("idx_loan_application_audit_performed_by").on(
        table.performedById
      ),
      idxLoanApplicationAuditEventType: index("idx_loan_application_audit_event_type").on(
        table.eventType
      ),
      idxLoanApplicationAuditCreatedAt: index("idx_loan_application_audit_created_at").on(
        table.createdAt
      ),

      // Composite indexes for common queries
      idxLoanApplicationAuditLoanAppEvent: index("idx_loan_application_audit_loan_app_event").on(
        table.loanApplicationId,
        table.eventType
      ),
      idxLoanApplicationAuditLoanAppCreated: index("idx_loan_application_audit_loan_app_created").on(
        table.loanApplicationId,
        table.createdAt
      ),
    };
  }
);

// Type exports for use in application code
export type LoanApplicationAuditEventType =
  (typeof loanApplicationAuditEventTypeEnum.enumValues)[number];
