/**
 * Chat view — streaming message thread with composer, tool call display, and thinking blocks.
 *
 * @see docs/specs/210-app-chat/spec.md [FR-2] [FR-3] [FR-4] [FR-6] [FR-8]
 * @see docs/specs/210-app-chat/design.md [DES-UI]
 * @see docs/specs/210-app-chat/design.md [DES-UI-MOCKUP-HYDRATION]
 * @see docs/specs/211-app-chat-composer/spec.md [FR-1] [FR-2] [FR-10] [FR-11]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-MOCKUP-IDLE] [DES-COMPOSER-MOCKUP-RUNTIME-MENU] [DES-COMPOSER-MOCKUP-STREAMING] [DES-COMPOSER-MOCKUP-COMPACTING] [DES-COMPOSER-MOCKUP-MODE-COLLAPSED] [DES-COMPOSER-MOCKUP-MODE-DROPDOWN] [DES-COMPOSER-MOCKUP-BLOCKED-COMMAND] [DES-COMPOSER-FLOW] [DES-COMPOSER-FILES-STRIP] [DES-COMPOSER-CONTEXT] [DES-COMPOSER-RUNTIME] [DES-COMPOSER-COMPONENT-MODEL-COMBOBOX] [DES-COMPOSER-COMPONENT-MODE-TOGGLE] [DES-COMPOSER-COMPONENT-BLOCKED-COMMAND-STRIP]
 * @see docs/specs/212-app-chat-messages/spec.md [FR-1] [FR-2]
 * @see docs/specs/212-app-chat-messages/design.md [DES-MESSAGES-COMPONENTS] [DES-MESSAGES-EVENT-FLOW]
 * @see docs/specs/100-package-shared/spec.md [FR-7] [FR-9] [FR-10]
 * @see docs/specs/211-app-chat-composer/spec.md [FR-9] [FR-10] [FR-11] [FR-12] [FR-13]
 * @see docs/specs/214-app-chat-settings/spec.md [FR-5] [FR-6]
 */
import {
  type ChangeEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  AtSign,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Copy,
  CornerDownLeft,
  Cpu,
  ExternalLink,
  Info,
  Layers,
  LoaderCircle,
  MessageSquarePlus,
  PenLine,
  Plus,
  RefreshCw,
  Scissors,
  SlidersHorizontal,
  Square,
  Terminal,
  Trash2,
  UserRound,
  X,
  Zap,
} from "lucide-react";
import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui";

import type {
  ActiveFileContextSnapshot,
  AgentCommand,
  AgentFileView,
  AgentModel,
  AgentRuntimePhase,
  AgentRuntimeStatus,
  AgentStatus,
  ChatMessageView,
  ChatTimelineItem,
  ChatToolView,
  ThinkingLevel,
  WorkspaceMode,
} from "@afx/shared";
import { createCheckingAgentRuntimeStatus } from "@afx/shared";
import { Badge } from "@afx/ui/components/badge";
import { Button, buttonVariants } from "@afx/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
} from "@afx/ui/components/dropdown-menu";
import { InputGroup, InputGroupAddon, InputGroupTextarea } from "@afx/ui/components/input-group";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@afx/ui/components/tooltip";
import { cn } from "@afx/ui/lib/utils";

import { AfxLogoIcon, AfxLogoMark } from "../components/afx-logo";
import type { AgentRecoveryActions } from "../components/agent-recovery-card";
import { ComposerStrip } from "../components/composer-strip";
import { FilesStrip } from "../components/files-strip";
import { MarkdownMessage } from "../components/markdown-message";
import { MentionPopup } from "../components/mention-popup";
import { ModelCombobox } from "../components/model-combobox";
import { OutputCard } from "../components/output-card";
import { SlashPopup } from "../components/slash-popup";
import { toast } from "../components/toast";
import { bridgeGetState, bridgeOn, bridgeSend, bridgeSetState } from "../lib/bridge";
import type { ComposerTrigger } from "../lib/composer-detect";
import { detectComposerTrigger } from "../lib/composer-detect";
import { deriveModifiedFiles } from "../lib/derive-modified-files";
import { extractMentions } from "../lib/mentions";
import { analyzeDanger } from "../lib/system-command";
import { toolDescriptor } from "../lib/tool-descriptor";

// ---------------------------------------------------------------------------
// types
// ---------------------------------------------------------------------------

/**
 * Subset of AgentStatus fields that are relevant to runtime display.
 * Excludes model/endpoint details that are shown elsewhere.
 */
type RuntimeSettings = Pick<
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
>;

/**
 * Represents a queued message that was sent while the agent was streaming.
 * The engine handles actual queueing; this mirrors what we sent for display.
 */
interface QueuedMessage {
  /** Local display ID; the engine owns the authoritative queue. */
  id: string;
  /** "steer" interrupts mid-turn; "followUp" runs after the active turn. */
  mode: "steer" | "followUp";
  /** Truncated content for display. */
  content: string;
  sentAt: number;
}

/** Host-blocked shell command surfaced when Explore mode rejects a runCommand. */
interface BlockedActionView {
  requestId: string;
  command: string;
  title: string;
  message: string;
  mode: WorkspaceMode;
}

/**
 * Aggregated usage stats for a turn, including token breakdown, cost, and context usage.
 */
interface UsageStats {
  tokens: { input: number; output: number; cacheRead: number; cacheWrite: number; total: number };
  cost: number;
  contextUsage?: { tokens: number | null; contextWindow: number; percent: number | null };
}

/** Command output row rendered in the timeline. */
interface ChatCommandOutputView {
  requestId: string;
  command: string;
  stdout: string;
  stderr: string;
  exitCode?: number;
  error?: string;
  createdAt: number;
}

/** Ephemeral note confirmation rendered in the timeline. */
interface ChatNoteEventView {
  id: string;
  content: string;
  savedAt: number;
}

/** Cached chat surface state persisted through the webview transport. */
interface PersistedChatViewState {
  messages: ChatTimelineItem[];
  commandOutputs: ChatCommandOutputView[];
  noteEvents: ChatNoteEventView[];
}

/** Webview state persisted by VS Code so remounts can hydrate instantly. */
interface PersistedWebviewState {
  draft?: string;
  chatView?: PersistedChatViewState;
}

function readPersistedChatViewState(): PersistedChatViewState | null {
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

  if (messages.length === 0 && commandOutputs.length === 0 && noteEvents.length === 0) {
    return null;
  }

  return { messages, commandOutputs, noteEvents };
}

function persistChatViewState(next: PersistedChatViewState | null): void {
  const state = bridgeGetState();
  const base = state && typeof state === "object" ? (state as PersistedWebviewState) : {};

  if (next) {
    bridgeSetState({ ...base, chatView: next });
    return;
  }

  const { chatView: _chatView, ...rest } = base;
  bridgeSetState(rest);
}

// ---------------------------------------------------------------------------
// Chat (root)
// ---------------------------------------------------------------------------

/**
 * Props for the Chat root component.
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-1] [FR-2] [FR-10] [FR-11] [FR-12] [FR-13]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-RUNTIME] [DES-COMPOSER-MOCKUP-IDLE] [DES-COMPOSER-MOCKUP-RUNTIME-MENU] [DES-COMPOSER-MOCKUP-STREAMING] [DES-COMPOSER-MOCKUP-MODE-COLLAPSED] [DES-COMPOSER-MOCKUP-MODE-DROPDOWN] [DES-COMPOSER-MOCKUP-BLOCKED-COMMAND]
 */
export interface ChatProps {
  agentStatus?: AgentRuntimeStatus;
  recoveryActions?: AgentRecoveryActions;
  insertCommand?: string | null;
  isCheckingAgent?: boolean;
  onCommandInserted?: () => void;
  onOpenSettings?: () => void;
  /** Draft text — managed by the parent (App) so it persists across tab switches. */
  draft: string;
  /** Callback to update the draft text. Accepts a string or a functional updater (like React setState). */
  onDraftChange: (value: string | ((prev: string) => string)) => void;
  /** Recently submitted prompts, owned by App so model/runtime switches do not reset recall. */
  promptHistory: readonly string[];
  /** Records a submitted prompt for ArrowUp/ArrowDown composer recall. */
  onPromptHistoryAppend: (prompt: string) => void;
}

/**
 * Root chat component — orchestrates message thread, composer, slash commands, and status.
 *
 * State ownership:
 * - Messages, thinking, usage, models, commands, files, runtime — local React state
 * - Bridge events update state reactively; no direct DOM manipulation
 *
 * Keyboard handling:
 * - Enter submits (or steers/follow-up if streaming)
 * - Shift+Enter queues follow-up while streaming
 * - Slash/mention trigger handled by detectComposerTrigger
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-1] [FR-2] [FR-10] [FR-11] [FR-12] [FR-13]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-RUNTIME] [DES-COMPOSER-MOCKUP-IDLE] [DES-COMPOSER-MOCKUP-RUNTIME-MENU] [DES-COMPOSER-MOCKUP-STREAMING] [DES-COMPOSER-MOCKUP-MODE-COLLAPSED] [DES-COMPOSER-MOCKUP-MODE-DROPDOWN] [DES-COMPOSER-MOCKUP-BLOCKED-COMMAND]
 */
