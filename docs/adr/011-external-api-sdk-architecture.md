# ADR 011 – External API SDK Architecture

## Status

Accepted

## Context

This monorepo will integrate with third-party REST APIs. Historically, those integrations are built as Nest services that call HTTP directly. Transport, auth, error mapping, and business logic then sit in one class. Tests mock the HTTP adapter. The client cannot be reused from a script or worker.

A standalone typed HTTP client, a testing subpath, and a thin Nest wiring layer separate those concerns. That pattern is not yet documented here, and `packages/*` has zero members on init. The first SDK must not be invented from scratch.

This ADR is law only. Do not ship an SDK package in the ticket that writes this file. `packages/` stays empty on init. The first `@monsieurbarti/<vendor>-sdk` lands in a later ticket that needs a real vendor.

## Decision

We will package every external API integration as a standalone SDK under `packages/<vendor>-sdk`. The SDK is framework-agnostic. Nest wiring is a thin layer in the consuming application.

### 1. Scope — three layers

An external API integration comprises three layers:

| Layer                | Location                                                | Responsibility                                |
| -------------------- | ------------------------------------------------------- | --------------------------------------------- |
| **SDK package**      | `packages/<vendor>-sdk`                                 | Typed HTTP client, resources, schemas, errors |
| **Testing subpath**  | `@monsieurbarti/<vendor>-sdk/testing`                   | InMemoryClient, builders, simulateError       |
| **Nest integration** | `apps/api/src/shared/integration/api-clients/<vendor>/` | Module, DI token, config                      |

The SDK must not import `@nestjs/*`, Express, or any other application framework.

### 2. Package naming

- Single-API vendor: `@monsieurbarti/<vendor>-sdk` (for example `@monsieurbarti/stripe-sdk`).
- Multi-API vendor: `@monsieurbarti/<vendor>-<domain>-sdk` (for example `@monsieurbarti/google-maps-sdk`).
- Suffix `-sdk` is mandatory.

On init, `packages/*` stays empty. Do not create a placeholder SDK.

### 3. Imposed file structure

```
packages/<vendor>-sdk/
├── src/
│   ├── index.ts                        # Public exports (client, types, errors)
│   ├── testing.ts                      # Re-exports for ./testing subpath
│   ├── webhooks.ts                     # Re-exports for ./webhooks subpath (optional)
│   ├── client.ts                       # <Vendor>Client concrete implementation
│   ├── types.ts                        # Logger, RateLimiter, ClientOptions interfaces
│   ├── errors/
│   │   └── index.ts                    # error classes (base + specialized)
│   ├── resources/
│   │   ├── base.ts                     # BaseResource abstract class
│   │   └── <resource>.ts               # One file per resource
│   ├── schemas/
│   │   └── <resource>.schema.ts        # One file per resource (Zod schemas + types)
│   ├── testing/
│   │   ├── in-memory-client.ts         # InMemory<Vendor>Client
│   │   └── builders/
│   │       └── <entity>.builder.ts     # One factory per entity
│   └── webhooks/                       # (optional)
│       ├── verify.ts                   # Signature verification
│       ├── parser.ts                   # Payload parsing + typed events
│       └── types.ts                    # Webhook event types
├── tests/
│   ├── helpers/                        # Fake HTTP server (internal, not exported)
│   └── <resource>.spec.ts
├── package.json
├── tsup.config.ts
├── vitest.config.ts
├── tsconfig.json
├── tsconfig.build.json
├── oxlint.config.ts
└── README.md
```

### 4. HTTP client — Axios

All SDKs use Axios. Do not put HTTP in Nest services. Do not use `@nestjs/axios` as the SDK. The interceptor pattern (rate-limit, retry, auth refresh) is standardized inside the package.

### 5. Validation — Zod

- **Input**: `schema.parse(input)` — strict, rejects unknown fields.
- **Output**: `schema.passthrough()` — validates expected fields, preserves unknown fields from API evolution.

