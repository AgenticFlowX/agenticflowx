// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0

import type { Anthropic } from "@anthropic-ai/sdk"

/**
 * Extended message type for API conversation history.
 * Extends Anthropic's MessageParam with metadata for reasoning,
 * condensation, and truncation tracking.
 */
export type ApiMessage = Anthropic.MessageParam & {
	ts?: number
	isSummary?: boolean
	id?: string
	type?: "reasoning"
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	summary?: any[]
	encrypted_content?: string
	text?: string
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	reasoning_details?: any[]
	reasoning_content?: string
	condenseId?: string
	condenseParent?: string
	truncationId?: string
	truncationParent?: string
	isTruncationMarker?: boolean
}
