/**
 * Conversation timeline event adapter and rows.
 *
 * @see docs/specs/212-app-chat-messages/design.md [DES-MESSAGES-COMPONENTS] [DES-MESSAGES-EVENT-FLOW]
 */
import {
  type ReactNode,
  type Ref,
  type RefObject,
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Info,
  PenLine,
  Scissors,
  Terminal,
  UserRound,
} from "lucide-react";

import type { ChatMessageView, ChatTimelineItem, ChatToolView } from "@afx/shared";
import { cn } from "@afx/ui/lib/utils";

import {
  parseResultActions,
  stripLegacyUiActionBlocks,
  stripResultActionSections,
} from "../../lib/result-actions";
import { toolDescriptor } from "../../lib/tool-descriptor";
import { AfxLogoIcon } from "../afx-logo";
import { MarkdownMessage } from "../markdown-message";
import { OutputCard } from "../output-card";
import { ResultActions } from "../result-actions";

export interface ConversationNoteEventView {
  id: string;
  content: string;
  savedAt: number;
}

export interface ConversationCommandOutputView {
  requestId: string;
  command: string;
  stdout: string;
  stderr: string;
  exitCode?: number;
  error?: string;
  createdAt: number;
}

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

type TurnEvent = Extract<
  TimelineEvent,
  { kind: "user" | "assistant" | "tool" | "shell" | "error" | "info" }
>;
type SystemEvent = Extract<TimelineEvent, { kind: "compaction" | "note" }>;

interface TimelineTurnGroup {
  kind: "turn";
  id: string;
  events: TurnEvent[];
}

interface TimelineSystemItem {
  kind: "system";
  id: string;
  event: SystemEvent;
}

type TimelineDayItem = TimelineTurnGroup | TimelineSystemItem;

