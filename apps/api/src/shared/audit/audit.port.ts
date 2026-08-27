import type { DomainEventPayload } from "../ddd/index.js";

/**
 * Who performed the audited action. Actor identity travels on the domain event
 * so crons and tests audit correctly without a request store; CLS may enrich a
 * row, it never invents the actor (docs/adr/007-audit-event-log.md §6).
 */
export type AuditActorType = "user" | "admin" | "system" | "cron";

/**
 * Technical enrichment copied from CLS when a store is active. Every member is
 * optional: non-HTTP origins carry no `ip` and no `userAgent`, and a missing
 * store is not a persist failure.
 *
 * `source` repeats the values of `RequestSource` from `shared/cls` rather than
 * importing them, so the port stays free of any infrastructure dependency.
 */
export type AuditMetadata = {
  readonly correlationId?: string;
  readonly ip?: string;
  readonly userAgent?: string;
  readonly source?: "api" | "webhook" | "cron" | "migration" | "job" | "event-handler";
};

/** Paging for the `find*` methods. `limit` is required so no caller scans the table. */
export type AuditQueryOpts = {
  readonly limit: number;
  readonly offset?: number;
};

/**
 * What a handler hands to `persist`. `recordedAt` is absent on purpose: it is
 * infrastructure time, stamped by the adapter from `IDateProvider`.
 *
 * `payload` is Published Language, not `Record<string, unknown>`: the handler
 * validates it against its own Zod schema before the insert.
 */
export type AuditEntryInput = {
  readonly eventId: string;
  readonly eventType: string;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly actorId: string;
  readonly actorType: AuditActorType;
  readonly occurredAt: Date;
  readonly payload: DomainEventPayload;
  readonly version?: number;
  readonly metadata?: AuditMetadata;
};

/**
 * One persisted audit row. `version` and `metadata` are always present here:
 * the mapper defaults the schema version and stores at least an empty object.
 */
export type AuditEntry = {
  readonly eventId: string;
  readonly eventType: string;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly actorId: string;
  readonly actorType: AuditActorType;
  readonly occurredAt: Date;
  readonly recordedAt: Date;
  readonly version: number;
  readonly payload: DomainEventPayload;
  readonly correlationId?: string;
  readonly metadata: AuditMetadata;
};

/**
 * Append-only business audit log. Persist-only by design: a log that can be
 * edited is not evidence, so there is no `update` and no `delete` — corrections
 * are appended as a further event (docs/adr/007-audit-event-log.md §3).
 *
 * `findByAggregate` and `findByActor` sort by `occurredAt` ascending, then
 * `eventId` ascending. They serve the shared contract suite and later internal
 * readers; they are not an HTTP API.
 *
 * Abstract class so it doubles as the Nest DI token.
 */
export abstract class AuditLogRepository {
  abstract persist(entry: AuditEntryInput): Promise<void>;
  abstract findByAggregate(aggregateId: string, opts: AuditQueryOpts): Promise<AuditEntry[]>;
  abstract findByActor(actorId: string, opts: AuditQueryOpts): Promise<AuditEntry[]>;
}
