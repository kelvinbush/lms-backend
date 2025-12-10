import { pgTable, timestamp, varchar, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";
import { loanProducts } from "./loanProducts";
import { userGroups } from "./userGroups";

/**
 * Junction table for many-to-many relationship between loan products and user groups
 * A loan product can be visible to multiple user groups
 */
export const loanProductsUserGroups = pgTable(
  "loan_products_user_groups",
  {
    id: varchar("id", { length: 24 }).$defaultFn(() => createId()).primaryKey(),
    loanProductId: varchar("loan_product_id", { length: 24 })
      .notNull()
      .references(() => loanProducts.id, { onDelete: "cascade" }),
    userGroupId: varchar("user_group_id", { length: 24 })
      .notNull()
      .references(() => userGroups.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => {
    return {
      // Ensure a loan product can only be linked to a user group once
      uqLoanProductUserGroup: uniqueIndex("uq_loan_products_user_groups").on(
        table.loanProductId,
        table.userGroupId
      ),
      // Indexes for common queries
      idxLoanProductsUserGroupsProduct: index("idx_loan_products_user_groups_product").on(
        table.loanProductId
      ),
      idxLoanProductsUserGroupsGroup: index("idx_loan_products_user_groups_group").on(table.userGroupId),
      idxLoanProductsUserGroupsCreated: index("idx_loan_products_user_groups_created").on(
        table.createdAt
      ),
    };
  },
);
