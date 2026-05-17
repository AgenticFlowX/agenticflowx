/**
 * Floating conversation jump-to-latest affordance.
 *
 * @see docs/specs/216-app-chat-window-componentization/design.md [DES-UI] [DES-A11Y] [DES-FILES]
 */
import { memo } from "react";

import { ArrowDown } from "lucide-react";

import { Button } from "@afx/ui/components/button";

export interface ConversationScrollButtonProps {
  onClick: () => void;
}

export const ConversationScrollButton = memo(function ConversationScrollButton({
  onClick,
}: ConversationScrollButtonProps) {
  return (
    <div className="relative">
      <div className="absolute -top-9 left-1/2 z-10 -translate-x-1/2">
        <Button
          size="icon"
          variant="secondary"
          onClick={onClick}
          className="h-7 w-7 rounded-full shadow-md"
          aria-label="Scroll to latest"
        >
          <ArrowDown size={12} />
        </Button>
      </div>
    </div>
  );
});