interface TimelineDayGroup {
  id: string;
  dateKey: string;
  label: string;
  turnCount: number;
  items: TimelineDayItem[];
}

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
export const ConversationTimeline = memo(function ConversationTimeline({
  messages,
  noteEvents,
  commandOutputs,
  onSendCommand,
  onInsertCommand,
}: {
  messages: ChatTimelineItem[];
  noteEvents: ConversationNoteEventView[];
  commandOutputs: ConversationCommandOutputView[];
  onSendCommand: (command: string) => void;
  onInsertCommand: (command: string) => void;
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

  const groups = buildTimelineGroups(events);

  const hasErrorEvent = events.some(
    (event) => event.kind === "error" || (event.kind === "shell" && Boolean(event.error)),
  );

  return (
    <>
      {hasErrorEvent ? (
        <span role="alert" className="sr-only">
          Conversation contains an error event.
        </span>
      ) : null}
      <ol
        className="relative flex flex-col"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        aria-atomic="false"
      >
        {groups.map((group) => (
          <DayGroup
            key={group.id}
            group={group}
            onSendCommand={onSendCommand}
            onInsertCommand={onInsertCommand}
          />
        ))}
      </ol>
    </>
  );
});

/**
 * Groups flat events into day sections and conversational turns.
 * User events start a new turn; AFX/tool/shell events attach to the active turn.
 * Note and compaction rows stay standalone so timeline history never pretends
 * that system history came from either participant.
 *
 * @see docs/specs/212-app-chat-messages/spec.md [FR-1]
 * @see docs/specs/212-app-chat-messages/design.md [DES-MESSAGES-COMPONENTS] [DES-MESSAGES-EVENT-FLOW]
 */
function buildTimelineGroups(events: TimelineEvent[]): TimelineDayGroup[] {
  const sorted = events.slice().sort((a, b) => getEventTime(a) - getEventTime(b));
  const days: TimelineDayGroup[] = [];
  let currentDay: TimelineDayGroup | null = null;
  let currentTurn: TimelineTurnGroup | null = null;

  function ensureDay(event: TimelineEvent): TimelineDayGroup {
    const ts = getEventTime(event);
    const dateKey = formatDayKey(ts);
    if (currentDay?.dateKey === dateKey) return currentDay;
    currentDay = {
      id: `day-${dateKey}`,
      dateKey,
      label: formatDayLabel(ts),
      turnCount: 0,
      items: [],
    };
    days.push(currentDay);
    currentTurn = null;
    return currentDay;
  }

  function pushTurn(day: TimelineDayGroup, event: TurnEvent): TimelineTurnGroup {
    const turn: TimelineTurnGroup = {
      kind: "turn",
      id: `turn-${event.id}`,
      events: [event],
    };
    day.items.push(turn);
    day.turnCount += 1;
    return turn;
  }

  for (const event of sorted) {
    const day = ensureDay(event);
    if (event.kind === "note" || event.kind === "compaction") {
      day.items.push({ kind: "system", id: `system-${event.id}`, event });
      currentTurn = null;
      continue;
    }
    if (event.kind === "user" || !currentTurn) {
      currentTurn = pushTurn(day, event);
      continue;
    }
    currentTurn.events.push(event);
  }

  return days;
}

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

function formatDayKey(ts: number): string {
  const d = new Date(ts);
  const year = d.getFullYear();
  const month = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDayLabel(ts: number): string {
  const d = new Date(ts);
  const weekday = d.toLocaleDateString(undefined, { weekday: "short" }).toUpperCase();
  const month = d.toLocaleDateString(undefined, { month: "short" }).toUpperCase();
  return `${weekday}, ${d.getDate()} ${month}`;
}

function summarizePrompt(content: string): string {
  const normalized = normalizePrompt(content);
  return normalized.length > 220 ? `${normalized.slice(0, 220)}…` : normalized;
}

function normalizePrompt(content: string): string {
  return content.replace(/\s+/g, " ").trim();
}

function DayGroup({
  group,
  onSendCommand,
  onInsertCommand,
}: {
  group: TimelineDayGroup;
  onSendCommand: (command: string) => void;
  onInsertCommand: (command: string) => void;
}) {
  return (
    <li className="mb-4 last:mb-0" data-timeline-day={group.dateKey}>
      <DayHeader label={group.label} turnCount={group.turnCount} />
      <ol className="mt-2 flex flex-col gap-3">
        {group.items.map((item) =>
          item.kind === "turn" ? (
            <TurnGroup
              key={item.id}
              turn={item}
              onSendCommand={onSendCommand}
              onInsertCommand={onInsertCommand}
            />
          ) : (
            <SystemRow
              key={item.id}
              event={item.event}
              onSendCommand={onSendCommand}
              onInsertCommand={onInsertCommand}
            />
          ),
        )}
      </ol>
    </li>
  );
}

function DayHeader({ label, turnCount }: { label: string; turnCount: number }) {
  return (
    <div
      data-testid="timeline-day-header"
      className="sticky top-0 z-40 flex items-center gap-2 rounded-md border border-border/50 bg-background px-2.5 py-1.5 shadow-sm"
    >
      <span
        className="size-1.5 rounded-full bg-afx-brand-soft shadow-[0_0_6px_var(--afx-brand-soft)]"
        aria-hidden
      />
      <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground">
        {label}
      </span>
      <span className="ml-auto font-mono text-[10px] text-muted-foreground/70">
        {turnCount} {turnCount === 1 ? "turn" : "turns"}
      </span>
    </div>
  );
}

/**
 * Renders a conversational turn with one calm rail and participant markers.
 *
 * @see docs/specs/212-app-chat-messages/spec.md [FR-1]
 * @see docs/specs/212-app-chat-messages/design.md [DES-MESSAGES-COMPONENTS] [DES-MESSAGES-MOCKUP-ASSISTANT]
 */
const TurnGroup = memo(function TurnGroup({
  turn,
  onSendCommand,
  onInsertCommand,
}: {
  turn: TimelineTurnGroup;
  onSendCommand: (command: string) => void;
  onInsertCommand: (command: string) => void;
}) {
  const userEvent = turn.events.find(
    (event): event is Extract<TurnEvent, { kind: "user" }> => event.kind === "user",
  );
  const userRowRef = useRef<HTMLLIElement | null>(null);
  const showTurnContext = useUserRowScrolledAbove(userRowRef);
  const handleJumpToUserMessage = useCallback(() => {
    userRowRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <li className="relative" data-timeline-turn={turn.id}>
      {userEvent && showTurnContext ? (
        <TurnContextBar event={userEvent} onJumpToMessage={handleJumpToUserMessage} />
      ) : null}
      <span
        aria-hidden
        className="pointer-events-none absolute top-5 bottom-1 left-[10px] w-px -translate-x-1/2 bg-border/60"
      />
      <ol className="flex flex-col gap-2">
        {turn.events.map((event) => (
          <TurnEventRow
            key={event.id}
            event={event}
            rowRef={event.kind === "user" ? userRowRef : undefined}
            onSendCommand={onSendCommand}
            onInsertCommand={onInsertCommand}
          />
        ))}
      </ol>
    </li>
  );
});

function TurnContextBar({
  event,
  onJumpToMessage,
}: {
  event: Extract<TurnEvent, { kind: "user" }>;
  onJumpToMessage: () => void;
}) {
  const fullPrompt = normalizePrompt(event.message.content);
  const prompt = summarizePrompt(event.message.content);
  if (!fullPrompt) return null;

  return (
    <div className="sticky top-[2.3rem] z-30 h-0 overflow-visible">
      <button
        type="button"
        data-testid="timeline-turn-context"
        className="ml-7 -mt-1 flex w-[calc(100%-1.75rem)] min-w-0 cursor-pointer items-start gap-1.5 rounded-md border border-afx-info/45 bg-background px-2.5 py-1.5 text-left shadow-[0_8px_22px_rgba(0,0,0,0.18)] ring-1 ring-afx-info/15 backdrop-blur transition-colors hover:border-afx-info/70 hover:bg-muted/80 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
        title={fullPrompt}
        aria-label={`Jump to message: ${prompt}`}
        onClick={onJumpToMessage}
      >
        <span
          className="mt-[0.35rem] size-1.5 shrink-0 rounded-full bg-afx-info shadow-[0_0_6px_currentColor]"
          aria-hidden
        />
        <span className="shrink-0 whitespace-nowrap font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-afx-info">
          You
        </span>
        <span className="shrink-0 font-mono text-[10px] text-muted-foreground/60">·</span>
        <span
          data-testid="timeline-turn-context-time"
          className="shrink-0 whitespace-nowrap font-mono text-[10px] text-muted-foreground/80"
        >
          {formatTimeMeta(event.message.createdAt)}
        </span>
        <span className="shrink-0 font-mono text-[10px] text-muted-foreground/60">·</span>
        <span
          data-testid="timeline-turn-context-prompt"
          className="line-clamp-3 min-w-0 text-[11px] leading-snug text-foreground"
        >
          {prompt}
        </span>
      </button>
    </div>
  );
}

function useUserRowScrolledAbove(ref: RefObject<HTMLElement | null>): boolean {
  const [isScrolledAbove, setIsScrolledAbove] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") return;

    const scrollRoot = findScrollRoot(node);
    let frame: number | null = null;
    const requestFrame =
      window.requestAnimationFrame ??
      ((callback: FrameRequestCallback) => window.setTimeout(() => callback(Date.now()), 16));
    const cancelFrame = window.cancelAnimationFrame ?? window.clearTimeout;
    const computeScrolledAbove = (
      rowRect = node.getBoundingClientRect(),
      rootRect = scrollRoot?.getBoundingClientRect() ?? null,
    ) => {
      const rootTop = rootRect?.top ?? 0;
      const next = scrollRoot && scrollRoot.scrollTop <= 0 ? false : rowRect.bottom < rootTop;
      setIsScrolledAbove((current) => (current === next ? current : next));
    };
    const scheduleCompute = () => {
      if (frame !== null) cancelFrame(frame);
      frame = requestFrame(() => {
        frame = null;
        computeScrolledAbove();
      });
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        if (entry.isIntersecting) {
          setIsScrolledAbove(false);
          return;
        }
        computeScrolledAbove(entry.boundingClientRect, entry.rootBounds);
      },
      { root: scrollRoot },
    );

    observer.observe(node);
    computeScrolledAbove();
    const scrollTarget: HTMLElement | Window = scrollRoot ?? window;
    scrollTarget.addEventListener("scroll", scheduleCompute, { passive: true });
    window.addEventListener("resize", scheduleCompute, { passive: true });

    return () => {
      observer.disconnect();
      scrollTarget.removeEventListener("scroll", scheduleCompute);
      window.removeEventListener("resize", scheduleCompute);
      if (frame !== null) cancelFrame(frame);
    };
  }, [ref]);

  return isScrolledAbove;
}

