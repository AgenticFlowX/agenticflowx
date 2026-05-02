/**
 * @vscode/test-cli configuration.
 * Launches the Extension Development Host, runs compiled tests from out/.
 *
 * @see docs/specs/420-dx-testing/spec.md [FR-3]
 * @see docs/specs/420-dx-testing/design.md [DES-ARCH] [DES-TEST]
 */
import { defineConfig } from "@vscode/test-cli";

export default defineConfig({
  files: "out/**/*.test.js",
  workspaceFolder: "../..",
  extensionDevelopmentPath: "../vscode",
  mocha: {
    timeout: 20_000,
  },
});
