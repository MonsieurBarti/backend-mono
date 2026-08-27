import { describe, expect, it } from "vitest";

import { newUuidV7 } from "./uuid-v7.js";

const CANONICAL_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const VERSION_NIBBLE_INDEX = 14;
const VARIANT_NIBBLE_INDEX = 19;
const RFC4122_VARIANTS = ["8", "9", "a", "b"];

describe("newUuidV7", () => {
  it("should match the canonical UUID string shape when minting", () => {
    const id = newUuidV7();

    expect(id).toMatch(CANONICAL_UUID);
  });

  it("should set the version nibble to 7 when minting", () => {
    const id = newUuidV7();

    expect(id[VERSION_NIBBLE_INDEX]).toBe("7");
  });

  it("should set the RFC 4122 variant to 8, 9, a, or b when minting", () => {
    const id = newUuidV7();

    expect(RFC4122_VARIANTS).toContain(id.charAt(VARIANT_NIBBLE_INDEX));
  });

  it("should return different strings when called twice", () => {
    const first = newUuidV7();
    const second = newUuidV7();

    expect(first).not.toBe(second);
  });
});
