/**
 * API provider catalog shared by the host and webviews.
 *
 * @see docs/specs/100-package-shared/spec.md [FR-1] [FR-4]
 * @see docs/specs/100-package-shared/design.md [DES-SHARED-PROVIDER-CATALOG]
 * @see docs/specs/350-agent-manager/spec.md [FR-1]
 * @see docs/specs/350-agent-manager/design.md [DES-DATA]
 */
/**
 * OAuth flow kind a provider uses to obtain a subscription credential.
 *
 * @see docs/specs/141-package-provider-catalog/spec.md [FR-1] [FR-4] [FR-5] [FR-6]
 * @see docs/specs/141-package-provider-catalog/design.md [DES-DATA]
 */
export type ProviderOAuthFlow = "pkce-loopback" | "device-code";

/**
 * Extra provider setup values that Pi requires in addition to the API key.
 * These are stored host-side and injected as env vars for the bundled Pi SDK.
 *
 * @see docs/specs/141-package-provider-catalog/design.md [DES-DATA]
 */
export interface ProviderConfigField {
  id: string;
  label: string;
  envVar: string;
  description: string;
  placeholder?: string;
  required?: boolean;
  secret?: boolean;
}

export interface ProviderCatalogDetails {
  displayName: string;
  modelHint: string;
  helpUrl?: string;
  noKeyNeeded?: boolean;
  configFields?: readonly ProviderConfigField[];
  /**
   * True when this provider supports AFX-owned OAuth subscription sign-in.
   *
   * @see docs/specs/141-package-provider-catalog/spec.md [FR-1] [FR-4] [FR-5] [FR-6]
   */
  oauthCapable?: boolean;
  /** OAuth flow used when `oauthCapable` (PKCE loopback for Anthropic/Codex, device-code for Copilot). */
  oauthFlow?: ProviderOAuthFlow;
  /**
   * True only when a single provider id serves BOTH `subscription` and `api-key`
   * (Anthropic) — the card shows a method chooser. Subscription-only OAuth providers
   * (`openai-codex`, `github-copilot`) are false and render a single sign-in action.
   *
   * @see docs/specs/141-package-provider-catalog/spec.md [FR-1] [FR-4] [FR-5] [FR-6]
   * @see docs/specs/141-package-provider-catalog/design.md [DES-DATA]
   */
  dualMethod?: boolean;
}

export const PROVIDER_API_KEY_ENV_ALIASES = {
  "amazon-bedrock": ["AWS_BEARER_TOKEN_BEDROCK"],
  "ant-ling": ["ANT_LING_API_KEY"],
  anthropic: ["ANTHROPIC_API_KEY"],
  "azure-openai-responses": ["AZURE_OPENAI_API_KEY"],
  cerebras: ["CEREBRAS_API_KEY"],
  "cloudflare-ai-gateway": ["CLOUDFLARE_API_KEY"],
  "cloudflare-workers-ai": ["CLOUDFLARE_API_KEY"],
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
  nvidia: ["NVIDIA_API_KEY"],
  moonshotai: ["MOONSHOT_API_KEY"],
  "moonshotai-cn": ["MOONSHOT_API_KEY"],
  openai: ["OPENAI_API_KEY"],
  // Subscription-only OAuth sibling of `openai` (ChatGPT Codex). The metered API-key
  // path remains the `openai` provider; this id carries the OAuth access token via an
  // AFX-owned env key and a Pi SDK provider override, not a metered API-key record.
  // @see docs/specs/141-package-provider-catalog/spec.md [FR-1] [FR-4] [FR-5] [FR-6]
  // @see docs/specs/141-package-provider-catalog/design.md [DES-DATA]
  "openai-codex": ["OPENAI_API_KEY"],
  opencode: ["OPENCODE_API_KEY"],
  "opencode-go": ["OPENCODE_API_KEY"],
  openrouter: ["OPENROUTER_API_KEY"],
  "qwen-token-plan": ["QWEN_TOKEN_PLAN_API_KEY"],
  "qwen-token-plan-cn": ["QWEN_TOKEN_PLAN_CN_API_KEY"],
  radius: ["RADIUS_API_KEY"],
  together: ["TOGETHER_API_KEY"],
  xiaomi: ["XIAOMI_API_KEY"],
  "xiaomi-token-plan-cn": ["XIAOMI_TOKEN_PLAN_CN_API_KEY"],
  "xiaomi-token-plan-ams": ["XIAOMI_TOKEN_PLAN_AMS_API_KEY"],
  "xiaomi-token-plan-sgp": ["XIAOMI_TOKEN_PLAN_SGP_API_KEY"],
  xai: ["XAI_API_KEY"],
  zai: ["ZAI_API_KEY"],
  "zai-coding-cn": ["ZAI_CODING_CN_API_KEY"],
  "vercel-ai-gateway": ["AI_GATEWAY_API_KEY"],
} as const;

