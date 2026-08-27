import { asc, eq } from "drizzle-orm";

import type { IDateProvider } from "../../ddd/index.js";
import type { Database } from "../../infrastructure/drizzle/drizzle.client.js";
import {
  AuditLogRepository,
  type AuditEntry,
  type AuditEntryInput,
  type AuditQueryOpts,
} from "../audit.port.js";
import { toDomain, toRow } from "./audit-log.mapper.js";
import { auditLogs } from "./audit-log.schema.js";

/**
 * Postgres adapter for the audit log. `insert` and `select` only: the port has
 * no `update` and no `delete` (docs/adr/007-audit-event-log.md §3).
 *
 * It holds the pool and deliberately ignores `currentExecutor()`. Audit is
 * fire-and-forget *after* the business `save()`, so joining an open business
 * transaction would make a failed command roll the audit row back — and would
 * let a slow audit insert hold the business transaction open
 * (docs/adr/007-audit-event-log.md §7).
 *
 * Nest-free: `AuditModule` wires it through a factory.
 */
export class AuditLogDrizzleRepository extends AuditLogRepository {
  constructor(
    private readonly database: Database,
    private readonly dates: IDateProvider,
  ) {
    super();
  }

  async persist(entry: AuditEntryInput): Promise<void> {
    await this.database.insert(auditLogs).values(toRow({ ...entry, recordedAt: this.dates.now() }));
  }

  async findByAggregate(aggregateId: string, opts: AuditQueryOpts): Promise<AuditEntry[]> {
    const rows = await this.database
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.aggregateId, aggregateId))
      .orderBy(asc(auditLogs.occurredAt), asc(auditLogs.eventId))
      .limit(opts.limit)
      .offset(opts.offset ?? 0);

    return rows.map((row) => toDomain(row));
  }

  async findByActor(actorId: string, opts: AuditQueryOpts): Promise<AuditEntry[]> {
    const rows = await this.database
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.actorId, actorId))
      .orderBy(asc(auditLogs.occurredAt), asc(auditLogs.eventId))
      .limit(opts.limit)
      .offset(opts.offset ?? 0);

    return rows.map((row) => toDomain(row));
  }
}
