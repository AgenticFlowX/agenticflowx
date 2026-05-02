/**
 * Vitest config for @afx/ui — runs the package's unit tests (cn helper, hooks).
 * Coverage filtering for the merged workspace report lives in the root vitest.config.ts.
 *
 * @see docs/specs/420-dx-testing/spec.md [FR-1]
 * @see docs/specs/420-dx-testing/design.md [DES-ARCH]
 */
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    name: "ui",
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    setupFiles: ["./vitest.setup.ts"],
  },
});
