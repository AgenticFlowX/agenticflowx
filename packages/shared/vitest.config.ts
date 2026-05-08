/**
 * @see docs/specs/420-dx-testing/spec.md [FR-1] [NFR-1]
 * @see docs/specs/100-package-shared/design.md [DES-OVR]
 */
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "shared",
    environment: "node",
    include: ["src/**/*.{test,spec}.ts"],
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.{test,spec}.ts",
        "src/index.ts",
        // These files contain only type re-exports; tested via integration.
        "src/messages.ts",
        "src/types.ts",
        "src/workbench-protocol.ts",
        "src/workbench-types.ts",
        "src/custom-providers/index.ts",
        "src/custom-providers/types.ts",
        "src/custom-providers/harness-adapter.ts",
      ],
      reporter: ["text", "lcov", "html"],
      thresholds: {
        statements: 95,
        branches: 80,
        functions: 95,
        lines: 95,
      },
    },
  },
});
