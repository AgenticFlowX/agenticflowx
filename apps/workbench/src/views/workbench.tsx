/**
 * Workbench view — feature-scoped thinking desk (spec / design / tasks / sessions).
 *
 * Features:
 * - Feature selector with progress bar
 * - SDD Studio overview, focus, and compare modes
 * - Paper-style reading cards that keep a readable measure in compact and zen layouts
 * - Tasks view with phase headers
 * - Sessions view with agent/human toggles
 * - Document-status indicators in footer
 *
 * @see docs/specs/227-app-workbench-shell/spec.md [FR-6] [FR-7] [FR-12]
 * @see docs/specs/227-app-workbench-shell/design.md [DES-SHELL-SDD-STUDIO] [DES-SHELL-FEATURE-COLUMNS]
 */
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  AlertTriangle,
  BadgeCheck,
  CheckCircle2,
  ChevronDown,
  Circle,
  Code2,
  Eye,
  EyeOff,
  FileText,
  Focus,
  GitBranch,
  History,
  Layout,
  ListTree,
  MessagesSquare,
  Minimize2,
  PanelTop,
  Search,
  SlidersHorizontal,
  Sparkles,
  StickyNote,
  Target,
} from "lucide-react";

import { type DocumentRow, type FeatureTasksData, type PipelineRow } from "@afx/shared";
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
import { type WorkSessionSignoffSummary, summarizeWorkSessionSignoffs } from "../lib/work-sessions";

type ColumnId = "spec" | "design" | "tasks" | "sessions";
type StudioMode = "studio" | "focus" | "compare";
type StudioRole = "coach" | "architect" | "dev" | "ship";

interface StudioAction {
  label: string;
  description: string;
  command?: string;
  filePath?: string;
  focusDoc?: ColumnId;
}

interface StudioSignal {
  tone: "success" | "warning" | "danger" | "info";
  label: string;
  detail: string;
  action?: StudioAction;
}

const COLUMN_CONFIG: Record<ColumnId, { label: string; icon: typeof StickyNote; accent: string }> =
  {
    spec: { label: "SPEC", icon: StickyNote, accent: "text-afx-brand" },
    design: { label: "DESIGN", icon: FileText, accent: "text-purple-400" },
    tasks: { label: "TASKS", icon: GitBranch, accent: "text-afx-success" },
    sessions: { label: "SESSIONS", icon: History, accent: "text-muted-foreground" },
  };

const ALL_COLUMNS: ColumnId[] = ["spec", "design", "tasks", "sessions"];

const defaultVisible: Record<ColumnId, boolean> = {
  spec: true,
  design: true,
  tasks: true,
  sessions: false,
};

const COLUMN_WIDTH_STORAGE_KEY = "afx.workbench.columnWidths.v1";
const STUDIO_STATE_STORAGE_KEY = "afx.workbench.sddStudio.v1";
const RECENT_FEATURE_STORAGE_KEY = "afx.workbench.recentFeatures.v1";
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

interface StudioUiState {
  mode: StudioMode;
  focusDoc: ColumnId;
}

interface RecentFeatureRecord {
  name: string;
  timestamp: string;
}

interface RecentFeatureOption {
  row: PipelineRow;
  meta: string;
  source: "opened" | "modified";
}

function isColumnId(value: unknown): value is ColumnId {
  return typeof value === "string" && ALL_COLUMNS.includes(value as ColumnId);
}

function isStudioMode(value: unknown): value is StudioMode {
  return value === "studio" || value === "focus" || value === "compare";
}

function readStudioUiState(): StudioUiState {
  try {
    const raw = globalThis.localStorage?.getItem(STUDIO_STATE_STORAGE_KEY);
    if (!raw) return { mode: "studio", focusDoc: "spec" };
    const parsed = JSON.parse(raw) as Partial<StudioUiState>;
    return {
      mode: isStudioMode(parsed.mode) ? parsed.mode : "studio",
      focusDoc: isColumnId(parsed.focusDoc) ? parsed.focusDoc : "spec",
    };
  } catch {
    return { mode: "studio", focusDoc: "spec" };
  }
}

