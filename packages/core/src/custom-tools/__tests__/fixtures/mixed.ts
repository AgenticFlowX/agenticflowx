// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

import { parametersSchema, defineCustomTool } from "@agenticflowx/types"

// This is a valid tool.
export const validTool = defineCustomTool({
	name: "mixed_validTool",
	description: "Valid",
	parameters: parametersSchema.object({}),
	async execute() {
		return "valid"
	},
})

// These should be silently skipped.
export const someString = "not a tool"
export const someNumber = 42
export const someObject = { foo: "bar" }
