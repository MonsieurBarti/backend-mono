import * as nodeCrypto from "node:crypto";

/**
 * `crypto.randomUUIDv7()` is the platform minter. It is not declared by the
 * installed `@types/node`, and it is absent from runtimes older than the pinned
 * one, so it is reached through a narrow structural type with an RFC 9562
 * compliant fallback. This is the only kernel file allowed to touch
 * `node:crypto`; every other domain file mints ids through `newUuidV7()`.
 */
type PlatformUuidV7Minter = {
  randomUUIDv7?: () => string;
};

const platform = nodeCrypto as PlatformUuidV7Minter;

const UUID_TIMESTAMP_BYTES = 6;
const VERSION_BYTE_INDEX = 6;
const VARIANT_BYTE_INDEX = 8;

function mintUuidV7(): string {
  const bytes = nodeCrypto.randomBytes(16);
  bytes.writeUIntBE(Date.now(), 0, UUID_TIMESTAMP_BYTES);
  bytes[VERSION_BYTE_INDEX] = (bytes[VERSION_BYTE_INDEX] & 0x0f) | 0x70;
  bytes[VARIANT_BYTE_INDEX] = (bytes[VARIANT_BYTE_INDEX] & 0x3f) | 0x80;

  const hex = bytes.toString("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

/**
 * Mints a UUID v7. The domain type is `string`.
 */
export function newUuidV7(): string {
  return platform.randomUUIDv7?.() ?? mintUuidV7();
}
