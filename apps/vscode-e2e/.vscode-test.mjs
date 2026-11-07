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
  version: process.env.AFX_VSCODE_E2E_VERSION?.trim() || "1.105.0",
  files: process.env.AFX_BLUEPRINT_RESTART_PHASE
    ? "out/blueprint-restart.test.js"
    : "out/**/*.test.js",
  workspaceFolder: process.env.AFX_BLUEPRINT_RESTART_SOURCE || "../..",
  extensionDevelopmentPath,
  launchArgs: [
    ...(process.env.AFX_BLUEPRINT_RESTART_PHASE ? ["--disable-workspace-trust"] : []),
    `--user-data-dir=${process.env.AFX_BLUEPRINT_RESTART_PROFILE || `/tmp/afx-vscode-e2e-${process.pid}`}`,
    `--extensions-dir=/tmp/afx-vscode-e2e-extensions-${process.pid}`,
  ],
  mocha: {
    timeout: 20_000,
  },
});
