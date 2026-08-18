/**
 * Vitest configuration.
 *
 * Phase 6 work — establishes the test runner that subsequent phases
 * (PR 6+) reuse for pure-function and schema unit tests. The runner is
 * intentionally minimal:
 *
 *   - `environment: "node"` — every unit target (the platform helpers,
 *     the reminder helpers, the Zod schemas) is a pure Node module; no
 *     DOM, no jsdom. Server-side Zod schemas are validated without a
 *     browser context.
 *
 *   - Path alias — the project uses `@/lib/...` from `tsconfig.json`; we
 *     mirror that here so test imports match source imports exactly
 *     (`import { ... } from "@/lib/platforms/infer"`).
 *
 *   - Excludes — `.next/`, `node_modules/`, the generated
 *     `database.types.ts` stub. The Vitest glob also extends `tests/` for
 *     any standalone fixtures.
 */
import { defineConfig } from "vitest/config";
import path from "node:path";

const r = (relative: string) => path.resolve(__dirname, relative);

export default defineConfig({
  test: {
    environment: "node",
    include: [
      "tests/**/*.test.ts",
      "src/**/*.test.ts",
    ],
    exclude: [
      "node_modules",
      ".next",
      "out",
      "build",
      "coverage",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      include: [
        "src/lib/**/*.ts",
      ],
      exclude: [
        "src/lib/supabase/database.types.ts",
        "src/lib/**/index.ts",
        "src/lib/**/*.d.ts",
      ],
      thresholds: {
        // Mirror the README's smoke-check discipline: every pure helper
        // is exercised. The hash-based thresholds are conservative for
        // the 6.3 seed and grow as more helpers gain test coverage.
        lines: 70,
        functions: 70,
        branches: 55,
        statements: 70,
      },
    },
  },
  resolve: {
    alias: {
      "@": r("./src"),
    },
  },
});
