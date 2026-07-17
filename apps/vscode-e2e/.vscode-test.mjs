/**
 * @vscode/test-cli configuration.
 * Launches the Extension Development Host, runs compiled tests from out/.
 *
 * @see docs/specs/420-dx-testing/spec.md [FR-3]
 * @see docs/specs/420-dx-testing/design.md [DES-ARCH] [DES-TEST]
 */
import process from "node:process";

import { defineConfig } from "@vscode/test-cli";

const extensionDevelopmentPath = process.env.AFX_VSCODE_E2E_EXTENSION_PATH?.trim() || "../vscode";

export default defineConfig({
  version: "1.105.0",
  files: "out/**/*.test.js",
  workspaceFolder: "../..",
  extensionDevelopmentPath,
  mocha: {
    timeout: 20_000,
  },
});
