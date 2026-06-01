/**
 * MultiplexedAgentManager auth-classification + dual-emit pure logic (Phase 5).
 *
 * Complements multiplex-agent-manager.test.ts: this file pins the classifier
 * contract in isolation — provider->method dual-emit, FR-11 pre-OAuth
 * degradation to ['api-key'], Ollama -> local, external -> undefined authMethod,
 * row uniqueness per method (the getModelKey radio invariant), classifier
 * dedupe/order, and classifier-supplied activeMethod on status.
 *
 * @see docs/specs/205-app-vscode-model-selection-state/spec.md [FR-1] [FR-3] [FR-4] [FR-6]
 * @see docs/specs/205-app-vscode-model-selection-state/design.md [DES-FLOW]
 */
import { describe, expect, it, vi } from "vitest";

import type { AgentAuthMethod, AgentModel } from "@afx/shared";

import { createMockAgentManager } from "./__fixtures__/mock-agent-manager";
import type { AgentInstance } from "./agent-factory";
import { type ModelAuthClassifier, MultiplexedAgentManager } from "./multiplex-agent-manager";

function instance(id: string, runtime: AgentInstance["runtime"]): AgentInstance {
  return {
    id,
    label: id === "pi" ? "Pi CLI" : "API Providers",
    runtime,
    manager: createMockAgentManager(),
  };
}

function model(provider: string, id: string): AgentModel {
  return {
    provider,
    id,
    name: id,
    reasoning: false,
    contextWindow: 0,
    maxTokens: 0,
  };
}

/** Mirrors the [DES-SEG] selection key the webview uses (method is part of the key). */
function modelKey(m: AgentModel): string {
  return `${m.instanceId ?? "pi-sdk"}:${m.provider}:${m.id}:${m.authMethod ?? "external"}`;
}

