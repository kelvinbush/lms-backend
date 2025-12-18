import { createId } from "@paralleldrive/cuid2";
import { index, pgTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";

export const userGroups = pgTable(
  "user_groups",
  {
    id: varchar("id", { length: 24 })
      .$defaultFn(() => createId())
      .primaryKey(),
    name: varchar("name", { length: 150 }).notNull(),
    slug: varchar("slug", { length: 150 }).notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => {
    return {
      uqName: uniqueIndex("uq_user_groups_name").on(table.name),
      uqSlug: uniqueIndex("uq_user_groups_slug").on(table.slug),
      idxCreatedAt: index("idx_user_groups_created_at").on(table.createdAt),
      idxDeletedAt: index("idx_user_groups_deleted_at").on(table.deletedAt),
    };
  }
);
