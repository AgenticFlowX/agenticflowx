/**
 * Chat top action bar.
 *
 * @see docs/specs/216-app-chat-window-componentization/design.md [DES-UI] [DES-FILES]
 */
import { type ReactNode, memo } from "react";

import { Layers, MessageSquarePlus, RefreshCw } from "lucide-react";

import type { AgentRuntimeStatus, AgentStatus } from "@afx/shared";
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
  onMemorySelect: (item: MemoryCatalogItem) => void;
  onRestartAgent?: () => void;
  /** Reserved slot for future top-bar actions such as history load/export. */
  extraActions?: ReactNode;
}

export const ChatTopBar = memo(function ChatTopBar({
  checking,
  status,
  runtime,
  onNewSession,
  onCompact,
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
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onCompact}
                disabled={isCompactDisabled(status, runtime)}
                className="inline-flex h-5 w-5 items-center justify-center rounded-sm text-muted-foreground/70 hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Compact session"
              >
                <Layers size={12} className={cn(runtime.isCompacting && "animate-pulse")} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{getCompactTooltip(status, runtime)}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onNewSession}
                disabled={checking || isDisconnected}
                className="inline-flex h-5 w-5 items-center justify-center rounded-sm text-muted-foreground/70 hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
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

function isCompactDisabled(status: AgentRuntimeStatus, runtime: ChatTopBarRuntime): boolean {
  return !status.running || status.isStreaming || runtime.isCompacting === true;
}

function getCompactTooltip(status: AgentRuntimeStatus, runtime: ChatTopBarRuntime): string {
  if (runtime.isCompacting) return "Compacting…";
  if (status.isStreaming) return "Wait for the active turn to finish";
  return "Compact session";
}
