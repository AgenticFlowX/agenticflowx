// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * Spec Awareness Protocol — General mode agent instructions for detecting
 * conversation patterns that relate to existing specs or new spec material.
 *
 * @see docs/specs/36-vscode-agenticflowx-focus-track-autopilot/spec.md [FR-27] [FR-28] [FR-29] [FR-30]
 * @see docs/specs/36-vscode-agenticflowx-focus-track-autopilot/design.md [DES-UI]
 */

import * as fs from "fs"
import * as path from "path"

export function getSpecAwarenessSection(cwd: string): string {
	// Scan for existing feature names to build awareness
	const specsDir = path.join(cwd, "docs/specs")
	let featureList = ""
	try {
		if (fs.existsSync(specsDir)) {
			const dirs = fs.readdirSync(specsDir, { withFileTypes: true })
			const features = dirs.filter((d) => d.isDirectory()).map((d) => d.name)
			if (features.length > 0) {
				featureList = `\nKnown features: ${features.join(", ")}`
			}
		}
	} catch {
		// Silently skip if unreadable
	}

	if (!featureList) return ""

	return `
====

SPEC AWARENESS PROTOCOL (General Mode)

When in General track, monitor the conversation for spec-related signals:${featureList}

1. EXISTING SPEC MATCH: If the user's discussion relates to a feature that has a spec in docs/specs/, suggest grounding. Match by:
   - Feature directory name keywords (e.g., "auth" matches "auth-flow")
   - Topics covered in the spec's problem statement or requirements
   When detected, include in your response: [hint:specMatch:FEATURE_NAME]

2. NEW SPEC MATERIAL: If the user discusses requirements (user stories, acceptance criteria, "must", "should", functional descriptions) across 3+ messages with no matching spec, suggest capturing.
   When detected, include in your response: [hint:specCapture]

Rules:
- Show ONE hint per topic shift. Do not repeat if already shown.
- Never interrupt mid-thought. Wait for a natural pause.
- Advisory only — the user can always dismiss and continue in General.
- Prefer false negatives over false positives. When uncertain, stay silent.
`
}
