import type { ClsStore } from "nestjs-cls";

/**
 * Entry point that opened the current unit of work. HTTP requests are `api`;
 * the remaining values exist for the adapters that arrive later.
 */
export type RequestSource = "api" | "webhook" | "cron" | "migration" | "job" | "event-handler";

/**
 * Request-scoped context propagated through `AsyncLocalStorage`. Correlation is
 * operational metadata: it never travels on a domain event payload.
 */
export interface AppClsStore extends ClsStore {
  /** UUIDv4 grouping every log line caused by one initiating action. */
  correlationId: string;

  /** Entry point that opened the store. */
  source: RequestSource;

  /** Caller address, audit metadata only. */
  ip?: string;

  /** Caller `User-Agent`, audit metadata only. */
  userAgent?: string;

  /** Authenticated principal id, filled by an auth guard when one exists. */
  actorId?: string;

  /** Authenticated principal kind, filled by an auth guard when one exists. */
  actorType?: string;
}

/** Store keys written by the HTTP middleware. */
export const CLS_CORRELATION_ID = "correlationId";
export const CLS_SOURCE = "source";
export const CLS_IP = "ip";
export const CLS_ACTOR_ID = "actorId";
export const CLS_ACTOR_TYPE = "actorType";
export const CLS_USER_AGENT = "userAgent";
