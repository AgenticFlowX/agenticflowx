/**
 * FilesPanel — body for the composer-adjacent panel listing files modified by
 * agent edit/write tool calls. Pills are clickable; click sends `chat/openFile`
 * which the host opens via `vscode.window.showTextDocument`.
 *
 * Compact-by-default: when more than `THRESHOLD` files are modified, the body
 * shows only the most recent `THRESHOLD` pills plus a `+N more` toggle. The
 * user can expand to see the full list. New edits arriving while compact do
 * not auto-expand — the ComposerPanel header count badge already reflects the
 * total, so the user notices without losing screen space.
 *
 * Mounted by `ComposerPanelStack` via the controller's `composerPanelStackConfig`.
 * Chrome (title, count, minimize, close) comes from `ComposerPanel`.
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-10]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-FILES-STRIP]
 * @see docs/specs/216-app-chat-window-componentization/design.md [DES-DATA]
 */
import { useState } from "react";

import { BookOpenCheck, ChevronDown, Layers3, PenLine, StickyNote } from "lucide-react";

import {
  classifySddDocumentPath,
  sddJournalActionForPath,
  sddPrimaryActionForPath,
} from "@afx/shared";
import { cn } from "@afx/ui/lib/utils";

import type { ModifiedFile } from "../lib/derive-modified-files";

export const THRESHOLD = 4;

export interface FilesPanelBodyProps {
  files: readonly ModifiedFile[];
  onOpenFile: (path: string, line?: number) => void;
  onOpenPreview?: (path: string) => void;
  onOpenWorkbench?: () => void;
  onCommand?: (command: string, mode?: "insert" | "send") => void;
}

export function FilesPanelBody({
  files,
  onOpenFile,
  onOpenPreview,
  onOpenWorkbench,
  onCommand,
}: FilesPanelBodyProps) {
  const [expanded, setExpanded] = useState(false);
  const overflow = files.length - THRESHOLD;
  const truncatable = overflow > 0;
  const visible = !truncatable || expanded ? files : files.slice(0, THRESHOLD);
  const sddFiles = files.filter((file) => classifySddDocumentPath(file.path));
  // Bound the basename width in compact mode so long realistic AFX paths
  // (e.g. `chat-controller-with-very-long-name.tsx`, ~280px at 11px monospace)
  // don't push each pill onto its own row at narrow sidebar widths (~360px),
  // defeating the ≤2-wrap-line goal. Expanded mode shows full basenames.
  // Tooltip and aria-label always carry the full path regardless.
  const truncatePill = truncatable && !expanded;

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <ul className="flex flex-wrap gap-1">
        {visible.map((f) => (
          <FilePill key={f.path} file={f} onOpen={onOpenFile} truncate={truncatePill} />
        ))}
        {truncatable ? (
          <li className="contents">
            <button
              type="button"
              data-testid="files-panel-toggle"
              data-expanded={expanded}
              aria-expanded={expanded}
              aria-label={
                expanded ? "Show fewer modified files" : `Show ${overflow} more modified files`
              }
              onClick={() => setExpanded((v) => !v)}
              className={cn(
                "group inline-flex items-center gap-1 rounded-sm border border-border/60 bg-card/40 px-1.5 py-0.5 text-[11px] text-foreground/90",
                "hover:bg-muted hover:text-foreground",
              )}
            >
              <ChevronDown
                size={11}
                className={cn("shrink-0 transition-transform", expanded && "rotate-180")}
              />
              <span className="font-mono">{expanded ? "Show less" : `+${overflow} more`}</span>
            </button>
          </li>
        ) : null}
      </ul>
      {sddFiles.length > 0 ? (
        <SddModifiedGuide
          files={sddFiles}
          onOpenPreview={onOpenPreview}
          onOpenWorkbench={onOpenWorkbench}
          onCommand={onCommand}
        />
      ) : null}
    </div>
  );
}