function findScrollRoot(node: HTMLElement): HTMLElement | null {
  let current = node.parentElement;
  while (current) {
    const overflowY = window.getComputedStyle(current).overflowY;
    if (overflowY === "auto" || overflowY === "scroll") return current;
    current = current.parentElement;
  }
  return null;
}

const TurnEventRow = memo(function TurnEventRow({
  event,
  rowRef,
  onSendCommand,
  onInsertCommand,
}: {
  event: TurnEvent;
  rowRef?: Ref<HTMLLIElement>;
  onSendCommand: (command: string) => void;
  onInsertCommand: (command: string) => void;
}) {
  if (event.kind === "user") {
    return (
      <li
        ref={rowRef}
        className="relative grid grid-cols-[20px_minmax(0,1fr)] gap-x-2.5"
        data-timeline-event={event.kind}
      >
        <div className="relative z-[8] flex justify-center pt-0.5">
          <Marker event={event} />
        </div>
        <UserBlock event={event} />
      </li>
    );
  }

  if (event.kind === "assistant") {
    return (
      <li
        className="relative grid grid-cols-[20px_minmax(0,1fr)] gap-x-2.5"
        data-timeline-event={event.kind}
      >
        <div className="relative z-[8] flex justify-center pt-0.5">
          <Marker event={event} />
        </div>
        <AfxBlock event={event} onSendCommand={onSendCommand} onInsertCommand={onInsertCommand} />
      </li>
    );
  }

  return (
    <li
      className="relative grid grid-cols-[20px_minmax(0,1fr)] gap-x-2.5 pl-7"
      data-timeline-event={event.kind}
    >
      <div className="relative z-[8] flex justify-center pt-0.5">
        <Marker event={event} />
      </div>
      <div className="min-w-0">
        {event.kind === "tool" ? (
          <ToolEvent tool={event.tool} />
        ) : (
          <>
            <EventHeader event={event} />
            <EventBody
              event={event}
              onSendCommand={onSendCommand}
              onInsertCommand={onInsertCommand}
            />
          </>
        )}
      </div>
    </li>
  );
});

