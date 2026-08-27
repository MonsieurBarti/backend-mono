# ADR 003 – BC Hive Communication

## Status

Accepted

## Context

This API will host more than one bounded context under `apps/api/src/contexts/`. Init has zero product BCs. The folder still needs a keep-file so later BCs land in one place.

Without a communication law, the first consumer will import a sibling application layer, inject a foreign client in a command handler, or invent a shared data service. Extraction then rewrites application code.

This ADR is the cross-BC contract. In-hexagon layering stays in `docs/adr/002-hexagonal-architecture.md`.

## Decision

We will ship the Hive law only. `apps/api/src/contexts/` stays a keep-file. Init adds no stub Hive clients. Init adds no `I*Client`. Init adds no consumer SPI. Init adds no InProc adapter files.

### 1. Keep-file, no stubs

`apps/api/src/contexts/` exists so BC roots have a home. It contains no hexagon until a product BC lands. Empty client files are not a skeleton. They rot and they fake a provider API.

### 2. When the first BC exists

That BC exposes one Open Host façade:

- Port: `abstract class I{Name}Client` in `{bc}/ports/`.
- Published Language DTOs and Zod schemas sit beside that port.
- Implementation: a concrete `{Name}Client` in `{bc}/presentation/clients/`.

The concrete client is a driving adapter. It validates edge input and dispatches `CommandBus` / `QueryBus`. It is not infrastructure. It is not an application service.

A multi-aggregate BC still exports one `I{Name}Client`. It does not export one client per aggregate.

The Nest module’s cross-BC public surface is that client token only: `{ provide: I{Name}Client, useClass: {Name}Client }`. Internal providers stay unexported.

Publishable contract surface is `{bc}/ports/` only. A consumer must not import `{bc}/presentation/**`, `{bc}/application/**`, `{bc}/infrastructure/**`, or `{bc}/domain/**`.

`{bc}/ports/` implements with Zod and kernel primitives. It does not import Nest, Drizzle, CQRS, or I/O.

### 3. Hive-strict consumer

When a later BC needs the first:

- The consumer owns an SPI in its own `domain/ports/`.
- Only consumer infrastructure implements that SPI.
- That adapter calls the provider `I{Name}Client`.
- Consumer application and domain never import a foreign `I*Client`.

Hive-lite is rejected: application must not inject a foreign `I*Client`.

### 4. Extract path

In this deployable, the InProc adapter is a method call on the provider client. On extract, swap that adapter for a network adapter. Provider application and domain do not move. Consumer application and domain do not move. Publish one contract per BC, never a monorepo-wide bag of every BC’s DTOs.

### 5. Published Language

Boundary DTOs and cross-BC event payloads use primitives only: string ids, ISO date strings, integers, currency codes, plain records and arrays of the same.

Value-object instances, domain-error subclasses, Nest entities, and shared mutable state do not cross BC packages. Each side reconstructs its own value objects inside its hexagon.

Zod schemas cover every exported client method and every cross-BC event payload. They live beside the port or event.

Hive error identity is the primitive envelope `{ type, status, context }`. Consumers match the discriminator. Class identity is not Published Language. HTTP problem mapping lives in `docs/adr/005-error-handling-rfc-9457.md`.

### 6. Communication style and events

Request/response through the provider API when the caller needs an answer in the same request. Domain events only for fire-and-forget reactions.

A synchronous chain across three or more BCs in one request is a design smell. Fatten the API or cache a local read model.

In-process events follow `docs/adr/002-hexagonal-architecture.md`: `@nestjs/cqrs` `EventBus`, Published Language payloads, handlers in the reacting BC application layer. Outbox only when a reaction must survive a crash.

`correlationId` stays transport and CLS. It is not a domain payload field. See `docs/adr/008-observability-logging-and-correlation.md`.

### 7. Forbidden façades

No `legacy:*-bridge`. This repository has no legacy modules to wrap.

No `IDataServices`. A BC does not reach into another BC’s tables. Foreign reads and writes go through the provider API or a consumer SPI plus adapter.

Each BC’s infrastructure owns that BC’s collections.

## Consequences

Positive: The first BC can add `I{Name}Client` without ripping out stubs. A later consumer extracts by swapping an adapter. Reviewers reject Hive-lite and shared data services as law, not taste. `apps/api/src/contexts/` already names the home for BCs.

Negative: The first cross-BC feature pays for a consumer SPI, an InProc adapter, PL DTOs, and Zod. Init looks empty: the keep-file is the only Hive artifact until a BC exists.

Trade-off: Hive-strict adds files per edge. Those files are the extract seam. Skipping them now would force an application rewrite later.

## Alternatives Considered

**Stub `I*Client`, SPI, and InProc adapter files on init.** Rejected: there is no provider and no consumer. Empty façades become copy-paste templates that drift from this law. The keep-file is enough.

**Hive-lite (application injects a foreign `I*Client`).** Rejected: consumer application then depends on the provider Nest export. Extraction rewrites handlers instead of one infrastructure adapter.

**`IDataServices` as a cross-BC data bus.** Rejected: it lets one BC import another BC’s persistence. Hive exists to stop that. Foreign data moves through Published Language.

**`legacy:*-bridge` tags as a standing hatch.** Rejected: this codebase has no legacy layer. A bridge tag would invent debt to house illegal imports.

**A shared package of every BC’s DTOs.** Rejected: it becomes a distributed monolith and invites value-object leakage. In-process, `{bc}/ports/` is the channel. On extract, publish one contract per BC.

**Putting Hive rules inside `docs/adr/002-hexagonal-architecture.md`.** Rejected: 002 is in-hexagon law. Communication, extract, and provider/consumer ownership are a separate decision with their own rejected options.
