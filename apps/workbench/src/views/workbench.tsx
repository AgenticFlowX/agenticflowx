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
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  Columns3,
  FileText,
  Focus,
  GitBranch,
  History,
  Layout,
  ListTree,
  Minimize2,
  SlidersHorizontal,
  StickyNote,
} from "lucide-react";

import type { DocumentRow } from "@afx/shared";
import { Badge } from "@afx/ui/components/badge";
import { Button } from "@afx/ui/components/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@afx/ui/components/empty";
import { Popover, PopoverContent, PopoverTrigger } from "@afx/ui/components/popover";
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
import { ToggleGroup, ToggleGroupItem } from "@afx/ui/components/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@afx/ui/components/tooltip";
import { cn } from "@afx/ui/lib/utils";

import { CopyMarkdownButton } from "../components/copy-markdown-button";
import { SessionSignoffToolbar } from "../components/session-signoff-toolbar";
import { WorkbenchLaunchpad } from "../components/workbench-launchpad";
import { useWorkbench } from "../context/workbench-context";
import { workbenchOn } from "../lib/bridge";
import { extractOutline } from "../lib/document-outline";
import {
  type DocumentSessionBulkAction,
  DocumentStudio,
  type DocumentStudioAction,
} from "../lib/document-studio";
import { type MarkdownCheckboxToggle, MinimalMarkdown } from "../lib/markdown-render";
import { OpenActions } from "../lib/open-actions";
import {
  type ReadingFont,
  type ReadingPrefs,
  type ReadingSize,
  type ReadingTone,
  type ReadingWidth,
  readReadingPrefs,
  readingWidthClass,
  writeReadingPrefs,
} from "../lib/reading-prefs";
import { splitSprintSections } from "../lib/sprint-sections";
import { summarizeWorkSessionSignoffs } from "../lib/work-sessions";

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

const COLUMN_WIDTH_STORAGE_KEY = "afx.workbench.columnWidths.v1";
const MIN_COLUMN_WIDTH = 320;
const MAX_COLUMN_WIDTH = 760;
const COLUMN_RESIZE_STEP = 32;
const DEFAULT_COLUMN_WIDTHS: Record<ColumnId, number> = {
  spec: 420,
  design: 420,
  tasks: 420,
  sessions: 460,
};

function clampColumnWidth(width: number): number {
  return Math.min(MAX_COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, Math.round(width)));
}

function readColumnWidths(): Record<ColumnId, number> {
  try {
    const raw = globalThis.localStorage?.getItem(COLUMN_WIDTH_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_COLUMN_WIDTHS };
    const parsed = JSON.parse(raw) as Partial<Record<ColumnId, number>>;
    return ALL_COLUMNS.reduce(
      (acc, id) => {
        const value = parsed[id];
        acc[id] = typeof value === "number" ? clampColumnWidth(value) : DEFAULT_COLUMN_WIDTHS[id];
        return acc;
      },
      { ...DEFAULT_COLUMN_WIDTHS },
    );
  } catch {
    return { ...DEFAULT_COLUMN_WIDTHS };
  }
}

function writeColumnWidths(widths: Record<ColumnId, number>): void {
  try {
    globalThis.localStorage?.setItem(COLUMN_WIDTH_STORAGE_KEY, JSON.stringify(widths));
  } catch {
    // localStorage unavailable — resizing stays in-memory only.
  }
}

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
  controls,
}: {
  colId: ColumnId;
  status: string;
  onOpen: () => void;
  docPath?: string;
  controls?: ReactNode;
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
      <div className="flex shrink-0 items-center gap-0.5">
        {docPath && <OpenActions filePath={docPath} includeAfxPreview />}
        {controls}
        {!docPath && (
          <Button variant="ghost" size="xs" onClick={onOpen} className="h-6 text-[10px]">
            Open
          </Button>
        )}
      </div>
    </header>
  );
}

