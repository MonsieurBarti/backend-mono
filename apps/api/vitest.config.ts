import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "src/shared/**/*.unit.spec.ts",
      "src/presentation/health/**/*.unit.spec.ts",
      "src/contexts/**/*.unit.spec.ts",
    ],
    pool: "threads",
    environment: "node",
    // Filter specs import AppLogger, which reads LOG_LEVEL from env.ts.
    // Dummy URL: unit never opens SQL and never uses backend_mono_test.
    env: {
      NODE_ENV: "test",
      PORT: "3000",
      DATABASE_URL: "postgres://unused:unused@127.0.0.1:1/unused",
      LOG_LEVEL: "fatal",
    },
  },
});
