import type { INestApplication } from "@nestjs/common";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { bootHealthApp } from "./health-app.harness.js";

describe("GET /health", () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await bootHealthApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("should return 200 and ok when GET health", async () => {
    const response = await fetch(`${await app.getUrl()}/health`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });
});
