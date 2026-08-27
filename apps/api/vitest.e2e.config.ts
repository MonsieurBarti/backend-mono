import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "src/shared/**/*.e2e.spec.ts",
      "src/presentation/**/*.e2e.spec.ts",
      "src/contexts/**/*.e2e.spec.ts",
    ],
    fileParallelism: false,
    environment: "node",
    env: {
      NODE_ENV: "test",
      PORT: "3000",
      DATABASE_URL: "postgres://unused:unused@127.0.0.1:1/unused",
      LOG_LEVEL: "fatal",
    },
  },
});
