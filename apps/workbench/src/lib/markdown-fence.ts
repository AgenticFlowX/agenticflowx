/**
 * Markdown fenced-code helpers shared by cleanup, table normalization, and
 * preview coverage. CommonMark allows longer outer fences to contain shorter
 * inner fences, which AFX docs use for examples of markdown documents.
 *
 * @see docs/specs/222-app-workbench-documents/spec.md [FR-11]
 * @see docs/specs/222-app-workbench-documents/design.md [DES-DOCS-MARKDOWN] [DES-TEST]
 */

export interface MarkdownFence {
  marker: "`" | "~";
  length: number;
}

const FENCE_MARKER_RE = /^(`{3,}|~{3,})/;

export function nextMarkdownFence(
  line: string,
  active: MarkdownFence | null,
): MarkdownFence | null {
  const marker = FENCE_MARKER_RE.exec(line.trimStart())?.[1];
  if (!marker) return active;

  const fence = marker[0] as "`" | "~";
  if (!active) return { marker: fence, length: marker.length };
  if (active.marker === fence && marker.length >= active.length) return null;
  return active;
}
