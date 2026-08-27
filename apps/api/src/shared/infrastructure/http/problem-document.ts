import type { ValidationViolation } from "../../ddd/index.js";

/** RFC 9457 media type. Every failed HTTP response uses it. */
export const PROBLEM_JSON_CONTENT_TYPE = "application/problem+json";

/**
 * RFC 9457 Problem Details body. `violations` is an extension member carried
 * only by the validation problem type.
 */
export interface ProblemDocument {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  violations?: readonly ValidationViolation[];
}

/** Minimal view of the outbound response the filters write. */
export interface ProblemResponseView {
  status(code: number): ProblemResponseView;
  setHeader(name: string, value: string): void;
  json(body: unknown): void;
}

/**
 * Single writer for problem responses: the HTTP status always equals the
 * problem `status`, and the media type is always `application/problem+json`.
 */
export function writeProblem(response: ProblemResponseView, problem: ProblemDocument): void {
  response.setHeader("Content-Type", PROBLEM_JSON_CONTENT_TYPE);
  response.status(problem.status).json(problem);
}
