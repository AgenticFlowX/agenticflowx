import { describe, expect, it } from "vitest";

import {
  formatModelSelectionIdentity,
  identityMatchesModel,
  parseLegacySdkDefaultModel,
  parseModelSelectionIdentity,
  toModelSelectionIdentity,
} from "./model-default-selection";

describe("model default selection helpers", () => {
  it("formats and parses the versioned full identity", () => {
    const identity = toModelSelectionIdentity({
      provider: "Anthropic",
      id: "claude-opus-4-7",
      instanceId: "pi-sdk",
      authMethod: "subscription",
    });

    expect(parseModelSelectionIdentity(formatModelSelectionIdentity(identity))).toEqual({
      v: 2,
      instanceId: "pi-sdk",
      provider: "anthropic",
      modelId: "claude-opus-4-7",
      authMethod: "subscription",
    });
  });

  it("rejects invalid full identities and reads legacy SDK defaults", () => {
    expect(parseModelSelectionIdentity('{"v":1}')).toBeUndefined();
    expect(parseModelSelectionIdentity("not-json")).toBeUndefined();
    expect(parseLegacySdkDefaultModel("llama.cpp:qwen2.5-coder:7b")).toEqual({
      v: 2,
      instanceId: "pi-sdk",
      provider: "llama.cpp",
      modelId: "qwen2.5-coder:7b",
    });
  });

  it("matches identity with instance and auth method", () => {
    const identity = {
      v: 2 as const,
      instanceId: "pi-sdk",
      provider: "anthropic",
      modelId: "claude-opus-4-7",
      authMethod: "api-key" as const,
    };

    expect(
      identityMatchesModel(identity, {
        provider: "Anthropic",
        id: "claude-opus-4-7",
        instanceId: "pi-sdk",
        authMethod: "api-key",
      }),
    ).toBe(true);
    expect(
      identityMatchesModel(identity, {
        provider: "Anthropic",
        id: "claude-opus-4-7",
        instanceId: "pi-sdk",
        authMethod: "subscription",
      }),
    ).toBe(false);
  });
});
