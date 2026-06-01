/**
 * Versioned model-selection persistence helpers.
 *
 * The selector persists a full identity so reload can restore the runtime,
 * provider, model, and credential method without delimiter parsing ambiguity.
 *
 * @see docs/specs/205-app-vscode-model-selection-state/spec.md [FR-1] [FR-3] [FR-6] [NFR-3]
 * @see docs/specs/205-app-vscode-model-selection-state/design.md [DES-DATA] [DES-API]
 */
import type { AgentAuthMethod, AgentModel } from "@afx/shared";

export const MODEL_DEFAULT_SELECTION_SETTING = "model.defaultSelection";

export interface ModelSelectionIdentityV2 {
  v: 2;
  instanceId: string;
  provider: string;
  modelId: string;
  authMethod?: AgentAuthMethod;
}

function normalizeProviderId(provider: string): string {
  return provider.trim().toLowerCase();
}

function isAgentAuthMethod(value: unknown): value is AgentAuthMethod {
  return value === "subscription" || value === "api-key" || value === "local";
}

export function toModelSelectionIdentity(
  model: Pick<AgentModel, "provider" | "id" | "instanceId" | "authMethod">,
  requestedInstanceId?: string,
): ModelSelectionIdentityV2 {
  const identity: ModelSelectionIdentityV2 = {
    v: 2,
    instanceId: model.instanceId ?? requestedInstanceId ?? "pi-sdk",
    provider: normalizeProviderId(model.provider),
    modelId: model.id,
  };
  if (model.authMethod) {
    identity.authMethod = model.authMethod;
  }
  return identity;
}

export function formatModelSelectionIdentity(identity: ModelSelectionIdentityV2): string {
  return JSON.stringify(identity);
}

export function parseModelSelectionIdentity(
  raw: string | null | undefined,
): ModelSelectionIdentityV2 | undefined {
  const trimmed = raw?.trim();
  if (!trimmed) return undefined;
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    if (parsed["v"] !== 2) return undefined;
    const instanceId = parsed["instanceId"];
    const provider = parsed["provider"];
    const modelId = parsed["modelId"];
    const authMethod = parsed["authMethod"];
    if (
      typeof instanceId !== "string" ||
      instanceId.trim().length === 0 ||
      typeof provider !== "string" ||
      provider.trim().length === 0 ||
      typeof modelId !== "string" ||
      modelId.trim().length === 0
    ) {
      return undefined;
    }
    const identity: ModelSelectionIdentityV2 = {
      v: 2,
      instanceId: instanceId.trim(),
      provider: normalizeProviderId(provider),
      modelId: modelId.trim(),
    };
    if (authMethod !== undefined) {
      if (!isAgentAuthMethod(authMethod)) return undefined;
      identity.authMethod = authMethod;
    }
    return identity;
  } catch {
    return undefined;
  }
}

export function parseLegacySdkDefaultModel(value: string): ModelSelectionIdentityV2 | undefined {
  const trimmed = value.trim();
  const separator = trimmed.indexOf(":");
  if (separator <= 0 || separator === trimmed.length - 1) return undefined;
  return {
    v: 2,
    instanceId: "pi-sdk",
    provider: normalizeProviderId(trimmed.slice(0, separator)),
    modelId: trimmed.slice(separator + 1),
  };
}

export function formatSdkDefaultModel(provider: string, modelId: string): string {
  return `${normalizeProviderId(provider)}:${modelId}`;
}

export function identityMatchesModel(
  identity: ModelSelectionIdentityV2,
  model: Pick<AgentModel, "provider" | "id" | "instanceId" | "authMethod">,
): boolean {
  return (
    normalizeProviderId(model.provider) === identity.provider &&
    model.id === identity.modelId &&
    (model.instanceId ?? "pi-sdk") === identity.instanceId &&
    (identity.authMethod === undefined || model.authMethod === identity.authMethod)
  );
}
