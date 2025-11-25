import { pgTable, varchar, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";
import { businessProfiles } from "./businessProfiles";
import { userGroups } from "./userGroups";

/**
 * Junction table for many-to-many relationship between businesses and user groups
 * A business can belong to multiple user groups (programs)
 */
export const businessUserGroups = pgTable(
  "business_user_groups",
  {
    id: varchar("id", { length: 24 }).$defaultFn(() => createId()).primaryKey(),
    businessId: varchar("business_id", { length: 24 })
      .notNull()
      .references(() => businessProfiles.id, { onDelete: "cascade" }),
    groupId: varchar("group_id", { length: 24 })
      .notNull()
      .references(() => userGroups.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => {
    return {
      // Ensure a business can only be in a group once
      uqBusinessGroup: uniqueIndex("uq_business_user_groups").on(
        table.businessId,
        table.groupId
      ),
      // Indexes for common queries
      idxBusinessUserGroupsBusiness: index("idx_business_user_groups_business").on(
        table.businessId
      ),
      idxBusinessUserGroupsGroup: index("idx_business_user_groups_group").on(table.groupId),
      idxBusinessUserGroupsCreated: index("idx_business_user_groups_created").on(
        table.createdAt
      ),
    };
  },
);

