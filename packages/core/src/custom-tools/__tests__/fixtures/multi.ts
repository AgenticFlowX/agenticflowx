// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

import { parametersSchema, defineCustomTool } from "@agenticflowx/types"

export const toolA = defineCustomTool({
	name: "multi_toolA",
	description: "Tool A",
	parameters: parametersSchema.object({}),
	async execute() {
		return "A"
	},
})

export const toolB = defineCustomTool({
	name: "multi_toolB",
	description: "Tool B",
	parameters: parametersSchema.object({}),
	async execute() {
		return "B"
	},
})
