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

import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  CornerDownLeft,
  Info,
  Lightbulb,
  Newspaper,
  Trash2,
  X,
  Zap,
} from "lucide-react";

import type { WorkspaceMode } from "@afx/shared";
import { Button } from "@afx/ui/components/button";
import { cn } from "@afx/ui/lib/utils";

export interface QueuedMessage {
  id: string;
  content: string;
  mode: "followUp" | "steer";
  sentAt: number;
}

export type ComposerNoticeKind = "tip" | "info" | "alert" | "news" | "success";

export interface ComposerNoticePanelBodyProps {
  kind?: ComposerNoticeKind;
  children?: ReactNode;
}

const COMPOSER_NOTICE_VARIANTS = {
  tip: { label: "Tip", Icon: Lightbulb, className: "text-afx-brand-soft" },
  info: { label: "Info", Icon: Info, className: "text-muted-foreground" },
  alert: { label: "Alert", Icon: AlertTriangle, className: "text-amber-500" },
  news: { label: "News", Icon: Newspaper, className: "text-afx-brand-soft" },
  success: { label: "Done", Icon: CheckCircle2, className: "text-emerald-500" },
} satisfies Record<ComposerNoticeKind, { label: string; Icon: typeof Info; className: string }>;

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
 * Generic notice body for low-noise tips, information, alerts, news, and success
 * messages mounted inside standard `ComposerPanel` chrome.
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-16]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-NOTICE-PANEL]
 */
export function ComposerNoticePanelBody({ kind = "info", children }: ComposerNoticePanelBodyProps) {
  const variant = COMPOSER_NOTICE_VARIANTS[kind];
  const Icon = variant.Icon;
  return (
    <div className="flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground">
      <Icon size={12} className={cn("mt-0.5 shrink-0", variant.className)} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "font-mono text-[10px] font-semibold uppercase tracking-[0.14em]",
            variant.className,
          )}
        >
          {variant.label}
        </p>
        {children ? <div className="mt-0.5">{children}</div> : null}
      </div>
    </div>
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
