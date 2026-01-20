import { createId } from "@paralleldrive/cuid2";
import {
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { loanApplications } from "./loanApplications";
import { users } from "./users";

export const loanApplicationVersionStatusEnum = pgEnum(
  "loan_application_version_status",
  ["original", "counter_offer"]
);

export const returnTypeEnum = pgEnum("return_type", ["interest_based", "revenue_sharing"]);

export const repaymentStructureEnum = pgEnum("repayment_structure", [
  "principal_and_interest",
  "bullet_repayment",
]);

export const repaymentCycleEnum = pgEnum("repayment_cycle", [
  "daily",
  "weekly",
  "bi_weekly",
  "monthly",
  "quarterly",
]);

export const loanApplicationVersions = pgTable(
  "loan_application_versions",
  {
    id: varchar("id", { length: 25 })
      .$defaultFn(() => createId())
      .primaryKey(),
    loanApplicationId: varchar("loan_application_id", { length: 24 })
      .notNull()
      .references(() => loanApplications.id, { onDelete: "cascade" }),

    status: loanApplicationVersionStatusEnum("status").notNull(),

    fundingAmount: numeric("funding_amount", { precision: 15, scale: 2 }).notNull(),
    repaymentPeriod: integer("repayment_period").notNull(),

    returnType: returnTypeEnum("return_type").notNull(),
    interestRate: numeric("interest_rate", { precision: 7, scale: 4 }).notNull(),

    repaymentStructure: repaymentStructureEnum("repayment_structure").notNull(),
    repaymentCycle: repaymentCycleEnum("repayment_cycle").notNull(),
    gracePeriod: integer("grace_period"),
    firstPaymentDate: timestamp("first_payment_date", { withTimezone: true }),

    customFees: jsonb("custom_fees").notNull().default(sql`'[]'::jsonb`),

    createdBy: varchar("created_by", { length: 24 })
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => {
    return {
      idxLoanApplicationVersionsLoanApplication: index(
        "idx_loan_application_versions_loan_application"
      ).on(table.loanApplicationId),
      idxLoanApplicationVersionsStatus: index("idx_loan_application_versions_status").on(
        table.status
      ),
    };
  }
);
