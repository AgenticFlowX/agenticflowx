/**
 * Vitest config for the bundled Pi API-provider adapter test project.
 *
 * @see docs/specs/420-dx-testing/spec.md [FR-1] [FR-4]
 * @see docs/specs/420-dx-testing/design.md [DES-ARCH]
 */
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "agent-pi-sdk",
    environment: "node",
    passWithNoTests: true,
    include: ["src/**/*.{test,spec}.ts", "bootstrap/**/*.{test,spec}.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts", "bootstrap/**/*.ts"],
      exclude: ["src/**/*.{test,spec}.ts", "bootstrap/**/*.{test,spec}.ts", "src/index.ts"],
      reporter: ["text", "lcov", "html"],
    },
  },
});
