// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Stream chunk types used by NativeToolCallParser and providers.
// Canonical location — providers re-export these.

export interface ApiStreamToolCallStartChunk {
	type: "tool_call_start"
	id: string
	name: string
}

export interface ApiStreamToolCallDeltaChunk {
	type: "tool_call_delta"
	id: string
	delta: string
}

export interface ApiStreamToolCallEndChunk {
	type: "tool_call_end"
	id: string
}