function UserBlock({ event }: { event: Extract<TurnEvent, { kind: "user" }> }) {
  return (
    <div className="min-w-0">
      <EventHeader event={event} />
      <EventBody event={event} onSendCommand={() => undefined} onInsertCommand={() => undefined} />
    </div>
  );
}

function AfxBlock({
  event,
  onSendCommand,
  onInsertCommand,
}: {
  event: Extract<TurnEvent, { kind: "assistant" }>;
  onSendCommand: (command: string) => void;
  onInsertCommand: (command: string) => void;
}) {
  return (
    <div className="min-w-0">
      <EventHeader event={event} />
      <EventBody event={event} onSendCommand={onSendCommand} onInsertCommand={onInsertCommand} />
    </div>
  );
}

function SystemRow({
  event,
  onSendCommand,
  onInsertCommand,
}: {
  event: SystemEvent;
  onSendCommand: (command: string) => void;
  onInsertCommand: (command: string) => void;
}) {
  return (
    <li
      className="relative grid grid-cols-[20px_minmax(0,1fr)] gap-x-2.5 pl-7"
      data-timeline-event={event.kind}
    >
      <div className="relative z-[8] flex justify-center pt-0.5">
        <Marker event={event} />
      </div>
      <div className="min-w-0">
        <EventHeader event={event} />
        <EventBody event={event} onSendCommand={onSendCommand} onInsertCommand={onInsertCommand} />
      </div>
    </li>
  );
}

// Avatar circles for the conversation participants (user, AFX). Tool, error,
// and system events render as plain icons against the rail to reduce visual noise.
const MARKER_AVATAR =
  "relative flex h-5 w-5 items-center justify-center rounded-full border border-border/60 bg-background shadow-sm ring-[4px] ring-background";
