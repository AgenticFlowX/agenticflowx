/**
 * Workbench view — feature-scoped thinking desk (spec / design / tasks / sessions).
 *
 * Features:
 * - Feature selector with progress bar
 * - Toggleable responsive columns (spec, design, tasks, sessions)
 * - Paper-style reading cards that keep a readable measure in compact and zen layouts
 * - Refinement actions for turning document thinking into chat commands
 * - Tasks view with phase headers
 * - Sessions view with agent/human toggles
 * - Drift indicators in footer
 *
 * @see docs/specs/227-app-workbench-shell/spec.md [FR-6] [FR-7] [FR-12]
 * @see docs/specs/227-app-workbench-shell/design.md [DES-SHELL-FEATURE-MOCKUP] [DES-SHELL-FEATURE-COLUMNS]
 */
import { useEffect, useMemo, useState } from "react";

import { Code2, Columns3, FileText, GitBranch, History, Layout, StickyNote } from "lucide-react";

import type { DocumentRow, FeatureTasksData, PhaseRow } from "@afx/shared";
import { Badge } from "@afx/ui/components/badge";
import { Button } from "@afx/ui/components/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@afx/ui/components/empty";
import { Progress } from "@afx/ui/components/progress";
import { ScrollArea } from "@afx/ui/components/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@afx/ui/components/select";
import { Separator } from "@afx/ui/components/separator";
import { Skeleton } from "@afx/ui/components/skeleton";
import { cn } from "@afx/ui/lib/utils";

import { WorkbenchLaunchpad } from "../components/workbench-launchpad";
import { useWorkbench } from "../context/workbench-context";
import { workbenchOn } from "../lib/bridge";
import { DocumentStudio, type DocumentStudioAction } from "../lib/document-studio";
import { OpenActions } from "../lib/open-actions";

// Column visibility type
type ColumnId = "spec" | "design" | "tasks" | "sessions";

// Column config with labels, icons, and accent colors
const COLUMN_CONFIG: Record<ColumnId, { label: string; icon: typeof StickyNote; accent: string }> =
  {
    spec: { label: "SPEC", icon: StickyNote, accent: "text-afx-brand" },
    design: { label: "DESIGN", icon: FileText, accent: "text-purple-400" },
    tasks: { label: "TASKS", icon: GitBranch, accent: "text-afx-success" },
    sessions: { label: "SESSIONS", icon: History, accent: "text-muted-foreground" },
  };

// All column IDs
const ALL_COLUMNS: ColumnId[] = ["spec", "design", "tasks", "sessions"];

// Default visibility
const defaultVisible: Record<ColumnId, boolean> = {
  spec: true,
  design: true,
  tasks: true,
  sessions: false,
};

/**
 * Renders one [Workbench.ColumnToggle] button in the feature toolbar.
 *
 * @see docs/specs/227-app-workbench-shell/spec.md [FR-6]
 * @see docs/specs/227-app-workbench-shell/design.md [DES-SHELL-FEATURE-COLUMNS]
 */
function ColumnToggle({
  id,
  visible,
  onToggle,
  status,
}: {
  id: ColumnId;
  visible: boolean;
  onToggle: () => void;
  status?: string;
}) {
  const config = COLUMN_CONFIG[id];

  const Icon = config.icon;
  const toggleLabel = `${visible ? "Hide" : "Show"} ${config.label} document column`;

  return (
    <Button
      variant={visible ? "outline" : "ghost"}
      size="xs"
      onClick={onToggle}
      className={cn(
        "h-7 min-w-0 gap-1.5 px-2",
        visible ? `bg-background shadow-sm ${config.accent}` : "text-muted-foreground",
      )}
      aria-pressed={visible}
      aria-label={toggleLabel}
      title={toggleLabel}
    >
      <Icon size={12} className="shrink-0" />
      <span className="truncate text-[11px] font-medium">{config.label}</span>
      {(id === "tasks" || id === "sessions") && status && visible && (
        <span className="shrink-0 text-[10px] opacity-70">{status}</span>
      )}
    </Button>
  );
}

