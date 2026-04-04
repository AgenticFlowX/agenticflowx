// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0

import type { Discussion } from "../../models/spec-document"

const DISCUSSION_RE = /^###\s+([A-Z]{2,}-D\d+)\s+-\s+(\d{4}-\d{2}-\d{2})\s+-\s+(.*)$/
const STATUS_RE = /`status:(active|blocked|closed)`/
const BOLD_SECTION_RE = /^\*\*(\w+)\*\*:\s*(.*)$/

interface PartialDiscussion {
	id: string
	date: string
	title: string
	line: number
	context?: string
	summary?: string
	decisions?: string[]
}

function finalizeDiscussion(d: PartialDiscussion, status: Discussion["status"]): Discussion {
	return {
		id: d.id,
		date: d.date,
		title: d.title,
		status,
		line: d.line,
		context: d.context,
		summary: d.summary,
		decisions: d.decisions?.length ? d.decisions : undefined,
	}
}

export function parseDiscussions(content: string): Discussion[] {
	const lines = content.split("\n")
	const discussions: Discussion[] = []
	let current: PartialDiscussion | undefined
	let currentSection: string | undefined
	let decisionLines: string[] = []

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i]

		const headingMatch = line.match(DISCUSSION_RE)
		if (headingMatch) {
			if (current) {
				if (decisionLines.length) current.decisions = decisionLines
				discussions.push(finalizeDiscussion(current, "active"))
			}
			current = {
				id: headingMatch[1],
				date: headingMatch[2],
				title: headingMatch[3].trim(),
				line: i,
			}
			currentSection = undefined
			decisionLines = []
			continue
		}

		if (current) {
			const statusMatch = line.match(STATUS_RE)
			if (statusMatch) {
				if (decisionLines.length) current.decisions = decisionLines
				discussions.push(finalizeDiscussion(current, statusMatch[1] as Discussion["status"]))
				current = undefined
				currentSection = undefined
				decisionLines = []
				continue
			}

			const sectionMatch = line.match(BOLD_SECTION_RE)
			if (sectionMatch) {
				const key = sectionMatch[1].toLowerCase()
				const val = sectionMatch[2].trim()
				if (key === "context") {
					current.context = val
					currentSection = "context"
				} else if (key === "summary") {
					current.summary = val
					currentSection = "summary"
				} else if (key === "decisions") {
					currentSection = "decisions"
					decisionLines = []
				} else {
					currentSection = undefined
				}
				continue
			}

			if (currentSection === "decisions") {
				const listMatch = line.match(/^-\s+(.+)$/)
				if (listMatch) {
					decisionLines.push(listMatch[1].trim())
				} else if (line.startsWith("**")) {
					currentSection = undefined
				}
			}
		}
	}

	if (current) {
		if (decisionLines.length) current.decisions = decisionLines
		discussions.push(finalizeDiscussion(current, "active"))
	}

	return discussions
}
