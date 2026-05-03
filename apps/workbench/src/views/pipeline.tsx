/**
 * Pipeline view — features grouped by progress with simple / timeline / grid modes.
 *
 * @see docs/specs/225-app-workbench-pipeline/spec.md [FR-1] [FR-7]
 * @see docs/specs/225-app-workbench-pipeline/design.md [DES-PIPELINE-FILTERS] [DES-PIPELINE-SIMPLE] [DES-PIPELINE-CARD]
 */
import { useMemo, useState } from "react";

import {
  BarChart2,
  CheckCircle2,
  Clock3,
  GitBranch,
  LayoutGrid,
  ListChecks,
  Rows3,
  Waypoints,
} from "lucide-react";

import type { PipelineRow, WorkbenchOutbound } from "@afx/shared";
import { Badge } from "@afx/ui/components/badge";
import { Button } from "@afx/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@afx/ui/components/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@afx/ui/components/empty";
import { Input } from "@afx/ui/components/input";
import { Progress } from "@afx/ui/components/progress";
import { ScrollArea } from "@afx/ui/components/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@afx/ui/components/select";
import { cn } from "@afx/ui/lib/utils";

import { useWorkbench } from "../context/workbench-context";
import { useLocalStorage } from "../hooks/use-local-storage";
import {
  type GroupStatus,
  getGroupStatus,
  getNextAction,
  groupByFeatureStatus,
  healthPct,
} from "../lib/pipeline";

type View = "simple" | "timeline" | "grid";

const VIEW_OPTIONS: Array<{ value: View; label: string; icon: typeof LayoutGrid }> = [
  { value: "simple", label: "Simple", icon: Rows3 },
  { value: "timeline", label: "Timeline", icon: Waypoints },
  { value: "grid", label: "Grid", icon: LayoutGrid },
];

const GROUP_LABELS: Record<GroupStatus, string> = {
  in_progress: "In progress",
  ready_to_build: "Ready to build",
  blocked: "Blocked",
  not_started: "Not started",
  complete: "Complete",
};

const GROUP_BADGE: Record<GroupStatus, string> = {
  in_progress: "border-afx-brand/30 text-afx-brand",
  ready_to_build: "border-purple-500/30 text-purple-400",
  blocked: "border-amber-500/30 text-amber-400",
  not_started: "border-border text-muted-foreground",
  complete: "border-green-500/30 text-green-400",
};

const GROUP_ORDER: GroupStatus[] = [
  "in_progress",
  "ready_to_build",
  "blocked",
  "not_started",
  "complete",
];

/**
 * Workbench Pipeline tab: filters, persisted view mode, and mode-specific body.
 *
 * @see docs/specs/225-app-workbench-pipeline/spec.md [FR-1] [FR-4]
 * @see docs/specs/225-app-workbench-pipeline/design.md [DES-PIPELINE-FILTERS]
 */
export default function Pipeline() {
  const { pipeline, send } = useWorkbench();
  const [view, setView] = useLocalStorage<View>("afx-pipeline-view-v3", "simple");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    return pipeline.filter((row) => {
      if (statusFilter !== "all" && getGroupStatus(row) !== statusFilter) return false;
      if (!query.trim()) return true;
      return row.name.toLowerCase().includes(query.toLowerCase());
    });
  }, [pipeline, query, statusFilter]);

  const grouped = groupByFeatureStatus(filtered);

  return (
    <div className="flex h-full flex-col">
      {/*
        Surface: Workbench.Pipeline.Filters
        @see docs/specs/225-app-workbench-pipeline/design.md [DES-PIPELINE-FILTERS]
      */}
      <div className="afx-surface-toolbar flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search features…"
          className="afx-field-surface h-8 max-w-xs text-sm"
          aria-label="Search features"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 w-[160px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="in_progress">In progress</SelectItem>
            <SelectItem value="ready_to_build">Ready to build</SelectItem>
            <SelectItem value="blocked">Blocked</SelectItem>
            <SelectItem value="not_started">Not started</SelectItem>
            <SelectItem value="complete">Complete</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex-1" />
        <div
          role="tablist"
          aria-label="Pipeline view"
          className="flex items-center gap-0.5 rounded-md border border-border bg-card/50 p-0.5"
        >
          {VIEW_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const active = view === opt.value;
            return (
              <Button
                key={opt.value}
                role="tab"
                aria-selected={active}
                variant="ghost"
                size="xs"
                onClick={() => setView(opt.value)}
                className={cn(
                  "h-7 gap-1.5 rounded-sm px-2 text-[11px] font-medium",
                  active
                    ? "bg-afx-brand/15 text-afx-brand hover:bg-afx-brand/15 hover:text-afx-brand"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon size={12} className="shrink-0" />
                {opt.label}
              </Button>
            );
          })}
        </div>
      </div>

      {pipeline.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <GitBranch />
            </EmptyMedia>
            <EmptyTitle>No features found</EmptyTitle>
            <EmptyDescription>
              Create a spec to get started — run /afx-scaffold spec my-feature in the chat.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ScrollArea className="min-h-0 flex-1">
          {view === "simple" ? (
            <SimplePipelineView rows={filtered} send={send} />
          ) : (
            <GroupedPipelineView view={view} grouped={grouped} send={send} />
          )}
        </ScrollArea>
      )}
    </div>
  );
}

