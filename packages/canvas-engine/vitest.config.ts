/**
 * Canvas engine unit tests — pure reducers/parsers, node environment.
 *
 * @see docs/specs/229-app-workbench-canvas/design.md [DES-DATA]
 * @see docs/specs/420-dx-testing/spec.md [FR-1] [FR-4]
 */
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "canvas-engine",
    environment: "node",
    globals: false,
    include: ["src/**/*.test.ts"],
  },
});
