// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

import type { AfxSayTool } from "@agenticflowx/types"

export function isWriteToolAction(tool: AfxSayTool): boolean {
	return ["editedExistingFile", "appliedDiff", "newFileCreated"].includes(tool.tool)
}

export function isReadOnlyToolAction(tool: AfxSayTool): boolean {
	return [
		"readFile",
		"listFiles",
		"listFilesTopLevel",
		"listFilesRecursive",
		"searchFiles",
		"codebaseSearch",
		"runSlashCommand",
	].includes(tool.tool)
}
