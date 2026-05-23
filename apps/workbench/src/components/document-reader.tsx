/**
 * Purpose-aware markdown reader chrome for Workbench document-like surfaces.
 * The parser/renderer stays shared while the surrounding controls stay tuned
 * for specs, research, ADRs, journals, notes, and generic markdown.
 *
 * @see docs/specs/222-app-workbench-documents/spec.md [FR-3] [FR-11] [FR-14]
 * @see docs/specs/222-app-workbench-documents/design.md [DES-DOCS-READER] [DES-DOCS-MARKDOWN]
 * @see docs/specs/223-app-workbench-journal/spec.md [FR-5] [FR-6]
 * @see docs/specs/223-app-workbench-journal/design.md [DES-JOURNAL-PREVIEW]
 * @see docs/specs/224-app-workbench-notes/spec.md [FR-5] [FR-6]
 * @see docs/specs/224-app-workbench-notes/design.md [DES-NOTES-ITEM]
 */
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  BookOpen,
  FileText,
  ListTree,
  type LucideIcon,
  NotebookText,
  ScrollText,
  SlidersHorizontal,
} from "lucide-react";

import { Button } from "@afx/ui/components/button";
import { Popover, PopoverContent, PopoverTrigger } from "@afx/ui/components/popover";
import { ToggleGroup, ToggleGroupItem } from "@afx/ui/components/toggle-group";
import { cn } from "@afx/ui/lib/utils";

import { type OutlineItem, extractOutline } from "../lib/document-outline";
import { type MarkdownCheckboxToggle, MinimalMarkdown } from "../lib/markdown-render";
import { OpenActions } from "../lib/open-actions";
import {
  type ReadingFont,
  type ReadingPrefs,
  type ReadingSize,
  type ReadingTone,
  readReadingPrefs,
  readingWidthClass,
  writeReadingPrefs,
} from "../lib/reading-prefs";
import { CopyMarkdownButton } from "./copy-markdown-button";

export type DocumentReaderPreset = "afx" | "research" | "adr" | "journal" | "note" | "generic";
type DocumentReaderChrome = "panel" | "inline" | "none";

interface ReaderPresetConfig {
  label: string;
  icon: LucideIcon;
  accent: string;
  paper: string;
}

const PRESET_CONFIG: Record<DocumentReaderPreset, ReaderPresetConfig> = {
  afx: {
    label: "AFX",
    icon: FileText,
    accent: "text-afx-brand-soft",
    paper: "afx-paper bg-card",
  },
  research: {
    label: "Research",
    icon: ScrollText,
    accent: "text-afx-brand-soft",
    paper: "afx-paper afx-paper--warm",
  },
  adr: {
    label: "ADR",
    icon: ScrollText,
    accent: "text-afx-brand-soft",
    paper: "afx-paper bg-card",
  },
  journal: {
    label: "Journal",
    icon: BookOpen,
    accent: "text-afx-brand-soft",
    paper: "afx-paper bg-card",
  },
  note: {
    label: "Note",
    icon: NotebookText,
    accent: "text-afx-brand-soft",
    paper: "bg-transparent",
  },
  generic: {
    label: "Markdown",
    icon: FileText,
    accent: "text-muted-foreground",
    paper: "afx-paper bg-card",
  },
};

const OUTLINE_INDENT_CLASS: Record<number, string> = {
  1: "pl-0",
  2: "pl-2",
  3: "pl-4",
  4: "pl-6",
  5: "pl-8",
  6: "pl-10",
};

export interface DocumentReaderProps {
  preset: DocumentReaderPreset;
  content: string | null | undefined;
  title?: ReactNode;
  subtitle?: ReactNode;
  filePath?: string;
  line?: number;
  chrome?: DocumentReaderChrome;
  hideTitle?: boolean;
  loadingText?: string;
  toolbar?: ReactNode;
  aside?: ReactNode;
  className?: string;
  bodyClassName?: string;
  showOpenActions?: boolean;
  includeAfxPreview?: boolean;
  showOutline?: boolean;
  showReadingControls?: boolean;
  density?: "default" | "relaxed";
  scale?: ReadingSize;
  onCheckboxToggle?: (target: MarkdownCheckboxToggle) => void;
}

/**
 * Shared reader shell for non-editor Workbench surfaces. It intentionally keeps
 * the parser/rendering path identical (`MinimalMarkdown`) while letting each
 * surface choose a lighter or heavier surrounding chrome.
 */
