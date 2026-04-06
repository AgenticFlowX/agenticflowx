// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * Spec Diagnostics Provider — shows orphan and ghost warnings in Problems panel.
 *
 * - Warning: exported function without @see annotation (orphaned)
 * - Error: @see target file doesn't exist (ghost)
 * - Error: @see target heading doesn't exist (ghost section)
 *
 * @see docs/specs/18-vscode-agenticflowx-ide-providers/design.md#diagnostics-and-decorations
 */

import * as path from "path"
import * as vscode from "vscode"
import { access, readFile } from "fs/promises"

const DEBOUNCE_MS = 1000
const COLLECTION_NAME = "AFX Traceability"

export function createSpecDiagnosticsProvider(
	getRoot: () => string,
	languages: string[],
): { collection: vscode.DiagnosticCollection; disposables: vscode.Disposable[] } {
	const collection = vscode.languages.createDiagnosticCollection(COLLECTION_NAME)
	const disposables: vscode.Disposable[] = [collection]
	let debounceTimer: ReturnType<typeof setTimeout> | undefined

	function scheduleUpdate(document: vscode.TextDocument) {
		// Only check source files in configured languages
		if (!languages.includes(document.languageId)) return
		const filePath = document.uri.fsPath
		// Skip non-src directories
		if (filePath.includes("node_modules") || filePath.includes("/dist/") || filePath.includes("/.git/")) return
		if (!filePath.includes("/src/")) return

		if (debounceTimer) clearTimeout(debounceTimer)
		debounceTimer = setTimeout(() => updateDiagnostics(document, collection, getRoot()), DEBOUNCE_MS)
	}

	disposables.push(
		vscode.workspace.onDidSaveTextDocument(scheduleUpdate),
		vscode.workspace.onDidOpenTextDocument(scheduleUpdate),
	)

	return { collection, disposables }
}

async function updateDiagnostics(
	document: vscode.TextDocument,
	collection: vscode.DiagnosticCollection,
	root: string,
): Promise<void> {
	const diagnostics: vscode.Diagnostic[] = []
	const text = document.getText()
	const lines = text.split("\n")

	// Check @see links for ghost references
	for (let i = 0; i < lines.length; i++) {
		const seeMatches = lines[i].matchAll(/@see\s+(docs\/specs\/[^\s]+)/g)
		for (const match of seeMatches) {
			const target = match[1]
			const [filePart, anchor] = target.split("#")
			const absPath = path.join(root, filePart)

			try {
				await access(absPath)
				// File exists — check anchor if provided
				if (anchor) {
					const content = await readFile(absPath, "utf-8")
					if (!headingExists(content, anchor)) {
						const col = (match.index ?? 0) + "@see ".length
						const range = new vscode.Range(i, col, i, col + target.length)
						diagnostics.push(
							new vscode.Diagnostic(
								range,
								`AFX: ghost reference — section "${anchor}" not found in ${filePart}`,
								vscode.DiagnosticSeverity.Error,
							),
						)
					}
				}
			} catch {
				const col = (match.index ?? 0) + "@see ".length
				const range = new vscode.Range(i, col, i, col + target.length)
				diagnostics.push(
					new vscode.Diagnostic(
						range,
						`AFX: ghost reference — file not found: ${filePart}`,
						vscode.DiagnosticSeverity.Error,
					),
				)
			}
		}
	}

	// Check exported symbols for orphaned (no @see in preceding JSDoc)
	const exportRegex = /^export\s+(?:async\s+)?(?:function|class|const|interface|type)\s+(\w+)/
	for (let i = 0; i < lines.length; i++) {
		const exportMatch = exportRegex.exec(lines[i])
		if (!exportMatch) continue

		// Look back up to 10 lines for @see in a JSDoc block
		let hasSee = false
		for (let j = i - 1; j >= Math.max(0, i - 10); j--) {
			if (lines[j].includes("@see docs/specs/")) {
				hasSee = true
				break
			}
			// Stop if we hit a non-comment, non-blank line
			const trimmed = lines[j].trim()
			if (
				trimmed &&
				!trimmed.startsWith("*") &&
				!trimmed.startsWith("//") &&
				!trimmed.startsWith("/**") &&
				!trimmed.startsWith("*/")
			) {
				break
			}
		}

		if (!hasSee) {
			const range = new vscode.Range(i, 0, i, lines[i].length)
			diagnostics.push(
				new vscode.Diagnostic(
					range,
					`AFX: orphaned ${exportMatch[1]} — no @see annotation linking to spec`,
					vscode.DiagnosticSeverity.Warning,
				),
			)
		}
	}

	collection.set(document.uri, diagnostics.length > 0 ? diagnostics : undefined)
}

function headingExists(content: string, anchor: string): boolean {
	const slug = anchor.toLowerCase().replace(/[^\w-]/g, "")
	for (const line of content.split("\n")) {
		const match = /^#{1,6}\s+(.+)$/.exec(line)
		if (match) {
			const headingSlug = match[1]
				.toLowerCase()
				.replace(/[^\w\s-]/g, "")
				.replace(/\s+/g, "-")
			if (headingSlug === slug || headingSlug.includes(slug)) return true
		}
	}
	return false
}
