/**
 * Custom-provider form — full Add/Edit dialog for AFX-managed Pi SDK providers.
 *
 * @see docs/specs/214-app-chat-settings/spec.md [FR-9] [FR-10]
 * @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-MOCKUP-CUSTOM-PROVIDER-FORM]
 */
import { useState } from "react";

import { ChevronDown, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";

import type { CustomProviderApiKind, CustomProviderModel, CustomProviderPreset } from "@afx/shared";
import { COMPAT_FLAGS_BY_API } from "@afx/shared";
import { Button } from "@afx/ui/components/button";
import { Input } from "@afx/ui/components/input";
import { Label } from "@afx/ui/components/label";
import { NativeSelect, NativeSelectOption } from "@afx/ui/components/native-select";
import { Switch } from "@afx/ui/components/switch";

import { MODELS } from "../lib/settings-copy";
import { ApiKeySourceInput, type ApiKeySourceValue } from "./api-key-source-input";
import { CustomModelForm } from "./custom-model-form";

const API_KINDS: CustomProviderApiKind[] = [
  "openai-completions",
  "openai-responses",
  "anthropic-messages",
  "google-generative-ai",
];

const PROVIDER_ID_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;

export interface CustomProviderFormSubmit {
  id: string;
  displayName?: string;
  baseUrl: string;
  api: CustomProviderApiKind;
  apiKeyRef: { source: ApiKeySourceValue["source"]; label?: string };
  apiKeyValue?: string;
  authHeader?: boolean;
  models: CustomProviderModel[];
  /** UI-known compat flags only — keyed by `COMPAT_FLAGS_BY_API[api][n].key`. */
  compat?: Record<string, boolean>;
}

export interface CustomProviderFormProps {
  /** Optional existing record (edit mode). */
  initial?: {
    id: string;
    displayName?: string;
    baseUrl: string;
    api: CustomProviderApiKind;
    apiKeySource: ApiKeySourceValue["source"];
    apiKeyLabel?: string;
    authHeader?: boolean;
    compatFlags?: Readonly<Record<string, boolean>>;
    models: CustomProviderModel[];
  };
  /** Optional preset (Add-from-preset mode). */
  preset?: CustomProviderPreset;
  onSubmit: (input: CustomProviderFormSubmit) => Promise<void> | void;
  onCancel: () => void;
}

function deriveSuggestedEnvVar(providerId: string): string {
  const slug = providerId.toUpperCase().replace(/[^A-Z0-9_]/g, "_");
  if (!/^[A-Z]/.test(slug)) return "AFX_PROVIDER_KEY";
  return `AFX_${slug}_KEY`;
}

/**
 * Add/Edit form for one custom provider. Submits a fully-validated payload to
 * the parent; the parent dispatches the bridge mutation.
 *
 * @see docs/specs/214-app-chat-settings/spec.md [FR-9] [FR-10] [NFR-1]
 */
export function CustomProviderForm({
  initial,
  preset,
  onSubmit,
  onCancel,
}: CustomProviderFormProps) {
  const [id, setId] = useState(initial?.id ?? preset?.defaultProviderId ?? "");
  const [displayName, setDisplayName] = useState(initial?.displayName ?? "");
  const [baseUrl, setBaseUrl] = useState(initial?.baseUrl ?? preset?.defaultBaseUrl ?? "");
  const [api, setApi] = useState<CustomProviderApiKind>(
    initial?.api ?? preset?.defaultApi ?? "openai-completions",
  );
  const [apiKeyValue, setApiKeyValue] = useState<ApiKeySourceValue>(() => {
    const source = initial?.apiKeySource ?? preset?.defaultApiKeySource ?? "vscode-secret";
    if (source === "vscode-secret") {
      const idForSlug = initial?.id ?? preset?.defaultProviderId ?? "";
      return { source, label: idForSlug ? deriveSuggestedEnvVar(idForSlug) : "", apiKeyValue: "" };
    }
    if (source === "none") return { source };
    return { source, label: initial?.apiKeyLabel ?? "" };
  });
  const [models, setModels] = useState<CustomProviderModel[]>(initial?.models ?? []);
  /**
   * Inline model editor state. `null` when closed; `{ kind: "add" }` for the
   * Add Model form; `{ kind: "edit", modelId }` to pre-populate the form with
   * an existing model so the user can tweak (the user reported that "no edit
   * affordance" was a real gap).
   */
  type ModelEditorMode = null | { kind: "add" } | { kind: "edit"; modelId: string };
  const [modelEditor, setModelEditor] = useState<ModelEditorMode>(
    (initial?.models?.length ?? 0) === 0 ? { kind: "add" } : null,
  );
  const [authHeader, setAuthHeader] = useState<boolean>(initial?.authHeader ?? true);
  // Compat flags are scoped to the current api kind; keys outside `COMPAT_FLAGS_BY_API`
  // are preserved server-side via merge in the host service.
  const [compatFlags, setCompatFlags] = useState<Record<string, boolean>>(() => {
    const initialApi = initial?.api ?? preset?.defaultApi ?? "openai-completions";
    const known = COMPAT_FLAGS_BY_API[initialApi];
    const seed: Record<string, boolean> = {};
    for (const flag of known) {
      seed[flag.key] = initial?.compatFlags?.[flag.key] ?? flag.defaultValue;
    }
    return seed;
  });
  const [advancedOpen, setAdvancedOpen] = useState<boolean>(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = Boolean(initial);
  const suggestedEnvVar = deriveSuggestedEnvVar(id || "provider");
  const knownCompatFlags = COMPAT_FLAGS_BY_API[api];

  function applyApiChange(nextApi: CustomProviderApiKind): void {
    setApi(nextApi);
    // Reseed compat flags from the new api's known set, preserving prior values when keys overlap.
    setCompatFlags((prev) => {
      const seed: Record<string, boolean> = {};
      for (const flag of COMPAT_FLAGS_BY_API[nextApi]) {
        seed[flag.key] = prev[flag.key] ?? flag.defaultValue;
      }
      return seed;
    });
  }

  function modelInitialFor(mode: ModelEditorMode): Partial<CustomProviderModel> | undefined {
    if (!mode || mode.kind !== "edit") return undefined;
    return models.find((m) => m.id === mode.modelId);
  }

  function validId(): boolean {
    return PROVIDER_ID_PATTERN.test(id);
  }

  async function submit(): Promise<void> {
    setError(null);
    if (!validId()) {
      setError("Provider id must start with a letter or digit and contain only [a-z0-9_-].");
      return;
    }
    if (!baseUrl.trim()) {
      setError("Base URL is required.");
      return;
    }
    if (models.length === 0) {
      setError(
        "A provider needs at least one model. Add one — or click Cancel and use the Remove button on the provider card to delete it entirely.",
      );
      return;
    }
    if (apiKeyValue.source === "vscode-secret" && !apiKeyValue.apiKeyValue && !isEdit) {
      setError("Paste an API key (or switch to a different Source).");
      return;
    }
    const payload: CustomProviderFormSubmit = {
      id: id.trim(),
      baseUrl: baseUrl.trim(),
      api,
      apiKeyRef: apiKeyValue.label
        ? { source: apiKeyValue.source, label: apiKeyValue.label }
        : { source: apiKeyValue.source },
      authHeader,
      models,
    };
    if (displayName.trim()) payload.displayName = displayName.trim();
    if (apiKeyValue.source === "vscode-secret" && apiKeyValue.apiKeyValue) {
      payload.apiKeyValue = apiKeyValue.apiKeyValue;
    }
    // Submit only the UI-known compat flags. Unknown keys on the canonical
    // record are merged server-side (the host service preserves them).
    if (Object.keys(compatFlags).length > 0) {
      payload.compat = { ...compatFlags };
    }
    setPending(true);
    try {
      await onSubmit(payload);
      // Clear secret value from local state immediately after dispatch.
      setApiKeyValue((current) =>
        current.source === "vscode-secret" ? { ...current, apiKeyValue: "" } : current,
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border bg-card/40 p-3">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-afx-brand-soft">
          Endpoint
        </p>
        <p className="mt-0.5 text-[10px] text-muted-foreground">
          Name the provider and point AFX at its API base URL.
        </p>
      </div>
      <div className="grid gap-2 @[420px]:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="custom-provider-id" className="text-[10px]">
            {MODELS.customSdkProviderIdLabel} *
          </Label>
          <Input
            id="custom-provider-id"
            value={id}
            onChange={(e) => setId(e.currentTarget.value)}
            disabled={isEdit}
            placeholder="ollama"
            className="h-7 text-[11px]"
          />
          <p className="text-[10px] text-muted-foreground">{MODELS.customSdkProviderIdHint}</p>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="custom-provider-name" className="text-[10px]">
            {MODELS.customSdkDisplayNameLabel}
          </Label>
          <Input
            id="custom-provider-name"
            value={displayName}
            onChange={(e) => setDisplayName(e.currentTarget.value)}
            placeholder="Ollama"
            className="h-7 text-[11px]"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="custom-provider-base-url" className="text-[10px]">
          {MODELS.customSdkBaseUrlLabel} *
        </Label>
        <Input
          id="custom-provider-base-url"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.currentTarget.value)}
          placeholder="http://localhost:11434/v1"
          className="h-7 text-[11px]"
        />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="custom-provider-api" className="text-[10px]">
          {MODELS.customSdkApiKindLabel}
        </Label>
        <NativeSelect
          id="custom-provider-api"
          value={api}
          onChange={(e) => applyApiChange(e.currentTarget.value as CustomProviderApiKind)}
          className="h-7 text-[11px]"
        >
          {API_KINDS.map((kind) => (
            <NativeSelectOption key={kind} value={kind}>
              {kind}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>

      <div className="flex flex-col gap-2 rounded-md border bg-muted/20 p-2.5">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-afx-brand-soft">
          Credential
        </p>
        <p className="text-[10px] font-medium text-foreground">{MODELS.customSdkApiKeyLabel}</p>
        <ApiKeySourceInput
          providerId={id || "provider"}
          value={apiKeyValue}
          onChange={setApiKeyValue}
          suggestedEnvVar={suggestedEnvVar}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-afx-brand-soft">
            {MODELS.customSdkModelsLabel} ({models.length})
          </p>
          <Button
            type="button"
            size="xs"
            variant="outline"
            onClick={() => setModelEditor({ kind: "add" })}
            disabled={modelEditor !== null}
          >
            <Plus size={10} />
            {MODELS.customSdkAddModelLabel}
          </Button>
        </div>
        {models.length > 0 ? (
          <ul className="flex flex-col gap-1 rounded-md border bg-card/30 p-1">
            {models.map((model) => (
              <li
                key={model.id}
                className="flex items-center justify-between gap-2 px-2 py-1 text-[11px]"
              >
                <span className="truncate">
                  <span className="font-medium">{model.id}</span>
                  {model.contextWindow ? (
                    <span className="ml-2 text-muted-foreground">
                      {model.contextWindow.toLocaleString()} ctx
                    </span>
                  ) : null}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    size="xs"
                    variant="ghost"
                    aria-label={`Edit model ${model.id}`}
                    onClick={() => setModelEditor({ kind: "edit", modelId: model.id })}
                    disabled={modelEditor !== null}
                  >
                    <Pencil size={10} />
                  </Button>
                  <Button
                    type="button"
                    size="xs"
                    variant="ghost"
                    aria-label={`Remove model ${model.id}`}
                    onClick={() => setModels((prev) => prev.filter((m) => m.id !== model.id))}
                  >
                    <Trash2 size={10} />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : null}

        {modelEditor !== null ? (
          <CustomModelForm
            initial={modelInitialFor(modelEditor)}
            providerApi={api}
            onSubmit={(model) => {
              setModels((prev) => {
                if (modelEditor.kind === "edit") {
                  // Replace by previous id (which may differ from the new id if user changed it)
                  return [
                    ...prev.filter((m) => m.id !== modelEditor.modelId && m.id !== model.id),
                    model,
                  ];
                }
                return [...prev.filter((m) => m.id !== model.id), model];
              });
              setModelEditor(null);
            }}
            onCancel={() => setModelEditor(null)}
          />
        ) : null}
      </div>

      {/* Advanced: authHeader + compat flags */}
      <div className="flex flex-col gap-1.5 rounded-md border bg-muted/10">
        <button
          type="button"
          onClick={() => setAdvancedOpen((v) => !v)}
          className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          aria-expanded={advancedOpen}
        >
          {advancedOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
          Advanced (auth header & compatibility flags)
        </button>
        {advancedOpen ? (
          <div className="flex flex-col gap-2 px-2 pb-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-col">
                <Label htmlFor="custom-provider-auth-header" className="text-[10px]">
                  Send Authorization: Bearer header
                </Label>
                <p className="text-[10px] text-muted-foreground">
                  Most OpenAI-compatible providers expect this. Disable only when the provider uses
                  a custom header (configure via Custom headers below).
                </p>
              </div>
              <Switch
                id="custom-provider-auth-header"
                checked={authHeader}
                onCheckedChange={setAuthHeader}
              />
            </div>
            {knownCompatFlags.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                <p className="text-[10px] font-medium text-foreground">Compatibility flags</p>
                <ul className="flex flex-col gap-1.5">
                  {knownCompatFlags.map((flag) => {
                    const checkboxId = `custom-provider-compat-${flag.key}`;
                    return (
                      <li key={flag.key} className="flex items-center justify-between gap-2">
                        <div className="flex flex-col">
                          <Label htmlFor={checkboxId} className="text-[10px]">
                            {flag.label}
                          </Label>
                          <p className="text-[10px] text-muted-foreground">{flag.description}</p>
                        </div>
                        <Switch
                          id={checkboxId}
                          checked={compatFlags[flag.key] ?? flag.defaultValue}
                          onCheckedChange={(checked) =>
                            setCompatFlags((prev) => ({ ...prev, [flag.key]: checked }))
                          }
                        />
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : (
              <p className="text-[10px] text-muted-foreground">
                No compatibility flags surfaced for {api}. Edit `~/.pi/agent/models.json` directly
                for advanced overrides.
              </p>
            )}
          </div>
        ) : null}
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-sm border border-destructive/40 bg-destructive/5 px-2 py-1 text-[10px] text-destructive"
        >
          {error}
        </p>
      ) : null}

      <div className="flex justify-end gap-1.5">
        <Button type="button" size="xs" variant="outline" onClick={onCancel} disabled={pending}>
          {MODELS.customSdkCancelLabel}
        </Button>
        <Button
          type="button"
          size="xs"
          variant="default"
          onClick={() => {
            void submit();
          }}
          disabled={pending}
        >
          {MODELS.customSdkSaveLabel}
        </Button>
      </div>
    </div>
  );
}
