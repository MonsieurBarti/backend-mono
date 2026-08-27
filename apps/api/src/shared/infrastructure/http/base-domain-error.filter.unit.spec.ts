import type { ArgumentsHost } from "@nestjs/common";
import { beforeEach, describe, expect, it } from "vitest";

import { BaseDomainError, PROBLEM_TYPE_BASE_URI, ValidationFailedError } from "../../ddd/index.js";
import type { AppLogger } from "../logging/logger.service.js";
import { BaseDomainErrorFilter } from "./base-domain-error.filter.js";
import {
  PROBLEM_JSON_CONTENT_TYPE,
  type ProblemDocument,
  type ProblemResponseView,
} from "./problem-document.js";

type EmitCall = {
  level: Parameters<AppLogger["emit"]>[0];
  event: string;
  fields: Record<string, unknown>;
};

class RecordingLogger implements Pick<AppLogger, "emit"> {
  readonly calls: EmitCall[] = [];

  emit(level: EmitCall["level"], event: string, fields: Record<string, unknown> = {}): void {
    this.calls.push({ level, event, fields });
  }
}

class FakeResponse implements ProblemResponseView {
  readonly headers: Record<string, string> = {};
  statusCode: number | undefined;
  body: unknown;

  setHeader(name: string, value: string): void {
    this.headers[name] = value;
  }

  status(code: number): this {
    this.statusCode = code;
    return this;
  }

  json(body: unknown): void {
    this.body = body;
  }
}

class InternalFailureError extends BaseDomainError<{ secret: string }> {
  readonly type = `${PROBLEM_TYPE_BASE_URI}/internal-failure`;
  readonly title = "Internal Failure";

  constructor(secret: string) {
    super({ secret });
  }

  override get detail(): string {
    return "An internal failure occurred";
  }
}

function hostOf(response: FakeResponse): ArgumentsHost {
  return {
    switchToHttp: () => ({
      getResponse: () => response,
    }),
  } as ArgumentsHost;
}

describe("BaseDomainErrorFilter", () => {
  let logger: RecordingLogger;
  let response: FakeResponse;
  let filter: BaseDomainErrorFilter;

  beforeEach(() => {
    logger = new RecordingLogger();
    response = new FakeResponse();
    filter = new BaseDomainErrorFilter(logger as AppLogger);
  });

  it("should write application/problem+json and HTTP status equal to problem status when catching a domain error", () => {
    const error = new ValidationFailedError([{ field: "name", message: "Required" }]);

    filter.catch(error, hostOf(response));

    expect(response.headers["Content-Type"]).toBe(PROBLEM_JSON_CONTENT_TYPE);
    expect(response.statusCode).toBe(error.status);
    expect(response.statusCode).toBe((response.body as ProblemDocument).status);
  });

  it("should include type, title, status, detail, and instance when serializing a domain error", () => {
    const error = new ValidationFailedError([{ field: "name", message: "Required" }]);

    filter.catch(error, hostOf(response));

    expect(response.body).toEqual(
      expect.objectContaining({
        type: error.type,
        title: error.title,
        status: error.status,
        detail: error.detail,
        instance: error.instance,
      }),
    );
  });

  it("should include violations and omit context when catching ValidationFailedError", () => {
    const violations = [
      { field: "email", message: "Invalid email" },
      { field: "address.city", message: "Required" },
    ];
    const error = new ValidationFailedError(violations);

    filter.catch(error, hostOf(response));

    const body = response.body as ProblemDocument;
    expect(body.type).toBe(`${PROBLEM_TYPE_BASE_URI}/validation-failed`);
    expect(body.title).toBe("Validation Failed");
    expect(body.status).toBe(422);
    expect(body.violations).toEqual(violations);
    expect(body).not.toHaveProperty("context");
  });

  it("should omit context from JSON when catching a 500 subclass", () => {
    const error = new InternalFailureError("server-only-token");

    filter.catch(error, hostOf(response));

    const body = response.body as ProblemDocument;
    expect(body.status).toBe(500);
    expect(body).not.toHaveProperty("context");
    expect(JSON.stringify(body)).not.toContain("server-only-token");
  });

  it("should log error.domain at warn when status is below 500", () => {
    const error = new ValidationFailedError([{ field: "name", message: "Required" }]);

    filter.catch(error, hostOf(response));

    expect(logger.calls).toHaveLength(1);
    expect(logger.calls[0]?.level).toBe("warn");
    expect(logger.calls[0]?.event).toBe("error.domain");
  });

  it("should log error.domain at error when status is 500 or above", () => {
    const error = new InternalFailureError("server-only-token");

    filter.catch(error, hostOf(response));

    expect(logger.calls).toHaveLength(1);
    expect(logger.calls[0]?.level).toBe("error");
    expect(logger.calls[0]?.event).toBe("error.domain");
  });

  it("should include context in log fields when catching a domain error", () => {
    const error = new InternalFailureError("server-only-token");

    filter.catch(error, hostOf(response));

    expect(logger.calls[0]?.fields).toEqual({
      type: error.type,
      status: error.status,
      instance: error.instance,
      detail: error.detail,
      context: { secret: "server-only-token" },
    });
    expect(response.body).not.toHaveProperty("context");
  });
});
