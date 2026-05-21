/**
 * Notes view — quick note capture with deterministic timestamp display.
 *
 * @see docs/specs/224-app-workbench-notes/spec.md [FR-1] [FR-7] [FR-8]
 * @see docs/specs/224-app-workbench-notes/design.md [DES-NOTES-CAPTURE] [DES-NOTES-TIMELINE] [DES-NOTES-ITEM] [DES-NOTES-TIME] [DES-NOTES-EMPTY]
 */
import { type KeyboardEvent, useMemo, useState } from "react";

import {
  CheckCircle,
  FileText,
  Lightbulb,
  MessageSquare,
  MousePointer2,
  NotepadText,
  Pencil,
  Search,
  Trash2,
  X,
} from "lucide-react";

import type { QuickNote } from "@afx/shared";
import { Button } from "@afx/ui/components/button";
import { Input } from "@afx/ui/components/input";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@afx/ui/components/resizable";
import { ScrollArea } from "@afx/ui/components/scroll-area";
import { Textarea } from "@afx/ui/components/textarea";

import { useWorkbench } from "../context/workbench-context";
import { MinimalMarkdown } from "../lib/markdown-render";
import { OpenActions } from "../lib/open-actions";

interface DateGroup {
  date: string;
  label: string;
  shortLabel: string;
  notes: QuickNote[];
}

type DateFilter = "all" | "today" | "week" | "month";

const DATE_FILTERS: Array<{ value: DateFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "today", label: "Today" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
];

/**
 * Split-pane note capture and timeline surface.
 *
 * @see docs/specs/224-app-workbench-notes/spec.md [FR-1] [FR-6]
 * @see docs/specs/224-app-workbench-notes/design.md [DES-NOTES-CAPTURE] [DES-NOTES-FILTERS]
 */
