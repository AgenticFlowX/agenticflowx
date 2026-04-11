// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

import * as vscode from "vscode"

import { TerminalActionId, TerminalActionPromptType } from "@agenticflowx/types"

import { getTerminalCommand } from "../utils/commands"
import { AfxProvider } from "../core/webview/afx-provider"
import { Terminal } from "../integrations/terminal/terminal"
import { t } from "../i18n"

export const registerTerminalActions = (context: vscode.ExtensionContext) => {
	registerTerminalAction(context, "terminalAddToContext", "TERMINAL_ADD_TO_CONTEXT")
	registerTerminalAction(context, "terminalFixCommand", "TERMINAL_FIX")
	registerTerminalAction(context, "terminalExplainCommand", "TERMINAL_EXPLAIN")
}

const registerTerminalAction = (
	context: vscode.ExtensionContext,
	command: TerminalActionId,
	promptType: TerminalActionPromptType,
) => {
	context.subscriptions.push(
		vscode.commands.registerCommand(getTerminalCommand(command), async (args: any) => {
			let content = args?.selection

			if (!content || content === "") {
				content = await Terminal.getTerminalContents(promptType === "TERMINAL_ADD_TO_CONTEXT" ? -1 : 1)
			}

			if (!content) {
				vscode.window.showWarningMessage(t("common:warnings.no_terminal_content"))
				return
			}

			await AfxProvider.handleTerminalAction(command, promptType, {
				terminalContent: content,
			})
		}),
	)
}
