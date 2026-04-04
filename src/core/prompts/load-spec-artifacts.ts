// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

/**
 * Selective spec artifact loader for Focus Track modes.
 * Resolves the active feature's spec directory and loads only the declared artifacts.
 *
 * @see docs/specs/vscode-agenticflowx-focus-track/spec.md [FR-7]
 * @see docs/specs/vscode-agenticflowx-focus-track/design.md [DES-ARTIFACT]
 */

import * as path from "path"
import * as fs from "fs/promises"

import * as vscode from "vscode"

type SpecArtifact = "spec" | "design" | "tasks" | "journal"

/**
 * Load only the declared spec artifacts for a Focus mode.
 *
 * @param cwd - Workspace root directory
 * @param specContext - Which artifacts to load (e.g., ["design", "spec"])
 * @returns Formatted artifact content or null if no feature directory found
 */
export async function loadSpecArtifacts(cwd: string, specContext: SpecArtifact[]): Promise<string | null> {
	const featureDir = await resolveFeatureDir(cwd)
	if (!featureDir) return null

	const parts: string[] = []
	for (const artifact of specContext) {
		const filePath = path.join(featureDir, `${artifact}.md`)
		const content = await readFileIfExists(filePath)
		if (content) {
			parts.push(`## ${artifact.toUpperCase()}\n\n${content}`)
		}
	}

	return parts.length > 0 ? parts.join("\n\n---\n\n") : null
}

/**
 * Resolve the feature spec directory from the active editor context.
 *
 * Priority order:
 * 1. Active editor file — if inside docs/specs/{feature}/, use that directory
 * 2. @see annotation — if active file has @see docs/specs/{feature}/..., use that feature
 * 3. Fallback — return null (caller handles gracefully)
 *
 * @see docs/specs/vscode-agenticflowx-focus-track/spec.md [FR-6]
 * @see docs/specs/vscode-agenticflowx-focus-track/tasks.md [1.9]
 */
export async function resolveFeatureDir(cwd: string): Promise<string | null> {
	const activeEditor = vscode.window.activeTextEditor
	if (!activeEditor) return null

	const filePath = activeEditor.document.uri.fsPath

	// Check if active file is inside docs/specs/{feature}/
	const specsDir = path.join(cwd, "docs", "specs")
	if (filePath.startsWith(specsDir)) {
		// Extract feature directory: docs/specs/{feature}/anything → docs/specs/{feature}
		const relative = path.relative(specsDir, filePath)
		const featureName = relative.split(path.sep)[0]
		if (featureName) {
			const featurePath = path.join(specsDir, featureName)
			try {
				const stat = await fs.stat(featurePath)
				if (stat.isDirectory()) {
					return featurePath
				}
			} catch {
				// Directory doesn't exist
			}
		}
	}

	// Check for @see docs/specs/{feature}/ annotation in active file
	try {
		const doc = activeEditor.document
		const maxLines = Math.min(doc.lineCount, 30)
		for (let i = 0; i < maxLines; i++) {
			const line = doc.lineAt(i).text
			const match = line.match(/@see\s+docs\/specs\/([^/\s]+)\//)
			if (match) {
				const featurePath = path.join(cwd, "docs", "specs", match[1])
				try {
					const stat = await fs.stat(featurePath)
					if (stat.isDirectory()) {
						return featurePath
					}
				} catch {
					// Directory doesn't exist
				}
			}
		}
	} catch {
		// File read error
	}

	return null
}

async function readFileIfExists(filePath: string): Promise<string | null> {
	try {
		return await fs.readFile(filePath, "utf-8")
	} catch {
		return null
	}
}
