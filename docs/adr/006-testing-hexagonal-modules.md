# ADR 006 – Testing Hexagonal Modules

## Status

Accepted

## Context

This repository is a Nest REST API with hexagonal bounded contexts, Drizzle persistence, and a shared kernel. Tests must prove domain behavior, port contracts, and HTTP wiring without dragging a DI container into every spec.

Unit tests that boot Nest hide whether the handler under test actually used its ports. Integration tests that open SQL from the unit lane hide whether the domain still stands alone. A second runner, a second suffix, or a browser suite would split the doctrine before the first bounded context exists.

The skeleton has no product bounded context. The law still has to name how a bounded context will be tested, and what the kernel must already prove: date, identity, RFC 9457, Zod, audit, and health.

## Decision

We will test hexagonal modules, kernel utilities, and health with Vitest only. Direct instantiation is the unit and integration construction style. Real Postgres 18.6 is the integration backend. REST e2e is a black-box HTTP lane.

### 1. Runner — Vitest only

Every automated test in this repository runs on Vitest. There is no Jest. There is no `*.test.ts` glob.

Unit, integration, and e2e are three Vitest configs under `apps/api/`:

| Config                         | Include glob            | Pool / parallelism       |
| ------------------------------ | ----------------------- | ------------------------ |
| `vitest.config.ts`             | `*.unit.spec.ts`        | `pool: 'threads'`        |
| `vitest.integration.config.ts` | `*.integration.spec.ts` | `fileParallelism: false` |
| `vitest.e2e.config.ts`         | `*.e2e.spec.ts`         | `fileParallelism: false` |

Each config includes `src/shared/**`, `src/presentation/health/**`, and `src/contexts/**`. The three globs stay disjoint. An e2e spec never matches the unit or integration config.

### 2. Construction — direct instantiation

Hexagonal unit and integration tests instantiate the subject and its collaborators in process. No `TestBed`. No `Test.createTestingModule()` in a `*.unit.spec.ts` or `*.integration.spec.ts` file.

```typescript
const events = new CapturingEventEmitter();
const dateProvider = new FakeDateProvider(new Date("2026-04-01T00:00:00.000Z"));
const orders = new InMemoryOrderRepository(events);
const handler = new ArchiveOrderHandler(orders, dateProvider);
```

Ports are small abstract classes. The test owns a real in-memory double for each port. Auto-mocking those doubles would prove nothing.

Nest DI is a presentation and wiring concern. The e2e lane in §14 exercises it. Hexagonal unit tests do not.

### 3. Per-layer matrix

| Layer                                  | Lane                     | How                                                                    |
| -------------------------------------- | ------------------------ | ---------------------------------------------------------------------- |
| Entities, value objects                | Unit                     | Builder + `FakeDateProvider`. Pure TypeScript.                         |
| Domain events, domain errors           | Unit                     | Asserted via `events.captured` or the thrown instance.                 |
| Mappers (`toDomain` / `toPersistence`) | Unit                     | Round-trip: `toPersistence(toDomain(record))` deep-equals `record`.    |
| Repository ports                       | Shared contract          | In-memory unit + Drizzle integration both call the same suite.         |
| In-memory repository                   | Unit via contract        | `runRepositoryContract(() => new InMemoryXxxRepository(events))`.      |
| Drizzle repository                     | Integration via contract | Real Postgres 18.6 + the same contract.                                |
| Command handlers                       | Unit                     | In-memory repos + `FakeDateProvider` + `CapturingEventEmitter`.        |
| Event handlers                         | Unit                     | In-memory repos and a manually built event payload.                    |
| Query handlers                         | Integration              | Real Postgres. A query handler reads a projection.                     |
| REST controllers                       | Not unit-tested          | Dispatch-only. The e2e lane covers HTTP.                               |
| External SDK adapters                  | Integration only         | Recorded or sandbox responses. No isolated unit spec.                  |
| Kernel utilities                       | Unit                     | Direct construction. No SQL.                                           |
| Kernel audit Drizzle adapter           | Integration              | Contract against Postgres 18.6. See `docs/adr/007-audit-event-log.md`. |
| Health HTTP                            | E2E                      | One `GET` through a booted app.                                        |

Minimum coverage once a hexagonal module exists:

- Every public command handler method has one happy path and one error case.
- Every domain invariant has a test that proves rejection.
- Every mapper has a round-trip unit test.

REST controllers are not unit-tested because `docs/adr/002-hexagonal-architecture.md` keeps them dispatch-only. A unit spec would assert that the command we passed was the command we dispatched. That is a tautology. External SDK adapters follow `docs/adr/011-external-api-sdk-architecture.md`: the only useful proof is an integration run against a sandbox or a recorded fixture.

### 4. In-memory repositories

Every bounded-context repository port has a hand-written in-memory implementation at `{aggregate}/__tests__/__fixtures__/{name}.in-memory-repository.ts`.

That file is a test fixture. It is excluded from the production build. It is not kernel code.

- The constructor accepts the capturing event emitter from §6.
- State lives in a `Map<string, EntityState>`.
- The class implements every method on the abstract repository. Partial no-ops are forbidden.
- There is no I/O and no delayed timer. `await` exists only because the port is async.

