/**
 * Pi SDK custom-providers adapter — first concrete `HarnessAdapter` implementation.
 *
 * Translates AFX canonical `CustomProviderRecord` ↔ pi-mono `models.json` provider
 * shape, and produces the bootstrap envelope shipped via `AFX_CUSTOM_PROVIDERS_JSON`.
 *
 * Pure TS, no `vscode` import (per ADR-0004).
 *
 * @see docs/specs/351-agent-pi/spec.md [FR-5] [FR-6]
 * @see docs/specs/351-agent-pi/design.md [DES-PI-CUSTOM-PROVIDERS]
 * @see docs/adr/ADR-0008-afx-custom-providers-adapter-pattern.md
 */
import { homedir } from "node:os";
import { join } from "node:path";

import type {
  CustomProviderApiKeyRef,
  CustomProviderApiKind,
  CustomProviderModel,
  CustomProviderRecord,
  HarnessAdapter,
  HarnessBootstrapEnvelope,
  HarnessParseResult,
} from "@afx/shared";

import { secretEnvVarFor } from "./secret-env";

/**
 * Pi-mono `ProviderConfig`-compatible entry shape ({@link https://github.com/mariozechner/pi-mono pi-mono}).
 * Fields strictly match `pi.registerProvider(name, config)` so the bootstrap can
 * pass entries through with no further translation.
 */
export interface PiMonoProviderEntry {
  name?: string;
  baseUrl: string;
  api: CustomProviderApiKind;
  apiKey?: string;
  authHeader?: boolean;
  headers?: Record<string, string>;
  compat?: Record<string, unknown>;
  models: PiMonoModelEntry[];
}

/** Pi-mono `ProviderModelConfig`-compatible entry. All `cost` fields required, `reasoning`/`input` required. */
export interface PiMonoModelEntry {
  id: string;
  name: string;
  api?: CustomProviderApiKind;
  reasoning: boolean;
  input: ("text" | "image")[];
  contextWindow: number;
  maxTokens: number;
  cost: { input: number; output: number; cacheRead: number; cacheWrite: number };
  headers?: Record<string, string>;
  compat?: Record<string, unknown>;
}

/** Top-level shape of the JSON envelope shipped via AFX_CUSTOM_PROVIDERS_JSON. */
export interface PiSdkBootstrapEnvelope {
  providers: Record<string, PiMonoProviderEntry>;
}

const DEFAULT_CONTEXT_WINDOW = 128_000;
const DEFAULT_MAX_TOKENS = 16_000;

const BUILT_IN_PROVIDER_IDS: ReadonlySet<string> = new Set([
  "anthropic",
  "openai",
  "google",
  "openrouter",
  "groq",
  "vercel",
  "github-copilot",
  "vercel-ai-gateway",
]);

/**
 * Per-api compat defaults that pi-mono expects but aren't surfaced in the canonical UI form.
 * Layered on top of the canonical `record.compat` at serialize time.
 */
function piMonoCompatDefaults(api: CustomProviderApiKind): Record<string, unknown> {
  switch (api) {
    case "openai-completions":
      return {
        supportsDeveloperRole: false,
        supportsReasoningEffort: false,
      };
    case "openai-responses":
      return {
        supportsDeveloperRole: true,
        supportsReasoningEffort: true,
      };
    case "anthropic-messages":
      return {};
    case "google-generative-ai":
      return {};
    default: {
      const _exhaustive: never = api;
      throw new Error(`piMonoCompatDefaults: unknown api ${String(_exhaustive)}`);
    }
  }
}

function buildModelEntry(model: CustomProviderModel): PiMonoModelEntry {
  const inputs: ("text" | "image")[] = ["text"];
  if (model.capabilities?.image) inputs.push("image");
  const entry: PiMonoModelEntry = {
    id: model.id,
    name: model.name,
    reasoning: model.capabilities?.reasoning ?? false,
    input: inputs,
    contextWindow: model.contextWindow ?? DEFAULT_CONTEXT_WINDOW,
    maxTokens: model.maxTokens ?? DEFAULT_MAX_TOKENS,
    cost: {
      input: model.cost?.input ?? 0,
      output: model.cost?.output ?? 0,
      cacheRead: model.cost?.cacheRead ?? 0,
      cacheWrite: model.cost?.cacheWrite ?? 0,
    },
  };
  if (model.api) entry.api = model.api;
  return entry;
}

function resolveApiKeyForEnvelope(
  providerId: string,
  apiKeyRef: CustomProviderApiKeyRef,
): string | undefined {
  switch (apiKeyRef.source) {
    case "vscode-secret":
      return secretEnvVarFor(providerId);
    case "env-var":
      return apiKeyRef.label?.trim() ?? undefined;
    case "shell-cmd":
      return apiKeyRef.label?.trim() ? `!${apiKeyRef.label.trim()}` : undefined;
    case "literal":
    case "none":
      return undefined;
    default: {
      const _exhaustive: never = apiKeyRef.source;
      throw new Error(`resolveApiKeyForEnvelope: unknown source ${String(_exhaustive)}`);
    }
  }
}

