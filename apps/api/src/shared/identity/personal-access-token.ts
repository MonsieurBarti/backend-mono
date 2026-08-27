import * as nodeCrypto from "node:crypto";

export const PERSONAL_ACCESS_TOKEN_BYTES = 32;
export const PERSONAL_ACCESS_TOKEN_PREFIX_LENGTH = 8;

export function mintPersonalAccessToken(): string {
  return nodeCrypto.randomBytes(PERSONAL_ACCESS_TOKEN_BYTES).toString("base64url");
}

export function hashPersonalAccessToken(secret: string): string {
  return nodeCrypto.createHash("sha256").update(secret, "utf8").digest("hex");
}

export function tokenPrefix(secret: string): string {
  return secret.slice(0, PERSONAL_ACCESS_TOKEN_PREFIX_LENGTH);
}
