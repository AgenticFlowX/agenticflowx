/**
 * Vitest config for apps/chat — React component unit tests (jsdom).
 *
 * Named `vitest.config.unit.ts` to avoid collision with the Vite dev-server
 * config; Playwright E2E lives at apps/chat/playwright.config.ts (`.spec.ts` only).
 *
 * After Phase 3 file move (see docs/specs/430-dx-enforcement/430-dx-enforcement.md [FR-5] [FR-6]),
 * unit tests are colocated with source as `*.test.ts(x)` — no `__tests__/` dir.
 *
 * @see docs/specs/420-dx-testing/spec.md [FR-1] [NFR-1]
 * @see docs/specs/210-app-chat/design.md [DES-TEST]
 * @see docs/specs/430-dx-enforcement/430-dx-enforcement.md [FR-5] [FR-6] [DES-NAMING]
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
        find: "@afx/transport",
        replacement: resolve(__dirname, "../../packages/transport/src/index.ts"),
      },
      {
        find: "@afx/shared",
        replacement: resolve(__dirname, "../../packages/shared/src/index.ts"),
      },
    ],
  },
  test: {
    name: "chat",
    environment: "jsdom",
    execArgv: ["--no-experimental-webstorage"],
    environmentOptions: {
      jsdom: {
        url: "http://localhost/",
      },
    },
    globals: true,
    include: ["src/**/*.test.{ts,tsx}"],
    exclude: ["e2e/**", "node_modules/**", "dist/**"],
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.test.{ts,tsx}", "src/__fixtures__/**", "src/main.tsx", "src/**/*.d.ts"],
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
