/**
 * @see docs/specs/214-app-chat-settings/spec.md [FR-1] [FR-2]
 * @see docs/specs/214-app-chat-settings/design.md [DES-DATA] [DES-SETTINGS-SURFACE-PROVIDERS]
 * @see docs/specs/100-package-shared/spec.md [FR-7] [FR-9]
 */
import { API_PROVIDER_IDS, PROVIDER_DETAILS } from "@afx/shared";
import type { AgentModel, SettingsSnapshot, WorkspaceMode } from "@afx/shared";

/**
 * Inputs used to synthesize a SettingsSnapshot for the chat webview.
 *
 * @see docs/specs/214-app-chat-settings/spec.md [FR-5] [FR-6]
 * @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-SURFACE-CONTEXT]
 */
export interface SettingsSnapshotInput {
  extensionVersion?: string;
  availableModels?: readonly AgentModel[];
  logLevel?: string;
  mode?: WorkspaceMode;
  rpcEnabled?: boolean;
  agentBinary?: string;
  bundledSkillsPath?: string;
  bundledSkillCount?: number;
  ephemeral?: boolean;
  sdkEnabled?: boolean;
  sdkDefaultModel?: string;
  ollamaBaseUrl?: string;
  sessionDir?: string;
  bundledPiNpmVersion?: string;
  includeActiveFileContext?: boolean;
  intentSlot?: 1 | 2 | 3 | 4;
  intentMinimized?: boolean;
  telemetryEnabled?: boolean;
  vscodeTelemetryEnabled?: boolean;
}

export function composeSettingsSnapshot(input: SettingsSnapshotInput): SettingsSnapshot {
  const availableModels = input.availableModels ?? [];
  return {
    appearance: {
      theme: "meridian",
      style: "lyra",
      themes: [
        {
          id: "meridian",
          label: "AFX / Meridian",
          implemented: true,
          description: "AFX identity and brass accents over VS Code host surfaces.",
        },
      ],
      styles: [
        {
          id: "lyra",
          label: "Lyra",
          implemented: true,
          description: "Compact, boxy shadcn treatment.",
        },
      ],
    },
    engine: {
      rpcEnabled: input.rpcEnabled ?? false,
      agentBinary: input.agentBinary?.trim() || "pi",
      bundledSkillsPath: input.bundledSkillsPath?.trim() || "resources/skills/agenticflowx",
      bundledSkillCount: input.bundledSkillCount ?? 0,
      ephemeral: input.ephemeral ?? false,
    },
    sdk: {
      enabled: input.sdkEnabled ?? true,
      defaultModel: input.sdkDefaultModel?.trim() || "anthropic:claude-opus-4-5",
      ollamaBaseUrl: input.ollamaBaseUrl?.trim() || "",
      sessionDir: input.sessionDir?.trim() || "",
    },
    context: {
      includeActiveFileContext: input.includeActiveFileContext ?? true,
    },
    mode: {
      active: input.mode ?? "code",
    },
    intent: {
      effective: {
        slot: input.intentSlot ?? 1,
        minimized: input.intentMinimized ?? false,
      },
      global: {
        slot: input.intentSlot ?? 1,
        minimized: input.intentMinimized ?? false,
      },
      hasWorkspaceOverride: false,
    },
    providers: groupProviders(availableModels, input.sdkDefaultModel),
    externalAgents: groupExternalAgents(availableModels, input),
    diagnostics: { logLevel: input.logLevel?.trim() || "info" },
    telemetry: {
      enabled: input.telemetryEnabled ?? true,
      vscodeTelemetryEnabled: input.vscodeTelemetryEnabled ?? true,
      effectiveEnabled: (input.telemetryEnabled ?? true) && (input.vscodeTelemetryEnabled ?? true),
    },
    about: {
      extensionVersion: input.extensionVersion?.trim() || "?",
      bundledPiNpmVersion: input.bundledPiNpmVersion?.trim() || "?",
    },
  };
}

function groupProviders(
  models: readonly AgentModel[],
  sdkDefaultModel: string | undefined,
): SettingsSnapshot["providers"] {
  const counts = new Map<string, AgentModel[]>();
  for (const model of models) {
    if (model.source === "external-agent") continue;
    const list = counts.get(model.provider) ?? [];
    list.push(model);
    counts.set(model.provider, list);
  }
  const [defaultProvider, defaultModel] = parseModelRef(sdkDefaultModel);
  const providerIds = new Set([...API_PROVIDER_IDS, "ollama", ...counts.keys()]);
  return [...providerIds]
    .map((id) =>
      providerSnapshot(id, counts.get(id) ?? [], id === defaultProvider ? defaultModel : undefined),
    )
    .sort((a, b) => a.displayName?.localeCompare(b.displayName ?? b.name) ?? 0);
}

function providerSnapshot(
  id: string,
  models: readonly AgentModel[],
  defaultModel: string | undefined,
): SettingsSnapshot["providers"][number] {
  const details = PROVIDER_DETAILS[id] ?? {
    displayName: titleCase(id),
    modelHint: "Models available from this provider",
  };
  const modelCount = models.length;
  return {
    id,
    name: id,
    displayName: details.displayName,
    modelCount,
    state: details.noKeyNeeded ? "no-key-needed" : modelCount > 0 ? "configured" : "empty",
    modelHint: details.modelHint,
    defaultModel,
    models: [...models],
    helpUrl: details.helpUrl,
  };
}

function groupExternalAgents(
  models: readonly AgentModel[],
  input: SettingsSnapshotInput,
): SettingsSnapshot["externalAgents"] {
  if (!input.rpcEnabled) {
    return [
      {
        id: "pi",
        name: "Pi CLI",
        status: "disabled",
        modelCount: 0,
        binaryPath: input.agentBinary?.trim() || "Auto-detect from PATH",
        enabled: false,
        ephemeral: input.ephemeral ?? false,
      },
    ];
  }

  const externalModels = models.filter((model) => model.source === "external-agent");
  const grouped = new Map<string, AgentModel[]>();
  for (const model of externalModels) {
    const id = model.instanceId ?? "pi";
    const list = grouped.get(id) ?? [];
    list.push(model);
    grouped.set(id, list);
  }
  if (grouped.size === 0) {
    return [
      {
        id: "pi",
        name: "Pi CLI",
        status: "unavailable",
        modelCount: 0,
        binaryPath: input.agentBinary?.trim() || "Auto-detect from PATH",
        enabled: true,
        ephemeral: input.ephemeral ?? false,
      },
    ];
  }
  return [...grouped.entries()].map(([id, agentModels]) => ({
    id,
    name: agentModels[0]?.instanceLabel ?? titleCase(id),
    status: "connected",
    modelCount: agentModels.length,
    binaryPath: input.agentBinary?.trim() || "Auto-detect from PATH",
    enabled: true,
    ephemeral: input.ephemeral ?? false,
  }));
}

function titleCase(value: string): string {
  return value.replace(
    /(^|[-_\s])([a-z])/g,
    (_match, prefix: string, char: string) =>
      `${prefix === "-" || prefix === "_" ? " " : prefix}${char.toUpperCase()}`,
  );
}

function parseModelRef(value: string | undefined): [provider: string, modelId: string | undefined] {
  const trimmed = value?.trim();
  if (!trimmed) return ["anthropic", undefined];
  const separator = trimmed.indexOf(":");
  if (separator <= 0 || separator === trimmed.length - 1) return ["anthropic", undefined];
  return [trimmed.slice(0, separator).toLowerCase(), trimmed.slice(separator + 1)];
}
