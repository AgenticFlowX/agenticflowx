/**
 * model-default-selection — versioned-identity persistence pure logic (Phase 5).
 *
 * Complements model-default-selection.test.ts with exhaustive parse/format,
 * legacy-read, normalization, and identity-match coverage for the
 * afx.model.defaultSelection store (NFR-6 versioned JSON; FR-6 legacy read).
 *
 * @see docs/specs/205-app-vscode-model-selection-state/spec.md [FR-1] [FR-3] [FR-6] [NFR-3]
 * @see docs/specs/205-app-vscode-model-selection-state/design.md [DES-DATA] [DES-API]
 */
import { describe, expect, it } from "vitest";

import {
  MODEL_DEFAULT_SELECTION_SETTING,
  type ModelSelectionIdentityV2,
  formatModelSelectionIdentity,
  formatSdkDefaultModel,
  identityMatchesModel,
  parseLegacySdkDefaultModel,
  parseModelSelectionIdentity,
  toModelSelectionIdentity,
} from "./model-default-selection";

describe("model-default-selection identity (Phase 5 pure logic)", () => {
  it("exports the afx-prefixed suffix setting key", () => {
    expect(MODEL_DEFAULT_SELECTION_SETTING).toBe("model.defaultSelection");
  });

  describe("toModelSelectionIdentity", () => {
    it("defaults instanceId to pi-sdk, lowercases provider, and omits absent authMethod", () => {
      const identity = toModelSelectionIdentity({
        provider: "Anthropic",
        id: "claude-opus-4-7",
      });
      expect(identity).toEqual({
        v: 2,
        instanceId: "pi-sdk",
        provider: "anthropic",
        modelId: "claude-opus-4-7",
      });
      expect(identity).not.toHaveProperty("authMethod");
    });

    it("prefers the model instanceId, then the requested one, then pi-sdk", () => {
      expect(
        toModelSelectionIdentity({ provider: "pi", id: "default", instanceId: "pi" }),
      ).toMatchObject({ instanceId: "pi" });
      expect(toModelSelectionIdentity({ provider: "pi", id: "default" }, "pi-rpc-2")).toMatchObject(
        { instanceId: "pi-rpc-2" },
      );
    });

    it("carries an explicit authMethod through to the identity", () => {
      expect(
        toModelSelectionIdentity({
          provider: "anthropic",
          id: "claude-opus-4-7",
          instanceId: "pi-sdk",
          authMethod: "subscription",
        }),
      ).toMatchObject({ authMethod: "subscription" });
    });
  });

  describe("parseModelSelectionIdentity", () => {
    it("round-trips a full identity through format", () => {
      const identity: ModelSelectionIdentityV2 = {
        v: 2,
        instanceId: "pi-sdk",
        provider: "anthropic",
        modelId: "claude-opus-4-7",
        authMethod: "api-key",
      };
      expect(parseModelSelectionIdentity(formatModelSelectionIdentity(identity))).toEqual(identity);
    });

    it("lowercases provider and trims instanceId/modelId on parse", () => {
      const raw = JSON.stringify({
        v: 2,
        instanceId: "  pi-sdk  ",
        provider: "Anthropic",
        modelId: "  claude-opus-4-7  ",
      });
      expect(parseModelSelectionIdentity(raw)).toEqual({
        v: 2,
        instanceId: "pi-sdk",
        provider: "anthropic",
        modelId: "claude-opus-4-7",
      });
    });

    it.each<[string, string | null | undefined]>([
      ["empty string", ""],
      ["whitespace", "   "],
      ["nullish", null],
      ["undefined", undefined],
      ["non-JSON", "{not json"],
      ["wrong version", '{"v":1,"instanceId":"pi-sdk","provider":"anthropic","modelId":"x"}'],
      ["missing modelId", '{"v":2,"instanceId":"pi-sdk","provider":"anthropic"}'],
      ["blank provider", '{"v":2,"instanceId":"pi-sdk","provider":"","modelId":"x"}'],
      ["blank instanceId", '{"v":2,"instanceId":"  ","provider":"anthropic","modelId":"x"}'],
      [
        "bad authMethod",
        '{"v":2,"instanceId":"pi-sdk","provider":"anthropic","modelId":"x","authMethod":"oauth"}',
      ],
    ])("returns undefined for %s", (_label, raw) => {
      expect(parseModelSelectionIdentity(raw)).toBeUndefined();
    });

    it("accepts a valid local authMethod (render-only) without rejecting it", () => {
      const raw = JSON.stringify({
        v: 2,
        instanceId: "pi-sdk",
        provider: "ollama",
        modelId: "llama3",
        authMethod: "local",
      });
      expect(parseModelSelectionIdentity(raw)).toMatchObject({ authMethod: "local" });
    });
  });

  describe("parseLegacySdkDefaultModel", () => {
    it("interprets a legacy <provider>:<modelId> string as a pi-sdk identity with no authMethod", () => {
      expect(parseLegacySdkDefaultModel("Anthropic:claude-opus-4-5")).toEqual({
        v: 2,
        instanceId: "pi-sdk",
        provider: "anthropic",
        modelId: "claude-opus-4-5",
      });
    });

    it("keeps colons inside the model id (only the first colon splits)", () => {
      expect(parseLegacySdkDefaultModel("llama.cpp:qwen2.5-coder:7b")).toEqual({
        v: 2,
        instanceId: "pi-sdk",
        provider: "llama.cpp",
        modelId: "qwen2.5-coder:7b",
      });
    });

    it.each([
      ["no separator", "anthropic"],
      ["leading colon", ":model"],
      ["trailing colon", "anthropic:"],
    ])("returns undefined for malformed legacy value: %s", (_label, value) => {
      expect(parseLegacySdkDefaultModel(value)).toBeUndefined();
    });
  });

  describe("formatSdkDefaultModel", () => {
    it("lowercases the provider and joins with a colon", () => {
      expect(formatSdkDefaultModel("Anthropic", "claude-opus-4-7")).toBe(
        "anthropic:claude-opus-4-7",
      );
    });
  });

  describe("identityMatchesModel", () => {
    const identity: ModelSelectionIdentityV2 = {
      v: 2,
      instanceId: "pi-sdk",
      provider: "anthropic",
      modelId: "claude-opus-4-7",
      authMethod: "api-key",
    };

    it("matches on lowercased provider, exact id/instance, and method", () => {
      expect(
        identityMatchesModel(identity, {
          provider: "Anthropic",
          id: "claude-opus-4-7",
          instanceId: "pi-sdk",
          authMethod: "api-key",
        }),
      ).toBe(true);
    });

    it("rejects a different authMethod (the dual-auth radio distinction)", () => {
      expect(
        identityMatchesModel(identity, {
          provider: "anthropic",
          id: "claude-opus-4-7",
          instanceId: "pi-sdk",
          authMethod: "subscription",
        }),
      ).toBe(false);
    });

    it("treats a missing model instanceId as the pi-sdk default", () => {
      expect(
        identityMatchesModel(
          { ...identity, authMethod: undefined },
          { provider: "anthropic", id: "claude-opus-4-7" },
        ),
      ).toBe(true);
    });

    it("ignores authMethod on the model when the identity has none (legacy restore)", () => {
      const legacy: ModelSelectionIdentityV2 = {
        v: 2,
        instanceId: "pi-sdk",
        provider: "anthropic",
        modelId: "claude-opus-4-7",
      };
      expect(
        identityMatchesModel(legacy, {
          provider: "anthropic",
          id: "claude-opus-4-7",
          instanceId: "pi-sdk",
          authMethod: "subscription",
        }),
      ).toBe(true);
    });

    it("rejects a different model id or instance", () => {
      expect(
        identityMatchesModel(identity, {
          provider: "anthropic",
          id: "claude-sonnet-4-7",
          instanceId: "pi-sdk",
          authMethod: "api-key",
        }),
      ).toBe(false);
      expect(
        identityMatchesModel(identity, {
          provider: "anthropic",
          id: "claude-opus-4-7",
          instanceId: "pi",
          authMethod: "api-key",
        }),
      ).toBe(false);
    });
  });
});
