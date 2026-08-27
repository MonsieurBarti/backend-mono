import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: [
    "./src/shared/audit/infrastructure/audit-log.schema.ts",
    "./src/shared/identity/infrastructure/identity.schema.ts",
  ],
  out: "./migrations",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      "postgres://monsieurbarti:monsieurbarti@localhost:5432/backend_mono",
  },
});
