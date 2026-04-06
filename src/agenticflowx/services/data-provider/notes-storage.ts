// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * Quick Notes storage — read/append/delete notes from .afx/notes.md
 *
 * File format (standard markdown):
 *   ## YYYY-MM-DD          (date header, most recent first)
 *   ### HH:MM:SS.mmm       (time entry)
 *   body content...        (freeform markdown until next ### or ##)
 *
 * @see docs/specs/16-vscode-agenticflowx-core/design.md#data-provider
 */

import * as path from "path"
import { readFile, writeFile, mkdir } from "fs/promises"
import type { QuickNote } from "../../models/panel-types"

const NOTES_PATH = ".afx/notes.md"
const FRONTMATTER = `---\nafx: true\ntype: NOTES\n---\n`
const DATE_RE = /^## (\d{4}-\d{2}-\d{2})$/
const TIME_RE = /^### (\d{2}:\d{2}:\d{2}\.\d{3})$/

function notesFile(root: string): string {
	return path.join(root, NOTES_PATH)
}

async function ensureFile(root: string): Promise<string> {
	const fp = notesFile(root)
	try {
		return await readFile(fp, "utf-8")
	} catch {
		await mkdir(path.dirname(fp), { recursive: true })
		await writeFile(fp, FRONTMATTER + "\n", "utf-8")
		return FRONTMATTER + "\n"
	}
}

export async function readNotes(root: string): Promise<QuickNote[]> {
	const content = await ensureFile(root)
	const lines = content.split("\n")
	const notes: QuickNote[] = []
	let currentDate = ""

	for (let i = 0; i < lines.length; i++) {
		const dateLine = DATE_RE.exec(lines[i])
		if (dateLine) {
			currentDate = dateLine[1]
			continue
		}

		if (!currentDate) continue

		const timeMatch = TIME_RE.exec(lines[i])
		if (timeMatch) {
			const time = timeMatch[1]
			const bodyLines: string[] = []
			let j = i + 1
			while (j < lines.length) {
				if (DATE_RE.test(lines[j]) || TIME_RE.test(lines[j])) break
				bodyLines.push(lines[j])
				j++
			}
			while (bodyLines.length > 0 && bodyLines[0].trim() === "") bodyLines.shift()
			while (bodyLines.length > 0 && bodyLines[bodyLines.length - 1].trim() === "") bodyLines.pop()

			notes.push({
				timestamp: `${currentDate}T${time}`,
				time,
				displayTime: time.slice(0, 5),
				date: currentDate,
				text: bodyLines.join("\n"),
			})
		}
	}

	return notes
}

export async function appendNote(root: string, text: string): Promise<void> {
	const content = await ensureFile(root)
	const now = new Date()
	const dateStr = [
		now.getFullYear(),
		String(now.getMonth() + 1).padStart(2, "0"),
		String(now.getDate()).padStart(2, "0"),
	].join("-")
	const timeStr =
		[
			String(now.getHours()).padStart(2, "0"),
			String(now.getMinutes()).padStart(2, "0"),
			String(now.getSeconds()).padStart(2, "0"),
		].join(":") +
		"." +
		String(now.getMilliseconds()).padStart(3, "0")

	const entry = `### ${timeStr}\n${text}`
	const lines = content.split("\n")

	let insertIdx = 0
	let inFrontmatter = false
	for (let i = 0; i < lines.length; i++) {
		if (lines[i].trim() === "---") {
			if (!inFrontmatter) {
				inFrontmatter = true
			} else {
				insertIdx = i + 1
				break
			}
		}
	}

	while (insertIdx < lines.length && lines[insertIdx].trim() === "") {
		insertIdx++
	}

	const todayHeader = `## ${dateStr}`
	const headerIdx = lines.findIndex((l) => l.trim() === todayHeader)

	if (headerIdx >= 0) {
		let entryInsert = headerIdx + 1
		if (entryInsert < lines.length && lines[entryInsert].trim() === "") {
			entryInsert++
		}
		lines.splice(entryInsert, 0, entry, "")
	} else {
		lines.splice(insertIdx, 0, "", todayHeader, "", entry, "")
	}

	await writeFile(notesFile(root), lines.join("\n"), "utf-8")
}

export async function deleteNote(root: string, timestamp: string): Promise<void> {
	const content = await ensureFile(root)
	const lines = content.split("\n")
	const [date, time] = timestamp.split("T")
	const targetHeader = `### ${time}`

	let currentDate = ""
	for (let i = 0; i < lines.length; i++) {
		const dateLine = DATE_RE.exec(lines[i])
		if (dateLine) {
			currentDate = dateLine[1]
			continue
		}

		if (currentDate === date && lines[i].trim() === targetHeader) {
			let end = i + 1
			while (end < lines.length && !DATE_RE.test(lines[end]) && !TIME_RE.test(lines[end])) {
				end++
			}
			lines.splice(i, end - i)

			if (i > 0 && DATE_RE.test(lines[i - 1]?.trim() || "")) {
				let nextContent = i
				while (nextContent < lines.length && lines[nextContent].trim() === "") nextContent++
				if (nextContent >= lines.length || DATE_RE.test(lines[nextContent])) {
					let start = i - 1
					if (start > 0 && lines[start - 1].trim() === "") start--
					lines.splice(start, nextContent - start)
				}
			}

			break
		}
	}

	await writeFile(notesFile(root), lines.join("\n"), "utf-8")
}

export function getNotesFilePath(root: string): string {
	return notesFile(root)
}
