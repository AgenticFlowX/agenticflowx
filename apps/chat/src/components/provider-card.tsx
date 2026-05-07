/**
 * API Provider settings card — full expanded form and compact tile variant.
 *
 * @see docs/specs/214-app-chat-settings/spec.md [FR-1] [NFR-3]
 * @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-COMPONENT-PROVIDER-CARD] [DES-SETTINGS-MOCKUP-MODELS]
 */
import { useState } from "react";

import {
  ChevronDown,
  ChevronRight,
  CircleCheck,
  ExternalLink,
  Key,
  TriangleAlert,
} from "lucide-react";

import type { AgentModel, ProviderConnectionState } from "@afx/shared";
import { Badge } from "@afx/ui/components/badge";
import { Button } from "@afx/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@afx/ui/components/card";
import { Input } from "@afx/ui/components/input";
import { Label } from "@afx/ui/components/label";
import { NativeSelect, NativeSelectOption } from "@afx/ui/components/native-select";
import { cn } from "@afx/ui/lib/utils";

import { MODELS } from "../lib/settings-copy";

export interface ProviderCardProps {
  provider: string;
  displayName: string;
  modelHint: string;
  state: ProviderConnectionState;
  configuredModelCount?: number;
  defaultModel?: string;
  modelOptions?: readonly AgentModel[];
  helpUrl?: string;
  /** When true the card renders as a compact tile showing name + badge + model count.
   *  Clicking the tile calls onExpand to let the parent toggle expanded state. */
  compact?: boolean;
  onExpand?: () => void;
  onSaveKey: (key: string) => Promise<void>;
  onClearKey: () => Promise<void>;
  onChangeDefault: (modelId: string) => Promise<void>;
}

/**
 * Renders one API provider card.
 *
 * When compact=true renders a tile (name + status badge + model count) — clicking calls onExpand.
 * When compact=false renders the full credential/model form.
 *
 * @see docs/specs/214-app-chat-settings/spec.md [FR-1] [NFR-3]
 * @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-COMPONENT-PROVIDER-CARD]
 */
export function ProviderCard({
  provider,
  displayName,
  modelHint,
  state,
  configuredModelCount = 0,
  defaultModel,
  modelOptions = [],
  helpUrl,
  compact = false,
  onExpand,
  onSaveKey,
  onClearKey,
  onChangeDefault,
}: ProviderCardProps) {
  const [keyValue, setKeyValue] = useState("");
  const [pending, setPending] = useState(false);
  const configured = state === "configured" || state === "invalid";
  const noKeyNeeded = state === "no-key-needed";
  const panelId = `provider-details-${provider}`;

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

  // ─── Compact tile variant (used in the 2-column grid) ─────────────────────
  if (compact) {
    const statusTooltip =
      state === "configured" || state === "no-key-needed"
        ? state === "configured"
          ? MODELS.providerReadyTooltip
          : MODELS.providerActiveTooltip
        : MODELS.providerNeedsKeyTooltip;
    return (
      <button
        type="button"
        aria-label={`${displayName} — click to expand`}
        aria-expanded={false}
        aria-controls={panelId}
        title={statusTooltip}
        onClick={onExpand}
        className="flex min-h-[3rem] w-full flex-col gap-1 rounded-md border bg-card/40 px-2.5 py-2 text-left transition-colors hover:bg-card/70"
      >
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border bg-muted/30">
            <Key size={10} className="text-afx-brand-soft" />
          </span>
          <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-foreground">
            {displayName}
          </span>
          <ProviderBadge state={state} count={configuredModelCount} />
          <ChevronRight size={11} className="shrink-0 text-muted-foreground" />
        </div>
        <span className="truncate pl-5.5 text-[9px] text-muted-foreground">{modelHint}</span>
      </button>
    );
  }

  // ─── Full expanded form ────────────────────────────────────────────────────
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
          {onExpand && (
            <Button
              type="button"
              size="xs"
              variant="ghost"
              className="h-6 px-1.5 text-[10px]"
              aria-label={`Collapse ${displayName}`}
              aria-expanded={true}
              aria-controls={panelId}
              onClick={onExpand}
            >
              Collapse
              <ChevronDown size={12} className="rotate-180 transition-transform" />
            </Button>
          )}
        </CardTitle>
      </CardHeader>
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
              title={MODELS.removeKeyTooltip}
              disabled={pending}
              onClick={() => void clearKey()}
            >
              {MODELS.removeKeyLabel}
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
            <div className="flex items-center gap-1">
              <Label
                htmlFor={`provider-key-${provider}`}
                className="text-[10px] text-muted-foreground"
              >
                {configured ? "Paste replacement key" : MODELS.apiKeyLabel}
              </Label>
              <span className="text-[9px] text-muted-foreground" title={MODELS.apiKeyTooltip}>
                [?]
              </span>
            </div>
            <p className="text-[10px] leading-relaxed text-muted-foreground">
              {MODELS.apiKeyDescription}
            </p>
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
          </div>
        )}

        {modelOptions.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1">
              <Label
                htmlFor={`provider-default-${provider}`}
                className="text-[10px] text-muted-foreground"
              >
                {MODELS.defaultModelLabel}
              </Label>
              <span className="text-[9px] text-muted-foreground" title={MODELS.defaultModelTooltip}>
                [?]
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground">{MODELS.defaultModelDescription}</p>
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
    </Card>
  );
}

/**
 * Maps provider connection state to the compact status badge shown in ProviderCard.
 *
 * @see docs/specs/214-app-chat-settings/spec.md [FR-1] [NFR-3]
 * @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-COMPONENT-PROVIDER-CARD]
 */
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
        state === "invalid"
          ? "destructive"
          : state === "configured" || state === "no-key-needed"
            ? "secondary"
            : "outline"
      }
      className={cn(
        "shrink-0 text-[9px]",
        state === "no-key-needed" && "text-afx-success",
        (state === "configured" || state === "no-key-needed") && "bg-afx-success/15",
      )}
    >
      {label}
    </Badge>
  );
}
