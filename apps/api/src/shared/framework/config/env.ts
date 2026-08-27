import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { appEnvSchema } from "./app-env.schema.js";

function loadLocalEnvFile(): void {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [join(process.cwd(), ".env"), join(here, "../../../../../../.env")];
  for (const path of candidates) {
    if (existsSync(path)) {
      process.loadEnvFile(path);
      return;
    }
  }
}

function absentEmptyStrings(input: NodeJS.ProcessEnv): Record<string, string | undefined> {
  const output: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(input)) {
    output[key] = value === "" ? undefined : value;
  }
  return output;
}

function writeIssues(issues: { path: PropertyKey[]; message: string }[]): void {
  const lines = issues.map((issue) => {
    const key = issue.path.map(String).join(".") || "(root)";
    return `${key}: ${issue.message}`;
  });
  process.stderr.write(`${lines.join("\n")}\n`);
}

loadLocalEnvFile();

const parsed = appEnvSchema.safeParse(absentEmptyStrings(process.env));
if (!parsed.success) {
  writeIssues(parsed.error.issues);
  process.exit(1);
}

export const env = parsed.data;
