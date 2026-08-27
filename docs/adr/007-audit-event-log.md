# ADR 007 – Audit Event Log

## Status

Accepted

## Context

Support, legal, and compliance need an immutable record of who changed what and when. Domain events already carry that business meaning after a successful save ([docs/adr/002-hexagonal-architecture.md](docs/adr/002-hexagonal-architecture.md)).

The skeleton has no product bounded context. Audit still has to ship as working kernel code so the first BC can register handlers without inventing persistence.

Audit is a side-effect on domain events. It is not itself a bounded context.

## Decision

We will persist business audit in Postgres through a shared kernel module. The module is persist-only. It is ready on init.

### 1. Placement

Audit lives at `apps/api/src/shared/audit`. It is kernel infrastructure, not a BC. There is no `apps/api/src/contexts/audit`. There is no toy BC that exists only to own this table.

The module is agnostic of bounded contexts. The first BC registers its own handlers later. The kernel does not import a BC.

### 2. Capture point

Domain events are the single capture point. After a successful `save()`, the repository publishes on Nest CQRS `EventBus`. An application-layer handler marked for an auditable event type persists one row.

Command handlers do not call the audit port. They do not know they are audited.

Each event carries exactly the data relevant to that event. No entity snapshots. No field-level diffs. The payload is the audit information.

### 3. Port

The port exposes persist and find. It does not expose update. It does not expose delete.

```typescript
abstract class AuditLogRepository {
  abstract persist(entry: AuditEntryInput): Promise<void>;
  abstract findByAggregate(aggregateId: string, opts: QueryOpts): Promise<AuditEntry[]>;
  abstract findByActor(actorId: string, opts: QueryOpts): Promise<AuditEntry[]>;
}
```

`persist` inserts one row. Find methods exist for tests and for later internal readers. They are not an HTTP API.

If an entry is wrong, append a corrective event. Never mutate a persisted row through the application.

### 4. Ready on init

The skeleton ships all of the following:

- Persist-only port.
- Drizzle adapter.
- In-memory adapter.
- Handler base class that maps an auditable domain event to `persist()`, merging CLS metadata when a store is active ([docs/adr/008-observability-logging-and-correlation.md](docs/adr/008-observability-logging-and-correlation.md)).

Idle handlers until the first BC registers listeners are acceptable.

### 5. Persistence files

One kernel table `audit_logs`. It is not a product table. Health has no table.

Files follow [docs/adr/004-persistence-dto-and-mapper.md](docs/adr/004-persistence-dto-and-mapper.md):

```
apps/api/src/shared/audit/
  audit.port.ts
  audit-handler.base.ts
  infrastructure/
    audit-log.schema.ts
    audit-log.mapper.ts
    audit-log.drizzle-repository.ts
    audit-log.in-memory-repository.ts
```

`audit-log.schema.ts` owns `pgTable`, columns, and indexes. It exports the table. Row types are `$inferSelect` and `$inferInsert`. No Zod. No HTTP. No domain entity.

`audit-log.mapper.ts` exports `toDomain` and `toRow`. This is the only string ↔ uuid conversion.

The Drizzle repository implements the port with `insert` and `select` only.

There is no presentation DTO. There is no response mapper. There is no HTTP read API on init.

### 6. Row shape

Common columns plus a typed payload. No schemaless `payload: Record<string, unknown>` as the write contract. Each auditable event type validates its payload (Zod at persist) before insert.

| Field           | Rule                                                                                      |
| --------------- | ----------------------------------------------------------------------------------------- |
| `eventType`     | Discriminator. Stable name of the domain event.                                           |
| `aggregateType` | Aggregate class name.                                                                     |
| `aggregateId`   | Aggregate id.                                                                             |
| `actorId`       | Who did it. Comes from the domain event.                                                  |
| `actorType`     | `'user'` \| `'admin'` \| `'system'` \| `'cron'`. Comes from the domain event.             |
| `occurredAt`    | Domain time. Set on the event during handler execution.                                   |
| `recordedAt`    | Infrastructure time. Set at insert.                                                       |
| `version`       | Schema version. Default `1`.                                                              |
| `eventId`       | Unique id for deduplication.                                                              |
| `metadata`      | Technical enrichment from CLS when present: `correlationId`, `ip`, `userAgent`, `source`. |

`occurredAt` and `recordedAt` are both server clocks. Neither uses client time. Queries sort by `occurredAt`. `recordedAt` is diagnostic.

Actor identity lives on the domain event so tests and crons work without CLS. CLS may add HTTP metadata. CLS does not invent the actor. CLS does not invent tenant scope.

Non-HTTP origins omit `ip` and `userAgent`. Missing CLS is not a persist failure.

### 7. Delivery

Writes are fire-and-forget after the business `save()`. Same Postgres as the API. Best-effort. No outbox, no DLQ, and no automatic replay on init.

If the business write succeeds and the audit insert fails, that row is lost. Log the failure. Do not fail the command. Outbox remains the upgrade path if production drop rate is non-trivial.

### 8. Schema evolution

Add optional fields only. `version` is a passive marker. Old rows stay valid. Breaking changes require an explicit version bump that this ADR does not introduce.

## Consequences

Positive: The first BC can audit by writing a handler. Command handlers stay unaware. Immutability is the port contract. Tests use the in-memory adapter against the same port ([docs/adr/006-testing-hexagonal-modules.md](docs/adr/006-testing-hexagonal-modules.md)). Persistence files match the rest of the kernel.

Negative: Best-effort delivery can drop a row after a successful save. One shared table will mix event types from every future BC. Per-event Zod payloads add a file per auditable event.

Trade-off: No HTTP read on init means operators query Postgres or wait for a later presentation slice. That keeps the kernel free of a premature admin API.

## Alternatives Considered

**Audit as a bounded context under `apps/api/src/contexts/audit`.** Rejected: audit has no domain of its own. It records other BCs' events. A BC would invent a toy aggregate and a fake Hive surface. Kernel placement under `apps/api/src/shared/audit` matches the hex lock.

**HTTP read API and presentation DTOs on init.** Rejected: there is no consumer and no product BC. A REST list would freeze a DTO before the first real event type exists. The port's `find*` methods cover tests. Presentation waits for a real reader.

**`update` or `delete` on the repository.** Rejected: an audit log that can be edited is not evidence. Correct mistakes by appending. Exceptional erasure, if law later requires it, is an out-of-band runbook. It is not an application method.

**Outbox on init.** Rejected: volume starts at zero BCs. An outbox adds a second write path before any handler exists. The handler is replaceable when monitors show loss.
