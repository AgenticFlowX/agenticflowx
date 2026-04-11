// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0

import type { TaskStats, Phase, WorkSession } from "../../models/spec-document.js"

const PHASE_RE = /^##\s+Phase\s+(\d+):?\s+(.*)$/
const TASK_RE = /^-\s+\[([ xX])\]\s+(.*)$/
const WORK_SESSION_HEADER_RE = /^##\s+Work\s+Sessions/i
const WORK_SESSION_ROW_RE =
	/^\|\s*(\d{4}-\d{2}-\d{2}(?:T[\d:.]+Z?)?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|/

export function parseTaskStats(content: string): TaskStats {
	const lines = content.split("\n")
	const phases: Phase[] = []
	const workSessions: WorkSession[] = []
	let currentPhase: Phase | undefined
	let totalCompleted = 0
	let totalCount = 0
	let inWorkSessions = false

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i]

		if (WORK_SESSION_HEADER_RE.test(line)) {
			inWorkSessions = true
			continue
		}

		if (inWorkSessions) {
			if (/^##\s/.test(line) && !WORK_SESSION_HEADER_RE.test(line)) {
				inWorkSessions = false
			} else {
				const rowMatch = line.match(WORK_SESSION_ROW_RE)
				if (rowMatch && !rowMatch[2].includes("---")) {
					workSessions.push({
						date: rowMatch[1].trim(),
						task: rowMatch[2].trim(),
						action: rowMatch[3].trim(),
						filesModified: rowMatch[4].trim(),
						agent: /\[x\]/i.test(rowMatch[5]),
						human: /\[x\]/i.test(rowMatch[6]),
					})
				}
				continue
			}
		}

		const phaseMatch = line.match(PHASE_RE)
		if (phaseMatch) {
			currentPhase = {
				number: parseInt(phaseMatch[1], 10),
				name: phaseMatch[2].trim(),
				total: 0,
				completed: 0,
				line: i,
				items: [],
			}
			phases.push(currentPhase)
			continue
		}

		const taskMatch = line.match(TASK_RE)
		if (taskMatch) {
			const done = taskMatch[1].toLowerCase() === "x"
			totalCount++
			if (done) totalCompleted++
			if (currentPhase) {
				currentPhase.total++
				if (done) currentPhase.completed++
				currentPhase.items!.push({
					text: taskMatch[2].trim(),
					completed: done,
					line: i + 1,
				})
			}
		}
	}

	return { total: totalCount, completed: totalCompleted, phases, workSessions }
}
