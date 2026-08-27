import { pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

/**
 * Kernel identity tables. Not a product bounded context
 * (MON-48). Ids are domain-minted UUID v7 strings mapped to `uuid` columns
 * with no database default (docs/adr/002-hexagonal-architecture.md).
 *
 * Only columns and indexes live here: no Zod, no HTTP, no mapper import.
 */
export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
});

export const personalAccessTokens = pgTable(
  "personal_access_tokens",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    tokenHash: text("token_hash").notNull(),
    prefix: text("prefix").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [uniqueIndex("personal_access_tokens_token_hash_uidx").on(table.tokenHash)],
);

export type UserRow = typeof users.$inferSelect;
export type UserInsert = typeof users.$inferInsert;
export type PersonalAccessTokenRow = typeof personalAccessTokens.$inferSelect;
export type PersonalAccessTokenInsert = typeof personalAccessTokens.$inferInsert;
