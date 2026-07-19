/**
 * FilesPanel — a compact, composer-adjacent inventory of the latest files
 * modified by the agent. Two standard files stay on the surface; the complete
 * inventory and inspection actions are rendered in portalled popovers so a
 * large edit batch never grows the composer stack.
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-10] [NFR-5] [NFR-7]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-FILES-STRIP]
 */
import { Fragment, type ReactNode, type Ref, useRef, useState } from "react";

import {
  BookOpenCheck,
  ChevronDown,
  ExternalLink,
  GitCompare,
  Layers3,
  MoreHorizontal,
  StickyNote,
} from "lucide-react";

import {
  classifySddDocumentPath,
  isMarkdownPath,
  sddJournalActionForPath,
  sddPrimaryActionForPath,
} from "@afx/shared";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@afx/ui/components/dropdown-menu";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@afx/ui/components/popover";
import { cn } from "@afx/ui/lib/utils";

import type { ModifiedFile } from "../lib/derive-modified-files";

export const COMPACT_FILE_LIMIT = 2;
const FILE_ACTION_HOVER_GRACE_MS = 300;

export interface FilesPanelBodyProps {
  files: readonly ModifiedFile[];
  onOpenFile: (path: string, line?: number) => void;
  onOpenPreview?: (path: string) => void;
  onOpenGitChanges?: (path: string) => void;
  onOpenWorkbench?: () => void;
  onCommand?: (command: string, mode?: "insert" | "send") => void;
}

export function FilesPanelBody({
  files,
  onOpenFile,
  onOpenPreview,
  onOpenGitChanges,
  onOpenWorkbench,
  onCommand,
}: FilesPanelBodyProps) {
  const standardFiles = files.filter((file) => !classifySddDocumentPath(file.path));
  const sddFiles = files.filter((file) => classifySddDocumentPath(file.path));
  const compactFiles = standardFiles.slice(0, COMPACT_FILE_LIMIT);
  const labels = shortestUniquePathLabels(files.map((file) => file.path));
  const needsAllFiles = files.length > compactFiles.length;

  const allFiles = needsAllFiles ? (
    <AllFilesPopover
      files={files}
      standardFiles={standardFiles}
      sddFiles={sddFiles}
      labels={labels}
      onOpenFile={onOpenFile}
      onOpenPreview={onOpenPreview}
      onOpenGitChanges={onOpenGitChanges}
    />
  ) : null;

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      {compactFiles.length > 0 ? (
        <ul
          data-testid="files-panel-compact-list"
          className="flex min-w-0 flex-nowrap items-center gap-1 overflow-visible"
        >
          {compactFiles.map((file) => (
            <li key={file.path} className="min-w-0 flex-1 basis-0 min-[480px]:max-w-56">
              <CompactFileControl
                file={file}
                label={labels.get(file.path) ?? file.path}
                onOpenFile={onOpenFile}
                onOpenPreview={onOpenPreview}
                onOpenGitChanges={onOpenGitChanges}
              />
            </li>
          ))}
          {allFiles ? <li className="shrink-0">{allFiles}</li> : null}
        </ul>
      ) : null}
      {sddFiles.length > 0 ? (
        <SddModifiedGuide
          files={sddFiles}
          allFiles={standardFiles.length === 0 ? allFiles : null}
          onOpenPreview={onOpenPreview}
          onOpenWorkbench={onOpenWorkbench}
          onCommand={onCommand}
        />
      ) : null}
    </div>
  );
}