The kernel audit in-memory adapter is kernel code under `apps/api/src/shared`. It is not a bounded-context fixture. It still implements the full audit port and still runs the shared contract from the unit lane.

### 5. Contract suites

A contract suite is a test factory that exercises every port method. Both implementations invoke it.

```typescript
// infrastructure/order.repository.contract.ts
export function runOrderRepositoryContract(
  factory: () => Promise<{
    repo: OrderRepository;
    events: CapturingEventEmitter;
  }>,
) {
  describe("OrderRepository contract", () => {
    it("should persist and retrieve an order by id", async () => {
      const { repo } = await factory();
      const order = anOrder().build();
      await repo.save(order);
      const found = await repo.findById(order.id);
      expect(found?.id).toBe(order.id);
    });
  });
}
```

Invocation:

- `{name}.in-memory-repository.contract.unit.spec.ts` builds the in-memory repository.
- `{name}.drizzle-repository.contract.integration.spec.ts` builds the Drizzle repository against Postgres 18.6.

Adding a method to the port without implementing it on both sides fails the contract. That is the point.

### 6. Capturing event emitter

`apps/api/src/shared/ddd/testing` ships `CapturingEventEmitter`. It records every published domain event.

Command handler tests assert on `events.captured`, not on `entity.pullEvents()`. That proves the repository published after persist, which is the integration contract the in-memory double must honor.

### 7. Builders

Each aggregate has a fluent builder at `{aggregate}/domain/__fixtures__/{name}.builder.ts`. The builder is excluded from the production build.

- `.build()` calls `reconstruct()`.
- `.buildNew()` calls `createNew()`.

`.build()` is the default. Most handler tests need an entity in an arbitrary legal state. `.buildNew()` is for creation events and create-time validation only.

Production code never imports a builder. Production constructs via `createNew()` from input or `reconstruct()` from a mapper. See `docs/adr/004-persistence-dto-and-mapper.md`.

If a test depends on a field value, the test sets that field on the builder. Asserting on leftover faker output is forbidden.

### 8. Cross-bounded-context reads

When bounded context A's command handler must read B's data, A's domain declares a local query port. A's infrastructure adapts that port to B through Hive, as `docs/adr/003-bc-hive-communication.md` requires. Tests inject an in-memory implementation of A's local port.

A's tests do not import B's handlers, repositories, or in-memory doubles. They import only the local port.

### 9. Style

- Arrange, act, assert. The three phases are visually distinct.
- `describe` nests class, then method, then behavior.
- `it` names follow `should X when Y`.
- `@ts-strict-ignore` is forbidden in tests. Doubles are typed.
- `vi.mock` is allowed only for a DI token the spec never exercises, so an unused constructor dependency does not load a heavy graph. It is forbidden for an asserted constant or a schema guard.

### 10. Time and identity

A test that asserts on time injects `FakeDateProvider` only. It never reads `new Date()` or `Date.now()` as the application clock.

A test that asserts on identity uses the kernel UUID v7 helper or an explicit builder default. It does not call `Math.random()` for ids.

Any `setTimeout`-driven wait runs under `vi.useFakeTimers` with stepped `vi.advanceTimersByTimeAsync`. Assertions keep their original patience bounds. Only the clock is faked.

### 11. File names

| Artifact                       | Name                                                       |
| ------------------------------ | ---------------------------------------------------------- |
| Repository contract suite      | `{name}.repository.contract.ts`                            |
| In-memory contract spec        | `{name}.in-memory-repository.contract.unit.spec.ts`        |
| Drizzle contract spec          | `{name}.drizzle-repository.contract.integration.spec.ts`   |
| Mapper unit spec               | `{name}.mapper.unit.spec.ts`                               |
| Command handler unit spec      | `{name}.command.unit.spec.ts`                              |
| Query handler integration spec | `{name}.query.integration.spec.ts`                         |
| Non-repo in-memory port double | `in-memory-{name}.{role}.ts` under `__fixtures__/`         |
| Health e2e spec                | `src/presentation/health/__tests__/e2e/{name}.e2e.spec.ts` |

### 12. Integration backend — real Postgres 18.6

Integration tests run against real Postgres 18.6. There is no PGlite. There are no Testcontainers.

Unit tests never open SQL. They never acquire a Drizzle client. They never read `backend_mono_test`.

The integration database is `backend_mono_test` on the root Compose Postgres service. CI uses a `postgres:18.6` service container with the same database name; `docs/adr/010-github-actions-workflows-organization.md` names that job.

Drizzle migrations run once per worker. While only kernel tables exist, integration and e2e keep `fileParallelism: false`.

`afterEach` truncates the tables the suite owns. After the first bounded context lands, isolation becomes id-scoped deletes only. Blanket `DELETE FROM` across another suite's rows is forbidden.

This ADR does not copy the local Compose recipe. A later model-invoked skill owns that recipe. Redis may be running with Compose. Redis is not a test dependency on init.

### 13. Init proving tests

The skeleton proves the kernel and health, not a product bounded context.

Unit:

