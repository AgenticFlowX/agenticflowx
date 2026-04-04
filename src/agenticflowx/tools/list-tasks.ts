// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * list_tasks tool — show task checklist with progress and NEXT marker.
 * Agent-autonomous: the agent decides when to check task status.
 *
 * @see docs/specs/vscode-agenticflowx-agent-tools/design.md#read-only-tools
 */

import * as path from "path"
import { readFile } from "fs/promises"
import type { CustomToolDefinition } from "@agenticflowx/types"
import { parametersSchema as z } from "@agenticflowx/types"

export function createListTasksTool(getRoot: () => string): CustomToolDefinition {
	return {
		name: "list_tasks",
		description:
			"List tasks for an AFX feature with completion status, progress counts, and a NEXT marker on the first unchecked task. Use this to understand what work is done and what to do next.",
		parameters: z.object({
			feature: z.string().describe("Feature name (e.g., 'user-auth')"),
			phase: z.number().optional().describe("Filter to a specific phase number"),
		}),
		async execute(args: { feature: string; phase?: number }) {
			const root = getRoot()
			const filePath = path.join(root, "docs", "specs", args.feature, "tasks.md")

			let content: string
			try {
				content = await readFile(filePath, "utf-8")
			} catch {
				return `Error: Feature "${args.feature}" not found or tasks.md does not exist.`
			}

			return formatTaskList(content, args.feature, args.phase)
		},
	}
}

function formatTaskList(content: string, feature: string, phaseFilter?: number): string {
	const lines = content.split("\n")
	// Two-pass: first count tasks per phase, then format output
	const checkboxRegex = /^(\s*-\s*\[)([ xX])(\]\s*)(.+)$/
	const phaseRegex = /^#{2,3}\s+(?:Phase\s+)?(\d+)[:.—\s]+(.+)/i

	interface PhaseBlock {
		num: number
		name: string
		tasks: Array<{ text: string; checked: boolean }>
	}

	const phases: PhaseBlock[] = []
	let currentPhase: PhaseBlock | undefined

	for (const line of lines) {
		const phaseMatch = phaseRegex.exec(line)
		if (phaseMatch) {
			currentPhase = { num: parseInt(phaseMatch[1]), name: phaseMatch[2].trim(), tasks: [] }
			phases.push(currentPhase)
			continue
		}

		const match = checkboxRegex.exec(line)
		if (match) {
			const task = { text: match[4].trim(), checked: match[2].toLowerCase() === "x" }
			if (currentPhase) {
				currentPhase.tasks.push(task)
			} else {
				// Tasks before any phase header
				if (phases.length === 0) phases.push({ num: 0, name: "Tasks", tasks: [] })
				phases[0].tasks.push(task)
			}
		}
	}

	// Format output
	const output: string[] = []
	let totalCompleted = 0
	let totalTasks = 0
	let foundNext = false

	for (const phase of phases) {
		if (phaseFilter && phase.num !== phaseFilter) continue

		const phaseCompleted = phase.tasks.filter((t) => t.checked).length
		if (phase.num > 0) {
			output.push(`## Phase ${phase.num} — ${phase.name} (${phaseCompleted}/${phase.tasks.length})`)
		}

		for (const task of phase.tasks) {
			totalTasks++
			if (task.checked) totalCompleted++

			const marker = !task.checked && !foundNext ? "          <-- NEXT" : ""
			if (!task.checked && !foundNext) foundNext = true
			output.push(`- [${task.checked ? "x" : " "}] ${task.text}${marker}`)
		}
	}

	const pct = totalTasks > 0 ? Math.round((totalCompleted / totalTasks) * 100) : 0
	const header = `# ${feature} — Tasks (${totalCompleted}/${totalTasks} complete, ${pct}%)`

	return [header, "", ...output].join("\n")
}
