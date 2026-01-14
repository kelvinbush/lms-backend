import { createId } from "@paralleldrive/cuid2";
import { index, pgEnum, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { loanApplications } from "./loanApplications";
import { users } from "./users";

// Enum for loan document types
export const loanDocumentTypeEnum = pgEnum("loan_document_type", [
  "eligibility_assessment_support",
  "credit_analysis_report",
  "approval_memo",
  "committee_decision_document",
  "offer_letter",
  "contract",
  "disbursement_authorization",
  // Additional types can be added as needed
]);

/**
 * Loan Documents table
 *
 * Stores documents attached to loan applications (not personal/business documents).
 * These are documents generated or uploaded during the loan application process.
 */
export const loanDocuments = pgTable(
  "loan_documents",
  {
    id: varchar("id", { length: 24 })
      .$defaultFn(() => createId())
      .primaryKey(),
    loanApplicationId: varchar("loan_application_id", { length: 24 })
      .notNull()
      .references(() => loanApplications.id, { onDelete: "cascade" }),
    documentType: loanDocumentTypeEnum("document_type").notNull(),
    docUrl: text("doc_url").notNull(),
    docName: varchar("doc_name", { length: 255 }), // Optional display name
    uploadedBy: varchar("uploaded_by", { length: 24 })
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    notes: text("notes"), // Optional notes about the document
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => {
    return {
      // Primary lookup indexes
      idxLoanDocumentsLoanApp: index("idx_loan_documents_loan_app").on(table.loanApplicationId),
      idxLoanDocumentsType: index("idx_loan_documents_type").on(table.documentType),
      idxLoanDocumentsUploadedBy: index("idx_loan_documents_uploaded_by").on(table.uploadedBy),

      // Composite indexes for common queries
      idxLoanDocumentsLoanAppType: index("idx_loan_documents_loan_app_type").on(
        table.loanApplicationId,
        table.documentType
      ),
      idxLoanDocumentsLoanAppDeleted: index("idx_loan_documents_loan_app_deleted").on(
        table.loanApplicationId,
        table.deletedAt
      ),
    };
  }
);

// Type exports for use in application code
export type LoanDocumentType = (typeof loanDocumentTypeEnum.enumValues)[number];
