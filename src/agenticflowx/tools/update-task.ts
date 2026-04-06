// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * update_task tool — toggle a task checkbox in tasks.md.
 * Uses shared toggleTaskCheckbox logic from hook-engine.
 *
 * @see docs/specs/14-vscode-agenticflowx-agent-tools/design.md [DES-WRITE-TOOLS]
 */

import * as path from "path"
import type { CustomToolDefinition } from "@agenticflowx/types"
import { parametersSchema as z } from "@agenticflowx/types"
import type { WriteCoordinator } from "../services/hook-engine/write-coordinator"
import { toggleTaskCheckbox } from "../services/hook-engine/actions/toggle-checkbox"

export function createUpdateTaskTool(getRoot: () => string, writeCoordinator: WriteCoordinator): CustomToolDefinition {
	return {
		name: "update_task",
		description:
			"Toggle a task checkbox in tasks.md. Marks a task as complete or incomplete. Returns updated progress. Warns if the task isn't the expected next unchecked task.",
		parameters: z.object({
			feature: z.string().describe("Feature name (e.g., 'user-auth')"),
			taskId: z.string().describe("Task ID (e.g., '2.3')"),
			completed: z.boolean().default(true).describe("Set to true to mark complete, false to unmark"),
		}),
		async execute(args: { feature: string; taskId: string; completed: boolean }) {
			const root = getRoot()
			const filePath = path.join(root, "docs", "specs", args.feature, "tasks.md")

			try {
				const result = await toggleTaskCheckbox(filePath, writeCoordinator, args.taskId)
				if (!result) {
					return `Error: Task "${args.taskId}" not found in ${args.feature}/tasks.md`
				}

				const lines = [
					`Task updated: ${result.taskId} — ${result.taskText}`,
					`Feature: ${args.feature} | Progress: ${result.progress.completed}/${result.progress.total} (${Math.round((result.progress.completed / result.progress.total) * 100)}%)`,
				]
				if (result.nextTask) {
					lines.push(`Next: ${result.nextTask}`)
				}
				return lines.join("\n")
			} catch (err) {
				return `Error: ${err instanceof Error ? err.message : String(err)}`
			}
		},
	}
}
