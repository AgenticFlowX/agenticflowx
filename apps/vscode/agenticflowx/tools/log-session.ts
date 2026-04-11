// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * log_session tool — append session discussion entry to journal.md.
 * Uses AFX journal format with auto-generated discussion ID.
 *
 * @see docs/specs/14-vscode-agenticflowx-agent-tools/design.md [DES-WRITE-TOOLS]
 */

import * as path from "path"
import type { CustomToolDefinition } from "@agenticflowx/types"
import { parametersSchema as z } from "@agenticflowx/types"
import type { WriteCoordinator } from "../services/hook-engine/write-coordinator"
import { appendSessionEntry } from "../services/hook-engine/actions/auto-log-session"

export function createLogSessionTool(getRoot: () => string, writeCoordinator: WriteCoordinator): CustomToolDefinition {
	return {
		name: "log_session",
		description:
			"Log a work session to journal.md for a feature. Creates a discussion entry with auto-generated ID following AFX journal format. Records what was done, which files were modified, and by which agent.",
		parameters: z.object({
			feature: z.string().describe("Feature name (e.g., 'user-auth')"),
			taskId: z.string().describe("Task ID worked on (e.g., '2.3')"),
			summary: z.string().describe("Brief summary of work done"),
			filesModified: z.array(z.string()).describe("List of file paths modified"),
		}),
		async execute(args: { feature: string; taskId: string; summary: string; filesModified: string[] }) {
			const root = getRoot()
			const filePath = path.join(root, "docs", "specs", args.feature, "journal.md")

			try {
				const newId = await appendSessionEntry(
					filePath,
					{
						timestamp: new Date().toISOString(),
						agent: "agenticflowx",
						taskId: args.taskId,
						summary: args.summary,
						filesModified: args.filesModified,
						feature: args.feature,
					},
					writeCoordinator,
				)
				return `Session logged: ${newId}\nFeature: ${args.feature} | File: journal.md\nTimestamp: ${new Date().toISOString()} | Task: ${args.taskId}`
			} catch (err) {
				return `Error: ${err instanceof Error ? err.message : String(err)}`
			}
		},
	}
}