export default function Chat({
  agentStatus: externalAgentStatus,
  recoveryActions,
  insertCommand,
  isCheckingAgent = false,
  onCommandInserted,
  onOpenSettings,
  draft,
  onDraftChange,
  promptHistory,
  onPromptHistoryAppend,
}: ChatProps) {
  // ── message state ────────────────────────────────────────────────────────
  const [initialPersistedChatView] = useState(() => readPersistedChatViewState());
  const [messages, setMessages] = useState<ChatTimelineItem[]>(
    () => initialPersistedChatView?.messages ?? [],
  );
  // Remounts hydrate synchronously from cached transcript state when available.
  // Otherwise we keep the loading shell up until the first host snapshot lands so
  // we do not flash the empty welcome card.
  const [hasReceivedStateSnapshot, setHasReceivedStateSnapshot] = useState(
    () => initialPersistedChatView !== null,
  );
  const [thinking, setThinking] = useState<string | null>(null);
  const [usage, setUsage] = useState<UsageStats | null>(null);
  const [includeActiveFileContext, setIncludeActiveFileContext] = useState(true);
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>("code");
  const [activeFileContext, setActiveFileContext] = useState<ActiveFileContextSnapshot | null>(
    null,
  );
  /**
   * Tracks the latest mode the user asked for so late host snapshots cannot
   * rewind the composer back to an older posture.
   */
  const pendingWorkspaceModeRef = useRef<WorkspaceMode | null>(null);

  // ── agent status state ────────────────────────────────────────────────────
  // Internal status used when external status is not provided (e.g., no runtime).
  const [internalAgentStatus, setInternalAgentStatus] = useState<AgentRuntimeStatus>(
    externalAgentStatus ?? createCheckingAgentRuntimeStatus(),
  );
  const [runtime, setRuntime] = useState<RuntimeSettings>({});

  // ── metadata state ────────────────────────────────────────────────────────
  const [models, setModels] = useState<AgentModel[]>([]);
  const [commands, setCommands] = useState<AgentCommand[]>([]);
  const [files, setFiles] = useState<AgentFileView[]>([]);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [queued, setQueued] = useState<QueuedMessage[]>([]);
  const [blockedAction, setBlockedAction] = useState<BlockedActionView | null>(null);
  /**
   * ID of the assistant message at which the user dismissed the modified-files
   * strip. Strip stays hidden until a *later* assistant message produces an
   * edit/write tool call.
   *
   * @see docs/specs/211-app-chat-composer/spec.md [FR-10]
   * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-FILES-STRIP]
   */
  const [dismissedAtAssistantMessageId, setDismissedAtAssistantMessageId] = useState<string | null>(
    null,
  );
  const [slashOpen, setSlashOpen] = useState(false);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [activeTrigger, setActiveTrigger] = useState<ComposerTrigger | null>(null);
  const [userScrolledUp, setUserScrolledUp] = useState(false);
  // Ephemeral note events (Cmd+Enter saves) — not persisted across reloads.
  const [noteEvents, setNoteEvents] = useState<ChatNoteEventView[]>(
    () => initialPersistedChatView?.noteEvents ?? [],
  );

  // ── command output state ─────────────────────────────────────────────────
  /** Completed + active command outputs rendered in the timeline. */
  const [commandOutputs, setCommandOutputs] = useState<ChatCommandOutputView[]>(
    () => initialPersistedChatView?.commandOutputs ?? [],
  );

  // ── composer state — lifted to App for persistence across tab switches ──
  // draft and onDraftChange are passed from App

  // ── refs ─────────────────────────────────────────────────────────────────
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLDivElement | null>(null);
  // Prevents double-inserting the same command (handles React 18 StrictMode double-effect).
  const insertedCommandRef = useRef<string | null>(null);
  const historyCursorRef = useRef<number | null>(null);
  const draftBeforeHistoryRef = useRef("");
  /** RequestId of a dangerous command awaiting user confirmation. */
  const pendingDangerousRef = useRef<{ requestId: string; command: string } | null>(null);
  /** Tracks the command string for the active runCommand so output cards can show it. */
  const activeCommandRef = useRef<{ requestId: string; command: string } | null>(null);

  // ── derived state ────────────────────────────────────────────────────────
  const agentStatus = externalAgentStatus ?? internalAgentStatus;
  const isStreaming = agentStatus.isStreaming;
  const runtimeUnavailable = agentStatus.phase === "disconnected" || agentStatus.phase === "error";
  const runtimeUnconfigured = agentStatus.runtimeConfigured === false;
  const rpcEnabled = runtime.rpcEnabled === true || agentStatus.rpcEnabled === true;
  const isCompacting = runtime.isCompacting === true;
  // The strip stays visible whenever the user has anything queued locally; the
  // dismiss / clear-all controls handle stale items if the engine drains them.
  const visibleQueued = queued;
  // Modified files strip: derived from transcript tool calls. Strip stays hidden
  // until a NEW assistant message produces an edit/write tool call after the user
  // dismisses it.
  // @see docs/specs/211-app-chat-composer/spec.md [FR-10]
  // @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-FILES-STRIP]
  const { files: modifiedFiles, latestEditingAssistantMessageId } = useMemo(
    () => deriveModifiedFiles(messages),
    [messages],
  );
  const filesStripVisible =
    modifiedFiles.length > 0 &&
    latestEditingAssistantMessageId !== null &&
    latestEditingAssistantMessageId !== dismissedAtAssistantMessageId;
  const handleDismissModifiedFiles = useCallback(() => {
    setDismissedAtAssistantMessageId(latestEditingAssistantMessageId);
  }, [latestEditingAssistantMessageId]);
  const handleOpenModifiedFile = useCallback((p: string, line?: number) => {
    bridgeSend({ type: "chat/openFile", path: p, line });
  }, []);
  const isExploreMode = workspaceMode === "explore";
  const activeFileDisplayName = activeFileContext?.name ?? "No active file";
  const activeFileDisplayPath = activeFileContext?.path ?? "No active editor file";
  /** True when the draft starts with "!" — shows the shell badge and warning footer. */
  const isSystemCommand = draft.startsWith("!");
  const isComposerDisabled =
    isCheckingAgent || isCompacting || (!isSystemCommand && runtimeUnavailable);
  const composerPlaceholder = getComposerPlaceholder({
    isCheckingAgent,
    runtimeUnconfigured,
    rpcEnabled,
    runtimeUnavailable,
    isCompacting,
    isStreaming,
    workspaceMode,
  });

  // ── scroll ────────────────────────────────────────────────────────────────
  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    bottomRef.current?.scrollIntoView({ behavior, block: "end" });
  }, []);

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    setUserScrolledUp(!atBottom);
  }, []);

  useEffect(() => {
    if (!userScrolledUp) scrollToBottom("instant");
  }, [messages, userScrolledUp, scrollToBottom]);

  // ── focus ─────────────────────────────────────────────────────────────────
  /** Returns the textarea element inside the composer. */
  function getTextarea(): HTMLTextAreaElement | null {
    return composerRef.current?.querySelector("textarea") ?? null;
  }

  /**
   * Reconciles the local queue mirror with the runtime's authoritative pending count.
   * The runtime reports consumption after queued steers/follow-ups are sent, so the
   * composer can clear rows without relying on manual dismiss/clear affordances.
   *
   * @see docs/specs/211-app-chat-composer/spec.md [FR-4]
   * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-QUEUE] [DES-COMPOSER-FLOW]
   */
  function reconcileQueuedFromRuntime(pendingMessageCount: number | undefined) {
    if (typeof pendingMessageCount !== "number") return;
    const normalizedCount = Math.max(0, pendingMessageCount);
    setQueued((q) => (q.length <= normalizedCount ? q : q.slice(q.length - normalizedCount)));
  }

  function acceptHostWorkspaceMode(mode: WorkspaceMode): boolean {
    if (pendingWorkspaceModeRef.current && pendingWorkspaceModeRef.current !== mode) return false;
    if (pendingWorkspaceModeRef.current === mode) pendingWorkspaceModeRef.current = null;
    setWorkspaceMode(mode);
    return true;
  }

  useEffect(() => {
    if (!isCheckingAgent && !isStreaming) {
      const active = document.activeElement as HTMLElement | null;
      if (!active || active === document.body || composerRef.current?.contains(active)) {
        getTextarea()?.focus();
      }
    }
  }, [isCheckingAgent, isStreaming]);

  // ── command insertion ───────────────────────────────────────────────────────
  /** Handles insertCommand prop — inserts a command (e.g., from sidebar) into the composer. */
  useEffect(() => {
    if (!insertCommand) {
      insertedCommandRef.current = null;
      return;
    }
    if (insertedCommandRef.current === insertCommand) return;
    insertedCommandRef.current = insertCommand;
    queueMicrotask(() => {
      onDraftChange((prev) =>
        prev.trim().length > 0 ? `${prev.trimEnd()} ${insertCommand} ` : `${insertCommand} `,
      );
      setSlashOpen(false);
      setMentionOpen(false);
      window.requestAnimationFrame(() => getTextarea()?.focus());
      onCommandInserted?.();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onDraftChange is stable (useCallback in App)
  }, [insertCommand, onCommandInserted]);

  const setCompactionActive = useCallback((isActive: boolean): void => {
    setRuntime((current) => ({ ...current, isCompacting: isActive }));
  }, []);

  const completeCompaction = useCallback((): void => {
    setQueued([]);
    setCompactionActive(false);
    setInternalAgentStatus((current) => ({
      ...current,
      phase: current.running ? "ready" : current.phase,
      isStreaming: false,
    }));
    setThinking(null);
    toast.success("Session compacted", "History compacted into a summary.");
  }, [setCompactionActive]);

  // ── bridge events ──────────────────────────────────────────────────────────
  useEffect(() => {
    const offs = [
      // State sync — full message/streaming state from host.
      bridgeOn("chat/state", (msg) => {
        setHasReceivedStateSnapshot(true);
        setMessages(msg.messages);
        setInternalAgentStatus((p) => ({
          ...p,
          phase: msg.isStreaming ? "busy" : p.phase,
          isStreaming: msg.isStreaming,
        }));
      }),

      // New message start — creates a placeholder in the timeline.
      // Guard against duplicate ids (replay on reconnect).
      bridgeOn("chat/messageStart", (msg) => {
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
        // New assistant turn — reset thinking.
        if (msg.role === "assistant") setThinking(null);
      }),

      // Text delta — appends to the assistant message content.
      bridgeOn("chat/messageDelta", (msg) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msg.id && "content" in m ? { ...m, content: m.content + msg.delta } : m,
          ),
        );
      }),

      // Thinking delta — accumulates in the ActivityBar and live thinking row.
      bridgeOn("chat/thinkingDelta", (msg) => {
        setThinking((prev) => (prev ?? "") + msg.delta);
      }),

      // Message end — marks streaming=false, clears thinking.
      bridgeOn("chat/messageEnd", (msg) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msg.id ? { ...m, streaming: false, stopReason: msg.stopReason } : m,
          ),
        );
        setThinking(null);
      }),

      // Tool call start — attaches a running tool to the most recent assistant message.
      bridgeOn("chat/toolStart", (msg) => {
        const args = msg.args as Record<string, unknown> | undefined;
        setMessages((prev) => {
          const copy = [...prev];
          // Attach tool to last assistant message.
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

      // Tool call end — updates tool status to ok/error with summary.
      bridgeOn("chat/toolEnd", (msg) => {
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

      // Agent status updates — keeps status bar and activity bar in sync.
      bridgeOn("agent/status", (msg) => {
        setInternalAgentStatus(msg.status);
        if (!msg.status.isStreaming) setThinking(null);
      }),

      // Usage stats — updates both the activity bar (live) and message metadata.
      bridgeOn("chat/usage", (msg) => {
        const usageValue = { tokens: msg.tokens, cost: msg.cost, contextUsage: msg.contextUsage };
        setUsage(usageValue);
        // Attach usage to the specific message if we have its ID.
        if (msg.messageId) {
          setMessages((prev) =>
            prev.map((m) => (m.id === msg.messageId ? { ...m, usage: usageValue } : m)),
          );
        }
      }),

      // Error — shows an error message and resets streaming state.
      bridgeOn("chat/error", (msg) => {
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
          { id: uid(), role: "assistant", content: `⚠ ${msg.message}`, createdAt: Date.now() },
        ]);
      }),

      // Abort — graceful stop, clears streaming state.
      bridgeOn("chat/aborted", () => {
        setInternalAgentStatus((p) => ({
          ...p,
          phase: p.running ? "ready" : p.phase,
          isStreaming: false,
        }));
        setThinking(null);
        // Sweep any tool calls still in `running` state — when the user aborts
        // mid-turn, pi-mono does not synthesize a `tool_execution_end` for the
        // in-flight tool. Without this sweep the FilesStrip pulse animation
        // would tick forever. Mark them `error` so the dot stops pulsing and
        // the user sees the canceled state.
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

      // Model list — populates the model selector.
      bridgeOn("agent/models", (msg) => {
        setModels(msg.models);
      }),

      // Model changed — updates the model list and active model.
      bridgeOn("agent/modelChanged", (msg) => {
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

      // Commands — populates the slash command popup.
      bridgeOn("agent/commands", (msg) => {
        setCommands(msg.commands);
      }),

      // Settings snapshot — mirrors the active-file context default from the host.
      bridgeOn("agent/settingsSnapshot", (msg) => {
        setIncludeActiveFileContext(msg.snapshot.context?.includeActiveFileContext ?? true);
        acceptHostWorkspaceMode(msg.snapshot.mode?.active ?? "code");
      }),

      // Blocked actions — surfaces host-side guardrails when Explore rejects a command.
      bridgeOn("agent/actionBlocked", (msg) => {
        if (!acceptHostWorkspaceMode(msg.mode)) return;
        setBlockedAction({
          requestId: msg.requestId ?? uid(),
          command: msg.command?.trim() ?? "",
          title: msg.title,
          message: msg.message,
          mode: msg.mode,
        });
      }),

      // Active-file context — keeps the composer label synced with the current editor file.
      bridgeOn("agent/activeFileContext", (msg) => {
        setActiveFileContext(msg.snapshot);
      }),

      // Files — populates the mention picker.
      bridgeOn("agent/files", (msg) => {
        setFiles(msg.files);
      }),

      // Runtime settings — thinking level, queue modes, compaction, retry.
      bridgeOn("agent/runtimeSettings", (msg) => {
        setRuntime(msg.settings);
        reconcileQueuedFromRuntime(msg.settings.pendingMessageCount);
      }),

      // Compaction — clears the queue and shows a compact confirmation.
      bridgeOn("agent/compacted", completeCompaction),

      // Command output — accumulates streaming stdout/stderr from shell commands.
      bridgeOn("agent/commandOutput", (msg) => {
        setCommandOutputs((prev) => {
          const idx = prev.findIndex((o) => o.requestId === msg.requestId);
          if (idx === -1) {
            // First event for this request (or done-only for silent commands)
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

      // Dangerous command confirmation — executes the pending command if user confirmed.
      bridgeOn("agent/dangerousConfirmed", (msg) => {
        if (pendingDangerousRef.current?.requestId === msg.requestId) {
          const { command } = pendingDangerousRef.current;
          pendingDangerousRef.current = null;
          if (msg.confirmed) {
            bridgeSend({ type: "chat/runCommand", requestId: msg.requestId, command });
          }
        }
      }),
    ];

    // Re-hydrate from the host on mount (e.g., tab switch).
    bridgeSend({ type: "chat/getState" });
    bridgeSend({ type: "chat/getModels", requestId: uid() });
    bridgeSend({ type: "chat/getCommands", requestId: uid() });
    bridgeSend({ type: "chat/getSettingsSnapshot", requestId: uid() });

    return () => offs.forEach((off) => off());
  }, [completeCompaction]);

  // Keep the last visible chat surface in webview state so remounts can
  // hydrate directly into the transcript instead of flashing the welcome card.
  useEffect(() => {
    const hasTimelineContent =
      messages.length > 0 || commandOutputs.length > 0 || noteEvents.length > 0;
    if (!hasReceivedStateSnapshot && !hasTimelineContent) return;

    persistChatViewState(
      hasTimelineContent
        ? {
            messages,
            commandOutputs,
            noteEvents,
          }
        : null,
    );
  }, [commandOutputs, hasReceivedStateSnapshot, messages, noteEvents]);

  // DEV-only: lets the debug panel pre-populate the QueueStrip for design
  // iteration without manually queueing items each time. Production builds
  // never dispatch this event.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const handler = (e: Event) => {
      const items = (e as CustomEvent<{ items: { mode: "steer" | "followUp"; content: string }[] }>)
        .detail?.items;
      if (!Array.isArray(items)) return;
      const now = Date.now();
      setQueued((q) => [
        ...q,
        ...items.map((i) => ({ id: uid(), mode: i.mode, content: i.content, sentAt: now })),
      ]);
    };
    window.addEventListener("afx:debug:inject-queue", handler);
    return () => window.removeEventListener("afx:debug:inject-queue", handler);
  }, []);

  // ── actions ────────────────────────────────────────────────────────────────
  /** Returns true if the composer has content and the agent is ready to receive input. */
  const hasDraft = draft.trim().length > 0;
  const canSend = hasDraft && !isComposerDisabled;

  /**
   * Handles draft changes and triggers slash/mention popups.
   * Uses detectComposerTrigger to find if cursor is after a "/" or "@".
   *
   * @see docs/specs/211-app-chat-composer/spec.md [FR-3]
   * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-HELPERS] [DES-COMPOSER-KEYS]
   */
  function handleDraftChange(e: ChangeEvent<HTMLTextAreaElement>) {
    const next = e.currentTarget.value;
    const caret = e.currentTarget.selectionStart ?? next.length;
    historyCursorRef.current = null;
    draftBeforeHistoryRef.current = "";
    onDraftChange(next);
    const trigger = detectComposerTrigger(next, caret);
    setActiveTrigger(trigger);
    setSlashOpen(trigger?.kind === "slash");
    setMentionOpen(trigger?.kind === "mention");
    if (trigger?.kind === "mention") {
      bridgeSend({ type: "chat/listFiles", requestId: uid(), limit: 200 });
    }
  }

  /**
   * Submits the draft. If idle, sends a new turn. If streaming, queues as steer or follow-up.
   * System commands (!prefix) bypass the LLM and execute locally.
   *
   * @see docs/specs/211-app-chat-composer/spec.md [FR-1] [FR-4] [FR-8] [FR-9]
   * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-FLOW] [DES-COMPOSER-QUEUE] [DES-COMPOSER-SYSTEM-COMMAND]
   */
  function submit(opts?: { followUp?: boolean }) {
    const trimmed = draft.trim();
    const isCommandDraft = trimmed.startsWith("!");
    if (
      trimmed.length === 0 ||
      (isCommandDraft ? isCheckingAgent || isCompacting : isComposerDisabled)
    )
      return;
    onDraftChange("");
    setSlashOpen(false);
    setMentionOpen(false);
    setUserScrolledUp(false);
    historyCursorRef.current = null;
    draftBeforeHistoryRef.current = "";

    // System command: bypass LLM entirely
    if (isCommandDraft) {
      const command = trimmed.slice(1).trimStart();
      if (command.length === 0) return;
      // New command: add empty slot that will be filled by streaming events

      if (isExploreMode) {
        const requestId = uid();
        activeCommandRef.current = { requestId, command };
        bridgeSend({ type: "chat/runCommand", requestId, command });
        getTextarea()?.focus();
        return;
      }

      // Dangerous pattern guard — request confirmation before executing
      const danger = analyzeDanger(command);
      if (danger.isDangerous) {
        const requestId = uid();
        pendingDangerousRef.current = { requestId, command };
        activeCommandRef.current = { requestId, command };
        bridgeSend({ type: "chat/confirmDangerous", requestId, command, reason: danger.reason });
        getTextarea()?.focus();
        return;
      }

      const requestId = uid();
      activeCommandRef.current = { requestId, command };
      bridgeSend({ type: "chat/runCommand", requestId, command });
      getTextarea()?.focus();
      return;
    }

    // Normal message path
    const mentions = extractMentions(trimmed);
    const mentionsArg = mentions.length > 0 ? mentions : undefined;
    onPromptHistoryAppend(trimmed);

    if (!isStreaming) {
      bridgeSend({
        type: "chat/send",
        requestId: uid(),
        content: trimmed,
        mentions: mentionsArg,
      });
    } else {
      const mode: QueuedMessage["mode"] = opts?.followUp ? "followUp" : "steer";
      bridgeSend({
        type: mode === "steer" ? "chat/steer" : "chat/followUp",
        requestId: uid(),
        content: trimmed,
        mentions: mentionsArg,
      });
      setQueued((q) => [...q, { id: uid(), mode, content: trimmed, sentAt: Date.now() }]);
    }
    getTextarea()?.focus();
  }

  function startCompact() {
    if (isCompacting) return;
    setCompactionActive(true);
    bridgeSend({ type: "chat/compact", requestId: uid() });
    toast.info("Compacting session…");
  }

  function setThinkingLevel(level: ThinkingLevel) {
    setRuntime((r) => ({ ...r, thinkingLevel: level }));
    bridgeSend({ type: "chat/setThinkingLevel", requestId: uid(), level });
  }

  function toggleIncludeActiveFileContext() {
    const next = !includeActiveFileContext;
    setIncludeActiveFileContext(next);
    bridgeSend({
      type: "chat/setIncludeActiveFileContext",
      requestId: uid(),
      enabled: next,
    });
    getTextarea()?.focus();
  }

  function setMode(mode: WorkspaceMode) {
    pendingWorkspaceModeRef.current = mode;
    if (workspaceMode !== mode) {
      setWorkspaceMode(mode);
    }
    bridgeSend({ type: "chat/setMode", requestId: uid(), mode });
  }

  function restoreBlockedCommand(): void {
    if (!blockedAction) return;
    const restored = `! ${blockedAction.command}`.trim();
    onDraftChange(restored);
    setBlockedAction(null);
    setMode("code");
    window.requestAnimationFrame(() => getTextarea()?.focus());
  }

  async function copyBlockedCommand(): Promise<void> {
    if (!blockedAction) return;
    const text = `! ${blockedAction.command}`.trim();
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Command copied");
    } catch {
      toast.error("Copy failed", "Could not copy the blocked command.");
    }
  }

  function dismissQueued(id: string) {
    setQueued((q) => q.filter((m) => m.id !== id));
  }

  function clearAllQueued() {
    setQueued([]);
  }

  function abort() {
    if (!isStreaming) return;
    bridgeSend({ type: "chat/abort" });
    getTextarea()?.focus();
  }

  /**
   * Saves the current composer draft as a note and renders an ephemeral timeline confirmation.
   *
   * @see docs/specs/215-app-chat-notes/spec.md [FR-1] [FR-2]
   * @see docs/specs/215-app-chat-notes/design.md [DES-NOTES-MOCKUP-CHAT] [DES-NOTES-FLOW]
   */
  function saveAsNote() {
    const trimmed = draft.trim();
    if (trimmed.length === 0) return;
    onDraftChange("");
    setSlashOpen(false);
    setMentionOpen(false);
    bridgeSend({ type: "chat/saveNote", content: trimmed });
    setNoteEvents((prev) => [...prev, { id: uid(), content: trimmed, savedAt: Date.now() }]);
  }

  /**
   * Routes keyboard events for the composer textarea.
   * When a slash/mention popup is open, delegates navigation to cmdk.
   *
   * @see docs/specs/211-app-chat-composer/spec.md [FR-1] [FR-3] [FR-6]
   * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-KEYS] [DES-COMPOSER-HELPERS]
   */
  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (slashOpen || mentionOpen) {
      if (e.key === "Escape") {
        e.preventDefault();
        setSlashOpen(false);
        setMentionOpen(false);
        return;
      }
      if (
        e.key === "ArrowDown" ||
        e.key === "ArrowUp" ||
        e.key === "Home" ||
        e.key === "End" ||
        // Plain Enter selects the highlighted item; Shift+Enter or Cmd/Ctrl+Enter submits.
        (e.key === "Enter" && !e.shiftKey && !(e.metaKey || e.ctrlKey))
      ) {
        const root = document.querySelector("[cmdk-root]");
        if (root) {
          e.preventDefault();
          root.dispatchEvent(
            new KeyboardEvent("keydown", {
              key: e.key,
              code: e.code,
              bubbles: true,
              cancelable: true,
            }),
          );
          return;
        }
      }
    }
    if (
      (e.key === "ArrowUp" || e.key === "ArrowDown") &&
      navigatePromptHistory(e.currentTarget, e.key === "ArrowUp" ? "previous" : "next")
    ) {
      e.preventDefault();
      return;
    }
    // Cmd/Ctrl+Shift+Enter saves draft as a note (no agent send).
    // Idle:      Enter sends; Shift+Enter inserts newline; Cmd/Ctrl+Enter also sends (compat).
    // Streaming: Enter queues a follow-up (polite); Cmd/Ctrl+Enter steers (interrupts).
    if (e.key === "Enter") {
      if (e.shiftKey && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        saveAsNote();
        return;
      }
      if (e.shiftKey) return; // newline — let the textarea handle it
      e.preventDefault();
      const isInterrupt = e.metaKey || e.ctrlKey;
      submit({ followUp: isStreaming && !isInterrupt });
    }
  }

  function navigatePromptHistory(
    textarea: HTMLTextAreaElement,
    direction: "previous" | "next",
  ): boolean {
    const history = collectPromptHistory(messages, promptHistory);
    if (history.length === 0) return false;

    const selectionStart = textarea.selectionStart ?? draft.length;
    const selectionEnd = textarea.selectionEnd ?? draft.length;
    if (direction === "previous") {
      const current = historyCursorRef.current;
      if (current === null && (selectionStart !== 0 || selectionEnd !== 0)) return false;
      if (current === null) {
        draftBeforeHistoryRef.current = draft;
        historyCursorRef.current = history.length - 1;
      } else {
        historyCursorRef.current = Math.max(0, current - 1);
      }
      applyHistoryDraft(history[historyCursorRef.current] ?? "");
      return true;
    }

    if (historyCursorRef.current === null) return false;
    if (selectionStart !== draft.length || selectionEnd !== draft.length) return false;
    if (historyCursorRef.current < history.length - 1) {
      historyCursorRef.current += 1;
      applyHistoryDraft(history[historyCursorRef.current] ?? "");
      return true;
    }
    historyCursorRef.current = null;
    applyHistoryDraft(draftBeforeHistoryRef.current);
    draftBeforeHistoryRef.current = "";
    return true;
  }

  function applyHistoryDraft(value: string): void {
    onDraftChange(value);
    window.requestAnimationFrame(() => {
      const input = getTextarea();
      const end = value.length;
      input?.focus();
      input?.setSelectionRange(end, end);
    });
  }

  /** Replaces the trigger prefix + query with a value and positions the caret after it. */
  function insertAtTrigger(value: string) {
    const textarea = getTextarea();
    const caret = textarea?.selectionStart ?? draft.length;
    const trigger = activeTrigger;
    const start = trigger?.start ?? caret;
    const replaceEnd = trigger ? start + 1 + trigger.query.length : caret;
    const next = `${draft.slice(0, start)}${value} ${draft.slice(replaceEnd)}`;
    onDraftChange(next);
    setSlashOpen(false);
    setMentionOpen(false);
    window.requestAnimationFrame(() => {
      const input = getTextarea();
      input?.focus();
      const nextCaret = start + value.length + 1;
      input?.setSelectionRange(nextCaret, nextCaret);
    });
  }

  function selectCommand(commandText: string) {
    insertAtTrigger(commandText);
  }

  /**
   * Clears the trigger and dispatches a slash action (/new, /abort) instead of inserting text.
   *
   * @see docs/specs/211-app-chat-composer/spec.md [FR-3] [FR-8]
   * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-HELPERS] [DES-COMPOSER-FLOW]
   */
  function selectSlashAction(action: "chat/newSession" | "chat/abort") {
    const trigger = activeTrigger;
    if (trigger) {
      const replaceEnd = trigger.start + 1 + trigger.query.length;
      onDraftChange((d) => `${d.slice(0, trigger.start)}${d.slice(replaceEnd)}`);
    }
    setSlashOpen(false);
    setMentionOpen(false);
    setActiveTrigger(null);
    bridgeSend({ type: action });
    window.requestAnimationFrame(() => getTextarea()?.focus());
  }

  function startNewSession() {
    bridgeSend({ type: "chat/newSession" });
    onDraftChange("");
    setQueued([]);
    setCommandOutputs([]);
    setUserScrolledUp(false);
    toast.success("New session started");
  }

  function selectMention(filePath: string) {
    insertAtTrigger(`@${filePath}`);
  }

  /**
   * Opens the mention helper from the toolbar and requests workspace file candidates.
   *
   * @see docs/specs/211-app-chat-composer/spec.md [FR-3]
   * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-HELPERS]
   */
  function openMentionPicker() {
    setActiveTrigger({ kind: "mention", start: draft.length, query: "" });
    setMentionOpen(true);
    setSlashOpen(false);
    bridgeSend({ type: "chat/listFiles", requestId: uid(), limit: 200 });
  }

  /**
   * Selects a composer model and keeps focus in the textarea for the next turn.
   *
   * @see docs/specs/211-app-chat-composer/spec.md [FR-5]
   * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-RUNTIME] [DES-COMPOSER-FLOW]
   */
  function selectModel(model: AgentModel) {
    bridgeSend({
      type: "chat/setModel",
      requestId: uid(),
      provider: model.provider,
      modelId: model.id,
      instanceId: model.instanceId,
    });
    historyCursorRef.current = null;
    draftBeforeHistoryRef.current = "";
    window.requestAnimationFrame(() => getTextarea()?.focus());
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
      {/* Status bar — dot indicator + action buttons */}
      <StatusBar
        checking={isCheckingAgent}
        status={agentStatus}
        runtime={runtime}
        onNewSession={startNewSession}
        onCompact={startCompact}
        onContextSave={() => {
          onDraftChange("/afx-context save");
        }}
        onRestartAgent={recoveryActions?.onRestartAgent}
      />

      {/* Message thread — native scroll with jump-to-bottom button */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="afx-surface-subtle flex-1 min-h-0 overflow-y-auto overflow-x-hidden scroll-smooth [scrollbar-width:thin] [scrollbar-color:var(--border)_transparent]"
      >
        <div className="px-2 py-3">
          {messages.length > 0 || commandOutputs.length > 0 || noteEvents.length > 0 ? (
            <Timeline messages={messages} noteEvents={noteEvents} commandOutputs={commandOutputs} />
          ) : !hasReceivedStateSnapshot ? (
            <AgentSetupState />
          ) : (
            <EmptyState
              runtimeUnconfigured={runtimeUnconfigured}
              rpcEnabled={rpcEnabled}
              onOpenSettings={onOpenSettings}
              onInsert={(text) => {
                onDraftChange(text);
                composerRef.current?.querySelector<HTMLTextAreaElement>("textarea")?.focus();
              }}
            />
          )}
          <div ref={bottomRef} className="h-3 shrink-0" />
        </div>
      </div>

      {/* Jump-to-bottom button — shown when user scrolled up during streaming */}
      {userScrolledUp && (
        <div className="relative">
          <div className="absolute -top-9 left-1/2 z-10 -translate-x-1/2">
            <Button
              size="icon"
              variant="secondary"
              onClick={() => {
                setUserScrolledUp(false);
                scrollToBottom("smooth");
              }}
              className="h-7 w-7 rounded-full shadow-md"
              aria-label="Scroll to bottom"
            >
              <ArrowDown size={12} />
            </Button>
          </div>
        </div>
      )}

      {/* Surface: [Composer.Activity] — always-on status strip above the composer */}
      <ActivityBar
        thinking={thinking}
        isStreaming={isStreaming}
        isSystemCommand={isSystemCommand}
      />

      {/* Surface: [Composer.Root] — textarea, helpers, model selector, send/abort, footer */}
      <div className="shrink-0 px-2 pb-3 pt-2">
        <div ref={composerRef}>
          {/* Surface: [Composer.Helpers] */}
          <SlashPopup
            open={slashOpen}
            commands={commands}
            onOpenChange={setSlashOpen}
            onSelect={selectCommand}
            onAction={selectSlashAction}
          />
          <MentionPopup
            open={mentionOpen}
            files={files}
            onOpenChange={setMentionOpen}
            onSelect={selectMention}
          />
          {/* Surface: [Composer.ModifiedFiles] */}
          {filesStripVisible && (
            <FilesStrip
              files={modifiedFiles}
              onOpenFile={handleOpenModifiedFile}
              onDismiss={handleDismissModifiedFiles}
            />
          )}
          {/* Surface: [Composer.Queue] */}
          <QueueStrip
            queued={visibleQueued}
            onDismiss={dismissQueued}
            onClearAll={clearAllQueued}
          />
          {blockedAction && (
            <BlockedCommandStrip
              action={blockedAction}
              onSwitchToCode={restoreBlockedCommand}
              onCopyCommand={copyBlockedCommand}
              onDismiss={() => setBlockedAction(null)}
            />
          )}
          <InputGroup className="afx-surface-composer @container h-auto flex-col items-stretch">
            {/* Surface: [Composer.Input] */}
            <InputGroupTextarea
              id="afx-chat-composer"
              value={draft}
              onChange={handleDraftChange}
              onKeyDown={onKeyDown}
              placeholder={composerPlaceholder}
              disabled={isComposerDisabled}
              rows={1}
              className="min-h-14 max-h-56"
            />
            {isSystemCommand && (
              <div className="px-3 py-1 text-[10px] text-amber-500/80">
                ⚠ Shell · output is local only
              </div>
            )}
            <InputGroupAddon align="block-end" className="flex-wrap justify-between gap-1">
              {/* Surface: [Composer.Toolbar] */}
              <TooltipProvider>
                <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
                  {isSystemCommand ? (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded bg-amber-500/20 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider text-amber-500">
                      Shell
                    </span>
                  ) : (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))}
                          onClick={openMentionPicker}
                          disabled={isComposerDisabled}
                          aria-label="Mention file"
                        >
                          <AtSign />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" align="start" className="max-w-xs text-left">
                        Mention a file in the workspace. Use it to insert the current editor file or
                        pick another file to reference in your message.
                      </TooltipContent>
                    </Tooltip>
                  )}
                  <ModelCombobox
                    models={models}
                    value={agentStatus.model}
                    thinkingLevel={runtime.thinkingLevel}
                    disabled={isComposerDisabled}
                    onSelect={selectModel}
                    onSelectThinkingLevel={setThinkingLevel}
                    onOpenSettings={onOpenSettings}
                  />
                  <span
                    aria-hidden="true"
                    className="px-0.5 font-mono text-[10px] text-muted-foreground/60"
                  >
                    |
                  </span>
                  <ModeToggle mode={workspaceMode} onChange={setMode} />
                  <ActiveFileContextToggle
                    enabled={includeActiveFileContext}
                    fileName={activeFileDisplayName}
                    filePath={activeFileDisplayPath}
                    onToggle={toggleIncludeActiveFileContext}
                  />
                </div>
              </TooltipProvider>
              {/* Surface: [Composer.Actions] */}
              <div className="ml-auto flex shrink-0 items-center gap-1">
                {isStreaming ? (
                  <>
                    {canSend && (
                      <>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => submit({ followUp: true })}
                          onMouseDown={(e) => e.preventDefault()}
                          aria-label="Queue follow-up"
                          title="Queue this message to run after the active turn (Enter)"
                          className="h-7 gap-1 px-1.5 text-[11px]"
                        >
                          <Plus className="size-3.5" />
                          <span>Follow-up</span>
                          <span className="rounded-sm border border-current/20 px-1 font-mono text-[9px] leading-4 opacity-75">
                            ⏎
                          </span>
                        </Button>
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => submit({ followUp: false })}
                          onMouseDown={(e) => e.preventDefault()}
                          aria-label="Steer turn"
                          title="Interrupt the active turn and redirect with this message (Command/Ctrl+Enter)"
                          className="h-7 gap-1 px-1.5 text-[11px]"
                        >
                          <Zap className="size-3.5" />
                          <span>Steer</span>
                          <span className="rounded-sm border border-current/20 px-1 font-mono text-[9px] leading-4 opacity-75">
                            ⌘⏎
                          </span>
                        </Button>
                      </>
                    )}
                    <Button
                      size="icon-sm"
                      variant="destructive"
                      onClick={abort}
                      onMouseDown={(e) => e.preventDefault()}
                      aria-label="Stop"
                      title="Stop the active turn"
                    >
                      <Square />
                    </Button>
                  </>
                ) : (
                  <Button
                    size="icon-sm"
                    variant={canSend ? "default" : "secondary"}
                    onClick={() => submit()}
                    onMouseDown={(e) => e.preventDefault()}
                    disabled={!canSend}
                    aria-label="Send"
                    title="Send (⏎)"
                  >
                    <ArrowUp />
                  </Button>
                )}
              </div>
            </InputGroupAddon>
          </InputGroup>
        </div>
        {/* Surface: [Composer.Footer] */}
        <FooterStrip
          usage={usage}
          isCheckingAgent={isCheckingAgent}
          runtimeUnavailable={runtimeUnavailable}
          runtimeUnconfigured={runtimeUnconfigured}
          isStreaming={isStreaming}
          rpcEnabled={rpcEnabled}
          agentPhase={agentStatus.phase}
          onPiWarningClick={recoveryActions?.onOpenSettings}
          isSystemCommand={isSystemCommand}
          workspaceMode={workspaceMode}
        />
      </div>
    </div>
  );
}

