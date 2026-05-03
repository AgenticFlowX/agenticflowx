/**
 * History view — active-session work log derived from current transcript events.
 *
 * @see docs/specs/210-app-chat/spec.md [FR-6]
 * @see docs/specs/210-app-chat/design.md [DES-UI]
 * @see docs/specs/213-app-chat-history/spec.md [FR-1] [FR-2] [FR-3] [FR-4] [FR-5] [FR-6] [FR-7]
 * @see docs/specs/213-app-chat-history/design.md [DES-HISTORY-MOCKUP-LIVE] [DES-HISTORY-COMPONENT-OVERLAY]
 */
import { type ReactNode, useEffect, useMemo, useState } from "react";

import {
  AlertTriangle,
  BookOpen,
  Bot,
  CheckCircle2,
  FileCode,
  Gauge,
  Hammer,
  ListTree,
  LoaderCircle,
  MessageSquareText,
  PencilLine,
  RefreshCw,
  Scissors,
  Search,
  Sparkles,
  Terminal,
  UserRound,
} from "lucide-react";

import type {
  AgentRuntimeStatus,
  AgentStatus,
  ChatMessageView,
  ChatTimelineItem,
  ChatToolView,
} from "@afx/shared";
import { createCheckingAgentRuntimeStatus } from "@afx/shared";
import { Button } from "@afx/ui/components/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@afx/ui/components/card";
import { Input } from "@afx/ui/components/input";
import { cn } from "@afx/ui/lib/utils";

import { type AgentRecoveryActions, AgentRecoveryCard } from "../components/agent-recovery-card";
import { bridgeOn, bridgeSend } from "../lib/bridge";
import {
  type ChatHistoryEvent,
  type HistoryDensity,
  deriveHistoryEvents,
} from "../lib/history-events";

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
>;

type HistorySectionModel = { label: string; items: ChatHistoryEvent[] };

export interface HistoryProps {
  agentStatus?: AgentRuntimeStatus;
  recoveryActions?: AgentRecoveryActions;
  isCheckingAgent?: boolean;
  onInsertCommand?: (commandText: string) => void;
}

/**
 * Renders the active-session History surface, bridge subscriptions, and local
 * filter state for the work log.
 *
 * @see docs/specs/213-app-chat-history/spec.md [FR-1] [FR-2] [FR-5] [FR-6]
 * @see docs/specs/213-app-chat-history/design.md [DES-HISTORY-MOCKUP-LIVE] [DES-HISTORY-SURFACE-MAP]
 */
