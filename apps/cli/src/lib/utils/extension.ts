// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

import path from "path"
import fs from "fs"

/**
 * Get the default path to the extension bundle.
 * This assumes the CLI is installed alongside the built extension.
 *
 * @param dirname - The __dirname equivalent for the calling module
 */
export function getDefaultExtensionPath(dirname: string): string {
	// Check for environment variable first (set by install script)
	if (process.env.ROO_EXTENSION_PATH) {
		const envPath = process.env.ROO_EXTENSION_PATH

		if (fs.existsSync(path.join(envPath, "extension.js"))) {
			return envPath
		}
	}

	// Find the CLI package root (apps/cli) by walking up to the nearest package.json.
	// This works whether called from dist/ (bundled) or src/commands/cli/ (tsx dev).
	let packageRoot = dirname

	while (packageRoot !== path.dirname(packageRoot)) {
		if (fs.existsSync(path.join(packageRoot, "package.json"))) {
			break
		}

		packageRoot = path.dirname(packageRoot)
	}

	// The extension is at ../../apps/vscode/dist relative to apps/cli
	const monorepoPath = path.resolve(packageRoot, "../../apps/vscode/dist")

	if (fs.existsSync(path.join(monorepoPath, "extension.js"))) {
		return monorepoPath
	}

	// Fallback: when installed via curl script, extension is at apps/cli/extension
	const packagePath = path.resolve(packageRoot, "extension")
	return packagePath
}
