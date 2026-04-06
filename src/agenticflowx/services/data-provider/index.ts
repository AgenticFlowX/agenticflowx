// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * AgenticFlowX data provider — collects all data for the bottom panel.
 *
 * @see docs/specs/16-vscode-agenticflowx-core/design.md#data-provider
 */

import * as path from "path"
import { readFile, stat } from "fs/promises"
import * as vscode from "vscode"
import type { AfxConfig } from "../../models/config"
import type { Feature } from "../../models/feature"
import { buildFeatures } from "../../models/feature"
import { parseFrontmatter } from "../spec-parser/frontmatter-parser"
import type {
	PipelineRow,
	DocumentRow,
	FeatureTasksData,
	JournalEntry,
	GhostTaskResult,
} from "../../models/panel-types"

// Specs data provider with caching

export function createSpecsDataProvider(
	getConfig: () => AfxConfig | undefined,
	getRoot: () => string,
	log?: import("vscode").OutputChannel,
) {
	let cachedFeatures: Feature[] | undefined

	return {
		async getFeatures(): Promise<Feature[]> {
			if (cachedFeatures) return cachedFeatures
			const config = getConfig()
			const root = getRoot()
			if (!config || !root) {
				log?.appendLine("[AFX] getFeatures: no config or root")
				return []
			}
			try {
				log?.appendLine(`[AFX] Building features from ${config.paths.specs}...`)
				cachedFeatures = await buildFeatures(config, root)
				log?.appendLine(
					`[AFX] Built ${cachedFeatures.length} features: [${cachedFeatures.map((f) => f.name).join(", ")}]`,
				)
				return cachedFeatures
			} catch (err) {
				log?.appendLine(`[AFX] ERROR building features: ${err instanceof Error ? err.stack : String(err)}`)
				return []
			}
		},

		refresh() {
			cachedFeatures = undefined
		},
	}
}

export type SpecsDataProvider = ReturnType<typeof createSpecsDataProvider>

// Pipeline rows from features

export function featureToPipelineRow(f: Feature): PipelineRow {
	return {
		name: f.name,
		specStatus: f.spec?.frontmatter.status ?? "—",
		designStatus: f.design?.frontmatter.status ?? "—",
		tasksStatus: f.tasks?.frontmatter.status ?? "—",
		completed: f.taskStats.completed,
		total: f.taskStats.total,
		featureStatus: f.status,
		specPath: f.spec?.path,
		designPath: f.design?.path,
		tasksPath: f.tasks?.path,
		specLastVerified: f.spec?.frontmatter.last_verified,
		designLastVerified: f.design?.frontmatter.last_verified,
		tasksLastVerified: f.tasks?.frontmatter.last_verified,
	}
}

// Feature tasks data

export function featureToTasksData(f: Feature): FeatureTasksData {
	return {
		name: f.name,
		tasksPath: f.tasks?.path,
		completed: f.taskStats.completed,
		total: f.taskStats.total,
		phases: f.taskStats.phases.map((p) => ({
			number: p.number,
			name: p.name,
			completed: p.completed,
			total: p.total,
			line: p.line,
			items: (p.items ?? []).map((item) => ({
				text: item.text,
				completed: item.completed,
				line: item.line,
			})),
		})),
		workSessions: f.taskStats.workSessions ?? [],
	}
}

// Journal entries from features

export function featureToJournalEntries(f: Feature): JournalEntry[] {
	if (!f.journal?.discussions) return []
	return f.journal.discussions.map((d) => ({
		id: d.id,
		date: d.date,
		title: d.title,
		status: d.status,
		feature: f.name,
		filePath: f.journal!.path,
		line: d.line,
		context: d.context,
		summary: d.summary,
		decisions: d.decisions,
	}))
}

// Scan all docs

export async function scanAllDocs(root: string): Promise<DocumentRow[]> {
	const rows: DocumentRow[] = []
	const seen = new Set<string>()
	const docsPattern = new vscode.RelativePattern(root, "docs/**/*")
	const files = await vscode.workspace.findFiles(docsPattern, "**/node_modules/**")

	for (const uri of files) {
		if (seen.has(uri.fsPath)) continue
		seen.add(uri.fsPath)
		try {
			const fileStat = await stat(uri.fsPath)
			const ext = path.extname(uri.fsPath).toLowerCase()
			const name = path.relative(root, uri.fsPath)
			let isAfx = false
			let type = ext.replace(".", "").toUpperCase()
			let status = ""
			let owner = ""

			if (ext === ".md") {
				try {
					const content = await readFile(uri.fsPath, "utf-8")
					const fm = parseFrontmatter(content, uri.fsPath)
					if (fm.afx) {
						isAfx = true
						type = fm.type ?? "DOC"
						status = fm.status ?? ""
						owner = fm.owner ?? ""
					}
				} catch {
					// skip
				}
			}

			rows.push({
				type,
				name,
				status,
				owner,
				filePath: uri.fsPath,
				isAfx,
				kind: ext.replace(".", ""),
				size: fileStat.size,
			})
		} catch {
			// skip unreadable
		}
	}

	return rows
}

// Ghost tasks (broken @see references)

const SEE_INLINE = /@see\s+(\S+)/g

export async function countGhostTasks(root: string, features: Feature[]): Promise<GhostTaskResult> {
	const items: GhostTaskResult["items"] = []

	for (const f of features) {
		if (!f.tasks?.path) continue
		try {
			const content = await readFile(f.tasks.path, "utf-8")
			const lines = content.split("\n")

			for (const line of lines) {
				if (!/^\s*-\s*\[[ x]\]/i.test(line)) continue

				SEE_INLINE.lastIndex = 0
				let m: RegExpExecArray | null
				while ((m = SEE_INLINE.exec(line)) !== null) {
					const target = m[1]
					if (target.startsWith("#") || target.startsWith("http")) continue

					const targetPath = target.split("#")[0]
					const absPath = path.resolve(path.dirname(f.tasks.path), targetPath)
					try {
						await stat(absPath)
					} catch {
						items.push({
							feature: f.name,
							task: line.replace(/^\s*-\s*\[[ x]\]\s*/i, "").trim(),
							target,
						})
					}
				}
			}
		} catch {
			// skip unreadable
		}
	}

	return { count: items.length, items }
}