export default function History({
  agentStatus = createCheckingAgentRuntimeStatus(),
  recoveryActions,
  isCheckingAgent = false,
  onInsertCommand,
}: HistoryProps) {
  const [messages, setMessages] = useState<ChatTimelineItem[]>([]);
  const [query, setQuery] = useState("");
  const [density, setDensity] = useState<HistoryDensity>("trace");
  const [runtime, setRuntime] = useState<RuntimeSettings>({});
  const runtimeUnconfigured = agentStatus.runtimeConfigured === false;
  const runtimeUnavailable =
    !runtimeUnconfigured && (agentStatus.phase === "disconnected" || agentStatus.phase === "error");

  useEffect(() => {
    const offs = [
      bridgeOn("chat/state", (msg) => {
        setMessages(msg.messages);
      }),
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
      }),
      bridgeOn("chat/messageDelta", (msg) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msg.id && "content" in m ? { ...m, content: m.content + msg.delta } : m,
          ),
        );
      }),
      bridgeOn("chat/messageEnd", (msg) => {
        setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, streaming: false } : m)));
      }),
      bridgeOn("chat/toolStart", (msg) => {
        setMessages((prev) => attachTool(prev, msg.toolCallId, msg.toolName, toolArgs(msg.args)));
      }),
      bridgeOn("chat/toolEnd", (msg) => {
        setMessages((prev) =>
          prev.map((m) => {
            if (!("tools" in m)) return m;
            const typed = m;
            return {
              ...typed,
              tools: (typed.tools ?? []).map((t: ChatToolView) =>
                t.toolCallId === msg.toolCallId
                  ? { ...t, status: msg.ok ? "ok" : "error", summary: msg.summary }
                  : t,
              ),
            };
          }),
        );
      }),
      bridgeOn("chat/error", (msg) => {
        if (msg.displayInTranscript === false) return;
        setMessages((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            role: "assistant",
            content: `⚠ ${msg.message}`,
            createdAt: Date.now(),
          },
        ]);
      }),
      bridgeOn("agent/runtimeSettings", (msg) => {
        setRuntime(msg.settings);
      }),
    ];

    bridgeSend({ type: "chat/getState" });
    return () => offs.forEach((off) => off());
  }, []);

  const events = useMemo(() => deriveHistoryEvents(messages), [messages]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    // narrative = messages only; trace = + usage; audit = + tool events.
    const densityFiltered = events.filter((event) => {
      if (density === "audit") return true;
      if (density === "trace") return event.density !== "audit";
      return event.density === "narrative";
    });
    if (!q) return densityFiltered;
    return densityFiltered.filter((event) => eventMatches(event, q));
  }, [events, query, density]);

  const sections = useMemo(() => groupByDay(filtered), [filtered]);

  // Surface: [History.Root]
  return (
    <div className="afx-surface-subtle flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
      {/* Surface: [History.Header] */}
      <div className="shrink-0 border-b bg-background/95 px-2 py-3">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-[15px] font-semibold text-foreground">
              <span className="afx-surface-card flex h-7 w-7 shrink-0 items-center justify-center rounded-md border text-afx-brand-soft">
                <MessageSquareText size={15} />
              </span>
              History
            </h2>
            <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
              {runtime.sessionName || runtime.sessionId
                ? "Active session work log"
                : "Start a thread to build the work log"}
              {runtime.sessionId ? (
                <span className="ml-1.5 font-mono text-[10px] opacity-60">
                  · {runtime.sessionId.slice(0, 8)}
                </span>
              ) : null}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <TraceChip>{events.length} events</TraceChip>
              <TraceChip>
                {(runtime.messageCount ?? messages.length).toLocaleString()} messages
              </TraceChip>
              {runtime.pendingMessageCount && runtime.pendingMessageCount > 0 ? (
                <TraceChip tone="warning">{runtime.pendingMessageCount} queued</TraceChip>
              ) : null}
              {runtime.isCompacting ? <TraceChip tone="warning">compacting</TraceChip> : null}
              <TraceChip tone={runtimeUnavailable || runtimeUnconfigured ? "warning" : "success"}>
                {runtimeUnconfigured ? "setup" : runtimeUnavailable ? "cached" : "live"}
              </TraceChip>
            </div>
          </div>
          <Button
            type="button"
            size="xs"
            variant="ghost"
            className="h-6 px-1.5"
            onClick={() => bridgeSend({ type: "chat/getState" })}
            disabled={isCheckingAgent || runtimeUnavailable || runtimeUnconfigured}
            aria-label="Refresh history"
          >
            <RefreshCw size={12} />
            Refresh
          </Button>
        </div>

        {/* Surface: [History.Context] */}
        <ContextPreviewCard runtime={runtime} onInsertCommand={onInsertCommand} />

        {/* Surface: [History.FilterBar] */}
        <div className="afx-field-surface rounded-lg border p-2">
          <div className="mb-2 flex flex-wrap items-center gap-1">
            {(["narrative", "trace", "audit"] as const).map((mode) => (
              <Button
                key={mode}
                type="button"
                size="xs"
                variant={density === mode ? "secondary" : "ghost"}
                className={cn(
                  "h-6 rounded-sm px-2 font-mono text-[10px] uppercase tracking-[0.08em]",
                  density === mode && "border border-border/70 bg-muted",
                )}
                onClick={() => setDensity(mode)}
              >
                {mode}
              </Button>
            ))}
          </div>

          <div className="relative">
            <Search
              size={12}
              className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                isCheckingAgent
                  ? "Work log loads when the runtime is ready…"
                  : runtimeUnconfigured
                    ? "Configure a runtime to load the work log…"
                    : runtimeUnavailable
                      ? "Search cached active-session rows…"
                      : "Search work log…"
              }
              disabled={isCheckingAgent}
              className="h-7 bg-background/80 pl-7 text-xs"
            />
          </div>
        </div>
      </div>

      {/*
        Surface: [History.Body]
        @see docs/specs/213-app-chat-history/design.md [DES-HISTORY-SURFACE-BODY]
      */}
      <HistoryBody
        agentStatus={agentStatus}
        eventCount={events.length}
        isCheckingAgent={isCheckingAgent}
        recoveryActions={recoveryActions}
        runtimeUnavailable={runtimeUnavailable}
        runtimeUnconfigured={runtimeUnconfigured}
        sections={sections}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// ContextPreviewCard — two-section card explaining agent session vs workspace context.
