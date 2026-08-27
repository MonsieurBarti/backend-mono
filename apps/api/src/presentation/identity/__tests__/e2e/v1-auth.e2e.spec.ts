import type { INestApplication } from "@nestjs/common";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PROBLEM_JSON_CONTENT_TYPE } from "../../../../shared/infrastructure/http/problem-document.js";
import { bootHealthApp } from "../../../health/__tests__/e2e/health-app.harness.js";

describe("GET /v1/me", () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await bootHealthApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("should return 401 problem+json when GET v1 me has no bearer", async () => {
    const response = await fetch(`${await app.getUrl()}/v1/me`);
    const body: unknown = await response.json();

    expect(response.status).toBe(401);
    expect(response.headers.get("content-type")).toContain(PROBLEM_JSON_CONTENT_TYPE);
    expect(body).toEqual(
      expect.objectContaining({
        type: "https://problems.monsieurbarti.dev/unauthenticated",
        title: "Unauthenticated",
        status: 401,
        detail: "Authentication is required.",
      }),
    );
  });
});
