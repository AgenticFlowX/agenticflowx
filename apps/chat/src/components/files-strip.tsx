/**
 * FilesStrip — composer-adjacent strip listing files modified by agent
 * edit/write tool calls. Pills are clickable; click sends `chat/openFile`
 * which the host opens via `vscode.window.showTextDocument`.
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-10]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-FILES-STRIP]
 */
import { cn } from "@afx/ui/lib/utils";

import type { ModifiedFile } from "../lib/derive-modified-files";
import { ComposerStrip } from "./composer-strip";

export interface FilesStripProps {
  files: readonly ModifiedFile[];
  onOpenFile: (path: string, line?: number) => void;
  onDismiss: () => void;
}

export function FilesStrip({ files, onOpenFile, onDismiss }: FilesStripProps) {
  if (files.length === 0) return null;
  return (
    <ComposerStrip title="Modified" count={files.length} tone="neutral" onDismiss={onDismiss}>
      <ul className="flex flex-wrap gap-1">
        {files.map((f) => (
          <FilePill key={f.path} file={f} onOpen={onOpenFile} />
        ))}
      </ul>
    </ComposerStrip>
  );
}

function FilePill({
  file,
  onOpen,
}: {
  file: ModifiedFile;
  onOpen: (path: string, line?: number) => void;
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
      data-testid="files-strip-pill"
      data-status={file.status}
      className={cn(
        "group inline-flex items-center gap-1 rounded-sm border border-border/60 bg-card/40 px-1.5 py-0.5 text-[11px] text-foreground/90",
        "hover:bg-muted hover:text-foreground",
      )}
    >
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dotClass)} />
      <span className="font-mono">
        {basename}
        {lineSuffix && <span className="text-muted-foreground/70">{lineSuffix}</span>}
      </span>
    </button>
  );
}
