// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * Hover provider — shows rich spec section preview when hovering over @see annotations.
 * Supports any `@see docs/**\/*.md` path (specs, ADRs, research).
 * Full markdown rendering (tables, code blocks, lists), scrollable content,
 * action links (Open in Editor, Open Preview, Open Split).
 *
 * Note: @see links below are for developer reference (AFX traceability standard).
 * The spec/design docs live in the afx-project workspace, not shipped with the extension.
 *
 * @see docs/specs/20-vscode-agenticflowx-spec-hover/spec.md [FR-1]
 * @see docs/specs/20-vscode-agenticflowx-spec-hover/design.md [DES-ARCH]
 */

import * as vscode from "vscode"
import * as path from "path"
import { readFile } from "fs/promises"
import type { Feature } from "../models/feature"

// Matches any @see docs/ path — specs, ADRs, research, any markdown file.
// Group 1: full relative path (docs/...)
// Group 2: section anchor (optional, after #)
const SEE_HOVER_PATTERN = /@see\s+(docs\/[a-z0-9_/.+-]+\.md(?:#([a-z0-9._-]+))?)/i

// Extract feature name from spec paths like docs/specs/{feature}/doc.md
const SPEC_FEATURE_PATTERN = /^docs\/specs\/([a-z0-9-]+)\//i

interface ExtractResult {
	content: string
	lineNumber: number
	found: boolean
}

interface PreviewResult {
	content: string
	truncated: boolean
}

export function createSpecHoverProvider(
	getFeatures: () => Promise<Feature[]>,
	getRoot: () => string,
): vscode.HoverProvider {
	return {
		async provideHover(
			document: vscode.TextDocument,
			position: vscode.Position,
		): Promise<vscode.Hover | undefined> {
			const line = document.lineAt(position.line)
			const match = SEE_HOVER_PATTERN.exec(line.text)
			if (!match) return undefined

			// Check cursor is within the @see reference
			const startIdx = line.text.indexOf(match[0])
			const endIdx = startIdx + match[0].length
			if (position.character < startIdx || position.character > endIdx) return undefined

			const fullPath = match[1].split("#")[0] // path without anchor
			const section = match[2] // anchor (optional)
			const root = getRoot()
			const absPath = path.join(root, fullPath)

			// Derive display name and doc type from path
			const fileName = path.basename(fullPath)
			const dirName = path.basename(path.dirname(fullPath))
			const displayName = `${dirName} / ${fileName}`

			// Try to match to a spec feature for rich metadata
			const specMatch = SPEC_FEATURE_PATTERN.exec(fullPath)
			const featureName = specMatch?.[1]
			const features = await getFeatures()
			const feature = featureName ? features.find((f) => f.name === featureName) : undefined
			const isSpecFile = !!specMatch

			let sectionContent = ""
			let sectionLine = 0
			let truncated = false
			let fileNotFound = false
			let sectionNotFound = false

			try {
				const content = await readFile(absPath, "utf-8")
				if (section) {
					const result = extractSection(content, section)
					sectionContent = result.content
					sectionLine = result.lineNumber
					sectionNotFound = !result.found
				} else {
					const result = getPreview(content)
					sectionContent = result.content
					truncated = result.truncated
				}
			} catch {
				fileNotFound = true
			}

			const md = new vscode.MarkdownString()
			md.isTrusted = true
			md.supportHtml = true
			md.supportThemeIcons = true

			// --- Error states: clean AFX error message ---
			if (fileNotFound) {
				md.appendMarkdown(`**AgenticFlowX** — ghost reference\n\n---\n\n`)
				md.appendMarkdown(`File not found: \`${fullPath}\`\n\n`)
				md.appendMarkdown(`*Check the path in your \`@see\` annotation.*`)
				return new vscode.Hover(md)
			}

			if (sectionNotFound) {
				md.appendMarkdown(`**AgenticFlowX** — ghost reference\n\n---\n\n`)
				md.appendMarkdown(`Section \`#${section}\` not found in \`${fullPath}\`\n\n`)

				const fileArgs = encodeURIComponent(JSON.stringify([vscode.Uri.file(absPath)]))
				md.appendMarkdown(
					`[Open in Editor](command:vscode.open?${fileArgs}) · ` +
						`[Open Preview](command:markdown.showPreview?${fileArgs})`,
				)
				return new vscode.Hover(md)
			}

			// Convert mermaid blocks to text (VS Code hover can't execute JS)
			sectionContent = convertMermaidBlocks(sectionContent)

			// --- Rich metadata header ---
			if (isSpecFile && feature) {
				const meta = getFeatureMeta(feature, fileName)
				md.appendMarkdown(`**${featureName} / ${fileName}** · \`${meta.status}\``)
				if (meta.version) md.appendMarkdown(` · v${meta.version}`)
				if (meta.owner) md.appendMarkdown(` · ${meta.owner}`)
				md.appendMarkdown("\n\n")
				if (meta.lastVerified) {
					md.appendMarkdown(`*Last verified: ${meta.lastVerified}*\n\n`)
				}

				// Task completion stats (tasks.md only)
				if (fileName === "tasks.md" && feature.taskStats) {
					const { total, completed } = feature.taskStats
					if (total > 0) {
						const pct = Math.round((completed / total) * 100)
						md.appendMarkdown(`*${completed}/${total} tasks complete (${pct}%)*\n\n`)
					}
				}
			} else {
				// Non-spec file (ADR, research, etc.) — simple header
				md.appendMarkdown(`**${displayName}**\n\n`)
			}

			md.appendMarkdown("---\n\n")

			// --- Section content (full markdown, scrollable) ---
			md.appendMarkdown(sectionContent)

			if (truncated) {
				md.appendMarkdown(`\n\n*...40 lines shown*`)
			}

			// --- Subtask stats for task sections ---
			if (fileName === "tasks.md" && section && sectionContent) {
				const stats = getTaskStats(sectionContent)
				if (stats.total > 0) {
					md.appendMarkdown(`\n\n*${stats.complete}/${stats.total} subtasks complete*`)
				}
			}

			// --- Journal discussion count (spec features only) ---
			if (feature?.discussions && feature.discussions.length > 0) {
				const count = feature.discussions.length
				const journalPath = path.join(path.dirname(absPath), "journal.md")
				const journalArgs = encodeURIComponent(JSON.stringify([vscode.Uri.file(journalPath)]))
				md.appendMarkdown(`\n\n---\n\n`)
				md.appendMarkdown(
					`$(checklist) *${count} discussion${count > 1 ? "s" : ""} in journal.md* · ` +
						`[Open Journal](command:vscode.open?${journalArgs})`,
				)
			}

			// --- Action links ---
			md.appendMarkdown("\n\n---\n\n")

			const openArgs = encodeURIComponent(
				JSON.stringify([
					vscode.Uri.file(absPath),
					{ selection: new vscode.Range(sectionLine, 0, sectionLine, 0) },
				]),
			)
			const fileArgs = encodeURIComponent(JSON.stringify([vscode.Uri.file(absPath)]))

			md.appendMarkdown(
				`[Open in Editor](command:vscode.open?${openArgs}) · ` +
					`[Open Preview](command:markdown.showPreview?${fileArgs}) · ` +
					`[Open Split](command:markdown.showPreviewToSide?${fileArgs})`,
			)

			return new vscode.Hover(md)
		},
	}
}

// --- Metadata helpers ---

interface FeatureMeta {
	status: string
	version?: string
	owner?: string
	lastVerified?: string
}

function getFeatureMeta(feature: Feature | undefined, docFile: string): FeatureMeta {
	if (!feature) return { status: "Unknown" }

	const doc =
		docFile === "spec.md"
			? feature.spec
			: docFile === "design.md"
				? feature.design
				: docFile === "tasks.md"
					? feature.tasks
					: docFile === "journal.md"
						? feature.journal
						: undefined

	if (!doc) return { status: "Missing" }

	const fm = doc.frontmatter
	return {
		status: fm.status ?? "Unknown",
		version: fm.version != null ? String(fm.version) : undefined,
		owner: fm.owner,
		lastVerified: fm.last_verified ? new Date(fm.last_verified).toISOString().split("T")[0] : undefined,
	}
}

// --- Section extraction (full content, no line limit) ---

function extractSection(content: string, sectionSlug: string): ExtractResult {
	const lines = content.split("\n")
	let capturing = false
	let captureLevel = 0
	const result: string[] = []
	let matchedLine = 0

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i]
		const headingMatch = /^(#{1,4})\s+(.+)/.exec(line)

		if (headingMatch) {
			const level = headingMatch[1].length
			const headingText = headingMatch[2]

			// Generate slug from heading text
			const slug = headingText
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, "-")
				.replace(/^-|-$/g, "")

			// Try task ID match: #2.1 or #2.1-description
			const taskIdMatch = /^(\d+\.\d+)/.exec(headingText)
			const taskId = taskIdMatch?.[1]
			const taskSlug = taskId
				? headingText
						.toLowerCase()
						.replace(/[^a-z0-9.]+/g, "-")
						.replace(/^-|-$/g, "")
				: undefined

			const isMatch =
				slug === sectionSlug || taskId === sectionSlug || (taskSlug && taskSlug.startsWith(sectionSlug))

			if (isMatch && !capturing) {
				capturing = true
				captureLevel = level
				matchedLine = i
				result.push(line)
				continue
			} else if (capturing && level <= captureLevel) {
				break // Next heading of same or higher level — stop
			}
		}

		if (capturing) {
			result.push(line)
		}
	}

	// Levenshtein fallback if no exact match
	if (result.length === 0) {
		return levenshteinFallback(lines, sectionSlug)
	}

	return { content: result.join("\n"), lineNumber: matchedLine, found: true }
}

