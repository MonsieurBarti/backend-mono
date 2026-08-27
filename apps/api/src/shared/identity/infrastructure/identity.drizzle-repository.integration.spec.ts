import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, afterEach, describe, expect, it } from "vitest";

import { FakeDateProvider } from "../../ddd/testing/fake-date-provider.js";
import { hashPersonalAccessToken } from "../personal-access-token.js";
import { provisionUser } from "../provision-user.js";
import { IdentityDrizzleRepository } from "./identity.drizzle-repository.js";

const databaseUrl = process.env.DATABASE_URL;
if (databaseUrl === undefined || databaseUrl.length === 0) {
  throw new Error(
    "DATABASE_URL is missing; the identity Drizzle spec needs postgres://…/backend_mono_test",
  );
}

const client = postgres(databaseUrl);
const database = drizzle(client);
const identity = new IdentityDrizzleRepository(database);

afterEach(async () => {
  await client`TRUNCATE TABLE personal_access_tokens, users CASCADE`;
});

afterAll(async () => {
  await client.end();
});

describe("IdentityDrizzleRepository", () => {
  it("should round-trip a provisioned user when looking up the PAT hash", async () => {
    const result = await provisionUser({ identity, dates: new FakeDateProvider() });

    const found = await identity.findUserIdByTokenHash(hashPersonalAccessToken(result.token));
    const missing = await identity.findUserIdByTokenHash(hashPersonalAccessToken("unknown-token"));

    expect(found).toBe(result.userId);
    expect(missing).toBeUndefined();
  });
});
