/**
 * Custom-model card — renders a single AFX-managed (editable) or hand-edited
 * (read-only) custom-provider summary.
 *
 * @see docs/specs/214-app-chat-settings/spec.md [FR-8] [FR-9]
 * @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-CUSTOM-MODELS]
 */
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  KeyRound,
  Pencil,
  Server,
  Trash2,
} from "lucide-react";

import type { CustomProviderSummary } from "@afx/shared";
import { Badge } from "@afx/ui/components/badge";
import { Button } from "@afx/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@afx/ui/components/card";

import { MODELS } from "../lib/settings-copy";

export interface CustomModelCardProps {
  summary: CustomProviderSummary;
  onEdit?: () => void;
  onRemove?: () => void;
  onOpenInEditor?: () => void;
  /**
   * When true, the Remove button is in its "armed / click-again-to-confirm" state.
   * Parent (settings.tsx) auto-disarms after a few seconds.
   */
  removeArmed?: boolean;
}

const KEY_MASK = "••••••••••••";

/**
 * Renders one custom-provider card. `editable` mode shows Edit/Remove; `readonly`
 * mode (origin === "hand-edited") shows an "Open in editor" button only.
 *
 * Surfaces (a) the redacted model list so the user can verify what they configured,
 * and (b) a masked indicator when an apiKey is set so the "is the key saved?"
 * affordance is visible without leaking the value.
 *
 * @see docs/specs/214-app-chat-settings/spec.md [FR-8] [FR-9] [NFR-1]
 */
export function CustomModelCard({
  summary,
  onEdit,
  onRemove,
  onOpenInEditor,
  removeArmed = false,
}: CustomModelCardProps) {
  const editable = summary.origin === "afx-managed";
  const title = summary.displayName ?? summary.id;
  return (
    <Card size="sm">
      <CardHeader className="gap-1">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-1.5 text-[12px]">
            <Server size={12} className="shrink-0 text-afx-brand-soft" />
            <span className="truncate">{title}</span>
          </CardTitle>
          <Badge variant={editable ? "secondary" : "outline"} className="shrink-0">
            {editable ? MODELS.customSdkBadge : "READ-ONLY"}
          </Badge>
        </div>
        <p className="truncate text-[10px] text-muted-foreground">{summary.baseUrl}</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
          <span>{summary.api}</span>
          <span aria-hidden="true">·</span>
          <span>
            {summary.modelCount} {summary.modelCount === 1 ? "model" : "models"}
          </span>
        </div>

        {summary.apiKeySource !== "none" ? (
          <div className="flex items-center gap-1.5 rounded-sm border bg-muted/30 px-1.5 py-1">
            {summary.hasApiKey ? (
              <CheckCircle2 size={10} className="shrink-0 text-emerald-600" />
            ) : (
              <KeyRound size={10} className="shrink-0 text-afx-brand-soft" />
            )}
            <span className="font-mono text-[10px] tracking-wide text-foreground">{KEY_MASK}</span>
            <span className="text-[10px] text-muted-foreground">·</span>
            <span className="truncate text-[10px] text-muted-foreground">
              {summary.apiKeyLabel ?? summary.apiKeySource}
            </span>
          </div>
        ) : null}

        {summary.models.length > 0 ? (
          <ul className="flex flex-col gap-0.5 rounded-sm border bg-card/30 px-1.5 py-1">
            {summary.models.map((model) => (
              <li key={model.id} className="flex items-baseline justify-between gap-2 text-[10px]">
                <span className="truncate font-medium text-foreground">{model.id}</span>
                {model.contextWindow ? (
                  <span className="shrink-0 text-muted-foreground">
                    {Math.round(model.contextWindow / 1000)}k ctx
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}

        {summary.hasLiteralApiKeyOnDisk ? (
          <div className="flex items-center gap-1 text-[10px] text-amber-600">
            <AlertTriangle size={10} />
            Literal API key on disk
          </div>
        ) : null}
        <div className="mt-1 flex flex-wrap gap-1.5">
          {editable ? (
            <>
              <Button
                type="button"
                size="xs"
                variant="outline"
                onClick={onEdit}
                aria-label={`${MODELS.customSdkEditLabel} ${title}`}
              >
                <Pencil size={10} />
                {MODELS.customSdkEditLabel}
              </Button>
              <Button
                type="button"
                size="xs"
                variant={removeArmed ? "destructive" : "outline"}
                onClick={onRemove}
                aria-label={
                  removeArmed
                    ? `Click again to remove ${title}`
                    : `${MODELS.customSdkRemoveLabel} ${title}`
                }
              >
                <Trash2 size={10} />
                {removeArmed ? "Click again to confirm" : MODELS.customSdkRemoveLabel}
              </Button>
            </>
          ) : (
            <Button
              type="button"
              size="xs"
              variant="outline"
              onClick={onOpenInEditor}
              aria-label={`Open ${title} in editor`}
            >
              <ExternalLink size={10} />
              Open in editor
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
