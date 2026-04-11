// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

import { type SambaNovaModelId, sambaNovaDefaultModelId, sambaNovaModels } from "@agenticflowx/types"

import type { ApiHandlerOptions } from "../../shared/api"

import { BaseOpenAiCompatibleProvider } from "./base-openai-compatible-provider"

export class SambaNovaHandler extends BaseOpenAiCompatibleProvider<SambaNovaModelId> {
	constructor(options: ApiHandlerOptions) {
		super({
			...options,
			providerName: "SambaNova",
			baseURL: "https://api.sambanova.ai/v1",
			apiKey: options.sambaNovaApiKey,
			defaultProviderModelId: sambaNovaDefaultModelId,
			providerModels: sambaNovaModels,
			defaultTemperature: 0.7,
		})
	}
}
