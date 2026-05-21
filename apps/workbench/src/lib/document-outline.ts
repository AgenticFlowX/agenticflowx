/**
 * Markdown outline extraction — flat list of headings with line numbers.
 *
 * @see docs/specs/222-app-workbench-documents/spec.md [FR-3] [FR-6] [FR-9]
 * @see docs/specs/222-app-workbench-documents/design.md [DES-DOCS-READER] [DES-DOCS-HELPERS]
 */
import { cleanInlineTraceTokens } from "./markdown-cleanup";

export interface OutlineItem {
  level: number;
  text: string;
  slug: string;
  line: number;
}

const HEADING_RE = /^(#{1,6})\s+(.+?)\s*$/;

/**
 * Generate deterministic markdown heading slugs for outline rows.
 *
 * @see docs/specs/222-app-workbench-documents/spec.md [FR-6]
 * @see docs/specs/222-app-workbench-documents/design.md [DES-DOCS-HELPERS]
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

/**
 * Extract visible markdown headings while ignoring fenced code blocks.
 *
 * @see docs/specs/222-app-workbench-documents/spec.md [FR-3] [FR-6]
 * @see docs/specs/222-app-workbench-documents/design.md [DES-DOCS-READER] [DES-DOCS-HELPERS]
 */
export function extractOutline(content: string): OutlineItem[] {
  const out: OutlineItem[] = [];
  const lines = content.split("\n");
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (line.startsWith("```")) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = HEADING_RE.exec(line);
    if (!m) continue;
    const level = m[1]?.length ?? 1;
    const text = cleanInlineTraceTokens(m[2] ?? "").trim();
    if (!text) continue;
    out.push({ level, text, slug: slugify(text), line: i + 1 });
  }
  return out;
}
