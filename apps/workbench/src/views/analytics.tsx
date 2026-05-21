/**
 * Analytics view — glanceable dashboard for the bottom panel.
 *
 * Headline cards (Tasks / Sessions / Streak) sit above a pipeline stage bar
 * and an activity heatmap. The Sessions card includes an inline SVG sparkline
 * built from the heatmap cells — no extra runtime cost.
 *
 * @see docs/specs/226-app-workbench-analytics/spec.md [FR-1] [FR-8] [FR-9]
 * @see docs/specs/226-app-workbench-analytics/design.md [DES-ANALYTICS-RANGE] [DES-ANALYTICS-HEADLINE] [DES-ANALYTICS-HEATMAP] [DES-ANALYTICS-EMPTY]
 */
import { useMemo } from "react";

import {
  Activity,
  BarChart2,
  CheckCircle2,
  FilePlus2,
  Flame,
  GitBranch,
  Layers3,
  Sparkles,
} from "lucide-react";

import { Badge } from "@afx/ui/components/badge";
import { Button } from "@afx/ui/components/button";
import { Progress } from "@afx/ui/components/progress";
import { ScrollArea } from "@afx/ui/components/scroll-area";
import { Separator } from "@afx/ui/components/separator";

import { useWorkbench } from "../context/workbench-context";
import { useLocalStorage } from "../hooks/use-local-storage";
import { type HeatmapCell, type Range, buildSnapshot } from "../lib/analytics";

const RANGES: Array<{ value: Range; label: string }> = [
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "90d", label: "90d" },
  { value: "all", label: "All" },
];

/**
 * Workbench Analytics tab surface: owns range persistence, snapshot creation,
 * headline widgets, stage row, top-feature badges, and heatmap.
 *
 * @see docs/specs/226-app-workbench-analytics/spec.md [FR-1] [FR-8]
 * @see docs/specs/226-app-workbench-analytics/design.md [DES-ANALYTICS-MOCKUP] [DES-ANALYTICS-RANGE]
 */
