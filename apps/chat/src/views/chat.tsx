/**
 * Chat view — streaming message thread with composer, tool call display, and thinking blocks.
 *
 * @see docs/specs/210-app-chat/spec.md [FR-2] [FR-3] [FR-4] [FR-6]
 * @see docs/specs/210-app-chat/design.md [DES-UI]
 * @see docs/specs/chat-ui-theme-foundation/chat-ui-theme-foundation.md [FR-8] [FR-9] [FR-10]
 */
import {
  type ChangeEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  AtSign,
  BookOpen,
  Brain,
  ChevronDown,
  ChevronRight,
  Cpu,
  ExternalLink,
  Info,
  Layers,
  LoaderCircle,
  MessageSquarePlus,
  Plus,
  RefreshCw,
  Scissors,
  Square,
  Trash2,
  UserRound,
  X,
  Zap,
} from "lucide-react";

import type {
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
} from "@afx/shared";
import { createCheckingAgentRuntimeStatus } from "@afx/shared";
import { Button, buttonVariants } from "@afx/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
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
import { MarkdownMessage } from "../components/markdown-message";
import { MentionPopup } from "../components/mention-popup";
import { ModelCombobox } from "../components/model-combobox";
import { SlashPopup } from "../components/slash-popup";
import { toast } from "../components/toast";
import { bridgeOn, bridgeSend } from "../lib/bridge";
import type { ComposerTrigger } from "../lib/composer-detect";
import { detectComposerTrigger } from "../lib/composer-detect";
import { extractMentions } from "../lib/mentions";
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

/**
 * Aggregated usage stats for a turn, including token breakdown, cost, and context usage.
 */
interface UsageStats {
  tokens: { input: number; output: number; cacheRead: number; cacheWrite: number; total: number };
  cost: number;
  contextUsage?: { tokens: number | null; contextWindow: number; percent: number | null };
}

// ---------------------------------------------------------------------------
// Chat (root)
// ---------------------------------------------------------------------------

