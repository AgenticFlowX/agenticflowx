// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * Hardcoded fallback AfxConfig — used when no .afx/.afx.yaml or .afx.yaml exist.
 *
 * @see docs/specs/16-vscode-agenticflowx-core/design.md [DES-CONFIG]
 */

import type { AfxConfig } from "../models/config"

export const DEFAULT_AFX_CONFIG: AfxConfig = {
	version: "main",
	paths: {
		specs: "docs/specs",
		adr: "docs/adr",
		templates: "templates",
	},
	features: [],
	prefixes: {},
	qualityGates: {
		requirePathCheck: false,
		requireHumanApproval: true,
		blockOnMockCode: false,
	},
	verification: {
		twoStage: true,
		staleThresholdDays: 30,
	},
	hooks: {
		onTaskCompleted: { action: "toggle_checkbox", mode: "auto", toggleCheckbox: true },
		onSpecChanged: { action: "refresh_panel", mode: "auto" },
		onFileCreated: { match: "src/**/*.ts", action: "suggest_see_link", mode: "suggest" },
	},
}
