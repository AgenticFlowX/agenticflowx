/**
 * Pi RPC manager — single-instance lifecycle manager implementing AgentManager.
 * Config is injected by the caller (apps/vscode/src/extension.ts reads VSCode settings).
 * No vscode import in this package.
 *
 * @see docs/specs/300-infra-pi/spec.md [FR-1] [FR-2] [FR-5] [FR-8] [FR-9]
 * @see docs/specs/300-infra-pi/design.md [DES-API]
 */
import type {
  AgentCommand,
  AgentEvent,
  AgentEventListener,
  AgentManager,
  AgentModel,
  AgentStatus,
  AgentStderrListener,
  AgentUiResponse,
  AgentUsageStats,
  CompactionResult,
  Disposable,
  Logger,
  QueueMode,
  ThinkingLevel,
} from "@afx/shared";

import { type PiClient, type PiEvent, createPiClient } from "./rpc-client";

const START_RETRY_COOLDOWN_MS = 10_000;
const START_MAX_ATTEMPTS = 3;
const CONTEXT_OVERFLOW_PATTERNS: readonly RegExp[] = [
  /exceeds the context window/i,
  /context window exceeds limit/i,
  /input token count.*exceeds the maximum/i,
  /maximum context length is \d+ tokens/i,
  /too many tokens/i,
  /token limit exceeded/i,
  /context[_ ]length[_ ]exceeded/i,
];
const RETRYABLE_PROVIDER_ERROR_PATTERNS: readonly RegExp[] = [
  /overloaded/i,
  /provider.?returned.?error/i,
  /rate.?limit/i,
  /too many requests/i,
  /\b429\b/,
  /\b5\d\d\b/,
  /service.?unavailable/i,
  /server.?error/i,
  /internal.?error/i,
  /network.?error/i,
  /connection.?(?:error|refused|lost)/i,
  /other side closed/i,
  /fetch failed/i,
  /upstream.?connect/i,
  /reset before headers/i,
  /socket hang up/i,
  /ended without/i,
  /http2 request did not get a response/i,
  /timed? out|timeout/i,
  /terminated/i,
];

/**
 * @see docs/specs/300-infra-pi/spec.md [FR-1] [FR-7]
 * @see docs/specs/300-infra-pi/design.md [DES-API]
 */
export interface PiRpcManagerOptions {
  /** Caller-supplied logger. The manager scopes its own child as `{parent}:rpc-manager`. */
  logger: Logger;
  /** Optional caller-provided CLI path; createPiClient falls back to its adapter default. */
  binaryPath?: string;
  /** From the caller's agent ephemeral-session setting. */
  ephemeral: boolean;
  /** Shared Pi session directory used for cross-runtime continuity. */
  sessionDir?: string;
  /** From vscode.workspace.workspaceFolders[0]. */
  cwd?: string;
  /** Additional skill roots appended as repeated `--skill <path>` CLI args. */
  additionalSkillPaths?: readonly string[];
  /** Absolute path to a default .afx.yaml bundled with the extension. Passed as `--append-system-prompt <path>` so the model has fallback config. */
  defaultConfigPath?: string;
  /** Environment overrides passed to the spawned runtime. */
  env?: Record<string, string>;
}

/**
 * Pi-backed `AgentManager` factory. Lazy-spawns the Pi subprocess on first use.
 *
 * @see docs/specs/300-infra-pi/spec.md [FR-1] [FR-2] [FR-5] [FR-9]
 * @see docs/specs/300-infra-pi/design.md [DES-API]
 */