function SddModifiedGuide({
  files,
  onOpenPreview,
  onOpenWorkbench,
  onCommand,
}: {
  files: readonly ModifiedFile[];
  onOpenPreview?: (path: string) => void;
  onOpenWorkbench?: () => void;
  onCommand?: (command: string, mode?: "insert" | "send") => void;
}) {
  const visibleFiles = files.slice(0, 3);
  const overflowFiles = files.length - visibleFiles.length;
  return (
    <section
      data-testid="sdd-modified-guide"
      aria-label="SDD next steps"
      className="rounded-md border border-border/60 border-l-2 border-l-afx-brand/50 bg-background/40 p-1.5"
    >
      <div className="mb-1 flex min-w-0 items-center gap-1.5">
        <StickyNote size={12} className="shrink-0 text-afx-brand" aria-hidden />
        <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.13em] text-afx-brand-soft">
          SDD next
        </span>
        <span className="min-w-0 truncate text-[10px] text-muted-foreground">
          {files.length} changed {files.length === 1 ? "doc" : "docs"}
        </span>
        {onOpenWorkbench ? (
          <button
            type="button"
            onClick={onOpenWorkbench}
            className="ml-auto inline-flex h-5 shrink-0 items-center gap-1 rounded-sm border border-border/60 bg-background/70 px-1.5 font-mono text-[10px] text-foreground/80 hover:bg-muted"
            aria-label="Open SDD Studio"
          >
            <Layers3 size={10} aria-hidden />
            Studio
          </button>
        ) : null}
      </div>
      <ul className="flex flex-col gap-1">
        {visibleFiles.map((file) => {
          const info = classifySddDocumentPath(file.path);
          const primary = sddPrimaryActionForPath(file.path);
          const journal = sddJournalActionForPath(file.path);
          if (!info) return null;
          return (
            <li
              key={file.path}
              className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-1.5 gap-y-1 rounded-sm bg-background/55 px-1.5 py-1"
            >
              <span className="rounded-sm border border-border/60 px-1 font-mono text-[9px] uppercase text-muted-foreground">
                {info.label}
              </span>
              <span className="min-w-0 truncate text-[11px] text-foreground/90" title={file.path}>
                {file.path.split("/").pop() ?? file.path}
              </span>
              <span className="col-span-2 flex min-w-0 flex-wrap gap-1">
                {onOpenPreview ? (
                  <GuideActionButton
                    label="Preview"
                    icon={BookOpenCheck}
                    onClick={() => onOpenPreview(file.path)}
                  />
                ) : null}
                {primary && onCommand ? (
                  <GuideActionButton
                    label={primary.label}
                    icon={PenLine}
                    onClick={() => onCommand(primary.command, primary.mode)}
                  />
                ) : null}
                {journal && onCommand ? (
                  <GuideActionButton
                    label="Journal"
                    icon={StickyNote}
                    onClick={() => onCommand(journal.command, journal.mode)}
                  />
                ) : null}
              </span>
            </li>
          );
        })}
        {overflowFiles > 0 ? (
          <li className="rounded-sm border border-border/60 bg-background/45 px-1.5 py-1 font-mono text-[10px] text-muted-foreground">
            +{overflowFiles} more SDD {overflowFiles === 1 ? "doc" : "docs"}
          </li>
        ) : null}
      </ul>
    </section>
  );
}

function GuideActionButton({
  label,
  icon: Icon,
  onClick,
}: {
  label: string;
  icon: typeof StickyNote;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-5 min-w-0 items-center gap-1 rounded-sm border border-border/60 bg-background/70 px-1.5 font-mono text-[10px] text-foreground/80 hover:bg-muted"
    >
      <Icon size={10} aria-hidden />
      <span className="truncate">{label}</span>
    </button>
  );
}

function FilePill({
  file,
  onOpen,
  truncate = false,
}: {
  file: ModifiedFile;
  onOpen: (path: string, line?: number) => void;
  /**
   * When true, the visible basename is bounded with `max-w-[160px] truncate`
   * so long realistic monorepo paths don't blow out the row at narrow sidebar
   * widths. The tooltip (`title`) and screen-reader label (`aria-label`) always
   * carry the full path regardless, so no information is lost.
   */
  truncate?: boolean;
}) {
  const basename = file.path.split("/").pop() || file.path;
  const dotClass =
    file.status === "running"
      ? "bg-afx-brand-soft animate-pulse"
      : file.status === "error"
        ? "bg-amber-500"
        : "bg-muted-foreground/40";
  const lineSuffix = file.line !== undefined ? `:${file.line}` : "";
  const titleHint =
    file.line !== undefined
      ? `${file.path}:${file.line}\nClick to open in editor at line ${file.line}`
      : `${file.path}\nClick to open in editor`;
  const ariaLabel =
    file.line !== undefined ? `Open ${file.path} at line ${file.line}` : `Open ${file.path}`;
  return (
    <button
      type="button"
      onClick={() => onOpen(file.path, file.line)}
      title={titleHint}
      aria-label={ariaLabel}
      data-testid="files-panel-pill"
      data-status={file.status}
      data-truncated={truncate}
      className={cn(
        "group inline-flex items-center gap-1 rounded-sm border border-border/60 bg-card/40 px-1.5 py-0.5 text-[11px] text-foreground/90",
        "hover:bg-muted hover:text-foreground",
      )}
    >
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dotClass)} />
      <span
        className={cn(
          "inline-flex items-baseline gap-0 font-mono",
          truncate && "min-w-0 max-w-[160px]",
        )}
      >
        <span className={cn(truncate && "truncate")}>{basename}</span>
        {lineSuffix && <span className="shrink-0 text-muted-foreground/70">{lineSuffix}</span>}
      </span>
    </button>
  );
}
