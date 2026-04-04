// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

export {
	type ParsedApiReqStartedTextType,
	consolidateTokenUsage,
	hasTokenUsageChanged,
	hasToolUsageChanged,
} from "./consolidateTokenUsage.js"

export { consolidateApiRequests } from "./consolidateApiRequests.js"

export { consolidateCommands, COMMAND_OUTPUT_STRING } from "./consolidateCommands.js"

export { safeJsonParse } from "./safeJsonParse.js"
