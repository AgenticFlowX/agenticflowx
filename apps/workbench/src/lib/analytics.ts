/**
 * Analytics snapshot — pure pipeline → KPI transformation.
 *
 * @see docs/specs/220-app-workbench/spec.md [FR-9]
 * @see docs/specs/220-app-workbench/design.md [DES-ANALYTICS]
 */
import type { FeatureTasksData, GhostTaskResult, JournalEntry, PipelineRow } from "@afx/shared";

export type Range = "7d" | "30d" | "90d" | "all";

export type Stage = "done" | "build" | "design" | "specify" | "backlog";

export function pipelineRowToStage(row: PipelineRow): Stage {
  if (row.total > 0 && row.completed === row.total) return "done";
  if (row.completed > 0) return "build";
  if (row.designStatus && row.designStatus !== "Draft") return "build";
  if (row.specStatus && row.specStatus !== "Draft") return "design";
  if (row.specStatus) return "specify";
  return "backlog";
}

/** YYYY-MM-DD bucket (UTC) — heatmap cells, streaks, active-day counts. */
export interface HeatmapCell {
  /** ISO date `YYYY-MM-DD`. */
  date: string;
  /** Sessions logged on that day (across all features). */
  count: number;
}

export interface AnalyticsSnapshot {
  totalFeatures: number;
  tasksDone: number;
  tasksTotal: number;
  stageBreakdown: Record<Stage, number>;
  /** Total work sessions inside the active range. */
  sessions: number;
  /** Unique active days inside the range. */
  activeDays: number;
  /** Consecutive days with at least one session, ending today. */
  currentStreak: number;
  /** Longest consecutive-day run inside the range. */
  longestStreak: number;
  /** Sessions per active day (rounded to 1 decimal); 0 if no active days. */
  avgPerDay: number;
  /** Feature with the most sessions in range (empty string if no data). */
  topFeature: string;
  /** Per-day cells, oldest → newest, length = days in range (or 90 for "all"). */
  heatmap: HeatmapCell[];
  upNext: PipelineRow[];
  recentJournal: JournalEntry[];
  ghostCount: number;
}

function daysForRange(range: Range): number {
  switch (range) {
    case "7d":
      return 7;
    case "30d":
      return 30;
    case "90d":
      return 90;
    case "all":
      return 90;
  }
}

function rangeMs(range: Range): number {
  if (range === "all") return Number.POSITIVE_INFINITY;
  return daysForRange(range) * 24 * 60 * 60 * 1000;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Build YYYY-MM-DD strings for the trailing N days, oldest first. */
function lastNDates(n: number, today = new Date()): string[] {
  const dates: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86_400_000);
    dates.push(isoDate(d));
  }
  return dates;
}

/** Walk back from `today` and count consecutive dates present in the set. */
export function computeCurrentStreak(activeDates: Set<string>, today = new Date()): number {
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const day = isoDate(new Date(today.getTime() - i * 86_400_000));
    if (!activeDates.has(day)) break;
    streak++;
  }
  return streak;
}

/** Longest run of consecutive dates in the set (irrespective of "today"). */
export function computeLongestStreak(activeDates: Set<string>): number {
  if (activeDates.size === 0) return 0;
  const sorted = Array.from(activeDates).sort();
  let longest = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1] ?? "";
    const curr = sorted[i] ?? "";
    const prevTime = Date.parse(prev);
    const currTime = Date.parse(curr);
    if (Number.isFinite(prevTime) && Number.isFinite(currTime)) {
      const diffDays = Math.round((currTime - prevTime) / 86_400_000);
      run = diffDays === 1 ? run + 1 : 1;
      if (run > longest) longest = run;
    }
  }
  return longest;
}

export function buildSnapshot(
  pipeline: PipelineRow[],
  featureTasks: FeatureTasksData[],
  journal: JournalEntry[],
  ghostTasks: GhostTaskResult,
  range: Range,
  now: Date = new Date(),
): AnalyticsSnapshot {
  const breakdown: Record<Stage, number> = {
    done: 0,
    build: 0,
    design: 0,
    specify: 0,
    backlog: 0,
  };
  for (const r of pipeline) breakdown[pipelineRowToStage(r)]++;

  const tasksDone = featureTasks.reduce((s, f) => s + f.completed, 0);
  const tasksTotal = featureTasks.reduce((s, f) => s + f.total, 0);

  const upNext = pipeline
    .filter((r) => r.completed < r.total && r.total > 0)
    .sort((a, b) => b.completed / Math.max(b.total, 1) - a.completed / Math.max(a.total, 1))
    .slice(0, 5);

  // Filter sessions to the active window.
  const cutoff = now.getTime() - rangeMs(range);
  const sessionsInRange: Array<{ date: string; feature: string }> = [];
  for (const f of featureTasks) {
    for (const s of f.workSessions) {
      const ts = Date.parse(s.date);
      if (range !== "all" && (!Number.isFinite(ts) || ts < cutoff)) continue;
      // Normalize the date bucket — workSessions can carry full ISO or YYYY-MM-DD.
      const bucket = s.date.length >= 10 ? s.date.slice(0, 10) : s.date;
      sessionsInRange.push({ date: bucket, feature: f.name });
    }
  }

  const activeDates = new Set(sessionsInRange.map((s) => s.date));
  const sessions = sessionsInRange.length;
  const activeDays = activeDates.size;
  const currentStreak = computeCurrentStreak(activeDates, now);
  const longestStreak = computeLongestStreak(activeDates);
  const avgPerDay = activeDays === 0 ? 0 : Math.round((sessions / activeDays) * 10) / 10;

  // Feature with most sessions in range.
  const featureCounts = new Map<string, number>();
  for (const s of sessionsInRange) {
    featureCounts.set(s.feature, (featureCounts.get(s.feature) ?? 0) + 1);
  }
  let topFeature = "";
  let topCount = 0;
  for (const [name, count] of featureCounts) {
    if (count > topCount) {
      topCount = count;
      topFeature = name;
    }
  }

  // Heatmap: trailing N days, oldest first.
  const heatmapDays = daysForRange(range);
  const sessionCountByDate = new Map<string, number>();
  for (const s of sessionsInRange) {
    sessionCountByDate.set(s.date, (sessionCountByDate.get(s.date) ?? 0) + 1);
  }
  const heatmap: HeatmapCell[] = lastNDates(heatmapDays, now).map((date) => ({
    date,
    count: sessionCountByDate.get(date) ?? 0,
  }));

  const recentJournal = journal
    .filter((j) => {
      if (range === "all") return true;
      const t = Date.parse(j.date);
      return Number.isFinite(t) && t >= cutoff;
    })
    .slice(0, 8);

  return {
    totalFeatures: pipeline.length,
    tasksDone,
    tasksTotal,
    stageBreakdown: breakdown,
    sessions,
    activeDays,
    currentStreak,
    longestStreak,
    avgPerDay,
    topFeature,
    heatmap,
    upNext,
    recentJournal,
    ghostCount: ghostTasks.count,
  };
}
