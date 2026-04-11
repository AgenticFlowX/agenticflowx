// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Model-level API handler types and utilities.
// Moved from apps/vscode/shared/api.ts to break the shared/ god module.

import type { ModelInfo } from "./model.js"
import type { ProviderSettings, DynamicProvider, LocalProvider } from "./provider-settings.js"
import { isDynamicProvider, isLocalProvider } from "./provider-settings.js"
import { ANTHROPIC_DEFAULT_MAX_TOKENS } from "./providers/anthropic.js"

// ApiHandlerOptions

export type ApiHandlerOptions = Omit<ProviderSettings, "apiProvider"> & {
	enableResponsesReasoningSummary?: boolean
	ollamaNumCtx?: number
}

// RouterName

export type RouterName = DynamicProvider | LocalProvider

export const isRouterName = (value: string): value is RouterName => isDynamicProvider(value) || isLocalProvider(value)

export function toRouterName(value?: string): RouterName {
	if (value && isRouterName(value)) {
		return value
	}

	throw new Error(`Invalid router name: ${value}`)
}

// Reasoning

export const shouldUseReasoningBudget = ({
	model,
	settings,
}: {
	model: ModelInfo
	settings?: ProviderSettings
}): boolean => !!model.requiredReasoningBudget || (!!model.supportsReasoningBudget && !!settings?.enableReasoningEffort)

export const shouldUseReasoningEffort = ({
	model,
	settings,
}: {
	model: ModelInfo
	settings?: ProviderSettings
}): boolean => {
	if (settings?.enableReasoningEffort === false) return false

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const selectedEffort = (settings?.reasoningEffort ?? (model as any).reasoningEffort) as
		| "disable"
		| "none"
		| "minimal"
		| "low"
		| "medium"
		| "high"
		| undefined

	if (selectedEffort === "disable") return false

	const cap = model.supportsReasoningEffort as unknown

	if (Array.isArray(cap)) {
		return !!selectedEffort && (cap as ReadonlyArray<string>).includes(selectedEffort as string)
	}

	if (model.supportsReasoningEffort === true) {
		return !!selectedEffort
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const modelDefaultEffort = (model as any).reasoningEffort as
		| "none"
		| "minimal"
		| "low"
		| "medium"
		| "high"
		| undefined
	return !!modelDefaultEffort
}

export const DEFAULT_HYBRID_REASONING_MODEL_MAX_TOKENS = 16_384
export const DEFAULT_HYBRID_REASONING_MODEL_THINKING_TOKENS = 8_192
export const GEMINI_25_PRO_MIN_THINKING_TOKENS = 128

// Max Tokens

export const getModelMaxOutputTokens = ({
	modelId,
	model,
	settings,
	format,
}: {
	modelId: string
	model: ModelInfo
	settings?: ProviderSettings
	format?: "anthropic" | "openai" | "gemini" | "openrouter"
}): number | undefined => {
	if (shouldUseReasoningBudget({ model, settings })) {
		return settings?.modelMaxTokens || DEFAULT_HYBRID_REASONING_MODEL_MAX_TOKENS
	}

	const isAnthropicContext =
		modelId.includes("claude") ||
		format === "anthropic" ||
		(format === "openrouter" && modelId.startsWith("anthropic/"))

	if (model.supportsReasoningBudget && isAnthropicContext) {
		return ANTHROPIC_DEFAULT_MAX_TOKENS
	}

	if (isAnthropicContext && (!model.maxTokens || model.maxTokens === 0)) {
		return ANTHROPIC_DEFAULT_MAX_TOKENS
	}

	if (model.maxTokens) {
		const isGpt5Model = modelId.toLowerCase().includes("gpt-5")

		if (isGpt5Model) {
			return model.maxTokens
		}

		return Math.min(model.maxTokens, Math.ceil(model.contextWindow * 0.2))
	}

	if (format) {
		return undefined
	}

	return ANTHROPIC_DEFAULT_MAX_TOKENS
}

// GetModelsOptions

type CommonFetchParams = {
	apiKey?: string
	baseUrl?: string
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const dynamicProviderExtras = {
	openrouter: {} as {}, // eslint-disable-line @typescript-eslint/no-empty-object-type
	"vercel-ai-gateway": {} as {}, // eslint-disable-line @typescript-eslint/no-empty-object-type
	litellm: {} as { apiKey: string; baseUrl: string },
	requesty: {} as { apiKey?: string; baseUrl?: string },
	unbound: {} as { apiKey?: string },
	ollama: {} as {}, // eslint-disable-line @typescript-eslint/no-empty-object-type
	lmstudio: {} as {}, // eslint-disable-line @typescript-eslint/no-empty-object-type
} as const satisfies Record<RouterName, object>

export type GetModelsOptions = {
	[P in keyof typeof dynamicProviderExtras]: ({ provider: P } & (typeof dynamicProviderExtras)[P]) & CommonFetchParams
}[RouterName]
