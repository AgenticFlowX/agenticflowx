/**
 * Custom-providers service — owns SecretStorage CRUD for AFX-managed custom
 * providers, optionally watches a hand-edited config file for the read-only
 * Pi RPC track display, and produces the bootstrap env for Pi SDK spawn.
 *
 * Functional factory style — no classes, no singletons.
 *
 * @see docs/specs/214-app-chat-settings/spec.md [FR-8] [FR-9] [FR-10]
 * @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-CUSTOM-MODELS]
 * @see docs/specs/351-agent-pi/spec.md [FR-5] [FR-6]
 * @see docs/specs/351-agent-pi/design.md [DES-PI-CUSTOM-PROVIDERS]
 */
import { existsSync, readFileSync } from "node:fs";

import * as vscode from "vscode";

import {
  type CustomProviderApiKeyRef,
  type CustomProviderApiKeySource,
  type CustomProviderModel,
  type CustomProviderRecord,
  type CustomProviderSummary,
  type HarnessAdapter,
  type Logger,
  type SettingsCustomModelsSnapshot,
  assertNoSecretLeak,
  summarizeForWebview,
} from "@afx/shared";

import { SecretStore } from "../secret-store";

export interface CustomProvidersServiceOptions {
  context: vscode.ExtensionContext;
  secretStore: SecretStore;
  adapter: HarnessAdapter;
  logger: Logger;
  /** Optional override for the hand-edited config path (default: adapter.handEditedConfigPath()). */
  handEditedConfigPath?: string;
}

export interface CustomProvidersService {
  /** Active harness adapter id. */
  readonly activeHarness: HarnessAdapter["id"];
  /** Compose the snapshot fragment (Pi SDK + Pi RPC tracks). */
  getSnapshot(): Promise<SettingsCustomModelsSnapshot>;
  /** Apply a `customModels/*` mutation. Returns ack info. */
  applyMutation(input: CustomProvidersMutation): Promise<MutationResult>;
  /**
   * Build the bootstrap env for a Pi SDK spawn:
   * `{ AFX_CUSTOM_PROVIDERS_JSON, AFX_<ID>_KEY=... }`.
   * Returns `{}` when no AFX-managed records exist.
   */
  buildEnvForPiSdkSpawn(): Promise<Record<string, string>>;
  /**
   * Return the list of AFX-managed custom-provider IDs and an initial provider+model
   * pick the host can use to seed the Pi SDK manager when no built-in API key exists.
   * Returns `{ ids: [], initial: undefined }` when SecretStorage has no records.
   *
   * @see docs/specs/351-agent-pi/design.md [DES-PI-CUSTOM-PROVIDERS]
   */
  describeForSpawn(): Promise<{
    ids: string[];
    initial?: { provider: string; modelId: string };
  }>;
  /** Subscribe to SecretStorage / file changes that should trigger a snapshot rebroadcast. */
  onDidChange(listener: () => void): vscode.Disposable;
  dispose(): void;
}

export type CustomProvidersMutation =
  | { kind: "refresh" }
  | { kind: "upsertProvider"; provider: UpsertProviderInput }
  | { kind: "removeProvider"; providerId: string }
  | { kind: "upsertModel"; providerId: string; model: CustomProviderModel }
  | { kind: "removeModel"; providerId: string; modelId: string };

export interface UpsertProviderInput {
  id: string;
  displayName?: string;
  baseUrl: string;
  api: CustomProviderRecord["api"];
  apiKeyRef: { source: CustomProviderApiKeySource; label?: string };
  /** Literal apiKey value when source === "vscode-secret". Never echoed back. */
  apiKeyValue?: string;
  authHeader?: boolean;
  models: CustomProviderModel[];
  headers?: Record<string, string>;
  compat?: Record<string, unknown>;
}

export interface MutationResult {
  ok: boolean;
  error?: string;
}

const PROVIDER_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/i;

/**
 * Detect when the user pasted an env-var-shaped string (e.g. `AFX_OPENROUTER_KEY`
 * or `OPENAI_API_KEY`) into the secret input. If they meant to reference an env
 * var they should have switched the Source dropdown to "Env var" first.
 */
function looksLikeEnvVarName(value: string): boolean {
  return /^[A-Z][A-Z0-9_]{2,}$/.test(value);
}

function normaliseApiKeyRef(input: UpsertProviderInput): CustomProviderApiKeyRef {
  const ref: CustomProviderApiKeyRef = { source: input.apiKeyRef.source };
  if (input.apiKeyRef.label) ref.label = input.apiKeyRef.label;
  return ref;
}