export default function Analytics() {
  const { pipeline, featureTasks, journal, ghostTasks, send } = useWorkbench();
  const [range, setRange] = useLocalStorage<Range>("afx-analytics-range", "30d");
  const snap = useMemo(
    () => buildSnapshot(pipeline, featureTasks, journal, ghostTasks, range),
    [pipeline, featureTasks, journal, ghostTasks, range],
  );

  if (pipeline.length === 0 && featureTasks.length === 0) {
    return (
      <AnalyticsEmptyGuide
        onCreateSample={() => send({ type: "afxCreateSampleDocs", kind: "full-spec" })}
      />
    );
  }

  const taskPct = snap.tasksTotal === 0 ? 0 : Math.round((snap.tasksDone / snap.tasksTotal) * 100);
  const flightCount = snap.upNext.length;

  return (
    <div className="flex h-full flex-col">
      {/*
        Surface: Workbench.Analytics.Range
        @see docs/specs/226-app-workbench-analytics/design.md [DES-ANALYTICS-RANGE]
      */}
      <header className="afx-surface-toolbar flex items-center justify-between gap-3 border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <BarChart2 size={14} className="text-afx-brand" />
          <h3 className="text-xs font-medium">Analytics</h3>
          <span className="font-mono text-[10px] text-muted-foreground">overview</span>
        </div>
        <div className="flex items-center gap-0.5 rounded-md border border-border bg-card/50 p-0.5">
          {RANGES.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setRange(r.value)}
              aria-pressed={range === r.value}
              className={`cursor-pointer rounded-sm px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider transition-colors ${
                range === r.value
                  ? "bg-afx-brand/15 text-afx-brand"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </header>

      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-3 p-3">
          {/*
            Surface: Workbench.Analytics.Headline
            @see docs/specs/226-app-workbench-analytics/design.md [DES-ANALYTICS-HEADLINE]
          */}
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            <HeadlineCard
              icon={CheckCircle2}
              label="Tasks"
              primary={`${snap.tasksDone}`}
              suffix={`/ ${snap.tasksTotal}`}
              hint={`${taskPct}% complete`}
              progress={taskPct}
              accent="text-afx-success"
            />
            <HeadlineCard
              icon={Activity}
              label="Sessions"
              primary={`${snap.sessions}`}
              suffix={snap.activeDays > 0 ? `· ${snap.activeDays} active days` : undefined}
              hint={
                snap.avgPerDay > 0
                  ? `${snap.avgPerDay.toFixed(1)} avg / day`
                  : "Log work to see trends"
              }
              sparkline={snap.heatmap}
              accent="text-afx-brand"
            />
            <HeadlineCard
              icon={Flame}
              label="Streak"
              primary={`${snap.currentStreak}d`}
              suffix={
                snap.longestStreak > snap.currentStreak
                  ? `· best ${snap.longestStreak}d`
                  : undefined
              }
              hint={
                snap.currentStreak === 0
                  ? "No active streak"
                  : snap.currentStreak === snap.longestStreak
                    ? "Personal best — keep going"
                    : "On a roll"
              }
              accent={snap.currentStreak > 0 ? "text-afx-brand" : "text-muted-foreground"}
            />
          </div>

          {/*
            Surface: Workbench.Analytics.StageAndTopFeature
            @see docs/specs/226-app-workbench-analytics/design.md [DES-ANALYTICS-STAGE] [DES-ANALYTICS-TOP-FEATURE]
          */}
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            <div className="afx-surface-card md:col-span-2 flex flex-col gap-2 rounded-md border border-border p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <GitBranch size={11} className="text-afx-brand-soft" />
                  Pipeline
                </div>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {snap.totalFeatures} features
                </span>
              </div>
              <StageBar
                done={snap.stageBreakdown.done}
                build={snap.stageBreakdown.build}
                design={snap.stageBreakdown.design}
                specify={snap.stageBreakdown.specify}
                backlog={snap.stageBreakdown.backlog}
                total={snap.totalFeatures}
              />
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                <StageDot color="bg-afx-success" label="Done" value={snap.stageBreakdown.done} />
                <StageDot color="bg-afx-brand" label="Build" value={snap.stageBreakdown.build} />
                <StageDot color="bg-purple-400" label="Design" value={snap.stageBreakdown.design} />
                <StageDot
                  color="bg-amber-400"
                  label="Specify"
                  value={snap.stageBreakdown.specify}
                />
                <StageDot
                  color="bg-muted-foreground/50"
                  label="Backlog"
                  value={snap.stageBreakdown.backlog}
                />
              </div>
            </div>

            <div className="afx-surface-card flex flex-col gap-2 rounded-md border border-border p-3">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                <Sparkles size={11} className="text-afx-brand-soft" />
                Top feature
              </div>
              <span className="truncate font-mono text-sm text-foreground" title={snap.topFeature}>
                {snap.topFeature || "—"}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {snap.topFeature ? "Most sessions in range" : "No sessions in range"}
              </span>
              {flightCount > 0 || snap.ghostCount > 0 ? (
                <>
                  <Separator className="my-1" />
                  <div className="flex flex-wrap items-center gap-1.5">
                    {flightCount > 0 && (
                      <Badge variant="outline" className="text-[10px]">
                        {flightCount} in flight
                      </Badge>
                    )}
                    {snap.ghostCount > 0 && (
                      <Badge
                        variant="outline"
                        className="border-amber-500/30 text-[10px] text-amber-400"
                      >
                        {snap.ghostCount} ghost refs
                      </Badge>
                    )}
                  </div>
                </>
              ) : null}
            </div>
          </div>

          {/*
            Surface: Workbench.Analytics.Heatmap
            @see docs/specs/226-app-workbench-analytics/design.md [DES-ANALYTICS-HEATMAP]
          */}
          <div className="afx-surface-card flex flex-col gap-3 rounded-md border border-border p-3">
            <Heatmap cells={snap.heatmap} />
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

/**
 * Empty Analytics onboarding with a preview of the dashboard once markdown
 * specs, tasks, journals, and boards exist.
 *
 * @see docs/specs/226-app-workbench-analytics/spec.md [FR-8] [FR-9]
 * @see docs/specs/226-app-workbench-analytics/design.md [DES-ANALYTICS-EMPTY]
 */
function AnalyticsEmptyGuide({ onCreateSample }: { onCreateSample: () => void }) {
  const previewCells = [0, 1, 0, 2, 1, 3, 0, 0, 2, 4, 1, 0, 3, 2];

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background text-foreground">
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex min-h-full flex-col gap-2 p-3">
          <header className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-b border-border pb-2">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-afx-brand/25 bg-afx-brand/10 text-afx-brand">
                <BarChart2 size={17} aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-afx-brand-soft">
                  Analytics
                </p>
                <h2 className="truncate text-base font-semibold leading-tight">
                  Your project heartbeat will land here
                </h2>
              </div>
            </div>
            <div className="flex min-w-0 items-center gap-2">
              <Button type="button" size="sm" className="h-8 gap-1.5" onClick={onCreateSample}>
                <FilePlus2 size={13} />
                Sample SDD set
              </Button>
              <Badge variant="outline" className="h-8 px-2 font-mono text-[10px]">
                docs/specs + .afx
              </Badge>
            </div>
          </header>

          <section className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2">
            {[
              ["Tasks", "completion + next slices"],
              ["Sessions", "decisions + active days"],
              ["Pipeline", "spec/design/build mix"],
              ["Attention", "in-flight + ghost refs"],
            ].map(([label, body]) => (
              <div key={label} className="rounded-md border border-border bg-muted/20 px-3 py-2">
                <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  {label}
                </div>
                <div className="mt-0.5 text-xs leading-4 text-foreground/90">{body}</div>
              </div>
            ))}
          </section>

          <section className="min-w-0 rounded-md border border-border bg-muted/15 p-2.5">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Layers3 size={14} className="text-afx-brand" aria-hidden />
                <span className="text-sm font-medium">Preview once signals exist</span>
              </div>
              <Badge variant="outline" className="text-[10px]">
                mock
              </Badge>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <MockMetric label="Tasks" value="18 / 24" tone="text-afx-success" />
              <MockMetric label="Sessions" value="9" tone="text-afx-brand" />
              <MockMetric label="Streak" value="4d" tone="text-amber-400" />
            </div>
            <div className="mt-2 rounded-md border border-border bg-background/70 p-2">
              <div className="mb-2 flex items-center justify-between text-[10px] text-muted-foreground">
                <span className="uppercase tracking-[0.14em]">Pipeline mix</span>
                <span className="font-mono">6 features</span>
              </div>
              <div className="flex h-2 overflow-hidden rounded-full bg-muted">
                <span className="w-[28%] bg-afx-success" />
                <span className="w-[32%] bg-afx-brand" />
                <span className="w-[18%] bg-purple-400" />
                <span className="w-[12%] bg-amber-400" />
                <span className="w-[10%] bg-muted-foreground/50" />
              </div>
              <div className="mt-2 grid grid-cols-7 gap-1">
                {previewCells.map((value, index) => (
                  <span
                    key={index}
                    className={`h-3 rounded-sm border border-border/50 ${
                      value === 0
                        ? "bg-muted/40"
                        : value === 1
                          ? "bg-afx-brand/25"
                          : value === 2
                            ? "bg-afx-brand/45"
                            : value === 3
                              ? "bg-afx-brand/70"
                              : "bg-afx-brand"
                    }`}
                  />
                ))}
              </div>
            </div>
          </section>
        </div>
      </ScrollArea>
    </div>
  );
}

function MockMetric({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-md border border-border bg-background/70 px-3 py-1.5">
      <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </div>
      <div className={`mt-0.5 text-base font-semibold leading-tight ${tone}`}>{value}</div>
    </div>
  );
}

/**
 * Dashboard KPI card. Renders either a progress bar or the sessions sparkline.
 *
 * @see docs/specs/226-app-workbench-analytics/spec.md [FR-2] [FR-3]
 * @see docs/specs/226-app-workbench-analytics/design.md [DES-ANALYTICS-HEADLINE] [DES-ANALYTICS-SPARKLINE]
 */
function HeadlineCard({
  icon: Icon,
  label,
  primary,
  suffix,
  hint,
  progress,
  sparkline,
  accent,
}: {
  icon: typeof Activity;
  label: string;
  primary: string;
  suffix?: string;
  hint?: string;
  progress?: number;
  sparkline?: HeatmapCell[];
  accent?: string;
}) {
  return (
    <div className="afx-surface-card flex flex-col gap-2 rounded-md border border-border p-3">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
          <Icon size={11} className={accent ?? "text-afx-brand-soft"} />
          {label}
        </span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className={`text-2xl font-semibold leading-none ${accent ?? "text-foreground"}`}>
          {primary}
        </span>
        {suffix && <span className="font-mono text-[11px] text-muted-foreground">{suffix}</span>}
      </div>
      {sparkline && sparkline.length > 1 ? (
        <Sparkline cells={sparkline} />
      ) : progress !== undefined ? (
        <Progress value={progress} className="h-1" />
      ) : null}
      {hint && <span className="text-[10px] text-muted-foreground">{hint}</span>}
    </div>
  );
}

/**
 * Inline sessions trend built directly from heatmap cells.
 *
 * @see docs/specs/226-app-workbench-analytics/spec.md [FR-3]
 * @see docs/specs/226-app-workbench-analytics/design.md [DES-ANALYTICS-SPARKLINE]
 */
function Sparkline({ cells }: { cells: HeatmapCell[] }) {
  const counts = cells.map((c) => c.count);
  const max = Math.max(1, ...counts);
  const len = cells.length;
  const width = 100;
  const height = 20;
  const stepX = len > 1 ? width / (len - 1) : width;
  const points = counts
    .map((c, i) => {
      const x = i * stepX;
      const y = height - (c / max) * height;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
  const areaPoints = `0,${height} ${points} ${width},${height}`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="h-5 w-full"
      role="img"
      aria-label="Sessions trend"
    >
      <polygon points={areaPoints} fill="currentColor" className="text-afx-brand/15" />
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-afx-brand"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/**
 * Pipeline stage distribution bar.
 *
 * @see docs/specs/226-app-workbench-analytics/spec.md [FR-4]
 * @see docs/specs/226-app-workbench-analytics/design.md [DES-ANALYTICS-STAGE]
 */
function StageBar({
  done,
  build,
  design,
  specify,
  backlog,
  total,
}: {
  done: number;
  build: number;
  design: number;
  specify: number;
  backlog: number;
  total: number;
}) {
  if (total === 0) {
    return <div className="h-1.5 w-full rounded-full bg-muted/40" />;
  }
  const pct = (n: number) => `${(n / total) * 100}%`;
  return (
    <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted/30">
      {done > 0 && <span className="block h-full bg-afx-success" style={{ width: pct(done) }} />}
      {build > 0 && <span className="block h-full bg-afx-brand" style={{ width: pct(build) }} />}
      {design > 0 && <span className="block h-full bg-purple-400" style={{ width: pct(design) }} />}
      {specify > 0 && (
        <span className="block h-full bg-amber-400" style={{ width: pct(specify) }} />
      )}
      {backlog > 0 && (
        <span className="block h-full bg-muted-foreground/40" style={{ width: pct(backlog) }} />
      )}
    </div>
  );
}

/**
 * Legend row item for the stage breakdown.
 *
 * @see docs/specs/226-app-workbench-analytics/spec.md [FR-4]
 * @see docs/specs/226-app-workbench-analytics/design.md [DES-ANALYTICS-STAGE]
 */
function StageDot({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <span className="flex items-center gap-1">
      <span className={`size-1.5 rounded-full ${color}`} />
      {label}
      <span className="font-mono text-foreground">{value}</span>
    </span>
  );
}

/**
 * 7-row × N-col heatmap. Rows are days of the week (Mon..Sun), columns are
 * weeks. Cell intensity scales with session count using the same brand color
 * at four opacities — same visual idiom as Claude/GitHub contribution graphs.
 *
 * @see docs/specs/226-app-workbench-analytics/spec.md [FR-6]
 * @see docs/specs/226-app-workbench-analytics/design.md [DES-ANALYTICS-HEATMAP]
 */
function Heatmap({ cells }: { cells: HeatmapCell[] }) {
  if (cells.length === 0) return null;

  // Bucket cells into weeks. Find the max count across the range to scale buckets.
  const maxCount = Math.max(0, ...cells.map((c) => c.count));
  const grid = bucketIntoWeeks(cells);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Activity</span>
        <span className="font-mono text-[10px] text-muted-foreground">
          {cells[0]?.date} → {cells[cells.length - 1]?.date}
        </span>
      </div>
      <div className="flex gap-[3px]">
        {grid.map((week, wIdx) => (
          <div key={wIdx} className="flex flex-col gap-[3px]">
            {week.map((cell, dIdx) => (
              <span
                key={dIdx}
                className={`block size-3 rounded-sm ${cellClass(cell?.count ?? -1, maxCount)}`}
                title={
                  cell ? `${cell.date} · ${cell.count} session${cell.count === 1 ? "" : "s"}` : ""
                }
                aria-label={cell ? `${cell.date}: ${cell.count} sessions` : "no activity"}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <span>Less</span>
        <span className="block size-2.5 rounded-sm bg-muted/40" />
        <span className="block size-2.5 rounded-sm bg-afx-brand/25" />
        <span className="block size-2.5 rounded-sm bg-afx-brand/50" />
        <span className="block size-2.5 rounded-sm bg-afx-brand/75" />
        <span className="block size-2.5 rounded-sm bg-afx-brand" />
        <span>More</span>
      </div>
    </div>
  );
}

/**
 * Cell color by quartile of `count` against `max`; -1 indicates a placeholder slot.
 *
 * @see docs/specs/226-app-workbench-analytics/spec.md [FR-6]
 * @see docs/specs/226-app-workbench-analytics/design.md [DES-ANALYTICS-HEATMAP]
 */
function cellClass(count: number, max: number): string {
  if (count < 0) return "bg-transparent";
  if (count === 0 || max === 0) return "bg-muted/40";
  const pct = count / max;
  if (pct <= 0.25) return "bg-afx-brand/25";
  if (pct <= 0.5) return "bg-afx-brand/50";
  if (pct <= 0.75) return "bg-afx-brand/75";
  return "bg-afx-brand";
}

/**
 * Pad to align day-of-week. Returns column-major weeks: each inner array is
 * one column (a week), 7 rows tall (Mon..Sun). Empty leading/trailing slots
 * are returned as `null` so the renderer can paint them transparent.
 *
 * @see docs/specs/226-app-workbench-analytics/spec.md [FR-6]
 * @see docs/specs/226-app-workbench-analytics/design.md [DES-ANALYTICS-HEATMAP]
 */
function bucketIntoWeeks(cells: HeatmapCell[]): Array<Array<HeatmapCell | null>> {
  if (cells.length === 0) return [];
  // Day index where Monday=0..Sunday=6, derived from the JS getDay() (Sun=0..Sat=6).
  const dayIdx = (date: string): number => {
    const d = new Date(`${date}T00:00:00Z`);
    const js = d.getUTCDay(); // 0..6 (Sun..Sat)
    return (js + 6) % 7; // shift so Mon=0
  };

  const weeks: Array<Array<HeatmapCell | null>> = [];
  let current: Array<HeatmapCell | null> = Array.from({ length: 7 }, () => null);
  let firstWeek = true;

  for (const cell of cells) {
    const idx = dayIdx(cell.date);
    if (firstWeek) {
      current[idx] = cell;
      if (idx === 6) {
        weeks.push(current);
        current = Array.from({ length: 7 }, () => null);
        firstWeek = false;
      }
      continue;
    }
    if (idx === 0 && current.some((c) => c !== null)) {
      weeks.push(current);
      current = Array.from({ length: 7 }, () => null);
    }
    current[idx] = cell;
  }
  if (current.some((c) => c !== null)) weeks.push(current);
  return weeks;
}
