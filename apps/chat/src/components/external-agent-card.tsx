/**
 * External local-agent settings card (Pi RPC and future adapters).
 * Used in the Runtimes group when the new InstanceCard pattern is not available.
 *
 * @see docs/specs/214-app-chat-settings/spec.md [FR-1] [FR-4]
 * @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-COMPONENT-EXTERNAL-AGENT-CARD] [DES-SETTINGS-INSTANCE-CARDS]
 */
import { CircleCheck, ExternalLink, Folder, PlugZap, Server } from "lucide-react";

import { Badge } from "@afx/ui/components/badge";
import { Button } from "@afx/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@afx/ui/components/card";
import { Input } from "@afx/ui/components/input";
import { Label } from "@afx/ui/components/label";
import { Switch } from "@afx/ui/components/switch";
import { cn } from "@afx/ui/lib/utils";

export interface ExternalAgentCardProps {
  id: string;
  name: string;
  status: "connected" | "disabled" | "unavailable" | "coming-soon";
  modelCount: number;
  binaryPath?: string;
  versionLabel?: string;
  enabled?: boolean;
  ephemeral?: boolean;
  onDetectBinary?: () => Promise<void>;
  onOpenBinarySetting?: () => void;
  onToggleEnabled?: (enabled: boolean) => void;
  onToggleEphemeral?: (enabled: boolean) => void;
}

/**
 * Renders one external/local-agent provider card for Pi RPC and future adapters.
 *
 * @see docs/specs/214-app-chat-settings/spec.md [FR-1] [FR-4]
 * @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-COMPONENT-EXTERNAL-AGENT-CARD] [DES-SETTINGS-INSTANCE-CARDS]
 */
export function ExternalAgentCard({
  id,
  name,
  status,
  modelCount,
  binaryPath,
  versionLabel,
  enabled,
  ephemeral = false,
  onDetectBinary,
  onOpenBinarySetting,
  onToggleEnabled,
  onToggleEphemeral,
}: ExternalAgentCardProps) {
  const disabled = status === "coming-soon";
  const rpcEnabled = enabled ?? (status !== "disabled" && status !== "coming-soon");
  return (
    <Card size="sm" className={cn("bg-card/40", disabled && "opacity-60")}>
      <CardHeader className="pb-2">
        <CardTitle className="flex flex-wrap items-start gap-2 text-[12px]">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border bg-muted/30">
            {disabled ? (
              <Server size={12} className="text-muted-foreground" />
            ) : (
              <PlugZap size={12} className="text-afx-brand-soft" />
            )}
          </span>
          <span className="min-w-[6rem] flex-1">
            <span className="block truncate">{name}</span>
            <CardDescription className="mt-0.5">
              {versionLabel ??
                (disabled ? "Planned local agent support" : "Opt-in local Pi RPC subprocess")}
            </CardDescription>
          </span>
          <Badge
            variant={status === "connected" ? "secondary" : "outline"}
            className="shrink-0 text-[9px]"
          >
            {status === "connected"
              ? `${modelCount} models`
              : status === "disabled"
                ? "Off"
                : status === "coming-soon"
                  ? "Soon"
                  : "Missing"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {disabled ? (
          <p className="rounded-sm border bg-muted/30 px-2 py-2 text-[11px] text-muted-foreground">
            OpenCode, Crush, and Aider can be added here later without changing the chat flow.
          </p>
        ) : (
          <>
            <div className="flex items-center gap-1.5 rounded-sm border bg-muted/30 px-2 py-1.5 text-[11px]">
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  status === "connected" ? "bg-afx-success" : "bg-muted-foreground",
                )}
              />
              {status === "connected" ? (
                <>
                  <CircleCheck size={12} className="text-afx-success" />
                  <span>Connected</span>
                </>
              ) : status === "disabled" ? (
                <span className="text-muted-foreground">RPC disabled</span>
              ) : (
                <span className="text-muted-foreground">Not detected</span>
              )}
            </div>
            {onToggleEnabled ? (
              <div className="flex items-center justify-between gap-3 rounded-sm border bg-muted/30 px-2 py-2">
                <div className="min-w-0">
                  <Label htmlFor={`external-agent-enabled-${id}`} className="text-[11px]">
                    Enable Pi RPC
                  </Label>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    Starts Pi with --mode rpc so AFX can stream events and call runtime controls.
                  </p>
                </div>
                <Switch
                  id={`external-agent-enabled-${id}`}
                  checked={rpcEnabled}
                  onCheckedChange={onToggleEnabled}
                />
              </div>
            ) : null}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`external-agent-${id}`} className="text-[10px] text-muted-foreground">
                Binary path
              </Label>
              <p className="text-[10px] text-muted-foreground">
                Command name or absolute path used only after Pi RPC is enabled.
              </p>
              <div className="flex flex-wrap gap-1.5">
                <Input
                  id={`external-agent-${id}`}
                  readOnly
                  value={binaryPath ?? "Auto-detect from PATH"}
                  className="min-w-[7rem] flex-1 font-mono text-[10px]"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="shrink-0"
                  onClick={() => void onDetectBinary?.()}
                >
                  Detect
                </Button>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Open binary setting"
                  onClick={onOpenBinarySetting}
                >
                  <Folder size={12} />
                </Button>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-sm border bg-muted/30 px-2 py-2">
              <div className="min-w-0">
                <Label htmlFor={`external-agent-ephemeral-${id}`} className="text-[11px]">
                  Ephemeral sessions
                </Label>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  Maps to Pi --no-session. Leave off for resumable sessions in the shared directory.
                </p>
              </div>
              <Switch
                id={`external-agent-ephemeral-${id}`}
                checked={ephemeral}
                onCheckedChange={onToggleEphemeral}
              />
            </div>
            <Button asChild size="xs" variant="link" className="self-start px-0">
              <a href="https://github.com/mariozechner/pi" target="_blank" rel="noreferrer">
                Open Pi docs
                <ExternalLink size={11} />
              </a>
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
