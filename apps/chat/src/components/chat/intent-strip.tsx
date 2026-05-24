/**
 * Composer Intent strip — parent-aware stance stepper for Code and Explore.
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-1] [FR-3] [FR-7] [FR-9] [FR-17]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-STRIP]
 */
import { Fragment, type ReactNode } from "react";

import { ChevronDown, Target } from "lucide-react";

import type { IntentParentMode, IntentSlot } from "@afx/shared";
import { getIntentPrompt, getIntentPrompts, normalizeIntentSlot } from "@afx/shared";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@afx/ui/components/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@afx/ui/components/tooltip";
import { cn } from "@afx/ui/lib/utils";

import {
  formatIntentPromptBadge,
  formatIntentPromptDetail,
  formatIntentPromptTitle,
} from "../../lib/intent-copy";
import { ComposerHeaderActionButton } from "./composer-header-action-button";
import { IntentPromptPreview } from "./intent-prompt-preview";

export function IntentStripTitle() {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <Target size={11} aria-hidden="true" className="shrink-0 text-muted-foreground/80" />
      <span>Intent</span>
    </span>
  );
}

export interface IntentStripHeaderExtrasProps {
  parentMode: IntentParentMode;
  slot: IntentSlot;
  onSlotChange: (slot: IntentSlot) => void;
  collapsed?: boolean;
  previewAction?: ReactNode;
}

export function IntentStripHeaderExtras({
  parentMode,
  slot,
  onSlotChange,
  collapsed,
  previewAction,
}: IntentStripHeaderExtrasProps) {
  const activeSlot = normalizeIntentSlot(slot);
  const entries = getIntentPrompts(parentMode);
  const active = getIntentPrompt(parentMode, activeSlot);
  const promptBadge = formatIntentPromptBadge(active.estimatedTokens);
  const switcherTooltip = active.prefix
    ? `Change Intent. Current: ${active.label}. ${active.description}`
    : `Change Intent. Current: ${active.label}. No prompt is injected.`;

  return (
    <TooltipProvider delayDuration={250}>
      <span
        className="afx-intent-strip flex min-w-0 items-center gap-1.5"
        data-workspace-mode={parentMode}
      >
        {previewAction}
        {collapsed ? (
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <ComposerHeaderActionButton
                    className="max-w-32"
                    aria-label={`Switch Intent. Current: ${active.label}`}
                    trailingIcon={
                      <ChevronDown size={10} aria-hidden="true" className="shrink-0 opacity-70" />
                    }
                  >
                    {active.label}
                  </ComposerHeaderActionButton>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent
                side="top"
                align="end"
                className="max-w-[240px] text-left text-[11px]"
              >
                {switcherTooltip}
              </TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuRadioGroup
                value={String(activeSlot)}
                onValueChange={(value) => {
                  const nextSlot = normalizeIntentSlot(Number(value));
                  if (nextSlot !== activeSlot) onSlotChange(nextSlot);
                }}
              >
                {entries.map((entry) => (
                  <DropdownMenuRadioItem
                    key={`${parentMode}-${entry.slot}`}
                    value={String(entry.slot)}
                    className="items-start gap-2 pr-8"
                  >
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-[11px] font-medium text-foreground">{entry.label}</span>
                      <span className="text-[10px] leading-snug text-muted-foreground">
                        {entry.description}
                      </span>
                    </span>
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
        {promptBadge ? (
          <span
            className="hidden rounded-full border border-border/70 px-1.5 py-0.5 text-[10px] leading-none text-muted-foreground/80 @[420px]:inline-flex"
            title={formatIntentPromptTitle(active.estimatedTokens)}
          >
            {promptBadge}
          </span>
        ) : null}
        <IntentPromptPreview entry={active} />
      </span>
    </TooltipProvider>
  );
}

export interface IntentStripProps {
  parentMode: IntentParentMode;
  slot: IntentSlot;
  onSlotChange: (slot: IntentSlot) => void;
}

export function IntentStrip({ parentMode, slot, onSlotChange }: IntentStripProps) {
  const activeSlot = normalizeIntentSlot(slot);
  const entries = getIntentPrompts(parentMode);
  const active = getIntentPrompt(parentMode, activeSlot);

  return (
    <TooltipProvider delayDuration={250}>
      <div
        className="afx-intent-strip @container flex min-w-0 flex-col gap-1.5"
        data-workspace-mode={parentMode}
        data-testid="intent-strip"
      >
        <div className="flex min-w-0 items-center overflow-hidden whitespace-nowrap">
          {entries.map((entry, index) => {
            const selected = entry.slot === activeSlot;
            return (
              <Fragment key={`${parentMode}-${entry.slot}`}>
                {index > 0 ? <div className="mx-1 h-px min-w-2 flex-1 bg-border/70" /> : null}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      data-testid={`intent-step-${entry.id}`}
                      aria-pressed={selected}
                      aria-label={`${entry.label} Intent`}
                      onClick={() => {
                        if (!selected) onSlotChange(entry.slot);
                      }}
                      className={cn(
                        "afx-intent-step inline-flex h-6 min-w-0 shrink-0 items-center justify-center rounded-full border px-2 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/50",
                        selected
                          ? "border-[var(--intent-accent-border)] bg-[var(--intent-accent-bg)] text-foreground shadow-sm"
                          : "border-border bg-muted/10 text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                      )}
                    >
                      <span className="@[260px]:hidden" aria-hidden="true">
                        {entry.icon}
                      </span>
                      <span className="hidden @[260px]:inline">{entry.label}</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent
                    side="top"
                    className="max-w-64 flex-col items-start text-left text-[11px]"
                  >
                    <p className="font-semibold text-foreground">
                      {entry.label} · {formatIntentPromptDetail(entry.estimatedTokens)}
                    </p>
                    <p className="text-muted-foreground">
                      {entry.prefix ? `“${truncate(entry.prefix, 72)}”` : "No prompt injected."}
                    </p>
                    <p className="mt-1 text-[10px] text-muted-foreground/80">
                      Click ⓘ for full text
                    </p>
                  </TooltipContent>
                </Tooltip>
              </Fragment>
            );
          })}
        </div>
        <p
          className="hidden min-w-0 truncate border-t border-dashed border-border/40 pt-1 text-[10px] leading-none text-muted-foreground @[320px]:block"
          data-testid="intent-tagline"
          title={`${active.label} — ${active.description}`}
        >
          <span className="font-medium text-foreground/80">{active.label}</span> —{" "}
          {active.description}
        </p>
      </div>
    </TooltipProvider>
  );
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}
