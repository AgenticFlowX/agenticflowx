/**
 * Section-aware focus parsing for Spec-mode document actions.
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-15]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-STRIP]
 * @see docs/specs/100-package-shared/design.md [DES-SHARED-CHAT-PROTOCOL]
 */
import type { FocusOption } from "@afx/shared";

export type FocusDocKind = "spec" | "design" | "tasks";

export interface ParseFocusOptions {
  lineOffset?: number;
}

const HEADING_RE = /^(#{2,6})\s+(.+?)\s*#*\s*$/;
const DESIGN_ID_RE = /\[([A-Z]{2,}-[A-Z0-9][A-Z0-9-]*)\]/;
const PHASE_RE = /^(?:\[[^\]]+\]\s*)?(?:phase\s+(\d+|[ivxlcdm]+)\b[:.\-\s]*(.*))$/i;
const FENCE_RE = /^\s*(```+|~~~+)/;
const EXCERPT_MAX_CHARS = 180;

const SKIPPED_HEADINGS = new Set([
  "acceptance criteria",
  "appendix",
  "change log",
  "cross-reference index",
  "design",
  "frontmatter",
  "implementation flow",
  "journal",
  "non-functional requirements",
  "notes",
  "overview",
  "references",
  "sessions",
  "source",
  "spec",
  "table of contents",
  "task breakdown",
  "task numbering convention",
  "tasks",
  "work sessions",
]);

/**
 * Parse composer focus targets from an AFX spec, design, or tasks document.
 *
 * H2 headings provide the normal section boundary. Tasks files additionally
 * admit phase headings at deeper levels because canonical AFX task templates
 * commonly use `### Phase N: ...` under a higher-level task section.
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-15]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-STRIP]
 */
export function parseFocuses(
  text: string,
  docKind: FocusDocKind | null | undefined,
  options: ParseFocusOptions = {},
): FocusOption[] {
  if (!docKind) return [];

  const focuses: FocusOption[] = [];
  const seen = new Set<string>();
  let fence: string | null = null;
  const lineOffset = options.lineOffset ?? 0;
  const lines = text.split(/\r?\n/);

  lines.forEach((line, index) => {
    const fenceMatch = line.match(FENCE_RE);
    if (fenceMatch) {
      const marker = fenceMatch[1]?.startsWith("~") ? "~" : "`";
      if (!fence) fence = marker;
      else if (fence === marker) fence = null;
      return;
    }
    if (fence) return;

    const heading = line.match(HEADING_RE);
    if (!heading) return;

    const level = heading[1]?.length ?? 0;
    const rawTitle = cleanHeadingTitle(heading[2] ?? "");
    const phase = rawTitle.match(PHASE_RE);
    const isPhase = docKind === "tasks" && Boolean(phase);
    if (level !== 2 && !isPhase) return;
    if (!isPhase && shouldSkipHeading(rawTitle)) return;

    const designId = rawTitle.match(DESIGN_ID_RE)?.[1];
    const label = formatLabel(rawTitle, designId);
    const slug = slugify(rawTitle);
    const commandSuffix = isPhase
      ? `phase-${String(phase?.[1] ?? "").toLowerCase()}`
      : designId?.toLowerCase();
    const id = commandSuffix ?? slug;
    if (!id || seen.has(id)) return;
    seen.add(id);

    const focus: FocusOption = {
      id,
      label,
      slug,
      line: lineOffset + index + 1,
    };
    if (commandSuffix) focus.commandSuffix = commandSuffix;
    const excerpt = sectionExcerpt(lines, index + 1, level);
    if (excerpt) focus.excerpt = excerpt;
    focuses.push(focus);
  });

  return focuses;
}

function cleanHeadingTitle(title: string): string {
  return title
    .replace(/<!--.*?-->/g, "")
    .replace(/\s+\{#[^}]+\}\s*$/g, "")
    .replace(/[`*_]/g, "")
    .trim();
}

function shouldSkipHeading(title: string): boolean {
  return SKIPPED_HEADINGS.has(
    title
      .replace(/^\d+\.\s*/, "")
      .replace(DESIGN_ID_RE, "")
      .trim()
      .toLowerCase(),
  );
}

function formatLabel(title: string, designId: string | undefined): string {
  if (!designId) return title;
  return title.replace(`[${designId}]`, `${designId}:`).replace(/\s+/g, " ").trim();
}

function sectionExcerpt(
  lines: string[],
  startIndex: number,
  headingLevel: number,
): string | undefined {
  const chunks: string[] = [];
  let fence: string | null = null;

  for (let index = startIndex; index < lines.length; index++) {
    const line = lines[index] ?? "";
    const fenceMatch = line.match(FENCE_RE);
    if (fenceMatch) {
      const marker = fenceMatch[1]?.startsWith("~") ? "~" : "`";
      if (!fence) fence = marker;
      else if (fence === marker) fence = null;
      continue;
    }
    if (fence) continue;
    const nestedHeading = line.match(HEADING_RE);
    if (nestedHeading) {
      const nestedLevel = nestedHeading[1]?.length ?? 0;
      if (nestedLevel <= headingLevel) break;
      continue;
    }

    const cleaned = cleanExcerptLine(line);
    if (!cleaned) continue;
    chunks.push(cleaned);

    const joined = chunks.join(" ");
    if (joined.length >= EXCERPT_MAX_CHARS) return truncateExcerpt(joined);
  }

  const excerpt = chunks.join(" ");
  return excerpt ? truncateExcerpt(excerpt) : undefined;
}

function cleanExcerptLine(line: string): string {
  return line
    .replace(/<!--.*?-->/g, "")
    .replace(/^\s*[-*+]\s+\[[ xX]?\]\s+/, "")
    .replace(/^\s*[-*+]\s+/, "")
    .replace(/^\s*\d+\.\s+/, "")
    .replace(/^\s*>\s?/, "")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/[*_~#|]/g, "")
    .replace(/^-{3,}$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function truncateExcerpt(value: string): string {
  if (value.length <= EXCERPT_MAX_CHARS) return value;
  return `${value.slice(0, EXCERPT_MAX_CHARS - 3).trimEnd()}...`;
}

/**
 * GitHub-compatible enough markdown slug used by AFX docs and focus commands.
 *
 * @see docs/specs/001-overview/design.md [DES-DATA]
 */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/\[([^\]]+)\]/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
