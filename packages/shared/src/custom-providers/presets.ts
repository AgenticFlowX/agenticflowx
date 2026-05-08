/**
 * Canonical preset catalog for the Add-Provider picker. Adapters layer on
 * harness-specific compat defaults at serialize time (e.g. pi-mono's
 * `supportsDeveloperRole: false` for Ollama / vLLM).
 *
 * @see docs/specs/214-app-chat-settings/spec.md [FR-9]
 * @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-MOCKUP-CUSTOM-PRESET]
 */
import type { CustomProviderApiKeySource, CustomProviderApiKind } from "./types";

export interface CustomProviderPreset {
  /** Stable id used as the preset key (kebab-case). */
  presetId: string;
  /** Default provider id when the preset is selected (user can edit). */
  defaultProviderId: string;
  /** Display name shown in the preset picker. */
  label: string;
  /** Short subtitle shown on the preset card. */
  subtitle: string;
  /** Default base URL — empty string for `custom-blank`. */
  defaultBaseUrl: string;
  /** Default api kind. */
  defaultApi: CustomProviderApiKind;
  /** Default apiKey source. `none` for local-only providers. */
  defaultApiKeySource: CustomProviderApiKeySource;
  /** Optional canonical compat defaults. Adapters add harness-specific extras. */
  defaultCompat?: Record<string, unknown>;
}

export const PRESET_OLLAMA: CustomProviderPreset = {
  presetId: "ollama",
  defaultProviderId: "ollama",
  label: "Ollama",
  subtitle: "local — no key needed",
  defaultBaseUrl: "http://localhost:11434/v1",
  defaultApi: "openai-completions",
  defaultApiKeySource: "none",
};

export const PRESET_LM_STUDIO: CustomProviderPreset = {
  presetId: "lm-studio",
  defaultProviderId: "lm-studio",
  label: "LM Studio",
  subtitle: "local — no key needed",
  defaultBaseUrl: "http://localhost:1234/v1",
  defaultApi: "openai-completions",
  defaultApiKeySource: "none",
};

export const PRESET_VLLM: CustomProviderPreset = {
  presetId: "vllm",
  defaultProviderId: "vllm",
  label: "vLLM",
  subtitle: "local — no key needed",
  defaultBaseUrl: "http://localhost:8000/v1",
  defaultApi: "openai-completions",
  defaultApiKeySource: "none",
};

export const PRESET_OPENROUTER: CustomProviderPreset = {
  presetId: "openrouter",
  defaultProviderId: "openrouter",
  label: "OpenRouter",
  subtitle: "router for many models",
  defaultBaseUrl: "https://openrouter.ai/api/v1",
  defaultApi: "openai-completions",
  defaultApiKeySource: "vscode-secret",
};

export const PRESET_VERCEL_GATEWAY: CustomProviderPreset = {
  presetId: "vercel-gateway",
  defaultProviderId: "vercel-ai-gateway",
  label: "Vercel AI Gateway",
  subtitle: "Vercel-hosted gateway",
  defaultBaseUrl: "https://gateway.ai.vercel.app/v1",
  defaultApi: "openai-completions",
  defaultApiKeySource: "vscode-secret",
};

export const PRESET_MOONSHOT: CustomProviderPreset = {
  presetId: "moonshot",
  defaultProviderId: "moonshot",
  label: "Moonshot (Kimi)",
  subtitle: "Moonshot AI / Kimi",
  defaultBaseUrl: "https://api.moonshot.ai/v1",
  defaultApi: "openai-completions",
  defaultApiKeySource: "vscode-secret",
};

export const PRESET_ANTHROPIC_PROXY: CustomProviderPreset = {
  presetId: "anthropic-proxy",
  defaultProviderId: "anthropic-proxy",
  label: "Anthropic proxy",
  subtitle: "self-hosted Anthropic proxy",
  defaultBaseUrl: "https://proxy.example.com/v1",
  defaultApi: "anthropic-messages",
  defaultApiKeySource: "vscode-secret",
};

export const PRESET_GOOGLE_AI_STUDIO: CustomProviderPreset = {
  presetId: "google-ai-studio",
  defaultProviderId: "google-ai-studio",
  label: "Google AI Studio",
  subtitle: "Gemini via AI Studio",
  defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
  defaultApi: "google-generative-ai",
  defaultApiKeySource: "vscode-secret",
};

export const PRESET_CUSTOM_BLANK: CustomProviderPreset = {
  presetId: "custom-blank",
  defaultProviderId: "custom",
  label: "Custom",
  subtitle: "blank — fill in everything",
  defaultBaseUrl: "",
  defaultApi: "openai-completions",
  defaultApiKeySource: "vscode-secret",
};

/** Ordered preset catalog as displayed in the picker grid. */
export const CUSTOM_PROVIDER_PRESETS: readonly CustomProviderPreset[] = [
  PRESET_OLLAMA,
  PRESET_LM_STUDIO,
  PRESET_VLLM,
  PRESET_OPENROUTER,
  PRESET_VERCEL_GATEWAY,
  PRESET_MOONSHOT,
  PRESET_ANTHROPIC_PROXY,
  PRESET_GOOGLE_AI_STUDIO,
  PRESET_CUSTOM_BLANK,
] as const;
