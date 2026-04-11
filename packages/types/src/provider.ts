// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0

import type { ExtensionMessage, ExtensionState } from "./vscode-extension-host.js"
import type { ModeConfig } from "./mode.js"

/**
 * Interface for provider capabilities needed by services (MCP, Skills, etc.).
 * Breaks the circular dependency between core/ and services/ — services depend
 * on this interface, AfxProvider implements it.
 *
 * @see docs/research/res-monorepo-plugin-migration.md
 */
export interface ITaskProvider {
	/** Current working directory / workspace path */
	readonly cwd: string

	/** Extension context — narrowed to only what services need */
	readonly context: {
		extension?: {
			packageJSON?: {
				version?: string
			}
		}
	}

	/** Custom modes manager — narrowed to what SkillsManager needs */
	readonly customModesManager: {
		getCustomModes(): Promise<ModeConfig[]>
	}

	/** Post a message to the webview UI */
	postMessageToWebview(message: ExtensionMessage): Promise<void>

	/** Ensure the MCP servers directory exists, return its path */
	ensureMcpServersDirectoryExists(): Promise<string>

	/** Ensure the settings directory exists, return its path */
	ensureSettingsDirectoryExists(): Promise<string>

	/** Get the current extension state */
	getState(): Promise<
		Omit<
			ExtensionState,
			"afxMessages" | "renderContext" | "hasOpenedModeSelector" | "version" | "shouldShowAnnouncement"
		>
	>
}
