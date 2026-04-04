// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

import { parametersSchema, defineCustomTool } from "@agenticflowx/types"

// This tool only exists in fixtures-override/ to test combined loading.
export default defineCustomTool({
	name: "unique_override",
	description: "A unique tool only in override directory",
	parameters: parametersSchema.object({ input: parametersSchema.string().describe("The input") }),
	async execute(args: { input: string }) {
		return "Unique: " + args.input
	},
})