export function DocumentReader({
  preset,
  content,
  title,
  subtitle,
  filePath,
  line,
  chrome = "panel",
  hideTitle = false,
  loadingText = "Loading content...",
  toolbar,
  aside,
  className,
  bodyClassName,
  showOpenActions = false,
  includeAfxPreview = false,
  showOutline = chrome === "panel",
  showReadingControls = chrome === "panel",
  density = chrome === "none" ? "default" : "relaxed",
  scale,
  onCheckboxToggle,
}: DocumentReaderProps) {
  const config = PRESET_CONFIG[preset];
  const Icon = config.icon;
  const readableContent = content ?? "";
  const isLoading = content === null || content === undefined;
  const outline = useMemo(
    () => (readableContent ? extractOutline(readableContent) : []),
    [readableContent],
  );
  const contentRef = useRef<HTMLDivElement>(null);
  const [prefs, setPrefs] = useState<ReadingPrefs>(readReadingPrefs);

  const readerPrefsEnabled = showReadingControls && chrome !== "none";

  useEffect(() => {
    if (readerPrefsEnabled) writeReadingPrefs(prefs);
  }, [prefs, readerPrefsEnabled]);

  const updatePrefs = useCallback((patch: Partial<ReadingPrefs>) => {
    setPrefs((prev) => ({ ...prev, ...patch }));
  }, []);

  const jumpToHeading = useCallback((slug: string) => {
    const target = contentRef.current?.querySelector<HTMLElement>(`#${CSS.escape(slug)}`);
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const effectiveScale = scale ?? (readerPrefsEnabled ? prefs.size : undefined);
  const paperClass = cn(
    chrome === "none"
      ? "min-w-0 max-w-full"
      : "min-w-0 max-w-full rounded-lg border border-border/60 shadow-[0_1px_0_rgba(255,255,255,0.04),0_8px_24px_rgba(0,0,0,0.06)]",
    chrome === "panel" && "px-4 py-4",
    chrome === "inline" && "px-3 py-3",
    chrome === "panel" && readingWidthClass(prefs.width),
    config.paper,
    readerPrefsEnabled && prefs.tone === "warm" && "afx-paper--warm",
    readerPrefsEnabled && prefs.font === "serif" && "font-serif",
    bodyClassName,
  );

  return (
    <section
      data-afx-doc-reader
      data-afx-reader-preset={preset}
      data-afx-reader-chrome={chrome}
      className={cn("min-w-0 max-w-full", className)}
    >
      {chrome !== "none" ? (
        <header className="mb-2 flex min-w-0 items-center gap-2 rounded-md border border-border/50 bg-muted/15 px-2.5 py-2">
          <Icon size={13} className={cn("shrink-0", config.accent)} aria-hidden />
          <div className="min-w-0 flex-1">
            <p className={cn("font-mono text-[10px] uppercase tracking-[0.16em]", config.accent)}>
              {config.label}
            </p>
            {title ? (
              <h3 className="mt-0.5 truncate text-sm font-semibold leading-tight text-foreground">
                {title}
              </h3>
            ) : null}
            {subtitle ? (
              <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{subtitle}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {toolbar}
            {showOpenActions && filePath ? (
              <OpenActions filePath={filePath} line={line} includeAfxPreview={includeAfxPreview} />
            ) : null}
            <CopyMarkdownButton
              content={readableContent}
              label={filePath ?? config.label}
              ariaLabel={`Copy ${config.label} markdown source`}
            />
            {showOutline ? <ReaderOutlineControl outline={outline} onJump={jumpToHeading} /> : null}
            {readerPrefsEnabled ? <ReaderOptions prefs={prefs} onChange={updatePrefs} /> : null}
          </div>
        </header>
      ) : null}
      <div className={cn("grid min-w-0 gap-3", aside && "xl:grid-cols-[minmax(0,1fr)_240px]")}>
        <article ref={contentRef} className={paperClass}>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">{loadingText}</p>
          ) : (
            <MinimalMarkdown
              content={readableContent}
              hideTitle={hideTitle}
              density={density}
              scale={effectiveScale}
              onCheckboxToggle={onCheckboxToggle}
            />
          )}
        </article>
        {aside ? <aside className="min-w-0">{aside}</aside> : null}
      </div>
    </section>
  );
}

function ReaderOutlineControl({
  outline,
  onJump,
}: {
  outline: OutlineItem[];
  onJump: (slug: string) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="text-muted-foreground hover:text-foreground"
          aria-label="Open reader outline"
          title="Open outline"
        >
          <ListTree size={13} aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={6}
        className="max-h-[min(28rem,calc(100vh-4rem))] w-[min(22rem,calc(100vw-2rem))] overflow-hidden p-0"
      >
        <section className="flex max-h-[min(28rem,calc(100vh-4rem))] min-w-0 flex-col bg-popover p-2">
          <div className="mb-1.5 flex min-w-0 items-center gap-2">
            <ListTree size={12} className="text-afx-brand" aria-hidden />
            <h4 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Outline
            </h4>
            <span className="min-w-0 truncate text-[11px] text-muted-foreground">
              {outline.length} {outline.length === 1 ? "section" : "sections"}
            </span>
          </div>
          <div className="min-h-0 overflow-y-auto overscroll-contain pr-1">
            <OutlineList outline={outline} onJump={onJump} />
          </div>
        </section>
      </PopoverContent>
    </Popover>
  );
}

function OutlineList({
  outline,
  onJump,
}: {
  outline: OutlineItem[];
  onJump: (slug: string) => void;
}) {
  if (outline.length === 0) {
    return <p className="px-1 py-1 text-xs text-muted-foreground">No headings detected.</p>;
  }

  return (
    <ul className="flex flex-col gap-0.5">
      {outline.map((item) => (
        <li key={`${item.line}-${item.slug}`}>
          <button
            type="button"
            onClick={() => onJump(item.slug)}
            className={cn(
              "w-full rounded-sm px-1 py-0.5 text-left text-xs leading-4 text-foreground/80 transition-colors hover:bg-muted/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              OUTLINE_INDENT_CLASS[item.level] ?? "pl-10",
            )}
            title={`Jump to "${item.text}"`}
          >
            <span className="block truncate">{item.text}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function ReaderOptions({
  prefs,
  onChange,
}: {
  prefs: ReadingPrefs;
  onChange: (patch: Partial<ReadingPrefs>) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="text-muted-foreground hover:text-foreground"
          aria-label="Reader options"
          title="Reader options"
        >
          <SlidersHorizontal size={13} aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-60 gap-3 rounded-md">
        <OptionRow label="Width">
          <ToggleGroup
            type="single"
            size="sm"
            variant="outline"
            value={prefs.width}
            onValueChange={(v) => v && onChange({ width: v as ReadingPrefs["width"] })}
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
  );
}

function OptionRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}
