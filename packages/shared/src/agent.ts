/**
 * Runtime-agnostic agent contract.
 * Every agent adapter (Pi, Aider, OpenCode, …) implements AgentManager.
 * The extension host and sidebar panel depend only on this interface.
 *
 * @see docs/specs/100-package-shared/spec.md [FR-5]
 * @see docs/specs/100-package-shared/design.md [DES-SHARED-AGENT-CONTRACT] [DES-SHARED-CHAT-VIEW-TYPES]
 */

export interface Disposable {
  dispose(): void;
}

export type { Logger } from "./logger";

export type AgentSource = "api-provider" | "external-agent";

/**
 * Host-assigned model routing classification for the composer picker.
 * `local` is display-only; only `subscription` / `api-key` are persisted to
 * `afx.authMethod.{provider}` by the OAuth sprint.
 *
 * @see docs/specs/205-app-vscode-model-selection-state/spec.md [FR-1] [FR-3] [FR-6] [NFR-3]
 * @see docs/specs/205-app-vscode-model-selection-state/design.md [DES-DATA] [DES-API]
 */
export type AgentAuthMethod = "subscription" | "api-key" | "local";

export interface AgentModel {
  provider: string;
  id: string;
  name: string;
  reasoning: boolean;
  contextWindow: number;
  maxTokens: number;
  cost?: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
  };
  /** Host-assigned source label used by model pickers. */
  source?: AgentSource;
  /** Host-assigned runtime instance id used for unambiguous model routing. */
  instanceId?: string;
  /** Human-readable runtime label for grouped model pickers. */
  instanceLabel?: string;
  /** Host-assigned credential/source method for picker segmentation. */
  authMethod?: AgentAuthMethod;
}

/**
 * Full model-selection identity sent from the composer to the host.
 *
 * @see docs/specs/205-app-vscode-model-selection-state/spec.md [FR-1] [FR-3] [FR-6] [NFR-3]
 * @see docs/specs/205-app-vscode-model-selection-state/design.md [DES-DATA] [DES-API]
 */
export interface AgentModelSelectionTarget {
  provider: string;
  modelId: string;
  instanceId?: string;
  authMethod?: AgentAuthMethod;
}

/**
 * Model fields safe to surface through runtime status updates.
 *
 * @see docs/specs/350-agent-manager/spec.md [FR-1]
 * @see docs/specs/350-agent-manager/design.md [DES-DATA]
 */
export type AgentRuntimeModel = Pick<
  AgentModel,
  "provider" | "id" | "name" | "source" | "instanceId" | "instanceLabel" | "authMethod"
> &
  Partial<Pick<AgentModel, "reasoning">>;

export interface AgentCommand {
  name: string;
  description?: string;
  source: "extension" | "prompt" | "skill";
}

export interface AgentAction {
  name: "new" | "abort";
  label: string;
  description: string;
  chatMessage: "chat/newSession" | "chat/abort";
}

/**
 * Reasoning effort for models that support it. `xhigh` is Pi's name for the
 * highest tier; cheaper models often clamp `xhigh` down to `high`.
 *
 * @see docs/specs/350-agent-manager/spec.md [FR-1]
 * @see docs/specs/350-agent-manager/design.md [DES-DATA]
 */
export type ThinkingLevel = "minimal" | "low" | "medium" | "high" | "xhigh";

/**
 * Queue mode for steering / follow-up messages while a turn is in flight.
 *
 * @see docs/specs/350-agent-manager/spec.md [FR-1]
 * @see docs/specs/350-agent-manager/design.md [DES-DATA]
 */
export type QueueMode = "all" | "one-at-a-time";

/**
 * Result of a successful `compact()` call. Mirrors Pi's `CompactionResult`
 * minus the extension-specific `details` payload, which adapters keep private.
 *
 * @see docs/specs/100-package-shared/spec.md [FR-5]
 */
export interface CompactionResult {
  summary: string;
  firstKeptEntryId: string;
  tokensBefore: number;
}

export type CompactionReason = "manual" | "overflow" | "threshold" | (string & {});

/**
 * @see docs/specs/100-package-shared/spec.md [FR-5]
 * @see docs/specs/100-package-shared/design.md [DES-SHARED-AGENT-CONTRACT]
 */
