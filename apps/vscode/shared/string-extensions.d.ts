// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

/**
 * Global string extensions declaration.
 * This file provides type declarations for String.prototype extensions
 * that are used across the codebase.
 *
 * The actual implementation is in src/utils/path.ts.
 *
 * This separate declaration file is necessary because the webview package
 * includes ../src/shared in its tsconfig.json but not ../src/utils/path.ts.
 * Without this file, the webview compilation would fail when processing
 * files that use the toPosix() method.
 */
declare global {
	interface String {
		/**
		 * Convert a path string to POSIX format (forward slashes).
		 * Extended-Length Paths in Windows (\\?\) are preserved.
		 * @returns The path with backslashes converted to forward slashes
		 */
		toPosix(): string
	}
}

// This export is needed to make this file a module
export {}
