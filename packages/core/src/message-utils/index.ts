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
} from "./consolidate-token-usage.js"

export { consolidateApiRequests } from "./consolidate-api-requests.js"

export { consolidateCommands, COMMAND_OUTPUT_STRING } from "./consolidate-commands.js"

export { safeJsonParse } from "./safe-json-parse.js"
