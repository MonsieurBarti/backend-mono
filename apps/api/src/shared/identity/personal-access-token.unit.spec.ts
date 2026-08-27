import { describe, expect, it } from "vitest";

import {
  hashPersonalAccessToken,
  mintPersonalAccessToken,
  tokenPrefix,
} from "./personal-access-token.js";

const KNOWN_SECRET = "test-token";
const KNOWN_SHA256 = "4c5dc9b7708905f77f5e5d16316b5dfb425e68cb326dcd55a860e90a7707031e";

describe("hashPersonalAccessToken", () => {
  it("should return the SHA-256 hex of a known secret when hashing", () => {
    expect(hashPersonalAccessToken(KNOWN_SECRET)).toBe(KNOWN_SHA256);
  });

  it("should return the same digest when hashing the same secret twice", () => {
    const first = hashPersonalAccessToken(KNOWN_SECRET);
    const second = hashPersonalAccessToken(KNOWN_SECRET);

    expect(first).toBe(second);
  });

  it("should return a different digest when hashing a different secret", () => {
    expect(hashPersonalAccessToken("other-token")).not.toBe(KNOWN_SHA256);
  });
});

describe("mintPersonalAccessToken", () => {
  it("should return different secrets when minting twice", () => {
    const first = mintPersonalAccessToken();
    const second = mintPersonalAccessToken();

    expect(first).not.toBe(second);
  });
});

describe("tokenPrefix", () => {
  it("should return the first eight characters when taking a prefix", () => {
    expect(tokenPrefix("abcdefghijkl")).toBe("abcdefgh");
  });
});
