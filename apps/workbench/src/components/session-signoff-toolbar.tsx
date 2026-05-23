/**
 * Shared Work Sessions signoff toolbar for preview and Workbench session panes.
 *
 * @see docs/specs/222-app-workbench-documents/spec.md [FR-7] [FR-9]
 * @see docs/specs/222-app-workbench-documents/design.md [DES-DOCS-PREVIEW-STANDALONE]
 * @see docs/specs/227-app-workbench-shell/spec.md [FR-6] [FR-7]
 * @see docs/specs/227-app-workbench-shell/design.md [DES-SHELL-FEATURE-COLUMNS]
 */
import type { ReactNode } from "react";

import { CheckSquare, MoreHorizontal, ShieldCheck, Square } from "lucide-react";

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

export interface SessionSignoffSummary {
  total: number;
  agentChecked: number;
  humanChecked: number;
  approvable: number;
}

interface SessionSignoffToolbarProps {
  summary: SessionSignoffSummary;
  onToggleAll?: (column: "agent" | "human", completed: boolean) => void;
  onApprove?: () => void;
  className?: string;
  density?: "regular" | "compact";
}

export function SessionSignoffToolbar({
  summary,
  onToggleAll,
  onApprove,
  className,
  density = "regular",
}: SessionSignoffToolbarProps) {
  if (summary.total === 0) return null;

  const compact = density === "compact";
  const canCheckAgent = summary.agentChecked < summary.total;
  const canCheckHuman = summary.humanChecked < summary.total;
  const canClearAgent = summary.agentChecked > 0;
  const canClearHuman = summary.humanChecked > 0;
  const canApprove = summary.approvable > 0;

  return (
    <div
      role="toolbar"
      aria-label="Work Sessions signoff toolbar"
      className={cn(
        "inline-flex min-h-9 max-w-full min-w-0 items-center gap-0.5 overflow-hidden rounded-md border border-border/70 bg-background/80 p-1 shadow-[0_1px_0_rgba(255,255,255,0.04),0_8px_24px_rgba(0,0,0,0.08)]",
        compact && "min-h-8 p-0.5",
        className,
      )}
    >
      <span className="shrink-0 px-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        Sessions
      </span>
      <ToolbarDivider />
      <ToolbarButton
        label="Approve"
        ariaLabel="Approve Work Sessions"
        title="Approve every Agent-verified Work Sessions row by checking Human."
        disabled={!canApprove}
        density={density}
        onClick={onApprove}
      >
        <ShieldCheck size={12} className="text-afx-brand-soft" aria-hidden />
        {summary.approvable > 0 ? (
          <span className="rounded-sm bg-muted/70 px-1 text-[9px] text-muted-foreground">
            {summary.approvable}
          </span>
        ) : null}
      </ToolbarButton>
      <ToolbarDivider />
      <ToolbarButton
        label="Agent all"
        ariaLabel="Select all Agent signoff checkboxes"
        title="Check every Agent signoff checkbox in Work Sessions."
        disabled={!canCheckAgent}
        density={density}
        onClick={() => onToggleAll?.("agent", true)}
      >
        <CheckSquare size={12} className="text-afx-brand-soft" aria-hidden />
      </ToolbarButton>
      <ToolbarButton
        label="Human all"
        ariaLabel="Select all Human signoff checkboxes"
        title="Check every Human signoff checkbox in Work Sessions."
        disabled={!canCheckHuman}
        density={density}
        onClick={() => onToggleAll?.("human", true)}
      >
        <CheckSquare size={12} className="text-afx-brand-soft" aria-hidden />
      </ToolbarButton>
      <ToolbarDivider />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className={cn(
              "gap-1 rounded-sm border border-transparent !px-1.5 font-mono !text-[10px] text-muted-foreground hover:border-border/70 hover:bg-background hover:text-foreground hover:shadow-sm",
              compact && "!h-6",
            )}
            aria-label="More Work Sessions signoff actions"
            title="More Work Sessions signoff actions"
          >
            <MoreHorizontal size={13} aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={6} className="w-60">
          <DropdownMenuLabel className="font-mono text-[10px] uppercase tracking-[0.14em]">
            Work Sessions
          </DropdownMenuLabel>
          <DropdownMenuItem
            disabled={!canClearAgent}
            onSelect={() => onToggleAll?.("agent", false)}
          >
            <Square size={12} aria-hidden />
            <span>Clear Agent signoffs</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!canClearHuman}
            onSelect={() => onToggleAll?.("human", false)}
          >
            <Square size={12} aria-hidden />
            <span>Clear Human signoffs</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <div className="px-2 py-1.5 font-mono text-[10px] leading-4 text-muted-foreground">
            {`Agent ${summary.agentChecked}/${summary.total} · Human ${summary.humanChecked}/${summary.total}`}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function ToolbarButton({
  label,
  ariaLabel,
  title,
  disabled,
  density,
  onClick,
  children,
}: {
  label: string;
  ariaLabel: string;
  title: string;
  disabled: boolean;
  density: "regular" | "compact";
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="xs"
      disabled={disabled}
      className={cn(
        "!h-7 min-w-0 max-w-[11rem] gap-1.5 rounded-sm border border-transparent !px-2 font-mono !text-[10px] !font-medium leading-none text-foreground/75 transition-colors hover:border-border/70 hover:bg-background hover:text-foreground hover:shadow-sm disabled:opacity-45",
        density === "compact" && "!h-6 max-w-[9rem] !px-1.5",
      )}
      aria-label={ariaLabel}
      title={title}
      onClick={onClick}
    >
      {children}
      <span className="shrink-0 truncate">{label}</span>
    </Button>
  );
}

function ToolbarDivider() {
  return <span aria-hidden className="mx-0.5 h-4 w-px shrink-0 bg-border/70" />;
}
