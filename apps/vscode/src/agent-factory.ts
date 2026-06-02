/**
 * Creates configured coding-agent instances for the VSCode host.
 * Returns configured runtime instances while keeping the host shape runtime-agnostic.
 * The instances produced here become the inputs to MultiplexAgentManager.
 *
 * `agent-factory.ts` is the only AFX-owned credential seam for the bundled Pi SDK.
 * The Pi SDK `getApiKey(provider)` callback resolves the active credential method
 * through {@link OAuthService.getSelectedProviderKey} so subscription tokens and API
 * keys route deliberately. The externally-run Pi RPC instance receives NO AFX-owned
 * credentials and instead has inherited provider keys scrubbed from its spawn env so
 * host-env keys never reach external Pi.
 *
 * @see docs/specs/350-agent-manager/spec.md [FR-2] [FR-3]
 * @see docs/specs/350-agent-manager/design.md [DES-AGENT-MULTIPLEX-FLOW]
 * @see docs/specs/351-agent-pi/spec.md [FR-2] [FR-4]
 * @see docs/specs/351-agent-pi/design.md [DES-API]
 * @see docs/specs/355-agent-sdk-credential-injection/spec.md [FR-1] [FR-2] [FR-3] [FR-4] [FR-5] [FR-6] [FR-7] [NFR-1] [NFR-3]
 * @see docs/specs/352-agent-managed-oauth/design.md [DES-POLICY]
 */
import type { Uri } from "vscode";

import { createAgentManager as createPiAgentManager } from "@afx/agent-pi";
import { createPiSdkAgentManager, createPiSdkCustomProvidersAdapter } from "@afx/agent-pi-sdk";
import {
  API_PROVIDER_IDS,
  PROVIDER_API_KEY_ENV_ALIASES,
  PROVIDER_DETAILS,
  type ProviderConfigField,
  getDefaultApiProviderModel,
} from "@afx/shared";
import type { AgentManager, HarnessAdapter, Logger } from "@afx/shared";

import type { SecretStore } from "./secret-store";
import { type OAuthService, createOAuthService } from "./services/oauth/oauth-service";

/**
 * Re-exported HarnessAdapter factory — the architecture rule restricts
 * `@afx/agent-*` imports to this file, so other host modules construct
 * the adapter via this helper.
 *
 * @see docs/specs/351-agent-pi/spec.md [FR-5]
 * @see docs/specs/351-agent-pi/design.md [DES-PI-CUSTOM-PROVIDERS]
 * @see docs/adr/ADR-0008-afx-custom-providers-adapter-pattern.md
 */
export function createCustomProvidersAdapter(): HarnessAdapter {
  return createPiSdkCustomProvidersAdapter();
}

export type AgentRuntime = "pi" | "pi-sdk";

export const KNOWN_PROVIDERS = API_PROVIDER_IDS;

export interface AgentInstance {
  id: string;
  label: string;
  runtime: AgentRuntime;
  manager: AgentManager;
}

