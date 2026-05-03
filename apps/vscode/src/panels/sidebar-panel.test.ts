/**
 * sidebar-panel — host bridge handler unit tests.
 *
 * Drives `dispatchInbound` through the captured `onDidReceiveMessage` handler
 * with a `createMockAgentManager` fixture, asserting that each chat/* message
 * invokes the matching AgentManager method with the expected args. Covers the
 * Phase 8.2 "host-handler unit tests" task.
 *
 * @see docs/specs/200-app-vscode/spec.md [FR-7]
 * @see docs/specs/200-app-vscode/design.md [DES-ARCH] [DES-TEST]
 * @see docs/specs/200-app-vscode/spec.md [FR-2] [FR-4]
 * @see docs/specs/200-app-vscode/design.md [DES-TEST]
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as vscode from "vscode";

import {
  type AgentEvent,
  type AgentModel,
  type Logger,
  createLogger,
  memorySink,
} from "@afx/shared";

import { type MockAgentManager, createMockAgentManager } from "../__fixtures__/mock-agent-manager";
import { createSidebarPanel } from "./sidebar-panel";

vi.mock("./webview-html", () => ({
  getAppDistPath: () => "/tmp/agenticflowx/chat/dist",
  loadWebviewHtml: () => "<html></html>",
}));

interface InboundCapture {
  fire(msg: unknown): void;
}

function makeMockView(): { view: vscode.WebviewView; inbound: InboundCapture } {
  const handlers = new Set<(raw: unknown) => void>();
  const inbound: InboundCapture = {
    fire(msg) {
      for (const h of handlers) h(msg);
    },
  };
  const view = {
    webview: {
      options: {} as vscode.WebviewOptions,
      html: "",
      cspSource: "vscode-webview://mock",
      asWebviewUri: (uri: vscode.Uri) => uri,
      onDidReceiveMessage: (handler: (raw: unknown) => void) => {
        handlers.add(handler);
        return { dispose: () => handlers.delete(handler) };
      },
      postMessage: vi.fn(async () => true),
    },
    visible: true,
    onDidChangeVisibility: () => ({ dispose: () => {} }),
    onDidDispose: () => ({ dispose: () => {} }),
    show: () => {},
  } as unknown as vscode.WebviewView;
  return { view, inbound };
}

describe("sidebar-panel host bridge", () => {
  let agent: MockAgentManager;
  let logger: Logger;

  beforeEach(() => {
    agent = createMockAgentManager();
    logger = createLogger({ scope: "test", level: "silent", sinks: [memorySink()] });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function setupWithView(): {
    inbound: InboundCapture;
    postMessage: ReturnType<typeof vi.fn>;
    provider: ReturnType<typeof createSidebarPanel>;
  } {
    const { view, inbound } = makeMockView();
    const provider = createSidebarPanel({
      extensionUri: vscode.Uri.file("/tmp/agenticflowx"),
      extensionMode: vscode.ExtensionMode.Test,
      extensionVersion: "2.0.0-test",
      bundledPiNpmVersion: "@mariozechner/pi-coding-agent@0.70.2",
      bundledSkillsPath: "/tmp/agenticflowx/resources/skills/agenticflowx",
      agentManager: agent,
      logger,
    });
    provider.resolveWebviewView(view, {} as never, {} as never);
    return {
      inbound,
      postMessage: view.webview.postMessage as ReturnType<typeof vi.fn>,
      provider,
    };
  }

  function setup(): InboundCapture {
    return setupWithView().inbound;
  }

  function mockAfxConfiguration(initialValues: Record<string, unknown> = {}) {
    const values = new Map<string, unknown>(
      Object.entries({
        agentBinaryPath: "",
        agentEphemeralSession: false,
        logLevel: "info",
        "rpc.enabled": false,
        "sdk.defaultModel": "anthropic:claude-opus-4-5",
        "sdk.enabled": true,
        "sdk.ollamaBaseUrl": "",
        sessionDir: "",
        style: "lyra",
        "telemetry.enabled": true,
        theme: "meridian",
        ...initialValues,
      }),
    );
    const update = vi.fn(async (key: string, value: unknown) => {
      values.set(key, value);
    });
    vi.spyOn(vscode.workspace, "getConfiguration").mockReturnValue({
      get: <T>(key: string, defaultValue?: T) =>
        (values.has(key) ? values.get(key) : defaultValue) as T,
      has: (key: string) => values.has(key),
      inspect: () => undefined,
      update,
    });
    return { update, values };
  }

  async function flushAsyncWork(cycles = 1): Promise<void> {
    for (let cycle = 0; cycle < cycles; cycle += 1) {
      await new Promise((resolve) => setImmediate(resolve));
    }
  }

  function firstAgentEventListener(): ((event: AgentEvent) => void) | undefined {
    const calls = (agent.onEvent as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    return calls[0]?.[0] as ((event: AgentEvent) => void) | undefined;
  }

  it("chat/getModels delegates to agent.getAvailableModels", async () => {
    const inbound = setup();
    inbound.fire({ type: "chat/getModels", requestId: "req-1" });
    await new Promise((r) => setImmediate(r));
    expect(agent.getAvailableModels).toHaveBeenCalledOnce();
  });

  it("includes the bundled Pi npm package version in the settings snapshot", async () => {
    const { inbound, postMessage } = setupWithView();

    inbound.fire({ type: "chat/getSettingsSnapshot", requestId: "settings-about" });
    await flushAsyncWork(2);

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "agent/settingsSnapshot",
        requestId: "settings-about",
        snapshot: expect.objectContaining({
          telemetry: expect.objectContaining({
            enabled: true,
            effectiveEnabled: true,
            vscodeTelemetryEnabled: true,
          }),
          about: expect.objectContaining({
            extensionVersion: "2.0.0-test",
            bundledPiNpmVersion: "@mariozechner/pi-coding-agent@0.70.2",
          }),
        }),
      }),
    );
  });

  it("provider/setApiKey refreshes settings and chat model options", async () => {
    const minimaxModel: AgentModel = {
      provider: "minimax",
      id: "minimax-text-01",
      name: "MiniMax Text 01",
      reasoning: false,
      contextWindow: 1_000_000,
      maxTokens: 32_000,
      source: "api-provider",
      instanceId: "pi-sdk",
    };
    agent.getAvailableModels.mockResolvedValue([minimaxModel]);
    const executeCommand = vi.spyOn(vscode.commands, "executeCommand").mockResolvedValue(undefined);
    const { inbound, postMessage } = setupWithView();

    inbound.fire({
      type: "provider/setApiKey",
      requestId: "provider-save-1",
      provider: "minimax",
      key: "secret",
    });
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));

    expect(executeCommand).toHaveBeenCalledWith("afx.setProviderApiKey", "minimax", "secret");
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "agent/settingsSnapshot",
        requestId: "provider-save-1",
      }),
    );
    expect(postMessage).toHaveBeenCalledWith({
      type: "agent/models",
      requestId: "provider-save-1",
      models: [minimaxModel],
    });
  });

  it("telemetry/setEnabled persists the opt-out setting and refreshes Clarity state", async () => {
    const { update } = mockAfxConfiguration({ "telemetry.enabled": true });
    const { inbound, postMessage } = setupWithView();

    inbound.fire({
      type: "chat/ready",
    });
    inbound.fire({
      type: "telemetry/setEnabled",
      requestId: "telemetry-off",
      enabled: false,
    });
    await flushAsyncWork(2);

    expect(update).toHaveBeenCalledWith(
      "telemetry.enabled",
      false,
      vscode.ConfigurationTarget.Global,
    );
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "agent/telemetryState",
        enabled: false,
        source: "disabledBySetting",
      }),
    );
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "agent/settingsSnapshot",
        requestId: "telemetry-off",
        snapshot: expect.objectContaining({
          telemetry: expect.objectContaining({ enabled: false, effectiveEnabled: false }),
        }),
      }),
    );
  });

  it("external/setRpcEnabled persists Pi RPC opt-in and refreshes models", async () => {
    const { update, values } = mockAfxConfiguration();
    const piModel: AgentModel = {
      provider: "anthropic",
      id: "claude-opus-4",
      name: "Claude Opus 4",
      reasoning: true,
      contextWindow: 200_000,
      maxTokens: 32_000,
      source: "external-agent",
      instanceId: "pi",
      instanceLabel: "Pi CLI",
    };
    agent.getAvailableModels.mockResolvedValue([piModel]);
    const { inbound, postMessage } = setupWithView();

    inbound.fire({
      type: "external/setRpcEnabled",
      requestId: "rpc-enabled",
      enabled: true,
    });
    await flushAsyncWork(2);

    expect(update).toHaveBeenCalledWith("rpc.enabled", true, vscode.ConfigurationTarget.Global);
    expect(values.get("rpc.enabled")).toBe(true);
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "agent/settingsSnapshot",
        requestId: "rpc-enabled",
        snapshot: expect.objectContaining({
          engine: expect.objectContaining({ rpcEnabled: true }),
          externalAgents: [expect.objectContaining({ id: "pi", enabled: true })],
        }),
      }),
    );
    expect(postMessage).toHaveBeenCalledWith({
      type: "agent/models",
      requestId: "rpc-enabled",
      models: [piModel],
    });
  });

  it("refreshes the settings snapshot after host configuration changes", async () => {
    mockAfxConfiguration({ "rpc.enabled": true });
    const piModel: AgentModel = {
      provider: "anthropic",
      id: "claude-opus-4",
      name: "Claude Opus 4",
      reasoning: true,
      contextWindow: 200_000,
      maxTokens: 32_000,
      source: "external-agent",
      instanceId: "pi",
      instanceLabel: "Pi CLI",
    };
    agent.getAvailableModels.mockResolvedValue([piModel]);
    const { provider, postMessage } = setupWithView();

    await provider.refreshRuntimeConfiguration();

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "agent/settingsSnapshot",
        snapshot: expect.objectContaining({
          engine: expect.objectContaining({ rpcEnabled: true }),
          externalAgents: [expect.objectContaining({ id: "pi", status: "connected" })],
        }),
      }),
    );
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "agent/models",
        models: [piModel],
      }),
    );
  });

  it("routes settings mutation failures to settings toast without transcript rows", async () => {
    vi.spyOn(vscode.commands, "executeCommand").mockRejectedValue(new Error("keychain locked"));
    const { inbound, postMessage } = setupWithView();

    inbound.fire({
      type: "provider/setApiKey",
      requestId: "provider-save-failed",
      provider: "anthropic",
      key: "secret",
    });
    await new Promise((r) => setImmediate(r));

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "chat/error",
        requestId: "provider-save-failed",
        message: "keychain locked",
        displayInTranscript: false,
        showToast: false,
      }),
    );
    expect(
      postMessage.mock.calls
        .map(([msg]) => msg as { type?: string; content?: string })
        .some(
          (msg) => msg.type === "chat/messageStart" && msg.content?.includes("keychain locked"),
        ),
    ).toBe(false);
  });

  it("chat/ready starts runtime monitoring and emits agent/status", async () => {
    const { inbound, postMessage } = setupWithView();
    inbound.fire({ type: "chat/ready" });
    await new Promise((r) => setImmediate(r));
    expect(agent.getStatus).toHaveBeenCalled();
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "agent/status",
        status: expect.objectContaining({ phase: "ready", running: true }),
      }),
    );
  });

  it("agent/checkStatus performs an immediate status check", async () => {
    const { inbound, postMessage } = setupWithView();
    inbound.fire({ type: "agent/checkStatus", requestId: "status-1" });
    await new Promise((r) => setImmediate(r));
    expect(agent.getStatus).toHaveBeenCalledOnce();
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "agent/status",
        requestId: "status-1",
      }),
    );
  });

  it("surfaces restart-required runtime status as one chat error", async () => {
    agent.getStatus.mockResolvedValue({
      running: false,
      isStreaming: false,
      restartRequired: true,
      info: "Pi RPC failed to start 3 times. Automatic retries are stopped.",
    });
    const { inbound, postMessage } = setupWithView();

    inbound.fire({ type: "agent/checkStatus", requestId: "status-locked" });
    await new Promise((r) => setImmediate(r));
    inbound.fire({ type: "agent/checkStatus", requestId: "status-locked-2" });
    await new Promise((r) => setImmediate(r));

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "agent/status",
        requestId: "status-locked",
        status: expect.objectContaining({ phase: "error", restartRequired: true }),
      }),
    );
    const errors = postMessage.mock.calls
      .map(([msg]) => msg as { type?: string; message?: string })
      .filter((msg) => msg.type === "chat/error");
    expect(errors).toHaveLength(1);
    expect(errors[0]?.message).toMatch(/automatic retries are stopped/i);
  });

  it("agent/restart stops runtime and emits checking/ready transitions", async () => {
    const { inbound, postMessage } = setupWithView();
    inbound.fire({ type: "agent/restart", requestId: "restart-1" });
    await new Promise((r) => setImmediate(r));
    expect(agent.stop).toHaveBeenCalledOnce();
    const statuses = postMessage.mock.calls
      .map(([msg]) => msg as { type?: string; status?: { phase?: string } })
      .filter((msg) => msg.type === "agent/status");
    expect(statuses.map((msg) => msg.status?.phase)).toEqual(["checking", "ready"]);
  });

  it("chat/setModel delegates to agent.setModel with the provided ids", async () => {
    const inbound = setup();
    inbound.fire({
      type: "chat/setModel",
      requestId: "req-2",
      provider: "anthropic",
      modelId: "claude-opus-4-7",
      instanceId: "pi",
    });
    await flushAsyncWork();
    expect(agent.setModel).toHaveBeenCalledWith({
      provider: "anthropic",
      modelId: "claude-opus-4-7",
      instanceId: "pi",
    });
  });

  it("persists chat API-provider model switches as the SDK default model", async () => {
    const { update, values } = mockAfxConfiguration();
    const model: AgentModel = {
      provider: "Anthropic",
      id: "claude-sonnet-4-5",
      name: "Claude Sonnet 4.5",
      reasoning: true,
      contextWindow: 200_000,
      maxTokens: 64_000,
      source: "api-provider",
      instanceId: "pi-sdk",
      instanceLabel: "Anthropic",
    };
    agent.setModel.mockResolvedValue(model);
    agent.getAvailableModels.mockResolvedValue([model]);
    const { inbound, postMessage } = setupWithView();

    inbound.fire({
      type: "chat/setModel",
      requestId: "api-model-switch",
      provider: "Anthropic",
      modelId: "claude-sonnet-4-5",
      instanceId: "pi-sdk",
    });
    await flushAsyncWork(3);

    expect(update).toHaveBeenCalledWith(
      "sdk.defaultModel",
      "anthropic:claude-sonnet-4-5",
      vscode.ConfigurationTarget.Global,
    );
    expect(values.get("sdk.defaultModel")).toBe("anthropic:claude-sonnet-4-5");
    expect(postMessage).toHaveBeenCalledWith({
      type: "agent/modelChanged",
      requestId: "api-model-switch",
      model,
    });
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "chat/messageStart",
        role: "assistant",
        content: expect.stringContaining("Switched to Anthropic"),
      }),
    );
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "agent/settingsSnapshot",
        requestId: "api-model-switch",
        snapshot: expect.objectContaining({
          sdk: expect.objectContaining({ defaultModel: "anthropic:claude-sonnet-4-5" }),
        }),
      }),
    );
  });

  it("keeps external-agent model switches scoped to the active session", async () => {
    const { update } = mockAfxConfiguration();
    const model: AgentModel = {
      provider: "pi",
      id: "default",
      name: "Pi CLI",
      reasoning: true,
      contextWindow: 200_000,
      maxTokens: 64_000,
      source: "external-agent",
      instanceId: "pi",
      instanceLabel: "Pi CLI",
    };
    agent.setModel.mockResolvedValue(model);
    const inbound = setup();

    inbound.fire({
      type: "chat/setModel",
      requestId: "external-model-switch",
      provider: "pi",
      modelId: "default",
      instanceId: "pi",
    });
    await flushAsyncWork();

    expect(update).not.toHaveBeenCalled();
  });

  it("persists model switch errors into the chat transcript", async () => {
    agent.setModel.mockRejectedValue(
      new Error(
        '401 {"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key"}}',
      ),
    );
    const { inbound, postMessage } = setupWithView();

    inbound.fire({
      type: "chat/setModel",
      requestId: "model-auth-failure",
      provider: "anthropic",
      modelId: "claude-opus-4-5",
    });
    await new Promise((r) => setImmediate(r));

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "chat/messageStart",
        role: "assistant",
        content: expect.stringContaining("invalid x-api-key"),
      }),
    );
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "chat/error",
        requestId: "model-auth-failure",
        displayInTranscript: false,
        showToast: true,
        message: expect.stringContaining("invalid x-api-key"),
      }),
    );

    inbound.fire({ type: "chat/getState" });
    const snapshots = postMessage.mock.calls
      .map(([msg]) => msg as { type?: string; messages?: unknown })
      .filter((msg) => msg.type === "chat/state");
    expect(snapshots.at(-1)?.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: "assistant",
          content: expect.stringContaining("invalid x-api-key"),
          stopReason: "error",
        }),
      ]),
    );
  });

  it("clears the active turn when the runtime reports an assistant error message", async () => {
    const { inbound, postMessage } = setupWithView();
    const listener = firstAgentEventListener();

    inbound.fire({ type: "chat/send", requestId: "bad-provider", content: "hello" });
    await flushAsyncWork();
    listener?.({
      type: "message_start",
      role: "assistant",
      errorMessage: "invalid x-api-key",
    });

    inbound.fire({ type: "chat/send", requestId: "after-error", content: "try again" });
    await flushAsyncWork();

    expect(agent.send).toHaveBeenCalledTimes(2);
    expect(
      postMessage.mock.calls
        .map(([msg]) => msg as { type?: string; message?: string })
        .some(
          (msg) =>
            msg.type === "chat/error" &&
            /already streaming/i.test(typeof msg.message === "string" ? msg.message : ""),
        ),
    ).toBe(false);
  });

  it("renders runtime error events in the transcript and clears the active turn", async () => {
    const { inbound, postMessage } = setupWithView();
    const listener = firstAgentEventListener();

    inbound.fire({ type: "chat/send", requestId: "quota-error", content: "hello" });
    await flushAsyncWork();
    listener?.({
      type: "error",
      message: "You exceeded your current quota.",
    });

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "chat/messageStart",
        role: "assistant",
        content: expect.stringContaining("You exceeded your current quota."),
      }),
    );
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "chat/error",
        requestId: "quota-error",
        message: "You exceeded your current quota.",
        displayInTranscript: false,
        showToast: true,
      }),
    );

    inbound.fire({ type: "chat/send", requestId: "after-quota-error", content: "try again" });
    await flushAsyncWork();

    expect(agent.send).toHaveBeenCalledTimes(2);
    expect(
      postMessage.mock.calls
        .map(([msg]) => msg as { type?: string; message?: string })
        .some(
          (msg) =>
            msg.type === "chat/error" &&
            /already streaming/i.test(typeof msg.message === "string" ? msg.message : ""),
        ),
    ).toBe(false);

    inbound.fire({ type: "chat/getState" });
    const snapshots = postMessage.mock.calls
      .map(([msg]) => msg as { type?: string; messages?: unknown })
      .filter((msg) => msg.type === "chat/state");
    expect(snapshots.at(-1)?.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: "assistant",
          content: expect.stringContaining("You exceeded your current quota."),
          stopReason: "error",
        }),
      ]),
    );
  });

  it("keeps context-overflow turns alive while Pi compacts and retries", async () => {
    const { inbound, postMessage } = setupWithView();
    const listener = firstAgentEventListener();

    inbound.fire({ type: "chat/send", requestId: "overflow-retry", content: "/afx-session" });
    await flushAsyncWork();
    listener?.({
      type: "context_overflow",
      message:
        "Your input exceeds the context window of this model. Please adjust your input and try again.",
    });
    listener?.({ type: "agent_end" });
    listener?.({ type: "compaction_start", reason: "overflow" });
    listener?.({
      type: "compaction_end",
      reason: "overflow",
      result: {
        summary: "Kept the important AFX session details.",
        firstKeptEntryId: "entry-2",
        tokensBefore: 250_000,
      },
      aborted: false,
      willRetry: true,
    });
    listener?.({ type: "agent_start" });
    listener?.({ type: "text_delta", id: "retry-msg", delta: "Recovered after compaction." });
    listener?.({ type: "message_end", role: "assistant", stopReason: "end_turn" });
    listener?.({ type: "agent_end" });
    await flushAsyncWork(2);

    expect(postMessage).toHaveBeenCalledWith({
      type: "agent/compacted",
      requestId: "overflow-retry",
      result: {
        summary: "Kept the important AFX session details.",
        firstKeptEntryId: "entry-2",
        tokensBefore: 250_000,
      },
    });
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "chat/messageDelta",
        delta: "Recovered after compaction.",
      }),
    );
    expect(
      postMessage.mock.calls
        .map(([msg]) => msg as { type?: string; message?: string })
        .some(
          (msg) =>
            msg.type === "chat/error" &&
            /context window/i.test(typeof msg.message === "string" ? msg.message : ""),
        ),
    ).toBe(false);
  });

  it("surfaces context overflow when Pi does not start compaction recovery", async () => {
    vi.useFakeTimers();
    const { inbound, postMessage } = setupWithView();
    const listener = firstAgentEventListener();

    inbound.fire({ type: "chat/send", requestId: "overflow-no-retry", content: "/afx-session" });
    listener?.({
      type: "context_overflow",
      message:
        "Your input exceeds the context window of this model. Please adjust your input and try again.",
    });
    listener?.({ type: "agent_end" });

    await vi.advanceTimersByTimeAsync(1_500);

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "chat/error",
        requestId: "overflow-no-retry",
        message: expect.stringContaining("context window"),
      }),
    );
  });

  it("keeps transient provider failures alive while Pi auto-retries", async () => {
    const { inbound, postMessage } = setupWithView();
    const listener = firstAgentEventListener();

    inbound.fire({ type: "chat/send", requestId: "transient-retry", content: "hello" });
    await flushAsyncWork();
    listener?.({
      type: "retryable_error",
      message: "overloaded_error: upstream service unavailable",
    });
    listener?.({ type: "agent_end" });
    listener?.({
      type: "auto_retry_start",
      attempt: 1,
      maxAttempts: 3,
      delayMs: 1_000,
      errorMessage: "overloaded_error: upstream service unavailable",
    });
    listener?.({ type: "agent_start" });
    listener?.({ type: "text_delta", id: "retry-msg", delta: "Recovered after retry." });
    listener?.({ type: "auto_retry_end", success: true, attempt: 1 });
    listener?.({ type: "message_end", role: "assistant", stopReason: "end_turn" });
    listener?.({ type: "agent_end" });
    await flushAsyncWork(2);

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "chat/messageDelta",
        delta: "Recovered after retry.",
      }),
    );
    expect(
      postMessage.mock.calls
        .map(([msg]) => msg as { type?: string; message?: string })
        .some(
          (msg) =>
            msg.type === "chat/error" &&
            /overloaded_error/i.test(typeof msg.message === "string" ? msg.message : ""),
        ),
    ).toBe(false);
  });

  it("model switches clear stale streaming state and add a transcript info row", async () => {
    mockAfxConfiguration();
    const model: AgentModel = {
      provider: "cerebras",
      id: "llama-4-scout",
      name: "Llama 4 Scout",
      reasoning: false,
      contextWindow: 128_000,
      maxTokens: 8_000,
      source: "api-provider",
      instanceId: "pi-sdk",
      instanceLabel: "Cerebras",
    };
    agent.setModel.mockResolvedValue(model);
    const { inbound, postMessage } = setupWithView();
    const listener = firstAgentEventListener();

    listener?.({ type: "agent_start" });
    inbound.fire({
      type: "chat/setModel",
      requestId: "switch-cerebras",
      provider: "cerebras",
      modelId: "llama-4-scout",
      instanceId: "pi-sdk",
    });
    await flushAsyncWork();
    inbound.fire({ type: "chat/send", requestId: "after-switch", content: "hello" });
    await flushAsyncWork();

    expect(agent.send).toHaveBeenCalledOnce();
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "chat/messageStart",
        role: "assistant",
        content: expect.stringContaining("Switched to Cerebras"),
      }),
    );
  });

  it("chat/getCommands delegates to agent.getCommands", async () => {
    const inbound = setup();
    inbound.fire({ type: "chat/getCommands", requestId: "req-3" });
    await new Promise((r) => setImmediate(r));
    expect(agent.getCommands).toHaveBeenCalledOnce();
  });

  it("chat/getCommands returns empty commands without an error when no runtime is configured", async () => {
    agent.getCommands.mockRejectedValueOnce(new Error("No configured agent runtime"));
    const { inbound, postMessage } = setupWithView();

    inbound.fire({ type: "chat/getCommands", requestId: "req-no-runtime" });
    await flushAsyncWork();

    expect(postMessage).toHaveBeenCalledWith({
      type: "agent/commands",
      requestId: "req-no-runtime",
      commands: [],
    });
    expect(
      postMessage.mock.calls
        .map(([msg]) => msg as { type?: string })
        .some((msg) => msg.type === "chat/error"),
    ).toBe(false);
  });

  it("chat/getStderr delegates to agent.getStderr (sync)", () => {
    const inbound = setup();
    inbound.fire({ type: "chat/getStderr", requestId: "req-4" });
    expect(agent.getStderr).toHaveBeenCalledOnce();
  });

  it("appearance/update persists validated theme and style settings", async () => {
    const update = vi.fn(async () => {});
    vi.spyOn(vscode.workspace, "getConfiguration").mockReturnValue({
      get: <T>(key: string, defaultValue?: T) =>
        (({ theme: "meridian", style: "lyra", logLevel: "info" })[key] ?? defaultValue) as T,
      has: () => true,
      inspect: () => undefined,
      update,
    });
    const { inbound, postMessage } = setupWithView();

    inbound.fire({
      type: "appearance/update",
      requestId: "appearance-1",
      theme: "meridian",
      style: "sera",
    });
    await new Promise((r) => setImmediate(r));

    expect(update).toHaveBeenCalledWith("theme", "meridian", vscode.ConfigurationTarget.Global);
    expect(update).toHaveBeenCalledWith("style", "sera", vscode.ConfigurationTarget.Global);
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "agent/appearanceUpdated",
        requestId: "appearance-1",
        appearance: expect.objectContaining({ theme: "meridian", style: "sera" }),
      }),
    );
  });

  it("appearance/update rejects unknown values without writing settings", async () => {
    const update = vi.fn(async () => {});
    vi.spyOn(vscode.workspace, "getConfiguration").mockReturnValue({
      get: <T>(key: string, defaultValue?: T) =>
        (({ theme: "meridian", style: "lyra", logLevel: "info" })[key] ?? defaultValue) as T,
      has: () => true,
      inspect: () => undefined,
      update,
    });
    const { inbound, postMessage } = setupWithView();

    inbound.fire({
      type: "appearance/update",
      requestId: "appearance-bad",
      theme: "meridian",
      style: "unknown",
    });
    await new Promise((r) => setImmediate(r));

    expect(update).not.toHaveBeenCalled();
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "chat/error",
        requestId: "appearance-bad",
        message: expect.stringMatching(/unknown appearance/i),
        displayInTranscript: false,
        showToast: false,
      }),
    );
    expect(
      postMessage.mock.calls
        .map(([msg]) => msg as { type?: string; content?: string })
        .some(
          (msg) => msg.type === "chat/messageStart" && msg.content?.includes("Unknown appearance"),
        ),
    ).toBe(false);
  });

  it("chat/abort delegates to agent.abort", async () => {
    const inbound = setup();
    inbound.fire({ type: "chat/abort" });
    await new Promise((r) => setImmediate(r));
    expect(agent.abort).toHaveBeenCalledOnce();
  });

  it("chat/newSession delegates to agent.newSession", async () => {
    const inbound = setup();
    inbound.fire({ type: "chat/newSession" });
    await new Promise((r) => setImmediate(r));
    expect(agent.newSession).toHaveBeenCalledOnce();
  });

  it("chat/send delegates to agent.send with the user content", async () => {
    const inbound = setup();
    inbound.fire({
      type: "chat/send",
      requestId: "req-5",
      content: "hello world",
    });
    await new Promise((r) => setImmediate(r));
    expect(agent.send).toHaveBeenCalledOnce();
    expect(agent.send).toHaveBeenCalledWith(expect.stringContaining("hello world"));
  });

  it("keeps the no-response timeout active when the runtime only reports startup", async () => {
    vi.useFakeTimers();
    const { inbound, postMessage } = setupWithView();
    const listener = firstAgentEventListener();

    inbound.fire({
      type: "chat/send",
      requestId: "req-start-only",
      content: "hello world",
    });
    listener?.({ type: "agent_start" });

    await vi.advanceTimersByTimeAsync(20_000);

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "chat/error",
        requestId: "req-start-only",
        message: expect.stringContaining("did not emit a response"),
      }),
    );
  });

  it("suppresses the normal prompt user echo because the host already rendered it", async () => {
    const { inbound, postMessage } = setupWithView();
    inbound.fire({ type: "chat/send", requestId: "req-send", content: "hello world" });
    await new Promise((r) => setImmediate(r));
    const listener = firstAgentEventListener();

    listener?.({ type: "message_start", role: "user", content: "inflated hello world" });

    const userStarts = postMessage.mock.calls
      .map(([msg]) => msg as { type?: string; role?: string })
      .filter((msg) => msg.type === "chat/messageStart" && msg.role === "user");
    expect(userStarts).toHaveLength(1);
  });

  it("rejects chat/followUp when no turn is streaming", async () => {
    const { inbound, postMessage } = setupWithView();
    inbound.fire({ type: "chat/followUp", requestId: "req-follow", content: "next please" });
    await new Promise((r) => setImmediate(r));
    expect(agent.followUp).not.toHaveBeenCalled();
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "chat/error",
        requestId: "req-follow",
        message: expect.stringMatching(/no turn is currently streaming/i),
      }),
    );
  });

  it("renders queued user messages only when the runtime consumes them", async () => {
    const { inbound, postMessage } = setupWithView();
    const listener = firstAgentEventListener();
    listener?.({ type: "agent_start" });

    inbound.fire({ type: "chat/followUp", requestId: "req-follow", content: "next please" });
    await new Promise((r) => setImmediate(r));

    let userStarts = postMessage.mock.calls
      .map(([msg]) => msg as { type?: string; role?: string; content?: string })
      .filter((msg) => msg.type === "chat/messageStart" && msg.role === "user");
    expect(userStarts).toHaveLength(0);

    listener?.({ type: "message_start", role: "user", content: "inflated next please" });

    userStarts = postMessage.mock.calls
      .map(([msg]) => msg as { type?: string; role?: string; content?: string })
      .filter((msg) => msg.type === "chat/messageStart" && msg.role === "user");
    expect(userStarts).toHaveLength(1);
    expect(userStarts[0]?.content).toBe("next please");
  });

  it("broadcasts runtime settings when the runtime reports a queue update", async () => {
    agent.getStatus.mockResolvedValue({
      running: true,
      isStreaming: true,
      model: { provider: "openai", id: "gpt-5.2", name: "GPT-5.2" },
      thinkingLevel: "medium",
      isCompacting: false,
      pendingMessageCount: 2,
      steeringMode: "all",
      followUpMode: "all",
      autoCompactionEnabled: true,
      autoRetryEnabled: true,
      sessionId: "test-session",
      messageCount: 0,
    });
    const { postMessage } = setupWithView();
    const listener = firstAgentEventListener();

    listener?.({
      type: "queue_update",
      steeringCount: 1,
      followUpCount: 1,
      pendingMessageCount: 2,
    });
    await new Promise((r) => setImmediate(r));

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "agent/runtimeSettings",
        settings: expect.objectContaining({ pendingMessageCount: 2 }),
      }),
    );
  });

  it("closes each assistant message on message_end inside one agent run", () => {
    const { postMessage } = setupWithView();
    const listener = firstAgentEventListener();

    listener?.({ type: "agent_start" });
    listener?.({ type: "text_delta", id: "assistant-1", delta: "first" });
    listener?.({ type: "message_end", role: "assistant", stopReason: "end_turn" });
    listener?.({ type: "text_delta", id: "assistant-2", delta: "second" });
    listener?.({ type: "message_end", role: "assistant", stopReason: "end_turn" });

    const posted = postMessage.mock.calls.map(([msg]) => msg as { type?: string; id?: string });
    expect(posted.filter((msg) => msg.type === "chat/messageStart")).toHaveLength(2);
    expect(posted.filter((msg) => msg.type === "chat/messageEnd")).toHaveLength(2);
    expect(posted).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "chat/messageDelta", id: "assistant-1" }),
        expect.objectContaining({ type: "chat/messageDelta", id: "assistant-2" }),
      ]),
    );
  });

  it("anchors tool calls that arrive before assistant text in state snapshots", async () => {
    const { inbound, postMessage } = setupWithView();
    const listener = firstAgentEventListener();

    listener?.({ type: "agent_start" });
    listener?.({
      type: "tool_start",
      toolCallId: "tool-1",
      toolName: "read_file",
      args: { path: "apps/chat/src/views/chat.tsx" },
    });
    listener?.({
      type: "tool_end",
      toolCallId: "tool-1",
      ok: true,
      result: { content: [{ type: "text", text: "apps/chat/src/views/chat.tsx (1320 lines)" }] },
    });
    listener?.({ type: "text_delta", id: "assistant-real", delta: "Done" });
    await new Promise((r) => setTimeout(r, 25));
    listener?.({ type: "text_delta", id: "assistant-real", delta: "." });
    listener?.({ type: "message_end", role: "assistant", stopReason: "end_turn" });

    inbound.fire({ type: "chat/getState" });

    const posted = postMessage.mock.calls.map(
      ([msg]) => msg as { type?: string; role?: string; messages?: unknown },
    );
    const firstAssistantStart = posted.findIndex(
      (msg) => msg.type === "chat/messageStart" && msg.role === "assistant",
    );
    const toolStart = posted.findIndex((msg) => msg.type === "chat/toolStart");
    expect(firstAssistantStart).toBeGreaterThanOrEqual(0);
    expect(toolStart).toBeGreaterThan(firstAssistantStart);

    const snapshots = posted.filter((msg) => msg.type === "chat/state");
    const lastSnapshot = snapshots.at(-1);
    expect(lastSnapshot?.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: "assistant",
          content: "Done.",
          tools: [
            expect.objectContaining({
              toolCallId: "tool-1",
              toolName: "read_file",
              status: "ok",
              args: { path: "apps/chat/src/views/chat.tsx" },
              summary: "apps/chat/src/views/chat.tsx (1320 lines)",
            }),
          ],
        }),
      ]),
    );
  });

  it("registers onEvent and onStderr listeners on resolveWebviewView", () => {
    setup();
    expect(agent.onEvent).toHaveBeenCalledOnce();
    expect(agent.onStderr).toHaveBeenCalledOnce();
  });

  it("ignores raw messages that are not objects with a string `type`", () => {
    const inbound = setup();
    inbound.fire(null);
    inbound.fire("not-an-object");
    inbound.fire({ noType: true });
    expect(agent.send).not.toHaveBeenCalled();
    expect(agent.abort).not.toHaveBeenCalled();
  });
});
