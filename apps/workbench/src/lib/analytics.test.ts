/**
 * @see docs/specs/220-app-workbench/spec.md [FR-9]
 * @see docs/specs/220-app-workbench/design.md [DES-ANALYTICS]
 */
import { describe, expect, it } from "vitest";

import type { FeatureTasksData, GhostTaskResult, JournalEntry, PipelineRow } from "@afx/shared";

import { buildSnapshot, computeCurrentStreak, computeLongestStreak } from "./analytics";

const NOW = new Date("2026-05-01T12:00:00.000Z");

const EMPTY_GHOST: GhostTaskResult = { count: 0, items: [] };

function pipelineRow(overrides: Partial<PipelineRow> = {}): PipelineRow {
  return {
    name: "feat",
    specStatus: "Approved",
    designStatus: "Approved",
    tasksStatus: "In Progress",
    completed: 0,
    total: 0,
    featureStatus: "In Progress",
    ...overrides,
  };
}

function feature(name: string, sessionDates: string[], completed = 0, total = 0): FeatureTasksData {
  return {
    name,
    completed,
    total,
    phases: [],
    workSessions: sessionDates.map((date) => ({
      date,
      task: "1.1",
      action: "Coded",
      filesModified: "",
      agent: true,
      human: false,
    })),
  };
}

describe("computeCurrentStreak", () => {
  it("returns 0 when today has no activity", () => {
    expect(computeCurrentStreak(new Set(["2026-04-29"]), NOW)).toBe(0);
  });

  it("counts consecutive days back from today", () => {
    const dates = new Set(["2026-05-01", "2026-04-30", "2026-04-29", "2026-04-27"]);
    expect(computeCurrentStreak(dates, NOW)).toBe(3);
  });

  it("returns 0 for an empty set", () => {
    expect(computeCurrentStreak(new Set(), NOW)).toBe(0);
  });
});

describe("computeLongestStreak", () => {
  it("returns 0 for empty set", () => {
    expect(computeLongestStreak(new Set())).toBe(0);
  });

  it("returns 1 when there's only a single isolated day", () => {
    expect(computeLongestStreak(new Set(["2026-04-15"]))).toBe(1);
  });

  it("finds the longest consecutive run", () => {
    const dates = new Set([
      "2026-04-01",
      "2026-04-02",
      "2026-04-03",
      "2026-04-10",
      "2026-04-11",
      "2026-04-12",
      "2026-04-13",
      "2026-04-20",
    ]);
    expect(computeLongestStreak(dates)).toBe(4);
  });
});

describe("buildSnapshot", () => {
  it("returns zeroed-out KPIs when there's no data", () => {
    const snap = buildSnapshot([], [], [], EMPTY_GHOST, "30d", NOW);
    expect(snap.totalFeatures).toBe(0);
    expect(snap.sessions).toBe(0);
    expect(snap.activeDays).toBe(0);
    expect(snap.currentStreak).toBe(0);
    expect(snap.longestStreak).toBe(0);
    expect(snap.avgPerDay).toBe(0);
    expect(snap.topFeature).toBe("");
    expect(snap.heatmap).toHaveLength(30);
  });

  it("aggregates sessions, active days, and avg/day across features", () => {
    const features = [
      feature("auth", ["2026-04-30", "2026-04-29", "2026-04-29"]),
      feature("billing", ["2026-04-30", "2026-04-28"]),
    ];
    const snap = buildSnapshot([], features, [], EMPTY_GHOST, "30d", NOW);
    expect(snap.sessions).toBe(5);
    expect(snap.activeDays).toBe(3);
    expect(snap.avgPerDay).toBe(1.7);
  });

  it("picks the feature with the most sessions as topFeature", () => {
    const features = [
      feature("auth", ["2026-04-30", "2026-04-29"]),
      feature("billing", ["2026-04-30", "2026-04-29", "2026-04-28"]),
    ];
    const snap = buildSnapshot([], features, [], EMPTY_GHOST, "30d", NOW);
    expect(snap.topFeature).toBe("billing");
  });

  it("excludes sessions outside the requested range", () => {
    const features = [feature("auth", ["2026-05-01", "2026-04-20", "2026-01-01"])];
    const snap7d = buildSnapshot([], features, [], EMPTY_GHOST, "7d", NOW);
    // 7d window: only the 2026-05-01 session should count
    expect(snap7d.sessions).toBe(1);
    expect(snap7d.activeDays).toBe(1);
  });

  it("produces a heatmap of N cells (oldest first) for fixed ranges", () => {
    const snap = buildSnapshot([], [], [], EMPTY_GHOST, "7d", NOW);
    expect(snap.heatmap).toHaveLength(7);
    expect(snap.heatmap[0]?.date).toBe("2026-04-25");
    expect(snap.heatmap[6]?.date).toBe("2026-05-01");
  });

  it("populates heatmap counts from session dates", () => {
    const features = [feature("auth", ["2026-04-30", "2026-04-30", "2026-04-29"])];
    const snap = buildSnapshot([], features, [], EMPTY_GHOST, "7d", NOW);
    const apr30 = snap.heatmap.find((c) => c.date === "2026-04-30");
    const apr29 = snap.heatmap.find((c) => c.date === "2026-04-29");
    expect(apr30?.count).toBe(2);
    expect(apr29?.count).toBe(1);
  });

  it("preserves existing fields (upNext, recentJournal, ghostCount, stage breakdown)", () => {
    const pipeline: PipelineRow[] = [
      pipelineRow({ name: "a", completed: 5, total: 10 }),
      pipelineRow({
        name: "b",
        completed: 0,
        total: 0,
        specStatus: "",
        designStatus: "",
        tasksStatus: "",
      }),
    ];
    const journal: JournalEntry[] = [
      {
        id: "AUTH-D001",
        date: "2026-04-30T10:00:00.000Z",
        title: "Decision",
        status: "active",
        feature: "a",
        filePath: "j.md",
        line: 1,
      },
    ];
    const ghost: GhostTaskResult = { count: 2, items: [] };
    const snap = buildSnapshot(pipeline, [], journal, ghost, "30d", NOW);
    expect(snap.upNext).toHaveLength(1);
    expect(snap.upNext[0]?.name).toBe("a");
    expect(snap.recentJournal).toHaveLength(1);
    expect(snap.ghostCount).toBe(2);
    expect(snap.stageBreakdown.build).toBe(1);
    expect(snap.stageBreakdown.backlog).toBe(1);
  });
});
