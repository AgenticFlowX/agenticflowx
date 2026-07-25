/**
 * Chat top action bar.
 *
 * @see docs/specs/216-app-chat-window-componentization/design.md [DES-UI] [DES-FILES]
 * @see docs/specs/900-fleet/17-release-hardening-pi-features/17-release-hardening-pi-features.md [FR-20] [FR-21] [FR-23]
 */
import { type FormEvent, type ReactNode, memo, useState } from "react";

import { ChevronDown, Download, Layers, MessageSquarePlus, Pencil, RefreshCw } from "lucide-react";

import type { AgentRuntimeStatus, AgentStatus } from "@afx/shared";
import { Popover, PopoverContent, PopoverTrigger } from "@afx/ui/components/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@afx/ui/components/tooltip";
import { cn } from "@afx/ui/lib/utils";

import type { MemoryCatalogItem } from "../../lib/doc-actions";
import { ChatMemoryMenuButton } from "../chat-memory-menu-button";

export type ChatTopBarRuntime = Pick<
  AgentStatus,
  | "thinkingLevel"
  | "steeringMode"
  | "followUpMode"
  | "autoCompactionEnabled"
  | "autoRetryEnabled"
  | "isCompacting"
  | "sessionId"
  | "sessionName"
  | "messageCount"
  | "pendingMessageCount"
  | "rpcEnabled"
>;

export interface ChatTopBarProps {
  checking?: boolean;
  status: AgentRuntimeStatus;
  runtime: ChatTopBarRuntime;
  onNewSession?: () => void;
  onCompact?: () => void;
  /** Compact with optional focus instructions for the summary. */
  onCompactWithInstructions?: (instructions: string) => void;
  onRenameSession?: (name: string) => void;
  onExportSession?: () => void;
  onMemorySelect: (item: MemoryCatalogItem) => void;
  onRestartAgent?: () => void;
  /** Reserved slot for future top-bar actions such as history load/export. */
  extraActions?: ReactNode;
}

const ICON_BUTTON_CLASS =
  "inline-flex h-5 w-5 items-center justify-center rounded-sm text-muted-foreground/70 hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40";

export const ChatTopBar = memo(function ChatTopBar({
  checking,
  status,
  runtime,
  onNewSession,
  onCompact,
  onCompactWithInstructions,
  onRenameSession,
  onExportSession,
  onMemorySelect,
  onRestartAgent,
  extraActions,
}: ChatTopBarProps) {
  const isDisconnected = status.phase === "disconnected" || status.phase === "error";

  return (
    <div
      role="toolbar"
      aria-label="Chat actions"
      className="flex h-7 shrink-0 items-center justify-end gap-1 border-b bg-card/30 px-2"
    >
      <TooltipProvider>
        <div className="flex shrink-0 items-center gap-0.5">
          <ChatMemoryMenuButton onSelect={onMemorySelect} side="bottom" align="end" />
          {extraActions}
          {onRenameSession ? (
            <RenameSessionButton
              sessionName={runtime.sessionName}
              disabled={checking || isDisconnected}
              onRename={onRenameSession}
            />
          ) : null}
          {onExportSession ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onExportSession}
                  disabled={checking || isDisconnected}
                  className={ICON_BUTTON_CLASS}
                  aria-label="Export transcript"
                >
                  <Download size={12} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Export transcript to a file</TooltipContent>
            </Tooltip>
          ) : null}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onCompact}
                disabled={isCompactDisabled(status, runtime)}
                className={ICON_BUTTON_CLASS}
                aria-label="Compact session"
              >
                <Layers size={12} className={cn(runtime.isCompacting && "animate-pulse")} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{getCompactTooltip(status, runtime)}</TooltipContent>
          </Tooltip>
          {onCompactWithInstructions ? (
            <CompactOptionsButton
              disabled={isCompactDisabled(status, runtime)}
              onCompact={onCompactWithInstructions}
            />
          ) : null}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onNewSession}
                disabled={checking || isDisconnected}
                className={ICON_BUTTON_CLASS}
                aria-label="New session"
              >
                <MessageSquarePlus size={12} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">New session</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onRestartAgent}
                className="-mr-1 inline-flex h-5 w-5 items-center justify-center rounded-sm text-muted-foreground/70 hover:bg-muted hover:text-foreground"
                aria-label="Restart agent"
              >
                <RefreshCw size={11} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Restart agent</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </div>
  );
});