function ColumnReaderControls({
  colId,
  content,
  outline,
  reading,
  focused,
  onJump,
  onReadingChange,
  onToggleFocus,
}: {
  colId: ColumnId;
  content: string | null | undefined;
  outline: ReturnType<typeof extractOutline>;
  reading: ReadingPrefs;
  focused: boolean;
  onJump: (slug: string) => void;
  onReadingChange: (patch: Partial<ReadingPrefs>) => void;
  onToggleFocus: () => void;
}) {
  const label = COLUMN_CONFIG[colId].label;

  return (
    <>
      <CopyMarkdownButton
        content={content}
        label={label}
        ariaLabel={`Copy ${label} markdown source`}
      />
      <Popover>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                className="h-6 shrink-0 gap-1 border-border/50 px-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:border-border hover:text-foreground"
                aria-label={`Open ${label} outline`}
              >
                <ListTree size={12} aria-hidden />
                <span className="hidden sm:inline">Outline</span>
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom">Open {label} outline</TooltipContent>
        </Tooltip>
        <PopoverContent
          align="end"
          sideOffset={6}
          className="max-h-[min(24rem,calc(100vh-4rem))] w-[min(22rem,calc(100vw-2rem))] overflow-hidden p-0"
        >
          <section
            aria-label={`${label} outline`}
            className="flex max-h-[min(24rem,calc(100vh-4rem))] min-w-0 flex-col overflow-hidden rounded-[inherit] bg-popover p-2"
          >
            <div className="mb-1.5 flex min-w-0 shrink-0 items-center gap-2">
              <ListTree size={12} className="shrink-0 text-afx-brand" aria-hidden />
              <h3 className="shrink-0 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Outline
              </h3>
              <span className="min-w-0 truncate text-[11px] text-muted-foreground">
                {outline.length} {outline.length === 1 ? "section" : "sections"}
              </span>
            </div>
            <div className="min-h-0 max-h-[min(21rem,calc(100vh-7rem))] overflow-y-auto overscroll-contain pr-1">
              {outline.length === 0 ? (
                <p className="px-1 py-1 text-xs text-muted-foreground">No headings detected.</p>
              ) : (
                <ul className="flex flex-col gap-0.5">
                  {outline.map((item) => (
                    <li key={`${item.line}-${item.slug}`}>
                      <button
                        type="button"
                        onClick={() => onJump(item.slug)}
                        className={cn(
                          "w-full rounded-sm px-1 py-0.5 text-left text-xs leading-4 text-foreground/80 transition-colors hover:bg-muted/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                          item.level === 1
                            ? "pl-0"
                            : item.level === 2
                              ? "pl-2"
                              : item.level === 3
                                ? "pl-4"
                                : item.level === 4
                                  ? "pl-6"
                                  : item.level === 5
                                    ? "pl-8"
                                    : "pl-10",
                        )}
                        title={`Jump to "${item.text}"`}
                      >
                        <span className="block truncate">{item.text}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </PopoverContent>
      </Popover>

      <Popover>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="text-muted-foreground hover:text-foreground"
                aria-label={`${label} reading options`}
              >
                <SlidersHorizontal size={12} aria-hidden />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom">{label} reading options</TooltipContent>
        </Tooltip>
        <PopoverContent align="end" className="w-56 gap-3 rounded-md">
          <ColumnOptionRow label="Width">
            <ToggleGroup
              type="single"
              size="sm"
              variant="outline"
              value={reading.width}
              onValueChange={(value) => value && onReadingChange({ width: value as ReadingWidth })}
            >
              <ToggleGroupItem value="comfortable" className="px-2 text-[11px]">
                Comfortable
              </ToggleGroupItem>
              <ToggleGroupItem value="wide" className="px-2 text-[11px]">
                Wide
              </ToggleGroupItem>
            </ToggleGroup>
          </ColumnOptionRow>
          <ColumnOptionRow label="Text size">
            <ToggleGroup
              type="single"
              size="sm"
              variant="outline"
              value={reading.size}
              onValueChange={(value) => value && onReadingChange({ size: value as ReadingSize })}
            >
              <ToggleGroupItem value="s" className="w-8 text-[11px]" aria-label="Small">
                S
              </ToggleGroupItem>
              <ToggleGroupItem value="m" className="w-8 text-[11px]" aria-label="Medium">
                M
              </ToggleGroupItem>
              <ToggleGroupItem value="l" className="w-8 text-[11px]" aria-label="Large">
                L
              </ToggleGroupItem>
              <ToggleGroupItem value="xl" className="w-8 text-[11px]" aria-label="Extra large">
                XL
              </ToggleGroupItem>
            </ToggleGroup>
          </ColumnOptionRow>
          <ColumnOptionRow label="Paper tone">
            <ToggleGroup
              type="single"
              size="sm"
              variant="outline"
              value={reading.tone}
              onValueChange={(value) => value && onReadingChange({ tone: value as ReadingTone })}
            >
              <ToggleGroupItem value="default" className="px-2 text-[11px]">
                Default
              </ToggleGroupItem>
              <ToggleGroupItem value="warm" className="px-2 text-[11px]">
                Warm
              </ToggleGroupItem>
            </ToggleGroup>
          </ColumnOptionRow>
          <ColumnOptionRow label="Font">
            <ToggleGroup
              type="single"
              size="sm"
              variant="outline"
              value={reading.font}
              onValueChange={(value) => value && onReadingChange({ font: value as ReadingFont })}
            >
              <ToggleGroupItem value="sans" className="px-2 text-[11px]">
                Sans
              </ToggleGroupItem>
              <ToggleGroupItem value="serif" className="px-2 font-serif text-[11px]">
                Serif
              </ToggleGroupItem>
            </ToggleGroup>
          </ColumnOptionRow>
        </PopoverContent>
      </Popover>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="text-muted-foreground hover:text-foreground"
            aria-label={focused ? `Exit ${label} focus mode` : `Focus ${label} column`}
            onClick={onToggleFocus}
          >
            {focused ? <Minimize2 size={12} aria-hidden /> : <Focus size={12} aria-hidden />}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {focused ? `Exit ${label} focus mode` : `Focus ${label} column`}
        </TooltipContent>
      </Tooltip>
    </>
  );
}

function ColumnOptionRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

/**
 * Drag/keyboard affordance for resizing one Workbench document column.
 *
 * @see docs/specs/227-app-workbench-shell/spec.md [FR-6]
 * @see docs/specs/227-app-workbench-shell/design.md [DES-SHELL-FEATURE-COLUMNS]
 */
function ColumnResizeHandle({
  colId,
  width,
  onResize,
}: {
  colId: ColumnId;
  width: number;
  onResize: (colId: ColumnId, delta: number) => void;
}) {
  const drag = useRef<{ pointerId: number; x: number } | null>(null);
  const label = `Resize ${COLUMN_CONFIG[colId].label} column`;

  return (
    <div
      role="separator"
      aria-label={label}
      aria-orientation="vertical"
      aria-valuemin={MIN_COLUMN_WIDTH}
      aria-valuemax={MAX_COLUMN_WIDTH}
      aria-valuenow={width}
      tabIndex={0}
      title={label}
      className="absolute bottom-0 right-0 top-0 z-10 flex w-3 translate-x-1/2 cursor-col-resize items-center justify-center opacity-70 transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      onPointerDown={(event) => {
        event.preventDefault();
        drag.current = { pointerId: event.pointerId, x: event.clientX };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        const active = drag.current;
        if (!active || active.pointerId !== event.pointerId) return;
        const delta = event.clientX - active.x;
        if (delta === 0) return;
        drag.current = { ...active, x: event.clientX };
        onResize(colId, delta);
      }}
      onPointerUp={(event) => {
        if (drag.current?.pointerId === event.pointerId) drag.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      }}
      onPointerCancel={(event) => {
        if (drag.current?.pointerId === event.pointerId) drag.current = null;
      }}
      onKeyDown={(event) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        onResize(colId, event.key === "ArrowRight" ? COLUMN_RESIZE_STEP : -COLUMN_RESIZE_STEP);
      }}
    >
      <span
        className="h-12 w-px rounded-full bg-border shadow-[0_0_0_1px_rgba(255,255,255,0.18)]"
        aria-hidden
      />
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
  content,
  docPath,
  featureName,
  onOpen,
  onCheckboxToggle,
  onSessionBulkAction,
  reading,
  focused,
  onReadingChange,
  onToggleFocus,
}: {
  content: string | undefined;
  docPath: string | undefined;
  featureName: string;
  onOpen: () => void;
  onCheckboxToggle: (target: MarkdownCheckboxToggle) => void;
  onSessionBulkAction: (action: DocumentSessionBulkAction) => void;
  reading: ReadingPrefs;
  focused: boolean;
  onReadingChange: (patch: Partial<ReadingPrefs>) => void;
  onToggleFocus: () => void;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const sessions = useMemo(
    () => (content ? extractWorkSessionsMarkdown(content) : null),
    [content],
  );
  const summary = useMemo(
    () => (content ? summarizeWorkSessionSignoffs(content) : null),
    [content],
  );
  const outline = useMemo(() => (sessions ? extractOutline(sessions.content) : []), [sessions]);
  const jumpToHeading = useCallback((slug: string) => {
    const target = contentRef.current?.querySelector<HTMLElement>(`#${CSS.escape(slug)}`);
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <div className="flex h-full min-w-0 flex-col">
      <ColumnHeader
        colId="sessions"
        status={summary ? `${summary.humanChecked}/${summary.total}` : ""}
        onOpen={onOpen}
        docPath={docPath}
        controls={
          docPath ? (
            <ColumnReaderControls
              colId="sessions"
              content={sessions?.content ?? content}
              outline={outline}
              reading={reading}
              focused={focused}
              onJump={jumpToHeading}
              onReadingChange={onReadingChange}
              onToggleFocus={onToggleFocus}
            />
          ) : null
        }
      />
      <ScrollArea className="afx-workbench-pane-scroll min-h-0 flex-1">
        {!docPath ? (
          <div className="flex flex-col items-center justify-center gap-2 p-8 text-center">
            <Layout size={24} className="text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground">No task document yet</p>
          </div>
        ) : !content ? (
          <div className="flex items-center justify-center p-4 text-xs text-muted-foreground">
            Loading...
          </div>
        ) : !sessions || !summary ? (
          <div className="flex flex-col items-center justify-center gap-2 p-8 text-center">
            <Layout size={24} className="text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground">No sessions logged</p>
          </div>
        ) : (
          <div ref={contentRef} className="min-w-0 p-3">
            <article
              className={cn(
                "afx-paper mx-auto flex min-h-full w-full min-w-0 flex-col gap-3 overflow-hidden rounded-xl border border-border/60 px-5 py-5 shadow-[0_1px_0_rgba(255,255,255,0.04),0_10px_30px_rgba(0,0,0,0.10)]",
                readingWidthClass(reading.width),
                reading.tone === "warm" ? "afx-paper--warm" : "bg-card",
                reading.font === "serif" && "font-serif",
              )}
            >
              <header className="border-b border-border/70 pb-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  Work Sessions
                </p>
                <h2 className="mt-1 break-words text-lg font-semibold leading-tight [overflow-wrap:anywhere]">
                  {titleFromFeatureName(featureName)}
                </h2>
              </header>
              <SessionSignoffToolbar
                summary={summary}
                density="compact"
                onToggleAll={(column, completed) =>
                  onSessionBulkAction({ type: "toggleAll", column, completed })
                }
                onApprove={() => onSessionBulkAction({ type: "approve" })}
              />
              <MinimalMarkdown
                content={sessions.content}
                hideTitle
                density="relaxed"
                scale={reading.size}
                sourceLineOffset={sessions.sourceLineOffset}
                onCheckboxToggle={onCheckboxToggle}
              />
            </article>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

function extractWorkSessionsMarkdown(
  content: string,
): { content: string; sourceLineOffset: number } | null {
  const segment = splitSprintSections(content).find((part) => part.kind === "SESSIONS");
  if (segment?.body.trim()) {
    return { content: segment.body, sourceLineOffset: segment.startLine - 1 };
  }
  return null;
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
  onCheckboxToggle,
  onSessionBulkAction,
  reading,
  focused,
  onReadingChange,
  onToggleFocus,
}: {
  colId: ColumnId;
  content: string | undefined;
  docPath: string | undefined;
  featureName: string;
  status?: string;
  onOpen: () => void;
  onCommand: (command: string) => void;
  onCheckboxToggle?: (target: MarkdownCheckboxToggle) => void;
  onSessionBulkAction?: (action: DocumentSessionBulkAction) => void;
  reading: ReadingPrefs;
  focused: boolean;
  onReadingChange: (patch: Partial<ReadingPrefs>) => void;
  onToggleFocus: () => void;
}) {
  const config = COLUMN_CONFIG[colId];
  const Icon = config.icon;
  const contentRef = useRef<HTMLDivElement>(null);
  const doc = useMemo(
    () => documentRowForColumn(colId, featureName, docPath, status),
    [colId, docPath, featureName, status],
  );
  const actions = useMemo(() => documentActionsForColumn(colId, featureName), [colId, featureName]);
  const outline = useMemo(() => (content ? extractOutline(content) : []), [content]);
  const jumpToHeading = useCallback((slug: string) => {
    const target = contentRef.current?.querySelector<HTMLElement>(`#${CSS.escape(slug)}`);
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <div className="flex h-full min-w-0 flex-col">
      <ColumnHeader
        colId={colId}
        status={status ?? ""}
        onOpen={onOpen}
        docPath={docPath}
        controls={
          docPath ? (
            <ColumnReaderControls
              colId={colId}
              content={content}
              outline={outline}
              reading={reading}
              focused={focused}
              onJump={jumpToHeading}
              onReadingChange={onReadingChange}
              onToggleFocus={onToggleFocus}
            />
          ) : null
        }
      />
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
          <div ref={contentRef} className="min-w-0 p-3">
            <DocumentStudio
              doc={doc}
              content={content}
              variant="column"
              actions={actions}
              reading={reading}
              onCommand={onCommand}
              onCheckboxToggle={onCheckboxToggle}
              onSessionBulkAction={onSessionBulkAction}
            />
          </div>
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
  const displayName = `${titleFromFeatureName(featureName)} — ${type}`;
  return {
    type,
    name: displayName,
    status: status ?? "",
    owner: "",
    filePath: docPath ?? `docs/specs/${featureName}/${type.toLowerCase()}.md`,
    isAfx: true,
  };
}

function titleFromFeatureName(featureName: string): string {
  const parts = featureName.split("/").filter(Boolean);
  const leaf = parts.length > 0 ? parts[parts.length - 1] : featureName;
  return leaf
    .replace(/^\d+[-_]/, "")
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => {
      if (/^agenticflowx$/i.test(part)) return "AgenticFlowX";
      if (/^afx$/i.test(part)) return "AFX";
      if (/^ui$/i.test(part)) return "UI";
      if (/^api$/i.test(part)) return "API";
      if (/^vscode$/i.test(part)) return "VS Code";
      return `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`;
    })
    .join(" ");
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
  const [columnWidths, setColumnWidths] = useState<Record<ColumnId, number>>(readColumnWidths);
  const [reading, setReading] = useState<ReadingPrefs>(readReadingPrefs);
  const [focusedColumn, setFocusedColumn] = useState<ColumnId | null>(null);

  useEffect(() => {
    writeColumnWidths(columnWidths);
  }, [columnWidths]);

  useEffect(() => {
    writeReadingPrefs(reading);
  }, [reading]);

  useEffect(() => {
    if (!focusedColumn) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFocusedColumn(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [focusedColumn]);

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
    setFocusedColumn((prev) => (prev === id ? null : prev));
  };

  const resizeColumn = useCallback((id: ColumnId, delta: number) => {
    setColumnWidths((prev) => ({
      ...prev,
      [id]: clampColumnWidth(prev[id] + delta),
    }));
  }, []);

  const updateReading = useCallback((patch: Partial<ReadingPrefs>) => {
    setReading((prev) => ({ ...prev, ...patch }));
  }, []);

  const toggleColumnFocus = useCallback((id: ColumnId) => {
    setFocusedColumn((prev) => (prev === id ? null : id));
  }, []);

  const handleMarkdownCheckboxToggle = (target: MarkdownCheckboxToggle) => {
    if (!tasks?.tasksPath) return;
    if (target.kind === "task" && typeof target.line === "number") {
      send({
        type: "afxToggleTask",
        path: tasks.tasksPath,
        line: target.line,
        completed: target.completed,
      });
      return;
    }
    if (target.kind === "session" && target.column && target.sessionIndex !== undefined) {
      send({
        type: "afxToggleSession",
        filePath: tasks.tasksPath,
        sessionIndex: target.sessionIndex,
        column: target.column,
        completed: target.completed,
        line: target.line,
      });
    }
  };

  const handleToggleAllSessions = (column: "agent" | "human", completed: boolean) => {
    if (tasks?.tasksPath) {
      send({
        type: "afxToggleAllSessions",
        filePath: tasks.tasksPath,
        column,
        completed,
      });
    }
  };

  const handleApproveSessions = () => {
    if (tasks?.tasksPath) {
      send({ type: "afxApproveSessions", filePath: tasks.tasksPath });
    }
  };

  const handleSessionBulkAction = (action: DocumentSessionBulkAction) => {
    if (action.type === "approve") {
      handleApproveSessions();
      return;
    }
    handleToggleAllSessions(action.column, action.completed);
  };

  const openChatCommand = (command: string) => {
    send({ type: "afxOpenChatCommand", command, mode: "insert" });
  };

  // Visible columns
  const visibleColumns = ALL_COLUMNS.filter((c) => visible[c]);
  const activeColumns = focusedColumn && visible[focusedColumn] ? [focusedColumn] : visibleColumns;

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
      {activeColumns.length === 0 ? (
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
          <div className="flex h-full min-w-full gap-2" data-testid="workbench-column-rail">
            {activeColumns.map((colId) => (
              <div
                key={colId}
                data-testid={`workbench-column-${colId}`}
                className="afx-surface-card afx-workbench-column-card group/column relative flex h-full min-w-0 flex-col overflow-hidden rounded-xl border border-border/60 bg-background shadow-[0_1px_0_rgba(255,255,255,0.04),0_8px_24px_rgba(0,0,0,0.10)]"
                style={{
                  flexBasis: activeColumns.length === 1 ? "100%" : `${columnWidths[colId]}px`,
                  flexGrow: 1,
                  flexShrink: 0,
                  minWidth: activeColumns.length === 1 ? 0 : MIN_COLUMN_WIDTH,
                }}
              >
                {colId === "spec" && row ? (
                  <ColumnDoc
                    colId="spec"
                    content={row.specPath ? content[row.specPath] : undefined}
                    docPath={row.specPath}
                    featureName={row.name}
                    status={row.specStatus}
                    onCommand={openChatCommand}
                    reading={reading}
                    focused={focusedColumn === "spec"}
                    onReadingChange={updateReading}
                    onToggleFocus={() => toggleColumnFocus("spec")}
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
                    reading={reading}
                    focused={focusedColumn === "design"}
                    onReadingChange={updateReading}
                    onToggleFocus={() => toggleColumnFocus("design")}
                    onOpen={() =>
                      row.designPath &&
                      send({ type: "afxOpenFile", path: row.designPath, mode: "preview" })
                    }
                  />
                ) : colId === "tasks" && tasks ? (
                  <ColumnDoc
                    colId="tasks"
                    content={tasks.tasksPath ? content[tasks.tasksPath] : undefined}
                    docPath={tasks.tasksPath}
                    featureName={tasks.name}
                    status={`${tasks.completed}/${tasks.total}`}
                    onCommand={openChatCommand}
                    onCheckboxToggle={handleMarkdownCheckboxToggle}
                    onSessionBulkAction={handleSessionBulkAction}
                    reading={reading}
                    focused={focusedColumn === "tasks"}
                    onReadingChange={updateReading}
                    onToggleFocus={() => toggleColumnFocus("tasks")}
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
                    reading={reading}
                    focused={focusedColumn === "tasks"}
                    onReadingChange={updateReading}
                    onToggleFocus={() => toggleColumnFocus("tasks")}
                    onOpen={() =>
                      row.tasksPath &&
                      send({ type: "afxOpenFile", path: row.tasksPath, mode: "preview" })
                    }
                  />
                ) : colId === "sessions" && tasks ? (
                  <ColumnSessions
                    content={tasks.tasksPath ? content[tasks.tasksPath] : undefined}
                    docPath={tasks.tasksPath}
                    featureName={tasks.name}
                    onCheckboxToggle={handleMarkdownCheckboxToggle}
                    onSessionBulkAction={handleSessionBulkAction}
                    reading={reading}
                    focused={focusedColumn === "sessions"}
                    onReadingChange={updateReading}
                    onToggleFocus={() => toggleColumnFocus("sessions")}
                    onOpen={() =>
                      row?.tasksPath &&
                      send({ type: "afxOpenFile", path: row.tasksPath, mode: "preview" })
                    }
                  />
                ) : (
                  <div className="flex items-center justify-center p-4 text-sm text-muted-foreground">
                    Select a feature to view {COLUMN_CONFIG[colId].label.toLowerCase()}.
                  </div>
                )}
                {activeColumns.length > 1 ? (
                  <ColumnResizeHandle
                    colId={colId}
                    width={columnWidths[colId]}
                    onResize={resizeColumn}
                  />
                ) : null}
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