export function createAgentManager(opts: PiRpcManagerOptions): AgentManager {
  const {
    logger: parentLogger,
    binaryPath,
    ephemeral,
    sessionDir,
    cwd,
    additionalSkillPaths = [],
    defaultConfigPath,
    env,
  } = opts;
  const log = parentLogger.child("rpc-manager");

  let rpcClient: PiClient | null = null;
  let startPromise: Promise<PiClient> | null = null;
  let lastStartFailure: { at: number; error: Error } | null = null;
  let failedStartAttempts = 0;
  let startDisabledError: Error | null = null;
  let isStreaming = false;
  // Tracks the current assistant message ID for text_delta / thinking_delta events.
  let currentMsgId: string | null = null;

  const eventListeners = new Set<AgentEventListener>();
  const stderrListeners = new Set<AgentStderrListener>();

  async function ensureStarted(): Promise<PiClient> {
    if (rpcClient?.isRunning) return rpcClient;
    if (startPromise) return startPromise;
    const retryError = getStartRetryError();
    if (retryError) throw retryError;

    const args = [
      ...(!ephemeral && sessionDir ? ["--session-dir", sessionDir] : []),
      ...(ephemeral ? ["--no-session"] : []),
      ...additionalSkillPaths.flatMap((p) => ["--skill", p]),
      ...(defaultConfigPath ? ["--append-system-prompt", defaultConfigPath] : []),
    ];

    const c = createPiClient({
      binaryPath,
      cwd,
      args,
      env,
      logger: log.child("client"),
    });

    rpcClient = c;
    startPromise = (async () => {
      try {
        await c.start();
        log.info("started");
        lastStartFailure = null;
        failedStartAttempts = 0;
        startDisabledError = null;
        return c;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        rpcClient = null;
        startPromise = null;
        failedStartAttempts += 1;
        if (failedStartAttempts >= START_MAX_ATTEMPTS) {
          lastStartFailure = null;
          startDisabledError = createStartDisabledError("Pi RPC", error);
          log.error("start disabled after repeated failures", startDisabledError, {
            attempts: failedStartAttempts,
          });
          throw startDisabledError;
        }
        lastStartFailure = { at: Date.now(), error };
        log.error("start failed", error, { attempts: failedStartAttempts });
        throw error;
      }
    })();

    c.onExit((info) => {
      log.info("process exited", { code: info.code, signal: info.signal });
      rpcClient = null;
      startPromise = null;
      isStreaming = false;
      currentMsgId = null;
    });

    // Single raw event listener per client; dispatches to all manager-level listeners.
    c.onEvent(normalizeAndEmit);

    c.onStderr((chunk) => {
      for (const l of stderrListeners) {
        try {
          l(chunk);
        } catch {
          /* ignore */
        }
      }
    });

    return startPromise;
  }

  function getStartRetryError(): Error | null {
    if (startDisabledError) return startDisabledError;
    if (!lastStartFailure) return null;
    const age = Date.now() - lastStartFailure.at;
    if (age >= START_RETRY_COOLDOWN_MS) {
      lastStartFailure = null;
      return null;
    }
    return new Error(
      `Pi RPC start retry suppressed for ${START_RETRY_COOLDOWN_MS - age}ms after previous failure: ${lastStartFailure.error.message}`,
    );
  }

  function emitEvent(evt: AgentEvent): void {
    for (const l of eventListeners) {
      try {
        l(evt);
      } catch (err) {
        log.error("event listener threw", err instanceof Error ? err : undefined);
      }
    }
  }

  function normalizeAndEmit(raw: PiEvent): void {
    const evt = normalizePiEvent(raw);
    if (evt) emitEvent(evt);
  }

  function normalizePiEvent(raw: PiEvent): AgentEvent | null {
    switch (raw.type) {
      case "agent_start": {
        isStreaming = true;
        currentMsgId = null;
        return { type: "agent_start" };
      }
      case "agent_end": {
        isStreaming = false;
        currentMsgId = null;
        return { type: "agent_end" };
      }
      case "message_start": {
        const message = (raw.message ?? {}) as {
          role?: string;
          content?: Array<{ type?: string; text?: string }>;
          stopReason?: string;
          errorMessage?: string;
        };
        if (message.role === "user") {
          const text = Array.isArray(message.content)
            ? message.content
                .filter((c) => c?.type === "text" && typeof c.text === "string")
                .map((c) => c.text as string)
                .join("")
            : "";
          return { type: "message_start", role: "user", content: text };
        }
        if (message.role !== "assistant") return null;
        // API failure packed into a synthetic assistant message.
        if (message.stopReason === "error" && typeof message.errorMessage === "string") {
          if (isContextOverflowError(message.errorMessage)) {
            return { type: "context_overflow", message: message.errorMessage };
          }
          if (isRetryableProviderError(message.errorMessage)) {
            return { type: "retryable_error", message: message.errorMessage };
          }
          return { type: "message_start", role: "assistant", errorMessage: message.errorMessage };
        }
        // Non-streaming: full content in message_start, no text_delta follows.
        const text = Array.isArray(message.content)
          ? message.content
              .filter((c) => c?.type === "text" && typeof c.text === "string")
              .map((c) => c.text as string)
              .join("")
          : "";
        if (text.length > 0) {
          return { type: "message_start", role: "assistant", content: text };
        }
        return null; // streaming mode — first text_delta creates the message in the consumer
      }
      case "message_end": {
        const message = (raw.message ?? {}) as {
          role?: string;
          stopReason?: string;
          errorMessage?: string;
        };
        if (message.role !== "assistant" && message.role !== "user") return null;
        if (message.role === "assistant") currentMsgId = null;
        if (message.role === "assistant" && message.stopReason === "error") {
          const messageText =
            typeof message.errorMessage === "string" && message.errorMessage.length > 0
              ? message.errorMessage
              : "The provider returned an error.";
          if (isContextOverflowError(messageText)) {
            return { type: "context_overflow", message: messageText };
          }
          if (isRetryableProviderError(messageText)) {
            return { type: "retryable_error", message: messageText };
          }
          return {
            type: "error",
            message: messageText,
          };
        }
        return {
          type: "message_end",
          role: message.role,
          stopReason: typeof message.stopReason === "string" ? message.stopReason : undefined,
        };
      }
      case "message_update": {
        const delta = raw.assistantMessageEvent as
          | { type: string; delta?: string; message?: string; error?: string }
          | undefined;
        if (!delta) return null;
        switch (delta.type) {
          case "thinking_start":
          case "text_start": {
            currentMsgId ??= generateId();
            return null;
          }
          case "text_delta": {
            if (!currentMsgId) currentMsgId = generateId();
            if (typeof delta.delta !== "string" || delta.delta.length === 0) {
              return null;
            }
            return { type: "text_delta", id: currentMsgId, delta: delta.delta };
          }
          case "thinking_delta": {
            if (!currentMsgId) currentMsgId = generateId();
            if (typeof delta.delta !== "string" || delta.delta.length === 0) {
              return null;
            }
            return { type: "thinking_delta", id: currentMsgId, delta: delta.delta };
          }
          case "error": {
            const message = delta.message ?? delta.error ?? "pi message_update.error";
            return { type: "error", message };
          }
          default:
            return null; // text_end, thinking_start, thinking_end, toolcall_* — no-op
        }
      }
      case "tool_execution_start": {
        const toolCallId = typeof raw.toolCallId === "string" ? raw.toolCallId : "";
        const toolName = typeof raw.toolName === "string" ? raw.toolName : "tool";
        if (!toolCallId) return null;
        return {
          type: "tool_start",
          toolCallId,
          toolName,
          args: raw.args as Record<string, unknown> | undefined,
        };
      }
      case "tool_execution_end": {
        const toolCallId = typeof raw.toolCallId === "string" ? raw.toolCallId : "";
        if (!toolCallId) return null;
        return {
          type: "tool_end",
          toolCallId,
          ok: !raw.isError,
          result: raw.result,
        };
      }
      case "queue_update": {
        const steeringCount = Array.isArray(raw.steering) ? raw.steering.length : 0;
        const followUpCount = Array.isArray(raw.followUp) ? raw.followUp.length : 0;
        return {
          type: "queue_update",
          steeringCount,
          followUpCount,
          pendingMessageCount: steeringCount + followUpCount,
        };
      }
      case "compaction_start": {
        return {
          type: "compaction_start",
          reason: typeof raw.reason === "string" ? raw.reason : "manual",
        };
      }
      case "compaction_end": {
        return {
          type: "compaction_end",
          reason: typeof raw.reason === "string" ? raw.reason : "manual",
          result: normalizeCompactionResult(raw.result),
          aborted: raw.aborted === true,
          willRetry: raw.willRetry === true,
          errorMessage: typeof raw.errorMessage === "string" ? raw.errorMessage : undefined,
        };
      }
      case "auto_retry_start": {
        return {
          type: "auto_retry_start",
          attempt: toFiniteNumber(raw.attempt, 0),
          maxAttempts: toFiniteNumber(raw.maxAttempts, 0),
          delayMs: toFiniteNumber(raw.delayMs, 0),
          errorMessage:
            typeof raw.errorMessage === "string" ? raw.errorMessage : "The provider failed.",
        };
      }
      case "auto_retry_end": {
        return {
          type: "auto_retry_end",
          success: raw.success === true,
          attempt: toFiniteNumber(raw.attempt, 0),
          finalError: typeof raw.finalError === "string" ? raw.finalError : undefined,
        };
      }
      case "error":
      case "agent_error": {
        const message = extractMessage(raw) ?? `pi emitted ${raw.type}`;
        return { type: "error", message };
      }
      case "extension_ui_request": {
        return normalizeUiRequest(raw);
      }
      default:
        return null;
    }
  }

  function normalizeUiRequest(raw: PiEvent): AgentEvent | null {
    const id = typeof raw.id === "string" ? raw.id : "";
    const method = typeof raw.method === "string" ? raw.method : "";
    if (!id || !method) return null;

    const timeout = typeof raw.timeout === "number" ? raw.timeout : undefined;
    switch (method) {
      case "select": {
        const title = typeof raw.title === "string" ? raw.title : "Select";
        const options = Array.isArray(raw.options)
          ? raw.options.filter((option): option is string => typeof option === "string")
          : [];
        return { type: "ui_request", id, method, title, options, timeout };
      }
      case "confirm": {
        const title = typeof raw.title === "string" ? raw.title : "Confirm";
        const message = typeof raw.message === "string" ? raw.message : title;
        return { type: "ui_request", id, method, title, message, timeout };
      }
      case "input": {
        const title = typeof raw.title === "string" ? raw.title : "Input";
        const placeholder = typeof raw.placeholder === "string" ? raw.placeholder : undefined;
        return { type: "ui_request", id, method, title, placeholder, timeout };
      }
      case "editor": {
        const title = typeof raw.title === "string" ? raw.title : "Editor";
        const prefill = typeof raw.prefill === "string" ? raw.prefill : undefined;
        return { type: "ui_request", id, method, title, prefill };
      }
      case "notify": {
        const message = typeof raw.message === "string" ? raw.message : "";
        const notifyType =
          raw.notifyType === "info" || raw.notifyType === "warning" || raw.notifyType === "error"
            ? raw.notifyType
            : undefined;
        return { type: "ui_request", id, method, message, notifyType };
      }
      case "setStatus": {
        const statusKey = typeof raw.statusKey === "string" ? raw.statusKey : "";
        const statusText = typeof raw.statusText === "string" ? raw.statusText : undefined;
        if (!statusKey) return null;
        return { type: "ui_request", id, method, statusKey, statusText };
      }
      case "setWidget": {
        const widgetKey = typeof raw.widgetKey === "string" ? raw.widgetKey : "";
        const widgetLines = Array.isArray(raw.widgetLines)
          ? raw.widgetLines.filter((line): line is string => typeof line === "string")
          : undefined;
        const widgetPlacement =
          raw.widgetPlacement === "aboveEditor" || raw.widgetPlacement === "belowEditor"
            ? raw.widgetPlacement
            : undefined;
        if (!widgetKey) return null;
        return { type: "ui_request", id, method, widgetKey, widgetLines, widgetPlacement };
      }
      case "setTitle": {
        const title = typeof raw.title === "string" ? raw.title : "";
        if (!title) return null;
        return { type: "ui_request", id, method, title };
      }
      case "set_editor_text": {
        const text = typeof raw.text === "string" ? raw.text : "";
        return { type: "ui_request", id, method, text };
      }
      default:
        return null;
    }
  }

  function extractMessage(raw: PiEvent): string | undefined {
    if (typeof raw.message === "string" && raw.message.length > 0) return raw.message;
    if (typeof raw.error === "string" && raw.error.length > 0) return raw.error;
    if (raw.error && typeof raw.error === "object") {
      const inner = (raw.error as { message?: unknown }).message;
      if (typeof inner === "string" && inner.length > 0) return inner;
    }
    return undefined;
  }

  function generateId(): string {
    const g = globalThis as unknown as { crypto?: { randomUUID?: () => string } };
    if (g.crypto?.randomUUID) return g.crypto.randomUUID();
    return `msg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function normalizeCompactionResult(value: unknown): CompactionResult | undefined {
    if (!value || typeof value !== "object") return undefined;
    const raw = value as {
      summary?: unknown;
      firstKeptEntryId?: unknown;
      tokensBefore?: unknown;
    };
    return {
      summary: typeof raw.summary === "string" ? raw.summary : "",
      firstKeptEntryId: typeof raw.firstKeptEntryId === "string" ? raw.firstKeptEntryId : "",
      tokensBefore: typeof raw.tokensBefore === "number" ? raw.tokensBefore : 0,
    };
  }

  function isContextOverflowError(message: string): boolean {
    return CONTEXT_OVERFLOW_PATTERNS.some((pattern) => pattern.test(message));
  }

  function isRetryableProviderError(message: string): boolean {
    if (isContextOverflowError(message)) return false;
    return RETRYABLE_PROVIDER_ERROR_PATTERNS.some((pattern) => pattern.test(message));
  }

  function toFiniteNumber(value: unknown, fallback: number): number {
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
  }

  async function send(message: string): Promise<void> {
    const c = await ensureStarted();
    await c.request({ type: "prompt", message: rewriteAfxCommandPrompt(message) });
  }

  async function abort(): Promise<void> {
    const c = await ensureStarted();
    await c.request({ type: "abort" });
  }

  async function steer(message: string): Promise<void> {
    const c = await ensureStarted();
    await c.request({ type: "steer", message: rewriteAfxCommandPrompt(message) });
  }

  async function followUp(message: string): Promise<void> {
    const c = await ensureStarted();
    await c.request({ type: "follow_up", message: rewriteAfxCommandPrompt(message) });
  }

  async function newSession(): Promise<void> {
    const c = await ensureStarted();
    await c.request({ type: "new_session" });
  }

  async function getStatus(): Promise<AgentStatus> {
    try {
      await ensureStarted();
    } catch (err) {
      return startFailureStatus(err);
    }
    const c = rpcClient;
    if (!c?.isRunning) return { running: false, isStreaming };

    try {
      const st = await c.request<RpcSessionStateLike | null>({ type: "get_state" });
      return mapPiStateToStatus(st, c.isRunning, isStreaming);
    } catch {
      // not critical — return minimal status
      return { running: c.isRunning, isStreaming };
    }
  }

  async function getAvailableModels(): Promise<AgentModel[]> {
    const c = await ensureStarted();
    // Pi wraps the list: `data: { models: Model[] }`. Unwrap before normalizing.
    const response = await c.request<{ models?: unknown } | unknown[]>({
      type: "get_available_models",
    });
    const models = Array.isArray(response)
      ? response
      : Array.isArray(response?.models)
        ? (response as { models: unknown[] }).models
        : [];
    const normalized = models.map(normalizeModel).filter((m): m is AgentModel => m !== null);
    log.debug(
      () =>
        `getAvailableModels: raw=${JSON.stringify(response).slice(0, 240)}; ` +
        `arrayLen=${models.length}; normalizedLen=${normalized.length}`,
    );
    return normalized;
  }

  async function setModel(target: { provider: string; modelId: string }): Promise<AgentModel> {
    const c = await ensureStarted();
    const response = await c.request<unknown>({
      type: "set_model",
      provider: target.provider,
      modelId: target.modelId,
    });
    const direct = normalizeModel(response);
    if (direct) return direct;

    const status = await c.request<{ model?: unknown } | null>({ type: "get_state" });
    const model = normalizeModel(status?.model);
    if (model) return model;
    return {
      provider: target.provider,
      id: target.modelId,
      name: target.modelId,
      reasoning: false,
      contextWindow: 0,
      maxTokens: 0,
    };
  }

  async function switchSession(sessionPath: string): Promise<{ cancelled: boolean }> {
    const c = await ensureStarted();
    const result = await c.request<{ cancelled?: unknown } | null>({
      type: "switch_session",
      sessionPath,
    });
    return { cancelled: result?.cancelled === true };
  }

  async function getCommands(): Promise<AgentCommand[]> {
    const c = await ensureStarted();
    // Pi wraps the list: `data: { commands: RpcSlashCommand[] }`. Unwrap before normalizing.
    const response = await c.request<{ commands?: unknown } | unknown[]>({
      type: "get_commands",
    });
    const commands = Array.isArray(response)
      ? response
      : Array.isArray(response?.commands)
        ? (response as { commands: unknown[] }).commands
        : [];
    const normalized = commands
      .map(normalizeCommand)
      .filter((cmd): cmd is AgentCommand => cmd !== null);
    log.debug(
      () =>
        `getCommands: raw=${JSON.stringify(response).slice(0, 240)}; ` +
        `arrayLen=${commands.length}; normalizedLen=${normalized.length}`,
    );
    return normalized;
  }

  function getStderr(): string {
    return rpcClient?.getStderr() ?? "";
  }

  async function getUsage(): Promise<AgentUsageStats | null> {
    try {
      await ensureStarted();
    } catch {
      return null;
    }
    const c = rpcClient;
    if (!c?.isRunning) return null;

    try {
      const stats = await c.request<{
        tokens?: {
          input?: number;
          output?: number;
          cacheRead?: number;
          cacheWrite?: number;
          total?: number;
        };
        cost?: number;
        contextUsage?: {
          tokens: number | null;
          contextWindow: number;
          percent: number | null;
        };
      }>({ type: "get_session_stats" });
      return {
        tokens: {
          input: stats.tokens?.input ?? 0,
          output: stats.tokens?.output ?? 0,
          cacheRead: stats.tokens?.cacheRead ?? 0,
          cacheWrite: stats.tokens?.cacheWrite ?? 0,
          total: stats.tokens?.total ?? 0,
        },
        cost: stats.cost ?? 0,
        contextUsage: stats.contextUsage,
      };
    } catch (err) {
      log.error("get_session_stats failed", err instanceof Error ? err : undefined);
      return null;
    }
  }

  async function compact(customInstructions?: string): Promise<CompactionResult> {
    const c = await ensureStarted();
    const response = await c.request<{
      summary?: unknown;
      firstKeptEntryId?: unknown;
      tokensBefore?: unknown;
    } | null>({
      type: "compact",
      ...(customInstructions ? { customInstructions } : {}),
    });
    return {
      summary: typeof response?.summary === "string" ? response.summary : "",
      firstKeptEntryId:
        typeof response?.firstKeptEntryId === "string" ? response.firstKeptEntryId : "",
      tokensBefore: typeof response?.tokensBefore === "number" ? response.tokensBefore : 0,
    };
  }

  async function setThinkingLevel(level: ThinkingLevel): Promise<void> {
    const c = await ensureStarted();
    await c.request({ type: "set_thinking_level", level });
  }

  async function setSteeringMode(mode: QueueMode): Promise<void> {
    const c = await ensureStarted();
    await c.request({ type: "set_steering_mode", mode });
  }

  async function setFollowUpMode(mode: QueueMode): Promise<void> {
    const c = await ensureStarted();
    await c.request({ type: "set_follow_up_mode", mode });
  }

  async function setAutoCompaction(enabled: boolean): Promise<void> {
    const c = await ensureStarted();
    await c.request({ type: "set_auto_compaction", enabled });
  }

  async function setAutoRetry(enabled: boolean): Promise<void> {
    const c = await ensureStarted();
    await c.request({ type: "set_auto_retry", enabled });
  }

  function respondToUiRequest(response: AgentUiResponse): Promise<void> {
    const c = rpcClient;
    if (!c?.isRunning) throw new Error("PiClient not started");
    c.send({ type: "extension_ui_response", ...response });
    return Promise.resolve();
  }

  function onEvent(listener: AgentEventListener): Disposable {
    eventListeners.add(listener);
    return {
      dispose: () => {
        eventListeners.delete(listener);
      },
    };
  }

  function onStderr(listener: AgentStderrListener): Disposable {
    stderrListeners.add(listener);
    return {
      dispose: () => {
        stderrListeners.delete(listener);
      },
    };
  }

  async function stop(): Promise<void> {
    const c = rpcClient;
    rpcClient = null;
    startPromise = null;
    lastStartFailure = null;
    failedStartAttempts = 0;
    startDisabledError = null;
    isStreaming = false;
    currentMsgId = null;
    if (c) await c.dispose();
    log.info("stopped");
  }

  function startFailureStatus(error: unknown): AgentStatus {
    return {
      running: false,
      isStreaming: false,
      info: formatError(error),
      restartRequired: startDisabledError !== null,
    };
  }

  async function dispose(): Promise<void> {
    eventListeners.clear();
    stderrListeners.clear();
    await stop();
  }

  return {
    send,
    abort,
    newSession,
    getStatus,
    getUsage,
    getAvailableModels,
    setModel,
    switchSession,
    getCommands,
    getStderr,
    compact,
    steer,
    followUp,
    setThinkingLevel,
    setSteeringMode,
    setFollowUpMode,
    setAutoCompaction,
    setAutoRetry,
    respondToUiRequest,
    onEvent,
    onStderr,
    stop,
    dispose,
  };
}

/**
 * Rewrites only leading AFX chat slash commands into Pi's skill command prefix.
 *
 * @see docs/specs/chat-foundation/chat-foundation.md [FR-8] [NFR-4] [DES-DEC] [3.1]
 */
export function rewriteAfxCommandPrompt(message: string): string {
  return message.replace(/^(\s*)\/afx-(?=\S)/, "$1/skill:afx-");
}

/**
 * Subset of Pi's `RpcSessionState` we depend on. Adapter-internal — not
 * exported. Pi may add more fields over time; we ignore unknown ones.
 */
interface RpcSessionStateLike {
  model?: { provider?: unknown; id?: unknown; name?: unknown; reasoning?: unknown } | null;
  thinkingLevel?: unknown;
  isCompacting?: unknown;
  steeringMode?: unknown;
  followUpMode?: unknown;
  autoCompactionEnabled?: unknown;
  autoRetryEnabled?: unknown;
  sessionId?: unknown;
  sessionFile?: unknown;
  sessionName?: unknown;
  messageCount?: unknown;
  pendingMessageCount?: unknown;
}

const THINKING_LEVELS: readonly ThinkingLevel[] = ["minimal", "low", "medium", "high", "xhigh"];
const QUEUE_MODES: readonly QueueMode[] = ["all", "one-at-a-time"];

function asThinkingLevel(value: unknown): ThinkingLevel | undefined {
  return typeof value === "string" && (THINKING_LEVELS as readonly string[]).includes(value)
    ? (value as ThinkingLevel)
    : undefined;
}

function asQueueMode(value: unknown): QueueMode | undefined {
  return typeof value === "string" && (QUEUE_MODES as readonly string[]).includes(value)
    ? (value as QueueMode)
    : undefined;
}

function mapPiStateToStatus(
  st: RpcSessionStateLike | null | undefined,
  running: boolean,
  isStreaming: boolean,
): AgentStatus {
  if (!st) return { running, isStreaming };
  let model: AgentStatus["model"];
  const m = st.model;
  if (m && typeof m === "object" && typeof m.provider === "string" && typeof m.id === "string") {
    model = {
      provider: m.provider,
      id: m.id,
      name: typeof m.name === "string" && m.name.length > 0 ? m.name : m.id,
      reasoning: typeof m.reasoning === "boolean" ? m.reasoning : undefined,
    };
  }
  return {
    running,
    isStreaming,
    model,
    thinkingLevel: asThinkingLevel(st.thinkingLevel),
    isCompacting: typeof st.isCompacting === "boolean" ? st.isCompacting : undefined,
    steeringMode: asQueueMode(st.steeringMode),
    followUpMode: asQueueMode(st.followUpMode),
    autoCompactionEnabled:
      typeof st.autoCompactionEnabled === "boolean" ? st.autoCompactionEnabled : undefined,
    autoRetryEnabled: typeof st.autoRetryEnabled === "boolean" ? st.autoRetryEnabled : undefined,
    sessionId: typeof st.sessionId === "string" ? st.sessionId : undefined,
    sessionFile: typeof st.sessionFile === "string" ? st.sessionFile : undefined,
    sessionName: typeof st.sessionName === "string" ? st.sessionName : undefined,
    messageCount: typeof st.messageCount === "number" ? st.messageCount : undefined,
    pendingMessageCount:
      typeof st.pendingMessageCount === "number" ? st.pendingMessageCount : undefined,
  };
}

function normalizeModel(value: unknown): AgentModel | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as {
    provider?: unknown;
    id?: unknown;
    name?: unknown;
    reasoning?: unknown;
    contextWindow?: unknown;
    maxTokens?: unknown;
    cost?: unknown;
  };
  if (typeof raw.provider !== "string" || typeof raw.id !== "string") return null;
  return {
    provider: raw.provider,
    id: raw.id,
    name: typeof raw.name === "string" && raw.name.length > 0 ? raw.name : raw.id,
    reasoning: typeof raw.reasoning === "boolean" ? raw.reasoning : false,
    contextWindow: typeof raw.contextWindow === "number" ? raw.contextWindow : 0,
    maxTokens: typeof raw.maxTokens === "number" ? raw.maxTokens : 0,
    cost: normalizeModelCost(raw.cost),
  };
}

function normalizeModelCost(value: unknown): AgentModel["cost"] {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as {
    input?: unknown;
    output?: unknown;
    cacheRead?: unknown;
    cacheWrite?: unknown;
  };
  return {
    input: typeof raw.input === "number" ? raw.input : 0,
    output: typeof raw.output === "number" ? raw.output : 0,
    cacheRead: typeof raw.cacheRead === "number" ? raw.cacheRead : 0,
    cacheWrite: typeof raw.cacheWrite === "number" ? raw.cacheWrite : 0,
  };
}

function normalizeCommand(value: unknown): AgentCommand | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as { name?: unknown; description?: unknown; source?: unknown };
  if (typeof raw.name !== "string") return null;
  if (raw.source !== "extension" && raw.source !== "prompt" && raw.source !== "skill") return null;
  return {
    name: raw.name,
    description: typeof raw.description === "string" ? raw.description : undefined,
    source: raw.source,
  };
}

function createStartDisabledError(runtimeLabel: string, lastError: Error): Error {
  return new Error(
    `${runtimeLabel} failed to start ${START_MAX_ATTEMPTS} times. Automatic retries are stopped until you restart the agent runtime. Last error: ${lastError.message}`,
  );
}

function formatError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return JSON.stringify(error);
}