/**
 * Default simple read of feature health and next work.
 *
 * @see docs/specs/225-app-workbench-pipeline/spec.md [FR-3] [FR-6]
 * @see docs/specs/225-app-workbench-pipeline/design.md [DES-PIPELINE-SIMPLE] [DES-PIPELINE-CARD]
 */
function SimplePipelineView({
  rows,
  send,
}: {
  rows: PipelineRow[];
  send: (msg: WorkbenchOutbound) => void;
}) {
  const summary = summarizeRows(rows);
  const upNext = rows.filter((row) => getGroupStatus(row) !== "complete").slice(0, 6);

  return (
    <div className="flex flex-col gap-3 p-3">
      <Card className="afx-surface-card rounded-md shadow-none">
        <CardHeader className="p-3 pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <BarChart2 size={14} className="text-afx-brand" />
            Pipeline overview
          </CardTitle>
          <CardDescription>
            Simple view for a quick read on feature health and next moves.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 p-3 pt-0">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <SummaryTile icon={GitBranch} label="Features" value={summary.features} />
            <SummaryTile
              icon={ListChecks}
              label="Tasks"
              value={`${summary.completedTasks}/${summary.totalTasks}`}
              hint={`${summary.overallPct}%`}
            />
            <SummaryTile
              icon={Clock3}
              label="In flight"
              value={summary.stageCounts.in_progress + summary.stageCounts.ready_to_build}
            />
            <SummaryTile
              icon={CheckCircle2}
              label="Complete"
              value={summary.stageCounts.complete}
            />
          </div>
          <Progress value={summary.overallPct} className="h-1.5" />
          <div className="grid grid-cols-2 gap-1 md:grid-cols-5">
            {GROUP_ORDER.map((status) => (
              <div key={status} className="rounded-sm border bg-muted/20 px-2 py-1.5">
                <span className={`block text-[10px] ${GROUP_BADGE[status]}`}>
                  {GROUP_LABELS[status]}
                </span>
                <span className="font-mono text-sm">{summary.stageCounts[status]}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <section className="flex flex-col gap-2">
        <header className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Up next
          </span>
          <span className="font-mono text-[10px] text-muted-foreground">
            {upNext.length}/{rows.length}
          </span>
        </header>
        {upNext.length > 0 ? (
          <div className="grid gap-2">
            {upNext.map((row) => (
              <PipelineNextRow key={row.name} row={row} send={send} />
            ))}
          </div>
        ) : (
          <p className="rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            No active pipeline items match the current filters.
          </p>
        )}
      </section>
    </div>
  );
}

/**
 * Timeline/grid grouped view of pipeline rows by status.
 *
 * @see docs/specs/225-app-workbench-pipeline/spec.md [FR-4]
 * @see docs/specs/225-app-workbench-pipeline/design.md [DES-PIPELINE-GROUPED]
 */
function GroupedPipelineView({
  view,
  grouped,
  send,
}: {
  view: Exclude<View, "simple">;
  grouped: Array<{ status: GroupStatus; rows: PipelineRow[] }>;
  send: (msg: WorkbenchOutbound) => void;
}) {
  return (
    <div className="flex flex-col gap-4 p-3">
      {grouped.map(({ status, rows }) => (
        <section key={status}>
          <header className="mb-2 flex items-center gap-2">
            <Badge variant="outline" className={`text-[10px] ${GROUP_BADGE[status]}`}>
              {GROUP_LABELS[status]}
            </Badge>
            <span className="text-xs text-muted-foreground">{rows.length}</span>
          </header>
          <div
            className={
              view === "grid"
                ? "grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3"
                : "flex flex-col gap-2"
            }
          >
            {rows.map((row) => (
              <PipelineCard key={row.name} row={row} send={send} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/**
 * Pipeline feature card used in grouped modes.
 *
 * @see docs/specs/225-app-workbench-pipeline/spec.md [FR-5] [FR-6]
 * @see docs/specs/225-app-workbench-pipeline/design.md [DES-PIPELINE-CARD]
 */
function PipelineCard({ row, send }: { row: PipelineRow; send: (msg: WorkbenchOutbound) => void }) {
  const next = getNextAction(row);
  const pct = healthPct(row);
  return (
    <Card className="afx-surface-card rounded-md shadow-none">
      <CardHeader className="p-3 pb-1">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-medium">{row.name}</CardTitle>
          <span className="font-mono text-xs text-muted-foreground">
            {row.completed}/{row.total}
          </span>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 p-3 pt-1">
        <Progress value={pct} className="h-1.5" />
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            className={`cursor-pointer font-mono text-[11px] hover:underline ${next.color}`}
            onClick={() =>
              next.path &&
              send({
                type: "afxOpenFile",
                path: next.path,
                mode: "preview",
              })
            }
          >
            → {next.label}
          </button>
          <FileBadges row={row} />
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Simple-mode action row for the next incomplete feature.
 *
 * @see docs/specs/225-app-workbench-pipeline/spec.md [FR-5] [FR-6]
 * @see docs/specs/225-app-workbench-pipeline/design.md [DES-PIPELINE-CARD]
 */
function PipelineNextRow({
  row,
  send,
}: {
  row: PipelineRow;
  send: (msg: WorkbenchOutbound) => void;
}) {
  const next = getNextAction(row);
  const pct = healthPct(row);
  const status = getGroupStatus(row);

  return (
    <button
      type="button"
      disabled={!next.path}
      onClick={() =>
        next.path &&
        send({
          type: "afxOpenFile",
          path: next.path,
          mode: "preview",
        })
      }
      className="afx-surface-card flex w-full flex-col gap-2 rounded-md border px-3 py-2 text-left transition-colors hover:border-afx-brand/40 hover:bg-accent/30 disabled:cursor-not-allowed disabled:opacity-70"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{row.name}</span>
          <span className={`block font-mono text-[11px] ${next.color}`}>→ {next.label}</span>
        </span>
        <Badge variant="outline" className={`shrink-0 text-[10px] ${GROUP_BADGE[status]}`}>
          {GROUP_LABELS[status]}
        </Badge>
      </div>
      <div className="flex items-center gap-2">
        <Progress value={pct} className="h-1.5 flex-1" />
        <span className="font-mono text-[10px] text-muted-foreground">
          {row.completed}/{row.total}
        </span>
      </div>
    </button>
  );
}

/**
 * Small KPI tile in the simple overview card.
 *
 * @see docs/specs/225-app-workbench-pipeline/spec.md [FR-3]
 * @see docs/specs/225-app-workbench-pipeline/design.md [DES-PIPELINE-SIMPLE]
 */
function SummaryTile({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof GitBranch;
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-md border bg-muted/20 px-2.5 py-2">
      <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Icon size={12} className="text-afx-brand-soft" />
        {label}
      </span>
      <span className="mt-1 flex items-baseline gap-1.5">
        <span className="font-mono text-lg leading-none text-foreground">{value}</span>
        {hint ? <span className="font-mono text-[10px] text-muted-foreground">{hint}</span> : null}
      </span>
    </div>
  );
}

/**
 * Available spec/design/tasks file indicators on a pipeline row.
 *
 * @see docs/specs/225-app-workbench-pipeline/spec.md [FR-6]
 * @see docs/specs/225-app-workbench-pipeline/design.md [DES-PIPELINE-CARD]
 */
function FileBadges({ row }: { row: PipelineRow }) {
  return (
    <div className="flex gap-1">
      {row.specPath ? (
        <Badge variant="outline" className="text-[10px]">
          spec
        </Badge>
      ) : null}
      {row.designPath ? (
        <Badge variant="outline" className="text-[10px]">
          design
        </Badge>
      ) : null}
      {row.tasksPath ? (
        <Badge variant="outline" className="text-[10px]">
          tasks
        </Badge>
      ) : null}
    </div>
  );
}

/**
 * Reduce visible pipeline rows into simple-mode summary metrics.
 *
 * @see docs/specs/225-app-workbench-pipeline/spec.md [FR-3] [FR-5]
 * @see docs/specs/225-app-workbench-pipeline/design.md [DES-PIPELINE-SIMPLE] [DES-PIPELINE-HELPERS]
 */
function summarizeRows(rows: PipelineRow[]) {
  const stageCounts = GROUP_ORDER.reduce(
    (counts, status) => ({ ...counts, [status]: 0 }),
    {} as Record<GroupStatus, number>,
  );
  let completedTasks = 0;
  let totalTasks = 0;

  for (const row of rows) {
    stageCounts[getGroupStatus(row)] += 1;
    completedTasks += row.completed;
    totalTasks += row.total;
  }

  return {
    features: rows.length,
    completedTasks,
    totalTasks,
    overallPct: totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100),
    stageCounts,
  };
}
