/**
 * Message protocol between the chat UI and the agent engine.
 * Discriminated-union design — every message has a `type` namespaced as `<scope>/<event>`.
 * Transport-agnostic: works over VSCode postMessage, WebSocket, or any adapter.
 *
 * @see docs/specs/100-package-shared/spec.md [FR-1] [FR-2] [FR-4]
 * @see docs/specs/100-package-shared/design.md [DES-SHARED-CHAT-PROTOCOL] [DES-SHARED-CHAT-VIEW-TYPES]
 */
import type {
  AgentCommand,
  AgentModel,
  AgentRuntimeStatus,
  AgentStatus,
  CompactionResult,
  QueueMode,
  ThinkingLevel,
} from "./agent";
import type {
  CustomProviderApiKeySource,
  CustomProviderApiKind,
  CustomProviderModel,
  CustomProviderSummary,
  HarnessId,
} from "./custom-providers";
import type { WorkspaceMode } from "./types";
import type { FocusOption, PhaseRow, SignOffSummary } from "./workbench-types";

// ---------------------------------------------------------------------------
// Runtime appearance
// ---------------------------------------------------------------------------

/**
 * Runtime appearance identities and treatment styles.
 *
 * @see docs/specs/131-package-ui-design-system/spec.md [FR-1] [FR-4]
 * @see docs/specs/131-package-ui-design-system/design.md [DES-DATA] [DES-API]
 */
export const AFX_THEME_IDS = ["meridian"] as const;
export type AfxThemeId = (typeof AFX_THEME_IDS)[number];

export const AFX_STYLE_IDS = ["lyra", "luma", "maia", "nova", "vega", "mira", "sera"] as const;
export type AfxStyleId = (typeof AFX_STYLE_IDS)[number];

export interface RuntimeAppearanceOption<T extends string> {
  id: T;
  label: string;
  implemented: boolean;
  description: string;
}

export interface RuntimeAppearanceSnapshot {
  theme: AfxThemeId;
  style: AfxStyleId;
  themes: Array<RuntimeAppearanceOption<AfxThemeId>>;
  styles: Array<RuntimeAppearanceOption<AfxStyleId>>;
}

// ---------------------------------------------------------------------------
// Chat message view (webview-friendly projection; not pi's full AgentMessage)
// ---------------------------------------------------------------------------

/** Chat roles + special system message types. */
export type ChatRole = "user" | "assistant" | "compactionSummary";

/**
 * @see docs/specs/100-package-shared/spec.md [FR-2]
 * @see docs/specs/100-package-shared/design.md [DES-SHARED-CHAT-VIEW-TYPES]
 */
export interface ChatUsageView {
  tokens: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    total: number;
  };
  cost: number;
  contextUsage?: {
    tokens: number | null;
    contextWindow: number;
    percent: number | null;
  };
}

/**
 * @see docs/specs/100-package-shared/spec.md [FR-2]
 * @see docs/specs/100-package-shared/design.md [DES-SHARED-CHAT-VIEW-TYPES]
 */
export interface ChatMessageView {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
  /** Present while the assistant message is streaming. */
  streaming?: boolean;
  /** Optional stop reason reported by pi. */
  stopReason?: string;
  /** Tool calls that occurred during this assistant turn. */
  tools?: ChatToolView[];
  /** Thinking/reasoning text (may be partial while streaming). */
  thinking?: string;
  /** Per-response usage snapshot for this assistant turn. */
  usage?: ChatUsageView;
}

/**
 * Any item that can appear in the chat timeline — regular messages or special cards.
 *
 * @see docs/specs/100-package-shared/spec.md [FR-2] [FR-5]
 * @see docs/specs/100-package-shared/design.md [DES-SHARED-CHAT-VIEW-TYPES]
 */
export type ChatTimelineItem = ChatMessageView | ChatCompactionView;

/**
 * A compaction summary injected by Pi after context pruning.
 * Displayed as a distinct system message in the chat timeline.
 *
 * @see docs/specs/100-package-shared/spec.md [FR-5]
 * @see docs/specs/100-package-shared/design.md [DES-SHARED-CHAT-VIEW-TYPES]
 */
export interface ChatCompactionView {
  id: string;
  role: "compactionSummary";
  /** Human-readable summary of what was compacted. */
  summary: string;
  /** Token count of the messages that were removed. */
  tokensBefore: number;
  createdAt: number;
}

/**
 * Lightweight summary of a tool execution surfaced in the chat UI.
 *
 * @see docs/specs/100-package-shared/spec.md [FR-2]
 * @see docs/specs/100-package-shared/design.md [DES-SHARED-CHAT-VIEW-TYPES]
 */
export interface ChatToolView {
  toolCallId: string;
  toolName: string;
  status: "running" | "ok" | "error";
  summary?: string;
  /** Tool arguments (for display). */
  args?: Record<string, unknown>;
  /**
   * 1-indexed first-changed line from the underlying tool result. Populated by
   * `chat/toolEnd` when the harness reports one (e.g. pi-mono
   * `result.details.firstChangedLine`). The composer modified-files strip reads
   * this field to jump the editor selection on pill click.
   *
   * @see docs/specs/211-app-chat-composer/spec.md [FR-10]
   * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-FILES-STRIP]
   */
  firstChangedLine?: number;
}

/**
 * @see docs/specs/211-app-chat-composer/spec.md [FR-3]
 * @see docs/specs/211-app-chat-composer/design.md [DES-DATA]
 */
export interface AgentFileView {
  path: string;
  recent?: boolean;
}

