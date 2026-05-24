/**
 * Shared flat button treatment for compact composer-panel header actions.
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-15]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-STRIP]
 */
import { type ButtonHTMLAttributes, type ComponentProps, type ReactNode, forwardRef } from "react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@afx/ui/components/tooltip";
import { cn } from "@afx/ui/lib/utils";

export interface ComposerHeaderActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  labelClassName?: string;
  tooltip?: ReactNode;
  tooltipAlign?: ComponentProps<typeof TooltipContent>["align"];
  tooltipClassName?: string;
  tooltipSide?: ComponentProps<typeof TooltipContent>["side"];
}

export const ComposerHeaderActionButton = forwardRef<
  HTMLButtonElement,
  ComposerHeaderActionButtonProps
>(function ComposerHeaderActionButton(
  {
    children,
    className,
    labelClassName,
    leadingIcon,
    tooltip,
    tooltipAlign = "center",
    tooltipClassName,
    tooltipSide = "top",
    trailingIcon,
    type = "button",
    ...props
  },
  ref,
) {
  const button = (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex h-5 shrink-0 items-center gap-1 rounded-full border border-transparent bg-transparent px-1.5 text-[10px] font-medium leading-none text-muted-foreground/80 transition-colors hover:border-border/70 hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/50",
        className,
      )}
      {...props}
    >
      {leadingIcon}
      <span className={cn("min-w-0 truncate", labelClassName)}>{children}</span>
      {trailingIcon}
    </button>
  );

  if (!tooltip) return button;

  return (
    <TooltipProvider delayDuration={250}>
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent
          side={tooltipSide}
          align={tooltipAlign}
          className={cn("max-w-[240px] text-left text-[11px]", tooltipClassName)}
        >
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});
