/** NextActionRail - ranked lifecycle actions emitted by AFX UI action blocks. */
import { cn } from "@afx/ui/lib/utils";

export type AfxUiActionMode = "run" | "insert";

export interface AfxUiAction {
  rank: number;
  label: string;
  command: string;
  mode: AfxUiActionMode;
  reason?: string;
  vocabulary?: string;
}

export interface NextActionRailProps {
  actions: readonly AfxUiAction[];
  className?: string;
  maxActions?: number;
  disabled?: boolean;
  onRun?: (command: string, action: AfxUiAction) => void;
  onInsert?: (command: string, action: AfxUiAction) => void;
}

export function NextActionRail({
  actions,
  className,
  maxActions = 3,
  disabled = false,
  onRun,
  onInsert,
}: NextActionRailProps) {
  const visibleActions = normalizeActions(actions).slice(0, Math.max(0, maxActions));
  if (visibleActions.length === 0) return null;

  return (
    <section
      aria-label="Ranked next actions"
      data-testid="next-action-rail"
      className={cn("my-2.5 flex max-w-full flex-col gap-1.5", className)}
    >
      <div className="flex items-center gap-1.5">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Run next
        </span>
        <span className="font-mono text-[10px] text-muted-foreground/60">
          <span aria-hidden="true">-</span> {visibleActions.length}
        </span>
      </div>
      <div className="grid gap-1.5 sm:grid-cols-3">
        {visibleActions.map((action) => (
          <NextActionButton
            key={`${action.rank}:${action.command}`}
            action={action}
            disabled={disabled}
            onRun={onRun}
            onInsert={onInsert}
          />
        ))}
      </div>
    </section>
  );
}

function NextActionButton({
  action,
  disabled,
  onRun,
  onInsert,
}: {
  action: AfxUiAction;
  disabled: boolean;
  onRun?: (command: string, action: AfxUiAction) => void;
  onInsert?: (command: string, action: AfxUiAction) => void;
}) {
  const handler = action.mode === "run" ? onRun : onInsert;
  const command = action.command.trim();
  const unavailable = disabled || !handler;
  const actionVerb = action.mode === "run" ? "Run" : "Insert";

  function handleClick() {
    if (unavailable || !handler) return;
    handler(command, action);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-disabled={unavailable}
      aria-label={`${actionVerb} ${action.label}: ${command}`}
      data-testid="next-action-button"
      data-mode={action.mode}
      className={cn(
        "flex min-w-0 flex-col gap-1 rounded-md border border-border/70 bg-background/85 p-2 text-left shadow-sm",
        "transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        unavailable
          ? "cursor-not-allowed opacity-55"
          : "hover:border-border hover:bg-muted/50 active:translate-y-px",
      )}
    >
      <span className="flex min-w-0 items-center gap-1.5">
        <span
          aria-hidden
          className="inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-sm bg-muted px-1 font-mono text-[10px] text-muted-foreground"
        >
          {action.rank}
        </span>
        <span className="min-w-0 truncate text-[12px] font-semibold text-foreground">
          {action.label}
        </span>
        <span className="ml-auto shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
          {actionVerb}
        </span>
      </span>
      <code className="block min-w-0 truncate font-mono text-[11px] text-muted-foreground">
        {command}
      </code>
      {action.reason || action.vocabulary ? (
        <span className="line-clamp-2 text-[11px] leading-snug text-muted-foreground/80">
          {action.reason ?? action.vocabulary}
        </span>
      ) : null}
      {action.reason && action.vocabulary ? (
        <span className="line-clamp-2 text-[10px] leading-snug text-muted-foreground/65">
          {action.vocabulary}
        </span>
      ) : null}
    </button>
  );
}

function normalizeActions(actions: readonly AfxUiAction[]): AfxUiAction[] {
  return actions
    .map((action, index) => ({ action, index }))
    .filter(({ action }) => isRenderableAction(action))
    .sort((left, right) => {
      const rankDelta = left.action.rank - right.action.rank;
      return rankDelta === 0 ? left.index - right.index : rankDelta;
    })
    .map(({ action }) => ({
      ...action,
      label: action.label.trim(),
      command: action.command.trim(),
      reason: action.reason?.trim(),
      vocabulary: action.vocabulary?.trim(),
    }));
}

function isRenderableAction(action: AfxUiAction): boolean {
  return (
    Number.isFinite(action.rank) &&
    action.rank > 0 &&
    typeof action.label === "string" &&
    action.label.trim().length > 0 &&
    typeof action.command === "string" &&
    action.command.trim().startsWith("/afx-") &&
    (action.mode === "run" || action.mode === "insert")
  );
}
