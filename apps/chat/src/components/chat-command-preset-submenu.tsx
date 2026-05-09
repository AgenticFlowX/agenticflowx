/**
 * ChatCommandPresetSubmenu — command-context preset menu for chat composer action dropdowns.
 * Used by `chat-doc-actions-strip.tsx` inside the More menu:
 *
 *   More ▾
 *     Refine presets ›
 *       Tighten Requirements
 *       Acceptance Criteria
 *
 * Presets are resolved from `context-presets.ts`; this component only renders
 * already-validated choices and reports the selected command upward.
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-15] [FR-16]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-STRIP]
 */
import { ListPlus } from "lucide-react";

import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@afx/ui/components/dropdown-menu";

import type { ContextPresetCtx, ResolvedContextPreset } from "../lib/context-presets";
import { resolveContextPresets } from "../lib/context-presets";

export interface ChatCommandPresetSubmenuProps {
  baseCommand: string;
  docContext: ContextPresetCtx;
  triggerLabel?: string;
  asSubmenu?: boolean;
  onSelect: (preset: ResolvedContextPreset) => void;
}

/**
 * Renders presets either as a nested shadcn DropdownMenuSub or as plain menu
 * content for callers that already own the submenu shell.
 *
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-STRIP]
 */
export function ChatCommandPresetSubmenu({
  baseCommand,
  docContext,
  triggerLabel = "Presets",
  asSubmenu = true,
  onSelect,
}: ChatCommandPresetSubmenuProps) {
  const presets = resolveContextPresets(baseCommand, docContext);
  if (presets.length === 0) {
    return null;
  }

  const content = <PresetItems presets={presets} onSelect={onSelect} />;

  if (!asSubmenu) {
    return content;
  }

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className="gap-1.5">
        <ListPlus size={11} />
        {triggerLabel}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent
        sideOffset={6}
        alignOffset={-4}
        collisionPadding={12}
        className="max-h-[min(24rem,calc(100vh-2rem))] w-64 max-w-[calc(100vw-1.5rem)] overflow-y-auto"
      >
        {content}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

function PresetItems({
  presets,
  onSelect,
}: {
  presets: readonly ResolvedContextPreset[];
  onSelect: (preset: ResolvedContextPreset) => void;
}) {
  return (
    <>
      <DropdownMenuLabel className="font-mono uppercase tracking-[0.14em]">
        Command Presets
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      {presets.map((preset) => (
        <DropdownMenuItem
          key={preset.command}
          className="items-start gap-2 px-2 py-2"
          onSelect={() => onSelect(preset)}
        >
          <ListPlus size={11} className="mt-0.5 text-afx-brand-soft" />
          <span className="flex min-w-0 flex-col gap-0.5 text-left">
            <span className="text-[11px] font-medium text-foreground">{preset.label}</span>
            <span className="text-[10px] leading-snug text-muted-foreground">
              {preset.description}
            </span>
            <span className="truncate font-mono text-[10px] text-muted-foreground">
              {preset.command}
            </span>
          </span>
        </DropdownMenuItem>
      ))}
    </>
  );
}
