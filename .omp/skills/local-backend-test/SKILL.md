---
name: local-backend-test
description: Local test, Compose, integration, e2e, or full database recipe for this API.
---

# Local backend test

For unit, do step 4.
For integration, do steps 1 through 3, then step 5.
For e2e, do step 6.
For full database, do steps 1 through 3.

## 1. Compose

From the repo root, run `docker compose up -d postgres`.
Done when `psql postgres://monsieurbarti:monsieurbarti@localhost:5432/backend_mono_test` connects as role `monsieurbarti`.
If port 5432 is taken, publish Compose on a free port: `POSTGRES_PORT=5433 docker compose up -d postgres`. Then set `DATABASE_URL=postgres://monsieurbarti:monsieurbarti@localhost:5433/backend_mono_test` for migrate and integration. Keep the database name `backend_mono_test`.
Redis may be up. Redis is not a test dependency.

## 2. `backend_mono_test`

Use database `backend_mono_test`.
Compose creates it from `docker/postgres/init/01-create-backend-mono-test.sql`.
Done when `backend_mono_test` exists.
Integration uses `backend_mono_test`. Do not use `backend_mono` for integration.

## 3. full database migrate

On a cold `backend_mono_test`, set
`DATABASE_URL=postgres://monsieurbarti:monsieurbarti@localhost:5432/backend_mono_test`
and run `pnpm --filter @monsieurbarti/api db:migrate`.
Done when `db:migrate` exits 0.
Integration `globalSetup` also migrates a warm database.

## 4. unit

Run `pnpm test:unit`.
Package-only: `pnpm --filter @monsieurbarti/api test:unit`.
Done when unit exits 0.
No DB. Compose may be down.

## 5. integration

Compose Postgres is up.
Run `pnpm test:integration`.
Done when integration exits 0 against `backend_mono_test`.

## 6. e2e

Run `pnpm test:e2e`.
Done when e2e exits 0.
Health GET through AppModule. No Postgres.
