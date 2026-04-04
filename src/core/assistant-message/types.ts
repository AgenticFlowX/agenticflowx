// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

import type { TextContent, ToolUse, McpToolUse } from "../../shared/tools"

export type AssistantMessageContent = TextContent | ToolUse | McpToolUse
