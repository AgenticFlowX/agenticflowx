// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

import {
	afxCliOutputFormats,
	type AfxCliCost,
	type AfxCliEventType,
	type AfxCliFinalOutput,
	type AfxCliOutputFormat,
	type AfxCliQueueItem,
	type AfxCliStreamEvent,
	type AfxCliToolResult,
	type AfxCliToolUse,
} from "@agenticflowx/types"

/**
 * JSON Event Types for Structured CLI Output
 *
 * This module defines the types for structured JSON output from the CLI.
 * The output format is NDJSON (newline-delimited JSON) for stream-json mode,
 * or a single JSON object for json mode.
 *
 * Schema is optimized for efficiency with high message volume:
 * - Minimal fields per event
 * - No redundant wrappers
 * - `done` flag instead of partial:false
 */

/**
 * Output format options for the CLI.
 */
export const OUTPUT_FORMATS = afxCliOutputFormats

export type OutputFormat = AfxCliOutputFormat

export function isValidOutputFormat(format: string): format is OutputFormat {
	return (OUTPUT_FORMATS as readonly string[]).includes(format)
}

/**
 * Event type discriminators for JSON output.
 */
export type JsonEventType = AfxCliEventType

export type JsonEventQueueItem = AfxCliQueueItem

/**
 * Tool use information for tool_use events.
 */
export type JsonEventToolUse = AfxCliToolUse

/**
 * Tool result information for tool_result events.
 */
export type JsonEventToolResult = AfxCliToolResult

/**
 * Cost and token usage information.
 */
export type JsonEventCost = AfxCliCost

/**
 * Base JSON event structure.
 * Optimized for minimal payload size.
 *
 * For streaming deltas:
 * - Each delta includes `id` for easy correlation
 * - Final message has `done: true`
 */
export type JsonEvent = AfxCliStreamEvent & {
	/** Event type discriminator */
	type: JsonEventType
	/** Protocol schema version (included on system.init) */
	schemaVersion?: number
	/** Transport protocol identifier (included on system.init) */
	protocol?: string
	/** Capability names supported by the current process */
	capabilities?: string[]
	/** Message ID - included on first delta and final message */
	id?: number
	/** Active task ID when available */
	taskId?: string
	/** Request ID for correlating streamed output to stdin commands */
	requestId?: string
	/** Command name for control events */
	command?: string
	/** Content text (for text-based events) */
	content?: string
	/** True when this is the final message (stream complete) */
	done?: boolean
	/** Optional subtype for more specific categorization */
	subtype?: string
	/** Optional machine-readable status/error code */
	code?: string
	/** Current queue depth (for queue events) */
	queueDepth?: number
	/** Queue item snapshots (for queue events) */
	queue?: JsonEventQueueItem[]
	/** Tool use information (for tool_use events) */
	tool_use?: JsonEventToolUse
	/** Tool result information (for tool_result events) */
	tool_result?: JsonEventToolResult
	/** Whether the task succeeded (for result events) */
	success?: boolean
	/** Cost and token usage (for result events) */
	cost?: JsonEventCost
}

/**
 * Final JSON output for "json" mode (single object at end).
 * Contains the result and accumulated messages.
 */
export type JsonFinalOutput = AfxCliFinalOutput & {
	/** Final result type */
	type: "result"
	/** Whether the task succeeded */
	success: boolean
	/** Result content/message */
	content?: string
	/** Cost and token usage */
	cost?: JsonEventCost
	/** All events that occurred during the task */
	events: JsonEvent[]
}
