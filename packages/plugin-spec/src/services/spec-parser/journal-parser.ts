// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0

import type { Discussion } from "../../models/spec-document.js"

// Accepted heading variants (see journal.md files across docs/specs/):
//   ### PREFIX-D001 - 2026-02-28 - Title        (inline date)
//   ### PREFIX-D001 — Title                     (em-dash, date on separate **Date:** line)
//   ### PREFIX-D001 -- Title                    (double-dash)
//   ### PREFIX-D001: Title                      (colon)
//   ## PREFIX-D001: Title                       (H2 variant, also with **Date:**)
//   ## 2026-03-23 -- Title                      (no ID — synthesize from date)
//   ## Session: Title (2026-03-16)              (freeform session header)
const SEPARATOR = "[\\s]*[-–—:]+[\\s]*"
const ID_HEADING_RE = new RegExp(`^#{2,3}\\s+([A-Z][A-Z0-9-]*-D\\d+)(?:${SEPARATOR}(.*))?$`)
const DATE_INLINE_RE = /^(\d{4}-\d{2}-\d{2})\s*[-–—:]+\s*(.*)$/
const DATE_ONLY_HEADING_RE = /^##\s+(\d{4}-\d{2}-\d{2})\s*[-–—:]+\s*(.+)$/
const SESSION_HEADING_RE = /^##\s+Session:\s*(.+?)(?:\s*\((\d{4}-\d{2}-\d{2})\))?\s*$/
const DATE_METADATA_RE = /^\*\*Date(?:\*\*:|:\*\*)\s*(\d{4}-\d{2}-\d{2})/
// Backtick-wrapped ISO date or date-only (e.g. `2026-04-04T04:05:38.000Z`).
const BACKTICK_DATE_RE = /`(\d{4}-\d{2}-\d{2})(?:T[\d:.Z+-]*)?`/
const STATUS_RE = /`status:(active|blocked|closed)`/
// Matches both `**Key:** value` and `**Key**: value` — authors use both.
const BOLD_SECTION_RE = /^\*\*(\w+)(?:\*\*:|:\*\*)\s*(.*)$/

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

function findNearbyDate(lines: string[], startLine: number): string | undefined {
	const end = Math.min(lines.length, startLine + 6)
	for (let i = startLine + 1; i < end; i++) {
		const line = lines[i]
		const meta = line.match(DATE_METADATA_RE)
		if (meta) return meta[1]
		const tick = line.match(BACKTICK_DATE_RE)
		if (tick) return tick[1]
	}
	return undefined
}

function tryParseHeading(
	lines: string[],
	i: number,
	fallbackPrefix: string,
	autoIndex: number,
): PartialDiscussion | undefined {
	const line = lines[i]

	// Form 1: ID-prefixed heading (### or ##)
	const idMatch = line.match(ID_HEADING_RE)
	if (idMatch) {
		const id = idMatch[1]
		const rest = (idMatch[2] ?? "").trim()
		const inline = rest.match(DATE_INLINE_RE)
		if (inline) {
			return { id, date: inline[1], title: inline[2].trim(), line: i }
		}
		const date = findNearbyDate(lines, i) ?? ""
		return { id, date, title: rest, line: i }
	}

	// Form 2: H2 date-only heading (## 2026-03-23 -- Title)
	const dateOnly = line.match(DATE_ONLY_HEADING_RE)
	if (dateOnly) {
		return {
			id: `${fallbackPrefix}-D${String(autoIndex).padStart(3, "0")}`,
			date: dateOnly[1],
			title: dateOnly[2].trim(),
			line: i,
		}
	}

	// Form 3: Freeform session heading (## Session: Title (date))
	const session = line.match(SESSION_HEADING_RE)
	if (session) {
		return {
			id: `${fallbackPrefix}-D${String(autoIndex).padStart(3, "0")}`,
			date: session[2] ?? findNearbyDate(lines, i) ?? "",
			title: session[1].trim(),
			line: i,
		}
	}

	return undefined
}

function extractPrefix(content: string, fallback: string): string {
	const m = content.match(/<!--\s*prefix:\s*([A-Z][A-Z0-9-]*)\s*-->/)
	return m ? m[1] : fallback
}

export function parseDiscussions(content: string): Discussion[] {
	const lines = content.split("\n")
	const prefix = extractPrefix(content, "JRN")
	const discussions: Discussion[] = []
	let current: PartialDiscussion | undefined
	let currentSection: string | undefined
	let decisionLines: string[] = []
	let autoIndex = 1

	const closeCurrent = (status: Discussion["status"]) => {
		if (!current) return
		if (decisionLines.length) current.decisions = decisionLines
		discussions.push(finalizeDiscussion(current, status))
		current = undefined
		currentSection = undefined
		decisionLines = []
	}

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i]

		const heading = tryParseHeading(lines, i, prefix, autoIndex)
		if (heading) {
			closeCurrent("active")
			current = heading
			autoIndex++
			continue
		}

		if (!current) continue

		const statusMatch = line.match(STATUS_RE)
		if (statusMatch) {
			closeCurrent(statusMatch[1] as Discussion["status"])
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

	closeCurrent("active")
	return discussions
}
