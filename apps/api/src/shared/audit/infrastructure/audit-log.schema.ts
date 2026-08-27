import { index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import type { DomainEventPayload } from "../../ddd/index.js";
import type { AuditMetadata } from "../audit.port.js";

/**
 * The one kernel table. It is not a product table and it has no
 * `organizationId`: audit records other bounded contexts' events, it does not
 * own a tenant scope (docs/adr/007-audit-event-log.md §5).
 *
 * Only columns and indexes live here: no Zod, no HTTP, no mapper import and no
 * domain entity, so `drizzle-kit` can load this file on its own
 * (docs/adr/004-persistence-dto-and-mapper.md §2).
 *
 * `event_id` is the primary key with no database default: the id is minted on
 * the domain event, so a retry of the same event collides instead of inserting
 * a duplicate. `version` likewise has no default; the mapper stamps it.
 *
 * The two `jsonb` columns are typed rather than schemaless. The write contract
 * is the payload each handler validates before insert, so the row type states
 * what was stored instead of forcing a cast in the mapper.
 */
export const auditLogs = pgTable(
  "audit_logs",
  {
    eventId: uuid("event_id").primaryKey(),
    eventType: text("event_type").notNull(),
    aggregateType: text("aggregate_type").notNull(),
    aggregateId: uuid("aggregate_id").notNull(),
    /** Text, not uuid: `system` and `cron` actors have no uuid identity. */
    actorId: text("actor_id").notNull(),
    /** Widened to text on purpose; the mapper narrows it to `AuditActorType`. */
    actorType: text("actor_type").notNull(),
    /** Domain time, server clock. Queries sort on this column. */
    occurredAt: timestamp("occurred_at", { withTimezone: true, mode: "date" }).notNull(),
    /** Infrastructure time, server clock. Diagnostic only. */
    recordedAt: timestamp("recorded_at", { withTimezone: true, mode: "date" }).notNull(),
    version: integer("version").notNull(),
    /** Lifted out of `metadata` so correlation is indexable and typed. */
    correlationId: uuid("correlation_id"),
    payload: jsonb("payload").$type<DomainEventPayload>().notNull(),
    metadata: jsonb("metadata").$type<AuditMetadata>().notNull(),
  },
  (table) => [
    index("audit_logs_aggregate_id_occurred_at_idx").on(table.aggregateId, table.occurredAt),
    index("audit_logs_actor_id_occurred_at_idx").on(table.actorId, table.occurredAt),
  ],
);

export type AuditLogRow = typeof auditLogs.$inferSelect;
export type AuditLogInsert = typeof auditLogs.$inferInsert;
