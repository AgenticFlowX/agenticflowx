// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * suggest_see_link action — shows VS Code notification suggesting @see annotation
 * when a new .ts file is created in src/.
 *
 * @see docs/specs/vscode-agenticflowx-hook-engine/design.md#hook-actions
 */

import * as vscode from "vscode"

export function executeSuggestSeeLink(filePath: string): void {
	if (!filePath.includes("/src/") || !filePath.endsWith(".ts")) return

	const fileName = filePath.split("/").pop() ?? filePath

	vscode.window
		.showInformationMessage(`AFX: Add @see traceability to ${fileName}?`, "Add @see Link")
		.then((action) => {
			if (action === "Add @see Link") {
				vscode.commands.executeCommand("agenticflowx.afxAddSeeLink")
			}
		})
}
