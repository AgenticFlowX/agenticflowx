// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * Feature scanner — scans docs/specs/ for recent features.
 * Used by the welcome screen to show "Pick up where you left off".
 *
 * @see docs/specs/36-vscode-agenticflowx-focus-track-autopilot/spec.md [FR-14] [FR-15]
 * @see docs/specs/36-vscode-agenticflowx-focus-track-autopilot/design.md [DES-ARCH]
 */

import * as fs from "fs"
import * as path from "path"

import { parseTaskProgress, type TaskProgress } from "../../core/file-context/file-context-detector"

export interface FeatureSummary {
	name: string
	updatedAt: string
	artifact?: string
	completed?: number
	total?: number
}

/**
 * Scan docs/specs/ for recent features, sorted by most recently updated.
 * Reads updated_at from frontmatter across all .md files in each feature dir.
 * Returns the top N features.
 */
export function scanRecentFeatures(workspaceRoot: string, limit: number = 3): FeatureSummary[] {
	const specsDir = path.join(workspaceRoot, "docs/specs")
	if (!fs.existsSync(specsDir)) return []

	const features: FeatureSummary[] = []

	let dirs: fs.Dirent[]
	try {
		dirs = fs.readdirSync(specsDir, { withFileTypes: true })
	} catch {
		return []
	}

	for (const dir of dirs) {
		if (!dir.isDirectory()) continue

		const featurePath = path.join(specsDir, dir.name)
		let latestDate = ""
		let latestArtifact: string | undefined

		let files: string[]
		try {
			files = fs.readdirSync(featurePath)
		} catch {
			continue
		}

		for (const file of files) {
			if (!file.endsWith(".md")) continue
			try {
				const filePath = path.join(featurePath, file)
				const content = fs.readFileSync(filePath, "utf-8")

				// Extract updated_at from frontmatter
				const match = content.match(/^updated_at:\s*"?([^"\n]+)"?/m)
				if (match && match[1] > latestDate) {
					latestDate = match[1]
					latestArtifact = file.replace(".md", "")
				}
			} catch {
				// Skip unreadable files
			}
		}

		if (!latestDate) continue

		const taskProgress = parseTaskProgress(featurePath)

		features.push({
			name: dir.name,
			updatedAt: latestDate,
			artifact: latestArtifact,
			completed: taskProgress?.completed,
			total: taskProgress?.total,
		})
	}

	return features.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, limit)
}