Schemas are internal. Export TypeScript types, not schemas.

### 6. Error hierarchy

Each SDK defines six error classes (one base + five specialized). Independent copies. No shared error-base package.

```
<Vendor>Error (base, extends Error)
├── <Vendor>ApiError        (status: number, body: unknown)
├── <Vendor>AuthError       (authentication failure)
├── <Vendor>RateLimitError  (429 exhausted after retries)
├── <Vendor>TimeoutError    (request timed out; timeoutMs: number)
└── <Vendor>ValidationError (Zod input validation failure)
```

When the SDK exports `./webhooks`, it MAY add one extra specialized class for signature or payload verification failures (`<Vendor>SignatureVerificationError`). Do not invent other specialized classes beyond this optional webhook error.

### 7. Resource pattern — namespaced

Resources are accessed via namespaced properties on the client:

```ts
client.cards.create(input);
client.transfers.list(filters);
```

Each resource is a class extending `BaseResource` that receives the Axios instance and logger.

### 8. Pagination

- `.list(filters)` — returns one page (items + pagination metadata). Mandatory for paginated resources.
- `.iterate(filters)` — returns `AsyncIterableIterator` traversing all pages. Optional, added when a consumer needs full traversal.

### 9. Authentication

Auth is always encapsulated in the SDK. The consumer provides credentials (API key, client id/secret, static token). The SDK handles header injection, token refresh, and 401 retry internally.

### 10. Rate limiting — three layers

All three layers are mandatory:

- **Proactive (consumer-global)**: injectable `RateLimiter` interface (`{ acquire(): Promise<{ remaining: number; resetMs: number }> }`). Optional parameter on the client constructor. The SDK calls it in an Axios request interceptor before auth.
- **Proactive (internal per-endpoint)**: the SDK maintains per-endpoint sliding-window buckets. Buckets are configured via `rateLimits?: Record<string, RateLimitConfig>` on `ClientOptions` (keys: `'global'`, `'resource'`, or `'resource.method'`; value: `{ limit: number; windowMs: number }`). The SDK author hardcodes sensible defaults; the consumer can override. `BaseResource.request()` acquires a bucket before every HTTP call and updates it from response headers. When headers contain rate-limit information (normalized from `ratelimit-*` / `x-ratelimit-*` variants), the bucket switches to header-driven mode.
- **Reactive**: Axios response interceptor retries on 429 (max 3 retries). Reads `Retry-After` (integer seconds or HTTP-date); uses it as wait duration when present and ≤ 60 s. If `Retry-After` > 60 s, throw `<Vendor>RateLimitError` immediately. If absent or unparseable, exponential backoff with jitter (`1s × 2^(attempt−1)` + 10 % jitter). No jitter when `Retry-After` is honored.

No retry on other status codes (5xx, network errors) — that is the consumer's responsibility.

### 11. Logger

Optional `Logger` interface, compatible with Pino:

```ts
interface Logger {
  debug: (message: string, ...args: unknown[]) => void;
  info: (message: string, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
}
```

If no logger is provided, the SDK is silent. A configurable `requestLogLevel` (default `'debug'`) controls HTTP tracing verbosity.

### 12. Timeout — per-endpoint

