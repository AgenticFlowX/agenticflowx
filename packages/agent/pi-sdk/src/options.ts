import type { Logger, ProviderAuthMethod } from "@afx/shared";

export interface PiSdkManagerOptions {
  /** Caller-supplied logger. The manager scopes its own child as `{parent}:sdk-rpc-manager`. */
  logger: Logger;
  /** Executable bootstrap path, usually `packages/agent/pi-sdk/dist/bootstrap.js`. */
  bootstrapPath: string;
  /** API provider hosted by this runtime instance. */
  provider: string;
  /** Initial model id for this provider. */
  modelId: string;
  /** Providers with credentials/base URLs configured for this bundled runtime. */
  apiProviders?: readonly string[];
  /** API-key lookup supplied by the host secret store. */
  getApiKey: (provider: string) => string | Promise<string | undefined> | undefined;
  /**
   * Active credential-method lookup supplied by the host secret store. When a
   * provider is using a subscription token, the bootstrap gets
   * `AFX_AUTH_METHOD_{PROVIDER}=subscription` so the token stays env-only and
   * never becomes a `--api-key` process arg.
   *
   * @see docs/specs/355-agent-sdk-credential-injection/spec.md [FR-1] [FR-2] [FR-3] [FR-4] [FR-5] [FR-6] [FR-7] [NFR-1] [NFR-3]
   * @see docs/specs/355-agent-sdk-credential-injection/design.md [DES-FLOW] [DES-EXTERNAL]
   */
  getAuthMethod?: (
    provider: string,
  ) => ProviderAuthMethod | Promise<ProviderAuthMethod | undefined> | undefined;
  /** From the caller's agent ephemeral-session setting. */
  ephemeral?: boolean;
  /** Shared Pi session directory used for cross-runtime continuity. */
  sessionDir?: string;
  /** Resolved Pi agent dir (`$PI_CODING_AGENT_DIR` or `~/.pi/agent`); a history read root. */
  agentDir?: string;
  /** From vscode.workspace.workspaceFolders[0]. */
  cwd?: string;
  /** Additional host prompt files appended as repeated `--append-system-prompt <path>` CLI args. */
  additionalSystemPromptPaths?: readonly string[];
  /** Additional skill roots appended as repeated `--skill <path>` CLI args. */
  additionalSkillPaths?: readonly string[];
  /** Optional Ollama endpoint for local provider models. */
  ollamaBaseUrl?: string;
  /** Absolute path to a default .afx.yaml bundled with the extension. */
  defaultConfigPath?: string;
  /**
   * Extra env entries merged into the bootstrap process env. Used by the AFX
   * custom-providers service to ship `AFX_CUSTOM_PROVIDERS_JSON` and per-provider
   * `AFX_<ID>_KEY` to the bootstrap.
   *
   * @see docs/specs/351-agent-pi/spec.md [FR-5]
   * @see docs/specs/351-agent-pi/design.md [DES-PI-CUSTOM-PROVIDERS]
   */
  extraEnv?: Record<string, string>;
}
