// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

import { ExtensionContext } from "vscode"
import { getSettingsDirectoryPath } from "./storage"

export async function ensureSettingsDirectoryExists(context: ExtensionContext): Promise<string> {
	// getSettingsDirectoryPath already handles the custom storage path setting
	return await getSettingsDirectoryPath(context.globalStorageUri.fsPath)
}
