import { describe, expect, it } from "vitest";

import { composeSettingsSnapshot } from "./settings-snapshot";

describe("composeSettingsSnapshot", () => {
  it("uses safe defaults when inputs are missing", () => {
    expect(composeSettingsSnapshot({})).toMatchObject({
      engine: {
        rpcEnabled: false,
        agentBinary: "pi",
        bundledSkillsPath: "resources/skills/agenticflowx",
        bundledSkillCount: 0,
        ephemeral: false,
      },
      context: { includeActiveFileContext: true },
      mode: { active: "code" },
      providers: expect.arrayContaining([
        expect.objectContaining({ id: "anthropic", state: "empty" }),
        expect.objectContaining({ id: "minimax", state: "empty" }),
        expect.objectContaining({ id: "openai", state: "empty" }),
      ]),
      externalAgents: [expect.objectContaining({ id: "pi", status: "disabled" })],
      diagnostics: { logLevel: "info" },
      telemetry: { enabled: true, vscodeTelemetryEnabled: true, effectiveEnabled: true },
      about: { extensionVersion: "?", bundledPiNpmVersion: "?" },
    });
  });

  it("groups models by provider", () => {
    const snapshot = composeSettingsSnapshot({
      availableModels: [
        {
          provider: "openai",
          id: "gpt-5.2",
          name: "GPT-5.2",
          reasoning: true,
          contextWindow: 400_000,
          maxTokens: 128_000,
          source: "api-provider",
        },
        {
          provider: "anthropic",
          id: "claude-opus-4",
          name: "Claude Opus 4",
          reasoning: true,
          contextWindow: 200_000,
          maxTokens: 32_000,
          source: "api-provider",
        },
        {
          provider: "openai",
          id: "gpt-5.4",
          name: "GPT-5.4",
          reasoning: true,
          contextWindow: 400_000,
          maxTokens: 128_000,
          source: "api-provider",
        },
      ],
    });

    expect(snapshot.providers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "anthropic", modelCount: 1, state: "configured" }),
        expect.objectContaining({ id: "openai", modelCount: 2, state: "configured" }),
      ]),
    );
  });

  it("surfaces Pi RPC as available only after it is enabled", () => {
    const snapshot = composeSettingsSnapshot({
      rpcEnabled: true,
      availableModels: [
        {
          provider: "anthropic",
          id: "claude-opus-4",
          name: "Claude Opus 4",
          reasoning: true,
          contextWindow: 200_000,
          maxTokens: 32_000,
          source: "external-agent",
          instanceId: "pi",
          instanceLabel: "Pi CLI",
        },
      ],
    });

    expect(snapshot.engine.rpcEnabled).toBe(true);
    expect(snapshot.externalAgents).toEqual([
      expect.objectContaining({ id: "pi", status: "connected", enabled: true }),
    ]);
  });

  it("respects the active-file context preference input", () => {
    expect(composeSettingsSnapshot({ includeActiveFileContext: false }).context).toEqual({
      includeActiveFileContext: false,
    });
  });

  it("defaults the workspace mode to Code and allows overriding it", () => {
    expect(composeSettingsSnapshot({}).mode).toEqual({ active: "code" });
    expect(composeSettingsSnapshot({ mode: "explore" }).mode).toEqual({ active: "explore" });
  });

  it("marks telemetry ineffective when VS Code telemetry is disabled", () => {
    expect(
      composeSettingsSnapshot({ telemetryEnabled: true, vscodeTelemetryEnabled: false }).telemetry,
    ).toEqual({
      enabled: true,
      vscodeTelemetryEnabled: false,
      effectiveEnabled: false,
    });
  });
});
