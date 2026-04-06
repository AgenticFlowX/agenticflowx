// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * Kanban board parser — reads .afx/kanban/*.md files.
 *
 * @see docs/specs/16-vscode-agenticflowx-core/design.md [DES-DATA-PROVIDER]
 */

import * as path from "path"
import { readdir, readFile, mkdir, writeFile } from "fs/promises"
import matter from "gray-matter"
import type { KanbanBoard, KanbanColumn, KanbanData, KanbanMeta } from "../../models/panel-types"

export function parseKanbanContent(content: string, filePath: string): KanbanBoard {
	const { data, content: body } = matter(content)
	const meta: KanbanMeta = {
		title: data.title,
		description: data.description,
		status: data.status,
		tags: Array.isArray(data.tags) ? data.tags : undefined,
		created: data.created,
		updated: data.updated,
	}

	const columns: KanbanColumn[] = []
	let currentColumn: KanbanColumn | undefined
	const lines = body.split("\n")

	for (const line of lines) {
		const colMatch = line.match(/^##\s+(.+)$/)
		if (colMatch) {
			currentColumn = { title: colMatch[1].trim(), cards: [] }
			columns.push(currentColumn)
			continue
		}

		if (currentColumn) {
			const cardMatch = line.match(/^-\s+(.+)$/)
			if (cardMatch) {
				currentColumn.cards.push({ text: cardMatch[1].trim() })
			}
		}
	}

	const name = path.basename(filePath, ".md")
	return { name, filePath, columns, rawContent: content, meta }
}

export async function scanKanbanDir(root: string): Promise<KanbanData> {
	const dirPath = path.join(root, ".afx", "kanban")
	const boards: KanbanBoard[] = []

	try {
		const entries = await readdir(dirPath, { withFileTypes: true })
		const mdFiles = entries.filter((e) => e.isFile() && e.name.endsWith(".md"))
		for (const f of mdFiles) {
			try {
				const filePath = path.join(dirPath, f.name)
				const content = await readFile(filePath, "utf-8")
				boards.push(parseKanbanContent(content, filePath))
			} catch {
				// skip unreadable
			}
		}
		boards.sort((a, b) => a.name.localeCompare(b.name))
	} catch {
		// dir doesn't exist yet — create default board
		try {
			await mkdir(dirPath, { recursive: true })
			const defaultPath = path.join(dirPath, "backlog.md")
			const defaultContent = `---\ntitle: Backlog\nstatus: active\n---\n\n## To Do\n\n## In Progress\n\n## Done\n`
			await writeFile(defaultPath, defaultContent, "utf-8")
			boards.push(parseKanbanContent(defaultContent, defaultPath))
		} catch {
			// can't create — that's ok
		}
	}

	return { boards, dirPath }
}
