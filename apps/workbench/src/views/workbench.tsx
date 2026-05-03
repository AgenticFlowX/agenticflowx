/**
 * Workbench view — feature-scoped 4-column view (spec / design / tasks / sessions).
 *
 * Features:
 * - Feature selector with progress bar
 * - Toggleable columns (spec, design, tasks, sessions)
 * - Resizable panes
 * - Tasks view with phase headers
 * - Sessions view with agent/human toggles
 * - Drift indicators in footer
 *
 * @see docs/specs/227-app-workbench-shell/spec.md [FR-6] [FR-7]
 * @see docs/specs/227-app-workbench-shell/design.md [DES-SHELL-FEATURE-MOCKUP] [DES-SHELL-FEATURE-COLUMNS]
 */
import { Fragment, useEffect, useMemo, useState } from "react";

import { FileText, GitBranch, History, Layout, StickyNote } from "lucide-react";

import type { FeatureTasksData, PhaseRow } from "@afx/shared";
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
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@afx/ui/components/resizable";
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

import { useWorkbench } from "../context/workbench-context";
import { workbenchOn } from "../lib/bridge";
import { MinimalMarkdown } from "../lib/markdown-render";
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

  return (
    <Button
      variant={visible ? "outline" : "ghost"}
      size="xs"
      onClick={onToggle}
      className={`h-7 gap-1.5 px-2 ${visible ? config.accent : "text-muted-foreground"}`}
      aria-pressed={visible}
    >
      <Icon size={12} className="shrink-0" />
      <span className="text-[11px] font-medium">{config.label}</span>
      {(id === "tasks" || id === "sessions") && status && visible && (
        <span className="text-[10px] opacity-70">{status}</span>
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
    <header className="afx-surface-toolbar flex items-center justify-between border-b border-border px-3 py-2">
      <div className="flex items-center gap-2">
        <div
          className={`flex size-5 items-center justify-center rounded-full bg-current/10 ${config.accent}`}
        >
          <Icon size={12} />
        </div>
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {config.label}
        </span>
        {status && (
          <Badge variant="outline" className="text-[10px]">
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
}: {
  feature: FeatureTasksData;
  onToggle: (line: number, completed: boolean) => void;
  onOpen: () => void;
}) {
  const pct = feature.total === 0 ? 0 : Math.round((feature.completed / feature.total) * 100);

  return (
    <div className="flex h-full flex-col">
      <ColumnHeader
        colId="tasks"
        status={`${feature.completed}/${feature.total}`}
        onOpen={onOpen}
        docPath={feature.tasksPath}
      />
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-4 p-3">
          {feature.phases.map((phase: PhaseRow) => {
            const phasePct =
              phase.total === 0 ? 0 : Math.round((phase.completed / phase.total) * 100);
            return (
              <section key={`${phase.number}-${phase.line}`} className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-medium">
                    Phase {phase.number} · {phase.name}
                  </h4>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {phase.completed}/{phase.total}
                  </span>
                </div>
                <Progress value={phasePct} className="h-1" />
                <ul className="flex flex-col gap-1">
                  {phase.items.map((item) => (
                    <li
                      key={item.line}
                      className="flex cursor-pointer items-start gap-2 rounded px-1 py-0.5 text-xs hover:bg-accent/50"
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
                          item.completed ? "text-muted-foreground line-through" : "text-foreground"
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
          <div className="mt-2 flex items-center gap-2 border-t border-border pt-2 text-muted-foreground">
            <Progress value={pct} className="h-1 flex-1" />
            <span className="font-mono text-[10px]">
              Progress: {feature.completed}/{feature.total} ({pct}%)
            </span>
          </div>
        </div>
      </ScrollArea>
    </div>
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
    <div className="flex h-full flex-col">
      <ColumnHeader
        colId="sessions"
        status={`(${feature.workSessions.length})`}
        onOpen={() => {}}
      />
      <ScrollArea className="min-h-0 flex-1">
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
  onOpen,
}: {
  colId: ColumnId;
  content: string | undefined;
  docPath: string | undefined;
  onOpen: () => void;
}) {
  const config = COLUMN_CONFIG[colId];
  const Icon = config.icon;

  return (
    <div className="flex h-full min-w-0 flex-col">
      <ColumnHeader colId={colId} status="" onOpen={onOpen} docPath={docPath} />
      <ScrollArea className="min-h-0 flex-1">
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
          <article className="min-w-0 p-4">
            <MinimalMarkdown content={content} />
          </article>
        )}
      </ScrollArea>
    </div>
  );
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
 * Renders the feature-scoped four-column Workbench tab.
 *
 * @see docs/specs/227-app-workbench-shell/spec.md [FR-5] [FR-6] [FR-7]
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
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Layout size={32} />
          </EmptyMedia>
          <EmptyTitle>No features found</EmptyTitle>
          <EmptyDescription>
            Run <code>/afx-scaffold</code> in the chat to create your first feature.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {/*
        Surface: [Workbench.FeatureToolbar]
        @see docs/specs/227-app-workbench-shell/design.md [DES-SHELL-FEATURE-COLUMNS]
      */}
      <div className="afx-surface-toolbar flex flex-wrap items-center gap-3 border-b border-border px-3 py-2">
        <Select value={featureName ?? ""} onValueChange={(v) => selectFeature(v)}>
          <SelectTrigger className="h-7 w-[200px] text-xs">
            <SelectValue placeholder="Select feature" />
          </SelectTrigger>
          <SelectContent>
            {pipeline.map((p) => (
              <SelectItem key={p.name} value={p.name} className="text-xs">
                <div className="flex items-center justify-between gap-4">
                  <span>{p.name}</span>
                  <span className="text-muted-foreground">
                    {p.completed}/{p.total}
                  </span>
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
        <div className="ml-auto flex flex-wrap items-center gap-1">
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
        <ResizablePanelGroup
          orientation="horizontal"
          className="min-h-0 flex-1 gap-2 overflow-hidden p-2"
        >
          {visibleColumns.map((colId, index) => (
            <Fragment key={colId}>
              <ResizablePanel defaultSize="25%" minSize="15%">
                <div className="afx-surface-card flex h-full flex-col overflow-hidden rounded-md border border-border shadow-none">
                  {colId === "spec" && row ? (
                    <ColumnDoc
                      colId="spec"
                      content={row.specPath ? content[row.specPath] : undefined}
                      docPath={row.specPath}
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
                      onOpen={() =>
                        row.designPath &&
                        send({ type: "afxOpenFile", path: row.designPath, mode: "preview" })
                      }
                    />
                  ) : colId === "tasks" && tasks ? (
                    <ColumnTasks
                      feature={tasks}
                      onToggle={handleToggleTask}
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
              </ResizablePanel>
              {index < visibleColumns.length - 1 ? (
                <ResizableHandle className="w-1 bg-transparent transition-colors hover:bg-afx-brand/35 focus-visible:bg-afx-brand/35" />
              ) : null}
            </Fragment>
          ))}
        </ResizablePanelGroup>
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