/**
 * Provider credential/configuration state surfaced in Settings.
 *
 * @see docs/specs/214-app-chat-settings/spec.md [FR-1] [FR-2]
 * @see docs/specs/214-app-chat-settings/design.md [DES-DATA]
 */
export type ProviderConnectionState = "empty" | "configured" | "invalid" | "no-key-needed";

/**
 * API Provider settings snapshot for the Settings view.
 *
 * @see docs/specs/214-app-chat-settings/spec.md [FR-1] [FR-2]
 * @see docs/specs/214-app-chat-settings/design.md [DES-DATA]
 */
export interface SettingsProviderSnapshot {
  id: string;
  name: string;
  displayName?: string;
  modelCount: number;
  state: ProviderConnectionState;
  modelHint?: string;
  defaultModel?: string;
  models?: AgentModel[];
  helpUrl?: string;
}

/**
 * External local-agent settings snapshot for the Settings view.
 *
 * @see docs/specs/214-app-chat-settings/spec.md [FR-1] [FR-2]
 * @see docs/specs/214-app-chat-settings/design.md [DES-DATA]
 */
export interface SettingsExternalAgentSnapshot {
  id: string;
  name: string;
  status: "connected" | "disabled" | "unavailable" | "coming-soon";
  modelCount: number;
  binaryPath?: string;
  versionLabel?: string;
  enabled?: boolean;
  ephemeral?: boolean;
}

/**
 * API Provider runtime configuration surfaced in Settings.
 *
 * @see docs/specs/214-app-chat-settings/spec.md [FR-1] [FR-2]
 * @see docs/specs/214-app-chat-settings/design.md [DES-DATA]
 */
export interface SettingsSdkSnapshot {
  enabled: boolean;
  defaultModel: string;
  ollamaBaseUrl: string;
  sessionDir: string;
}

/**
 * Active-file context preference mirrored between Settings and the composer.
 *
 * @see docs/specs/214-app-chat-settings/spec.md [FR-5]
 * @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-SURFACE-CONTEXT]
 */
export interface SettingsContextSnapshot {
  includeActiveFileContext: boolean;
}

/**
 * Workspace mode preference mirrored between Settings, the chat composer, and
 * the host bridge.
 *
 * @see docs/specs/100-package-shared/spec.md [FR-9]
 */
export interface SettingsModeSnapshot {
  active: WorkspaceMode;
}

/**
 * One-time onboarding dismissal flags. Persisted in `ExtensionContext.workspaceState`.
 *
 * @see docs/specs/100-package-shared/spec.md [FR-12]
 */
export interface OnboardingFlagsSnapshot {
  specModeOfferDismissed: boolean;
  specModeTooltipSeen: boolean;
  docActionsTooltipSeen: boolean;
}

/**
 * Snapshot of the active editor file surfaced to the composer UI.
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-11]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-CONTEXT]
 */
export interface ActiveFileContextSnapshot {
  name: string;
  path: string;
}

export type ActiveDocFormat = "sprint" | "standard" | null;
export type ActiveDocSection = "SPEC" | "DESIGN" | "TASKS" | null;
export type ActiveDocKind =
  | "spec"
  | "design"
  | "tasks"
  | "journal"
  | "adr"
  | "research"
  | "context"
  | null;

/**
 * Active AFX document context surfaced to the composer doc-actions strip.
 * New fields are optional so old hosts and old webviews can interoperate.
 *
 * @see docs/specs/100-package-shared/spec.md [FR-12]
 * @see docs/specs/100-package-shared/design.md [DES-SHARED-CHAT-PROTOCOL]
 * @see docs/specs/211-app-chat-composer/spec.md [FR-15]
 */
export interface ActiveDocContextSnapshot {
  format: ActiveDocFormat;
  section: ActiveDocSection;
  docKind: ActiveDocKind;
  feature: string | null;
  filePath?: string | null;
  approvalStatus: string | null;
  taskPhases?: PhaseRow[];
  signOff?: SignOffSummary;
  parsedFocuses?: FocusOption[];
  specStatus?: string | null;
  designStatus?: string | null;
  tasksStatus?: string | null;
  tasksCompleted?: number;
  tasksTotal?: number;
  /**
   * Row counts for the `## Work Sessions` table inside `tasks.md` (or the
   * `## SESSIONS` slice of a sprint file). Powers the spec stepper's
   * `Work Sessions n/m` chip — `n` is the number of rows whose Human cell is
   * ticked, `m` is the total row count. Distinct from `tasksCompleted/Total`
   * which counts body checkbox tasks, not session log entries.
   *
   * @see docs/specs/211-app-chat-composer/spec.md [FR-17]
   */
  workSessionsTotal?: number;
  workSessionsSigned?: number;
  /**
   * Absolute paths to sibling SDD files for the current feature, populated only
   * when the host can resolve them on disk. Powers per-step click-to-open in
   * the spec stepper — a missing entry renders the stepper node as disabled.
   * Sprint files leave these undefined; the stepper jumps to in-file sections
   * via `sectionOffsets` instead.
   *
   * @see docs/specs/211-app-chat-composer/spec.md [FR-17]
   * @see docs/specs/100-package-shared/design.md [DES-SHARED-CHAT-PROTOCOL]
   */
  siblingPaths?: {
    spec?: string;
    design?: string;
    tasks?: string;
    journal?: string;
  };
  /**
   * 1-indexed line numbers for in-file section headings in sprint single-file
   * SDD format. The stepper uses these to dispatch `chat/openFile { path,
   * line }` so clicking a step scrolls to the matching `## SPEC` / `## DESIGN`
   * / `## TASKS` heading. Standard 4-file mode leaves these undefined and uses
   * `siblingPaths` for navigation. `sessions` is the sprint Work Sessions
   * heading line; for standard mode this targets the `## Work Sessions` heading
   * inside `tasks.md`.
   *
   * @see docs/specs/211-app-chat-composer/spec.md [FR-17]
   * @see docs/specs/100-package-shared/design.md [DES-SHARED-CHAT-PROTOCOL]
   */
  sectionOffsets?: {
    spec?: number;
    design?: number;
    tasks?: number;
    sessions?: number;
  };
}

