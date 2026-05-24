/**
 * Shared document studio reader for AFX markdown surfaces.
 *
 * @see docs/specs/222-app-workbench-documents/spec.md [FR-3] [FR-4] [FR-7] [FR-9]
 * @see docs/specs/222-app-workbench-documents/design.md [DES-DOCS-READER] [DES-DOCS-STUDIO] [DES-DOCS-MARKDOWN]
 * @see docs/specs/227-app-workbench-shell/spec.md [FR-6] [FR-12]
 * @see docs/specs/227-app-workbench-shell/design.md [DES-SHELL-FEATURE-COLUMNS]
 */
import { useMemo } from "react";

import { ListChecks } from "lucide-react";

import type { DocumentRow } from "@afx/shared";
import { cn } from "@afx/ui/lib/utils";

import { CommandToolbar, type CommandToolbarAction } from "../components/command-toolbar";
import { SessionSignoffToolbar } from "../components/session-signoff-toolbar";
import { slugify } from "./document-outline";
import { parseSimpleFrontmatter } from "./frontmatter";
import { cleanInlineMarkdownText, cleanMarkdownForReading } from "./markdown-cleanup";
import {
  type MarkdownCheckboxToggle,
  type MarkdownHeadingActionRenderer,
  type MarkdownHeadingInfo,
  MinimalMarkdown,
} from "./markdown-render";
import {
  DEFAULT_READING_PREFS,
  type ReadingPrefs,
  type ReadingSize,
  readingTitleSizeClass,
  readingWidthClass,
} from "./reading-prefs";
import { type SprintSectionKind, isSprintContent, splitSprintSections } from "./sprint-sections";
import { summarizeWorkSessionSignoffs } from "./work-sessions";

export type DocumentStudioAction = CommandToolbarAction;
export type DocumentSessionBulkAction =
  | { type: "toggleAll"; column: "agent" | "human"; completed: boolean }
  | { type: "approve" };

interface TaskActionTarget {
  id: string;
  title: string;
  phaseNumber?: string;
  phaseName?: string;
}

interface ParsedTaskTarget extends TaskActionTarget {
  checkboxCount: number;
  uncheckedCount: number;
  line: number;
  headingLevel: number;
}

interface TaskPhaseActionTarget {
  number: string;
  name: string;
  tasks: ParsedTaskTarget[];
  line: number;
  headingLevel: number;
}