function CompactFileControl({
  file,
  label,
  onOpenFile,
  onOpenPreview,
  onOpenGitChanges,
}: {
  file: ModifiedFile;
  label: string;
  onOpenFile: (path: string, line?: number) => void;
  onOpenPreview?: (path: string) => void;
  onOpenGitChanges?: (path: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const firstActionRef = useRef<HTMLButtonElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const passivelyOpenedRef = useRef(false);

  const cancelClose = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };
  const openPassively = () => {
    cancelClose();
    passivelyOpenedRef.current = true;
    setOpen(true);
  };
  const scheduleClose = () => {
    cancelClose();
    // Radix may still be settling the portalled surface while the pointer
    // crosses the small gap above the chip. Keep a deliberate grace window so
    // normal pointer travel (and assistive pointer dwell) cannot tear down the
    // target before it is actionable.
    closeTimerRef.current = setTimeout(() => setOpen(false), FILE_ACTION_HOVER_GRACE_MS);
  };
  const close = () => {
    cancelClose();
    setOpen(false);
  };
  const restoreTrigger = () => {
    close();
    requestAnimationFrame(() => triggerRef.current?.focus());
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div
          data-testid="files-panel-chip"
          className={cn(
            "group flex min-w-0 max-w-full items-stretch rounded-sm border border-border/60 bg-card/40 text-[11px] text-foreground/90",
            "hover:border-border hover:bg-muted/80 focus-within:border-afx-brand/60 focus-within:ring-1 focus-within:ring-afx-brand/50",
          )}
          onPointerEnter={openPassively}
          onPointerLeave={scheduleClose}
          onFocusCapture={(event) => {
            if (!triggerRef.current?.contains(event.target)) openPassively();
          }}
          onKeyDownCapture={(event) => {
            if (event.key === "Escape" && open) {
              event.preventDefault();
              if (document.activeElement === triggerRef.current) restoreTrigger();
              else close();
            }
          }}
        >
          <FileSourceButton
            file={file}
            label={label}
            compact
            onOpen={() => {
              close();
              onOpenFile(file.path, file.line);
            }}
          />
          <PopoverTrigger asChild>
            <button
              ref={triggerRef}
              type="button"
              aria-label={`Actions for ${file.path}`}
              onPointerDown={() => {
                // Hover can open the surface before the explicit trigger is
                // pressed. Close that passive instance first so Radix treats
                // the ensuing click as an intentional open, not a toggle-off.
                if (open && passivelyOpenedRef.current) {
                  passivelyOpenedRef.current = false;
                  setOpen(false);
                }
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  passivelyOpenedRef.current = false;
                  requestAnimationFrame(() => firstActionRef.current?.focus());
                }
              }}
              className={cn(
                "inline-flex w-6 shrink-0 items-center justify-center border-l border-border/50 text-muted-foreground",
                "hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-afx-brand",
              )}
            >
              <MoreHorizontal size={11} aria-hidden />
            </button>
          </PopoverTrigger>
        </div>
      </PopoverAnchor>
      <PopoverContent
        role="dialog"
        aria-label={`Actions for ${file.path}`}
        align="start"
        side="top"
        className="w-auto min-w-44 gap-1 p-1 motion-reduce:animate-none"
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
        onPointerEnter={cancelClose}
        onPointerLeave={scheduleClose}
        onFocusCapture={cancelClose}
        onEscapeKeyDown={(event) => {
          event.preventDefault();
          restoreTrigger();
        }}
      >
        <FileActionButtons
          file={file}
          firstActionRef={firstActionRef}
          onOpenFile={() => {
            close();
            onOpenFile(file.path, file.line);
          }}
          onOpenPreview={
            onOpenPreview
              ? () => {
                  close();
                  onOpenPreview(file.path);
                }
              : undefined
          }
          onOpenGitChanges={
            onOpenGitChanges
              ? () => {
                  close();
                  onOpenGitChanges(file.path);
                }
              : undefined
          }
        />
      </PopoverContent>
    </Popover>
  );
}

