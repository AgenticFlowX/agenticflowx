// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

import * as vscode from "vscode"
import { WebviewMessage } from "../../shared/webview-message"
import { defaultModeSlug } from "../../shared/modes"
import { buildApiHandler } from "../../api"

import { SYSTEM_PROMPT } from "../prompts/system"
import { MultiSearchReplaceDiffStrategy } from "../diff/strategies/multi-search-replace"
import { Package } from "../../shared/package"

import { AfxProvider } from "./afx-provider"

export const generateSystemPrompt = async (provider: AfxProvider, message: WebviewMessage) => {
	const {
		apiConfiguration,
		customModePrompts,
		customInstructions,
		mcpEnabled,
		experiments,
		language,
		enableSubfolderRules,
	} = await provider.getState()

	const diffStrategy = new MultiSearchReplaceDiffStrategy()

	const cwd = provider.cwd

	const mode = message.mode ?? defaultModeSlug
	const customModes = await provider.customModesManager.getCustomModes()

	const afxIgnoreInstructions = provider.getCurrentTask()?.afxIgnoreController?.getInstructions()

	// Create a temporary API handler to check model info for stealth mode.
	// This avoids relying on an active Cline instance which might not exist during preview.
	let modelInfo: { isStealthModel?: boolean } | undefined
	try {
		const tempApiHandler = buildApiHandler(apiConfiguration)
		modelInfo = tempApiHandler.getModel().info
	} catch (error) {
		console.error("Error fetching model info for system prompt preview:", error)
	}

	const systemPrompt = await SYSTEM_PROMPT(
		provider.context,
		cwd,
		false, // supportsComputerUse — browser removed
		mcpEnabled ? provider.getMcpHub() : undefined,
		diffStrategy,
		mode,
		customModePrompts,
		customModes,
		customInstructions,
		experiments,
		language,
		afxIgnoreInstructions,
		{
			todoListEnabled: apiConfiguration?.todoListEnabled ?? true,
			useAgentRules: vscode.workspace.getConfiguration(Package.name).get<boolean>("useAgentRules") ?? true,
			enableSubfolderRules: enableSubfolderRules ?? false,
			newTaskRequireTodos: vscode.workspace
				.getConfiguration(Package.name)
				.get<boolean>("newTaskRequireTodos", false),
			isStealthModel: modelInfo?.isStealthModel,
		},
		undefined, // todoList
		undefined, // modelId
		provider.getSkillsManager(),
	)

	return systemPrompt
}