export interface AgentFactoryOptions {
  logger: Logger;
  binaryPath?: string;
  ephemeral: boolean;
  sessionDir?: string;
  agentDir?: string;
  cwd?: string;
  additionalSystemPromptPaths?: readonly string[];
  additionalSkillPaths?: readonly string[];
  defaultConfigPath?: string;
  secretStore?: SecretStore;
  /**
   * AFX-owned OAuth orchestrator for the bundled Pi SDK runtime. The Pi SDK
   * `getApiKey(provider)` seam resolves the active credential method through this
   * service. When omitted, the factory constructs one from
   * `secretStore` + `globalStorageUri` so the SDK path always has an active-method
   * resolver. External Pi RPC never consults it.
   *
   * @see docs/specs/355-agent-sdk-credential-injection/spec.md [FR-1] [FR-2] [FR-3] [FR-4] [FR-5] [FR-6] [FR-7] [NFR-1] [NFR-3]
   * @see docs/specs/355-agent-sdk-credential-injection/design.md [DES-FLOW] [DES-EXTERNAL]
   */
  oauthService?: OAuthService;
  /**
   * `context.globalStorageUri` — only consulted to construct a default
   * {@link OAuthService} when `oauthService` is not injected. The OAuth refresh
   * advisory lock lives under it.
   *
   * @see docs/specs/353-agent-oauth-credential-store/spec.md [FR-1] [FR-2] [FR-4] [FR-5] [FR-6] [FR-7] [NFR-1]
   * @see docs/specs/353-agent-oauth-credential-store/design.md [DES-DATA] [DES-API] [DES-LOCK]
   */
  globalStorageUri?: Uri;
  bootstrapPath?: string;
  sdkEnabled?: boolean;
  sdkDefaultModel?: string;
  ollamaBaseUrl?: string;
  piAvailable?: boolean;
  rpcEnabled?: boolean;
  /**
   * Extra env entries merged into the Pi SDK spawn (e.g. `AFX_CUSTOM_PROVIDERS_JSON`
   * and per-provider `AFX_<ID>_KEY` from the custom-providers service).
   * Pi RPC instances ignore this field.
   *
   * @see docs/specs/351-agent-pi/spec.md [FR-5]
   * @see docs/specs/351-agent-pi/design.md [DES-PI-CUSTOM-PROVIDERS]
   */
  piSdkExtraEnv?: Record<string, string>;
  /**
   * Custom-provider IDs surfaced through the AFX-managed registry. The Pi SDK
   * manager spawns when at least one of these is configured even if no built-in
   * API provider keys are stored — without this, `apiProviders.length === 0`
   * would skip Pi SDK construction and AFX-managed providers would never reach
   * the model picker.
   *
   * @see docs/specs/214-app-chat-settings/spec.md [FR-9]
   * @see docs/specs/351-agent-pi/spec.md [FR-5]
   */
  piSdkCustomProviderIds?: readonly string[];
  /**
   * Optional initial provider+model pulled from an AFX-managed custom provider.
   * Used as the Pi SDK's startup `--provider` / `--model` when no built-in keys
   * exist. Only consulted when `apiProviders.length === 0` and at least one
   * custom provider is configured.
   *
   * @see docs/specs/351-agent-pi/spec.md [FR-5]
   */
  piSdkCustomInitial?: { provider: string; modelId: string };
}

