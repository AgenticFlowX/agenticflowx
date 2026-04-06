// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * toggle_checkbox action — marks the next unchecked task as complete in tasks.md.
 * Shared logic used by both hook actions and the update_task agent tool.
 *
 * @see docs/specs/17-vscode-agenticflowx-hook-engine/design.md#hook-actions
 */

import type { WriteCoordinator } from "../write-coordinator"

export interface ToggleResult {
	taskId: string
	taskText: string
	completed: boolean
	nextTask?: string
	progress: { completed: number; total: number }
}

/**
 * Toggle a task checkbox in tasks.md.
 * If taskId is provided, toggles that specific task.
 * If taskId is omitted, toggles the next unchecked task.
 */
export async function toggleTaskCheckbox(
	tasksFilePath: string,
	writeCoordinator: WriteCoordinator,
	taskId?: string,
): Promise<ToggleResult | undefined> {
	const content = await writeCoordinator.readSpecFile(tasksFilePath)
	const lines = content.split("\n")

	let targetLine = -1
	let taskText = ""
	const checkboxRegex = /^(\s*-\s*\[)([ xX])(\]\s*)(.+)$/

	if (taskId) {
		// Find specific task by ID pattern (e.g., "2.3" matches "- [ ] 2.3 Auth middleware")
		for (let i = 0; i < lines.length; i++) {
			const match = checkboxRegex.exec(lines[i])
			if (match && match[4].trim().startsWith(taskId)) {
				targetLine = i
				taskText = match[4].trim()
				break
			}
		}
	} else {
		// Find first unchecked task
		for (let i = 0; i < lines.length; i++) {
			const match = checkboxRegex.exec(lines[i])
			if (match && match[2] === " ") {
				targetLine = i
				taskText = match[4].trim()
				break
			}
		}
	}

	if (targetLine === -1) return undefined

	// Toggle the checkbox
	const match = checkboxRegex.exec(lines[targetLine])
	if (!match) return undefined

	const wasChecked = match[2].toLowerCase() === "x"
	const newState = wasChecked ? " " : "x"
	lines[targetLine] = `${match[1]}${newState}${match[3]}${match[4]}`

	await writeCoordinator.writeSpecFile(tasksFilePath, lines.join("\n"))

	// Count progress
	let completed = 0
	let total = 0
	let nextTask: string | undefined
	for (const line of lines) {
		const m = checkboxRegex.exec(line)
		if (m) {
			total++
			if (m[2].toLowerCase() === "x" || (line === lines[targetLine] && !wasChecked)) {
				completed++
			} else if (!nextTask && line !== lines[targetLine]) {
				nextTask = m[4].trim()
			}
		}
	}

	return {
		taskId: taskId ?? taskText.split(" ")[0],
		taskText,
		completed: !wasChecked,
		nextTask,
		progress: { completed, total },
	}
}
