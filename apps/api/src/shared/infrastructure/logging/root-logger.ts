import { pino, type Logger } from "pino";

import { env } from "../../framework/config/env.js";

/** Structured fields attached to a log line. Never a free-form sentence. */
export type LogBindings = Record<string, unknown>;

/**
 * Keys censored at any depth, i.e. the `**.<key>` paths of ADR 008.
 *
 * They are applied through a log formatter rather than pino's `redact` option
 * on purpose: `redact` is backed by fast-redact, whose wildcard matches exactly
 * one level, so a literal `**.password` path silently redacts nothing. A key
 * table walked at every depth keeps one source of truth instead of a cross
 * product of `*.password`, `*.*.password`, ... paths that still stops at an
 * arbitrary depth.
 *
 * This is a safety net. Callers still must not log passwords, tokens, card
 * numbers, full emails, phone numbers, JWT payloads or user content bodies.
 */
const REDACTED_KEYS: Record<string, true> = {
  password: true,
  token: true,
  secret: true,
  authorization: true,
  creditCard: true,
  creditCardNumber: true,
  cvv: true,
  accessToken: true,
  refreshToken: true,
  apiKey: true,
};

const REDACT_CENSOR = "[REDACTED]";

/** Bounds the walk on pathological or self-referencing log payloads. */
const MAX_REDACT_DEPTH = 8;

/**
 * Copy-on-write censoring: an object holding no censored key is returned by
 * reference, so a clean log line allocates nothing beyond the key arrays.
 */
function censorRecord(source: Record<string, unknown>, depth: number): Record<string, unknown> {
  let copy: Record<string, unknown> | undefined;
  for (const key of Object.keys(source)) {
    const current = source[key];
    const next = REDACTED_KEYS[key] === true ? REDACT_CENSOR : censorValue(current, depth + 1);
    if (next !== current) {
      copy ??= { ...source };
      copy[key] = next;
    }
  }
  return copy ?? source;
}

function censorValue(value: unknown, depth: number): unknown {
  if (depth >= MAX_REDACT_DEPTH || typeof value !== "object" || value === null) {
    return value;
  }

  if (Array.isArray(value)) {
    let copy: unknown[] | undefined;
    for (let index = 0; index < value.length; index += 1) {
      const next = censorValue(value[index], depth + 1);
      if (next !== value[index]) {
        copy ??= [...value];
        copy[index] = next;
      }
    }
    return copy ?? value;
  }

  return censorRecord(value as Record<string, unknown>, depth);
}

/**
 * The single root logger: JSON to stdout, no transport, no vendor APM. `mixin`
 * runs on every log call so callers never pass `correlationId` by hand, and the
 * log formatter censors secrets in both the mixin output and the call bindings.
 */
export function createRootLogger(mixin: () => LogBindings): Logger {
  return pino({
    level: env.LOG_LEVEL,
    mixin,
    formatters: {
      level: (label: string) => ({ level: label }),
      log: (object: Record<string, unknown>) => censorRecord(object, 0),
    },
  });
}
