/**
 * @see docs/specs/211-app-chat-composer/spec.md [FR-5]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-MODEL-COMBOBOX] [DES-COMPOSER-RUNTIME]
 */
import { useState } from "react";

import { KeyRound, Server, Settings2, Sparkles } from "lucide-react";

import type { AgentModel } from "@afx/shared";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@afx/ui/components/accordion";
import { Button, buttonVariants } from "@afx/ui/components/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxGroup,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
  ComboboxSeparator,
  ComboboxTrigger,
} from "@afx/ui/components/combobox";
import { cn } from "@afx/ui/lib/utils";

export interface ModelComboboxProps {
  models: readonly AgentModel[];
  value?: Pick<AgentModel, "provider" | "id" | "name" | "instanceId">;
  disabled?: boolean;
  onSelect: (model: AgentModel) => void;
  onOpenSettings?: () => void;
}

/**
 * Renders the composer model selector with API-provider and external-agent groups.
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-5]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-MODEL-COMBOBOX]
 */
export function ModelCombobox({
  models,
  value,
  disabled,
  onSelect,
  onOpenSettings,
}: ModelComboboxProps) {
  const selected = models.find((m) => isSameModel(m, value)) ?? null;
  const grouped = groupModels(models);
  const triggerLabel = selected ? formatModelTriggerLabel(selected) : (value?.name ?? value?.id);
  const [open, setOpen] = useState(false);

  function openSettingsAndClose(): void {
    setOpen(false);
    if (!onOpenSettings) return;
    window.setTimeout(onOpenSettings, 150);
  }

  return (
    <Combobox<AgentModel>
      open={open}
      onOpenChange={setOpen}
      value={selected}
      onValueChange={(model) => {
        if (!model) return;
        setOpen(false);
        onSelect(model);
      }}
      itemToStringLabel={(model: AgentModel) => formatModelName(model)}
      itemToStringValue={(model) =>
        `${model.instanceId ?? "default"}:${model.provider}:${model.id}`
      }
      isItemEqualToValue={isSameModel}
      autoHighlight
    >
      <ComboboxTrigger
        aria-label="Switch model"
        disabled={disabled}
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "cn-button min-w-0 max-w-full px-1.5 [&>svg:last-child]:hidden @[260px]:[&>svg:last-child]:block",
        )}
      >
        <Sparkles className="shrink-0 text-afx-brand-soft" />
        <span className="hidden min-w-0 max-w-[9rem] truncate font-mono text-[10px] tracking-tight @[260px]:inline">
          {triggerLabel ?? "Select model"}
        </span>
      </ComboboxTrigger>
      <ComboboxContent side="top" align="start" className="w-72 max-w-[calc(100vw-1rem)]">
        <ComboboxList>
          {models.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-3 py-4 text-xs text-muted-foreground">
              <p>No models available.</p>
              <Button type="button" size="xs" variant="outline" onClick={openSettingsAndClose}>
                Open Settings
              </Button>
            </div>
          ) : null}
          {grouped.api.map(([provider, providerModels], index) => (
            <ComboboxGroup key={provider}>
              {index > 0 && <ComboboxSeparator />}
              <ComboboxLabel className="flex items-center gap-1.5 font-mono uppercase tracking-[0.14em]">
                <KeyRound size={11} />
                {formatProviderLabel(provider)}
              </ComboboxLabel>
              {providerModels.map((model) => renderModelItem(model))}
            </ComboboxGroup>
          ))}
          {grouped.external.length > 0 ? (
            <>
              {grouped.api.length > 0 && <ComboboxSeparator />}
              <Accordion type="single" collapsible defaultValue="external" className="px-1">
                <AccordionItem value="external" className="border-b-0">
                  <AccordionTrigger className="py-1.5 text-[11px]">
                    <span className="flex items-center gap-1.5">
                      <Server size={11} />
                      External Agents ({grouped.external.length})
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="pb-1">
                    {grouped.external.map(([instanceId, instanceModels], index) => (
                      <ComboboxGroup key={instanceId}>
                        {index > 0 && <ComboboxSeparator />}
                        <ComboboxLabel className="font-mono uppercase tracking-[0.14em]">
                          {instanceModels[0]?.instanceLabel ?? instanceId}
                        </ComboboxLabel>
                        {instanceModels.map((model) => renderModelItem(model))}
                      </ComboboxGroup>
                    ))}
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </>
          ) : null}
          {models.length > 0 ? (
            <>
              <ComboboxSeparator />
              <div className="p-1">
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={openSettingsAndClose}
                >
                  <Settings2 size={11} />
                  Manage providers and agents…
                </Button>
              </div>
            </>
          ) : null}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

export function formatModelName(model: Pick<AgentModel, "name" | "id">): string {
  return model.name || model.id;
}

function renderModelItem(model: AgentModel) {
  return (
    <ComboboxItem
      key={`${model.instanceId ?? "default"}:${model.provider}:${model.id}`}
      value={model}
    >
      <div className="min-w-0">
        <p className="truncate text-[11px] font-medium">{formatModelName(model)}</p>
        <p className="truncate font-mono text-[10px] text-muted-foreground">
          {model.id}
          {model.contextWindow > 0 ? ` · ${formatWindow(model.contextWindow)}` : ""}
        </p>
      </div>
    </ComboboxItem>
  );
}

/**
 * Groups models by provider/runtime source so the picker mirrors Settings provider concepts.
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-5]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-MODEL-COMBOBOX]
 */
function groupModels(models: readonly AgentModel[]): {
  api: Array<[string, AgentModel[]]>;
  external: Array<[string, AgentModel[]]>;
} {
  const apiGroups = new Map<string, AgentModel[]>();
  const externalGroups = new Map<string, AgentModel[]>();
  for (const model of models) {
    const groups = model.source === "external-agent" ? externalGroups : apiGroups;
    const key =
      model.source === "external-agent" ? (model.instanceId ?? "external") : model.provider;
    const list = groups.get(key) ?? [];
    list.push(model);
    groups.set(key, list);
  }
  return {
    api: [...apiGroups.entries()].sort(([a], [b]) => a.localeCompare(b)),
    external: [...externalGroups.entries()].sort(([a], [b]) => a.localeCompare(b)),
  };
}

function isSameModel(
  a: Pick<AgentModel, "provider" | "id" | "instanceId"> | null | undefined,
  b: Pick<AgentModel, "provider" | "id" | "instanceId"> | null | undefined,
): boolean {
  return Boolean(
    a &&
    b &&
    a.provider === b.provider &&
    a.id === b.id &&
    (a.instanceId ?? "default") === (b.instanceId ?? "default"),
  );
}

function formatWindow(value: number): string {
  if (value >= 1_000_000) return `${Math.round(value / 1_000_000)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}k`;
  return String(value);
}

function formatProviderLabel(provider: string): string {
  return provider.replace(
    /(^|[-_\s])([a-z])/g,
    (_match, prefix: string, char: string) =>
      `${prefix === "-" || prefix === "_" ? " " : prefix}${char.toUpperCase()}`,
  );
}

function formatModelTriggerLabel(model: AgentModel): string {
  const runtimeLabel =
    model.source === "external-agent"
      ? (model.instanceLabel ?? "CLI")
      : formatProviderLabel(model.provider);
  return `${runtimeLabel} · ${formatModelName(model)}`;
}
