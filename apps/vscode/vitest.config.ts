/**
 * Vitest config for the VSCode extension host.
 *
 * Uses a mocked `vscode` module via `resolve.alias` so unit tests run in plain
 * Node without launching VSCode. Real-VSCode coverage lives in
 * `apps/vscode-e2e` (`@vscode/test-electron`).
 *
 * After Phase 3 file move (see docs/specs/430-dx-enforcement/430-dx-enforcement.md [FR-5] [FR-6]),
 * tests are colocated with source as `*.test.ts`; fixtures live under `src/__fixtures__/`.
 *
 * @see docs/specs/420-dx-testing/spec.md [FR-1] [NFR-1]
 * @see docs/specs/200-app-vscode/design.md [DES-TEST]
 * @see docs/specs/430-dx-enforcement/430-dx-enforcement.md [FR-5] [FR-6] [DES-NAMING]
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      vscode: path.resolve(here, "__mocks__/vscode.ts"),
    },
  },
  test: {
    name: "vscode",
    environment: "node",
    globals: true,
    include: ["src/**/*.test.ts"],
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/__fixtures__/**", "src/**/*.d.ts"],
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
