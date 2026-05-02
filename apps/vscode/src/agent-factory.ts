/**
 * Creates configured coding-agent instances for the VSCode host.
 * Returns configured runtime instances while keeping the host shape runtime-agnostic.
 *
 * @see docs/specs/200-app-vscode/spec.md [FR-6] [FR-8]
 * @see docs/specs/200-app-vscode/design.md [DES-ARCH]
 * @see docs/specs/300-infra-pi/spec.md [FR-1] [FR-6] [FR-7]
 * @see docs/specs/300-infra-pi/design.md [DES-API]
 */
import { createAgentManager as createPiAgentManager } from "@afx/agent-pi";
import { createPiSdkAgentManager } from "@afx/agent-pi-sdk";
import { API_PROVIDER_IDS, getDefaultApiProviderModel } from "@afx/shared";
import type { AgentManager, Logger } from "@afx/shared";

import type { SecretStore } from "./secret-store";

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
  additionalSkillPaths?: readonly string[];
  defaultConfigPath?: string;
  secretStore?: SecretStore;
  bootstrapPath?: string;
  sdkEnabled?: boolean;
  sdkDefaultModel?: string;
  ollamaBaseUrl?: string;
  piAvailable?: boolean;
  rpcEnabled?: boolean;
}

export async function createConfiguredAgentInstances(
  opts: AgentFactoryOptions,
): Promise<AgentInstance[]> {
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
  if (opts.sdkEnabled !== false && opts.secretStore && opts.bootstrapPath && apiProviders.length) {
    const initialProvider = apiProviders.includes(defaultProvider)
      ? defaultProvider
      : apiProviders[0]!;
    const initialModelId =
      initialProvider === defaultProvider
        ? defaultModelId
        : (getDefaultApiProviderModel(initialProvider) ?? "");
    instances.push({
      id: "pi-sdk",
      label: "API Providers",
      runtime: "pi-sdk",
      manager: createPiSdkAgentManager({
        logger: opts.logger,
        bootstrapPath: opts.bootstrapPath,
        provider: initialProvider,
        modelId: initialModelId,
        apiProviders,
        getApiKey: (providerId) => opts.secretStore?.getApiKey(providerId),
        ephemeral: opts.ephemeral,
        sessionDir: opts.sessionDir,
        cwd: opts.cwd,
        additionalSkillPaths: opts.additionalSkillPaths,
        defaultConfigPath: opts.defaultConfigPath,
        ollamaBaseUrl: opts.ollamaBaseUrl,
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
