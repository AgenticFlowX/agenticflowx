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
  { type: "toggleAll"; column: "agent" | "human"; completed: boolean } | { type: "approve" };

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

interface OpenQuestionTarget {
  id: string;
  question: string;
  owner: string | null;
  status: string | null;
  line: number;
}

interface OpenQuestionSignalSummary {
  open: number;
  blocked: number;
  statusMismatch: number;
  resolvedWithoutResolution: number;
  resolvedWithoutJournal: number;
}

interface TaskCheckboxSummary {
  total: number;
  open: number;
}

const TOOLBAR_OVERFLOW_LIMIT = 5;
const SURGICAL_TOOLBAR_OVERFLOW_LIMIT = 3;
const PHASE_HEADING_RE = /^#{2,3}\s+Phase\s+(\d+)\s*:\s*(.+?)\s*$/i;
const TASK_GROUP_HEADING_RE = /^(#{3,5})\s+(\d+\.\d+(?:\.\d+)*)\s+(.+?)\s*$/;
const ANY_HEADING_RE = /^(#{1,6})\s+/;
const CHECKBOX_RE = /^\s*[-*]\s+\[([ xX]?)\]\s+/;
const TABLE_SEPARATOR_RE = /^\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?$/;

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
  const openQuestions = (
    <OpenQuestionsActionList content={content} feature={feature} onCommand={onCommand} />
  );
  const sectionActions = useMemo(
    () => createSectionHeadingActionRenderer(doc, feature, onCommand),
    [doc, feature, onCommand],
  );

  if (sprintLike) {
    return (
      <div className="flex min-w-0 flex-col gap-3">
        {openQuestions}
        <SprintBody
          content={content}
          feature={feature}
          scale={scale}
          onCommand={onCommand}
          onCheckboxToggle={onCheckboxToggle}
          onSessionBulkAction={onSessionBulkAction}
        />
      </div>
    );
  }

  if (doc.type === "TASKS") {
    return (
      <div className="flex min-w-0 flex-col gap-3">
        {openQuestions}
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
    <div className="flex min-w-0 flex-col gap-3">
      {openQuestions}
      <MinimalMarkdown
        content={content}
        hideTitle
        density={density}
        scale={scale}
        renderAfterHeading={sectionActions}
        onCheckboxToggle={onCheckboxToggle}
      />
    </div>
  );
}

function OpenQuestionsActionList({
  content,
  feature,
  onCommand,
}: {
  content: string;
  feature: string;
  onCommand: ((command: string, mode?: "insert" | "send") => void) | undefined;
}) {
  const questions = useMemo(() => parseOpenQuestions(content), [content]);
  if (questions.length === 0) return null;

  const first = questions[0];
  const quoted = quoteCommandText(first.question);
  const actions: DocumentStudioAction[] = [
    {
      label: "Draft answer",
      ariaLabel: `Draft answer for open question: ${first.question}`,
      command: `/afx-spec refine ${feature} answer open question ${quoted}`,
      description: first.question,
      mode: "insert",
      icon: "draft",
      meta: first.owner ? `Owner ${first.owner}` : undefined,
    },
    {
      label: "Resolve",
      ariaLabel: `Resolve open question: ${first.question}`,
      command: `/afx-spec refine ${feature} resolve open question ${quoted}`,
      description: first.question,
      mode: "insert",
      icon: "spark",
    },
    {
      label: "Journal",
      ariaLabel: "Capture open-question decision in journal",
      command: `/afx-session capture --links ${feature} open-questions`,
      description: "Capture the answer or decision context.",
      mode: "insert",
      icon: "draft",
    },
    {
      label: "Ignore",
      ariaLabel: `Draft rationale to ignore open question: ${first.question}`,
      command: `/afx-session capture --links ${feature} ignored open question ${quoted}`,
      description: "Capture why this question is intentionally not blocking.",
      mode: "insert",
      icon: "run",
    },
  ];

  return (
    <div
      data-afx-action-scope="open-questions"
      className="flex min-w-0 flex-col gap-2 rounded-md border border-amber-500/25 bg-amber-500/5 p-2.5"
    >
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-amber-300">
            Open questions need answers
          </p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground" title={first.question}>
            {first.question}
          </p>
        </div>
        <span className="shrink-0 rounded-sm border border-border/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
          {questions.length}
        </span>
      </div>
      <CommandToolbar
        actions={actions}
        onCommand={onCommand}
        scope="open-questions"
        label="Question"
        density="compact"
        overflowAfter={4}
        actionAria="label"
      />
    </div>
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

function createSectionHeadingActionRenderer(
  doc: DocumentRow,
  feature: string,
  onCommand: ((command: string, mode?: "insert" | "send") => void) | undefined,
): MarkdownHeadingActionRenderer {
  function renderSectionHeadingAction(heading: MarkdownHeadingInfo) {
    if (!onCommand || heading.level === 1) return null;
    const actions = sectionActionsForHeading(doc, feature, heading);
    if (actions.length === 0) return null;
    return (
      <CommandToolbar
        actions={actions}
        onCommand={onCommand}
        scope="inline-section"
        density="compact"
        overflowAfter={3}
        actionAria="label"
      />
    );
  }

  return renderSectionHeadingAction;
}

function sectionActionsForHeading(
  doc: DocumentRow,
  feature: string,
  heading: MarkdownHeadingInfo,
): DocumentStudioAction[] {
  const target = featureFromPath(doc.filePath) ?? feature;
  const text = heading.text.toLowerCase();
  const sourceAnchor = `${target}#${heading.slug}`;

  if (/\b(open\s+questions?|questions?)\b/.test(text)) {
    return [
      {
        label: "Answer",
        ariaLabel: `Answer questions in ${heading.text}`,
        command: refinementCommandForDoc(doc, target, `${heading.text} answers`),
        description: "Draft answers or clarify what information is still missing.",
        mode: "insert",
        icon: "draft",
      },
      {
        label: "Resolve",
        ariaLabel: `Resolve or defer questions in ${heading.text}`,
        command: refinementCommandForDoc(doc, target, `${heading.text} resolution`),
        description: "Draft a focused pass for the unresolved questions in this section.",
        mode: "insert",
        icon: "spark",
      },
      {
        label: "Journal",
        ariaLabel: `Capture decisions for ${heading.text}`,
        command: `/afx-session capture --links ${sourceAnchor} open-questions`,
        description: "Capture the answer context before approval moves on.",
        mode: "insert",
        icon: "draft",
      },
    ];
  }

  if (/\b(requirements?|functional requirements?|non-functional requirements?)\b/.test(text)) {
    return [
      {
        label: "Refine",
        ariaLabel: `Refine ${heading.text}`,
        command: refinementCommandForDoc(doc, target, heading.text),
        description: "Improve scope, ambiguity, and acceptance language for this section.",
        mode: "insert",
        icon: "spark",
      },
      {
        label: "Review",
        ariaLabel: `Review ${heading.text}`,
        command: reviewCommandForDoc(doc, target, heading.text),
        description: "Run a gap pass against this section.",
        mode: "send",
        icon: "run",
      },
    ];
  }

  if (/\b(acceptance|success|test plan|verification|proof)\b/.test(text)) {
    return [
      {
        label: "Add proof",
        ariaLabel: `Add proof for ${heading.text}`,
        command: refinementCommandForDoc(doc, target, `${heading.text} proof`),
        description: "Draft measurable proof, tests, or acceptance evidence.",
        mode: "insert",
        icon: "draft",
      },
    ];
  }

  if (/\b(decisions?|decision log|tradeoffs?|risks?|blockers?)\b/.test(text)) {
    return [
      {
        label: "Journal",
        ariaLabel: `Capture ${heading.text} in journal`,
        command: `/afx-session capture --links ${sourceAnchor} ${heading.text}`,
        description: "Preserve why this decision or risk matters.",
        mode: "insert",
        icon: "draft",
      },
      {
        label: "Refine",
        ariaLabel: `Refine ${heading.text}`,
        command: refinementCommandForDoc(doc, target, heading.text),
        description: "Clarify options, impact, and the chosen path.",
        mode: "insert",
        icon: "spark",
      },
    ];
  }

  if (/\b(work\s+sessions?|sessions?|journal)\b/.test(text)) {
    return [
      {
        label: "Capture",
        ariaLabel: `Capture context for ${heading.text}`,
        command: `/afx-session capture --links ${sourceAnchor}`,
        description: "Turn the current section into durable session context.",
        mode: "insert",
        icon: "draft",
      },
    ];
  }

  return [];
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
  const normalized = filePath.replace(/\\/g, "/");
  const match = normalized.match(/(?:^|\/)docs\/specs\/(.+)$/);
  if (!match) return null;

  const parts = match[1].split("/").filter(Boolean);
  if (parts.length < 2) return null;

  return parts.slice(0, -1).join("/");
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

export interface DocumentQualitySuggestion {
  id: string;
  category: "blocker" | "refinement" | "evidence";
  target: string;
  why: string;
  evidence: string;
  suggestedFix: string;
  actionLabel: string;
  command: string;
  mode: "insert" | "send";
}

export interface DocumentJournalNudge {
  id: string;
  label: string;
  reason: string;
  command: string;
  mode: "insert" | "send";
}

export interface DocumentScorecardItem {
  label: "Strategy" | "Structure" | "Clarity" | "Completeness";
  status: "good" | "watch" | "gap";
  reason: string;
}

export interface DocumentQualitySummary {
  issues: string[];
  scoreLabel: string;
  summary: string | null;
  scorecard: DocumentScorecardItem[];
  suggestions: DocumentQualitySuggestion[];
  journalNudges: DocumentJournalNudge[];
}

export function summarizeDocumentQuality(
  doc: DocumentRow,
  content: string | undefined,
  frontmatter: Record<string, unknown>,
  outline: Array<{ text: string }>,
): DocumentQualitySummary {
  const issues: string[] = [];
  const suggestions: DocumentQualitySuggestion[] = [];
  const journalNudges: DocumentJournalNudge[] = [];
  const target = featureFromPath(doc.filePath) ?? doc.filePath;
  const addIssue = (
    issue: string,
    suggestion?: Omit<DocumentQualitySuggestion, "id" | "command" | "mode" | "suggestedFix"> & {
      command?: string;
      mode?: "insert" | "send";
      suggestedFix?: string;
    },
  ) => {
    issues.push(issue);
    if (suggestion) {
      suggestions.push({
        id: slugify(`${issue}-${suggestion.target}`),
        command: suggestion.command ?? refinementCommandForDoc(doc, target, suggestion.target),
        mode: suggestion.mode ?? "insert",
        suggestedFix: suggestion.suggestedFix ?? suggestion.actionLabel,
        ...suggestion,
      });
    }
  };

  const lowered = content?.toLowerCase() ?? "";
  const rawContent = content ?? "";
  const hasOwner = Boolean(stringMeta(frontmatter, "owner"));
  const hasStatus = Boolean(doc.status || stringMeta(frontmatter, "status"));
  const hasSuccessLanguage = lowered.includes("success");
  const hasRequirementLanguage = /\b(?:fr-\d+|nfr-\d+|requirement|acceptance criteria)\b/i.test(
    rawContent,
  );
  const hasAcceptanceLanguage =
    /\b(?:acceptance criteria|verification|test plan|done definition|proof|e2e)\b/i.test(
      rawContent,
    );
  const hasTraceLanguage = /\b(?:fr-\d+|nfr-\d+|des-[a-z0-9-]+|ref:|implements:|@see)\b/i.test(
    rawContent,
  );
  const openQuestionSignals = summarizeOpenQuestionSignals(content);
  const unresolvedQuestions = openQuestionSignals.open + openQuestionSignals.blocked;
  const taskSummary = summarizeTaskCheckboxes(content);
  const signoffSummary = content ? summarizeWorkSessionSignoffs(content) : null;

  if (!hasOwner) {
    addIssue("Owner missing", {
      category: "blocker",
      target: "Frontmatter",
      why: "Ownership makes approval and follow-up unambiguous.",
      evidence: "No owner field was found in frontmatter.",
      actionLabel: "Add owner",
    });
  }
  if (!hasStatus) {
    addIssue("Status missing", {
      category: "blocker",
      target: "Frontmatter",
      why: "Lifecycle state should be visible before approval or implementation.",
      evidence: "No status field was found in frontmatter.",
      actionLabel: "Set status",
    });
  }
  if (outline.length < 3) {
    addIssue("Needs more sections", {
      category: "refinement",
      target: "Document structure",
      why: "A short outline makes it harder to spot requirements, decisions, and proof gaps.",
      evidence: `${outline.length} heading${outline.length === 1 ? "" : "s"} detected.`,
      actionLabel: "Refine structure",
    });
  }
  if ((doc.type === "SPEC" || doc.type === "DESIGN") && !hasSuccessLanguage) {
    addIssue("Success metrics missing", {
      category: "refinement",
      target: "Success metrics",
      why: "A spec is easier to approve when success is measurable.",
      evidence: "No success language was detected in the document body.",
      suggestedFix: "Add measurable outcomes, target behaviors, or verification signals.",
      actionLabel: "Add metrics",
    });
  }
  if (unresolvedQuestions > 0) {
    addIssue(`${unresolvedQuestions} open question${unresolvedQuestions === 1 ? "" : "s"}`, {
      category: "blocker",
      target: "Open Questions",
      why: "Unresolved questions often block approval or implementation planning.",
      evidence: `${unresolvedQuestions} unresolved row${unresolvedQuestions === 1 ? "" : "s"} found.`,
      suggestedFix: "Resolve, intentionally defer, or capture the decision context.",
      actionLabel: "Resolve questions",
      command: refinementCommandForDoc(doc, target, "open questions"),
    });
    journalNudges.push({
      id: "capture-open-questions",
      label: "Capture questions",
      reason: "Preserve the decision context when questions are resolved.",
      command: `/afx-session capture --links ${target} open-questions`,
      mode: "insert",
    });
  }
  if (openQuestionSignals.statusMismatch > 0) {
    addIssue("Question status mismatch", {
      category: "refinement",
      target: "Open Questions",
      why: "A question with an answer but an open status leaves approval unclear.",
      evidence: `${openQuestionSignals.statusMismatch} row${openQuestionSignals.statusMismatch === 1 ? "" : "s"} have open status with resolution text.`,
      suggestedFix: "Mark answered rows resolved or capture why they remain open.",
      actionLabel: "Fix status",
      command: refinementCommandForDoc(doc, target, "open question status"),
    });
  }
  if (openQuestionSignals.resolvedWithoutResolution > 0) {
    addIssue("Resolved question needs answer", {
      category: "refinement",
      target: "Open Questions",
      why: "Resolved questions need enough answer text for future readers.",
      evidence: `${openQuestionSignals.resolvedWithoutResolution} resolved row${openQuestionSignals.resolvedWithoutResolution === 1 ? "" : "s"} have no resolution.`,
      suggestedFix: "Add the final answer or reopen the question.",
      actionLabel: "Add answer",
      command: refinementCommandForDoc(doc, target, "resolved question answers"),
    });
  }

  if (
    (doc.type === "SPEC" || doc.type === "TASKS" || doc.type === "SPRINT") &&
    !hasAcceptanceLanguage
  ) {
    addIssue("Acceptance proof missing", {
      category: "evidence",
      target: "Acceptance Criteria",
      why: "Implementation can move faster when completion proof is visible in the document.",
      evidence:
        "No acceptance criteria, verification, test plan, done definition, or proof section was detected.",
      suggestedFix: "Add concrete acceptance or verification bullets.",
      actionLabel: "Add proof",
      command: refinementCommandForDoc(doc, target, "acceptance proof"),
    });
  }

  if ((doc.type === "DESIGN" || doc.type === "TASKS") && !hasTraceLanguage) {
    addIssue("Trace links missing", {
      category: "evidence",
      target: "Traceability",
      why: "Design and task docs should point back to the requirements they implement.",
      evidence: "No FR/NFR/DES/ref markers were detected.",
      suggestedFix: "Add requirement or design references near the relevant sections.",
      actionLabel: "Add trace",
      command: reviewCommandForDoc(doc, target, "traceability"),
      mode: "send",
    });
  }

  if (
    (doc.type === "TASKS" || doc.type === "SPRINT" || doc.type === "FLUID") &&
    taskSummary.open > 0
  ) {
    addIssue(`${taskSummary.open} open task${taskSummary.open === 1 ? "" : "s"}`, {
      category: "refinement",
      target: "Tasks",
      why: "Open implementation work should have a clear next command.",
      evidence: `${taskSummary.open}/${taskSummary.total} checklist item${taskSummary.total === 1 ? "" : "s"} remain open.`,
      suggestedFix: "Pick the next task or verify the task list before coding.",
      actionLabel: doc.type === "TASKS" ? "Pick task" : "Verify tasks",
      command:
        doc.type === "TASKS" ? `/afx-task pick ${target}` : `/afx-sprint verify ${target} tasks`,
      mode: doc.type === "TASKS" ? "send" : "send",
    });
  }

  if (
    signoffSummary &&
    (signoffSummary.agentChecked < signoffSummary.total ||
      signoffSummary.humanChecked < signoffSummary.total)
  ) {
    addIssue("Work session signoff pending", {
      category: "evidence",
      target: "Work Sessions",
      why: "Unsigned work sessions leave the final approval trail ambiguous.",
      evidence: `Agent ${signoffSummary.agentChecked}/${signoffSummary.total} · Human ${signoffSummary.humanChecked}/${signoffSummary.total}.`,
      suggestedFix: "Use the signoff controls or capture why signoff is pending.",
      actionLabel: "Capture signoff",
      command: `/afx-session capture --links ${target} work-sessions`,
    });
  }

  if (hasDecisionLanguage(content)) {
    journalNudges.push({
      id: "capture-decisions",
      label: "Capture decisions",
      reason: "Decision language was detected in this document.",
      command: `/afx-session capture --links ${target} decisions`,
      mode: "insert",
    });
  }
  if (openQuestionSignals.resolvedWithoutJournal > 0) {
    journalNudges.push({
      id: "capture-resolved-questions",
      label: "Capture resolved questions",
      reason: "Resolved questions were found without an obvious journal reference.",
      command: `/afx-session capture --links ${target} resolved-questions`,
      mode: "insert",
    });
  }
  if (isApprovedStatus(doc, frontmatter) && !hasJournalReference(rawContent)) {
    journalNudges.push({
      id: "capture-approval",
      label: "Capture approval",
      reason: "Approved state should have durable context.",
      command: `/afx-session capture --links ${target} approval`,
      mode: "insert",
    });
  }
  const summary = extractFirstParagraph(content);
  return {
    issues,
    scoreLabel: issues.length === 0 ? "Strong" : issues.length <= 2 ? "Needs pass" : "Drafty",
    summary,
    scorecard: [
      {
        label: "Strategy",
        status: hasSuccessLanguage ? "good" : "watch",
        reason: hasSuccessLanguage ? "Success signal found" : "Add success measure",
      },
      {
        label: "Structure",
        status: outline.length >= 3 ? "good" : "watch",
        reason: outline.length >= 3 ? `${outline.length} sections` : "Outline is thin",
      },
      {
        label: "Clarity",
        status:
          unresolvedQuestions === 0 && openQuestionSignals.statusMismatch === 0 ? "good" : "gap",
        reason:
          unresolvedQuestions === 0 && openQuestionSignals.statusMismatch === 0
            ? "No unresolved questions"
            : `${unresolvedQuestions + openQuestionSignals.statusMismatch} question signal${unresolvedQuestions + openQuestionSignals.statusMismatch === 1 ? "" : "s"}`,
      },
      {
        label: "Completeness",
        status: hasOwner && hasStatus && hasRequirementLanguage ? "good" : "watch",
        reason:
          hasOwner && hasStatus && hasRequirementLanguage
            ? "Core fields present"
            : "Check owner, status, requirements",
      },
    ],
    suggestions: suggestions.slice(0, 4),
    journalNudges: dedupeJournalNudges(journalNudges).slice(0, 3),
  };
}

function refinementCommandForDoc(doc: DocumentRow, target: string, focus: string): string {
  const suffix = focus ? ` ${focus}` : "";
  switch (doc.type) {
    case "DESIGN":
      return `/afx-design refine ${target}${suffix}`;
    case "TASKS":
      return `/afx-task review ${target}${suffix}`;
    case "SPRINT":
    case "FLUID":
      return `/afx-sprint verify ${target}${suffix}`;
    default:
      return `/afx-spec refine ${target}${suffix}`;
  }
}

function reviewCommandForDoc(doc: DocumentRow, target: string, focus: string): string {
  const suffix = focus ? ` ${focus}` : "";
  switch (doc.type) {
    case "DESIGN":
      return `/afx-design review ${target}${suffix}`;
    case "TASKS":
      return `/afx-task review ${target}${suffix}`;
    case "SPRINT":
    case "FLUID":
      return `/afx-sprint verify ${target}${suffix}`;
    default:
      return `/afx-spec review ${target}${suffix}`;
  }
}

function summarizeTaskCheckboxes(content: string | undefined): TaskCheckboxSummary {
  if (!content) return { total: 0, open: 0 };
  let total = 0;
  let open = 0;
  for (const line of content.split(/\r?\n/)) {
    const checkbox = CHECKBOX_RE.exec(line.trim());
    if (!checkbox) continue;
    total += 1;
    if ((checkbox[1] ?? "").trim().toLowerCase() !== "x") open += 1;
  }
  return { total, open };
}

function summarizeOpenQuestionSignals(content: string | undefined): OpenQuestionSignalSummary {
  const summary: OpenQuestionSignalSummary = {
    open: 0,
    blocked: 0,
    statusMismatch: 0,
    resolvedWithoutResolution: 0,
    resolvedWithoutJournal: 0,
  };
  if (!content) return summary;
  const hasJournal = hasJournalReference(content);
  const lines = content.split(/\r?\n/);
  let inOpenQuestions = false;
  let tableHeaders: string[] | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^#{1,6}\s+/.test(trimmed)) {
      inOpenQuestions = /open\s+questions?/i.test(trimmed);
      tableHeaders = null;
      continue;
    }
    if (!inOpenQuestions) continue;
    if (!trimmed) continue;
    if (/^\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?$/.test(trimmed)) continue;
    if (/^\|/.test(trimmed)) {
      const cells = splitMarkdownTableRow(trimmed);
      if (isOpenQuestionHeader(cells)) {
        tableHeaders = cells.map((cell) => cell.toLowerCase());
        continue;
      }
      const statusIndex = findHeaderIndex(tableHeaders, ["status", "state"]);
      const resolutionIndex = findHeaderIndex(tableHeaders, ["resolution", "answer", "decision"]);
      const status = cleanQuestionText(
        statusIndex >= 0
          ? (cells[statusIndex] ?? "")
          : (cells.find((cell) =>
              /\b(open|unresolved|blocked|pending|resolved|closed|answered|done)\b/i.test(cell),
            ) ?? ""),
      );
      const resolution = cleanQuestionText(
        resolutionIndex >= 0 ? (cells[resolutionIndex] ?? "") : "",
      );
      const normalized = normalizeQuestionStatus(status);
      if (normalized === "blocked") {
        summary.blocked += 1;
      } else if (normalized === "resolved") {
        if (!resolution) summary.resolvedWithoutResolution += 1;
        if (resolution && !hasJournal) summary.resolvedWithoutJournal += 1;
      } else if (normalized === "open" || trimmed.includes("?")) {
        if (resolution) summary.statusMismatch += 1;
        else summary.open += 1;
      }
      continue;
    }
    if (/^[-*]\s+\[\s\]/.test(trimmed)) summary.open += 1;
  }

  return summary;
}

function parseOpenQuestions(content: string): OpenQuestionTarget[] {
  const lines = content.split(/\r?\n/);
  const questions: OpenQuestionTarget[] = [];
  let inOpenQuestions = false;
  let tableHeaders: string[] | null = null;

  for (const [index, line] of lines.entries()) {
    const trimmed = line.trim();
    if (/^#{1,6}\s+/.test(trimmed)) {
      inOpenQuestions = /open\s+questions?/i.test(trimmed);
      tableHeaders = null;
      continue;
    }
    if (!inOpenQuestions || !trimmed) continue;

    if (trimmed.startsWith("|")) {
      if (TABLE_SEPARATOR_RE.test(trimmed)) continue;
      const cells = splitMarkdownTableRow(trimmed);
      if (cells.length === 0) continue;
      if (isOpenQuestionHeader(cells)) {
        tableHeaders = cells.map((cell) => cell.toLowerCase());
        continue;
      }

      const questionIndex =
        findHeaderIndex(tableHeaders, ["question", "open question", "prompt"]) ?? 0;
      const statusIndex = findHeaderIndex(tableHeaders, ["status", "state"]);
      const ownerIndex = findHeaderIndex(tableHeaders, ["owner"]);
      const question = cleanQuestionText(cells[questionIndex] ?? cells[0] ?? "");
      const status = statusIndex >= 0 ? cleanQuestionText(cells[statusIndex] ?? "") : null;
      if (!question || isResolvedQuestionStatus(status)) continue;
      questions.push({
        id: `oq-${index + 1}`,
        question,
        owner: ownerIndex >= 0 ? cleanQuestionText(cells[ownerIndex] ?? "") || null : null,
        status,
        line: index + 1,
      });
      continue;
    }

    const checklist = trimmed.match(/^[-*]\s+\[\s\]\s+(.+)$/);
    if (checklist?.[1]) {
      questions.push({
        id: `oq-${index + 1}`,
        question: cleanQuestionText(checklist[1]),
        owner: null,
        status: "Open",
        line: index + 1,
      });
    }
  }

  return questions;
}

function splitMarkdownTableRow(row: string): string[] {
  return row
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((cell) => cleanQuestionText(cell));
}

function isOpenQuestionHeader(cells: string[]): boolean {
  const normalized = cells.map((cell) => cleanQuestionText(cell).toLowerCase());
  return (
    normalized.some((cell) => ["question", "open question", "prompt"].includes(cell)) &&
    normalized.some((cell) =>
      ["status", "state", "resolution", "answer", "decision"].includes(cell),
    )
  );
}

function findHeaderIndex(headers: string[] | null | undefined, aliases: string[]): number {
  if (!headers) return -1;
  const aliasSet = new Set(aliases.map((alias) => alias.toLowerCase()));
  return headers.findIndex((header) => aliasSet.has(cleanQuestionText(header).toLowerCase()));
}

function cleanQuestionText(value: string): string {
  return cleanInlineMarkdownText(value).replace(/\s+/g, " ").trim();
}

function isResolvedQuestionStatus(status: string | null): boolean {
  return status != null && /\b(resolved|closed|answered|done)\b/i.test(status);
}

function normalizeQuestionStatus(status: string | null): "open" | "blocked" | "resolved" | null {
  if (!status) return null;
  if (/\b(blocked)\b/i.test(status)) return "blocked";
  if (/\b(resolved|closed|answered|done)\b/i.test(status)) return "resolved";
  if (/\b(open|unresolved|pending)\b/i.test(status)) return "open";
  return null;
}

function quoteCommandText(value: string): string {
  return JSON.stringify(value);
}

function hasDecisionLanguage(content: string | undefined): boolean {
  if (!content) return false;
  return /\b(decision|decided|chosen|agreed|approved|deferred)\b/i.test(content);
}

function hasJournalReference(content: string): boolean {
  return /\b(journal|session capture|discussion|decision id|work session|captured)\b/i.test(
    content,
  );
}

function isApprovedStatus(doc: DocumentRow, frontmatter: Record<string, unknown>): boolean {
  const status = doc.status || stringMeta(frontmatter, "status") || "";
  return /\bapproved\b/i.test(status);
}

function dedupeJournalNudges(nudges: DocumentJournalNudge[]): DocumentJournalNudge[] {
  const seen = new Set<string>();
  return nudges.filter((nudge) => {
    if (seen.has(nudge.id)) return false;
    seen.add(nudge.id);
    return true;
  });
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
