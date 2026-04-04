// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0

import { readFile } from "fs/promises"
import type { SpecDocument, DocType } from "../../models/spec-document"
import { parseFrontmatter } from "./frontmatter-parser"
import { parseTaskStats } from "./task-parser"
import { parseDiscussions } from "./journal-parser"
import { parseSections } from "./section-parser"

export async function parseSpecDocument(filePath: string, expectedType: string): Promise<SpecDocument | undefined> {
	try {
		const content = await readFile(filePath, "utf-8")
		const frontmatter = parseFrontmatter(content, filePath)
		const type = (frontmatter.type ?? expectedType) as DocType

		const doc: SpecDocument = { path: filePath, type, frontmatter }

		if (type === "TASKS") {
			doc.taskStats = parseTaskStats(content)
		}

		if (type === "JOURNAL") {
			doc.discussions = parseDiscussions(content)
		}

		if (type === "SPEC" || type === "DESIGN") {
			doc.sections = parseSections(content)
		}

		return doc
	} catch {
		return undefined
	}
}
