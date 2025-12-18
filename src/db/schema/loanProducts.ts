import { createId } from "@paralleldrive/cuid2";
import {
  boolean,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { pgEnum } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";

// Enum for loan term unit granularity
// Use plural names to be explicit in meaning when reading rows
export const loanTermUnitEnum = pgEnum("loan_term_unit", [
  "days",
  "weeks",
  "months",
  "quarters",
  "years",
]);

// Enum to indicate the period unit the interest rate refers to
export const interestRatePeriodEnum = pgEnum("interest_rate_period", [
  "per_day",
  "per_month",
  "per_quarter",
  "per_year",
]);

// Enum for repayment frequency (e.g., how often repayments are made)
export const repaymentFrequencyEnum = pgEnum("repayment_frequency", [
  "weekly",
  "biweekly",
  "monthly",
  "quarterly",
]);

// Enum for amortization method
export const amortizationMethodEnum = pgEnum("amortization_method", ["flat", "reducing_balance"]);

// Enum for interest collection method
export const interestCollectionMethodEnum = pgEnum("interest_collection_method", [
  "installments",
  "deducted",
  "capitalized",
]);

// Enum for interest recognition criteria
export const interestRecognitionCriteriaEnum = pgEnum("interest_recognition_criteria", [
  "on_disbursement",
  "when_accrued",
]);

// Enum for grace period unit
export const gracePeriodUnitEnum = pgEnum("grace_period_unit", [
  "days",
  "weeks",
  "months",
  "years",
]);

// Enum for product status
export const productStatusEnum = pgEnum("product_status", ["draft", "active", "archived"]);

/**
 * Loan products master table
 *
 * Notes:
 * - interestRate is stored as a percentage value (e.g., 12.5 means 12.5%).
 * - minAmount/maxAmount are stored as NUMERIC(15,2) to support large currencies with cents.
 * - minTerm/maxTerm use the unit defined by termUnit (e.g., months).
 */
export const loanProducts = pgTable(
  "loan_products",
  {
    id: varchar("id", { length: 24 })
      .$defaultFn(() => createId())
      .primaryKey(),

    // Identity & presentation
    name: varchar("name", { length: 150 }).notNull(),
    slug: varchar("slug", { length: 180 }),
    summary: text("summary"),
    description: text("description"),

    // Organization and visibility
    organizationId: varchar("organization_id", { length: 24 })
      .references(() => organizations.id, { onDelete: "restrict" })
      .notNull(),

    // Loan availability window
    availabilityStartDate: timestamp("availability_start_date", { withTimezone: true }),
    availabilityEndDate: timestamp("availability_end_date", { withTimezone: true }),

    // Monetary constraints & currency
    currency: varchar("currency", { length: 10 }).notNull(), // ISO 4217 preferred (e.g., "USD", "KES")
    minAmount: numeric("min_amount", { precision: 15, scale: 2 }).notNull(),
    maxAmount: numeric("max_amount", { precision: 15, scale: 2 }).notNull(),

    // Term constraints & unit
    minTerm: integer("min_term").notNull(),
    maxTerm: integer("max_term").notNull(),
    termUnit: loanTermUnitEnum("term_unit").notNull(),

    // Pricing
    interestRate: numeric("interest_rate", { precision: 7, scale: 4 }).notNull(), // percentage value
    ratePeriod: interestRatePeriodEnum("rate_period").default("per_year").notNull(),
    amortizationMethod: amortizationMethodEnum("amortization_method")
      .default("reducing_balance")
      .notNull(),
    repaymentFrequency: repaymentFrequencyEnum("repayment_frequency").default("monthly").notNull(),
    interestCollectionMethod: interestCollectionMethodEnum("interest_collection_method").notNull(),
    interestRecognitionCriteria: interestRecognitionCriteriaEnum(
      "interest_recognition_criteria"
    ).notNull(),

    // Grace period
    maxGracePeriod: integer("max_grace_period"),
    maxGraceUnit: gracePeriodUnitEnum("max_grace_unit"),

    // Lifecycle and versioning (minimal compliance)
    version: integer("version").default(1).notNull(),
    status: productStatusEnum("status").default("draft").notNull(),
    changeReason: text("change_reason"),
    approvedBy: varchar("approved_by"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => {
    return {
      uqLoanProductsName: uniqueIndex("uq_loan_products_name").on(table.name),
      idxLoanProductsCurrency: index("idx_loan_products_currency").on(table.currency),
      idxLoanProductsTermUnit: index("idx_loan_products_term_unit").on(table.termUnit),
      idxLoanProductsRatePeriod: index("idx_loan_products_rate_period").on(table.ratePeriod),
      idxLoanProductsRepaymentFrequency: index("idx_loan_products_repayment_frequency").on(
        table.repaymentFrequency
      ),
      idxLoanProductsAmortization: index("idx_loan_products_amortization").on(
        table.amortizationMethod
      ),
      idxLoanProductsActive: index("idx_loan_products_active").on(table.isActive),
      idxLoanProductsStatus: index("idx_loan_products_status").on(table.status),
      idxLoanProductsVersion: index("idx_loan_products_version").on(table.version),
      idxLoanProductsDeletedAt: index("idx_loan_products_deleted_at").on(table.deletedAt),
      idxLoanProductsCreatedAt: index("idx_loan_products_created_at").on(table.createdAt),
      idxLoanProductsOrganizationId: index("idx_loan_products_organization_id").on(
        table.organizationId
      ),
      idxLoanProductsAvailabilityDates: index("idx_loan_products_availability_dates").on(
        table.availabilityStartDate,
        table.availabilityEndDate
      ),
    };
  }
);
