// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

/**
 * File context detector for Focus Track.
 * Detects the active file's type and suggests the matching Focus mode.
 * Also determines whether to auto-switch from General to Focus track.
 *
 * @see docs/specs/31-vscode-agenticflowx-focus-track/spec.md [FR-4] [FR-8]
 * @see docs/specs/31-vscode-agenticflowx-focus-track/design.md [DES-FILEDETECT]
 */

import * as fs from "fs/promises"
import * as fsSync from "fs"
import * as path from "path"

/**
 * File context detection result.
 */
/**
 * Task progress from parsing tasks.md checkboxes.
 *
 * @see docs/specs/36-vscode-agenticflowx-focus-track-autopilot/spec.md [FR-8] [FR-22] [FR-23]
 * @see docs/specs/36-vscode-agenticflowx-focus-track-autopilot/design.md [DES-ARCH]
 */
export interface TaskProgress {
	completed: number
	total: number
}

export interface FileContext {
	feature?: string
	artifact?: string
	suggestedMode?: string
	completed?: number
	total?: number
	filePath: string
}

/**
 * Action to take based on file context and current track.
 */
export interface FileContextAction {
	switchTrack?: "focus"
	suggestedMode?: string
	feature?: string
	artifact?: string
	completed?: number
	total?: number
}

/**
 * Map spec artifact types to Focus mode slugs.
 */
const ARTIFACT_TO_MODE: Record<string, string> = {
	spec: "focus-review-spec",
	design: "focus-review-design",
	tasks: "focus-review-tasks",
	journal: "focus-review-spec",
}

/**
 * Parse task progress from a feature's tasks.md by counting checkboxes.
 * Returns completed/total counts, or undefined if no tasks.md exists.
 *
 * @see docs/specs/36-vscode-agenticflowx-focus-track-autopilot/spec.md [FR-8] [FR-22] [FR-23]
 * @see docs/specs/36-vscode-agenticflowx-focus-track-autopilot/design.md [DES-ARCH]
 */
export function parseTaskProgress(featurePath: string): TaskProgress | undefined {
	const tasksPath = path.join(featurePath, "tasks.md")
	if (!fsSync.existsSync(tasksPath)) return undefined

	const content = fsSync.readFileSync(tasksPath, "utf-8")
	const checkboxes = content.match(/^- \[([ xX])\]/gm) ?? []
	const total = checkboxes.length
	const completed = checkboxes.filter((m) => m.includes("[x]") || m.includes("[X]")).length
	return { completed, total }
}

/**
 * Detect file context from a file path.
 * Returns the feature, artifact type, and suggested Focus mode.
 */
export function detectFileContext(filePath: string, workspaceRoot?: string): FileContext {
	// Match spec artifacts: docs/specs/{feature}/{artifact}.md
	const specMatch = filePath.match(/docs\/specs\/([^/]+)\/(spec|design|tasks|journal)\.md$/)
	if (specMatch) {
		const feature = specMatch[1]
		const artifact = specMatch[2]
		let completed: number | undefined
		let total: number | undefined

		if (workspaceRoot) {
			const featurePath = path.join(workspaceRoot, "docs/specs", feature)
			const taskProgress = parseTaskProgress(featurePath)
			completed = taskProgress?.completed
			total = taskProgress?.total
		}

		return {
			feature,
			artifact,
			suggestedMode: ARTIFACT_TO_MODE[artifact],
			completed,
			total,
			filePath,
		}
	}

	// Match research docs: docs/research/**
	if (/docs\/research\//.test(filePath)) {
		return { suggestedMode: "focus-research", filePath }
	}

	// Match ADR docs: docs/adr/**
	if (/docs\/adr\//.test(filePath)) {
		return { suggestedMode: "focus-review-spec", filePath }
	}

	// Match source files — check for @see annotations
	if (/\.tsx?$|\.jsx?$/.test(filePath)) {
		// Note: @see parsing is async — caller should use getFileContextAction() for full flow
		return { filePath }
	}

	// No match — default to Next
	return { suggestedMode: "focus-next", filePath }
}

/**
 * Get the action to take based on file context and current track.
 * Determines whether to auto-switch tracks and which mode to suggest.
 *
 * Rules:
 * - Spec/research/ADR files → auto-switch to Focus track
 * - Source files → suggest mode only if already on Focus track
 * - Other files → no action
 */
export async function getFileContextAction(
	filePath: string,
	currentTrack: "general" | "focus",
	workspaceRoot?: string,
): Promise<FileContextAction> {
	const context = detectFileContext(filePath, workspaceRoot)

	// Spec/research/ADR files → auto-switch to Focus track (transition only)
	// switchTrack is only set when transitioning from General → Focus, so the Auto-mode
	// confirmation ("Switched to Focus: X") only shows on the actual transition, not on
	// every subsequent spec-file browse while already in Focus.
	// @see docs/specs/36-vscode-agenticflowx-focus-track-autopilot/design.md [DES-UI]
	const isSpecFile = /docs\/(specs|research|adr)\//.test(filePath)
	if (isSpecFile) {
		return {
			switchTrack: currentTrack === "general" ? "focus" : undefined,
			suggestedMode: context.suggestedMode,
			feature: context.feature,
			artifact: context.artifact,
			completed: context.completed,
			total: context.total,
		}
	}

	// Source files → check for @see annotation, suggest mode only if on Focus track
	if (/\.tsx?$|\.jsx?$/.test(filePath)) {
		const seeAnnotation = await parseFirstSeeAnnotation(filePath)
		if (seeAnnotation && currentTrack === "focus") {
			return {
				suggestedMode: "focus-code",
				feature: seeAnnotation.feature,
			}
		}
	}

	// No action
	return {}
}

/**
 * Parse the first @see docs/specs/{feature}/ annotation from a source file.
 * Only reads the first 30 lines.
 */
async function parseFirstSeeAnnotation(filePath: string): Promise<{ feature: string } | null> {
	try {
		const content = await fs.readFile(filePath, "utf-8")
		const lines = content.split("\n").slice(0, 30)
		for (const line of lines) {
			const match = line.match(/@see\s+docs\/specs\/([^/\s]+)\//)
			if (match) {
				return { feature: match[1] }
			}
		}
	} catch {
		// File read error
	}
	return null
}