export async function createConfiguredAgentInstances(
  opts: AgentFactoryOptions,
): Promise<AgentInstance[]> {
  // Flow: [AgentManager.Factory]
  // Flow: [AgentPi.FactoryInput]
  const instances: AgentInstance[] = [];
  if (opts.rpcEnabled === true && opts.piAvailable !== false) {
    // External (user-run) Pi: AFX injects NO credentials and additionally scrubs
    // inherited provider-credential env vars from the spawn so a host-env key
    // (e.g. ANTHROPIC_API_KEY) cannot leak into external Pi or shadow its
    // auth.json. The harness owns its own auth.
    // @see docs/specs/352-agent-managed-oauth/spec.md [FR-1] [FR-2] [FR-4] [NFR-1]
    // @see docs/specs/352-agent-managed-oauth/design.md [DES-POLICY]
    const scrubbedEnv = scrubInheritedProviderCredentials(process.env);
    instances.push({
      id: "pi",
      label: "Pi CLI",
      runtime: "pi",
      manager: createPiAgentManager({
        ...opts,
        ...(Object.keys(scrubbedEnv).length > 0 ? { env: scrubbedEnv } : {}),
      }),
    });
  }

  const [defaultProvider, defaultModelId] = parseModelRef(
    opts.sdkDefaultModel ?? "anthropic:claude-opus-4-5",
  );
  // OAuth-owned active-method resolver for the bundled Pi SDK seam.
  // Injected for tests; otherwise constructed here from secretStore + globalStorageUri.
  // @see docs/specs/355-agent-sdk-credential-injection/spec.md [FR-1] [FR-2] [FR-3] [FR-4] [FR-5] [FR-6] [FR-7] [NFR-1] [NFR-3]
  // @see docs/specs/355-agent-sdk-credential-injection/design.md [DES-FLOW] [DES-EXTERNAL]
  const oauthService =
    opts.oauthService ??
    (opts.secretStore && opts.globalStorageUri
      ? createOAuthService({
          secretStore: opts.secretStore,
          logger: opts.logger,
          globalStorageUri: opts.globalStorageUri,
        })
      : undefined);
  // A provider with an `afx.oauth.{provider}` record counts as configured for Pi SDK
  // startup and model discovery even when no `afx.apiKey.{provider}` exists.
  const configuredProviders = opts.secretStore
    ? await getConfiguredProviders(opts.secretStore, KNOWN_PROVIDERS)
    : [];
  const ollamaConfigured = Boolean(opts.ollamaBaseUrl);
  const apiProviders = ollamaConfigured ? [...configuredProviders, "ollama"] : configuredProviders;
  const customProviderIds = opts.piSdkCustomProviderIds ?? [];
  const hasCustomProviders = customProviderIds.length > 0;
  // The Pi SDK manager must spawn even when only AFX-managed custom providers
  // are configured — otherwise the registered providers never reach the model
  // picker. @see docs/specs/214-app-chat-settings/spec.md [FR-9]
  const shouldSpawnPiSdk = apiProviders.length > 0 || hasCustomProviders;
  if (opts.sdkEnabled !== false && opts.secretStore && opts.bootstrapPath && shouldSpawnPiSdk) {
    const builtInChoice = apiProviders.includes(defaultProvider)
      ? { provider: defaultProvider, modelId: defaultModelId }
      : apiProviders[0]
        ? {
            provider: apiProviders[0],
            modelId: getDefaultApiProviderModel(apiProviders[0]) ?? "",
          }
        : null;
    const initial = builtInChoice ?? opts.piSdkCustomInitial ?? null;
    if (!initial) {
      // hasCustomProviders is true but no initial was supplied — skip rather than
      // boot pi without a model. The host should always pass piSdkCustomInitial
      // when piSdkCustomProviderIds is non-empty.
      opts.logger.warn(
        "Pi SDK skipped: piSdkCustomProviderIds set but no piSdkCustomInitial provided",
      );
      return instances;
    }
    // When the github-copilot OAuth record resolves a non-default Copilot API base
    // URL (Enterprise / proxy-ep), inject a Pi SDK provider base-URL override at
    // spawn. AFX owns the credential and does not populate the SDK auth store, so
    // AFX delivers the derived base URL itself via env-only JSON.
    // @see docs/specs/355-agent-sdk-credential-injection/spec.md [FR-4] [FR-5] [NFR-1]
    // @see docs/specs/355-agent-sdk-credential-injection/design.md [DES-OVERRIDES]
    const [overrideEnv, providerConfigEnv] = await Promise.all([
      buildCopilotBaseUrlOverrideEnv(opts.secretStore),
      buildProviderConfigEnv(opts.secretStore, apiProviders),
    ]);
    const piSdkExtraEnv = mergeSpawnEnv(opts.piSdkExtraEnv, providerConfigEnv, overrideEnv);
    instances.push({
      id: "pi-sdk",
      label: "API Providers",
      runtime: "pi-sdk",
      manager: createPiSdkAgentManager({
        logger: opts.logger,
        bootstrapPath: opts.bootstrapPath,
        provider: initial.provider,
        modelId: initial.modelId,
        apiProviders: [...apiProviders, ...customProviderIds],
        // Pi SDK ONLY: resolve the active credential method (subscription token vs
        // API key) through the OAuth orchestrator; never a silent cross-method
        // fallback. Falls back to the raw API key only when no OAuth
        // service is wired (e.g. headless tests without globalStorageUri).
        // @see docs/specs/355-agent-sdk-credential-injection/spec.md [FR-1] [FR-2] [FR-3] [FR-4] [FR-5] [FR-6] [FR-7] [NFR-1] [NFR-3]
        // @see docs/specs/355-agent-sdk-credential-injection/design.md [DES-FLOW] [DES-EXTERNAL]
        getApiKey: (providerId) =>
          oauthService
            ? oauthService.getSelectedProviderKey(providerId)
            : opts.secretStore?.getApiKey(providerId),
        getAuthMethod: (providerId) => opts.secretStore?.getAuthMethod(providerId),
        ephemeral: opts.ephemeral,
        sessionDir: opts.sessionDir,
        agentDir: opts.agentDir,
        cwd: opts.cwd,
        additionalSystemPromptPaths: opts.additionalSystemPromptPaths,
        additionalSkillPaths: opts.additionalSkillPaths,
        defaultConfigPath: opts.defaultConfigPath,
        ollamaBaseUrl: opts.ollamaBaseUrl,
        extraEnv: piSdkExtraEnv,
      }),
    });
  }
  return instances;
}

