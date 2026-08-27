import type { AuditActorType, AuditEntry, AuditEntryInput, AuditMetadata } from "../audit.port.js";
import type { AuditLogInsert, AuditLogRow } from "./audit-log.schema.js";

/**
 * Schema version stamped on every new row. `version` is a passive marker: old
 * rows stay valid and additive fields never bump it
 * (docs/adr/007-audit-event-log.md §8).
 */
const CURRENT_AUDIT_VERSION = 1;

const AUDIT_ACTOR_TYPES: readonly AuditActorType[] = ["user", "admin", "system", "cron"];

type MutableAuditMetadata = { -readonly [Key in keyof AuditMetadata]: AuditMetadata[Key] };

type MutableAuditEntry = { -readonly [Key in keyof AuditEntry]: AuditEntry[Key] };

/**
 * Narrows the widened `actor_type` column. A value outside the union means the
 * row was written by something other than this mapper, which makes the entry
 * unreadable rather than merely surprising, so it throws instead of guessing.
 */
function toActorType(value: string): AuditActorType {
  const actorType = AUDIT_ACTOR_TYPES.find((candidate) => candidate === value);
  if (actorType === undefined) {
    throw new Error(`audit_logs.actor_type holds an unsupported value: ${value}`);
  }
  return actorType;
}

/**
 * Rebuilds `AuditMetadata` keeping only the keys that carry a value, so a row
 * from a cron never stores `"ip": null` and an unenriched write stores `{}`.
 */
function compactMetadata(metadata: AuditMetadata | undefined): MutableAuditMetadata {
  const compacted: MutableAuditMetadata = {};
  if (metadata === undefined) {
    return compacted;
  }
  if (metadata.correlationId !== undefined) {
    compacted.correlationId = metadata.correlationId;
  }
  if (metadata.ip !== undefined) {
    compacted.ip = metadata.ip;
  }
  if (metadata.userAgent !== undefined) {
    compacted.userAgent = metadata.userAgent;
  }
  if (metadata.source !== undefined) {
    compacted.source = metadata.source;
  }
  return compacted;
}

/**
 * Row to domain. This file is the only place `event_id`, `aggregate_id` and
 * `correlation_id` cross the uuid boundary; `actor_id` stays text.
 *
 * The `correlation_id` column wins over the copy inside the `metadata`
 * document: the column is the indexed, typed one.
 */
export function toDomain(row: AuditLogRow): AuditEntry {
  const metadata = compactMetadata(row.metadata);
  const correlationId = row.correlationId ?? metadata.correlationId;
  if (correlationId !== undefined) {
    metadata.correlationId = correlationId;
  }

  const entry: MutableAuditEntry = {
    eventId: row.eventId,
    eventType: row.eventType,
    aggregateType: row.aggregateType,
    aggregateId: row.aggregateId,
    actorId: row.actorId,
    actorType: toActorType(row.actorType),
    occurredAt: row.occurredAt,
    recordedAt: row.recordedAt,
    version: row.version,
    payload: row.payload,
    metadata,
  };
  if (correlationId !== undefined) {
    entry.correlationId = correlationId;
  }
  return entry;
}

/**
 * Domain to row. `recordedAt` is supplied by the adapter from `IDateProvider`
 * so this function stays clock-free, and `version` falls back to the current
 * schema version when the caller does not pin one.
 */
export function toRow(entry: AuditEntryInput & { recordedAt: Date }): AuditLogInsert {
  const metadata = compactMetadata(entry.metadata);

  return {
    eventId: entry.eventId,
    eventType: entry.eventType,
    aggregateType: entry.aggregateType,
    aggregateId: entry.aggregateId,
    actorId: entry.actorId,
    actorType: toActorType(entry.actorType),
    occurredAt: entry.occurredAt,
    recordedAt: entry.recordedAt,
    version: entry.version ?? CURRENT_AUDIT_VERSION,
    correlationId: metadata.correlationId ?? null,
    payload: entry.payload,
    metadata,
  };
}
