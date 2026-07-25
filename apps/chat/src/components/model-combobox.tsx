/**
 * Renders the composer combined model/thinking control as a searchable, method-segmented
 * Popover + Command selector (Subscription / API key / Local / External Agents).
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-5]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-MODEL-COMBOBOX] [DES-COMPOSER-RUNTIME] [DES-COMPOSER-MOCKUP-RUNTIME-MENU]
 * @see docs/specs/217-app-chat-model-selector/spec.md [FR-1] [FR-2] [FR-4] [FR-5] [FR-7]
 * @see docs/specs/217-app-chat-model-selector/design.md [DES-UI] [DES-SEG] [DES-SEARCH]
 */
import { useMemo, useState } from "react";

import { Brain, ChevronDown, HardDrive, KeyRound, Server, Settings2, Sparkles } from "lucide-react";

import type { AgentModel, ThinkingLevel } from "@afx/shared";
import { Button, buttonVariants } from "@afx/ui/components/button";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@afx/ui/components/command";
import { Popover, PopoverContent, PopoverTrigger } from "@afx/ui/components/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@afx/ui/components/tooltip";
import { cn } from "@afx/ui/lib/utils";

import type { SettingsOpenTarget } from "../lib/settings-navigation";

/**
 * Props for the combined composer model/thinking control.
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-5]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-MODEL-COMBOBOX] [DES-COMPOSER-RUNTIME] [DES-COMPOSER-MOCKUP-RUNTIME-MENU]
 */
export interface ModelComboboxProps {
  models: readonly AgentModel[];
  value?: Pick<AgentModel, "provider" | "id" | "name" | "instanceId" | "authMethod">;
  thinkingLevel?: ThinkingLevel;
  availableThinkingLevels?: readonly ThinkingLevel[];
  disabled?: boolean;
  onSelect: (model: AgentModel) => void;
  onSelectThinkingLevel: (level: ThinkingLevel) => void;
  onOpenSettings?: (target?: SettingsOpenTarget) => void;
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
  { level: "off", label: "Off" },
  { level: "minimal", label: "Minimal" },
  { level: "low", label: "Low" },
  { level: "medium", label: "Medium" },
  { level: "high", label: "High" },
  { level: "xhigh", label: "Extra High" },
  { level: "max", label: "Max" },
] as const;

/**
 * Renders the composer combined model/thinking selector with provider and external-agent groups.
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-5]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-MODEL-COMBOBOX] [DES-COMPOSER-RUNTIME]
 * @see docs/specs/217-app-chat-model-selector/spec.md [FR-1] [FR-2] [FR-4] [FR-5] [FR-7]
 * @see docs/specs/217-app-chat-model-selector/design.md [DES-UI] [DES-SEG] [DES-SEARCH]
 */
