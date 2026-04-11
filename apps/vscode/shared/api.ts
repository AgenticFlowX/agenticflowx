// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Re-export from @agenticflowx/types — the canonical location for these types.
// This shim preserves existing import paths within apps/vscode/.

export {
	type ApiHandlerOptions,
	type GetModelsOptions,
	type RouterName,
	isRouterName,
	toRouterName,
	shouldUseReasoningBudget,
	shouldUseReasoningEffort,
	getModelMaxOutputTokens,
	DEFAULT_HYBRID_REASONING_MODEL_MAX_TOKENS,
	DEFAULT_HYBRID_REASONING_MODEL_THINKING_TOKENS,
	GEMINI_25_PRO_MIN_THINKING_TOKENS,
} from "@agenticflowx/types"
