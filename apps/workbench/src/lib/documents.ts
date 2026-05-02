/**
 * Documents view utilities — grouping + freshness helpers.
 *
 * @see docs/specs/220-app-workbench/spec.md [FR-8]
 * @see docs/specs/220-app-workbench/design.md [DES-DOCS]
 */
import type { DocumentRow, GhostTaskResult } from "@afx/shared";

const RENDERABLE_EXTS = new Set(["md", "mdx", "txt"]);

export function isRenderable(doc: DocumentRow): boolean {
  const ext = doc.filePath.split(".").pop()?.toLowerCase() ?? "";
  return RENDERABLE_EXTS.has(ext);
}

export function groupByType(docs: DocumentRow[]): Record<string, DocumentRow[]> {
  const out: Record<string, DocumentRow[]> = {};
  for (const d of docs) {
    const key = d.type || "other";
    (out[key] ??= []).push(d);
  }
  return out;
}

export interface AttentionItem {
  filePath: string;
  reason: string;
  detail?: string;
}

const FOURTEEN_DAYS = 14 * 24 * 60 * 60 * 1000;

export function attentionFor(docs: DocumentRow[], ghostTasks: GhostTaskResult): AttentionItem[] {
  const items: AttentionItem[] = [];
  const now = Date.now();
  for (const d of docs) {
    if (d.status === "Draft") {
      items.push({ filePath: d.filePath, reason: "Draft awaiting approval" });
      continue;
    }
    if (d.updatedAt) {
      const age = now - new Date(d.updatedAt).getTime();
      if (age > FOURTEEN_DAYS) {
        items.push({
          filePath: d.filePath,
          reason: "Stale",
          detail: `Last updated ${Math.floor(age / (24 * 60 * 60 * 1000))}d ago`,
        });
      }
    }
  }
  for (const g of ghostTasks.items) {
    items.push({
      filePath: g.target,
      reason: `Ghost task in ${g.feature}`,
      detail: g.task,
    });
  }
  return items;
}

export function fileIconFor(filePath: string): string {
  const base = filePath.split("/").pop() ?? "";
  if (base === "spec.md") return "file-text";
  if (base === "design.md") return "layout";
  if (base === "tasks.md") return "list-checks";
  if (base === "journal.md") return "book-open";
  if (base.endsWith(".md")) return "file-text";
  return "file";
}
