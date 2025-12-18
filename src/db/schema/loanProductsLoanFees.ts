import { createId } from "@paralleldrive/cuid2";
import { index, pgTable, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { loanFees } from "./loanFees";
import { loanProducts } from "./loanProducts";

/**
 * Junction table for many-to-many relationship between loan products and loan fees
 * A loan product can have multiple fees, and a fee can be used by multiple products
 */
export const loanProductsLoanFees = pgTable(
  "loan_products_loan_fees",
  {
    id: varchar("id", { length: 24 })
      .$defaultFn(() => createId())
      .primaryKey(),
    loanProductId: varchar("loan_product_id", { length: 24 })
      .notNull()
      .references(() => loanProducts.id, { onDelete: "cascade" }),
    loanFeeId: varchar("loan_fee_id", { length: 24 })
      .notNull()
      .references(() => loanFees.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => {
    return {
      // Ensure a loan product can only be linked to a fee once
      uqLoanProductLoanFee: uniqueIndex("uq_loan_products_loan_fees").on(
        table.loanProductId,
        table.loanFeeId
      ),
      // Indexes for common queries
      idxLoanProductsLoanFeesProduct: index("idx_loan_products_loan_fees_product").on(
        table.loanProductId
      ),
      idxLoanProductsLoanFeesFee: index("idx_loan_products_loan_fees_fee").on(table.loanFeeId),
      idxLoanProductsLoanFeesCreated: index("idx_loan_products_loan_fees_created").on(
        table.createdAt
      ),
    };
  }
);
