// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * Content search for the Documents tab home pane.
 *
 * No external ripgrep dependency — walks the `docs/**` tree with
 * `vscode.workspace.findFiles`, reads each file in parallel, and matches
 * the query in-memory. Fast enough for workspaces up to a few thousand
 * docs; if it ever becomes a bottleneck we can swap in `@vscode/ripgrep`
 * without changing the IPC contract.
 *
 * @see docs/specs/bottom-panel-enhancements/bottom-panel-enhancements.md [FR-13] [DES-IPC]
 */

import * as path from "path"
import * as vscode from "vscode"
import { readFile } from "fs/promises"
import matter from "gray-matter"

const DEFAULT_SCOPE = ["md", "mdx", "txt", "csv"]
const MAX_FILE_HITS = 200
const SNIPPETS_PER_FILE = 3
const SNIPPET_WINDOW = 60 // chars on each side of the match

export interface DocsSearchMatch {
	line: number
	snippet: string
	ranges: Array<[start: number, end: number]>
}

export interface DocsSearchHit {
	filePath: string
	type: string
	matches: DocsSearchMatch[]
}

export async function runDocsSearch(
	root: string,
	rawQuery: string,
	scope: string[] = DEFAULT_SCOPE,
): Promise<DocsSearchHit[]> {
	const query = rawQuery.trim()
	if (!query) return []

	const globExts = scope.join(",")
	const pattern = new vscode.RelativePattern(root, `docs/**/*.{${globExts}}`)
	const uris = await vscode.workspace.findFiles(pattern, "**/node_modules/**", 2000)

	const needle = query.toLowerCase()
	const hits: DocsSearchHit[] = []

	await Promise.all(
		uris.map(async (uri) => {
			try {
				const content = await readFile(uri.fsPath, "utf-8")
				const body = stripFrontmatter(content)
				const lines = body.split(/\r?\n/)
				const matches: DocsSearchMatch[] = []
				for (let i = 0; i < lines.length && matches.length < SNIPPETS_PER_FILE; i++) {
					const line = lines[i]
					const lower = line.toLowerCase()
					let from = 0
					const ranges: Array<[number, number]> = []
					while (true) {
						const idx = lower.indexOf(needle, from)
						if (idx < 0) break
						ranges.push([idx, idx + needle.length])
						from = idx + needle.length
					}
					if (ranges.length === 0) continue
					const first = ranges[0][0]
					const snipStart = Math.max(0, first - SNIPPET_WINDOW)
					const snipEnd = Math.min(line.length, first + needle.length + SNIPPET_WINDOW)
					const snippet = line.slice(snipStart, snipEnd)
					const shifted: Array<[number, number]> = ranges
						.filter(([s, e]) => s >= snipStart && e <= snipEnd)
						.map(([s, e]) => [s - snipStart, e - snipStart] as [number, number])
					matches.push({
						line: i + 1,
						snippet,
						ranges: shifted,
					})
				}
				if (matches.length > 0) {
					hits.push({
						filePath: uri.fsPath,
						type: inferType(content),
						matches,
					})
				}
			} catch {
				// skip unreadable files
			}
		}),
	)

	// Sort: most matches first, then by name.
	hits.sort((a, b) => {
		const ma = a.matches.length
		const mb = b.matches.length
		if (ma !== mb) return mb - ma
		return path.basename(a.filePath).localeCompare(path.basename(b.filePath))
	})

	return hits.slice(0, MAX_FILE_HITS)
}

function stripFrontmatter(content: string): string {
	try {
		return matter(content).content
	} catch {
		return content
	}
}

function inferType(content: string): string {
	try {
		const data = matter(content).data as Record<string, unknown>
		if (typeof data.type === "string") return data.type
	} catch {
		// ignore
	}
	return ""
}
