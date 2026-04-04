// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * FIXME: DocumentLinkProvider not working — links appear (blue on Cmd+hover) but
 * click does not navigate. Suspected TypeScript Language Service intercepting Cmd+click.
 * See docs/research/res-phase4-deep-integration.md "Clickable @see Parts" section for
 * investigation steps.
 *
 * @see docs/specs/vscode-agenticflowx-ide-providers/design.md#navigation
 */

import * as path from "path"
import * as vscode from "vscode"

export function createSeeDocumentLinkProvider(getRoot: () => string): vscode.DocumentLinkProvider {
	return {
		provideDocumentLinks(document: vscode.TextDocument): vscode.DocumentLink[] {
			const links: vscode.DocumentLink[] = []
			const root = getRoot()
			if (!root) return links

			for (let i = 0; i < document.lineCount; i++) {
				const lineText = document.lineAt(i).text
				const seeRegex = /@(?:see|trace\s+\w+:)\s+(docs\/specs\/[^\s,)]+)/g

				for (const match of lineText.matchAll(seeRegex)) {
					const target = match[1]
					const startCol = (match.index ?? 0) + match[0].indexOf(target)
					const endCol = startCol + target.length
					const range = new vscode.Range(i, startCol, i, endCol)

					const [filePart] = target.split("#")
					const absPath = path.join(root, filePart)

					// Simple file URI — no fragment, no anchor resolution
					// Just open the file. Anchor navigation handled by DefinitionProvider.
					const link = new vscode.DocumentLink(range, vscode.Uri.file(absPath))
					link.tooltip = `Open ${path.basename(filePart)}`
					links.push(link)
				}
			}

			return links
		},
	}
}
