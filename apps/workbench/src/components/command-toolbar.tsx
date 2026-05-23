/**
 * Shared AFX command toolbar for preview and workbench document surfaces.
 *
 * @see docs/specs/222-app-workbench-documents/spec.md [FR-4] [FR-7] [FR-9]
 * @see docs/specs/222-app-workbench-documents/design.md [DES-DOCS-READER] [DES-DOCS-STUDIO]
 */
import { Fragment } from "react";

import { Code2, MoreHorizontal, PenLine, Sparkles, Zap } from "lucide-react";

import { Button } from "@afx/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@afx/ui/components/dropdown-menu";
import { cn } from "@afx/ui/lib/utils";

export type CommandToolbarActionMode = "insert" | "send";
export type CommandToolbarActionIcon = "code" | "draft" | "run" | "spark";

export interface CommandToolbarAction {
  label: string;
  command: string;
  ariaLabel?: string;
  description?: string;
  mode?: CommandToolbarActionMode;
  icon?: CommandToolbarActionIcon;
  meta?: string;
  badge?: string | number;
}

interface CommandToolbarProps {
  actions: CommandToolbarAction[];
  onCommand?: (command: string, mode?: CommandToolbarActionMode) => void;
  scope?: string;
  label?: string;
  ariaLabel?: string;
  className?: string;
  density?: "regular" | "compact";
  overflowAfter?: number;
  actionAria?: "label" | "mode";
}

const DEFAULT_OVERFLOW_AFTER = 5;

export function CommandToolbar({
  actions,
  onCommand,
  scope = "document",
  label,
  ariaLabel,
  className,
  density = "regular",
  overflowAfter = DEFAULT_OVERFLOW_AFTER,
  actionAria = "mode",
}: CommandToolbarProps) {
  if (actions.length === 0) return null;

  const ordered = orderToolbarActions(actions);
  const shouldOverflow = ordered.length >= overflowAfter;
  const visibleCount = shouldOverflow ? Math.max(1, overflowAfter - 1) : ordered.length;
  const visibleActions = ordered.slice(0, visibleCount);
  const overflowActions = ordered.slice(visibleCount);
  const compact = density === "compact";

  return (
    <div
      role="toolbar"
      data-afx-command-toolbar={scope}
      data-afx-action-scope={scope}
      aria-label={ariaLabel ?? (label ? `${label} command toolbar` : "Command toolbar")}
      className={cn(
        "inline-flex min-h-9 max-w-full min-w-0 items-center gap-0.5 overflow-hidden rounded-md border border-border/70 bg-background/70 p-1 shadow-[0_1px_0_rgba(255,255,255,0.04),0_8px_24px_rgba(0,0,0,0.08)]",
        compact && "min-h-8 p-0.5",
        scope === "section" && "border-afx-brand/25 bg-muted/10 shadow-none",
        scope.startsWith("inline-") && "border-afx-brand/25 bg-background/95 shadow-md",
        className,
      )}
    >
      {label ? (
        <>
          <span className="shrink-0 px-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            {label}
          </span>
          <ToolbarDivider />
        </>
      ) : null}
      {visibleActions.map((action, index) => (
        <Fragment key={`${action.command}-${action.label}`}>
          {index > 0 && shouldSplitToolbarAction(visibleActions[index - 1], action) ? (
            <ToolbarDivider />
          ) : null}
          <ToolbarActionButton
            action={action}
            onCommand={onCommand}
            density={density}
            actionAria={actionAria}
          />
        </Fragment>
      ))}
      {overflowActions.length > 0 ? (
        <>
          <ToolbarDivider />
          <ToolbarOverflowMenu
            actions={overflowActions}
            onCommand={onCommand}
            label={label ?? "More"}
            density={density}
          />
        </>
      ) : null}
    </div>
  );
}

function orderToolbarActions(actions: CommandToolbarAction[]): CommandToolbarAction[] {
  return [
    ...actions.filter((action) => action.mode !== "send"),
    ...actions.filter((action) => action.mode === "send"),
  ];
}

function shouldSplitToolbarAction(
  previous: CommandToolbarAction | undefined,
  next: CommandToolbarAction,
): boolean {
  if (!previous) return false;
  return commandActionMode(previous) !== commandActionMode(next);
}

function commandActionMode(action: CommandToolbarAction): CommandToolbarActionMode {
  return action.mode ?? "insert";
}

function ToolbarDivider() {
  return <span aria-hidden className="mx-0.5 h-4 w-px shrink-0 bg-border/70" />;
}

