// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * check_traceability tool — verify @see/@trace links in a file.
 * Reports linked, orphaned, and ghost reference counts.
 *
 * @see docs/specs/vscode-agenticflowx-agent-tools/design.md#read-only-tools
 */

import * as path from "path"
import { readFile, access } from "fs/promises"
import type { CustomToolDefinition } from "@agenticflowx/types"
import { parametersSchema as z } from "@agenticflowx/types"

export function createCheckTraceabilityTool(getRoot: () => string): CustomToolDefinition {
	return {
		name: "check_traceability",
		description:
			"Check @see traceability links in a source file. Reports how many functions have valid spec links (linked), how many are missing links (orphaned), and how many link to non-existent spec targets (ghost).",
		parameters: z.object({
			filePath: z
				.string()
				.describe("Relative path to the source file to check (e.g., 'src/auth/jwt.service.ts')"),
		}),
		async execute(args: { filePath: string }) {
			const root = getRoot()
			const absPath = path.join(root, args.filePath)

			let content: string
			try {
				content = await readFile(absPath, "utf-8")
			} catch {
				return `Error: File "${args.filePath}" not found.`
			}

			return await analyzeTraceability(content, root, args.filePath)
		},
	}
}

async function analyzeTraceability(content: string, root: string, filePath: string): Promise<string> {
	const exportRegex = /export\s+(?:async\s+)?(?:function|class|const|interface|type)\s+(\w+)/g

	// Find all @see links
	const seeLinks: Array<{ target: string; line: number }> = []
	const lines = content.split("\n")
	for (let i = 0; i < lines.length; i++) {
		const matches = lines[i].matchAll(/@see\s+(docs\/specs\/[^\s]+)/g)
		for (const match of matches) {
			seeLinks.push({ target: match[1], line: i + 1 })
		}
	}

	// Find all exports
	const exports: string[] = []
	for (const match of content.matchAll(exportRegex)) {
		exports.push(match[1])
	}

	// Validate links
	let linked = 0
	let ghost = 0
	const ghostDetails: string[] = []

	for (const link of seeLinks) {
		const [filePart, anchor] = link.target.split("#")
		const targetPath = path.join(root, filePart)
		try {
			await access(targetPath)
			// Validate anchor if provided
			if (anchor) {
				const targetContent = await readFile(targetPath, "utf-8")
				if (!headingExists(targetContent, anchor)) {
					ghost++
					ghostDetails.push(`  Line ${link.line}: ${link.target} — section "${anchor}" not found`)
					continue
				}
			}
			linked++
		} catch {
			ghost++
			ghostDetails.push(`  Line ${link.line}: ${link.target} — file not found`)
		}
	}

	const orphaned = Math.max(0, exports.length - linked)

	const overall = ghost === 0 && orphaned === 0 ? "COMPLETE" : "PARTIAL"
	const output = [
		`## Annotation Audit: ${filePath}`,
		"",
		`| Check | Count | Status |`,
		`|-------|-------|--------|`,
		`| Linked @see | ${linked} | ${linked > 0 ? "✓" : "—"} |`,
		`| Orphaned exports | ${orphaned} | ${orphaned === 0 ? "✓" : "⚠"} |`,
		`| Ghost references | ${ghost} | ${ghost === 0 ? "✓" : "✗"} |`,
		"",
		`**Result:** ${overall}`,
	]

	if (ghostDetails.length > 0) {
		output.push("", "### Ghost References", "")
		output.push(...ghostDetails)
	}

	if (orphaned > 0) {
		output.push("", `### Orphaned Exports`, "", `${orphaned} exported symbol(s) without @see annotations.`)
		output.push("", "Fix: Add `@see docs/specs/{feature}/{document}.md#{section}` to each export's JSDoc.")
	}

	output.push("", `Next: /afx-check trace ${filePath}`)

	return output.join("\n")
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