export interface AgentStatus {
  running: boolean;
  isStreaming: boolean;
  model?: AgentRuntimeModel;
  /** Optional adapter detail for non-ready states. */
  info?: string;
  /** Automatic start attempts are stopped until the user explicitly restarts. */
  restartRequired?: boolean;
  /** Active reasoning level (when adapter exposes one). */
  thinkingLevel?: ThinkingLevel;
  /** Currently compacting the message log. */
  isCompacting?: boolean;
  /** Queue mode: how many follow-up turns the engine takes from the queue. */
  steeringMode?: QueueMode;
  followUpMode?: QueueMode;
  /** Auto-compaction enabled (engine compacts when context fills). */
  autoCompactionEnabled?: boolean;
  /** Auto-retry enabled on transient provider failures. */
  autoRetryEnabled?: boolean;
  /** Engine-level session id (e.g. Pi's `sessionId`). */
  sessionId?: string;
  /** Engine-level session file used for runtime-to-runtime continuity. */
  sessionFile?: string;
  sessionName?: string;
  /** Total messages in the active session, post-compaction. */
  messageCount?: number;
  /** Total queued steering + follow-up messages reported by the engine. */
  pendingMessageCount?: number;
  /**
   * Whether the user has opted into the Pi CLI RPC runtime via `afx.rpc.enabled`.
   * Chat uses this to decide whether to surface Pi reachability in the UI; when
   * false (SDK-only flow), Pi-specific affordances stay hidden.
   */
  rpcEnabled?: boolean;
  /**
   * Whether at least one runtime instance is configured and routable. `false`
   * means the user still needs to configure an API provider or opt into Pi RPC.
   */
  runtimeConfigured?: boolean;
}

/**
 * A persisted conversation as listed in History. Runtime-agnostic; normalized
 * from the engine's native session metadata (e.g. Pi `SessionInfo`). All
 * timestamps are epoch milliseconds so the shape survives the webview
 * postMessage boundary (engine `Date` fields are converted at the adapter).
 *
 * @see docs/specs/213-app-chat-history/spec.md [FR-14]
 * @see docs/specs/213-app-chat-history/design.md [DES-PERSISTENT-DATA]
 */
export interface AgentSessionInfo {
  /** Stable session id (engine-assigned, e.g. uuidv7). */
  id: string;
  /** Session file path — the handle for open/switch/delete. */
  path: string;
  /** Display label (engine session name, else first-message snippet). */
  label?: string;
  /** First user message, used as a preview snippet. */
  firstMessage?: string;
  /** Total messages in the session. */
  messageCount: number;
  /** Creation time, epoch ms. */
  createdAt: number;
  /** Last-modified time, epoch ms. */
  updatedAt: number;
  /** Workspace directory the session ran in (header cwd) — for project grouping + reveal. */
  cwd?: string;
  /** Path of the session this one was forked from, if any. */
  forkedFrom?: string;
  /** True when the session tree has more than one branch (display marker). */
  hasBranches?: boolean;
}

/**
 * One entry in a loaded transcript, normalized from the engine's native message
 * shape so the host can render history without importing engine types.
 *
 * @see docs/specs/213-app-chat-history/spec.md [FR-15]
 * @see docs/specs/213-app-chat-history/design.md [DES-PERSISTENT-DATA]
 */
export interface AgentTranscriptEntry {
  /** Source role of this entry. */
  role: "user" | "assistant" | "tool" | "bash" | "compaction";
  /** User content / joined assistant text blocks / summary text. */
  text?: string;
  /** Assistant reasoning content, when present. */
  thinking?: string;
  /** Tool calls requested in an assistant turn. */
  toolCalls?: { id: string; name: string; args: Record<string, unknown> }[];
  /** Result of a tool call (`ok` = `!isError`). */
  toolResult?: {
    toolCallId: string;
    toolName: string;
    ok: boolean;
    summary?: string;
  };
  /** Bash execution detail, for bash entries. */
  bash?: { command: string; exitCode?: number };
  /** Entry timestamp, epoch ms. */
  createdAt: number;
}

/**
 * Runtime health phase shared by every chat host shell.
 *
 * @see docs/specs/350-agent-manager/spec.md [FR-1]
 * @see docs/specs/350-agent-manager/design.md [DES-API]
 */
export type AgentRuntimePhase =
  | "checking"
  | "starting"
  | "ready"
  | "busy"
  | "disconnected"
  | "error";

