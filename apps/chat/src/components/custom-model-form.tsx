/**
 * Custom-model form — inline editor for a single CustomProviderModel inside the
 * provider form. Fields beyond id/name are optional; harness adapter applies
 * sensible defaults at serialize time.
 *
 * @see docs/specs/214-app-chat-settings/spec.md [FR-9]
 * @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-MOCKUP-CUSTOM-MODEL-FORM]
 */
import { useState } from "react";

import type { CustomProviderApiKind, CustomProviderModel } from "@afx/shared";
import { Button } from "@afx/ui/components/button";
import { Input } from "@afx/ui/components/input";
import { Label } from "@afx/ui/components/label";
import { NativeSelect, NativeSelectOption } from "@afx/ui/components/native-select";

const API_KINDS: CustomProviderApiKind[] = [
  "openai-completions",
  "openai-responses",
  "anthropic-messages",
  "google-generative-ai",
];

export interface CustomModelFormProps {
  initial?: Partial<CustomProviderModel>;
  providerApi: CustomProviderApiKind;
  onSubmit: (model: CustomProviderModel) => void;
  onCancel: () => void;
}

/**
 * Inline form for adding or editing a single custom model. Submits a fully-typed
 * `CustomProviderModel`; numeric fields default to undefined when blank so the
 * adapter applies its preset defaults at materialization time.
 *
 * @see docs/specs/214-app-chat-settings/spec.md [FR-9]
 */
export function CustomModelForm({
  initial,
  providerApi,
  onSubmit,
  onCancel,
}: CustomModelFormProps) {
  const [id, setId] = useState(initial?.id ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [api, setApi] = useState<CustomProviderApiKind | "">(initial?.api ?? "");
  const [reasoning, setReasoning] = useState<boolean>(initial?.capabilities?.reasoning ?? false);
  const [image, setImage] = useState<boolean>(initial?.capabilities?.image ?? false);
  const [contextWindow, setContextWindow] = useState<string>(
    initial?.contextWindow !== undefined ? String(initial.contextWindow) : "",
  );
  const [maxTokens, setMaxTokens] = useState<string>(
    initial?.maxTokens !== undefined ? String(initial.maxTokens) : "",
  );
  const [costInput, setCostInput] = useState<string>(
    initial?.cost?.input !== undefined ? String(initial.cost.input) : "",
  );
  const [costOutput, setCostOutput] = useState<string>(
    initial?.cost?.output !== undefined ? String(initial.cost.output) : "",
  );

  function parseNumberOrUndefined(value: string): number | undefined {
    const trimmed = value.trim();
    if (trimmed === "") return undefined;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  function submit(): void {
    const trimmedId = id.trim();
    if (!trimmedId) return;
    const cost: CustomProviderModel["cost"] = {};
    const inputCost = parseNumberOrUndefined(costInput);
    if (inputCost !== undefined) cost.input = inputCost;
    const outputCost = parseNumberOrUndefined(costOutput);
    if (outputCost !== undefined) cost.output = outputCost;
    const model: CustomProviderModel = {
      id: trimmedId,
      name: name.trim() || trimmedId,
    };
    if (api && api !== providerApi) model.api = api;
    if (reasoning || image) {
      model.capabilities = {};
      if (reasoning) model.capabilities.reasoning = true;
      if (image) model.capabilities.image = true;
    }
    const ctx = parseNumberOrUndefined(contextWindow);
    if (ctx !== undefined) model.contextWindow = ctx;
    const max = parseNumberOrUndefined(maxTokens);
    if (max !== undefined) model.maxTokens = max;
    if (Object.keys(cost).length > 0) model.cost = cost;
    onSubmit(model);
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border bg-muted/20 p-2">
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="custom-model-id" className="text-[10px]">
            Model id *
          </Label>
          <Input
            id="custom-model-id"
            value={id}
            onChange={(e) => setId(e.currentTarget.value)}
            placeholder="e.g. anthropic/claude-sonnet-4"
            className="h-7 text-[11px]"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="custom-model-name" className="text-[10px]">
            Display name
          </Label>
          <Input
            id="custom-model-name"
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            placeholder="Claude Sonnet 4"
            className="h-7 text-[11px]"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="custom-model-api" className="text-[10px]">
          API override
        </Label>
        <NativeSelect
          id="custom-model-api"
          value={api}
          onChange={(e) => setApi(e.currentTarget.value as CustomProviderApiKind | "")}
          className="h-7 text-[11px]"
        >
          <NativeSelectOption value="">Use provider · {providerApi}</NativeSelectOption>
          {API_KINDS.map((kind) => (
            <NativeSelectOption key={kind} value={kind}>
              {kind}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>

      <div className="flex flex-wrap gap-3 text-[11px]">
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={reasoning}
            onChange={(e) => setReasoning(e.currentTarget.checked)}
          />
          reasoning
        </label>
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={image}
            onChange={(e) => setImage(e.currentTarget.checked)}
          />
          image input
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="custom-model-context" className="text-[10px]">
            Context window
          </Label>
          <Input
            id="custom-model-context"
            inputMode="numeric"
            value={contextWindow}
            onChange={(e) => setContextWindow(e.currentTarget.value)}
            placeholder="e.g. 200000"
            className="h-7 text-[11px]"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="custom-model-max" className="text-[10px]">
            Max output tokens
          </Label>
          <Input
            id="custom-model-max"
            inputMode="numeric"
            value={maxTokens}
            onChange={(e) => setMaxTokens(e.currentTarget.value)}
            placeholder="e.g. 16000"
            className="h-7 text-[11px]"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="custom-model-cost-in" className="text-[10px]">
            Cost · input ($/1M)
          </Label>
          <Input
            id="custom-model-cost-in"
            inputMode="decimal"
            value={costInput}
            onChange={(e) => setCostInput(e.currentTarget.value)}
            placeholder="3.00"
            className="h-7 text-[11px]"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="custom-model-cost-out" className="text-[10px]">
            Cost · output ($/1M)
          </Label>
          <Input
            id="custom-model-cost-out"
            inputMode="decimal"
            value={costOutput}
            onChange={(e) => setCostOutput(e.currentTarget.value)}
            placeholder="15.00"
            className="h-7 text-[11px]"
          />
        </div>
      </div>

      <div className="flex justify-end gap-1.5">
        <Button type="button" size="xs" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" size="xs" variant="default" disabled={!id.trim()} onClick={submit}>
          {initial ? "Save" : "Add"}
        </Button>
      </div>
    </div>
  );
}