/**
 * Custom-provider snapshot fragment — drives the Custom Models sub-tab.
 * Only carries `CustomProviderSummary` (redacted); never apiKey, models[],
 * headers, or compat. See `assertNoSecretLeak` in `@afx/shared/custom-providers`.
 *
 * @see docs/specs/214-app-chat-settings/spec.md [FR-8] [FR-10] [NFR-1]
 * @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-CUSTOM-MODELS]
 */
export interface SettingsCustomModelsSnapshot {
  /** Active harness id — drives which adapter the host uses for translation. */
  activeHarness: HarnessId;
  /** Pi SDK track — AFX-managed providers from VSCode SecretStorage. */
  piSdk: { providers: CustomProviderSummary[] };
  /** Pi RPC track — read-only display of `~/.pi/agent/models.json`. Optional when not surfaced. */
  piRpc?: {
    path: string;
    status: "ready" | "parse-error" | "missing";
    error?: string;
    providers: CustomProviderSummary[];
  };
}

/**
 * @see docs/specs/214-app-chat-settings/spec.md [FR-1] [FR-2] [FR-5] [FR-6] [FR-8]
 * @see docs/specs/214-app-chat-settings/design.md [DES-DATA] [DES-SETTINGS-SURFACE-CONTEXT] [DES-SETTINGS-CUSTOM-MODELS]
 * @see docs/specs/100-package-shared/spec.md [FR-7] [FR-9]
 */
export interface SettingsSnapshot {
  appearance: RuntimeAppearanceSnapshot;
  engine: {
    rpcEnabled: boolean;
    agentBinary: string;
    bundledSkillsPath: string;
    bundledSkillCount: number;
    ephemeral: boolean;
  };
  sdk?: SettingsSdkSnapshot;
  context: SettingsContextSnapshot;
  mode: SettingsModeSnapshot;
  /**
   * Optional — older transports / mock fixtures may omit this. Webview consumers
   * default missing flags to `false` (offer/tooltip not yet dismissed).
   *
   * @see docs/specs/100-package-shared/spec.md [FR-12]
   */
  onboarding?: OnboardingFlagsSnapshot;
  providers: SettingsProviderSnapshot[];
  externalAgents?: SettingsExternalAgentSnapshot[];
  /**
   * Custom Models snapshot. Optional — older transports / fixtures may omit this.
   *
   * @see docs/specs/214-app-chat-settings/spec.md [FR-8]
   */
  customModels?: SettingsCustomModelsSnapshot;
  diagnostics: { logLevel: string };
  telemetry: {
    enabled: boolean;
    effectiveEnabled: boolean;
    vscodeTelemetryEnabled: boolean;
  };
  about: { extensionVersion: string; bundledPiNpmVersion?: string };
}

// ---------------------------------------------------------------------------
// Chat → Agent (outbound: commands from the chat UI to the engine)
// ---------------------------------------------------------------------------

/**
 * Discriminated union of every webview-to-host message. Per-variant `@see`
 * routes each shape to its owning zone — the source spec a developer should
 * read first when changing that variant's payload or behavior.
 *
 * @see docs/specs/100-package-shared/spec.md [FR-1] [FR-4]
 * @see docs/specs/100-package-shared/design.md [DES-SHARED-CHAT-PROTOCOL]
 */