/**
 * Builds state-aware composer placeholder copy without nesting UI conditionals.
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-1] [FR-2]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-FOOTER] [DES-COMPOSER-MOCKUP-COMPACTING]
 */
function getComposerPlaceholder({
  isCheckingAgent,
  runtimeUnconfigured,
  rpcEnabled,
  runtimeUnavailable,
  isCompacting,
  isStreaming,
  workspaceMode,
}: {
  isCheckingAgent: boolean;
  runtimeUnconfigured: boolean;
  rpcEnabled: boolean;
  runtimeUnavailable: boolean;
  isCompacting: boolean;
  isStreaming: boolean;
  workspaceMode: WorkspaceMode;
}): string {
  if (isCheckingAgent) return "Waiting for the agent runtime to be ready…";
  if (runtimeUnconfigured) {
    return rpcEnabled
      ? "Configure a provider or fix Pi RPC in Settings…"
      : "Configure an API provider or enable Pi RPC to continue…";
  }
  if (runtimeUnavailable) return "Reconnect the agent runtime to continue…";
  if (isCompacting) return "Compacting session — wait for it to finish…";
  if (workspaceMode === "explore") {
    return isStreaming
      ? "Explore mode is read-only — queue another analysis question…"
      : "Explore mode is read-only — ask about files, risks, or the next step…";
  }
  if (isStreaming) return "Queue a follow-up… (⌘⏎ to steer this turn)";
  return "Ask AFX about this workspace — ⌘⇧⏎ saves a note";
}

