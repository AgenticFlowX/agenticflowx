// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0

import type { Anthropic } from "@anthropic-ai/sdk"
import type OpenAI from "openai"
import type { ModelInfo } from "@agenticflowx/types"

import type { ApiStream } from "./transform/stream"

export interface SingleCompletionHandler {
	completePrompt(prompt: string): Promise<string>
}

export interface ApiHandlerCreateMessageMetadata {
	taskId: string
	mode?: string
	suppressPreviousResponseId?: boolean
	store?: boolean
	tools?: OpenAI.Chat.ChatCompletionTool[]
	tool_choice?: OpenAI.Chat.ChatCompletionCreateParams["tool_choice"]
	parallelToolCalls?: boolean
	allowedFunctionNames?: string[]
}

export interface ApiHandler {
	createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream

	getModel(): { id: string; info: ModelInfo }

	countTokens(content: Array<Anthropic.Messages.ContentBlockParam>): Promise<number>
}
