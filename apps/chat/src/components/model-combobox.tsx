/**
 * Renders the composer combined model/thinking control with nested model grouping.
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-5]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-MODEL-COMBOBOX] [DES-COMPOSER-RUNTIME] [DES-COMPOSER-MOCKUP-RUNTIME-MENU]
 */
import { useState } from "react";

import { Brain, ChevronDown, KeyRound, Server, Settings2 } from "lucide-react";
import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui";

import type { AgentModel, ThinkingLevel } from "@afx/shared";
import { Button, buttonVariants } from "@afx/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
} from "@afx/ui/components/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@afx/ui/components/tooltip";
import { cn } from "@afx/ui/lib/utils";

/**
 * Props for the combined composer model/thinking control.
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-5]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-MODEL-COMBOBOX] [DES-COMPOSER-RUNTIME] [DES-COMPOSER-MOCKUP-RUNTIME-MENU]
 */
export interface ModelComboboxProps {
  models: readonly AgentModel[];
  value?: Pick<AgentModel, "provider" | "id" | "name" | "instanceId">;
  thinkingLevel?: ThinkingLevel;
  disabled?: boolean;
  onSelect: (model: AgentModel) => void;
  onSelectThinkingLevel: (level: ThinkingLevel) => void;
  onOpenSettings?: () => void;
  /**
   * Map of provider id → user-set display name from the AFX-managed custom-providers
   * snapshot. When a provider id matches a key in this map, the dropdown group label
   * uses the display name instead of the title-cased id.
   *
   * @see docs/specs/214-app-chat-settings/spec.md [FR-9]
   */
  customProviderLabels?: Readonly<Record<string, string>>;
}

const THINKING_LEVELS: ReadonlyArray<{ level: ThinkingLevel; label: string }> = [
  { level: "minimal", label: "Minimal" },
  { level: "low", label: "Low" },
  { level: "medium", label: "Medium" },
  { level: "high", label: "High" },
  { level: "xhigh", label: "Extra High" },
] as const;

/**
 * Renders the composer combined model/thinking selector with provider and external-agent groups.
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-5]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-MODEL-COMBOBOX] [DES-COMPOSER-RUNTIME]
 */
