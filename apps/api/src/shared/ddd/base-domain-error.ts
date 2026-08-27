import { newUuidV7 } from "./uuid-v7.js";

/**
 * Catalog host for RFC 9457 `type` and `instance` URIs. New problem classes add
 * a new path segment; a URI is never reused for a different meaning.
 */
export const PROBLEM_TYPE_BASE_URI = "https://problems.monsieurbarti.dev";

const INSTANCE_REFERENCE_LENGTH = 6;

export type DomainErrorContext = Record<string, unknown>;

/**
 * Base class for every domain error. Extends `Error`, imports neither Nest nor
 * HTTP, and carries the RFC 9457 problem members that presentation serializes.
 *
 * `context` is server-only and is never sent to the client. `detail` is derived
 * from `context` by the concrete class, never assembled at the throw site.
 * `message` is a getter over `detail`, so `detail === message` always holds.
 */
export abstract class BaseDomainError<
  Context extends DomainErrorContext = DomainErrorContext,
> extends Error {
  /** Absolute URI identifying the problem class. Clients switch on this. */
  abstract readonly type: string;

  /** Short English summary of the problem class. */
  abstract readonly title: string;

  /** Indicative HTTP status. Concrete classes override the 500 default. */
  readonly status: number = 500;

  /** Server-only payload. Logged, never serialized to the client. */
  readonly context: Context;

  /** URI identifying this occurrence, unique per throw. */
  readonly instance: string;

  override readonly cause?: Error;

  protected constructor(context: Context, cause?: Error) {
    super();
    this.name = new.target.name;
    this.context = context;
    this.cause = cause;
    const reference = newUuidV7().replaceAll("-", "").slice(-INSTANCE_REFERENCE_LENGTH);
    this.instance = `${PROBLEM_TYPE_BASE_URI}/instances/IE-${reference.toUpperCase()}`;
  }

  /** Occurrence-specific English text derived from `context`. */
  abstract get detail(): string;

  override get message(): string {
    return this.detail;
  }
}
