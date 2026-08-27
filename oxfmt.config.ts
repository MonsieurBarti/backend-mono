import { defineConfig } from "oxfmt";

export default defineConfig({
  ignorePatterns: ["**/dist/**", "**/.turbo/**", "**/pnpm-lock.yaml"],
});
