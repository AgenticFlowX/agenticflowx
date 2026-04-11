// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * Task dispatch — send a task to Copilot Chat, AgenticFlowX, or Claude Code terminal.
 * Shared logic used by both panel context menu and editor code actions.
 *
 * @see docs/specs/15-vscode-agenticflowx-copilot-chat/design.md [DES-DISPATCH]
 */

import * as vscode from "vscode"

export type DispatchTarget =
	| "copilot"
	| "agenticflowx"
	| "claude-panel"
	| "claude-sidebar"
	| "claude-terminal"
	| "codex-panel"
	| "codex-sidebar"
	| "codex-terminal"
	| "codex-thread"
	| "gemini"

export async function dispatchTask(
	taskId: string,
	feature: string,
	target: DispatchTarget,
	log?: (msg: string) => void,
): Promise<void> {
	const command = `/afx-dev code task ${taskId} for feature ${feature}`

	switch (target) {
		case "copilot":
			await dispatchToCopilot(feature, command, log)
			break
		case "agenticflowx":
			await dispatchToAfx(command, log)
			break
		case "claude-panel":
			await dispatchToClaudePanel(command, log)
			break
		case "claude-sidebar":
			await dispatchToClaudeSidebar(command, log)
			break
		case "claude-terminal":
			await dispatchToClaudeTerminal(command, log)
			break
		case "codex-panel":
			await dispatchToCodexPanel(command, log)
			break
		case "codex-sidebar":
			await dispatchToCodexSidebar(command, log)
			break
		case "codex-terminal":
			await dispatchToCodexTerminal(command, log)
			break
		case "codex-thread":
			await dispatchToCodexThread(command, log)
			break
		case "gemini":
			await dispatchToGemini(command, log)
			break
	}
}

async function dispatchToCopilot(_feature: string, command: string, log?: (msg: string) => void): Promise<void> {
	try {
		await vscode.commands.executeCommand("workbench.action.chat.open", {
			query: `@afx ${command}`,
		})
		log?.(`[AFX] Dispatched to Copilot Chat: ${command}`)
	} catch (err) {
		// Copilot Chat not available — fallback to notification
		vscode.window
			.showWarningMessage(`Copilot Chat not available. Command: ${command}`, "Copy Command")
			.then((action) => {
				if (action === "Copy Command") {
					vscode.env.clipboard.writeText(command)
				}
			})
		log?.(`[AFX] Copilot Chat unavailable: ${err instanceof Error ? err.message : String(err)}`)
	}
}

async function dispatchToAfx(command: string, log?: (msg: string) => void): Promise<void> {
	try {
		const { AfxProvider } = await import("../../core/webview/afx-provider")
		const provider = await AfxProvider.getInstance()
		if (!provider) {
			vscode.window.showWarningMessage("AgenticFlowX not available.")
			return
		}
		await provider.createTask(command)
		log?.(`[AFX] Dispatched to AgenticFlowX: ${command}`)
	} catch (err) {
		log?.(`[AFX] AgenticFlowX dispatch failed: ${err instanceof Error ? err.message : String(err)}`)
	}
}

async function dispatchToClaudePanel(command: string, log?: (msg: string) => void): Promise<void> {
	try {
		// Open Claude Code in editor tab (new tab)
		await vscode.commands.executeCommand("claude-vscode.editor.open")
		await vscode.commands.executeCommand("claude-vscode.newConversation")
		await vscode.commands.executeCommand("claude-vscode.focus")
		await vscode.env.clipboard.writeText(command)
		vscode.window.showInformationMessage("AFX: Command copied. Paste into Claude Code to send.", "OK")
		log?.(`[AFX] Dispatched to Claude Code editor tab (clipboard): ${command}`)
	} catch {
		vscode.window.showWarningMessage("Claude Code extension not found. Falling back to terminal.")
		await dispatchToClaudeTerminal(command, log)
	}
}

