// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * CompletionItemProvider for @see annotations in JSDoc comments.
 * Cascading autocomplete: feature → document → section heading.
 *
 * Triggered on `/` and `#` characters inside `@see docs/specs/` context.
 * Completely additive — no agenticflowx files modified.
 *
 * @see docs/specs/vscode-agenticflowx-ide-providers/design.md#completions
 */

import * as path from "path"
import * as vscode from "vscode"
import { readFile, readdir } from "fs/promises"

export function createSeeCompletionProvider(getRoot: () => string): vscode.CompletionItemProvider {
	return {
		async provideCompletionItems(
			document: vscode.TextDocument,
			position: vscode.Position,
		): Promise<vscode.CompletionItem[] | undefined> {
			const lineText = document.lineAt(position).text
			const textBefore = lineText.substring(0, position.character)

			// Only trigger in @see context
			if (!textBefore.includes("@see")) return undefined

			const root = getRoot()
			if (!root) return undefined

			const seeMatch = textBefore.match(/@see\s+(docs\/specs\/(.*))$/)
			if (!seeMatch) {
				// Just typed "@see " — suggest "docs/specs/"
				if (textBefore.match(/@see\s*$/)) {
					const item = new vscode.CompletionItem("docs/specs/", vscode.CompletionItemKind.Folder)
					item.insertText = "docs/specs/"
					item.command = { command: "editor.action.triggerSuggest", title: "" }
					return [item]
				}
				return undefined
			}

			const afterSpecsSlash = seeMatch[2] // everything after "docs/specs/"

			// Level 1: After "docs/specs/" → list feature directories
			if (!afterSpecsSlash || !afterSpecsSlash.includes("/")) {
				return await getFeatureCompletions(root, afterSpecsSlash ?? "")
			}

			const parts = afterSpecsSlash.split("/")
			const featureName = parts[0]

			// Level 2: After "docs/specs/{feature}/" → list documents
			if (parts.length <= 2 && !afterSpecsSlash.includes("#")) {
				return getDocumentCompletions(featureName, parts[1] ?? "")
			}

			// Level 3: After "docs/specs/{feature}/{doc}.md#" → list section headings
			if (afterSpecsSlash.includes("#")) {
				const docMatch = afterSpecsSlash.match(/^([^/]+)\/([^#]+)#(.*)$/)
				if (docMatch) {
					const [, feature, docFile, partialAnchor] = docMatch
					return await getSectionCompletions(root, feature, docFile, partialAnchor)
				}
			}

			return undefined
		},
	}
}

async function getFeatureCompletions(root: string, partial: string): Promise<vscode.CompletionItem[]> {
	const specsDir = path.join(root, "docs", "specs")
	try {
		const entries = await readdir(specsDir, { withFileTypes: true })
		return entries
			.filter((e) => e.isDirectory() && e.name.startsWith(partial))
			.map((e) => {
				const item = new vscode.CompletionItem(e.name, vscode.CompletionItemKind.Folder)
				item.insertText = e.name + "/"
				item.detail = "AFX feature"
				item.command = { command: "editor.action.triggerSuggest", title: "" }
				return item
			})
	} catch {
		return []
	}
}

function getDocumentCompletions(featureName: string, partial: string): vscode.CompletionItem[] {
	const docs = [
		{ name: "spec.md", detail: "Feature specification" },
		{ name: "design.md", detail: "Technical design" },
		{ name: "tasks.md", detail: "Implementation tasks" },
		{ name: "journal.md", detail: "Session journal" },
	]

	return docs
		.filter((d) => d.name.startsWith(partial))
		.map((d) => {
			const item = new vscode.CompletionItem(d.name, vscode.CompletionItemKind.File)
			item.insertText = d.name + "#"
			item.detail = d.detail
			item.command = { command: "editor.action.triggerSuggest", title: "" }
			return item
		})
}

async function getSectionCompletions(
	root: string,
	feature: string,
	docFile: string,
	partialAnchor: string,
): Promise<vscode.CompletionItem[]> {
	const filePath = path.join(root, "docs", "specs", feature, docFile)
	try {
		const content = await readFile(filePath, "utf-8")
		const items: vscode.CompletionItem[] = []

		for (const line of content.split("\n")) {
			const headingMatch = /^(#{1,6})\s+(.+)$/.exec(line)
			if (!headingMatch) continue

			const level = headingMatch[1].length
			const title = headingMatch[2].trim()
			const slug = title
				.toLowerCase()
				.replace(/[^\w\s-]/g, "")
				.replace(/\s+/g, "-")

			if (partialAnchor && !slug.startsWith(partialAnchor) && !slug.includes(partialAnchor)) continue

			const item = new vscode.CompletionItem(slug, vscode.CompletionItemKind.Reference)
			item.detail = `${"#".repeat(level)} ${title}`
			item.documentation = `Section: ${title}`
			item.insertText = slug
			items.push(item)
		}

		return items
	} catch {
		return []
	}
}
