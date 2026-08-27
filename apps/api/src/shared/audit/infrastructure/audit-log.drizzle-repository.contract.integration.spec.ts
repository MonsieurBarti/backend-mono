import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, afterEach } from "vitest";

import { FakeDateProvider } from "../../ddd/testing/fake-date-provider.js";
import { AuditLogDrizzleRepository } from "./audit-log.drizzle-repository.js";
import { runAuditLogRepositoryContract } from "./audit-log.repository.contract.js";

const databaseUrl = process.env.DATABASE_URL;
if (databaseUrl === undefined || databaseUrl.length === 0) {
  throw new Error(
    "DATABASE_URL is missing; the audit Drizzle contract needs postgres://…/backend_mono_test",
  );
}

const client = postgres(databaseUrl);
const database = drizzle(client);

afterEach(async () => {
  await client`TRUNCATE TABLE audit_logs`;
});

afterAll(async () => {
  await client.end();
});

runAuditLogRepositoryContract(async () => {
  const dates = new FakeDateProvider();
  const repo = new AuditLogDrizzleRepository(database, dates);
  return { repo, dates };
});