export type ChatToAgent =
  /**
   * Webview finished mounting and is ready to receive state.
   *
   * @see docs/specs/210-app-chat/spec.md [FR-1]
   * @see docs/specs/210-app-chat/design.md [DES-API]
   */
  | { type: "chat/ready" }
  /**
   * User submitted a message. `requestId` lets us correlate error back.
   *
   * @see docs/specs/211-app-chat-composer/spec.md [FR-1]
   * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-FLOW]
   */
  | { type: "chat/send"; requestId: string; content: string; mentions?: string[] }
  /**
   * User clicked a pill in the composer's modified-files strip. The host opens the
   * file in the editor via `vscode.window.showTextDocument`. Relative paths are
   * resolved against the workspace root. When `line` is supplied (1-indexed,
   * forwarded from `ChatToolView.firstChangedLine`), the host reveals that line
   * via the editor selection.
   *
   * @see docs/specs/211-app-chat-composer/spec.md [FR-10]
   * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-FILES-STRIP]
   */
  | { type: "chat/openFile"; path: string; line?: number }
  /**
   * Open Pi's models.json in the editor, creating it with an empty skeleton if absent.
   * The host resolves the path via PI_CODING_AGENT_DIR or ~/.pi/agent/models.json.
   *
   * @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-CUSTOM-MODELS]
   */
  | { type: "chat/openModelsJson"; requestId: string }
  /**
   * User pressed abort.
   *
   * @see docs/specs/212-app-chat-messages/spec.md [FR-1]
   * @see docs/specs/212-app-chat-messages/design.md [DES-MESSAGES-EVENT-FLOW]
   */
  | { type: "chat/abort" }
  /**
   * User requested a fresh pi session.
   *
   * @see docs/specs/212-app-chat-messages/spec.md [FR-1]
   * @see docs/specs/212-app-chat-messages/design.md [DES-MESSAGES-EVENT-FLOW]
   */
  | { type: "chat/newSession" }
  /**
   * Webview reconnecting / asking for the current state snapshot.
   *
   * @see docs/specs/212-app-chat-messages/spec.md [FR-1]
   * @see docs/specs/212-app-chat-messages/design.md [DES-MESSAGES-EVENT-FLOW]
   */
  | { type: "chat/getState" }
  /**
   * Probe runtime status (used by recovery flows and webview boot).
   *
   * @see docs/specs/350-agent-manager/spec.md [FR-1]
   * @see docs/specs/350-agent-manager/design.md [DES-API]
   */
  | { type: "agent/checkStatus"; requestId: string }
  /**
   * User-triggered restart of the active agent runtime.
   *
   * @see docs/specs/350-agent-manager/spec.md [FR-1]
   * @see docs/specs/350-agent-manager/design.md [DES-API]
   */
  | { type: "agent/restart"; requestId: string }
  /**
   * Reload the agent runtime configuration without a full restart.
   *
   * @see docs/specs/350-agent-manager/spec.md [FR-1]
   * @see docs/specs/350-agent-manager/design.md [DES-API]
   */
  | { type: "agent/reload"; requestId: string }
  /**
   * Settings panel requests the current model list.
   *
   * @see docs/specs/214-app-chat-settings/spec.md [FR-1]
   * @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-FLOW]
   */
  | { type: "chat/getModels"; requestId: string }
  /**
   * Composer model picker selected a different model.
   *
   * @see docs/specs/211-app-chat-composer/spec.md [FR-5]
   * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-RUNTIME]
   */
  | {
      type: "chat/setModel";
      requestId: string;
      provider: string;
      modelId: string;
      instanceId?: string;
    }
  /**
   * Workspace mode toggle from the chat composer or Settings surface.
   *
   * @see docs/specs/100-package-shared/spec.md [FR-10]
   * @see docs/specs/200-app-vscode/spec.md [FR-11] [FR-12]
   */
  | { type: "chat/setMode"; requestId: string; mode: WorkspaceMode }
  /**
   * Persist a one-time onboarding dismissal (mode-suggest strip, tooltips) to
   * `ExtensionContext.workspaceState`.
   *
   * @see docs/specs/100-package-shared/spec.md [FR-12]
   */
  | {
      type: "chat/setOnboardingFlag";
      key: "specModeOfferDismissed" | "specModeTooltipSeen" | "docActionsTooltipSeen";
      value: boolean;
    }
  /**
   * Composer slash popup requests the available commands.
   *
   * @see docs/specs/211-app-chat-composer/spec.md [FR-3]
   * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-HELPERS]
   */
  | { type: "chat/getCommands"; requestId: string }
  /**
   * Composer mention popup requests recent/workspace files.
   *
   * @see docs/specs/211-app-chat-composer/spec.md [FR-3]
   * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-HELPERS]
   */
  | { type: "chat/listFiles"; requestId: string; query?: string; limit?: number }
  /**
   * Settings panel requests the full settings snapshot.
   *
   * @see docs/specs/214-app-chat-settings/spec.md [FR-1]
   * @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-FLOW]
   */
  | { type: "chat/getSettingsSnapshot"; requestId: string }
  /**
   * Composer and Settings mirror the active-file context default through the host.
   *
   * @see docs/specs/211-app-chat-composer/spec.md [FR-11]
   * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-CONTEXT]
   * @see docs/specs/214-app-chat-settings/spec.md [FR-5]
   * @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-SURFACE-CONTEXT]
   */
  | { type: "chat/setIncludeActiveFileContext"; requestId: string; enabled: boolean }
  /**
   * Settings panel sets a provider API key.
   *
   * @see docs/specs/214-app-chat-settings/spec.md [FR-2]
   * @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-FLOW]
   */
  | { type: "provider/setApiKey"; requestId: string; provider: string; key: string }
  /**
   * Settings panel clears a provider API key.
   *
   * @see docs/specs/214-app-chat-settings/spec.md [FR-2]
   * @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-FLOW]
   */
  | { type: "provider/clearApiKey"; requestId: string; provider: string }
  /**
   * Settings panel sets the default model for a provider.
   *
   * @see docs/specs/214-app-chat-settings/spec.md [FR-2]
   * @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-FLOW]
   */
  | { type: "provider/setDefaultModel"; requestId: string; provider: string; modelId: string }
  /**
   * Settings recovery action: detect Pi binary on disk.
   *
   * @see docs/specs/351-agent-pi/spec.md [FR-1]
   * @see docs/specs/351-agent-pi/design.md [DES-API]
   */
  | { type: "external/detectPiBinary"; requestId: string }
  /**
   * Toggle Pi RPC runtime on/off.
   *
   * @see docs/specs/351-agent-pi/spec.md [FR-1]
   * @see docs/specs/351-agent-pi/design.md [DES-API]
   */
  | { type: "external/setRpcEnabled"; requestId: string; enabled: boolean }
  /**
   * Toggle Pi ephemeral session mode.
   *
   * @see docs/specs/351-agent-pi/spec.md [FR-1]
   * @see docs/specs/351-agent-pi/design.md [DES-API]
   */
  | { type: "external/setEphemeral"; requestId: string; enabled: boolean }
  /**
   * Settings diagnostics: pull recent agent stderr.
   *
   * @see docs/specs/350-agent-manager/spec.md [FR-1]
   * @see docs/specs/350-agent-manager/design.md [DES-API]
   */
  | { type: "chat/getStderr"; requestId: string; maxLines?: number }
  /**
   * Open a VSCode settings UI focused on a known AFX configuration key.
   *
   * @see docs/specs/214-app-chat-settings/spec.md [FR-1]
   * @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-FLOW]
   */
  | {
      type: "chat/openSettings";
      requestId: string;
      key:
        | "afx.agentBinaryPath"
        | "afx.agentEphemeralSession"
        | "afx.rpc.enabled"
        | "afx.sessionDir"
        | "afx.sdk.enabled"
        | "afx.sdk.defaultModel"
        | "afx.sdk.ollamaBaseUrl"
        | "afx.debugPerf"
        | "afx.logLevel"
        | "afx.theme"
        | "afx.style"
        | "afx.telemetry.enabled";
    }
  /**
   * Telemetry consent toggle.
   *
   * @see docs/specs/901-cross-telemetry/spec.md [FR-1]
   * @see docs/specs/901-cross-telemetry/design.md [DES-TELEMETRY-CATALOG]
   */
  | { type: "telemetry/setEnabled"; requestId: string; enabled: boolean }
  /**
   * Appearance change from the Settings appearance preview.
   *
   * @see docs/specs/131-package-ui-design-system/spec.md [FR-3]
   * @see docs/specs/131-package-ui-design-system/design.md [DES-APPEARANCE-BRIDGE]
   */
  | {
      type: "appearance/update";
      requestId: string;
      theme?: string;
      style?: string;
    }
  /**
   * Compact context (manual or auto trigger).
   *
   * @see docs/specs/212-app-chat-messages/spec.md [FR-1]
   * @see docs/specs/212-app-chat-messages/design.md [DES-MESSAGES-EVENT-FLOW]
   */
  | { type: "chat/compact"; requestId: string; customInstructions?: string }
  /**
   * Composer thinking-level selector change.
   *
   * @see docs/specs/211-app-chat-composer/spec.md [FR-5]
   * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-RUNTIME]
   */
  | { type: "chat/setThinkingLevel"; requestId: string; level: ThinkingLevel }
  /**
   * User typed a system command prefixed with "!". Host executes it locally
   * and streams the output back as a system message. Not sent to the LLM.
   *
   * @see docs/specs/210-app-chat/spec.md [FR-1]
   * @see docs/specs/210-app-chat/design.md [DES-COMPOSER-FLOW]
   */
  | { type: "chat/runCommand"; requestId: string; command: string }
  /**
   * Request confirmation from the user before executing a potentially dangerous command.
   * Host shows a VSCode warning dialog. Response is `agent/dangerousConfirmed`.
   *
   * @see docs/specs/211-app-chat-composer/spec.md [NFR-6]
   * @see docs/specs/211-app-chat-composer/design.md [DES-ERR]
   */
  | { type: "chat/confirmDangerous"; requestId: string; command: string; reason?: string }
  /**
   * Settings runtime control: streaming-mode steer policy.
   *
   * @see docs/specs/214-app-chat-settings/spec.md [FR-1]
   * @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-FLOW]
   */
  | { type: "chat/setSteeringMode"; requestId: string; mode: QueueMode }
  /**
   * Settings runtime control: streaming-mode follow-up policy.
   *
   * @see docs/specs/214-app-chat-settings/spec.md [FR-1]
   * @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-FLOW]
   */
  | { type: "chat/setFollowUpMode"; requestId: string; mode: QueueMode }
  /**
   * Settings runtime control: enable auto-compaction.
   *
   * @see docs/specs/214-app-chat-settings/spec.md [FR-1]
   * @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-FLOW]
   */
  | { type: "chat/setAutoCompaction"; requestId: string; enabled: boolean }
  /**
   * Settings runtime control: enable auto-retry.
   *
   * @see docs/specs/214-app-chat-settings/spec.md [FR-1]
   * @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-FLOW]
   */
  | { type: "chat/setAutoRetry"; requestId: string; enabled: boolean }
  /**
   * Inject a message into the active turn (mid-stream). Webview should only
   * dispatch this while the runtime status reports `isStreaming === true`.
   *
   * @see docs/specs/211-app-chat-composer/spec.md [FR-1] [FR-4]
   * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-FLOW]
   */
  | { type: "chat/steer"; requestId: string; content: string; mentions?: string[] }
  /**
   * Queue a message for after the active turn completes.
   *
   * @see docs/specs/211-app-chat-composer/spec.md [FR-1] [FR-4]
   * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-FLOW]
   */
  | { type: "chat/followUp"; requestId: string; content: string; mentions?: string[] }
  /**
   * User saved the composer draft as a note (Cmd+Enter). Host writes to .afx/notes.md.
   *
   * @see docs/specs/215-app-chat-notes/spec.md [FR-1] [FR-2]
   * @see docs/specs/215-app-chat-notes/design.md [DES-NOTES-FLOW]
   */
  | { type: "chat/saveNote"; content: string }
  /**
   * Host-side document mutation triggered by the composer doc-actions strip.
   * Currently only one action — `tasks.signOff` — runs the Work Sessions Human
   * column tick + status promotion atomically against the active editor URI.
   * The host re-parses the document on receipt and dispatches a separate
   * `agent/signOffComplete` event back so the webview can show a toast.
   *
   * @see docs/specs/211-app-chat-composer/spec.md [FR-15]
   * @see docs/specs/100-package-shared/design.md [DES-SHARED-CHAT-PROTOCOL]
   */
  | { type: "chat/hostAction"; requestId: string; action: "tasks.signOff"; uri: string }
  /**
   * Webview asks the host to re-read both Custom Models tracks (SecretStorage + ~/.pi/agent/models.json).
   *
   * @see docs/specs/214-app-chat-settings/spec.md [FR-8]
   * @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-CUSTOM-MODELS]
   */
  | { type: "customModels/refresh"; requestId: string }
  /**
   * Add or update an AFX-managed custom provider in VSCode SecretStorage. Pi SDK track only.
   * The `apiKeyValue` is the literal secret if `apiKeyRef.source === "vscode-secret"`; never echoed back.
   *
   * @see docs/specs/214-app-chat-settings/spec.md [FR-9] [FR-10]
   * @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-CUSTOM-MODELS]
   */
  | {
      type: "customModels/upsertProvider";
      requestId: string;
      provider: {
        id: string;
        displayName?: string;
        baseUrl: string;
        api: CustomProviderApiKind;
        apiKeyRef: { source: CustomProviderApiKeySource; label?: string };
        apiKeyValue?: string;
        /** Whether the resolved key should be sent as Authorization: Bearer at runtime. */
        authHeader?: boolean;
        models: CustomProviderModel[];
        headers?: Record<string, string>;
        compat?: Record<string, unknown>;
      };
    }
  /**
   * Remove an AFX-managed custom provider from VSCode SecretStorage. Pi SDK track only.
   *
   * @see docs/specs/214-app-chat-settings/spec.md [FR-9]
   * @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-CUSTOM-MODELS]
   */
  | { type: "customModels/removeProvider"; requestId: string; providerId: string }
  /**
   * Add or update a single model on an existing AFX-managed provider. Convenience message
   * used by the Add Model form to avoid round-tripping the entire provider record.
   *
   * @see docs/specs/214-app-chat-settings/spec.md [FR-9]
   * @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-CUSTOM-MODELS]
   */
  | {
      type: "customModels/upsertModel";
      requestId: string;
      providerId: string;
      model: CustomProviderModel;
    }
  /**
   * Remove a single model from an existing AFX-managed provider.
   *
   * @see docs/specs/214-app-chat-settings/spec.md [FR-9]
   * @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-CUSTOM-MODELS]
   */
  | { type: "customModels/removeModel"; requestId: string; providerId: string; modelId: string };

