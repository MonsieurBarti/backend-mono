import type { IDateProvider } from "../../ddd/index.js";
import {
  AuditLogRepository,
  type AuditEntry,
  type AuditEntryInput,
  type AuditQueryOpts,
} from "../audit.port.js";
import { toDomain, toRow } from "./audit-log.mapper.js";
import type { AuditLogRow } from "./audit-log.schema.js";

/**
 * `occurredAt` ascending, then `eventId` ascending — the order the port
 * promises and the Drizzle adapter asks Postgres for.
 *
 * `eventId` is compared with `<` rather than `localeCompare`: canonical
 * lowercase uuids sort identically byte-wise and lexically, while
 * `localeCompare` would follow the host locale's collation and drift from
 * Postgres' `uuid` ordering.
 */
function byOccurredAtThenEventId(left: AuditEntry, right: AuditEntry): number {
  const byOccurredAt = left.occurredAt.getTime() - right.occurredAt.getTime();
  if (byOccurredAt !== 0) {
    return byOccurredAt;
  }
  if (left.eventId === right.eventId) {
    return 0;
  }
  return left.eventId < right.eventId ? -1 : 1;
}

/**
 * In-process audit log. Kernel production code, not a test fixture: contract
 * suites, local drivers and any future non-Postgres deployment bind it through
 * the same port (docs/adr/007-audit-event-log.md §4).
 *
 * Writes go through `toRow` and come back through `toDomain`, so the schema
 * version default, the metadata compaction and the `actorType` check behave
 * exactly as they do against Postgres. Divergence here would make the shared
 * contract suite pass in memory and fail on the database.
 *
 * Nest-free, like the Drizzle adapter.
 */
export class AuditLogInMemoryRepository extends AuditLogRepository {
  private readonly entries = new Map<string, AuditEntry>();

  constructor(private readonly dates: IDateProvider) {
    super();
  }

  async persist(entry: AuditEntryInput): Promise<void> {
    if (this.entries.has(entry.eventId)) {
      // `event_id` is the primary key: Postgres rejects the second insert
      // rather than overwriting an immutable row, and so does this adapter.
      throw new Error(`audit_logs already holds event ${entry.eventId}`);
    }

    const row = toRow({ ...entry, recordedAt: this.dates.now() });
    const stored: AuditLogRow = { ...row, correlationId: row.correlationId ?? null };
    this.entries.set(stored.eventId, toDomain(stored));
  }

  async findByAggregate(aggregateId: string, opts: AuditQueryOpts): Promise<AuditEntry[]> {
    return this.page(
      [...this.entries.values()].filter((entry) => entry.aggregateId === aggregateId),
      opts,
    );
  }

  async findByActor(actorId: string, opts: AuditQueryOpts): Promise<AuditEntry[]> {
    return this.page(
      [...this.entries.values()].filter((entry) => entry.actorId === actorId),
      opts,
    );
  }

  /** Sorts in place: `matches` is always a freshly filtered array. */
  private page(matches: AuditEntry[], opts: AuditQueryOpts): AuditEntry[] {
    const offset = opts.offset ?? 0;
    return matches.sort(byOccurredAtThenEventId).slice(offset, offset + opts.limit);
  }
}
