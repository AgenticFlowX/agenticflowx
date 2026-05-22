/**
 * Composer toolbar controls for mention, model/runtime, workspace mode, and file context.
 *
 * @see docs/specs/216-app-chat-window-componentization/design.md [DES-FILES] [DES-UI]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-RUNTIME] [DES-COMPOSER-CONTEXT]
 */
import { memo, useState } from "react";

import { AtSign, ChevronDown, Paperclip, SlidersHorizontal } from "lucide-react";
import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui";

import type { AgentModel, ThinkingLevel, WorkspaceMode } from "@afx/shared";
import { Badge } from "@afx/ui/components/badge";
import { buttonVariants } from "@afx/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
} from "@afx/ui/components/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@afx/ui/components/tooltip";
import { cn } from "@afx/ui/lib/utils";

import type { SettingsOpenTarget } from "../../lib/settings-navigation";
import { ModelCombobox } from "../model-combobox";

export interface ComposerToolbarProps {
  isSystemCommand: boolean;
  disabled: boolean;
  models: readonly AgentModel[];
  selectedModel?: Pick<AgentModel, "provider" | "id" | "name" | "instanceId">;
  thinkingLevel?: ThinkingLevel;
  workspaceMode: WorkspaceMode;
  includeActiveFileContext: boolean;
  activeFileDisplayName: string;
  activeFileDisplayPath: string;
  customProviderLabels?: Readonly<Record<string, string>>;
  onOpenMentionPicker: () => void;
  /** Optional attachment trigger; callers omit it until a working picker is available. */
  onOpenAttachmentPicker?: () => void;
  onSelectModel: (model: AgentModel) => void;
  onSelectThinkingLevel: (level: ThinkingLevel) => void;
  onOpenSettings?: (target?: SettingsOpenTarget) => void;
  onWorkspaceModeChange: (mode: WorkspaceMode) => void;
  onToggleActiveFileContext: () => void;
}

export const ComposerToolbar = memo(function ComposerToolbar({
  isSystemCommand,
  disabled,
  models,
  selectedModel,
  thinkingLevel,
  workspaceMode,
  includeActiveFileContext,
  activeFileDisplayName,
  activeFileDisplayPath,
  customProviderLabels,
  onOpenMentionPicker,
  onOpenAttachmentPicker,
  onSelectModel,
  onSelectThinkingLevel,
  onOpenSettings,
  onWorkspaceModeChange,
  onToggleActiveFileContext,
}: ComposerToolbarProps) {
  return (
    <TooltipProvider>
      <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-hidden @[260px]:gap-1">
        {isSystemCommand ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded bg-amber-500/20 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider text-amber-500">
            Shell
          </span>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))}
                onClick={onOpenMentionPicker}
                disabled={disabled}
                aria-label="Mention file"
              >
                <AtSign />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" align="start" className="max-w-xs text-left">
              Mention a file in the workspace. Use it to insert the current editor file or pick
              another file to reference in your message.
            </TooltipContent>
          </Tooltip>
        )}
        {onOpenAttachmentPicker ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))}
                onClick={onOpenAttachmentPicker}
                disabled={disabled}
                aria-label="Attach file or image"
              >
                <Paperclip />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" align="start" className="max-w-xs text-left">
              Attach files or images to this message.
            </TooltipContent>
          </Tooltip>
        ) : null}
        <ModelCombobox
          models={models}
          value={selectedModel}
          thinkingLevel={thinkingLevel}
          disabled={disabled}
          onSelect={onSelectModel}
          onSelectThinkingLevel={onSelectThinkingLevel}
          onOpenSettings={onOpenSettings}
          customProviderLabels={customProviderLabels}
        />
        <span
          aria-hidden="true"
          className="hidden px-0.5 font-mono text-[10px] text-muted-foreground/60 @[260px]:inline"
        >
          |
        </span>
        <ModeToggle mode={workspaceMode} onChange={onWorkspaceModeChange} />
        <ActiveFileContextToggle
          enabled={includeActiveFileContext}
          fileName={activeFileDisplayName}
          filePath={activeFileDisplayPath}
          onToggle={onToggleActiveFileContext}
        />
      </div>
    </TooltipProvider>
  );
});

const WORKSPACE_MODES: ReadonlyArray<{
  value: WorkspaceMode;
  label: string;
  description: string;
  hint?: string;
  badge?: string;
}> = [
  {
    value: "code",
    label: "Code",
    description: "Default. Full access. The active coding harness can act and edit.",
  },
  {
    value: "explore",
    label: "Explore",
    description: "Read-only. Use it to inspect code, trace behavior, and plan changes.",
    badge: "Experimental",
  },
  {
    value: "spec",
    label: "Spec",
    description: "Plan before you code. Shape -> Design -> Slice -> Build -> Ship.",
    hint: "Starting a new feature? Switch here first.",
    badge: "SDD",
  },
];

