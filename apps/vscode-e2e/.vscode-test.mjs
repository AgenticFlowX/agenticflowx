// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

/**
 * See: https://code.visualstudio.com/api/working-with-extensions/testing-extension
 */

import { defineConfig } from "@vscode/test-cli"

export default defineConfig({
	label: "integrationTest",
	files: "out/suite/**/*.test.js",
	workspaceFolder: ".",
	mocha: {
		ui: "tdd",
		timeout: 60000,
	},
	launchArgs: ["--enable-proposed-api=agenticflowx.agenticflowx", "--disable-extensions"],
})
