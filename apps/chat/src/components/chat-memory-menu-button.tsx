/**
 * ChatMemoryMenuButton — shared one-click Memory menu for chat chrome.
 *
 * Used by `chat.tsx` in both the top status bar and composer action row:
 *
 *   [Archive Memory v]
 *
 * Save/Load/History/Impact and session commands all live in the same dropdown,
 * matching the compact model selector pattern in the composer.
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-15]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-STRIP]
 */
import type { MouseEventHandler } from "react";

import { Archive, ChevronDown } from "lucide-react";

import { Button } from "@afx/ui/components/button";
import { DropdownMenu, DropdownMenuTrigger } from "@afx/ui/components/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@afx/ui/components/tooltip";
import { cn } from "@afx/ui/lib/utils";

import { type MemoryCatalogItem } from "../lib/doc-actions";
import { MemoryDropdownContent } from "./memory-dropdown";

export interface ChatMemoryMenuButtonProps {
  onSelect: (item: MemoryCatalogItem) => void;
  disabled?: boolean;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  size?: "tiny" | "composer";
  preventMouseDown?: boolean;
}

/**
 * Renders the shadcn-style DropdownMenu trigger recommended for compact
 * one-click session-memory actions.
 *
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-STRIP]
 */
export function ChatMemoryMenuButton({
  onSelect,
  disabled,
  side = "bottom",
  align = "end",
  size = "tiny",
  preventMouseDown = false,
}: ChatMemoryMenuButtonProps) {
  const onMouseDown: MouseEventHandler<HTMLButtonElement> | undefined = preventMouseDown
    ? (event) => event.preventDefault()
    : undefined;
  const buttonClass =
    size === "composer"
      ? "h-7 min-w-7 gap-1 px-1.5 font-mono text-[10px] tracking-tight text-muted-foreground/80 [&_svg]:size-3.5"
      : "h-5 gap-0.5 px-1 text-muted-foreground/75 [&_svg]:size-3";
  const buttonSize = size === "composer" ? "sm" : "xs";

  return (
    <TooltipProvider delayDuration={250}>
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size={buttonSize}
                disabled={disabled}
                aria-label="Open memory menu"
                onMouseDown={onMouseDown}
                className={cn("cn-button min-w-0 max-w-full shrink-0", buttonClass)}
                data-testid="chat-memory-menu-button"
              >
                <Archive className="shrink-0 text-afx-brand-soft" aria-hidden />
                <span
                  className={cn(
                    "min-w-0 truncate",
                    size === "tiny" ? "sr-only" : "hidden @[260px]:inline",
                  )}
                >
                  Memory
                </span>
                <ChevronDown
                  className={cn(
                    "shrink-0 text-muted-foreground",
                    size === "composer" && "hidden @[260px]:block",
                  )}
                  aria-hidden
                />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side={side} align={align} className="max-w-[220px] text-left">
            Session memory + discussion log.
          </TooltipContent>
        </Tooltip>
        <MemoryDropdownContent onSelect={onSelect} side={side} align={align} />
      </DropdownMenu>
    </TooltipProvider>
  );
}
