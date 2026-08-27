import { fileURLToPath } from "node:url";

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

/**
 * Runs Drizzle migrations once against `backend_mono_test`.
 * Vitest `test.env` does not reach globalSetup, so this URL is explicit.
 * This file does not import `env.ts`.
 */
const TEST_DATABASE_URL = "postgres://monsieurbarti:monsieurbarti@localhost:5432/backend_mono_test";

export default async function setup(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL ?? TEST_DATABASE_URL;
  if (!databaseUrl.includes("backend_mono_test")) {
    throw new Error(
      `integration globalSetup refuses DATABASE_URL=${databaseUrl}; use backend_mono_test`,
    );
  }

  const migrationsFolder = fileURLToPath(new URL("./migrations", import.meta.url));
  const client = postgres(databaseUrl, { max: 1 });
  try {
    await migrate(drizzle(client), { migrationsFolder });
  } finally {
    await client.end();
  }
}
