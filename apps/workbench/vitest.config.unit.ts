/**
 * Vitest config for apps/workbench — React component unit tests (jsdom).
 *
 * @see docs/specs/420-dx-testing/spec.md [FR-1] [NFR-1]
 * @see docs/specs/227-app-workbench-shell/design.md [DES-TEST]
 */
import { resolve } from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: "@", replacement: resolve(__dirname, "src") },
      {
        find: "@afx/shared",
        replacement: resolve(__dirname, "../../packages/shared/src/index.ts"),
      },
      { find: "@afx/ui", replacement: resolve(__dirname, "../../packages/ui/src") },
    ],
  },
  test: {
    name: "workbench",
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules/**", "dist/**"],
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.{test,spec}.{ts,tsx}", "src/main.tsx", "src/**/*.d.ts"],
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