/** Props for the Chat root component. */
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
  const [messages, setMessages] = useState<ChatTimelineItem[]>([]);
  const [thinking, setThinking] = useState<string | null>(null);
  const [usage, setUsage] = useState<UsageStats | null>(null);

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
  const [slashOpen, setSlashOpen] = useState(false);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [activeTrigger, setActiveTrigger] = useState<ComposerTrigger | null>(null);
  const [userScrolledUp, setUserScrolledUp] = useState(false);

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

  // ── derived state ────────────────────────────────────────────────────────
  const agentStatus = externalAgentStatus ?? internalAgentStatus;
  const isStreaming = agentStatus.isStreaming;
  const runtimeUnavailable = agentStatus.phase === "disconnected" || agentStatus.phase === "error";
  const runtimeUnconfigured = agentStatus.runtimeConfigured === false;
  const rpcEnabled = runtime.rpcEnabled === true || agentStatus.rpcEnabled === true;
  // Show whatever the user has queued locally during streaming; the dismiss
  // and clear-all controls handle stale items if the engine drains them.
  const visibleQueued = isStreaming ? queued : [];
  const selectedModel =
    agentStatus.model == null
      ? undefined
      : models.find(
          (m) =>
            m.provider === agentStatus.model?.provider &&
            m.id === agentStatus.model?.id &&
            (m.instanceId ?? "default") === (agentStatus.model.instanceId ?? "default"),
        );
  const isApiProviderRuntime =
    agentStatus.model?.source === "api-provider" || agentStatus.model?.instanceId === "pi-sdk";
  const modelSupportsThinking = selectedModel?.reasoning ?? agentStatus.model?.reasoning ?? false;
  const showThinkingToggle = Boolean(
    agentStatus.model && (modelSupportsThinking || isApiProviderRuntime),
  );

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

  // ── bridge events ──────────────────────────────────────────────────────────
  useEffect(() => {
    const offs = [
      // State sync — full message/streaming state from host.
      bridgeOn("chat/state", (msg) => {
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

      // Files — populates the mention picker.
      bridgeOn("agent/files", (msg) => {
        setFiles(msg.files);
      }),

      // Runtime settings — thinking level, queue modes, compaction, retry.
      bridgeOn("agent/runtimeSettings", (msg) => {
        setRuntime(msg.settings);
      }),

      // Compaction — clears the queue and shows a toast.
      bridgeOn("agent/compacted", (msg) => {
        setQueued([]);
        toast.success(
          "Session compacted",
          msg.result.summary ? msg.result.summary : "History compacted into a summary.",
        );
      }),
    ];

    // Re-hydrate from the host on mount (e.g., tab switch).
    bridgeSend({ type: "chat/getState" });
    bridgeSend({ type: "chat/getModels", requestId: uid() });
    bridgeSend({ type: "chat/getCommands", requestId: uid() });

    return () => offs.forEach((off) => off());
  }, []);

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
  const canSend = !isCheckingAgent && !runtimeUnavailable && hasDraft;

  /**
   * Handles draft changes and triggers slash/mention popups.
   * Uses detectComposerTrigger to find if cursor is after a "/" or "@".
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
   */
  function submit(opts?: { followUp?: boolean }) {
    const trimmed = draft.trim();
    if (trimmed.length === 0 || isCheckingAgent || runtimeUnavailable) return;
    onDraftChange("");
    setSlashOpen(false);
    setMentionOpen(false);
    setUserScrolledUp(false);
    const mentions = extractMentions(trimmed);
    const mentionsArg = mentions.length > 0 ? mentions : undefined;
    onPromptHistoryAppend(trimmed);
    historyCursorRef.current = null;
    draftBeforeHistoryRef.current = "";

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
    bridgeSend({ type: "chat/compact", requestId: uid() });
    toast.info("Compacting session…");
  }

  function setThinkingLevel(level: ThinkingLevel) {
    setRuntime((r) => ({ ...r, thinkingLevel: level }));
    bridgeSend({ type: "chat/setThinkingLevel", requestId: uid(), level });
  }

  function dismissQueued(id: string) {
    setQueued((q) => q.filter((m) => m.id !== id));
  }

  function clearQueuedMode(mode: "steer" | "followUp") {
    setQueued((q) => q.filter((m) => m.mode !== mode));
  }

  function abort() {
    if (!isStreaming) return;
    bridgeSend({ type: "chat/abort" });
    getTextarea()?.focus();
  }

  /**
   * Routes keyboard events for the composer textarea.
   * When a slash/mention popup is open, delegates navigation to cmdk.
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
    // Idle:      Enter sends; Shift+Enter inserts newline; Cmd/Ctrl+Enter also sends (compat).
    // Streaming: Enter queues a follow-up (polite); Cmd/Ctrl+Enter steers (interrupts).
    if (e.key === "Enter" && !e.shiftKey) {
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

  /** Clears the trigger and dispatches a slash action (/new, /abort) instead of inserting text. */
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
    setUserScrolledUp(false);
    toast.success("New session started");
  }

  function selectMention(filePath: string) {
    insertAtTrigger(`@${filePath}`);
  }

  function openMentionPicker() {
    setActiveTrigger({ kind: "mention", start: draft.length, query: "" });
    setMentionOpen(true);
    setSlashOpen(false);
    bridgeSend({ type: "chat/listFiles", requestId: uid(), limit: 200 });
  }

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
          {isCheckingAgent ? (
            <AgentSetupState />
          ) : messages.length === 0 ? (
            <EmptyState
              runtimeUnconfigured={runtimeUnconfigured}
              rpcEnabled={rpcEnabled}
              onOpenSettings={onOpenSettings}
              onInsert={(text) => {
                onDraftChange(text);
                composerRef.current?.querySelector<HTMLTextAreaElement>("textarea")?.focus();
              }}
            />
          ) : (
            <Timeline messages={messages} />
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

      {/* Activity bar — always-on status strip above the composer */}
      <ActivityBar thinking={thinking} isStreaming={isStreaming} />

      {/* Composer — textarea, slash commands, mentions, model selector, send/abort */}
      <div className="shrink-0 px-2 pb-3 pt-2">
        <div ref={composerRef}>
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
          <QueueStrip
            queued={visibleQueued}
            onDismiss={dismissQueued}
            onClearMode={clearQueuedMode}
          />
          <InputGroup className="afx-surface-composer @container h-auto flex-col items-stretch">
            <InputGroupTextarea
              id="afx-chat-composer"
              value={draft}
              onChange={handleDraftChange}
              onKeyDown={onKeyDown}
              placeholder={
                isCheckingAgent
                  ? "Waiting for the agent runtime to be ready…"
                  : runtimeUnconfigured
                    ? rpcEnabled
                      ? "Configure a provider or fix Pi RPC in Settings…"
                      : "Configure an API provider or enable Pi RPC to continue…"
                    : runtimeUnavailable
                      ? "Reconnect the agent runtime to continue…"
                      : isStreaming
                        ? "Queue a follow-up… (⌘⏎ to steer this turn)"
                        : draft.length === 0 && commands.length > 0
                          ? "Try /afx-hello, /afx-scaffold, /afx-task…"
                          : "Ask AFX about this workspace…"
              }
              disabled={isCheckingAgent || runtimeUnavailable}
              rows={1}
              className="min-h-14 max-h-56"
            />
            <InputGroupAddon align="block-end" className="flex-wrap justify-between gap-1">
              <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  className="shrink-0"
                  onClick={openMentionPicker}
                  disabled={isCheckingAgent || runtimeUnavailable}
                  aria-label="Mention file"
                  title="Mention file"
                >
                  <AtSign />
                </Button>
                <ModelCombobox
                  models={models}
                  value={agentStatus.model}
                  disabled={isCheckingAgent || runtimeUnavailable}
                  onSelect={selectModel}
                  onOpenSettings={onOpenSettings}
                />
                {showThinkingToggle && (
                  <ThinkingLevelToggle level={runtime.thinkingLevel} onChange={setThinkingLevel} />
                )}
              </div>
              <div className="ml-auto flex shrink-0 items-center gap-1">
                {isStreaming && (
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={abort}
                    onMouseDown={(e) => e.preventDefault()}
                    aria-label="Stop"
                    title="Stop the active turn"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Square />
                  </Button>
                )}
                {isStreaming ? (
                  <>
                    <Button
                      size="sm"
                      variant={canSend ? "secondary" : "ghost"}
                      onClick={() => submit({ followUp: true })}
                      onMouseDown={(e) => e.preventDefault()}
                      disabled={!canSend}
                      aria-label="Queue follow-up"
                      title="Queue this message to run after the active turn (⏎)"
                      className="h-7 gap-1 px-2 text-[11px]"
                    >
                      <Plus className="size-3.5" />
                      Queue
                    </Button>
                    <Button
                      size="sm"
                      variant={canSend ? "default" : "ghost"}
                      onClick={() => submit({ followUp: false })}
                      onMouseDown={(e) => e.preventDefault()}
                      disabled={!canSend}
                      aria-label="Steer turn"
                      title="Interrupt the active turn and redirect with this message (⌘⏎)"
                      className="h-7 gap-1 px-2 text-[11px]"
                    >
                      <Zap className="size-3.5" />
                      Steer
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
        <FooterStrip
          usage={usage}
          isCheckingAgent={isCheckingAgent}
          runtimeUnavailable={runtimeUnavailable}
          runtimeUnconfigured={runtimeUnconfigured}
          isStreaming={isStreaming}
          rpcEnabled={rpcEnabled}
          agentPhase={agentStatus.phase}
          onPiWarningClick={recoveryActions?.onOpenSettings}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ActivityBar — always-on status strip above the composer.
// Two-line layout: label row + optional thinking preview during streaming.
// ---------------------------------------------------------------------------

interface ActivityBarProps {
  thinking: string | null;
  isStreaming: boolean;
}

function ActivityBar({ thinking, isStreaming }: ActivityBarProps) {
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
        {isStreaming ? (
          <span className="inline-block h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-afx-brand" />
        ) : (
          <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/30" />
        )}
        {isStreaming ? (
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
        ) : (
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground/50">
            idle
          </span>
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
// FooterStrip — single always-mounted row below the composer.
// Left: Pi pill (when RPC opted in) + Cpu icon + stats (tokens · ctx · cost).
// Right: contextual hint text (hidden on narrow widths via container query).
// Row height stays fixed to prevent composer jumps.
// ---------------------------------------------------------------------------

function FooterStrip({
  usage,
  isCheckingAgent,
  runtimeUnavailable,
  runtimeUnconfigured,
  isStreaming,
  rpcEnabled,
  agentPhase,
  onPiWarningClick,
}: {
  usage: UsageStats | null;
  isCheckingAgent: boolean;
  runtimeUnavailable: boolean;
  runtimeUnconfigured: boolean;
  isStreaming: boolean;
  rpcEnabled: boolean;
  agentPhase: AgentRuntimePhase;
  onPiWarningClick?: () => void;
}) {
  const hint = isCheckingAgent
    ? "Checking agent runtime readiness…"
    : runtimeUnconfigured
      ? rpcEnabled
        ? "Configure a provider or fix Pi RPC in Settings."
        : "Configure an API provider or enable Pi RPC in Settings."
      : runtimeUnavailable
        ? "Connection recovery is required before sending."
        : isStreaming
          ? "⏎ queues · ⌘⏎ steers · ⇧⏎ newline"
          : "⏎ sends · ↑ history";

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
                disabled={!status.running || runtime.isCompacting}
                className="inline-flex h-5 w-5 items-center justify-center rounded-sm text-muted-foreground/70 hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Compact session"
              >
                <Layers size={12} className={cn(runtime.isCompacting && "animate-pulse")} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {runtime.isCompacting ? "Compacting…" : "Compact session"}
            </TooltipContent>
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

// ---------------------------------------------------------------------------
// ThinkingLevelToggle — inline dropdown to set the active runtime&apos;s thinking depth.
// API-provider runtimes accept the same setting even when discovered models omit reasoning metadata.
// ---------------------------------------------------------------------------

const THINKING_LEVELS: ReadonlyArray<{ level: ThinkingLevel; label: string }> = [
  { level: "minimal", label: "Minimal" },
  { level: "low", label: "Low" },
  { level: "medium", label: "Medium" },
  { level: "high", label: "High" },
  { level: "xhigh", label: "Extra-high" },
];

function ThinkingLevelToggle({
  level,
  onChange,
}: {
  level: ThinkingLevel | undefined;
  onChange: (level: ThinkingLevel) => void;
}) {
  const current = THINKING_LEVELS.find((item) => item.level === level) ?? THINKING_LEVELS[2];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        type="button"
        aria-label="Thinking level"
        title={`Thinking: ${current.label}`}
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "cn-button min-w-0 max-w-full shrink-0 px-1.5",
        )}
      >
        <Brain className="shrink-0 text-afx-brand-soft" />
        <span className="hidden max-w-[4.75rem] truncate font-mono text-[10px] tracking-tight @[260px]:inline">
          {current.label}
        </span>
        <ChevronDown className="hidden shrink-0 text-muted-foreground @[260px]:block" />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="min-w-[10rem]">
        <DropdownMenuLabel className="font-mono uppercase tracking-[0.14em]">
          Thinking level
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={current.level}
          onValueChange={(value) => onChange(value as ThinkingLevel)}
        >
          {THINKING_LEVELS.map(({ level: l, label }) => (
            <DropdownMenuRadioItem key={l} value={l} className="text-[11px] font-medium">
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ---------------------------------------------------------------------------
// QueueStrip — visual list of messages staged while the agent is streaming.
// The engine handles the actual queueing; this strip only mirrors what we sent.
// ---------------------------------------------------------------------------

function QueueStrip({
  queued,
  onDismiss,
  onClearMode,
}: {
  queued: readonly QueuedMessage[];
  onDismiss: (id: string) => void;
  onClearMode: (mode: "steer" | "followUp") => void;
}) {
  const [followsExpanded, setFollowsExpanded] = useState(true);
  if (queued.length === 0) return null;

  const steers = queued.filter((q) => q.mode === "steer");
  const follows = queued.filter((q) => q.mode === "followUp");
  // Auto-collapse the follow-up list once it grows past a comfortable count.
  const autoCollapse = follows.length > 3;
  const showFollows = !autoCollapse || followsExpanded;

  return (
    <div className="mb-1.5 flex flex-col gap-1.5">
      {steers.length > 0 && (
        <section
          aria-label="Pending steers"
          className="rounded-md border border-afx-brand-soft/60 bg-afx-brand-soft/10 shadow-sm"
        >
          <header className="flex items-center gap-2 px-2 py-1">
            <Zap className="size-3 shrink-0 text-afx-brand-soft" />
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-afx-brand-soft">
              Steering this turn
            </span>
            <span className="font-mono text-[10px] text-muted-foreground">({steers.length})</span>
            {steers.length >= 2 && (
              <button
                type="button"
                onClick={() => onClearMode("steer")}
                className="ml-auto inline-flex items-center gap-1 rounded-sm px-1 py-0.5 text-[10px] text-muted-foreground/80 hover:bg-muted hover:text-foreground"
                title="Clear all queued steers"
              >
                <Trash2 size={10} />
                Clear
              </button>
            )}
          </header>
          <ul className="flex flex-col gap-0.5 px-2 pb-1.5">
            {steers.map((q, index) => (
              <QueueRow
                key={q.id}
                item={q}
                marker={steers.length > 1 ? `${index + 1}.` : "→"}
                onDismiss={onDismiss}
              />
            ))}
          </ul>
        </section>
      )}

      {follows.length > 0 && (
        <section
          aria-label="Queued follow-ups"
          className="rounded-md border border-border bg-muted/60 shadow-sm"
        >
          <header className="flex items-center gap-2 px-2 py-1">
            <button
              type="button"
              onClick={() => setFollowsExpanded((v) => !v)}
              className="inline-flex items-center gap-1 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground"
              aria-expanded={showFollows}
              title={showFollows ? "Collapse" : "Expand"}
            >
              {showFollows ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
              Queued after this turn
            </button>
            <span className="font-mono text-[9px] text-muted-foreground">({follows.length})</span>
            {follows.length >= 2 && (
              <button
                type="button"
                onClick={() => onClearMode("followUp")}
                className="ml-auto inline-flex items-center gap-1 rounded-sm px-1 py-0.5 text-[10px] text-muted-foreground/80 hover:bg-muted hover:text-foreground"
                title="Clear all queued follow-ups"
              >
                <Trash2 size={10} />
                Clear
              </button>
            )}
          </header>
          {showFollows && (
            <ul className="flex flex-col gap-0.5 px-2 pb-1.5">
              {follows.map((q, index) => (
                <QueueRow key={q.id} item={q} marker={`${index + 1}.`} onDismiss={onDismiss} />
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

function QueueRow({
  item,
  marker,
  onDismiss,
}: {
  item: QueuedMessage;
  marker: string;
  onDismiss: (id: string) => void;
}) {
  return (
    <li
      className="group/queue-item flex items-start gap-2 rounded-sm py-0.5 pl-1 pr-0.5 hover:bg-muted/60"
      title={
        item.mode === "steer"
          ? "Steers the active turn at the next agent step"
          : "Runs after the active turn completes"
      }
    >
      <span
        className={cn(
          "mt-[1px] shrink-0 font-mono text-[10px] tabular-nums",
          item.mode === "steer" ? "text-afx-brand-soft" : "text-muted-foreground/80",
        )}
      >
        {marker}
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
  | { id: string; kind: "tool"; tool: ChatToolView }
  | { id: string; kind: "thinking"; preview: string }
  | { id: string; kind: "compaction"; summary: string; tokensBefore: number; createdAt: number };

/**
 * Converts a flat message list into a timeline of events.
 * Tools are placed before their parent assistant message.
 */
function Timeline({ messages }: { messages: ChatTimelineItem[] }) {
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
    // Assistant: tools first (they ran before the final content), then the message itself.
    for (const t of m.tools ?? []) {
      events.push({ id: `${m.id}-${t.toolCallId}`, kind: "tool", tool: t });
    }
    const isError = m.content.startsWith("⚠");
    const isInfo = m.content.startsWith("ℹ");
    events.push({
      id: m.id,
      kind: isError ? "error" : isInfo ? "info" : "assistant",
      message: m,
    });
  }

  return (
    <ol className="relative flex flex-col">
      {events.map((event, i) => (
        <TimelineRow key={event.id} event={event} isLast={i === events.length - 1} />
      ))}
    </ol>
  );
}

/**
 * Renders a single timeline row with a rail marker, event header, and event body.
 * The rail line is hidden for the last row to avoid dangling at the bottom.
 */
function TimelineRow({ event, isLast }: { event: TimelineEvent; isLast: boolean }) {
  return (
    <li className="relative grid grid-cols-[20px_minmax(0,1fr)] gap-x-2.5 pb-3 last:pb-0">
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

// Avatar circles for the conversation participants (user, AFX). System events
// (tools, errors, thinking) render as plain icons against the rail to reduce
// visual noise and keep the focus on the dialogue.
const MARKER_AVATAR =
  "relative flex h-5 w-5 items-center justify-center rounded-full ring-[3px] ring-background";
const MARKER_PLAIN = "relative flex h-5 w-5 items-center justify-center bg-background";

/** Renders the rail marker for each timeline event type. */
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

  // thinking — pulsing indicator during live streaming.
  return (
    <span aria-hidden className={cn(MARKER_PLAIN, "animate-pulse text-afx-brand-soft")}>
      <Brain size={12} className="shrink-0" strokeWidth={2.25} />
    </span>
  );
}

/** EventHeader — renders the eyebrow label (e.g., "You", "AFX") for message events. */
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
  if (event.kind === "thinking") {
    return (
      <div className="flex items-center gap-1.5 text-[11px]">
        <span className="flex items-center gap-1 italic text-afx-brand-soft">
          thinking
          <span className="inline-flex gap-0.5">
            <span className="animate-pulse">.</span>
            <span className="animate-pulse [animation-delay:150ms]">.</span>
            <span className="animate-pulse [animation-delay:300ms]">.</span>
          </span>
        </span>
      </div>
    );
  }
  if (event.kind === "compaction") {
    return <Eyebrow tone="brand" label="Session compacted" timestamp={event.createdAt} />;
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

// ---------------------------------------------------------------------------
// ThinkingTrace — collapsible reasoning block in the message timeline.
// No card chrome; first ~60 chars shown as inline preview when collapsed.
// ---------------------------------------------------------------------------

function ThinkingTrace({ preview }: { preview: string }) {
  const [open, setOpen] = useState(false);
  const firstLine = preview.length > 60 ? preview.slice(0, 60) + "…" : preview;
  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-start gap-1.5 text-left"
      >
        <Brain size={11} className="mt-0.5 shrink-0 text-afx-brand-soft" />
        <span className="font-serif text-[11px] italic text-muted-foreground">{firstLine}</span>
        <ChevronRight
          size={11}
          className={cn(
            "ml-auto mt-0.5 shrink-0 text-muted-foreground/40 transition-transform",
            open && "rotate-90",
          )}
        />
      </button>
      {open && (
        <div className="mt-1 pl-5 whitespace-pre-wrap break-words font-serif text-[11px] italic leading-relaxed text-muted-foreground/70">
          {preview}
        </div>
      )}
    </div>
  );
}

/** EventBody — renders the content for each timeline event type. */
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
  if (event.kind === "thinking") {
    return <ThinkingTrace preview={event.preview} />;
  }
  if (event.kind === "compaction") {
    return <CompactionCard summary={event.summary} tokensBefore={event.tokensBefore} />;
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

/** A single row in the ToolEvent table with a label gutter and content cell. */
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
