// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

import { type SerializedCustomToolDefinition, parametersSchema } from "@agenticflowx/types"

import type { StoredCustomTool } from "./types.js"

export function serializeCustomTool({
	name,
	description,
	parameters,
	source,
}: StoredCustomTool): SerializedCustomToolDefinition {
	return {
		name,
		description,
		parameters: parameters ? parametersSchema.toJSONSchema(parameters) : undefined,
		source,
	}
}

export function serializeCustomTools(tools: StoredCustomTool[]): SerializedCustomToolDefinition[] {
	return tools.map(serializeCustomTool)
}