function FileSourceButton({
  file,
  label,
  compact = false,
  onOpen,
}: {
  file: ModifiedFile;
  label: string;
  compact?: boolean;
  onOpen: () => void;
}) {
  const statusText =
    file.status === "running" ? ", updating" : file.status === "error" ? ", needs attention" : "";
  const lineText = file.line !== undefined ? `:${file.line}` : "";
  const ariaLabel = `Open ${file.path}${file.line !== undefined ? ` at line ${file.line}` : ""}${statusText}`;
  const dotClass =
    file.status === "running"
      ? "bg-afx-brand-soft animate-pulse motion-reduce:animate-none"
      : file.status === "error"
        ? "bg-amber-500"
        : "bg-muted-foreground/40";

  return (
    <button
      type="button"
      data-testid={compact ? "files-panel-pill" : undefined}
      data-status={file.status}
      aria-label={ariaLabel}
      title={ariaLabel}
      onClick={onOpen}
      className={cn(
        "flex min-w-0 items-center gap-1 text-left font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-afx-brand",
        compact ? "flex-1 px-1.5 py-0.5" : "px-1 py-1",
      )}
    >
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dotClass)} aria-hidden />
      <span className="min-w-0 truncate">{label}</span>
      {lineText ? <span className="shrink-0 text-muted-foreground/70">{lineText}</span> : null}
    </button>
  );
}

function FileActionButtons({
  file,
  firstActionRef,
  inline = false,
  onOpenFile,
  onOpenPreview,
  onOpenGitChanges,
}: {
  file: ModifiedFile;
  firstActionRef?: Ref<HTMLButtonElement>;
  inline?: boolean;
  onOpenFile: () => void;
  onOpenPreview?: () => void;
  onOpenGitChanges?: () => void;
}) {
  const buttonClass = cn(
    "inline-flex items-center justify-center gap-1 rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-afx-brand",
    inline ? "h-6 w-6" : "h-7 justify-start px-2 text-[11px]",
  );

  return (
    <div className={cn("flex", inline ? "shrink-0 items-center gap-0.5" : "flex-col gap-0.5")}>
      <button
        ref={firstActionRef}
        type="button"
        aria-label="Open source"
        title="Open source"
        className={buttonClass}
        onClick={onOpenFile}
      >
        <ExternalLink size={11} aria-hidden />
        {!inline ? <span>Open source</span> : null}
      </button>
      {isMarkdownPath(file.path) && onOpenPreview ? (
        <button
          type="button"
          aria-label="AFX Preview"
          title="AFX Preview"
          className={buttonClass}
          onClick={onOpenPreview}
        >
          <BookOpenCheck size={11} aria-hidden />
          {!inline ? <span>AFX Preview</span> : null}
        </button>
      ) : null}
      {onOpenGitChanges ? (
        <button
          type="button"
          aria-label="Git changes"
          title="Git changes"
          className={buttonClass}
          onClick={onOpenGitChanges}
        >
          <GitCompare size={11} aria-hidden />
          {!inline ? <span>Git changes</span> : null}
        </button>
      ) : null}
    </div>
  );
}