/**
 * Renders a shared column header with status and editor/preview actions.
 *
 * @see docs/specs/227-app-workbench-shell/spec.md [FR-6] [FR-7]
 * @see docs/specs/227-app-workbench-shell/design.md [DES-SHELL-FEATURE-COLUMNS]
 */
function ColumnHeader({
  colId,
  status,
  onOpen,
  docPath,
}: {
  colId: ColumnId;
  status: string;
  onOpen: () => void;
  docPath?: string;
}) {
  const config = COLUMN_CONFIG[colId];
  const Icon = config.icon;

  return (
    <header className="afx-surface-toolbar flex min-w-0 items-center justify-between gap-2 border-b border-border px-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <div
          className={`flex size-5 shrink-0 items-center justify-center rounded-full bg-current/10 ${config.accent}`}
        >
          <Icon size={12} />
        </div>
        <span className="truncate font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          {config.label}
        </span>
        {status && (
          <Badge variant="outline" className="shrink-0 text-[10px]">
            {status}
          </Badge>
        )}
      </div>
      {docPath && <OpenActions filePath={docPath} />}
      {!docPath && (
        <Button variant="ghost" size="xs" onClick={onOpen} className="h-6 text-[10px]">
          Open
        </Button>
      )}
    </header>
  );
}

/**
 * Renders the [Workbench.TasksColumn] phase/task checklist.
 *
 * @see docs/specs/227-app-workbench-shell/spec.md [FR-6] [FR-7]
 * @see docs/specs/227-app-workbench-shell/design.md [DES-SHELL-FEATURE-COLUMNS]
 */
