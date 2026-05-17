/**
 * MultiplexedAgentManager routing and continuity behavior.
 *
 * @see docs/specs/350-agent-manager/spec.md [FR-1] [FR-2]
 * @see docs/specs/350-agent-manager/design.md [DES-TEST]
 */
import { describe, expect, it, vi } from "vitest";

import { createMockAgentManager } from "./__fixtures__/mock-agent-manager";
import type { AgentInstance } from "./agent-factory";
import { MultiplexedAgentManager } from "./multiplex-agent-manager";

function instance(id: string, runtime: AgentInstance["runtime"]): AgentInstance {
  return {
    id,
    label: id === "pi" ? "Pi CLI" : "API Providers",
    runtime,
    manager: createMockAgentManager(),
  };
}

describe("MultiplexedAgentManager", () => {
  it("tags models with source and instance metadata", async () => {
    const pi = instance("pi", "pi");
    const sdk = instance("pi-sdk", "pi-sdk");
    vi.mocked(pi.manager.getAvailableModels).mockResolvedValueOnce([
      model("anthropic", "claude-opus-4-7"),
    ]);
    vi.mocked(sdk.manager.getAvailableModels).mockResolvedValueOnce([model("openai", "gpt-5.2")]);

    const manager = new MultiplexedAgentManager([pi, sdk]);

    await expect(manager.getAvailableModels()).resolves.toEqual([
      expect.objectContaining({
        provider: "anthropic",
        id: "claude-opus-4-7",
        source: "external-agent",
        instanceId: "pi",
        instanceLabel: "Pi CLI",
      }),
      expect.objectContaining({
        provider: "openai",
        id: "gpt-5.2",
        source: "api-provider",
        instanceId: "pi-sdk",
        instanceLabel: "API Providers",
      }),
    ]);
  });

  it("keeps available models from healthy runtimes when one runtime fails", async () => {
    const pi = instance("pi", "pi");
    const sdk = instance("pi-sdk", "pi-sdk");
    vi.mocked(pi.manager.getAvailableModels).mockRejectedValueOnce(new Error("spawn ENOENT"));
    vi.mocked(sdk.manager.getAvailableModels).mockResolvedValueOnce([model("openai", "gpt-5.2")]);

    const manager = new MultiplexedAgentManager([pi, sdk]);

    await expect(manager.getAvailableModels()).resolves.toEqual([
      expect.objectContaining({
        provider: "openai",
        id: "gpt-5.2",
        instanceId: "pi-sdk",
      }),
    ]);
  });

  it("reports opt-in and configuration state when no runtime instances exist", async () => {
    const manager = new MultiplexedAgentManager([], {
      rpcEnabledGetter: () => false,
    });

    await expect(manager.getStatus()).resolves.toMatchObject({
      running: false,
      isStreaming: false,
      info: "No agent runtime configured",
      rpcEnabled: false,
      runtimeConfigured: false,
    });
  });

  it("switches session before routing to another runtime", async () => {
    const pi = instance("pi", "pi");
    const sdk = instance("pi-sdk", "pi-sdk");
    vi.mocked(pi.manager.getStatus).mockResolvedValueOnce({
      running: true,
      isStreaming: false,
      sessionFile: "/tmp/agenticflowx-sessions/session.jsonl",
    });
    vi.mocked(sdk.manager.setModel).mockResolvedValueOnce(model("openai", "gpt-5.2"));

    const manager = new MultiplexedAgentManager([pi, sdk]);
    const selected = await manager.setModel({
      provider: "openai",
      modelId: "gpt-5.2",
      instanceId: "pi-sdk",
    });

    expect(sdk.manager.switchSession).toHaveBeenCalledWith(
      "/tmp/agenticflowx-sessions/session.jsonl",
    );
    expect(sdk.manager.setModel).toHaveBeenCalledWith({
      provider: "openai",
      modelId: "gpt-5.2",
      instanceId: "pi-sdk",
    });
    expect(selected.instanceId).toBe("pi-sdk");
  });

  it("still switches model when cross-runtime session handoff fails", async () => {
    const pi = instance("pi", "pi");
    const sdk = instance("pi-sdk", "pi-sdk");
    vi.mocked(pi.manager.getStatus).mockResolvedValueOnce({
      running: true,
      isStreaming: false,
      sessionFile: "/tmp/agenticflowx-sessions/session.jsonl",
    });
    vi.mocked(sdk.manager.switchSession!).mockRejectedValueOnce(
      new Error("pi exited (code=1, signal=null)"),
    );
    vi.mocked(sdk.manager.setModel).mockResolvedValue(model("anthropic", "claude-opus-4-5"));

    const manager = new MultiplexedAgentManager([pi, sdk]);
    const selected = await manager.setModel({
      provider: "anthropic",
      modelId: "claude-opus-4-5",
      instanceId: "pi-sdk",
    });

    expect(sdk.manager.switchSession).toHaveBeenCalledWith(
      "/tmp/agenticflowx-sessions/session.jsonl",
    );
    expect(sdk.manager.setModel).toHaveBeenCalledWith({
      provider: "anthropic",
      modelId: "claude-opus-4-5",
      instanceId: "pi-sdk",
    });
    expect(sdk.manager.setModel).toHaveBeenCalledTimes(2);
    expect(selected).toEqual(
      expect.objectContaining({
        provider: "anthropic",
        id: "claude-opus-4-5",
        instanceId: "pi-sdk",
      }),
    );
  });

  it("routes future sends to the selected runtime even when its model switch fails", async () => {
    const sdk = instance("pi-sdk", "pi-sdk");
    const pi = instance("pi", "pi");
    vi.mocked(pi.manager.setModel).mockRejectedValueOnce(new Error("Model not found"));

    const manager = new MultiplexedAgentManager([sdk, pi]);
    await expect(
      manager.setModel({
        provider: "anthropic",
        modelId: "claude-opus-4-7",
        instanceId: "pi",
      }),
    ).rejects.toThrow("Model not found");
    await manager.send("after failed switch");

    expect(pi.manager.send).toHaveBeenCalledWith("after failed switch");
    expect(sdk.manager.send).not.toHaveBeenCalled();
  });

  it("forwards AFX skill sends unchanged so the runtime can expand them", async () => {
    const pi = instance("pi", "pi");
    const manager = new MultiplexedAgentManager([pi]);

    await manager.send("/afx-next");
    await manager.steer("  /skill:afx-task verify dapi-394-long-name");

    expect(pi.manager.send).toHaveBeenCalledWith("/afx-next");
    expect(pi.manager.steer).toHaveBeenCalledWith("  /skill:afx-task verify dapi-394-long-name");
  });

  it("forwards events only from the active runtime", () => {
    const pi = instance("pi", "pi");
    const sdk = instance("pi-sdk", "pi-sdk");
    let piListener: Parameters<typeof pi.manager.onEvent>[0] | undefined;
    let sdkListener: Parameters<typeof sdk.manager.onEvent>[0] | undefined;
    vi.mocked(pi.manager.onEvent).mockImplementation((listener) => {
      piListener = listener;
      return { dispose: vi.fn() };
    });
    vi.mocked(sdk.manager.onEvent).mockImplementation((listener) => {
      sdkListener = listener;
      return { dispose: vi.fn() };
    });
    const listener = vi.fn();

    const manager = new MultiplexedAgentManager([pi, sdk]);
    manager.onEvent(listener);
    sdkListener?.({ type: "agent_start" });
    piListener?.({ type: "agent_start" });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ type: "agent_start" });
  });

  it("keeps event listeners alive across replaceInstances", async () => {
    // Regression: replaceInstances used to dispose old per-instance forwarders
    // without rewiring new ones, leaving any prior `onEvent` subscription dead.
    // The chat host registered exactly one listener at activation time and
    // relied on it surviving secret/config reconfigs (which trigger a rebuild).
    const pi1 = instance("pi", "pi");
    const sdk1 = instance("pi-sdk", "pi-sdk");
    let pi1Listener: Parameters<typeof pi1.manager.onEvent>[0] | undefined;
    vi.mocked(pi1.manager.onEvent).mockImplementation((l) => {
      pi1Listener = l;
      return { dispose: vi.fn() };
    });

    const pi2 = instance("pi", "pi");
    const sdk2 = instance("pi-sdk", "pi-sdk");
    let pi2Listener: Parameters<typeof pi2.manager.onEvent>[0] | undefined;
    let sdk2Listener: Parameters<typeof sdk2.manager.onEvent>[0] | undefined;
    vi.mocked(pi2.manager.onEvent).mockImplementation((l) => {
      pi2Listener = l;
      return { dispose: vi.fn() };
    });
    vi.mocked(sdk2.manager.onEvent).mockImplementation((l) => {
      sdk2Listener = l;
      return { dispose: vi.fn() };
    });

    const listener = vi.fn();
    const manager = new MultiplexedAgentManager([pi1, sdk1]);
    manager.onEvent(listener);

    // Pre-replace: events from the active runtime reach the listener.
    pi1Listener?.({ type: "agent_start" });
    expect(listener).toHaveBeenCalledTimes(1);

    // Simulate a runtime rebuild (e.g. API key saved → secretStore.onDidChange).
    await manager.replaceInstances([pi2, sdk2]);

    // Post-replace: events from the new active runtime must still reach the listener.
    pi2Listener?.({ type: "agent_start" });
    expect(listener).toHaveBeenCalledTimes(2);

    // Inactive runtime is still filtered out.
    sdk2Listener?.({ type: "agent_start" });
    expect(listener).toHaveBeenCalledTimes(2);
  });
});

function model(provider: string, id: string) {
  return {
    provider,
    id,
    name: id,
    reasoning: false,
    contextWindow: 0,
    maxTokens: 0,
  };
}
