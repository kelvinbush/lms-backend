import { createId } from "@paralleldrive/cuid2";
import { index, pgEnum, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";

// Internal invitations to manage backend-driven Clerk invitations for internal users
// Status values align with Clerk invitation lifecycle but are simplified for admin UI
export const internalInvitationStatusEnum = pgEnum("internal_invitation_status", [
  "pending",
  "revoked",
  "accepted",
  "expired",
]);
export const internalInvitations = pgTable(
  "internal_invitations",
  {
    id: varchar("id", { length: 24 })
      .$defaultFn(() => createId())
      .primaryKey(),
    email: varchar("email", { length: 320 }).notNull(),
    role: varchar("role", { length: 50 }).notNull(), // super-admin | admin | member
    clerkInvitationId: varchar("clerk_invitation_id", { length: 64 }),
    status: internalInvitationStatusEnum("status").notNull(),
    invitedByUserId: varchar("invited_by_user_id", { length: 64 }).notNull(),
    lastSentAt: timestamp("last_sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_internal_invitations_email").on(table.email),
    index("idx_internal_invitations_status").on(table.status),
    index("idx_internal_invitations_created_at").on(table.createdAt),
  ]
);