function ColumnTasks({
  feature,
  onToggle,
  onOpen,
  onCommand,
}: {
  feature: FeatureTasksData;
  onToggle: (line: number, completed: boolean) => void;
  onOpen: () => void;
  onCommand: (command: string) => void;
}) {
  const pct = feature.total === 0 ? 0 : Math.round((feature.completed / feature.total) * 100);
  const actions = useMemo(() => taskActionsForFeature(feature.name), [feature.name]);

  return (
    <div className="flex h-full min-w-0 flex-col">
      <ColumnHeader
        colId="tasks"
        status={`${feature.completed}/${feature.total}`}
        onOpen={onOpen}
        docPath={feature.tasksPath}
      />
      <ScrollArea className="afx-workbench-pane-scroll min-h-0 flex-1">
        <div className="min-w-0 p-3">
          <article className="mx-auto flex min-h-full w-full min-w-0 max-w-[76ch] flex-col gap-4 overflow-hidden rounded-sm border border-border bg-background px-4 py-4 shadow-[0_1px_0_rgba(255,255,255,0.04),0_8px_30px_rgba(0,0,0,0.06)]">
            <header className="border-b border-border/70 pb-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-afx-success">
                Execution plan
              </p>
              <div className="mt-2 flex min-w-0 items-end justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="break-words text-lg font-semibold leading-tight [overflow-wrap:anywhere]">
                    Tasks and checkpoints
                  </h2>
                  <p className="mt-1 break-words text-sm leading-6 text-muted-foreground [overflow-wrap:anywhere]">
                    Turn the decisions into a visible implementation path.
                  </p>
                </div>
                <span className="shrink-0 font-mono text-xs text-muted-foreground">
                  {feature.completed}/{feature.total}
                </span>
              </div>
              <Progress value={pct} className="mt-3 h-1.5" />
            </header>

            <TaskCommandRail actions={actions} onCommand={onCommand} />

            {feature.phases.map((phase: PhaseRow) => {
              const phasePct =
                phase.total === 0 ? 0 : Math.round((phase.completed / phase.total) * 100);
              const phaseCodeAction = phaseCodeActionForFeature(feature.name, phase);
              return (
                <section
                  key={`${phase.number}-${phase.line}`}
                  className="flex min-w-0 flex-col gap-2 overflow-hidden rounded-md border border-border/80 bg-muted/10 px-3 py-3"
                >
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h4 className="break-words text-sm font-semibold">
                        Phase {phase.number} · {phase.name}
                      </h4>
                      <p className="mt-0.5 break-words text-[11px] text-muted-foreground [overflow-wrap:anywhere]">
                        {phaseCodeAction
                          ? `Next open: ${phaseCodeAction.targetLabel}`
                          : "No open tasks in this phase"}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {phase.completed}/{phase.total}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="xs"
                        className="h-6 gap-1 px-2 text-[10px]"
                        disabled={!phaseCodeAction}
                        title={
                          phaseCodeAction?.description ??
                          `No open tasks remain in Phase ${phase.number}`
                        }
                        aria-label={`Code Phase ${phase.number}: ${phase.name}`}
                        onClick={() => phaseCodeAction && onCommand(phaseCodeAction.command)}
                      >
                        <Code2 size={11} />
                        Code
                      </Button>
                    </div>
                  </div>
                  <Progress value={phasePct} className="h-1" />
                  <ul className="flex flex-col gap-1">
                    {phase.items.map((item) => (
                      <li
                        key={item.line}
                        className="flex cursor-pointer items-start gap-2 rounded px-1 py-1 text-xs leading-5 hover:bg-accent/50"
                        onClick={() => onToggle(item.line, !item.completed)}
                      >
                        <input
                          type="checkbox"
                          checked={item.completed}
                          readOnly
                          className="mt-0.5 shrink-0 cursor-pointer accent-afx-success"
                        />
                        <span
                          className={
                            item.completed
                              ? "break-words text-muted-foreground line-through"
                              : "break-words text-foreground"
                          }
                        >
                          {item.text}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </article>
        </div>
      </ScrollArea>
    </div>
  );
}

function TaskCommandRail({
  actions,
  onCommand,
}: {
  actions: DocumentStudioAction[];
  onCommand: (command: string) => void;
}) {
  return (
    <section className="min-w-0 overflow-hidden rounded-md border border-afx-success/20 bg-afx-success/5 px-3 py-2">
      <div className="mb-2 flex min-w-0 items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-afx-success">
            Implementation launch
          </p>
          <p className="break-words text-xs leading-5 text-muted-foreground [overflow-wrap:anywhere]">
            Pick, inspect, or draft a coding run from this task plan.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {actions.map((action) => (
          <Button
            key={action.command}
            type="button"
            variant="outline"
            size="xs"
            className="h-7 min-w-0 gap-1 text-[10px]"
            title={action.description ?? action.command}
            onClick={() => onCommand(action.command)}
          >
            <span className="truncate">{action.label}</span>
          </Button>
        ))}
      </div>
    </section>
  );
}

/**
 * Renders the [Workbench.SessionsColumn] work-session verification table.
 *
 * @see docs/specs/227-app-workbench-shell/spec.md [FR-6] [FR-7]
 * @see docs/specs/227-app-workbench-shell/design.md [DES-SHELL-FEATURE-COLUMNS]
 */
function ColumnSessions({
  feature,
  onToggle,
}: {
  feature: FeatureTasksData;
  onToggle: (sessionIndex: number, column: "agent" | "human", completed: boolean) => void;
}) {
  return (
    <div className="flex h-full min-w-0 flex-col">
      <ColumnHeader
        colId="sessions"
        status={`(${feature.workSessions.length})`}
        onOpen={() => {}}
      />
      <ScrollArea className="afx-workbench-pane-scroll min-h-0 flex-1">
        {feature.workSessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 p-8 text-center">
            <Layout size={24} className="text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground">No sessions logged</p>
          </div>
        ) : (
          <div className="overflow-auto p-3">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-2 py-1 font-medium text-muted-foreground">Date</th>
                  <th className="px-2 py-1 font-medium text-muted-foreground">Task</th>
                  <th className="px-2 py-1 font-medium text-muted-foreground">Action</th>
                  <th className="px-2 py-1 font-medium text-muted-foreground">Files</th>
                  <th className="w-10 px-2 py-1 text-center font-medium text-muted-foreground">
                    Agent
                  </th>
                  <th className="w-10 px-2 py-1 text-center font-medium text-muted-foreground">
                    Human
                  </th>
                </tr>
              </thead>
              <tbody>
                {feature.workSessions.map((ws, i) => (
                  <tr key={i} className="border-b border-border hover:bg-accent/30">
                    <td className="whitespace-nowrap px-2 py-1 font-mono text-[10px] text-muted-foreground">
                      {ws.date.slice(0, 10)}
                    </td>
                    <td className="px-2 py-1">{ws.task}</td>
                    <td className="px-2 py-1 text-muted-foreground">{ws.action}</td>
                    <td className="px-2 py-1 font-mono text-[10px] text-muted-foreground">
                      {ws.filesModified}
                    </td>
                    <td className="px-2 py-1 text-center">
                      <input
                        type="checkbox"
                        checked={ws.agent}
                        onChange={() => onToggle(i, "agent", !ws.agent)}
                        className="cursor-pointer accent-afx-success"
                      />
                    </td>
                    <td className="px-2 py-1 text-center">
                      <input
                        type="checkbox"
                        checked={ws.human}
                        onChange={() => onToggle(i, "human", !ws.human)}
                        className="cursor-pointer accent-afx-success"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

/**
 * Renders one markdown-backed document column for spec/design/tasks content.
 *
 * @see docs/specs/227-app-workbench-shell/spec.md [FR-6] [FR-7]
 * @see docs/specs/227-app-workbench-shell/design.md [DES-SHELL-FEATURE-COLUMNS]
 * @see docs/specs/222-app-workbench-documents/design.md [DES-DOCS-MARKDOWN]
 */
function ColumnDoc({
  colId,
  content,
  docPath,
  featureName,
  status,
  onOpen,
  onCommand,
}: {
  colId: ColumnId;
  content: string | undefined;
  docPath: string | undefined;
  featureName: string;
  status?: string;
  onOpen: () => void;
  onCommand: (command: string) => void;
}) {
  const config = COLUMN_CONFIG[colId];
  const Icon = config.icon;
  const doc = useMemo(
    () => documentRowForColumn(colId, featureName, docPath, status),
    [colId, docPath, featureName, status],
  );
  const actions = useMemo(() => documentActionsForColumn(colId, featureName), [colId, featureName]);

  return (
    <div className="flex h-full min-w-0 flex-col">
      <ColumnHeader colId={colId} status={status ?? ""} onOpen={onOpen} docPath={docPath} />
      <ScrollArea className="afx-workbench-pane-scroll min-h-0 flex-1">
        {!docPath ? (
          <div className="flex flex-col items-center justify-center gap-2 p-8 text-center">
            <Icon size={24} className="text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground">Not yet created</p>
          </div>
        ) : !content ? (
          <div className="flex items-center justify-center p-4 text-xs text-muted-foreground">
            Loading...
          </div>
        ) : (
          <DocumentStudio
            doc={doc}
            content={content}
            variant="column"
            actions={actions}
            onCommand={onCommand}
          />
        )}
      </ScrollArea>
    </div>
  );
}

function documentRowForColumn(
  colId: ColumnId,
  featureName: string,
  docPath: string | undefined,
  status: string | undefined,
): DocumentRow {
  const type = COLUMN_CONFIG[colId].label;
  return {
    type,
    name: docPath ?? `${featureName}/${type.toLowerCase()}.md`,
    status: status ?? "",
    owner: "",
    filePath: docPath ?? `docs/specs/${featureName}/${type.toLowerCase()}.md`,
    isAfx: true,
  };
}

function documentActionsForColumn(colId: ColumnId, featureName: string): DocumentStudioAction[] {
  if (colId === "design") {
    return [
      {
        label: "Refine design",
        command: `/afx-design refine ${featureName}`,
        description: "Improve design.md from the approved spec.",
      },
      {
        label: "Review design",
        command: `/afx-design review ${featureName}`,
        description: "Ask AFX to check design quality and gaps.",
      },
    ];
  }
  if (colId === "tasks") {
    return taskActionsForFeature(featureName);
  }
  return [
    {
      label: "Refine spec",
      command: `/afx-spec refine ${featureName}`,
      description: "Tighten requirements and current truth in spec.md.",
    },
    {
      label: "Review gaps",
      command: `/afx-spec review ${featureName}`,
      description: "Ask AFX to surface missing requirements and decisions.",
    },
  ];
}

function taskActionsForFeature(featureName: string): DocumentStudioAction[] {
  return [
    {
      label: "Refine tasks",
      command: `/afx-task refine ${featureName}`,
      description: "Refresh the implementation plan from the current design.",
    },
    {
      label: "Task status",
      command: `/afx-task status ${featureName}`,
      description: "Summarize phase progress and the next actionable task.",
    },
    {
      label: "Code all",
      command: `/afx-task code all ${featureName}`,
      description: "Draft a coding run for every remaining task in this feature.",
    },
  ];
}

function phaseCodeActionForFeature(
  featureName: string,
  phase: PhaseRow,
): { command: string; description: string; targetLabel: string } | null {
  const targetIndex = phase.items.findIndex((item) => !item.completed);
  if (targetIndex < 0) return null;

  const target = phase.items[targetIndex];
  if (!target) return null;

  const wbsId = target.wbsId?.trim() || fallbackTaskWbsId(phase, targetIndex);
  const phaseName = phase.name.trim().replace(/\s+/g, " ");
  const targetLabel = `${wbsId} ${target.text}`.trim();
  return {
    command: `/afx-task code ${featureName}#${wbsId} phase ${phase.number} ${phaseName}`,
    description: `Draft a surgical coding run for ${targetLabel}.`,
    targetLabel,
  };
}

function fallbackTaskWbsId(phase: PhaseRow, index: number): string {
  return `${phase.number}.${Math.max(index, 0) + 1}`;
}

/**
 * Renders one [Workbench.DriftIndicator] status/staleness pill in the footer.
 *
 * @see docs/specs/227-app-workbench-shell/spec.md [FR-6]
 * @see docs/specs/227-app-workbench-shell/design.md [DES-SHELL-FEATURE-COLUMNS]
 */
function DriftIndicator({
  label,
  status,
  lastVerified,
}: {
  label: string;
  status: string | undefined;
  lastVerified: string | undefined;
}) {
  const dotColor =
    status === "Approved" || status === "Stable"
      ? "bg-afx-success"
      : status === "Living"
        ? "bg-afx-brand"
        : "bg-muted-foreground";

  const staleDays = lastVerified
    ? Math.floor(
        // eslint-disable-next-line react-hooks/purity -- display-only; staleness is intentional
        (Date.now() - new Date(lastVerified).getTime()) / 86400000,
      )
    : undefined;

  const freshnessColor =
    staleDays === undefined
      ? "text-muted-foreground"
      : staleDays <= 7
        ? "text-afx-success"
        : staleDays <= 30
          ? "text-amber-400"
          : "text-destructive";

  return (
    <span className="flex items-center gap-1.5 text-[10px]">
      <span className={`size-1.5 rounded-full ${dotColor}`} />
      <span className="uppercase tracking-wide">{label}</span>: {status ?? "—"}
      {staleDays !== undefined && <span className={freshnessColor}>({staleDays}d)</span>}
    </span>
  );
}

/**
 * Renders the feature-scoped Workbench thinking desk.
 *
 * @see docs/specs/227-app-workbench-shell/spec.md [FR-5] [FR-6] [FR-7] [FR-12]
 * @see docs/specs/227-app-workbench-shell/design.md [DES-SHELL-FEATURE-MOCKUP] [DES-SHELL-FEATURE-COLUMNS]
 */
export default function Workbench() {
  const { pipeline, featureTasks, selectedFeature, selectFeature, send, isLoading } =
    useWorkbench();
  const [content, setContent] = useState<Record<string, string>>({});
  const [visible, setVisible] = useState<Record<ColumnId, boolean>>(defaultVisible);

  // Listen for doc content
  useEffect(() => {
    return workbenchOn("afxDocContent", (msg) => {
      setContent((prev) => ({ ...prev, [msg.filePath]: msg.content }));
    });
  }, []);

  // Feature selection
  const featureName = selectedFeature ?? pipeline[0]?.name ?? null;
  const row = useMemo(() => pipeline.find((p) => p.name === featureName), [pipeline, featureName]);
  const tasks = useMemo(
    () => featureTasks.find((f) => f.name === featureName),
    [featureTasks, featureName],
  );

  // Request content when needed
  useEffect(() => {
    if (!row) return;
    for (const path of [row.specPath, row.designPath, row.tasksPath]) {
      if (path && !content[path]) {
        send({ type: "afxFetchDocContent", filePath: path });
      }
    }
  }, [row, content, send]);

  // Toggle column visibility
  const toggleColumn = (id: ColumnId) => {
    setVisible((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Handle task toggle
  const handleToggleTask = (line: number, completed: boolean) => {
    if (tasks?.tasksPath) {
      send({ type: "afxToggleTask", path: tasks.tasksPath, line, completed });
    }
  };

  // Handle session toggle
  const handleToggleSession = (
    sessionIndex: number,
    column: "agent" | "human",
    completed: boolean,
  ) => {
    if (tasks?.tasksPath) {
      send({
        type: "afxToggleSession",
        filePath: tasks.tasksPath,
        sessionIndex,
        column,
        completed,
      });
    }
  };

  const openChatCommand = (command: string) => {
    send({ type: "afxOpenChatCommand", command, mode: "insert" });
  };

  // Visible columns
  const visibleColumns = ALL_COLUMNS.filter((c) => visible[c]);

  // Progress percentage
  const featurePct = row
    ? row.total === 0
      ? 0
      : Math.round((row.completed / row.total) * 100)
    : 0;

  // Show skeleton while host scans the workspace — important for large projects
  // where the initial scan can take seconds.
  if (isLoading && pipeline.length === 0) {
    return (
      <div className="flex h-full flex-col">
        <div className="afx-surface-toolbar flex items-center gap-3 border-b border-border px-3 py-2">
          <Skeleton className="h-7 w-[200px]" />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="ml-auto h-1.5 w-32" />
        </div>
        <div className="grid flex-1 grid-cols-1 gap-2 p-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-full min-h-32 rounded-md" />
          ))}
        </div>
        <div className="border-t border-border px-3 py-1.5 text-[10px] text-muted-foreground">
          Scanning workspace…
        </div>
      </div>
    );
  }

  if (pipeline.length === 0) {
    return <WorkbenchLaunchpad context="workbench" />;
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {/*
        Surface: [Workbench.FeatureToolbar]
        @see docs/specs/227-app-workbench-shell/design.md [DES-SHELL-FEATURE-COLUMNS]
      */}
      <div className="afx-surface-toolbar flex flex-wrap items-center gap-3 border-b border-border px-3 py-2">
        <Select value={featureName ?? ""} onValueChange={(v) => selectFeature(v)}>
          <SelectTrigger className="afx-field-surface h-8 w-[min(340px,46vw)] justify-between border border-border bg-background px-3 text-left text-xs shadow-sm">
            <SelectValue placeholder="Select feature" />
          </SelectTrigger>
          <SelectContent className="min-w-[360px] border border-border bg-popover p-1 shadow-lg">
            {pipeline.map((p) => (
              <SelectItem
                key={p.name}
                value={p.name}
                className="rounded-sm py-1.5 pl-7 pr-2 text-xs"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
                  <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                    {p.completed}/{p.total}
                  </span>
                  <span
                    className={cn(
                      "size-1.5 shrink-0 rounded-full",
                      p.featureStatus === "Living" ? "bg-afx-brand" : "bg-muted-foreground/60",
                    )}
                    aria-hidden
                  />
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {row && (
          <>
            <Separator orientation="vertical" className="h-5" />
            {row.total > 0 && (
              <div className="flex items-center gap-2">
                <Progress value={featurePct} className="h-1 w-16" />
                <span className="font-mono text-[10px] text-muted-foreground">{featurePct}%</span>
              </div>
            )}
            <Badge variant="outline" className="text-[10px]">
              {row.featureStatus || "Draft"}
            </Badge>
          </>
        )}

        {/* Column toggles */}
        <div
          className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-1 rounded-md border border-border/70 bg-background/45 px-1.5 py-1"
          data-testid="workbench-column-toggles"
          aria-label="Show or hide Workbench document columns"
          title="Show or hide Workbench document columns"
        >
          <span className="hidden shrink-0 items-center gap-1 font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground sm:inline-flex">
            <Columns3 size={11} aria-hidden />
            Show/hide docs
          </span>
          {ALL_COLUMNS.map((colId) => {
            const status =
              colId === "spec"
                ? row?.specStatus
                : colId === "design"
                  ? row?.designStatus
                  : colId === "tasks"
                    ? tasks
                      ? `${tasks.completed}/${tasks.total}`
                      : undefined
                    : colId === "sessions"
                      ? tasks
                        ? `(${tasks.workSessions.length})`
                        : undefined
                      : undefined;
            return (
              <ColumnToggle
                key={colId}
                id={colId}
                visible={visible[colId]}
                onToggle={() => toggleColumn(colId)}
                status={status}
              />
            );
          })}
        </div>
      </div>

      {/*
        Surface: [Workbench.ColumnRegion]
        @see docs/specs/227-app-workbench-shell/design.md [DES-SHELL-FEATURE-COLUMNS]
      */}
      {visibleColumns.length === 0 ? (
        <Empty className="flex-1">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Layout size={32} />
            </EmptyMedia>
            <EmptyTitle>No columns visible</EmptyTitle>
            <EmptyDescription>Toggle a column above to get started.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div
          data-testid="workbench-column-region"
          className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden p-2"
        >
          <div
            className="grid h-full min-w-full gap-2"
            style={{
              gridTemplateColumns:
                visibleColumns.length === 1
                  ? "minmax(0, 1fr)"
                  : `repeat(${visibleColumns.length}, minmax(420px, 1fr))`,
            }}
          >
            {visibleColumns.map((colId) => (
              <div
                key={colId}
                className="afx-surface-card afx-workbench-column-card flex h-full min-w-0 flex-col overflow-hidden rounded-md border border-border bg-muted/5 shadow-none"
              >
                {colId === "spec" && row ? (
                  <ColumnDoc
                    colId="spec"
                    content={row.specPath ? content[row.specPath] : undefined}
                    docPath={row.specPath}
                    featureName={row.name}
                    status={row.specStatus}
                    onCommand={openChatCommand}
                    onOpen={() =>
                      row.specPath &&
                      send({ type: "afxOpenFile", path: row.specPath, mode: "preview" })
                    }
                  />
                ) : colId === "design" && row ? (
                  <ColumnDoc
                    colId="design"
                    content={row.designPath ? content[row.designPath] : undefined}
                    docPath={row.designPath}
                    featureName={row.name}
                    status={row.designStatus}
                    onCommand={openChatCommand}
                    onOpen={() =>
                      row.designPath &&
                      send({ type: "afxOpenFile", path: row.designPath, mode: "preview" })
                    }
                  />
                ) : colId === "tasks" && tasks ? (
                  <ColumnTasks
                    feature={tasks}
                    onToggle={handleToggleTask}
                    onCommand={openChatCommand}
                    onOpen={() =>
                      row?.tasksPath &&
                      send({ type: "afxOpenFile", path: row.tasksPath, mode: "preview" })
                    }
                  />
                ) : colId === "tasks" && row ? (
                  <ColumnDoc
                    colId="tasks"
                    content={row.tasksPath ? content[row.tasksPath] : undefined}
                    docPath={row.tasksPath}
                    featureName={row.name}
                    status={row.tasksStatus}
                    onCommand={openChatCommand}
                    onOpen={() =>
                      row.tasksPath &&
                      send({ type: "afxOpenFile", path: row.tasksPath, mode: "preview" })
                    }
                  />
                ) : colId === "sessions" && tasks ? (
                  <ColumnSessions feature={tasks} onToggle={handleToggleSession} />
                ) : (
                  <div className="flex items-center justify-center p-4 text-sm text-muted-foreground">
                    Select a feature to view {COLUMN_CONFIG[colId].label.toLowerCase()}.
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/*
        Surface: [Workbench.DriftFooter]
        @see docs/specs/227-app-workbench-shell/design.md [DES-SHELL-FEATURE-COLUMNS]
      */}
      {row && (
        <div className="afx-surface-toolbar flex flex-wrap items-center gap-4 border-t border-border px-3 py-1.5 text-muted-foreground">
          <DriftIndicator
            label="spec"
            status={row.specStatus}
            lastVerified={row.specLastVerified}
          />
          <DriftIndicator
            label="design"
            status={row.designStatus}
            lastVerified={row.designLastVerified}
          />
          <DriftIndicator
            label="tasks"
            status={row.tasksStatus}
            lastVerified={row.tasksLastVerified}
          />
        </div>
      )}
    </div>
  );
}