function levenshteinFallback(lines: string[], sectionSlug: string): ExtractResult {
	let bestMatch = ""
	let bestDistance = Infinity

	for (let i = 0; i < lines.length; i++) {
		const headingMatch = /^#{1,4}\s+(.+)/.exec(lines[i])
		if (!headingMatch) continue

		const slug = headingMatch[1]
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-|-$/g, "")

		const dist = levenshtein(slug, sectionSlug)
		if (dist < bestDistance && dist <= Math.max(sectionSlug.length * 0.4, 3)) {
			bestDistance = dist
			bestMatch = slug
		}
	}

	if (bestMatch) {
		return extractSection(lines.join("\n"), bestMatch)
	}

	return { content: "", lineNumber: 0, found: false }
}

function levenshtein(a: string, b: string): number {
	const m = a.length
	const n = b.length
	const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))
	for (let i = 0; i <= m; i++) dp[i][0] = i
	for (let j = 0; j <= n; j++) dp[0][j] = j
	for (let i = 1; i <= m; i++) {
		for (let j = 1; j <= n; j++) {
			dp[i][j] =
				a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
		}
	}
	return dp[m][n]
}

// --- File preview (40 lines, skip frontmatter) ---

function getPreview(content: string): PreviewResult {
	const lines = content.split("\n")
	const maxLines = 40
	let start = 0

	// Skip frontmatter
	if (lines[0]?.trim() === "---") {
		for (let i = 1; i < lines.length; i++) {
			if (lines[i].trim() === "---") {
				start = i + 1
				break
			}
		}
	}

	const remaining = lines.length - start
	const sliced = lines
		.slice(start, start + maxLines)
		.join("\n")
		.trim()

	return {
		content: sliced,
		truncated: remaining > maxLines,
	}
}

// --- Task stats (count checkboxes) ---

function getTaskStats(content: string): { total: number; complete: number } {
	const checked = (content.match(/- \[x\]/gi) ?? []).length
	const unchecked = (content.match(/- \[ \]/g) ?? []).length
	return { total: checked + unchecked, complete: checked }
}

// --- Mermaid block conversion ---

function convertMermaidBlocks(content: string): string {
	return content.replace(/```mermaid\s*\n([\s\S]*?)```/g, "*Mermaid diagram (open file to view):*\n\n```text\n$1```")
}