function ToolbarActionButton({
  action,
  onCommand,
  density,
  actionAria,
}: {
  action: CommandToolbarAction;
  onCommand?: (command: string, mode?: CommandToolbarActionMode) => void;
  density: "regular" | "compact";
  actionAria: "label" | "mode";
}) {
  const mode = commandActionMode(action);
  const compact = density === "compact";
  return (
    <Button
      type="button"
      variant="ghost"
      size="xs"
      className={cn(
        "!h-7 min-w-0 max-w-[18rem] gap-1.5 rounded-sm border border-transparent !px-2 font-mono !text-[10px] !font-medium leading-none text-foreground/75 transition-colors hover:border-border/70 hover:bg-background hover:text-foreground hover:shadow-sm",
        compact && "!h-6 max-w-[14rem] !px-1.5",
      )}
      aria-label={
        action.ariaLabel ??
        (actionAria === "label"
          ? action.label
          : `${action.label}: ${mode === "send" ? "Auto" : "Draft"}`)
      }
      title={toolbarActionTitle(action)}
      onClick={() => onCommand?.(action.command, action.mode)}
    >
      <ToolbarActionIcon action={action} />
      <span className="shrink-0 truncate">{action.label}</span>
      {action.meta ? (
        <span className="hidden min-w-0 truncate text-muted-foreground sm:inline">
          {action.meta}
        </span>
      ) : null}
      {action.badge !== undefined ? (
        <span className="rounded-sm bg-muted/70 px-1 text-[9px] text-muted-foreground">
          {action.badge}
        </span>
      ) : null}
    </Button>
  );
}

function ToolbarOverflowMenu({
  actions,
  onCommand,
  label,
  density,
}: {
  actions: CommandToolbarAction[];
  onCommand?: (command: string, mode?: CommandToolbarActionMode) => void;
  label: string;
  density: "regular" | "compact";
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className={cn(
            "gap-1 rounded-sm border border-transparent !px-1.5 font-mono !text-[10px] text-muted-foreground hover:border-border/70 hover:bg-background hover:text-foreground hover:shadow-sm",
            density === "compact" && "!h-6",
          )}
          aria-label={`${label} command menu`}
          title={`${label} command menu`}
        >
          <MoreHorizontal size={13} aria-hidden />
          <span aria-hidden>+{actions.length}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={6}
        className="max-h-[min(28rem,calc(100vh-6rem))] w-64 overflow-y-auto"
      >
        <DropdownMenuLabel className="font-mono text-[10px] uppercase tracking-[0.14em]">
          {label} commands
        </DropdownMenuLabel>
        {actions.map((action, index) => (
          <Fragment key={`${action.command}-${action.label}`}>
            {index > 0 && shouldSplitToolbarAction(actions[index - 1], action) ? (
              <DropdownMenuSeparator />
            ) : null}
            <DropdownMenuItem
              className="min-w-0"
              title={toolbarActionTitle(action)}
              onSelect={() => onCommand?.(action.command, action.mode)}
            >
              <ToolbarActionIcon action={action} />
              <span className="min-w-0 flex-1 truncate">{action.label}</span>
              {action.badge !== undefined ? (
                <span className="rounded-sm bg-muted/70 px-1 font-mono text-[9px] text-muted-foreground">
                  {action.badge}
                </span>
              ) : null}
              <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
                {commandActionMode(action) === "send" ? "Auto" : "Draft"}
              </span>
            </DropdownMenuItem>
            {action.meta ? (
              <div className="-mt-1 mb-1 min-w-0 px-8 text-[11px] leading-4 text-muted-foreground">
                <span className="block truncate">{action.meta}</span>
              </div>
            ) : null}
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ToolbarActionIcon({ action }: { action: CommandToolbarAction }) {
  const mode = commandActionMode(action);
  const className = cn(
    "shrink-0",
    mode === "send" ? "text-amber-500" : "text-afx-brand-soft",
    action.icon === "spark" && "text-afx-brand",
  );

  if (action.icon === "code") return <Code2 size={12} className={className} aria-hidden />;
  if (action.icon === "spark") return <Sparkles size={12} className={className} aria-hidden />;
  if (action.icon === "run" || action.mode === "send") {
    return <Zap size={12} className={className} aria-hidden />;
  }

  return <PenLine size={12} className={className} aria-hidden />;
}

function toolbarActionTitle(action: CommandToolbarAction): string {
  const mode = commandActionMode(action);
  const hint =
    mode === "send" ? "Auto - runs in chat immediately" : "Draft - edit in chat before sending";
  return `${action.description ?? action.command}\n${action.command}\n${hint}`;
}
