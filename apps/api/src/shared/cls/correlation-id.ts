import { randomUUID } from "node:crypto";

/** Request header carrying a client supplied correlation id (lowercased by Node). */
export const CORRELATION_ID_HEADER = "x-correlation-id";

/** Response header echoing the correlation id back to the caller. */
export const CORRELATION_ID_RESPONSE_HEADER = "X-Correlation-ID";

/**
 * UUIDv4 shape. Correlation ids stay v4 on purpose: domain aggregate ids are v7
 * and the two must not be confused. Validated with a regex so the `uuid`
 * package stays out of the dependency list.
 */
const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Trusts the inbound header when it is a valid UUIDv4, otherwise mints a fresh
 * one. The server always has a correlation id; the client only ever hints.
 */
export function resolveCorrelationId(candidate: string | undefined): string {
  if (candidate !== undefined && UUID_V4_PATTERN.test(candidate)) {
    return candidate;
  }
  return randomUUID();
}
