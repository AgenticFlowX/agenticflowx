// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

import { parametersSchema, defineCustomTool } from "@agenticflowx/types"

export default defineCustomTool({
	name: "simple",
	description: "Simple tool",
	parameters: parametersSchema.object({ value: parametersSchema.string().describe("The input value") }),
	async execute(args: { value: string }) {
		return "Result: " + args.value
	},
})
