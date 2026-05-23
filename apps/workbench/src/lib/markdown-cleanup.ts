/**
 * Markdown cleanup helpers for Workbench reader surfaces.
 *
 * @see docs/specs/222-app-workbench-documents/spec.md [FR-3] [FR-6] [FR-9]
 * @see docs/specs/222-app-workbench-documents/design.md [DES-DOCS-MARKDOWN] [DES-DOCS-PRD-READER]
 */
import { type MarkdownFence, nextMarkdownFence } from "./markdown-fence";
import { normalizeMarkdownTables } from "./markdown-table";

const TRACE_TOKEN_RE =
  /\s*\[(?:FR|NFR|DES|ADR|AC|REQ|TASK|QA|TRACE|DESIGN|SPEC)-[A-Za-z0-9_.:-]+\]/g;
const SEE_RE = /^\s*(?:[-*]\s*)?@see\b/i;
const MDX_COMPONENT_TAG_RE = /^<\/?[A-Z][A-Za-z0-9]*(?:\s+[^>]*)?>$/;
const FRONTMATTER_BOUNDARY = "---";
const FRONTMATTER_KEY_RE = /^[A-Za-z_][A-Za-z0-9_-]*\s*:/;
const MARKDOWN_ESCAPABLE_CHARS = new Set([
  "\\",
  "`",
  "*",
  "{",
  "}",
  "[",
  "]",
  "(",
  ")",
  "#",
  "+",
  "-",
  ".",
  "!",
  "_",
  "|",
  "<",
  ">",
  "~",
]);

/**
 * Remove AFX frontmatter before rendering markdown preview content.
 *
 * @see docs/specs/222-app-workbench-documents/spec.md [FR-3] [FR-6]
 * @see docs/specs/222-app-workbench-documents/design.md [DES-DOCS-MARKDOWN]
 */
export function stripFrontmatter(raw: string): string {
  const input = raw.startsWith("\uFEFF") ? raw.slice(1) : raw;
  const lines = input.split(/\r?\n/);
  if (lines[0]?.trim() !== FRONTMATTER_BOUNDARY) return input;

  const closeIndex = lines.findIndex(
    (line, index) => index > 0 && line.trim() === FRONTMATTER_BOUNDARY,
  );
  if (closeIndex === -1) return input;

  const yamlLines = lines.slice(1, closeIndex);
  const hasYamlKeys = yamlLines.some((line) => FRONTMATTER_KEY_RE.test(line.trim()));
  if (!hasYamlKeys) return input;

  return lines
    .slice(closeIndex + 1)
    .join("\n")
    .replace(/^\s+/, "");
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
  let fence: MarkdownFence | null = null;
  let inHtmlComment = false;

  for (const line of lines) {
    const nextFence = nextMarkdownFence(line, fence);
    if (nextFence !== fence) {
      fence = nextFence;
      out.push(line);
      continue;
    }

    if (fence) {
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

    const visibleTrimmed = visible.trim();
    if (SEE_RE.test(visibleTrimmed)) continue;
    if (MDX_COMPONENT_TAG_RE.test(visibleTrimmed)) continue;
    visible = visible.replace(/^(\s*[-*]\s+)\[\](?=\s)/, "$1[ ]");
    // Strip trace anchors (`[FR-1]`, `[DES-API]`) only from HEADINGS so the
    // outline/titles stay clean. In prose they are real content — e.g.
    // `> Ref: [DES-EXTRACT], [FR-7]` or `Node IDs: \`[FR-X]\`` — and must survive.
    const isHeading = /^#{1,6}\s/.test(visible.trim());
    out.push((isHeading ? cleanInlineTraceTokens(visible) : visible).replace(/[ \t]+$/g, ""));
  }

  const readable = out.join("\n").replace(/\n{4,}/g, "\n\n\n");
  return normalizeMarkdownTables(readable).trim();
}

/**
 * Hide AFX trace anchors such as `[FR-1]` and `[DES-API]` from reader copy.
 *
 * @see docs/specs/222-app-workbench-documents/spec.md [FR-9]
 * @see docs/specs/222-app-workbench-documents/design.md [DES-DOCS-MARKDOWN]
 */
export function cleanInlineTraceTokens(text: string): string {
  const codeSpans: string[] = [];
  const protectedText = text.replace(/`([^`]+)`/g, (codeSpan: string) => {
    const marker = `@@AFXTRACEKEEP${codeSpans.length}@@`;
    codeSpans.push(codeSpan);
    return marker;
  });

  return protectedText
    .replace(TRACE_TOKEN_RE, "")
    .replace(/@@AFXTRACEKEEP(\d+)@@/g, (_, index: string) => codeSpans[Number(index)] ?? "")
    .replace(/\s{2,}/g, " ")
    .trimEnd();
}

/**
 * Convert markdown heading/source text into the plain label shown in document
 * chrome, outlines, and surgical action controls.
 *
 * @see docs/specs/222-app-workbench-documents/spec.md [FR-6] [FR-9]
 * @see docs/specs/222-app-workbench-documents/design.md [DES-DOCS-READER]
 */
export function cleanInlineMarkdownText(text: string): string {
  const codeSpans: string[] = [];
  const protectedText = text.replace(/`([^`]+)`/g, (_, code: string) => {
    const marker = `@@AFXCODESPAN${codeSpans.length}@@`;
    codeSpans.push(code);
    return marker;
  });

  return cleanInlineTraceTokens(protectedText)
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/(^|[^\w])\*([^*\n]+)\*($|[^\w])/g, "$1$2$3")
    .replace(/(^|[^\w])_([^_\n]+)_($|[^\w])/g, "$1$2$3")
    .replace(/~~([^~]+)~~/g, "$1")
    .replace(/\\(.)/g, (match: string, char: string) =>
      MARKDOWN_ESCAPABLE_CHARS.has(char) ? char : match,
    )
    .replace(/@@AFXCODESPAN(\d+)@@/g, (_, index: string) => codeSpans[Number(index)] ?? "")
    .replace(/\s+/g, " ")
    .trim();
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
