// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * Standalone AFX code action provider — registered separately from agenticflowx's
 * CodeActionProvider. VS Code merges actions from multiple providers automatically.
 *
 * Context-aware: detects spec files vs code files and shows appropriate actions.
 * - Code files: Verify, Trace, Add @see (Phase 3)
 * - Spec files: Review, Validate, Approve, Discuss (Phase 4G)
 * - Task lines: Dispatch to Copilot/AFX/Claude (Phase 4G)
 *
 * @see docs/specs/18-vscode-agenticflowx-ide-providers/design.md [DES-CODE-ACTIONS]
 * @see docs/specs/18-vscode-agenticflowx-ide-providers/tasks.md [5]
 */

import * as vscode from "vscode"
import { EditorUtils } from "../../integrations/editor/EditorUtils"

// --- Code-level actions (Phase 3) ---

const CODE_ACTIONS = {
	afxVerifySpec: {
		title: "Verify with AFX Spec",
		template: (p: ActionParams) =>
			`Verify this code from ${p.filePath}:${p.startLine}-${p.endLine} against the AFX spec. Check that @see links are valid, implementation matches spec requirements, and all referenced tasks are complete.\n\`\`\`\n${p.selectedText}\n\`\`\``,
	},
	afxCheckTrace: {
		title: "Check @see Traceability",
		template: (p: ActionParams) =>
			`Check @see traceability for ${p.filePath}:${p.startLine}-${p.endLine}. Verify all functions and classes have proper @see annotations linking to spec documents in docs/specs/.\n\`\`\`\n${p.selectedText}\n\`\`\``,
	},
	afxAddSeeLink: {
		title: "Add @see Link",
		template: (p: ActionParams) =>
			`Add appropriate @see annotations to this code from ${p.filePath}:${p.startLine}-${p.endLine}. Link to the relevant spec, design, or tasks documents in docs/specs/. Follow the format: @see docs/specs/{feature}/{document}.md#{section}\n\`\`\`\n${p.selectedText}\n\`\`\``,
	},
} as const

// --- Spec-level actions (Phase 4G) ---

const SPEC_ACTIONS: Record<string, Record<string, { title: string; template: (p: SpecActionParams) => string }>> = {
	spec: {
		afxReviewSpec: {
			title: "Review Spec",
			template: (p) =>
				`Review the spec at ${p.filePath}. Check for completeness, clarity, missing acceptance criteria, and consistency with design.md.\n\`\`\`\n${p.selectedText}\n\`\`\``,
		},
		afxValidateSpec: {
			title: "Validate Structure",
			template: (p) =>
				`Validate the AFX spec structure at ${p.filePath}. Check frontmatter schema (afx: true, type, status, owner), required sections, and cross-references to design.md and tasks.md.`,
		},
		afxApproveSpec: {
			title: "Approve Spec",
			template: (p) =>
				`Validate and approve the spec at ${p.filePath}. Run full validation (frontmatter, required sections, cross-refs). If valid, update the frontmatter: status: Draft → status: Approved, set last_verified to now (ISO 8601). If invalid, report what needs fixing.`,
		},
	},
	design: {
		afxReviewDesign: {
			title: "Review Design",
			template: (p) =>
				`Review the design document at ${p.filePath}. Check alignment with spec.md, technical completeness, and consistency.\n\`\`\`\n${p.selectedText}\n\`\`\``,
		},
		afxDiscussSection: {
			title: "Discuss Section",
			template: (p) =>
				`Start a discussion about this section from ${p.filePath}:${p.startLine}-${p.endLine}. Log the discussion to journal.md with an auto-generated ID. Include the selected text as context.\n\`\`\`\n${p.selectedText}\n\`\`\``,
		},
	},
	tasks: {
		afxReviewProgress: {
			title: "Review Progress",
			template: (p) =>
				`Review task progress for feature "${p.feature}" at ${p.filePath}. Summarize completed vs remaining work, identify blockers, and suggest next steps.`,
		},
		afxPickNextTask: {
			title: "Pick Next Task",
			template: (p) =>
				`Read ${p.filePath} and identify the next unchecked task. Show its details, acceptance criteria from the spec, and relevant design context. Then ask if I want to start working on it.`,
		},
	},
	journal: {
		afxPromoteToAdr: {
			title: "Promote to ADR",
			template: (p) =>
				`Promote this discussion from ${p.filePath}:${p.startLine}-${p.endLine} to a formal Architecture Decision Record (ADR). Create an ADR file in docs/adr/ following the standard template.\n\`\`\`\n${p.selectedText}\n\`\`\``,
		},
		afxSummarizeSession: {
			title: "Summarize Session",
			template: (p) =>
				`Summarize the recent discussions in ${p.filePath}. Group by topic, highlight key decisions, and identify open items.`,
		},
	},
}