export function ModelCombobox({
  models,
  value,
  thinkingLevel,
  disabled,
  onSelect,
  onSelectThinkingLevel,
  onOpenSettings,
  customProviderLabels,
}: ModelComboboxProps) {
  const [open, setOpen] = useState(false);
  const selectedModel = models.find((m) => isSameModel(m, value)) ?? null;
  const currentThinking =
    THINKING_LEVELS.find((item) => item.level === thinkingLevel) ?? THINKING_LEVELS[2];
  const selectedModelKey = selectedModel ? getModelKey(selectedModel) : "";
  const displayModel = selectedModel ?? value ?? null;
  const selectedModelLabel = displayModel ? formatModelName(displayModel) : "";
  const triggerLabel = formatComposerSelectionLabel(selectedModel ?? value, currentThinking.label);
  const triggerAriaLabel = selectedModelLabel
    ? `Model: ${selectedModelLabel}. Thinking level: ${currentThinking.label}`
    : `Select model. Thinking level: ${currentThinking.label}`;
  const grouped = groupModels(models);

  function openSettingsAndClose(): void {
    setOpen(false);
    if (!onOpenSettings) return;
    window.setTimeout(onOpenSettings, 150);
  }

  function selectModel(nextValue: string): void {
    const nextModel = models.find((model) => getModelKey(model) === nextValue);
    if (!nextModel) return;
    setOpen(false);
    onSelect(nextModel);
  }

  function selectThinking(nextValue: string): void {
    setOpen(false);
    onSelectThinkingLevel(nextValue as ThinkingLevel);
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuPrimitive.Trigger asChild>
            <button
              type="button"
              disabled={disabled}
              aria-label={triggerAriaLabel}
              className={cn(
                buttonVariants({ variant: "ghost", size: "sm" }),
                "cn-button min-w-7 max-w-full shrink gap-1 px-1.5",
              )}
            >
              <Brain className="shrink-0 text-afx-brand-soft" />
              <span className="hidden min-w-0 max-w-[7.5rem] truncate font-mono text-[10px] tracking-tight @[260px]:inline">
                {triggerLabel}
              </span>
              <ChevronDown className="hidden shrink-0 text-muted-foreground @[260px]:block" />
            </button>
          </DropdownMenuPrimitive.Trigger>
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          align="start"
          className="max-w-xs flex-col items-start gap-1 text-left"
        >
          <span>Choose the model and thinking level for the next turn.</span>
          {selectedModelLabel ? (
            <span className="break-words font-mono text-[10px] opacity-80">
              {selectedModelLabel}
            </span>
          ) : null}
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent
        side="top"
        align="start"
        collisionPadding={8}
        className="max-h-[min(34rem,calc(100vh-2rem))] w-[min(20rem,calc(100vw-1rem))] overflow-y-auto"
      >
        <DropdownMenuLabel className="font-mono uppercase tracking-[0.14em]">
          Thinking Level
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup value={currentThinking.level} onValueChange={selectThinking}>
          {THINKING_LEVELS.map(({ level, label }) => (
            <DropdownMenuRadioItem key={level} value={level} className="text-[11px] font-medium">
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>

        <DropdownMenuSeparator />
        <DropdownMenuLabel className="font-mono uppercase tracking-[0.14em]">
          Model
        </DropdownMenuLabel>
        {models.length === 0 ? (
          <div className="flex flex-col items-start gap-2 px-3 py-4 text-xs text-muted-foreground">
            <p>No models available.</p>
            {onOpenSettings ? (
              <Button type="button" size="xs" variant="outline" onClick={openSettingsAndClose}>
                Open Settings
              </Button>
            ) : null}
          </div>
        ) : (
          <>
            <DropdownMenuRadioGroup value={selectedModelKey} onValueChange={selectModel}>
              {grouped.api.length > 0 ? (
                <>
                  <DropdownMenuLabel className="flex items-center gap-1.5 font-mono uppercase tracking-[0.14em]">
                    <KeyRound size={11} />
                    Provider
                  </DropdownMenuLabel>
                  {grouped.api.map(([provider, providerModels], index) => (
                    <div key={provider}>
                      {index > 0 ? <DropdownMenuSeparator /> : null}
                      <DropdownMenuLabel className="px-2 py-2 font-mono uppercase tracking-[0.14em]">
                        {customProviderLabels?.[provider] ?? formatProviderLabel(provider)}
                      </DropdownMenuLabel>
                      {providerModels.map((model) => renderModelItem(model))}
                    </div>
                  ))}
                </>
              ) : null}

              {grouped.external.length > 0 ? (
                <>
                  {grouped.api.length > 0 ? <DropdownMenuSeparator /> : null}
                  <DropdownMenuLabel className="flex items-center gap-1.5 font-mono uppercase tracking-[0.14em]">
                    <Server size={11} />
                    External Agents
                  </DropdownMenuLabel>
                  {grouped.external.map(([instanceId, instanceModels], index) => (
                    <div key={instanceId}>
                      {index > 0 ? <DropdownMenuSeparator /> : null}
                      <DropdownMenuLabel className="px-2 py-2 font-mono uppercase tracking-[0.14em]">
                        {instanceModels[0]?.instanceLabel ?? instanceId}
                      </DropdownMenuLabel>
                      {instanceModels.map((model) => renderModelItem(model))}
                    </div>
                  ))}
                </>
              ) : null}
            </DropdownMenuRadioGroup>

            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={openSettingsAndClose} className="gap-1.5">
              <Settings2 size={11} />
              Manage providers and agents…
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function renderModelItem(model: AgentModel) {
  return (
    <DropdownMenuRadioItem key={getModelKey(model)} value={getModelKey(model)}>
      <div className="min-w-0">
        <p className="truncate text-[11px] font-medium">{formatModelName(model)}</p>
        <p className="truncate font-mono text-[10px] text-muted-foreground">
          {model.id}
          {model.contextWindow > 0 ? ` · ${formatWindow(model.contextWindow)}` : ""}
        </p>
      </div>
    </DropdownMenuRadioItem>
  );
}

function formatComposerSelectionLabel(
  model: Pick<AgentModel, "name" | "id"> | null | undefined,
  thinkingLabel: string,
): string {
  const modelLabel = model ? "Model" : "Select model";
  return `${modelLabel} - ${thinkingLabel}`;
}

function getModelKey(model: Pick<AgentModel, "provider" | "id" | "instanceId">): string {
  return `${model.instanceId ?? "default"}:${model.provider}:${model.id}`;
}

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

function formatModelName(model: Pick<AgentModel, "name" | "id">): string {
  return model.name || model.id;
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
