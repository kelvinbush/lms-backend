import { pgTable, varchar, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";
import { businessProfiles } from "./businessProfiles";

/**
 * Junction table for many-to-many relationship between businesses and countries of operation
 * A business can operate in multiple countries
 */
export const businessCountries = pgTable(
  "business_countries",
  {
    id: varchar("id", { length: 24 }).$defaultFn(() => createId()).primaryKey(),
    businessId: varchar("business_id", { length: 24 })
      .notNull()
      .references(() => businessProfiles.id, { onDelete: "cascade" }),
    country: varchar("country", { length: 100 }).notNull(), // Country name or ISO code
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => {
    return {
      // Ensure a business can only have a country listed once
      uqBusinessCountry: uniqueIndex("uq_business_countries").on(
        table.businessId,
        table.country
      ),
      // Indexes for common queries
      idxBusinessCountriesBusiness: index("idx_business_countries_business").on(
        table.businessId
      ),
      idxBusinessCountriesCountry: index("idx_business_countries_country").on(table.country),
      idxBusinessCountriesCreated: index("idx_business_countries_created").on(
        table.createdAt
      ),
    };
  },
);