export function getDefaultAgentInstance(instances: readonly AgentInstance[]): AgentInstance {
  const [agent] = instances;
  if (!agent) throw new Error("No configured agent instances");
  return agent;
}

function parseModelRef(value: string): [provider: string, modelId: string] {
  const trimmed = value.trim();
  const separator = trimmed.indexOf(":");
  if (separator <= 0 || separator === trimmed.length - 1) {
    return ["anthropic", "claude-opus-4-5"];
  }
  return [trimmed.slice(0, separator).toLowerCase(), trimmed.slice(separator + 1)];
}

/**
 * Providers AFX considers configured for Pi SDK startup + model discovery. A
 * provider counts when it has either an `afx.apiKey.{provider}` API key OR an
 * `afx.oauth.{provider}` subscription record, so a user signed in via
 * subscription with no API key still gets an API Providers runtime and that
 * provider's models. The OAuth set is intersected with the known `providers`
 * universe so stray OAuth-only ids never widen the API-provider list.
 *
 * @see docs/specs/355-agent-sdk-credential-injection/spec.md [FR-1] [FR-2] [FR-3] [FR-4] [FR-5] [FR-6] [FR-7] [NFR-1] [NFR-3]
 * @see docs/specs/355-agent-sdk-credential-injection/design.md [DES-FLOW] [DES-EXTERNAL]
 */
/** GitHub Copilot id and the individual (non-enterprise) default API base URL. */
const GITHUB_COPILOT_PROVIDER_ID = "github-copilot";
const COPILOT_INDIVIDUAL_BASE_URL = "https://api.individual.githubcopilot.com";

/**
 * Build the `AFX_PROVIDER_OVERRIDES_JSON` env entry that overrides the bundled Pi
 * `github-copilot` provider base URL when the stored OAuth record resolved a
 * non-default (Enterprise / proxy-ep) Copilot API base URL. AFX owns the
 * credential and injects it via env credentials, so AFX must also carry the
 * derived base URL itself.
 *
 * Returns `undefined` (no override) when there is no Copilot record, no
 * `meta.copilotBaseUrl`, or the resolved base URL equals the individual default —
 * so individual Copilot users get no spurious override. The override carries only a
 * base URL (no token), so it is safe as plaintext env.
 *
 * @see docs/specs/355-agent-sdk-credential-injection/spec.md [FR-4] [FR-5] [NFR-1]
 * @see docs/specs/355-agent-sdk-credential-injection/design.md [DES-OVERRIDES]
 */
export async function buildCopilotBaseUrlOverrideEnv(
  secretStore: SecretStore,
): Promise<Record<string, string> | undefined> {
  const record = await secretStore.getOAuth(GITHUB_COPILOT_PROVIDER_ID);
  const baseUrl = record?.meta?.copilotBaseUrl;
  if (!baseUrl || baseUrl === COPILOT_INDIVIDUAL_BASE_URL) {
    return undefined;
  }
  const envelope = {
    overrides: { [GITHUB_COPILOT_PROVIDER_ID]: { baseUrl } },
  };
  return { AFX_PROVIDER_OVERRIDES_JSON: JSON.stringify(envelope) };
}

export async function getConfiguredProviders(
  secretStore: SecretStore,
  providers: readonly string[],
): Promise<string[]> {
  const oauthProviders = new Set(await secretStore.listOAuthProviders());
  const entries = await Promise.all(
    providers.map(async (provider) => {
      if (oauthProviders.has(provider)) return provider;
      const apiKey = await secretStore.getApiKey(provider);
      if (!apiKey) return null;
      return (await hasRequiredProviderConfig(secretStore, provider)) ? provider : null;
    }),
  );
  return entries.filter((provider): provider is string => provider !== null);
}

/**
 * Build additional env values required by provider metadata. Cloudflare providers
 * are the first built-ins that need this: Pi resolves account/gateway placeholders
 * from `process.env` at request time, so the bundled SDK spawn must receive the
 * stored values alongside the API key.
 *
 * @see docs/specs/141-package-provider-catalog/design.md [DES-DATA]
 */
export async function buildProviderConfigEnv(
  secretStore: SecretStore,
  providers: readonly string[] = API_PROVIDER_IDS,
): Promise<Record<string, string>> {
  const env: Record<string, string> = {};
  const fields = uniqueProviderConfigFields(providers);
  for (const field of fields) {
    const value = await readProviderEnvVar(secretStore, field.envVar);
    if (value) {
      env[field.envVar] = value;
    }
  }
  return env;
}

