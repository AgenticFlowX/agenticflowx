/**
 * Canonical custom-provider types — harness-agnostic shape used by AFX UI and
 * SecretStorage. Per-harness adapters translate to/from native config formats.
 *
 * @see docs/specs/214-app-chat-settings/spec.md [FR-9] [FR-10]
 * @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-CUSTOM-MODELS]
 * @see docs/specs/100-package-shared/spec.md [FR-1] [FR-4]
 * @see docs/adr/ADR-0008-afx-custom-providers-adapter-pattern.md
 */

/** Canonical API kinds. Maps to pi-mono's four; harness adapters translate where needed. */
export type CustomProviderApiKind =
  | "openai-completions"
  | "openai-responses"
  | "anthropic-messages"
  | "google-generative-ai";

/** Source of an apiKey value. `vscode-secret` compiles to env-var indirection at bootstrap. */
export type CustomProviderApiKeySource =
  | "none"
  | "vscode-secret"
  | "env-var"
  | "shell-cmd"
  | "literal";

/** Origin tag — drives UI mode (editable vs readonly) and source-of-truth dispatch. */
export type CustomProviderOrigin = "afx-managed" | "hand-edited";

/** Capability flags surfaced in the UI form. Pi-mono compat fields beyond these live in adapter defaults. */
export interface CustomProviderModelCapabilities {
  reasoning?: boolean;
  /** Whether the model accepts image inputs. */
  image?: boolean;
}

/** Cost in dollars per 1M tokens. Cache fields are optional. */
export interface CustomProviderModelCost {
  input?: number;
  output?: number;
  cacheRead?: number;
  cacheWrite?: number;
}

export interface CustomProviderModel {
  id: string;
  name: string;
  /** Optional per-model API kind override. When unset, model inherits provider api. */
  api?: CustomProviderApiKind;
  contextWindow?: number;
  maxTokens?: number;
  capabilities?: CustomProviderModelCapabilities;
  cost?: CustomProviderModelCost;
}

/** Reference to an apiKey resolution. The literal value is stored in SecretStorage, not here. */
export interface CustomProviderApiKeyRef {
  source: CustomProviderApiKeySource;
  /**
   * Display label for the key reference. For `vscode-secret`: the env-var name we'll set
   * (e.g. `AFX_OPENROUTER_KEY`). For `env-var` / `shell-cmd`: the literal name/command.
   * Never contains the resolved secret value.
   */
  label?: string;
}

/**
 * Host-internal canonical record. Lives in VSCode SecretStorage entirely — including
 * apiKey VALUE — and is translated by the active harness adapter at bootstrap time.
 * NEVER crosses the host→webview bridge in cleartext (use {@link CustomProviderSummary}).
 */
export interface CustomProviderRecord {
  id: string;
  displayName?: string;
  baseUrl: string;
  api: CustomProviderApiKind;
  /**
   * The literal key value (when `source === "vscode-secret"`) or unused for other sources.
   * Webview never receives this field.
   */
  apiKey?: string;
  apiKeyRef: CustomProviderApiKeyRef;
  /**
   * Whether the resolved API key should be sent as `Authorization: Bearer <key>` —
   * pi-mono provider option. Most OpenAI-compatible providers expect `true`.
   */
  authHeader?: boolean;
  models: CustomProviderModel[];
  /** Optional custom request headers, e.g. `x-portkey-api-key`. */
  headers?: Record<string, string>;
  /**
   * Per-api-kind compatibility flags. Adapter merges these on top of harness-specific
   * defaults at serialize time (e.g. pi-mono's `supportsDeveloperRole: false` for
   * Ollama / vLLM). See {@link COMPAT_FLAGS_BY_API} for the canonical UI-known set.
   */
  compat?: Record<string, unknown>;
}

/**
 * Canonical UI-known compat flag descriptors per api kind. The form renders a
 * checkbox per flag for the active api; values not in this map are preserved
 * round-trip but not surfaced individually (escape hatch: Open models.json).
 *
 * @see docs/specs/214-app-chat-settings/spec.md [FR-9]
 */
