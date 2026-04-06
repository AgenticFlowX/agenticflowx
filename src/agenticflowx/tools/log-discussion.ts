// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * log_discussion tool — record a decision/discussion in journal.md.
 * Auto-generates discussion ID following AFX journal format.
 * Matches /afx-session skill output format.
 *
 * @see docs/specs/14-vscode-agenticflowx-agent-tools/design.md#write-tools
 */

import * as path from "path"
import type { CustomToolDefinition } from "@agenticflowx/types"
import { parametersSchema as z } from "@agenticflowx/types"
import type { WriteCoordinator } from "../services/hook-engine/write-coordinator"

export function createLogDiscussionTool(
	getRoot: () => string,
	writeCoordinator: WriteCoordinator,
): CustomToolDefinition {
	return {
		name: "log_discussion",
		description:
			"Record a decision or discussion in journal.md for a feature. Auto-generates a discussion ID (e.g., UA-D004). Use this to capture architectural decisions, design rationale, or important discussions.",
		parameters: z.object({
			feature: z.string().describe("Feature name (e.g., 'user-auth')"),
			title: z.string().describe("Discussion title (e.g., 'JWT vs cookies')"),
			context: z.string().describe("What prompted this discussion"),
			summary: z.string().describe("Key points in 2-3 sentences"),
			decisions: z.array(z.string()).default([]).describe("List of decisions made"),
			tags: z.array(z.string()).default([]).describe("Tags for filtering (e.g., ['architecture', 'auth'])"),
			status: z.enum(["active", "closed", "blocked"]).default("closed").describe("Discussion status"),
			relatedFiles: z.array(z.string()).default([]).describe("Related file paths"),
		}),
		async execute(args: {
			feature: string
			title: string
			context: string
			summary: string
			decisions: string[]
			tags: string[]
			status: string
			relatedFiles: string[]
		}) {
			const root = getRoot()
			const filePath = path.join(root, "docs", "specs", args.feature, "journal.md")

			try {
				let existing: string
				try {
					existing = await writeCoordinator.readSpecFile(filePath)
				} catch {
					const prefix = generatePrefix(args.feature)
					existing = `---
afx: true
type: JOURNAL
status: Living
owner: "@rix"
tags: [${args.feature}, journal]
---

# ${args.feature} — Journal

<!-- prefix: ${prefix} -->

## Discussions

<!-- Chronological order: oldest first, newest last -->
`
				}

				// Generate next discussion ID
				const prefix = generatePrefix(args.feature)
				const idRegex = new RegExp(`${prefix}-D(\\d+)`, "g")
				let maxId = 0
				for (const match of existing.matchAll(idRegex)) {
					const num = parseInt(match[1])
					if (num > maxId) maxId = num
				}
				const newId = `${prefix}-D${String(maxId + 1).padStart(3, "0")}`

				const timestamp = new Date().toISOString()
				const dateStr = timestamp.split("T")[0] ?? timestamp
				const tagStr = args.tags.length > 0 ? args.tags.join(", ") : args.feature

				const decisionsBlock =
					args.decisions.length > 0
						? `\n**Decisions**:\n${args.decisions.map((d) => `- ${d}`).join("\n")}`
						: ""

				const filesBlock =
					args.relatedFiles.length > 0
						? `\n**Related Files**: ${args.relatedFiles.map((f) => path.basename(f)).join(", ")}`
						: ""

				const entry = `

### ${newId} - ${dateStr} - ${args.title}

\`status:${args.status}\` \`[${tagStr}]\`

**Context**: ${args.context}

**Summary**: ${args.summary}
${decisionsBlock}
${filesBlock}
**Participants**: Claude
`

				const updated = existing.trimEnd() + "\n" + entry

				await writeCoordinator.writeSpecFile(filePath, updated)

				return `Discussion logged: ${newId}\nFeature: ${args.feature} | Status: ${args.status} | File: journal.md`
			} catch (err) {
				return `Error: ${err instanceof Error ? err.message : String(err)}`
			}
		},
	}
}

function generatePrefix(featureName: string): string {
	return featureName
		.split("-")
		.map((w) => w[0]?.toUpperCase() ?? "")
		.join("")
}