export default function Notes() {
  const { notes, isLoading, notesFilePath, send } = useWorkbench();
  const [text, setText] = useState("");
  const [textareaFocused, setTextareaFocused] = useState(false);
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");

  const filtered = useMemo(() => {
    let result = notes;
    const cutoff = getDateRange(dateFilter);
    if (cutoff) {
      result = result.filter((note) => new Date(note.timestamp).getTime() >= cutoff.getTime());
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((note) => note.text.toLowerCase().includes(q));
    }
    return result;
  }, [dateFilter, notes, search]);

  const grouped = useMemo(() => groupByDate(filtered), [filtered]);
  const uniqueDays = useMemo(() => new Set(notes.map((n) => n.date)).size, [notes]);

  function handleSubmit() {
    if (!text.trim()) return;
    send({ type: "afxAppendNote", text: text.trim() });
    setText("");
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <ResizablePanelGroup orientation="horizontal" className="h-full min-h-0 overflow-hidden">
      {/*
        Surface: Workbench.Notes.Capture
        @see docs/specs/224-app-workbench-notes/design.md [DES-NOTES-CAPTURE]
      */}
      <ResizablePanel defaultSize="36%" minSize="320px" maxSize="58%">
        <aside className="afx-surface-subtle flex h-full min-h-0 min-w-[320px] flex-col border-r border-border">
          <div className="afx-surface-toolbar flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
            <MessageSquare size={14} className="text-afx-brand" />
            <div className="min-w-0">
              <p className="text-xs font-medium">Capture</p>
              <p className="truncate font-mono text-[10px] text-muted-foreground">
                {notesFilePath || ".afx/notes.md"}
              </p>
            </div>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-2 p-3">
            <Textarea
              aria-label="New note"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onFocus={() => setTextareaFocused(true)}
              onBlur={() => setTextareaFocused(false)}
              onKeyDown={onKeyDown}
              placeholder="Quick note… (Enter to save, Shift+Enter for newline)
Markdown supported — # heading, **bold**, - list, `code`."
              className={`afx-field-surface afx-notes-capture-input min-h-[4.5rem] flex-1 resize-none text-sm transition-all ${
                textareaFocused ? "border-l-4 border-l-afx-brand pl-3" : ""
              }`}
            />
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={!text.trim()}
              className="afx-notes-capture-save h-8 w-full"
            >
              <CheckCircle size={14} className="mr-1" />
              Save
            </Button>
          </div>
          <div className="flex shrink-0 items-center gap-2 border-t border-border px-3 py-1 text-[10px] text-muted-foreground">
            <span>
              <span className="font-mono">{notes.length}</span> notes ·{" "}
              <span className="font-mono">{uniqueDays}</span> day{uniqueDays === 1 ? "" : "s"}
            </span>
            <span className="ml-auto truncate">Enter saves · Shift+Enter newline</span>
          </div>
        </aside>
      </ResizablePanel>
      <ResizableHandle
        withHandle
        className="w-2 bg-border/60 transition-colors hover:bg-afx-brand/35 focus-visible:bg-afx-brand/35"
      />
      {/*
        Surface: Workbench.Notes.Timeline
        @see docs/specs/224-app-workbench-notes/design.md [DES-NOTES-FILTERS] [DES-NOTES-TIMELINE]
      */}
      <ResizablePanel defaultSize="64%" minSize="360px">
        <section className="flex h-full min-h-0 flex-col overflow-hidden">
          <div className="afx-surface-toolbar flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
            <FileText size={14} className="text-muted-foreground" />
            <span className="text-xs font-medium">notes.md</span>
            <span className="font-mono text-[10px] text-muted-foreground">timeline</span>
            <span className="font-mono text-[10px] text-muted-foreground">
              {filtered.length}/{notes.length}
            </span>
            <div className="relative ml-3 max-w-[220px] flex-1">
              <Search
                size={11}
                className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search notes…"
                className="afx-field-surface h-7 pl-6 text-xs"
                aria-label="Search notes"
              />
            </div>
            <div className="flex shrink-0 items-center gap-1" aria-label="Date filter">
              {DATE_FILTERS.map((filter) => (
                <Button
                  key={filter.value}
                  type="button"
                  size="xs"
                  variant={dateFilter === filter.value ? "secondary" : "ghost"}
                  onClick={() => setDateFilter(filter.value)}
                  aria-pressed={dateFilter === filter.value}
                  className="h-6 px-2 font-mono text-[10px]"
                >
                  {filter.label}
                </Button>
              ))}
            </div>
            <OpenActions filePath={notesFilePath || ".afx/notes.md"} className="ml-auto" />
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <p className="text-sm text-muted-foreground">Loading notes…</p>
            </div>
          ) : notes.length === 0 ? (
            <NotesEmptyGuide />
          ) : grouped.length === 0 ? (
            <div className="flex flex-1 items-center justify-center">
              <p className="text-sm text-muted-foreground">No notes match “{search}”.</p>
            </div>
          ) : (
            <ScrollArea className="min-h-0 flex-1">
              <div className="mx-auto w-full max-w-3xl px-5 py-4">
                {grouped.map((group) => (
                  <DateSection
                    key={group.date}
                    group={group}
                    onDelete={(timestamp) => send({ type: "afxDeleteNote", timestamp })}
                    onEdit={(timestamp, text) => send({ type: "afxEditNote", timestamp, text })}
                  />
                ))}
              </div>
            </ScrollArea>
          )}
        </section>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

/**
 * Empty Notes onboarding that explains fleeting-note sources and the timeline
 * users get after notes arrive.
 *
 * @see docs/specs/224-app-workbench-notes/spec.md [FR-8]
 * @see docs/specs/224-app-workbench-notes/design.md [DES-NOTES-EMPTY]
 */
