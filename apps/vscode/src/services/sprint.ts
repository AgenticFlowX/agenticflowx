/**
 * Sprint section slicer — splits a single-document SDD ("sprint") file into
 * virtual SPEC / DESIGN / TASKS / SESSIONS sub-documents.
 *
 * @see docs/specs/220-app-workbench/spec.md [FR-7]
 * @see docs/specs/220-app-workbench/design.md [DES-WORKBENCH-SPRINT-SLICER]
 */
import { parseFrontmatter } from "@afx/parsers";

export type SprintSection = "SPEC" | "DESIGN" | "TASKS" | "SESSIONS";

export const SPRINT_SECTIONS: SprintSection[] = ["SPEC", "DESIGN", "TASKS", "SESSIONS"];

interface SectionSlice {
  /** Section content as a standalone markdown blob (includes the section's own headings). */
  content: string;
  /** Zero-indexed line in the original file where the section begins. */
  startLine: number;
  /** Zero-indexed line in the original file where `content` starts after trimming outer blanks. */
  contentStartLine: number;
  /** Whether the slice was matched via explicit HTML markers (true) or heading fallback (false). */
  byMarker: boolean;
}

const markerStartRe = (s: SprintSection): RegExp =>
  new RegExp(`<!--\\s*SPRINT-SECTION-START\\s*:\\s*${s}\\b[^>]*-->`, "i");
const markerEndRe = (s: SprintSection): RegExp =>
  new RegExp(`<!--\\s*SPRINT-SECTION-END\\s*:\\s*${s}\\b[^>]*-->`, "i");

const HEADING_FALLBACK: Record<SprintSection, RegExp> = {
  SPEC: /^#{1,2}\s+(?:\d+\.\s+)?(?:Spec|Specification)\b/i,
  DESIGN: /^#{1,2}\s+(?:\d+\.\s+)?(?:Design|Plan)\b/i,
  TASKS: /^#{1,2}\s+(?:\d+\.\s+)?Tasks?\b/i,
  SESSIONS: /^#{1,2}\s+(?:\d+\.\s+)?(?:Work\s+Sessions?|Sessions)\b/i,
};

/** True iff the file's frontmatter declares a sprint-style document. */
export function isSprintFile(raw: string): boolean {
  const data = parseFrontmatter(raw).data ?? {};
  const type = typeof data["type"] === "string" ? data["type"].toUpperCase() : "";
  return type === "SPRINT" || type === "FLUID";
}

/**
 * Extract a single virtual section from a sprint file.
 * Returns `undefined` when the requested section cannot be located.
 */
export function sliceSprintSection(raw: string, section: SprintSection): SectionSlice | undefined {
  const lines = raw.split("\n");

  // Marker-driven slice (canonical).
  const markerStartIdx = findLineMatching(lines, markerStartRe(section));
  const markerEndIdx = findLineMatching(lines, markerEndRe(section));
  if (markerStartIdx >= 0 && markerEndIdx > markerStartIdx) {
    const bodyLines = lines.slice(markerStartIdx + 1, markerEndIdx);
    const firstContentIdx = bodyLines.findIndex((line) => line.trim().length > 0);
    const body = bodyLines.join("\n").trim();
    if (body.length > 0) {
      return {
        content: body,
        startLine: markerStartIdx,
        contentStartLine: markerStartIdx + 1 + Math.max(firstContentIdx, 0),
        byMarker: true,
      };
    }
  }

  // Heading fallback — walk to the first matching H1/H2 and capture until
  // the next heading at the same or higher level. This lets older sprint
  // docs use `# 1. Spec` sections with `##` content headings inside them.
  const fallbackRe = HEADING_FALLBACK[section];
  const startIdx = findLineMatching(lines, fallbackRe);
  if (startIdx === -1) return undefined;
  const startDepth = headingDepth(lines[startIdx] ?? "") ?? 2;

  const collected: string[] = [];
  for (let i = startIdx; i < lines.length; i++) {
    const depth = headingDepth(lines[i] ?? "");
    if (i > startIdx && depth != null && depth <= startDepth) break;
    if (/<!--\s*SPRINT-SECTION-(?:START|END)\b/i.test(lines[i] ?? "")) continue;
    collected.push(lines[i] ?? "");
  }
  const body = collected.join("\n").trim();
  if (!body) return undefined;
  const firstContentIdx = collected.findIndex((line) => line.trim().length > 0);
  return {
    content: body,
    startLine: startIdx,
    contentStartLine: startIdx + Math.max(firstContentIdx, 0),
    byMarker: false,
  };
}

