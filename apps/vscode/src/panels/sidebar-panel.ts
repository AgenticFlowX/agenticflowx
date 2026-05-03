/**
 * SidebarPanel — webview view provider that bridges the chat UI to the agent manager.
 * Routes chat/send, chat/abort, chat/newSession from the webview to the agent; streams events back.
 * Deltas are coalesced per message id and flushed at ~16ms intervals.
 *
 * @see docs/specs/201-app-vscode-panels/spec.md [FR-1] [FR-7]
 * @see docs/specs/201-app-vscode-panels/design.md [DES-PANELS-LIFECYCLE] [DES-PANELS-DISPATCH]
 * @see docs/specs/350-agent-manager/spec.md [FR-2] [FR-4]
 * @see docs/specs/350-agent-manager/design.md [DES-AGENT-LIFECYCLE]
 * @see docs/specs/131-package-ui-design-system/spec.md [FR-1] [FR-4]
 * @see docs/specs/131-package-ui-design-system/design.md [DES-APPEARANCE-BRIDGE]
 */
import { readFileSync } from "node:fs";
import * as path from "node:path";

import * as vscode from "vscode";

import {
  AFX_STYLE_IDS,
  AFX_THEME_IDS,
  API_PROVIDER_IDS,
  type ChatCompactionView,
  type ChatMessageView,
  type ChatTimelineItem,
  PROVIDER_DETAILS,
} from "@afx/shared";
import type {
  AfxStyleId,
  AfxThemeId,
  AgentEvent,
  AgentFileView,
  AgentManager,
  AgentModel,
  AgentRuntimeModel,
  AgentRuntimeStatus,
  AgentStatus,
  AgentToChat,
  AgentUiRequest,
  AgentUiResponse,
  ChatToAgent,
  ChatToolView,
  ChatUsageView,
  CompactionResult,
  Logger,
  RuntimeAppearanceSnapshot,
  SettingsSnapshot,
} from "@afx/shared";

import { type AgentRuntimeMonitor, createAgentRuntimeMonitor } from "../agent-runtime-monitor";
import type { SecretStore } from "../secret-store";
import { appendNoteToWorkspace } from "../utils/notes-utils";
import { getAppDistPath, loadWebviewHtml } from "./webview-html";

export const SIDEBAR_VIEW_TYPE = "afx-sidebar";

export interface SidebarPanelDeps {
  extensionUri: vscode.Uri;
  extensionMode: vscode.ExtensionMode;
  extensionVersion?: string;
  bundledPiNpmVersion?: string;
  bundledSkillsPath?: string;
  agentManager: AgentManager;
  runtimeMonitor?: AgentRuntimeMonitor;
  logger: Logger;
  secretStore?: SecretStore;
}

export interface SidebarPanelProvider extends vscode.WebviewViewProvider {
  sendExternalPrompt(content: string): Promise<void>;
  appendToDraft(content: string): Promise<void>;
  refreshRuntimeConfiguration(): Promise<void>;
}

interface SidebarState {
  isStreaming: boolean;
  messages: ChatTimelineItem[];
  tools: ChatToolView[];
  /** id of the assistant message currently being streamed, if any. */
  currentAssistantId: string | null;
  /** Runtime event id associated with the current assistant stream, when known. */
  currentAssistantSourceId: string | null;
  /** Last assistant message id completed in the active run, used for usage attribution. */
  lastAssistantId: string | null;
  /** requestId from the active send, so errors can be attributed. */
  currentRequestId: string | null;
  /** Last session totals snapshot for per-turn usage diffing. */
  lastUsageTotals: ChatUsageView | null;
  /** Suppress the runtime echo for the normal prompt, which the host renders optimistically. */
  suppressNextUserMessageStart: boolean;
  /** Whether the active send produced a response-bearing runtime event before the start timeout. */
  currentTurnSawRuntimeEvent: boolean;
}

interface QueuedUserDisplay {
  content: string;
}

type ErrorPresentation = "transcript" | "toast" | "settings-toast";

const DELTA_FLUSH_MS = 16;
const TURN_START_TIMEOUT_MS = 20_000;
const OVERFLOW_RECOVERY_GRACE_MS = 1_500;
const TOOL_SUMMARY_MAX = 200;
const MENTION_FILE_CAP_BYTES = 64 * 1024;