// ---------------------------------------------------------------------------

/**
 * Renders the [History.Context] card for session and workspace context actions.
 *
 * @see docs/specs/213-app-chat-history/spec.md [FR-4]
 * @see docs/specs/213-app-chat-history/design.md [DES-HISTORY-SURFACE-CONTEXT]
 */
function ContextPreviewCard({
  runtime,
  onInsertCommand,
}: {
  runtime: RuntimeSettings;
  onInsertCommand?: (commandText: string) => void;
}) {
  return (
    <div className="mb-3 rounded-md border border-border/60 bg-muted/20 px-2.5 py-2.5">
      <div className="mb-2.5 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
        <BookOpen size={10} className="text-afx-brand-soft/60" />
        Context
      </div>

      {/* Section 1 — Agent session: internal, managed automatically */}
      <div className="mb-2.5">
        <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground/50">
          Agent session
        </p>
        <p className="text-[11px] leading-relaxed text-muted-foreground/50">
          The agent manages its own session state automatically — conversation history, tool calls,
          and compaction are maintained internally.
          {runtime.sessionId ? (
            <span className="ml-1 font-mono text-[10px] text-afx-brand-soft/50">
              Session {runtime.sessionId.slice(0, 8)}
            </span>
          ) : null}
        </p>
      </div>

      <div className="mb-2.5 border-t border-border/40" />

      {/* Section 2 — AFX workspace context: user-saved, cross-session */}
      <div>
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground/50">
            AFX workspace context
          </p>
          <button
            type="button"
            onClick={() => onInsertCommand?.("/afx-context save")}
            disabled={!onInsertCommand}
            className="inline-flex items-center gap-1 rounded-sm border border-border/50 bg-muted/40 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground/70 transition-colors hover:border-afx-brand-soft/40 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            Save
          </button>
        </div>
        <p className="text-[11px] leading-relaxed text-muted-foreground/50">
          No workspace context saved yet. Run{" "}
          <span className="break-all font-mono text-[10px] text-afx-brand-soft/70">
            /afx-context save
          </span>{" "}
          to capture a summary you can reload in future sessions.
        </p>
      </div>
    </div>
  );
}

/**
 * Renders the [History.Body] scroll region and its runtime/search/list state
 * matrix.
 *
 * @see docs/specs/213-app-chat-history/spec.md [FR-1] [FR-5] [FR-6] [FR-7]
 * @see docs/specs/213-app-chat-history/design.md [DES-HISTORY-SURFACE-BODY]
 */
function HistoryBody({
  agentStatus,
  eventCount,
  isCheckingAgent,
  recoveryActions,
  runtimeUnavailable,
  runtimeUnconfigured,
  sections,
}: {
  agentStatus: AgentRuntimeStatus;
  eventCount: number;
  isCheckingAgent: boolean;
  recoveryActions?: AgentRecoveryActions;
  runtimeUnavailable: boolean;
  runtimeUnconfigured: boolean;
  sections: HistorySectionModel[];
}) {
  let content: ReactNode;

  if (isCheckingAgent) {
    content = <HistorySetupState />;
  } else if (runtimeUnconfigured) {
    content = (
      <div className="px-3 py-8 text-center">
        <p className="text-xs text-muted-foreground">
          No runtime configured yet. Connect a provider in Settings to build the work log.
        </p>
      </div>
    );
  } else if (runtimeUnavailable) {
    content = (
      <div className="px-1 py-1">
        <AgentRecoveryCard status={agentStatus} actions={recoveryActions} />
        {sections.length > 0 ? (
          <div className="mt-3 space-y-2 opacity-70">
            {sections.map((section) => (
              <HistorySection key={section.label} section={section} />
            ))}
          </div>
        ) : null}
      </div>
    );
  } else if (sections.length === 0) {
    content = (
      <div className="px-3 py-8 text-center">
        <p className="text-xs text-muted-foreground">
          {eventCount === 0
            ? "No active-session events yet. Start chatting to build the work log."
            : "No matching active-session events."}
        </p>
      </div>
    );
  } else {
    content = sections.map((section) => <HistorySection key={section.label} section={section} />);
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-2 py-3 [scrollbar-width:thin] [scrollbar-color:var(--border)_transparent]">
      {content}
    </div>
  );
}