async function dispatchToClaudeSidebar(command: string, log?: (msg: string) => void): Promise<void> {
	try {
		// Open Claude Code in sidebar
		await vscode.commands.executeCommand("claude-vscode.sidebar.open")
		await vscode.commands.executeCommand("claude-vscode.newConversation")
		await vscode.commands.executeCommand("claude-vscode.focus")
		await vscode.env.clipboard.writeText(command)
		vscode.window.showInformationMessage("AFX: Command copied. Paste into Claude Code sidebar to send.", "OK")
		log?.(`[AFX] Dispatched to Claude Code sidebar (clipboard): ${command}`)
	} catch {
		vscode.window.showWarningMessage("Claude Code extension not found. Falling back to terminal.")
		await dispatchToClaudeTerminal(command, log)
	}
}

async function dispatchToClaudeTerminal(command: string, log?: (msg: string) => void): Promise<void> {
	const existingTerminal = vscode.window.terminals.find((t) => t.name.toLowerCase().includes("claude"))
	const terminal = existingTerminal ?? vscode.window.createTerminal("Claude Code")
	terminal.show()
	terminal.sendText(`claude "${command}"`)
	log?.(`[AFX] Dispatched to Claude Code terminal: ${command}`)
}

async function dispatchToCodexPanel(command: string, log?: (msg: string) => void): Promise<void> {
	try {
		// openai.chatgpt extension: new agent panel
		await vscode.commands.executeCommand("chatgpt.newCodexPanel")
		await vscode.env.clipboard.writeText(command)
		vscode.window.showInformationMessage("AFX: Command copied. Paste into Codex to send.", "OK")
		log?.(`[AFX] Dispatched to Codex panel (clipboard): ${command}`)
	} catch {
		vscode.window.showWarningMessage("Codex extension not found. Falling back to terminal.")
		await dispatchToCodexTerminal(command, log)
	}
}

async function dispatchToCodexSidebar(command: string, log?: (msg: string) => void): Promise<void> {
	try {
		// openai.chatgpt extension: sidebar with new thread
		await vscode.commands.executeCommand("chatgpt.openSidebar")
		await vscode.commands.executeCommand("chatgpt.newChat")
		await vscode.env.clipboard.writeText(command)
		vscode.window.showInformationMessage("AFX: Command copied. Paste into Codex sidebar to send.", "OK")
		log?.(`[AFX] Dispatched to Codex sidebar (clipboard): ${command}`)
	} catch {
		vscode.window.showWarningMessage("Codex extension not found. Falling back to terminal.")
		await dispatchToCodexTerminal(command, log)
	}
}

async function dispatchToCodexThread(command: string, log?: (msg: string) => void): Promise<void> {
	try {
		// Try passing command directly via addToThread
		await vscode.commands.executeCommand("chatgpt.addToThread", command)
		log?.(`[AFX] Dispatched to Codex thread: ${command}`)
	} catch {
		// Fallback: open sidebar + clipboard
		vscode.window.showWarningMessage("addToThread failed. Falling back to sidebar.")
		await dispatchToCodexSidebar(command, log)
	}
}

async function dispatchToCodexTerminal(command: string, log?: (msg: string) => void): Promise<void> {
	const existingTerminal = vscode.window.terminals.find((t) => t.name.toLowerCase().includes("codex"))
	const terminal = existingTerminal ?? vscode.window.createTerminal("OpenAI Codex")
	terminal.show()
	terminal.sendText(`codex "${command}"`)
	log?.(`[AFX] Dispatched to Codex terminal: ${command}`)
}

async function dispatchToGemini(command: string, log?: (msg: string) => void): Promise<void> {
	try {
		// Gemini Code Assist uses its own chat participant or panel
		// Try gemini-code-assist extension first
		await vscode.commands.executeCommand("geminicodeassist.chat.open")
		await vscode.env.clipboard.writeText(command)
		vscode.window.showInformationMessage("AFX: Command copied. Paste into Gemini Code Assist to send.", "OK")
		log?.(`[AFX] Dispatched to Gemini Code Assist (clipboard): ${command}`)
	} catch {
		// Fallback: try Copilot Chat @gemini if available
		try {
			await vscode.commands.executeCommand("workbench.action.chat.open", {
				query: command,
			})
			log?.(`[AFX] Dispatched to Gemini via Copilot Chat fallback: ${command}`)
		} catch {
			await vscode.env.clipboard.writeText(command)
			vscode.window.showWarningMessage("Gemini not available. Command copied to clipboard.")
			log?.(`[AFX] Gemini dispatch failed — copied to clipboard: ${command}`)
		}
	}
}
