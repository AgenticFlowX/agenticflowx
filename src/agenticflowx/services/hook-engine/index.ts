// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * HookEngine — event-driven automation for spec lifecycle.
 * Receives events from agenticflowx (tool execution, task completion)
 * and dispatches to configured actions.
 *
 * @see docs/specs/17-vscode-agenticflowx-hook-engine/design.md#hook-engine
 */

import * as path from "path"
import type { HookConfig } from "../../models/config"
import type { Feature } from "../../models/feature"
import { createWriteCoordinator, type WriteCoordinator } from "./write-coordinator"
import { executeRefreshPanel } from "./actions/refresh-panel"
import { executeSuggestSeeLink } from "./actions/suggest-see-link"
import { toggleTaskCheckbox } from "./actions/toggle-checkbox"
import { appendSessionEntry } from "./actions/auto-log-session"

export interface HookEngineDeps {
	getHookConfig: () => HookConfig | undefined
	getRoot: () => string
	getActiveFeature: () => Promise<Feature | undefined>
	refreshPanel: () => void
	refreshSpecs: () => void
	log: (msg: string) => void
}

export function createHookEngine(deps: HookEngineDeps) {
	const writeCoordinator = createWriteCoordinator({
		refreshPanel: deps.refreshPanel,
		refreshSpecs: deps.refreshSpecs,
		log: deps.log,
	})

	async function onToolExecuted(toolName: string, params: Record<string, unknown>, _result: unknown): Promise<void> {
		const config = deps.getHookConfig()
		if (!config?.onFileCreated) return

		// Only fire suggest_see_link on write_to_file creating .ts in src/
		if (toolName === "write_to_file" && config.onFileCreated.action === "suggest_see_link") {
			const filePath = (params.path as string) ?? ""
			if (config.onFileCreated.match) {
				const matchPattern = config.onFileCreated.match
				// Simple glob check: "src/**/*.ts" → startsWith("src/") && endsWith(".ts")
				const parts = matchPattern.split("**/")
				const prefix = parts[0] ?? ""
				const suffix = (parts[1] ?? "").replace("*", "")
				if (filePath.startsWith(prefix) && filePath.endsWith(suffix)) {
					if (config.onFileCreated.mode === "suggest") {
						executeSuggestSeeLink(path.join(deps.getRoot(), filePath))
					}
				}
			}
		}
	}

	async function onTaskCompleted(taskId: string, filesModified: string[]): Promise<void> {
		const config = deps.getHookConfig()
		if (!config?.onTaskCompleted) return

		const feature = await deps.getActiveFeature()
		if (!feature) return

		const tasksFilePath = path.join(feature.dirPath, "tasks.md")

		// Toggle checkbox if configured
		if (config.onTaskCompleted.toggleCheckbox) {
			try {
				const result = await toggleTaskCheckbox(tasksFilePath, writeCoordinator)
				if (result) {
					deps.log(
						`[AFX] Hook: toggled task ${result.taskId} (${result.progress.completed}/${result.progress.total})`,
					)
				}
			} catch (err) {
				deps.log(`[AFX] Hook toggle error: ${err instanceof Error ? err.message : String(err)}`)
			}
		}

		// Auto-log session to journal.md
		if (
			config.onTaskCompleted.action === "auto_log_session" ||
			config.onTaskCompleted.action === "toggle_checkbox"
		) {
			try {
				const journalFilePath = path.join(feature.dirPath, "journal.md")
				const newId = await appendSessionEntry(
					journalFilePath,
					{
						timestamp: new Date().toISOString(),
						agent: "agenticflowx",
						taskId,
						summary: "Task completed",
						filesModified,
						feature: feature.name,
					},
					writeCoordinator,
				)
				deps.log(`[AFX] Hook: session ${newId} logged to journal.md for task ${taskId}`)
			} catch (err) {
				deps.log(`[AFX] Hook log error: ${err instanceof Error ? err.message : String(err)}`)
			}
		}
	}

	function onSpecChanged(): void {
		const config = deps.getHookConfig()
		if (config?.onSpecChanged?.action === "refresh_panel") {
			executeRefreshPanel(deps.refreshPanel)
		}
	}

	return { onToolExecuted, onTaskCompleted, onSpecChanged, writeCoordinator }
}

export type HookEngine = ReturnType<typeof createHookEngine>
