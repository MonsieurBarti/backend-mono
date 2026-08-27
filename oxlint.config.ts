import { defineConfig } from "oxlint";

export default defineConfig({
  categories: {
    correctness: "error",
  },
  ignorePatterns: ["**/dist/**", "**/.turbo/**", "**/node_modules/**"],
  overrides: [
    {
      files: ["**/contexts/*.ts", "**/contexts/**/*.ts"],
      excludeFiles: ["**/domain/*.ts", "**/domain/**/*.ts"],
      rules: {
        "no-restricted-imports": [
          "error",
          {
            patterns: [
              {
                regex: "contexts/[^/]+/(domain|application|infrastructure|presentation)",
                message: "A bounded context cannot import another except ports/.",
              },
            ],
          },
        ],
      },
    },
    {
      files: ["**/domain/*.ts", "**/domain/**/*.ts"],
      rules: {
        "no-restricted-imports": [
          "error",
          {
            paths: [
              {
                name: "@nestjs/common",
                message: "Domain cannot import Nest.",
              },
              {
                name: "drizzle-orm",
                message: "Domain cannot import Drizzle.",
              },
              {
                name: "postgres",
                message: "Domain cannot import postgres.",
              },
              {
                name: "express",
                message: "Domain cannot import HTTP.",
              },
              {
                name: "fastify",
                message: "Domain cannot import HTTP.",
              },
              {
                name: "http",
                message: "Domain cannot import HTTP.",
              },
              {
                name: "https",
                message: "Domain cannot import HTTP.",
              },
              {
                name: "node:http",
                message: "Domain cannot import HTTP.",
              },
              {
                name: "node:https",
                message: "Domain cannot import HTTP.",
              },
            ],
            patterns: [
              {
                group: ["@nestjs", "@nestjs/*"],
                message: "Domain cannot import Nest.",
              },
              {
                group: ["drizzle-orm/*"],
                message: "Domain cannot import Drizzle.",
              },
              {
                group: ["postgres/*"],
                message: "Domain cannot import postgres.",
              },
              {
                regex: "contexts/[^/]+/(domain|application|infrastructure|presentation)",
                message: "A bounded context cannot import another except ports/.",
              },
            ],
          },
        ],
      },
    },
    {
      files: ["**/*.schema.ts"],
      rules: {
        "no-restricted-imports": [
          "error",
          {
            paths: [
              {
                name: "express",
                message: "Schema files cannot import HTTP.",
              },
              {
                name: "fastify",
                message: "Schema files cannot import HTTP.",
              },
              {
                name: "http",
                message: "Schema files cannot import HTTP.",
              },
              {
                name: "https",
                message: "Schema files cannot import HTTP.",
              },
              {
                name: "node:http",
                message: "Schema files cannot import HTTP.",
              },
              {
                name: "node:https",
                message: "Schema files cannot import HTTP.",
              },
            ],
            patterns: [
              {
                group: [
                  "*.request",
                  "*.request.ts",
                  "**/*.request",
                  "**/*.request.ts",
                  "*.response",
                  "*.response.ts",
                  "**/*.response",
                  "**/*.response.ts",
                ],
                message: "Schema files cannot import Zod HTTP DTOs.",
              },
              {
                group: ["**/presentation/**"],
                message: "Schema files cannot import presentation.",
              },
              {
                group: ["*.mapper", "*.mapper.ts", "**/*.mapper", "**/*.mapper.ts"],
                message: "Schema files cannot import the sibling mapper.",
              },
              {
                group: ["@nestjs", "@nestjs/*"],
                message: "Schema files cannot import HTTP.",
              },
            ],
          },
        ],
      },
    },
    {
      files: ["**/*.request.ts", "**/*.response.ts"],
      rules: {
        "no-restricted-imports": [
          "error",
          {
            paths: [
              {
                name: "drizzle-orm",
                message: "REST request and response files cannot import drizzle-orm.",
              },
              {
                name: "postgres",
                message: "REST request and response files cannot import postgres.",
              },
            ],
            patterns: [
              {
                group: ["drizzle-orm/*"],
                message: "REST request and response files cannot import drizzle-orm.",
              },
              {
                group: ["postgres/*"],
                message: "REST request and response files cannot import postgres.",
              },
            ],
          },
        ],
      },
    },
  ],
});
