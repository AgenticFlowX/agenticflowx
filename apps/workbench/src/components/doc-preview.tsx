/**
 * DocPreview — reusable rendering core for an AFX document preview. Drives both
 * the Workbench Documents reader (`mode="full"`) and the standalone editor-area
 * preview panel. `mode="full"` renders a metadata-chip toolbar + a reading-first
 * paper sheet (DocumentStudio) with a collapsible quality/outline rail;
 * `mode="generic"` degrades to a minimal header plus MinimalMarkdown on a sheet.
 *
 * Reading controls (width / text size / paper tone / font / focus) apply to both
 * modes and persist via `reading-prefs`.
 *
 * @see docs/specs/222-app-workbench-documents/spec.md [FR-11] [FR-14]
 * @see docs/specs/222-app-workbench-documents/design.md [DES-DOCS-PREVIEW-STANDALONE]
 */
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  FileText,
  Focus,
  ListTree,
  Minimize2,
  PanelRightClose,
  PanelRightOpen,
  SlidersHorizontal,
} from "lucide-react";

import type { DocumentRow } from "@afx/shared";
import { Button } from "@afx/ui/components/button";
import { Popover, PopoverContent, PopoverTrigger } from "@afx/ui/components/popover";
import { ScrollArea } from "@afx/ui/components/scroll-area";
import { Separator } from "@afx/ui/components/separator";
import { ToggleGroup, ToggleGroupItem } from "@afx/ui/components/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@afx/ui/components/tooltip";
import { cn } from "@afx/ui/lib/utils";

import { useWorkbench } from "../context/workbench-context";
import { type OutlineItem, extractOutline } from "../lib/document-outline";
import {
  type DocumentSessionBulkAction,
  DocumentStudio,
  documentActions,
  summarizeDocumentQuality,
} from "../lib/document-studio";
import { type MetaChip, extractMetaChips, parseSimpleFrontmatter } from "../lib/frontmatter";
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
import { CopyMarkdownButton } from "./copy-markdown-button";

const OUTLINE_INDENT_CLASS: Record<number, string> = {
  1: "pl-0",
  2: "pl-2",
  3: "pl-4",
  4: "pl-6",
  5: "pl-8",
  6: "pl-10",
};

const RAIL_COLLAPSED_STORAGE_KEY = "afx.workbench.preview.outlineCollapsed.v2";

const SHEET_SHADOW = "shadow-[0_1px_0_rgba(255,255,255,0.04),0_10px_30px_rgba(0,0,0,0.16)]";

type DocumentQualitySummary = ReturnType<typeof summarizeDocumentQuality>;

function metaChipText(chip: MetaChip): string {
  if (chip.kind === "version") return `v${chip.value.replace(/^v/i, "")}`;
  return chip.value;
}

/**
 * Read the persisted rail-collapsed flag. Defaults to expanded (false) and
 * guards localStorage which may be unavailable (private mode / restricted host).
 */
