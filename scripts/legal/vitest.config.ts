/**
 * Focused tests for deterministic notice generation and VSIX legal gates.
 *
 * @see docs/specs/430-dx-enforcement/430-dx-enforcement.md [FR-18] [DES-SUPPLY]
 */
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "legal",
    environment: "node",
    globals: true,
    include: ["**/*.test.ts"],
  },
});