function NotesEmptyGuide() {
  const sources = [
    {
      icon: NotepadText,
      label: "Workbench capture",
      body: "Type on the left and press Enter for quick repo-backed notes.",
    },
    {
      icon: MessageSquare,
      label: "From chat",
      body: "Send a useful thought, snippet, or decision into the same notes file.",
    },
    {
      icon: MousePointer2,
      label: "IDE right click",
      body: "Capture selected code or markdown without breaking your editor flow.",
    },
  ];
  const preview = [
    "Check release wording after screenshots pass.",
    "PRD reader needs a quality pulse, not just pretty markdown.",
    "Follow up: board columns need explicit move controls.",
  ];

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden bg-background">
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex min-h-full flex-col gap-2 p-3">
          <header className="flex min-w-0 items-center gap-2.5 border-b border-border pb-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-afx-brand/25 bg-afx-brand/10 text-afx-brand">
              <Lightbulb size={17} aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-afx-brand-soft">
                Fleeting notes
              </p>
              <h2 className="truncate text-base font-semibold leading-tight">
                Catch the thought before it becomes a task
              </h2>
            </div>
          </header>

          <section className="grid grid-cols-[repeat(auto-fit,minmax(110px,1fr))] gap-2">
            {sources.map(({ icon: Icon, label, body }) => (
              <div key={label} className="rounded-md border border-border bg-muted/20 px-2.5 py-2">
                <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  <Icon size={11} className="text-afx-brand-soft" aria-hidden />
                  {label}
                </div>
                <p className="mt-1 line-clamp-1 text-[11px] leading-4 text-foreground/85">{body}</p>
              </div>
            ))}
          </section>

          <section className="min-w-0 rounded-md border border-border bg-muted/15 p-2.5">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium">Timeline after capture</span>
              <span className="font-mono text-[10px] text-muted-foreground">mock</span>
            </div>
            <div className="grid gap-2 md:grid-cols-3">
              {preview.map((text, index) => (
                <article
                  key={text}
                  className="rounded-md border border-border/90 bg-background px-3 py-2 shadow-[0_1px_0_rgba(255,255,255,0.04),0_8px_22px_rgba(0,0,0,0.04)]"
                >
                  <header className="font-mono text-[10px] uppercase tracking-[0.12em] text-afx-brand-soft">
                    {index === 0 ? "just now" : index === 1 ? "today" : "yesterday"}
                  </header>
                  <p className="mt-1 line-clamp-2 text-xs leading-4 text-foreground/90">{text}</p>
                </article>
              ))}
            </div>
          </section>
        </div>
      </ScrollArea>
    </div>
  );
}

/**
 * Sticky day section in the notes timeline.
 *
 * @see docs/specs/224-app-workbench-notes/spec.md [FR-4]
 * @see docs/specs/224-app-workbench-notes/design.md [DES-NOTES-TIMELINE]
 */
function DateSection({
  group,
  onDelete,
  onEdit,
}: {
  group: DateGroup;
  onDelete: (timestamp: string) => void;
  onEdit: (timestamp: string, text: string) => void;
}) {
  return (
    <section className="mb-6">
      <header className="afx-surface-subtle sticky top-0 z-10 mb-3 flex items-center gap-2 rounded-md border border-border/40 px-3 py-1.5 backdrop-blur">
        <span
          className="size-1.5 rounded-full bg-afx-brand shadow-[0_0_6px_var(--afx-brand)]"
          aria-hidden
        />
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground">
          {group.label}
        </span>
        <span className="text-[10px] text-muted-foreground/70" title={group.date}>
          {group.shortLabel}
        </span>
        <span className="ml-auto font-mono text-[10px] text-muted-foreground">
          {group.notes.length} {group.notes.length === 1 ? "note" : "notes"}
        </span>
      </header>
      <ol className="relative ml-3 border-l border-dashed border-border/70 pl-6">
        {group.notes.map((note) => (
          <NoteItem key={note.timestamp} note={note} onDelete={onDelete} onEdit={onEdit} />
        ))}
      </ol>
    </section>
  );
}

/**
 * Single timeline note item with markdown preview and inline edit/delete.
 *
 * @see docs/specs/224-app-workbench-notes/spec.md [FR-5] [FR-6] [FR-7]
 * @see docs/specs/224-app-workbench-notes/design.md [DES-NOTES-ITEM] [DES-NOTES-TIME]
 */
