// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Platform-agnostic mode utilities extracted from shared/modes.ts.
// vscode-coupled functions (getAllModesWithPrompts) stay in the extension.

import {
	type GroupEntry,
	type ModeConfig,
	type ToolGroup,
	DEFAULT_MODES,
	FOCUS_MODES,
} from "@agenticflowx/types"

import { TOOL_GROUPS, ALWAYS_AVAILABLE_TOOLS } from "./tools"

export type Mode = string

export function getGroupName(group: GroupEntry): ToolGroup {
	if (typeof group === "string") {
		return group
	}
	return group[0]
}

export function getToolsForMode(groups: readonly GroupEntry[]): string[] {
	const tools = new Set<string>()
	groups.forEach((group) => {
		const groupName = getGroupName(group)
		const groupConfig = TOOL_GROUPS[groupName]
		groupConfig.tools.forEach((tool: string) => tools.add(tool))
	})
	ALWAYS_AVAILABLE_TOOLS.forEach((tool) => tools.add(tool))
	return Array.from(tools)
}

export const modes: readonly ModeConfig[] = [...DEFAULT_MODES, ...FOCUS_MODES]

export const defaultModeSlug = DEFAULT_MODES[0].slug

export function getModeBySlug(slug: string, customModes?: ModeConfig[]): ModeConfig | undefined {
	const customMode = customModes?.find((mode) => mode.slug === slug)
	if (customMode) {
		return customMode
	}
	return modes.find((mode) => mode.slug === slug)
}

export function getModeConfig(slug: string, customModes?: ModeConfig[]): ModeConfig {
	const mode = getModeBySlug(slug, customModes)
	if (!mode) {
		throw new Error(`No mode found for slug: ${slug}`)
	}
	return mode
}

export function getAllModes(customModes?: ModeConfig[]): ModeConfig[] {
	if (!customModes?.length) {
		return [...modes]
	}
	const allModes = [...modes]
	customModes.forEach((customMode) => {
		const index = allModes.findIndex((mode) => mode.slug === customMode.slug)
		if (index !== -1) {
			allModes[index] = customMode
		} else {
			allModes.push(customMode)
		}
	})
	return allModes
}

export function findModeBySlug(slug: string, searchModes: readonly ModeConfig[] | undefined): ModeConfig | undefined {
	return searchModes?.find((mode) => mode.slug === slug)
}

export function isToolAllowedForMode(toolName: string, modeSlug: string, customModes?: ModeConfig[]): boolean {
	const mode = getModeBySlug(modeSlug, customModes)
	if (!mode) {
		return false
	}
	const modeTools = getToolsForMode(mode.groups)
	return modeTools.includes(toolName)
}
