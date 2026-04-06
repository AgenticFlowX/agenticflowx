// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * Self-contained AFX spec context injection for the system prompt.
 * Resolves AfxManager via global registry — no param threading needed.
 * Called via dynamic import from system.ts to avoid signature changes.
 *
 * @see docs/specs/14-vscode-agenticflowx-agent-tools/design.md [DES-SYSTEM-PROMPT]
 */

import { getGlobalAfxManager } from "../index"
import { getDecisionReplayBlock } from "../services/decision-replay"

export async function getAfxSpecContextSection(): Promise<string> {
	try {
		const afxManager = getGlobalAfxManager()
		if (!afxManager) return ""

		const context = await afxManager.getSpecContext()
		if (!context) return ""

		// Decision Replay — inject prior decisions for active feature
		let decisionBlock = ""
		try {
			const activeFeature = await afxManager.getActiveFeatureForReplay()
			if (activeFeature) {
				decisionBlock = getDecisionReplayBlock(activeFeature)
			}
		} catch {}

		const toolHint =
			"AFX tools available: use `list_tasks` to check progress, `read_spec` to read spec content, `update_task` to toggle checkboxes, `log_session` to log work."

		return `====

AFX SPECIFICATION CONTEXT

${context}

${toolHint}${decisionBlock ? `\n\n${decisionBlock}` : ""}`
	} catch {
		return ""
	}
}
