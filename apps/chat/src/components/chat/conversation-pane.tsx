/**
 * Conversation scroll viewport and state-routing boundary.
 *
 * @see docs/specs/216-app-chat-window-componentization/design.md [DES-UI] [DES-STATE] [DES-FILES]
 */
import { type HTMLAttributes, forwardRef, memo } from "react";

import { cn } from "@afx/ui/lib/utils";

import { ConversationScrollButton } from "./conversation-scroll-button";

export interface ConversationPaneProps extends HTMLAttributes<HTMLDivElement> {
  showScrollButton?: boolean;
  onScrollToLatest?: () => void;
}

export const ConversationPane = memo(
  forwardRef<HTMLDivElement, ConversationPaneProps>(
    ({ className, children, showScrollButton = false, onScrollToLatest, ...props }, ref) => (
      <>
        <div
          ref={ref}
          role="region"
          aria-label="Conversation"
          className={cn(
            "afx-surface-subtle flex-1 min-h-0 overflow-y-auto overflow-x-hidden scroll-smooth [scrollbar-width:thin] [scrollbar-color:var(--border)_transparent]",
            className,
          )}
          {...props}
        >
          {children}
        </div>
        {showScrollButton && onScrollToLatest ? (
          <ConversationScrollButton onClick={onScrollToLatest} />
        ) : null}
      </>
    ),
  ),
);
ConversationPane.displayName = "ConversationPane";
