/**
 * Journal view — session-by-session discussions with timeline and preview.
 *
 * @see docs/specs/223-app-workbench-journal/spec.md [FR-1] [FR-7] [FR-8] [FR-9]
 * @see docs/specs/223-app-workbench-journal/design.md [DES-JOURNAL-FILTERS] [DES-JOURNAL-CARD] [DES-JOURNAL-PREVIEW] [DES-JOURNAL-TIME] [DES-JOURNAL-EMPTY]
 */
import { useEffect, useMemo, useState } from "react";

import {
  BookOpen,
  CheckCircle,
  Circle,
  GitBranch,
  Lightbulb,
  MessageCircle,
  Pause,
  Sparkles,
} from "lucide-react";

import type { JournalEntry } from "@afx/shared";
import { Badge } from "@afx/ui/components/badge";
import { Button } from "@afx/ui/components/button";
import { Input } from "@afx/ui/components/input";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@afx/ui/components/resizable";
import { ScrollArea } from "@afx/ui/components/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@afx/ui/components/select";
import { ToggleGroup, ToggleGroupItem } from "@afx/ui/components/toggle-group";

import { DocumentReader } from "../components/document-reader";
import { useWorkbench } from "../context/workbench-context";
import { workbenchOn } from "../lib/bridge";
import { OpenActions } from "../lib/open-actions";

type TimeFilter = "today" | "week" | "month" | "year" | "all";

const STATUS_CONFIG: Record<string, { color: string; icon: typeof Circle; label: string }> = {
  active: { color: "text-afx-brand", icon: MessageCircle, label: "Active" },
  blocked: { color: "text-amber-400", icon: Pause, label: "Blocked" },
  closed: { color: "text-green-400", icon: CheckCircle, label: "Closed" },
};

const TIME_OPTIONS: { value: TimeFilter; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "year", label: "Year" },
  { value: "all", label: "All" },
];

/**
 * Check whether an entry date is inside the selected journal time filter.
 *
 * @see docs/specs/223-app-workbench-journal/spec.md [FR-1]
 * @see docs/specs/223-app-workbench-journal/design.md [DES-JOURNAL-FILTERS] [DES-JOURNAL-TIME]
 */
function isInTimeRange(dateStr: string, filter: TimeFilter): boolean {
  if (filter === "all") return true;
  const d = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (filter === "today") {
    const entryDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    return entryDay.getTime() === today.getTime();
  }
  const cutoff = new Date(today);
  if (filter === "week") cutoff.setDate(cutoff.getDate() - 7);
  else if (filter === "month") cutoff.setMonth(cutoff.getMonth() - 1);
  else if (filter === "year") cutoff.setFullYear(cutoff.getFullYear() - 1);
  return d >= cutoff;
}

/**
 * Human-facing sticky header label for journal entry groups.
 *
 * @see docs/specs/223-app-workbench-journal/spec.md [FR-2]
 * @see docs/specs/223-app-workbench-journal/design.md [DES-JOURNAL-TIME]
 */
function formatDateHeader(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const targetDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((today.getTime() - targetDay.getTime()) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return targetDay.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/**
 * Compact absolute date label for journal group headers.
 *
 * @see docs/specs/223-app-workbench-journal/spec.md [FR-2]
 * @see docs/specs/223-app-workbench-journal/design.md [DES-JOURNAL-TIME]
 */
function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/**
 * Group journal entries by date newest-first.
 *
 * @see docs/specs/223-app-workbench-journal/spec.md [FR-2]
 * @see docs/specs/223-app-workbench-journal/design.md [DES-JOURNAL-TIME]
 */
function groupByDate(entries: JournalEntry[]) {
  const groups = new Map<string, JournalEntry[]>();
  for (const entry of entries) {
    const list = groups.get(entry.date) ?? [];
    list.push(entry);
    groups.set(entry.date, list);
  }
  return Array.from(groups.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, entries]) => ({ date, entries }));
}

/**
 * Timeline card for one journal entry.
 *
 * @see docs/specs/223-app-workbench-journal/spec.md [FR-3]
 * @see docs/specs/223-app-workbench-journal/design.md [DES-JOURNAL-CARD]
 */