function ModeToggle({
  mode,
  onChange,
}: {
  mode: WorkspaceMode;
  onChange: (mode: WorkspaceMode) => void;
}) {
  const current = WORKSPACE_MODES.find((item) => item.value === mode) ?? WORKSPACE_MODES[0];

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuPrimitive.Trigger
            type="button"
            aria-label={`Workspace mode: ${current.label}`}
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "cn-button min-w-7 max-w-full shrink-0 gap-1 px-1.5",
            )}
          >
            <SlidersHorizontal size={11} className="shrink-0 text-afx-brand-soft" />
            <span className="hidden max-w-[6.5rem] truncate font-mono text-[10px] tracking-tight @[260px]:inline">
              {current.label}
            </span>
            <ChevronDown className="hidden shrink-0 text-muted-foreground @[260px]:block" />
          </DropdownMenuPrimitive.Trigger>
        </TooltipTrigger>
        <TooltipContent side="bottom" align="start" className="max-w-xs text-left">
          {current.value === "explore"
            ? "Explore is experimental and read-only. Use it to inspect code, trace behavior, and plan changes without running commands or edits."
            : current.value === "spec"
              ? "Spec mode powers Spec-Driven Development: Shape → Design → Slice → Build → Verify → Ship → Evolve. The agent edits specs, designs, tasks, journals, ADRs, and research notes — your source code stays untouched."
              : "Code is the default full-access coding mode."}
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent side="top" align="start" className="min-w-[15rem]">
        <DropdownMenuLabel className="font-mono uppercase tracking-[0.14em]">
          Mode
        </DropdownMenuLabel>
        <div className="px-2 pb-1 text-[10px] leading-relaxed text-muted-foreground">
          Code is the default. Explore is read-only inspection. Spec is for Spec-Driven Development.
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={current.value}
          onValueChange={(value) => onChange(value as WorkspaceMode)}
        >
          {WORKSPACE_MODES.map(({ value, label, description, hint, badge }) => (
            <DropdownMenuRadioItem
              key={value}
              value={value}
              className="items-start gap-2 px-2 py-2"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-medium text-foreground">{label}</span>
                  {badge ? (
                    <Badge
                      variant="outline"
                      className="h-4 px-1 text-[9px] uppercase tracking-wide"
                    >
                      {badge}
                    </Badge>
                  ) : null}
                </div>
                <span className="text-[10px] leading-snug text-muted-foreground">
                  {description}
                </span>
                {hint ? (
                  <span className="text-[10px] leading-snug text-afx-brand-soft/80">{hint}</span>
                ) : null}
              </div>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ActiveFileContextToggle({
  enabled,
  fileName,
  filePath,
  onToggle,
}: {
  enabled: boolean;
  fileName: string;
  filePath: string;
  onToggle: () => void;
}) {
  const [tooltipOpen, setTooltipOpen] = useState(false);

  return (
    <Tooltip open={tooltipOpen} onOpenChange={setTooltipOpen}>
      <TooltipTrigger asChild>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label={fileName}
          onClick={onToggle}
          onMouseOver={() => setTooltipOpen(true)}
          onMouseEnter={() => setTooltipOpen(true)}
          onMouseMove={() => setTooltipOpen(true)}
          onMouseLeave={() => setTooltipOpen(false)}
          onPointerOver={() => setTooltipOpen(true)}
          onPointerEnter={() => setTooltipOpen(true)}
          onPointerLeave={() => setTooltipOpen(false)}
          onFocus={() => setTooltipOpen(true)}
          onBlur={() => setTooltipOpen(false)}
          className={cn(
            "inline-flex min-w-0 max-w-full items-center gap-1",
            enabled ? "text-foreground" : "text-muted-foreground",
          )}
        >
          <span
            data-slot="switch"
            data-size="sm"
            data-state={enabled ? "checked" : "unchecked"}
            aria-hidden="true"
            className={cn(
              "cn-switch",
              "relative inline-flex h-[14px] w-[26px] shrink-0 items-center rounded-full border border-transparent p-px transition-all outline-none",
              enabled ? "bg-primary" : "bg-input dark:bg-input/80",
            )}
          >
            <span
              data-slot="switch-thumb"
              className={cn(
                "cn-switch-thumb pointer-events-none block size-3 rounded-full bg-background ring-0 transition-transform",
                enabled
                  ? "translate-x-3 dark:bg-primary-foreground"
                  : "translate-x-0 dark:bg-foreground",
              )}
            />
          </span>
          <span className="hidden min-w-0 max-w-[7rem] truncate font-mono text-[10px] tracking-tight @[260px]:inline">
            {fileName}
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" align="start" className="max-w-xs text-left">
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em]">
            {enabled ? "File context on" : "File context off"}
          </span>
          <span className="text-xs">
            {enabled
              ? "New turns automatically include this editor file, which is useful when the answer depends on the current code. Keep this on by default for file-specific work."
              : "Turn this on when you want the next turn to use the current editor file as context. It is best left on when you are debugging or editing this file."}
          </span>
          <span className="break-all font-mono text-[10px] opacity-70">{filePath}</span>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
