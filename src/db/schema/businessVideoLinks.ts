import { pgTable, text, timestamp, integer, varchar, index } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";
import { businessProfiles } from "./businessProfiles";

/**
 * Table for storing business video links
 * Supports multiple video links from different sources (YouTube, Vimeo, direct links, etc.)
 */
export const businessVideoLinks = pgTable(
  "business_video_links",
  {
    id: varchar("id", { length: 24 }).$defaultFn(() => createId()).primaryKey(),
    businessId: varchar("business_id", { length: 24 })
      .notNull()
      .references(() => businessProfiles.id, { onDelete: "cascade" }),
    videoUrl: text("video_url").notNull(),
    source: varchar("source", { length: 50 }), // e.g., "youtube", "vimeo", "direct", etc.
    displayOrder: integer("display_order").default(0).notNull(), // For ordering videos (0-based)
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => {
    return {
      // Indexes for common queries
      idxBusinessVideoLinksBusiness: index("idx_business_video_links_business").on(
        table.businessId
      ),
      idxBusinessVideoLinksBusinessDeleted: index("idx_business_video_links_business_deleted").on(
        table.businessId,
        table.deletedAt
      ),
      idxBusinessVideoLinksOrder: index("idx_business_video_links_order").on(
        table.businessId,
        table.displayOrder
      ),
      idxBusinessVideoLinksCreated: index("idx_business_video_links_created").on(
        table.createdAt
      ),
    };
  },
);