/**
 * Host-owned runtime health snapshot. Chat, History, Settings, VS Code, and
 * future web/browser hosts consume this shape instead of runtime-specific state.
 *
 * @see docs/specs/350-agent-manager/spec.md [FR-1]
 * @see docs/specs/350-agent-manager/design.md [DES-API]
 */
export interface AgentRuntimeStatus {
  phase: AgentRuntimePhase;
  running: boolean;
  isStreaming: boolean;
  model?: AgentRuntimeModel;
  info?: string;
  /** Whether Pi RPC is opted in via `afx.rpc.enabled`. */
  rpcEnabled?: boolean;
  /** Whether at least one runtime instance is configured and routable. */
  runtimeConfigured?: boolean;
  /** Host should stop automatic polling/retry and wait for manual restart. */
  restartRequired?: boolean;
  checkedAt: number;
  lastReadyAt?: number;
  consecutiveFailures: number;
}

/**
 * Phase derivation input used by host monitors and mock transports.
 *
 * @see docs/specs/350-agent-manager/spec.md [FR-1]
 * @see docs/specs/350-agent-manager/design.md [DES-API] [DES-TEST]
 */
export interface AgentRuntimeStatusInput {
  status?: AgentStatus;
  error?: unknown;
  now?: number;
  previous?: AgentRuntimeStatus;
  startedAt?: number;
  startupGraceMs?: number;
  failureThreshold?: number;
}

/** @see docs/specs/350-agent-manager/spec.md [FR-1] */
export const AGENT_RUNTIME_STARTUP_GRACE_MS = 30_000;

/** @see docs/specs/350-agent-manager/spec.md [FR-1] */
export const AGENT_RUNTIME_FAILURE_THRESHOLD = 3;

/**
 * Initial runtime state for mounted UIs before the host has answered.
 *
 * @see docs/specs/350-agent-manager/spec.md [FR-1]
 * @see docs/specs/350-agent-manager/design.md [DES-API]
 */
export function createCheckingAgentRuntimeStatus(now = Date.now()): AgentRuntimeStatus {
  return {
    phase: "checking",
    running: false,
    isStreaming: false,
    checkedAt: now,
    consecutiveFailures: 0,
  };
}

/**
 * Convert low-level adapter status into the user-facing runtime health phase.
 *
 * @see docs/specs/350-agent-manager/spec.md [FR-1]
 * @see docs/specs/350-agent-manager/design.md [DES-API] [DES-TEST]
 */
export function deriveAgentRuntimeStatus(input: AgentRuntimeStatusInput): AgentRuntimeStatus {
  const now = input.now ?? Date.now();
  const previous = input.previous;
  const startupGraceMs = input.startupGraceMs ?? AGENT_RUNTIME_STARTUP_GRACE_MS;
  const failureThreshold = input.failureThreshold ?? AGENT_RUNTIME_FAILURE_THRESHOLD;
  const startedAt = input.startedAt ?? previous?.checkedAt ?? now;
  const errorInfo = formatRuntimeError(input.error);
  const running = input.status?.running ?? false;
  const isStreaming = input.status?.isStreaming ?? false;
  const runtimeConfigured = running
    ? true
    : (input.status?.runtimeConfigured ?? previous?.runtimeConfigured);
  const isUnconfigured = runtimeConfigured === false;
  const restartRequired = !running && input.status?.restartRequired === true;
  const hasFailure = !isUnconfigured && (Boolean(input.error) || !running);
  const baseConsecutiveFailures = hasFailure ? (previous?.consecutiveFailures ?? 0) + 1 : 0;
  const consecutiveFailures = restartRequired
    ? Math.max(baseConsecutiveFailures, failureThreshold)
    : baseConsecutiveFailures;
  const lastReadyAt = running ? now : previous?.lastReadyAt;
  const wasReady =
    previous?.phase === "ready" ||
    previous?.phase === "busy" ||
    previous?.lastReadyAt !== undefined;

  let phase: AgentRuntimePhase;
  if (running) {
    phase = isStreaming ? "busy" : "ready";
  } else if (isUnconfigured) {
    phase = "disconnected";
  } else if (restartRequired) {
    phase = "error";
  } else {
    const elapsedStartupMs = Math.max(0, now - startedAt);
    const failureLimitHit = wasReady
      ? consecutiveFailures >= failureThreshold
      : elapsedStartupMs >= startupGraceMs;
    if (!failureLimitHit) {
      phase = wasReady ? "checking" : "starting";
    } else {
      phase = input.error ? "error" : "disconnected";
    }
  }

  return {
    phase,
    running,
    isStreaming,
    model: input.status?.model ?? previous?.model,
    info: errorInfo ?? input.status?.info,
    rpcEnabled: input.status?.rpcEnabled ?? previous?.rpcEnabled,
    runtimeConfigured,
    restartRequired,
    checkedAt: now,
    lastReadyAt,
    consecutiveFailures,
  };
}

