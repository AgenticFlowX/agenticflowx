// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * read_spec tool — load spec document with parsed structure.
 * Agent-autonomous: the agent decides when to read specs.
 *
 * @see docs/specs/vscode-agenticflowx-agent-tools/design.md#read-only-tools
 */

import * as path from "path"
import { readFile } from "fs/promises"
import type { CustomToolDefinition } from "@agenticflowx/types"
import { parametersSchema as z } from "@agenticflowx/types"

const MAX_CHARS = 4000

export function createReadSpecTool(getRoot: () => string): CustomToolDefinition {
	return {
		name: "read_spec",
		description:
			"Read an AFX spec document (spec.md, design.md, tasks.md, or journal.md) for a feature. Returns the document with frontmatter metadata. Use this to understand feature requirements, design decisions, and task status.",
		parameters: z.object({
			feature: z.string().describe("Feature name (e.g., 'user-auth', 'dashboard')"),
			document: z.enum(["spec", "design", "tasks", "journal"]).default("spec").describe("Which document to read"),
			section: z.string().optional().describe("Optional section heading to extract (e.g., 'jwt-tokens')"),
		}),
		async execute(args: { feature: string; document: string; section?: string }) {
			const root = getRoot()
			const filePath = path.join(root, "docs", "specs", args.feature, `${args.document}.md`)

			let content: string
			try {
				content = await readFile(filePath, "utf-8")
			} catch {
				return `Error: Feature "${args.feature}" not found or ${args.document}.md does not exist.`
			}

			if (args.section) {
				const sectionContent = extractSection(content, args.section)
				if (!sectionContent) {
					return `Error: Section "${args.section}" not found in ${args.feature}/${args.document}.md`
				}
				content = sectionContent
			}

			// Extract frontmatter status for header
			const statusMatch = content.match(/^---[\s\S]*?status:\s*(.+?)$/m)
			const ownerMatch = content.match(/^---[\s\S]*?owner:\s*(.+?)$/m)
			const versionMatch = content.match(/^---[\s\S]*?version:\s*(.+?)$/m)
			const status = statusMatch?.[1]?.trim() ?? "Unknown"
			const owner = ownerMatch?.[1]?.trim() ?? ""
			const version = versionMatch?.[1]?.trim() ?? ""

			if (content.length > MAX_CHARS) {
				content =
					content.substring(0, MAX_CHARS) +
					"\n\n[truncated — use section parameter to read specific sections]"
			}

			const meta = [`Status: ${status}`, owner ? `Owner: ${owner}` : "", version ? `Version: ${version}` : ""]
				.filter(Boolean)
				.join(" | ")

			return `# ${args.feature} / ${args.document}.md\n${meta}\n\n${content}`
		},
	}
}

function extractSection(content: string, sectionName: string): string | undefined {
	const slug = sectionName.toLowerCase().replace(/\s+/g, "-")
	const lines = content.split("\n")
	let capturing = false
	let capturedLevel = 0
	const result: string[] = []

	for (const line of lines) {
		const headingMatch = /^(#{1,6})\s+(.+)$/.exec(line)
		if (headingMatch) {
			const level = headingMatch[1].length
			const headingSlug = headingMatch[2]
				.toLowerCase()
				.replace(/[^\w\s-]/g, "")
				.replace(/\s+/g, "-")

			if (capturing && level <= capturedLevel) break
			if (headingSlug.includes(slug)) {
				capturing = true
				capturedLevel = level
			}
		}
		if (capturing) result.push(line)
	}

	return result.length > 0 ? result.join("\n") : undefined
}
