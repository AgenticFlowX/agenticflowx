// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

import { parametersSchema, defineCustomTool } from "@agenticflowx/types"

export default defineCustomTool({
	name: "legacy",
	description: "Legacy tool using args",
	parameters: parametersSchema.object({ input: parametersSchema.string().describe("The input string") }),
	async execute(args: { input: string }) {
		return args.input
	},
})
