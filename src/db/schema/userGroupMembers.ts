import { createId } from "@paralleldrive/cuid2";
import { index, pgTable, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { userGroups } from "./userGroups";
import { users } from "./users";

export const userGroupMembers = pgTable(
  "user_group_members",
  {
    id: varchar("id", { length: 24 })
      .$defaultFn(() => createId())
      .primaryKey(),
    userId: varchar("user_id", { length: 24 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    groupId: varchar("group_id", { length: 24 })
      .notNull()
      .references(() => userGroups.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => {
    return {
      uqUserGroup: uniqueIndex("uq_user_group_membership").on(table.userId, table.groupId),
      idxUser: index("idx_user_group_members_user").on(table.userId),
      idxGroup: index("idx_user_group_members_group").on(table.groupId),
      idxCreatedAt: index("idx_user_group_members_created_at").on(table.createdAt),
    };
  }
);
