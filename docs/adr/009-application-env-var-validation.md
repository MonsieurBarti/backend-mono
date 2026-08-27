# ADR 009 – Application Env Var Validation

## Status

Accepted

## Context

`apps/api` reads process configuration from the environment. Untyped `process.env` reads and Nest `ConfigService.get()` calls both return `string | undefined`. A misspelled key or a variable nobody provisioned surfaces as `undefined` the first time a code path exercises it, which can be long after boot, and often in a path with no error handling.

`.env.example` is documentation. Nothing in a documentation file can prove the application agrees with it. Treating that file as the contract inverts the dependency: the code would follow a list that drifts.

This ADR is law only. A later kernel ticket implements `apps/api/src/shared/framework/config/app-env.schema.ts` and `env.ts`. This repository has no GitOps `cd/` tree. Do not invent a drift-check against deploy files that do not exist here.

## Decision

We will validate application environment variables with one Zod schema, parsed once at boot, before `listen()`.

### 1. One Zod schema, parsed once at boot

`apps/api/src/shared/framework/config/app-env.schema.ts` declares `appEnvSchema`, a flat `z.object()`. `apps/api/src/shared/framework/config/env.ts` parses `process.env` against it at module scope and exports the result as `env`.

A validation failure prints every offending key and exits non-zero. The process never reaches `listen()` with invalid configuration.

### 2. The schema is the source of truth; `.env.example` is documentation

`appEnvSchema` is the single source of truth for the key set. `.env.example` is checked against the schema, never the reverse.

- A key in `.env.example` that the schema does not declare is an error: the schema decides what exists.
- A key the schema declares and the file lacks is an error: local documentation must name every application key.
- What `.env.example` keeps owning is local development values and the prose explaining a variable. Do not generate the file wholesale from TypeScript.

A key belongs in the schema when the **application** reads it, including indirectly — through a constant, or by a third-party SDK reading `process.env` on its own. Keys read only by standalone tooling stay out.

### 3. Plain Zod — no environment-variable framework

Use the Zod already pinned in the workspace. Do not add `@t3-oss/env-core` or any other env framework. See Alternative A.

### 4. A key is required or optional — there is no conditional state

A key is required or optional. There is no boot-time cross-field "required when" refinement. Do not add `.superRefine()` (or equivalent) that says "KEY is required when OTHER_KEY says so."

Three reasons:

1. **The blast radius is the whole process, not the feature.** A boot-time refinement stops every entrypoint that imports the env module, including later migrators and scripts.
2. **They buy no typing.** A refinement does not narrow output types, so the call site still sees `string | undefined`.
3. **They cannot be verified at the schema.** A conditional rule fails in environments the schema cannot see.

A conditional requirement belongs where the value is consumed. Raise there, naming the key and the condition.

On init, required keys are the ones the later kernel ticket locks (`NODE_ENV`, `PORT`, `DATABASE_URL`). Optional keys may carry defaults (for example `LOG_LEVEL` default `info`). Do not mark every declared key required on day 1.

### 5. `env` is canonical; do not inject `ConfigService` as the env source

New code imports `env` and reads `env.KEY`. Do not inject Nest `ConfigService` to read environment variables. Two access paths is the problem this ADR exists to solve.

Do not wrap `ConfigService` with `validate: () => env` or a `ConfigService<AppEnv, true>` alias. Those aliases promise validated, coerced values that `ConfigService` does not serve, and they freeze a snapshot that hides later `process.env` writes in tests.

No Nest `registerAs` namespaces. Feature config objects, if any, read from `env`.

### 6. Empty strings are absent

`KEY=` in a `.env` file yields `''`, which satisfies `z.string()` and would boot the application with an empty value. Strip values equal to `''` before parse, so `.optional()` means what it says. Whitespace is a value — `' '` is something someone typed.

### 7. Validation errors name keys, never values

The formatter emits `issue.path` and `issue.message` only. It never reads Zod's `error.message`, which embeds received values for some issue types. Print to stderr only. A secret must not travel with the message.

### 8. Entrypoints populate `process.env` before importing the env module

The singleton parses at import time, so anything that fills `process.env` later is invisible to it. Load dotenv (or any secret injector) before the first import of `env.ts` or of a module that imports it. `env.ts` may load the local `.env` file itself so entrypoints do not each have to remember.

## Consequences

A misspelled or missing required key is a boot failure that names the key, not a mystery `undefined` later. `.env.example` stays documentation, but CI (or the kernel ticket that implements the schema) can check it against `appEnvSchema`.

Optional keys stay `string | undefined` at call sites. With no conditional requirements, a key the schema cannot prove present keeps a non-null assertion or a local guard where it is consumed.

An import-time singleton is less testable than dependency injection. `env` is resolved when the module is first imported: there is no DI override and no per-test mock. Tests that import modules reading `env` inherit the process environment. Required keys must exist in the test env files, or the suite fails at import time.

Adding an environment variable is a multi-file change: schema, `.env.example`, and — if required — test env files. That friction is the point. It keeps the artifacts in agreement.

There is no GitOps drift-check in this repository. Tightening the required set is a later operational concern, not a check against files this tree does not contain.

## Alternatives Considered

**A. `@t3-oss/env-core`.** Rejected. The library's defining feature is a client/server split and a runtime Proxy that throws when browser code touches a server secret. This application is a server-only Nest process, so that value is zero. What remains is an error formatter (which this decision needs anyway), a skip-validation flag, and empty-string-as-undefined — reproducible in one strip before parse (§6). The rest of its surface exists for browser bundles and platform hosting, neither of which applies here. A runtime dependency that appears nowhere else in this workspace is not worth the lines it would save. The default failure path also embeds received values, which would leak a secret into stderr (§7).

**B. Nest `ConfigService` as the env source.** Rejected. `get()` returns untyped strings, invites a second access path beside `env`, and does not exit before `listen()`. Backing it with the validated object freezes a first-import snapshot and hides later `process.env` writes.

**C. Per-request env guards.** Rejected. Environment variables are process-scoped, not request-scoped. Validating them per request would report the same misconfiguration on every call instead of once, at boot, before serving traffic.

**D. Make every declared key required on day 1.** Rejected. Optional keys with defaults are real (`LOG_LEVEL`). Requiring keys the process does not need yet, or keys later features will add, turns a missing unused variable into an outage. Required is a deliberate subset. Tighten it when a key is actually consumed on every boot.

**E. Treat `.env.example` as the contract and generate the schema from it.** Rejected. The file drifts (commented keys, duplicates, prose). The schema is code the application imports. Documentation follows code.

**F. A GitOps drift-check against `cd/`.** Rejected. This repository has no `cd/` tree. Do not invent one in order to copy a check from another codebase.

## Related references

- `docs/adr/001-architecture-decision-records.md` — ADR format and immutability.
- Later kernel ticket implements `apps/api/src/shared/framework/config/app-env.schema.ts` and `env.ts`.
