import { pgTable, text, timestamp, boolean, numeric, varchar, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";
import { pgEnum } from "drizzle-orm/pg-core";

// Enum for fee calculation method
export const feeCalculationMethodEnum = pgEnum("fee_calculation_method", [
  "flat",
  "percentage",
]);

// Enum for fee collection rule
export const feeCollectionRuleEnum = pgEnum("fee_collection_rule", [
  "upfront",
  "end_of_term",
]);

// Enum for fee calculation basis
export const feeCalculationBasisEnum = pgEnum("fee_calculation_basis", [
  "principal",
  "total_disbursed",
]);

/**
 * Loan fees master table
 * Stores reusable fee configurations that can be linked to loan products
 */
export const loanFees = pgTable(
  "loan_fees",
  {
    id: varchar("id", { length: 24 }).$defaultFn(() => createId()).primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    calculationMethod: feeCalculationMethodEnum("calculation_method").notNull(),
    rate: numeric("rate", { precision: 15, scale: 4 }).notNull(), // Fee rate/percentage
    collectionRule: feeCollectionRuleEnum("collection_rule").notNull(),
    allocationMethod: varchar("allocation_method", { length: 100 }).notNull(), // e.g., "first_installment", "spread_installments"
    calculationBasis: feeCalculationBasisEnum("calculation_basis").notNull(),
    isArchived: boolean("is_archived").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => {
    return {
      uqLoanFeesName: uniqueIndex("uq_loan_fees_name").on(table.name),
      idxLoanFeesArchived: index("idx_loan_fees_archived").on(table.isArchived),
      idxLoanFeesDeletedAt: index("idx_loan_fees_deleted_at").on(table.deletedAt),
      idxLoanFeesCreatedAt: index("idx_loan_fees_created_at").on(table.createdAt),
    };
  },
);
