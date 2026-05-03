/**
 * Vitest config for the Pi adapter test project.
 *
 * @see docs/specs/420-dx-testing/spec.md [FR-1] [FR-4]
 * @see docs/specs/420-dx-testing/design.md [DES-DX-TESTING-RUNNER-ISOLATION]
 */
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "agent-pi",
    environment: "node",
    passWithNoTests: true,
    include: ["src/**/*.{test,spec}.ts"],
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.{test,spec}.ts", "src/index.ts"],
      reporter: ["text", "lcov", "html"],
    },
  },
});
