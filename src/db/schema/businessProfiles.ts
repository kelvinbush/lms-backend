import { createId } from "@paralleldrive/cuid2";
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const businessProfiles = pgTable(
  "business_profiles",
  {
    id: varchar("id", { length: 24 })
      .$defaultFn(() => createId())
      .primaryKey(),
    userId: varchar("user_id", { length: 24 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 150 }).notNull(),
    description: text("description"),
    imageUrl: text("image_url"),
    coverImage: text("cover_image"),
    entityType: varchar("entity_type", { length: 50 }),
    country: varchar("country", { length: 100 }),
    city: varchar("city", { length: 100 }),
    address: varchar("address", { length: 200 }),
    zipCode: varchar("zip_code", { length: 20 }),
    address2: varchar("address2", { length: 200 }),
    sector: varchar("sector", { length: 100 }),
    yearOfIncorporation: varchar("year_of_incorporation", { length: 10 }),
    avgMonthlyTurnover: numeric("avg_monthly_turnover", { precision: 15, scale: 2 }),
    avgYearlyTurnover: numeric("avg_yearly_turnover", { precision: 15, scale: 2 }),
    borrowingHistory: boolean("borrowing_history"),
    amountBorrowed: numeric("amount_borrowed", { precision: 15, scale: 2 }),
    loanStatus: varchar("loan_status", { length: 50 }),
    defaultReason: text("default_reason"),
    currency: varchar("currency", { length: 10 }),
    ownershipType: varchar("ownership_type", { length: 50 }),
    ownershipPercentage: integer("ownership_percentage"),
    isOwned: boolean("is_owned"),
    // New fields for admin onboarding (all nullable for backward compatibility)
    logo: text("logo"), // Logo URL
    sectors: jsonb("sectors"), // Array of sectors (new field, keep old 'sector' for compatibility)
    selectionCriteria: jsonb("selection_criteria"), // Array of strings (2xCriteria)
    noOfEmployees: integer("no_of_employees"),
    website: text("website"),
    registeredOfficeAddress: text("registered_office_address"),
    registeredOfficeCity: varchar("registered_office_city", { length: 100 }),
    registeredOfficeZipCode: varchar("registered_office_zip_code", { length: 20 }),
    companyHQ: varchar("company_hq", { length: 100 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => {
    return {
      idxBusinessProfilesUser: index("idx_business_profiles_user").on(table.userId),
      idxBusinessProfilesName: index("idx_business_profiles_name").on(table.name),
      idxBusinessProfilesDeletedAt: index("idx_business_profiles_deleted_at").on(table.deletedAt),
      idxBusinessProfilesCreatedAt: index("idx_business_profiles_created_at").on(table.createdAt),
      idxBusinessProfilesUserDeleted: index("idx_business_profiles_user_deleted").on(
        table.userId,
        table.deletedAt
      ),
      idxBusinessProfilesUserCreated: index("idx_business_profiles_user_created").on(
        table.userId,
        table.createdAt
      ),
    };
  }
);
