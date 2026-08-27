import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "src/shared/**/*.integration.spec.ts",
      "src/presentation/**/*.integration.spec.ts",
      "src/contexts/**/*.integration.spec.ts",
    ],
    fileParallelism: false,
    environment: "node",
    globalSetup: "./vitest.integration.setup.ts",
    env: {
      NODE_ENV: "test",
      PORT: "3000",
      DATABASE_URL:
        process.env.DATABASE_URL ??
        "postgres://monsieurbarti:monsieurbarti@localhost:5432/backend_mono_test",
      LOG_LEVEL: "fatal",
    },
  },
});