export type ApiProviderId = keyof typeof PROVIDER_API_KEY_ENV_ALIASES;

export const API_PROVIDER_IDS = Object.keys(
  PROVIDER_API_KEY_ENV_ALIASES,
) as readonly ApiProviderId[];

/**
 * Bundled SDK provider-default model ids used when AFX creates an API-provider runtime
 * for a provider that differs from the currently configured global default.
 *
 * @see docs/specs/350-agent-manager/spec.md [FR-1]
 * @see docs/specs/350-agent-manager/design.md [DES-DATA]
 */
export const DEFAULT_API_PROVIDER_MODELS: Partial<Record<ApiProviderId, string>> = {
  "amazon-bedrock": "us.anthropic.claude-opus-4-6-v1",
  "ant-ling": "Ling-2.6-1T",
  anthropic: "claude-opus-4-7",
  "azure-openai-responses": "gpt-5.4",
  cerebras: "zai-glm-4.7",
  "cloudflare-ai-gateway": "workers-ai/@cf/moonshotai/kimi-k2.6",
  "cloudflare-workers-ai": "@cf/moonshotai/kimi-k2.6",
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
  nvidia: "meta/llama-3.1-70b-instruct",
  moonshotai: "kimi-k2.6",
  "moonshotai-cn": "kimi-k2.6",
  openai: "gpt-5.4",
  "openai-codex": "gpt-5.5",
  opencode: "kimi-k2.6",
  "opencode-go": "kimi-k2.6",
  openrouter: "moonshotai/kimi-k2.6",
  "qwen-token-plan": "qwen3.7-max",
  "qwen-token-plan-cn": "qwen3.7-max",
  radius: "auto",
  together: "moonshotai/Kimi-K2.6",
  "vercel-ai-gateway": "zai/glm-5.1",
  xiaomi: "mimo-v2.5-pro",
  "xiaomi-token-plan-cn": "mimo-v2.5-pro",
  "xiaomi-token-plan-ams": "mimo-v2.5-pro",
  "xiaomi-token-plan-sgp": "mimo-v2.5-pro",
  xai: "grok-4.20-0309-reasoning",
  zai: "glm-5.1",
  "zai-coding-cn": "glm-5.1",
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
  "ant-ling": {
    displayName: "Ant Ling",
    modelHint: "Ant Ling hosted language models",
    helpUrl: "https://ant-ling.com",
  },
  anthropic: {
    displayName: "Anthropic",
    modelHint: "Claude Opus, Sonnet, and Haiku models",
    helpUrl: "https://console.anthropic.com/settings/keys",
    oauthCapable: true,
    oauthFlow: "pkce-loopback",
    // Only dual-method provider: one id serves both Subscription and API key.
    dualMethod: true,
  },
  "azure-openai-responses": {
    displayName: "Azure OpenAI",
    modelHint: "Azure-hosted OpenAI deployments",
  },
  cerebras: {
    displayName: "Cerebras",
    modelHint: "Cerebras-hosted inference models",
  },
  "cloudflare-ai-gateway": {
    displayName: "Cloudflare AI Gateway",
    modelHint: "Cloudflare AI Gateway routed hosted models",
    helpUrl: "https://developers.cloudflare.com/ai-gateway/",
    configFields: [
      {
        id: "account-id",
        label: "Account ID",
        envVar: "CLOUDFLARE_ACCOUNT_ID",
        description: "Required by Pi to resolve Cloudflare AI Gateway base URLs.",
        placeholder: "Cloudflare account ID",
      },
      {
        id: "gateway-id",
        label: "Gateway ID",
        envVar: "CLOUDFLARE_GATEWAY_ID",
        description: "Cloudflare AI Gateway slug from your dashboard.",
        placeholder: "AI Gateway slug",
      },
    ],
  },
  "cloudflare-workers-ai": {
    displayName: "Cloudflare Workers AI",
    modelHint: "Cloudflare Workers AI hosted models",
    helpUrl: "https://developers.cloudflare.com/workers-ai/",
    configFields: [
      {
        id: "account-id",
        label: "Account ID",
        envVar: "CLOUDFLARE_ACCOUNT_ID",
        description: "Required by Pi to resolve Cloudflare Workers AI base URLs.",
        placeholder: "Cloudflare account ID",
      },
    ],
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
    oauthCapable: true,
    oauthFlow: "device-code",
    // Subscription-only: device-code sign-in renders a single action, no chooser.
    dualMethod: false,
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
    oauthCapable: true,
    oauthFlow: "device-code",
    dualMethod: true,
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
  nvidia: {
    displayName: "NVIDIA",
    modelHint: "NVIDIA-hosted inference models",
    helpUrl: "https://build.nvidia.com",
  },
  moonshotai: {
    displayName: "Moonshot",
    modelHint: "Moonshot Kimi hosted models",
  },
  "moonshotai-cn": {
    displayName: "Moonshot China",
    modelHint: "Moonshot Kimi hosted models routed through the China endpoint",
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
  "openai-codex": {
    displayName: "ChatGPT (Codex)",
    modelHint: "GPT models via your ChatGPT Plus/Pro plan",
    oauthCapable: true,
    oauthFlow: "pkce-loopback",
    // Subscription-only: the metered path is the separate `openai` card.
    dualMethod: false,
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
    oauthCapable: true,
    oauthFlow: "pkce-loopback",
    dualMethod: true,
  },
  "qwen-token-plan": {
    displayName: "Qwen Token Plan",
    modelHint: "Qwen token-plan models via API-key authentication",
  },
  "qwen-token-plan-cn": {
    displayName: "Qwen Token Plan China",
    modelHint: "Qwen token-plan models routed through the China endpoint",
  },
  radius: {
    displayName: "Radius",
    modelHint: "Dynamic Radius pi-messages gateway models",
    helpUrl: "https://radius.pi.dev",
  },
  together: {
    displayName: "Together AI",
    modelHint: "Together AI hosted open model catalog",
  },
  xiaomi: {
    displayName: "Xiaomi MiMo",
    modelHint: "Xiaomi MiMo hosted reasoning and multimodal models",
  },
  "xiaomi-token-plan-cn": {
    displayName: "Xiaomi MiMo Token Plan CN",
    modelHint: "Xiaomi MiMo token-plan models routed through the China endpoint",
  },
  "xiaomi-token-plan-ams": {
    displayName: "Xiaomi MiMo Token Plan AMS",
    modelHint: "Xiaomi MiMo token-plan models routed through the Amsterdam endpoint",
  },
  "xiaomi-token-plan-sgp": {
    displayName: "Xiaomi MiMo Token Plan SGP",
    modelHint: "Xiaomi MiMo token-plan models routed through the Singapore endpoint",
  },
  "vercel-ai-gateway": {
    displayName: "Vercel AI Gateway",
    modelHint: "Vercel AI Gateway routed models",
  },
  xai: {
    displayName: "xAI",
    modelHint: "xAI Grok models",
    oauthCapable: true,
    oauthFlow: "device-code",
    dualMethod: true,
  },
  zai: {
    displayName: "Z.ai",
    modelHint: "Z.ai hosted models",
  },
  "zai-coding-cn": {
    displayName: "Z.AI Coding China",
    modelHint: "Z.AI coding models via the China endpoint",
    helpUrl: "https://open.bigmodel.cn",
  },
};