/**
 * True when all required provider setup fields are stored. Providers with no
 * metadata fields remain simple single-key providers.
 *
 * @see docs/specs/141-package-provider-catalog/design.md [DES-DATA]
 */
export async function hasRequiredProviderConfig(
  secretStore: SecretStore,
  provider: string,
): Promise<boolean> {
  const fields = requiredProviderConfigFields(provider);
  if (fields.length === 0) return true;
  for (const field of fields) {
    if (!(await readProviderEnvVar(secretStore, field.envVar))) {
      return false;
    }
  }
  return true;
}

function readProviderEnvVar(secretStore: SecretStore, envVar: string): Promise<string | undefined> {
  const store = secretStore as SecretStore & {
    getProviderEnvVar?: (name: string) => Promise<string | undefined>;
  };
  return store.getProviderEnvVar?.(envVar) ?? Promise.resolve(undefined);
}

function uniqueProviderConfigFields(providers: readonly string[]) {
  const fields = new Map<string, ProviderConfigField>();
  for (const provider of providers) {
    for (const field of PROVIDER_DETAILS[provider]?.configFields ?? []) {
      fields.set(field.envVar, field);
    }
  }
  return [...fields.values()];
}

function requiredProviderConfigFields(provider: string) {
  return (PROVIDER_DETAILS[provider]?.configFields ?? []).filter(
    (field) => field.required !== false,
  );
}

function mergeSpawnEnv(
  ...envs: Array<Record<string, string> | undefined>
): Record<string, string> | undefined {
  const merged: Record<string, string> = {};
  for (const env of envs) {
    if (env) Object.assign(merged, env);
  }
  return Object.keys(merged).length > 0 ? merged : undefined;
}

/**
 * Build a spawn-env override that REMOVES every inherited provider-credential env
 * var from the external Pi RPC spawn. The RPC client spawns Pi with
 * `{ ...process.env, ...env }`; Node's `spawn` omits any env entry whose value is
 * `undefined`, so setting each provider-credential var to `undefined` deletes the
 * inherited value rather than merely refraining from adding one. Covers
 * the per-provider aliases (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, …), the
 * `{PROVIDER}_API_KEY` form, and the AFX `AFX_API_KEY_{PROVIDER}` / `AFX_{SLUG}_KEY`
 * aliases. Only vars actually present in `hostEnv` are scrubbed, keeping the
 * override minimal. AFX injects NOTHING else into the external spawn.
 *
 * The `undefined` values are intentional — they are the deletion signal for
 * `child_process.spawn`. The Pi RPC `env` field is typed `Record<string, string>`,
 * so we cast the deletion map through it without widening the agent-package API.
 *
 * @see docs/specs/352-agent-managed-oauth/spec.md [FR-1] [FR-2] [FR-4] [NFR-1]
 * @see docs/specs/352-agent-managed-oauth/design.md [DES-POLICY]
 */
export function scrubInheritedProviderCredentials(
  hostEnv: NodeJS.ProcessEnv,
): Record<string, string> {
  const credentialVars = new Set<string>();
  for (const provider of API_PROVIDER_IDS) {
    const providerKey = provider.replace(/[^a-zA-Z0-9]/g, "_").toUpperCase();
    credentialVars.add(`${providerKey}_API_KEY`);
    credentialVars.add(`AFX_API_KEY_${providerKey}`);
    for (const alias of PROVIDER_API_KEY_ENV_ALIASES[provider]) {
      credentialVars.add(alias);
    }
  }
  const scrub: Record<string, string | undefined> = {};
  for (const name of Object.keys(hostEnv)) {
    // Built-in/known-alias credential vars, plus any AFX custom-provider secret
    // (`AFX_<SLUG>_KEY`) inherited from the host process.
    if (credentialVars.has(name) || (name.startsWith("AFX_") && name.endsWith("_KEY"))) {
      scrub[name] = undefined; // deletion signal for child_process.spawn
    }
  }
  // The deletion map carries `undefined` values by design; the spawn `env` field is
  // typed `Record<string, string>` and Node drops the `undefined` entries.
  return scrub as Record<string, string>;
}
