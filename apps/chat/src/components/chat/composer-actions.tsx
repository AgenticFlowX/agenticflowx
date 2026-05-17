/**
 * Composer action controls for memory, send, follow-up, steer, and stop.
 *
 * @see docs/specs/216-app-chat-window-componentization/design.md [DES-FILES] [DES-UI]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-FLOW] [DES-COMPOSER-KEYS]
 */
import { memo } from "react";

import { ArrowUp, Plus, Square, Zap } from "lucide-react";

import { Button } from "@afx/ui/components/button";

import type { MemoryCatalogItem } from "../../lib/doc-actions";
import { ChatMemoryMenuButton } from "../chat-memory-menu-button";

export interface ComposerActionsProps {
  disabled: boolean;
  isStreaming: boolean;
  canSend: boolean;
  onMemorySelect: (item: MemoryCatalogItem) => void;
  onSend: () => void;
  onQueueFollowUp: () => void;
  onSteer: () => void;
  onStop: () => void;
}

export const ComposerActions = memo(function ComposerActions({
  disabled,
  isStreaming,
  canSend,
  onMemorySelect,
  onSend,
  onQueueFollowUp,
  onSteer,
  onStop,
}: ComposerActionsProps) {
  return (
    <div className="ml-auto flex shrink-0 items-center gap-1">
      <ChatMemoryMenuButton
        onSelect={onMemorySelect}
        disabled={disabled}
        side="top"
        align="end"
        size="composer"
        preventMouseDown
      />
      {isStreaming ? (
        <>
          {canSend ? (
            <>
              <Button
                size="sm"
                variant="secondary"
                onClick={onQueueFollowUp}
                onMouseDown={(e) => e.preventDefault()}
                aria-label="Queue follow-up"
                title="Queue this message to run after the active turn (Enter)"
                className="h-7 gap-1 px-1.5 text-[11px]"
              >
                <Plus className="size-3.5" />
                <span>Follow-up</span>
                <span className="rounded-sm border border-current/20 px-1 font-mono text-[9px] leading-4 opacity-75">
                  ⏎
                </span>
              </Button>
              <Button
                size="sm"
                variant="default"
                onClick={onSteer}
                onMouseDown={(e) => e.preventDefault()}
                aria-label="Steer turn"
                title="Interrupt the active turn and redirect with this message (Command/Ctrl+Enter)"
                className="h-7 gap-1 px-1.5 text-[11px]"
              >
                <Zap className="size-3.5" />
                <span>Steer</span>
                <span className="rounded-sm border border-current/20 px-1 font-mono text-[9px] leading-4 opacity-75">
                  ⌘⏎
                </span>
              </Button>
            </>
          ) : null}
          <Button
            size="icon-sm"
            variant="destructive"
            onClick={onStop}
            onMouseDown={(e) => e.preventDefault()}
            aria-label="Stop"
            title="Stop the active turn"
          >
            <Square />
          </Button>
        </>
      ) : (
        <Button
          size="icon-sm"
          variant={canSend ? "default" : "secondary"}
          onClick={onSend}
          onMouseDown={(e) => e.preventDefault()}
          disabled={!canSend}
          aria-label="Send"
          title="Send (⏎)"
        >
          <ArrowUp />
        </Button>
      )}
    </div>
  );
});
