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
 * @see docs/specs/vscode-agenticflowx-focus-track/spec.md [FR-4] [FR-8]
 * @see docs/specs/vscode-agenticflowx-focus-track/design.md [DES-FILEDETECT]
 */

import * as fs from "fs/promises"

/**
 * File context detection result.
 */
export interface FileContext {
	feature?: string
	artifact?: string
	suggestedMode?: string
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
 * Detect file context from a file path.
 * Returns the feature, artifact type, and suggested Focus mode.
 */
export function detectFileContext(filePath: string): FileContext {
	// Match spec artifacts: docs/specs/{feature}/{artifact}.md
	const specMatch = filePath.match(/docs\/specs\/([^/]+)\/(spec|design|tasks|journal)\.md$/)
	if (specMatch) {
		return {
			feature: specMatch[1],
			artifact: specMatch[2],
			suggestedMode: ARTIFACT_TO_MODE[specMatch[2]],
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
): Promise<FileContextAction> {
	const context = detectFileContext(filePath)

	// Spec/research/ADR files → auto-switch to Focus track
	const isSpecFile = /docs\/(specs|research|adr)\//.test(filePath)
	if (isSpecFile) {
		return {
			switchTrack: currentTrack === "general" ? "focus" : undefined,
			suggestedMode: context.suggestedMode,
			feature: context.feature,
			artifact: context.artifact,
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
