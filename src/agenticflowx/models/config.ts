// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * AgenticFlowX project-level configuration.
 * Loaded from .afx.yaml (user overrides) and .afx/.afx.yaml (managed defaults).
 *
 * @see docs/specs/16-vscode-agenticflowx-core/design.md#models
 */

export interface AfxConfig {
	version: string
	source?: string
	paths: {
		specs: string
		adr: string
		templates: string
		sessions?: string
	}
	features: string[]
	prefixes: Record<string, string>
	library?: Record<string, string>
	qualityGates: {
		requirePathCheck: boolean
		requireHumanApproval: boolean
		blockOnMockCode: boolean
	}
	verification: {
		twoStage: boolean
		staleThresholdDays: number
	}
	testTraceability?: {
		enabled: boolean
		annotation: string
	}
	anchors?: {
		taskFormat: string
		sectionFormat: string
	}
	timeMachine?: {
		enabled: boolean
	}
	architecture?: {
		enabled: boolean
		sourceRoots: string[]
		exclude: string[]
		mermaid?: {
			theme: "dark" | "default" | "forest" | "neutral"
			defaultDiagram: "flow" | "er" | "sequence"
			maxNodes: number
		}
		layers?: Array<{ name: string; patterns: string[] }>
		monorepo?: { packagesGlob: string }
	}
	logLevel?: "debug" | "info" | "warn" | "error" | "silent"
	hooks?: HookConfig
}

export interface HookConfig {
	onFileCreated?: HookAction
	onTaskCompleted?: HookAction
	onSpecChanged?: HookAction
}

export interface HookAction {
	match?: string
	action: "suggest_see_link" | "auto_log_session" | "toggle_checkbox" | "refresh_panel"
	mode: "auto" | "suggest" | "confirm"
	toggleCheckbox?: boolean
}

export interface ParsedAfxConfig {
	config: AfxConfig
	rawText: string
}
