import { createId } from "@paralleldrive/cuid2";
import { index, pgTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";

/**
 * Organizations table
 * Used as loan providers in the loan product creation flow
 */
export const organizations = pgTable(
  "organizations",
  {
    id: varchar("id", { length: 24 })
      .$defaultFn(() => createId())
      .primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => {
    return {
      uqOrganizationsName: uniqueIndex("uq_organizations_name").on(table.name),
      idxOrganizationsCreatedAt: index("idx_organizations_created_at").on(table.createdAt),
      idxOrganizationsDeletedAt: index("idx_organizations_deleted_at").on(table.deletedAt),
    };
  }
);
