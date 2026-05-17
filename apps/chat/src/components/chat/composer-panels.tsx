/**
 * Composer panel bodies, titles, and header actions — registered with
 * `ComposerPanelStack` via the controller's `composerPanelStackConfig`. Each
 * `*PanelBody` renders only the inner content; chrome (title, count, tone,
 * collapse, dismiss, error boundary) comes from `ComposerPanel`.
 *
 * @see docs/specs/216-app-chat-window-componentization/design.md [DES-DATA] [DES-FILES] [DES-UI]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-STRIP] [DES-COMPOSER-QUEUE]
 */
import type { ReactNode } from "react";

import { AlertTriangle, Copy, CornerDownLeft, Trash2, X, Zap } from "lucide-react";

import type { WorkspaceMode } from "@afx/shared";
import { Button } from "@afx/ui/components/button";
import { cn } from "@afx/ui/lib/utils";

import { type ActiveDocCtx, describeDoc, resolveDocActions } from "../../lib/doc-actions";
import { docKindVisual } from "../chat-doc-kind-visual";

export interface QueuedMessage {
  id: string;
  content: string;
  mode: "followUp" | "steer";
  sentAt: number;
}

/** Host-blocked shell command surfaced when Explore mode rejects a runCommand. */
export interface BlockedActionView {
  requestId: string;
  command: string;
  title: string;
  message: string;
  mode: WorkspaceMode;
}

/**
 * Renders the queue rows. Mounted by `ComposerPanelStack` through the panel
 * registry; chrome (title, count badge, dismiss) comes from `ComposerPanel`.
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-4]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-QUEUE]
 */
export function QueuePanel({
  queued,
  onDismiss,
}: {
  queued: readonly QueuedMessage[];
  onDismiss: (id: string) => void;
}) {
  const steers = queued.filter((q) => q.mode === "steer");
  const follows = queued.filter((q) => q.mode === "followUp");
  return (
    <ul className="flex flex-col gap-0.5">
      {steers.map((q, index) => (
        <QueueRow
          key={q.id}
          item={q}
          marker={steers.length > 1 ? `${index + 1}.` : "→"}
          kindIcon={<Zap size={10} className="text-afx-brand-soft" />}
          onDismiss={onDismiss}
        />
      ))}
      {follows.map((q, index) => (
        <QueueRow
          key={q.id}
          item={q}
          marker={`${index + 1}.`}
          kindIcon={<CornerDownLeft size={10} className="text-muted-foreground/70" />}
          onDismiss={onDismiss}
        />
      ))}
    </ul>
  );
}

/**
 * Header action for the queue panel — mounted in `ComposerPanelDefinition.actions`.
 *
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-QUEUE]
 */
export function QueueClearAllAction({ onClearAll }: { onClearAll: () => void }) {
  return (
    <button
      type="button"
      onClick={onClearAll}
      className="inline-flex shrink-0 items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] text-muted-foreground/80 hover:bg-muted hover:text-foreground"
    >
      <Trash2 size={10} />
      Clear all
    </button>
  );
}

/**
 * Body for the host-blocked system-command panel (Explore mode).
 *
 * @see docs/specs/201-app-vscode-panels/spec.md [FR-11]
 * @see docs/specs/211-app-chat-composer/spec.md [FR-13]
 */
export function BlockedCommandPanelBody({
  action,
  onCopyCommand,
}: {
  action: BlockedActionView;
  onCopyCommand: () => void | Promise<void>;
}) {
  const commandText = `! ${action.command}`.trim();
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-start gap-2">
        <AlertTriangle size={12} className="mt-0.5 shrink-0 text-amber-500" />
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-500">
            {action.title}
          </p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
            {action.message}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 rounded-sm border border-amber-500/20 bg-amber-500/5 px-2 py-1">
        <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-foreground">
          {commandText}
        </span>
        <Button
          type="button"
          size="xs"
          variant="outline"
          className="shrink-0"
          onClick={() => void onCopyCommand()}
        >
          <Copy className="size-3" />
          <span>Copy command</span>
        </Button>
      </div>
    </div>
  );
}