- `FakeDateProvider`
- UUID v7 helper
- RFC 9457 exception filter (`docs/adr/005-error-handling-rfc-9457.md`)
- Zod pipe: skip unmarked input; fail loud when the pipe is bound
- Audit in-memory contract

Integration:

- Audit Drizzle contract against Postgres 18.6

E2E:

- One health `GET` through a booted `AppModule`
- `Test.createTestingModule` only under `__tests__/e2e/**`
- Health e2e does not need Postgres

There are no product bounded-context specs on init.

### 14. REST e2e

A REST e2e spec is a black-box HTTP test against a booted Nest application. It asserts on status, body, and persisted state. It does not spy on handlers or private methods.

`Test.createTestingModule` is permitted only under `__tests__/e2e/**`. Specs consume a harness. They do not inline the testing module.

`vi.mock` in this lane follows §9: unused DI tokens only.

On init the health suite boots `AppModule`. The first bounded context later adds a BC-scoped REST harness under that BC's `__tests__/e2e/**`. A BC suite then boots that harness, not `AppModule`. That harness is not part of the skeleton.

Health stays at `apps/api/src/presentation/health/`. Kernel stays at `apps/api/src/shared`. Neither is a product bounded context. See `docs/adr/002-hexagonal-architecture.md` and `docs/adr/012-documentation-factory.md`.

### 15. Review detection

A reviewer can reject a diff that:

- adds Jest, `*.test.ts`, `TestBed`, or `Test.createTestingModule` outside `__tests__/e2e/**`
- opens SQL from a `*.unit.spec.ts`
- uses PGlite or Testcontainers
- unit-tests a REST controller or an external SDK adapter
- asserts on `entity.pullEvents()` instead of `events.captured`
- calls `.build()` for a create-time invariant that needs `.buildNew()`, or the reverse as the only construction path
- imports another BC's internals instead of a local query port
- uses `@ts-strict-ignore`, wall-clock `Date.now()`, or real `setTimeout` waits

TDD ordering is not an ADR rule. A merge diff cannot show whether the test was written first. That guidance belongs in a skill, not here.

## Consequences

Positive:

- One runner, one suffix family, three lanes. CI names in `docs/adr/010-github-actions-workflows-organization.md` map onto these configs without a fourth doctrine.
- Handler tests read as arrange, act, assert against real in-memory ports. Contributors learn the module by reading one spec.
- Repository drift fails the contract suite instead of production.
- Unit stays fast because it never opens SQL. Integration stays honest because it uses Postgres 18.6, the same engine production uses.
- Health e2e proves Nest wiring for `GET /health` without standing up Postgres.

Negative:

- Each aggregate pays an in-memory repository, a contract suite, and a builder before the first handler spec is cheap. That cost is deliberate.
- REST controllers are not unit-tested. Mapping bugs at the HTTP edge surface in e2e or in production.
- Hexagonal unit tests cannot catch a missing Nest `provide`. E2e and application boot catch wiring.
- `fileParallelism: false` on integration serializes kernel-table suites. Throughput waits until id-scoped isolation exists.
- The local Compose recipe lives outside this ADR. An agent that ignores the skill will guess the database name.

Trade-offs:

- Vitest `pool: 'threads'` on unit favors speed and per-file isolation. Integration and e2e serialize files while the kernel owns the only tables.
- Faker-backed builder defaults favor short arrange blocks. The ban on asserting leftover faker output keeps those defaults from becoming the spec.

## Alternatives Considered

**Jest for unit or for the whole suite.** Rejected: a second runner and a `*.test.ts` suffix would split the doctrine on a greenfield API that has no legacy Jest inventory. Vitest covers unit, integration, and e2e.

**`TestBed` or `Test.createTestingModule` in unit and integration.** Rejected: the container reintroduces Nest into tests that should prove ports. The only extra assertion it buys is DI wiring, which the e2e lane already covers. `Test.createTestingModule` stays path-scoped to `__tests__/e2e/**`.

**GraphQL test clients (`supertest-graphql` and friends).** Rejected: the API is REST. E2e issues HTTP against resource routes. There is no GraphQL surface to wrap.

**PGlite as the integration database.** Rejected: the production engine is Postgres 18.6. An in-process stand-in hides engine-specific SQL and migration behavior that Drizzle will actually run.

**Testcontainers for Postgres.** Rejected: root Compose already runs Postgres 18.6 for local work, and CI already runs a `postgres:18.6` service. A container runtime inside the test process adds a second lifecycle for no extra fidelity.

**Unit-test REST controllers and external SDK adapters.** Rejected: both produce tautologies. Controllers dispatch. Adapters call the vendor. Prove them at HTTP e2e and at adapter integration.

**One shared in-memory repository in the kernel for every aggregate.** Rejected: a generic store would have to satisfy every port and would leak across Hive boundaries.

**TDD as an enforceable ADR rule.** Rejected: test-first ordering is not visible in a merge diff. This ADR enforces what the spec contains, not the order it was typed.

**Browser-driven suites as the API e2e lane.** Rejected: this repository has no frontend. API e2e is black-box HTTP through Vitest and Nest.