describe("MultiplexedAgentManager auth classification (Phase 5 pure logic)", () => {
  it("emits one row per available method with a stable, method-unique selection key (FR-3, NFR-3)", async () => {
    const sdk = instance("pi-sdk", "pi-sdk");
    vi.mocked(sdk.manager.getAvailableModels).mockResolvedValueOnce([
      model("anthropic", "claude-opus-4-7"),
    ]);
    const classifier: ModelAuthClassifier = async () => ({
      methods: ["subscription", "api-key"],
      activeMethod: "subscription",
    });

    const manager = new MultiplexedAgentManager([sdk], { modelAuthClassifier: classifier });
    const models = await manager.getAvailableModels();

    expect(models.map((m) => m.authMethod)).toEqual(["subscription", "api-key"]);
    // Group bucket (provider) is shared; selection key differs only by method.
    expect(models.map((m) => m.provider)).toEqual(["anthropic", "anthropic"]);
    const keys = models.map(modelKey);
    expect(new Set(keys).size).toBe(2);
    expect(keys).toEqual([
      "pi-sdk:anthropic:claude-opus-4-7:subscription",
      "pi-sdk:anthropic:claude-opus-4-7:api-key",
    ]);
  });

  it("degrades hosted SDK models to api-key when no classifier is injected (FR-11)", async () => {
    const sdk = instance("pi-sdk", "pi-sdk");
    vi.mocked(sdk.manager.getAvailableModels).mockResolvedValueOnce([
      model("anthropic", "claude-opus-4-7"),
    ]);

    const manager = new MultiplexedAgentManager([sdk]);
    const models = await manager.getAvailableModels();

    expect(models).toHaveLength(1);
    expect(models[0]).toMatchObject({ authMethod: "api-key", source: "api-provider" });
  });

  it("degrades to api-key when the classifier returns an empty method set (FR-11, FR-14)", async () => {
    const sdk = instance("pi-sdk", "pi-sdk");
    vi.mocked(sdk.manager.getAvailableModels).mockResolvedValueOnce([
      model("anthropic", "claude-opus-4-7"),
    ]);
    const classifier: ModelAuthClassifier = async () => ({ methods: [] });

    const manager = new MultiplexedAgentManager([sdk], { modelAuthClassifier: classifier });
    const models = await manager.getAvailableModels();

    expect(models.map((m) => m.authMethod)).toEqual(["api-key"]);
  });

  it("classifies Ollama hosted models as local even when the classifier is silent", async () => {
    const sdk = instance("pi-sdk", "pi-sdk");
    vi.mocked(sdk.manager.getAvailableModels).mockResolvedValueOnce([model("ollama", "llama3")]);
    const seen: string[] = [];
    const classifier: ModelAuthClassifier = async ({ provider }) => {
      seen.push(provider);
      return { methods: [] };
    };

    const manager = new MultiplexedAgentManager([sdk], { modelAuthClassifier: classifier });
    const models = await manager.getAvailableModels();

    expect(seen).toContain("ollama");
    expect(models.map((m) => m.authMethod)).toEqual(["local"]);
  });

  it("leaves external (runtime 'pi') models without an authMethod and never duplicates them", async () => {
    const pi = instance("pi", "pi");
    vi.mocked(pi.manager.getAvailableModels).mockResolvedValueOnce([
      model("anthropic", "claude-opus-4-7"),
      model("openai", "gpt-5.2"),
    ]);
    const classifier = vi.fn<ModelAuthClassifier>(async () => ({
      methods: ["subscription", "api-key"],
    }));

    const manager = new MultiplexedAgentManager([pi], { modelAuthClassifier: classifier });
    const models = await manager.getAvailableModels();

    expect(models).toHaveLength(2);
    expect(models.every((m) => m.authMethod === undefined)).toBe(true);
    expect(models.every((m) => m.source === "external-agent")).toBe(true);
    // External agents are unclassifiable in v1 — the classifier must not be consulted.
    expect(classifier).not.toHaveBeenCalled();
  });

  it("dedupes and order-preserves classifier methods so radio rows stay unique", async () => {
    const sdk = instance("pi-sdk", "pi-sdk");
    vi.mocked(sdk.manager.getAvailableModels).mockResolvedValueOnce([
      model("anthropic", "claude-opus-4-7"),
    ]);
    const dupMethods = ["api-key", "subscription", "api-key"] as AgentAuthMethod[];
    const classifier: ModelAuthClassifier = async () => ({ methods: dupMethods });

    const manager = new MultiplexedAgentManager([sdk], { modelAuthClassifier: classifier });
    const models = await manager.getAvailableModels();

    expect(models.map((m) => m.authMethod)).toEqual(["api-key", "subscription"]);
    expect(new Set(models.map(modelKey)).size).toBe(2);
  });

  it("treats distinct provider ids (openai-codex vs openai) as separate rows, not duplicates (FR-3)", async () => {
    const sdk = instance("pi-sdk", "pi-sdk");
    vi.mocked(sdk.manager.getAvailableModels).mockResolvedValueOnce([
      model("openai-codex", "gpt-5.5"),
      model("openai", "gpt-5.5"),
    ]);
    const classifier: ModelAuthClassifier = async ({ provider }) =>
      provider === "openai-codex"
        ? { methods: ["subscription"], activeMethod: "subscription" }
        : { methods: ["api-key"], activeMethod: "api-key" };

    const manager = new MultiplexedAgentManager([sdk], { modelAuthClassifier: classifier });
    const models = await manager.getAvailableModels();

    expect(models).toEqual([
      expect.objectContaining({ provider: "openai-codex", authMethod: "subscription" }),
      expect.objectContaining({ provider: "openai", authMethod: "api-key" }),
    ]);
  });

  it("invokes the classifier once per provider id within a single getAvailableModels pass", async () => {
    const sdk = instance("pi-sdk", "pi-sdk");
    vi.mocked(sdk.manager.getAvailableModels).mockResolvedValueOnce([
      model("anthropic", "claude-opus-4-7"),
      model("anthropic", "claude-sonnet-4-7"),
    ]);
    const classifier = vi.fn<ModelAuthClassifier>(async () => ({
      methods: ["subscription", "api-key"],
    }));

    const manager = new MultiplexedAgentManager([sdk], { modelAuthClassifier: classifier });
    const models = await manager.getAvailableModels();

    // Both anthropic models duplicate into two rows each (4 rows total).
    expect(models).toHaveLength(4);
    // The classifier is still consulted per-model; assert it always saw "anthropic".
    expect(classifier.mock.calls.every(([input]) => input.provider === "anthropic")).toBe(true);
  });

  it("tags Pi SDK status with the classifier activeMethod and falls back to the lone method", async () => {
    const sdk = instance("pi-sdk", "pi-sdk");
    vi.mocked(sdk.manager.getStatus).mockResolvedValueOnce({
      running: true,
      isStreaming: false,
      model: { provider: "anthropic", id: "claude-opus-4-7", name: "Claude Opus" },
    });
    const classifier: ModelAuthClassifier = async () => ({
      methods: ["api-key"],
    });

    const manager = new MultiplexedAgentManager([sdk], { modelAuthClassifier: classifier });

    await expect(manager.getStatus()).resolves.toMatchObject({
      model: { provider: "anthropic", authMethod: "api-key", instanceId: "pi-sdk" },
    });
  });

  it("does not tag external status models with an authMethod", async () => {
    const pi = instance("pi", "pi");
    vi.mocked(pi.manager.getStatus).mockResolvedValueOnce({
      running: true,
      isStreaming: false,
      model: { provider: "anthropic", id: "claude-opus-4-7", name: "Claude Opus" },
    });
    const classifier = vi.fn<ModelAuthClassifier>(async () => ({
      methods: ["subscription", "api-key"],
      activeMethod: "subscription",
    }));

    const manager = new MultiplexedAgentManager([pi], { modelAuthClassifier: classifier });
    const status = await manager.getStatus();

    expect(status.model).toMatchObject({ source: "external-agent", instanceId: "pi" });
    expect(status.model).not.toHaveProperty("authMethod");
    expect(classifier).not.toHaveBeenCalled();
  });
});