function formatRuntimeError(error: unknown): string | undefined {
  if (!error) return undefined;
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return JSON.stringify(error);
}

/**
 * @see docs/specs/100-package-shared/spec.md [FR-5]
 * @see docs/specs/100-package-shared/design.md [DES-SHARED-AGENT-CONTRACT]
 */
export interface AgentUsageStats {
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
 * @see docs/specs/100-package-shared/spec.md [FR-5]
 * @see docs/specs/100-package-shared/design.md [DES-SHARED-AGENT-CONTRACT]
 */
export type AgentUiRequest =
  | {
      type: "ui_request";
      id: string;
      method: "select";
      title: string;
      options: string[];
      timeout?: number;
    }
  | {
      type: "ui_request";
      id: string;
      method: "confirm";
      title: string;
      message: string;
      timeout?: number;
    }
  | {
      type: "ui_request";
      id: string;
      method: "input";
      title: string;
      placeholder?: string;
      timeout?: number;
    }
  | { type: "ui_request"; id: string; method: "editor"; title: string; prefill?: string }
  | {
      type: "ui_request";
      id: string;
      method: "notify";
      message: string;
      notifyType?: "info" | "warning" | "error";
    }
  | { type: "ui_request"; id: string; method: "setStatus"; statusKey: string; statusText?: string }
  | {
      type: "ui_request";
      id: string;
      method: "setWidget";
      widgetKey: string;
      widgetLines?: string[];
      widgetPlacement?: "aboveEditor" | "belowEditor";
    }
  | { type: "ui_request"; id: string; method: "setTitle"; title: string }
  | { type: "ui_request"; id: string; method: "set_editor_text"; text: string };

/**
 * @see docs/specs/100-package-shared/spec.md [FR-5]
 * @see docs/specs/100-package-shared/design.md [DES-SHARED-AGENT-CONTRACT]
 */
export type AgentUiResponse =
  | { id: string; value: string }
  | { id: string; confirmed: boolean }
  | { id: string; cancelled: true };

/**
 * Normalized event union — adapters translate native event shapes to this union.
 *
 * @see docs/specs/100-package-shared/spec.md [FR-5]
 * @see docs/specs/100-package-shared/design.md [DES-SHARED-AGENT-CONTRACT]
 */
export type AgentEvent =
  | { type: "agent_start" }
  | { type: "agent_end" }
  | { type: "context_overflow"; message: string }
  | { type: "retryable_error"; message: string }
  /**
   * Provider authentication failure (HTTP 401 / OAuth `invalid_grant` /
   * `invalid_token` / unauthorized). Pi surfaces no structured auth error — the
   * adapter classifies the free-text `message.errorMessage` and emits this so the
   * host can run one reactive refresh + restart + retry per turn, then fail closed.
   *
   * @see docs/specs/353-agent-oauth-credential-store/spec.md [FR-1] [FR-2] [FR-4] [FR-5] [FR-6] [FR-7] [NFR-1]
   * @see docs/specs/353-agent-oauth-credential-store/design.md [DES-DATA] [DES-API] [DES-LOCK]
   */
  | { type: "auth_error"; provider?: string; message: string }
  | { type: "compaction_start"; reason: CompactionReason }
  | {
      type: "compaction_end";
      reason: CompactionReason;
      result?: CompactionResult;
      aborted: boolean;
      willRetry: boolean;
      errorMessage?: string;
    }
  | {
      type: "auto_retry_start";
      attempt: number;
      maxAttempts: number;
      delayMs: number;
      errorMessage: string;
    }
  | { type: "auto_retry_end"; success: boolean; attempt: number; finalError?: string }
  | { type: "message_start"; role: "user" | "assistant"; content?: string; errorMessage?: string }
  | { type: "message_end"; role: "user" | "assistant"; stopReason?: string }
  | { type: "text_delta"; id: string; delta: string }
  | { type: "thinking_delta"; id: string; delta: string }
  | { type: "tool_start"; toolCallId: string; toolName: string; args?: Record<string, unknown> }
  | { type: "tool_end"; toolCallId: string; ok: boolean; result?: unknown }
  /** Engine queue changed after a steer/follow-up was queued or consumed. */
  | {
      type: "queue_update";
      steeringCount: number;
      followUpCount: number;
      pendingMessageCount: number;
    }
  | AgentUiRequest
  | { type: "error"; message: string };

/** @see docs/specs/100-package-shared/spec.md [FR-5] */
export type AgentEventListener = (event: AgentEvent) => void;
/** @see docs/specs/100-package-shared/spec.md [FR-5] */
export type AgentStderrListener = (chunk: string) => void;

/**
 * Flow: [AgentManager.AdapterContract]
 *
 * Runtime-agnostic agent contract — implemented by every adapter.
 *
 * @see docs/specs/350-agent-manager/spec.md [FR-1]
 * @see docs/specs/350-agent-manager/design.md [DES-API]
 * @see docs/specs/100-package-shared/spec.md [FR-5]
 * @see docs/specs/100-package-shared/design.md [DES-SHARED-AGENT-CONTRACT]
 */
export interface AgentManager {
  send(message: string): Promise<void>;
  abort(): Promise<void>;
  newSession(): Promise<void>;
  getStatus(): Promise<AgentStatus>;
  getUsage(): Promise<AgentUsageStats | null>;
  getAvailableModels(): Promise<AgentModel[]>;
  setModel(target: AgentModelSelectionTarget): Promise<AgentModel>;
  switchSession?(sessionPath: string): Promise<{ cancelled: boolean }>;
  /**
   * List persisted past sessions for the active workspace (newest-first).
   * Optional — adapters without a session store omit it; callers must
   * feature-detect (the multiplexer throws for unsupported runtimes).
   *
   * @see docs/specs/213-app-chat-history/spec.md [FR-14]
   * @see docs/specs/213-app-chat-history/design.md [DES-PERSISTENT-API]
   */
  listSessions?(opts?: { allWorkspaces?: boolean }): Promise<AgentSessionInfo[]>;
  /**
   * Load a past session's transcript (active leaf branch) for read-only
   * display, without disturbing the live session.
   *
   * @see docs/specs/213-app-chat-history/spec.md [FR-15]
   * @see docs/specs/213-app-chat-history/design.md [DES-PERSISTENT-API]
   */
  getTranscript?(sessionPath: string): Promise<AgentTranscriptEntry[]>;
  /**
   * Rename the currently-loaded session.
   *
   * @see docs/specs/213-app-chat-history/spec.md [FR-15]
   * @see docs/specs/213-app-chat-history/design.md [DES-PERSISTENT-API]
   */
  setSessionName?(name: string): Promise<void>;
  /**
   * Delete a persisted session by path.
   *
   * @see docs/specs/213-app-chat-history/spec.md [FR-19]
   * @see docs/specs/213-app-chat-history/design.md [DES-PERSISTENT-API]
   */
  deleteSession?(sessionPath: string): Promise<void>;
  getCommands(): Promise<AgentCommand[]>;
  getStderr(): string;
  /** Compact the active session's history. Adapters that don't support it should reject. */
  compact(customInstructions?: string): Promise<CompactionResult>;
  /**
   * Inject a message into the active turn. Engine processes mid-stream (per Pi `steer`).
   * Adapters without mid-stream injection should reject; callers must check `getStatus().isStreaming`.
   */
  steer(message: string): Promise<void>;
  /**
   * Queue a message for after the active turn completes (per Pi `follow_up`).
   * Adapters without a queue should reject.
   */
  followUp(message: string): Promise<void>;
  setThinkingLevel(level: ThinkingLevel): Promise<void>;
  setSteeringMode(mode: QueueMode): Promise<void>;
  setFollowUpMode(mode: QueueMode): Promise<void>;
  setAutoCompaction(enabled: boolean): Promise<void>;
  setAutoRetry(enabled: boolean): Promise<void>;
  respondToUiRequest(response: AgentUiResponse): Promise<void>;
  onEvent(listener: AgentEventListener): Disposable;
  onStderr(listener: AgentStderrListener): Disposable;
  stop(): Promise<void>;
  dispose(): Promise<void>;
}