function readRailCollapsed(): boolean {
  try {
    return globalThis.localStorage?.getItem(RAIL_COLLAPSED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/** Persist the rail-collapsed flag, swallowing storage failures. */
function writeRailCollapsed(collapsed: boolean): void {
  try {
    globalThis.localStorage?.setItem(RAIL_COLLAPSED_STORAGE_KEY, collapsed ? "1" : "0");
  } catch {
    // localStorage unavailable — state stays in-memory only.
  }
}

/**
 * Renders an AFX document preview in either full or generic mode.
 *
 * @see docs/specs/222-app-workbench-documents/spec.md [FR-11] [FR-14]
 * @see docs/specs/222-app-workbench-documents/design.md [DES-DOCS-PREVIEW-STANDALONE]
 */
export function DocPreview({
  doc,
  content,
  mode,
  showAfxPreviewAction,
}: {
  doc: DocumentRow;
  content: string | undefined;
  mode: "full" | "generic";
  showAfxPreviewAction?: boolean;
}) {
  const { send } = useWorkbench();
  const frontmatter = useMemo(() => (content ? parseSimpleFrontmatter(content) : {}), [content]);
  const outline = useMemo(() => (content ? extractOutline(content) : []), [content]);
  const quality = useMemo(
    () => summarizeDocumentQuality(doc, content, frontmatter, outline),
    [content, doc, frontmatter, outline],
  );
  const metaChips = useMemo(
    () =>
      extractMetaChips(frontmatter)
        .filter((chip) => chip.kind !== "tag")
        .slice(0, 5),
    [frontmatter],
  );
  const studioActions = useMemo(() => documentActions(doc), [doc]);

  const [railCollapsed, setRailCollapsed] = useState<boolean>(readRailCollapsed);
  const [prefs, setPrefs] = useState<ReadingPrefs>(readReadingPrefs);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    writeRailCollapsed(railCollapsed);
  }, [railCollapsed]);

  useEffect(() => {
    writeReadingPrefs(prefs);
  }, [prefs]);

  const updatePrefs = useCallback((patch: Partial<ReadingPrefs>) => {
    setPrefs((prev) => ({ ...prev, ...patch }));
  }, []);

  // Escape exits focus/zen mode (the toolbar is hidden in focus, so this + the
  // floating exit button are the ways out).
  useEffect(() => {
    if (!prefs.focus) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPrefs((prev) => ({ ...prev, focus: false }));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prefs.focus]);

  const scrollToHeading = useCallback((slug: string) => {
    const root = contentRef.current;
    if (!root) return;
    const target = root.querySelector<HTMLElement>(`#${CSS.escape(slug)}`);
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const readingControls = <ReadingControls prefs={prefs} onChange={updatePrefs} />;
  const toggleMarkdownCheckbox = useCallback(
    (target: MarkdownCheckboxToggle) => {
      if (target.kind === "session" && target.sessionIndex !== undefined && target.column) {
        send({
          type: "afxToggleSession",
          filePath: doc.filePath,
          sessionIndex: target.sessionIndex,
          column: target.column,
          completed: target.completed,
          line: target.line,
        });
        return;
      }
      if (target.kind === "task" && typeof target.line === "number") {
        send({
          type: "afxToggleTask",
          path: doc.filePath,
          line: target.line,
          completed: target.completed,
        });
      }
    },
    [doc.filePath, send],
  );
  const handleSessionBulkAction = useCallback(
    (action: DocumentSessionBulkAction) => {
      if (action.type === "approve") {
        send({ type: "afxApproveSessions", filePath: doc.filePath });
        return;
      }
      send({
        type: "afxToggleAllSessions",
        filePath: doc.filePath,
        column: action.column,
        completed: action.completed,
      });
    },
    [doc.filePath, send],
  );

  if (mode === "generic") {
    const genericSheet = cn(
      "afx-paper mx-auto flex w-full min-w-0 flex-col rounded-xl border border-border/60 px-7 py-8",
      SHEET_SHADOW,
      readingWidthClass(prefs.width),
      prefs.tone === "warm" ? "afx-paper--warm" : "bg-card",
      prefs.font === "serif" && "font-serif",
    );
    return (
      <div className="relative flex h-full min-h-0 flex-col overflow-hidden">
        {!prefs.focus && (
          <div className="flex items-center gap-2 border-b border-border/40 px-3 py-1.5">
            <FileText size={11} className="shrink-0 text-muted-foreground/70" aria-hidden />
            <span className="min-w-0 flex-1 truncate font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
              {doc.filePath}
            </span>
            <OpenActions
              filePath={doc.filePath}
              includeAfxPreview={showAfxPreviewAction ?? false}
            />
            <CopyMarkdownButton content={content} label={doc.filePath} />
            {readingControls}
          </div>
        )}
        <ScrollArea
          data-afx-preview-scroll="content"
          className="@container min-h-0 flex-1 [&_[data-slot=scroll-area-viewport]>div]:!block"
        >
          <div className="min-w-0 px-3 py-5 @[34rem]:px-6">
            <article className={genericSheet}>
              <MinimalMarkdown
                content={content ?? ""}
                density="relaxed"
                scale={prefs.size}
                onCheckboxToggle={toggleMarkdownCheckbox}
              />
            </article>
          </div>
        </ScrollArea>
        {prefs.focus && <FocusExitButton onExit={() => updatePrefs({ focus: false })} />}
      </div>
    );
  }

  return (
    <div className="@container relative flex h-full min-h-0 flex-col overflow-hidden">
      {!prefs.focus && (
        <div className="flex items-center gap-2 border-b border-border/40 px-3 py-1.5">
          <span className="min-w-0 flex-1 truncate font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
            {doc.filePath}
          </span>
          {metaChips.length > 0 ? (
            <div
              className="hidden min-w-0 shrink-0 items-center gap-1 xl:flex"
              aria-label="Document metadata"
            >
              {metaChips.map((chip) => (
                <span
                  key={`${chip.kind}-${chip.value}`}
                  className="max-w-28 truncate rounded-sm border border-border/70 bg-muted/30 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
                  title={`${chip.label}: ${chip.value}`}
                >
                  {metaChipText(chip)}
                </span>
              ))}
            </div>
          ) : null}
          <OpenActions filePath={doc.filePath} includeAfxPreview={showAfxPreviewAction ?? false} />
          <CopyMarkdownButton content={content} label={doc.filePath} />
          <OutlineToolbarControl
            railCollapsed={railCollapsed}
            quality={quality}
            outline={outline}
            onJump={scrollToHeading}
            onToggleRail={() => setRailCollapsed((prev) => !prev)}
          />
          {readingControls}
        </div>
      )}
      <div className="@container flex min-h-0 flex-1 overflow-hidden">
        <ScrollArea
          data-afx-preview-scroll="content"
          className="h-full min-w-0 flex-1 [&_[data-slot=scroll-area-viewport]>div]:!block"
        >
          <div ref={contentRef} className="min-w-0 px-3 py-5 @[34rem]:px-6">
            <DocumentStudio
              doc={doc}
              content={content}
              actions={studioActions}
              reading={prefs}
              onCheckboxToggle={toggleMarkdownCheckbox}
              onSessionBulkAction={handleSessionBulkAction}
              onCommand={(command, mode) =>
                send({
                  type: "afxOpenChatCommand",
                  command,
                  mode: mode ?? "insert",
                })
              }
            />
          </div>
        </ScrollArea>
        {!railCollapsed && !prefs.focus && (
          <QualityOutlineRail quality={quality} outline={outline} onJump={scrollToHeading} />
        )}
      </div>
      {prefs.focus && <FocusExitButton onExit={() => updatePrefs({ focus: false })} />}
    </div>
  );
}

/**
 * Toolbar outline control. Wide previews use a persistent rail; constrained
 * previews keep the outline minimized in a popover so it never eats document
 * reading space.
 */
function OutlineToolbarControl({
  railCollapsed,
  quality,
  outline,
  onJump,
  onToggleRail,
}: {
  railCollapsed: boolean;
  quality: DocumentQualitySummary;
  outline: OutlineItem[];
  onJump: (slug: string) => void;
  onToggleRail: () => void;
}) {
  const summary = (
    <>
      <span className="font-medium text-foreground">{quality.scoreLabel}</span> · {outline.length}{" "}
      {outline.length === 1 ? "section" : "sections"}
    </>
  );

  return (
    <>
      <Popover>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                className="shrink-0 gap-1 border-border/50 px-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:border-border hover:text-foreground xl:hidden"
                aria-label="Open outline"
              >
                <ListTree size={13} aria-hidden />
                <span className="hidden @[24rem]:inline">Outline</span>
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom">Open outline</TooltipContent>
        </Tooltip>
        <PopoverContent
          align="end"
          sideOffset={6}
          className="max-h-[calc(100vh-4rem)] w-[min(22rem,calc(100vw-2rem))] gap-0 overflow-hidden p-0"
        >
          <OutlinePopoverPanel summary={summary} outline={outline} onJump={onJump} />
        </PopoverContent>
      </Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="hidden shrink-0 gap-1 border-border/50 px-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:border-border hover:text-foreground xl:inline-flex"
            aria-label={railCollapsed ? "Show outline" : "Hide outline"}
            aria-pressed={!railCollapsed}
            onClick={onToggleRail}
          >
            {railCollapsed ? (
              <PanelRightOpen size={13} aria-hidden />
            ) : (
              <PanelRightClose size={13} aria-hidden />
            )}
            <span>Outline</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {railCollapsed ? "Show outline" : "Hide outline"}
        </TooltipContent>
      </Tooltip>
    </>
  );
}

/** Minimized outline content for constrained previews. */
function OutlinePopoverPanel({
  summary,
  outline,
  onJump,
}: {
  summary: ReactNode;
  outline: OutlineItem[];
  onJump: (slug: string) => void;
}) {
  return (
    <section
      aria-label="Document outline"
      data-afx-preview-outline="popover"
      className="flex max-h-[calc(100vh-4rem)] min-w-0 flex-col overflow-hidden rounded-[inherit] bg-popover p-2"
    >
      <div className="mb-1.5 flex min-w-0 shrink-0 items-center gap-2">
        <ListTree size={12} className="shrink-0 text-afx-brand" aria-hidden />
        <h3 className="shrink-0 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Outline
        </h3>
        <span className="min-w-0 truncate text-[11px] text-muted-foreground">{summary}</span>
      </div>
      <div
        data-afx-preview-outline-scroll="popover"
        className="min-h-0 max-h-[calc(100vh-7rem)] overflow-y-auto overscroll-contain pr-1"
      >
        <OutlineList outline={outline} onJump={onJump} compact />
      </div>
    </section>
  );
}

/** Desktop outline rail with document quality signals and jump navigation. */
function QualityOutlineRail({
  quality,
  outline,
  onJump,
}: {
  quality: DocumentQualitySummary;
  outline: OutlineItem[];
  onJump: (slug: string) => void;
}) {
  return (
    <aside
      aria-label="Document quality and outline"
      data-afx-preview-outline="rail"
      className="afx-surface-subtle hidden w-52 min-h-0 shrink-0 flex-col gap-2 border-l border-border p-3 xl:flex"
    >
      <h3 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        Quality pulse
      </h3>
      <p className="text-[11px] leading-5 text-muted-foreground">
        <span className="font-medium text-foreground">{quality.scoreLabel}</span> · {outline.length}{" "}
        {outline.length === 1 ? "section" : "sections"} · {quality.issues.length} to review
      </p>
      <div className="flex flex-col gap-1.5">
        {quality.issues.length === 0 ? (
          <span className="rounded-md border border-afx-success/30 bg-afx-success/10 px-2 py-1.5 text-xs text-afx-success">
            Looks ready to read
          </span>
        ) : (
          quality.issues.map((issue) => (
            <span
              key={issue}
              className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-xs text-amber-300"
            >
              {issue}
            </span>
          ))
        )}
      </div>
      <Separator />
      <h3 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        Outline
      </h3>
      <Separator />
      <ScrollArea className="min-h-0 flex-1 [&_[data-slot=scroll-area-viewport]>div]:!block">
        <OutlineList outline={outline} onJump={onJump} />
      </ScrollArea>
    </aside>
  );
}

/** Shared outline list used by both the minimized popover and the desktop rail. */
function OutlineList({
  outline,
  onJump,
  compact,
}: {
  outline: OutlineItem[];
  onJump: (slug: string) => void;
  compact?: boolean;
}) {
  if (outline.length === 0) {
    return <p className="px-1 py-1 text-xs text-muted-foreground">No headings detected.</p>;
  }

  return (
    <ul className={cn("flex flex-col", compact ? "gap-0.5" : "gap-1")}>
      {outline.map((o) => (
        <li key={`${o.line}-${o.slug}`}>
          <button
            type="button"
            onClick={() => onJump(o.slug)}
            className={cn(
              "w-full rounded-sm px-1 py-0.5 text-left text-xs text-foreground/80 transition-colors hover:bg-muted/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              compact ? "leading-4" : "leading-5",
              OUTLINE_INDENT_CLASS[o.level] ?? "pl-10",
            )}
            title={`Jump to "${o.text}"`}
          >
            <span className="block truncate">{o.text}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * Toolbar cluster: a reading-options popover (width / text size / tone / font)
 * plus a one-click Focus/Zen toggle. Shared by both preview modes.
 */
function ReadingControls({
  prefs,
  onChange,
}: {
  prefs: ReadingPrefs;
  onChange: (patch: Partial<ReadingPrefs>) => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      <Popover>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="text-muted-foreground hover:text-foreground"
                aria-label="Reading options"
              >
                <SlidersHorizontal size={13} aria-hidden />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom">Reading options</TooltipContent>
        </Tooltip>
        <PopoverContent align="end" className="w-60 gap-3 rounded-md">
          <OptionRow label="Width">
            <ToggleGroup
              type="single"
              size="sm"
              variant="outline"
              value={prefs.width}
              onValueChange={(v) => v && onChange({ width: v as ReadingWidth })}
            >
              <ToggleGroupItem value="comfortable" className="px-2 text-[11px]">
                Comfortable
              </ToggleGroupItem>
              <ToggleGroupItem value="wide" className="px-2 text-[11px]">
                Wide
              </ToggleGroupItem>
            </ToggleGroup>
          </OptionRow>
          <OptionRow label="Text size">
            <ToggleGroup
              type="single"
              size="sm"
              variant="outline"
              value={prefs.size}
              onValueChange={(v) => v && onChange({ size: v as ReadingSize })}
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
          </OptionRow>
          <OptionRow label="Paper tone">
            <ToggleGroup
              type="single"
              size="sm"
              variant="outline"
              value={prefs.tone}
              onValueChange={(v) => v && onChange({ tone: v as ReadingTone })}
            >
              <ToggleGroupItem value="default" className="px-2 text-[11px]">
                Default
              </ToggleGroupItem>
              <ToggleGroupItem value="warm" className="px-2 text-[11px]">
                Warm
              </ToggleGroupItem>
            </ToggleGroup>
          </OptionRow>
          <OptionRow label="Font">
            <ToggleGroup
              type="single"
              size="sm"
              variant="outline"
              value={prefs.font}
              onValueChange={(v) => v && onChange({ font: v as ReadingFont })}
            >
              <ToggleGroupItem value="sans" className="px-2 text-[11px]">
                Sans
              </ToggleGroupItem>
              <ToggleGroupItem value="serif" className="px-2 font-serif text-[11px]">
                Serif
              </ToggleGroupItem>
            </ToggleGroup>
          </OptionRow>
        </PopoverContent>
      </Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="text-muted-foreground hover:text-foreground"
            aria-label="Focus mode"
            onClick={() => onChange({ focus: true })}
          >
            <Focus size={13} aria-hidden />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Focus mode (hide chrome)</TooltipContent>
      </Tooltip>
    </div>
  );
}

/** A labelled row inside the reading-options popover. */
function OptionRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

/** Floating control to leave focus/zen mode (also exitable via Escape). */
function FocusExitButton({ onExit }: { onExit: () => void }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="xs"
      className="absolute right-3 top-3 z-10 h-7 gap-1 text-[10px] opacity-60 shadow-sm transition-opacity hover:opacity-100"
      aria-label="Exit focus mode"
      title="Exit focus mode (Esc)"
      onClick={onExit}
    >
      <Minimize2 size={11} aria-hidden />
      Exit focus
    </Button>
  );
}