function isCompactDisabled(status: AgentRuntimeStatus, runtime: RuntimeSettings): boolean {
  return !status.running || status.isStreaming || runtime.isCompacting === true;
}

function getCompactTooltip(status: AgentRuntimeStatus, runtime: RuntimeSettings): string {
  if (runtime.isCompacting) return "Compacting…";
  if (status.isStreaming) return "Wait for the active turn to finish";
  return "Compact session";
}

// ---------------------------------------------------------------------------
// Surface: [Composer.Activity]
// ActivityBar — always-on status strip above the composer.
// Two-line layout: label row + optional thinking preview during streaming.
// ---------------------------------------------------------------------------

interface ActivityBarProps {
  thinking: string | null;
  isStreaming: boolean;
  isSystemCommand: boolean;
}

/**
 * Renders the live composer activity strip above the input group.
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-7]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-FOOTER]
 */
function ActivityBar({ thinking, isStreaming, isSystemCommand }: ActivityBarProps) {
  // Show first 120 chars so user sees what Pi is thinking *about*, not raw tail.
  const preview =
    isStreaming && thinking
      ? thinking.length > 120
        ? thinking.slice(0, 120) + "…"
        : thinking
      : null;

  return (
    <div className="shrink-0 border-t bg-muted/30 px-3 py-1.5">
      <div className="flex items-center gap-1.5">
        {isSystemCommand ? (
          <>
            <span className="inline-flex items-center gap-1 rounded bg-amber-500/20 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider text-amber-500">
              Shell
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground/50">
              local execution
            </span>
          </>
        ) : isStreaming ? (
          <>
            <span className="inline-block h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-afx-brand" />
            <span className="inline-flex items-baseline font-mono text-[10px] uppercase tracking-[0.14em]">
              <span className="afx-thinking-word bg-gradient-to-r from-afx-brand via-afx-brand-soft to-foreground bg-clip-text text-transparent">
                thinking
              </span>
              <span aria-hidden className="ml-0.5 inline-flex w-3 text-afx-brand-soft">
                <span className="afx-thinking-dot">.</span>
                <span className="afx-thinking-dot">.</span>
                <span className="afx-thinking-dot">.</span>
              </span>
            </span>
          </>
        ) : (
          <>
            <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/30" />
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground/50">
              idle
            </span>
          </>
        )}
      </div>
      {preview && (
        <p className="mt-0.5 truncate pl-3 font-serif text-[11px] italic text-muted-foreground">
          {preview}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Surface: [Composer.Footer]
// FooterStrip — single always-mounted row below the composer.
// Left: Pi pill (when RPC opted in) + Cpu icon + stats (tokens · ctx · cost).
// Right: contextual hint text (hidden on narrow widths via container query).
// Row height stays fixed to prevent composer jumps.
// ---------------------------------------------------------------------------

/**
 * Renders the fixed-height footer row with Pi/runtime hints and usage stats.
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-2]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-FOOTER]
 */
function FooterStrip({
  usage,
  isCheckingAgent,
  runtimeUnavailable,
  runtimeUnconfigured,
  isStreaming,
  rpcEnabled,
  agentPhase,
  onPiWarningClick,
  isSystemCommand,
  workspaceMode,
}: {
  usage: UsageStats | null;
  isCheckingAgent: boolean;
  runtimeUnavailable: boolean;
  runtimeUnconfigured: boolean;
  isStreaming: boolean;
  rpcEnabled: boolean;
  agentPhase: AgentRuntimePhase;
  onPiWarningClick?: () => void;
  isSystemCommand?: boolean;
  workspaceMode: WorkspaceMode;
}) {
  const hint =
    workspaceMode === "explore"
      ? "Read-only / Safe"
      : isSystemCommand
        ? "⚠ Shell · output is local only"
        : isCheckingAgent
          ? "Checking agent runtime readiness…"
          : runtimeUnconfigured
            ? rpcEnabled
              ? "Configure a provider or fix Pi RPC in Settings."
              : "Configure an API provider or enable Pi RPC in Settings."
            : runtimeUnavailable
              ? "Connection recovery is required before sending."
              : isStreaming
                ? "⏎ follow-up · ⌘⏎ steer · ⌘⇧⏎ note · ↑ history"
                : "⏎ follow-up · ⌘⏎ steer · idle: ⏎ send · ⌘⇧⏎ note · ↑ history";

  const statsText = usage
    ? [
        `${fmtTokens(usage.tokens.total)} tokens`,
        usage.contextUsage?.percent != null
          ? `ctx ${Math.round(usage.contextUsage.percent)}%`
          : null,
        usage.cost > 0 ? `$${usage.cost.toFixed(usage.cost < 1 ? 4 : 2)}` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : null;

  return (
    <div className="@container mt-1.5 flex h-4 items-center justify-between gap-2 px-1">
      <div className="flex min-w-0 items-center gap-2">
        {rpcEnabled ? <PiPill phase={agentPhase} onWarningClick={onPiWarningClick} /> : null}
        {statsText ? (
          <span
            className="flex min-w-0 items-center gap-1 truncate font-mono text-[10px] text-muted-foreground/60"
            title={usage ? usageTooltip(usage) : undefined}
          >
            <Cpu size={10} className="shrink-0 text-afx-brand-soft/40" />
            <span className="truncate">{statsText}</span>
          </span>
        ) : null}
      </div>
      <span className="hidden min-w-0 shrink-0 truncate text-right font-sans text-[10px] text-muted-foreground/60 @[280px]:inline">
        {hint}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Surface: [Composer.Footer]
// PiPill — runtime reachability indicator shown only when `afx.rpc.enabled`.
// Hidden when RPC is opt-out (the SDK-only default flow). Warning state
// becomes a button that opens AFX settings so the user can fix the path.
// ---------------------------------------------------------------------------

function PiPill({
  phase,
  onWarningClick,
}: {
  phase: AgentRuntimePhase;
  onWarningClick?: () => void;
}) {
  const isWarning = phase === "disconnected" || phase === "error";
  const isReady = phase === "ready" || phase === "busy";

  // Tone classes — colored dot + label color, matched to existing design tokens.
  const dotClass = isWarning
    ? "bg-amber-500/80"
    : isReady
      ? "bg-afx-brand-soft"
      : "bg-muted-foreground/40";
  const labelClass = isWarning
    ? "text-amber-500/80"
    : isReady
      ? "text-afx-brand-soft/80"
      : "text-muted-foreground/50";

  const dot = (
    <span
      aria-hidden
      className={cn(
        "inline-block h-1.5 w-1.5 shrink-0 rounded-full",
        dotClass,
        phase === "checking" || phase === "starting" ? "animate-pulse" : null,
      )}
    />
  );

  // Label hidden on narrow widths (<280px container) — dot alone communicates state.
  const label = (
    <span
      className={cn(
        "hidden font-mono text-[10px] uppercase tracking-[0.12em] @[280px]:inline",
        labelClass,
      )}
    >
      pi
    </span>
  );

  if (isWarning && onWarningClick) {
    return (
      <button
        type="button"
        onClick={onWarningClick}
        title="Pi runtime not reachable — open settings"
        aria-label="Pi runtime not reachable, open settings"
        className="flex shrink-0 items-center gap-1 rounded-sm px-1 -mx-1 transition-colors hover:bg-amber-500/10"
      >
        {dot}
        {label}
      </button>
    );
  }

  return (
    <span
      title={isReady ? "Pi runtime ready" : "Checking Pi runtime…"}
      className="flex shrink-0 items-center gap-1"
    >
      {dot}
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// StatusBar — top-of-window status with runtime state, usage pill, and controls.
// ---------------------------------------------------------------------------

function StatusBar({
  checking,
  status,
  runtime,
  onNewSession,
  onCompact,
  onContextSave,
  onRestartAgent,
}: {
  checking?: boolean;
  status: AgentRuntimeStatus;
  runtime: RuntimeSettings;
  onNewSession?: () => void;
  onCompact?: () => void;
  onContextSave?: () => void;
  onRestartAgent?: () => void;
}) {
  const isDisconnected = status.phase === "disconnected" || status.phase === "error";

  return (
    <div className="flex h-7 shrink-0 items-center justify-end gap-1 border-b bg-card/30 px-2">
      <TooltipProvider>
        <div className="flex shrink-0 items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onContextSave}
                className="inline-flex h-5 w-5 items-center justify-center rounded-sm text-muted-foreground/70 hover:bg-muted hover:text-foreground"
                aria-label="Save context"
              >
                <BookOpen size={11} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Save context (/afx-context save)</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onCompact}
                disabled={isCompactDisabled(status, runtime)}
                className="inline-flex h-5 w-5 items-center justify-center rounded-sm text-muted-foreground/70 hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Compact session"
              >
                <Layers size={12} className={cn(runtime.isCompacting && "animate-pulse")} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{getCompactTooltip(status, runtime)}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onNewSession}
                disabled={checking || isDisconnected}
                className="inline-flex h-5 w-5 items-center justify-center rounded-sm text-muted-foreground/70 hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="New session"
              >
                <MessageSquarePlus size={12} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">New session</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onRestartAgent}
                className="-mr-1 inline-flex h-5 w-5 items-center justify-center rounded-sm text-muted-foreground/70 hover:bg-muted hover:text-foreground"
                aria-label="Restart agent"
              >
                <RefreshCw size={11} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Restart agent</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AgentSetupState — brief spinner shown during the initial host handshake.
// Persistent runtime issues now surface via the Pi pill in FooterStrip and the
// recovery controls in StatusBar — no full-screen takeover.
// ---------------------------------------------------------------------------

function AgentSetupState() {
  return (
    <div
      className="mx-auto flex h-full w-full max-w-md flex-col justify-center px-3 py-8"
      aria-live="polite"
    >
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <AfxLogoIcon size={14} className="text-afx-brand-soft" />
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground/60">
          <LoaderCircle size={11} className="animate-spin text-afx-brand-soft" />
          Connecting to agent…
        </div>
        <p className="text-[11px] text-muted-foreground/40">Loading workspace state</p>
      </div>
    </div>
  );
}

const WORKSPACE_MODES: ReadonlyArray<{
  value: WorkspaceMode;
  label: string;
  description: string;
  badge?: string;
}> = [
  {
    value: "code",
    label: "Code",
    description: "Default. Full access. Pi can act and edit.",
  },
  {
    value: "explore",
    label: "Explore",
    description: "Read-only. Use it to inspect code, trace behavior, and plan changes.",
    badge: "Experimental",
  },
];

/**
 * Renders the workspace posture dropdown used to switch between Code and Explore.
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-12]
 */
function ModeToggle({
  mode,
  onChange,
}: {
  mode: WorkspaceMode;
  onChange: (mode: WorkspaceMode) => void;
}) {
  const current = WORKSPACE_MODES.find((item) => item.value === mode) ?? WORKSPACE_MODES[0];

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuPrimitive.Trigger
            type="button"
            aria-label="Workspace mode"
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "cn-button min-w-0 max-w-full shrink-0 gap-1 px-1.5",
            )}
          >
            <SlidersHorizontal size={11} className="shrink-0 text-afx-brand-soft" />
            <span className="hidden max-w-[6.5rem] truncate font-mono text-[10px] tracking-tight @[260px]:inline">
              {current.label}
            </span>
            <span className="font-mono text-[10px] @[260px]:hidden">{current.label}</span>
            <ChevronDown className="hidden shrink-0 text-muted-foreground @[260px]:block" />
          </DropdownMenuPrimitive.Trigger>
        </TooltipTrigger>
        <TooltipContent side="bottom" align="start" className="max-w-xs text-left">
          {current.value === "explore"
            ? "Explore is experimental and read-only. Use it to inspect code, trace behavior, and plan changes without running commands or edits."
            : "Code is the default full-access Pi-backed mode."}
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent side="top" align="start" className="min-w-[15rem]">
        <DropdownMenuLabel className="font-mono uppercase tracking-[0.14em]">
          Mode
        </DropdownMenuLabel>
        <div className="px-2 pb-1 text-[10px] leading-relaxed text-muted-foreground">
          Code is the default. Explore is for inspection, tracing, and planning.
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={current.value}
          onValueChange={(value) => onChange(value as WorkspaceMode)}
        >
          {WORKSPACE_MODES.map(({ value, label, description, badge }) => (
            <DropdownMenuRadioItem
              key={value}
              value={value}
              className="items-start gap-2 px-2 py-2"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-medium text-foreground">{label}</span>
                  {badge ? (
                    <Badge
                      variant="outline"
                      className="h-4 px-1 text-[9px] uppercase tracking-wide"
                    >
                      {badge}
                    </Badge>
                  ) : null}
                </div>
                <span className="text-[10px] leading-snug text-muted-foreground">
                  {description}
                </span>
              </div>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Composer switch for whether new turns should include the active file context.
 * The visible label uses the active file basename; hover exposes the full path.
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-11]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-CONTEXT]
 */
function ActiveFileContextToggle({
  enabled,
  fileName,
  filePath,
  onToggle,
}: {
  enabled: boolean;
  fileName: string;
  filePath: string;
  onToggle: () => void;
}) {
  const [tooltipOpen, setTooltipOpen] = useState(false);

  return (
    <Tooltip open={tooltipOpen} onOpenChange={setTooltipOpen}>
      <TooltipTrigger asChild>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label={fileName}
          onClick={onToggle}
          onMouseOver={() => setTooltipOpen(true)}
          onMouseEnter={() => setTooltipOpen(true)}
          onMouseMove={() => setTooltipOpen(true)}
          onMouseLeave={() => setTooltipOpen(false)}
          onPointerOver={() => setTooltipOpen(true)}
          onPointerEnter={() => setTooltipOpen(true)}
          onPointerLeave={() => setTooltipOpen(false)}
          onFocus={() => setTooltipOpen(true)}
          onBlur={() => setTooltipOpen(false)}
          className={cn(
            "inline-flex min-w-0 max-w-full items-center gap-1",
            enabled ? "text-foreground" : "text-muted-foreground",
          )}
        >
          <span
            data-slot="switch"
            data-size="sm"
            data-state={enabled ? "checked" : "unchecked"}
            aria-hidden="true"
            className={cn(
              "cn-switch",
              "group/switch relative inline-flex shrink-0 items-center rounded-full border border-transparent transition-all outline-none data-[size=default]:h-[18.4px] data-[size=default]:w-[32px] data-[size=sm]:h-[14px] data-[size=sm]:w-[24px] data-checked:bg-primary data-unchecked:bg-input dark:data-unchecked:bg-input/80",
              "shrink-0 origin-center scale-[0.8]",
            )}
          >
            <span
              data-slot="switch-thumb"
              className="cn-switch-thumb pointer-events-none block rounded-full bg-background ring-0 transition-transform group-data-[size=default]/switch:size-4 group-data-[size=sm]/switch:size-3 group-data-[size=default]/switch:data-checked:translate-x-[calc(100%-2px)] group-data-[size=sm]/switch:data-checked:translate-x-[calc(100%-2px)] dark:data-checked:bg-primary-foreground group-data-[size=default]/switch:data-unchecked:translate-x-0 group-data-[size=sm]/switch:data-unchecked:translate-x-0 dark:data-unchecked:bg-foreground"
            />
          </span>
          <span className="hidden min-w-0 max-w-[7rem] truncate font-mono text-[10px] tracking-tight @[260px]:inline">
            {fileName}
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" align="start" className="max-w-xs text-left">
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em]">
            {enabled ? "File context on" : "File context off"}
          </span>
          <span className="text-xs">
            {enabled
              ? "New turns automatically include this editor file, which is useful when the answer depends on the current code. Keep this on by default for file-specific work."
              : "Turn this on when you want the next turn to use the current editor file as context. It is best left on when you are debugging or editing this file."}
          </span>
          <span className="break-all font-mono text-[10px] opacity-70">{filePath}</span>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

// ---------------------------------------------------------------------------
// Surface: [Composer.Queue]
// QueueStrip — visual list of messages staged while the agent is streaming.
// The engine handles the actual queueing; this strip only mirrors what we sent.
// ---------------------------------------------------------------------------

/**
 * Renders queued steer/follow-up rows mirrored from streaming submissions.
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-4]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-QUEUE] [DES-COMPOSER-MOCKUP-STREAMING]
 */
function QueueStrip({
  queued,
  onDismiss,
  onClearAll,
}: {
  queued: readonly QueuedMessage[];
  onDismiss: (id: string) => void;
  onClearAll: () => void;
}) {
  if (queued.length === 0) return null;

  const steers = queued.filter((q) => q.mode === "steer");
  const follows = queued.filter((q) => q.mode === "followUp");

  return (
    <ComposerStrip
      title="Queued"
      count={queued.length}
      action={{
        label: "Clear all",
        icon: <Trash2 size={10} />,
        onClick: onClearAll,
      }}
    >
      <ul className="flex flex-col gap-0.5">
        {steers.map((q, index) => (
          <QueueRow
            key={q.id}
            item={q}
            marker={steers.length > 1 ? `${index + 1}.` : "→"}
            kindIcon={<Zap size={10} className="text-afx-brand-soft" />}
            onDismiss={onDismiss}
          />
        ))}
        {follows.map((q, index) => (
          <QueueRow
            key={q.id}
            item={q}
            marker={`${index + 1}.`}
            kindIcon={<CornerDownLeft size={10} className="text-muted-foreground/70" />}
            onDismiss={onDismiss}
          />
        ))}
      </ul>
    </ComposerStrip>
  );
}

/**
 * Renders the host-blocked system-command strip used in Explore mode.
 *
 * @see docs/specs/201-app-vscode-panels/spec.md [FR-11]
 * @see docs/specs/211-app-chat-composer/spec.md [FR-13]
 */
function BlockedCommandStrip({
  action,
  onSwitchToCode,
  onCopyCommand,
  onDismiss,
}: {
  action: BlockedActionView;
  onSwitchToCode: () => void;
  onCopyCommand: () => void | Promise<void>;
  onDismiss: () => void;
}) {
  const commandText = `! ${action.command}`.trim();

  return (
    <ComposerStrip
      title="Blocked command"
      tone="warning"
      action={{
        label: "Switch to Code",
        onClick: onSwitchToCode,
      }}
      onDismiss={onDismiss}
    >
      <div className="flex flex-col gap-1.5">
        <div className="flex items-start gap-2">
          <AlertTriangle size={12} className="mt-0.5 shrink-0 text-amber-500" />
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-500">
              {action.title}
            </p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
              {action.message}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-sm border border-amber-500/20 bg-amber-500/5 px-2 py-1">
          <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-foreground">
            {commandText}
          </span>
          <Button
            type="button"
            size="xs"
            variant="outline"
            className="shrink-0"
            onClick={() => void onCopyCommand()}
          >
            <Copy className="size-3" />
            <span>Copy command</span>
          </Button>
        </div>
      </div>
    </ComposerStrip>
  );
}

/**
 * Renders one queued composer row and explains that dismissal only hides local display.
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-4]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-QUEUE]
 */
function QueueRow({
  item,
  marker,
  kindIcon,
  onDismiss,
}: {
  item: QueuedMessage;
  marker: string;
  kindIcon: React.ReactNode;
  onDismiss: (id: string) => void;
}) {
  const label = item.mode === "steer" ? "Steer" : "Follow-up";

  return (
    <li
      className="group/queue-item flex items-start gap-1.5 rounded-sm py-0.5 pl-1 pr-0.5 hover:bg-muted/60"
      title={
        item.mode === "steer"
          ? "Steers the active turn at the next agent step"
          : "Runs after the active turn completes"
      }
    >
      <span className="mt-[2px] shrink-0">{kindIcon}</span>
      <span
        className={cn(
          "mt-[1px] shrink-0 font-mono text-[10px] tabular-nums",
          item.mode === "steer" ? "text-afx-brand-soft" : "text-muted-foreground/80",
        )}
      >
        {marker}
      </span>
      <span
        className={cn(
          "mt-[1px] shrink-0 rounded px-1 py-px text-[9px] font-medium uppercase tracking-wide",
          item.mode === "steer"
            ? "bg-afx-brand-soft/10 text-afx-brand-soft"
            : "bg-muted text-muted-foreground",
        )}
      >
        {label}
      </span>
      <span className="line-clamp-2 min-w-0 flex-1 text-[11px] leading-relaxed text-foreground/90">
        {item.content}
      </span>
      <button
        type="button"
        onClick={() => onDismiss(item.id)}
        className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-muted-foreground/0 transition-colors group-hover/queue-item:text-muted-foreground/70 hover:bg-muted hover:!text-foreground"
        aria-label="Hide from queue display"
        title="Hide from queue display (already sent to engine)"
      >
        <X size={10} />
      </button>
    </li>
  );
}

/** Builds a detailed tooltip for the footer stats. */
function usageTooltip(usage: UsageStats): string {
  const lines = [`Total tokens: ${fmtTokens(usage.tokens.total)}`];
  if (usage.tokens.input > 0) lines.push(`  Input:  ${fmtTokens(usage.tokens.input)}`);
  if (usage.tokens.output > 0) lines.push(`  Output: ${fmtTokens(usage.tokens.output)}`);
  if (usage.tokens.cacheRead > 0) lines.push(`  Cache read:  ${fmtTokens(usage.tokens.cacheRead)}`);
  if (usage.tokens.cacheWrite > 0)
    lines.push(`  Cache write: ${fmtTokens(usage.tokens.cacheWrite)}`);
  if (usage.contextUsage) {
    lines.push(
      `Context: ${usage.contextUsage.tokens?.toLocaleString() ?? "?"} / ${usage.contextUsage.contextWindow.toLocaleString()} (${Math.round(usage.contextUsage.percent ?? 0)}%)`,
    );
  }
  if (usage.cost > 0) lines.push(`Cost: $${usage.cost.toFixed(4)}`);
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// EmptyState — shown when there are no messages.
// ---------------------------------------------------------------------------

/** Groups of quick-command buttons shown when the chat is empty. */
const QUICK_COMMANDS: ReadonlyArray<{ label: string; commands: string[] }> = [
  { label: "Scaffold", commands: ["/afx-scaffold", "/afx-adr"] },
  { label: "Plan", commands: ["/afx-task", "/afx-spec", "/afx-sprint"] },
  { label: "Quality", commands: ["/afx-check", "/afx-report"] },
  { label: "Session", commands: ["/afx-next", "/afx-session", "/afx-context"] },
];

/** Props for EmptyState — receives the insert callback to populate the composer. */
interface EmptyStateProps {
  /** Called with command text when a quick-command button is clicked. */
  onInsert: (text: string) => void;
  runtimeUnconfigured?: boolean;
  rpcEnabled?: boolean;
  onOpenSettings?: () => void;
}

/**
 * Shown when the chat has no messages and the agent is ready.
 * Displays quick-command groups and a collapsible about section.
 */
function EmptyState({
  onInsert,
  runtimeUnconfigured = false,
  rpcEnabled = false,
  onOpenSettings,
}: EmptyStateProps) {
  return (
    <div className="mx-auto flex h-full w-full max-w-md flex-col gap-3 px-1 py-6">
      <div className="flex shrink-0 flex-col items-center gap-2 border-b border-border/70 pb-4 pt-1 text-center">
        <AfxLogoMark width={168} className="h-auto max-w-full text-foreground" />
        <h2 className="font-serif text-lg italic leading-snug text-foreground">
          {runtimeUnconfigured ? "Connect a model to start." : "Ready when you are."}
        </h2>
        <p className="max-w-full break-words font-mono text-[10px] uppercase tracking-[0.14em] text-afx-brand-soft/70">
          {runtimeUnconfigured
            ? "No runtime configured"
            : rpcEnabled
              ? "Pi CLI + API providers"
              : "API providers"}
        </p>
      </div>

      {runtimeUnconfigured ? (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2.5">
          <div className="flex items-start gap-2">
            <AlertTriangle size={13} className="mt-0.5 shrink-0 text-amber-500" />
            <div className="min-w-0">
              <p className="text-[12px] font-medium text-foreground">No active runtime</p>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                {rpcEnabled
                  ? "Add an API provider key, configure Ollama, or fix Pi CLI settings."
                  : "Add an API provider key, configure Ollama, or enable Pi RPC from Settings."}
              </p>
              <Button
                type="button"
                size="xs"
                variant="outline"
                className="mt-2"
                onClick={onOpenSettings}
                disabled={!onOpenSettings}
              >
                Open Settings
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {!runtimeUnconfigured ? (
        <div className="flex flex-col gap-2">
          <p className="px-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground/80">
            Quick commands
          </p>
          {QUICK_COMMANDS.map((group) => (
            <div
              key={group.label}
              className="afx-field-surface group flex flex-col items-stretch gap-2 rounded-md border px-2.5 py-2"
            >
              <span className="font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-afx-brand-soft">
                {group.label}
              </span>
              <div className="flex min-w-0 flex-wrap gap-1.5">
                {group.commands.map((cmd) => (
                  <button
                    key={cmd}
                    type="button"
                    onClick={() => onInsert(cmd)}
                    className="inline-flex max-w-full min-w-0 items-center gap-1 break-all rounded-sm border border-border/60 bg-muted/40 px-1.5 py-0.5 font-mono text-[10px] text-foreground/80 transition-colors hover:border-afx-brand-soft/40 hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/50"
                  >
                    {cmd}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-1 border-t border-border/50 pt-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground/60">
          Early access
        </p>
        <div className="mt-2 text-[11px] leading-relaxed text-muted-foreground/60">
          <p>
            {rpcEnabled
              ? "Pi CLI and API provider models can run side by side; the model picker decides which one handles a turn."
              : "Add provider keys in Settings, then use the model picker to choose which model handles a turn."}
          </p>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
            {rpcEnabled ? (
              <a
                href="https://pi.dev"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-afx-brand-soft/70 hover:text-afx-brand-soft"
              >
                pi.dev
                <ExternalLink size={9} />
              </a>
            ) : null}
            <a
              href="https://github.com/AgenticFlowX/agenticflowx/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-muted-foreground/50 hover:text-muted-foreground"
            >
              GitHub Issues
              <ExternalLink size={9} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Timeline — vertical rail with dots and per-event rows
// ---------------------------------------------------------------------------

/**
 * Timeline event types that can appear in the message thread.
 * Tools are flattened before their parent assistant message.
 * Compaction summaries appear as distinct system messages.
 */
type TimelineEvent =
  | { id: string; kind: "user"; message: ChatMessageView }
  | { id: string; kind: "assistant"; message: ChatMessageView }
  | { id: string; kind: "error"; message: ChatMessageView }
  | { id: string; kind: "info"; message: ChatMessageView }
  | { id: string; kind: "tool"; tool: ChatToolView; createdAt: number }
  | { id: string; kind: "compaction"; summary: string; tokensBefore: number; createdAt: number }
  | { id: string; kind: "note"; content: string; savedAt: number }
  | {
      id: string;
      kind: "shell";
      command: string;
      stdout: string;
      stderr: string;
      exitCode?: number;
      error?: string;
      createdAt: number;
    };

/**
 * Returns whether an assistant row has user-visible content worth rendering.
 * Empty non-streaming placeholders can be produced by thinking-only runtime phases;
 * suppressing them prevents long blank AFX history rows.
 *
 * @see docs/specs/212-app-chat-messages/spec.md [FR-1] [FR-2]
 * @see docs/specs/212-app-chat-messages/design.md [DES-MESSAGES-COMPONENT-TIMELINE] [DES-MESSAGES-MOCKUP-THINKING]
 */
function hasVisibleAssistantMessage(message: ChatMessageView): boolean {
  return message.content.trim().length > 0;
}

/**
 * Converts a flat message list into a timeline of events.
 * Tools are placed before their parent assistant message.
 * Note and shell events are appended after messages, then sorted by timestamp.
 *
 * @see docs/specs/212-app-chat-messages/spec.md [FR-1] [FR-2] [FR-4] [FR-6]
 * @see docs/specs/212-app-chat-messages/design.md [DES-MESSAGES-COMPONENTS] [DES-MESSAGES-EVENT-FLOW]
 * @see docs/specs/215-app-chat-notes/spec.md [FR-1] [FR-2]
 * @see docs/specs/215-app-chat-notes/design.md [DES-NOTES-MOCKUP-CHAT]
 */
function Timeline({
  messages,
  noteEvents,
  commandOutputs,
}: {
  messages: ChatTimelineItem[];
  noteEvents: ChatNoteEventView[];
  commandOutputs: ChatCommandOutputView[];
}) {
  const events: TimelineEvent[] = [];
  for (const m of messages) {
    if (m.role === "user") {
      events.push({ id: m.id, kind: "user", message: m });
      continue;
    }
    // Compaction summary — rendered as a distinct system card.
    if (m.role === "compactionSummary") {
      const msg = m as unknown as {
        id: string;
        summary: string;
        tokensBefore: number;
        createdAt: number;
      };
      events.push({
        id: msg.id,
        kind: "compaction",
        summary: msg.summary,
        tokensBefore: msg.tokensBefore,
        createdAt: msg.createdAt,
      });
      continue;
    }
    // Assistant: tools first within the assistant turn, but timestamped to the
    // parent assistant so sorting never moves them above the triggering user row.
    for (const t of m.tools ?? []) {
      events.push({ id: `${m.id}-${t.toolCallId}`, kind: "tool", tool: t, createdAt: m.createdAt });
    }
    if (!hasVisibleAssistantMessage(m)) continue;
    const isError = m.content.startsWith("⚠");
    const isInfo = m.content.startsWith("ℹ");
    events.push({
      id: m.id,
      kind: isError ? "error" : isInfo ? "info" : "assistant",
      message: m,
    });
  }
  for (const n of noteEvents) {
    events.push({ id: n.id, kind: "note", content: n.content, savedAt: n.savedAt });
  }
  for (const cmd of commandOutputs) {
    events.push({
      id: cmd.requestId,
      kind: "shell",
      command: cmd.command,
      stdout: cmd.stdout,
      stderr: cmd.stderr,
      exitCode: cmd.exitCode,
      error: cmd.error,
      createdAt: cmd.createdAt,
    });
  }

  // Sort all events by createdAt so shell outputs interleave with chat history.
  function getEventTime(event: TimelineEvent): number {
    switch (event.kind) {
      case "user":
      case "assistant":
      case "error":
      case "info":
        return event.message.createdAt;
      case "note":
        return event.savedAt;
      case "compaction":
        return event.createdAt;
      case "shell":
      case "tool":
        return event.createdAt;
    }
  }
  events.sort((a, b) => getEventTime(a) - getEventTime(b));

  return (
    <ol className="relative flex flex-col">
      {events.map((event, i) => (
        <TimelineRow
          key={event.id}
          event={event}
          isLast={i === events.length - 1}
          isReply={event.kind !== "user"}
        />
      ))}
    </ol>
  );
}

/**
 * Renders a single timeline row with a rail marker, event header, and event body.
 * The rail line is hidden for the last row to avoid dangling at the bottom.
 * Reply rows (non-user) are indented by 28px to visually nest under the user turn.
 *
 * @see docs/specs/212-app-chat-messages/spec.md [FR-1]
 * @see docs/specs/212-app-chat-messages/design.md [DES-MESSAGES-COMPONENTS] [DES-MESSAGES-MOCKUP-ASSISTANT]
 */
function TimelineRow({
  event,
  isLast,
  isReply,
}: {
  event: TimelineEvent;
  isLast: boolean;
  isReply: boolean;
}) {
  return (
    <li
      className={cn(
        "relative grid grid-cols-[20px_minmax(0,1fr)] gap-x-2.5 pb-3 last:pb-0",
        isReply && "pl-[28px]",
      )}
    >
      {/* Rail line — centered behind the marker; hidden for the last row */}
      {!isLast && (
        <span
          aria-hidden
          className="pointer-events-none absolute top-7 bottom-0 left-[10px] w-px -translate-x-1/2 bg-border/60"
        />
      )}
      <div className="relative z-10 flex justify-center pt-0.5">
        <Marker event={event} />
      </div>
      <div className="min-w-0">
        {event.kind === "tool" ? (
          <ToolEvent tool={event.tool} />
        ) : (
          <>
            <EventHeader event={event} />
            <EventBody event={event} />
          </>
        )}
      </div>
    </li>
  );
}

// Avatar circles for the conversation participants (user, AFX). Tool, error,
// and system events render as plain icons against the rail to reduce visual noise.
const MARKER_AVATAR =
  "relative flex h-5 w-5 items-center justify-center rounded-full ring-[3px] ring-background";
const MARKER_PLAIN = "relative flex h-5 w-5 items-center justify-center bg-background";

/**
 * Renders the rail marker for each timeline event type.
 *
 * @see docs/specs/212-app-chat-messages/spec.md [FR-1] [FR-6]
 * @see docs/specs/212-app-chat-messages/design.md [DES-MESSAGES-COMPONENTS] [DES-MESSAGES-MOCKUP-SYSTEM]
 */
function Marker({ event }: { event: TimelineEvent }) {
  if (event.kind === "user") {
    return (
      <span aria-hidden className={cn(MARKER_AVATAR, "bg-afx-info/15 text-afx-info")}>
        <UserRound size={11} className="shrink-0" strokeWidth={2.5} />
      </span>
    );
  }

  if (event.kind === "assistant") {
    return (
      <span aria-hidden className={cn(MARKER_AVATAR, "bg-afx-brand-soft/15 text-afx-brand-soft")}>
        <AfxLogoIcon size={14} />
      </span>
    );
  }

  if (event.kind === "tool") {
    const { icon: Icon } = toolDescriptor(event.tool);
    const { status } = event.tool;
    const tone =
      status === "running"
        ? "text-afx-brand animate-pulse"
        : status === "ok"
          ? "text-afx-success"
          : "text-destructive";
    return (
      <span aria-hidden className={cn(MARKER_PLAIN, tone)}>
        <Icon size={12} className="shrink-0" strokeWidth={2.25} />
      </span>
    );
  }

  if (event.kind === "error") {
    return (
      <span aria-hidden className={cn(MARKER_PLAIN, "text-destructive")}>
        <AlertTriangle size={12} className="shrink-0" strokeWidth={2.25} />
      </span>
    );
  }

  if (event.kind === "info") {
    return (
      <span aria-hidden className={cn(MARKER_PLAIN, "text-muted-foreground/35")}>
        <Info size={10} className="shrink-0" strokeWidth={2.25} />
      </span>
    );
  }

  if (event.kind === "compaction") {
    return (
      <span aria-hidden className={cn(MARKER_PLAIN, "text-afx-brand-soft")}>
        <Scissors size={12} className="shrink-0" strokeWidth={2.25} />
      </span>
    );
  }

  if (event.kind === "note") {
    return (
      <span aria-hidden className={cn(MARKER_PLAIN, "text-muted-foreground/60")}>
        <PenLine size={12} className="shrink-0" strokeWidth={2.25} />
      </span>
    );
  }

  if (event.kind === "shell") {
    return (
      <span aria-hidden className={cn(MARKER_PLAIN, "text-amber-500/70")}>
        <Terminal size={12} className="shrink-0" strokeWidth={2.25} />
      </span>
    );
  }

  return null;
}

/**
 * EventHeader — renders the eyebrow label (e.g., "You", "AFX") for message events.
 *
 * @see docs/specs/212-app-chat-messages/spec.md [FR-1] [FR-6]
 * @see docs/specs/212-app-chat-messages/design.md [DES-MESSAGES-COMPONENTS] [DES-MESSAGES-MOCKUP-ASSISTANT]
 */
function EventHeader({ event }: { event: TimelineEvent }) {
  if (event.kind === "user") {
    return <Eyebrow tone="info" label="You" timestamp={event.message.createdAt} />;
  }
  if (event.kind === "assistant") {
    return (
      <Eyebrow tone="brand" label="AFX" timestamp={event.message.createdAt}>
        {event.message.streaming && (
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-afx-brand" />
        )}
      </Eyebrow>
    );
  }
  if (event.kind === "error") {
    return <Eyebrow tone="destructive" label="Error" />;
  }
  if (event.kind === "info") {
    return null;
  }
  if (event.kind === "compaction") {
    return <Eyebrow tone="brand" label="Session compacted" timestamp={event.createdAt} />;
  }
  if (event.kind === "note") {
    return (
      <div className="flex items-center gap-1.5 text-[11px]">
        <span className="font-mono font-medium uppercase tracking-[0.14em] text-muted-foreground/60">
          Note
        </span>
        <span className="font-mono text-[10px] text-muted-foreground/60">
          {formatTimeMeta(event.savedAt)}
        </span>
      </div>
    );
  }
  if (event.kind === "shell") {
    return <Eyebrow tone="brand" label="Shell" />;
  }
  // tool events render via ToolEvent (table-style). EventHeader is unused for them.
  return null;
}

/** Compresses tool action verbs into tight terminal-style labels. */
function toolEyebrow(action: string): string {
  const lower = action.toLowerCase();
  if (lower.startsWith("running command") || lower.startsWith("ran command")) return "cmd";
  if (lower.startsWith("editing") || lower.startsWith("edited")) return "edit";
  if (lower.startsWith("reading") || lower.startsWith("read")) return "read";
  if (lower.startsWith("searching") || lower.startsWith("searched")) return "search";
  if (lower.startsWith("listing") || lower.startsWith("listed")) return "list";
  if (lower.startsWith("asking") || lower.startsWith("got input")) return "input";
  return action;
}

/**
 * Eyebrow — renders a colored label with optional timestamp and trailing content.
 * Used for "You", "AFX", "Error" labels in the timeline.
 *
 * @see docs/specs/212-app-chat-messages/spec.md [FR-1]
 * @see docs/specs/212-app-chat-messages/design.md [DES-MESSAGES-COMPONENTS]
 */
function Eyebrow({
  tone,
  label,
  timestamp,
  children,
}: {
  tone: "info" | "brand" | "destructive";
  label: string;
  timestamp?: number;
  children?: React.ReactNode;
}) {
  const toneClass =
    tone === "info"
      ? "text-afx-info"
      : tone === "brand"
        ? "text-afx-brand-soft"
        : "text-destructive";
  return (
    <div className="flex items-center gap-1.5 text-[11px]">
      <span className={cn("font-mono font-medium uppercase tracking-[0.14em]", toneClass)}>
        {label}
      </span>
      {children}
      {timestamp != null && (
        <span className="font-mono text-[10px] text-muted-foreground/60">
          {formatTimeMeta(timestamp)}
        </span>
      )}
    </div>
  );
}

/**
 * EventBody — renders the content for each timeline event type.
 *
 * @see docs/specs/212-app-chat-messages/spec.md [FR-1] [FR-2] [FR-3] [FR-6]
 * @see docs/specs/212-app-chat-messages/design.md [DES-MESSAGES-COMPONENTS] [DES-MESSAGES-MARKDOWN] [DES-MESSAGES-MOCKUP-SYSTEM]
 */
function EventBody({ event }: { event: TimelineEvent }) {
  if (event.kind === "user") {
    return (
      <div className="mt-1 rounded-md bg-muted/40 px-2.5 py-1.5 whitespace-pre-wrap break-words text-[13px] leading-relaxed">
        {event.message.content}
      </div>
    );
  }
  if (event.kind === "assistant") {
    if (event.message.content) {
      return (
        <div className="mt-0.5">
          <MarkdownMessage content={event.message.content} />
          <AssistantMeta message={event.message} />
        </div>
      );
    }
    if (event.message.streaming) {
      return <div className="mt-0.5 text-[13px] text-muted-foreground">…</div>;
    }
    return null;
  }
  if (event.kind === "error") {
    const body = event.message.content.replace(/^⚠\s*/, "");
    return (
      <div className="mt-1 rounded-sm border border-destructive/30 bg-destructive/[0.06] px-2.5 py-1.5">
        <p className="whitespace-pre-wrap break-words text-[12px] leading-relaxed text-destructive">
          {linkify(body)}
        </p>
      </div>
    );
  }
  if (event.kind === "info") {
    const body = event.message.content.replace(/^ℹ\s*/, "");
    return (
      <div className="mt-0.5 py-0.5">
        <p className="whitespace-pre-wrap break-words font-mono text-[10px] italic leading-relaxed tracking-[0.02em] text-muted-foreground/55">
          {body}
        </p>
      </div>
    );
  }
  if (event.kind === "compaction") {
    return <CompactionCard summary={event.summary} tokensBefore={event.tokensBefore} />;
  }
  if (event.kind === "note") {
    return (
      <div className="mt-0.5 py-0.5">
        <p className="whitespace-pre-wrap break-words font-serif text-[12px] italic leading-relaxed text-muted-foreground/60">
          {event.content}
        </p>
      </div>
    );
  }
  if (event.kind === "shell") {
    return (
      <div className="mt-1">
        <OutputCard
          command={event.command}
          stdout={event.stdout}
          stderr={event.stderr}
          exitCode={event.exitCode}
          error={event.error}
        />
      </div>
    );
  }
  // tool events are rendered by ToolEvent (table layout) — EventBody is unused.
  return null;
}

// ---------------------------------------------------------------------------
// ToolEvent — compact two-row "input/output" table for tool call display.
// ---------------------------------------------------------------------------

/**
 * Renders a tool call as a compact two-row table:
 *   ┌──────────────────────────────────────────┐
 *   │ CMD │ pwd && echo "---" && ls -la         │
 *   ├─────┼────────────────────────────────────┤
 *   │ OUT │ /path/to/workspace                   │
 *   └─────┴────────────────────────────────────┘
 *
 * @see docs/specs/212-app-chat-messages/spec.md [FR-4]
 * @see docs/specs/212-app-chat-messages/design.md [DES-MESSAGES-TOOLS] [DES-MESSAGES-MOCKUP-TOOL]
 */
function ToolEvent({ tool }: { tool: ChatToolView }) {
  const descriptor = toolDescriptor(tool);
  const inputLabel = toolEyebrow(descriptor.action);
  const inputContent = descriptor.target;
  const isError = tool.status === "error";
  const isRunning = tool.status === "running";
  const outputLabel = isError ? "err" : "out";

  // Output preview for collapsed state.
  const summary = tool.summary ?? "";
  const firstLine = summary.split(/\r?\n/).find((line) => line.trim().length > 0) ?? "";
  const preview = firstLine.length > 140 ? `${firstLine.slice(0, 140)}…` : firstLine;
  const isMultiline = summary.includes("\n") || summary.length > 140;
  const hasOutput = summary.length > 0;

  return (
    <div className="afx-surface-card overflow-hidden rounded-md border">
      <ToolEventRow
        label={inputLabel}
        labelTone="text-muted-foreground"
        contentTone="text-foreground/90"
      >
        {inputContent ? (
          <span className="truncate">{inputContent}</span>
        ) : (
          <span className="text-muted-foreground italic">(no arguments)</span>
        )}
        {isRunning ? (
          <span className="ml-1.5 inline-block h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-afx-brand" />
        ) : null}
      </ToolEventRow>

      {hasOutput ? (
        isMultiline ? (
          <details className="group border-t">
            <summary
              className={cn(
                "flex cursor-pointer list-none items-stretch marker:hidden hover:bg-muted/30",
                isError && "text-destructive",
              )}
            >
              <span
                className={cn(
                  "flex w-12 shrink-0 items-center justify-center border-r bg-muted/40 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em]",
                  isError ? "text-destructive" : "text-muted-foreground",
                )}
              >
                {outputLabel}
              </span>
              <span className="flex min-w-0 flex-1 items-center gap-1.5 px-2.5 py-1.5 font-mono text-[11px]">
                <ChevronDown
                  size={11}
                  className="shrink-0 -rotate-90 text-muted-foreground transition-transform group-open:rotate-0"
                />
                <span className="min-w-0 truncate">{preview}</span>
              </span>
            </summary>
            <pre className="max-h-64 overflow-auto border-t bg-muted/20 px-2.5 py-2 font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-words text-muted-foreground">
              {summary}
            </pre>
          </details>
        ) : (
          <ToolEventRow
            label={outputLabel}
            labelTone={isError ? "text-destructive" : "text-muted-foreground"}
            contentTone={isError ? "text-destructive" : "text-foreground/80"}
            divider
          >
            <span className="truncate">{preview}</span>
          </ToolEventRow>
        )
      ) : null}
    </div>
  );
}

/**
 * A single row in the ToolEvent table with a label gutter and content cell.
 *
 * @see docs/specs/212-app-chat-messages/spec.md [FR-4]
 * @see docs/specs/212-app-chat-messages/design.md [DES-MESSAGES-TOOLS]
 */
function ToolEventRow({
  label,
  labelTone,
  contentTone,
  divider,
  children,
}: {
  label: string;
  labelTone: string;
  contentTone: string;
  divider?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex items-stretch", divider && "border-t")}>
      <span
        className={cn(
          "flex w-12 shrink-0 items-center justify-center border-r bg-muted/40 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em]",
          labelTone,
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          "flex min-w-0 flex-1 items-center gap-1.5 px-2.5 py-1.5 font-mono text-[11px]",
          contentTone,
        )}
      >
        {children}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AssistantMeta — token/cost/context metadata below assistant messages.
// ---------------------------------------------------------------------------

/** Maps technical stop reasons from the model to user-friendly labels. */
const FRIENDLY_STOP_REASONS: Record<string, string | undefined> = {
  // Natural stop — end of assistant turn (don't show, it's normal).
  end_turn: undefined,
  // Max tokens reached.
  max_tokens: "max tokens",
  // Model hit a stop sequence.
  stop_sequence: "stop sequence",
  // Model was interrupted.
  interrupt: "interrupted",
  // Session ended.
  session_end: "session ended",
  // Model requested a tool (normal for tool-using models, don't show).
  tool_use: undefined,
};

/**
 * Renders token/cost/context metadata below an assistant message.
 * Only shows data that is available and meaningful.
 *
 * @see docs/specs/212-app-chat-messages/spec.md [FR-5]
 * @see docs/specs/212-app-chat-messages/design.md [DES-MESSAGES-META]
 */
function AssistantMeta({ message }: { message: ChatMessageView }) {
  const usage = message.usage;
  const parts: string[] = [];
  if (usage) {
    parts.push(`Used ${fmtTokens(usage.tokens.total)} actual`);
    if (usage.contextUsage?.percent != null)
      parts.push(`Context ${Math.round(usage.contextUsage.percent)}%`);
    if (usage.cost > 0) parts.push(`Cost $${usage.cost.toFixed(usage.cost < 1 ? 4 : 2)}`);
  }
  // Only show stop reasons that are meaningful to the user.
  if (message.stopReason) {
    const friendlyLabel = FRIENDLY_STOP_REASONS[message.stopReason];
    if (friendlyLabel) parts.push(friendlyLabel);
  }
  if (parts.length === 0) return null;
  return (
    <div className="mt-1.5 font-mono text-[10px] tracking-wide text-muted-foreground/70">
      {parts.join(" · ")}
    </div>
  );
}

function formatTimeMeta(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/** Matches URLs and common domain names for auto-linking in error messages. */
// ---------------------------------------------------------------------------
// CompactionCard — summary card rendered when Pi prunes old context.
// ---------------------------------------------------------------------------

/** Lightweight inline collapsible row rendered when the agent prunes old context. */
function CompactionCard({ summary, tokensBefore }: { summary: string; tokensBefore: number }) {
  const [open, setOpen] = useState(false);
  const tokenLabel = tokensBefore > 0 ? `${fmtTokens(tokensBefore)} tokens` : null;

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-1.5 text-left"
      >
        <Scissors size={10} className="shrink-0 text-muted-foreground/50" />
        <span className="font-mono text-[10px] text-muted-foreground/60">compacted</span>
        {tokenLabel && (
          <span className="font-mono text-[10px] text-muted-foreground/40">· {tokenLabel}</span>
        )}
        <ChevronRight
          size={10}
          className={cn(
            "ml-auto shrink-0 text-muted-foreground/30 transition-transform",
            open && "rotate-90",
          )}
        />
      </button>
      {open && (
        <p className="mt-1 pl-4 whitespace-pre-wrap break-words text-[11px] leading-relaxed text-muted-foreground/60">
          {summary}
        </p>
      )}
    </div>
  );
}

const URL_RE =
  /\b(https?:\/\/[^\s<>"']+|[a-z0-9.-]+\.(?:com|org|net|io|dev|ai|app|co)(?:\/[^\s<>"']*)?)/gi;

/**
 * Converts plain text URLs into anchor tags with hover styling.
 * Handles both http URLs and bare domains.
 */
function linkify(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let lastIdx = 0;
  let key = 0;
  for (const match of text.matchAll(URL_RE)) {
    const idx = match.index ?? 0;
    if (idx > lastIdx) parts.push(text.slice(lastIdx, idx));
    const raw = match[0];
    const href = raw.startsWith("http") ? raw : `https://${raw}`;
    parts.push(
      <a
        key={`l-${key++}`}
        href={href}
        target="_blank"
        rel="noreferrer"
        className="underline decoration-destructive/40 underline-offset-2 hover:decoration-destructive"
      >
        {raw}
      </a>,
    );
    lastIdx = idx + raw.length;
  }
  if (lastIdx < text.length) parts.push(text.slice(lastIdx));
  return parts;
}

/** Formats a token count into a human-readable string (e.g., "1.3m", "500k"). */
function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}m`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function collectPromptHistory(
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
function uid(): string {
  const g = globalThis as unknown as { crypto?: { randomUUID?: () => string } };
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
