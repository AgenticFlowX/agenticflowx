// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0

import type { Section } from "../../models/spec-document.js"

const HEADING_RE = /^(#{2,3})\s+(.+)$/

export function parseSections(content: string): Section[] {
	const lines = content.split("\n")
	const sections: Section[] = []
	let inFrontmatter = false

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i]

		if (line.trim() === "---") {
			inFrontmatter = !inFrontmatter
			continue
		}
		if (inFrontmatter) continue

		const match = line.match(HEADING_RE)
		if (match) {
			sections.push({
				title: match[2].trim(),
				level: match[1].length,
				line: i,
			})
		}
	}

	return sections
}
