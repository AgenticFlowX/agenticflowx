/**
 * SpecStepper — pill-stepper navigator for the AFX SDD workflow.
 *
 * Renders a single row of three numbered pills (Spec · Design · Tasks)
 * connected by a brass progress line. Each pill is clickable: in standard
 * 4-file mode it opens the sibling SDD file, in sprint single-file mode it
 * scrolls to the matching `## SPEC` / `## DESIGN` / `## TASKS` heading.
 *
 * A muted tier-2 row directly below carries compact Journal and Work Sessions
 * chips for sibling artifacts of the same feature. It stays single-line and
 * hides low-priority chips at tight widths. The Memory anchor lives in the
 * chat top bar and composer actions, not in the stepper.
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-17] [FR-18]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-STRIP]
 */
import { Fragment, type ReactNode } from "react";

import { BookOpen, ListChecks } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@afx/ui/components/tooltip";
import { cn } from "@afx/ui/lib/utils";

export type SpecStepperSegmentKey = "spec" | "design" | "tasks";

export type SpecStepperSegmentStatus = "approved" | "draft" | "blocked" | "progress" | "pending";

export interface SpecStepperSegment {
  key: SpecStepperSegmentKey;
  label: "Spec" | "Design" | "Tasks";
  glyph: string;
  status: SpecStepperSegmentStatus;
  hint: string;
}

export interface SpecStepperProps {
  /** Three ordered segment descriptors derived from `buildBreadcrumbSegments`. */
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
  /** True when the open editor is journal.md so the tier-2 chip lights up. */
  journalActive?: boolean;
  /** Tasks completion fraction — feeds the progress-line gradient out of Tasks. */
  tasksCompleted?: number;
  tasksTotal?: number;
  /** Work Sessions row counts — drives the tier-2 chip's `n/m` label. */
  workSessionsTotal?: number;
  workSessionsSigned?: number;
  /** Host bridge — opens a workspace file at an optional 1-indexed line. */
  onOpenFile: (path: string, line?: number) => void;
  /**
   * Insert a slash command into the composer draft (no auto-send). Used by
   * the Journal chip — clicking it drops `/afx-session note ` into the
   * textarea so the user can append content and send when ready.
   */
  onInsertDraft?: (text: string) => void;
}

const SEGMENT_INDEX: Record<SpecStepperSegmentKey, number> = {
  spec: 1,
  design: 2,
  tasks: 3,
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
  workSessionsTotal,
  workSessionsSigned,
  onOpenFile,
  onInsertDraft,
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

  // Journal chip is a draft-insert action — clicking it drops
  // `/afx-session note ` into the composer so the user can append content
  // and send when ready. Always interactive when `onInsertDraft` is wired,
  // regardless of whether journal.md exists yet (the slash command auto-
  // creates it).
  const journalDraft = onInsertDraft ? "/afx-session note " : null;

  const sessionsTarget =
    format === "sprint"
      ? filePath && sectionOffsets?.sessions
        ? { path: filePath, line: sectionOffsets.sessions }
        : null
      : siblingPaths?.tasks && sectionOffsets?.sessions
        ? { path: siblingPaths.tasks, line: sectionOffsets.sessions }
        : null;

  const showJournal = true;

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
        {/* Tier-2 — sibling artifacts of the same feature. Hide the whole row
            until a real target can fit; otherwise it reads like stray chrome.
            Memory is workspace-wide and lives in the chat top bar/composer. */}
        <div
          className={cn(
            "hidden min-h-5 max-h-6 min-w-0 flex-nowrap items-center justify-center gap-x-2 overflow-hidden whitespace-nowrap border-t border-dashed border-border/40 pt-1 text-[10px] leading-none text-muted-foreground @[430px]:gap-x-3",
            showJournal ? "@[220px]:flex" : "@[360px]:flex",
          )}
          data-testid="spec-stepper-related-row"
        >
          {showJournal ? (
            <SecondaryChip
              icon={<BookOpen size={10} aria-hidden />}
              label="Journal"
              active={journalActive}
              action={
                journalDraft
                  ? {
                      kind: "draft",
                      text: journalDraft,
                      hint: "Insert /afx-session note into draft",
                    }
                  : null
              }
              disabledHint="Wire onInsertDraft to capture a journal note"
              onOpenFile={onOpenFile}
              onInsertDraft={onInsertDraft}
              testId="spec-stepper-journal"
              className="inline-flex whitespace-nowrap"
            />
          ) : null}
          <SecondaryChip
            icon={<ListChecks size={10} aria-hidden />}
            label={
              typeof workSessionsTotal === "number" && workSessionsTotal > 0
                ? `Work Sessions ${workSessionsSigned ?? 0}/${workSessionsTotal}`
                : "Work Sessions"
            }
            active={false}
            action={
              sessionsTarget
                ? { kind: "open", target: sessionsTarget, hint: "Open Work Sessions table" }
                : null
            }
            disabledHint="No Work Sessions section yet"
            onOpenFile={onOpenFile}
            onInsertDraft={onInsertDraft}
            testId="spec-stepper-sessions"
            className={
              showJournal
                ? "hidden whitespace-nowrap @[430px]:inline-flex"
                : "inline-flex whitespace-nowrap"
            }
          />
        </div>
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
        "inline-flex min-w-0 items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] leading-none transition-colors",
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
      <span aria-hidden className="font-semibold">
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
      <TooltipContent side="bottom" align="center" className="max-w-[220px] text-left">
        {tooltipBody}
      </TooltipContent>
    </Tooltip>
  );
}

function SecondaryChip({
  icon,
  label,
  active,
  action,
  disabledHint,
  onOpenFile,
  onInsertDraft,
  testId,
  className,
}: {
  icon: ReactNode;
  label: string;
  active: boolean;
  /**
   * Either an `open` action that fires `onOpenFile(path, line?)` or a `draft`
   * action that drops a slash command into the composer via `onInsertDraft`.
   * `null` renders the chip disabled.
   */
  action:
    | { kind: "open"; target: { path: string; line?: number }; hint: string }
    | { kind: "draft"; text: string; hint: string }
    | null;
  disabledHint?: string;
  onOpenFile: (path: string, line?: number) => void;
  onInsertDraft?: (text: string) => void;
  testId: string;
  className?: string;
}) {
  const interactive = action !== null;
  const chipClassName = cn(
    "inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 transition-colors",
    interactive && "cursor-pointer hover:bg-muted hover:text-foreground",
    !interactive && "cursor-not-allowed opacity-70",
    active && "text-foreground",
  );

  const content = (
    <span className={chipClassName} data-testid={testId} data-active={active ? "true" : "false"}>
      {active ? <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-afx-brand" /> : null}
      {icon}
      <span>{label}</span>
    </span>
  );

  if (action) {
    function handleClick() {
      if (action!.kind === "open") {
        onOpenFile(action!.target.path, action!.target.line);
      } else if (onInsertDraft) {
        onInsertDraft(action!.text);
      }
    }
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={handleClick}
            aria-label={label}
            data-action-kind={action.kind}
            className={cn("inline-flex shrink-0", className)}
          >
            {content}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[220px] text-left">
          <span className="text-[11px] leading-snug">{action.hint}</span>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn("inline-flex shrink-0", className)} aria-label={label}>
          {content}
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-[220px] text-left">
        <span className="text-[11px] leading-snug">{disabledHint ?? `${label} not available`}</span>
      </TooltipContent>
    </Tooltip>
  );
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
  if (segment.key === "tasks" && segment.status === "progress") {
    return segment.glyph;
  }
  return "";
}
