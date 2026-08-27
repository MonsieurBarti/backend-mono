# ADR 002 – Hexagonal Architecture

## Status

Accepted

## Context

This repository is a greenfield Nest API with Drizzle, Postgres, REST, and CQRS. It ships with zero product bounded contexts. Later BCs need one in-hexagon law before the first aggregate lands. Without that law, teams invent layers, ID strategies, and dispatch styles per feature.

Health is an HTTP probe, not a domain. Treating it as a BC would fake a hexagon and teach the wrong folder layout.

## Decision

We will use four layers as day-1 law. Presentation depends on Application. Application depends on Domain. Infrastructure depends on Domain only. Domain depends on nothing: no Nest, no Drizzle, no HTTP.

Hex is law before any product BC exists. Kernel types live in `apps/api/src/shared/ddd`. Persistence file names live in `docs/adr/004-persistence-dto-and-mapper.md`. Hive edges live in `docs/adr/003-bc-hive-communication.md`. Tests live in `docs/adr/006-testing-hexagonal-modules.md`.

### 1. Four layers

| Layer              | Responsibility                                                                 | Depends on                |
| ------------------ | ------------------------------------------------------------------------------ | ------------------------- |
| **Presentation**   | Driving adapters: HTTP controllers, later job processors, Hive concrete client | Application               |
| **Application**    | CQRS command, query, and event handlers                                        | Domain                    |
| **Domain**         | Entities, value objects, events, errors, ports                                 | Nothing                   |
| **Infrastructure** | Port implementations: Drizzle, outbound adapters                               | Domain (implements ports) |

The domain is pure TypeScript. It has zero framework imports and zero I/O.

### 2. Folders and HTTP

Bounded contexts live under `apps/api/src/contexts/<bc>/`.

- BC HTTP controllers live at `{bc}/{aggregate}/presentation/{feature}/controllers/` and use the `*.controller.ts` suffix.
- The Hive concrete client lives at `{bc}/presentation/clients/`.
- A single-aggregate BC flattens layers at the BC root and keeps the same folder names.
- Health lives at `apps/api/src/presentation/health/`. It is an app driving adapter. It is not under `contexts/`. It is not under `shared/`. It is not a BC.

```
apps/api/src/
├── presentation/
│   └── health/                          ← app driving adapter, not a BC
├── shared/
│   ├── ddd/                             ← kernel types (this ADR)
│   └── audit/                           ← persist-only kernel (docs/adr/007-audit-event-log.md)
└── contexts/
    └── {bc}/
        ├── {bc}.module.ts
        ├── ports/                       ← Hive provider surface when a BC exists (docs/adr/003-bc-hive-communication.md)
        ├── presentation/
        │   └── clients/
        └── {aggregate}/                 ← omit this extra segment when the BC has one aggregate
            ├── {aggregate}.module.ts
            ├── domain/
            ├── application/
            │   ├── commands/
            │   ├── queries/
            │   └── event-handlers/
            ├── infrastructure/          ← Drizzle and outbound adapters; file names in ADR 004
            └── presentation/
                └── {feature}/
                    ├── controllers/
                    ├── dto/             ← REST DTO files in ADR 004
                    ├── mappers/
                    └── processors/
```

One Nest module per aggregate. One root module per BC. `AppModule` imports BC root modules and the health adapter.

### 3. Domain entities

Every write goes through a domain entity. There is no exception.

The command handler loads or creates the entity, calls a behavioral method, and persists through the repository port.

`createNew()` and `reconstruct()` are the only factories. The constructor is private. One `{name}.entity.ts` file holds the entity.

- Properties are `private` and prefixed with `_`. Immutable fields are `private readonly`.
- Public getters drop the underscore.
- `static createNew(props)` validates, mints the aggregate id, emits domain events, and returns the entity.
- `static reconstruct(state)` hydrates from persistence. It does not validate. It does not emit events.
- Behavioral methods enforce invariants and emit events.
- Methods that need time take `IDateProvider`. Domain code never calls `new Date()`.

Entities emit domain events. Side effects run in the application layer. Multi-entity orchestration lives in command handlers, not domain services.

Value objects exist when the field has behavior. Constraint-only fields stay as Zod inside the entity.

### 4. Ports and Nest DI

Ports are abstract classes. They are the Nest DI tokens. There is no `tokens.ts` file. Handlers inject the abstract class. Modules bind `{ provide: Port, useClass: Adapter }`.

`RepositoryPort<Entity>` in `apps/api/src/shared/ddd` exposes `save()`, `findById()`, `findAll()`, and `delete()`. Each aggregate extends it with specific write-side methods.

### 5. Drizzle lives in infrastructure only

The ORM, table schema, and repositories live only in infrastructure. That is either a BC infrastructure folder or the kernel audit folder. Domain and application never import `drizzle-orm` or `postgres`.

Query handlers use the database client through infrastructure. They do not declare a second read-repository port. They return a read model defined beside the query. They never return REST DTOs.

Kernel `audit_logs` live under `apps/api/src/shared/audit`. The migrator is app-local under `apps/api`.

### 6. Domain-minted UUID v7

The domain mints the aggregate id in `createNew()`. It calls a kernel helper in `apps/api/src/shared/ddd` that wraps `crypto.randomUUIDv7()` (Node 24). The domain type is `string`. The domain does not import `node:crypto`.

Persistence stores that id. Aggregate primary keys have no database default. The Postgres column type is `uuid`. The persistence mapper is the only string ↔ uuid conversion.

Correlation ids stay UUIDv4. They are not aggregate ids. See `docs/adr/008-observability-logging-and-correlation.md`.

### 7. Nest CQRS buses

