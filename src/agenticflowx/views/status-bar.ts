// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * AgenticFlowX status bar item.
 * Shows feature count, task progress, and health percentage.
 *
 * @see docs/specs/vscode-agenticflowx-panel/design.md#status-bar
 */

import * as vscode from "vscode"

export interface StatsData {
	featureCount: number
	completedTasks: number
	totalTasks: number
	inProgressCount: number
	docsCount?: number
}

export interface AfxStatusBar extends vscode.Disposable {
	update(data: StatsData): void
	show(): void
	hide(): void
}

export function createStatusBar(): AfxStatusBar {
	const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50)
	item.command = "agenticflowx.afxOpenPanel"
	item.name = "AFX Project Status"

	return {
		update(data: StatsData) {
			const { featureCount, completedTasks, totalTasks, inProgressCount, docsCount } = data

			if (featureCount === 0) {
				item.text = "$(book) AFX: No features"
				item.tooltip = "No AFX features configured\nClick to open panel"
				item.color = undefined
				return
			}

			const pct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
			const icon = pct >= 80 ? "$(check)" : pct >= 40 ? "$(warning)" : "$(error)"

			item.text = `${icon} AFX: ${featureCount} features · ${completedTasks}/${totalTasks} · ${pct}%`

			if (pct >= 80) {
				item.color = new vscode.ThemeColor("charts.green")
			} else if (pct >= 40) {
				item.color = new vscode.ThemeColor("charts.yellow")
			} else {
				item.color = undefined
			}

			const tip = new vscode.MarkdownString()
			tip.isTrusted = true
			tip.supportThemeIcons = true
			const lines = [
				"**AFX Project Status**",
				"",
				"| | |",
				"|---|---|",
				`| Features | ${featureCount} (${inProgressCount} in progress) |`,
				`| Tasks | ${completedTasks}/${totalTasks} (${pct}%) |`,
			]
			if (docsCount !== undefined) {
				lines.push(`| Docs | ${docsCount} scanned |`)
			}
			lines.push("", "_Click to open panel_")
			tip.appendMarkdown(lines.join("\n"))
			item.tooltip = tip
		},
		show() {
			item.show()
		},
		hide() {
			item.hide()
		},
		dispose() {
			item.dispose()
		},
	}
}
