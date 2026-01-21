import { createId } from "@paralleldrive/cuid2";
import {
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { businessProfiles } from "./businessProfiles";
import { loanProducts } from "./loanProducts";
import { users } from "./users";

// Enum for loan application status
export const loanApplicationStatusEnum = pgEnum("loan_application_status", [
  "kyc_kyb_verification",
  "eligibility_check",
  "credit_analysis",
  "head_of_credit_review",
  "internal_approval_ceo",
  "committee_decision",
  "sme_offer_approval",
  "document_generation",
  "signing_execution",
  "awaiting_disbursement",
  "approved",
  "rejected",
  "disbursed",
  "cancelled",
]);

// Enum for contract status within the loan application workflow
export const contractStatusEnum = pgEnum("contract_status", [
  "contract_uploaded",
  "contract_sent_for_signing",
  "contract_in_signing",
  "contract_partially_signed",
  "contract_fully_signed",
  "contract_voided",
  "contract_expired",
]);

/**
 * Loan applications table
 *
 * Notes:
 * - Links businesses/entrepreneurs to loan products
 * - Tracks the complete loan application lifecycle
 * - Supports currency conversion for multi-currency scenarios
 * - loanId is auto-generated display ID (e.g., "LN-48291")
 * - entrepreneurId references the business owner/entrepreneur (typically same as businessProfiles.userId)
 * - createdBy references the user who created the application (can be admin/member creating on behalf, or entrepreneur creating their own)
 */
export const loanApplications = pgTable(
  "loan_applications",
  {
    id: varchar("id", { length: 24 })
      .$defaultFn(() => createId())
      .primaryKey(),

    // Application identification
    loanId: varchar("loan_id", { length: 50 }).notNull().unique(), // Display ID (e.g., "LN-48291")

    // Core relationships
    businessId: varchar("business_id", { length: 24 })
      .notNull()
      .references(() => businessProfiles.id, { onDelete: "restrict" }),
    entrepreneurId: varchar("entrepreneur_id", { length: 24 })
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }), // Business owner/entrepreneur
    loanProductId: varchar("loan_product_id", { length: 24 })
      .notNull()
      .references(() => loanProducts.id, { onDelete: "restrict" }),

    // Funding details
    fundingAmount: numeric("funding_amount", { precision: 15, scale: 2 }).notNull(),
    fundingCurrency: varchar("funding_currency", { length: 10 }).notNull(), // ISO 4217 currency code

    // Currency conversion (optional)
    convertedAmount: numeric("converted_amount", { precision: 15, scale: 2 }),
    convertedCurrency: varchar("converted_currency", { length: 10 }),
    exchangeRate: numeric("exchange_rate", { precision: 15, scale: 6 }),

    // Repayment terms
    repaymentPeriod: integer("repayment_period").notNull(), // Repayment period (unit matches loan product's termUnit: days, weeks, months, quarters, or years)

    // Additional details
    intendedUseOfFunds: varchar("intended_use_of_funds", { length: 100 }).notNull(), // Max 100 characters
    interestRate: numeric("interest_rate", { precision: 7, scale: 4 }).notNull(), // Interest rate per annum (percentage)

    // Metadata
    loanSource: varchar("loan_source", { length: 100 }), // Source of application (e.g., "Admin Platform", "SME Platform")

    // Active version reference (for counter-offers)
    activeVersionId: varchar("active_version_id", { length: 24 }),

    // Application status and workflow
    status: loanApplicationStatusEnum("status").default("kyc_kyb_verification").notNull(),
    // External signing integration (SignRequest)
    // - signrequestDocumentUuid: Document UUID (used for webhooks & downloads)
    // - signrequestSignrequestUuid: SignRequest UUID (used for resend endpoint)
    signrequestDocumentUuid: varchar("signrequest_document_uuid", { length: 255 }),
    signrequestSignrequestUuid: varchar("signrequest_signrequest_uuid", { length: 255 }),
    contractStatus: contractStatusEnum("contract_status"),

    // Timeline tracking
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    rejectedAt: timestamp("rejected_at", { withTimezone: true }),
    disbursedAt: timestamp("disbursed_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),

    // Rejection reason (if applicable)
    rejectionReason: text("rejection_reason"),

    // Eligibility assessment (when moving from eligibility_check to credit_analysis)
    eligibilityAssessmentComment: text("eligibility_assessment_comment"),
    eligibilityAssessmentCompletedAt: timestamp("eligibility_assessment_completed_at", {
      withTimezone: true,
    }),
    eligibilityAssessmentCompletedBy: varchar("eligibility_assessment_completed_by", {
      length: 24,
    }).references(() => users.id, { onDelete: "set null" }),

    // Credit assessment (when moving from credit_analysis to head_of_credit_review)
    creditAssessmentComment: text("credit_assessment_comment"),
    creditAssessmentCompletedAt: timestamp("credit_assessment_completed_at", {
      withTimezone: true,
    }),
    creditAssessmentCompletedBy: varchar("credit_assessment_completed_by", {
      length: 24,
    }).references(() => users.id, { onDelete: "set null" }),

    // Head of credit review assessment (when moving from head_of_credit_review to internal_approval_ceo)
    headOfCreditReviewComment: text("head_of_credit_review_comment"),
    headOfCreditReviewCompletedAt: timestamp("head_of_credit_review_completed_at", {
      withTimezone: true,
    }),
    headOfCreditReviewCompletedBy: varchar("head_of_credit_review_completed_by", {
      length: 24,
    }).references(() => users.id, { onDelete: "set null" }),

    // Internal approval CEO assessment (when moving from internal_approval_ceo to committee_decision)
    internalApprovalCeoComment: text("internal_approval_ceo_comment"),
    internalApprovalCeoCompletedAt: timestamp("internal_approval_ceo_completed_at", {
      withTimezone: true,
    }),
    internalApprovalCeoCompletedBy: varchar("internal_approval_ceo_completed_by", {
      length: 24,
    }).references(() => users.id, { onDelete: "set null" }),

    // Committee decision (when moving from committee_decision to sme_offer_approval)
    termSheetUrl: text("term_sheet_url"), // URL to the uploaded term sheet document
    termSheetUploadedAt: timestamp("term_sheet_uploaded_at", {
      withTimezone: true,
    }),
    termSheetUploadedBy: varchar("term_sheet_uploaded_by", {
      length: 24,
    }).references(() => users.id, { onDelete: "set null" }),

    // Audit tracking
    createdBy: varchar("created_by", { length: 24 })
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }), // User who created the application (admin/member or entrepreneur themselves)
    lastUpdatedBy: varchar("last_updated_by", { length: 24 }).references(() => users.id, {
      onDelete: "set null",
    }), // User who last updated
    lastUpdatedAt: timestamp("last_updated_at", { withTimezone: true }).defaultNow(),

    // Standard lifecycle fields
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => {
    return {
      // Unique constraints
      uqLoanApplicationsLoanId: uniqueIndex("uq_loan_applications_loan_id").on(table.loanId),

      // Primary lookup indexes
      idxLoanApplicationsBusiness: index("idx_loan_applications_business").on(table.businessId),
      idxLoanApplicationsEntrepreneur: index("idx_loan_applications_entrepreneur").on(
        table.entrepreneurId
      ),
      idxLoanApplicationsLoanProduct: index("idx_loan_applications_loan_product").on(
        table.loanProductId
      ),
      idxLoanApplicationsStatus: index("idx_loan_applications_status").on(table.status),
      idxLoanApplicationsLoanId: index("idx_loan_applications_loan_id").on(table.loanId),
      idxLoanApplicationsLoanSource: index("idx_loan_applications_loan_source").on(
        table.loanSource
      ),

      // Timeline indexes
      idxLoanApplicationsSubmittedAt: index("idx_loan_applications_submitted_at").on(
        table.submittedAt
      ),
      idxLoanApplicationsApprovedAt: index("idx_loan_applications_approved_at").on(
        table.approvedAt
      ),
      idxLoanApplicationsRejectedAt: index("idx_loan_applications_rejected_at").on(
        table.rejectedAt
      ),
      idxLoanApplicationsDisbursedAt: index("idx_loan_applications_disbursed_at").on(
        table.disbursedAt
      ),

      // Audit indexes
      idxLoanApplicationsCreatedBy: index("idx_loan_applications_created_by").on(table.createdBy),
      idxLoanApplicationsLastUpdatedBy: index("idx_loan_applications_last_updated_by").on(
        table.lastUpdatedBy
      ),
      idxLoanApplicationsLastUpdatedAt: index("idx_loan_applications_last_updated_at").on(
        table.lastUpdatedAt
      ),

      // Soft delete indexes
      idxLoanApplicationsDeletedAt: index("idx_loan_applications_deleted_at").on(table.deletedAt),
      idxLoanApplicationsCreatedAt: index("idx_loan_applications_created_at").on(table.createdAt),

      // Composite indexes for common queries
      idxLoanApplicationsBusinessStatus: index("idx_loan_applications_business_status").on(
        table.businessId,
        table.status
      ),
      idxLoanApplicationsEntrepreneurStatus: index("idx_loan_applications_entrepreneur_status").on(
        table.entrepreneurId,
        table.status
      ),
      idxLoanApplicationsLoanProductStatus: index("idx_loan_applications_loan_product_status").on(
        table.loanProductId,
        table.status
      ),
      idxLoanApplicationsStatusDeleted: index("idx_loan_applications_status_deleted").on(
        table.status,
        table.deletedAt
      ),
      idxLoanApplicationsCreatedAtStatus: index("idx_loan_applications_created_at_status").on(
        table.createdAt,
        table.status
      ),
    };
  }
);

// Type exports for use in application code
export type LoanApplicationStatus = (typeof loanApplicationStatusEnum.enumValues)[number];
