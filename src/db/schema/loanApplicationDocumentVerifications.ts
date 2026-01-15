import { createId } from "@paralleldrive/cuid2";
import { index, pgEnum, pgTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { loanApplications } from "./loanApplications";
import { users } from "./users";

// Enum for document verification status
export const documentVerificationStatusEnum = pgEnum("document_verification_status", [
  "pending",
  "approved",
  "rejected",
]);

// Enum for document type (personal or business)
export const documentTypeEnum = pgEnum("document_type", ["personal", "business"]);

/**
 * Loan Application Document Verifications table
 *
 * Links loan applications to specific document instances with verification status.
 * Tracks which documents were verified for each loan application and their approval/rejection status.
 */
export const loanApplicationDocumentVerifications = pgTable(
  "loan_application_document_verifications",
  {
    id: varchar("id", { length: 24 })
      .$defaultFn(() => createId())
      .primaryKey(),

    // Core relationships
    loanApplicationId: varchar("loan_application_id", { length: 24 })
      .notNull()
      .references(() => loanApplications.id, { onDelete: "cascade" }),

    // Document reference - can be either personal or business document
    documentType: documentTypeEnum("document_type").notNull(),
    documentId: varchar("document_id", { length: 24 }).notNull(), // References either personal_documents.id or business_documents.id

    // Verification details
    verificationStatus: documentVerificationStatusEnum("verification_status")
      .default("pending")
      .notNull(),
    verifiedBy: varchar("verified_by", { length: 24 }).references(() => users.id, {
      onDelete: "set null",
    }), // Admin user who performed verification
    verifiedAt: timestamp("verified_at", { withTimezone: true }), // Null until verified
    rejectionReason: text("rejection_reason"), // Reason if rejected
    notes: text("notes"), // Admin notes

    // Standard lifecycle fields
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => {
    return {
      // Unique constraint: one verification per document per loan application
      uqVerificationLoanAppDocument: uniqueIndex("uq_verification_loan_app_document").on(
        table.loanApplicationId,
        table.documentType,
        table.documentId
      ),

      // Primary lookup indexes
      idxVerificationsLoanApp: index("idx_verifications_loan_app").on(table.loanApplicationId),
      idxVerificationsDocument: index("idx_verifications_document").on(
        table.documentType,
        table.documentId
      ),
      idxVerificationsStatus: index("idx_verifications_status").on(table.verificationStatus),
      idxVerificationsVerifiedBy: index("idx_verifications_verified_by").on(table.verifiedBy),

      // Composite indexes for common queries
      idxVerificationsLoanAppStatus: index("idx_verifications_loan_app_status").on(
        table.loanApplicationId,
        table.verificationStatus
      ),
      idxVerificationsLoanAppType: index("idx_verifications_loan_app_type").on(
        table.loanApplicationId,
        table.documentType
      ),
    };
  }
);

// Type exports for use in application code
export type DocumentVerificationStatus = (typeof documentVerificationStatusEnum.enumValues)[number];
export type DocumentType = (typeof documentTypeEnum.enumValues)[number];