export function createSidebarPanel(deps: SidebarPanelDeps): SidebarPanelProvider {
  const {
    extensionUri,
    extensionMode,
    extensionVersion = "?",
    bundledPiNpmVersion = readBundledPiNpmVersion(extensionUri),
    bundledSkillsPath = vscode.Uri.joinPath(extensionUri, "resources", "skills", "agenticflowx")
      .fsPath,
    agentManager,
    runtimeMonitor: providedRuntimeMonitor,
    logger: parentLogger,
    secretStore,
  } = deps;
  const log = parentLogger.child("sidebar");
  const runtimeMonitor =
    providedRuntimeMonitor ?? createAgentRuntimeMonitor({ agentManager, logger: parentLogger });

  const state: SidebarState = {
    isStreaming: false,
    messages: [],
    tools: [],
    currentAssistantId: null,
    currentAssistantSourceId: null,
    lastAssistantId: null,
    currentRequestId: null,
    lastUsageTotals: null,
    suppressNextUserMessageStart: false,
    currentTurnSawRuntimeEvent: false,
  };
  let currentModel: AgentRuntimeModel | undefined;
  let bundledSkillCountCache: number | null = null;
  const queuedUserDisplays: QueuedUserDisplay[] = [];

  // Pending delta text per message id; flushed on a single RAF-like timer.
  const pendingDeltas = new Map<string, string>();
  let flushTimer: NodeJS.Timeout | null = null;
  let turnStartTimeout: NodeJS.Timeout | null = null;
  let overflowRecoveryTimeout: NodeJS.Timeout | null = null;
  let retryRecoveryTimeout: NodeJS.Timeout | null = null;
  let pendingContextOverflowError: string | null = null;
  let pendingRetryableError: string | null = null;

  // Some adapters print fatal errors to stderr (e.g. provider 4xx) instead of
  // emitting a normalized `error` event. We line-buffer that stream so the user
  // sees the failure in chat instead of an indefinite spinner.
  let stderrLineBuf = "";
  let errorPostedThisTurn = false;
  let postedRestartRequiredInfo: string | null = null;

  let webview: vscode.Webview | null = null;
  let chatReady = false;
  const pendingDraftAppends: string[] = [];
  const pendingToasts: Array<{
    tone: "success" | "info" | "error";
    message: string;
    description?: string;
    durationMs?: number;
  }> = [];

  function post(msg: AgentToChat): void {
    webview?.postMessage(msg);
  }

  function computeTelemetryState(): {
    enabled: boolean;
    source: "enabled" | "disabledBySetting" | "disabledByVscodeTelemetry";
  } {
    const cfg = vscode.workspace.getConfiguration("afx");
    const enabledBySetting = cfg.get<boolean>("telemetry.enabled", true);
    if (!enabledBySetting) return { enabled: false, source: "disabledBySetting" };
    if (!vscode.env.isTelemetryEnabled)
      return { enabled: false, source: "disabledByVscodeTelemetry" };
    return { enabled: true, source: "enabled" };
  }

  function postTelemetryState(): void {
    if (!webview || !chatReady) return;
    post({ type: "agent/telemetryState", ...computeTelemetryState() });
  }

  function markChatReady(): void {
    chatReady = true;
    flushPendingDraftAppends();
    flushPendingToasts();
    postTelemetryState();
  }

  function flushPendingDraftAppends(): void {
    if (!webview || !chatReady) return;
    if (pendingDraftAppends.length === 0) return;
    for (const content of pendingDraftAppends.splice(0, pendingDraftAppends.length)) {
      post({ type: "chat/draftAppend", content });
    }
  }

  function flushPendingToasts(): void {
    if (!webview || !chatReady) return;
    if (pendingToasts.length === 0) return;
    for (const payload of pendingToasts.splice(0, pendingToasts.length)) {
      post({ type: "chat/toast", ...payload });
    }
  }

  function postChatToast(payload: {
    tone: "success" | "info" | "error";
    message: string;
    description?: string;
    durationMs?: number;
  }): void {
    if (!webview || !chatReady) {
      pendingToasts.push(payload);
      return;
    }
    post({ type: "chat/toast", ...payload });
  }

  function postRuntimeStatus(status: AgentRuntimeStatus, requestId?: string): void {
    currentModel = status.model ?? currentModel;
    post({ type: "agent/status", requestId, status });
    maybePostRestartRequiredStatusError(status, requestId);
  }

  function recordRuntimeStatus(status: AgentStatus, requestId?: string): void {
    runtimeMonitor.record(
      {
        ...status,
        model: status.model ?? currentModel,
      },
      requestId,
    );
  }

  function postError(
    requestId: string | undefined,
    message: string,
    presentation: ErrorPresentation,
  ): void {
    log.error(message, { requestId });
    if (presentation === "transcript") {
      appendErrorMessage(message);
    }
    post({
      type: "chat/error",
      requestId,
      message,
      displayInTranscript: false,
      showToast: presentation !== "settings-toast",
    });
  }

  function appendErrorMessage(message: string): void {
    const id = cryptoRandom();
    const createdAt = Date.now();
    const content = `⚠ ${message}`;
    state.messages.push({
      id,
      role: "assistant",
      content,
      createdAt,
      streaming: false,
      stopReason: "error",
    });
    post({ type: "chat/messageStart", id, role: "assistant", createdAt, content });
    post({ type: "chat/messageEnd", id, stopReason: "error" });
  }

  function appendInfoMessage(message: string): void {
    const id = cryptoRandom();
    const createdAt = Date.now();
    const content = `ℹ ${message}`;
    state.messages.push({
      id,
      role: "assistant",
      content,
      createdAt,
      streaming: false,
      stopReason: "info",
    });
    post({ type: "chat/messageStart", id, role: "assistant", createdAt, content });
    post({ type: "chat/messageEnd", id, stopReason: "info" });
  }

  function appendCompactionSummary(result: CompactionResult): void {
    const compactionMsg: ChatCompactionView = {
      id: `compaction-${Date.now()}`,
      role: "compactionSummary",
      summary: result.summary || "Session history compacted.",
      tokensBefore: result.tokensBefore,
      createdAt: Date.now(),
    };
    state.messages.push(compactionMsg);
    postSnapshot();
  }

  function clearTurnStartTimeout(): void {
    if (!turnStartTimeout) return;
    clearTimeout(turnStartTimeout);
    turnStartTimeout = null;
  }

  function clearOverflowRecoveryTimeout(): void {
    if (!overflowRecoveryTimeout) return;
    clearTimeout(overflowRecoveryTimeout);
    overflowRecoveryTimeout = null;
  }

  function clearPendingContextOverflow(): void {
    pendingContextOverflowError = null;
    clearOverflowRecoveryTimeout();
  }

  function clearRetryRecoveryTimeout(): void {
    if (!retryRecoveryTimeout) return;
    clearTimeout(retryRecoveryTimeout);
    retryRecoveryTimeout = null;
  }

  function clearPendingRetryableError(): void {
    pendingRetryableError = null;
    clearRetryRecoveryTimeout();
  }

  function clearStreamingState(stopReason?: string): string | null {
    clearTurnStartTimeout();
    clearPendingContextOverflow();
    clearPendingRetryableError();
    const finishedId = finishCurrentAssistant(stopReason);
    state.isStreaming = false;
    state.currentRequestId = null;
    state.suppressNextUserMessageStart = false;
    state.currentTurnSawRuntimeEvent = false;
    return finishedId;
  }

  function failActiveTurn(requestId: string | undefined, message: string): void {
    if (!errorPostedThisTurn) {
      errorPostedThisTurn = true;
      postError(requestId, message, "transcript");
    }
    clearStreamingState("error");
    recordRuntimeStatus({ running: true, isStreaming: false, model: currentModel }, requestId);
  }

  function scheduleTurnStartTimeout(requestId: string): void {
    clearTurnStartTimeout();
    turnStartTimeout = setTimeout(() => {
      if (
        state.currentRequestId !== requestId ||
        !state.isStreaming ||
        state.currentTurnSawRuntimeEvent
      ) {
        return;
      }
      failActiveTurn(
        requestId,
        "The selected provider accepted the prompt but did not emit a response. Check the provider API key/model configuration, then retry.",
      );
    }, TURN_START_TIMEOUT_MS);
    turnStartTimeout.unref?.();
  }

  function scheduleOverflowRecoveryTimeout(requestId: string | undefined): void {
    clearOverflowRecoveryTimeout();
    overflowRecoveryTimeout = setTimeout(() => {
      const message =
        pendingContextOverflowError ??
        "The selected provider reported that the prompt exceeds the model context window.";
      pendingContextOverflowError = null;
      overflowRecoveryTimeout = null;
      failActiveTurn(requestId, message);
    }, OVERFLOW_RECOVERY_GRACE_MS);
    overflowRecoveryTimeout.unref?.();
  }

  function scheduleRetryRecoveryTimeout(requestId: string | undefined): void {
    clearRetryRecoveryTimeout();
    retryRecoveryTimeout = setTimeout(() => {
      const message =
        pendingRetryableError ??
        "The selected provider returned a transient error and did not retry.";
      pendingRetryableError = null;
      retryRecoveryTimeout = null;
      failActiveTurn(requestId, message);
    }, OVERFLOW_RECOVERY_GRACE_MS);
    retryRecoveryTimeout.unref?.();
  }

  function maybePostRestartRequiredStatusError(
    status: AgentRuntimeStatus,
    requestId?: string,
  ): void {
    if (!status.restartRequired) {
      postedRestartRequiredInfo = null;
      return;
    }

    const message =
      status.info ??
      "Agent runtime failed to start repeatedly. Automatic retries are stopped; use Restart agent after fixing the binary path or provider settings.";
    if (postedRestartRequiredInfo === message) return;
    postedRestartRequiredInfo = message;
    postError(requestId, message, "toast");
  }

  function postSnapshot(): void {
    post({
      type: "chat/state",
      isStreaming: state.isStreaming,
      messages: state.messages,
      tools: state.tools,
    });
    // On tab switch, emit current usage so the chat view can display it live.
    if (state.lastUsageTotals) {
      emitCurrentUsage();
    } else if (state.messages.length > 0) {
      void primeUsageTotals();
    }
  }

  /** Emits a chat/usage event with the current session totals. Call after any state change that affects usage display. */
  function emitCurrentUsage(): void {
    const totals = state.lastUsageTotals;
    if (!totals) return;
    post({
      type: "chat/usage",
      messageId: undefined,
      tokens: totals.tokens,
      cost: totals.cost,
      contextUsage: totals.contextUsage,
    });
  }

  async function primeUsageTotals(): Promise<void> {
    try {
      state.lastUsageTotals = await agentManager.getUsage();
    } catch (err) {
      log.error("getUsage failed", err instanceof Error ? err : undefined);
    }
  }

  async function fetchAndEmitUsage(messageId?: string): Promise<void> {
    try {
      const currentTotals = await agentManager.getUsage();
      if (!currentTotals) return;

      const previous = state.lastUsageTotals;
      const turnUsage: ChatUsageView = previous
        ? {
            tokens: {
              input: Math.max(0, currentTotals.tokens.input - previous.tokens.input),
              output: Math.max(0, currentTotals.tokens.output - previous.tokens.output),
              cacheRead: Math.max(0, currentTotals.tokens.cacheRead - previous.tokens.cacheRead),
              cacheWrite: Math.max(0, currentTotals.tokens.cacheWrite - previous.tokens.cacheWrite),
              total: Math.max(0, currentTotals.tokens.total - previous.tokens.total),
            },
            cost: Math.max(0, currentTotals.cost - previous.cost),
            contextUsage: currentTotals.contextUsage,
          }
        : currentTotals;

      state.lastUsageTotals = currentTotals;

      if (messageId) {
        const msg = state.messages.find((m) => m.id === messageId);
        // Only assign usage to regular messages — compaction summaries don't have it.
        if (msg && "usage" in msg) msg.usage = turnUsage;
      }

      post({
        type: "chat/usage",
        messageId,
        tokens: turnUsage.tokens,
        cost: turnUsage.cost,
        contextUsage: turnUsage.contextUsage,
      });
    } catch (err) {
      log.error("getUsage failed", err instanceof Error ? err : undefined);
    }
  }

  // ---------------------------------------------------------------------------
  // streaming flush
  // ---------------------------------------------------------------------------

  function scheduleFlush(): void {
    if (flushTimer) return;
    flushTimer = setTimeout(flushPendingDeltas, DELTA_FLUSH_MS);
  }

  function flushPendingDeltas(): void {
    flushTimer = null;
    if (pendingDeltas.size === 0) return;
    for (const [id, delta] of pendingDeltas) {
      const m = state.messages.find((m) => m.id === id);
      // Only append delta to regular messages.
      if (m && "content" in m) m.content += delta;
      post({ type: "chat/messageDelta", id, delta });
    }
    pendingDeltas.clear();
  }

  function startAssistantMessage(id: string, content = "", sourceId: string | null = id): void {
    const createdAt = Date.now();
    state.currentAssistantId = id;
    state.currentAssistantSourceId = sourceId;
    state.lastAssistantId = id;
    state.messages.push({ id, role: "assistant", content, createdAt, streaming: true });
    post({ type: "chat/messageStart", id, role: "assistant", createdAt });
    if (content.length > 0) {
      post({ type: "chat/messageDelta", id, delta: content });
    }
  }

  function getCurrentAssistantMessage(): ChatMessageView | undefined {
    return state.currentAssistantId
      ? (state.messages.find(
          (m): m is ChatMessageView => m.id === state.currentAssistantId && "content" in m,
        ) ?? undefined)
      : undefined;
  }

  /**
   * Tool events can arrive before the first assistant text delta. In that case,
   * create a placeholder assistant row so the tool is not orphaned from later
   * state snapshots.
   */
  function ensureAssistantMessage(): ChatMessageView {
    const existing = getCurrentAssistantMessage();
    if (existing) return existing;
    const id = cryptoRandom();
    startAssistantMessage(id, "", null);
    // startAssistantMessage always appends a ChatMessageView.
    return state.messages[state.messages.length - 1] as ChatMessageView;
  }

  /**
   * Maps runtime stream ids onto the UI assistant message id.
   *
   * Tool-first turns start with a generated placeholder id because the runtime
   * stream id is not known yet. The first text/thinking delta claims that
   * placeholder via `currentAssistantSourceId`; later deltas for the same
   * runtime id must reuse the placeholder so tools, text, and thinking remain
   * one assistant turn across live updates and `chat/state` refreshes.
   */
  function resolveAssistantStreamId(eventId: string): string {
    if (!state.currentAssistantId) {
      startAssistantMessage(eventId);
      return eventId;
    }
    if (state.currentAssistantId === eventId || state.currentAssistantSourceId === eventId) {
      return state.currentAssistantId;
    }

    const current = getCurrentAssistantMessage();
    if (
      current?.streaming &&
      state.currentAssistantSourceId === null &&
      current.content.length === 0 &&
      !current.stopReason
    ) {
      state.currentAssistantSourceId = eventId;
      return current.id;
    }

    finishCurrentAssistant();
    startAssistantMessage(eventId);
    return eventId;
  }

  function finishCurrentAssistant(stopReason?: string): string | null {
    flushPendingDeltas();
    const finishedId = state.currentAssistantId;
    if (!finishedId) return null;
    const m = state.messages.find(
      (message): message is ChatMessageView => message.id === finishedId && "streaming" in message,
    );
    if (m) {
      m.streaming = false;
      m.stopReason = stopReason;
    }
    post({ type: "chat/messageEnd", id: finishedId, stopReason });
    state.currentAssistantId = null;
    state.currentAssistantSourceId = null;
    state.lastAssistantId = finishedId;
    return finishedId;
  }

  function startUserMessage(content: string): void {
    const id = cryptoRandom();
    const createdAt = Date.now();
    state.messages.push({ id, role: "user", content, createdAt });
    post({ type: "chat/messageStart", id, role: "user", createdAt, content });
    post({ type: "chat/messageEnd", id });
  }

  // ---------------------------------------------------------------------------
  // stderr handling — surface fatal errors that agent prints (not emits)
  // ---------------------------------------------------------------------------

  function handleAgentStderr(chunk: string): void {
    stderrLineBuf += chunk;
    let idx: number;
    while ((idx = stderrLineBuf.indexOf("\n")) !== -1) {
      const line = stderrLineBuf.slice(0, idx).replace(/\r$/, "");
      stderrLineBuf = stderrLineBuf.slice(idx + 1);
      if (line.trim().length === 0) continue;
      handleStderrLine(line);
    }
  }

  function handleStderrLine(line: string): void {
    if (!state.isStreaming) return;
    if (errorPostedThisTurn) return;

    const message = parseStderrError(line) ?? line.trim();
    failActiveTurn(state.currentRequestId ?? undefined, message);
  }

  // ---------------------------------------------------------------------------
  // AgentEvent dispatch
  // ---------------------------------------------------------------------------

  const eventLog = log.child("agent-event");

  function handleAgentEvent(evt: AgentEvent): void {
    eventLog.debug(() => evt.type);
    try {
      if (state.isStreaming && state.currentRequestId && eventProvesTurnStarted(evt)) {
        state.currentTurnSawRuntimeEvent = true;
        clearTurnStartTimeout();
      }
      dispatchAgentEvent(evt);
    } catch (err) {
      eventLog.error(() => `${evt.type}: handler threw`, err instanceof Error ? err : undefined);
      failActiveTurn(
        state.currentRequestId ?? undefined,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  function eventProvesTurnStarted(evt: AgentEvent): boolean {
    switch (evt.type) {
      case "message_start":
      case "message_end":
        return evt.role === "assistant";
      case "text_delta":
      case "thinking_delta":
      case "tool_start":
      case "tool_end":
      case "ui_request":
      case "context_overflow":
      case "retryable_error":
      case "compaction_start":
      case "compaction_end":
      case "auto_retry_start":
      case "auto_retry_end":
      case "agent_end":
      case "error":
        return true;
      case "agent_start":
      case "queue_update":
        return false;
      default: {
        const _exhaustive: never = evt;
        return _exhaustive;
      }
    }
  }

  function dispatchAgentEvent(evt: AgentEvent): void {
    switch (evt.type) {
      case "agent_start": {
        state.isStreaming = true;
        recordRuntimeStatus({ running: true, isStreaming: true, model: currentModel });
        return;
      }
      case "agent_end": {
        if (pendingContextOverflowError) {
          scheduleOverflowRecoveryTimeout(state.currentRequestId ?? undefined);
          recordRuntimeStatus({
            running: true,
            isStreaming: true,
            model: currentModel,
            isCompacting: true,
          });
          return;
        }
        if (pendingRetryableError) {
          scheduleRetryRecoveryTimeout(state.currentRequestId ?? undefined);
          recordRuntimeStatus({
            running: true,
            isStreaming: true,
            model: currentModel,
          });
          return;
        }
        const finishedId = clearStreamingState();
        recordRuntimeStatus({ running: true, isStreaming: false, model: currentModel });
        void fetchAndEmitUsage(finishedId ?? state.lastAssistantId ?? undefined);
        void broadcastRuntimeSettings();
        return;
      }
      case "context_overflow": {
        pendingContextOverflowError = evt.message;
        clearTurnStartTimeout();
        return;
      }
      case "retryable_error": {
        pendingRetryableError = evt.message;
        clearTurnStartTimeout();
        return;
      }
      case "compaction_start": {
        clearOverflowRecoveryTimeout();
        recordRuntimeStatus({
          running: true,
          isStreaming: state.isStreaming,
          model: currentModel,
          isCompacting: true,
        });
        void broadcastRuntimeSettings();
        if (evt.reason === "overflow") {
          postChatToast({
            tone: "info",
            message: "Context overflow detected",
            description: "Compacting the session and retrying the prompt.",
            durationMs: 4_000,
          });
        }
        return;
      }
      case "compaction_end": {
        clearOverflowRecoveryTimeout();
        if (evt.errorMessage) {
          pendingContextOverflowError = null;
          failActiveTurn(state.currentRequestId ?? undefined, evt.errorMessage);
          return;
        }
        if (evt.aborted && pendingContextOverflowError) {
          const message = "Context overflow recovery was cancelled.";
          pendingContextOverflowError = null;
          failActiveTurn(state.currentRequestId ?? undefined, message);
          return;
        }
        if (evt.result && evt.reason !== "manual") {
          appendCompactionSummary(evt.result);
          post({
            type: "agent/compacted",
            requestId: state.currentRequestId ?? `auto-compact-${Date.now()}`,
            result: evt.result,
          });
        }
        pendingContextOverflowError = null;
        recordRuntimeStatus({
          running: true,
          isStreaming: state.isStreaming || evt.willRetry,
          model: currentModel,
          isCompacting: false,
        });
        void broadcastRuntimeSettings();
        if (evt.willRetry && state.currentRequestId) {
          state.isStreaming = true;
          state.currentTurnSawRuntimeEvent = false;
          scheduleTurnStartTimeout(state.currentRequestId);
        }
        return;
      }
      case "auto_retry_start": {
        clearRetryRecoveryTimeout();
        pendingRetryableError = evt.errorMessage;
        state.isStreaming = true;
        recordRuntimeStatus({
          running: true,
          isStreaming: true,
          model: currentModel,
        });
        void broadcastRuntimeSettings();
        postChatToast({
          tone: "info",
          message: `Retrying provider request (${evt.attempt}/${evt.maxAttempts})`,
          description: `Transient provider error; retrying in ${formatRetryDelay(evt.delayMs)}.`,
          durationMs: 4_000,
        });
        return;
      }
      case "auto_retry_end": {
        clearRetryRecoveryTimeout();
        if (!evt.success) {
          const message = evt.finalError ?? pendingRetryableError ?? "Provider retry failed.";
          pendingRetryableError = null;
          failActiveTurn(state.currentRequestId ?? undefined, message);
          return;
        }
        pendingRetryableError = null;
        recordRuntimeStatus({
          running: true,
          isStreaming: state.isStreaming,
          model: currentModel,
        });
        return;
      }
      case "message_start": {
        if (evt.role === "user") {
          if (state.suppressNextUserMessageStart) {
            state.suppressNextUserMessageStart = false;
            return;
          }
          const queuedDisplay = queuedUserDisplays.shift();
          startUserMessage(queuedDisplay?.content ?? evt.content ?? "");
          return;
        }
        if (evt.role !== "assistant") return;
        // API failure packed as errorMessage by the adapter.
        if (evt.errorMessage) {
          if (errorPostedThisTurn) return;
          failActiveTurn(state.currentRequestId ?? undefined, evt.errorMessage);
          return;
        }
        // Non-streaming: full content in message_start, no text_delta follows.
        if (evt.content && evt.content.length > 0) {
          clearPendingRetryableError();
          startAssistantMessage(cryptoRandom(), evt.content);
        }
        return;
      }
      case "message_end": {
        if (evt.role === "assistant") {
          if (evt.stopReason !== "error") clearPendingRetryableError();
          finishCurrentAssistant(evt.stopReason);
        }
        return;
      }
      case "text_delta": {
        const { id, delta } = evt;
        // First delta for this message — mint or reuse message state.
        clearPendingRetryableError();
        const targetId = resolveAssistantStreamId(id);
        if (delta.length === 0) return;
        pendingDeltas.set(targetId, (pendingDeltas.get(targetId) ?? "") + delta);
        scheduleFlush();
        return;
      }
      case "thinking_delta": {
        const { id, delta } = evt;
        if (delta.length === 0) return;
        clearPendingRetryableError();
        const targetId = resolveAssistantStreamId(id);
        const m = state.messages.find(
          (m): m is ChatMessageView => m.id === targetId && "thinking" in m,
        );
        if (m) m.thinking = (m.thinking ?? "") + delta;
        post({ type: "chat/thinkingDelta", id: targetId, delta });
        return;
      }
      case "tool_start": {
        const { toolCallId, toolName, args } = evt;
        if (!toolCallId) return;
        const tool: ChatToolView = { toolCallId, toolName, status: "running", args };
        state.tools.push(tool);
        const msg = ensureAssistantMessage();
        // tools may not exist yet on a freshly-created placeholder message.
        msg.tools = [...(msg.tools ?? []), tool];
        post({ type: "chat/toolStart", toolCallId, toolName, args: args ?? null });
        return;
      }
      case "tool_end": {
        const { toolCallId, ok, result } = evt;
        if (!toolCallId) return;
        const summary = extractToolSummary(result);
        const tool = state.tools.find((t) => t.toolCallId === toolCallId);
        if (tool) {
          tool.status = ok ? "ok" : "error";
          tool.summary = summary;
        }
        for (const m of state.messages) {
          if (!("tools" in m)) continue;
          const mt = m.tools?.find((t: ChatToolView) => t.toolCallId === toolCallId);
          if (mt) {
            mt.status = ok ? "ok" : "error";
            mt.summary = summary;
          }
        }
        post({ type: "chat/toolEnd", toolCallId, ok, summary });
        return;
      }
      case "queue_update": {
        void broadcastRuntimeSettings();
        return;
      }
      case "ui_request": {
        void handleUiRequest(evt);
        return;
      }
      case "error": {
        const { message } = evt;
        eventLog.error(message, { payload: evt });
        failActiveTurn(state.currentRequestId ?? undefined, message);
        return;
      }
      default: {
        const _exhaustive: never = evt;
        eventLog.warn(`unhandled type=${(_exhaustive as { type: string }).type}`);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Agent UI requests
  // ---------------------------------------------------------------------------

  const uiLog = log.child("agent-ui");

  async function handleUiRequest(evt: AgentUiRequest): Promise<void> {
    try {
      switch (evt.method) {
        case "select": {
          const value = await vscode.window.showQuickPick(evt.options, {
            title: evt.title,
            ignoreFocusOut: true,
          });
          await respondToUiRequest(value ? { id: evt.id, value } : { id: evt.id, cancelled: true });
          return;
        }
        case "confirm": {
          const selected = await vscode.window.showWarningMessage(
            evt.message,
            { modal: true, detail: evt.title },
            "Confirm",
          );
          await respondToUiRequest({ id: evt.id, confirmed: selected === "Confirm" });
          return;
        }
        case "input": {
          const value = await vscode.window.showInputBox({
            title: evt.title,
            placeHolder: evt.placeholder,
            ignoreFocusOut: true,
          });
          await respondToUiRequest(
            value === undefined ? { id: evt.id, cancelled: true } : { id: evt.id, value },
          );
          return;
        }
        case "editor": {
          const value = await vscode.window.showInputBox({
            title: evt.title,
            value: evt.prefill,
            ignoreFocusOut: true,
          });
          await respondToUiRequest(
            value === undefined ? { id: evt.id, cancelled: true } : { id: evt.id, value },
          );
          return;
        }
        case "notify": {
          showNotification(evt);
          return;
        }
        case "setStatus": {
          uiLog.debug("setStatus", { key: evt.statusKey, text: evt.statusText });
          return;
        }
        case "setWidget": {
          uiLog.debug("setWidget", { key: evt.widgetKey, lines: evt.widgetLines ?? [] });
          return;
        }
        case "setTitle": {
          uiLog.debug("setTitle", { title: evt.title });
          return;
        }
        case "set_editor_text": {
          uiLog.debug("set_editor_text", { text: evt.text });
          return;
        }
        default: {
          const _exhaustive: never = evt;
          uiLog.warn("unhandled", { evt: _exhaustive });
        }
      }
    } catch (err) {
      uiLog.error(`${evt.method} failed`, err instanceof Error ? err : undefined);
      if (requiresUiResponse(evt)) {
        await respondToUiRequest({ id: evt.id, cancelled: true });
      }
    }
  }

  async function respondToUiRequest(response: AgentUiResponse): Promise<void> {
    try {
      await agentManager.respondToUiRequest(response);
    } catch (err) {
      uiLog.error("respondToUiRequest failed", err instanceof Error ? err : undefined);
    }
  }

  function showNotification(evt: Extract<AgentUiRequest, { method: "notify" }>): void {
    if (evt.notifyType === "error") {
      vscode.window.showErrorMessage(evt.message);
      return;
    }
    if (evt.notifyType === "warning") {
      vscode.window.showWarningMessage(evt.message);
      return;
    }
    vscode.window.showInformationMessage(evt.message);
  }

  function requiresUiResponse(evt: AgentUiRequest): boolean {
    return (
      evt.method === "select" ||
      evt.method === "confirm" ||
      evt.method === "input" ||
      evt.method === "editor"
    );
  }

  // ---------------------------------------------------------------------------
  // Flow: [AgentManager.HostBridge]
  // Flow: [Bridge.ChatToAgent]
  // inbound from webview
  // ---------------------------------------------------------------------------

  const inboundLog = log.child("webview");

  function handleInbound(msg: ChatToAgent): void {
    inboundLog.debug(() => msg.type);
    try {
      dispatchInbound(msg);
    } catch (err) {
      inboundLog.error(() => `${msg.type}: handler threw`, err instanceof Error ? err : undefined);
      postError(undefined, err instanceof Error ? err.message : String(err), "toast");
    }
  }

  /**
   * Inbound message dispatcher for the chat webview. Each `case` carries an
   * `@see` to the spec/design that owns the message variant. Use those anchors
   * as the entry point when changing a handler's behavior or contract.
   *
   * @see docs/specs/200-app-vscode/design.md [DES-ARCH]
   * @see docs/specs/100-package-shared/design.md [DES-SHARED-CHAT-PROTOCOL]
   */
  function dispatchInbound(msg: ChatToAgent): void {
    switch (msg.type) {
      // @see docs/specs/210-app-chat/design.md [DES-API]
      // @see docs/specs/212-app-chat-messages/design.md [DES-MESSAGES-EVENT-FLOW]
      case "chat/ready":
      case "chat/getState": {
        markChatReady();
        runtimeMonitor.start();
        postSnapshot();
        void runtimeMonitor.check();
        void broadcastRuntimeSettings();
        return;
      }
      // @see docs/specs/350-agent-manager/design.md [DES-API]
      case "agent/checkStatus": {
        void runtimeMonitor.check(msg.requestId);
        return;
      }
      // @see docs/specs/350-agent-manager/design.md [DES-API]
      case "agent/restart": {
        void runtimeMonitor.restart(msg.requestId);
        return;
      }
      // @see docs/specs/350-agent-manager/design.md [DES-API]
      case "agent/reload": {
        void vscode.commands.executeCommand("workbench.action.reloadWindow");
        return;
      }
      // @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-FLOW]
      case "chat/send": {
        void handleSend(msg.requestId, msg.content, msg.mentions);
        return;
      }
      // @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-FLOW]
      case "chat/getModels": {
        void handleGetModels(msg.requestId);
        return;
      }
      // @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-RUNTIME]
      case "chat/setModel": {
        void handleSetModel(msg.requestId, msg.provider, msg.modelId, msg.instanceId);
        return;
      }
      // @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-HELPERS]
      case "chat/getCommands": {
        void handleGetCommands(msg.requestId);
        return;
      }
      // @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-HELPERS]
      case "chat/listFiles": {
        void handleListFiles(msg.requestId, msg.query, msg.limit);
        return;
      }
      // @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-FLOW]
      case "chat/getSettingsSnapshot": {
        void handleGetSettingsSnapshot(msg.requestId);
        return;
      }
      // @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-FLOW]
      case "provider/setApiKey": {
        void handleSetProviderApiKey(msg.requestId, msg.provider, msg.key);
        return;
      }
      // @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-FLOW]
      case "provider/clearApiKey": {
        void handleClearProviderApiKey(msg.requestId, msg.provider);
        return;
      }
      // @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-FLOW]
      case "provider/setDefaultModel": {
        void handleSetProviderDefaultModel(msg.requestId, msg.provider, msg.modelId);
        return;
      }
      // @see docs/specs/351-agent-pi/design.md [DES-API]
      case "external/detectPiBinary": {
        void handleDetectPiBinary(msg.requestId);
        return;
      }
      // @see docs/specs/351-agent-pi/design.md [DES-API]
      case "external/setRpcEnabled": {
        void handleSetRpcEnabled(msg.requestId, msg.enabled);
        return;
      }
      // @see docs/specs/351-agent-pi/design.md [DES-API]
      case "external/setEphemeral": {
        void handleSetEphemeralSession(msg.requestId, msg.enabled);
        return;
      }
      // @see docs/specs/350-agent-manager/design.md [DES-API]
      case "chat/getStderr": {
        handleGetStderr(msg.requestId, msg.maxLines);
        return;
      }
      // @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-FLOW]
      case "chat/openSettings": {
        void vscode.commands.executeCommand("workbench.action.openSettings", msg.key);
        return;
      }
      // @see docs/specs/901-cross-telemetry/design.md [DES-TELEMETRY-CATALOG]
      case "telemetry/setEnabled": {
        void handleSetTelemetryEnabled(msg.requestId, msg.enabled);
        return;
      }
      // @see docs/specs/131-package-ui-design-system/design.md [DES-APPEARANCE-BRIDGE]
      case "appearance/update": {
        void handleUpdateAppearance(msg.requestId, msg.theme, msg.style);
        return;
      }
      // @see docs/specs/212-app-chat-messages/design.md [DES-MESSAGES-EVENT-FLOW]
      case "chat/abort": {
        void handleAbort();
        return;
      }
      // @see docs/specs/212-app-chat-messages/design.md [DES-MESSAGES-EVENT-FLOW]
      case "chat/newSession": {
        void handleNewSession();
        return;
      }
      // @see docs/specs/212-app-chat-messages/design.md [DES-MESSAGES-EVENT-FLOW]
      case "chat/compact": {
        void handleCompact(msg.requestId, msg.customInstructions);
        return;
      }
      // @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-FLOW]
      case "chat/steer": {
        void handleSteer(msg.requestId, msg.content, msg.mentions);
        return;
      }
      // @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-FLOW]
      case "chat/followUp": {
        void handleFollowUp(msg.requestId, msg.content, msg.mentions);
        return;
      }
      // @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-RUNTIME]
      case "chat/setThinkingLevel": {
        void handleSetRuntimeSetting(msg.requestId, () => agentManager.setThinkingLevel(msg.level));
        return;
      }
      // @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-FLOW]
      case "chat/setSteeringMode": {
        void handleSetRuntimeSetting(msg.requestId, () => agentManager.setSteeringMode(msg.mode));
        return;
      }
      // @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-FLOW]
      case "chat/setFollowUpMode": {
        void handleSetRuntimeSetting(msg.requestId, () => agentManager.setFollowUpMode(msg.mode));
        return;
      }
      // @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-FLOW]
      case "chat/setAutoCompaction": {
        void handleSetRuntimeSetting(msg.requestId, () =>
          agentManager.setAutoCompaction(msg.enabled),
        );
        return;
      }
      // @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-FLOW]
      case "chat/setAutoRetry": {
        void handleSetRuntimeSetting(msg.requestId, () => agentManager.setAutoRetry(msg.enabled));
        return;
      }
      // @see docs/specs/215-app-chat-notes/design.md [DES-NOTES-FLOW]
      case "chat/saveNote": {
        void appendNoteToWorkspace(msg.content);
        return;
      }
      default: {
        const _never: never = msg;
        inboundLog.warn("unknown inbound", { msg: _never });
      }
    }
  }

  async function handleSend(
    requestId: string,
    content: string,
    mentions: readonly string[] = [],
  ): Promise<void> {
    if (state.isStreaming) {
      postError(requestId, "Already streaming. Wait for the current turn to finish.", "toast");
      return;
    }

    const userId = cryptoRandom();
    const createdAt = Date.now();
    state.messages.push({ id: userId, role: "user", content, createdAt });
    post({ type: "chat/messageStart", id: userId, role: "user", createdAt, content });
    post({ type: "chat/messageEnd", id: userId });

    state.currentRequestId = requestId;
    state.isStreaming = true;
    state.lastAssistantId = null;
    state.suppressNextUserMessageStart = true;
    state.currentTurnSawRuntimeEvent = false;
    errorPostedThisTurn = false;
    recordRuntimeStatus({ running: true, isStreaming: true, model: currentModel });
    scheduleTurnStartTimeout(requestId);

    try {
      const inflated = await inflateMentionContext(content, normalizeMentions(content, mentions));
      await agentManager.send(inflated);
    } catch (err) {
      log.error("agent.send failed", err instanceof Error ? err : undefined, { requestId });
      const message = err instanceof Error ? err.message : String(err);
      failActiveTurn(requestId, message);
      postedRestartRequiredInfo = message;
      await runtimeMonitor.check(requestId);
    }
  }

  async function handleGetModels(requestId: string): Promise<void> {
    await postAvailableModels(requestId, { reportErrors: true });
  }

  async function postAvailableModels(
    requestId: string,
    options: { reportErrors: boolean },
  ): Promise<void> {
    try {
      post({ type: "agent/models", requestId, models: await agentManager.getAvailableModels() });
    } catch (err) {
      log.error("getAvailableModels failed", err instanceof Error ? err : undefined);
      if (options.reportErrors) {
        postError(requestId, err instanceof Error ? err.message : String(err), "toast");
      }
    }
  }

  async function handleSetModel(
    requestId: string,
    provider: string,
    modelId: string,
    instanceId?: string,
  ): Promise<void> {
    try {
      if (state.isStreaming) {
        clearStreamingState("model_switch");
        recordRuntimeStatus({ running: true, isStreaming: false, model: currentModel }, requestId);
      }
      const model = await agentManager.setModel({ provider, modelId, instanceId });
      const shouldRefreshSettings = await persistSelectedApiProviderModel(
        requestId,
        model,
        instanceId,
      );
      currentModel = {
        provider: model.provider,
        id: model.id,
        name: model.name,
        reasoning: model.reasoning,
        source: model.source,
        instanceId: model.instanceId,
        instanceLabel: model.instanceLabel,
      };
      post({ type: "agent/modelChanged", requestId, model });
      appendInfoMessage(formatModelSwitchInfo(model));
      recordRuntimeStatus({ running: true, isStreaming: false, model: currentModel }, requestId);
      if (shouldRefreshSettings) {
        await handleGetSettingsSnapshot(requestId);
      }
    } catch (err) {
      log.error("setModel failed", err instanceof Error ? err : undefined, { provider, modelId });
      postError(requestId, err instanceof Error ? err.message : String(err), "transcript");
    }
  }

  async function persistSelectedApiProviderModel(
    requestId: string,
    model: AgentModel,
    requestedInstanceId?: string,
  ): Promise<boolean> {
    if (!isApiProviderModel(model, requestedInstanceId)) return false;
    const defaultModel = formatSdkDefaultModel(model.provider, model.id);
    try {
      await updateSdkDefaultModel(model.provider, model.id);
      return true;
    } catch (err) {
      log.error("persist selected provider model failed", err instanceof Error ? err : undefined, {
        provider: model.provider,
        modelId: model.id,
      });
      const reason = err instanceof Error ? err.message : String(err);
      postError(
        requestId,
        `Model switched for this session, but AFX could not save ${defaultModel} as your default: ${reason}`,
        "toast",
      );
      return false;
    }
  }

  async function handleGetCommands(requestId: string): Promise<void> {
    try {
      post({ type: "agent/commands", requestId, commands: await agentManager.getCommands() });
    } catch (err) {
      if (isNoConfiguredRuntimeError(err)) {
        post({ type: "agent/commands", requestId, commands: [] });
        return;
      }
      log.error("getCommands failed", err instanceof Error ? err : undefined);
      postError(requestId, err instanceof Error ? err.message : String(err), "toast");
    }
  }

  function handleGetStderr(requestId: string, maxLines = 200): void {
    const { content, truncated } = truncateTextFromHead(agentManager.getStderr(), maxLines);
    post({ type: "agent/stderr", requestId, content, truncated });
  }

  async function handleListFiles(requestId: string, query = "**/*", limit = 200): Promise<void> {
    try {
      const cap = Math.max(1, Math.min(limit, 500));
      const recentPaths = getOpenWorkspaceFilePaths();
      const byPath = new Map<string, AgentFileView>();
      for (const p of recentPaths) byPath.set(p, { path: p, recent: true });
      const found = await vscode.workspace.findFiles(query.trim() || "**/*", undefined, cap);
      for (const uri of found) {
        const relative = toWorkspaceRelativePath(uri);
        if (!relative) continue;
        const existing = byPath.get(relative);
        byPath.set(relative, {
          path: relative,
          recent: existing?.recent ?? recentPaths.has(relative),
        });
      }
      const files = [...byPath.values()]
        .sort(
          (a, b) =>
            Number(Boolean(b.recent)) - Number(Boolean(a.recent)) || a.path.localeCompare(b.path),
        )
        .slice(0, cap);
      post({ type: "agent/files", requestId, files });
    } catch (err) {
      log.error("listFiles failed", err instanceof Error ? err : undefined);
      postError(requestId, err instanceof Error ? err.message : String(err), "toast");
    }
  }

  async function handleGetSettingsSnapshot(requestId: string): Promise<void> {
    try {
      const [models, bundledSkillCount] = await Promise.all([
        agentManager.getAvailableModels().catch((err: unknown) => {
          log.error("settings getAvailableModels failed", err instanceof Error ? err : undefined);
          return [] as AgentModel[];
        }),
        countBundledSkills(),
      ]);
      const cfg = vscode.workspace.getConfiguration("afx");
      const agentBinary = cfg.get<string>("agentBinaryPath", "").trim();
      const rpcEnabled = cfg.get<boolean>("rpc.enabled", false);
      const ephemeral = cfg.get<boolean>("agentEphemeralSession", false);
      const sessionDir = cfg.get<string>("sessionDir", "").trim();
      const telemetryEnabled = cfg.get<boolean>("telemetry.enabled", true);
      const snapshot: SettingsSnapshot = {
        appearance: appearanceSnapshotFromConfig(cfg),
        engine: {
          rpcEnabled,
          agentBinary: agentBinary || "pi",
          bundledSkillsPath,
          bundledSkillCount,
          ephemeral,
        },
        sdk: {
          enabled: cfg.get<boolean>("sdk.enabled", true),
          defaultModel: cfg.get<string>("sdk.defaultModel", "anthropic:claude-opus-4-5"),
          ollamaBaseUrl: cfg.get<string>("sdk.ollamaBaseUrl", "").trim(),
          sessionDir: sessionDir || "extension-managed storage",
        },
        providers: await groupProviders(
          models,
          cfg.get<string>("sdk.defaultModel", "anthropic:claude-opus-4-5"),
          cfg.get<string>("sdk.ollamaBaseUrl", "").trim(),
          secretStore,
        ),
        externalAgents: groupExternalAgents(models, { agentBinary, rpcEnabled, ephemeral }),
        diagnostics: { logLevel: cfg.get<string>("logLevel", "info") },
        telemetry: {
          enabled: telemetryEnabled,
          vscodeTelemetryEnabled: vscode.env.isTelemetryEnabled,
          effectiveEnabled: telemetryEnabled && vscode.env.isTelemetryEnabled,
        },
        about: {
          extensionVersion,
          bundledPiNpmVersion,
        },
      };
      post({ type: "agent/settingsSnapshot", requestId, snapshot });
    } catch (err) {
      log.error("settings snapshot failed", err instanceof Error ? err : undefined);
      postError(requestId, err instanceof Error ? err.message : String(err), "toast");
    }
  }

  async function handleSetProviderApiKey(
    requestId: string,
    provider: string,
    key: string,
  ): Promise<void> {
    try {
      await vscode.commands.executeCommand("afx.setProviderApiKey", provider, key);
      await handleGetSettingsSnapshot(requestId);
      await postAvailableModels(requestId, { reportErrors: false });
    } catch (err) {
      log.error("set provider key failed", err instanceof Error ? err : undefined);
      postError(requestId, err instanceof Error ? err.message : String(err), "settings-toast");
    }
  }

  async function handleClearProviderApiKey(requestId: string, provider: string): Promise<void> {
    try {
      await vscode.commands.executeCommand("afx.clearProviderApiKey", provider);
      await handleGetSettingsSnapshot(requestId);
      await postAvailableModels(requestId, { reportErrors: false });
    } catch (err) {
      log.error("clear provider key failed", err instanceof Error ? err : undefined);
      postError(requestId, err instanceof Error ? err.message : String(err), "settings-toast");
    }
  }

  async function handleSetProviderDefaultModel(
    requestId: string,
    provider: string,
    modelId: string,
  ): Promise<void> {
    try {
      await updateSdkDefaultModel(provider, modelId);
      await handleGetSettingsSnapshot(requestId);
      await postAvailableModels(requestId, { reportErrors: false });
    } catch (err) {
      log.error("set provider default model failed", err instanceof Error ? err : undefined);
      postError(requestId, err instanceof Error ? err.message : String(err), "settings-toast");
    }
  }

  async function handleDetectPiBinary(requestId: string): Promise<void> {
    try {
      await vscode.commands.executeCommand("afx.detectPiBinary");
      await handleGetSettingsSnapshot(requestId);
    } catch (err) {
      log.error("detect Pi binary failed", err instanceof Error ? err : undefined);
      postError(requestId, err instanceof Error ? err.message : String(err), "settings-toast");
    }
  }

  async function handleSetRpcEnabled(requestId: string, enabled: boolean): Promise<void> {
    try {
      await vscode.workspace
        .getConfiguration("afx")
        .update("rpc.enabled", enabled, vscode.ConfigurationTarget.Global);
      await handleGetSettingsSnapshot(requestId);
      await postAvailableModels(requestId, { reportErrors: false });
    } catch (err) {
      log.error("set Pi RPC enabled failed", err instanceof Error ? err : undefined);
      postError(requestId, err instanceof Error ? err.message : String(err), "settings-toast");
    }
  }

  async function handleSetEphemeralSession(requestId: string, enabled: boolean): Promise<void> {
    try {
      await vscode.workspace
        .getConfiguration("afx")
        .update("agentEphemeralSession", enabled, vscode.ConfigurationTarget.Global);
      await handleGetSettingsSnapshot(requestId);
    } catch (err) {
      log.error("set ephemeral session failed", err instanceof Error ? err : undefined);
      postError(requestId, err instanceof Error ? err.message : String(err), "settings-toast");
    }
  }

  async function handleSetTelemetryEnabled(requestId: string, enabled: boolean): Promise<void> {
    try {
      await vscode.workspace
        .getConfiguration("afx")
        .update("telemetry.enabled", enabled, vscode.ConfigurationTarget.Global);
      postTelemetryState();
      await handleGetSettingsSnapshot(requestId);
    } catch (err) {
      log.error("set telemetry enabled failed", err instanceof Error ? err : undefined);
      postError(requestId, err instanceof Error ? err.message : String(err), "settings-toast");
    }
  }

  async function handleUpdateAppearance(
    requestId: string,
    themeValue: string | undefined,
    styleValue: string | undefined,
  ): Promise<void> {
    const cfg = vscode.workspace.getConfiguration("afx");
    const current = appearanceSnapshotFromConfig(cfg);
    const theme = themeValue === undefined ? current.theme : normalizeTheme(themeValue);
    const style = styleValue === undefined ? current.style : normalizeStyle(styleValue);

    if (!theme || !style) {
      postError(
        requestId,
        "Unknown appearance value. AFX kept the current theme/style settings.",
        "settings-toast",
      );
      return;
    }

    try {
      await Promise.all([
        themeValue === undefined
          ? Promise.resolve()
          : cfg.update("theme", theme, vscode.ConfigurationTarget.Global),
        styleValue === undefined
          ? Promise.resolve()
          : cfg.update("style", style, vscode.ConfigurationTarget.Global),
      ]);
      const appearance = appearanceSnapshotFromValues(theme, style);
      post({ type: "agent/appearanceUpdated", requestId, appearance });
      await handleGetSettingsSnapshot(requestId);
    } catch (err) {
      log.error("appearance update failed", err instanceof Error ? err : undefined);
      postError(requestId, err instanceof Error ? err.message : String(err), "settings-toast");
    }
  }

  async function handleAbort(): Promise<void> {
    try {
      await agentManager.abort();
    } catch (err) {
      log.error("abort failed", err instanceof Error ? err : undefined);
    }
    const finishedId = clearStreamingState("aborted");
    post({ type: "chat/aborted" });
    recordRuntimeStatus({ running: true, isStreaming: false, model: currentModel });
    void fetchAndEmitUsage(finishedId ?? undefined);
  }

  async function handleNewSession(): Promise<void> {
    try {
      await agentManager.newSession();
    } catch (err) {
      log.error("newSession failed", err instanceof Error ? err : undefined);
    }
    state.messages = [];
    state.tools = [];
    state.isStreaming = false;
    state.currentAssistantId = null;
    state.currentAssistantSourceId = null;
    state.lastAssistantId = null;
    state.currentRequestId = null;
    state.suppressNextUserMessageStart = false;
    state.currentTurnSawRuntimeEvent = false;
    pendingContextOverflowError = null;
    pendingRetryableError = null;
    state.lastUsageTotals = null;
    queuedUserDisplays.length = 0;
    pendingDeltas.clear();
    clearTurnStartTimeout();
    clearOverflowRecoveryTimeout();
    clearRetryRecoveryTimeout();
    postSnapshot();
    void broadcastRuntimeSettings();
  }

  /**
   * Handles compaction — runs Pi's compact, replaces the message list with just a
   * summary card, and broadcasts the updated state.
   *
   * We do NOT try to match `firstKeptEntryId` against local message IDs because
   * Pi and AFX use independent ID schemes.
   *
   * Performance: creates a new array reference so React can efficiently diff and
   * unmount the old message components.
   */
  async function handleCompact(requestId: string, customInstructions?: string): Promise<void> {
    try {
      const result = await agentManager.compact(customInstructions);

      // Create a fresh array with only the summary — this gives React a new
      // reference so it can efficiently diff and unmount old message components.
      const compactionMsg: ChatCompactionView = {
        id: `compaction-${Date.now()}`,
        role: "compactionSummary",
        summary: result.summary || "Session history compacted.",
        tokensBefore: result.tokensBefore,
        createdAt: Date.now(),
      };
      state.messages = [compactionMsg];

      // Clear pending streaming state — there can't be any in-progress deltas
      // after compaction, and clearing this prevents stale UI.
      pendingDeltas.clear();

      // Clear queued messages — they belong to the pruned context.
      queuedUserDisplays.length = 0;

      // Broadcast the result and updated snapshot to the webview.
      post({ type: "agent/compacted", requestId, result });
      postSnapshot();
      void broadcastRuntimeSettings();
    } catch (err) {
      log.error("compact failed", err instanceof Error ? err : undefined);
      postError(requestId, err instanceof Error ? err.message : String(err), "transcript");
    }
  }

  async function handleSteer(
    requestId: string,
    content: string,
    mentions: readonly string[] = [],
  ): Promise<void> {
    if (!state.isStreaming) {
      postError(requestId, "Cannot steer: no turn is currently streaming.", "toast");
      return;
    }
    try {
      const inflated = await inflateMentionContext(content, normalizeMentions(content, mentions));
      await agentManager.steer(inflated);
      queuedUserDisplays.push({ content });
      void broadcastRuntimeSettings();
    } catch (err) {
      log.error("agent.steer failed", err instanceof Error ? err : undefined, { requestId });
      postError(requestId, err instanceof Error ? err.message : String(err), "transcript");
    }
  }

  async function handleFollowUp(
    requestId: string,
    content: string,
    mentions: readonly string[] = [],
  ): Promise<void> {
    if (!state.isStreaming) {
      postError(requestId, "Cannot queue follow-up: no turn is currently streaming.", "toast");
      return;
    }
    try {
      const inflated = await inflateMentionContext(content, normalizeMentions(content, mentions));
      await agentManager.followUp(inflated);
      queuedUserDisplays.push({ content });
      void broadcastRuntimeSettings();
    } catch (err) {
      log.error("agent.followUp failed", err instanceof Error ? err : undefined, { requestId });
      postError(requestId, err instanceof Error ? err.message : String(err), "transcript");
    }
  }

  async function handleSetRuntimeSetting(
    requestId: string,
    apply: () => Promise<void>,
  ): Promise<void> {
    try {
      await apply();
      await broadcastRuntimeSettings(requestId);
    } catch (err) {
      log.error("runtime setting failed", err instanceof Error ? err : undefined);
      postError(requestId, err instanceof Error ? err.message : String(err), "toast");
    }
  }

  async function broadcastRuntimeSettings(requestId?: string): Promise<void> {
    try {
      const status = await agentManager.getStatus();
      post({
        type: "agent/runtimeSettings",
        requestId,
        settings: {
          thinkingLevel: status.thinkingLevel,
          steeringMode: status.steeringMode,
          followUpMode: status.followUpMode,
          autoCompactionEnabled: status.autoCompactionEnabled,
          autoRetryEnabled: status.autoRetryEnabled,
          isCompacting: status.isCompacting,
          sessionId: status.sessionId,
          sessionFile: status.sessionFile,
          sessionName: status.sessionName,
          messageCount: status.messageCount,
          pendingMessageCount: status.pendingMessageCount,
          rpcEnabled: status.rpcEnabled,
          runtimeConfigured: status.runtimeConfigured,
        },
      });
    } catch (err) {
      log.warn("broadcastRuntimeSettings failed", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const CONTENT_MENTION_RE = /(^|[^A-Za-z0-9\\])@([\w./_-]+)/g;
  const TRAILING_MENTION_PUNCTUATION_RE = /[),.;:]+$/g;

  function looksLikeWorkspaceFileMention(value: string): boolean {
    if (!value) return false;
    // Block common non-file mentions; AFX currently only resolves workspace files.
    if (value === "problems" || value === "terminal" || value === "git-changes") return false;
    // Likely commit hash (7-40 char hex); not supported as mentions.
    if (/^[a-f0-9]{7,40}$/i.test(value)) return false;
    // Absolute paths are rejected by the mention reader.
    if (value.startsWith("/")) return false;
    // Heuristic: prefer path-ish tokens; avoid random @words becoming "unavailable references".
    return value.includes("/") || value.includes(".") || value.startsWith(".");
  }

  function extractMentionsFromText(content: string): string[] {
    const seen = new Set<string>();
    const mentions: string[] = [];
    for (const match of content.matchAll(CONTENT_MENTION_RE)) {
      const raw = match[2];
      if (!raw) continue;
      const candidate = raw.replace(TRAILING_MENTION_PUNCTUATION_RE, "");
      if (!looksLikeWorkspaceFileMention(candidate)) continue;
      if (seen.has(candidate)) continue;
      seen.add(candidate);
      mentions.push(candidate);
    }
    return mentions;
  }

  function normalizeMentions(content: string, explicit: readonly string[] = []): string[] {
    const merged = [...explicit, ...extractMentionsFromText(content)].filter(
      (m) => m.trim().length > 0,
    );
    return Array.from(new Set(merged));
  }

  async function inflateMentionContext(
    content: string,
    mentions: readonly string[],
  ): Promise<string> {
    const uniqueMentions = Array.from(new Set(mentions.filter((m) => m.trim().length > 0)));
    if (uniqueMentions.length === 0) return content;

    const blocks: string[] = [];
    const unavailable: string[] = [];
    for (const mention of uniqueMentions) {
      const resolved = await readMentionFile(mention);
      if (resolved.ok) {
        blocks.push(
          [`### ${mention}`, `\`\`\`${languageForPath(mention)}`, resolved.content, "```"].join(
            "\n",
          ),
        );
      } else {
        unavailable.push(`@${mention} [unavailable: ${resolved.reason}]`);
      }
    }

    if (blocks.length === 0 && unavailable.length === 0) return content;
    return [
      "The user referenced these files:",
      "",
      ...blocks,
      ...(unavailable.length > 0 ? ["", "Unavailable references:", ...unavailable] : []),
      "",
      "Then asked:",
      content,
    ].join("\n");
  }

  async function readMentionFile(
    mention: string,
  ): Promise<{ ok: true; content: string } | { ok: false; reason: string }> {
    const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!root) return { ok: false, reason: "no workspace folder" };
    if (path.isAbsolute(mention)) return { ok: false, reason: "absolute paths are not allowed" };

    const targetPath = path.resolve(root, mention);
    const relative = path.relative(root, targetPath);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      return { ok: false, reason: "outside workspace" };
    }

    try {
      const uri = vscode.Uri.file(targetPath);
      const stat = await vscode.workspace.fs.stat(uri);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison -- bitwise check on FileType flags; symlink-to-file resolves to (FileType.File | FileType.SymbolicLink)
      if ((stat.type & vscode.FileType.File) !== vscode.FileType.File) {
        return { ok: false, reason: "not a regular file" };
      }
      if (stat.size > MENTION_FILE_CAP_BYTES) {
        return { ok: false, reason: "truncated: file too large" };
      }
      const bytes = await vscode.workspace.fs.readFile(uri);
      if (bytes.slice(0, 512).includes(0)) return { ok: false, reason: "binary file" };
      return { ok: true, content: new TextDecoder("utf-8").decode(bytes) };
    } catch (err) {
      log.warn("mention read failed", {
        mention,
        err: err instanceof Error ? err.message : String(err),
      });
      return { ok: false, reason: err instanceof Error ? err.message : "read failed" };
    }
  }

  async function countBundledSkills(): Promise<number> {
    if (bundledSkillCountCache !== null) return bundledSkillCountCache;
    try {
      const entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(bundledSkillsPath));
      bundledSkillCountCache = entries.filter(
        ([, type]) => type === vscode.FileType.Directory,
      ).length;
    } catch (err) {
      log.warn("bundled skill count unavailable", {
        bundledSkillsPath,
        err: err instanceof Error ? err.message : String(err),
      });
      bundledSkillCountCache = 0;
    }
    return bundledSkillCountCache;
  }

  function getOpenWorkspaceFilePaths(): Set<string> {
    const paths = new Set<string>();
    for (const group of vscode.window.tabGroups.all) {
      for (const tab of group.tabs) {
        const input = tab.input as { uri?: vscode.Uri } | undefined;
        if (!input?.uri || input.uri.scheme !== "file") continue;
        const relative = toWorkspaceRelativePath(input.uri);
        if (relative) paths.add(relative);
      }
    }
    return paths;
  }

  function toWorkspaceRelativePath(uri: vscode.Uri): string | null {
    const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!root) return null;
    const relative = path.relative(root, uri.fsPath);
    if (relative.startsWith("..") || path.isAbsolute(relative)) return null;
    return relative.split(path.sep).join("/");
  }

  // ---------------------------------------------------------------------------
  // view provider
  // ---------------------------------------------------------------------------

  function resolveWebviewView(view: vscode.WebviewView): void {
    const chatDistPath = getAppDistPath(extensionUri, "chat");
    const localResourceRoots = chatDistPath ? [vscode.Uri.file(chatDistPath)] : [];

    view.webview.options = {
      enableScripts: true,
      localResourceRoots,
    };
    view.webview.html = loadWebviewHtml(view.webview, extensionUri, "chat", extensionMode);
    webview = view.webview;
    chatReady = false;

    const disposables: vscode.Disposable[] = [];

    disposables.push(
      view.webview.onDidReceiveMessage((raw: unknown) => {
        if (!raw || typeof raw !== "object") return;
        const typed = raw as { type?: unknown };
        if (typeof typed.type !== "string") return;
        handleInbound(raw as ChatToAgent);
      }),
      runtimeMonitor.onStatus(postRuntimeStatus),
      view.onDidChangeVisibility(() => {
        if (view.visible) void runtimeMonitor.check();
      }),
      vscode.window.onDidChangeWindowState((state) => {
        if (state.focused) void runtimeMonitor.check();
      }),
      agentManager.onEvent(handleAgentEvent),
      agentManager.onStderr(handleAgentStderr),
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (!event.affectsConfiguration("afx.telemetry.enabled")) return;
        postTelemetryState();
      }),
      vscode.env.onDidChangeTelemetryEnabled(() => {
        postTelemetryState();
      }),
    );

    view.onDidDispose(() => {
      for (const d of disposables) {
        try {
          d.dispose();
        } catch {
          /* ignore */
        }
      }
      if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
      }
      clearTurnStartTimeout();
      if (webview === view.webview) {
        webview = null;
        chatReady = false;
      }
    });
  }

  return {
    resolveWebviewView,
    async sendExternalPrompt(content: string): Promise<void> {
      const requestId = cryptoRandom();
      if (state.isStreaming) {
        await handleFollowUp(requestId, content);
        postChatToast({
          tone: "info",
          message: "Queued as follow-up",
          description: "AFX will run this after the current response completes.",
        });
        return;
      }
      await handleSend(requestId, content);
    },
    appendToDraft(content: string): Promise<void> {
      const insertion = content.trim();
      if (!insertion) return Promise.resolve();
      if (!webview || !chatReady) {
        pendingDraftAppends.push(insertion);
        return Promise.resolve();
      }
      post({ type: "chat/draftAppend", content: insertion });
      return Promise.resolve();
    },
    async refreshRuntimeConfiguration(): Promise<void> {
      if (!webview) return;
      const requestId = cryptoRandom();
      await handleGetSettingsSnapshot(requestId);
      await postAvailableModels(requestId, { reportErrors: false });
    },
  };
}

// -----------------------------------------------------------------------------
// helpers
// -----------------------------------------------------------------------------

function cryptoRandom(): string {
  const g = globalThis as unknown as { crypto?: { randomUUID?: () => string } };
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function parseStderrError(line: string): string | undefined {
  const jsonMatch = line.match(/\{[\s\S]*\}\s*$/);
  if (jsonMatch) {
    try {
      const obj = JSON.parse(jsonMatch[0]) as {
        error?: { message?: string; type?: string };
        message?: string;
      };
      const inner = obj.error?.message ?? obj.message;
      if (typeof inner === "string" && inner.length > 0) return inner;
    } catch {
      /* not JSON — fall through */
    }
  }
  const errMatch = line.match(
    /^\s*(?:Error|TypeError|RangeError|ReferenceError|SyntaxError):\s*(.+)$/,
  );
  if (errMatch?.[1]) return errMatch[1].trim();
  return undefined;
}

function formatRetryDelay(delayMs: number): string {
  if (!Number.isFinite(delayMs) || delayMs <= 0) return "a moment";
  if (delayMs < 1_000) return `${Math.round(delayMs)}ms`;
  const seconds = delayMs / 1_000;
  return `${Number.isInteger(seconds) ? seconds : seconds.toFixed(1)}s`;
}

function extractToolSummary(result: unknown): string | undefined {
  const r = result as { content?: Array<{ type: string; text?: string }> } | undefined;
  const first = r?.content?.[0];
  if (!first || first.type !== "text" || typeof first.text !== "string") return undefined;
  const text = first.text.trim();
  if (text.length <= TOOL_SUMMARY_MAX) return text.slice(0, TOOL_SUMMARY_MAX);
  return text.slice(0, TOOL_SUMMARY_MAX) + "…";
}

function truncateTextFromHead(
  content: string,
  maxLines: number,
): { content: string; truncated: boolean } {
  const lines = content.split(/\r?\n/);
  if (lines.length <= maxLines) return { content, truncated: false };
  const hidden = lines.length - maxLines;
  return {
    content: [`... ${hidden} earlier lines hidden`, ...lines.slice(-maxLines)].join("\n"),
    truncated: true,
  };
}

async function groupProviders(
  models: readonly AgentModel[],
  sdkDefaultModel: string,
  ollamaBaseUrl: string,
  secretStore?: SecretStore,
): Promise<SettingsSnapshot["providers"]> {
  const byProvider = new Map<string, AgentModel[]>();
  for (const model of models) {
    if (model.source === "external-agent") continue;
    const provider = normalizeProviderId(model.provider);
    const providerModels = byProvider.get(provider) ?? [];
    providerModels.push(model);
    byProvider.set(provider, providerModels);
  }
  const [defaultProvider, defaultModelId] = parseModelRef(sdkDefaultModel);
  const providerIds = new Set<string>([...API_PROVIDER_IDS, ...byProvider.keys()]);
  if (ollamaBaseUrl || byProvider.has("ollama")) providerIds.add("ollama");

  const configuredProviders = new Set(
    (
      await Promise.all(
        [...providerIds].map(async (provider) =>
          secretStore && (await secretStore.getApiKey(provider)) ? provider : null,
        ),
      )
    ).filter((provider): provider is string => provider !== null),
  );

  return [...providerIds]
    .map((provider) => {
      const providerModels = byProvider.get(provider) ?? [];
      const details = PROVIDER_DETAILS[provider] ?? {
        displayName: titleCase(provider),
        modelHint: "Models available from this provider",
      };
      const noKeyNeeded = provider === "ollama" && Boolean(ollamaBaseUrl);
      const configured = configuredProviders.has(provider) || providerModels.length > 0;
      return {
        id: provider,
        name: provider,
        displayName: details.displayName,
        modelCount: providerModels.length,
        state: noKeyNeeded ? "no-key-needed" : configured ? "configured" : "empty",
        modelHint: details.modelHint,
        defaultModel: provider === defaultProvider ? defaultModelId : undefined,
        models: providerModels,
        helpUrl: details.helpUrl,
      } satisfies SettingsSnapshot["providers"][number];
    })
    .sort((a, b) => (a.displayName ?? a.name).localeCompare(b.displayName ?? b.name));
}

function groupExternalAgents(
  models: readonly AgentModel[],
  input: { agentBinary: string; rpcEnabled: boolean; ephemeral: boolean },
): SettingsSnapshot["externalAgents"] {
  if (!input.rpcEnabled) {
    return [
      {
        id: "pi",
        name: "Pi CLI",
        status: "disabled",
        modelCount: 0,
        binaryPath: input.agentBinary || "Auto-detect from PATH",
        enabled: false,
        ephemeral: input.ephemeral,
      },
    ];
  }

  const byInstance = new Map<string, AgentModel[]>();
  for (const model of models) {
    if (model.source !== "external-agent") continue;
    const instanceId = model.instanceId ?? "pi";
    const instanceModels = byInstance.get(instanceId) ?? [];
    instanceModels.push(model);
    byInstance.set(instanceId, instanceModels);
  }
  if (byInstance.size === 0) {
    return [
      {
        id: "pi",
        name: "Pi CLI",
        status: "unavailable",
        modelCount: 0,
        binaryPath: input.agentBinary || "Auto-detect from PATH",
        enabled: true,
        ephemeral: input.ephemeral,
      },
    ];
  }
  return [...byInstance.entries()].map(([id, instanceModels]) => ({
    id,
    name: instanceModels[0]?.instanceLabel ?? titleCase(id),
    status: "connected",
    modelCount: instanceModels.length,
    binaryPath: input.agentBinary || "Auto-detect from PATH",
    enabled: true,
    ephemeral: input.ephemeral,
  }));
}

function parseModelRef(value: string): [provider: string, modelId: string | undefined] {
  const trimmed = value.trim();
  const separator = trimmed.indexOf(":");
  if (separator <= 0 || separator === trimmed.length - 1) return ["anthropic", undefined];
  return [normalizeProviderId(trimmed.slice(0, separator)), trimmed.slice(separator + 1)];
}

function isApiProviderModel(model: AgentModel, requestedInstanceId?: string): boolean {
  return (
    model.source === "api-provider" ||
    model.instanceId === "pi-sdk" ||
    requestedInstanceId === "pi-sdk"
  );
}

function isNoConfiguredRuntimeError(err: unknown): boolean {
  return (
    err instanceof Error &&
    (/no configured agent runtime/i.test(err.message) ||
      /no agent runtime configured/i.test(err.message))
  );
}

function formatSdkDefaultModel(provider: string, modelId: string): string {
  return `${normalizeProviderId(provider)}:${modelId}`;
}

function formatModelSwitchInfo(model: AgentModel): string {
  const source =
    model.source === "external-agent" ? (model.instanceLabel ?? "External agent") : "API provider";
  const provider =
    PROVIDER_DETAILS[normalizeProviderId(model.provider)]?.displayName ?? titleCase(model.provider);
  return `Switched to ${provider} — ${model.name || model.id} (${model.id}). Runtime: ${source}.`;
}

async function updateSdkDefaultModel(provider: string, modelId: string): Promise<void> {
  await vscode.workspace
    .getConfiguration("afx")
    .update(
      "sdk.defaultModel",
      formatSdkDefaultModel(provider, modelId),
      vscode.ConfigurationTarget.Global,
    );
}

function normalizeProviderId(provider: string): string {
  return provider.trim().toLowerCase();
}

function readBundledPiNpmVersion(extensionUri: vscode.Uri): string {
  try {
    const packageJsonPath = vscode.Uri.joinPath(
      extensionUri,
      "resources",
      "pi-sdk",
      "package.json",
    ).fsPath;
    const metadata = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
      afxBundledPi?: { package?: unknown; version?: unknown };
    };
    const packageName = metadata.afxBundledPi?.package;
    const version = metadata.afxBundledPi?.version;
    if (typeof version !== "string" || version.trim().length === 0) return "?";
    if (typeof packageName !== "string" || packageName.trim().length === 0) {
      return version.trim();
    }
    return `${packageName.trim()}@${version.trim()}`;
  } catch {
    return "?";
  }
}

function titleCase(value: string): string {
  return value.replace(
    /(^|[-_\s])([a-z])/g,
    (_match, prefix: string, char: string) =>
      `${prefix === "-" || prefix === "_" ? " " : prefix}${char.toUpperCase()}`,
  );
}

function appearanceSnapshotFromConfig(
  cfg: vscode.WorkspaceConfiguration,
): RuntimeAppearanceSnapshot {
  const rawTheme = cfg.get<string>("theme", "meridian");
  const rawStyle = cfg.get<string>("style", "lyra");
  return appearanceSnapshotFromValues(
    normalizeTheme(rawTheme) ?? "meridian",
    normalizeStyle(rawStyle) ?? (rawTheme === "lyra" ? "lyra" : "lyra"),
  );
}

function appearanceSnapshotFromValues(
  theme: AfxThemeId,
  style: AfxStyleId,
): RuntimeAppearanceSnapshot {
  return {
    theme,
    style,
    themes: AFX_THEME_IDS.map((id) => ({
      id,
      label: id === "meridian" ? "AFX / Meridian" : id,
      implemented: true,
      description: "AFX identity and brass accents over VS Code host surfaces.",
    })),
    styles: AFX_STYLE_IDS.map((id) => ({
      id,
      label: id[0]!.toUpperCase() + id.slice(1),
      implemented: true,
      description:
        id === "lyra"
          ? "Compact, boxy shadcn treatment."
          : "Runtime treatment tokens over the Lyra primitive baseline.",
    })),
  };
}

function normalizeTheme(value: string): AfxThemeId | null {
  if (value === "lyra") return "meridian";
  return (AFX_THEME_IDS as readonly string[]).includes(value) ? (value as AfxThemeId) : null;
}

function normalizeStyle(value: string): AfxStyleId | null {
  return (AFX_STYLE_IDS as readonly string[]).includes(value) ? (value as AfxStyleId) : null;
}

function languageForPath(filePath: string): string {
  const ext = path.extname(filePath).slice(1).toLowerCase();
  const map: Record<string, string> = {
    js: "javascript",
    jsx: "jsx",
    ts: "typescript",
    tsx: "tsx",
    md: "markdown",
    mjs: "javascript",
    cjs: "javascript",
    json: "json",
    yaml: "yaml",
    yml: "yaml",
  };
  return map[ext] ?? ext;
}