/**
 * Placeholder apiKey emitted when the user picked "No key" but pi-mono's
 * `registerProvider` validation requires `apiKey` (or `oauth`) whenever
 * models[] is defined. We pair it with `authHeader: false` so pi never sends
 * the placeholder over the wire — local-only providers (Ollama, vLLM, LM Studio)
 * accept any string for the field but skip the Authorization header entirely.
 */
const NO_KEY_PLACEHOLDER = "no-key";

function recordToProviderEntry(record: CustomProviderRecord): PiMonoProviderEntry {
  const compat = {
    ...piMonoCompatDefaults(record.api),
    ...(record.compat ?? {}),
  };
  const entry: PiMonoProviderEntry = {
    baseUrl: record.baseUrl,
    api: record.api,
    models: record.models.map(buildModelEntry),
  };
  // Pi-mono uses `name` as the human-readable provider label in UI surfaces.
  // Without this the dropdown groups under the provider id (e.g. "MOONSHOT")
  // instead of the user's chosen display name.
  if (record.displayName) {
    entry.name = record.displayName;
  }
  const apiKey = resolveApiKeyForEnvelope(record.id, record.apiKeyRef);
  if (apiKey) {
    entry.apiKey = apiKey;
    // Default `authHeader: true` for OpenAI-compatible / Anthropic providers
    // (matches what most upstreams expect) but honour the explicit setting on
    // the canonical record when present.
    entry.authHeader = record.authHeader ?? true;
  } else {
    // Source === "none" or "literal" with no value: pi-mono still requires
    // apiKey when models[] is defined. Emit a placeholder + force authHeader
    // off so pi never sends it as a credential.
    entry.apiKey = NO_KEY_PLACEHOLDER;
    entry.authHeader = record.authHeader ?? false;
  }
  if (record.headers && Object.keys(record.headers).length > 0) {
    entry.headers = { ...record.headers };
  }
  if (Object.keys(compat).length > 0) {
    entry.compat = compat;
  }
  return entry;
}

function buildEnvMap(records: readonly CustomProviderRecord[]): Record<string, string> {
  const env: Record<string, string> = {};
  for (const record of records) {
    if (record.apiKeyRef.source !== "vscode-secret") continue;
    if (typeof record.apiKey !== "string" || record.apiKey.length === 0) continue;
    env[secretEnvVarFor(record.id)] = record.apiKey;
  }
  return env;
}