export function ModelCombobox({
  models,
  value,
  thinkingLevel,
  availableThinkingLevels,
  disabled,
  onSelect,
  onSelectThinkingLevel,
  onOpenSettings,
  customProviderLabels,
}: ModelComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selectedModel = models.find((m) => isSameModel(m, value)) ?? null;
  const thinkingOptions =
    availableThinkingLevels && availableThinkingLevels.length > 0
      ? THINKING_LEVELS.filter((item) => availableThinkingLevels.includes(item.level))
      : THINKING_LEVELS;
  const currentThinking =
    thinkingOptions.find((item) => item.level === thinkingLevel) ??
    THINKING_LEVELS.find((item) => item.level === thinkingLevel) ??
    thinkingOptions.find((item) => item.level === "medium") ??
    thinkingOptions[0] ??
    THINKING_LEVELS.find((item) => item.level === "medium")!;
  const selectedModelKey = selectedModel ? getModelKey(selectedModel) : "";
  const displayModel = selectedModel ?? value ?? null;
  const selectedModelLabel = displayModel ? formatModelName(displayModel) : "";
  const selectedMethodLabel = displayModel ? formatMethodLabel(displayModel) : null;
  const selectedMethodChip = displayModel ? formatMethodChip(displayModel) : null;
  const triggerLabel = formatComposerSelectionLabel(selectedModel ?? value, currentThinking.label);
  const triggerAriaLabel = selectedModelLabel
    ? `Model: ${selectedModelLabel}. Method: ${selectedMethodChip}. Thinking level: ${currentThinking.label}`
    : `Select model. Thinking level: ${currentThinking.label}`;
  const searchActive = query.trim().length > 0;
  const grouped = useMemo(
    () =>
      groupModelSegments(filterModels(models, query, customProviderLabels), customProviderLabels),
    [customProviderLabels, models, query],
  );
  const visibleModelCount = grouped.reduce((count, segment) => count + segment.models.length, 0);

  function openSettingsAndClose(): void {
    setOpen(false);
    if (!onOpenSettings) return;
    window.setTimeout(() => onOpenSettings("connect"), 150);
  }

  function selectModel(nextModel: AgentModel): void {
    setOpen(false);
    setQuery("");
    onSelect(nextModel);
  }

  function selectThinking(nextValue: string): void {
    setOpen(false);
    setQuery("");
    onSelectThinkingLevel(nextValue as ThinkingLevel);
  }

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setQuery("");
      }}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
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
              <span className="hidden min-w-0 max-w-[7.5rem] truncate font-mono text-[10px] @[260px]:inline">
                {triggerLabel}
              </span>
              {selectedMethodLabel ? (
                <span className="hidden h-4 max-w-[4.5rem] shrink-0 items-center truncate border border-border/70 px-1 font-mono text-[9px] uppercase text-muted-foreground @[340px]:inline-flex">
                  {formatMethodChip(displayModel)}
                </span>
              ) : null}
              <ChevronDown className="hidden shrink-0 text-muted-foreground @[260px]:block" />
            </button>
          </PopoverTrigger>
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
          {selectedMethodLabel ? (
            <span className="font-mono text-[10px] opacity-80">{selectedMethodLabel}</span>
          ) : null}
        </TooltipContent>
      </Tooltip>
      <PopoverContent
        side="top"
        align="start"
        collisionPadding={8}
        className="w-[min(21rem,calc(100vw-1rem))] p-0"
      >
        <Command shouldFilter={false} label="Search models">
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Search models..."
            aria-label="Search models"
          />

          {!searchActive ? (
            <div className="border-b px-2 py-2">
              <p className="mb-1.5 font-mono text-[10px] uppercase text-muted-foreground">
                Thinking Level
              </p>
              <div className="grid grid-cols-7 gap-1">
                {thinkingOptions.map(({ level, label }) => (
                  <Button
                    key={level}
                    type="button"
                    size="xs"
                    variant={currentThinking.level === level ? "secondary" : "ghost"}
                    className="min-w-0 px-1 text-[10px]"
                    aria-pressed={currentThinking.level === level}
                    onClick={() => selectThinking(level)}
                  >
                    <span className="truncate">{label}</span>
                  </Button>
                ))}
              </div>
            </div>
          ) : null}

          <CommandList className="max-h-[min(28rem,calc(100vh-8rem))]">
            {models.length === 0 ? (
              <div className="flex flex-col items-start gap-2 px-3 py-4 text-xs text-muted-foreground">
                <p>No models available.</p>
                {onOpenSettings ? (
                  <Button type="button" size="xs" variant="outline" onClick={openSettingsAndClose}>
                    <Settings2 size={11} />
                    Open Settings
                  </Button>
                ) : null}
              </div>
            ) : visibleModelCount === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                <span className="block">No matching models.</span>
                {onOpenSettings ? (
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    className="mt-2"
                    onClick={openSettingsAndClose}
                  >
                    <Settings2 size={11} />
                    Open Settings
                  </Button>
                ) : null}
              </div>
            ) : (
              grouped.map((segment, index) => (
                <div key={segment.id}>
                  {index > 0 ? <CommandSeparator /> : null}
                  <div className="px-2 pt-2 pb-1">
                    <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase text-muted-foreground">
                      {renderSegmentIcon(segment.id)}
                      <span>{segment.label}</span>
                      <span className="ml-auto normal-case opacity-80">{segment.hint}</span>
                    </div>
                  </div>
                  <CommandGroup>
                    {segment.models.map((model) => (
                      <CommandItem
                        key={getModelKey(model)}
                        value={getSearchText(model, customProviderLabels)}
                        data-checked={getModelKey(model) === selectedModelKey ? "true" : undefined}
                        onSelect={() => selectModel(model)}
                      >
                        {renderSegmentIcon(segment.id)}
                        {renderModelItem(model, customProviderLabels)}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </div>
              ))
            )}

            {models.length > 0 ? (
              <>
                <CommandSeparator />
                <CommandItem
                  value="manage providers and agents settings"
                  onSelect={openSettingsAndClose}
                  className="gap-1.5"
                >
                  <Settings2 size={11} />
                  <span>Manage providers and agents...</span>
                </CommandItem>
              </>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function renderModelItem(
  model: AgentModel,
  customProviderLabels?: Readonly<Record<string, string>>,
) {
  return (
    <div className="min-w-0 flex-1">
      <div className="flex min-w-0 items-center gap-1.5">
        <p className="truncate text-[11px] font-medium">{formatModelName(model)}</p>
        <span className="shrink-0 border border-border/60 px-1 font-mono text-[9px] uppercase text-muted-foreground">
          {formatMethodChip(model)}
        </span>
      </div>
      <p className="truncate font-mono text-[10px] text-muted-foreground">
        {formatProviderLabelForModel(model, customProviderLabels)}
        {" · "}
        {model.id}
        {model.contextWindow > 0 ? ` · ${formatWindow(model.contextWindow)}` : ""}
      </p>
      <p className="truncate text-[10px] text-muted-foreground">{formatModelSourceDetail(model)}</p>
    </div>
  );
}

function formatComposerSelectionLabel(
  model: Pick<AgentModel, "name" | "id"> | null | undefined,
  thinkingLabel: string,
): string {
  const modelLabel = model ? formatModelName(model) : "Select model";
  return `${modelLabel} - ${thinkingLabel}`;
}

function getModelKey(
  model: Pick<AgentModel, "provider" | "id" | "instanceId" | "authMethod">,
): string {
  return `${model.instanceId ?? "default"}:${model.provider}:${model.id}:${model.authMethod ?? "external"}`;
}

type ModelSegmentId = "subscription" | "api-key" | "local" | "external";

interface ModelSegment {
  id: ModelSegmentId;
  label: string;
  hint: string;
  models: AgentModel[];
}

const SEGMENT_DEFS: ReadonlyArray<Omit<ModelSegment, "models">> = [
  { id: "subscription", label: "Subscription", hint: "no credits" },
  { id: "api-key", label: "API key", hint: "metered" },
  { id: "local", label: "Local", hint: "on-device" },
  { id: "external", label: "External Agents", hint: "external" },
];

function groupModelSegments(
  models: readonly AgentModel[],
  customProviderLabels?: Readonly<Record<string, string>>,
): ModelSegment[] {
  const groups = new Map<ModelSegmentId, AgentModel[]>();
  for (const model of models) {
    const segmentId = getModelSegmentId(model);
    const list = groups.get(segmentId) ?? [];
    list.push(model);
    groups.set(segmentId, list);
  }
  return SEGMENT_DEFS.map((segment) => ({
    ...segment,
    hint:
      segment.id === "external" ? formatExternalSegmentHint(groups.get(segment.id)) : segment.hint,
    models: (groups.get(segment.id) ?? []).sort((a, b) =>
      getSearchSortKey(a, customProviderLabels).localeCompare(
        getSearchSortKey(b, customProviderLabels),
      ),
    ),
  })).filter((segment) => segment.models.length > 0);
}

function filterModels(
  models: readonly AgentModel[],
  query: string,
  customProviderLabels?: Readonly<Record<string, string>>,
): AgentModel[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [...models];
  return models.filter((model) =>
    getSearchText(model, customProviderLabels).toLowerCase().includes(normalized),
  );
}

function getModelSegmentId(model: AgentModel): ModelSegmentId {
  if (model.source === "external-agent") return "external";
  if (model.authMethod === "subscription") return "subscription";
  if (model.authMethod === "local" || model.provider === "ollama") return "local";
  return "api-key";
}

function renderSegmentIcon(segmentId: ModelSegmentId) {
  if (segmentId === "subscription") return <Sparkles size={12} className="shrink-0" />;
  if (segmentId === "local") return <HardDrive size={12} className="shrink-0" />;
  if (segmentId === "external") return <Server size={12} className="shrink-0" />;
  return <KeyRound size={12} className="shrink-0" />;
}

function getSearchText(
  model: AgentModel,
  customProviderLabels?: Readonly<Record<string, string>>,
): string {
  return [
    formatModelName(model),
    model.id,
    model.provider,
    formatProviderLabelForModel(model, customProviderLabels),
    formatMethodLabel(model),
    formatMethodChip(model),
    model.instanceLabel,
    model.instanceId,
  ]
    .filter(Boolean)
    .join(" ");
}

function getSearchSortKey(
  model: AgentModel,
  customProviderLabels?: Readonly<Record<string, string>>,
): string {
  return `${formatProviderLabelForModel(model, customProviderLabels)} ${formatModelName(model)} ${formatMethodLabel(model)}`;
}

function isSameModel(
  a: Pick<AgentModel, "provider" | "id" | "instanceId" | "authMethod"> | null | undefined,
  b: Pick<AgentModel, "provider" | "id" | "instanceId" | "authMethod"> | null | undefined,
): boolean {
  return Boolean(
    a &&
    b &&
    a.provider === b.provider &&
    a.id === b.id &&
    (a.instanceId ?? "default") === (b.instanceId ?? "default") &&
    (a.authMethod ?? "external") === (b.authMethod ?? "external"),
  );
}

function formatModelName(model: Pick<AgentModel, "name" | "id">): string {
  return model.name || model.id;
}

function formatMethodLabel(
  model: Pick<AgentModel, "authMethod" | "source" | "instanceLabel" | "instanceId" | "provider">,
): string {
  if (model.source === "external-agent") return model.instanceLabel ?? "External";
  if (model.authMethod === "subscription") return "Subscription";
  if (model.authMethod === "local" || model.provider === "ollama") return "Local";
  return "API key";
}

function formatMethodChip(
  model:
    | Pick<AgentModel, "authMethod" | "source" | "instanceLabel" | "instanceId" | "provider">
    | null
    | undefined,
): string {
  if (!model) return "";
  if (model.source === "external-agent") return model.instanceLabel ?? model.instanceId ?? "Ext";
  if (model.authMethod === "subscription") return "Sub";
  if (model.authMethod === "local" || model.provider === "ollama") return "Local";
  return "API";
}

function formatProviderLabelForModel(
  model: Pick<AgentModel, "provider">,
  customProviderLabels?: Readonly<Record<string, string>>,
): string {
  return customProviderLabels?.[model.provider] ?? formatProviderLabel(model.provider);
}

function formatModelSourceDetail(model: AgentModel): string {
  const method = formatMethodLabel(model);
  if (model.source === "external-agent") {
    return `${method} · ${model.instanceId ?? "external"}`;
  }
  if (model.cost) {
    return `${method} · ${formatCost(model.cost)}`;
  }
  return `${method} · ${model.instanceLabel ?? "API Providers"}`;
}

function formatExternalSegmentHint(models: AgentModel[] | undefined): string {
  const labels = Array.from(
    new Set((models ?? []).map((model) => model.instanceLabel ?? model.instanceId).filter(Boolean)),
  );
  return labels.length === 1 ? labels[0]! : "external";
}

function formatCost(cost: NonNullable<AgentModel["cost"]>): string {
  return `$${cost.input}/$${cost.output}/MTok`;
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