function AllFilesPopover({
  files,
  standardFiles,
  sddFiles,
  labels,
  onOpenFile,
  onOpenPreview,
  onOpenGitChanges,
}: {
  files: readonly ModifiedFile[];
  standardFiles: readonly ModifiedFile[];
  sddFiles: readonly ModifiedFile[];
  labels: ReadonlyMap<string, string>;
  onOpenFile: (path: string, line?: number) => void;
  onOpenPreview?: (path: string) => void;
  onOpenGitChanges?: (path: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-testid="files-panel-all-trigger"
          aria-label={`Show all ${files.length} modified files`}
          className={cn(
            "inline-flex h-[22px] shrink-0 items-center gap-1 rounded-sm border border-border/60 bg-card/40 px-1.5 font-mono text-[10px] text-foreground/80",
            "hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-afx-brand",
          )}
        >
          <ChevronDown size={10} className="motion-reduce:transition-none" aria-hidden />
          <span>All {files.length}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        role="dialog"
        aria-label={`All ${files.length} modified files`}
        align="end"
        side="top"
        className="max-h-[min(45vh,320px)] w-[min(32rem,calc(100vw-1rem))] gap-2 overflow-y-auto p-2 motion-reduce:animate-none"
      >
        {standardFiles.length > 0 ? (
          <AllFilesGroup
            title={`Files · ${standardFiles.length}`}
            files={standardFiles}
            labels={labels}
            onOpenFile={(path, line) => {
              setOpen(false);
              onOpenFile(path, line);
            }}
            onOpenPreview={
              onOpenPreview
                ? (path) => {
                    setOpen(false);
                    onOpenPreview(path);
                  }
                : undefined
            }
            onOpenGitChanges={
              onOpenGitChanges
                ? (path) => {
                    setOpen(false);
                    onOpenGitChanges(path);
                  }
                : undefined
            }
          />
        ) : null}
        {sddFiles.length > 0 ? (
          <AllFilesGroup
            title={`SDD · ${sddFiles.length}`}
            files={sddFiles}
            labels={labels}
            onOpenFile={(path, line) => {
              setOpen(false);
              onOpenFile(path, line);
            }}
            onOpenPreview={
              onOpenPreview
                ? (path) => {
                    setOpen(false);
                    onOpenPreview(path);
                  }
                : undefined
            }
            onOpenGitChanges={
              onOpenGitChanges
                ? (path) => {
                    setOpen(false);
                    onOpenGitChanges(path);
                  }
                : undefined
            }
          />
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

function AllFilesGroup({
  title,
  files,
  labels,
  onOpenFile,
  onOpenPreview,
  onOpenGitChanges,
}: {
  title: string;
  files: readonly ModifiedFile[];
  labels: ReadonlyMap<string, string>;
  onOpenFile: (path: string, line?: number) => void;
  onOpenPreview?: (path: string) => void;
  onOpenGitChanges?: (path: string) => void;
}) {
  return (
    <section className="min-w-0">
      <h3 className="px-1 pb-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
        {title}
      </h3>
      <ul className="flex min-w-0 flex-col gap-0.5">
        {files.map((file) => (
          <li
            key={file.path}
            data-testid="files-panel-all-row"
            className="flex min-w-0 items-center rounded-sm border border-transparent hover:border-border/50 hover:bg-muted/50 focus-within:bg-muted/50"
          >
            <div className="min-w-0 flex-1">
              <FileSourceButton
                file={file}
                label={labels.get(file.path) ?? file.path}
                onOpen={() => onOpenFile(file.path, file.line)}
              />
            </div>
            <FileActionButtons
              file={file}
              inline
              onOpenFile={() => onOpenFile(file.path, file.line)}
              onOpenPreview={onOpenPreview ? () => onOpenPreview(file.path) : undefined}
              onOpenGitChanges={onOpenGitChanges ? () => onOpenGitChanges(file.path) : undefined}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

function SddModifiedGuide({
  files,
  allFiles,
  onOpenPreview,
  onOpenWorkbench,
  onCommand,
}: {
  files: readonly ModifiedFile[];
  allFiles?: ReactNode;
  onOpenPreview?: (path: string) => void;
  onOpenWorkbench?: () => void;
  onCommand?: (command: string, mode?: "insert" | "send") => void;
}) {
  const settledFiles = files.filter((file) => file.status === "ok");
  const previewFile = settledFiles[0];
  const actionGroups = sddActionGroups(settledFiles);
  const journalAction = previewFile ? sddJournalActionForPath(previewFile.path) : null;
  const journalOwner = previewFile ? sddActionOwner(previewFile.path) : null;
  const ownerLabels = shortestUniquePathLabels([
    ...actionGroups.map((group) => group.owner),
    ...(journalOwner && !actionGroups.some((group) => group.owner === journalOwner)
      ? [journalOwner]
      : []),
  ]);
  const status = files.some((file) => file.status === "error")
    ? "error"
    : files.some((file) => file.status === "running")
      ? "running"
      : "ok";
  const statusText =
    status === "running" ? "updating" : status === "error" ? "needs attention" : "updated";

  return (
    <section
      data-testid="sdd-modified-guide"
      data-status={status}
      aria-label={`SDD · ${files.length} ${files.length === 1 ? "doc" : "docs"}, ${statusText}`}
      className="flex min-w-0 items-center gap-1 border-t border-border/50 pt-1"
    >
      <div className="flex min-w-0 flex-1 items-center gap-1" aria-live="polite">
        <StickyNote
          size={11}
          className={cn(
            "shrink-0",
            status === "running"
              ? "text-afx-brand-soft"
              : status === "error"
                ? "text-amber-500"
                : "text-afx-success",
          )}
          aria-hidden
        />
        <span className="min-w-0 truncate font-mono text-[10px] uppercase tracking-[0.1em] text-afx-brand-soft">
          SDD{" "}
          <span className="text-muted-foreground">
            · {files.length} {files.length === 1 ? "doc" : "docs"}
          </span>
        </span>
        <span className="sr-only">{statusText}</span>
      </div>
      {allFiles}
      {previewFile && onOpenPreview ? (
        <GuideActionButton
          label="Preview"
          ariaLabel={`Preview ${previewFile.path}`}
          title={`Preview ${previewFile.path}`}
          icon={BookOpenCheck}
          onClick={() => onOpenPreview(previewFile.path)}
        />
      ) : null}
      {previewFile && onOpenWorkbench ? (
        <GuideActionButton
          label="Studio"
          ariaLabel="Open SDD Studio"
          icon={Layers3}
          onClick={onOpenWorkbench}
        />
      ) : null}
      {onCommand && (actionGroups.length > 0 || journalAction) ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="More SDD document actions"
              className="inline-flex h-[22px] min-w-0 shrink-0 items-center gap-1 rounded-sm px-1.5 font-mono text-[10px] text-foreground/80 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-afx-brand"
            >
              <MoreHorizontal size={10} aria-hidden />
              <span className="hidden min-[420px]:inline">More</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="max-h-[min(45vh,320px)] w-72 max-w-[calc(100vw-1rem)] overflow-y-auto motion-reduce:animate-none"
          >
            <DropdownMenuLabel className="font-mono text-[10px] uppercase tracking-[0.12em]">
              SDD actions · {actionGroups.length} {actionGroups.length === 1 ? "spec" : "specs"}
            </DropdownMenuLabel>
            {actionGroups.map((group, index) => (
              <Fragment key={group.owner}>
                {index > 0 ? <DropdownMenuSeparator /> : null}
                <DropdownMenuGroup
                  aria-label={`SDD actions for ${group.owner}`}
                  data-testid="sdd-action-group"
                >
                  <DropdownMenuLabel
                    title={group.owner}
                    className="truncate py-1 font-mono text-[9px] tracking-[0.04em] text-foreground/70"
                  >
                    {ownerLabels.get(group.owner) ?? group.owner}
                  </DropdownMenuLabel>
                  {group.actions.map((action) => (
                    <DropdownMenuItem
                      key={action.command}
                      aria-label={`${action.label} for ${group.owner}`}
                      title={`${action.label} · ${group.owner}`}
                      className="flex min-w-0 items-center justify-between gap-2 py-1.5"
                      onClick={() => onCommand(action.command, action.mode)}
                    >
                      <span className="truncate">{action.label}</span>
                      <span className="shrink-0 font-mono text-[9px] text-muted-foreground">
                        {action.documentLabel}
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
              </Fragment>
            ))}
            {actionGroups.length > 0 && journalAction ? <DropdownMenuSeparator /> : null}
            {journalAction && journalOwner ? (
              <DropdownMenuItem
                aria-label={`Journal for ${journalOwner}`}
                title={`Journal · ${journalOwner}`}
                className="flex min-w-0 items-center gap-2 py-1.5"
                onClick={() => onCommand(journalAction.command, journalAction.mode)}
              >
                <StickyNote size={11} aria-hidden />
                <span>Journal</span>
                <span className="ml-auto max-w-40 truncate font-mono text-[9px] text-muted-foreground">
                  {ownerLabels.get(journalOwner) ?? journalOwner}
                </span>
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </section>
  );
}

type SddActionKind = NonNullable<ReturnType<typeof classifySddDocumentPath>>["kind"];

interface GroupedSddAction {
  kind: SddActionKind;
  label: string;
  command: string;
  mode: "insert" | "send";
  documentLabel: string;
}

interface SddActionGroupModel {
  owner: string;
  actions: GroupedSddAction[];
}

const SDD_LIFECYCLE_ORDER: Readonly<Record<SddActionKind, number>> = {
  spec: 0,
  design: 1,
  tasks: 2,
  journal: 3,
  sprint: 0,
  adr: 0,
  research: 0,
};

/** Group actions by their owning spec while preserving latest-group recency. */
function sddActionGroups(files: readonly ModifiedFile[]): readonly SddActionGroupModel[] {
  const groups = new Map<string, SddActionGroupModel>();

  for (const file of files) {
    const info = classifySddDocumentPath(file.path);
    const action = sddPrimaryActionForPath(file.path);
    const owner = sddActionOwner(file.path);
    if (!info || !action || !owner) continue;

    const group = groups.get(owner) ?? { owner, actions: [] };
    if (!groups.has(owner)) groups.set(owner, group);
    if (group.actions.some((candidate) => candidate.command === action.command)) continue;

    group.actions.push({
      ...action,
      kind: info.kind,
      documentLabel: info.label,
    });
  }

  for (const group of groups.values()) {
    group.actions.sort(
      (left, right) => SDD_LIFECYCLE_ORDER[left.kind] - SDD_LIFECYCLE_ORDER[right.kind],
    );
  }

  return [...groups.values()];
}

/** Standard SDD files share a directory owner; singleton documents own themselves. */
function sddActionOwner(path: string): string | null {
  const info = classifySddDocumentPath(path);
  if (!info) return null;
  const normalized = info.path.replace(/\\/g, "/");

  if (
    info.kind === "spec" ||
    info.kind === "design" ||
    info.kind === "tasks" ||
    info.kind === "journal"
  ) {
    const separator = normalized.lastIndexOf("/");
    return separator >= 0
      ? normalized.slice(0, separator)
      : normalized.replace(/\.(?:md|markdown)$/i, "");
  }

  return normalized.replace(/\.(?:md|markdown)$/i, "");
}

function GuideActionButton({
  label,
  ariaLabel,
  title,
  icon: Icon,
  onClick,
}: {
  label: string;
  ariaLabel?: string;
  title?: string;
  icon: typeof StickyNote;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      title={title}
      className="inline-flex h-[22px] min-w-0 shrink-0 items-center gap-1 rounded-sm px-1.5 font-mono text-[10px] text-foreground/80 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-afx-brand"
    >
      <Icon size={10} aria-hidden />
      <span className="hidden min-[420px]:inline">{label}</span>
    </button>
  );
}

/** Return the shortest trailing path that distinguishes every input path. */
function shortestUniquePathLabels(paths: readonly string[]): ReadonlyMap<string, string> {
  const segmented = paths.map((path) => ({
    path,
    parts: path.replace(/\\/g, "/").split("/").filter(Boolean),
  }));
  return new Map(
    segmented.map(({ path, parts }, index) => {
      for (let size = 1; size <= parts.length; size += 1) {
        const suffix = parts.slice(-size).join("/");
        const unique = segmented.every((candidate, candidateIndex) => {
          if (candidateIndex === index) return true;
          return candidate.parts.slice(-size).join("/") !== suffix;
        });
        if (unique) return [path, suffix] as const;
      }
      return [path, parts.join("/") || path] as const;
    }),
  );
}
