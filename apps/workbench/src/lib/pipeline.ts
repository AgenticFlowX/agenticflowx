/**
 * Pipeline view utilities — pure transformations of PipelineRow into UI shapes.
 *
 * @see docs/specs/220-app-workbench/spec.md [FR-7]
 * @see docs/specs/220-app-workbench/design.md [DES-PIPELINE]
 */
import type { PipelineRow } from "@afx/shared";

export function healthPct(row: PipelineRow): number {
  if (!row.total) return 0;
  return Math.round((row.completed / row.total) * 100);
}

export type GroupStatus = "in_progress" | "ready_to_build" | "complete" | "blocked" | "not_started";

export function getGroupStatus(row: PipelineRow): GroupStatus {
  if (row.completed === row.total && row.total > 0) return "complete";
  if (row.completed > 0) return "in_progress";
  if (row.specStatus && row.designStatus && row.tasksStatus) return "ready_to_build";
  if (row.featureStatus === "blocked") return "blocked";
  return "not_started";
}

export interface NextAction {
  label: string;
  color: string;
  path?: string;
}

export function getNextAction(row: PipelineRow): NextAction {
  if (!row.specStatus || row.specStatus === "Draft") {
    return { label: "Approve spec", color: "text-amber-400", path: row.specPath };
  }
  if (!row.designStatus || row.designStatus === "Draft") {
    return { label: "Approve design", color: "text-amber-400", path: row.designPath };
  }
  if (row.completed === 0 && row.total > 0) {
    return { label: "Start tasks", color: "text-afx-brand", path: row.tasksPath };
  }
  if (row.completed < row.total) {
    return { label: "Continue tasks", color: "text-afx-brand", path: row.tasksPath };
  }
  return { label: "Complete", color: "text-green-400", path: row.tasksPath };
}

export function groupByFeatureStatus(
  rows: PipelineRow[],
): Array<{ status: GroupStatus; rows: PipelineRow[] }> {
  const buckets = new Map<GroupStatus, PipelineRow[]>();
  for (const r of rows) {
    const key = getGroupStatus(r);
    const list = buckets.get(key) ?? [];
    list.push(r);
    buckets.set(key, list);
  }
  const order: GroupStatus[] = [
    "in_progress",
    "ready_to_build",
    "blocked",
    "not_started",
    "complete",
  ];
  return order
    .filter((s) => buckets.has(s))
    .map((status) => ({ status, rows: buckets.get(status) ?? [] }));
}

export function formatShortDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export function formatRelativeTime(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const diff = Date.now() - d.getTime();
  const day = 24 * 60 * 60 * 1000;
  if (diff < 60 * 1000) return "just now";
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / (60 * 1000))}m ago`;
  if (diff < day) return `${Math.floor(diff / (60 * 60 * 1000))}h ago`;
  if (diff < 30 * day) return `${Math.floor(diff / day)}d ago`;
  return formatShortDate(iso);
}
