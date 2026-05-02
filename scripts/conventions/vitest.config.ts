/**
 * Vitest config for tree-shape conventions (naming-guard, no-__tests__, etc.).
 * Runs as part of the workspace; also invokable directly via `pnpm test:naming-guard`.
 *
 * @see docs/specs/430-dx-enforcement/430-dx-enforcement.md [FR-5] [FR-6] [DES-NAMING]
 */
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "conventions",
    environment: "node",
    globals: true,
    include: ["**/*.test.ts"],
  },
});
