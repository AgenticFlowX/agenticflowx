// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * auto_log_session action — appends a session discussion entry to journal.md.
 * Follows AFX journal format with auto-generated discussion ID.
 *
 * @see docs/specs/17-vscode-agenticflowx-hook-engine/design.md#hook-actions
 * @see /Users/rix/Workspace/afx-project/.agents/skills/afx-session/SKILL.md
 */

import * as path from "path"
import type { WriteCoordinator } from "../write-coordinator"

export interface SessionLogEntry {
	timestamp: string
	agent: string
	taskId: string
	summary: string
	filesModified: string[]
	feature: string
}

/**
 * Append a session discussion entry to journal.md.
 * Auto-generates a discussion ID by scanning existing {PREFIX}-D{NNN} entries.
 */
export async function appendSessionEntry(
	journalFilePath: string,
	entry: SessionLogEntry,
	writeCoordinator: WriteCoordinator,
): Promise<string> {
	let existing: string
	try {
		existing = await writeCoordinator.readSpecFile(journalFilePath)
	} catch {
		// Create journal.md if it doesn't exist
		existing = `---
afx: true
type: JOURNAL
status: Living
owner: "@rix"
tags: [${entry.feature}, journal]
---

# ${entry.feature} — Journal

<!-- prefix: ${generatePrefix(entry.feature)} -->

## Discussions

<!-- Chronological order: oldest first, newest last -->
`
	}

	// Generate next discussion ID
	const prefix = generatePrefix(entry.feature)
	const idRegex = new RegExp(`${prefix}-D(\\d+)`, "g")
	let maxId = 0
	for (const match of existing.matchAll(idRegex)) {
		const num = parseInt(match[1])
		if (num > maxId) maxId = num
	}
	const newId = `${prefix}-D${String(maxId + 1).padStart(3, "0")}`

	const dateStr = entry.timestamp.split("T")[0] ?? entry.timestamp
	const fileBasenames = entry.filesModified.map((f) => path.basename(f)).join(", ")

	const discussion = `

### ${newId} - ${dateStr} - Work Session: ${entry.taskId}

\`status:closed\` \`[session, ${entry.agent}, auto-capture]\`

**Context**: Automated session log for task ${entry.taskId}

**Summary**: ${entry.summary}

**Decisions**:
- Task ${entry.taskId} completed by ${entry.agent}

**Related Files**: ${fileBasenames || "none"}
**Participants**: @${entry.agent}
`

	const updated = existing.trimEnd() + "\n" + discussion

	await writeCoordinator.writeSpecFile(journalFilePath, updated)

	return newId
}

function generatePrefix(featureName: string): string {
	return featureName
		.split("-")
		.map((w) => w[0]?.toUpperCase() ?? "")
		.join("")
}
