// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * Spec Definition Provider — Cmd+click on @see annotations
 * navigates to the spec heading.
 *
 * @see docs/specs/18-vscode-agenticflowx-ide-providers/design.md [DES-NAVIGATION]
 */

import * as path from "path"
import * as vscode from "vscode"
import { readFile } from "fs/promises"

export function createSpecDefinitionProvider(getRoot: () => string): vscode.DefinitionProvider {
	return {
		async provideDefinition(
			document: vscode.TextDocument,
			position: vscode.Position,
		): Promise<vscode.Location | undefined> {
			const line = document.lineAt(position).text

			// Match @see in JSDoc: handle leading " * " prefix
			const seeMatch = /@see\s+(docs\/specs\/[^\s,)]+)/g

			for (const match of line.matchAll(seeMatch)) {
				const matchStart = match.index ?? 0
				const matchEnd = matchStart + match[0].length
				if (position.character < matchStart || position.character > matchEnd) continue

				const target = match[1]
				const [filePart, anchor] = target.split("#")
				const root = getRoot()
				const absPath = path.join(root, filePart)

				try {
					const content = await readFile(absPath, "utf-8")
					const targetLine = anchor ? findHeadingLine(content, anchor) : 0

					const uri = vscode.Uri.file(absPath)
					return new vscode.Location(uri, new vscode.Position(targetLine, 0))
				} catch {
					// File doesn't exist — ghost reference
					return undefined
				}
			}

			return undefined
		},
	}
}

function findHeadingLine(content: string, anchor: string): number {
	const slug = anchor.toLowerCase().replace(/[^\w-]/g, "")
	const lines = content.split("\n")

	// Exact match first
	for (let i = 0; i < lines.length; i++) {
		const headingMatch = /^#{1,6}\s+(.+)$/.exec(lines[i])
		if (headingMatch) {
			const headingSlug = headingMatch[1]
				.toLowerCase()
				.replace(/[^\w\s-]/g, "")
				.replace(/\s+/g, "-")
			if (headingSlug === slug || headingSlug.includes(slug)) return i
		}
	}

	// Levenshtein fallback — find closest heading
	let bestLine = 0
	let bestDist = Infinity
	for (let i = 0; i < lines.length; i++) {
		const headingMatch = /^#{1,6}\s+(.+)$/.exec(lines[i])
		if (headingMatch) {
			const headingSlug = headingMatch[1]
				.toLowerCase()
				.replace(/[^\w\s-]/g, "")
				.replace(/\s+/g, "-")
			const dist = levenshtein(slug, headingSlug)
			if (dist < bestDist) {
				bestDist = dist
				bestLine = i
			}
		}
	}

	return bestLine
}

function levenshtein(a: string, b: string): number {
	const m = a.length
	const n = b.length
	const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))
	for (let i = 0; i <= m; i++) dp[i][0] = i
	for (let j = 0; j <= n; j++) dp[0][j] = j
	for (let i = 1; i <= m; i++) {
		for (let j = 1; j <= n; j++) {
			dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
		}
	}
	return dp[m][n]
}
