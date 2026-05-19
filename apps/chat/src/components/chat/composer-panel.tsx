/**
 * Reusable composer panel chrome — the standard (and only) surface used by
 * every entry in the `ComposerPanelStack` registry. Supports a count badge,
 * tone variants (neutral/brand/warning), an actions slot, optional collapse
 * and dismiss controls, and a per-panel error boundary.
 *
 * @see docs/specs/216-app-chat-window-componentization/spec.md [FR-10]
 * @see docs/specs/216-app-chat-window-componentization/design.md [DES-DATA] [DES-A11Y]
 */
import { Component, type ErrorInfo, type ReactNode, memo } from "react";

import { Minus, Plus, X } from "lucide-react";

import { cn } from "@afx/ui/lib/utils";

export type ComposerPanelTone = "neutral" | "brand" | "warning";

export interface ComposerPanelProps {
  title: ReactNode;
  /** A11y label slug — defaults to a slugified `title` if `title` is a string. */
  titleId?: string;
  children: ReactNode;
  actions?: ReactNode;
  /** Right-aligned inline header content placed between the title and actions. */
  headerExtras?: ReactNode | ((state: { collapsed: boolean }) => ReactNode);
  /** Numeric badge rendered next to the title (e.g. queue or modified-files count). */
  count?: number;
  tone?: ComposerPanelTone;
  collapsible?: boolean;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  dismissible?: boolean;
  onDismiss?: () => void;
  /**
   * When true the title row uses the panel-default mono-uppercase styling
   * ("TITLE · count"). Set false to use a plain `h3 text-xs` chrome for panels
   * that want a richer/non-uppercase title.
   */
  monoHeader?: boolean;
}

export const ComposerPanel = memo(function ComposerPanel({
  title,
  titleId,
  children,
  actions,
  headerExtras,
  count,
  tone = "neutral",
  collapsible = false,
  collapsed = false,
  onCollapsedChange,
  dismissible = false,
  onDismiss,
  monoHeader = true,
}: ComposerPanelProps) {
  const computedTitleId = titleId ?? `composer-panel-${slugifyTitle(title)}`;
  const resolvedHeaderExtras =
    typeof headerExtras === "function" ? headerExtras({ collapsed }) : headerExtras;
  const toneClass =
    tone === "brand"
      ? "border-afx-brand-soft/40"
      : tone === "warning"
        ? "border-amber-500/40"
        : "border-border";

  return (
    <section
      role="region"
      aria-labelledby={computedTitleId}
      // Child container queries must measure the panel, not the wider composer.
      className={cn(
        "afx-surface-card @container overflow-hidden rounded-md border shadow-sm",
        toneClass,
      )}
    >
      <div className="flex items-center gap-1.5 px-2 py-1">
        {/* Collapsible panels make the title row a toggle target. */}
        {collapsible ? (
          <button
            type="button"
            id={computedTitleId}
            aria-expanded={!collapsed}
            onClick={() => onCollapsedChange?.(!collapsed)}
            className={cn(
              "min-w-0 flex-1 truncate text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/50",
              monoHeader
                ? "font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground"
                : "text-xs font-medium hover:text-foreground",
            )}
          >
            {title}
            {count != null ? (
              <span className="ml-1 font-mono text-[10px] text-muted-foreground/60">· {count}</span>
            ) : null}
          </button>
        ) : (
          <h3
            id={computedTitleId}
            className={cn(
              "min-w-0 flex-1 truncate",
              monoHeader
                ? "font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
                : "text-xs font-medium",
            )}
          >
            {title}
            {count != null ? (
              <span className="ml-1 font-mono text-[10px] text-muted-foreground/60">· {count}</span>
            ) : null}
          </h3>
        )}
        {resolvedHeaderExtras ? (
          <div className="flex shrink-0 items-center gap-1.5">{resolvedHeaderExtras}</div>
        ) : null}
        {/* Panel actions appear before minimize and close. */}
        <div className="flex shrink-0 items-center gap-1">
          {actions}
          {collapsible ? (
            <button
              type="button"
              className="rounded-sm p-0.5 text-muted-foreground/60 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/50"
              aria-label={
                collapsed ? `Expand ${stringifyTitle(title)}` : `Minimize ${stringifyTitle(title)}`
              }
              aria-expanded={!collapsed}
              title={collapsed ? "Expand" : "Minimize"}
              onClick={() => onCollapsedChange?.(!collapsed)}
            >
              {collapsed ? <Plus size={11} /> : <Minus size={11} />}
            </button>
          ) : null}
          {dismissible ? (
            <button
              type="button"
              className="rounded-sm p-0.5 text-muted-foreground/60 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/50"
              aria-label={`Dismiss ${stringifyTitle(title)}`}
              title="Close"
              onClick={onDismiss}
            >
              <X size={11} />
            </button>
          ) : null}
        </div>
      </div>
      <ComposerPanelErrorBoundary title={stringifyTitle(title)}>
        <div
          className={cn("border-t border-border/60 px-2 py-1.5", collapsed ? "hidden" : null)}
          aria-hidden={collapsed}
        >
          {children}
        </div>
      </ComposerPanelErrorBoundary>
    </section>
  );
});

function slugifyTitle(title: ReactNode): string {
  return stringifyTitle(title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");
}

function stringifyTitle(title: ReactNode): string {
  if (typeof title === "string" || typeof title === "number") return String(title);
  return "panel";
}

class ComposerPanelErrorBoundary extends Component<
  { title: string; children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, errorInfo: ErrorInfo): void {
    console.error("Composer panel failed", { title: this.props.title, error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-2 text-[11px] text-destructive" role="alert">
          {this.props.title} panel failed to render.
        </div>
      );
    }
    return this.props.children;
  }
}
