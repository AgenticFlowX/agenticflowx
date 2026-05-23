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

import { ChevronDown } from "lucide-react";

import { cn } from "@afx/ui/lib/utils";

import type { ModifiedFile } from "../lib/derive-modified-files";

export const THRESHOLD = 4;

export interface FilesPanelBodyProps {
  files: readonly ModifiedFile[];
  onOpenFile: (path: string, line?: number) => void;
}

export function FilesPanelBody({ files, onOpenFile }: FilesPanelBodyProps) {
  const [expanded, setExpanded] = useState(false);
  const overflow = files.length - THRESHOLD;
  const truncatable = overflow > 0;
  const visible = !truncatable || expanded ? files : files.slice(0, THRESHOLD);
  // Bound the basename width in compact mode so long realistic AFX paths
  // (e.g. `chat-controller-with-very-long-name.tsx`, ~280px at 11px monospace)
  // don't push each pill onto its own row at narrow sidebar widths (~360px),
  // defeating the ≤2-wrap-line goal. Expanded mode shows full basenames.
  // Tooltip and aria-label always carry the full path regardless.
  const truncatePill = truncatable && !expanded;

  return (
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