function writeStudioUiState(state: StudioUiState): void {
  try {
    globalThis.localStorage?.setItem(STUDIO_STATE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage unavailable - studio mode stays in-memory only.
  }
}

function readRecentFeatureRecords(): RecentFeatureRecord[] {
  try {
    const raw = globalThis.localStorage?.getItem(RECENT_FEATURE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is RecentFeatureRecord =>
        Boolean(
          item &&
          typeof item === "object" &&
          typeof (item as RecentFeatureRecord).name === "string" &&
          typeof (item as RecentFeatureRecord).timestamp === "string",
        ),
      )
      .slice(0, 6);
  } catch {
    return [];
  }
}

function writeRecentFeatureRecords(records: RecentFeatureRecord[]): void {
  try {
    globalThis.localStorage?.setItem(
      RECENT_FEATURE_STORAGE_KEY,
      JSON.stringify(records.slice(0, 6)),
    );
  } catch {
    // localStorage unavailable - recent feature shortcuts stay in-memory only.
  }
}

function withRecentFeature(records: RecentFeatureRecord[], name: string): RecentFeatureRecord[] {
  return [
    { name, timestamp: new Date().toISOString() },
    ...records.filter((item) => item.name !== name),
  ].slice(0, 6);
}

function featureNameFromSpecPath(filePath: string): string | null {
  const match = /(?:^|\/)docs\/specs\/(.+)\/(?:spec|[^/]+)\.md$/i.exec(filePath);
  return match?.[1] ?? null;
}

function formatRelativeAge(value: string | undefined, prefix: string): string {
  if (!value) return prefix;
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return prefix;
  const diffMs = Math.max(0, Date.now() - time);
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return `${prefix} now`;
  if (minutes < 60) return `${prefix} ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${prefix} ${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${prefix} ${days}d ago`;
  const months = Math.floor(days / 30);
  return `${prefix} ${months}mo ago`;
}

function recentFeatureOptions(
  pipeline: PipelineRow[],
  documents: DocumentRow[],
  records: RecentFeatureRecord[],
): RecentFeatureOption[] {
  const byName = new Map(pipeline.map((row) => [row.name, row]));
  const added = new Set<string>();
  const options: RecentFeatureOption[] = [];

  for (const record of records) {
    const row = byName.get(record.name);
    if (!row || added.has(row.name)) continue;
    options.push({
      row,
      source: "opened",
      meta: formatRelativeAge(record.timestamp, "Opened"),
    });
    added.add(row.name);
  }

  const specDocs = documents
    .filter((doc) => doc.type.toUpperCase() === "SPEC")
    .slice()
    .sort((a, b) => (Date.parse(b.updatedAt ?? "") || 0) - (Date.parse(a.updatedAt ?? "") || 0));

  for (const doc of specDocs) {
    const featureName = featureNameFromSpecPath(doc.filePath);
    const row = featureName ? byName.get(featureName) : undefined;
    if (!row || added.has(row.name)) continue;
    options.push({
      row,
      source: "modified",
      meta: formatRelativeAge(doc.updatedAt, "Modified"),
    });
    added.add(row.name);
    if (options.length >= 4) break;
  }

  return options.slice(0, 4);
}

function columnDisplayLabel(id: ColumnId): string {
  switch (id) {
    case "spec":
      return "Spec";
    case "design":
      return "Design";
    case "tasks":
      return "Tasks";
    case "sessions":
      return "Sessions";
  }
}

/**
 * Renders one [Workbench.ColumnToggle] button in the SDD Studio compare toolbar.
 *
 * @see docs/specs/227-app-workbench-shell/spec.md [FR-6]
 * @see docs/specs/227-app-workbench-shell/design.md [DES-SHELL-FEATURE-COLUMNS]
 */
function ColumnToggle({
  id,
  visible,
  onToggle,
}: {
  id: ColumnId;
  visible: boolean;
  onToggle: () => void;
}) {
  const config = COLUMN_CONFIG[id];
  const label = columnDisplayLabel(id);

  const Icon = visible ? Eye : EyeOff;
  const toggleLabel = `${visible ? "Hide" : "Show"} ${label} document column`;

  return (
    <Button
      variant="outline"
      size="xs"
      onClick={onToggle}
      className={cn(
        "afx-sdd-column-toggle !h-7 min-w-[4.25rem] justify-center gap-1.5 rounded-sm border !px-2 font-mono !text-[10px] !font-medium leading-none shadow-none transition-colors hover:border-border hover:bg-background hover:text-foreground hover:shadow-sm",
        visible
          ? `border-border/70 bg-background/75 ${config.accent}`
          : "border-transparent bg-transparent text-muted-foreground hover:border-border/70 hover:bg-background hover:text-foreground",
      )}
      aria-pressed={visible}
      aria-label={toggleLabel}
      title={toggleLabel}
    >
      <Icon size={12} className="shrink-0" />
      <span className="truncate text-[11px] font-medium">{label}</span>
    </Button>
  );
}

/**
 * Renders the compact [Workbench.SDDStudioHeader] orientation and mode switcher.
 *
 * @see docs/specs/227-app-workbench-shell/spec.md [FR-6] [FR-12]
 * @see docs/specs/227-app-workbench-shell/design.md [DES-SHELL-SDD-STUDIO]
 */
function SddStudioHeader({
  pipeline,
  documents,
  recentFeatureRecords,
  row,
  tasks,
  featureName,
  featurePct,
  mode,
  onSelectFeature,
  onModeChange,
}: {
  pipeline: PipelineRow[];
  documents: DocumentRow[];
  recentFeatureRecords: RecentFeatureRecord[];
  row: PipelineRow | undefined;
  tasks: FeatureTasksData | undefined;
  featureName: string | null;
  featurePct: number;
  mode: StudioMode;
  onSelectFeature: (feature: string) => void;
  onModeChange: (mode: StudioMode) => void;
}) {
  const title = row ? titleFromFeatureName(row.name) : "Choose a feature";
  const [pickerOpen, setPickerOpen] = useState(false);
  const [featureQuery, setFeatureQuery] = useState("");
  const pickerRef = useRef<HTMLDivElement>(null);
  const status = row?.featureStatus || row?.specStatus || "Draft";
  const taskSummary = tasks
    ? `${tasks.completed}/${tasks.total} tasks`
    : row
      ? `${row.completed}/${row.total} tasks`
      : "No tasks";
  const showFeatureSearch = pipeline.length > 6;
  const filteredPipeline = useMemo(() => {
    const q = featureQuery.trim().toLowerCase();
    if (!showFeatureSearch || !q) return pipeline;
    return pipeline.filter((p) =>
      `${titleFromFeatureName(p.name)} ${p.name} ${p.featureStatus ?? ""}`
        .toLowerCase()
        .includes(q),
    );
  }, [featureQuery, pipeline, showFeatureSearch]);
  const recentOptions = useMemo(
    () => recentFeatureOptions(pipeline, documents, recentFeatureRecords),
    [documents, pipeline, recentFeatureRecords],
  );

  useEffect(() => {
    if (!pickerOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node) || pickerRef.current?.contains(target)) return;
      setPickerOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPickerOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [pickerOpen]);

  useEffect(() => {
    // Clear a stale filter once the picker closes so reopening starts fresh.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot reset tied to open/close
    if (!pickerOpen) setFeatureQuery("");
  }, [pickerOpen]);

  return (
    <section
      className="shrink-0 border-b border-border bg-background/95 px-2 py-1.5 shadow-[0_1px_0_rgba(255,255,255,0.05)]"
      data-afx-sdd-studio="header"
    >
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <div ref={pickerRef} className="relative flex min-w-[16rem] flex-1 items-center gap-2">
          <button
            type="button"
            aria-label="Select SDD feature"
            aria-haspopup="listbox"
            aria-expanded={pickerOpen}
            aria-controls="sdd-feature-picker-list"
            onClick={() => setPickerOpen((open) => !open)}
            className={cn(
              "group relative flex h-12 min-w-[14rem] max-w-[28rem] flex-1 items-center justify-between overflow-hidden rounded-md border border-border/70 bg-background/80 px-3 py-2 text-left shadow-sm transition-colors hover:border-afx-brand/45 hover:bg-background focus-visible:border-afx-brand/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-afx-brand/40",
              pickerOpen && "border-afx-brand/55 bg-background shadow-md",
            )}
            data-testid="sdd-feature-picker"
          >
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
                Current feature
              </span>
              <span className="min-w-0 truncate text-sm font-semibold text-foreground">
                {title}
              </span>
            </span>
            <span
              className="ml-3 hidden shrink-0 items-center gap-1.5 text-[10px] text-muted-foreground sm:flex"
              aria-label="Feature summary"
              data-testid="sdd-feature-summary"
            >
              <span className="rounded-sm border border-border/70 bg-muted/30 px-1.5 py-0.5 font-mono">
                <span className="sr-only">Status </span>
                {status}
              </span>
              <span className="rounded-sm border border-border/70 bg-muted/30 px-1.5 py-0.5 font-mono">
                <span className="sr-only">Tasks </span>
                {taskSummary}
              </span>
            </span>
            <ChevronDown
              size={15}
              className={cn(
                "ml-2 shrink-0 text-muted-foreground transition-transform group-hover:text-foreground",
                pickerOpen && "rotate-180 text-foreground",
              )}
              aria-hidden
            />
            <Progress
              value={featurePct}
              aria-label="Feature progress"
              className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 rounded-none bg-afx-brand/25 [&_[data-slot=progress-indicator]]:bg-afx-brand"
            />
          </button>
          {pickerOpen ? (
            <div
              id="sdd-feature-picker-list"
              role="listbox"
              aria-label="Select SDD feature"
              className="absolute left-0 top-[calc(100%+0.25rem)] z-50 max-h-[min(22rem,calc(100vh-8rem))] w-[min(44rem,calc(100vw-1rem))] overflow-y-auto rounded-md border border-border bg-popover p-1.5 text-popover-foreground shadow-xl"
            >
              <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_14rem]">
                <div className="min-w-0">
                  <div className="px-2 pb-1 pt-1 font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
                    Switch feature
                  </div>
                  {showFeatureSearch ? (
                    <label className="mb-1 flex h-8 min-w-0 items-center gap-2 rounded-sm border border-border/70 bg-background/70 px-2 text-muted-foreground focus-within:border-afx-brand/45 focus-within:text-foreground">
                      <Search size={12} className="shrink-0" aria-hidden />
                      <input
                        aria-label="Filter SDD features"
                        value={featureQuery}
                        onChange={(event) => setFeatureQuery(event.target.value)}
                        placeholder="Search features"
                        className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground/70"
                      />
                    </label>
                  ) : null}
                  {filteredPipeline.map((p) => (
                    <button
                      key={p.name}
                      type="button"
                      role="option"
                      aria-selected={p.name === featureName}
                      className={cn(
                        "flex w-full min-w-0 items-center gap-3 rounded-sm border border-transparent px-2 py-2 text-left text-xs transition-colors hover:border-border/70 hover:bg-muted/45 focus-visible:border-afx-brand/45 focus-visible:bg-muted/45 focus-visible:outline-none",
                        p.name === featureName && "border-afx-brand/35 bg-afx-brand/10",
                      )}
                      onClick={() => {
                        onSelectFeature(p.name);
                        setPickerOpen(false);
                      }}
                    >
                      <span
                        className={cn(
                          "size-2 shrink-0 rounded-full",
                          p.featureStatus === "Living" ? "bg-afx-brand" : "bg-muted-foreground/60",
                        )}
                        aria-hidden
                      />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate font-medium text-foreground">
                          {titleFromFeatureName(p.name)}
                        </span>
                        <span className="truncate font-mono text-[10px] text-muted-foreground">
                          {p.featureStatus || "Draft"} · {p.completed}/{p.total} tasks
                        </span>
                      </span>
                      {p.name === featureName ? (
                        <CheckCircle2 size={14} className="shrink-0 text-afx-brand" aria-hidden />
                      ) : null}
                    </button>
                  ))}
                  {filteredPipeline.length === 0 ? (
                    <p className="px-2 py-4 text-center text-xs text-muted-foreground">
                      No matching features.
                    </p>
                  ) : null}
                </div>
                {recentOptions.length > 0 ? (
                  <div
                    className="min-w-0 rounded-sm border border-border/70 bg-background/55 p-1.5"
                    aria-label="Recent specs"
                  >
                    <div className="px-1 pb-1 font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
                      Recent specs
                    </div>
                    <div className="flex min-w-0 flex-col gap-1">
                      {recentOptions.map((option) => (
                        <button
                          key={`${option.source}-${option.row.name}`}
                          type="button"
                          aria-label={`Open recent spec ${titleFromFeatureName(option.row.name)}`}
                          className="flex min-w-0 flex-col rounded-sm border border-transparent px-2 py-1.5 text-left text-xs transition-colors hover:border-afx-brand/35 hover:bg-afx-brand/10 focus-visible:border-afx-brand/45 focus-visible:outline-none"
                          onClick={() => {
                            onSelectFeature(option.row.name);
                            setPickerOpen(false);
                          }}
                        >
                          <span className="truncate font-medium text-foreground">
                            {titleFromFeatureName(option.row.name)}
                          </span>
                          <span className="truncate font-mono text-[10px] text-muted-foreground">
                            {option.meta}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        <StudioModeSwitch mode={mode} onModeChange={onModeChange} />
      </div>
    </section>
  );
}

function StudioModeSwitch({
  mode,
  onModeChange,
}: {
  mode: StudioMode;
  onModeChange: (mode: StudioMode) => void;
}) {
  const modes: Array<{ id: StudioMode; label: string; icon: typeof Sparkles }> = [
    { id: "studio", label: "Overview", icon: Sparkles },
    { id: "focus", label: "Focus doc", icon: PanelTop },
    { id: "compare", label: "Compare docs", icon: Layout },
  ];

  return (
    <div
      className="ml-auto flex min-w-0 shrink-0 items-center gap-1 rounded-md border border-border/70 bg-background/60 p-0.5 pl-2"
      role="group"
      aria-label="SDD Studio view mode"
    >
      <span className="shrink-0 pr-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
        View mode
      </span>
      {modes.map((item) => {
        const Icon = item.icon;
        const selected = mode === item.id;
        return (
          <Button
            key={item.id}
            type="button"
            variant={selected ? "outline" : "ghost"}
            size="xs"
            className={cn(
              "h-6 gap-1 rounded-sm px-2 text-[10px] whitespace-nowrap",
              selected
                ? "border-afx-brand/45 bg-afx-brand/10 text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-background hover:text-foreground",
            )}
            aria-pressed={selected}
            onClick={() => onModeChange(item.id)}
          >
            <Icon size={11} aria-hidden />
            {item.label}
          </Button>
        );
      })}
    </div>
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
  showPath = false,
  controls,
}: {
  colId: ColumnId;
  status: string;
  onOpen: () => void;
  docPath?: string;
  showPath?: boolean;
  controls?: ReactNode;
}) {
  const config = COLUMN_CONFIG[colId];
  const Icon = config.icon;
  const label = columnDisplayLabel(colId);

  return (
    <header className="afx-surface-toolbar flex min-w-0 items-center justify-between gap-2 border-b border-border px-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <div
          className={`flex size-5 shrink-0 items-center justify-center rounded-full bg-current/10 ${config.accent}`}
        >
          <Icon size={12} />
        </div>
        <span className="truncate text-xs font-semibold text-foreground">{label}</span>
        {status && (
          <Badge variant="outline" className="shrink-0 text-[10px]">
            {status}
          </Badge>
        )}
      </div>
      {docPath && showPath ? (
        <div className="hidden min-w-0 flex-1 justify-center px-2 sm:flex">
          <span
            className="min-w-0 truncate rounded-sm border border-border/60 bg-muted/20 px-2 py-0.5 font-mono text-[10px] text-muted-foreground"
            title={docPath}
          >
            {docPath}
          </span>
        </div>
      ) : (
        <div className="min-w-0 flex-1" />
      )}
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
        showPath={focused}
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
        showPath={focused}
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

function docPathForColumn(
  colId: ColumnId,
  row: PipelineRow | undefined,
  tasks: FeatureTasksData | undefined,
): string | undefined {
  if (colId === "spec") return row?.specPath;
  if (colId === "design") return row?.designPath;
  if (colId === "tasks") return tasks?.tasksPath ?? row?.tasksPath;
  return tasks?.tasksPath ?? row?.tasksPath;
}

function docStatusForColumn(
  colId: ColumnId,
  row: PipelineRow | undefined,
  tasks: FeatureTasksData | undefined,
  sessionSummary: WorkSessionSignoffSummary | null,
): string {
  if (colId === "spec") return row?.specStatus || "Missing";
  if (colId === "design") return row?.designStatus || "Missing";
  if (colId === "tasks") {
    if (tasks) return `${tasks.completed}/${tasks.total}`;
    return row?.tasksStatus || "Missing";
  }
  if (sessionSummary) return `${sessionSummary.humanChecked}/${sessionSummary.total}`;
  return docPathForColumn("sessions", row, tasks) ? "Pending" : "Missing";
}

function isPositiveStatus(status: string | undefined): boolean {
  return /^(approved|living|stable|complete|completed)$/i.test(status ?? "");
}

function statusDotClass(status: string): string {
  if (isPositiveStatus(status) || /^\d+\/\d+$/.test(status)) return "bg-afx-success";
  if (/draft|progress|pending/i.test(status)) return "bg-amber-400";
  if (/missing|blocked/i.test(status)) return "bg-destructive";
  return "bg-muted-foreground";
}

function studioDocumentInfos({
  row,
  tasks,
  sessionSummary,
}: {
  row: PipelineRow | undefined;
  tasks: FeatureTasksData | undefined;
  sessionSummary: WorkSessionSignoffSummary | null;
}): Array<{
  id: ColumnId;
  label: string;
  role: string;
  status: string;
  detail: string;
  path?: string;
  createCommand?: string;
}> {
  const featureName = row?.name ?? tasks?.name ?? "";
  return [
    {
      id: "spec",
      label: "Spec",
      role: "Coach",
      status: docStatusForColumn("spec", row, tasks, sessionSummary),
      detail: row?.specPath
        ? "Coach uses this to refine problem, users, and outcomes."
        : "Start product intent, users, and outcomes.",
      path: row?.specPath,
      createCommand: `/afx-spec new ${featureName}`,
    },
    {
      id: "design",
      label: "Design",
      role: "Architect",
      status: docStatusForColumn("design", row, tasks, sessionSummary),
      detail: row?.designPath
        ? "Architect uses this to inspect tradeoffs and gaps."
        : "Author architecture after the spec is ready.",
      path: row?.designPath,
      createCommand: `/afx-design author ${featureName}`,
    },
    {
      id: "tasks",
      label: "Tasks",
      role: "Dev",
      status: docStatusForColumn("tasks", row, tasks, sessionSummary),
      detail: tasks?.total
        ? `Dev uses this to pick ${Math.max(0, tasks.total - tasks.completed)} open task${tasks.total - tasks.completed === 1 ? "" : "s"}.`
        : "Plan implementation slices for the dev loop.",
      path: tasks?.tasksPath ?? row?.tasksPath,
      createCommand: `/afx-task plan ${featureName}`,
    },
    {
      id: "sessions",
      label: "Sessions",
      role: "Ship",
      status: docStatusForColumn("sessions", row, tasks, sessionSummary),
      detail: sessionSummary
        ? `Ship uses this to verify ${sessionSummary.approvable} pending signoff${sessionSummary.approvable === 1 ? "" : "s"}.`
        : "Ship uses this for proof and verification trail.",
      path: tasks?.tasksPath ?? row?.tasksPath,
      createCommand: `/afx-session capture --links ${featureName} work-session`,
    },
  ];
}

function studioNextAction({
  row,
  tasks,
  sessionSummary,
}: {
  row: PipelineRow | undefined;
  tasks: FeatureTasksData | undefined;
  sessionSummary: WorkSessionSignoffSummary | null;
}): StudioAction {
  const featureName = row?.name ?? tasks?.name ?? "";
  if (!row?.specPath) {
    return {
      label: "Start spec",
      description: "Create the product intent and requirements first.",
      command: `/afx-spec new ${featureName}`,
    };
  }
  if (!isPositiveStatus(row.specStatus)) {
    return {
      label: "Refine spec",
      description: "Tighten the spec before moving deeper into design or tasks.",
      command: `/afx-spec refine ${featureName}`,
      focusDoc: "spec",
    };
  }
  if (!row.designPath) {
    return {
      label: "Author design",
      description: "Turn the approved spec into architecture and tradeoffs.",
      command: `/afx-design author ${featureName}`,
    };
  }
  if (!isPositiveStatus(row.designStatus)) {
    return {
      label: "Review design",
      description: "Check architecture gaps before implementation planning.",
      command: `/afx-design review ${featureName}`,
      focusDoc: "design",
    };
  }
  if (!row.tasksPath && !tasks?.tasksPath) {
    return {
      label: "Plan tasks",
      description: "Create implementation slices from the design.",
      command: `/afx-task plan ${featureName}`,
    };
  }
  if (tasks && tasks.completed < tasks.total) {
    return {
      label: "Continue tasks",
      description: `${tasks.total - tasks.completed} task${tasks.total - tasks.completed === 1 ? "" : "s"} still open.`,
      command: `/afx-task code ${featureName}`,
      focusDoc: "tasks",
    };
  }
  if (sessionSummary && sessionSummary.humanChecked < sessionSummary.total) {
    return {
      label: "Verify sessions",
      description: "Human signoff is still pending for completed work.",
      focusDoc: "sessions",
    };
  }
  return {
    label: "Capture proof",
    description: "Everything looks complete. Preserve the final proof and decisions.",
    command: `/afx-session capture --links ${featureName} implementation-proof`,
    focusDoc: "sessions",
  };
}

function studioSignals({
  row,
  tasks,
  sessionSummary,
  content,
}: {
  row: PipelineRow | undefined;
  tasks: FeatureTasksData | undefined;
  sessionSummary: WorkSessionSignoffSummary | null;
  content: Record<string, string>;
}): StudioSignal[] {
  const featureName = row?.name ?? tasks?.name ?? "";
  const signals: StudioSignal[] = [];

  if (!row?.specPath) {
    signals.push({
      tone: "danger",
      label: "Spec missing",
      detail: "No source-of-truth requirements document yet.",
      action: {
        label: "Create spec",
        description: "Create the spec.",
        command: `/afx-spec new ${featureName}`,
      },
    });
  } else if (!isPositiveStatus(row.specStatus)) {
    signals.push({
      tone: "warning",
      label: "Spec needs refinement",
      detail: row.specStatus || "Draft",
      action: {
        label: "Refine spec",
        description: "Draft a spec refinement command.",
        command: `/afx-spec refine ${featureName}`,
        focusDoc: "spec",
      },
    });
  }

  if (row?.designPath && !isPositiveStatus(row.designStatus)) {
    signals.push({
      tone: "warning",
      label: "Design review pending",
      detail: row.designStatus || "Draft",
      action: {
        label: "Review design",
        description: "Ask AFX to review the design.",
        command: `/afx-design review ${featureName}`,
        focusDoc: "design",
      },
    });
  }

  if (tasks && tasks.completed < tasks.total) {
    signals.push({
      tone: "info",
      label: "Open implementation work",
      detail: `${tasks.total - tasks.completed} task${tasks.total - tasks.completed === 1 ? "" : "s"} remaining`,
      action: {
        label: "Open tasks",
        description: "Focus the task document.",
        focusDoc: "tasks",
      },
    });
  }

  const specContent = row?.specPath ? content[row.specPath] : "";
  const designContent = row?.designPath ? content[row.designPath] : "";
  const combined = `${specContent}\n${designContent}`;
  if (/open\s+questions?/i.test(combined)) {
    signals.push({
      tone: "warning",
      label: "Questions to resolve",
      detail: "Open Questions section detected.",
      action: {
        label: "Refine questions",
        description: "Draft an open-question refinement.",
        command: `/afx-spec refine ${featureName} open questions`,
        focusDoc: "spec",
      },
    });
  }

  if (sessionSummary && sessionSummary.approvable > 0) {
    signals.push({
      tone: "warning",
      label: "Journal/signoff nudge",
      detail: `${sessionSummary.approvable} session${sessionSummary.approvable === 1 ? "" : "s"} ready for human signoff`,
      action: {
        label: "Verify sessions",
        description: "Review the work-session table.",
        focusDoc: "sessions",
      },
    });
  }

  if (signals.length === 0) {
    signals.push({
      tone: "success",
      label: "All clear",
      detail: "Spec, design, tasks, and proof are ready for review.",
    });
  }

  return signals.slice(0, 5);
}

function signalIcon(tone: StudioSignal["tone"]) {
  if (tone === "success") return CheckCircle2;
  if (tone === "danger") return AlertTriangle;
  if (tone === "warning") return AlertTriangle;
  return Circle;
}

function signalToneClass(tone: StudioSignal["tone"]): string {
  if (tone === "success") return "border-afx-success/30 bg-afx-success/8 text-afx-success";
  if (tone === "danger") return "border-destructive/35 bg-destructive/8 text-destructive";
  if (tone === "warning") return "border-amber-400/35 bg-amber-400/8 text-amber-300";
  return "border-afx-brand/25 bg-afx-brand/8 text-afx-brand-soft";
}

const SIGNAL_PRIORITY: Record<StudioSignal["tone"], number> = {
  danger: 0,
  warning: 1,
  info: 2,
  success: 3,
};

function signalPriorityLabel(tone: StudioSignal["tone"]): string {
  if (tone === "danger") return "Blocker";
  if (tone === "warning") return "Next";
  if (tone === "success") return "Clear";
  return "Watch";
}

/**
 * Renders the SDD Studio overview workspace for next work, role modes, and active docs.
 *
 * @see docs/specs/227-app-workbench-shell/spec.md [FR-12]
 * @see docs/specs/227-app-workbench-shell/design.md [DES-SHELL-SDD-STUDIO]
 */
function SddStudioCockpit({
  row,
  tasks,
  sessionSummary,
  signals,
  nextAction,
  onAction,
  onFocusDoc,
  onOpenFile,
}: {
  row: PipelineRow | undefined;
  tasks: FeatureTasksData | undefined;
  sessionSummary: WorkSessionSignoffSummary | null;
  signals: StudioSignal[];
  nextAction: StudioAction;
  onAction: (action: StudioAction) => void;
  onFocusDoc: (doc: ColumnId) => void;
  onOpenFile: (path: string) => void;
}) {
  const docs = studioDocumentInfos({ row, tasks, sessionSummary });

  return (
    <div
      className="min-h-0 flex-1 overflow-auto p-2"
      data-testid="sdd-studio-cockpit"
      data-afx-sdd-studio="cockpit"
    >
      <div className="grid min-h-full min-w-[720px] grid-cols-[12rem_minmax(0,1fr)] gap-2">
        <div className="flex min-h-0 min-w-0 flex-col gap-2">
          <StudioPanel
            title="Workflow"
            icon={Target}
            description="Follow the artifact chain from intent to proof."
            className="shrink-0"
          >
            <WorkflowRail docs={docs} activeDoc={null} onFocusDoc={onFocusDoc} />
          </StudioPanel>

          <StudioPanel
            title="Needs attention"
            icon={BadgeCheck}
            description="Blockers, questions, and proof checks."
            className="min-h-0 flex-1"
          >
            <SignalPanel signals={signals} onAction={onAction} compact />
          </StudioPanel>
        </div>

        <div className="grid min-h-0 min-w-0 grid-rows-[auto_auto_minmax(0,1fr)] gap-2">
          <StudioPanel
            title="Next work"
            icon={Sparkles}
            description="Best next step for this feature."
          >
            <div className="flex min-w-0 flex-col gap-3">
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-foreground">
                  {nextAction.label}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {nextAction.description}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Button
                  type="button"
                  size="xs"
                  className="h-7 gap-1.5 rounded-sm"
                  onClick={() => onAction(nextAction)}
                >
                  <Sparkles size={12} aria-hidden />
                  {nextAction.label}
                </Button>
                {nextAction.focusDoc ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    className="h-7 rounded-sm"
                    onClick={() => onFocusDoc(nextAction.focusDoc!)}
                  >
                    Focus {columnDisplayLabel(nextAction.focusDoc)}
                  </Button>
                ) : null}
              </div>
            </div>
          </StudioPanel>

          <StudioPanel
            title="Role modes"
            icon={MessagesSquare}
            description="Pick how you want to think."
          >
            <RoleModeGrid featureName={row?.name ?? tasks?.name ?? ""} onAction={onAction} />
          </StudioPanel>

          <div className="min-h-0 min-w-0">
            <StudioPanel
              title="Active docs"
              icon={FileText}
              description="Open the artifact that matches the role you are playing."
            >
              <div className="grid grid-cols-2 gap-1.5 xl:grid-cols-4">
                {docs.map((doc) => (
                  <ActiveDocCard
                    key={doc.id}
                    doc={doc}
                    onFocus={() => onFocusDoc(doc.id)}
                    onOpen={() => doc.path && onOpenFile(doc.path)}
                    onCreate={() =>
                      doc.createCommand &&
                      onAction({
                        label: `Create ${doc.label}`,
                        description: doc.detail,
                        command: doc.createCommand,
                      })
                    }
                  />
                ))}
              </div>
            </StudioPanel>
          </div>
        </div>
      </div>
    </div>
  );
}

function StudioPanel({
  title,
  icon: Icon,
  children,
  description,
  className,
}: {
  title: string;
  icon: typeof StickyNote;
  children: ReactNode;
  description?: string;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "afx-surface-card flex min-h-0 min-w-0 flex-col gap-3 rounded-lg border border-border/60 bg-background/95 p-3",
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="flex min-w-0 items-center gap-2">
          <Icon size={13} className="shrink-0 text-afx-brand-soft" aria-hidden />
          <h2 className="truncate font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            {title}
          </h2>
        </div>
        {description ? (
          <p className="line-clamp-2 text-[11px] leading-4 text-muted-foreground/85">
            {description}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function WorkflowRail({
  docs,
  activeDoc,
  onFocusDoc,
}: {
  docs: ReturnType<typeof studioDocumentInfos>;
  activeDoc: ColumnId | null;
  onFocusDoc: (doc: ColumnId) => void;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1" role="list" aria-label="SDD workflow sequence">
      {docs.map((doc, index) => {
        const selected = activeDoc === doc.id;
        const final = index === docs.length - 1;
        const positive = isPositiveStatus(doc.status) || /^\d+\/\d+$/.test(doc.status);
        return (
          <div
            key={doc.id}
            role="listitem"
            className="grid min-w-0 grid-cols-[1.75rem_minmax(0,1fr)] items-stretch gap-1.5"
            data-testid={`sdd-workflow-step-${doc.id}`}
          >
            <span className="relative flex justify-center pt-2" aria-hidden>
              {!final ? (
                <span
                  className={cn(
                    "absolute bottom-[-0.25rem] left-1/2 top-7 w-px -translate-x-1/2",
                    positive ? "bg-afx-success/35" : "bg-border/80",
                  )}
                />
              ) : null}
              <span
                className={cn(
                  "relative z-10 grid size-5 place-items-center rounded-full border font-mono text-[9px] shadow-sm",
                  selected
                    ? "border-afx-brand/55 bg-background text-afx-brand-soft ring-2 ring-afx-brand/10"
                    : positive
                      ? "border-afx-success/45 bg-background text-afx-success"
                      : "border-border/80 bg-background text-muted-foreground",
                )}
              >
                {index + 1}
              </span>
            </span>
            <button
              type="button"
              aria-label={`${doc.label} workflow step ${index + 1}: ${doc.status}`}
              onClick={() => onFocusDoc(doc.id)}
              className={cn(
                "flex min-h-14 w-full min-w-0 items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors",
                selected
                  ? "border-afx-brand/50 bg-afx-brand/10 text-foreground"
                  : positive
                    ? "border-afx-success/25 bg-afx-success/5 text-muted-foreground hover:bg-afx-success/10 hover:text-foreground"
                    : "border-border/55 bg-muted/10 text-muted-foreground hover:bg-muted/30 hover:text-foreground",
              )}
            >
              <span className={cn("size-2 shrink-0 rounded-full", statusDotClass(doc.status))} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-medium">{doc.label}</span>
                <span className="block truncate font-mono text-[10px]">{doc.status}</span>
              </span>
            </button>
          </div>
        );
      })}
    </div>
  );
}

function SignalPanel({
  signals,
  onAction,
  compact = false,
}: {
  signals: StudioSignal[];
  onAction: (action: StudioAction) => void;
  compact?: boolean;
}) {
  const orderedSignals = useMemo(
    () => [...signals].sort((a, b) => SIGNAL_PRIORITY[a.tone] - SIGNAL_PRIORITY[b.tone]),
    [signals],
  );

  return (
    <div className="flex min-w-0 flex-col gap-1" data-testid="sdd-coach-signal-queue">
      {orderedSignals.map((signal, index) => {
        const Icon = signalIcon(signal.tone);
        return (
          <div
            key={`${signal.label}-${signal.detail}`}
            className={cn(
              "flex min-w-0 flex-col gap-1 rounded-md border px-2 py-1.5",
              signalToneClass(signal.tone),
            )}
          >
            <div className="flex min-w-0 items-center gap-1.5">
              <span
                className="w-5 shrink-0 font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground"
                aria-hidden
              >
                P{index + 1}
              </span>
              <Icon size={13} className="shrink-0" aria-hidden />
              <p className="min-w-0 flex-1 truncate text-xs font-semibold text-foreground">
                {signal.label}
              </p>
              <span className="shrink-0 rounded-sm border border-current/20 px-1 py-0.5 font-mono text-[8px] uppercase tracking-[0.08em] opacity-80">
                {signalPriorityLabel(signal.tone)}
              </span>
            </div>
            <div className="flex min-w-0 items-center gap-2 pl-[2.125rem]">
              <p className="min-w-0 flex-1 truncate text-[10px] leading-4 text-muted-foreground">
                {signal.detail}
              </p>
              {signal.action ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  className={cn("h-5 shrink-0 rounded-sm px-1.5 text-[10px]", compact && "h-5")}
                  onClick={() => onAction(signal.action!)}
                >
                  {signal.action.label}
                </Button>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RoleModeGrid({
  featureName,
  onAction,
}: {
  featureName: string;
  onAction: (action: StudioAction) => void;
}) {
  const roles: Array<{
    id: StudioRole;
    label: string;
    detail: string;
    icon: typeof Sparkles;
    action: StudioAction;
  }> = [
    {
      id: "coach",
      label: "Coach",
      detail: "Clarify intent and questions.",
      icon: MessagesSquare,
      action: {
        label: "Refine spec",
        description: "Draft a product-coach refinement pass for the spec.",
        command: `/afx-spec refine ${featureName}`,
        focusDoc: "spec",
      },
    },
    {
      id: "architect",
      label: "Architect",
      detail: "Review architecture gaps and tradeoffs.",
      icon: Target,
      action: {
        label: "Review design",
        description: "Draft an architecture review command.",
        command: `/afx-design review ${featureName}`,
        focusDoc: "design",
      },
    },
    {
      id: "dev",
      label: "Dev",
      detail: "Check task status and choose the next slice.",
      icon: Code2,
      action: {
        label: "Check tasks",
        description: "Draft a task status command.",
        command: `/afx-task status ${featureName}`,
        focusDoc: "tasks",
      },
    },
    {
      id: "ship",
      label: "Ship",
      detail: "Verify sessions, proof, and final signoff.",
      icon: BadgeCheck,
      action: {
        label: "Capture proof",
        description: "Draft a final proof capture.",
        command: `/afx-session capture --links ${featureName} proof`,
        focusDoc: "sessions",
      },
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-1.5">
      {roles.map((role) => {
        const Icon = role.icon;
        return (
          <button
            key={role.id}
            type="button"
            className="flex min-w-0 flex-col gap-1 rounded-md border border-border/60 bg-muted/10 p-2 text-left transition-colors hover:border-afx-brand/35 hover:bg-afx-brand/8"
            onClick={() => onAction(role.action)}
          >
            <span className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-foreground">
              <Icon size={12} className="shrink-0 text-afx-brand-soft" aria-hidden />
              {role.label}
            </span>
            <span className="line-clamp-2 text-[11px] leading-4 text-muted-foreground">
              {role.detail}
            </span>
            <span className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-afx-brand-soft">
              {role.action.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function ActiveDocCard({
  doc,
  onFocus,
  onOpen,
  onCreate,
}: {
  doc: ReturnType<typeof studioDocumentInfos>[number];
  onFocus: () => void;
  onOpen: () => void;
  onCreate: () => void;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-md border border-border/60 bg-muted/10 p-2">
      <div className="flex min-w-0 items-center justify-between gap-2">
        <span className="truncate text-xs font-semibold text-foreground">{doc.label}</span>
        <span className={cn("size-2 shrink-0 rounded-full", statusDotClass(doc.status))} />
      </div>
      <p className="truncate font-mono text-[10px] text-muted-foreground">
        {doc.role} surface · {doc.status}
      </p>
      <p className="line-clamp-2 min-h-8 text-[11px] leading-4 text-muted-foreground">
        {doc.detail}
      </p>
      <div className="mt-auto flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="xs"
          className="h-6 rounded-sm"
          onClick={onFocus}
          aria-label={`Focus ${doc.label} for ${doc.role}`}
        >
          Focus
        </Button>
        {doc.path ? (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="h-6 rounded-sm"
            onClick={onOpen}
            aria-label={`Preview ${doc.label}`}
          >
            Preview
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="h-6 rounded-sm"
            onClick={onCreate}
            aria-label={`Create ${doc.label}`}
          >
            Create
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Renders one focused SDD document with the shared workflow and attention rail.
 *
 * @see docs/specs/227-app-workbench-shell/spec.md [FR-12]
 * @see docs/specs/227-app-workbench-shell/design.md [DES-SHELL-SDD-STUDIO]
 */
function SddStudioFocusView({
  docs,
  activeDoc,
  signals,
  renderDocument,
  onFocusDoc,
  onAction,
}: {
  docs: ReturnType<typeof studioDocumentInfos>;
  activeDoc: ColumnId;
  signals: StudioSignal[];
  renderDocument: (doc: ColumnId) => ReactNode;
  onFocusDoc: (doc: ColumnId) => void;
  onAction: (action: StudioAction) => void;
}) {
  return (
    <div
      className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden p-2"
      data-testid="sdd-studio-focus"
      data-afx-sdd-studio="focus"
    >
      <div className="grid h-full min-w-[720px] grid-cols-[12rem_minmax(28rem,1fr)] gap-2">
        <div className="flex min-h-0 min-w-0 flex-col gap-2">
          <StudioPanel
            title="Workflow"
            icon={Target}
            description="Follow the artifact chain from intent to proof."
            className="shrink-0"
          >
            <WorkflowRail docs={docs} activeDoc={activeDoc} onFocusDoc={onFocusDoc} />
          </StudioPanel>
          <StudioPanel
            title="Needs attention"
            icon={BadgeCheck}
            description="Blockers, questions, and proof checks."
            className="min-h-0 flex-1"
          >
            <SignalPanel signals={signals} onAction={onAction} compact />
          </StudioPanel>
        </div>
        <div
          data-testid={`sdd-studio-focus-${activeDoc}`}
          className="afx-surface-card flex h-full min-w-0 flex-col overflow-hidden rounded-xl border border-border/60 bg-background"
        >
          {renderDocument(activeDoc)}
        </div>
      </div>
    </div>
  );
}

function CompareToolbar({
  visible,
  onToggleColumn,
}: {
  visible: Record<ColumnId, boolean>;
  onToggleColumn: (column: ColumnId) => void;
}) {
  return (
    <div className="afx-surface-toolbar flex shrink-0 items-center justify-between gap-2 border-b border-border px-2 py-1.5">
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold text-foreground">Compare documents</p>
        <p className="truncate text-[11px] text-muted-foreground">
          Multi-document view for checking spec, design, tasks, and sessions side by side.
        </p>
      </div>
      <div
        className="flex shrink-0 items-center gap-1"
        data-testid="workbench-column-toggles"
        aria-label="Show or hide SDD Studio compare documents"
      >
        {ALL_COLUMNS.map((colId) => (
          <ColumnToggle
            key={colId}
            id={colId}
            visible={visible[colId]}
            onToggle={() => onToggleColumn(colId)}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Renders one document-status pill (frontmatter status) in the footer.
 *
 * @see docs/specs/227-app-workbench-shell/spec.md [FR-6]
 * @see docs/specs/227-app-workbench-shell/design.md [DES-SHELL-FEATURE-COLUMNS]
 */
function DocStatusIndicator({ label, status }: { label: string; status: string | undefined }) {
  const dotColor =
    status === "Approved" || status === "Stable"
      ? "bg-afx-success"
      : status === "Living"
        ? "bg-afx-brand"
        : "bg-muted-foreground";

  return (
    <span className="flex items-center gap-1.5 text-[10px]">
      <span className={`size-1.5 rounded-full ${dotColor}`} />
      <span className="uppercase tracking-wide">{label}</span>: {status ?? "—"}
    </span>
  );
}

/**
 * Renders the feature-scoped Workbench thinking desk.
 *
 * @see docs/specs/227-app-workbench-shell/spec.md [FR-5] [FR-6] [FR-7] [FR-12]
 * @see docs/specs/227-app-workbench-shell/design.md [DES-SHELL-SDD-STUDIO] [DES-SHELL-FEATURE-COLUMNS]
 */
export default function Workbench() {
  const { pipeline, featureTasks, documents, selectedFeature, selectFeature, send, isLoading } =
    useWorkbench();
  const [content, setContent] = useState<Record<string, string>>({});
  const [visible, setVisible] = useState<Record<ColumnId, boolean>>(defaultVisible);
  const [columnWidths, setColumnWidths] = useState<Record<ColumnId, number>>(readColumnWidths);
  const [reading, setReading] = useState<ReadingPrefs>(readReadingPrefs);
  const initialStudioState = useMemo(() => readStudioUiState(), []);
  const [studioMode, setStudioMode] = useState<StudioMode>(initialStudioState.mode);
  const [focusDoc, setFocusDoc] = useState<ColumnId>(initialStudioState.focusDoc);
  const [recentFeatureRecords, setRecentFeatureRecords] =
    useState<RecentFeatureRecord[]>(readRecentFeatureRecords);

  useEffect(() => {
    writeColumnWidths(columnWidths);
  }, [columnWidths]);

  useEffect(() => {
    writeReadingPrefs(reading);
  }, [reading]);

  useEffect(() => {
    writeStudioUiState({ mode: studioMode, focusDoc });
  }, [focusDoc, studioMode]);

  useEffect(() => {
    if (studioMode !== "focus") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setStudioMode("studio");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [studioMode]);

  useEffect(() => {
    return workbenchOn("afxDocContent", (msg) => {
      setContent((prev) => ({ ...prev, [msg.filePath]: msg.content }));
    });
  }, []);

  const featureName = selectedFeature ?? pipeline[0]?.name ?? null;
  const row = useMemo(() => pipeline.find((p) => p.name === featureName), [pipeline, featureName]);
  const tasks = useMemo(
    () => featureTasks.find((f) => f.name === featureName),
    [featureTasks, featureName],
  );

  useEffect(() => {
    if (!row) return;
    for (const path of [row.specPath, row.designPath, row.tasksPath]) {
      if (path && !content[path]) {
        send({ type: "afxFetchDocContent", filePath: path });
      }
    }
  }, [row, content, send]);

  const toggleColumn = (id: ColumnId) => {
    setVisible((prev) => ({ ...prev, [id]: !prev[id] }));
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

  const handleSelectFeature = useCallback(
    (name: string) => {
      selectFeature(name);
      setRecentFeatureRecords((prev) => {
        const next = withRecentFeature(prev, name);
        writeRecentFeatureRecords(next);
        return next;
      });
    },
    [selectFeature],
  );

  const focusColumn = useCallback((id: ColumnId) => {
    setFocusDoc(id);
    setStudioMode("focus");
  }, []);

  const toggleColumnFocus = useCallback(
    (id: ColumnId) => {
      if (studioMode === "focus" && focusDoc === id) {
        setStudioMode("compare");
        return;
      }
      setFocusDoc(id);
      setStudioMode("focus");
    },
    [focusDoc, studioMode],
  );

  const handleMarkdownCheckboxToggle = useCallback(
    (target: MarkdownCheckboxToggle) => {
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
    },
    [tasks, send],
  );

  const handleToggleAllSessions = useCallback(
    (column: "agent" | "human", completed: boolean) => {
      if (tasks?.tasksPath) {
        send({
          type: "afxToggleAllSessions",
          filePath: tasks.tasksPath,
          column,
          completed,
        });
      }
    },
    [tasks, send],
  );

  const handleApproveSessions = useCallback(() => {
    if (tasks?.tasksPath) {
      send({ type: "afxApproveSessions", filePath: tasks.tasksPath });
    }
  }, [tasks, send]);

  const handleSessionBulkAction = useCallback(
    (action: DocumentSessionBulkAction) => {
      if (action.type === "approve") {
        handleApproveSessions();
        return;
      }
      handleToggleAllSessions(action.column, action.completed);
    },
    [handleApproveSessions, handleToggleAllSessions],
  );

  const openChatCommand = useCallback(
    (command: string) => {
      send({ type: "afxOpenChatCommand", command, mode: "insert" });
    },
    [send],
  );

  const visibleColumns = ALL_COLUMNS.filter((c) => visible[c]);

  const featurePct = row
    ? row.total === 0
      ? 0
      : Math.round((row.completed / row.total) * 100)
    : 0;
  const sessionSummary = useMemo(() => {
    const taskContent = tasks?.tasksPath ? content[tasks.tasksPath] : undefined;
    return taskContent ? summarizeWorkSessionSignoffs(taskContent) : null;
  }, [content, tasks?.tasksPath]);
  const studioDocs = useMemo(
    () => studioDocumentInfos({ row, tasks, sessionSummary }),
    [row, sessionSummary, tasks],
  );
  const signals = useMemo(
    () => studioSignals({ row, tasks, sessionSummary, content }),
    [content, row, sessionSummary, tasks],
  );
  const nextAction = useMemo(
    () => studioNextAction({ row, tasks, sessionSummary }),
    [row, sessionSummary, tasks],
  );

  const openPreviewFile = useCallback(
    (path: string) => {
      send({ type: "afxOpenFile", path, mode: "afxPreview" });
    },
    [send],
  );

  const handleStudioAction = useCallback(
    (action: StudioAction) => {
      if (action.focusDoc) {
        setFocusDoc(action.focusDoc);
        setStudioMode("focus");
      }
      if (action.filePath) {
        openPreviewFile(action.filePath);
        return;
      }
      if (action.command) {
        send({ type: "afxOpenChatCommand", command: action.command, mode: "insert" });
      }
    },
    [openPreviewFile, send],
  );

  const renderColumnContent = useCallback(
    (colId: ColumnId) => {
      if (colId === "spec" && row) {
        return (
          <ColumnDoc
            colId="spec"
            content={row.specPath ? content[row.specPath] : undefined}
            docPath={row.specPath}
            featureName={row.name}
            status={row.specStatus}
            onCommand={openChatCommand}
            reading={reading}
            focused={studioMode === "focus" && focusDoc === "spec"}
            onReadingChange={updateReading}
            onToggleFocus={() => toggleColumnFocus("spec")}
            onOpen={() =>
              row.specPath && send({ type: "afxOpenFile", path: row.specPath, mode: "preview" })
            }
          />
        );
      }
      if (colId === "design" && row) {
        return (
          <ColumnDoc
            colId="design"
            content={row.designPath ? content[row.designPath] : undefined}
            docPath={row.designPath}
            featureName={row.name}
            status={row.designStatus}
            onCommand={openChatCommand}
            reading={reading}
            focused={studioMode === "focus" && focusDoc === "design"}
            onReadingChange={updateReading}
            onToggleFocus={() => toggleColumnFocus("design")}
            onOpen={() =>
              row.designPath && send({ type: "afxOpenFile", path: row.designPath, mode: "preview" })
            }
          />
        );
      }
      if (colId === "tasks" && tasks) {
        return (
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
            focused={studioMode === "focus" && focusDoc === "tasks"}
            onReadingChange={updateReading}
            onToggleFocus={() => toggleColumnFocus("tasks")}
            onOpen={() =>
              row?.tasksPath && send({ type: "afxOpenFile", path: row.tasksPath, mode: "preview" })
            }
          />
        );
      }
      if (colId === "tasks" && row) {
        return (
          <ColumnDoc
            colId="tasks"
            content={row.tasksPath ? content[row.tasksPath] : undefined}
            docPath={row.tasksPath}
            featureName={row.name}
            status={row.tasksStatus}
            onCommand={openChatCommand}
            reading={reading}
            focused={studioMode === "focus" && focusDoc === "tasks"}
            onReadingChange={updateReading}
            onToggleFocus={() => toggleColumnFocus("tasks")}
            onOpen={() =>
              row.tasksPath && send({ type: "afxOpenFile", path: row.tasksPath, mode: "preview" })
            }
          />
        );
      }
      if (colId === "sessions" && tasks) {
        return (
          <ColumnSessions
            content={tasks.tasksPath ? content[tasks.tasksPath] : undefined}
            docPath={tasks.tasksPath}
            featureName={tasks.name}
            onCheckboxToggle={handleMarkdownCheckboxToggle}
            onSessionBulkAction={handleSessionBulkAction}
            reading={reading}
            focused={studioMode === "focus" && focusDoc === "sessions"}
            onReadingChange={updateReading}
            onToggleFocus={() => toggleColumnFocus("sessions")}
            onOpen={() =>
              row?.tasksPath && send({ type: "afxOpenFile", path: row.tasksPath, mode: "preview" })
            }
          />
        );
      }
      return (
        <div className="flex items-center justify-center p-4 text-sm text-muted-foreground">
          Select a feature to view {COLUMN_CONFIG[colId].label.toLowerCase()}.
        </div>
      );
    },
    [
      content,
      focusDoc,
      handleMarkdownCheckboxToggle,
      handleSessionBulkAction,
      openChatCommand,
      reading,
      row,
      send,
      studioMode,
      tasks,
      toggleColumnFocus,
      updateReading,
    ],
  );

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
      <SddStudioHeader
        pipeline={pipeline}
        documents={documents}
        recentFeatureRecords={recentFeatureRecords}
        row={row}
        tasks={tasks}
        featureName={featureName}
        featurePct={featurePct}
        mode={studioMode}
        onSelectFeature={handleSelectFeature}
        onModeChange={setStudioMode}
      />

      {studioMode === "studio" ? (
        <SddStudioCockpit
          row={row}
          tasks={tasks}
          sessionSummary={sessionSummary}
          signals={signals}
          nextAction={nextAction}
          onAction={handleStudioAction}
          onFocusDoc={focusColumn}
          onOpenFile={openPreviewFile}
        />
      ) : studioMode === "focus" ? (
        <SddStudioFocusView
          docs={studioDocs}
          activeDoc={focusDoc}
          signals={signals}
          renderDocument={renderColumnContent}
          onFocusDoc={focusColumn}
          onAction={handleStudioAction}
        />
      ) : visibleColumns.length === 0 ? (
        <Empty className="flex-1">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Layout size={32} />
            </EmptyMedia>
            <EmptyTitle>No compare documents visible</EmptyTitle>
            <EmptyDescription>Toggle a document above to compare it.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden" data-afx-sdd-studio="compare">
          <CompareToolbar visible={visible} onToggleColumn={toggleColumn} />
          <div
            data-testid="workbench-column-region"
            className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden p-2"
          >
            <div className="flex h-full min-w-full gap-2" data-testid="workbench-column-rail">
              {visibleColumns.map((colId) => (
                <div
                  key={colId}
                  data-testid={`workbench-column-${colId}`}
                  className="afx-surface-card afx-workbench-column-card group/column relative flex h-full min-w-0 flex-col overflow-hidden rounded-xl border border-border/60 bg-background shadow-[0_1px_0_rgba(255,255,255,0.04),0_8px_24px_rgba(0,0,0,0.10)]"
                  style={{
                    flexBasis: `${columnWidths[colId]}px`,
                    flexGrow: 1,
                    flexShrink: 0,
                    minWidth: MIN_COLUMN_WIDTH,
                  }}
                >
                  {renderColumnContent(colId)}
                  {visibleColumns.length > 1 ? (
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
        </div>
      )}

      {row && studioMode === "compare" ? (
        <div className="afx-surface-toolbar flex flex-wrap items-center gap-4 border-t border-border px-3 py-1.5 text-muted-foreground">
          <DocStatusIndicator label="spec" status={row.specStatus} />
          <DocStatusIndicator label="design" status={row.designStatus} />
          <DocStatusIndicator label="tasks" status={row.tasksStatus} />
        </div>
      ) : null}
    </div>
  );
}
