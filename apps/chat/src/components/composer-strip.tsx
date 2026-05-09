/**
 * ComposerStrip — generic collapsible container that sits flush above the chat composer.
 *
 * Used for queued messages, tips, news, system errors. The component is purely chrome:
 * presence in the tree is visibility — callers control unmount.
 *
 * Dismissal modes:
 *  - User-closable: pass onDismiss → ✕ button shown, click fires callback.
 *  - Auto-dismiss:  pass onDismiss + autoDismissMs → timer fires onDismiss.
 *  - Persistent:    omit both → no ✕, no timer; parent unmounts when its condition flips.
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-4]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-STRIP] [DES-COMPOSER-QUEUE]
 * @see docs/specs/215-app-chat-notes/spec.md [FR-1]
 */
import { type ReactNode, useEffect, useState } from "react";

import { ChevronDown, ChevronRight, X } from "lucide-react";

import { cn } from "@afx/ui/lib/utils";

export interface ComposerStripAction {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
}

export interface ComposerStripProps {
  /**
   * Title rendered in the strip header. Accepts a string or any inline ReactNode
   * (e.g. icon + label) so callers can mirror the Workbench icon vocabulary.
   *
   * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-STRIP]
   */
  title: ReactNode;
  count?: number;
  tone?: "neutral" | "brand" | "warning";
  action?: ComposerStripAction;
  /**
   * Free-form ReactNode rendered between the title button and the dismiss
   * control. Used by the doc-actions strip header to host the workflow-position
   * breadcrumb and the strip-side Memory ▾ anchor — both carry their own click
   * handlers and so cannot live inside the title's toggle button.
   *
   * @see docs/specs/211-app-chat-composer/spec.md [FR-17] [FR-18]
   * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-STRIP]
   */
  headerExtras?: ReactNode;
  onDismiss?: () => void;
  autoDismissMs?: number;
  defaultExpanded?: boolean;
  children: ReactNode;
}

/**
 * Renders reusable collapsible strip chrome above the composer.
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-4]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-STRIP]
 */
export function ComposerStrip({
  title,
  count,
  tone = "neutral",
  action,
  headerExtras,
  onDismiss,
  autoDismissMs,
  defaultExpanded = true,
  children,
}: ComposerStripProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  useEffect(() => {
    if (autoDismissMs == null || !onDismiss) return;
    const timer = setTimeout(onDismiss, autoDismissMs);
    return () => clearTimeout(timer);
  }, [autoDismissMs, onDismiss]);

  const toneClass =
    tone === "brand"
      ? "border-afx-brand-soft/40"
      : tone === "warning"
        ? "border-amber-500/40"
        : "border-border";

  return (
    <div
      className={cn(
        "afx-surface-card mb-1.5 overflow-hidden rounded-md border shadow-sm",
        toneClass,
      )}
    >
      <header className="flex items-center gap-2 px-2 py-1">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="inline-flex min-w-0 flex-1 items-center gap-1.5 text-left"
          aria-expanded={expanded}
          title={expanded ? "Collapse" : "Expand"}
        >
          {expanded ? (
            <ChevronDown size={11} className="shrink-0 text-muted-foreground/70" />
          ) : (
            <ChevronRight size={11} className="shrink-0 text-muted-foreground/70" />
          )}
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {title}
          </span>
          {count != null && (
            <span className="font-mono text-[10px] text-muted-foreground/60">· {count}</span>
          )}
        </button>
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className="inline-flex shrink-0 items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] text-muted-foreground/80 hover:bg-muted hover:text-foreground"
          >
            {action.icon}
            {action.label}
          </button>
        )}
        {headerExtras ? (
          <div className="flex shrink-0 items-center gap-1.5">{headerExtras}</div>
        ) : null}
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Close"
            title="Close"
            className="inline-flex shrink-0 items-center justify-center rounded-sm p-0.5 text-muted-foreground/60 hover:bg-muted hover:text-foreground"
          >
            <X size={11} />
          </button>
        )}
      </header>
      {expanded && <div className="border-t border-border/60 px-2 py-1.5">{children}</div>}
      {autoDismissMs != null && onDismiss && (
        <div aria-hidden className="h-px overflow-hidden">
          <div
            className="h-full bg-muted-foreground/30"
            style={{ animation: `composer-strip-fill ${autoDismissMs}ms linear forwards` }}
          />
        </div>
      )}
    </div>
  );
}
