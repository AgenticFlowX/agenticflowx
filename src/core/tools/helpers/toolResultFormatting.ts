// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

/**
 * Formats tool invocation parameters for display.
 */
export function formatToolInvocation(toolName: string, params: Record<string, any>): string {
	// Native-only: readable format
	const paramsList = Object.entries(params)
		.map(([key, value]) => `${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`)
		.join(", ")
	return `Called ${toolName}${paramsList ? ` with ${paramsList}` : ""}`
}