const MARKER_PLAIN =
  "relative flex h-5 w-5 items-center justify-center rounded-full bg-background ring-[4px] ring-background";

/**
 * Renders the rail marker for each timeline event type.
 *
 * @see docs/specs/212-app-chat-messages/spec.md [FR-1] [FR-6]
 * @see docs/specs/212-app-chat-messages/design.md [DES-MESSAGES-COMPONENTS] [DES-MESSAGES-MOCKUP-SYSTEM]
 */
function Marker({ event }: { event: TimelineEvent }) {
  if (event.kind === "user") {
    return (
      <span aria-hidden data-timeline-marker="user" className={cn(MARKER_AVATAR, "text-afx-info")}>
        <UserRound size={11} className="shrink-0" strokeWidth={2.5} />
      </span>
    );
  }

  if (event.kind === "assistant") {
    return (
      <span
        aria-hidden
        data-timeline-marker="assistant"
        className={cn(MARKER_AVATAR, "text-afx-brand-soft")}
      >
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
      <span aria-hidden data-timeline-marker="tool" className={cn(MARKER_PLAIN, tone)}>
        <Icon size={12} className="shrink-0" strokeWidth={2.25} />
      </span>
    );
  }

  if (event.kind === "error") {
    return (
      <span
        aria-hidden
        data-timeline-marker="error"
        className={cn(MARKER_PLAIN, "text-destructive")}
      >
        <AlertTriangle size={12} className="shrink-0" strokeWidth={2.25} />
      </span>
    );
  }

  if (event.kind === "info") {
    return (
      <span
        aria-hidden
        data-timeline-marker="info"
        className={cn(MARKER_PLAIN, "text-muted-foreground/35")}
      >
        <Info size={10} className="shrink-0" strokeWidth={2.25} />
      </span>
    );
  }

  if (event.kind === "compaction") {
    return (
      <span
        aria-hidden
        data-timeline-marker="compaction"
        className={cn(MARKER_PLAIN, "text-afx-brand-soft")}
      >
        <Scissors size={12} className="shrink-0" strokeWidth={2.25} />
      </span>
    );
  }

  if (event.kind === "note") {
    return (
      <span
        aria-hidden
        data-timeline-marker="note"
        className={cn(MARKER_PLAIN, "text-muted-foreground/60")}
      >
        <PenLine size={12} className="shrink-0" strokeWidth={2.25} />
      </span>
    );
  }

  if (event.kind === "shell") {
    return (
      <span
        aria-hidden
        data-timeline-marker="shell"
        className={cn(MARKER_PLAIN, "text-amber-500/70")}
      >
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
  children?: ReactNode;
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
        <>
          <span aria-hidden className="font-mono text-[10px] text-muted-foreground/40">
            ·
          </span>
          <span className="font-mono text-[10px] text-muted-foreground/60">
            {formatTimeMeta(timestamp)}
          </span>
        </>
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
function EventBody({
  event,
  onSendCommand,
  onInsertCommand,
}: {
  event: TimelineEvent;
  onSendCommand: (command: string) => void;
  onInsertCommand: (command: string) => void;
}) {
  if (event.kind === "user") {
    return (
      <div className="mt-1 rounded-md bg-muted/40 px-2.5 py-1.5 whitespace-pre-wrap break-words text-[13px] leading-relaxed">
        {event.message.content}
      </div>
    );
  }
  if (event.kind === "assistant") {
    if (event.message.content) {
      const sanitizedContent = stripLegacyUiActionBlocks(event.message.content);
      const resultActions = event.message.streaming ? [] : parseResultActions(sanitizedContent);
      const visibleContent =
        resultActions.length > 0 ? stripResultActionSections(sanitizedContent) : sanitizedContent;
      return (
        <div className="mt-0.5">
          <MarkdownMessage content={visibleContent} />
          <ResultActions
            actions={resultActions}
            onSend={(command) => onSendCommand(command)}
            onInsert={(command) => onInsertCommand(command)}
          />
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
  children: ReactNode;
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
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
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
function linkify(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
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
