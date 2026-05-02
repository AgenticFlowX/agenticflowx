/**
 * Journal view — session-by-session discussions with timeline and preview.
 *
 * @see docs/specs/220-app-workbench/spec.md [FR-6] [FR-11]
 * @see docs/specs/220-app-workbench/design.md [DES-JOURNAL]
 */
import { useEffect, useMemo, useState } from "react";

import { BookOpen, CheckCircle, Circle, MessageCircle, Pause, Sparkles } from "lucide-react";

import type { JournalEntry } from "@afx/shared";
import { Badge } from "@afx/ui/components/badge";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@afx/ui/components/empty";
import { Input } from "@afx/ui/components/input";
import { ScrollArea } from "@afx/ui/components/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@afx/ui/components/select";
import { ToggleGroup, ToggleGroupItem } from "@afx/ui/components/toggle-group";

import { useWorkbench } from "../context/workbench-context";
import { workbenchOn } from "../lib/bridge";
import { MinimalMarkdown } from "../lib/markdown-render";
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

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

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
        <div className="flex items-center gap-2">
          <span className={`font-mono text-[10px] font-semibold ${config.color}`}>{entry.id}</span>
          <span className="truncate text-[10px] text-muted-foreground/80">{featureShort}</span>
          {decisionsCount > 0 && (
            <Badge
              variant="outline"
              className="ml-auto shrink-0 rounded-sm px-1 py-0 text-[9px] text-muted-foreground"
            >
              {decisionsCount}d
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
        {entry.context && (
          <p className="mt-0.5 line-clamp-1 text-[10px] leading-snug text-muted-foreground/70">
            {entry.context}
          </p>
        )}
        {entry.summary && !entry.context && (
          <p className="mt-0.5 line-clamp-1 text-[10px] leading-snug text-muted-foreground/70">
            {entry.summary}
          </p>
        )}
      </div>
    </button>
  );
}

function PreviewPanel({ entry }: { entry: JournalEntry | null }) {
  const { send } = useWorkbench();
  const [content, setContent] = useState<string | null>(null);
  const config = entry ? (STATUS_CONFIG[entry.status] ?? STATUS_CONFIG.active) : null;
  const Icon = config?.icon ?? Circle;

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
      <div className="afx-surface-toolbar flex flex-col gap-1.5 border-b border-border px-3 py-2">
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
        {entry.decisions && entry.decisions.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-0.5">
            {entry.decisions.map((d, i) => (
              <span
                key={i}
                className="rounded bg-muted px-1.5 py-0.5 text-[10px] leading-tight text-muted-foreground"
              >
                {d}
              </span>
            ))}
          </div>
        )}
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <article className="mx-auto w-full max-w-4xl px-5 py-5">
          {entry.summary && (
            <p className="mb-4 text-sm text-muted-foreground leading-relaxed">{entry.summary}</p>
          )}
          {trimmedContent ? (
            <MinimalMarkdown content={trimmedContent} />
          ) : (
            <p className="text-sm text-muted-foreground">Loading content…</p>
          )}
        </article>
      </ScrollArea>
    </div>
  );
}

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

export default function Journal() {
  const { journal } = useWorkbench();
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
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <BookOpen size={32} />
          </EmptyMedia>
          <EmptyTitle>No journal discussions yet</EmptyTitle>
          <EmptyDescription>
            Run <code>/afx-session log</code> in the chat to capture a session, or{" "}
            <code>/afx-session note</code> to record a decision.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {/* Toolbar */}
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

      {/* Content */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="afx-surface-subtle flex w-80 shrink-0 flex-col border-r border-border">
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

        {/* Preview */}
        <div className="flex min-w-0 flex-1 overflow-hidden p-3">
          <PreviewPanel entry={selected} />
        </div>
      </div>
    </div>
  );
}