function parseModelEntry(value: unknown): CustomProviderModel | null {
  if (value === null || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const idRaw = raw["id"];
  if (typeof idRaw !== "string" || idRaw.length === 0) return null;
  const nameRaw = raw["name"];
  const model: CustomProviderModel = {
    id: idRaw,
    name: typeof nameRaw === "string" ? nameRaw : idRaw,
  };
  const apiRaw = raw["api"];
  if (
    apiRaw === "openai-completions" ||
    apiRaw === "openai-responses" ||
    apiRaw === "anthropic-messages" ||
    apiRaw === "google-generative-ai"
  ) {
    model.api = apiRaw;
  }
  const contextWindow = raw["contextWindow"];
  if (typeof contextWindow === "number") model.contextWindow = contextWindow;
  const maxTokens = raw["maxTokens"];
  if (typeof maxTokens === "number") model.maxTokens = maxTokens;
  if (raw["reasoning"] === true) {
    model.capabilities = { ...(model.capabilities ?? {}), reasoning: true };
  }
  const inputArr = raw["input"];
  if (Array.isArray(inputArr) && inputArr.includes("image")) {
    model.capabilities = { ...(model.capabilities ?? {}), image: true };
  }
  const costRawValue = raw["cost"];
  if (costRawValue && typeof costRawValue === "object") {
    const costRaw = costRawValue as Record<string, unknown>;
    const cost: NonNullable<CustomProviderModel["cost"]> = {};
    const inputCost = costRaw["input"];
    if (typeof inputCost === "number") cost.input = inputCost;
    const outputCost = costRaw["output"];
    if (typeof outputCost === "number") cost.output = outputCost;
    const cacheRead = costRaw["cacheRead"];
    if (typeof cacheRead === "number") cost.cacheRead = cacheRead;
    const cacheWrite = costRaw["cacheWrite"];
    if (typeof cacheWrite === "number") cost.cacheWrite = cacheWrite;
    if (Object.keys(cost).length > 0) model.cost = cost;
  }
  return model;
}

function parseProviderEntry(
  id: string,
  value: unknown,
  warnings: string[],
): CustomProviderRecord | null {
  if (value === null || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const baseUrlRaw = raw["baseUrl"];
  if (typeof baseUrlRaw !== "string" || baseUrlRaw.length === 0) {
    warnings.push(`${id}: missing baseUrl`);
    return null;
  }
  const api = raw["api"];
  if (
    api !== "openai-completions" &&
    api !== "openai-responses" &&
    api !== "anthropic-messages" &&
    api !== "google-generative-ai"
  ) {
    warnings.push(`${id}: unsupported api kind "${String(api)}"`);
    return null;
  }
  const modelsRawValue = raw["models"];
  const modelsRaw: unknown[] = Array.isArray(modelsRawValue) ? modelsRawValue : [];
  if (modelsRaw.length === 0) {
    // No own models[] — this is OVERRIDE/TWEAKS, not a CUSTOM provider. Surface as warning, skip.
    warnings.push(`${id}: no models[]; not surfaced (OVERRIDE/TWEAKS pattern)`);
    return null;
  }
  const models: CustomProviderModel[] = [];
  for (const modelRaw of modelsRaw) {
    const model = parseModelEntry(modelRaw);
    if (model) models.push(model);
  }
  if (models.length === 0) {
    warnings.push(`${id}: models[] present but no valid entries`);
    return null;
  }

  const rawApiKey = raw["apiKey"];
  const apiKeyValue = typeof rawApiKey === "string" ? rawApiKey : undefined;
  const apiKeyRef = inferApiKeyRefFromHandEdited(apiKeyValue);

  const record: CustomProviderRecord = {
    id,
    baseUrl: baseUrlRaw,
    api,
    apiKeyRef,
    models,
  };
  const rawAuthHeader = raw["authHeader"];
  if (typeof rawAuthHeader === "boolean") {
    record.authHeader = rawAuthHeader;
  }
  const rawHeaders = raw["headers"];
  if (typeof rawHeaders === "object" && rawHeaders !== null) {
    record.headers = rawHeaders as Record<string, string>;
  }
  const rawCompat = raw["compat"];
  if (typeof rawCompat === "object" && rawCompat !== null) {
    record.compat = rawCompat as Record<string, unknown>;
  }
  return record;
}

function inferApiKeyRefFromHandEdited(rawApiKey: string | undefined): CustomProviderApiKeyRef {
  if (!rawApiKey) return { source: "none" };
  if (rawApiKey.startsWith("!")) {
    return { source: "shell-cmd", label: rawApiKey.slice(1) };
  }
  if (/^AFX_[A-Z][A-Z0-9_]*_KEY$/.test(rawApiKey)) {
    return { source: "vscode-secret", label: rawApiKey };
  }
  if (/^[A-Z][A-Z0-9_]*$/.test(rawApiKey)) {
    return { source: "env-var", label: rawApiKey };
  }
  return { source: "literal" };
}

/**
 * Factory — returns a `HarnessAdapter` configured for the Pi SDK runtime.
 *
 * @see docs/specs/351-agent-pi/spec.md [FR-5]
 * @see docs/specs/351-agent-pi/design.md [DES-PI-CUSTOM-PROVIDERS]
 */
export function createPiSdkCustomProvidersAdapter(): HarnessAdapter {
  function encodeForBootstrap(records: readonly CustomProviderRecord[]): HarnessBootstrapEnvelope {
    const providers: Record<string, PiMonoProviderEntry> = {};
    for (const record of records) {
      providers[record.id] = recordToProviderEntry(record);
    }
    const envelope: PiSdkBootstrapEnvelope = { providers };
    return {
      envelopeJson: JSON.stringify(envelope),
      env: buildEnvMap(records),
    };
  }

  function parseHandEdited(text: string): HarnessParseResult {
    const warnings: string[] = [];
    const records: CustomProviderRecord[] = [];
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      warnings.push(`parse error: ${err instanceof Error ? err.message : String(err)}`);
      return { records, warnings };
    }
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      warnings.push("parse error: top-level value is not an object");
      return { records, warnings };
    }
    const root = parsed as Record<string, unknown>;
    const providersRaw = root["providers"];
    if (providersRaw === null || typeof providersRaw !== "object") {
      warnings.push("missing or invalid `providers` map");
      return { records, warnings };
    }
    for (const [id, entry] of Object.entries(providersRaw as Record<string, unknown>)) {
      // OVERRIDE pattern — built-in provider id with no own models[] is not a CUSTOM provider.
      if (BUILT_IN_PROVIDER_IDS.has(id) && entry !== null && typeof entry === "object") {
        const probe = entry as Record<string, unknown>;
        const probeModels = probe["models"];
        if (!Array.isArray(probeModels) || probeModels.length === 0) {
          warnings.push(`${id}: built-in provider override (OVERRIDE/TWEAKS); not surfaced`);
          continue;
        }
      }
      const record = parseProviderEntry(id, entry, warnings);
      if (record) records.push(record);
    }
    return { records, warnings };
  }

  function handEditedConfigPath(): string {
    return join(homedir(), ".pi", "agent", "models.json");
  }

  return {
    id: "pi-sdk",
    displayName: "Pi SDK",
    materialization: "in-process-register",
    handEditedConfigPath,
    encodeForBootstrap,
    parseHandEdited,
  };
}