Every SDK exposes a global `timeoutMs` option (default at the SDK author's discretion, 30 s typical) plus per-endpoint overrides via `timeouts?: Record<string, number>` on `ClientOptions` (keys: `'resource.method'` or `'resource'`).

Resolution order: consumer method override → consumer resource override → SDK author method default → SDK author resource default → global `timeoutMs`.

Timeout errors are wrapped. The response interceptor catches Axios timeout errors (`error.code === 'ECONNABORTED'` or `'ETIMEDOUT'`) and throws `<Vendor>TimeoutError(timeoutMs)`. No raw `AxiosError` leaks to the consumer.

### 13. Data casing

Preserve the vendor's native format end-to-end. No camelCase transformation. TypeScript types mirror the API response exactly.

### 14. API versioning

The SDK targets one API version (encoded in the base URL or resource paths). Multi-version support is not pre-architected. If needed, create a second SDK or namespace at that time.

### 15. DI contract — abstract class

Each SDK exports an `abstract class I<Vendor>Client` that both the real client and in-memory client extend:

```ts
export abstract class IStripeClient {
  abstract readonly cards: {
    create(input: CardCreateInput): Promise<CardResponse>;
  };
}

export class StripeClient extends IStripeClient {
  /* ... */
}

export class InMemoryStripeClient extends IStripeClient {
  /* ... */
}
```

The abstract class is both the TypeScript contract and the Nest injection token. Interfaces are erased at runtime and cannot serve as tokens.

### 16. Nest integration — consumer-side

The SDK is framework-agnostic. Nest wiring lives in `apps/api/src/shared/integration/api-clients/<vendor>/`.

Use a static module plus a factory for a single credential set. Use a registry for multi-credential (several accounts known at boot). Do not use Nest `forRoot()` / `forFeature()` for the single-instance case.

Factories read credentials from `env` (`docs/adr/009-application-env-var-validation.md`). Do not inject `ConfigService` as the env source.

Do not use EventEmitter2. In-process events use `@nestjs/cqrs` EventBus (see `docs/adr/002-hexagonal-architecture.md`).

```ts
@Module({
  providers: [
    {
      provide: IStripeClient,
      useFactory: () =>
        new StripeClient({
          baseUrl: env.STRIPE_API_URL,
          apiKey: env.STRIPE_API_KEY,
        }),
    },
  ],
  exports: [IStripeClient],
})
export class StripeModule {}
```

### 17. Testing subpath

Exported via `@monsieurbarti/<vendor>-sdk/testing`:

- **`InMemory<Vendor>Client`** — extends `I<Vendor>Client`, stores data in memory, validates inputs with Zod.
- **Builders** — factory functions named `a<Vendor><Entity>(overrides?: Partial<T>): T`.
- **`simulateError(key, error, opts?)`** — key is `resource.method` (for example `'cards.create'`). One-shot by default; `{ persistent: true }` for repeated errors.
- **`clearErrors()`** and **`reset()`** (clears stores + errors).

`@faker-js/faker` is an optional `peerDependency` — only consumers of `/testing` need it.

### 18. SDK tests — fake HTTP server

SDK tests run against a real `node:http` server simulating the external API. No Axios mocks. The fake server is internal to the package (`tests/helpers/`), never exported.

Consumer tests use the `InMemory<Vendor>Client` via DI. They do not retest HTTP transport. See `docs/adr/006-testing-hexagonal-modules.md`.

### 19. Webhooks (optional subpath `./webhooks`)

When an external API sends webhooks, the SDK MAY export `./webhooks` providing:

- **Signature verification** — validates payload authenticity.
- **Payload parsing** — deserializes and validates the event body, returns typed event objects.
- **Event types** — TypeScript types for webhook payloads.

The SDK does not own event dispatch. The Nest integration receives the verified, parsed event and publishes it on the CQRS EventBus. The app emits. The SDK only verifies and parses.

### 20. Build and exports

Build with `tsup` (CJS + ESM + `.d.ts`).

**Source exports** — default while the SDK has no Nest or Docker runtime consumer. Monorepo consumers import TypeScript source directly:

```json
{
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./testing": "./src/testing.ts",
    "./webhooks": "./src/webhooks.ts"
  }
}
```

**Dist dual packaging** — required once Nest or Docker consumes the package. Switch in the same PR that wires Nest consumption. Omit `./webhooks` when the vendor has no inbound webhooks.

### 21. Dependencies

- **Runtime deps**: HTTP client (axios) + validation (zod). Additional deps only when the API requires it (for example an XML parser), with justification in the README.
- **No framework deps**: no `@nestjs/*`, no `express`.
- **`@faker-js/faker`**: optional `peerDependency` + `devDependency` — used only by the `/testing` subpath builders.

### 22. README

Every SDK package includes a `README.md` documenting constructor options, resource list with method signatures, error types, usage examples, and testing subpath usage.

### 23. Hex consumption (bounded contexts)

When a hexagonal BC under `apps/api/src/contexts/<bc>` needs an external vendor API:

- Hex **domain** and **application** never import `@monsieurbarti/*-sdk` packages, Nest SDK modules under `shared/integration/api-clients/**`, or concrete `<Vendor>Client` classes.
- Domain declares a driven port (abstract class) for the capability the BC needs, not a 1:1 dump of the vendor surface unless the BC truly owns that shape.
- Infrastructure adapter implements that port and may depend on `I<Vendor>Client` (§15) or the Nest-wired registry.
- Vendor SDKs are not bounded contexts. Cross-BC edges stay Hive-strict (`docs/adr/003-bc-hive-communication.md`). See also `docs/adr/002-hexagonal-architecture.md`.

## Consequences

Any external API integration follows a predictable structure. Testing is consistent: inject `InMemory<Vendor>Client` in unit tests, no HTTP mocks to maintain. SDKs are reusable in scripts, workers, and CLIs without Nest.

The abstract class contract keeps the in-memory client synchronized with the real client at compile time. Hex BCs stay extractable: swapping SDK for another adapter inside infrastructure does not touch domain or application.

Every external API — even one with a single endpoint — requires a full SDK package. That is more ceremony than an inline fetch. The error hierarchy is duplicated across SDKs (~40 lines each). A shared base package was rejected to avoid coupling. Dual rate limiting adds interceptor code even for APIs that rarely rate-limit. Hex BCs need an extra port-and-adapter hop versus injecting the SDK in a Nest service.

On init this ADR is unused code-wise. `packages/` stays empty until a later ticket needs a vendor. The cost of writing the law first is a file to follow; the cost of skipping it is a one-off Nest HTTP service that cannot be reused.

## Alternatives Considered

**Put HTTP in Nest services, or use `@nestjs/axios` as the SDK.** Rejected. It couples transport to business logic, makes tests mock Axios, grows without bound, and cannot be reused outside Nest. The SDK pattern separates concerns and enables `InMemoryClient`.

**Share one error-base package across SDKs.** Rejected. An update to core forces a bump of every SDK. The coordination cost exceeds the ~40 lines of duplication. Implementation details may legitimately vary per vendor.

**Ship an SDK on init.** Rejected. `packages/*` has zero members by layout lock. A placeholder vendor would be a toy package with no consumer. Law lands now; the first package lands when a real vendor is needed.

**TypeScript `interface` for the DI contract.** Rejected. Interfaces are erased at runtime and cannot serve as Nest injection tokens. `abstract class I<Vendor>Client` is both contract and token.

**camelCase normalization in the SDK.** Rejected. A transformation layer introduces mapping bugs, breaks vendor documentation, and complicates Zod passthrough.

**`forRoot()` / `forFeature()` Nest dynamic module.** Rejected for single-instance SDKs. A static module plus factory is enough. For multi-credential, a registry in a static module matches a known-at-boot set.

**EventEmitter2 for webhook dispatch.** Rejected. In-process events use `@nestjs/cqrs` EventBus (`docs/adr/002-hexagonal-architecture.md`). The SDK still only verifies and parses.

## Related references

- `docs/adr/002-hexagonal-architecture.md` — driven ports, EventBus, Nest as a driving adapter.
- `docs/adr/003-bc-hive-communication.md` — vendor SDKs are not BCs; cross-BC edges stay Hive-strict.
- `docs/adr/006-testing-hexagonal-modules.md` — consumer tests use InMemoryClient; SDK tests use a real `node:http` fake server.
- `docs/adr/009-application-env-var-validation.md` — Nest factories read `env`, not `ConfigService`.
