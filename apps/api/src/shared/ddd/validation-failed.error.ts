import { BaseDomainError, PROBLEM_TYPE_BASE_URI } from "./base-domain-error.js";

export type ValidationViolation = {
  readonly field: string;
  readonly message: string;
};

export type ValidationFailedContext = {
  readonly violations: readonly ValidationViolation[];
};

/**
 * Raised when a bound request schema or an entity guard rejects input. The
 * `violations` extension member is present only for this problem type.
 */
export class ValidationFailedError extends BaseDomainError<ValidationFailedContext> {
  readonly type = `${PROBLEM_TYPE_BASE_URI}/validation-failed`;
  readonly title = "Validation Failed";
  override readonly status = 422;

  constructor(violations: readonly ValidationViolation[], cause?: Error) {
    super({ violations }, cause);
  }

  get violations(): readonly ValidationViolation[] {
    return this.context.violations;
  }

  override get detail(): string {
    const count = this.context.violations.length;
    return `${count} validation error${count === 1 ? "" : "s"}`;
  }
}
