import { pgTable, text, timestamp, varchar, index, boolean, pgEnum, integer } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";

// Enum for onboarding status
export const onboardingStatusEnum = pgEnum("onboarding_status", [
  "draft",
  "pending_invitation",
  "active",
]);

export const users = pgTable(
  "users",
  {
    id: varchar("id", { length: 24 }).$defaultFn(() => createId()).primaryKey(),
    clerkId: varchar("clerk_id", { length: 64 }).unique(), // Nullable for draft users
    firstName: varchar("first_name", { length: 100 }),
    lastName: varchar("last_name", { length: 100 }),
    imageUrl: text("image_url"),
    email: varchar("email", { length: 320 }).notNull().unique(),
    phoneNumber: varchar("phone_number", { length: 32 }),
    isPhoneVerified: boolean("is_phone_verified").default(false),
    phoneVerificationCode: varchar("phone_verification_code", { length: 10 }),
    phoneVerificationExpiry: timestamp("phone_verification_expiry", { withTimezone: true }),
    role: varchar("role", { length: 50 }),
    position: varchar("position", { length: 50 }),
    gender: varchar("gender", { length: 20 }),
    onboardingStatus: onboardingStatusEnum("onboarding_status").default("draft").notNull(),
    onboardingStep: integer("onboarding_step"), // 1-7, nullable
    idNumber: varchar("id_number", { length: 50 }),
    taxNumber: varchar("tax_number", { length: 50 }),
    dob: timestamp("dob", { withTimezone: true }),
    idType: varchar("id_type", { length: 50 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => {
    return {
      idxUsersDeletedAt: index("idx_users_deleted_at").on(table.deletedAt),
      idxUsersCreatedAt: index("idx_users_created_at").on(table.createdAt),
      idxUsersOnboardingStatus: index("idx_users_onboarding_status").on(table.onboardingStatus),
    };
  },
);

// Type export for use in application code
export type OnboardingStatus = (typeof onboardingStatusEnum.enumValues)[number];
