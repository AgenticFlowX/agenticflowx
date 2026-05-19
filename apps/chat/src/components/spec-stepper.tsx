/**
 * SpecStepper — pill-stepper navigator for the AFX SDD workflow.
 *
 * Renders a single row of four numbered pills (Spec · Design · Tasks · Work)
 * connected by a brass progress line. Each pill is clickable: in standard
 * 4-file mode it opens the sibling SDD file or Work Sessions table; in sprint
 * single-file mode it scrolls to SPEC / DESIGN / TASKS / SESSIONS headings.
 *
 * A muted second row directly below carries the active SDD intent label.
 * It stays single-line and hides at tight widths. The Memory anchor lives in
 * the chat top bar and composer actions, not in the stepper.
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-17] [FR-18]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-STRIP]
 */
import { Fragment } from "react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@afx/ui/components/tooltip";
import { cn } from "@afx/ui/lib/utils";

export type SpecStepperSegmentKey = "spec" | "design" | "tasks" | "work";

export type SpecStepperSegmentStatus = "approved" | "draft" | "blocked" | "progress" | "pending";

export interface SpecStepperSegment {
  key: SpecStepperSegmentKey;
  label: "Spec" | "Design" | "Tasks" | "Work";
  glyph: string;
  status: SpecStepperSegmentStatus;
  hint: string;
}

export interface SpecStepperProps {
  /** Four ordered segment descriptors derived from `buildBreadcrumbSegments`. */
  segments: readonly SpecStepperSegment[];
  /** Which segment is currently active (matches the open editor file/section). */
  active: SpecStepperSegmentKey | null;
  /** Format of the active doc — controls standard sibling vs sprint section navigation. */
  format: "sprint" | "standard" | null;
  /** Absolute path of the active doc — used for sprint section jumps. */
  filePath?: string | null;
  /** Resolved sibling SDD file paths (standard 4-file mode). */
  siblingPaths?: {
    spec?: string;
    design?: string;
    tasks?: string;
    journal?: string;
  };
  /** 1-indexed in-file section heading lines (sprint + standard work-sessions). */
  sectionOffsets?: {
    spec?: number;
    design?: number;
    tasks?: number;
    sessions?: number;
  };
  /** True when the open editor is journal.md so the label can name the journal context. */
  journalActive?: boolean;
  /** Tasks completion fraction — feeds the progress-line gradient out of Tasks. */
  tasksCompleted?: number;
  tasksTotal?: number;
  /** Work Sessions row counts — kept for compatibility; Work segment owns display. */
  workSessionsTotal?: number;
  workSessionsSigned?: number;
  /** Host bridge — opens a workspace file at an optional 1-indexed line. */
  onOpenFile: (path: string, line?: number) => void;
  /** Legacy callback retained for the surrounding doc-actions API. */
  onInsertDraft?: (text: string) => void;
}

const SEGMENT_INDEX: Record<SpecStepperSegmentKey, number> = {
  spec: 1,
  design: 2,
  tasks: 3,
  work: 4,
};

