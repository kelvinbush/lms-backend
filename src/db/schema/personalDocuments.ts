import { createId } from "@paralleldrive/cuid2";
import { boolean, index, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { loanApplications } from "./loanApplications";
import { users } from "./users";

export const personalDocuments = pgTable(
  "personal_documents",
  {
    id: varchar("id", { length: 24 })
      .$defaultFn(() => createId())
      .primaryKey(),
    userId: varchar("user_id", { length: 24 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    docType: varchar("doc_type", { length: 50 }),
    docUrl: text("doc_url"),
    // Verification fields
    isVerified: boolean("is_verified").default(false).notNull(),
    verifiedForLoanApplicationId: varchar("verified_for_loan_application_id", {
      length: 24,
    }).references(() => loanApplications.id, { onDelete: "set null" }),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => {
    return {
      idxPersonalDocsUser: index("idx_personal_docs_user").on(table.userId),
      idxPersonalDocsType: index("idx_personal_docs_type").on(table.docType),
      idxPersonalDocsDeletedAt: index("idx_personal_docs_deleted_at").on(table.deletedAt),
      idxPersonalDocsCreatedAt: index("idx_personal_docs_created_at").on(table.createdAt),
      idxPersonalDocsUserDeleted: index("idx_personal_docs_user_deleted").on(
        table.userId,
        table.deletedAt
      ),
      idxPersonalDocsUserCreated: index("idx_personal_docs_user_created").on(
        table.userId,
        table.createdAt
      ),

      // Additional performance indexes for common query patterns
      idxPersonalDocsUserType: index("idx_personal_docs_user_type").on(table.userId, table.docType),
      idxPersonalDocsUserTypeDeleted: index("idx_personal_docs_user_type_deleted").on(
        table.userId,
        table.docType,
        table.deletedAt
      ),

      // Verification indexes
      idxPersonalDocsVerified: index("idx_personal_docs_verified").on(
        table.isVerified,
        table.verifiedForLoanApplicationId
      ),
    };
  }
);
