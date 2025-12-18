import { createId } from "@paralleldrive/cuid2";
import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

export const investorOpportunities = pgTable(
  "investor_opportunities",
  {
    id: varchar("id", { length: 24 })
      .$defaultFn(() => createId())
      .primaryKey(),

    // Core fields (all string inputs per requirements)
    name: varchar("name", { length: 200 }).notNull(),
    countryOfOrigin: varchar("country_of_origin", { length: 120 }),
    totalFundSize: varchar("total_fund_size", { length: 120 }),
    sectorFocusSsa: text("sector_focus_ssa"),
    countriesOfOperation: text("countries_of_operation"),
    operatingSince: varchar("operating_since", { length: 50 }),
    website: varchar("website", { length: 300 }),

    // Lifecycle
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => {
    return {
      uqInvestorOpportunitiesName: uniqueIndex("uq_investor_opportunities_name").on(table.name),
      idxInvestorOpportunitiesCountry: index("idx_investor_opportunities_country").on(
        table.countryOfOrigin
      ),
      idxInvestorOpportunitiesActive: index("idx_investor_opportunities_active").on(table.isActive),
      idxInvestorOpportunitiesDeletedAt: index("idx_investor_opportunities_deleted_at").on(
        table.deletedAt
      ),
      idxInvestorOpportunitiesCreatedAt: index("idx_investor_opportunities_created_at").on(
        table.createdAt
      ),
    };
  }
);
