// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

/**
 * Focus Track lean prompt builder.
 * Produces a system prompt with only 3 sections: role + artifacts + skills listing.
 * Used when modeConfig.track === "focus" instead of the full 12-section General prompt.
 *
 * @see docs/specs/vscode-agenticflowx-focus-track/spec.md [FR-6] [NFR-1]
 * @see docs/specs/vscode-agenticflowx-focus-track/design.md [DES-PROMPT]
 */

import * as path from "path"

import type { ModeConfig } from "@agenticflowx/types"

import type { SkillsManager } from "../../services/skills/SkillsManager"

import { loadSpecArtifacts, resolveFeatureDir } from "./load-spec-artifacts"
import { getSkillsSection } from "./sections/skills"

/**
 * Build a lean system prompt for Focus Track modes.
 *
 * Output: roleDefinition + specArtifacts (if specContext set) + skills listing
 * Target: ~500-1,000 tokens (fits within 4K context models)
 */
export async function buildFocusPrompt(
	modeConfig: ModeConfig,
	cwd: string,
	skillsManager?: SkillsManager,
): Promise<string> {
	const parts: string[] = []

	// 1. Short role definition (~50 tokens)
	parts.push(modeConfig.roleDefinition)

	// 2. Load only the spec artifacts this mode needs
	let loadedArtifacts: string[] = []
	if (modeConfig.specContext?.length) {
		const artifacts = await loadSpecArtifacts(cwd, modeConfig.specContext)
		if (artifacts) {
			parts.push(artifacts)
			loadedArtifacts = modeConfig.specContext
		}
	}

	// 3. Context orientation — acknowledge feature + loaded artifacts (~50 tokens)
	// @see docs/specs/vscode-agenticflowx-focus-track/spec.md [FR-6]
	// @see docs/specs/vscode-agenticflowx-focus-track/tasks.md [1.9]
	const featureDir = await resolveFeatureDir(cwd)
	if (featureDir) {
		const featureName = path.basename(featureDir)
		const artifactList = loadedArtifacts.length > 0 ? loadedArtifacts.join(", ") : "none"
		parts.push(
			`CONTEXT ORIENTATION\nYou are operating in the context of the "${featureName}" feature. Loaded spec artifacts: ${artifactList}. Begin your response by briefly acknowledging the feature and artifacts you are working with.`,
		)
	}

	// 4. Skills section — filtered by modeSlugs for this mode
	if (skillsManager) {
		const skillsSection = await getSkillsSection(skillsManager, modeConfig.slug)
		if (skillsSection) {
			parts.push(skillsSection)
		}
	}

	return parts.join("\n\n")
}
