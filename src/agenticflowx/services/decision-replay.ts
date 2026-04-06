// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * Decision Replay — anti-amnesia system.
 * Injects prior decisions into the system prompt so agents don't
 * contradict their own earlier architectural choices.
 *
 * @see docs/specs/14-vscode-agenticflowx-agent-tools/design.md [DES-DECISION-REPLAY]
 */

import type { Feature } from "../models/feature"

export interface RelevantDecision {
	id: string
	date: string
	title: string
	rationale: string
	filesAffected: string[]
}

const MAX_DECISIONS = 5
const MAX_TOKENS_PER_DECISION = 100 // approximate: ~4 chars per token

/**
 * Get decisions relevant to the current work context.
 * Filters to closed discussions, ranks by file relevance, caps at 5.
 */
export function getRelevantDecisions(
	feature: Feature,
	targetFiles?: string[],
	limit: number = MAX_DECISIONS,
): RelevantDecision[] {
	const closedDiscussions = feature.discussions.filter((d) => d.status === "closed")
	if (closedDiscussions.length === 0) return []

	const decisions: RelevantDecision[] = closedDiscussions.map((d) => {
		// Extract @see links from discussion content as filesAffected
		const seeLinks: string[] = []
		const seeRegex = /@see\s+(\S+)/g
		for (const match of (d.context ?? "").matchAll(seeRegex)) {
			seeLinks.push(match[1])
		}

		// Extract rationale — first sentence or first 200 chars
		const rationale = extractRationale(d.summary ?? d.context ?? d.title)

		return {
			id: d.id,
			date: d.date ?? "unknown",
			title: d.title,
			rationale,
			filesAffected: seeLinks,
		}
	})

	// Rank by relevance to target files
	if (targetFiles && targetFiles.length > 0) {
		decisions.sort((a, b) => {
			const scoreA = a.filesAffected.filter((f) => targetFiles.some((t) => t.includes(f) || f.includes(t))).length
			const scoreB = b.filesAffected.filter((f) => targetFiles.some((t) => t.includes(f) || f.includes(t))).length
			if (scoreB !== scoreA) return scoreB - scoreA
			// Tiebreak: most recent first
			return (b.date ?? "").localeCompare(a.date ?? "")
		})
	} else {
		// Sort by date descending
		decisions.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
	}

	return decisions.slice(0, limit)
}

/**
 * Format decisions as a system prompt block.
 * Returns empty string if no closed discussions exist.
 */
export function getDecisionReplayBlock(feature: Feature, targetFiles?: string[]): string {
	const decisions = getRelevantDecisions(feature, targetFiles)
	if (decisions.length === 0) return ""

	const lines: string[] = ["PRIOR DECISIONS (do not contradict without explicit user approval)", ""]

	for (const d of decisions) {
		const filesStr = d.filesAffected.length > 0 ? `\n  Files: ${d.filesAffected.join(", ")}` : ""
		const rationale = truncate(d.rationale, MAX_TOKENS_PER_DECISION * 4)
		lines.push(`[${d.id}] ${d.date.split("T")[0] ?? d.date} — ${d.title}`)
		lines.push(`  Reason: ${rationale}${filesStr}`)
		lines.push("")
	}

	return lines.join("\n")
}

function extractRationale(content: string): string {
	// Skip frontmatter, headings, empty lines
	const lines = content.split("\n").filter((l) => {
		const trimmed = l.trim()
		return trimmed.length > 0 && !trimmed.startsWith("#") && !trimmed.startsWith("---") && !trimmed.startsWith("**")
	})

	// Take first meaningful sentence
	const firstLine = lines[0] ?? content.substring(0, 200)
	const sentenceEnd = firstLine.indexOf(". ")
	if (sentenceEnd > 20) return firstLine.substring(0, sentenceEnd + 1)
	return firstLine.substring(0, 200)
}

function truncate(text: string, maxChars: number): string {
	if (text.length <= maxChars) return text
	return text.substring(0, maxChars - 3) + "..."
}