// ---------------------------------------------------------------------------
// Agent → Chat (inbound: events from the engine to the chat UI)
// ---------------------------------------------------------------------------

/**
 * Discriminated union of every host-to-webview message. Per-variant `@see`
 * routes each shape to its owning zone — the source spec a developer should
 * read first when changing that variant's payload or rendering behavior.
 *
 * @see docs/specs/100-package-shared/spec.md [FR-1] [FR-4]
 * @see docs/specs/100-package-shared/design.md [DES-SHARED-CHAT-PROTOCOL]
 */
export type AgentToChat =
  /**
   * Full state snapshot. Sent on ready and on reconnect.
   *
   * @see docs/specs/212-app-chat-messages/spec.md [FR-1]
   * @see docs/specs/212-app-chat-messages/design.md [DES-MESSAGES-EVENT-FLOW]
   */
  | {
      type: "chat/state";
      isStreaming: boolean;
      messages: ChatTimelineItem[];
      tools: ChatToolView[];
    }
  /**
   * Append text into the chat composer draft (no send).
   * Used by host-side editor actions such as "Add to Context".
   *
   * @see docs/specs/211-app-chat-composer/spec.md [FR-1]
   * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-FLOW]
   */
  | { type: "chat/draftAppend"; content: string }
  /**
   * Active AFX document context for the composer doc-actions strip and the
   * mode-suggest onboarding strip. Posted by `sprint-context.ts` whenever the
   * active editor changes. `format` distinguishes sprint single-doc files from
   * standard 4-file specs; `section` is only set for sprint files.
   *
   * @see docs/specs/100-package-shared/spec.md [FR-12]
   * @see docs/specs/100-package-shared/design.md [DES-SHARED-CHAT-PROTOCOL]
   */
  | ({ type: "chat/activeDocContext" } & ActiveDocContextSnapshot)
  /**
   * Lightweight toast notification surfaced by the host.
   *
   * @see docs/specs/210-app-chat/spec.md [FR-1]
   * @see docs/specs/210-app-chat/design.md [DES-API]
   */
  | {
      type: "chat/toast";
      tone: "success" | "info" | "error";
      message: string;
      description?: string;
      durationMs?: number;
    }
  /**
   * Telemetry enablement snapshot for the webview (used by Clarity integration).
   *
   * @see docs/specs/901-cross-telemetry/spec.md [FR-1]
   * @see docs/specs/901-cross-telemetry/design.md [DES-TELEMETRY-CATALOG]
   */
  | {
      type: "agent/telemetryState";
      enabled: boolean;
      source: "enabled" | "disabledBySetting" | "disabledByVscodeTelemetry";
    }
  /**
   * New message started (user or assistant).
   *
   * @see docs/specs/212-app-chat-messages/spec.md [FR-1]
   * @see docs/specs/212-app-chat-messages/design.md [DES-MESSAGES-EVENT-FLOW]
   */
  | {
      type: "chat/messageStart";
      id: string;
      role: ChatRole;
      createdAt: number;
      /** For user messages, the full content. Assistant content streams via deltas. */
      content?: string;
    }
  /**
   * Streaming text appended to an in-progress assistant message.
   *
   * @see docs/specs/212-app-chat-messages/spec.md [FR-1]
   * @see docs/specs/212-app-chat-messages/design.md [DES-MESSAGES-EVENT-FLOW]
   */
  | { type: "chat/messageDelta"; id: string; delta: string }
  /**
   * Thinking/reasoning text from the model.
   *
   * @see docs/specs/212-app-chat-messages/spec.md [FR-3]
   * @see docs/specs/212-app-chat-messages/design.md [DES-MESSAGES-MOCKUP-THINKING]
   */
  | { type: "chat/thinkingDelta"; id: string; delta: string }
  /**
   * Message completed.
   *
   * @see docs/specs/212-app-chat-messages/spec.md [FR-1]
   * @see docs/specs/212-app-chat-messages/design.md [DES-MESSAGES-EVENT-FLOW]
   */
  | { type: "chat/messageEnd"; id: string; stopReason?: string }
  /**
   * Tool execution started.
   *
   * @see docs/specs/212-app-chat-messages/spec.md [FR-2]
   * @see docs/specs/212-app-chat-messages/design.md [DES-MESSAGES-TOOLS]
   */
  | {
      type: "chat/toolStart";
      toolCallId: string;
      toolName: string;
      args: unknown;
    }
  /**
   * Tool execution finished.
   *
   * @see docs/specs/212-app-chat-messages/spec.md [FR-2]
   * @see docs/specs/212-app-chat-messages/design.md [DES-MESSAGES-TOOLS]
   */
  | {
      type: "chat/toolEnd";
      toolCallId: string;
      ok: boolean;
      summary?: string;
      /**
       * 1-indexed first-changed line forwarded from the underlying tool result
       * when the harness reports one (e.g. pi-mono
       * `result.details.firstChangedLine`). Optional, harness-agnostic.
       *
       * @see docs/specs/211-app-chat-composer/spec.md [FR-10]
       * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-FILES-STRIP]
       */
      firstChangedLine?: number;
    }
  /**
   * Non-fatal error surfaced to the user.
   * `displayInTranscript=false` means the host already made an explicit
   * transcript/no-transcript choice for the same error. `showToast=false`
   * lets tab-specific handlers render contextual settings/action feedback.
   *
   * @see docs/specs/212-app-chat-messages/spec.md [FR-1]
   * @see docs/specs/212-app-chat-messages/design.md [DES-MESSAGES-MOCKUP-SYSTEM]
   */
  | {
      type: "chat/error";
      message: string;
      requestId?: string;
      displayInTranscript?: boolean;
      showToast?: boolean;
    }
  /**
   * User-initiated abort acknowledged.
   *
   * @see docs/specs/212-app-chat-messages/spec.md [FR-1]
   * @see docs/specs/212-app-chat-messages/design.md [DES-MESSAGES-EVENT-FLOW]
   */
  | { type: "chat/aborted" }
  /**
   * Generic runtime health status.
   *
   * @see docs/specs/350-agent-manager/spec.md [FR-1]
   * @see docs/specs/350-agent-manager/design.md [DES-API]
   */
  | { type: "agent/status"; requestId?: string; status: AgentRuntimeStatus }
  /**
   * Token / cost / context usage after a turn.
   *
   * @see docs/specs/212-app-chat-messages/spec.md [FR-3]
   * @see docs/specs/212-app-chat-messages/design.md [DES-MESSAGES-META]
   */
  | {
      type: "chat/usage";
      /** Assistant message id this usage belongs to (when available). */
      messageId?: string;
      tokens: {
        input: number;
        output: number;
        cacheRead: number;
        cacheWrite: number;
        total: number;
      };
      cost: number;
      contextUsage?: {
        tokens: number | null;
        contextWindow: number;
        percent: number | null;
      };
    }
  /**
   * Settings panel: full model list response.
   *
   * @see docs/specs/214-app-chat-settings/spec.md [FR-1]
   * @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-FLOW]
   */
  | { type: "agent/models"; requestId: string; models: AgentModel[] }
  /**
   * Composer model picker: active model changed.
   *
   * @see docs/specs/211-app-chat-composer/spec.md [FR-5]
   * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-RUNTIME]
   */
  | { type: "agent/modelChanged"; requestId?: string; model: AgentModel }
  /**
   * Host rejected an action while in a restricted workspace mode.
   *
   * @see docs/specs/201-app-vscode-panels/spec.md [FR-11]
   * @see docs/specs/211-app-chat-composer/spec.md [FR-13]
   */
  | {
      type: "agent/actionBlocked";
      requestId?: string;
      mode: WorkspaceMode;
      action: "runCommand";
      title: string;
      message: string;
      command?: string;
    }
  /**
   * Composer slash popup: command list response.
   *
   * @see docs/specs/211-app-chat-composer/spec.md [FR-3]
   * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-HELPERS]
   */
  | { type: "agent/commands"; requestId: string; commands: AgentCommand[] }
  /**
   * Composer mention popup: file list response.
   *
   * @see docs/specs/211-app-chat-composer/spec.md [FR-3]
   * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-HELPERS]
   */
  | { type: "agent/files"; requestId: string; files: AgentFileView[] }
  /**
   * Settings panel: full snapshot response.
   *
   * @see docs/specs/214-app-chat-settings/spec.md [FR-2] [FR-5] [FR-6]
   * @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-FLOW]
   * @see docs/specs/100-package-shared/spec.md [FR-7] [FR-9]
   */
  | { type: "agent/settingsSnapshot"; requestId: string; snapshot: SettingsSnapshot }
  /**
   * Composer context label for the active editor file.
   *
   * @see docs/specs/211-app-chat-composer/spec.md [FR-11]
   * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-CONTEXT]
   */
  | { type: "agent/activeFileContext"; snapshot: ActiveFileContextSnapshot | null }
  /**
   * Appearance change applied (echoed back so all webviews stay in sync).
   *
   * @see docs/specs/131-package-ui-design-system/spec.md [FR-3]
   * @see docs/specs/131-package-ui-design-system/design.md [DES-APPEARANCE-BRIDGE]
   */
  | {
      type: "agent/appearanceUpdated";
      requestId: string;
      appearance: RuntimeAppearanceSnapshot;
    }
  /**
   * Settings diagnostics: agent stderr buffer.
   *
   * @see docs/specs/350-agent-manager/spec.md [FR-1]
   * @see docs/specs/350-agent-manager/design.md [DES-API]
   */
  | { type: "agent/stderr"; requestId: string; content: string; truncated?: boolean }
  /**
   * Runtime settings snapshot. Broadcast after activation and after every
   * `chat/set*` mutation so the chat UI reflects the engine's authoritative state.
   *
   * @see docs/specs/350-agent-manager/spec.md [FR-1]
   * @see docs/specs/350-agent-manager/design.md [DES-API]
   */
  | {
      type: "agent/runtimeSettings";
      requestId?: string;
      settings: Pick<
        AgentStatus,
        | "thinkingLevel"
        | "steeringMode"
        | "followUpMode"
        | "autoCompactionEnabled"
        | "autoRetryEnabled"
        | "isCompacting"
        | "sessionId"
        | "sessionFile"
        | "sessionName"
        | "messageCount"
        | "pendingMessageCount"
        | "rpcEnabled"
        | "runtimeConfigured"
      >;
    }
  /**
   * Result of a compaction request.
   *
   * @see docs/specs/212-app-chat-messages/spec.md [FR-1]
   * @see docs/specs/212-app-chat-messages/design.md [DES-MESSAGES-EVENT-FLOW]
   */
  | { type: "agent/compacted"; requestId: string; result: CompactionResult }
  /**
   * Streaming output from a system command execution.
   *
   * @see docs/specs/211-app-chat-composer/spec.md [FR-9]
   * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-SYSTEM-COMMAND]
   */
  | {
      type: "agent/commandOutput";
      requestId: string;
      streamId?: string;
      /** Partial stdout or stderr text. */
      delta?: string;
      /** Which stream this delta came from. */
      kind?: "stdout" | "stderr";
      /** Set to true when the command finishes (after the last delta). */
      done?: boolean;
      /** Exit code of the process (0-255). Present when done === true. */
      exitCode?: number;
      /** Error message if the process could not start (e.g., ENOENT). */
      error?: string;
    }
  /**
   * Response to `chat/confirmDangerous` — whether the user confirmed or cancelled.
   *
   * @see docs/specs/211-app-chat-composer/spec.md [NFR-6]
   * @see docs/specs/211-app-chat-composer/design.md [DES-ERR]
   */
  | { type: "agent/dangerousConfirmed"; requestId: string; confirmed: boolean }
  /**
   * Acknowledgement for any `customModels/*` mutation. Never echoes the apiKey value or
   * any non-public field. The webview reconciles state via a fresh `agent/settingsSnapshot`.
   *
   * @see docs/specs/214-app-chat-settings/spec.md [FR-9] [FR-10] [NFR-1]
   * @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-CUSTOM-MODELS]
   */
  | {
      type: "customModels/result";
      requestId: string;
      ok: boolean;
      /** When `ok === false`, a short non-secret error message. */
      error?: string;
    }
  /**
   * Acknowledgement for `chat/hostAction` `tasks.signOff`. Posted as a separate
   * inbound event (not a callback envelope) per the existing fire-and-forget
   * dispatch convention. The webview surfaces a toast on `ok` and an error
   * banner on `error`.
   *
   * @see docs/specs/211-app-chat-composer/spec.md [FR-15]
   * @see docs/specs/100-package-shared/design.md [DES-SHARED-CHAT-PROTOCOL]
   */
  | {
      type: "agent/signOffComplete";
      requestId: string;
      uri: string;
      ok: boolean;
      rowsTicked?: number;
      newStatus?: string;
      error?: string;
    };

// ---------------------------------------------------------------------------
// Workbench — placeholders, not yet used
// ---------------------------------------------------------------------------

/**
 * @see docs/specs/100-package-shared/spec.md [FR-4]
 * @see docs/specs/100-package-shared/design.md [DES-SHARED-WORKBENCH-PROTOCOL]
 */
export type WorkbenchToHost = { type: "workbench/ready" };

/**
 * @see docs/specs/100-package-shared/spec.md [FR-4]
 * @see docs/specs/100-package-shared/design.md [DES-SHARED-WORKBENCH-PROTOCOL]
 */
export type HostToWorkbench =
  | { type: "workbench/state"; data: unknown }
  | { type: "workbench/status"; running: boolean };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract message variants by their `type` discriminator.
 *
 * @see docs/specs/100-package-shared/spec.md [FR-1]
 * @see docs/specs/100-package-shared/design.md [DES-SHARED-CHAT-PROTOCOL]
 */
export type MessageOf<U extends { type: string }, T extends U["type"]> = Extract<U, { type: T }>;
