/**
 * Sprint section splitter — an AFX sprint doc carries Spec + Design + Tasks (+
 * Work Sessions) in one file, delimited by `<!-- SPRINT-SECTION-START: X -->`
 * markers (heading fallback when markers are absent). Splitting lets the preview
 * render each section with its own AFX action group inline.
 *
 * Mirrors the host `apps/vscode/src/services/sprint.ts` section model.
 *
 * @see docs/specs/222-app-workbench-documents/design.md [DES-DOCS-PREVIEW-STANDALONE]
 */
export type SprintSectionKind = "SPEC" | "DESIGN" | "TASKS" | "SESSIONS";

export interface SprintSegment {
  /** The workflow section this run of content belongs to, or null for preamble/other. */
  kind: SprintSectionKind | null;
  body: string;
  /** 1-based line number in the source document for the first rendered body line. */
  startLine: number;
}

// `[\s\S]*?-->` (not `[^>]*`) so marker comments containing `>` — e.g. the
// "promote ### -> ##" hints in real sprint docs — still match to the closing.
const START_RE = /<!--\s*SPRINT-SECTION-START\s*:\s*(SPEC|DESIGN|TASKS|SESSIONS)\b[\s\S]*?-->/i;
const END_RE = /<!--\s*SPRINT-SECTION-END\s*:\s*(SPEC|DESIGN|TASKS|SESSIONS)\b[\s\S]*?-->/i;

const HEADING_FALLBACK: Record<SprintSectionKind, RegExp> = {
  SPEC: /^#{1,2}\s+(?:\d+\.\s+)?(?:Spec|Specification|References)\b/i,
  DESIGN: /^#{1,2}\s+(?:\d+\.\s+)?(?:Design|Plan)\b/i,
  TASKS: /^#{1,2}\s+(?:\d+\.\s+)?Tasks?\b/i,
  SESSIONS: /^#{1,2}\s+(?:\d+\.\s+)?(?:Work\s+Sessions?|Sessions)\b/i,
};

/** True when the content looks like a single-file sprint doc. */
export function isSprintContent(content: string): boolean {
  return START_RE.test(content) || /^type:\s*(?:SPRINT|FLUID)\b/im.test(content);
}

/**
 * Split sprint content into ordered segments. Marker-delimited sections win;
 * otherwise a `## Heading` matching a section name opens that section until the
 * next section heading. Preamble/unmatched runs carry `kind: null`.
 */
export function splitSprintSections(content: string): SprintSegment[] {
  const lines = content.split("\n");
  const segments: SprintSegment[] = [];
  let current: SprintSectionKind | null = null;
  let inFence = false;
  let buffer: string[] = [];
  let bufferStartLine = 1;

  const flush = (): void => {
    const firstVisible = buffer.findIndex((line) => line.trim().length > 0);
    const body = buffer.join("\n").trim();
    // Skip empty runs and lone `---` separators left between section markers.
    if (body.length > 0 && !/^-{3,}$/.test(body)) {
      segments.push({
        kind: current,
        body,
        startLine: bufferStartLine + Math.max(firstVisible, 0),
      });
    }
    buffer = [];
  };

  const hasMarkers = START_RE.test(content);

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index] ?? "";
    const sourceLine = index + 1;
    if (/^\s*```/.test(line)) inFence = !inFence;

    if (!inFence && hasMarkers) {
      const start = START_RE.exec(line);
      if (start) {
        flush();
        current = start[1]?.toUpperCase() as SprintSectionKind;
        bufferStartLine = sourceLine + 1;
        continue; // drop the marker comment itself
      }
      if (END_RE.test(line)) {
        flush();
        current = null;
        bufferStartLine = sourceLine + 1;
        continue;
      }
    } else if (!inFence && !hasMarkers && /^#{1,2}\s/.test(line)) {
      const matched = (Object.keys(HEADING_FALLBACK) as SprintSectionKind[]).find((k) =>
        HEADING_FALLBACK[k].test(line),
      );
      if (matched && matched !== current) {
        flush();
        current = matched;
        bufferStartLine = sourceLine;
      }
    }

    if (buffer.length === 0) bufferStartLine = sourceLine;
    buffer.push(line);
  }
  flush();
  return segments;
}