function JournalCard({
  entry,
  isSelected,
  onSelect,
}: {
  entry: JournalEntry;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const config = STATUS_CONFIG[entry.status] ?? STATUS_CONFIG.active;
  const dotBg = config.color.replace("text-", "bg-");
  const featureShort = entry.feature.replace(/^\d+-/, "");
  const decisionsCount = entry.decisions?.length ?? 0;
  const firstDecision = entry.decisions?.[0];

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group relative flex w-full cursor-pointer items-start gap-2.5 rounded-md border-l-2 py-2 pl-3 pr-2 text-left transition-colors ${
        isSelected ? "border-l-afx-brand bg-afx-brand/8" : "border-l-transparent hover:bg-accent/40"
      }`}
    >
      <span
        className={`mt-1.5 size-2 shrink-0 rounded-full ${dotBg} ring-2 ring-background`}
        aria-label={config.label}
        title={config.label}
      />
      <div className="min-w-0 flex-1">
        <div className="grid min-w-0 grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-2">
          <span className={`whitespace-nowrap font-mono text-[10px] font-semibold ${config.color}`}>
            {entry.id}
          </span>
          <Badge
            variant="outline"
            className={`shrink-0 rounded-sm px-1 py-0 text-[9px] ${config.color}`}
          >
            {config.label}
          </Badge>
          <span className="truncate text-[10px] text-muted-foreground/80">{featureShort}</span>
          {decisionsCount > 0 && (
            <Badge
              variant="outline"
              className="shrink-0 rounded-sm px-1 py-0 text-[9px] text-afx-brand-soft"
            >
              {decisionsCount} decision{decisionsCount === 1 ? "" : "s"}
            </Badge>
          )}
        </div>
        <p
          className={`mt-0.5 line-clamp-2 text-xs leading-snug ${
            isSelected ? "font-medium text-foreground" : "text-foreground/90"
          }`}
        >
          {entry.title}
        </p>
        {firstDecision ? (
          <p className="mt-1 line-clamp-1 text-[10px] leading-snug text-afx-brand-soft">
            {firstDecision}
          </p>
        ) : entry.context ? (
          <p className="mt-0.5 line-clamp-1 text-[10px] leading-snug text-muted-foreground/70">
            {entry.context}
          </p>
        ) : null}
        {entry.summary && !entry.context && !firstDecision && (
          <p className="mt-0.5 line-clamp-1 text-[10px] leading-snug text-muted-foreground/70">
            {entry.summary}
          </p>
        )}
      </div>
    </button>
  );
}

/**
 * Selected journal entry preview with fetched markdown content.
 *
 * @see docs/specs/223-app-workbench-journal/spec.md [FR-5] [FR-6]
 * @see docs/specs/223-app-workbench-journal/design.md [DES-JOURNAL-PREVIEW]
 */
function PreviewPanel({ entry }: { entry: JournalEntry | null }) {
  const { send } = useWorkbench();
  const [content, setContent] = useState<string | null>(null);
  const config = entry ? (STATUS_CONFIG[entry.status] ?? STATUS_CONFIG.active) : null;
  const Icon = config?.icon ?? Circle;
  const decisions = entry?.decisions ?? [];

  useEffect(() => {
    if (!entry) return;
    queueMicrotask(() => setContent(null));
    send({ type: "afxFetchDocContent", filePath: entry.filePath });
    const off = workbenchOn("afxDocContent", (msg) => {
      if (msg.filePath === entry.filePath) setContent(msg.content);
    });
    return off;
  }, [entry, send]);

  const trimmedContent = useMemo(
    () => (content && entry ? trimRedundantHeader(content, entry.title) : null),
    [content, entry],
  );

  if (!entry) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 rounded-md border border-dashed border-border p-8 text-center">
        <BookOpen size={32} className="text-muted-foreground/30" />
        <p className="font-medium">No discussion selected</p>
        <p className="text-xs text-muted-foreground">
          Pick a discussion from the timeline to view its content.
        </p>
      </div>
    );
  }

  return (
    <div className="afx-surface-card flex h-full min-w-0 w-full flex-1 flex-col rounded-md border border-border shadow-none">
      <div className="afx-surface-toolbar flex flex-col gap-1.5 border-b border-border px-3 py-2.5">
        <div className="flex items-center gap-2">
          <Icon size={12} className={config?.color} />
          <span className={`font-mono text-xs font-semibold ${config?.color}`}>{entry.id}</span>
          <Badge variant="outline" className={`text-[9px] ${config?.color}`}>
            {config?.label}
          </Badge>
          <span className="truncate text-[10px] text-muted-foreground" title={entry.feature}>
            · {entry.feature}
          </span>
          <span className="ml-auto shrink-0 text-[10px] text-muted-foreground" title={entry.date}>
            {formatDateHeader(entry.date)}
          </span>
          <OpenActions filePath={entry.filePath} line={entry.line} />
        </div>
        <p className="text-sm font-semibold leading-snug text-foreground">{entry.title}</p>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <article className="grid w-full gap-3 px-4 py-4 xl:grid-cols-[minmax(0,1fr)_280px]">
          <div className="min-w-0 space-y-3">
            {entry.summary ? (
              <section className="rounded-md border border-border bg-muted/15 px-3 py-2.5">
                <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  <Sparkles size={11} aria-hidden />
                  What mattered
                </div>
                <p className="mt-2 text-sm leading-6 text-foreground/90">{entry.summary}</p>
              </section>
            ) : null}
            <DocumentReader
              preset="journal"
              title="Captured session"
              subtitle={entry.filePath}
              content={trimmedContent}
              filePath={entry.filePath}
              line={entry.line}
              hideTitle
              showOutline
              showReadingControls
              loadingText="Loading content..."
            />
          </div>
          <aside className="flex min-w-0 flex-col gap-3">
            <section className="rounded-md border border-border bg-muted/15 px-3 py-2.5">
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                <Lightbulb size={11} aria-hidden />
                Key decisions
              </div>
              {decisions.length > 0 ? (
                <ul className="mt-2 space-y-1.5">
                  {decisions.map((decision) => (
                    <li
                      key={decision}
                      className="rounded-sm border border-afx-brand/20 bg-afx-brand/8 px-2 py-1.5 text-xs leading-5 text-foreground/90"
                    >
                      {decision}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  No explicit decision was captured for this entry yet.
                </p>
              )}
            </section>
            <section className="rounded-md border border-border bg-muted/15 px-3 py-2.5">
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                <GitBranch size={11} aria-hidden />
                Context
              </div>
              <dl className="mt-2 grid gap-2 text-xs">
                <JournalFact label="Feature" value={entry.feature} />
                <JournalFact label="Status" value={config?.label ?? entry.status} />
                <JournalFact label="Date" value={formatShortDate(entry.date)} />
                {entry.context ? <JournalFact label="Why now" value={entry.context} /> : null}
              </dl>
            </section>
          </aside>
        </article>
      </ScrollArea>
    </div>
  );
}

/**
 * Compact key/value tile for the selected journal entry context rail.
 *
 * @see docs/specs/223-app-workbench-journal/spec.md [FR-9]
 * @see docs/specs/223-app-workbench-journal/design.md [DES-JOURNAL-PREVIEW]
 */
function JournalFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-sm border border-border/70 bg-background/50 px-2 py-1.5">
      <dt className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 break-words text-foreground/90">{value}</dd>
    </div>
  );
}

/**
 * Remove duplicated captured title/date headers from the preview body.
 *
 * @see docs/specs/223-app-workbench-journal/spec.md [FR-6]
 * @see docs/specs/223-app-workbench-journal/design.md [DES-JOURNAL-PREVIEW] [DES-JOURNAL-TIME]
 */
function trimRedundantHeader(content: string, title: string): string {
  const lines = content.split("\n");
  const titleLower = title.trim().toLowerCase();
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? "";
    const trimmed = line.trim();
    if (!trimmed) {
      i++;
      continue;
    }
    if (/^#{1,6}\s+/.test(trimmed)) {
      const headingText = trimmed.replace(/^#{1,6}\s+/, "").toLowerCase();
      if (headingText === titleLower || headingText.includes(titleLower)) {
        i++;
        continue;
      }
    }
    if (/^\*\*[^*]+\*\*\s*[—-]\s*\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      i++;
      continue;
    }
    break;
  }
  return lines.slice(i).join("\n").trim();
}

/**
 * Workbench Journal tab surface: filters, timeline grouping, and preview.
 *
 * @see docs/specs/223-app-workbench-journal/spec.md [FR-1] [FR-7] [FR-8] [FR-9]
 * @see docs/specs/223-app-workbench-journal/design.md [DES-JOURNAL-FILTERS] [DES-JOURNAL-CARD] [DES-JOURNAL-PREVIEW] [DES-JOURNAL-EMPTY]
 */
export default function Journal() {
  const { journal, send } = useWorkbench();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");
  const [selected, setSelected] = useState<JournalEntry | null>(null);

  const features = useMemo(() => [...new Set(journal.map((e) => e.feature))].sort(), [journal]);

  const filtered = useMemo(() => {
    let result = journal;
    result = result.filter((e) => isInTimeRange(e.date, timeFilter));
    if (statusFilter !== "all") result = result.filter((e) => e.status === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.id.toLowerCase().includes(q) ||
          e.feature.toLowerCase().includes(q) ||
          e.context?.toLowerCase().includes(q) ||
          e.summary?.toLowerCase().includes(q),
      );
    }
    return result;
  }, [journal, statusFilter, timeFilter, search]);

  const grouped = useMemo(() => groupByDate(filtered), [filtered]);

  const statusCounts = useMemo(
    () => ({
      active: journal.filter((e) => e.status === "active").length,
      blocked: journal.filter((e) => e.status === "blocked").length,
      closed: journal.filter((e) => e.status === "closed").length,
    }),
    [journal],
  );

  useEffect(() => {
    if (filtered.length > 0 && !selected) {
      const latest = grouped[0]?.entries[0];
      if (latest) queueMicrotask(() => setSelected(latest));
    }
  }, [filtered.length, grouped, selected]);

  if (journal.length === 0) {
    return (
      <JournalEmptyGuide
        onLogSession={() =>
          send({ type: "afxOpenChatCommand", command: "/afx-session log", mode: "insert" })
        }
        onCaptureDecision={() =>
          send({ type: "afxOpenChatCommand", command: "/afx-session note ", mode: "insert" })
        }
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {/*
        Surface: Workbench.Journal.Filters
        @see docs/specs/223-app-workbench-journal/design.md [DES-JOURNAL-FILTERS]
      */}
      <div className="afx-surface-toolbar flex flex-col gap-1.5 border-b border-border px-3 py-2">
        {/* Row 1: time chips + search + status */}
        <div className="flex items-center gap-2">
          <ToggleGroup
            type="single"
            value={timeFilter}
            onValueChange={(v) => {
              if (v) setTimeFilter(v as TimeFilter);
            }}
            variant="outline"
            size="sm"
            className="h-6 shrink-0"
          >
            {TIME_OPTIONS.map((opt) => (
              <ToggleGroupItem
                key={opt.value}
                value={opt.value}
                className="h-6 px-2 text-[10px] font-medium"
              >
                {opt.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="afx-field-surface h-6 min-w-0 flex-1 text-xs"
          />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-6 w-[100px] shrink-0 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="blocked">Blocked</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Row 2: counts + auto-label */}
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span>
            {filtered.length} of {journal.length}
          </span>
          <span aria-hidden>·</span>
          <span>{features.length} features</span>
          {statusCounts.blocked > 0 && (
            <>
              <span aria-hidden>·</span>
              <span className={STATUS_CONFIG.blocked?.color}>{statusCounts.blocked} blocked</span>
            </>
          )}
          {statusCounts.active > 0 && (
            <>
              <span aria-hidden>·</span>
              <span className={STATUS_CONFIG.active?.color}>{statusCounts.active} active</span>
            </>
          )}
          <span className="ml-auto flex items-center gap-1 text-muted-foreground/50">
            <Sparkles size={9} />
            Auto-written by skills · <code className="font-mono">/afx-session log</code>
          </span>
        </div>
      </div>

      {/*
        Surface: Workbench.Journal.TimelineAndPreview
        @see docs/specs/223-app-workbench-journal/design.md [DES-JOURNAL-CARD] [DES-JOURNAL-PREVIEW]
      */}
      <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1 overflow-hidden">
        <ResizablePanel defaultSize="32%" minSize="280px" maxSize="48%">
          <div className="afx-surface-subtle flex h-full min-h-0 min-w-[280px] flex-col border-r border-border">
            <ScrollArea className="min-h-0 flex-1">
              {grouped.length === 0 ? (
                <p className="p-4 text-center text-xs text-muted-foreground">
                  No discussions match your filter.
                </p>
              ) : (
                <div className="py-1">
                  {grouped.map((group) => (
                    <div key={group.date} className="mb-2">
                      <div className="afx-surface-subtle sticky top-0 z-10 flex items-center gap-2 border-b border-border/40 px-3 py-1.5">
                        <span
                          className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
                          title={group.date}
                        >
                          {formatDateHeader(group.date)}
                        </span>
                        <span className="text-[10px] text-muted-foreground/70">
                          {formatShortDate(group.date)}
                        </span>
                        <span className="ml-auto font-mono text-[10px] text-muted-foreground/70">
                          {group.entries.length}
                        </span>
                      </div>
                      <div className="flex flex-col gap-0.5 px-1.5 py-1">
                        {group.entries.map((entry) => (
                          <JournalCard
                            key={`${entry.feature}-${entry.id}`}
                            entry={entry}
                            isSelected={
                              selected?.id === entry.id && selected?.feature === entry.feature
                            }
                            onSelect={() => setSelected(entry)}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </ResizablePanel>
        <ResizableHandle
          withHandle
          className="w-2 bg-border/60 transition-colors hover:bg-afx-brand/35 focus-visible:bg-afx-brand/35"
        />
        <ResizablePanel defaultSize="68%" minSize="360px">
          <div className="flex h-full min-w-0 overflow-hidden p-3">
            <PreviewPanel entry={selected} />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

/**
 * Useful first-run guide for the session journal, with commands and a preview
 * of the timeline users get after capturing work.
 *
 * @see docs/specs/223-app-workbench-journal/spec.md [FR-8]
 * @see docs/specs/223-app-workbench-journal/design.md [DES-JOURNAL-EMPTY]
 */
function JournalEmptyGuide({
  onLogSession,
  onCaptureDecision,
}: {
  onLogSession: () => void;
  onCaptureDecision: () => void;
}) {
  const previewRows = [
    { id: "S-021", title: "Composer scope clarified", status: "Decision", tone: "text-afx-brand" },
    { id: "S-020", title: "Watcher pressure reduced", status: "Closed", tone: "text-green-400" },
    { id: "S-019", title: "Open question: release notes", status: "Open", tone: "text-amber-400" },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex min-h-full flex-col gap-2 p-3">
          <header className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-b border-border pb-2">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-afx-brand/25 bg-afx-brand/10 text-afx-brand">
                <BookOpen size={17} aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-afx-brand-soft">
                  Journal
                </p>
                <h2 className="truncate text-base font-semibold leading-tight">
                  Keep the work understandable after the tab closes
                </h2>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" size="sm" className="h-8 gap-1.5" onClick={onLogSession}>
                <MessageCircle size={13} />
                Log session
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5"
                onClick={onCaptureDecision}
              >
                <Sparkles size={13} />
                Decision note
              </Button>
            </div>
          </header>

          <section className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-2">
            <div className="rounded-md border border-border bg-muted/20 px-3 py-2">
              <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Session log
              </div>
              <p className="mt-0.5 text-xs leading-4 text-foreground/90">
                What changed, what was decided, and what still needs attention.
              </p>
              <code className="mt-1 block font-mono text-[10px] text-afx-brand-soft">
                /afx-session log
              </code>
            </div>
            <div className="rounded-md border border-border bg-muted/20 px-3 py-2">
              <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Decision note
              </div>
              <p className="mt-0.5 text-xs leading-4 text-foreground/90">
                One crisp decision while the context is still warm.
              </p>
              <code className="mt-1 block font-mono text-[10px] text-afx-brand-soft">
                /afx-session note
              </code>
            </div>
          </section>

          <section className="min-w-0 rounded-md border border-border bg-muted/15 p-2.5">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium">Preview after your first session</span>
              <Badge variant="outline" className="text-[10px]">
                mock
              </Badge>
            </div>
            <ol className="grid gap-2 md:grid-cols-3">
              {previewRows.map((row) => (
                <li key={row.id}>
                  <article className="h-full rounded-md border border-border bg-background/70 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className={`font-mono text-[10px] font-semibold ${row.tone}`}>
                        {row.id}
                      </span>
                      <span className="truncate text-xs font-medium text-foreground">
                        {row.title}
                      </span>
                      <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                        {row.status}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-muted-foreground">
                      Linked to markdown with decisions ready to promote.
                    </p>
                  </article>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </ScrollArea>
    </div>
  );
}
