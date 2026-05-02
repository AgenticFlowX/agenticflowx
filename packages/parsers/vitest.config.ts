/**
 * @see docs/specs/420-dx-testing/spec.md [FR-1] [NFR-1]
 * @see docs/specs/120-package-parsers/design.md [DES-TEST]
 */
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "parsers",
    environment: "node",
    include: ["src/**/*.{test,spec}.ts"],
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.{test,spec}.ts", "src/index.ts"],
      reporter: ["text", "lcov", "html"],
      thresholds: {
        statements: 70,
        branches: 70,
        functions: 70,
        lines: 70,
      },
    },
  },
});
