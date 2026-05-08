import type { Logger } from "@afx/shared";

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
  /** From the caller's agent ephemeral-session setting. */
  ephemeral?: boolean;
  /** Shared Pi session directory used for cross-runtime continuity. */
  sessionDir?: string;
  /** From vscode.workspace.workspaceFolders[0]. */
  cwd?: string;
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