/**
 * Shape-only validation that runs before any SecretStorage I/O. Edit-mode-specific
 * checks (e.g. "vscode-secret without re-pasted key") are NOT here — they need
 * access to the existing record and live inline in the upsert branch.
 */
function validateUpsertShape(input: UpsertProviderInput): string | null {
  if (!PROVIDER_ID_PATTERN.test(input.id)) {
    return `invalid provider id "${input.id}"`;
  }
  if (typeof input.baseUrl !== "string" || input.baseUrl.length === 0) {
    return "baseUrl must be a non-empty string";
  }
  if (!Array.isArray(input.models) || input.models.length === 0) {
    return "at least one model is required";
  }
  return null;
}

export function createCustomProvidersService(
  opts: CustomProvidersServiceOptions,
): CustomProvidersService {
  const log = opts.logger.child("custom-providers-service");
  const onDidChangeEmitter = new vscode.EventEmitter<void>();
  const handEditedPath = opts.handEditedConfigPath ?? opts.adapter.handEditedConfigPath?.();
  const fileWatcher: vscode.FileSystemWatcher | undefined = handEditedPath
    ? vscode.workspace.createFileSystemWatcher(handEditedPath)
    : undefined;

  const fileChangeHandler = (): void => {
    onDidChangeEmitter.fire();
  };
  fileWatcher?.onDidChange(fileChangeHandler);
  fileWatcher?.onDidCreate(fileChangeHandler);
  fileWatcher?.onDidDelete(fileChangeHandler);

  const secretChangeSub = opts.secretStore.onDidChange((event) => {
    if (SecretStore.isCustomProviderKey(event.key)) {
      onDidChangeEmitter.fire();
    }
  });

  function readHandEditedSummaries(): {
    providers: CustomProviderSummary[];
    status: SettingsCustomModelsSnapshot["piRpc"] extends infer T
      ? T extends { status: infer S }
        ? S
        : never
      : never;
    error?: string;
    path: string;
  } {
    const path = handEditedPath ?? "";
    if (!path || !existsSync(path)) {
      return { providers: [], status: "missing", path };
    }
    let text: string;
    try {
      text = readFileSync(path, "utf-8");
    } catch (err) {
      return {
        providers: [],
        status: "parse-error",
        error: err instanceof Error ? err.message : String(err),
        path,
      };
    }
    const parsed = opts.adapter.parseHandEdited(text);
    const summaries = parsed.records.map((record) => {
      const hasLiteralOnDisk = record.apiKeyRef.source === "literal";
      const summary = summarizeForWebview(record, "hand-edited", {
        hasLiteralApiKeyOnDisk: hasLiteralOnDisk,
      });
      assertNoSecretLeak(summary);
      return summary;
    });
    if (parsed.warnings.length > 0) {
      log.debug(() => `hand-edited parse warnings: ${parsed.warnings.join("; ")}`);
    }
    return { providers: summaries, status: "ready", path };
  }

  async function getSnapshot(): Promise<SettingsCustomModelsSnapshot> {
    const records = await opts.secretStore.listCustomProviderRecords();
    const piSdkProviders = records.map((record) => {
      const summary = summarizeForWebview(record, "afx-managed");
      assertNoSecretLeak(summary);
      return summary;
    });
    const handEdited = readHandEditedSummaries();
    return {
      activeHarness: opts.adapter.id,
      piSdk: { providers: piSdkProviders },
      piRpc: {
        path: handEdited.path,
        status: handEdited.status,
        ...(handEdited.error ? { error: handEdited.error } : {}),
        providers: handEdited.providers,
      },
    };
  }

  async function applyMutation(input: CustomProvidersMutation): Promise<MutationResult> {
    switch (input.kind) {
      case "refresh":
        onDidChangeEmitter.fire();
        return { ok: true };
      case "upsertProvider": {
        const validationError = validateUpsertShape(input.provider);
        if (validationError) return { ok: false, error: validationError };
        // Read existing record so unknown compat keys (and the existing apiKey
        // when source !== "vscode-secret") survive the round-trip.
        const existing = await opts.secretStore.getCustomProviderRecord(input.provider.id);
        const next: CustomProviderRecord = {
          id: input.provider.id,
          baseUrl: input.provider.baseUrl,
          api: input.provider.api,
          apiKeyRef: normaliseApiKeyRef(input.provider),
          models: input.provider.models,
        };
        if (input.provider.displayName) next.displayName = input.provider.displayName;
        if (input.provider.authHeader !== undefined) {
          next.authHeader = input.provider.authHeader;
        }
        if (input.provider.headers && Object.keys(input.provider.headers).length > 0) {
          next.headers = input.provider.headers;
        }
        // Merge: existing compat (preserves unknown keys) ← incoming compat (UI-known flags).
        const mergedCompat: Record<string, unknown> = {
          ...(existing?.compat ?? {}),
          ...(input.provider.compat ?? {}),
        };
        if (Object.keys(mergedCompat).length > 0) {
          next.compat = mergedCompat;
        }
        if (input.provider.apiKeyRef.source === "vscode-secret") {
          const value = input.provider.apiKeyValue;
          if (typeof value === "string" && value.length > 0) {
            if (looksLikeEnvVarName(value)) {
              return {
                ok: false,
                error:
                  "apiKeyValue looks like an env-var name, not a secret. Switch Source → Env var if that's what you meant.",
              };
            }
            next.apiKey = value;
          } else if (existing?.apiKey) {
            // Edit-without-re-paste: keep the previously stored secret.
            next.apiKey = existing.apiKey;
          } else {
            return { ok: false, error: "vscode-secret source requires apiKeyValue" };
          }
        }
        await opts.secretStore.setCustomProviderRecord(next);
        log.info("upserted custom provider", { id: next.id, models: next.models.length });
        return { ok: true };
      }
      case "removeProvider": {
        if (!PROVIDER_ID_PATTERN.test(input.providerId)) {
          return { ok: false, error: `invalid provider id "${input.providerId}"` };
        }
        await opts.secretStore.deleteCustomProviderRecord(input.providerId);
        log.info("removed custom provider", { id: input.providerId });
        return { ok: true };
      }
      case "upsertModel": {
        const existing = await opts.secretStore.getCustomProviderRecord(input.providerId);
        if (!existing) return { ok: false, error: `unknown provider "${input.providerId}"` };
        const filtered = existing.models.filter((m) => m.id !== input.model.id);
        const next: CustomProviderRecord = {
          ...existing,
          models: [...filtered, input.model],
        };
        await opts.secretStore.setCustomProviderRecord(next);
        log.info("upserted custom model", {
          providerId: input.providerId,
          modelId: input.model.id,
        });
        return { ok: true };
      }
      case "removeModel": {
        const existing = await opts.secretStore.getCustomProviderRecord(input.providerId);
        if (!existing) return { ok: false, error: `unknown provider "${input.providerId}"` };
        const next: CustomProviderRecord = {
          ...existing,
          models: existing.models.filter((m) => m.id !== input.modelId),
        };
        if (next.models.length === 0) {
          return {
            ok: false,
            error: "provider must keep at least one model; delete the provider instead",
          };
        }
        await opts.secretStore.setCustomProviderRecord(next);
        log.info("removed custom model", { providerId: input.providerId, modelId: input.modelId });
        return { ok: true };
      }
      default: {
        const _exhaustive: never = input;
        return { ok: false, error: `unknown mutation kind: ${String(_exhaustive)}` };
      }
    }
  }

  async function buildEnvForPiSdkSpawn(): Promise<Record<string, string>> {
    const records = await opts.secretStore.listCustomProviderRecords();
    if (records.length === 0) return {};
    const { envelopeJson, env } = opts.adapter.encodeForBootstrap(records);
    return {
      AFX_CUSTOM_PROVIDERS_JSON: envelopeJson,
      ...env,
    };
  }

  async function describeForSpawn(): Promise<{
    ids: string[];
    initial?: { provider: string; modelId: string };
  }> {
    const records = await opts.secretStore.listCustomProviderRecords();
    const ids = records.map((r) => r.id);
    const seed = records.find((r) => r.models.length > 0);
    if (seed && seed.models[0]) {
      return { ids, initial: { provider: seed.id, modelId: seed.models[0].id } };
    }
    return { ids };
  }

  function dispose(): void {
    fileWatcher?.dispose();
    secretChangeSub.dispose();
    onDidChangeEmitter.dispose();
  }

  return {
    activeHarness: opts.adapter.id,
    getSnapshot,
    applyMutation,
    buildEnvForPiSdkSpawn,
    describeForSpawn,
    onDidChange: (listener) => onDidChangeEmitter.event(listener),
    dispose,
  };
}
