import { createId } from "@paralleldrive/cuid2";
import { index, integer, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { businessProfiles } from "./businessProfiles";

/**
 * Table for storing business photos
 * Maximum 5 photos per business (enforced in service layer)
 */
export const businessPhotos = pgTable(
  "business_photos",
  {
    id: varchar("id", { length: 24 })
      .$defaultFn(() => createId())
      .primaryKey(),
    businessId: varchar("business_id", { length: 24 })
      .notNull()
      .references(() => businessProfiles.id, { onDelete: "cascade" }),
    photoUrl: text("photo_url").notNull(),
    displayOrder: integer("display_order").default(0).notNull(), // For ordering photos (0-based)
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => {
    return {
      // Indexes for common queries
      idxBusinessPhotosBusiness: index("idx_business_photos_business").on(table.businessId),
      idxBusinessPhotosBusinessDeleted: index("idx_business_photos_business_deleted").on(
        table.businessId,
        table.deletedAt
      ),
      idxBusinessPhotosOrder: index("idx_business_photos_order").on(
        table.businessId,
        table.displayOrder
      ),
      idxBusinessPhotosCreated: index("idx_business_photos_created").on(table.createdAt),
    };
  }
);