type CodeActionId = keyof typeof CODE_ACTIONS

interface ActionParams {
	filePath: string
	selectedText: string
	startLine: number
	endLine: number
}

interface SpecActionParams extends ActionParams {
	feature: string
	docType: string
}

// Custom kinds for visual grouping in the lightbulb menu
const AFX_SPEC_KIND = vscode.CodeActionKind.QuickFix.append("afxSpec")
const AFX_DISPATCH_KIND = vscode.CodeActionKind.RefactorRewrite.append("afxDispatch")

class AfxCodeActionProvider implements vscode.CodeActionProvider {
	public static readonly providedCodeActionKinds = [vscode.CodeActionKind.QuickFix, AFX_SPEC_KIND, AFX_DISPATCH_KIND]

	provideCodeActions(
		document: vscode.TextDocument,
		range: vscode.Range | vscode.Selection,
	): vscode.ProviderResult<vscode.CodeAction[]> {
		try {
			const effectiveRange = EditorUtils.getEffectiveRange(document, range)
			if (!effectiveRange) return []

			const filePath = EditorUtils.getFilePath(document)
			const startLine = effectiveRange.range.start.line + 1
			const endLine = effectiveRange.range.end.line + 1

			// Detect if this is a spec file
			const specMatch = filePath.match(/docs\/specs\/([^/]+)\/(spec|design|tasks|journal)\.md$/)

			if (specMatch) {
				const [, feature, docType] = specMatch
				return this.getSpecActions(filePath, effectiveRange.text, startLine, endLine, feature, docType)
			}

			// Code-level actions
			const args = [filePath, effectiveRange.text, startLine, endLine]
			return Object.entries(CODE_ACTIONS).map(([id, { title }]) => {
				const action = new vscode.CodeAction(title, vscode.CodeActionKind.QuickFix)
				action.command = { command: `agenticflowx.${id}`, title, arguments: args }
				return action
			})
		} catch {
			return []
		}
	}

	private getSpecActions(
		filePath: string,
		selectedText: string,
		startLine: number,
		endLine: number,
		feature: string,
		docType: string,
	): vscode.CodeAction[] {
		const actions: vscode.CodeAction[] = []
		const specActions = SPEC_ACTIONS[docType]
		if (!specActions) return []

		const args = [filePath, selectedText, startLine, endLine, feature, docType]

		for (const [id, { title }] of Object.entries(specActions)) {
			const action = new vscode.CodeAction(title, AFX_SPEC_KIND)
			action.command = { command: `agenticflowx.${id}`, title, arguments: args }
			actions.push(action)
		}

		// Add "Discuss Selection" for any spec file with selected text
		if (selectedText.trim().length > 0) {
			const discussAction = new vscode.CodeAction("Discuss Selection", AFX_SPEC_KIND)
			discussAction.command = {
				command: "agenticflowx.afxDiscussSection",
				title: "Discuss Selection",
				arguments: args,
			}
			actions.push(discussAction)
		}

		// Task dispatch: detect "- [ ] X.Y ..." lines in tasks.md
		if (docType === "tasks") {
			const taskMatch = selectedText.match(/^-\s*\[\s*\]\s*(\S+)\s+(.+)$/m)
			if (taskMatch) {
				const taskId = taskMatch[1]
				const dispatchArgs = [taskId, feature]

				const dispatchActions: Array<{ id: string; title: string }> = [
					{ id: "afxDispatchAfx", title: "Code in AgenticFlowX" },
					{ id: "afxDispatchCopilot", title: "Code in Copilot Chat" },
					{ id: "afxDispatchClaudePanel", title: "Code in Claude Code (Editor Tab)" },
					{ id: "afxDispatchClaudeSidebar", title: "Code in Claude Code (Sidebar)" },
					{ id: "afxDispatchClaudeTerminal", title: "Code in Claude Code (Terminal)" },
					{ id: "afxDispatchCodexPanel", title: "Code in OpenAI Codex (Editor Tab)" },
					{ id: "afxDispatchCodexSidebar", title: "Code in OpenAI Codex (Sidebar)" },
					{ id: "afxDispatchCodexThread", title: "Code in OpenAI Codex (Add to Thread)" },
					{ id: "afxDispatchCodexTerminal", title: "Code in OpenAI Codex (Terminal)" },
					{ id: "afxDispatchGemini", title: "Code in Gemini Code Assist" },
				]
				for (const { id, title } of dispatchActions) {
					const action = new vscode.CodeAction(title, AFX_DISPATCH_KIND)
					action.command = { command: `agenticflowx.${id}`, title, arguments: dispatchArgs }
					actions.push(action)
				}
			}
		}

		return actions
	}
}

