/**
 * Composer Intent prompt preview popover.
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-13] [FR-14] [FR-15] [FR-16]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-STRIP]
 */
import { useState } from "react";

import { Copy, Info } from "lucide-react";

import type { IntentPromptEntry } from "@afx/shared";
import { Button } from "@afx/ui/components/button";
import { Popover, PopoverContent, PopoverTrigger } from "@afx/ui/components/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@afx/ui/components/tooltip";

import { formatIntentPromptDetail } from "../../lib/intent-copy";
import { toast } from "../toast";

export interface IntentPromptPreviewProps {
  entry: IntentPromptEntry;
}

export function IntentPromptPreview({ entry }: IntentPromptPreviewProps) {
  const [open, setOpen] = useState(false);
  const isDefault = entry.prefix.length === 0;

  async function copyPrefix(): Promise<void> {
    if (isDefault) return;
    try {
      await navigator.clipboard.writeText(entry.prefix);
      toast.success("Intent prompt copied");
    } catch {
      toast.error("Copy failed", "Could not copy the Intent prompt.");
    }
  }

  return (
    <TooltipProvider delayDuration={250}>
      <Popover open={open} onOpenChange={setOpen}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label={`Preview injected prompt for ${entry.label}`}
                className="rounded-sm p-0.5 text-muted-foreground/70 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/50"
              >
                <Info size={11} />
              </button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="top" align="end" className="max-w-[220px] text-left text-[11px]">
            Show the Intent prompt text and token estimate.
          </TooltipContent>
        </Tooltip>
        <PopoverContent
          align="end"
          side="top"
          sideOffset={8}
          className="w-[min(26rem,calc(100vw-2rem))] border-border bg-popover p-0 text-popover-foreground shadow-xl"
        >
          <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-foreground">
                Injected prompt for: {entry.label}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {formatIntentPromptDetail(entry.estimatedTokens)}
              </p>
            </div>
            <Button
              type="button"
              size="xs"
              variant="outline"
              disabled={isDefault}
              onClick={() => {
                void copyPrefix();
              }}
            >
              <Copy size={11} />
              Copy
            </Button>
          </div>
          <div className="px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
            {isDefault ? (
              <p>
                No prompt injected. Your message goes to the agent unchanged by Intent — what you
                type is what you send and pay for.
              </p>
            ) : (
              <pre className="max-h-48 whitespace-pre-wrap rounded-sm bg-muted/40 p-2 font-sans text-[11px] leading-relaxed text-foreground">
                {entry.prefix}
              </pre>
            )}
          </div>
          {!isDefault ? (
            <p className="border-t border-border px-3 py-2 font-mono text-[10px] text-muted-foreground/80">
              Added after parent-mode guardrails · once per turn
            </p>
          ) : null}
        </PopoverContent>
      </Popover>
    </TooltipProvider>
  );
}