const TOOLBAR_OVERFLOW_LIMIT = 5;
const SURGICAL_TOOLBAR_OVERFLOW_LIMIT = 3;
const PHASE_HEADING_RE = /^#{2,3}\s+Phase\s+(\d+)\s*:\s*(.+?)\s*$/i;
const TASK_GROUP_HEADING_RE = /^(#{3,5})\s+(\d+\.\d+(?:\.\d+)*)\s+(.+?)\s*$/;
const ANY_HEADING_RE = /^(#{1,6})\s+/;
const CHECKBOX_RE = /^\s*[-*]\s+\[([ xX]?)\]\s+/;

interface DocumentStudioProps {
  doc: DocumentRow;
  content: string | undefined;
  variant?: "full" | "column";
  actions?: DocumentStudioAction[];
  onCommand?: (command: string, mode?: "insert" | "send") => void;
  onCheckboxToggle?: (target: MarkdownCheckboxToggle) => void;
  onSessionBulkAction?: (action: DocumentSessionBulkAction) => void;
  className?: string;
  /** Reading preferences (full variant only): width, text size, tone, font. */
  reading?: ReadingPrefs;
}

export function DocumentStudio({
  doc,
  content,
  variant = "full",
  actions = [],
  onCommand,
  onCheckboxToggle,
  onSessionBulkAction,
  className,
  reading = DEFAULT_READING_PREFS,
}: DocumentStudioProps) {
  const compact = variant === "column";
  const frontmatter = useMemo(() => (content ? parseSimpleFrontmatter(content) : {}), [content]);
  const title = documentTitle(doc, content);
  const feature = featureFromPath(doc.filePath) ?? doc.filePath;
  const sprintLike = useMemo(() => (content ? isSprintContent(content) : false), [content]);

  if (!content) {
    return <p className="p-4 text-sm text-muted-foreground">Loading...</p>;
  }

  // Reading-first layout (full variant): title + flowing prose at a comfortable
  // measure, no dashboard chrome. Metrics/outline live in the DocPreview rail.
  if (!compact) {
    const metaVersion = stringMeta(frontmatter, "version");
    const metaUpdated = formatShortDate(doc.updatedAt);
    const fullByline = [
      doc.status || stringMeta(frontmatter, "status"),
      stringMeta(frontmatter, "owner"),
      metaVersion ? `v${metaVersion.replace(/^v/i, "")}` : undefined,
      metaUpdated ? `Updated ${metaUpdated}` : undefined,
    ].filter((part): part is string => Boolean(part));
    return (
      <article
        data-afx-doc-surface="document-studio"
        data-afx-doc-type={doc.type || "DOC"}
        className={cn(
          "mx-auto flex w-full min-w-0 flex-col gap-6 rounded-xl border border-border/60 px-7 py-8 shadow-[0_1px_0_rgba(255,255,255,0.04),0_10px_30px_rgba(0,0,0,0.16)]",
          readingWidthClass(reading.width),
          reading.tone === "warm" ? "afx-paper afx-paper--warm" : "afx-paper bg-card",
          reading.font === "serif" && "font-serif",
          className,
        )}
      >
        <header className="flex flex-col gap-4 border-b border-border/50 pb-5">
          <div className="min-w-0">
            <p className="afx-doc-eyebrow font-mono text-[10px] uppercase tracking-[0.18em] text-afx-brand-soft">
              {doc.type || "Document"}
            </p>
            <h1
              className={cn(
                "mt-1.5 max-w-full text-pretty break-words font-semibold leading-snug tracking-tight text-foreground",
                readingTitleSizeClass(reading.size),
              )}
            >
              {title}
            </h1>
            {fullByline.length > 0 ? (
              <p className="afx-doc-byline mt-2.5 font-mono text-[11px] tracking-wide text-muted-foreground">
                {fullByline.join("  ·  ")}
              </p>
            ) : null}
          </div>
          {actions.length > 0 ? (
            <CommandToolbar
              actions={actions}
              onCommand={onCommand}
              scope="document"
              ariaLabel="Document command toolbar"
            />
          ) : null}
        </header>
        <DocumentStudioBody
          doc={doc}
          content={content}
          feature={feature}
          sprintLike={sprintLike}
          scale={reading.size}
          density="relaxed"
          onCommand={onCommand}
          onCheckboxToggle={onCheckboxToggle}
          onSessionBulkAction={onSessionBulkAction}
        />
      </article>
    );
  }

  return (
    <article
      data-afx-doc-surface="document-studio"
      data-afx-doc-type={doc.type || "DOC"}
      className={cn(
        "afx-paper mx-auto flex w-full min-w-0 flex-col gap-4 overflow-hidden rounded-xl border border-border/60 px-5 py-5 shadow-[0_1px_0_rgba(255,255,255,0.04),0_10px_30px_rgba(0,0,0,0.10)]",
        readingWidthClass(reading.width),
        reading.tone === "warm" ? "afx-paper--warm" : "bg-card",
        reading.font === "serif" && "font-serif",
        className,
      )}
    >
      <header className="flex min-w-0 flex-col gap-3 border-b border-border/60 pb-3">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-afx-brand-soft">
            {doc.type || "Document"}
          </p>
          <h1 className="mt-1 max-w-full break-words text-lg font-semibold leading-tight tracking-normal text-foreground [overflow-wrap:anywhere]">
            {title}
          </h1>
        </div>
        {actions.length > 0 ? (
          <CommandToolbar
            actions={actions}
            onCommand={onCommand}
            scope="document-column"
            density="compact"
            overflowAfter={3}
            actionAria="label"
          />
        ) : null}
      </header>
      <DocumentStudioBody
        doc={doc}
        content={content}
        feature={feature}
        sprintLike={sprintLike}
        scale={reading.size}
        density="relaxed"
        onCommand={onCommand}
        onCheckboxToggle={onCheckboxToggle}
        onSessionBulkAction={onSessionBulkAction}
      />
    </article>
  );
}

function DocumentStudioBody({
  doc,
  content,
  feature,
  sprintLike,
  scale,
  density,
  onCommand,
  onCheckboxToggle,
  onSessionBulkAction,
}: {
  doc: DocumentRow;
  content: string;
  feature: string;
  sprintLike: boolean;
  scale: ReadingSize;
  density: "default" | "relaxed";
  onCommand: ((command: string, mode?: "insert" | "send") => void) | undefined;
  onCheckboxToggle: ((target: MarkdownCheckboxToggle) => void) | undefined;
  onSessionBulkAction: ((action: DocumentSessionBulkAction) => void) | undefined;
}) {
  if (sprintLike) {
    return (
      <SprintBody
        content={content}
        feature={feature}
        scale={scale}
        onCommand={onCommand}
        onCheckboxToggle={onCheckboxToggle}
        onSessionBulkAction={onSessionBulkAction}
      />
    );
  }

  if (doc.type === "TASKS") {
    return (
      <div className="flex min-w-0 flex-col gap-3">
        <TaskActionList content={content} feature={feature} source="tasks" onCommand={onCommand} />
        <WorkSessionsActionList content={content} onSessionBulkAction={onSessionBulkAction} />
        <TaskMarkdown
          content={content}
          feature={feature}
          source="tasks"
          hideTitle
          density={density}
          scale={scale}
          onCommand={onCommand}
          onCheckboxToggle={onCheckboxToggle}
        />
      </div>
    );
  }

  return (
    <MinimalMarkdown
      content={content}
      hideTitle
      density={density}
      scale={scale}
      onCheckboxToggle={onCheckboxToggle}
    />
  );
}

function TaskActionList({
  content,
  feature,
  source,
  onCommand,
}: {
  content: string;
  feature: string;
  source: "sprint" | "tasks";
  onCommand: ((command: string, mode?: "insert" | "send") => void) | undefined;
}) {
  const taskPlan = useMemo(() => parseTaskPlan(content), [content]);
  const tasks = taskPlan.tasks.filter(isOpenTask);
  if (tasks.length === 0) return null;

  const phaseActions = taskPlan.phases
    .map((phase) => phaseActionForTarget(source, feature, phase))
    .filter((phase): phase is NonNullable<typeof phase> => Boolean(phase));
  const phaseToolbarActions: DocumentStudioAction[] = phaseActions.map((phase) => ({
    label: `Code Phase ${phase.number}`,
    ariaLabel: `Code Phase ${phase.number}: ${phase.name}`,
    command: phase.command,
    description: phase.description,
    mode: "insert",
    icon: "code",
    meta: phase.name,
    badge: phase.openCount,
  }));
  const taskToolbarActions: DocumentStudioAction[] = tasks.map((task) => {
    const command = taskCommandForTarget(source, feature, task);
    const phase = task.phaseNumber ? ` phase ${task.phaseNumber}` : "";
    return {
      label: `Code ${task.id}`,
      ariaLabel: `Code ${task.id}: ${task.title}`,
      command,
      description: `${task.title}${phase}`,
      mode: "insert",
      icon: "draft",
      meta: task.title,
    };
  });

  return (
    <div
      data-afx-action-scope="tasks"
      className="flex min-w-0 max-w-full flex-col gap-2 rounded-md border border-border/70 bg-muted/10 p-2.5"
    >
      <div className="flex min-w-0 items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-afx-brand-soft">
          <ListChecks size={12} className="shrink-0" aria-hidden />
          <span className="truncate">Open tasks</span>
        </div>
        <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
          {tasks.length} open
        </span>
      </div>
      {phaseActions.length > 0 ? (
        <CommandToolbar
          actions={phaseToolbarActions}
          onCommand={onCommand}
          scope="tasks-phase"
          label="Phase"
          density="compact"
          overflowAfter={SURGICAL_TOOLBAR_OVERFLOW_LIMIT}
        />
      ) : null}
      <CommandToolbar
        actions={taskToolbarActions}
        onCommand={onCommand}
        scope="tasks"
        label="Task"
        density="compact"
        overflowAfter={SURGICAL_TOOLBAR_OVERFLOW_LIMIT}
      />
    </div>
  );
}

function WorkSessionsActionList({
  content,
  onSessionBulkAction,
}: {
  content: string;
  onSessionBulkAction: ((action: DocumentSessionBulkAction) => void) | undefined;
}) {
  const summary = useMemo(() => summarizeWorkSessionSignoffs(content), [content]);
  if (!summary) return null;

  return (
    <div
      data-afx-action-scope="work-sessions"
      className="flex min-w-0 max-w-full flex-wrap items-center justify-between gap-2 rounded-md border border-border/70 bg-muted/10 p-2.5"
    >
      <div className="min-w-0">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-afx-brand-soft">
          Work Sessions
        </p>
        <p className="break-words text-xs leading-5 text-muted-foreground [overflow-wrap:anywhere]">
          {`Agent ${summary.agentChecked}/${summary.total} · Human ${summary.humanChecked}/${summary.total}`}
        </p>
      </div>
      <SessionSignoffToolbar
        summary={summary}
        density="compact"
        onToggleAll={(column, completed) =>
          onSessionBulkAction?.({ type: "toggleAll", column, completed })
        }
        onApprove={() => onSessionBulkAction?.({ type: "approve" })}
      />
    </div>
  );
}

function TaskMarkdown({
  content,
  feature,
  source,
  hideTitle,
  density,
  scale,
  sourceLineOffset,
  onCommand,
  onCheckboxToggle,
}: {
  content: string;
  feature: string;
  source: "sprint" | "tasks";
  hideTitle?: boolean;
  density?: "default" | "relaxed";
  scale?: ReadingSize;
  sourceLineOffset?: number;
  onCommand: ((command: string, mode?: "insert" | "send") => void) | undefined;
  onCheckboxToggle: ((target: MarkdownCheckboxToggle) => void) | undefined;
}) {
  const taskPlan = useMemo(() => parseTaskPlan(content), [content]);
  const renderAfterHeading = useMemo(
    () => createTaskHeadingActionRenderer(taskPlan, source, feature, onCommand),
    [feature, onCommand, source, taskPlan],
  );

  return (
    <MinimalMarkdown
      content={content}
      hideTitle={hideTitle}
      density={density}
      scale={scale}
      sourceLineOffset={sourceLineOffset}
      renderAfterHeading={renderAfterHeading}
      onCheckboxToggle={onCheckboxToggle}
    />
  );
}

function createTaskHeadingActionRenderer(
  taskPlan: ReturnType<typeof parseTaskPlan>,
  source: "sprint" | "tasks",
  feature: string,
  onCommand: ((command: string, mode?: "insert" | "send") => void) | undefined,
): MarkdownHeadingActionRenderer {
  const phasesBySlug = new Map(
    taskPlan.phases.map((phase) => [slugify(`Phase ${phase.number}: ${phase.name}`), phase]),
  );
  const tasksBySlug = new Map(
    taskPlan.tasks.map((task) => [slugify(`${task.id} ${task.title}`), task]),
  );

  function renderTaskHeadingAction(heading: MarkdownHeadingInfo) {
    const phase = phasesBySlug.get(heading.slug);
    if (phase && heading.level === phase.headingLevel) {
      const action = phaseInlineActionForTarget(source, feature, phase);
      if (!action) return null;
      return (
        <InlineTaskCommand
          kind="phase"
          label={`Code Phase ${action.number}`}
          detail={`${action.name} · ${action.openCount} open`}
          ariaLabel={`Code task phase ${action.number}: ${action.name}`}
          command={action.command}
          description={action.description}
          badge={action.openCount > 0 ? action.openCount : undefined}
          onCommand={onCommand}
        />
      );
    }

    const task = tasksBySlug.get(heading.slug);
    if (task && heading.level === task.headingLevel) {
      const command = taskCommandForTarget(source, feature, task);
      return (
        <InlineTaskCommand
          kind="task"
          label={`Code ${task.id}`}
          detail={task.title}
          ariaLabel={`Code task ${task.id}: ${task.title}`}
          command={command}
          description={`Draft a surgical coding run for ${task.id} ${task.title}.`}
          onCommand={onCommand}
        />
      );
    }

    return null;
  }

  return renderTaskHeadingAction;
}

function InlineTaskCommand({
  kind,
  label,
  detail,
  ariaLabel,
  command,
  description,
  badge,
  onCommand,
}: {
  kind: "phase" | "task";
  label: string;
  detail: string;
  ariaLabel: string;
  command: string;
  description: string;
  badge?: number;
  onCommand: ((command: string, mode?: "insert" | "send") => void) | undefined;
}) {
  return (
    <CommandToolbar
      actions={[
        {
          label,
          ariaLabel,
          command,
          description: `${description} ${detail}`,
          mode: "insert",
          icon: "code",
          badge,
        },
      ]}
      onCommand={onCommand}
      scope={`inline-${kind}`}
      density="compact"
      overflowAfter={1}
    />
  );
}

function taskCommandForTarget(
  source: "sprint" | "tasks",
  feature: string,
  task: TaskActionTarget,
): string {
  return source === "sprint"
    ? `/afx-sprint code ${feature} ${task.id}`
    : `/afx-task code ${feature}#${task.id}`;
}

function phaseActionForTarget(
  source: "sprint" | "tasks",
  feature: string,
  phase: TaskPhaseActionTarget,
): {
  number: string;
  name: string;
  command: string;
  description: string;
  openCount: number;
} | null {
  const openTasks = phase.tasks.filter(isOpenTask);
  const target = openTasks[0];
  if (!target) return null;
  const phaseName = phase.name.trim().replace(/\s+/g, " ");
  const base = taskCommandForTarget(source, feature, target);
  return {
    number: phase.number,
    name: phaseName,
    openCount: openTasks.length,
    command: `${base} phase ${phase.number} ${phaseName}`,
    description: `Draft a coding run for Phase ${phase.number}'s next open task: ${target.id} ${target.title}.`,
  };
}

function phaseInlineActionForTarget(
  source: "sprint" | "tasks",
  feature: string,
  phase: TaskPhaseActionTarget,
): {
  number: string;
  name: string;
  command: string;
  description: string;
  openCount: number;
} | null {
  const openTasks = phase.tasks.filter(isOpenTask);
  const target = openTasks[0] ?? phase.tasks[0];
  if (!target) return null;
  const phaseName = phase.name.trim().replace(/\s+/g, " ");
  const base = taskCommandForTarget(source, feature, target);
  const openSummary =
    openTasks.length > 0
      ? `Phase ${phase.number}'s next open task: ${target.id} ${target.title}.`
      : `Phase ${phase.number} for targeted refinement or rework.`;
  return {
    number: phase.number,
    name: phaseName,
    openCount: openTasks.length,
    command: `${base} phase ${phase.number} ${phaseName}`,
    description: `Draft a surgical coding run for ${openSummary}`,
  };
}

function isOpenTask(task: ParsedTaskTarget): boolean {
  return task.checkboxCount === 0 || task.uncheckedCount > 0;
}

function parseTaskPlan(content: string): {
  tasks: ParsedTaskTarget[];
  phases: TaskPhaseActionTarget[];
} {
  const tasks: ParsedTaskTarget[] = [];
  const phases: TaskPhaseActionTarget[] = [];
  const lines = cleanMarkdownForReading(content).split("\n");
  let phaseNumber: string | undefined;
  let phaseName: string | undefined;
  let currentPhase: TaskPhaseActionTarget | null = null;
  let current: ParsedTaskTarget | null = null;

  const finish = (): void => {
    if (!current) return;
    const task = {
      id: current.id,
      title: current.title,
      phaseNumber: current.phaseNumber,
      phaseName: current.phaseName,
      checkboxCount: current.checkboxCount,
      uncheckedCount: current.uncheckedCount,
      line: current.line,
      headingLevel: current.headingLevel,
    };
    tasks.push(task);
    if (!currentPhase) {
      currentPhase = {
        number: phaseNumber ?? "0",
        name: phaseName ?? "Tasks",
        line: current.line,
        headingLevel: Math.max(1, current.headingLevel - 1),
        tasks: [],
      };
      phases.push(currentPhase);
    }
    currentPhase.tasks.push(task);
    current = null;
  };

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index] ?? "";
    const trimmed = line.trim();
    const phase = PHASE_HEADING_RE.exec(trimmed);
    if (phase) {
      finish();
      phaseNumber = phase[1];
      phaseName = cleanInlineMarkdownText(phase[2] ?? "");
      currentPhase = {
        number: phaseNumber ?? "",
        name: phaseName,
        line: index + 1,
        headingLevel: phase[0]?.match(/^#+/)?.[0]?.length ?? 2,
        tasks: [],
      };
      phases.push(currentPhase);
      continue;
    }

    const task = TASK_GROUP_HEADING_RE.exec(trimmed);
    if (task) {
      finish();
      current = {
        id: task[2] ?? "",
        title: cleanInlineMarkdownText(task[3] ?? ""),
        phaseNumber,
        phaseName,
        checkboxCount: 0,
        uncheckedCount: 0,
        line: index + 1,
        headingLevel: task[1]?.length ?? 3,
      };
      continue;
    }

    const heading = ANY_HEADING_RE.exec(trimmed);
    if (current && heading && (heading[1]?.length ?? 6) <= current.headingLevel) {
      finish();
    }

    const checkbox = CHECKBOX_RE.exec(trimmed);
    if (current && checkbox) {
      current.checkboxCount += 1;
      if ((checkbox[1] ?? "").trim().toLowerCase() !== "x") {
        current.uncheckedCount += 1;
      }
    }
  }

  finish();
  return {
    tasks: tasks.filter((task): task is ParsedTaskTarget => Boolean(task.id && task.title)),
    phases: phases.filter((phase) => phase.number && phase.name && phase.tasks.length > 0),
  };
}

export function documentTitle(doc: DocumentRow, content: string | undefined): string {
  if (content) {
    const heading = /^#\s+(.+)$/m.exec(content)?.[1]?.trim();
    if (heading) {
      const title = cleanInlineMarkdownText(heading);
      if (!headingLooksLikeFilePath(title)) return title;
    }
  }
  return docDisplayName(doc).replace(/\.md$/i, "");
}

function headingLooksLikeFilePath(title: string): boolean {
  return /(?:^|[\s/])[\w.-]+\.md(?:#[A-Z]+)?\b/i.test(title);
}

/**
 * Type-aware AFX skill actions for a document's action bar. Each AFX file type
 * exposes the global skill subcommands relevant to it; `mode` follows the AFX
 * skill UX — content/creation commands `insert` (draft for review), read-only
 * analyses `send` (run immediately). The command vocabulary mirrors Spec Mode
 * so a tasks.md preview drafts the same commands as the chat-side doc strip.
 *
 * @see docs/specs/222-app-workbench-documents/design.md [DES-DOCS-PREVIEW-STANDALONE]
 */
export function documentActions(doc: DocumentRow): DocumentStudioAction[] {
  const target = featureFromPath(doc.filePath) ?? doc.filePath;
  switch (doc.type) {
    case "SPEC":
      return [
        {
          label: "Refine",
          command: `/afx-spec refine ${target}`,
          mode: "insert",
          description: "Tighten requirements and current truth in spec.md.",
        },
        {
          label: "Author",
          command: `/afx-design author ${target}`,
          mode: "insert",
          description: "Draft or refresh design.md from this spec.",
        },
        {
          label: "Validate",
          command: `/afx-spec validate ${target}`,
          mode: "send",
          description: "Structural compliance check.",
        },
        {
          label: "Review",
          command: `/afx-spec review ${target}`,
          mode: "send",
          description: "Surface missing requirements and decisions.",
        },
        {
          label: "Approve",
          command: `/afx-spec approve ${target}`,
          mode: "send",
          description: "Approve spec.md when requirements are ready.",
        },
      ];
    case "DESIGN":
      return [
        {
          label: "Refine",
          command: `/afx-design refine ${target}`,
          mode: "insert",
          description: "Improve design.md from the approved spec.",
        },
        {
          label: "Author",
          command: `/afx-task plan ${target}`,
          mode: "insert",
          description: "Draft tasks.md from this design.",
        },
        {
          label: "Validate",
          command: `/afx-design validate ${target}`,
          mode: "send",
          description: "Structural + node-id compliance check.",
        },
        {
          label: "Review",
          command: `/afx-design review ${target}`,
          mode: "send",
          description: "Check architecture quality and gaps.",
        },
        {
          label: "Approve",
          command: `/afx-design approve ${target}`,
          mode: "send",
          description: "Approve design.md when the implementation plan is clear.",
        },
      ];
    case "TASKS":
      return [
        {
          label: "Code",
          command: `/afx-task code all ${target}`,
          mode: "insert",
          description: "Draft a coding run for all remaining tasks.",
        },
        {
          label: "Verify",
          command: `/afx-task verify all ${target}`,
          mode: "send",
          description: "Verify every task against the spec.",
        },
        {
          label: "Pick",
          command: "/afx-task pick",
          mode: "send",
          description: "Pick the next task from the active tasks document.",
        },
        {
          label: "Review",
          command: `/afx-task review ${target}`,
          mode: "send",
          description: "Review task readiness and traceability.",
        },
        {
          label: "Status",
          command: `/afx-task status ${target}`,
          mode: "send",
          description: "Phase progress and the next actionable task.",
        },
      ];
    case "JOURNAL":
      return [
        {
          label: "Note",
          command: `/afx-session note ${target}`,
          mode: "insert",
          description: "Draft a quick journal note.",
        },
        {
          label: "Log",
          command: `/afx-session log ${target}`,
          mode: "insert",
          description: "Save this session to the discussion record.",
        },
        {
          label: "Recap",
          command: `/afx-session recap ${target}`,
          mode: "send",
          description: "Synthesize context to resume work.",
        },
        {
          label: "Promote",
          command: `/afx-session promote ${target}`,
          mode: "insert",
          description: "Draft a promotion target for durable decisions.",
        },
        {
          label: "Capture",
          command: `/afx-session capture ${target}`,
          mode: "insert",
          description: "Capture a pivotal prompt and outcome.",
        },
      ];
    case "ADR":
      return [
        {
          label: "Review",
          command: `/afx-adr review ${target}`,
          mode: "insert",
          description: "Validate ADR structure and content.",
        },
        {
          label: "Supersede",
          command: `/afx-adr supersede ${target}`,
          mode: "insert",
          description: "Draft a supersession update for this ADR.",
        },
        {
          label: "List",
          command: `/afx-adr list ${target}`,
          mode: "send",
          description: "List ADRs in context.",
        },
      ];
    case "RES":
    case "RESEARCH":
      return [
        {
          label: "Explore",
          command: `/afx-research explore ${target}`,
          mode: "insert",
          description: "Draft a research exploration prompt.",
        },
        {
          label: "Compare",
          command: `/afx-research compare ${target}`,
          mode: "insert",
          description: "Compare alternatives or sources for this research.",
        },
        {
          label: "Summarize",
          command: `/afx-research summarize ${target}`,
          mode: "insert",
          description: "Summarize findings into a compact brief.",
        },
        {
          label: "Finalize",
          command: `/afx-research finalize ${target}`,
          mode: "insert",
          description: "Draft final recommendations and next steps.",
        },
      ];
    case "SPRINT":
    case "FLUID":
      return [
        {
          label: "Verify",
          command: `/afx-sprint verify ${target}`,
          mode: "send",
          description: "Check the sprint is ready to implement.",
        },
        {
          label: "Graduate",
          command: `/afx-sprint graduate ${target}`,
          mode: "insert",
          description: "Split this sprint into spec.md / design.md / tasks.md.",
        },
      ];
    default:
      return [];
  }
}

/**
 * AFX skill actions scoped to a single sprint section (Spec/Design/Tasks). The
 * sprint skill exposes canonical section verbs (`spec`, `design`, `task`) plus
 * approval gates; these render inline at the head of each section in a preview.
 *
 * @see docs/specs/222-app-workbench-documents/design.md [DES-DOCS-PREVIEW-STANDALONE]
 */
export function sprintSectionActions(
  feature: string,
  section: SprintSectionKind,
): DocumentStudioAction[] {
  switch (section) {
    case "SPEC":
      return [
        {
          label: "Refine spec",
          command: `/afx-sprint spec ${feature}`,
          mode: "insert",
          description: "Tighten the sprint's spec section.",
        },
        {
          label: "Author design",
          command: `/afx-sprint design ${feature}`,
          mode: "insert",
          description: "Draft the sprint design section from this spec.",
        },
        {
          label: "Verify spec",
          command: `/afx-sprint verify ${feature}`,
          mode: "send",
          description: "Check sprint readiness and section gates.",
        },
        {
          label: "Approve spec",
          command: `/afx-sprint spec ${feature} --approve`,
          mode: "send",
          description: "Approve the sprint spec gate.",
        },
      ];
    case "DESIGN":
      return [
        {
          label: "Refine design",
          command: `/afx-sprint design ${feature}`,
          mode: "insert",
          description: "Shape the sprint's design section.",
        },
        {
          label: "Author tasks",
          command: `/afx-sprint task ${feature}`,
          mode: "insert",
          description: "Draft the sprint tasks section from this design.",
        },
        {
          label: "Verify design",
          command: `/afx-sprint verify ${feature}`,
          mode: "send",
          description: "Check sprint readiness and section gates.",
        },
        {
          label: "Approve design",
          command: `/afx-sprint design ${feature} --approve`,
          mode: "send",
          description: "Approve the sprint design gate.",
        },
      ];
    case "TASKS":
      return [
        {
          label: "Refine tasks",
          command: `/afx-sprint task ${feature}`,
          mode: "insert",
          description: "Refresh the sprint's task plan.",
        },
        {
          label: "Code tasks",
          command: `/afx-sprint code ${feature}`,
          mode: "insert",
          description: "Implement the next sprint task (gated on approvals).",
        },
        {
          label: "Verify tasks",
          command: `/afx-sprint verify ${feature}`,
          mode: "send",
          description: "Check sprint readiness before coding.",
        },
        {
          label: "Approve tasks",
          command: `/afx-sprint task ${feature} --approve`,
          mode: "send",
          description: "Approve the sprint tasks gate.",
        },
        {
          label: "Graduate",
          command: `/afx-sprint graduate ${feature}`,
          mode: "insert",
          description: "Split this sprint into spec.md / design.md / tasks.md.",
        },
      ];
    case "SESSIONS":
      return [];
    default:
      return [];
  }
}

/**
 * Sprint body — splits a single-file sprint into its Spec/Design/Tasks/Work
 * Sessions sections and renders each with its own inline AFX action group, so
 * the surgical commands live in the section they act on.
 *
 * @see docs/specs/222-app-workbench-documents/design.md [DES-DOCS-PREVIEW-STANDALONE]
 */
function SprintBody({
  content,
  feature,
  scale,
  onCommand,
  onCheckboxToggle,
  onSessionBulkAction,
}: {
  content: string;
  feature: string;
  scale: ReadingSize;
  onCommand: ((command: string, mode?: "insert" | "send") => void) | undefined;
  onCheckboxToggle: ((target: MarkdownCheckboxToggle) => void) | undefined;
  onSessionBulkAction: ((action: DocumentSessionBulkAction) => void) | undefined;
}) {
  const segments = useMemo(() => splitSprintSections(content), [content]);
  return (
    <div className="flex flex-col gap-6">
      {segments.map((segment, i) => {
        const actions = segment.kind ? sprintSectionActions(feature, segment.kind) : [];
        return (
          <section
            data-afx-doc-section={segment.kind?.toLowerCase() ?? "preamble"}
            key={`${segment.kind ?? "preamble"}-${i}`}
            className="flex min-w-0 flex-col gap-3"
          >
            {actions.length > 0 ? (
              <CommandToolbar
                actions={actions}
                onCommand={onCommand}
                scope="section"
                label={sprintSectionLabel(segment.kind)}
                overflowAfter={TOOLBAR_OVERFLOW_LIMIT}
              />
            ) : null}
            {segment.kind === "TASKS" ? (
              <TaskActionList
                content={segment.body}
                feature={feature}
                source="sprint"
                onCommand={onCommand}
              />
            ) : null}
            {segment.kind === "SESSIONS" ? (
              <WorkSessionsActionList
                content={segment.body}
                onSessionBulkAction={onSessionBulkAction}
              />
            ) : null}
            {segment.kind === "TASKS" ? (
              <TaskMarkdown
                content={segment.body}
                feature={feature}
                source="sprint"
                hideTitle={i === 0}
                density="relaxed"
                scale={scale}
                sourceLineOffset={(segment.startLine ?? 1) - 1}
                onCommand={onCommand}
                onCheckboxToggle={onCheckboxToggle}
              />
            ) : (
              <MinimalMarkdown
                content={segment.body}
                hideTitle={i === 0}
                density="relaxed"
                scale={scale}
                sourceLineOffset={(segment.startLine ?? 1) - 1}
                onCheckboxToggle={onCheckboxToggle}
              />
            )}
          </section>
        );
      })}
    </div>
  );
}

function sprintSectionLabel(section: SprintSectionKind | null): string {
  switch (section) {
    case "SPEC":
      return "Spec";
    case "DESIGN":
      return "Design";
    case "TASKS":
      return "Tasks";
    case "SESSIONS":
      return "Work";
    case null:
      return "Section";
  }
}

export function featureFromPath(filePath: string): string | null {
  const m = filePath.match(/^docs\/specs\/([^/]+)\//);
  return m?.[1] ?? null;
}

export function docDisplayName(doc: DocumentRow): string {
  const parts = doc.name.split("/");
  if (parts.length <= 1) return doc.name;
  if (parts[0] === "docs" && parts[1] === "specs" && parts.length >= 4) {
    return `${parts[2]} / ${parts[parts.length - 1]}`;
  }
  return `${parts[parts.length - 2]} / ${parts[parts.length - 1]}`;
}

export function formatShortDate(iso: string | undefined): string | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export function stringMeta(frontmatter: Record<string, unknown>, key: string): string | undefined {
  const value = frontmatter[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function summarizeDocumentQuality(
  doc: DocumentRow,
  content: string | undefined,
  frontmatter: Record<string, unknown>,
  outline: Array<{ text: string }>,
): { issues: string[]; scoreLabel: string; summary: string | null } {
  const issues: string[] = [];
  if (!stringMeta(frontmatter, "owner")) issues.push("Owner missing");
  if (!doc.status && !stringMeta(frontmatter, "status")) issues.push("Status missing");
  if (outline.length < 3) issues.push("Needs more sections");
  const lowered = content?.toLowerCase() ?? "";
  if ((doc.type === "SPEC" || doc.type === "DESIGN") && !lowered.includes("success")) {
    issues.push("Success metrics missing");
  }
  const summary = extractFirstParagraph(content);
  return {
    issues,
    scoreLabel: issues.length === 0 ? "Strong" : issues.length <= 2 ? "Needs pass" : "Drafty",
    summary,
  };
}

function extractFirstParagraph(content: string | undefined): string | null {
  if (!content) return null;
  const body = cleanMarkdownForReading(content)
    .split("\n")
    .map((line) => line.trim())
    .filter(
      (line) =>
        line &&
        !line.startsWith("#") &&
        !line.startsWith("- ") &&
        !line.startsWith("|") &&
        !line.startsWith(">"),
    );
  return body[0] ? plainReaderLine(body[0]) : null;
}

function plainReaderLine(line: string): string {
  return line
    .replace(/\*\*/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
}
