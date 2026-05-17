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
  onInsert?: (command: string, action: ParsedResultAction) => void;
  onDismiss?: () => void;
}

export function ResultActions({ actions, onSend, onInsert, onDismiss }: ResultActionsProps) {
  if (actions.length === 0) return null;
  const visibleActions = actions.slice(0, 3);

  return (
    <TooltipProvider delayDuration={250}>
      <div
        aria-label="Next actions"
        data-testid="result-actions-row"
        className="my-2 w-full max-w-full text-[11px] text-muted-foreground/70"
      >
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="shrink-0 text-[10px] font-medium uppercase text-muted-foreground/75">
            Run next
          </span>
          {onDismiss ? (
            <button
              type="button"
              onClick={onDismiss}
              className="inline-flex h-5 w-5 items-center justify-center rounded-sm text-muted-foreground/60 hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              aria-label="Dismiss next actions"
            >
              ×
            </button>
          ) : null}
        </div>
        <div className="grid max-w-full grid-cols-1 gap-1 sm:grid-cols-3">
          {visibleActions.map((action) => (
            <ResultActionButton
              key={action.command}
              action={action}
              onSend={onSend}
              onInsert={onInsert}
            />
          ))}
        </div>
      </div>
    </TooltipProvider>
  );
}

function ResultActionButton({
  action,
  onSend,
  onInsert,
}: {
  action: ParsedResultAction;
  onSend?: (command: string, action: ParsedResultAction) => void;
  onInsert?: (command: string, action: ParsedResultAction) => void;
}) {
  const runNow = action.status === "supported" && action.autoSend;
  const canRun = runNow && onSend != null;
  const canInsert = !runNow && action.status !== "unknown" && onInsert != null;
  const isAvailable = canRun || canInsert;
  const modeLabel = runNow ? "run" : "insert";
  const actionVerb = runNow ? "Run" : "Insert";

  function handleClick() {
    if (canRun) {
      onSend(action.command, action);
      return;
    }
    if (canInsert) {
      onInsert(action.command, action);
    }
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={handleClick}
          aria-label={`${actionVerb} ${action.label}: ${action.command}`}
          aria-disabled={!isAvailable}
          data-testid="result-action-button"
          data-status={action.status}
          data-group={action.group}
          data-mode={modeLabel}
          className={cn(
            "flex h-9 min-w-0 max-w-full items-center gap-1.5 rounded-md border border-border/65 bg-background/85 px-2 text-left",
            "font-mono text-foreground/90 shadow-sm transition-colors hover:border-border hover:bg-muted/60 hover:text-foreground",
            "active:translate-y-px focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            !isAvailable
              ? "cursor-not-allowed opacity-55 shadow-none hover:border-border/65 hover:bg-background/85 active:translate-y-0"
              : "",
          )}
        >
          <span className="min-w-0 max-w-[7.5rem] shrink-0 truncate font-sans text-[11px] font-semibold text-primary">
            {action.label}
          </span>
          <span aria-hidden className="h-3 w-px shrink-0 bg-border/70" />
          <span className="block min-w-0 flex-1 truncate text-[10.5px] leading-tight text-foreground/78">
            {action.command}
          </span>
          <span className="shrink-0 rounded-[3px] bg-muted/45 px-1 py-0.5 font-sans text-[8px] uppercase text-muted-foreground/70">
            {runNow ? "Run" : "Draft"}
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" align="start" className="max-w-[240px] text-left">
        <span className="flex flex-col gap-1">
          <span className="font-medium">{action.label}</span>
          <span className="text-[11px] leading-snug opacity-85">
            {runNow
              ? "Click runs this command now."
              : "Click inserts this command into the composer."}
          </span>
          <span className="break-words font-mono text-[10px] opacity-75">{action.command}</span>
          <span className="font-mono text-[9px] uppercase opacity-70">
            {isAvailable ? (runNow ? "Run now" : "Insert draft") : "Unavailable"}
          </span>
        </span>
      </TooltipContent>
    </Tooltip>
  );
}
