/**
 * Markdown outline extraction — flat list of headings with line numbers.
 *
 * @see docs/specs/220-app-workbench/spec.md [FR-8]
 * @see docs/specs/220-app-workbench/design.md [DES-DOCS]
 */
export interface OutlineItem {
  level: number;
  text: string;
  slug: string;
  line: number;
}

const HEADING_RE = /^(#{1,6})\s+(.+?)\s*$/;

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

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
    const text = m[2] ?? "";
    out.push({ level, text, slug: slugify(text), line: i + 1 });
  }
  return out;
}
