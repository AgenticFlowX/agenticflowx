// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * @afx chat participant for VS Code Copilot Chat.
 * Works in any VS Code with GitHub Copilot.
 *
 * Commands:
 *   @afx /status  — project overview with feature progress
 *   @afx /next    — next unchecked task with spec context
 *   @afx /spec    — show spec content for a feature
 *
 * Uses runtime detection — gracefully skips if chat API unavailable.
 *
 * @see docs/specs/15-vscode-agenticflowx-copilot-chat/design.md [DES-CHAT-PARTICIPANT]
 */

import * as vscode from "vscode"
import { getGlobalAfxManager } from "../index"
import type { Feature } from "../models/feature"

const PARTICIPANT_ID = "agenticflowx.chat"

export function registerAfxChatParticipant(
	context: vscode.ExtensionContext,
	log: vscode.OutputChannel,
): vscode.Disposable | undefined {
	// Runtime detection — chat API may not exist on older VS Code
	if (typeof vscode.chat?.createChatParticipant !== "function") {
		log.appendLine("[AFX] Chat participant API not available — skipping (requires VS Code 1.93+)")
		return undefined
	}

	const participant = vscode.chat.createChatParticipant(PARTICIPANT_ID, handleRequest)
	participant.iconPath = new vscode.ThemeIcon("symbol-structure")

	log.appendLine("[AFX] Chat participant @afx registered")

	return participant
}

async function handleRequest(
	request: vscode.ChatRequest,
	_context: vscode.ChatContext,
	response: vscode.ChatResponseStream,
	token: vscode.CancellationToken,
): Promise<void> {
	const afxManager = getGlobalAfxManager()

	if (!afxManager) {
		response.markdown("**AFX not active.** No `.afx.yaml` or `docs/specs/` found in this workspace.")
		return
	}

	const command = request.command ?? ""
	const query = request.prompt.trim()

	switch (command) {
		case "status":
			await handleStatus(response, token)
			break
		case "next":
			await handleNextTask(response, query, token)
			break
		case "spec":
			await handleShowSpec(response, query, token)
			break
		default:
			await handleFreeform(response, query, token)
			break
	}
}

async function handleStatus(response: vscode.ChatResponseStream, _token: vscode.CancellationToken): Promise<void> {
	const afxManager = getGlobalAfxManager()
	if (!afxManager) return

	const context = await afxManager.getSpecContext()
	if (!context) {
		response.markdown("No features found in this workspace.")
		return
	}

	response.markdown(`## AFX Project Status\n\n${context}`)
}

async function handleNextTask(
	response: vscode.ChatResponseStream,
	featureHint: string,
	_token: vscode.CancellationToken,
): Promise<void> {
	const afxManager = getGlobalAfxManager()
	if (!afxManager) return

	const feature = await resolveFeature(featureHint)
	if (!feature) {
		response.markdown("No active feature detected. Specify a feature: `@afx /next user-auth`")
		return
	}

	const nextTask = findNextUnchecked(feature)
	if (!nextTask) {
		response.markdown(`**${feature.name}**: All tasks complete!`)
		return
	}

	const lines = [
		`## Next Task: ${feature.name}`,
		"",
		`**Task:** ${nextTask}`,
		`**Phase:** ${feature.taskStats.phases.find((p) => p.completed < p.total)?.name ?? "Unknown"}`,
		`**Progress:** ${feature.taskStats.completed}/${feature.taskStats.total} (${Math.round((feature.taskStats.completed / feature.taskStats.total) * 100)}%)`,
		"",
		`Start with: \`/afx-dev code\` or right-click the task in tasks.md`,
	]

	response.markdown(lines.join("\n"))
}

async function handleShowSpec(
	response: vscode.ChatResponseStream,
	query: string,
	_token: vscode.CancellationToken,
): Promise<void> {
	const feature = await resolveFeature(query)
	if (!feature) {
		response.markdown("Specify a feature: `@afx /spec user-auth`")
		return
	}

	const lines = [
		`## ${feature.name}`,
		"",
		`**Spec:** ${feature.spec?.frontmatter.status ?? "Missing"}`,
		`**Design:** ${feature.design?.frontmatter.status ?? "Missing"}`,
		`**Tasks:** ${feature.taskStats.completed}/${feature.taskStats.total}`,
		"",
	]

	// Show spec section titles if available
	if (feature.spec?.sections && feature.spec.sections.length > 0) {
		lines.push("**Sections:**")
		for (const section of feature.spec.sections.slice(0, 10)) {
			lines.push(`${"  ".repeat(section.level - 1)}- ${section.title}`)
		}
		lines.push("")
	}

	lines.push(`Open: \`docs/specs/${feature.name}/spec.md\``)

	response.markdown(lines.join("\n"))
}

async function handleFreeform(
	response: vscode.ChatResponseStream,
	query: string,
	token: vscode.CancellationToken,
): Promise<void> {
	const afxManager = getGlobalAfxManager()
	if (!afxManager) return

	const context = await afxManager.getSpecContext()

	// Try to use vscode.lm for intelligent response
	try {
		const models = await vscode.lm.selectChatModels({ family: "gpt-4o" })
		const model = models[0]
		if (model) {
			const messages = [
				vscode.LanguageModelChatMessage.User(
					`You are AFX, a spec-driven development assistant. Here is the current project context:\n\n${context ?? "No spec context available."}\n\nUser question: ${query}`,
				),
			]
			const chatResponse = await model.sendRequest(messages, {}, token)
			for await (const fragment of chatResponse.text) {
				response.markdown(fragment)
			}
			return
		}
	} catch {
		// vscode.lm not available — fallback to static response
	}

	// Fallback: static context dump
	response.markdown(
		`## AFX Context\n\n${context ?? "No spec context available."}\n\nUse \`/status\`, \`/next\`, or \`/spec <feature>\` for specific queries.`,
	)
}

async function resolveFeature(hint: string): Promise<Feature | undefined> {
	const afxManager = getGlobalAfxManager()
	if (!afxManager) return undefined

	const feature = await afxManager.getActiveFeatureForReplay()

	// If hint provided, try to match by name
	if (hint) {
		const specsData = (afxManager as any).specsData
		if (specsData) {
			const features: Feature[] = await specsData.getFeatures()
			const match = features.find((f) => f.name === hint || f.name.includes(hint) || hint.includes(f.name))
			if (match) return match
		}
	}

	return feature
}

function findNextUnchecked(feature: Feature): string | undefined {
	for (const phase of feature.taskStats.phases) {
		const next = phase.items?.find((item) => !item.completed)
		if (next) return next.text
	}
	return undefined
}
