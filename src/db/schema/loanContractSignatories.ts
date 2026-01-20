import { createId } from "@paralleldrive/cuid2";
import { boolean, index, integer, pgEnum, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";
import { loanApplications } from "./loanApplications";
import { loanDocuments } from "./loanDocuments";

// Enum for contract signatory category
export const contractSignatoryCategoryEnum = pgEnum("contract_signatory_category", [
  "mk", // Melanin Kapital / company signatory
  "client", // Client / borrower signatory
]);

export const loanContractSignatories = pgTable(
  "loan_contract_signatories",
  {
    id: varchar("id", { length: 24 })
      .$defaultFn(() => createId())
      .primaryKey(),
    loanApplicationId: varchar("loan_application_id", { length: 24 })
      .notNull()
      .references(() => loanApplications.id, { onDelete: "cascade" }),
    contractDocumentId: varchar("contract_document_id", { length: 24 })
      .notNull()
      .references(() => loanDocuments.id, { onDelete: "cascade" }),
    category: contractSignatoryCategoryEnum("category").notNull(),
    fullName: varchar("full_name", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    roleTitle: varchar("role_title", { length: 255 }),
    signingOrder: integer("signing_order"),
    hasSigned: boolean("has_signed").default(false).notNull(),
    signedAt: timestamp("signed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => {
    return {
      idxLoanContractSignatoriesLoanApp: index(
        "idx_loan_contract_signatories_loan_app"
      ).on(table.loanApplicationId),
      idxLoanContractSignatoriesContract: index(
        "idx_loan_contract_signatories_contract"
      ).on(table.contractDocumentId),
      idxLoanContractSignatoriesCategory: index(
        "idx_loan_contract_signatories_category"
      ).on(table.category),
    };
  }
);

export type ContractSignatoryCategory =
  (typeof contractSignatoryCategoryEnum.enumValues)[number];

