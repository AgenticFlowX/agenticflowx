/**
 * Chat controller — the single owner of cross-region state, bridge subscriptions,
 * action callbacks, derived flags, region slices, and the composer panel-stack
 * configuration. ChatWindow keeps only composer-local UI state and DOM refs.
 *
 * @see docs/specs/216-app-chat-window-componentization/spec.md [FR-3] [FR-6] [FR-7] [FR-10]
 * @see docs/specs/216-app-chat-window-componentization/design.md [DES-ARCH] [DES-STATE] [DES-API] [DES-DATA]
 */
import {
  type ComponentType,
  type DependencyList,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type {
  ActiveFileContextSnapshot,
  AgentCommand,
  AgentFileView,
  AgentModel,
  AgentRuntimePhase,
  AgentRuntimeStatus,
  AgentStatus,
  AgentToChat,
  ChatMessageView,
  ChatTimelineItem,
  ChatToolView,
  MessageOf,
  ThinkingLevel,
  WorkspaceMode,
} from "@afx/shared";
import { createCheckingAgentRuntimeStatus } from "@afx/shared";

import { bridgeGetState, bridgeOn, bridgeSend, bridgeSetState } from "../../lib/bridge";
import { deriveModifiedFiles } from "../../lib/derive-modified-files";
import { type ActiveDocCtx, EMPTY_DOC_CTX, type MemoryCatalogItem } from "../../lib/doc-actions";
import { extractMentions } from "../../lib/mentions";
import { analyzeDanger } from "../../lib/system-command";
import type { AgentRecoveryActions } from "../agent-recovery-card";
import { ChatDocActionsPanelBody, ChatDocActionsPanelTitle } from "../chat-doc-actions-panel";
import { FilesPanelBody } from "../files-panel";
import { toast } from "../toast";
import type {
  ChatHistoryStore,
  ChatWindowFlags,
  ComposerPanelDefinition,
  ComposerPanelStackConfig,
} from "./chat.types";
import { DEFAULT_CHAT_WINDOW_FLAGS } from "./chat.types";
import {
  AfxCommandSuggestPanelBody,
  type BlockedActionView,
  BlockedCommandPanelBody,
  ModeSuggestPanelBody,
  ModeSuggestPanelTitle,
  QueueClearAllAction,
  QueuePanel,
  type QueuedMessage,
} from "./composer-panels";

type ActiveDocContextMessage = MessageOf<AgentToChat, "chat/activeDocContext">;

const EDIT_TOOL_NAME_PATTERN = /(edit|write|patch|create|notebookedit)/i;

function activeDocContextFromMessage(msg: ActiveDocContextMessage): ActiveDocCtx {
  const { type: _type, ...ctx } = msg;
  void _type;
  return ctx;
}

function isEditLikeToolName(toolName: string): boolean {
  return EDIT_TOOL_NAME_PATTERN.test(toolName);
}

// ---------------------------------------------------------------------------
// Types — surface boundary
// ---------------------------------------------------------------------------

/** Subset of AgentStatus fields the controller mirrors as `runtime`. */
export type ChatRuntimeSettings = Partial<
  Pick<
    AgentStatus,
    | "thinkingLevel"
    | "steeringMode"
    | "followUpMode"
    | "autoCompactionEnabled"
    | "autoRetryEnabled"
    | "isCompacting"
    | "sessionId"
    | "sessionName"
    | "messageCount"
    | "pendingMessageCount"
    | "rpcEnabled"
  >
>;

/** Aggregated usage stats for a turn. */
export interface ChatUsageStats {
  tokens: { input: number; output: number; cacheRead: number; cacheWrite: number; total: number };
  cost: number;
  contextUsage?: { tokens: number | null; contextWindow: number; percent: number | null };
}

/** Command output row rendered in the timeline. */
export interface ChatCommandOutputView {
  requestId: string;
  command: string;
  stdout: string;
  stderr: string;
  exitCode?: number;
  error?: string;
  createdAt: number;
}

/** Ephemeral note confirmation rendered in the timeline. */
export interface ChatNoteEventView {
  id: string;
  content: string;
  savedAt: number;
}

/** Persisted onboarding flags from `agent/settingsSnapshot`. */
export interface OnboardingFlags {
  specModeOfferDismissed: boolean;
  specModeTooltipSeen: boolean;
  docActionsTooltipSeen: boolean;
}

/** Cached chat surface state persisted through the webview transport. */
export interface PersistedChatViewState {
  messages: ChatTimelineItem[];
  commandOutputs: ChatCommandOutputView[];
  noteEvents: ChatNoteEventView[];
  /** @see docs/specs/212-app-chat-messages/spec.md [FR-8] */
  workspaceMode?: WorkspaceMode;
}

/** Webview state persisted by VS Code so remounts can hydrate instantly. */
interface PersistedWebviewState {
  draft?: string;
  chatView?: PersistedChatViewState;
}

/** Cross-region state owned by the controller. */
export interface ChatControllerState {
  // Bridge-sourced / persisted
  messages: ChatTimelineItem[];
  noteEvents: ChatNoteEventView[];
  commandOutputs: ChatCommandOutputView[];
  runtime: ChatRuntimeSettings;
  usage: ChatUsageStats | null;
  queued: QueuedMessage[];
  workspaceMode: WorkspaceMode;
  hasReceivedStateSnapshot: boolean;
  hasReceivedSettingsSnapshot: boolean;
  internalAgentStatus: AgentRuntimeStatus;
  thinking: string | null;
  models: readonly AgentModel[];
  commands: readonly AgentCommand[];
  files: readonly AgentFileView[];
  activeFileContext: ActiveFileContextSnapshot | null;
  activeDocContext: ActiveDocCtx;
  customProviderLabels: Readonly<Record<string, string>>;
  onboardingFlags: OnboardingFlags;
  blockedAction: BlockedActionView | null;
  includeActiveFileContext: boolean;
  dismissedDocActionsStrip: boolean;
  afxCommandSuggestVisible: boolean;
  afxCommandSuggestDismissed: boolean;
  dismissedAtAssistantMessageId: string | null;
}

/** Computed flags derived from `state` + `props.agentStatus` override. */
export interface ChatControllerDerived {
  /** External override beats internal — App passes a status when it has one. */
  agentStatus: AgentRuntimeStatus;
  isStreaming: boolean;
  isCompacting: boolean;
  runtimeUnavailable: boolean;
  runtimeUnconfigured: boolean;
  rpcEnabled: boolean;
  isExploreMode: boolean;
}

/**
 * Composer-local callbacks used when controller actions must touch textarea,
 * draft, popover, or scroll state that intentionally remains in ChatWindow.
 *
 * @see docs/specs/216-app-chat-window-componentization/design.md [DES-STATE]
 */
export interface ComposerLocalCallbacks {
  /** Replace the draft text. */
  clearDraft?: () => void;
  setDraft?: (value: string) => void;
  /** Close slash/mention popovers and clear the active trigger. */
  closePopovers?: () => void;
  /** Move the textarea caret/focus back to the composer. */
  focusComposer?: () => void;
  /** Reset `userScrolledUp` so the next message scrolls the pane to bottom. */
  resetScroll?: () => void;
  /** Reset the prompt-history cursor (called after submit / saveAsNote). */
  resetPromptHistoryCursor?: () => void;
}

export interface ChatSubmitInput {
  draft: string;
  followUp?: boolean;
  composer?: ComposerLocalCallbacks;
}

export interface ChatStartNewSessionInput {
  composer?: ComposerLocalCallbacks;
}

export interface ChatSaveAsNoteInput {
  draft: string;
  composer?: ComposerLocalCallbacks;
}

export interface ChatHandleMemorySelectInput {
  item: MemoryCatalogItem;
  composer?: ComposerLocalCallbacks;
}

/** Stable action callbacks the controller exposes to `ChatWindow`. */
export interface ChatControllerActions {
  // Persistence
  persistChatViewState: (next: PersistedChatViewState | null) => void;

  // Bridge dispatch
  abort: () => void;
  setMode: (mode: WorkspaceMode) => void;
  acceptHostWorkspaceMode: (mode: WorkspaceMode) => boolean;
  setThinkingLevel: (level: ThinkingLevel) => void;
  dispatchHostAction: (action: "tasks.signOff", uri: string) => void;

  // Composer-coupled (need composer-local cleanup callbacks)
  submit: (input: ChatSubmitInput) => void;
  saveAsNote: (input: ChatSaveAsNoteInput) => void;
  startNewSession: (input?: ChatStartNewSessionInput) => void;
  handleMemorySelect: (input: ChatHandleMemorySelectInput) => void;

  // Pure controller actions
  startCompact: (composer?: ComposerLocalCallbacks) => void;
  handleOpenModifiedFile: (path: string, line?: number) => void;
  dismissComposerPanel: (id: string) => void;
  dismissModifiedFiles: () => void;
  dismissQueued: (id: string) => void;
  clearAllQueued: () => void;
  restoreBlockedCommand: (composer?: ComposerLocalCallbacks) => void;
  copyBlockedCommand: () => Promise<void>;
  toggleIncludeActiveFileContext: (composer?: ComposerLocalCallbacks) => void;
  selectModel: (model: AgentModel, composer?: ComposerLocalCallbacks) => void;
  setOnboardingFlag: (key: keyof OnboardingFlags, value: boolean) => void;
  setAfxCommandSuggestVisible: (value: boolean) => void;
  setAfxCommandSuggestDismissed: (value: boolean) => void;
  restartAgent: (composer?: ComposerLocalCallbacks) => void;
  /** Slash-action like `/new` or `/abort` issued from the SlashPopup. */
  dispatchSlashAction: (action: "chat/newSession" | "chat/abort") => void;
  /** Send a prepared message immediately (used by Spec-mode strips/welcomes). */
  sendNow: (content: string, composer?: ComposerLocalCallbacks) => void;
  /** Listen for the dev-only debug-panel queue injection custom event. */
  registerDebugQueueInjection: () => void;
}

// ---------------------------------------------------------------------------
// Slice contracts — the region-shaped views consumed by visual components.
// ---------------------------------------------------------------------------

export interface TopBarSlice {
  enabled: boolean;
  checking: boolean;
  status: AgentRuntimeStatus;
  runtime: ChatRuntimeSettings;
  actions: {
    onMemorySelect: (item: MemoryCatalogItem) => void;
    onNewSession: () => void;
    onCompact: () => void;
    onRestartAgent: () => void;
  };
}

export interface ConversationSlice {
  enabled: boolean;
  messages: readonly ChatTimelineItem[];
  noteEvents: readonly ChatNoteEventView[];
  commandOutputs: readonly ChatCommandOutputView[];
  hasReceivedStateSnapshot: boolean;
  hasReceivedSettingsSnapshot: boolean;
  workspaceMode: WorkspaceMode;
  activeDocContext: ActiveDocCtx;
  runtimeUnconfigured: boolean;
  rpcEnabled: boolean;
  initialPersistedChatView: PersistedChatViewState | null;
}

export interface ComposerActivitySlice {
  enabled: boolean;
  thinking: string | null;
  isStreaming: boolean;
  isSystemCommand: (draft: string) => boolean;
}

export interface ComposerSlice {
  enabled: boolean;
  dockEnabled: boolean;
  activityBarEnabled: boolean;
  attachmentTrayEnabled: boolean;
  panelStackEnabled: boolean;
  slashCommandPopoverEnabled: boolean;
  fileMentionPopoverEnabled: boolean;
  workspaceMode: WorkspaceMode;
  models: readonly AgentModel[];
  commands: readonly AgentCommand[];
  files: readonly AgentFileView[];
  selectedModel: Pick<AgentModel, "provider" | "id" | "name" | "instanceId"> | undefined;
  thinkingLevel: ThinkingLevel | undefined;
  includeActiveFileContext: boolean;
  activeFileDisplayName: string;
  activeFileDisplayPath: string;
  customProviderLabels: Readonly<Record<string, string>>;
  isStreaming: boolean;
  isCompacting: boolean;
  runtimeUnavailable: boolean;
  runtimeUnconfigured: boolean;
  rpcEnabled: boolean;
}

export interface FooterSlice {
  enabled: boolean;
  usageStatsEnabled: boolean;
  usage: ChatUsageStats | null;
  isCheckingAgent: boolean;
  runtimeUnavailable: boolean;
  runtimeUnconfigured: boolean;
  isStreaming: boolean;
  rpcEnabled: boolean;
  agentPhase: AgentRuntimePhase;
  workspaceMode: WorkspaceMode;
  onPiWarningClick?: () => void;
}

export interface HistorySlice {
  enabled: boolean;
  historyStore: ChatHistoryStore | null;
}

export interface ChatControllerRegionSlices {
  topBar: TopBarSlice;
  conversation: ConversationSlice;
  composer: ComposerSlice;
  composerActivity: ComposerActivitySlice;
  footer: FooterSlice;
  history: HistorySlice;
}

export interface ChatControllerBridge {
  getState: typeof bridgeGetState;
  setState: typeof bridgeSetState;
  send: typeof bridgeSend;
  on: typeof bridgeOn;
}

export interface ChatController {
  flags: ChatWindowFlags;
  initialPersistedChatView: PersistedChatViewState | null;
  /** Reserved controller slot for future durable chat-history persistence. */
  historyStore: ChatHistoryStore | null;
  bridge: ChatControllerBridge;
  state: ChatControllerState;
  derived: ChatControllerDerived;
  actions: ChatControllerActions;
  slices: ChatControllerRegionSlices;
  /** Panel registry config built from current state + lifted strip actions. */
  composerPanelStackConfig: ComposerPanelStackConfig;
}

export interface UseChatControllerProps {
  flags?: Partial<ChatWindowFlags>;
  externalAgentStatus?: AgentRuntimeStatus;
  recoveryActions?: AgentRecoveryActions;
  isCheckingAgent?: boolean;
  onPromptHistoryAppend?: (prompt: string) => void;
  /**
   * Composer-local callbacks owned by `ChatWindow` (textarea focus, draft
   * clearing, popover open/close, scroll reset, prompt-history cursor reset).
   * The controller wires these into panel-registry actions so chrome buttons
   * (e.g. "Switch to Code" on the blocked-command panel) can update composer-
   * local state without re-implementing it.
   */
  composerLocal?: ComposerLocalCallbacks;
}

export type ChatBridgeUnsubscribe = () => void;
export type ChatBridgeSubscriptionFactory = (
  bridge: ChatControllerBridge,
) => readonly ChatBridgeUnsubscribe[];

export function useChatBridgeSubscriptions(
  createSubscriptions: ChatBridgeSubscriptionFactory,
  deps: DependencyList,
): void {
  useEffect(() => {
    const subscriptions = createSubscriptions({
      getState: bridgeGetState,
      setState: bridgeSetState,
      send: bridgeSend,
      on: bridgeOn,
    });
    return () => subscriptions.forEach((unsubscribe) => unsubscribe());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- caller owns handler dependency selection.
  }, deps);
}

const STABLE_BRIDGE: ChatControllerBridge = {
  getState: bridgeGetState,
  setState: bridgeSetState,
  send: bridgeSend,
  on: bridgeOn,
};

/**
 * Returns a callback whose identity stays stable for the component's lifetime
 * but always invokes the latest `fn` (via a ref). Used by the controller and
 * by `ChatWindow` so action callbacks don't break downstream memoization when
 * their internal state dependencies change.
 *
 * @see docs/specs/216-app-chat-window-componentization/design.md [DES-PERF]
 */
export function useStableCallback<TArgs extends unknown[], TReturn>(
  fn: (...args: TArgs) => TReturn,
): (...args: TArgs) => TReturn {
  const ref = useRef(fn);
  useEffect(() => {
    ref.current = fn;
  });
  return useCallback((...args: TArgs) => ref.current(...args), []);
}

const DEFAULT_ONBOARDING_FLAGS: OnboardingFlags = {
  specModeOfferDismissed: false,
  specModeTooltipSeen: false,
  docActionsTooltipSeen: false,
};

// ---------------------------------------------------------------------------
// useChatController — owns everything except composer-local UI state.
// ---------------------------------------------------------------------------

export function useChatController({
  flags,
  externalAgentStatus,
  recoveryActions,
  isCheckingAgent = false,
  onPromptHistoryAppend,
  composerLocal,
}: UseChatControllerProps = {}): ChatController {
  const mergedFlags = useMemo<ChatWindowFlags>(
    () => ({ ...DEFAULT_CHAT_WINDOW_FLAGS, ...flags }),
    [flags],
  );
  const [initialPersistedChatView] = useState(() => readPersistedChatViewState());
  const historyStore: ChatHistoryStore | null = null;

  // Cross-region / bridge-sourced / persisted state. Every field below either
  // (a) is read by more than one visual region, or (b) arrives from a bridge
  // subscription, or (c) survives across remounts via the persisted-view
  // hydration above. ChatWindow consumes these via `controller.state.X`.
  const [messages, setMessages] = useState<ChatTimelineItem[]>(
    () => initialPersistedChatView?.messages ?? [],
  );
  const [noteEvents, setNoteEvents] = useState<ChatNoteEventView[]>(
    () => initialPersistedChatView?.noteEvents ?? [],
  );
  const [commandOutputs, setCommandOutputs] = useState<ChatCommandOutputView[]>(
    () => initialPersistedChatView?.commandOutputs ?? [],
  );
  const [runtime, setRuntime] = useState<ChatRuntimeSettings>({});
  const [usage, setUsage] = useState<ChatUsageStats | null>(null);
  const [queued, setQueued] = useState<QueuedMessage[]>([]);
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>(
    () => initialPersistedChatView?.workspaceMode ?? "code",
  );
  const [hasReceivedStateSnapshot, setHasReceivedStateSnapshot] = useState(
    () => initialPersistedChatView !== null,
  );
  const [hasReceivedSettingsSnapshot, setHasReceivedSettingsSnapshot] = useState(
    () => initialPersistedChatView?.workspaceMode != null,
  );
  const [internalAgentStatus, setInternalAgentStatus] = useState<AgentRuntimeStatus>(
    () => externalAgentStatus ?? createCheckingAgentRuntimeStatus(),
  );
  const [thinking, setThinking] = useState<string | null>(null);
  const [models, setModels] = useState<readonly AgentModel[]>([]);
  const [commands, setCommands] = useState<readonly AgentCommand[]>([]);
  const [files, setFiles] = useState<readonly AgentFileView[]>([]);
  const [activeFileContext, setActiveFileContext] = useState<ActiveFileContextSnapshot | null>(
    null,
  );
  const [activeDocContext, setActiveDocContext] = useState<ActiveDocCtx>(EMPTY_DOC_CTX);
  const [customProviderLabels, setCustomProviderLabels] = useState<
    Readonly<Record<string, string>>
  >({});
  const [onboardingFlags, setOnboardingFlags] = useState<OnboardingFlags>(DEFAULT_ONBOARDING_FLAGS);
  const [blockedAction, setBlockedAction] = useState<BlockedActionView | null>(null);
  const [includeActiveFileContext, setIncludeActiveFileContext] = useState(true);
  const [dismissedDocActionsStrip, setDismissedDocActionsStrip] = useState(false);
  const [afxCommandSuggestVisible, setAfxCommandSuggestVisibleState] = useState(false);
  const [afxCommandSuggestDismissed, setAfxCommandSuggestDismissedState] = useState(false);
  const [dismissedAtAssistantMessageId, setDismissedAtAssistantMessageId] = useState<string | null>(
    null,
  );

  // Refs keep long-lived bridge handlers aligned with the latest mode,
  // command, and dangerous-command confirmation state.
  const pendingWorkspaceModeRef = useRef<WorkspaceMode | null>(null);
  const latestWorkspaceModeRef = useRef<WorkspaceMode>(workspaceMode);
  const afxCommandSuggestDismissedRef = useRef(false);
  const pendingAfxCommandSuggestRef = useRef(false);
  const activeCommandRef = useRef<{ requestId: string; command: string } | null>(null);
  const pendingDangerousRef = useRef<{ requestId: string; command: string } | null>(null);

  useEffect(() => {
    latestWorkspaceModeRef.current = workspaceMode;
  }, [workspaceMode]);
  useEffect(() => {
    afxCommandSuggestDismissedRef.current = afxCommandSuggestDismissed;
  }, [afxCommandSuggestDismissed]);

  // Derived flags read by slices, the panel-stack config, and several actions.
  // `agentStatus` prefers the external status the host passes via `ChatProps`
  // and falls back to the internal one the controller maintains from `agent/*`
  // bridge messages.
  const agentStatus = externalAgentStatus ?? internalAgentStatus;
  const isStreaming = agentStatus.isStreaming;
  const isCompacting = runtime.isCompacting === true;
  const runtimeUnavailable = agentStatus.phase === "disconnected" || agentStatus.phase === "error";
  const runtimeUnconfigured = agentStatus.runtimeConfigured === false;
  const rpcEnabled = runtime.rpcEnabled === true || agentStatus.rpcEnabled === true;
  const isExploreMode = workspaceMode === "explore";
  const activeFileDisplayName = activeFileContext?.name ?? "No active file";
  const activeFileDisplayPath = activeFileContext?.path ?? "No active editor file";

  // Compaction lifecycle. `setCompactionActive` flips a single bit on the
  // runtime snapshot so the composer/footer can show the "Compacting…" state;
  // `completeCompaction` (fired by the `agent/compacted` handler) clears the
  // queue, returns the agent to `ready`, drops the thinking text, and toasts.
  const setCompactionActive = useCallback((isActive: boolean): void => {
    setRuntime((current) => ({ ...current, isCompacting: isActive }));
  }, []);

  const completeCompaction = useStableCallback((): void => {
    setQueued([]);
    setCompactionActive(false);
    setInternalAgentStatus((current) => ({
      ...current,
      phase: current.running ? "ready" : current.phase,
      isStreaming: false,
    }));
    setThinking(null);
    toast.success("Session compacted", "History compacted into a summary.");
  });

  // A pending local mode change wins over stale host snapshots until the host
  // confirms the same mode.
  const acceptHostWorkspaceMode = useStableCallback((mode: WorkspaceMode): boolean => {
    if (pendingWorkspaceModeRef.current && pendingWorkspaceModeRef.current !== mode) return false;
    if (pendingWorkspaceModeRef.current === mode) pendingWorkspaceModeRef.current = null;
    setWorkspaceMode(mode);
    return true;
  });

  const setMode = useStableCallback((mode: WorkspaceMode) => {
    pendingWorkspaceModeRef.current = mode;
    setWorkspaceMode((current) => (current === mode ? current : mode));
    if (mode !== "code") {
      setAfxCommandSuggestVisibleState(false);
      pendingAfxCommandSuggestRef.current = false;
    }
    bridgeSend({ type: "chat/setMode", requestId: createChatUid(), mode });
  });

  const markAfxCommandIfCodeMode = useCallback((content: string): void => {
    if (latestWorkspaceModeRef.current !== "code") return;
    if (/^\/afx-[a-z-]+(?:\s|$)/i.test(content.trim())) {
      pendingAfxCommandSuggestRef.current = true;
    }
  }, []);

  // ChatWindow has no direct bridge subscriptions; host messages hydrate and
  // update the chat surface here.
  useChatBridgeSubscriptions(
    (bridge) => {
      const offs = [
        // Full snapshot from host
        bridge.on("chat/state", (msg) => {
          setHasReceivedStateSnapshot(true);
          setMessages(msg.messages);
          if (msg.messages.length === 0) {
            setCommandOutputs([]);
            setNoteEvents([]);
            setUsage(null);
            setAfxCommandSuggestVisibleState(false);
            pendingAfxCommandSuggestRef.current = false;
          }
          setInternalAgentStatus((p) => ({
            ...p,
            phase: msg.isStreaming ? "busy" : p.phase,
            isStreaming: msg.isStreaming,
          }));
        }),

        // New message start
        bridge.on("chat/messageStart", (msg) => {
          setMessages((prev: ChatTimelineItem[]) =>
            prev.some((m) => m.id === msg.id)
              ? prev
              : [
                  ...prev,
                  {
                    id: msg.id,
                    role: msg.role,
                    content: msg.content ?? "",
                    createdAt: msg.createdAt,
                    streaming: msg.role === "assistant",
                  },
                ],
          );
          if (msg.role === "assistant") setThinking(null);
        }),

        bridge.on("chat/messageDelta", (msg) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === msg.id && "content" in m ? { ...m, content: m.content + msg.delta } : m,
            ),
          );
        }),

        bridge.on("chat/thinkingDelta", (msg) => {
          setThinking((prev) => (prev ?? "") + msg.delta);
        }),

        bridge.on("chat/messageEnd", (msg) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === msg.id ? { ...m, streaming: false, stopReason: msg.stopReason } : m,
            ),
          );
          if (
            pendingAfxCommandSuggestRef.current &&
            latestWorkspaceModeRef.current === "code" &&
            !afxCommandSuggestDismissedRef.current
          ) {
            pendingAfxCommandSuggestRef.current = false;
            setAfxCommandSuggestVisibleState(true);
          }
          setThinking(null);
        }),

        bridge.on("chat/toolStart", (msg) => {
          const args = msg.args as Record<string, unknown> | undefined;
          if (isEditLikeToolName(msg.toolName)) {
            setDismissedAtAssistantMessageId(null);
          }
          setMessages((prev) => {
            const copy = [...prev];
            for (let i = copy.length - 1; i >= 0; i--) {
              if (copy[i].role === "assistant") {
                const m = copy[i] as ChatMessageView;
                copy[i] = {
                  ...m,
                  tools: [
                    ...(m.tools ?? []),
                    {
                      toolCallId: msg.toolCallId,
                      toolName: msg.toolName,
                      status: "running" as const,
                      args,
                    },
                  ],
                };
                break;
              }
            }
            return copy;
          });
        }),

        bridge.on("chat/toolEnd", (msg) => {
          setMessages((prev) =>
            prev.map((m) => {
              if (!("tools" in m)) return m;
              const typed = m;
              return {
                ...typed,
                tools: (typed.tools ?? []).map((t: ChatToolView) =>
                  t.toolCallId === msg.toolCallId
                    ? {
                        ...t,
                        status: msg.ok ? "ok" : "error",
                        summary: msg.summary,
                        firstChangedLine: msg.firstChangedLine ?? t.firstChangedLine,
                      }
                    : t,
                ),
              };
            }),
          );
        }),

        bridge.on("agent/status", (msg) => {
          setInternalAgentStatus(msg.status);
          if (!msg.status.isStreaming) setThinking(null);
        }),

        bridge.on("chat/usage", (msg) => {
          const usageValue: ChatUsageStats = {
            tokens: msg.tokens,
            cost: msg.cost,
            contextUsage: msg.contextUsage,
          };
          setUsage(usageValue);
          if (msg.messageId) {
            setMessages((prev) =>
              prev.map((m) => (m.id === msg.messageId ? { ...m, usage: usageValue } : m)),
            );
          }
        }),

        bridge.on("chat/error", (msg) => {
          if (msg.showToast !== false) {
            toast.error("Agent runtime error", msg.message);
          }
          setInternalAgentStatus((p) => ({
            ...p,
            phase: p.running ? "ready" : p.phase,
            isStreaming: false,
          }));
          setThinking(null);
          if (msg.displayInTranscript === false) return;
          setMessages((prev) => [
            ...prev,
            {
              id: createChatUid(),
              role: "assistant",
              content: `⚠ ${msg.message}`,
              createdAt: Date.now(),
            },
          ]);
        }),

        bridge.on("chat/aborted", () => {
          setInternalAgentStatus((p) => ({
            ...p,
            phase: p.running ? "ready" : p.phase,
            isStreaming: false,
          }));
          setThinking(null);
          setMessages((prev) => {
            let touched = false;
            const next = prev.map((m) => {
              if (!("tools" in m)) return m;
              const tools = m.tools ?? [];
              if (!tools.some((t) => t.status === "running")) return m;
              touched = true;
              return {
                ...m,
                tools: tools.map((t) =>
                  t.status === "running" ? { ...t, status: "error" as const } : t,
                ),
              };
            });
            return touched ? next : prev;
          });
        }),

        bridge.on("agent/models", (msg) => {
          setModels(msg.models);
        }),

        bridge.on("agent/modelChanged", (msg) => {
          setModels((prev) =>
            prev.some(
              (m) =>
                m.provider === msg.model.provider &&
                m.id === msg.model.id &&
                (m.instanceId ?? "default") === (msg.model.instanceId ?? "default"),
            )
              ? prev
              : [...prev, msg.model],
          );
          setInternalAgentStatus((p) => ({
            ...p,
            model: {
              provider: msg.model.provider,
              id: msg.model.id,
              name: msg.model.name,
              reasoning: msg.model.reasoning,
              source: msg.model.source,
              instanceId: msg.model.instanceId,
              instanceLabel: msg.model.instanceLabel,
            },
          }));
        }),

        bridge.on("agent/commands", (msg) => {
          setCommands(msg.commands);
        }),

        bridge.on("agent/settingsSnapshot", (msg) => {
          setIncludeActiveFileContext(msg.snapshot.context?.includeActiveFileContext ?? true);
          acceptHostWorkspaceMode(msg.snapshot.mode?.active ?? "code");
          if (msg.snapshot.onboarding) {
            setOnboardingFlags(msg.snapshot.onboarding);
          }
          const piSdkProviders = msg.snapshot.customModels?.piSdk.providers ?? [];
          const labels: Record<string, string> = {};
          for (const summary of piSdkProviders) {
            if (summary.displayName) labels[summary.id] = summary.displayName;
          }
          setCustomProviderLabels(labels);
          setHasReceivedSettingsSnapshot(true);
        }),

        bridge.on("agent/actionBlocked", (msg) => {
          if (!acceptHostWorkspaceMode(msg.mode)) return;
          setBlockedAction({
            requestId: msg.requestId ?? createChatUid(),
            command: msg.command?.trim() ?? "",
            title: msg.title,
            message: msg.message,
            mode: msg.mode,
          });
        }),

        bridge.on("agent/activeFileContext", (msg) => {
          setActiveFileContext(msg.snapshot);
        }),

        bridge.on("chat/activeDocContext", (msg) => {
          setActiveDocContext((prev) => {
            const next = activeDocContextFromMessage(msg);
            if (
              prev.feature !== next.feature ||
              prev.filePath !== next.filePath ||
              prev.docKind !== next.docKind ||
              prev.format !== next.format
            ) {
              setDismissedDocActionsStrip(false);
            }
            return next;
          });
        }),

        bridge.on("agent/files", (msg) => {
          setFiles(msg.files);
        }),

        bridge.on("agent/runtimeSettings", (msg) => {
          setRuntime(msg.settings);
          const pending = msg.settings.pendingMessageCount;
          if (typeof pending === "number") {
            const normalized = Math.max(0, pending);
            setQueued((q) => (q.length <= normalized ? q : q.slice(q.length - normalized)));
          }
        }),

        bridge.on("agent/compacted", completeCompaction),

        bridge.on("agent/signOffComplete", (msg) => {
          if (!msg.ok) {
            toast.error("Sign Off failed", msg.error ?? "The host could not apply the edit.");
            return;
          }
          if ((msg.rowsTicked ?? 0) === 0) {
            toast.info("Already signed off", "No Human cells needed updating.");
            return;
          }
          const rows = msg.rowsTicked ?? 0;
          const promoted = msg.newStatus === "Living";
          const title = promoted
            ? `Promoted to Living · ${rows} row${rows === 1 ? "" : "s"} signed off`
            : `${rows} row${rows === 1 ? "" : "s"} signed off`;
          toast.success(title, "⌘Z reverts the edit.");
        }),

        bridge.on("agent/commandOutput", (msg) => {
          setCommandOutputs((prev) => {
            const idx = prev.findIndex((o) => o.requestId === msg.requestId);
            if (idx === -1) {
              const cmd =
                activeCommandRef.current?.requestId === msg.requestId
                  ? activeCommandRef.current.command
                  : "";
              return [
                ...prev,
                {
                  requestId: msg.requestId,
                  command: cmd,
                  stdout: msg.kind !== "stderr" && !msg.done ? (msg.delta ?? "") : "",
                  stderr: msg.kind === "stderr" ? (msg.delta ?? "") : "",
                  error: msg.error,
                  exitCode: msg.done ? msg.exitCode : undefined,
                  createdAt: Date.now(),
                },
              ];
            }
            const next = [...prev];
            const existing = next[idx];
            next[idx] = {
              ...existing,
              stdout:
                !msg.done && msg.kind !== "stderr"
                  ? existing.stdout + (msg.delta ?? "")
                  : existing.stdout,
              stderr:
                !msg.done && msg.kind === "stderr"
                  ? existing.stderr + (msg.delta ?? "")
                  : existing.stderr,
              error: msg.error ?? existing.error,
              exitCode: msg.done ? msg.exitCode : existing.exitCode,
            };
            return next;
          });
        }),

        bridge.on("agent/dangerousConfirmed", (msg) => {
          if (pendingDangerousRef.current?.requestId === msg.requestId) {
            const { command } = pendingDangerousRef.current;
            pendingDangerousRef.current = null;
            if (msg.confirmed) {
              bridge.send({ type: "chat/runCommand", requestId: msg.requestId, command });
            }
          }
        }),
      ];

      // Handshake on mount
      bridge.send({ type: "chat/getState" });
      bridge.send({ type: "chat/getModels", requestId: createChatUid() });
      bridge.send({ type: "chat/getCommands", requestId: createChatUid() });
      bridge.send({ type: "chat/getSettingsSnapshot", requestId: createChatUid() });

      return offs;
    },
    [acceptHostWorkspaceMode, completeCompaction],
  );

  // Webview-state persistence — VS Code retains an opaque blob across webview
  // remounts; we use it to seed `messages`, `commandOutputs`, `noteEvents`,
  // and `workspaceMode` so a tab switch lands directly on the prior transcript
  // instead of flashing the empty welcome card.
  //
  // The effect below writes whenever any of those four atoms change AND we
  // have either real timeline content or a confirmed settings snapshot; this
  // avoids writing the trivial empty shape on first paint before the host has
  // had a chance to push anything.
  const persistAction = useStableCallback((next: PersistedChatViewState | null) =>
    persistChatViewState(next),
  );
  useEffect(() => {
    const hasTimelineContent =
      messages.length > 0 || commandOutputs.length > 0 || noteEvents.length > 0;
    const shouldPersistMode = hasReceivedSettingsSnapshot;
    if (!hasReceivedStateSnapshot && !hasTimelineContent && !shouldPersistMode) return;

    persistAction(
      hasTimelineContent
        ? {
            messages: [...messages],
            commandOutputs: [...commandOutputs],
            noteEvents: [...noteEvents],
            workspaceMode,
          }
        : shouldPersistMode
          ? { messages: [], commandOutputs: [], noteEvents: [], workspaceMode }
          : null,
    );
  }, [
    commandOutputs,
    hasReceivedSettingsSnapshot,
    hasReceivedStateSnapshot,
    messages,
    noteEvents,
    persistAction,
    workspaceMode,
  ]);

  //
  // All public actions use `useStableCallback` so their identity stays stable
  // for the controller's lifetime. This is the critical perf invariant: when
  // state (e.g. `isStreaming`) changes, action references must not invalidate —
  // otherwise every downstream memoized child re-renders. The full memoization
  // table this protects is in
  // `docs/specs/216-app-chat-window-componentization/design.md [DES-PERF]`.

  // Modified-files derivation drives both the panel definition's visibility and
  // the `dismissModifiedFiles` action, so compute once here.
  const { files: modifiedFiles, latestEditingAssistantMessageId } = useMemo(
    () => deriveModifiedFiles(messages),
    [messages],
  );
  const filesPanelVisible =
    modifiedFiles.length > 0 &&
    latestEditingAssistantMessageId !== null &&
    latestEditingAssistantMessageId !== dismissedAtAssistantMessageId;

  const abort = useStableCallback(() => {
    bridgeSend({ type: "chat/abort" });
  });

  const setThinkingLevel = useStableCallback((level: ThinkingLevel) => {
    setRuntime((r) => ({ ...r, thinkingLevel: level }));
    bridgeSend({ type: "chat/setThinkingLevel", requestId: createChatUid(), level });
  });

  const dispatchHostAction = useStableCallback((action: "tasks.signOff", uri: string) => {
    bridgeSend({ type: "chat/hostAction", requestId: createChatUid(), action, uri });
  });

  const handleOpenModifiedFile = useStableCallback((p: string, line?: number) => {
    bridgeSend({ type: "chat/openFile", path: p, line });
  });

  const dismissModifiedFiles = useStableCallback(() => {
    setDismissedAtAssistantMessageId(latestEditingAssistantMessageId);
  });

  const dismissQueued = useStableCallback((id: string) => {
    setQueued((q) => q.filter((m) => m.id !== id));
  });

  const clearAllQueued = useStableCallback(() => {
    setQueued([]);
  });

  const restoreBlockedCommand = useStableCallback((composer?: ComposerLocalCallbacks) => {
    const action = blockedAction;
    if (!action) return;
    const restored = `! ${action.command}`.trim();
    composer?.setDraft?.(restored);
    setBlockedAction(null);
    setMode("code");
    composer?.focusComposer?.();
  });

  const copyBlockedCommand = useStableCallback(async (): Promise<void> => {
    const action = blockedAction;
    if (!action) return;
    const text = `! ${action.command}`.trim();
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Command copied");
    } catch {
      toast.error("Copy failed", "Could not copy the blocked command.");
    }
  });

  const toggleIncludeActiveFileContext = useStableCallback((composer?: ComposerLocalCallbacks) => {
    const next = !includeActiveFileContext;
    setIncludeActiveFileContext(next);
    bridgeSend({
      type: "chat/setIncludeActiveFileContext",
      requestId: createChatUid(),
      enabled: next,
    });
    composer?.focusComposer?.();
  });

  const selectModel = useStableCallback((model: AgentModel, composer?: ComposerLocalCallbacks) => {
    bridgeSend({
      type: "chat/setModel",
      requestId: createChatUid(),
      provider: model.provider,
      modelId: model.id,
      instanceId: model.instanceId,
    });
    composer?.resetPromptHistoryCursor?.();
    composer?.focusComposer?.();
  });

  const setOnboardingFlag = useStableCallback((key: keyof OnboardingFlags, value: boolean) => {
    bridgeSend({ type: "chat/setOnboardingFlag", key, value });
    setOnboardingFlags((flags) => ({ ...flags, [key]: value }));
  });

  const setAfxCommandSuggestVisible = useStableCallback((value: boolean) => {
    setAfxCommandSuggestVisibleState(value);
    if (!value) pendingAfxCommandSuggestRef.current = false;
  });

  const setAfxCommandSuggestDismissed = useStableCallback((value: boolean) => {
    setAfxCommandSuggestDismissedState(value);
    if (value) setAfxCommandSuggestVisibleState(false);
  });

  const dismissComposerPanel = useStableCallback((id: string) => {
    if (id === "modified-files") {
      setDismissedAtAssistantMessageId(latestEditingAssistantMessageId);
      return;
    }
    if (id === "doc-actions") {
      setDismissedDocActionsStrip(true);
      return;
    }
    if (id === "mode-suggest") {
      setOnboardingFlag("specModeOfferDismissed", true);
      return;
    }
    if (id === "afx-command-suggest") {
      setAfxCommandSuggestDismissed(true);
      return;
    }
    if (id === "blocked-command") {
      setBlockedAction(null);
    }
  });

  const startCompact = useStableCallback((composer?: ComposerLocalCallbacks) => {
    if (isCompacting) return;
    setCompactionActive(true);
    bridgeSend({ type: "chat/compact", requestId: createChatUid() });
    toast.info("Compacting session…");
    composer?.focusComposer?.();
  });

  const restartAgent = useStableCallback((composer?: ComposerLocalCallbacks) => {
    recoveryActions?.onRestartAgent?.();
    composer?.focusComposer?.();
  });

  const dispatchSlashAction = useStableCallback((action: "chat/newSession" | "chat/abort") => {
    bridgeSend({ type: action });
  });

  // Composer-coupled actions — the actions in this group need to touch the
  // textarea, the slash/mention popover state, the prompt-history cursor, or
  // the auto-scroll behavior. None of those live on the controller (they're
  // composer-local per the State Ownership rule), so the action accepts a
  // `ComposerLocalCallbacks` bundle from the caller and pokes through it.
  const isComposerDisabledFor = useCallback(
    (draft: string): boolean => {
      const isSystem = draft.startsWith("!");
      return isCheckingAgent || isCompacting || (!isSystem && runtimeUnavailable);
    },
    [isCheckingAgent, isCompacting, runtimeUnavailable],
  );

  const submit = useStableCallback((input: ChatSubmitInput) => {
    const trimmed = input.draft.trim();
    const isCommandDraft = trimmed.startsWith("!");
    if (
      trimmed.length === 0 ||
      (isCommandDraft ? isCheckingAgent || isCompacting : isComposerDisabledFor(input.draft))
    ) {
      return;
    }

    input.composer?.clearDraft?.();
    input.composer?.closePopovers?.();
    input.composer?.resetScroll?.();
    input.composer?.resetPromptHistoryCursor?.();

    // System command: bypass LLM
    if (isCommandDraft) {
      const command = trimmed.slice(1).trimStart();
      if (command.length === 0) return;
      if (isExploreMode) {
        const requestId = createChatUid();
        activeCommandRef.current = { requestId, command };
        bridgeSend({ type: "chat/runCommand", requestId, command });
        input.composer?.focusComposer?.();
        return;
      }
      const danger = analyzeDanger(command);
      if (danger.isDangerous) {
        const requestId = createChatUid();
        pendingDangerousRef.current = { requestId, command };
        activeCommandRef.current = { requestId, command };
        bridgeSend({
          type: "chat/confirmDangerous",
          requestId,
          command,
          reason: danger.reason,
        });
        input.composer?.focusComposer?.();
        return;
      }
      const requestId = createChatUid();
      activeCommandRef.current = { requestId, command };
      bridgeSend({ type: "chat/runCommand", requestId, command });
      input.composer?.focusComposer?.();
      return;
    }

    // Normal LLM message
    const mentions = extractMentions(trimmed);
    const mentionsArg = mentions.length > 0 ? mentions : undefined;
    onPromptHistoryAppend?.(trimmed);
    markAfxCommandIfCodeMode(trimmed);

    if (!isStreaming) {
      bridgeSend({
        type: "chat/send",
        requestId: createChatUid(),
        content: trimmed,
        mentions: mentionsArg,
      });
    } else {
      const mode: QueuedMessage["mode"] = input.followUp ? "followUp" : "steer";
      bridgeSend({
        type: mode === "steer" ? "chat/steer" : "chat/followUp",
        requestId: createChatUid(),
        content: trimmed,
        mentions: mentionsArg,
      });
      setQueued((q) => [...q, { id: createChatUid(), mode, content: trimmed, sentAt: Date.now() }]);
    }
    input.composer?.focusComposer?.();
  });

  const sendNow = useStableCallback((content: string, composer?: ComposerLocalCallbacks) => {
    const trimmed = content.trim();
    if (trimmed.length === 0) return;
    // Hard guard — runtime not ready: surface in draft instead of dropping.
    if (isComposerDisabledFor(trimmed)) {
      composer?.setDraft?.(trimmed);
      composer?.focusComposer?.();
      return;
    }
    onPromptHistoryAppend?.(trimmed);
    markAfxCommandIfCodeMode(trimmed);
    const requestId = createChatUid();
    if (isStreaming) {
      bridgeSend({ type: "chat/followUp", requestId, content: trimmed });
      setQueued((q) => [
        ...q,
        { id: createChatUid(), mode: "followUp", content: trimmed, sentAt: Date.now() },
      ]);
      return;
    }
    bridgeSend({ type: "chat/send", requestId, content: trimmed });
  });

  const handleMemorySelect = useStableCallback(
    ({ item, composer }: ChatHandleMemorySelectInput) => {
      if (item.autoSend) {
        sendNow(item.command, composer);
      } else {
        composer?.setDraft?.(item.command);
        composer?.focusComposer?.();
      }
    },
  );

  const saveAsNote = useStableCallback(({ draft, composer }: ChatSaveAsNoteInput) => {
    const trimmed = draft.trim();
    if (trimmed.length === 0) return;
    composer?.clearDraft?.();
    composer?.closePopovers?.();
    bridgeSend({ type: "chat/saveNote", content: trimmed });
    setNoteEvents((prev) => [
      ...prev,
      { id: createChatUid(), content: trimmed, savedAt: Date.now() },
    ]);
  });

  const startNewSession = useStableCallback((input?: ChatStartNewSessionInput) => {
    bridgeSend({ type: "chat/newSession" });
    input?.composer?.clearDraft?.();
    setQueued([]);
    setCommandOutputs([]);
    setNoteEvents([]);
    setUsage(null);
    input?.composer?.resetScroll?.();
    toast.success("New session started");
    input?.composer?.focusComposer?.();
  });

  const registerDebugQueueInjection = useStableCallback(() => {
    // No-op — the controller subscribes to the dev event itself (see hook below).
  });

  // Dev-only: subscribe to the debug-panel queue injection custom event so the
  // QueueStrip/QueuePanel can be pre-populated for design iteration.
  useDebugQueueInjectionEffect(setQueued);

  // Region slices — narrow, memoized views of the controller's state shaped
  // for each visual region. Each slice memoizes on the actual fields it reads,
  // so an unrelated state change (e.g. `models` arriving) does not invalidate
  // the topbar or footer slices.
  //
  //     +----------------------+      +-------------------+
  //     | controller.state.*   | ───► |   slice.*         |
  //     | controller.actions.* |      |   (data + scoped  |
  //     +----------------------+      |    actions only)  |
  //                                   +-------------------+
  //                                              │
  //                                              ▼
  //                                   ChatTopBar / Composer* / ...
  const topBarActions = useMemo(
    () => ({
      onMemorySelect: (item: MemoryCatalogItem) => handleMemorySelect({ item }),
      onNewSession: () => startNewSession(),
      onCompact: () => startCompact(),
      onRestartAgent: () => restartAgent(),
    }),
    [handleMemorySelect, restartAgent, startCompact, startNewSession],
  );

  const topBarSlice = useMemo<TopBarSlice>(
    () => ({
      enabled: mergedFlags.topBar,
      checking: isCheckingAgent,
      status: agentStatus,
      runtime,
      actions: topBarActions,
    }),
    [agentStatus, isCheckingAgent, mergedFlags.topBar, runtime, topBarActions],
  );

  const conversationSlice = useMemo<ConversationSlice>(
    () => ({
      enabled: mergedFlags.conversationPane,
      messages,
      noteEvents,
      commandOutputs,
      hasReceivedStateSnapshot,
      hasReceivedSettingsSnapshot,
      workspaceMode,
      activeDocContext,
      runtimeUnconfigured,
      rpcEnabled,
      initialPersistedChatView,
    }),
    [
      activeDocContext,
      commandOutputs,
      hasReceivedSettingsSnapshot,
      hasReceivedStateSnapshot,
      initialPersistedChatView,
      mergedFlags.conversationPane,
      messages,
      noteEvents,
      rpcEnabled,
      runtimeUnconfigured,
      workspaceMode,
    ],
  );

  const composerActivitySlice = useMemo<ComposerActivitySlice>(
    () => ({
      enabled: mergedFlags.composerActivityBar,
      thinking,
      isStreaming,
      isSystemCommand: (draft: string) => draft.startsWith("!"),
    }),
    [isStreaming, mergedFlags.composerActivityBar, thinking],
  );

  const composerSlice = useMemo<ComposerSlice>(
    () => ({
      enabled: mergedFlags.composerDock,
      dockEnabled: mergedFlags.composerDock,
      activityBarEnabled: mergedFlags.composerActivityBar,
      attachmentTrayEnabled: mergedFlags.composerAttachmentTray,
      panelStackEnabled: mergedFlags.composerPanelStack,
      slashCommandPopoverEnabled: mergedFlags.slashCommandPopover,
      fileMentionPopoverEnabled: mergedFlags.fileMentionPopover,
      workspaceMode,
      models,
      commands,
      files,
      selectedModel: agentStatus.model,
      thinkingLevel: runtime.thinkingLevel,
      includeActiveFileContext,
      activeFileDisplayName,
      activeFileDisplayPath,
      customProviderLabels,
      isStreaming,
      isCompacting,
      runtimeUnavailable,
      runtimeUnconfigured,
      rpcEnabled,
    }),
    [
      activeFileDisplayName,
      activeFileDisplayPath,
      agentStatus.model,
      commands,
      customProviderLabels,
      files,
      includeActiveFileContext,
      isCompacting,
      isStreaming,
      mergedFlags.composerActivityBar,
      mergedFlags.composerAttachmentTray,
      mergedFlags.composerDock,
      mergedFlags.composerPanelStack,
      mergedFlags.fileMentionPopover,
      mergedFlags.slashCommandPopover,
      models,
      rpcEnabled,
      runtime.thinkingLevel,
      runtimeUnavailable,
      runtimeUnconfigured,
      workspaceMode,
    ],
  );

  const footerSlice = useMemo<FooterSlice>(
    () => ({
      enabled: mergedFlags.composerDock,
      usageStatsEnabled: mergedFlags.composerFooterUsageStats,
      usage,
      isCheckingAgent,
      runtimeUnavailable,
      runtimeUnconfigured,
      isStreaming,
      rpcEnabled,
      agentPhase: agentStatus.phase,
      workspaceMode,
      onPiWarningClick: recoveryActions?.onOpenSettings,
    }),
    [
      agentStatus.phase,
      isCheckingAgent,
      isStreaming,
      mergedFlags.composerDock,
      mergedFlags.composerFooterUsageStats,
      recoveryActions?.onOpenSettings,
      rpcEnabled,
      runtimeUnavailable,
      runtimeUnconfigured,
      usage,
      workspaceMode,
    ],
  );

  const historySlice = useMemo<HistorySlice>(
    () => ({ enabled: mergedFlags.chatHistory, historyStore }),
    [mergedFlags.chatHistory, historyStore],
  );

  const slices = useMemo<ChatControllerRegionSlices>(
    () => ({
      topBar: topBarSlice,
      conversation: conversationSlice,
      composer: composerSlice,
      composerActivity: composerActivitySlice,
      footer: footerSlice,
      history: historySlice,
    }),
    [
      composerActivitySlice,
      composerSlice,
      conversationSlice,
      footerSlice,
      historySlice,
      topBarSlice,
    ],
  );

  // Builds panel bodies in their visible order; ComposerPanel supplies chrome.
  const composerPanelStackConfig = useMemo<ComposerPanelStackConfig>(() => {
    const panels: ComposerPanelDefinition[] = [];

    // Queue dismisses rows; blocked-command warnings stay expanded.
    // @see docs/specs/211-app-chat-composer/spec.md [FR-4] [FR-10] [FR-13] [FR-15]

    // 1. Files
    if (filesPanelVisible) {
      panels.push({
        id: "modified-files",
        zone: "context",
        title: "Modified",
        count: modifiedFiles.length,
        tone: "neutral",
        visible: true,
        collapsible: true,
        dismissible: true,
        component: FilesPanelBody as ComponentType<unknown>,
        props: { files: modifiedFiles, onOpenFile: handleOpenModifiedFile },
      });
    }

    // 2. Queue: collapsible only; row-level dismiss lives inside QueueRow.
    if (queued.length > 0) {
      panels.push({
        id: "queue",
        zone: "feedback",
        title: "Queued",
        count: queued.length,
        tone: "neutral",
        visible: true,
        collapsible: true,
        actions: <QueueClearAllAction onClearAll={clearAllQueued} />,
        component: QueuePanel as ComponentType<unknown>,
        props: { queued, onDismiss: dismissQueued },
      });
    }

    // 3. Blocked command: dismissible, not collapsible.
    if (blockedAction) {
      panels.push({
        id: "blocked-command",
        zone: "workflow",
        title: "Blocked command",
        tone: "warning",
        visible: true,
        dismissible: true,
        actions: (
          <button
            type="button"
            onClick={() => restoreBlockedCommand(composerLocal)}
            className="inline-flex shrink-0 items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] text-muted-foreground/80 hover:bg-muted hover:text-foreground"
          >
            Switch to Code
          </button>
        ),
        component: BlockedCommandPanelBody as ComponentType<unknown>,
        props: { action: blockedAction, onCopyCommand: copyBlockedCommand },
      });
    }

    // 4. Doc-actions (when not dismissed and an AFX doc is active with actions)
    //
    // Memory is not duplicated in this panel header.
    if (!dismissedDocActionsStrip && activeDocContext.docKind != null) {
      panels.push({
        id: "doc-actions",
        zone: "workflow",
        title: <ChatDocActionsPanelTitle docContext={activeDocContext} />,
        tone: "neutral",
        visible: true,
        collapsible: true,
        dismissible: true,
        component: ChatDocActionsPanelBody as ComponentType<unknown>,
        props: {
          workspaceMode,
          docContext: activeDocContext,
          onInsert: (text: string) => composerLocal?.setDraft?.(text),
          onAutoSend: (text: string) => sendNow(text, composerLocal),
          onHostAction: dispatchHostAction,
          onOpenFile: handleOpenModifiedFile,
        },
      });
    }

    // 5. Mode suggest
    if (
      workspaceMode !== "spec" &&
      !onboardingFlags.specModeOfferDismissed &&
      activeDocContext.docKind != null
    ) {
      panels.push({
        id: "mode-suggest",
        zone: "feedback",
        title: <ModeSuggestPanelTitle docContext={activeDocContext} />,
        tone: "brand",
        visible: true,
        dismissible: true,
        actions: (
          <button
            type="button"
            onClick={() => {
              setMode("spec");
              setOnboardingFlag("specModeOfferDismissed", true);
            }}
            className="inline-flex shrink-0 items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] text-muted-foreground/80 hover:bg-muted hover:text-foreground"
          >
            Switch to Spec
          </button>
        ),
        component: ModeSuggestPanelBody as ComponentType<unknown>,
        props: { docContext: activeDocContext },
      });
    }

    // 6. AFX command suggest
    if (afxCommandSuggestVisible && !afxCommandSuggestDismissed && workspaceMode === "code") {
      panels.push({
        id: "afx-command-suggest",
        zone: "feedback",
        title: "AFX command completed",
        tone: "brand",
        visible: true,
        dismissible: true,
        actions: (
          <button
            type="button"
            onClick={() => {
              setMode("spec");
              setAfxCommandSuggestVisible(false);
            }}
            className="inline-flex shrink-0 items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] text-muted-foreground/80 hover:bg-muted hover:text-foreground"
          >
            Switch to Spec
          </button>
        ),
        component: AfxCommandSuggestPanelBody as ComponentType<unknown>,
      });
    }

    return { panels };
  }, [
    activeDocContext,
    afxCommandSuggestDismissed,
    afxCommandSuggestVisible,
    blockedAction,
    clearAllQueued,
    composerLocal,
    copyBlockedCommand,
    dismissQueued,
    dismissedDocActionsStrip,
    dispatchHostAction,
    filesPanelVisible,
    handleOpenModifiedFile,
    modifiedFiles,
    onboardingFlags.specModeOfferDismissed,
    queued,
    restoreBlockedCommand,
    sendNow,
    setAfxCommandSuggestVisible,
    setMode,
    setOnboardingFlag,
    workspaceMode,
  ]);

  // Bundled `derived` object — what ChatWindow reads via `controller.derived`.
  const derived = useMemo<ChatControllerDerived>(
    () => ({
      agentStatus,
      isStreaming,
      isCompacting,
      runtimeUnavailable,
      runtimeUnconfigured,
      rpcEnabled,
      isExploreMode,
    }),
    [
      agentStatus,
      isCompacting,
      isExploreMode,
      isStreaming,
      rpcEnabled,
      runtimeUnavailable,
      runtimeUnconfigured,
    ],
  );

  // Bundled `state` object — what ChatWindow reads via `controller.state`.
  const state = useMemo<ChatControllerState>(
    () => ({
      messages,
      noteEvents,
      commandOutputs,
      runtime,
      usage,
      queued,
      workspaceMode,
      hasReceivedStateSnapshot,
      hasReceivedSettingsSnapshot,
      internalAgentStatus,
      thinking,
      models,
      commands,
      files,
      activeFileContext,
      activeDocContext,
      customProviderLabels,
      onboardingFlags,
      blockedAction,
      includeActiveFileContext,
      dismissedDocActionsStrip,
      afxCommandSuggestVisible,
      afxCommandSuggestDismissed,
      dismissedAtAssistantMessageId,
    }),
    [
      activeDocContext,
      activeFileContext,
      afxCommandSuggestDismissed,
      afxCommandSuggestVisible,
      blockedAction,
      commandOutputs,
      commands,
      customProviderLabels,
      dismissedAtAssistantMessageId,
      dismissedDocActionsStrip,
      files,
      hasReceivedSettingsSnapshot,
      hasReceivedStateSnapshot,
      includeActiveFileContext,
      internalAgentStatus,
      messages,
      models,
      noteEvents,
      onboardingFlags,
      queued,
      runtime,
      thinking,
      usage,
      workspaceMode,
    ],
  );

  // Bundled `actions` object — what ChatWindow invokes via `controller.actions.X`.
  const actions = useMemo<ChatControllerActions>(
    () => ({
      persistChatViewState: persistAction,
      abort,
      setMode,
      acceptHostWorkspaceMode,
      setThinkingLevel,
      dispatchHostAction,
      submit,
      saveAsNote,
      startNewSession,
      handleMemorySelect,
      startCompact,
      handleOpenModifiedFile,
      dismissComposerPanel,
      dismissModifiedFiles,
      dismissQueued,
      clearAllQueued,
      restoreBlockedCommand,
      copyBlockedCommand,
      toggleIncludeActiveFileContext,
      selectModel,
      setOnboardingFlag,
      setAfxCommandSuggestVisible,
      setAfxCommandSuggestDismissed,
      restartAgent,
      dispatchSlashAction,
      sendNow,
      registerDebugQueueInjection,
    }),
    [
      abort,
      acceptHostWorkspaceMode,
      clearAllQueued,
      copyBlockedCommand,
      dismissModifiedFiles,
      dismissQueued,
      dispatchHostAction,
      dispatchSlashAction,
      dismissComposerPanel,
      handleMemorySelect,
      handleOpenModifiedFile,
      persistAction,
      registerDebugQueueInjection,
      restartAgent,
      restoreBlockedCommand,
      saveAsNote,
      selectModel,
      sendNow,
      setAfxCommandSuggestDismissed,
      setAfxCommandSuggestVisible,
      setMode,
      setOnboardingFlag,
      setThinkingLevel,
      startCompact,
      startNewSession,
      submit,
      toggleIncludeActiveFileContext,
    ],
  );

  return useMemo(
    () => ({
      flags: mergedFlags,
      initialPersistedChatView,
      historyStore,
      bridge: STABLE_BRIDGE,
      state,
      derived,
      actions,
      slices,
      composerPanelStackConfig,
    }),
    [
      actions,
      composerPanelStackConfig,
      derived,
      initialPersistedChatView,
      mergedFlags,
      slices,
      state,
    ],
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function readPersistedChatViewState(): PersistedChatViewState | null {
  const state = bridgeGetState();
  if (!state || typeof state !== "object") return null;

  const persisted = (state as PersistedWebviewState).chatView;
  if (!persisted || typeof persisted !== "object") return null;

  const messages = Array.isArray(persisted.messages)
    ? persisted.messages.map((m) => ({ ...m }))
    : [];
  const commandOutputs = Array.isArray(persisted.commandOutputs)
    ? persisted.commandOutputs.map((output) => ({ ...output }))
    : [];
  const noteEvents = Array.isArray(persisted.noteEvents)
    ? persisted.noteEvents.map((event) => ({ ...event }))
    : [];

  if (
    messages.length === 0 &&
    commandOutputs.length === 0 &&
    noteEvents.length === 0 &&
    persisted.workspaceMode == null
  ) {
    return null;
  }

  return { messages, commandOutputs, noteEvents, workspaceMode: persisted.workspaceMode };
}

export function collectPromptHistory(
  messages: readonly ChatTimelineItem[],
  localHistory: readonly string[],
): string[] {
  const history: string[] = [];
  for (const message of messages) {
    if (message.role !== "user") continue;
    const content = message.content.trim();
    if (content.length > 0 && history[history.length - 1] !== content) history.push(content);
  }
  for (const content of localHistory) {
    const trimmed = content.trim();
    if (trimmed.length > 0 && history[history.length - 1] !== trimmed) history.push(trimmed);
  }
  return history.slice(-50);
}

/** Generates a unique ID for locally-created messages/events. */
export function createChatUid(): string {
  const g = globalThis as unknown as { crypto?: { randomUUID?: () => string } };
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function persistChatViewState(next: PersistedChatViewState | null): void {
  const state = bridgeGetState();
  const base = state && typeof state === "object" ? (state as PersistedWebviewState) : {};

  if (next) {
    bridgeSetState({ ...base, chatView: next });
    return;
  }

  const { chatView: _chatView, ...rest } = base;
  bridgeSetState(rest);
}

// Modified-files derivation lives in `lib/derive-modified-files` and is
// consumed by the controller's `deriveModifiedFiles` import.

/** Dev-only: subscribes to the debug-panel queue injection custom event. */
function useDebugQueueInjectionEffect(setQueued: Dispatch<SetStateAction<QueuedMessage[]>>): void {
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const handler = (e: Event) => {
      const items = (e as CustomEvent<{ items: { mode: "steer" | "followUp"; content: string }[] }>)
        .detail?.items;
      if (!Array.isArray(items)) return;
      const now = Date.now();
      setQueued((q) => [
        ...q,
        ...items.map((i) => ({
          id: createChatUid(),
          mode: i.mode,
          content: i.content,
          sentAt: now,
        })),
      ]);
    };
    window.addEventListener("afx:debug:inject-queue", handler);
    return () => window.removeEventListener("afx:debug:inject-queue", handler);
    // setQueued is a stable controller setter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

// Re-export to keep imports stable.
export type { AgentToChat, ReactNode };
