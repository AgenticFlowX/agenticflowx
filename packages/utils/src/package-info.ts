// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * Package identity constants.
 * In the extension, these are overridden by esbuild defines from package.json.
 * In the package, sensible defaults are used.
 */
export const Package = {
	publisher: "agenticflowx",
	name: process.env.PKG_NAME || "agenticflowx",
	version: process.env.PKG_VERSION || "0.0.0",
	outputChannel: process.env.PKG_OUTPUT_CHANNEL || "AgenticFlowX",
	sha: process.env.PKG_SHA,
} as const