export function SpecStepper({
  segments,
  active,
  format,
  filePath,
  siblingPaths,
  sectionOffsets,
  journalActive = false,
  tasksCompleted,
  tasksTotal,
  onOpenFile,
}: SpecStepperProps) {
  if (segments.length === 0) return null;

  const tasksProgressPct =
    typeof tasksCompleted === "number" && typeof tasksTotal === "number" && tasksTotal > 0
      ? Math.min(100, Math.max(0, Math.round((tasksCompleted / tasksTotal) * 100)))
      : null;

  function targetForSegment(segment: SpecStepperSegment): { path: string; line?: number } | null {
    const key = segment.key;
    // The active pill always re-focuses the editor on the same file — no
    // sibling-path resolution needed and it works even when the workspace
    // doesn't have all four files yet.
    if (key === "work") {
      if (format === "sprint") {
        if (!filePath) return null;
        return { path: filePath, line: sectionOffsets?.sessions };
      }
      const tasksPath =
        siblingPaths?.tasks ?? (filePath ? deriveSiblingPath(filePath, "tasks.md") : null);
      if (!tasksPath) return null;
      return { path: tasksPath, line: sectionOffsets?.sessions };
    }
    if (active === key && filePath) {
      if (format === "sprint" && sectionOffsets?.[key]) {
        return { path: filePath, line: sectionOffsets[key] };
      }
      return { path: filePath };
    }
    if (format === "sprint") {
      const line = sectionOffsets?.[key];
      if (!filePath) return null;
      return { path: filePath, line };
    }
    // Standard mode: prefer the host-resolved sibling path, but fall back to
    // deriving `<dirname>/<key>.md` from the active doc when the host missed
    // populating it. The segment status (`approved` / `draft` / `blocked` /
    // `progress`) is proof the host successfully read the sibling's
    // frontmatter — meaning the file exists on disk — so a derived path is
    // safe to dispatch. Only `pending` (no status read at all) stays disabled.
    const hostPath = siblingPaths?.[key];
    if (hostPath) return { path: hostPath };
    if (filePath && segment.status !== "pending") {
      return { path: deriveSiblingPath(filePath, `${key}.md`) };
    }
    return null;
  }

  const sddIntent = sddIntentLabel(active, journalActive);

  return (
    <TooltipProvider delayDuration={250}>
      <div className="@container flex flex-col gap-1.5" data-testid="spec-stepper">
        {/* Tier-1 — pill stepper. Pills and connectors are direct flex
            siblings so connectors (`flex-1`) absorb width when the chat
            panel resizes; pills stay content-sized. */}
        <div className="flex min-w-0 items-center">
          {segments.map((segment, index) => {
            const target = targetForSegment(segment);
            const isActive = active === segment.key;
            const previous = index > 0 ? segments[index - 1] : null;

            return (
              <Fragment key={segment.key}>
                {previous ? (
                  <ConnectorLine
                    prev={previous}
                    next={segment}
                    progressPct={
                      previous.key === "tasks" && previous.status === "progress"
                        ? tasksProgressPct
                        : null
                    }
                  />
                ) : null}
                <SegmentPill
                  segment={segment}
                  active={isActive}
                  target={target}
                  onOpenFile={onOpenFile}
                />
              </Fragment>
            );
          })}
        </div>
        {/* Active SDD intent label — analogous to the Code/Explore Intent tagline,
            but owned by the Spec/SDD workflow stepper instead of the Intent strip. */}
        <p
          className="hidden min-h-5 max-h-6 min-w-0 truncate border-t border-dashed border-border/40 pt-1 text-center text-[10px] leading-none text-muted-foreground @[220px]:block"
          data-testid="spec-stepper-intent-label"
          title={`${sddIntent.label} — ${sddIntent.description}`}
        >
          <span className="font-medium text-foreground/80">{sddIntent.label}</span> —{" "}
          {sddIntent.description}
        </p>
      </div>
    </TooltipProvider>
  );
}

function SegmentPill({
  segment,
  active,
  target,
  onOpenFile,
}: {
  segment: SpecStepperSegment;
  active: boolean;
  target: { path: string; line?: number } | null;
  onOpenFile: (path: string, line?: number) => void;
}) {
  const number = SEGMENT_INDEX[segment.key];
  const tone = pillTone(segment, active);
  const interactive = Boolean(target);
  const disabled = !target;
  const inlineProgress = displayInlineProgress(segment);

  const inner = (
    <span
      className={cn(
        "inline-flex h-6 min-w-0 items-center justify-center gap-1 rounded-full border px-2.5 text-[11px] font-medium leading-none transition-colors",
        tone,
        interactive && "cursor-pointer hover:brightness-110",
        disabled && "cursor-not-allowed opacity-60",
        // Boost contrast on the active pill so "currently viewing" reads at
        // a glance — wider ring with stronger brass tint, plus offset to lift
        // the pill off the connector line.
        active && "ring-2 ring-afx-brand/60 ring-offset-2 ring-offset-background shadow-sm",
      )}
      data-testid={`spec-stepper-segment-${segment.key}`}
      data-status={segment.status}
      data-active={active ? "true" : "false"}
    >
      <span aria-hidden className="font-semibold tabular-nums">
        {number}
      </span>
      <span className="hidden truncate @[300px]:inline">{segment.label}</span>
      {inlineProgress ? (
        <span aria-hidden className="shrink-0">
          {inlineProgress}
        </span>
      ) : null}
    </span>
  );

  const tooltipBody = (
    <span className="flex flex-col gap-0.5 text-left">
      <span className="font-medium">
        {number}. {segment.label}
      </span>
      <span className="text-[11px] leading-snug opacity-85">{segment.hint}</span>
      {interactive ? (
        <span className="font-mono text-[9px] uppercase opacity-70">
          {active ? "Click to refocus" : "Click to open"}
        </span>
      ) : (
        <span className="font-mono text-[9px] uppercase opacity-70">
          {`${segment.label.toLowerCase()}.md not found`}
        </span>
      )}
    </span>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {interactive && target ? (
          <button
            type="button"
            aria-current={active ? "step" : undefined}
            aria-label={`${segment.label} step — ${segment.hint}`}
            onClick={() => onOpenFile(target.path, target.line)}
            className="inline-flex shrink-0 items-center"
          >
            {inner}
          </button>
        ) : (
          <span
            role="presentation"
            aria-current={active ? "step" : undefined}
            className="inline-flex shrink-0 items-center"
          >
            {inner}
          </span>
        )}
      </TooltipTrigger>
      <TooltipContent side="bottom" align="center" className="max-w-[220px] items-start text-left">
        {tooltipBody}
      </TooltipContent>
    </Tooltip>
  );
}