/**
 * Header title for the mode-suggest panel — uses doc icon + detected file label.
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-15]
 */
export function ModeSuggestPanelTitle({ docContext }: { docContext: ActiveDocCtx }) {
  if (!docContext.docKind) return null;
  const detected = docContext.format === "sprint" ? "Sprint" : "AFX";
  const docLabelHint = describeDoc(docContext);
  const { icon: DocIcon, accent } = docKindVisual(docContext.docKind);
  return (
    <span className="inline-flex items-center gap-1.5">
      <DocIcon size={11} className={cn("shrink-0", accent)} aria-hidden />
      <span>
        {detected} file detected (<span className="font-mono">{docLabelHint}</span>)
      </span>
    </span>
  );
}

/**
 * Body for the mode-suggest panel — explanatory copy + quick-glance action pills.
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-15]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-STRIP]
 */
export function ModeSuggestPanelBody({ docContext }: { docContext: ActiveDocCtx }) {
  const actions = resolveDocActions(docContext).slice(0, 5);
  return (
    <>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Switching unlocks targeted actions for this file. Spec mode stays focused on specs and docs
        instead of source edits.
      </p>
      {actions.length > 0 ? (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {actions.map((action) => (
            <span
              key={action.command}
              className="inline-flex items-center gap-1 rounded-sm border border-afx-brand-soft/30 bg-afx-brand-soft/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-afx-brand-soft"
            >
              {action.autoSend ? <Zap size={10} className="shrink-0 text-amber-500" /> : null}
              {action.label}
            </span>
          ))}
        </div>
      ) : null}
    </>
  );
}

/**
 * Body for the AFX-command-suggest panel.
 *
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-STRIP]
 */
export function AfxCommandSuggestPanelBody() {
  return (
    <p className="text-[11px] leading-relaxed text-muted-foreground">
      That command worked here. Switch to Spec mode for the action rail, stage tracker, and approval
      workflow.
    </p>
  );
}

/**
 * Renders one queued composer row and explains that dismissal only hides local display.
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-4]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-QUEUE]
 */
function QueueRow({
  item,
  marker,
  kindIcon,
  onDismiss,
}: {
  item: QueuedMessage;
  marker: string;
  kindIcon: ReactNode;
  onDismiss: (id: string) => void;
}) {
  const label = item.mode === "steer" ? "Steer" : "Follow-up";
  return (
    <li
      className="group/queue-item flex items-start gap-1.5 rounded-sm py-0.5 pl-1 pr-0.5 hover:bg-muted/60"
      title={
        item.mode === "steer"
          ? "Steers the active turn at the next agent step"
          : "Runs after the active turn completes"
      }
    >
      <span className="mt-[2px] shrink-0">{kindIcon}</span>
      <span
        className={cn(
          "mt-[1px] shrink-0 font-mono text-[10px] tabular-nums",
          item.mode === "steer" ? "text-afx-brand-soft" : "text-muted-foreground/80",
        )}
      >
        {marker}
      </span>
      <span
        className={cn(
          "mt-[1px] shrink-0 rounded px-1 py-px text-[9px] font-medium uppercase tracking-wide",
          item.mode === "steer"
            ? "bg-afx-brand-soft/10 text-afx-brand-soft"
            : "bg-muted text-muted-foreground",
        )}
      >
        {label}
      </span>
      <span className="line-clamp-2 min-w-0 flex-1 text-[11px] leading-relaxed text-foreground/90">
        {item.content}
      </span>
      <button
        type="button"
        onClick={() => onDismiss(item.id)}
        className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-muted-foreground/0 transition-colors group-hover/queue-item:text-muted-foreground/70 hover:bg-muted hover:!text-foreground"
        aria-label="Hide from queue display"
        title="Hide from queue display (already sent to engine)"
      >
        <X size={10} />
      </button>
    </li>
  );
}
