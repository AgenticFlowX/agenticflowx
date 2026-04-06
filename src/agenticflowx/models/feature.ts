// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * Feature model — represents a spec-driven feature with its 4 documents.
 *
 * @see docs/specs/16-vscode-agenticflowx-core/design.md#models
 */

import * as path from "path"
import { access, constants, readdir } from "fs/promises"
import type { AfxConfig } from "./config"
import type { SpecDocument, TaskStats, Discussion } from "./spec-document"
import { parseSpecDocument } from "../services/spec-parser/spec-document-parser"

export type FeatureStatus = "Not Started" | "In Progress" | "Complete" | "Draft" | "Approved" | "Living" | "Stable"

export interface Feature {
	name: string
	prefix: string
	dirPath: string
	spec?: SpecDocument
	design?: SpecDocument
	tasks?: SpecDocument
	journal?: SpecDocument
	taskStats: TaskStats
	discussions: Discussion[]
	status: FeatureStatus
}

const FRONTMATTER_STATUSES: FeatureStatus[] = ["Draft", "Approved", "Living", "Stable"]

export function deriveFeatureStatus(taskStats: TaskStats, frontmatterStatus?: string): FeatureStatus {
	if (taskStats.total > 0 && taskStats.completed > 0) {
		return taskStats.completed >= taskStats.total ? "Complete" : "In Progress"
	}
	if (frontmatterStatus && FRONTMATTER_STATUSES.includes(frontmatterStatus as FeatureStatus)) {
		return frontmatterStatus as FeatureStatus
	}
	return "Draft"
}

async function fileExists(filePath: string): Promise<boolean> {
	try {
		await access(filePath, constants.R_OK)
		return true
	} catch {
		return false
	}
}

async function tryParseDocument(filePath: string, expectedType: string): Promise<SpecDocument | undefined> {
	if (!(await fileExists(filePath))) {
		return undefined
	}
	return parseSpecDocument(filePath, expectedType)
}

async function buildFeature(name: string, prefix: string, dirPath: string): Promise<Feature> {
	const [spec, design, tasks, journal] = await Promise.all([
		tryParseDocument(path.join(dirPath, "spec.md"), "SPEC"),
		tryParseDocument(path.join(dirPath, "design.md"), "DESIGN"),
		tryParseDocument(path.join(dirPath, "tasks.md"), "TASKS"),
		tryParseDocument(path.join(dirPath, "journal.md"), "JOURNAL"),
	])

	const taskStats = tasks?.taskStats ?? { total: 0, completed: 0, phases: [] }
	const discussions = journal?.discussions ?? []
	const status = deriveFeatureStatus(taskStats, spec?.frontmatter.status)

	return { name, prefix, dirPath, spec, design, tasks, journal, taskStats, discussions, status }
}

export async function buildFeatures(config: AfxConfig, workspaceRoot: string): Promise<Feature[]> {
	const specsDir = path.join(workspaceRoot, config.paths.specs)

	let discovered: string[] = []
	try {
		const entries = await readdir(specsDir, { withFileTypes: true })
		discovered = entries.filter((e) => e.isDirectory()).map((e) => e.name)
	} catch {
		// specs dir doesn't exist — fall back to config list only
	}

	const configSet = new Set(config.features)
	const merged = [...config.features, ...discovered.filter((d) => !configSet.has(d))]

	return Promise.all(
		merged.map((name) => {
			const dirPath = path.join(specsDir, name)
			const prefix = config.prefixes[name] ?? ""
			return buildFeature(name, prefix, dirPath)
		}),
	)
}

// Auto-discovery

const CANDIDATE_SPECS_DIRS = ["docs/specs", "specs", "docs/features"]

async function hasAfxContent(dirPath: string): Promise<boolean> {
	try {
		const entries = await readdir(dirPath, { withFileTypes: true })
		const subdirs = entries.filter((e) => e.isDirectory())

		for (const subdir of subdirs) {
			const subPath = path.join(dirPath, subdir.name)
			const subEntries = await readdir(subPath)
			for (const file of subEntries) {
				if (!file.endsWith(".md")) continue
				try {
					const { readFile } = await import("fs/promises")
					const content = await readFile(path.join(subPath, file), "utf-8")
					const lines = content.split("\n", 10)
					if (lines[0]?.trim() === "---") {
						for (let i = 1; i < lines.length; i++) {
							if (lines[i].trim() === "---") break
							if (/^afx:\s*true\b/.test(lines[i])) return true
						}
					}
				} catch {
					// skip
				}
			}
		}
	} catch {
		// dir doesn't exist
	}
	return false
}

export async function autoDiscoverSpecsDir(workspaceRoot: string): Promise<string | undefined> {
	for (const candidate of CANDIDATE_SPECS_DIRS) {
		const absPath = path.join(workspaceRoot, candidate)
		if ((await fileExists(absPath)) && (await hasAfxContent(absPath))) {
			return candidate
		}
	}
	return undefined
}
