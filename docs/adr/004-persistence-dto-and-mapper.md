# ADR 004 – Persistence, DTO, and mapper

## Status

Accepted

## Context

Hexagonal layers in `docs/adr/002-hexagonal-architecture.md` split write persistence from HTTP. Drizzle table types, domain entities, and REST payloads are different shapes. Mixing them in one file couples the database to transport and forces repositories to speak HTTP.

Init has no product BC. Health has no table. Kernel audit is persist-only. This ADR is the file law those later aggregates follow.

## Decision

We will keep one concern per file. Schema never imports transport. Mappers are plain exported functions. oxlint walls enforce the split.

Persistence lives in infrastructure. REST lives in presentation. They are not siblings.

Hive published-language DTOs stay in `{bc}/ports/`. They are out of this ADR. See `docs/adr/003-bc-hive-communication.md`.

### 1. Future aggregate layout

Flatten layers at the BC root when the BC has one aggregate. Keep these names:

```
{bc}/{aggregate}/infrastructure/persistence/
  {name}.schema.ts
  {name}.mapper.ts
  {name}.drizzle-repository.ts

{bc}/{aggregate}/presentation/{feature}/
  dto/{action}.request.ts
  dto/{resource}.response.ts
  mappers/{resource}.response-mapper.ts
```

Do not place a persistence DTO file beside the table. Do not return HTTP DTOs from repositories. Do not treat `-raw.mapper` as day-1 law. Do not add `static toOutputDto` on schema or entity.

### 2. Drizzle schema

`{name}.schema.ts` owns `pgTable`, columns, and indexes. It exports the table. Row types are `$inferSelect` and `$inferInsert`.

The schema file has no extra `{name}.dto.ts`. It has no Zod. It has no HTTP. It has no domain entity.

### 3. Persistence mapper

`{name}.mapper.ts` exports `toDomain` and `toRow`. This is the only string ↔ uuid conversion. Repositories call it. Repositories return domain types, never REST DTOs.

The write repository implements the domain port from `docs/adr/002-hexagonal-architecture.md`. It does not import `*.request.ts` or `*.response.ts`.

### 4. REST DTOs

`{action}.request.ts` is HTTP in. `{resource}.response.ts` is HTTP out. Both are Zod. Never reuse the request shape as the response.

A global Zod pipe binds request schemas. There is no class-validator. There is no `Object.assign` onto class DTOs.

REST DTOs never leave presentation. Application and infrastructure never import `*.request.ts` or `*.response.ts`. Query handlers return read models, not HTTP types. Controllers dispatch CQRS, then call the response mapper.

### 5. Presentation mapper

`{resource}.response-mapper.ts` exports plain functions. It maps a read model or entity view to the response Zod type. Controllers do not map field-by-field.

### 6. Kernel audit

`apps/api/src/shared/audit/` takes the persistence half only:

- `audit-log.schema.ts`
- `audit-log.mapper.ts`
- drizzle repository (persist-only adapter)

No presentation DTO. No response mapper. No HTTP read on init. See `docs/adr/007-audit-event-log.md`.

### 7. Health

Health has no table and no persistence trio. It stays at `apps/api/src/presentation/health/` per `docs/adr/002-hexagonal-architecture.md`.

### 8. Lint

oxlint:

- `**/*.schema.ts` cannot import Zod DTOs, HTTP, presentation, or the sibling mapper.
- Presentation `*.request.ts` / `*.response.ts` cannot import `drizzle-orm` or `postgres`.

### 9. Init

No product BC. This ADR is law. Audit kernel files follow the persistence half when that kernel ships. Controllers, request files, and response files appear with the first HTTP feature of a BC.

## Consequences

Positive: Drizzle row types stay out of HTTP. Domain entities stay out of controllers. Schema files load in the migrator without pulling Zod or Nest. Repositories stay honest: they persist aggregates, they do not shape REST.

Negative: One aggregate write path needs schema, persistence mapper, drizzle repository, command, controller, request DTO, response DTO, and response mapper. That is more files than a single sibling trio.

Trade-off: Flattening a single-aggregate BC at the root reduces nesting, but the persistence and presentation folders remain distinct. Reviewers reject any attempt to reunite them as siblings.

## Alternatives Considered

**Sibling-file layout (schema, transport DTO, and mapper in one folder).** Rejected: infrastructure would import HTTP types and presentation would import Drizzle. The hex layers in `docs/adr/002-hexagonal-architecture.md` forbid that. Persistence and REST are not siblings.

**A persistence DTO file beside the table.** Rejected: Drizzle already infers row types from `pgTable`. A hand-written `{name}.dto.ts` duplicates columns and invites Zod or HTTP imports into schema space.

**Repositories that return HTTP DTOs.** Rejected: the write path must return domain types. The read path returns application read models. HTTP mapping is a presentation concern.

**class-validator on request and response classes.** Rejected: REST DTOs are Zod. A global Zod pipe binds requests. A second decorator stack would split validation.

**`Object.assign` onto class DTOs.** Rejected: it copies undeclared fields, hides mapping, and fights class initializers. Mappers assign known fields through plain functions.

**`-raw.mapper` as day-1 law.** Rejected: there is no product mapping that needs a raw/ORM split yet. `{name}.mapper.ts` with `toDomain` / `toRow` is enough. A later BC may add a raw helper when a real mapping forces it.

**`static toOutputDto` on the schema or entity.** Rejected: that puts transport shape on persistence or domain. Response mapping lives in `{resource}.response-mapper.ts`.
