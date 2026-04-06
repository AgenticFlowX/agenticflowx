// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * refresh_panel action — triggers panel data refresh.
 *
 * @see docs/specs/17-vscode-agenticflowx-hook-engine/design.md#hook-actions
 */

export function executeRefreshPanel(refreshPanel: () => void): void {
	refreshPanel()
}
