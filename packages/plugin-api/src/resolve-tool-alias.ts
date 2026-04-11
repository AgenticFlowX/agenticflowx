// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0

import { TOOL_ALIASES } from "@agenticflowx/utils"

/**
 * Reverse lookup map — maps alias name to canonical tool name.
 * Built once at module load from the central TOOL_ALIASES constant.
 */
const ALIAS_TO_CANONICAL: Map<string, string> = new Map(
	Object.entries(TOOL_ALIASES).map(([alias, canonical]) => [alias, canonical]),
)

/**
 * Resolves a tool name to its canonical name.
 * If the tool name is an alias, returns the canonical tool name.
 * If it's already a canonical name or unknown, returns as-is.
 */
export function resolveToolAlias(toolName: string): string {
	const canonical = ALIAS_TO_CANONICAL.get(toolName)
	return canonical ?? toolName
}
