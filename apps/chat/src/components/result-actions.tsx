/**
 * ResultActions — composer-adjacent follow-up buttons parsed from AFX output.
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-15]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-STRIP]
 */
import { type MouseEvent } from "react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@afx/ui/components/tooltip";
import { cn } from "@afx/ui/lib/utils";

import type { ParsedResultAction } from "../lib/result-actions";
import { ComposerStrip } from "./composer-strip";

export interface ResultActionsProps {
  actions: readonly ParsedResultAction[];
  onDraft: (command: string, action: ParsedResultAction) => void;
  onSend?: (command: string, action: ParsedResultAction) => void;
  onDismiss?: () => void;
}

export function ResultActions({ actions, onDraft, onSend, onDismiss }: ResultActionsProps) {
  if (actions.length === 0) return null;
  const groups = groupResultActions(actions);

  return (
    <ComposerStrip title="Next" count={actions.length} tone="brand" onDismiss={onDismiss}>
      <TooltipProvider delayDuration={250}>
        <div className="flex flex-wrap items-center gap-1.5">
          {groups.map((group, index) => (
            <div key={group.group} className="inline-flex flex-wrap items-center gap-1">
              {index > 0 ? (
                <span aria-hidden className="mx-0.5 h-4 w-px shrink-0 bg-border/80" />
              ) : null}
              <span className="sr-only">{group.label}</span>
              {group.actions.map((action) => (
                <ResultActionButton
                  key={action.command}
                  action={action}
                  onDraft={onDraft}
                  onSend={onSend}
                />
              ))}
            </div>
          ))}
        </div>
      </TooltipProvider>
    </ComposerStrip>
  );
}

function ResultActionButton({
  action,
  onDraft,
  onSend,
}: {
  action: ParsedResultAction;
  onDraft: (command: string, action: ParsedResultAction) => void;
  onSend?: (command: string, action: ParsedResultAction) => void;
}) {
  const canSend = action.status === "supported" && onSend != null;
  const modeLabel = action.autoSend && canSend ? "send" : "draft";

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    if (canSend && (action.autoSend || event.shiftKey)) {
      onSend(action.command, action);
      return;
    }

    onDraft(action.command, action);
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={handleClick}
          aria-label={`${action.label}: ${action.command}`}
          data-testid="result-action-button"
          data-status={action.status}
          data-group={action.group}
          data-mode={modeLabel}
          className={cn(
            "inline-flex max-w-full items-center gap-1 rounded-sm border border-border/60 bg-card/40 px-1.5 py-0.5 text-[11px]",
            "font-mono text-foreground/90 hover:bg-muted hover:text-foreground",
            action.autoSend && canSend ? "border-afx-brand-soft/50" : "",
          )}
        >
          <span className="font-sans text-[10px] font-medium text-muted-foreground">
            {action.label}
          </span>
          <span className="max-w-[18rem] truncate">{action.command}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" align="start" className="max-w-[240px] text-left">
        <span className="flex flex-col gap-1">
          <span className="font-medium">{action.label}</span>
          <span className="text-[11px] leading-snug opacity-85">
            {canSend ? "Click drafts or sends by command policy." : "Click inserts into draft."}
          </span>
          <span className="font-mono text-[10px] opacity-75">{action.command}</span>
          <span className="font-mono text-[9px] uppercase opacity-70">
            {canSend ? "Shift-click sends now" : "Draft only"}
          </span>
        </span>
      </TooltipContent>
    </Tooltip>
  );
}

function groupResultActions(actions: readonly ParsedResultAction[]) {
  const order = ["quality", "state", "action", "memory", "research", "global", "unknown"];
  return order
    .map((group) => ({
      group,
      label: group.charAt(0).toUpperCase() + group.slice(1),
      actions: actions.filter((action) => action.group === group),
    }))
    .filter((group) => group.actions.length > 0);
}
