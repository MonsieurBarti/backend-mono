# ADR 008 – Observability, Logging, and Correlation

## Status

Accepted

## Context

A REST request fans out through Nest CQRS buses, domain events, and later jobs. Without an application-level correlation id, those steps do not share a search key.

Logs today would otherwise be free-form English sentences. Filters and alerts need a stable `msg`. Secrets must not land in stdout.

This skeleton does not ship Datadog. It does not ship any vendor APM. Correlation and structured logs are the observability surface on init.

## Decision

We will propagate a UUIDv4 `correlationId` through `nestjs-cls`, emit one REST canonical log line per HTTP request, and log Nest CQRS bus traffic through custom publishers. Domain never logs.

### 1. Correlation id

Every unit of work carries a `correlationId`.

- Read header `X-Correlation-ID` when it is a valid UUIDv4.
- Otherwise generate a UUIDv4.
- Do not use UUIDv7 here. Domain aggregate ids use v7 ([docs/adr/002-hexagonal-architecture.md](docs/adr/002-hexagonal-architecture.md)). Correlation ids stay v4.

The server echoes `X-Correlation-ID` on the response. Clients SHOULD send the header. The server always has a fallback.

The id groups everything caused by one initiating action (one HTTP request, later one job, later one cron tick).

### 2. CLS — `nestjs-cls`

Request context lives in `nestjs-cls` (`AsyncLocalStorage`).

| Field           | Source                       | Purpose                |
| --------------- | ---------------------------- | ---------------------- |
| `correlationId` | Header or generated UUIDv4   | Universal correlation  |
| `ip`            | `req.ip` / `X-Forwarded-For` | Audit metadata         |
| `userAgent`     | `User-Agent`                 | Audit metadata         |
| `source`        | Entry point                  | Audit metadata, filter |
| `actorId`       | Auth guard when present      | Log enrichment         |
| `actorType`     | Auth guard when present      | Log enrichment         |

`source` values: `'api'` | `'webhook'` | `'cron'` | `'migration'` | `'job'` | `'event-handler'`.

On init the HTTP middleware fills the store. Cron and job entry points generate a fresh id when those adapters exist.

Domain event payloads do not carry `correlationId`. CLS propagation keeps it off the domain. Crossing a process or time boundary (a job payload) is the exception: the producer copies `correlationId` into job data and the processor opens a new CLS store.

### 3. Pino

A custom Pino root logger is the only logger. `mixin` reads the CLS store on every call and attaches `correlationId`, `actorId`, and `source` when present. Missing CLS yields `{}`. Callers do not pass `correlationId` by hand.

`msg` is a stable dotted event name, not a sentence. No interpolation in `msg`.

```
{domain}.{action}
{domain}.{entity}.{action}
```

Examples: `request.completed`, `command.executed`, `audit.persist.rejected`. Dynamic data lives in structured fields.

Redact secrets at the logger:

```
**.password
**.token
**.secret
**.authorization
**.creditCard
**.creditCardNumber
**.cvv
**.accessToken
**.refreshToken
**.apiKey
```

Censor value: `[REDACTED]`. Redaction is a safety net. Do not log passwords, tokens, secrets, card numbers, full emails, phone numbers, JWT payloads, or request bodies that contain user content. Use `actorId` instead of identity fields.

### 4. Domain logging ban

The domain layer never logs. Entities, value objects, domain events, and domain errors emit no log lines.

Logging belongs in:

- Presentation — canonical line interceptor, exception filters ([docs/adr/005-error-handling-rfc-9457.md](docs/adr/005-error-handling-rfc-9457.md)).
- Application — command, query, and event handlers.
- Infrastructure — adapters and repository edge cases.

This restates the hex rule in [docs/adr/002-hexagonal-architecture.md](docs/adr/002-hexagonal-architecture.md).

### 5. REST canonical log line

One structured line is emitted at the end of each HTTP request.

```json
{
  "level": "info",
  "msg": "request.completed",
  "correlationId": "...",
  "method": "GET",
  "path": "/health",
  "statusCode": 200,
  "duration_ms": 12,
  "status": "success",
  "source": "api"
}
```

Failed requests use `msg` `request.failed` and `status` `failure`. Client errors log at `warn`. Server errors log at `error`. Success logs at `info`.

Event handlers do not emit a canonical line. They share the request's `correlationId`.

This is a REST line. It is keyed by method, path, and status code. It is not a GraphQL operation line.

### 6. CQRS bus observation

`CqrsModule.forRoot()` installs custom `commandPublisher`, `queryPublisher`, and `eventPublisher`.

Each publisher logs, then forwards to the Nest CQRS bus. Nest 12 has no all-command listener. Publishers are that listener.

Suggested `msg` values: `command.executed`, `command.failed`, `query.executed`, `query.failed`, `event.published`. Fields include the command, query, or event class name. No payload dump of secrets or PII.

Wired on init. Idle until the first `execute` or `publish` is acceptable.

This observes Nest CQRS buses. It is not the audit write path. Audit persistence is [docs/adr/007-audit-event-log.md](docs/adr/007-audit-event-log.md).

In-process events use Nest CQRS `EventBus`. That is the bus [docs/adr/002-hexagonal-architecture.md](docs/adr/002-hexagonal-architecture.md) names. Do not introduce EventEmitter2 as the domain-event bus in order to reuse a CLS plugin.

### 7. Vendor APM

This skeleton does not ship Datadog. It does not ship `dd-trace`. It does not ship OpenTelemetry exporters. It does not ship any vendor APM agent.

Stdout Pino plus `correlationId` is the init observability contract. A later ticket may add an exporter. That ticket does not sneak an agent into this skeleton.

## Consequences

Positive: One header traces a request across logs, audit metadata, and bus observation. Dotted `msg` values are filterable. Domain stays free of I/O. The CQRS publishers work before any BC exists.

Negative: `nestjs-cls` is a runtime dependency. A lost store means a line without `correlationId`. The mixin runs on every log call (O(1), still extra work). Publishers log even when no handler cares yet.

Trade-off: No APM trace on init. Debugging a fast success starts from the canonical line and `correlationId`, not a vendor flame graph.

## Alternatives Considered

**Domain-layer logging.** Rejected: logging is a side-effect. Domain must stay framework-free and deterministic ([docs/adr/002-hexagonal-architecture.md](docs/adr/002-hexagonal-architecture.md)). Filters and handlers already see the same failures.

**GraphQL canonical line (`operation`, `operationType`).** Rejected: the API is REST. A GraphQL-shaped summary would name fields this server does not have. The canonical line uses HTTP method, path, and status code.

**Shipping Datadog (or any vendor APM) in this skeleton.** Rejected: the map does not include a live APM backend. An agent would add a vendor SDK, env, and CI surface before any product traffic exists. Correlation and Pino are enough for init.

**EventEmitter2 CLS bridging as the domain-event bus.** Rejected: in-process events travel on Nest CQRS `EventBus` ([docs/adr/002-hexagonal-architecture.md](docs/adr/002-hexagonal-architecture.md)). A second bus exists only to please a CLS plugin. `nestjs-cls` already covers the Nest request lifecycle. Publishers on `CqrsModule.forRoot()` observe that bus.

**Embed `correlationId` on every domain event.** Rejected: correlation is operational, not business. Domain events stay published-language primitives. CLS carries the id. Job payloads are the one explicit copy.

**Hand-rolled `AsyncLocalStorage` instead of `nestjs-cls`.** Rejected: Nest guard, interceptor, and middleware ordering is the whole problem. `nestjs-cls` already solves it.
