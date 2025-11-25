import { pgTable, varchar, timestamp, integer, index, uniqueIndex, jsonb } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";
import { users } from "./users";

/**
 * Table for tracking SME onboarding progress
 * Tracks which steps are completed and current step
 */
export const smeOnboardingProgress = pgTable(
  "sme_onboarding_progress",
  {
    id: varchar("id", { length: 24 }).$defaultFn(() => createId()).primaryKey(),
    userId: varchar("user_id", { length: 24 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" })
      .unique(), // One progress record per user
    currentStep: integer("current_step"), // 1-7, nullable
    completedSteps: jsonb("completed_steps"), // Array of integers [1,2,3...] representing completed steps
    lastSavedAt: timestamp("last_saved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => {
    return {
      // Ensure one progress record per user
      uqSmeOnboardingProgressUser: uniqueIndex("uq_sme_onboarding_progress_user").on(
        table.userId
      ),
      // Indexes for common queries
      idxSmeOnboardingProgressUser: index("idx_sme_onboarding_progress_user").on(table.userId),
      idxSmeOnboardingProgressCurrentStep: index("idx_sme_onboarding_progress_current_step").on(
        table.currentStep
      ),
      idxSmeOnboardingProgressCreated: index("idx_sme_onboarding_progress_created").on(
        table.createdAt
      ),
    };
  },
);

