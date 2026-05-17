/**
 * Generic runtime recovery card shared by Chat, History, and Settings.
 *
 * @see docs/specs/214-app-chat-settings/spec.md [FR-1] [FR-4]
 * @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-COMPONENT-RECOVERY-CARD] [DES-SETTINGS-MOCKUP-RECOVERY]
 */
import { AlertTriangle, RefreshCw, RotateCcw, Settings, Zap } from "lucide-react";

import type { AgentRuntimeStatus } from "@afx/shared";
import { Button } from "@afx/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@afx/ui/components/card";
import { cn } from "@afx/ui/lib/utils";

/**
 * Recovery actions supplied by the host shell.
 *
 * @see docs/specs/214-app-chat-settings/spec.md [FR-1] [FR-4]
 * @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-COMPONENT-RECOVERY-CARD] [DES-SETTINGS-FLOW]
 */
export interface AgentRecoveryActions {
  onRetryConnection?: () => void;
  onRestartAgent?: () => void;
  onOpenSettings?: () => void;
  onReloadHost?: () => void;
}

/**
 * Shared recovery state for confirmed long disconnects/errors.
 *
 * @see docs/specs/214-app-chat-settings/spec.md [FR-1] [FR-4]
 * @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-COMPONENT-RECOVERY-CARD] [DES-SETTINGS-MOCKUP-RECOVERY]
 */
export function AgentRecoveryCard({
  status,
  actions,
  className,
}: {
  status: AgentRuntimeStatus;
  actions?: AgentRecoveryActions;
  className?: string;
}) {
  const checkedAt = status.checkedAt ? new Date(status.checkedAt).toLocaleTimeString() : null;
  const restartRequired = status.restartRequired === true;
  const description = restartRequired
    ? "Automatic runtime retries are stopped after repeated start failures. Fix the binary or provider setting, then restart manually."
    : status.phase === "error"
      ? "The agent runtime reported an error. Retry first; restart if the connection does not recover."
      : "The agent runtime has not reported readiness for a while. Retry first; restart if it stays unavailable.";

  return (
    <Card size="sm" className={cn("border-destructive/30 bg-card/90", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <AlertTriangle size={14} />
          Agent runtime needs attention
        </CardTitle>
        <CardDescription>
          {description}
          {checkedAt ? <span className="block">Last checked at {checkedAt}.</span> : null}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {status.info ? (
          <p className="rounded-sm border bg-muted/30 px-2 py-1.5 font-mono text-[10px] text-muted-foreground">
            {status.info}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="xs"
            onClick={actions?.onRetryConnection}
            disabled={restartRequired || !actions?.onRetryConnection}
          >
            <RefreshCw size={12} />
            Retry connection
          </Button>
          <Button
            type="button"
            size="xs"
            variant="outline"
            onClick={actions?.onRestartAgent}
            disabled={!actions?.onRestartAgent}
          >
            <Zap size={12} />
            Restart agent
          </Button>
          <Button
            type="button"
            size="xs"
            variant="ghost"
            onClick={actions?.onOpenSettings}
            disabled={!actions?.onOpenSettings}
          >
            <Settings size={12} />
            Open settings
          </Button>
          <Button
            type="button"
            size="xs"
            variant="ghost"
            onClick={actions?.onReloadHost}
            disabled={!actions?.onReloadHost}
          >
            <RotateCcw size={12} />
            Reload window/app
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