function sddIntentLabel(
  active: SpecStepperSegmentKey | null,
  journalActive: boolean,
): { label: string; description: string } {
  if (journalActive) return { label: "Journal", description: "capture notes and decisions." };
  if (active === null)
    return { label: "Spec", description: "clarify requirements, acceptance, and scope." };
  switch (active) {
    case "design":
      return { label: "Design", description: "shape architecture and tradeoffs." };
    case "tasks":
      return { label: "Tasks", description: "slice implementation into verifiable work." };
    case "work":
      return { label: "Work", description: "track execution sessions and sign-off." };
    case "spec":
      return { label: "Spec", description: "clarify requirements, acceptance, and scope." };
  }
}

function ConnectorLine({
  prev,
  next: _next,
  progressPct,
}: {
  prev: SpecStepperSegment;
  next: SpecStepperSegment;
  progressPct: number | null;
}) {
  // Mark the parameter as intentionally unused — we only need the previous
  // step's status to decide line tone right now, but keeping the signature
  // bidirectional leaves room for future "blocked downstream" flagging.
  void _next;
  if (prev.status === "progress" && progressPct != null) {
    return (
      <span
        aria-hidden
        data-testid="spec-stepper-connector"
        data-style="gradient"
        className="mx-1.5 h-px min-w-2 flex-1"
        style={{
          background: `linear-gradient(to right, var(--afx-brand) ${progressPct}%, color-mix(in srgb, var(--muted-foreground) 30%, transparent) ${progressPct}%)`,
        }}
      />
    );
  }
  if (isReached(prev.status)) {
    return (
      <span
        aria-hidden
        data-testid="spec-stepper-connector"
        data-style="solid"
        className="mx-1.5 h-px min-w-2 flex-1 bg-afx-brand"
      />
    );
  }
  return (
    <span
      aria-hidden
      data-testid="spec-stepper-connector"
      data-style="dotted"
      className="mx-1.5 h-px min-w-2 flex-1 border-t border-dotted border-muted-foreground/40"
    />
  );
}

function isReached(status: SpecStepperSegmentStatus): boolean {
  return status === "approved" || status === "draft" || status === "blocked";
}

/**
 * Derive a sibling SDD file path from the active doc's path. Used as a
 * client-side fallback when the host's `siblingPaths` payload is missing an
 * entry but the segment status (read host-side from frontmatter) proves the
 * file exists. Handles both POSIX and Windows separators.
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-17]
 */
function deriveSiblingPath(activeFilePath: string, siblingFilename: string): string {
  const sep = activeFilePath.includes("\\") ? "\\" : "/";
  const lastSep = activeFilePath.lastIndexOf(sep);
  if (lastSep === -1) return siblingFilename;
  return `${activeFilePath.slice(0, lastSep)}${sep}${siblingFilename}`;
}

function pillTone(segment: SpecStepperSegment, active: boolean): string {
  switch (segment.status) {
    case "approved":
      return "bg-afx-brand text-white border-afx-brand";
    case "progress":
      return "bg-afx-brand text-white border-afx-brand";
    case "draft":
      return active
        ? "bg-afx-brand-soft/30 text-foreground border-afx-brand"
        : "bg-afx-brand-soft/15 text-foreground border-afx-brand-soft/50";
    case "blocked":
      return "bg-amber-500/20 text-amber-700 border-amber-500/50 dark:text-amber-300";
    case "pending":
    default:
      return "border-dashed border-muted-foreground/40 bg-transparent text-muted-foreground";
  }
}

function displayInlineProgress(segment: SpecStepperSegment): string {
  if ((segment.key === "tasks" || segment.key === "work") && segment.status === "progress") {
    return segment.glyph;
  }
  return "";
}
