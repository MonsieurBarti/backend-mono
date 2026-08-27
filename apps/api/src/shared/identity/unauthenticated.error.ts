import { BaseDomainError, PROBLEM_TYPE_BASE_URI } from "../ddd/index.js";

/**
 * Raised when a `/v1` request has no bearer token or the hash is unknown.
 * Detail is generic on purpose: the client must not learn whether a hash exists.
 */
export class UnauthenticatedError extends BaseDomainError {
  readonly type = `${PROBLEM_TYPE_BASE_URI}/unauthenticated`;
  readonly title = "Unauthenticated";
  override readonly status = 401;

  constructor(cause?: Error) {
    super({}, cause);
  }

  override get detail(): string {
    return "Authentication is required.";
  }
}
