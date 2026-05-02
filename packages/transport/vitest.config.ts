/**
 * Vitest config for packages/transport — pure Node unit tests (no DOM needed).
 *
 * @see docs/specs/420-dx-testing/spec.md [FR-1]
 * @see docs/specs/430-dx-enforcement/430-dx-enforcement.md [FR-13] [FR-14] [DES-TEST]
 */
import { resolve } from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: [{ find: "@afx/shared", replacement: resolve(__dirname, "../shared/src/index.ts") }],
  },
  test: {
    name: "transport",
    environment: "node",
    globals: true,
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.{test,spec}.ts",
        "src/**/*.d.ts",
        "src/index.ts",
        // Webview-only adapter — requires `acquireVsCodeApi` global, untestable in node.
        "src/vscode.ts",
        // Type-only declarations.
        "src/types.ts",
      ],
      reporter: ["text", "lcov"],
      thresholds: {
        statements: 60,
        branches: 60,
        functions: 39,
        lines: 60,
      },
    },
  },
});