async function handleAction(actionId: string, ...args: any[]): Promise<void> {
	let filePath: string
	let selectedText: string
	let startLine: number
	let endLine: number
	let feature = ""
	let docType = ""

	if (args.length >= 6) {
		;[filePath, selectedText, startLine, endLine, feature, docType] = args
	} else if (args.length >= 4) {
		;[filePath, selectedText, startLine, endLine] = args
	} else {
		const ctx = EditorUtils.getEditorContext()
		if (!ctx) return
		;({ filePath, selectedText } = ctx)
		startLine = ctx.startLine ?? 1
		endLine = ctx.endLine ?? 1
	}

	const params: SpecActionParams = { filePath, selectedText, startLine, endLine, feature, docType }

	// Try code actions first
	const codeAction = CODE_ACTIONS[actionId as CodeActionId]
	const prompt = codeAction
		? codeAction.template(params)
		: (findSpecTemplate(actionId)?.(params) ?? `AFX action "${actionId}" on ${filePath}:${startLine}-${endLine}`)

	try {
		const { AfxProvider } = await import("../../core/webview/AfxProvider")
		const provider = await AfxProvider.getInstance()
		if (!provider) return
		await provider.createTask(prompt)
	} catch (error) {
		console.error(`[AFX] Failed to create task for ${actionId}:`, error)
	}
}

function findSpecTemplate(actionId: string): ((p: SpecActionParams) => string) | undefined {
	for (const actions of Object.values(SPEC_ACTIONS)) {
		if (actions[actionId]) return actions[actionId].template
	}
	return undefined
}

export function createAfxCodeActionProvider(
	_context: vscode.ExtensionContext,
	log: vscode.OutputChannel,
): { disposables: vscode.Disposable[] } {
	const provider = new AfxCodeActionProvider()
	const disposables: vscode.Disposable[] = []

	// Register the provider
	disposables.push(
		vscode.languages.registerCodeActionsProvider({ pattern: "**/*" }, provider, {
			providedCodeActionKinds: AfxCodeActionProvider.providedCodeActionKinds,
		}),
	)

	// Register code action command handlers
	const allActionIds = [
		...Object.keys(CODE_ACTIONS),
		...Object.values(SPEC_ACTIONS).flatMap((actions) => Object.keys(actions)),
	]

	for (const actionId of allActionIds) {
		disposables.push(
			vscode.commands.registerCommand(`agenticflowx.${actionId}`, (...args: any[]) =>
				handleAction(actionId, ...args),
			),
		)
	}

	// Register dispatch commands
	const dispatchTargets = {
		afxDispatchCopilot: "copilot",
		afxDispatchAfx: "agenticflowx",
		afxDispatchClaudePanel: "claude-panel",
		afxDispatchClaudeSidebar: "claude-sidebar",
		afxDispatchClaudeTerminal: "claude-terminal",
		afxDispatchCodexPanel: "codex-panel",
		afxDispatchCodexSidebar: "codex-sidebar",
		afxDispatchCodexThread: "codex-thread",
		afxDispatchCodexTerminal: "codex-terminal",
		afxDispatchGemini: "gemini",
	} as const
	for (const [cmdId, target] of Object.entries(dispatchTargets)) {
		disposables.push(
			vscode.commands.registerCommand(`agenticflowx.${cmdId}`, async (taskId: string, feature: string) => {
				const { dispatchTask } = await import("../dispatch/task-dispatch")
				await dispatchTask(taskId, feature, target as any, (msg) => log.appendLine(msg))
			}),
		)
	}

	return { disposables }
}
