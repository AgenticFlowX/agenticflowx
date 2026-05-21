/**
 * Markdown cleanup helpers for Workbench reader surfaces.
 *
 * @see docs/specs/222-app-workbench-documents/spec.md [FR-3] [FR-6] [FR-9]
 * @see docs/specs/222-app-workbench-documents/design.md [DES-DOCS-MARKDOWN] [DES-DOCS-PRD-READER]
 */

const FRONTMATTER_RE = /^---[\s\S]*?---\s*/m;
const TRACE_TOKEN_RE =
  /\s*\[(?:FR|NFR|DES|ADR|AC|REQ|TASK|QA|TRACE|DESIGN|SPEC)-[A-Za-z0-9_.:-]+\]/g;
const FENCE_RE = /^(```|~~~)/;
const SEE_RE = /^\s*(?:[-*]\s*)?@see\b/i;

/**
 * Remove AFX frontmatter before rendering markdown preview content.
 *
 * @see docs/specs/222-app-workbench-documents/spec.md [FR-3] [FR-6]
 * @see docs/specs/222-app-workbench-documents/design.md [DES-DOCS-MARKDOWN]
 */
export function stripFrontmatter(raw: string): string {
  return raw.replace(FRONTMATTER_RE, "");
}

/**
 * Remove reader noise from markdown while preserving fenced code blocks.
 *
 * @see docs/specs/222-app-workbench-documents/spec.md [FR-3] [FR-9]
 * @see docs/specs/222-app-workbench-documents/design.md [DES-DOCS-MARKDOWN] [DES-DOCS-PRD-READER]
 */
export function cleanMarkdownForReading(raw: string): string {
  const withoutFrontmatter = stripFrontmatter(raw);
  const lines = withoutFrontmatter.split("\n");
  const out: string[] = [];
  let inFence = false;
  let inHtmlComment = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (FENCE_RE.test(trimmed)) {
      inFence = !inFence;
      out.push(line);
      continue;
    }

    if (inFence) {
      out.push(line);
      continue;
    }

    let visible = line;
    if (inHtmlComment) {
      const close = visible.indexOf("-->");
      if (close === -1) continue;
      visible = visible.slice(close + 3);
      inHtmlComment = false;
    }

    while (visible.includes("<!--")) {
      const open = visible.indexOf("<!--");
      const close = visible.indexOf("-->", open + 4);
      if (close === -1) {
        visible = visible.slice(0, open);
        inHtmlComment = true;
        break;
      }
      visible = visible.slice(0, open) + visible.slice(close + 3);
    }

    if (SEE_RE.test(visible.trim())) continue;
    out.push(cleanInlineTraceTokens(visible).replace(/[ \t]+$/g, ""));
  }

  return out
    .join("\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

/**
 * Hide AFX trace anchors such as `[FR-1]` and `[DES-API]` from reader copy.
 *
 * @see docs/specs/222-app-workbench-documents/spec.md [FR-9]
 * @see docs/specs/222-app-workbench-documents/design.md [DES-DOCS-MARKDOWN]
 */
export function cleanInlineTraceTokens(text: string): string {
  return text
    .replace(TRACE_TOKEN_RE, "")
    .replace(/\s{2,}/g, " ")
    .trimEnd();
}

/**
 * Drop the first H1 when a reader surface already provides the document title.
 *
 * @see docs/specs/222-app-workbench-documents/spec.md [FR-7] [FR-9]
 * @see docs/specs/222-app-workbench-documents/design.md [DES-DOCS-PRD-READER]
 */
export function removeLeadingH1(markdown: string): string {
  return markdown.replace(/^\s*#\s+.+(?:\n+|$)/, "").trim();
}