/**
 * Renders the [History.SetupState] loading card while the runtime is checked.
 *
 * @see docs/specs/213-app-chat-history/spec.md [FR-6]
 * @see docs/specs/213-app-chat-history/design.md [DES-HISTORY-MOCKUP-EMPTY] [DES-HISTORY-SURFACE-BODY]
 */
function HistorySetupState() {
  return (
    <div className="px-3 py-8 text-center" aria-live="polite">
      <Card size="sm" className="mx-auto max-w-xs border-afx-brand-soft/30 bg-card/80">
        <CardHeader className="items-center text-center">
          <CardTitle className="flex items-center gap-2">
            <LoaderCircle size={14} className="animate-spin text-afx-brand-soft" />
            Checking agent runtime
          </CardTitle>
          <CardDescription>
            Chat history will refresh once the active runtime connection is ready.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}

/**
 * Renders a [History.Section] sticky day group.
 *
 * @see docs/specs/213-app-chat-history/spec.md [FR-7]
 * @see docs/specs/213-app-chat-history/design.md [DES-HISTORY-SURFACE-SECTIONS]
 */
function HistorySection({ section }: { section: HistorySectionModel }) {
  return (
    <section className="mb-3 last:mb-0">
      <div className="sticky top-0 z-10 -mx-2 mb-1 border-y bg-muted/80 px-2 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground backdrop-blur-sm">
        <span className="inline-flex items-center gap-1.5">
          <Sparkles size={10} className="text-afx-brand-soft" />
          {section.label}
        </span>
      </div>
      <ul className="divide-y divide-border/40">
        {section.items.map((turn) => (
          <HistoryEventRow key={turn.id} event={turn} />
        ))}
      </ul>
    </section>
  );
}

/**
 * Renders a single [History.Row] event item.
 *
 * @see docs/specs/213-app-chat-history/spec.md [FR-7]
 * @see docs/specs/213-app-chat-history/design.md [DES-HISTORY-SURFACE-SECTIONS]
 */
function HistoryEventRow({ event }: { event: ChatHistoryEvent }) {
  const statusClass =
    event.status === "error"
      ? "text-destructive"
      : event.status === "running"
        ? "text-afx-brand"
        : event.kind === "usage"
          ? "text-afx-info"
          : event.kind === "compaction"
            ? "text-afx-brand-soft"
            : "text-muted-foreground";

  return (
    <li className="group flex items-start gap-2 px-1 py-2 transition-colors hover:bg-muted/40">
      <span className="mt-0.5 shrink-0">{renderEventIcon(event, cn("shrink-0", statusClass))}</span>
      <div className="min-w-0 flex-1 leading-snug">
        <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 text-[12px]">
          <p className="min-w-0 truncate">
            <span className="font-medium text-foreground/90">{event.action}</span>
            <span className="ml-1.5 text-muted-foreground">{event.target}</span>
            {event.kind === "compaction" &&
              event.compaction &&
              event.compaction.tokensBefore > 0 && (
                <span className="ml-1.5 text-[10px] text-afx-brand-soft">
                  (−{formatCompact(event.compaction.tokensBefore)} tokens)
                </span>
              )}
          </p>
          <span className="shrink-0 font-mono text-[10px] text-muted-foreground/60">
            {formatTime(event.createdAt)}
          </span>
        </div>
        {event.detail || event.status === "running" ? (
          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            {event.detail ? <span className="truncate">{event.detail}</span> : null}
            {event.status === "running" ? (
              <span className="inline-flex items-center gap-1 text-afx-brand">
                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-afx-brand" />
                live
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </li>
  );
}

/**
 * Renders the compact header metadata chips in [History.Header].
 *
 * @see docs/specs/213-app-chat-history/spec.md [FR-3]
 * @see docs/specs/213-app-chat-history/design.md [DES-HISTORY-SURFACE-HEADER]
 */
function TraceChip({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: "default" | "success" | "warning";
}) {
  const toneClass =
    tone === "success"
      ? "border-afx-success/30 text-afx-success"
      : tone === "warning"
        ? "border-afx-brand-soft/40 text-afx-brand-soft"
        : "border-border text-muted-foreground";
  return (
    <span
      className={cn(
        "rounded-sm border bg-muted/30 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em]",
        toneClass,
      )}
    >
      {children}
    </span>
  );
}

/**
 * Mirrors `chat/toolStart` into the latest assistant timeline item.
 *
 * @see docs/specs/213-app-chat-history/spec.md [FR-2]
 * @see docs/specs/213-app-chat-history/design.md [DES-API]
 */
function attachTool(
  messages: ChatTimelineItem[],
  toolCallId: string,
  toolName: string,
  args?: Record<string, unknown>,
): ChatTimelineItem[] {
  const copy = [...messages];
  for (let i = copy.length - 1; i >= 0; i--) {
    if (copy[i].role === "assistant" && "tools" in copy[i]) {
      const m = copy[i] as ChatMessageView;
      const tools = [...(m.tools ?? [])];
      tools.push({ toolCallId, toolName, status: "running" as const, args });
      copy[i] = { ...m, tools };
      break;
    }
  }
  return copy;
}

function toolArgs(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

/**
 * Groups filtered events into sticky day sections for [History.Section].
 *
 * @see docs/specs/213-app-chat-history/spec.md [FR-7]
 * @see docs/specs/213-app-chat-history/design.md [DES-HISTORY-SURFACE-SECTIONS]
 */
function groupByDay(events: ChatHistoryEvent[]): HistorySectionModel[] {
  const map = new Map<string, ChatHistoryEvent[]>();

  for (const event of events) {
    const label = formatDay(event.createdAt);
    if (!map.has(label)) map.set(label, []);
    map.get(label)!.push(event);
  }

  return Array.from(map.entries()).map(([label, items]) => ({ label, items }));
}

function formatDay(ts: number): string {
  const date = new Date(ts);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const deltaDays = Math.floor((today - day) / (1000 * 60 * 60 * 24));

  if (deltaDays === 0) return "Today";
  if (deltaDays === 1) return "Yesterday";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Formats a token count (e.g., 12500 → "12.5k"). */
function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

/**
 * Applies History search text across row action, target, detail, and kind.
 *
 * @see docs/specs/213-app-chat-history/spec.md [FR-5]
 * @see docs/specs/213-app-chat-history/design.md [DES-DATA]
 */
function eventMatches(event: ChatHistoryEvent, query: string): boolean {
  return `${event.action} ${event.target} ${event.detail ?? ""} ${event.kind}`
    .toLowerCase()
    .includes(query);
}

/**
 * Chooses the row icon for each History event kind.
 *
 * @see docs/specs/213-app-chat-history/spec.md [FR-7] [FR-9]
 * @see docs/specs/213-app-chat-history/design.md [DES-HISTORY-SURFACE-SECTIONS]
 */
function renderEventIcon(event: ChatHistoryEvent, className: string) {
  switch (event.kind) {
    case "message.user":
      return <UserRound size={13} className={className} />;
    case "message.assistant":
      return <Bot size={13} className={className} />;
    case "file.read":
      return <FileCode size={13} className={className} />;
    case "file.edit":
      return <PencilLine size={13} className={className} />;
    case "command.run":
      return <Terminal size={13} className={className} />;
    case "search":
      return <Search size={13} className={className} />;
    case "list":
      return <ListTree size={13} className={className} />;
    case "usage":
      return <Gauge size={13} className={className} />;
    case "failed":
      return <AlertTriangle size={13} className={className} />;
    case "compaction":
      return <Scissors size={13} className={className} />;
    case "activity":
      return event.status === "ok" ? (
        <CheckCircle2 size={13} className={className} />
      ) : (
        <Hammer size={13} className={className} />
      );
  }
  return <Hammer size={13} className={className} />;
}
