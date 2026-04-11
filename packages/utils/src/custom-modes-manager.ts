// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Interface for CustomModesManager — the full implementation lives in
// apps/vscode/core/config/CustomModesManager.ts (vscode-coupled).
// This interface is used by plugin-services (marketplace) to avoid
// importing the concrete class.

import type { ModeConfig } from "@agenticflowx/types"

export interface ImportResult {
	success: boolean
	slug?: string
	error?: string
}

export interface CustomModesManager {
	getCustomModes(): Promise<ModeConfig[]>
	importModeWithRules(yamlContent: string, source?: "global" | "project"): Promise<ImportResult>
	deleteCustomMode(slug: string, skipConfirmation?: boolean): Promise<void>
}

