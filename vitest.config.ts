/**
 * Root Vitest config — global coverage settings for workspace mode.
 * Project discovery is handled by vitest.workspace.ts.
 *
 * @see docs/specs/420-dx-testing/spec.md [FR-1] [FR-4]
 * @see docs/specs/420-dx-testing/design.md [DES-DX-TESTING-RUNNER-ISOLATION]
 */
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      exclude: [
        "**/packages/ui/**",
        "**/node_modules/**",
        "**/dist/**",
        "**/out/**",
        "**/.vscode-test/**",
        "**/*.config.{ts,mjs,js}",
        "**/*.setup.{ts,js}",
        "**/*.d.ts",
      ],
    },
  },
});
