/**
 * Documents view utilities — grouping + freshness helpers.
 *
 * @see docs/specs/222-app-workbench-documents/spec.md [FR-6]
 * @see docs/specs/222-app-workbench-documents/design.md [DES-DOCS-HELPERS]
 */
import type { DocumentRow, GhostTaskResult } from "@afx/shared";

const RENDERABLE_EXTS = new Set(["md", "mdx", "txt"]);

/**
 * Decide whether a document can be shown in the Workbench reader.
 *
 * @see docs/specs/222-app-workbench-documents/spec.md [FR-5] [FR-6]
 * @see docs/specs/222-app-workbench-documents/design.md [DES-DOCS-HELPERS]
 */
export function isRenderable(doc: DocumentRow): boolean {
  const ext = doc.filePath.split(".").pop()?.toLowerCase() ?? "";
  return RENDERABLE_EXTS.has(ext);
}

/**
 * Bucket documents by frontmatter/type label.
 *
 * @see docs/specs/222-app-workbench-documents/spec.md [FR-6]
 * @see docs/specs/222-app-workbench-documents/design.md [DES-DOCS-HELPERS]
 */
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

/**
 * Build attention rows for draft/stale docs and ghost task references.
 *
 * @see docs/specs/222-app-workbench-documents/spec.md [FR-6]
 * @see docs/specs/222-app-workbench-documents/design.md [DES-DOCS-HELPERS]
 */
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

/**
 * Icon key for document path/type presentation.
 *
 * @see docs/specs/222-app-workbench-documents/spec.md [FR-6]
 * @see docs/specs/222-app-workbench-documents/design.md [DES-DOCS-HELPERS]
 */
export function fileIconFor(filePath: string): string {
  const base = filePath.split("/").pop() ?? "";
  if (base === "spec.md") return "file-text";
  if (base === "design.md") return "layout";
  if (base === "tasks.md") return "list-checks";
  if (base === "journal.md") return "book-open";
  if (base.endsWith(".md")) return "file-text";
  return "file";
}
