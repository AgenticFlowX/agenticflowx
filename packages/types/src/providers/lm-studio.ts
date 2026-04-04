// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

import type { ModelInfo } from "../model.js"

export const LMSTUDIO_DEFAULT_TEMPERATURE = 0

// LM Studio
// https://lmstudio.ai/docs/cli/ls
export const lMStudioDefaultModelId = "mistralai/devstral-small-2505"
export const lMStudioDefaultModelInfo: ModelInfo = {
	maxTokens: 8192,
	contextWindow: 200_000,
	supportsImages: true,
	supportsPromptCache: true,
	inputPrice: 0,
	outputPrice: 0,
	cacheWritesPrice: 0,
	cacheReadsPrice: 0,
	description: "LM Studio hosted models",
}