/**
 * Pencil popover for renaming the active session. The host confirms the new
 * name through the runtime-settings broadcast, so the popover closes
 * optimistically on submit.
 */
function RenameSessionButton({
  sessionName,
  disabled,
  onRename,
}: {
  sessionName?: string;
  disabled?: boolean;
  onRename: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  function handleOpenChange(nextOpen: boolean): void {
    setOpen(nextOpen);
    if (nextOpen) setName(sessionName ?? "");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length === 0) return;
    onRename(trimmed);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              type="button"
              disabled={disabled}
              className={ICON_BUTTON_CLASS}
              aria-label="Rename session"
            >
              <Pencil size={11} />
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">Rename session</TooltipContent>
      </Tooltip>
      <PopoverContent side="bottom" align="end" className="w-60 p-2">
        <form onSubmit={handleSubmit} className="flex flex-col gap-1.5">
          <label
            htmlFor="afx-rename-session-input"
            className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground"
          >
            Session name
          </label>
          <input
            id="afx-rename-session-input"
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
            placeholder="Name this session"
            autoFocus
            className="h-6 rounded-sm border border-border/70 bg-background px-1.5 text-[11px] text-foreground outline-none focus-visible:border-ring"
          />
          <button
            type="submit"
            disabled={name.trim().length === 0}
            className="self-end rounded-sm border border-border/70 px-2 py-0.5 text-[10px] font-medium text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
          >
            Rename
          </button>
        </form>
      </PopoverContent>
    </Popover>
  );
}

/** Chevron popover next to Compact for optional summary focus instructions. */
function CompactOptionsButton({
  disabled,
  onCompact,
}: {
  disabled?: boolean;
  onCompact: (instructions: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [instructions, setInstructions] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    onCompact(instructions);
    setInstructions("");
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              type="button"
              disabled={disabled}
              className="-ml-1 inline-flex h-5 w-3 items-center justify-center rounded-sm text-muted-foreground/70 hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Compact with focus"
            >
              <ChevronDown size={10} />
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">Compact with focus instructions</TooltipContent>
      </Tooltip>
      <PopoverContent side="bottom" align="end" className="w-64 p-2">
        <form onSubmit={handleSubmit} className="flex flex-col gap-1.5">
          <label
            htmlFor="afx-compact-focus-input"
            className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground"
          >
            What should the summary keep?
          </label>
          <input
            id="afx-compact-focus-input"
            value={instructions}
            onChange={(event) => setInstructions(event.currentTarget.value)}
            placeholder="e.g. decisions about the parser rewrite"
            autoFocus
            className="h-6 rounded-sm border border-border/70 bg-background px-1.5 text-[11px] text-foreground outline-none focus-visible:border-ring"
          />
          <button
            type="submit"
            className="self-end rounded-sm border border-border/70 px-2 py-0.5 text-[10px] font-medium text-foreground hover:bg-muted"
          >
            Compact
          </button>
        </form>
      </PopoverContent>
    </Popover>
  );
}

function isCompactDisabled(status: AgentRuntimeStatus, runtime: ChatTopBarRuntime): boolean {
  return !status.running || status.isStreaming || runtime.isCompacting === true;
}

function getCompactTooltip(status: AgentRuntimeStatus, runtime: ChatTopBarRuntime): string {
  if (runtime.isCompacting) return "Compacting…";
  if (status.isStreaming) return "Wait for the active turn to finish";
  return "Compact session";
}
