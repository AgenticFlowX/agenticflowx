/**
 * API Provider settings card.
 *
 * @see docs/specs/000-plans/plan-pi-hybrid-runtime.md
 */
import { useState } from "react";

import { ChevronDown, CircleCheck, ExternalLink, Key, TriangleAlert } from "lucide-react";

import type { AgentModel, ProviderConnectionState } from "@afx/shared";
import { Badge } from "@afx/ui/components/badge";
import { Button } from "@afx/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@afx/ui/components/card";
import { Input } from "@afx/ui/components/input";
import { Label } from "@afx/ui/components/label";
import { NativeSelect, NativeSelectOption } from "@afx/ui/components/native-select";
import { cn } from "@afx/ui/lib/utils";

export interface ProviderCardProps {
  provider: string;
  displayName: string;
  modelHint: string;
  state: ProviderConnectionState;
  configuredModelCount?: number;
  defaultModel?: string;
  modelOptions?: readonly AgentModel[];
  helpUrl?: string;
  onSaveKey: (key: string) => Promise<void>;
  onClearKey: () => Promise<void>;
  onChangeDefault: (modelId: string) => Promise<void>;
}

export function ProviderCard({
  provider,
  displayName,
  modelHint,
  state,
  configuredModelCount = 0,
  defaultModel,
  modelOptions = [],
  helpUrl,
  onSaveKey,
  onClearKey,
  onChangeDefault,
}: ProviderCardProps) {
  const [keyValue, setKeyValue] = useState("");
  const [pending, setPending] = useState(false);
  const configured = state === "configured" || state === "invalid";
  const noKeyNeeded = state === "no-key-needed";
  const [expanded, setExpanded] = useState(true);
  const panelId = `provider-details-${provider}`;
  const toggleLabel = expanded
    ? "Collapse"
    : noKeyNeeded
      ? "View details"
      : configured
        ? "Replace key"
        : "Paste key";

  async function saveKey(): Promise<void> {
    const trimmed = keyValue.trim();
    if (!trimmed) return;
    setPending(true);
    try {
      await onSaveKey(trimmed);
      setKeyValue("");
    } finally {
      setPending(false);
    }
  }

  async function clearKey(): Promise<void> {
    setPending(true);
    try {
      await onClearKey();
      setKeyValue("");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card size="sm" className="bg-card/40">
      <CardHeader className="pb-2">
        <CardTitle className="flex flex-wrap items-start gap-2 text-[12px]">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border bg-muted/30">
            <Key size={12} className="text-afx-brand-soft" />
          </span>
          <span className="min-w-[6rem] flex-1">
            <span className="block truncate">{displayName}</span>
            <CardDescription className="mt-0.5">{modelHint}</CardDescription>
          </span>
          <ProviderBadge state={state} count={configuredModelCount} />
          <Button
            type="button"
            size="xs"
            variant={expanded ? "ghost" : "outline"}
            className="h-6 px-1.5 text-[10px]"
            aria-label={`${toggleLabel} ${displayName}`}
            aria-expanded={expanded}
            aria-controls={panelId}
            onClick={() => setExpanded((value) => !value)}
          >
            {toggleLabel}
            <ChevronDown
              size={12}
              className={cn("transition-transform", expanded ? "rotate-180" : "")}
            />
          </Button>
        </CardTitle>
      </CardHeader>
      {expanded ? (
        <CardContent id={panelId} className="flex flex-col gap-2">
          {configured ? (
            <div
              className="flex items-center justify-between gap-2 rounded-sm border bg-muted/30 px-2 py-1.5"
              data-clarity-mask="true"
            >
              <span className="flex min-w-0 items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
                {state === "invalid" ? (
                  <TriangleAlert size={12} className="text-afx-warning" />
                ) : (
                  <CircleCheck size={12} className="text-afx-success" />
                )}
                <span className="truncate">•••••••••• saved</span>
              </span>
              <Button
                type="button"
                size="xs"
                variant="ghost"
                className="h-6 px-1.5 text-[10px]"
                aria-label={`Remove ${displayName} key`}
                disabled={pending}
                onClick={() => void clearKey()}
              >
                Remove
              </Button>
            </div>
          ) : null}

          {noKeyNeeded ? (
            <p className="rounded-sm border bg-muted/30 px-2 py-2 text-[11px] text-muted-foreground">
              Local models are discovered from the configured base URL. No provider key is stored in
              VS Code.
            </p>
          ) : (
            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor={`provider-key-${provider}`}
                className="text-[10px] text-muted-foreground"
              >
                {configured ? "Paste replacement key" : "Paste API key"}
              </Label>
              <div className="flex flex-wrap gap-1.5">
                <Input
                  id={`provider-key-${provider}`}
                  data-clarity-mask="true"
                  type="password"
                  value={keyValue}
                  placeholder={configured ? "Paste replacement key" : "Paste provider key"}
                  autoComplete="off"
                  className="min-w-[6rem] flex-1"
                  onChange={(event) => setKeyValue(event.currentTarget.value)}
                />
                <Button
                  type="button"
                  size="sm"
                  className="shrink-0"
                  disabled={pending || keyValue.trim().length === 0}
                  onClick={() => void saveKey()}
                >
                  {configured ? "Update key" : "Save key"}
                </Button>
              </div>
              <p className="text-[10px] leading-relaxed text-muted-foreground">
                Saved in VS Code Secret Storage and used only by the API Provider SDK runtime.
              </p>
            </div>
          )}

          {modelOptions.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor={`provider-default-${provider}`}
                className="text-[10px] text-muted-foreground"
              >
                Default model
              </Label>
              <p className="text-[10px] text-muted-foreground">
                Used when this provider is selected from Chat or configured as the SDK default.
              </p>
              <NativeSelect
                id={`provider-default-${provider}`}
                size="sm"
                className="w-full"
                value={defaultModel ?? modelOptions[0]?.id ?? ""}
                onChange={(event) => void onChangeDefault(event.currentTarget.value)}
              >
                {modelOptions.map((model) => (
                  <NativeSelectOption key={model.id} value={model.id}>
                    {model.name || model.id}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
          ) : null}

          {helpUrl ? (
            <Button asChild size="xs" variant="link" className="self-start px-0">
              <a href={helpUrl} target="_blank" rel="noreferrer">
                Get a key
                <ExternalLink size={11} />
              </a>
            </Button>
          ) : null}
        </CardContent>
      ) : null}
    </Card>
  );
}

function ProviderBadge({ state, count }: { state: ProviderConnectionState; count: number }) {
  const label =
    state === "configured"
      ? `${count} models`
      : state === "invalid"
        ? "Invalid"
        : state === "no-key-needed"
          ? `${count} local`
          : "Needs key";
  return (
    <Badge
      variant={
        state === "invalid" ? "destructive" : state === "configured" ? "secondary" : "outline"
      }
      className={cn("shrink-0 text-[9px]", state === "no-key-needed" && "text-afx-success")}
    >
      {label}
    </Badge>
  );
}
