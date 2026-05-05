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
 * Snapshot of the active editor file surfaced to the composer UI.
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-11]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-CONTEXT]
 */
export interface ActiveFileContextSnapshot {
  name: string;
  path: string;
}

/**
 * @see docs/specs/214-app-chat-settings/spec.md [FR-1] [FR-2] [FR-5]
 * @see docs/specs/214-app-chat-settings/design.md [DES-DATA] [DES-SETTINGS-SURFACE-CONTEXT]
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
  providers: SettingsProviderSnapshot[];
  externalAgents?: SettingsExternalAgentSnapshot[];
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
  | { type: "chat/saveNote"; content: string };

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
   * @see docs/specs/214-app-chat-settings/spec.md [FR-1]
   * @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-FLOW]
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
  | { type: "agent/dangerousConfirmed"; requestId: string; confirmed: boolean };

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
