// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Based on Roo Code (https://github.com/RooCodeInc/Roo-Code)
// Original work by Saoud Rizwan (Claude Dev)

import { type BasetenModelId, basetenDefaultModelId, basetenModels } from "@agenticflowx/types"

import type { ApiHandlerOptions } from "@agenticflowx/types"
import { BaseOpenAiCompatibleProvider } from "./base-openai-compatible-provider"

export class BasetenHandler extends BaseOpenAiCompatibleProvider<BasetenModelId> {
	constructor(options: ApiHandlerOptions) {
		super({
			...options,
			providerName: "Baseten",
			baseURL: "https://inference.baseten.co/v1",
			apiKey: options.basetenApiKey,
			defaultProviderModelId: basetenDefaultModelId,
			providerModels: basetenModels,
			defaultTemperature: 0.5,
		})
	}
}
