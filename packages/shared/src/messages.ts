/**
 * Message protocol between the chat UI and the agent engine.
 * Discriminated-union design — every message has a `type` namespaced as `<scope>/<event>`.
 * Transport-agnostic: works over VSCode postMessage, WebSocket, or any adapter.
 *
 * @see docs/specs/100-package-shared/spec.md [FR-1] [FR-2] [FR-4]
 * @see docs/specs/100-package-shared/design.md [DES-API]
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
 * @see docs/specs/chat-ui-theme-foundation/chat-ui-theme-foundation.md [FR-4] [FR-5]
 * @see docs/specs/chat-ui-theme-foundation/chat-ui-theme-foundation.md [DES-DATA] [DES-API]
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
 * @see docs/specs/100-package-shared/design.md [DES-DATA]
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
 * @see docs/specs/100-package-shared/design.md [DES-DATA]
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
 * @see docs/specs/100-package-shared/design.md [DES-DATA]
 */
export type ChatTimelineItem = ChatMessageView | ChatCompactionView;

/**
 * A compaction summary injected by Pi after context pruning.
 * Displayed as a distinct system message in the chat timeline.
 *
 * @see docs/specs/100-package-shared/spec.md [FR-5]
 * @see docs/specs/100-package-shared/design.md [DES-DATA]
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
 * @see docs/specs/100-package-shared/design.md [DES-DATA]
 */
export interface ChatToolView {
  toolCallId: string;
  toolName: string;
  status: "running" | "ok" | "error";
  summary?: string;
  /** Tool arguments (for display). */
  args?: Record<string, unknown>;
}

/**
 * @see docs/specs/chat-foundation/chat-foundation.md [FR-12] [DES-MENTION]
 */
export interface AgentFileView {
  path: string;
  recent?: boolean;
}

/**
 * Provider credential/configuration state surfaced in Settings.
 *
 * @see docs/specs/000-plans/plan-pi-hybrid-runtime.md
 */
export type ProviderConnectionState = "empty" | "configured" | "invalid" | "no-key-needed";

/**
 * API Provider settings snapshot for the Settings view.
 *
 * @see docs/specs/000-plans/plan-pi-hybrid-runtime.md
 * @see docs/specs/chat-foundation/chat-foundation.md [FR-13] [DES-SETTINGS]
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
 * @see docs/specs/000-plans/plan-pi-hybrid-runtime.md
 * @see docs/specs/chat-foundation/chat-foundation.md [FR-13] [DES-SETTINGS]
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
 * @see docs/specs/000-plans/plan-pi-hybrid-runtime.md
 * @see docs/specs/chat-foundation/chat-foundation.md [FR-13] [DES-SETTINGS]
 */
export interface SettingsSdkSnapshot {
  enabled: boolean;
  defaultModel: string;
  ollamaBaseUrl: string;
  sessionDir: string;
}

/**
 * @see docs/specs/chat-foundation/chat-foundation.md [FR-13] [DES-SETTINGS]
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
 * @see docs/specs/100-package-shared/spec.md [FR-1] [FR-4]
 * @see docs/specs/100-package-shared/design.md [DES-API]
 */
export type ChatToAgent =
  /** Webview finished mounting and is ready to receive state. */
  | { type: "chat/ready" }
  /** User submitted a message. `requestId` lets us correlate error back. */
  | { type: "chat/send"; requestId: string; content: string; mentions?: string[] }
  /** User pressed abort. */
  | { type: "chat/abort" }
  /** User requested a fresh pi session. */
  | { type: "chat/newSession" }
  /** Webview reconnecting / asking for the current state snapshot. */
  | { type: "chat/getState" }
  | { type: "agent/checkStatus"; requestId: string }
  | { type: "agent/restart"; requestId: string }
  | { type: "agent/reload"; requestId: string }
  | { type: "chat/getModels"; requestId: string }
  | {
      type: "chat/setModel";
      requestId: string;
      provider: string;
      modelId: string;
      instanceId?: string;
    }
  | { type: "chat/getCommands"; requestId: string }
  | { type: "chat/listFiles"; requestId: string; query?: string; limit?: number }
  | { type: "chat/getSettingsSnapshot"; requestId: string }
  | { type: "provider/setApiKey"; requestId: string; provider: string; key: string }
  | { type: "provider/clearApiKey"; requestId: string; provider: string }
  | { type: "provider/setDefaultModel"; requestId: string; provider: string; modelId: string }
  | { type: "external/detectPiBinary"; requestId: string }
  | { type: "external/setRpcEnabled"; requestId: string; enabled: boolean }
  | { type: "external/setEphemeral"; requestId: string; enabled: boolean }
  | { type: "chat/getStderr"; requestId: string; maxLines?: number }
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
  | { type: "telemetry/setEnabled"; requestId: string; enabled: boolean }
  | {
      type: "appearance/update";
      requestId: string;
      theme?: string;
      style?: string;
    }
  | { type: "chat/compact"; requestId: string; customInstructions?: string }
  | { type: "chat/setThinkingLevel"; requestId: string; level: ThinkingLevel }
  | { type: "chat/setSteeringMode"; requestId: string; mode: QueueMode }
  | { type: "chat/setFollowUpMode"; requestId: string; mode: QueueMode }
  | { type: "chat/setAutoCompaction"; requestId: string; enabled: boolean }
  | { type: "chat/setAutoRetry"; requestId: string; enabled: boolean }
  /**
   * Inject a message into the active turn (mid-stream). Webview should only
   * dispatch this while the runtime status reports `isStreaming === true`.
   */
  | { type: "chat/steer"; requestId: string; content: string; mentions?: string[] }
  /**
   * Queue a message for after the active turn completes.
   */
  | { type: "chat/followUp"; requestId: string; content: string; mentions?: string[] };

