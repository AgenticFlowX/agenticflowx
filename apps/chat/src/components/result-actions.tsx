/**
 * ResultActions — subtle follow-up buttons parsed from AFX output.
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-16]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-STRIP]
 */
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@afx/ui/components/tooltip";
import { cn } from "@afx/ui/lib/utils";

import type { ParsedResultAction } from "../lib/result-actions";

export interface ResultActionsProps {
  actions: readonly ParsedResultAction[];
  onSend?: (command: string, action: ParsedResultAction) => void;
  onDismiss?: () => void;
}

export function ResultActions({ actions, onSend, onDismiss }: ResultActionsProps) {
  if (actions.length === 0) return null;
  const groups = groupResultActions(actions);

  return (
    <TooltipProvider delayDuration={250}>
      <div
        aria-label="Next actions"
        data-testid="result-actions-row"
        className="my-2.5 flex max-w-full flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground/70"
      >
        <span className="mr-0.5 shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">
          Run next
        </span>
        {groups.map((group, index) => (
          <div key={group.group} className="inline-flex max-w-full flex-wrap items-center gap-1">
            {index > 0 ? (
              <span aria-hidden className="sr-only">
                ,{" "}
              </span>
            ) : null}
            <span className="sr-only">{group.label}</span>
            {group.actions.map((action) => (
              <ResultActionButton key={action.command} action={action} onSend={onSend} />
            ))}
          </div>
        ))}
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            className="ml-0.5 inline-flex h-5 w-5 items-center justify-center rounded-sm text-muted-foreground/60 hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            aria-label="Dismiss next actions"
          >
            ×
          </button>
        ) : null}
      </div>
    </TooltipProvider>
  );
}

function ResultActionButton({
  action,
  onSend,
}: {
  action: ParsedResultAction;
  onSend?: (command: string, action: ParsedResultAction) => void;
}) {
  const canSend = action.status === "supported" && onSend != null;
  const modeLabel = canSend ? "send" : "unavailable";

  function handleClick() {
    if (!canSend) return;
    onSend(action.command, action);
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={handleClick}
          aria-label={`${action.label}: ${action.command}`}
          aria-disabled={!canSend}
          data-testid="result-action-button"
          data-status={action.status}
          data-group={action.group}
          data-mode={modeLabel}
          className={cn(
            "inline-flex h-7 max-w-full items-center gap-1.5 rounded-md border border-border/65 bg-background/85 px-2.5 text-[11px]",
            "font-mono text-foreground/90 shadow-sm transition-colors hover:border-border hover:bg-muted/60 hover:text-foreground",
            "active:translate-y-px focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            !canSend
              ? "cursor-not-allowed opacity-55 shadow-none hover:border-border/65 hover:bg-background/85 active:translate-y-0"
              : "",
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
            {canSend ? "Click sends this command now." : "This command cannot be sent directly."}
          </span>
          <span className="font-mono text-[10px] opacity-75">{action.command}</span>
          <span className="font-mono text-[9px] uppercase opacity-70">
            {canSend ? "Run now" : "Unavailable"}
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
