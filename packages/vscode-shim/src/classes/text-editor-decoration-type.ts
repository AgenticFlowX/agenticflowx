// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

/**
 * TextEditorDecorationType class for VSCode API
 */

import type { Disposable } from "../interfaces/workspace.js"

/**
 * Text editor decoration type mock for CLI mode
 */
export class TextEditorDecorationType implements Disposable {
	public key: string

	constructor(key: string) {
		this.key = key
	}

	dispose(): void {
		// No-op for CLI
	}
}