/** Convenience — slice all four sections, returning whichever ones resolve. */
export function sliceAllSprintSections(raw: string): Partial<Record<SprintSection, SectionSlice>> {
  const out: Partial<Record<SprintSection, SectionSlice>> = {};
  for (const s of SPRINT_SECTIONS) {
    const slice = sliceSprintSection(raw, s);
    if (slice) out[s] = slice;
  }
  return out;
}

/**
 * Resolve which sprint section a zero-indexed line falls within.
 * Marker-driven sections take priority; heading-fallback ranges fill the gaps.
 * Returns `undefined` for content above the first section (e.g., References).
 *
 * @see docs/specs/220-app-workbench/spec.md [FR-7]
 * @see docs/specs/220-app-workbench/design.md [DES-WORKBENCH-SPRINT-SLICER]
 */
export function findSectionAt(raw: string, line: number): SprintSection | undefined {
  const lines = raw.split("\n");
  // Marker-driven ranges first — if both markers present, the section owns
  // everything between them (inclusive of headers/comments).
  for (const section of SPRINT_SECTIONS) {
    const startIdx = findLineMatching(lines, markerStartRe(section));
    const endIdx = findLineMatching(lines, markerEndRe(section));
    if (startIdx >= 0 && endIdx > startIdx && line >= startIdx && line <= endIdx) {
      return section;
    }
  }
  // Heading fallback — walk through H1/H2 headings, mapping each to a section
  // if it matches a known fallback pattern. The line belongs to the most
  // recent matching heading until the next heading at the same or higher level.
  let currentSection: SprintSection | undefined;
  let currentDepth: number | undefined;
  for (let i = 0; i <= line && i < lines.length; i++) {
    const ln = lines[i] ?? "";
    const depth = headingDepth(ln);
    if (depth == null) continue;
    let matched: SprintSection | undefined;
    for (const section of SPRINT_SECTIONS) {
      if (HEADING_FALLBACK[section].test(ln)) {
        matched = section;
        break;
      }
    }
    if (matched) {
      currentSection = matched;
      currentDepth = depth;
    } else if (currentDepth != null && depth <= currentDepth) {
      currentSection = undefined;
      currentDepth = undefined;
    }
  }
  return currentSection;
}

/**
 * Parse `<workspace-relative-path>#SECTION` into its parts.
 *
 * @see docs/specs/220-app-workbench/spec.md [FR-7]
 * @see docs/specs/220-app-workbench/design.md [DES-WORKBENCH-SPRINT-SLICER]
 */
export function parseSprintPath(filePath: string): {
  path: string;
  section: SprintSection | undefined;
} {
  const idx = filePath.indexOf("#");
  if (idx === -1) return { path: filePath, section: undefined };
  const rawSection = filePath.slice(idx + 1).toUpperCase();
  const section = (SPRINT_SECTIONS as readonly string[]).includes(rawSection)
    ? (rawSection as SprintSection)
    : undefined;
  return { path: filePath.slice(0, idx), section };
}

function findLineMatching(lines: string[], re: RegExp): number {
  for (let i = 0; i < lines.length; i++) {
    if (re.test(lines[i] ?? "")) return i;
  }
  return -1;
}

function headingDepth(line: string): number | undefined {
  const match = /^(#{1,6})\s+/.exec(line);
  return match?.[1]?.length;
}