Presentation calls `CommandBus` and `QueryBus`. It never injects a handler.

One file holds the command or query class and its handler. There is no extra application service around the bus.

Controllers, job processors, and the Hive concrete client all dispatch the same commands and queries. Guarantees stay identical.

### 8. In-process events

Use `@nestjs/cqrs` `EventBus`. The repository publishes after a successful `save()`. Handlers live in the reacting BC application layer. Payloads are Published Language primitives: strings, numbers, ISO date strings, plain records and arrays of the same.

Add an outbox only when a reaction must survive a crash. Do not use EventEmitter2.

Domain events do not carry `correlationId`. CLS carries it. See `docs/adr/008-observability-logging-and-correlation.md`.

Event names use `{Aggregate}{Verb}Event`.

### 9. Transactions

`TransactionManager` is a port in `apps/api/src/shared/ddd`. It wraps Drizzle `db.transaction`. Domain and application never see the Drizzle client.

Multi-aggregate transactions are not a goal. Prefer events.

### 10. Dates, logging, errors, auth

`IDateProvider` is an abstract class with `now()`. `RealDateProvider` is production. `FakeDateProvider` is for tests (`set`, `advance`). Domain and command handlers inject it.

The domain never logs. Logging belongs in application, infrastructure, and presentation. See `docs/adr/008-observability-logging-and-correlation.md`.

Domain errors are typed classes. Mapping to HTTP problem documents lives in `docs/adr/005-error-handling-rfc-9457.md`. Repositories return `| null`. Command handlers decide whether absence is an error.

Guards authenticate in presentation. Fine-grained authorization lives on the entity. The command handler passes actor context. The entity throws a domain error when the actor cannot act.

Hex domain and application never import an external SDK. Domain declares a port. Only infrastructure adapters depend on vendor clients. See `docs/adr/011-external-api-sdk-architecture.md`.

### 11. Kernel types on init

`apps/api/src/shared/ddd` ships on init. It is not a BC. It has no product entities.

It ships `AggregateRoot`, `DomainEvent`, `RepositoryPort`, `IDateProvider` (Real + Fake), `TransactionManager`, and the UUID v7 helper.

### 12. Naming suffixes

| Role                 | Suffix                           |
| -------------------- | -------------------------------- |
| Aggregate root       | `{name}.entity.ts`               |
| Value object         | `{name}.value-object.ts`         |
| Domain event         | `{name}.event.ts`                |
| Domain error         | `{name}.error.ts`                |
| Repository port      | `{name}.repository.ts`           |
| Command              | `{name}.command.ts`              |
| Query                | `{name}.query.ts`                |
| Event handler        | `{name}.event-handler.ts`        |
| HTTP controller      | `{name}.controller.ts`           |
| Job processor        | `{name}.processor.ts`            |
| Outbound adapter     | `{name}.adapter.ts`              |
| In-memory repository | `{name}.in-memory-repository.ts` |

Command classes are `CreateXCommand`. Query classes are `GetXQuery`. Handler classes are `CreateXHandler` and `GetXHandler`. Persistence and REST DTO suffixes live in `docs/adr/004-persistence-dto-and-mapper.md`.

### 13. Lint walls

oxlint only. No ESLint.

- `**/domain/**` cannot import Nest, Drizzle, or HTTP.
- One `contexts/<bc>` cannot import another except `ports/`.

Rules sit idle on an empty `contexts/` folder. Revisit extra tooling after two BCs if the globs are too weak. That revisit is outside this ADR.

## Consequences

Positive: Domain logic stays framework-free and unit-testable. A later extract swaps adapters, not entities. Folders and suffixes make a later BC obvious. Drizzle cannot leak into domain or application. UUID v7 ids are minted where invariants live.

Negative: A small write needs more files than a handler-plus-table sketch. Query handlers talk to the database through infrastructure without a read port, so reviewers must watch drizzle imports by lint, not by type. Outbox is opt-in, so a crash can drop an in-process reaction until a BC pays for durability.

Trade-off: Four layers and Nest CQRS buses add dispatch hops. Those hops are the seam for logging, transactions, and Hive clients. Health stays outside `contexts/` so a probe cannot masquerade as a BC.

## Alternatives Considered

**Health as a toy bounded context.** Rejected: health has no entity, no table, and no Hive port. Putting it under `contexts/` would teach a fake hexagon. It stays an app driving adapter at `apps/api/src/presentation/health/`.

**Database-default or generated aggregate ids.** Rejected: the entity must hold its id before `save()`. A Postgres default would mint a second identity and force the domain to learn the id after persist. Domain-minted UUID v7 is the single id.

**Domain imports `node:crypto` directly.** Rejected: `crypto.randomUUIDv7()` is a platform API. The kernel helper keeps domain free of Node modules while still minting UUID v7.

**Interfaces for ports.** Rejected: TypeScript erases interfaces at runtime. Nest would need a parallel token file and `@Inject()` on every constructor. Abstract classes are the contract and the token.

**A read-repository port beside the write port.** Rejected: read tests need a real database anyway. A second port duplicates the table without protecting the domain. Query handlers use the infrastructure database client and return read models.

**Direct handler injection from controllers.** Rejected: it couples presentation to handler classes and blocks bus middleware. Presentation calls `CommandBus` / `QueryBus` only.

**EventEmitter2 as the in-process bus.** Rejected: `@nestjs/cqrs` `EventBus` is the same stack as command and query dispatch. A second emitter would split handler discovery.

**Multi-aggregate Drizzle transactions as a target.** Rejected: they hide bad aggregate boundaries. `TransactionManager` wraps a single unit of work. Cross-aggregate work uses events.
