/**
 * Composer footer with Pi/runtime hints and usage stats.
 *
 * @see docs/specs/216-app-chat-window-componentization/design.md [DES-FILES]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-FOOTER]
 */
import { memo } from "react";

import { Cpu } from "lucide-react";

import type { AgentRuntimePhase, WorkspaceMode } from "@afx/shared";
import { cn } from "@afx/ui/lib/utils";

export interface ComposerFooterUsageStats {
  tokens: { input: number; output: number; cacheRead: number; cacheWrite: number; total: number };
  cost: number;
  contextUsage?: { tokens: number | null; contextWindow: number; percent: number | null };
}

export interface ComposerFooterProps {
  hintId?: string;
  usage: ComposerFooterUsageStats | null;
  isCheckingAgent: boolean;
  runtimeUnavailable: boolean;
  runtimeUnconfigured: boolean;
  isStreaming: boolean;
  rpcEnabled: boolean;
  agentPhase: AgentRuntimePhase;
  onPiWarningClick?: () => void;
  isSystemCommand?: boolean;
  workspaceMode: WorkspaceMode;
}

export const ComposerFooter = memo(function ComposerFooter({
  hintId,
  usage,
  isCheckingAgent,
  runtimeUnavailable,
  runtimeUnconfigured,
  isStreaming,
  rpcEnabled,
  agentPhase,
  onPiWarningClick,
  isSystemCommand,
  workspaceMode,
}: ComposerFooterProps) {
  const hint =
    workspaceMode === "explore"
      ? "Read-only / Safe · ⌘⇧M to switch"
      : workspaceMode === "spec"
        ? "Planning / Docs only · ⌘⇧M to switch"
        : isSystemCommand
          ? "⚠ Shell · output is local only"
          : isCheckingAgent
            ? "Checking agent runtime readiness…"
            : runtimeUnconfigured
              ? rpcEnabled
                ? "Configure a provider or fix Pi RPC in Settings."
                : "Configure an API provider or enable Pi RPC in Settings."
              : runtimeUnavailable
                ? "Connection recovery is required before sending."
                : isStreaming
                  ? "⏎ follow-up · ⌘⏎ steer · ⌘⇧⏎ note · ↑ history"
                  : "⏎ follow-up · ⌘⏎ steer · idle: ⏎ send · ⌘⇧⏎ note · ↑ history";

  const statsText = usage
    ? [
        `${fmtTokens(usage.tokens.total)} tokens`,
        usage.contextUsage?.percent != null
          ? `ctx ${Math.round(usage.contextUsage.percent)}%`
          : null,
        usage.cost > 0 ? `$${usage.cost.toFixed(usage.cost < 1 ? 4 : 2)}` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : null;

  return (
    <div className="@container mt-1.5 flex h-4 items-center justify-between gap-2 px-1">
      <div className="flex min-w-0 items-center gap-2">
        {rpcEnabled ? <PiPill phase={agentPhase} onWarningClick={onPiWarningClick} /> : null}
        {statsText ? (
          <span
            className="flex min-w-0 items-center gap-1 truncate font-mono text-[10px] text-muted-foreground/60"
            title={usage ? usageTooltip(usage) : undefined}
          >
            <Cpu size={10} className="shrink-0 text-afx-brand-soft/40" />
            <span className="truncate">{statsText}</span>
          </span>
        ) : null}
      </div>
      <span
        id={hintId}
        className="hidden min-w-0 shrink-0 truncate text-right font-sans text-[10px] text-muted-foreground/60 @[280px]:inline"
      >
        {hint}
      </span>
    </div>
  );
});

function PiPill({
  phase,
  onWarningClick,
}: {
  phase: AgentRuntimePhase;
  onWarningClick?: () => void;
}) {
  const isWarning = phase === "disconnected" || phase === "error";
  const isReady = phase === "ready" || phase === "busy";

  const dotClass = isWarning
    ? "bg-amber-500/80"
    : isReady
      ? "bg-afx-brand-soft"
      : "bg-muted-foreground/40";
  const labelClass = isWarning
    ? "text-amber-500/80"
    : isReady
      ? "text-afx-brand-soft/80"
      : "text-muted-foreground/50";

  const dot = (
    <span
      aria-hidden
      className={cn(
        "inline-block h-1.5 w-1.5 shrink-0 rounded-full",
        dotClass,
        phase === "checking" || phase === "starting" ? "animate-pulse" : null,
      )}
    />
  );

  const label = (
    <span
      className={cn(
        "hidden font-mono text-[10px] uppercase tracking-[0.12em] @[280px]:inline",
        labelClass,
      )}
    >
      pi
    </span>
  );

  if (isWarning && onWarningClick) {
    return (
      <button
        type="button"
        onClick={onWarningClick}
        title="Pi runtime not reachable — open settings"
        aria-label="Pi runtime not reachable, open settings"
        className="flex shrink-0 items-center gap-1 rounded-sm px-1 -mx-1 transition-colors hover:bg-amber-500/10"
      >
        {dot}
        {label}
      </button>
    );
  }

  return (
    <span
      title={isReady ? "Pi runtime ready" : "Checking Pi runtime…"}
      className="flex shrink-0 items-center gap-1"
    >
      {dot}
      {label}
    </span>
  );
}

function usageTooltip(usage: ComposerFooterUsageStats): string {
  const lines = [`Total tokens: ${fmtTokens(usage.tokens.total)}`];
  if (usage.tokens.input > 0) lines.push(`  Input:  ${fmtTokens(usage.tokens.input)}`);
  if (usage.tokens.output > 0) lines.push(`  Output: ${fmtTokens(usage.tokens.output)}`);
  if (usage.tokens.cacheRead > 0) lines.push(`  Cache read:  ${fmtTokens(usage.tokens.cacheRead)}`);
  if (usage.tokens.cacheWrite > 0) {
    lines.push(`  Cache write: ${fmtTokens(usage.tokens.cacheWrite)}`);
  }
  if (usage.contextUsage) {
    const percent = usage.contextUsage.percent;
    lines.push(`Context: ${percent != null ? Math.round(percent) + "%" : "unknown"}`);
  }
  if (usage.cost > 0) lines.push(`Cost: $${usage.cost.toFixed(usage.cost < 1 ? 4 : 2)}`);
  return lines.join("\n");
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}m`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}
