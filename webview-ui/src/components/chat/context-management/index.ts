// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

/**
 * Context Management UI Components
 *
 * Components for displaying context management events in the ChatView:
 * - Context Condensation: AI-powered summarization to reduce token usage
 * - Context Truncation: Sliding window removal of older messages
 * - Error States: When context management operations fail
 */

export { InProgressRow } from "./InProgressRow"
export { CondensationResultRow } from "./CondensationResultRow"
export { CondensationErrorRow } from "./CondensationErrorRow"
export { TruncationResultRow } from "./TruncationResultRow"
