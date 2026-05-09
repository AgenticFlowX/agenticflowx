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

  text.split(/\r?\n/).forEach((line, index) => {
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
