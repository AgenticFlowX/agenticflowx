// Copyright 2026 AgenticFlowX contributors
// SPDX-License-Identifier: Apache-2.0
//
// Provider registry instance — registers all 30+ LLM providers.
// Replaces the monolithic switch-case in buildApiHandler().
//
// @see docs/research/res-monorepo-plugin-migration.md [D11]

import { ProviderRegistry } from "@agenticflowx/plugin-api"

import {
	AnthropicHandler,
	AwsBedrockHandler,
	OpenRouterHandler,
	VertexHandler,
	AnthropicVertexHandler,
	OpenAiHandler,
	OpenAiCodexHandler,
	LmStudioHandler,
	GeminiHandler,
	OpenAiNativeHandler,
	DeepSeekHandler,
	MoonshotHandler,
	MistralHandler,
	VsCodeLmHandler,
	RequestyHandler,
	UnboundHandler,
	FakeAIHandler,
	XAIHandler,
	LiteLLMHandler,
	QwenCodeHandler,
	SambaNovaHandler,
	ZAiHandler,
	FireworksHandler,
	VercelAiGatewayHandler,
	MiniMaxHandler,
	BasetenHandler,
} from "./providers"
import { NativeOllamaHandler } from "./providers/native-ollama"

import type { ApiHandler } from "./index"
import type { ApiHandlerOptions } from "@agenticflowx/types"

export const registry = new ProviderRegistry()

// Register all providers synchronously at module initialization.
// Each registration maps a provider name to a factory that creates its handler.
registry.register({ name: "anthropic", factory: { create: (o: ApiHandlerOptions) => new AnthropicHandler(o) as ApiHandler } })
registry.register({ name: "openrouter", factory: { create: (o: ApiHandlerOptions) => new OpenRouterHandler(o) as ApiHandler } })
registry.register({ name: "bedrock", factory: { create: (o: ApiHandlerOptions) => new AwsBedrockHandler(o) as ApiHandler } })
registry.register({ name: "openai", factory: { create: (o: ApiHandlerOptions) => new OpenAiHandler(o) as ApiHandler } })
registry.register({ name: "ollama", factory: { create: (o: ApiHandlerOptions) => new NativeOllamaHandler(o) as ApiHandler } })
registry.register({ name: "lmstudio", factory: { create: (o: ApiHandlerOptions) => new LmStudioHandler(o) as ApiHandler } })
registry.register({ name: "gemini", factory: { create: (o: ApiHandlerOptions) => new GeminiHandler(o) as ApiHandler } })
registry.register({ name: "openai-codex", factory: { create: (o: ApiHandlerOptions) => new OpenAiCodexHandler(o) as ApiHandler } })
registry.register({ name: "openai-native", factory: { create: (o: ApiHandlerOptions) => new OpenAiNativeHandler(o) as ApiHandler } })
registry.register({ name: "deepseek", factory: { create: (o: ApiHandlerOptions) => new DeepSeekHandler(o) as ApiHandler } })
registry.register({ name: "qwen-code", factory: { create: (o: ApiHandlerOptions) => new QwenCodeHandler(o) as ApiHandler } })
registry.register({ name: "moonshot", factory: { create: (o: ApiHandlerOptions) => new MoonshotHandler(o) as ApiHandler } })
registry.register({ name: "vscode-lm", factory: { create: (o: ApiHandlerOptions) => new VsCodeLmHandler(o) as ApiHandler } })
registry.register({ name: "mistral", factory: { create: (o: ApiHandlerOptions) => new MistralHandler(o) as ApiHandler } })
registry.register({ name: "requesty", factory: { create: (o: ApiHandlerOptions) => new RequestyHandler(o) as ApiHandler } })
registry.register({ name: "unbound", factory: { create: (o: ApiHandlerOptions) => new UnboundHandler(o) as ApiHandler } })
registry.register({ name: "fake-ai", factory: { create: (o: ApiHandlerOptions) => new FakeAIHandler(o) as ApiHandler } })
registry.register({ name: "xai", factory: { create: (o: ApiHandlerOptions) => new XAIHandler(o) as ApiHandler } })
registry.register({ name: "litellm", factory: { create: (o: ApiHandlerOptions) => new LiteLLMHandler(o) as ApiHandler } })
registry.register({ name: "sambanova", factory: { create: (o: ApiHandlerOptions) => new SambaNovaHandler(o) as ApiHandler } })
registry.register({ name: "zai", factory: { create: (o: ApiHandlerOptions) => new ZAiHandler(o) as ApiHandler } })
registry.register({ name: "fireworks", factory: { create: (o: ApiHandlerOptions) => new FireworksHandler(o) as ApiHandler } })
registry.register({ name: "vercel-ai-gateway", factory: { create: (o: ApiHandlerOptions) => new VercelAiGatewayHandler(o) as ApiHandler } })
registry.register({ name: "minimax", factory: { create: (o: ApiHandlerOptions) => new MiniMaxHandler(o) as ApiHandler } })
registry.register({ name: "baseten", factory: { create: (o: ApiHandlerOptions) => new BasetenHandler(o) as ApiHandler } })

// Vertex has special routing: claude models → AnthropicVertexHandler, others → VertexHandler
registry.register({
	name: "vertex",
	factory: {
		create: (o: ApiHandlerOptions) =>
			(o.apiModelId?.startsWith("claude") ? new AnthropicVertexHandler(o) : new VertexHandler(o)) as ApiHandler,
	},
})