// ---------------------------------------------------------------------------
// Agent → Chat (inbound: events from the engine to the chat UI)
// ---------------------------------------------------------------------------

/**
 * @see docs/specs/100-package-shared/spec.md [FR-1] [FR-4]
 * @see docs/specs/100-package-shared/design.md [DES-API]
 */
export type AgentToChat =
  /** Full state snapshot. Sent on ready and on reconnect. */
  | {
      type: "chat/state";
      isStreaming: boolean;
      messages: ChatTimelineItem[];
      tools: ChatToolView[];
    }
  /**
   * Append text into the chat composer draft (no send).
   * Used by host-side editor actions such as "Add to Context".
   */
  | { type: "chat/draftAppend"; content: string }
  /** Lightweight toast notification surfaced by the host. */
  | {
      type: "chat/toast";
      tone: "success" | "info" | "error";
      message: string;
      description?: string;
      durationMs?: number;
    }
  /** Telemetry enablement snapshot for the webview (used by Clarity integration). */
  | {
      type: "agent/telemetryState";
      enabled: boolean;
      source: "enabled" | "disabledBySetting" | "disabledByVscodeTelemetry";
    }
  /** New message started (user or assistant). */
  | {
      type: "chat/messageStart";
      id: string;
      role: ChatRole;
      createdAt: number;
      /** For user messages, the full content. Assistant content streams via deltas. */
      content?: string;
    }
  /** Streaming text appended to an in-progress assistant message. */
  | { type: "chat/messageDelta"; id: string; delta: string }
  /** Thinking/reasoning text from the model. */
  | { type: "chat/thinkingDelta"; id: string; delta: string }
  /** Message completed. */
  | { type: "chat/messageEnd"; id: string; stopReason?: string }
  /** Tool execution started. */
  | {
      type: "chat/toolStart";
      toolCallId: string;
      toolName: string;
      args: unknown;
    }
  /** Tool execution finished. */
  | {
      type: "chat/toolEnd";
      toolCallId: string;
      ok: boolean;
      summary?: string;
    }
  /**
   * Non-fatal error surfaced to the user.
   * `displayInTranscript=false` means the host already made an explicit
   * transcript/no-transcript choice for the same error. `showToast=false`
   * lets tab-specific handlers render contextual settings/action feedback.
   */
  | {
      type: "chat/error";
      message: string;
      requestId?: string;
      displayInTranscript?: boolean;
      showToast?: boolean;
    }
  /** User-initiated abort acknowledged. */
  | { type: "chat/aborted" }
  /** Generic runtime health status. */
  | { type: "agent/status"; requestId?: string; status: AgentRuntimeStatus }
  /** Token / cost / context usage after a turn. */
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
  | { type: "agent/models"; requestId: string; models: AgentModel[] }
  | { type: "agent/modelChanged"; requestId?: string; model: AgentModel }
  | { type: "agent/commands"; requestId: string; commands: AgentCommand[] }
  | { type: "agent/files"; requestId: string; files: AgentFileView[] }
  | { type: "agent/settingsSnapshot"; requestId: string; snapshot: SettingsSnapshot }
  | {
      type: "agent/appearanceUpdated";
      requestId: string;
      appearance: RuntimeAppearanceSnapshot;
    }
  | { type: "agent/stderr"; requestId: string; content: string; truncated?: boolean }
  /**
   * Runtime settings snapshot. Broadcast after activation and after every
   * `chat/set*` mutation so the chat UI reflects the engine's authoritative state.
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
  /** Result of a compaction request. */
  | { type: "agent/compacted"; requestId: string; result: CompactionResult };

// ---------------------------------------------------------------------------
// Workbench — placeholders, not yet used
// ---------------------------------------------------------------------------

/**
 * @see docs/specs/100-package-shared/spec.md [FR-4]
 * @see docs/specs/100-package-shared/design.md [DES-API]
 */
export type WorkbenchToHost = { type: "workbench/ready" };

/**
 * @see docs/specs/100-package-shared/spec.md [FR-4]
 * @see docs/specs/100-package-shared/design.md [DES-API]
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
 * @see docs/specs/100-package-shared/design.md [DES-API]
 */
export type MessageOf<U extends { type: string }, T extends U["type"]> = Extract<U, { type: T }>;
