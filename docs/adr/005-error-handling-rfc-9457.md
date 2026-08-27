# ADR 005 – Error Handling (RFC 9457)

## Status

Accepted

## Context

The API is REST. Clients need a single, documented error body they can parse without per-endpoint folklore.

Hexagonal modules keep a Domain layer with zero framework imports ([docs/adr/002-hexagonal-architecture.md](docs/adr/002-hexagonal-architecture.md)). Domain failures therefore cannot be Nest HTTP exceptions.

RFC 9457 defines HTTP Problem Details. That vocabulary maps domain failures onto HTTP without inventing a private envelope.

## Decision

We will return RFC 9457 Problem Details on every failed HTTP response. Domain errors stay framework-free. Presentation maps them to `application/problem+json`.

### 1. Transport

The error `Content-Type` is `application/problem+json`. The HTTP status equals the problem `status` field.

Every problem body carries these members:

| Member     | Rule                                                                              |
| ---------- | --------------------------------------------------------------------------------- |
| `type`     | Absolute URI identifying the problem class. Stable. Clients switch on this value. |
| `title`    | Short English summary of that class. Same `type` always yields the same `title`.  |
| `status`   | HTTP status code copied into the body.                                            |
| `detail`   | Occurrence-specific English text. Equals `error.message`.                         |
| `instance` | URI identifying this occurrence (support correlation). Unique per throw.          |

Example `type`: `https://problems.monsieurbarti.dev/validation-failed`.

The type catalog lives under `https://problems.monsieurbarti.dev/`. New classes add a new path segment. Do not reuse a URI for a different meaning.

`instance` uses the same host, for example `https://problems.monsieurbarti.dev/instances/IE-7712`.

### 2. `BaseDomainError<Context>`

The kernel ships an abstract base class under `apps/api/src/shared/ddd`. It extends `Error`. It imports neither Nest nor HTTP.

Required members:

- `type`: URI string.
- `title`: static summary for the class.
- `status`: indicative HTTP status. Default `500`. Concrete errors override.
- `context`: strongly typed payload. Server-only. Never serialized to the client.
- `detail`: getter derived from `context`. Never built at the throw site.
- `instance`: occurrence URI, minted in the constructor.
- `cause`: optional wrapped `Error`.

`error.message` returns `detail`. `detail === message` is an invariant.

Domain and application throw only `BaseDomainError` subclasses. They do not throw Nest HTTP exceptions (`HttpException`, `BadRequestException`, `NotFoundException`, and siblings). Controllers do not catch domain errors to rethrow Nest exceptions.

### 3. Filter chain

Presentation owns two global filters. Nest evaluates them in reverse registration order.

1. `BaseDomainErrorFilter` — matches `BaseDomainError`. Writes `application/problem+json`. Logs the error with full `context`. Pino enrichment from CLS supplies `correlationId` ([docs/adr/008-observability-logging-and-correlation.md](docs/adr/008-observability-logging-and-correlation.md)).
2. `GlobalExceptionCatcherFilter` — catch-all. Any non-domain failure becomes a generic `500` problem. `type` is `https://problems.monsieurbarti.dev/internal`. `detail` is generic. The original error stays in logs only.

Technical failures (connection timeout, network error, process crash) are not wrapped. They reach the catch-all.

Business-meaningful infrastructure outcomes (missing row, unique conflict, vendor denial the client can act on) are wrapped by the command handler into a `BaseDomainError` subclass. The repository returns `| null`. The handler decides whether absence is an error.

Criterion: can the client act differently given this information? Yes → `BaseDomainError`. No → catch-all `500`.

### 4. Zod at the HTTP boundary

A global `ZodValidationPipe` binds request schemas. Unmarked arguments pass through (health `GET` has no body schema). A bound schema that fails is fail-loud.

Zod issues map through the RFC 9457 filter. The pipe does not throw Nest `BadRequestException`.

Validation problem:

- `type`: `https://problems.monsieurbarti.dev/validation-failed`
- `title`: `Validation Failed`
- `status`: `422`
- `detail`: occurrence summary (for example `2 validation errors`)
- `violations`: RFC 9457 extension member. Array of `{ field, message }`. Present only for this `type`.

Domain entities that use Zod catch `ZodError` inside the entity and throw a `BaseDomainError` subclass. Zod never escapes the domain.

Do not use class-validator. Do not use `nestjs-zod`.

### 5. `detail` conventions

Language is English.

`detail` is specific to the occurrence. It may include identifiers from `context` when those identifiers are safe to show.

For authorization and existence checks on sensitive resources (payment instruments, PII-bearing aggregates), keep `detail` generic. Do not embed the target resource id. Do not distinguish "exists but forbidden" from "does not exist". Put ids in server-only `context`. The client uses `type` plus `instance`.

### 6. Vendor failures

Infrastructure adapters map vendor HTTP or SDK failures into either a `BaseDomainError` or an unwrapped technical error. Do not parse vendor SDK error-message strings. Do not ship a message-parser utility. Status codes and typed SDK error classes at the adapter boundary are the input. Free-text vendor `message` fields are not.

### 7. One error per request

First error wins. A thrown `BaseDomainError` stops the command handler. The HTTP response carries one problem body.

## Consequences

Positive: Domain stays testable without Nest. Clients get a documented media type and a URI `type` they can switch on. Support correlates a reported `instance` to one log line via CLS. Validation yields field-level `violations` without string scraping.

Negative: Every concrete error class carries `type`, `title`, `status`, `context`, and a `detail` getter. That is more boilerplate than throwing `BadRequestException`. The type catalog is an ops surface: each new URI needs a stable path.

Trade-off: `context` never leaves the server. Frontend debugging uses `detail` and `instance`, not internal ids.

## Alternatives Considered

**GraphQL `extensions` shape (`code`, `errorLabel`, `statusCode`).** Rejected: this API is REST. RFC 9457 already specifies HTTP Problem Details with a URI `type`. A GraphQL envelope would invent a second contract for a transport we do not ship.

**Throwing Nest HTTP exceptions from domain or application.** Rejected: Nest exceptions are a framework type. They cannot live in a framework-free Domain layer ([docs/adr/002-hexagonal-architecture.md](docs/adr/002-hexagonal-architecture.md)). Mapping belongs in presentation filters.

**class-validator plus Nest `ValidationPipe`.** Rejected: request schemas are Zod ([docs/adr/004-persistence-dto-and-mapper.md](docs/adr/004-persistence-dto-and-mapper.md)). Nest `BadRequestException` from a default `exceptionFactory` is not `application/problem+json`.

**Vendor SDK error-message parsers.** Rejected: vendor copy changes without notice. Parsing English (or localized) strings couples the kernel to a third-party phrasing. Adapters map typed failures or let technical errors hit the catch-all `500`.

**SCREAMING_SNAKE `type` without a URI.** Rejected: RFC 9457 defines `type` as a URI reference. A URI is dereferenceable documentation and a stable client key. A label is neither.
