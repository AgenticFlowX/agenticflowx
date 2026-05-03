/**
 * API provider catalog shared by the host and webviews.
 *
 * @see docs/specs/100-package-shared/spec.md [FR-1] [FR-4]
 * @see docs/specs/100-package-shared/design.md [DES-SHARED-PROVIDER-CATALOG]
 * @see docs/specs/350-agent-manager/spec.md [FR-1]
 * @see docs/specs/350-agent-manager/design.md [DES-DATA]
 */
export interface ProviderCatalogDetails {
  displayName: string;
  modelHint: string;
  helpUrl?: string;
  noKeyNeeded?: boolean;
}

export const PROVIDER_API_KEY_ENV_ALIASES = {
  "amazon-bedrock": ["AWS_BEARER_TOKEN_BEDROCK"],
  anthropic: ["ANTHROPIC_API_KEY"],
  "azure-openai-responses": ["AZURE_OPENAI_API_KEY"],
  cerebras: ["CEREBRAS_API_KEY"],
  deepseek: ["DEEPSEEK_API_KEY"],
  fireworks: ["FIREWORKS_API_KEY"],
  "github-copilot": ["COPILOT_GITHUB_TOKEN"],
  google: ["GEMINI_API_KEY", "GOOGLE_API_KEY"],
  "google-vertex": ["GOOGLE_CLOUD_API_KEY"],
  groq: ["GROQ_API_KEY"],
  huggingface: ["HF_TOKEN"],
  "kimi-coding": ["KIMI_API_KEY"],
  minimax: ["MINIMAX_API_KEY"],
  "minimax-cn": ["MINIMAX_CN_API_KEY"],
  mistral: ["MISTRAL_API_KEY"],
  openai: ["OPENAI_API_KEY"],
  opencode: ["OPENCODE_API_KEY"],
  "opencode-go": ["OPENCODE_API_KEY"],
  openrouter: ["OPENROUTER_API_KEY"],
  xai: ["XAI_API_KEY"],
  zai: ["ZAI_API_KEY"],
  "vercel-ai-gateway": ["AI_GATEWAY_API_KEY"],
} as const;

export type ApiProviderId = keyof typeof PROVIDER_API_KEY_ENV_ALIASES;

export const API_PROVIDER_IDS = Object.keys(
  PROVIDER_API_KEY_ENV_ALIASES,
) as readonly ApiProviderId[];

/**
 * Pi's provider-default model ids used when AFX creates an API-provider runtime
 * for a provider that differs from the currently configured global default.
 *
 * @see docs/specs/350-agent-manager/spec.md [FR-1]
 * @see docs/specs/350-agent-manager/design.md [DES-DATA]
 */
export const DEFAULT_API_PROVIDER_MODELS: Partial<Record<ApiProviderId, string>> = {
  "amazon-bedrock": "us.anthropic.claude-opus-4-6-v1",
  anthropic: "claude-opus-4-7",
  "azure-openai-responses": "gpt-5.4",
  cerebras: "zai-glm-4.7",
  deepseek: "deepseek-v4-pro",
  fireworks: "accounts/fireworks/models/kimi-k2p6",
  "github-copilot": "gpt-5.4",
  google: "gemini-3.1-pro-preview",
  "google-vertex": "gemini-3.1-pro-preview",
  groq: "openai/gpt-oss-120b",
  huggingface: "moonshotai/Kimi-K2.6",
  "kimi-coding": "kimi-for-coding",
  minimax: "MiniMax-M2.7",
  "minimax-cn": "MiniMax-M2.7",
  mistral: "devstral-medium-latest",
  openai: "gpt-5.4",
  opencode: "kimi-k2.6",
  "opencode-go": "kimi-k2.6",
  openrouter: "moonshotai/kimi-k2.6",
  "vercel-ai-gateway": "zai/glm-5.1",
  xai: "grok-4.20-0309-reasoning",
  zai: "glm-5.1",
};

/**
 * Returns a Pi-compatible startup model for a known API provider.
 *
 * @see docs/specs/350-agent-manager/spec.md [FR-1]
 * @see docs/specs/350-agent-manager/design.md [DES-DATA]
 */
export function getDefaultApiProviderModel(provider: string): string | undefined {
  return DEFAULT_API_PROVIDER_MODELS[provider as ApiProviderId];
}

export const PROVIDER_DETAILS: Record<string, ProviderCatalogDetails> = {
  "amazon-bedrock": {
    displayName: "Amazon Bedrock",
    modelHint: "AWS-hosted foundation models via Bedrock bearer token or environment credentials",
  },
  anthropic: {
    displayName: "Anthropic",
    modelHint: "Claude Opus, Sonnet, and Haiku models",
    helpUrl: "https://console.anthropic.com/settings/keys",
  },
  "azure-openai-responses": {
    displayName: "Azure OpenAI",
    modelHint: "Azure-hosted OpenAI deployments",
  },
  cerebras: {
    displayName: "Cerebras",
    modelHint: "Cerebras-hosted inference models",
  },
  deepseek: {
    displayName: "DeepSeek",
    modelHint: "DeepSeek reasoning and chat models",
  },
  fireworks: {
    displayName: "Fireworks",
    modelHint: "Fireworks-hosted open model catalog",
  },
  "github-copilot": {
    displayName: "GitHub Copilot",
    modelHint: "GitHub Copilot token-backed models",
  },
  google: {
    displayName: "Google Gemini",
    modelHint: "Google Gemini models",
    helpUrl: "https://aistudio.google.com/app/apikey",
  },
  "google-vertex": {
    displayName: "Google Vertex AI",
    modelHint: "Google Cloud Vertex AI models",
  },
  groq: {
    displayName: "Groq",
    modelHint: "Groq-hosted low-latency inference models",
  },
  huggingface: {
    displayName: "Hugging Face",
    modelHint: "Hugging Face hosted inference providers",
  },
  "kimi-coding": {
    displayName: "Kimi For Coding",
    modelHint: "Kimi coding models",
  },
  minimax: {
    displayName: "MiniMax",
    modelHint: "MiniMax hosted models",
  },
  "minimax-cn": {
    displayName: "MiniMax China",
    modelHint: "MiniMax China hosted models",
  },
  mistral: {
    displayName: "Mistral",
    modelHint: "Mistral hosted models",
  },
  ollama: {
    displayName: "Ollama",
    modelHint: "Local Ollama models from your base URL",
    noKeyNeeded: true,
  },
  openai: {
    displayName: "OpenAI",
    modelHint: "GPT reasoning and multimodal models",
    helpUrl: "https://platform.openai.com/api-keys",
  },
  opencode: {
    displayName: "OpenCode",
    modelHint: "OpenCode hosted models",
  },
  "opencode-go": {
    displayName: "OpenCode Go",
    modelHint: "OpenCode Go hosted models",
  },
  openrouter: {
    displayName: "OpenRouter",
    modelHint: "OpenRouter-hosted model catalog",
    helpUrl: "https://openrouter.ai/keys",
  },
  "vercel-ai-gateway": {
    displayName: "Vercel AI Gateway",
    modelHint: "Vercel AI Gateway routed models",
  },
  xai: {
    displayName: "xAI",
    modelHint: "xAI Grok models",
  },
  zai: {
    displayName: "Z.ai",
    modelHint: "Z.ai hosted models",
  },
};
