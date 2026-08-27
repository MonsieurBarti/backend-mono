import { describe, expect, it } from "vitest";

import { FakeDateProvider } from "../ddd/testing/fake-date-provider.js";
import { hashPersonalAccessToken, tokenPrefix } from "./personal-access-token.js";
import { provisionUser } from "./provision-user.js";
import { InMemoryIdentityRepository } from "./testing/in-memory-identity-repository.js";

const CANONICAL_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe("provisionUser", () => {
  it("should persist a user and the hash of one PAT when provisioning", async () => {
    const identity = new InMemoryIdentityRepository();
    const dates = new FakeDateProvider();

    const result = await provisionUser({ identity, dates });

    expect(result.userId).toMatch(CANONICAL_UUID);
    expect(identity.users).toEqual([{ id: result.userId, createdAt: dates.now() }]);
    expect(identity.tokens).toHaveLength(1);
    expect(identity.tokens[0]?.tokenHash).toBe(hashPersonalAccessToken(result.token));
    expect(identity.tokens[0]?.prefix).toBe(tokenPrefix(result.token));
    expect(identity.tokens[0]?.tokenHash).not.toBe(result.token);
  });

  it("should find the user id when looking up the minted token hash", async () => {
    const identity = new InMemoryIdentityRepository();

    const result = await provisionUser({ identity, dates: new FakeDateProvider() });
    const userId = await identity.findUserIdByTokenHash(hashPersonalAccessToken(result.token));

    expect(userId).toBe(result.userId);
  });

  it("should return undefined when looking up a hash that was never stored", async () => {
    const identity = new InMemoryIdentityRepository();
    await provisionUser({ identity, dates: new FakeDateProvider() });

    const userId = await identity.findUserIdByTokenHash(hashPersonalAccessToken("unknown-token"));

    expect(userId).toBeUndefined();
  });
});
