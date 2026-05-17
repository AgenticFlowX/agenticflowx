/**
 * Composer activity strip above the composer input.
 *
 * @see docs/specs/216-app-chat-window-componentization/design.md [DES-FILES]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-FOOTER]
 */
import { memo } from "react";

export interface ComposerActivityBarProps {
  thinking: string | null;
  isStreaming: boolean;
  isSystemCommand: boolean;
}

export const ComposerActivityBar = memo(function ComposerActivityBar({
  thinking,
  isStreaming,
  isSystemCommand,
}: ComposerActivityBarProps) {
  const preview =
    isStreaming && thinking
      ? thinking.length > 120
        ? thinking.slice(0, 120) + "…"
        : thinking
      : null;

  return (
    <div className="shrink-0 border-t bg-muted/30 px-3 py-1.5">
      <div className="flex items-center gap-1.5">
        {isSystemCommand ? (
          <>
            <span className="inline-flex items-center gap-1 rounded bg-amber-500/20 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider text-amber-500">
              Shell
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground/50">
              local execution
            </span>
          </>
        ) : isStreaming ? (
          <>
            <span className="inline-block h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-afx-brand" />
            <span className="inline-flex items-baseline font-mono text-[10px] uppercase tracking-[0.14em]">
              <span className="afx-thinking-word bg-gradient-to-r from-afx-brand via-afx-brand-soft to-foreground bg-clip-text text-transparent">
                thinking
              </span>
              <span aria-hidden className="ml-0.5 inline-flex w-3 text-afx-brand-soft">
                <span className="afx-thinking-dot">.</span>
                <span className="afx-thinking-dot">.</span>
                <span className="afx-thinking-dot">.</span>
              </span>
            </span>
          </>
        ) : (
          <>
            <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/30" />
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground/50">
              idle
            </span>
          </>
        )}
      </div>
      {preview && (
        <p className="mt-0.5 truncate pl-3 font-serif text-[11px] italic text-muted-foreground">
          {preview}
        </p>
      )}
    </div>
  );
});
