/**
 * Shared composer Memory dropdown. The top-right/composer menu trigger and
 * strip/header anchors both render this same catalog so their content cannot drift.
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-15]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-STRIP]
 */
import type { ReactElement, ReactNode } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@afx/ui/components/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@afx/ui/components/tooltip";
import { cn } from "@afx/ui/lib/utils";

import { MEMORY_CATALOG, type MemoryCatalogItem } from "../lib/doc-actions";

export interface MemoryDropdownProps {
  children: ReactNode;
  onSelect: (item: MemoryCatalogItem) => void;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  className?: string;
}

export interface MemoryDropdownContentProps {
  onSelect: (item: MemoryCatalogItem) => void;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  className?: string;
}

/**
 * Renders only the shared Memory catalog content so custom trigger composition
 * can stay local to each anchor.
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-15]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-STRIP]
 */
export function MemoryDropdownContent({
  onSelect,
  side = "top",
  align = "end",
  className,
}: MemoryDropdownContentProps) {
  return (
    <DropdownMenuContent
      side={side}
      align={align}
      sideOffset={8}
      collisionPadding={12}
      className={cn(
        "max-h-[min(28rem,calc(100vh-2rem))] w-64 max-w-[calc(100vw-1rem)] overflow-y-auto",
        className,
      )}
    >
      <TooltipProvider delayDuration={250}>
        {MEMORY_CATALOG.map((group, groupIndex) => (
          <div key={group.id}>
            {groupIndex > 0 ? <DropdownMenuSeparator /> : null}
            <DropdownMenuLabel className="font-mono uppercase tracking-[0.14em]">
              {group.label}
            </DropdownMenuLabel>
            {group.items.map((item) => (
              <MemoryRowTooltip key={item.id} item={item}>
                <DropdownMenuItem
                  onSelect={() => onSelect(item)}
                  aria-label={`${item.label}: ${item.command} ${
                    item.autoSend ? "Auto-send" : "Draft first"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-medium">{item.label}</p>
                    <p className="truncate font-mono text-[10px] text-muted-foreground">
                      {item.command}
                    </p>
                  </div>
                  <span className="shrink-0 font-mono text-[9px] uppercase tracking-normal text-muted-foreground">
                    {item.autoSend ? "Auto" : "Draft"}
                  </span>
                </DropdownMenuItem>
              </MemoryRowTooltip>
            ))}
          </div>
        ))}
      </TooltipProvider>
    </DropdownMenuContent>
  );
}

function MemoryRowTooltip({ children, item }: { children: ReactElement; item: MemoryCatalogItem }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="block">{children}</span>
      </TooltipTrigger>
      <TooltipContent
        side="left"
        align="start"
        sideOffset={8}
        className="max-w-[320px] flex-col items-start gap-1 text-left"
      >
        <span className="font-medium leading-snug">{item.label}</span>
        <span className="text-[11px] leading-snug opacity-85">{item.description}</span>
        <span className="text-[11px] leading-snug opacity-85">{item.workflowDetail}</span>
        <span className="font-mono text-[10px] opacity-75">{item.usage}</span>
        <span className="font-mono text-[9px] uppercase opacity-70">
          {item.autoSend ? "Auto" : "Draft"}
        </span>
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Renders the shared Memory catalog from any trigger anchor.
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-15]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-STRIP]
 */
export function MemoryDropdown({
  children,
  onSelect,
  open,
  defaultOpen,
  onOpenChange,
  side = "top",
  align = "end",
  className,
}: MemoryDropdownProps) {
  return (
    <DropdownMenu open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <MemoryDropdownContent onSelect={onSelect} side={side} align={align} className={className} />
    </DropdownMenu>
  );
}