export interface CustomProviderCompatFlag {
  /** Storage key within `compat`. */
  key: string;
  /** Short label rendered next to the checkbox. */
  label: string;
  /** One-line tooltip describing the flag. */
  description: string;
  /** Default value when the flag isn't set on the record. */
  defaultValue: boolean;
}

export const COMPAT_FLAGS_BY_API: Readonly<
  Record<CustomProviderApiKind, readonly CustomProviderCompatFlag[]>
> = {
  "openai-completions": [
    {
      key: "supportsDeveloperRole",
      label: "Supports developer role",
      description:
        "Uses the OpenAI 'developer' role for system messages. Disable for providers that only accept 'system' (Ollama, Moonshot, vLLM).",
      defaultValue: false,
    },
    {
      key: "supportsReasoningEffort",
      label: "Supports reasoning effort",
      description:
        "Provider accepts an explicit `reasoning_effort` parameter on the chat completions endpoint.",
      defaultValue: false,
    },
    {
      key: "supportsStore",
      label: "Supports store=true",
      description: "Provider accepts the `store` parameter (OpenAI feature).",
      defaultValue: false,
    },
    {
      key: "supportsUsageInStreaming",
      label: "Streams usage stats",
      description: "Provider emits `stream_options.include_usage` totals while streaming.",
      defaultValue: false,
    },
  ],
  "openai-responses": [
    {
      key: "supportsDeveloperRole",
      label: "Supports developer role",
      description: "Same as openai-completions; OpenAI Responses API typically supports it.",
      defaultValue: true,
    },
    {
      key: "supportsReasoningEffort",
      label: "Supports reasoning effort",
      description: "Provider accepts an explicit `reasoning_effort` parameter.",
      defaultValue: true,
    },
  ],
  "anthropic-messages": [
    {
      key: "supportsEagerToolInputStreaming",
      label: "Eager tool input streaming",
      description:
        "Provider streams partial tool inputs as they're generated. Enable only for endpoints that explicitly support it.",
      defaultValue: false,
    },
    {
      key: "supportsLongCacheRetention",
      label: "Long cache retention",
      description: "Provider supports Anthropic's extended prompt-caching TTL.",
      defaultValue: false,
    },
  ],
  "google-generative-ai": [],
};

/**
 * Non-secret structural model summary surfaced in the webview. Excludes fields
 * pi-mono's per-model `compat` may expose that could leak provider internals.
 */
export interface CustomProviderModelSummary {
  id: string;
  name: string;
  api?: CustomProviderApiKind;
  contextWindow?: number;
  maxTokens?: number;
  capabilities?: CustomProviderModelCapabilities;
}

/**
 * Webview-safe redacted summary. The ONLY shape the host→webview bridge ever
 * carries for custom providers. Carries non-secret model summaries (id/name/
 * context window) and the boolean values of UI-known compat flags so the form
 * can hydrate on edit. NEVER carries the apiKey value, headers, or any compat
 * key outside `COMPAT_FLAGS_BY_API`.
 *
 * @see docs/specs/214-app-chat-settings/spec.md [NFR-1]
 */
export interface CustomProviderSummary {
  id: string;
  displayName?: string;
  baseUrl: string;
  api: CustomProviderApiKind;
  modelCount: number;
  /** Redacted model entries — id, name, context window, capabilities. No apiKey, no compat, no headers. */
  models: readonly CustomProviderModelSummary[];
  apiKeySource: CustomProviderApiKeySource;
  /** Display label for the key resolution (env-var name, command snippet, or short hint). */
  apiKeyLabel?: string;
  /** When source !== "none", the host has a key (or env-var ref) for this provider. */
  hasApiKey: boolean;
  /** Whether the resolved key should be sent as Authorization: Bearer at runtime. */
  authHeader?: boolean;
  /**
   * UI-known compat flags only — values for the keys listed in
   * {@link COMPAT_FLAGS_BY_API} for this provider's api kind. Unknown keys
   * stored on the canonical record are preserved server-side but not echoed.
   */
  compatFlags?: Readonly<Record<string, boolean>>;
  origin: CustomProviderOrigin;
  /** When `origin === "hand-edited"` and the file's literal key is plaintext. */
  hasLiteralApiKeyOnDisk?: boolean;
}
