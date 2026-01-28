import { createId } from "@paralleldrive/cuid2";
import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { businessProfiles } from "./businessProfiles";
import { loanApplications } from "./loanApplications";

export const businessDocumentTypeEnum = pgEnum("business_document_type", [
  // Core entity and incorporation docs
  "business_registration",
  "articles_of_association",
  "business_permit",
  "tax_registration_certificate",
  "certificate_of_incorporation",
  "tax_clearance_certificate",
  "partnership_deed",
  "memorandum_of_association",
  // Company registration documents (CR forms)
  "CR1",
  "CR2",
  "CR8",
  "CR12",

  // Plans and presentations
  "business_plan",
  "pitch_deck",

  // Banking/financial docs (year-based allowed via docYear)
  "annual_bank_statement",
  "audited_financial_statements",
  "income_statements",
  "personal_bank_statement",

  // Generic fallback for any other document type (name comes from payload/UI)
  "other",
]);

// Type alias for use in application code
export type BusinessDocumentType = (typeof businessDocumentTypeEnum.enumValues)[number];

export const businessDocuments = pgTable(
  "business_documents",
  {
    id: varchar("id", { length: 24 })
      .$defaultFn(() => createId())
      .primaryKey(),
    businessId: varchar("business_id", { length: 24 })
      .notNull()
      .references(() => businessProfiles.id, { onDelete: "cascade" }),
    // Use enum for doc type for better consistency
    docType: businessDocumentTypeEnum("doc_type").notNull(),
    // Optional human-readable document name/label (required for 'other' type)
    docName: varchar("doc_name", { length: 200 }),
    docUrl: text("doc_url"),
    // Optional: store a password if the document is password-protected
    isPasswordProtected: boolean("is_password_protected").default(false).notNull(),
    docPassword: varchar("doc_password", { length: 200 }),
    docBankName: varchar("doc_bank_name", { length: 100 }),
    // For year-based documents (e.g., audited financial statements, annual bank statements)
    docYear: integer("doc_year"),
    // Verification fields
    isVerified: boolean("is_verified").default(false).notNull(),
    verifiedForLoanApplicationId: varchar("verified_for_loan_application_id", {
      length: 24,
    }).references(() => loanApplications.id, { onDelete: "set null" }),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => {
    return {
      idxBusinessDocsBusiness: index("idx_business_docs_business").on(table.businessId),
      idxBusinessDocsType: index("idx_business_docs_type").on(table.docType),
      idxBusinessDocsYear: index("idx_business_docs_year").on(table.docYear),
      idxBusinessDocsDeletedAt: index("idx_business_docs_deleted_at").on(table.deletedAt),
      idxBusinessDocsCreatedAt: index("idx_business_docs_created_at").on(table.createdAt),
      // Prevent duplicates per business, doc type, year, bank name, and doc name
      uqBusinessDocsUniquePerYear: uniqueIndex("uq_business_docs_unique_per_year").on(
        table.businessId,
        table.docType,
        table.docYear,
        table.docBankName,
        table.docName
      ),
      idxBusinessDocsBusinessDeleted: index("idx_business_docs_business_deleted").on(
        table.businessId,
        table.deletedAt
      ),
      idxBusinessDocsBusinessCreated: index("idx_business_docs_business_created").on(
        table.businessId,
        table.createdAt
      ),

      // Additional performance indexes for common query patterns
      idxBusinessDocsBusinessType: index("idx_business_docs_business_type").on(
        table.businessId,
        table.docType
      ),
      idxBusinessDocsBusinessTypeDeleted: index("idx_business_docs_business_type_deleted").on(
        table.businessId,
        table.docType,
        table.deletedAt
      ),

      // Verification indexes
      idxBusinessDocsVerified: index("idx_business_docs_verified").on(
        table.isVerified,
        table.verifiedForLoanApplicationId
      ),
    };
  }
);