function NoteItem({
  note,
  onDelete,
  onEdit,
}: {
  note: QuickNote;
  onDelete: (timestamp: string) => void;
  onEdit: (timestamp: string, text: string) => void;
}) {
  const time = humanizeTimestamp(note.timestamp, note.displayTime);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.text);

  function startEdit(): void {
    setDraft(note.text);
    setEditing(true);
  }

  function cancel(): void {
    setEditing(false);
    setDraft(note.text);
  }

  function save(): void {
    const next = draft.trim();
    if (!next || next === note.text.trim()) {
      cancel();
      return;
    }
    onEdit(note.timestamp, next);
    setEditing(false);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>): void {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      save();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancel();
    }
  }

  return (
    <li className="group relative mb-3 last:mb-0">
      <span
        className="absolute -left-[31px] top-3.5 flex size-4 items-center justify-center rounded-full border border-afx-brand/40 bg-background ring-2 ring-background"
        aria-hidden
      >
        <span className="size-1.5 rounded-full bg-afx-brand" />
      </span>
      <article
        className={`afx-surface-card relative rounded-md border bg-background px-4 py-3 shadow-[0_1px_0_rgba(255,255,255,0.04),0_8px_24px_rgba(0,0,0,0.05)] transition-all before:absolute before:bottom-3 before:left-0 before:top-3 before:w-0.5 before:rounded-r before:bg-afx-brand/35 ${
          editing
            ? "border-afx-brand/60 ring-1 ring-afx-brand/20"
            : "border-border hover:-translate-y-px hover:border-afx-brand/40"
        }`}
      >
        <header
          className="mb-2 flex items-baseline gap-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground"
          title={time.tooltip}
        >
          <span className="text-afx-brand-soft">{time.primary}</span>
          {time.secondary && <span className="text-muted-foreground/60">{time.secondary}</span>}
          {!editing && (
            <div className="ml-auto flex items-center gap-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="Edit note"
                title="Edit note"
                onClick={startEdit}
              >
                <Pencil size={11} />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="Delete note"
                title="Delete note"
                onClick={() => onDelete(note.timestamp)}
              >
                <Trash2 size={11} />
              </Button>
            </div>
          )}
        </header>
        {editing ? (
          <div className="flex flex-col gap-2">
            <Textarea
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              aria-label="Edit note text"
              className="afx-field-surface min-h-32 resize-y text-sm"
            />
            <div className="flex items-center justify-end gap-1.5 text-[10px] text-muted-foreground">
              <span className="mr-auto">⌘/Ctrl+Enter to save · Esc to cancel</span>
              <Button variant="ghost" size="xs" onClick={cancel}>
                <X size={11} className="mr-1" />
                Cancel
              </Button>
              <Button size="xs" onClick={save} disabled={!draft.trim()}>
                <CheckCircle size={11} className="mr-1" />
                Save
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-sm leading-relaxed text-foreground">
            <MinimalMarkdown content={note.text} />
          </div>
        )}
      </article>
    </li>
  );
}

/**
 * Group notes into newest-first day sections.
 *
 * @see docs/specs/224-app-workbench-notes/spec.md [FR-3] [FR-4]
 * @see docs/specs/224-app-workbench-notes/design.md [DES-NOTES-FILTERS] [DES-NOTES-TIMELINE]
 */
function groupByDate(notes: QuickNote[]): DateGroup[] {
  const groups = new Map<string, QuickNote[]>();
  for (const note of notes) {
    const list = groups.get(note.date) ?? [];
    list.push(note);
    groups.set(note.date, list);
  }
  return Array.from(groups.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, list]) => {
      const sorted = [...list].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      return {
        date,
        label: dayLabel(date),
        shortLabel: shortDateLabel(date),
        notes: sorted,
      };
    });
}

