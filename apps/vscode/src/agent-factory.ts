/**
 * Creates configured coding-agent instances for the VSCode host.
 * Returns configured runtime instances while keeping the host shape runtime-agnostic.
 * The instances produced here become the inputs to MultiplexAgentManager.
 *
 * @see docs/specs/350-agent-manager/spec.md [FR-2] [FR-3]
 * @see docs/specs/350-agent-manager/design.md [DES-AGENT-MULTIPLEX-FLOW]
 * @see docs/specs/351-agent-pi/spec.md [FR-2] [FR-4]
 * @see docs/specs/351-agent-pi/design.md [DES-API]
 */
import { createAgentManager as createPiAgentManager } from "@afx/agent-pi";
import { createPiSdkAgentManager, createPiSdkCustomProvidersAdapter } from "@afx/agent-pi-sdk";
import { API_PROVIDER_IDS, getDefaultApiProviderModel } from "@afx/shared";
import type { AgentManager, HarnessAdapter, Logger } from "@afx/shared";

import type { SecretStore } from "./secret-store";

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
  cwd?: string;
  additionalSystemPromptPaths?: readonly string[];
  additionalSkillPaths?: readonly string[];
  defaultConfigPath?: string;
  secretStore?: SecretStore;
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
    instances.push({
      id: "pi",
      label: "Pi CLI",
      runtime: "pi",
      manager: createPiAgentManager(opts),
    });
  }

  const [defaultProvider, defaultModelId] = parseModelRef(
    opts.sdkDefaultModel ?? "anthropic:claude-opus-4-5",
  );
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
        getApiKey: (providerId) => opts.secretStore?.getApiKey(providerId),
        ephemeral: opts.ephemeral,
        sessionDir: opts.sessionDir,
        cwd: opts.cwd,
        additionalSystemPromptPaths: opts.additionalSystemPromptPaths,
        additionalSkillPaths: opts.additionalSkillPaths,
        defaultConfigPath: opts.defaultConfigPath,
        ollamaBaseUrl: opts.ollamaBaseUrl,
        extraEnv: opts.piSdkExtraEnv,
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

export async function getConfiguredProviders(
  secretStore: SecretStore,
  providers: readonly string[],
): Promise<string[]> {
  const entries = await Promise.all(
    providers.map(async (provider) => ((await secretStore.getApiKey(provider)) ? provider : null)),
  );
  return entries.filter((provider): provider is string => provider !== null);
}
