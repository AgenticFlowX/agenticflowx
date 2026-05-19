/**
 * Vitest workspace config — references all packages with test coverage.
 *
 * @see docs/specs/420-dx-testing/spec.md [FR-1] [FR-4]
 * @see docs/specs/420-dx-testing/design.md [DES-DX-TESTING-RUNNER-ISOLATION]
 * @see docs/specs/430-dx-enforcement/430-dx-enforcement.md [FR-5] [FR-6] [DES-NAMING]
 */
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      "packages/shared/vitest.config.ts",
      "packages/agent/pi/vitest.config.ts",
      "packages/agent/pi-sdk/vitest.config.ts",
      "packages/parsers/vitest.config.ts",
      "packages/transport/vitest.config.ts",
      "packages/ui/vitest.config.ts",
      "apps/vscode/vitest.config.ts",
      "apps/chat/vitest.config.unit.ts",
      "apps/workbench/vitest.config.unit.ts",
      "scripts/conventions/vitest.config.ts",
    ],
  },
});