/**
 * Human-facing date header label for the note timeline.
 *
 * @see docs/specs/224-app-workbench-notes/spec.md [FR-7]
 * @see docs/specs/224-app-workbench-notes/design.md [DES-NOTES-TIME]
 */
function dayLabel(dateStr: string): string {
  const d = parseDate(dateStr);
  if (!d) return dateStr;
  const today = startOfDay(new Date());
  const target = startOfDay(d);
  const diffDays = Math.round((today.getTime() - target.getTime()) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return d.toLocaleDateString(undefined, { weekday: "long" });
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

/**
 * Compact absolute date label used beside sticky day headers.
 *
 * @see docs/specs/224-app-workbench-notes/spec.md [FR-7]
 * @see docs/specs/224-app-workbench-notes/design.md [DES-NOTES-TIME]
 */
function shortDateLabel(dateStr: string): string {
  const d = parseDate(dateStr);
  if (!d) return dateStr;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/**
 * Convert the active date filter to a cutoff date.
 *
 * @see docs/specs/224-app-workbench-notes/spec.md [FR-3]
 * @see docs/specs/224-app-workbench-notes/design.md [DES-NOTES-FILTERS]
 */
function getDateRange(filter: DateFilter): Date | null {
  if (filter === "all") return null;
  const now = new Date();
  if (filter === "today") return startOfDay(now);
  const cutoff = new Date(now);
  if (filter === "week") {
    cutoff.setDate(cutoff.getDate() - 7);
    return cutoff;
  }
  cutoff.setMonth(cutoff.getMonth() - 1);
  return cutoff;
}

interface HumanTime {
  primary: string;
  secondary?: string;
  tooltip: string;
}

/**
 * Build the primary/secondary/tooltip timestamp text for a note.
 *
 * @see docs/specs/224-app-workbench-notes/spec.md [FR-7]
 * @see docs/specs/224-app-workbench-notes/design.md [DES-NOTES-TIME]
 */
function humanizeTimestamp(timestamp: string, fallback?: string): HumanTime {
  const d = new Date(timestamp);
  if (Number.isNaN(d.getTime())) {
    return { primary: fallback ?? timestamp, tooltip: timestamp };
  }
  const tooltip = d.toLocaleString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  return { primary: formatClock(d), secondary: relativeTimestamp(d), tooltip };
}

/**
 * Best-effort relative label shown beside the exact note time.
 *
 * @see docs/specs/224-app-workbench-notes/spec.md [FR-7]
 * @see docs/specs/224-app-workbench-notes/design.md [DES-NOTES-TIME]
 */
function relativeTimestamp(d: Date): string | undefined {
  const now = Date.now();
  const diffMs = now - d.getTime();
  if (diffMs < 0) return undefined;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMs < 60_000) return "just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  const sameDay = startOfDay(new Date(now)).getTime() === startOfDay(d).getTime();
  if (sameDay) return "today";
  const diffHr = Math.floor(diffMs / 3_600_000);
  if (diffHr < 24 * 2) return "yesterday";
  return undefined;
}

/**
 * Exact 12-hour clock including seconds.
 *
 * @see docs/specs/224-app-workbench-notes/spec.md [FR-7]
 * @see docs/specs/224-app-workbench-notes/design.md [DES-NOTES-TIME]
 */
function formatClock(d: Date): string {
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

/**
 * Parse date-only and timestamp strings for note grouping.
 *
 * @see docs/specs/224-app-workbench-notes/spec.md [FR-7]
 * @see docs/specs/224-app-workbench-notes/design.md [DES-NOTES-TIME]
 */
function parseDate(value: string): Date | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number) as [number, number, number];
    return new Date(year, month - 1, day);
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Normalize a date to local-day midnight for range and relative calculations.
 *
 * @see docs/specs/224-app-workbench-notes/spec.md [FR-7]
 * @see docs/specs/224-app-workbench-notes/design.md [DES-NOTES-TIME]
 */
function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
