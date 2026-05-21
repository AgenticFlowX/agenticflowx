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
import { EventEmitter } from "events";
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

const mockSpawn = vi.fn();
vi.mock("child_process", () => ({
  spawn: (...args: unknown[]) => mockSpawn(...args),
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
    mockSpawn.mockClear();
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

  function mockAfxConfiguration(
    initialValues: Record<string, unknown> = {},
    workspaceKeys: ReadonlySet<string> = new Set(),
  ) {
    const defaults: Record<string, unknown> = {
      agentBinaryPath: "",
      agentEphemeralSession: false,
      logLevel: "info",
      "rpc.enabled": false,
      "sdk.defaultModel": "anthropic:claude-opus-4-5",
      "sdk.enabled": true,
      "sdk.ollamaBaseUrl": "",
      sessionDir: "",
      "context.includeActiveFileContext": true,
      "mode.active": "code",
      "composer.intent.slot": 1,
      "composer.intent.minimized": false,
      style: "lyra",
      "telemetry.enabled": true,
      theme: "meridian",
    };
    const workspaceOverrides = new Set(workspaceKeys);
    const globalValues = new Map<string, unknown>(
      Object.entries({ ...defaults, ...initialValues }),
    );
    const values = new Map<string, unknown>(Object.entries({ ...defaults, ...initialValues }));
    for (const key of workspaceOverrides) {
      globalValues.set(key, defaults[key]);
    }
    const update = vi.fn(
      async (key: string, value: unknown, target?: vscode.ConfigurationTarget) => {
        if (target === vscode.ConfigurationTarget.Workspace) {
          if (value === undefined) {
            workspaceOverrides.delete(key);
            values.set(key, globalValues.get(key));
          } else {
            workspaceOverrides.add(key);
            values.set(key, value);
          }
          return;
        }

        globalValues.set(key, value);
        if (!workspaceOverrides.has(key)) {
          values.set(key, value);
        }
      },
    );
    function inspect<T>(key: string) {
      return {
        key,
        globalValue: globalValues.get(key) as T,
        workspaceValue: workspaceOverrides.has(key) ? (values.get(key) as T) : undefined,
      };
    }
    vi.spyOn(vscode.workspace, "getConfiguration").mockReturnValue({
      get: <T>(key: string, defaultValue?: T) =>
        (values.has(key) ? values.get(key) : defaultValue) as T,
      has: (key: string) => values.has(key),
      inspect,
      update,
    });
    return { update, values };
  }

  async function flushAsyncWork(cycles = 1): Promise<void> {
    for (let cycle = 0; cycle < cycles; cycle += 1) {
      await new Promise((resolve) => setImmediate(resolve));
    }
  }

  function mockActiveWorkspaceFile(): void {
    const activeEditor = {
      document: {
        uri: vscode.Uri.file("/workspace/src/active.ts"),
        languageId: "ts",
      },
    } as unknown as vscode.TextEditor;
    vi.spyOn(vscode.workspace, "workspaceFolders", "get").mockReturnValue([
      { uri: { fsPath: "/workspace" } } as vscode.WorkspaceFolder,
    ]);
    vi.spyOn(vscode.window, "activeTextEditor", "get").mockReturnValue(activeEditor);
    vi.spyOn(vscode.workspace.fs, "stat").mockResolvedValue({
      type: vscode.FileType.File,
      ctime: 0,
      mtime: 0,
      size: 64,
    });
    vi.spyOn(vscode.workspace.fs, "readFile").mockResolvedValue(
      Buffer.from("console.log('active file context');"),
    );
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

  it("includes the active workspace mode and Composer Intent in the settings snapshot", async () => {
    mockAfxConfiguration({
      "mode.active": "explore",
      "composer.intent.slot": 4,
      "composer.intent.minimized": true,
    });
    const { inbound, postMessage } = setupWithView();

    inbound.fire({ type: "chat/getSettingsSnapshot", requestId: "settings-mode" });
    await flushAsyncWork(2);

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "agent/settingsSnapshot",
        requestId: "settings-mode",
        snapshot: expect.objectContaining({
          mode: { active: "explore" },
          intent: {
            effective: { slot: 4, minimized: true },
            global: { slot: 4, minimized: true },
            hasWorkspaceOverride: false,
          },
        }),
      }),
    );
  });

  it("posts the active file context snapshot when the chat view becomes ready", async () => {
    const { inbound, postMessage } = setupWithView();
    mockAfxConfiguration();
    mockActiveWorkspaceFile();

    inbound.fire({ type: "chat/ready" });
    await flushAsyncWork(2);

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "agent/activeFileContext",
        snapshot: {
          name: "active.ts",
          path: "/workspace/src/active.ts",
        },
      }),
    );
  });

  it("attaches the active file context to chat turns when enabled", async () => {
    mockAfxConfiguration({ "context.includeActiveFileContext": true });
    const { inbound } = setupWithView();
    mockActiveWorkspaceFile();

    inbound.fire({ type: "chat/send", requestId: "ctx-on", content: "Summarize this." });
    await vi.waitFor(() => expect(agent.send).toHaveBeenCalledTimes(1));

    expect(agent.send).toHaveBeenCalledWith(
      expect.stringContaining("The user referenced these files:"),
    );
    expect(agent.send).toHaveBeenCalledWith(expect.stringContaining("### src/active.ts"));
    expect(agent.send).toHaveBeenCalledWith(
      expect.stringContaining("console.log('active file context');"),
    );
  });

  it("omits the active file context when disabled", async () => {
    mockAfxConfiguration({ "context.includeActiveFileContext": false });
    const { inbound } = setupWithView();
    mockActiveWorkspaceFile();

    inbound.fire({ type: "chat/send", requestId: "ctx-off", content: "Summarize this." });
    await vi.waitFor(() => expect(agent.send).toHaveBeenCalledTimes(1));

    expect(agent.send).toHaveBeenCalledWith("Summarize this.");
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

  it("chat/setIntentSlot and chat/setIntentMinimized persist Composer Intent settings", async () => {
    const { update, values } = mockAfxConfiguration();
    const { inbound, postMessage } = setupWithView();

    inbound.fire({ type: "chat/setIntentSlot", requestId: "intent-slot", slot: 4 });
    inbound.fire({ type: "chat/setIntentMinimized", requestId: "intent-min", minimized: true });
    await flushAsyncWork(2);

    expect(update).toHaveBeenCalledWith(
      "composer.intent.slot",
      4,
      vscode.ConfigurationTarget.Global,
    );
    expect(update).toHaveBeenCalledWith(
      "composer.intent.minimized",
      true,
      vscode.ConfigurationTarget.Global,
    );
    expect(values.get("composer.intent.slot")).toBe(4);
    expect(values.get("composer.intent.minimized")).toBe(true);
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "agent/settingsSnapshot",
        requestId: "intent-min",
        snapshot: expect.objectContaining({
          intent: {
            effective: { slot: 4, minimized: true },
            global: { slot: 4, minimized: true },
            hasWorkspaceOverride: false,
          },
        }),
      }),
    );
  });

  it("updates Composer Intent at workspace scope when a workspace value already exists", async () => {
    const { update } = mockAfxConfiguration(
      { "composer.intent.slot": 2 },
      new Set(["composer.intent.slot"]),
    );
    const { inbound } = setupWithView();

    inbound.fire({ type: "chat/setIntentSlot", requestId: "intent-workspace-slot", slot: 3 });
    await flushAsyncWork(2);

    expect(update).toHaveBeenCalledWith(
      "composer.intent.slot",
      3,
      vscode.ConfigurationTarget.Workspace,
    );
  });

  it("falls back to workspace Composer Intent settings when user settings cannot be written", async () => {
    const { update, values } = mockAfxConfiguration();
    update.mockRejectedValueOnce(new Error("Unable to write into user settings."));
    vi.spyOn(vscode.workspace, "workspaceFolders", "get").mockReturnValue([
      { uri: { fsPath: "/workspace" }, name: "workspace", index: 0 } as vscode.WorkspaceFolder,
    ]);
    const { inbound, postMessage } = setupWithView();

    inbound.fire({ type: "chat/setIntentSlot", requestId: "intent-fallback-slot", slot: 3 });
    await flushAsyncWork(2);

    expect(update).toHaveBeenNthCalledWith(
      1,
      "composer.intent.slot",
      3,
      vscode.ConfigurationTarget.Global,
    );
    expect(update).toHaveBeenNthCalledWith(
      2,
      "composer.intent.slot",
      3,
      vscode.ConfigurationTarget.Workspace,
    );
    expect(values.get("composer.intent.slot")).toBe(3);
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "agent/settingsSnapshot",
        requestId: "intent-fallback-slot",
        snapshot: expect.objectContaining({
          intent: expect.objectContaining({
            effective: { slot: 3, minimized: false },
            workspace: { slot: 3 },
            hasWorkspaceOverride: true,
          }),
        }),
      }),
    );
  });

  it("reports Composer Intent workspace overrides in settings snapshots", async () => {
    mockAfxConfiguration(
      {
        "composer.intent.slot": 4,
        "composer.intent.minimized": true,
      },
      new Set(["composer.intent.slot", "composer.intent.minimized"]),
    );
    const { inbound, postMessage } = setupWithView();

    inbound.fire({ type: "chat/getSettingsSnapshot", requestId: "settings-intent-workspace" });
    await flushAsyncWork(2);

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "agent/settingsSnapshot",
        requestId: "settings-intent-workspace",
        snapshot: expect.objectContaining({
          intent: {
            effective: { slot: 4, minimized: true },
            global: { slot: 1, minimized: false },
            workspace: { slot: 4, minimized: true },
            hasWorkspaceOverride: true,
          },
        }),
      }),
    );
  });

  it("chat/setIntentScope switches between global defaults and workspace overrides", async () => {
    const { update, values } = mockAfxConfiguration(
      { "composer.intent.slot": 4, "composer.intent.minimized": true },
      new Set(["composer.intent.slot", "composer.intent.minimized"]),
    );
    const { inbound, postMessage } = setupWithView();

    inbound.fire({
      type: "chat/setIntentScope",
      requestId: "intent-global",
      scope: "global",
      slot: 2,
      minimized: false,
    });
    await flushAsyncWork(2);

    expect(update).toHaveBeenCalledWith(
      "composer.intent.slot",
      2,
      vscode.ConfigurationTarget.Global,
    );
    expect(update).toHaveBeenCalledWith(
      "composer.intent.minimized",
      false,
      vscode.ConfigurationTarget.Global,
    );
    expect(update).toHaveBeenCalledWith(
      "composer.intent.slot",
      undefined,
      vscode.ConfigurationTarget.Workspace,
    );
    expect(update).toHaveBeenCalledWith(
      "composer.intent.minimized",
      undefined,
      vscode.ConfigurationTarget.Workspace,
    );
    expect(values.get("composer.intent.slot")).toBe(2);
    expect(values.get("composer.intent.minimized")).toBe(false);

    inbound.fire({
      type: "chat/setIntentScope",
      requestId: "intent-workspace",
      scope: "workspace",
      slot: 3,
      minimized: false,
    });
    await flushAsyncWork(2);

    expect(update).toHaveBeenCalledWith(
      "composer.intent.slot",
      3,
      vscode.ConfigurationTarget.Workspace,
    );
    expect(update).toHaveBeenCalledWith(
      "composer.intent.minimized",
      false,
      vscode.ConfigurationTarget.Workspace,
    );
    expect(values.get("composer.intent.slot")).toBe(3);
    expect(values.get("composer.intent.minimized")).toBe(false);

    inbound.fire({
      type: "chat/setIntentScope",
      requestId: "intent-global-again",
      scope: "global",
      slot: 2,
      minimized: false,
    });
    await flushAsyncWork(2);

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "agent/settingsSnapshot",
        requestId: "intent-global-again",
        snapshot: expect.objectContaining({
          intent: {
            effective: { slot: 2, minimized: false },
            global: { slot: 2, minimized: false },
            hasWorkspaceOverride: false,
          },
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
    expect(
      postMessage.mock.calls.some(([msg]) => {
        const posted = msg as { type?: string; content?: string };
        return (
          posted.type === "chat/messageStart" && /Switched to Anthropic/.test(posted.content ?? "")
        );
      }),
    ).toBe(false);
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

  it("locks manual compaction against overlapping sends and clears busy state", async () => {
    const { inbound, postMessage } = setupWithView();
    let finishCompact!: (value: Awaited<ReturnType<MockAgentManager["compact"]>>) => void;
    agent.compact.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishCompact = resolve;
        }),
    );

    inbound.fire({ type: "chat/compact", requestId: "manual-compact" });
    await flushAsyncWork(2);

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "agent/runtimeSettings",
        settings: expect.objectContaining({ isCompacting: true }),
      }),
    );

    inbound.fire({ type: "chat/send", requestId: "send-during-compact", content: "hello" });
    await flushAsyncWork(2);

    expect(agent.send).not.toHaveBeenCalled();
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "chat/error",
        requestId: "send-during-compact",
        message: "Compaction is in progress. Wait for it to finish.",
      }),
    );

    finishCompact({
      summary: "Kept the important details.",
      firstKeptEntryId: "entry-1",
      tokensBefore: 1000,
    });
    await flushAsyncWork(3);

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "chat/state",
        isStreaming: false,
        messages: [expect.objectContaining({ role: "compactionSummary" })],
      }),
    );
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "agent/runtimeSettings",
        settings: expect.objectContaining({ isCompacting: false }),
      }),
    );
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

  it("model switches clear stale streaming state without hiding empty-session onboarding", async () => {
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
    expect(
      postMessage.mock.calls.some(([msg]) => {
        const posted = msg as { type?: string; role?: string; content?: string };
        return (
          posted.type === "chat/messageStart" &&
          posted.role === "assistant" &&
          /Switched to Cerebras/.test(posted.content ?? "")
        );
      }),
    ).toBe(false);
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

  it("chat/showLogs opens the AgenticFlowX output channel command", () => {
    const executeCommand = vi.spyOn(vscode.commands, "executeCommand").mockResolvedValue(undefined);
    const inbound = setup();
    inbound.fire({ type: "chat/showLogs", requestId: "logs-1" });
    expect(executeCommand).toHaveBeenCalledWith("afx.showLogs");
  });

  it("chat/openWorkbench opens the Workbench command", () => {
    const executeCommand = vi.spyOn(vscode.commands, "executeCommand").mockResolvedValue(undefined);
    const inbound = setup();
    inbound.fire({ type: "chat/openWorkbench", requestId: "workbench-1" });
    expect(executeCommand).toHaveBeenCalledWith("afx.openWorkbench");
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

  it("prepends the Explore guardrail prompt to chat/send", async () => {
    mockAfxConfiguration({ "mode.active": "explore" });
    const { inbound } = setupWithView();

    inbound.fire({
      type: "chat/send",
      requestId: "req-explore-send",
      content: "hello world",
    });
    await new Promise((r) => setImmediate(r));

    expect(agent.send).toHaveBeenCalledOnce();
    expect(agent.send).toHaveBeenCalledWith(
      expect.stringContaining("[AFX EXPLORE MODE: READ ONLY]"),
    );
    expect(agent.send).toHaveBeenCalledWith(
      expect.stringContaining("read files, list folders, search source"),
    );
    expect(agent.send).toHaveBeenCalledWith(expect.stringContaining("read pages or websites"));
    expect(agent.send).toHaveBeenCalledWith(expect.stringContaining("This requires Code mode"));
    expect(agent.send).toHaveBeenCalledWith(expect.stringContaining("hello world"));
  });

  it("adds non-default Composer Intent prompts after the parent mode guardrail", async () => {
    mockAfxConfiguration({ "mode.active": "explore" });
    const { inbound } = setupWithView();

    inbound.fire({
      type: "chat/send",
      requestId: "req-explore-prd",
      content: "shape this idea",
      intentSlot: 4,
    });
    await flushAsyncWork(2);

    const prompt = (vi.mocked(agent.send).mock.calls[0] as [string] | undefined)?.[0] ?? "";
    expect(prompt.indexOf("[AFX EXPLORE MODE: READ ONLY]")).toBeLessThan(
      prompt.indexOf("Mode: PRD"),
    );
    expect(prompt).toContain(
      "Mode: PRD. Draft a PRD in chat from the discussion and read-only repo/web context",
    );
    expect(prompt).toContain("Runtime tools are allowed only for read-only inspection");
    expect(prompt).toContain("shape this idea");
  });

  it("applies the Explore guardrail to all four Composer Intent slots", async () => {
    mockAfxConfiguration({ "mode.active": "explore" });
    const { inbound } = setupWithView();
    const listener = firstAgentEventListener();
    const expectedIntentLabels = new Map([
      [1, null],
      [2, "Mode: Ask"],
      [3, "Mode: Architect"],
      [4, "Mode: PRD"],
    ]);

    for (const slot of [1, 2, 3, 4] as const) {
      inbound.fire({
        type: "chat/send",
        requestId: `req-explore-slot-${slot}`,
        content: `slot ${slot} request`,
        intentSlot: slot,
      });
      await flushAsyncWork(2);

      const prompt = (vi.mocked(agent.send).mock.calls.at(-1) as [string] | undefined)?.[0] ?? "";
      expect(prompt).toContain("[AFX EXPLORE MODE: READ ONLY]");
      expect(prompt).toContain("read files, list folders, search source");
      expect(prompt).toContain(`slot ${slot} request`);
      const intentLabel = expectedIntentLabels.get(slot);
      if (intentLabel) {
        expect(prompt.indexOf("[AFX EXPLORE MODE: READ ONLY]")).toBeLessThan(
          prompt.indexOf(intentLabel),
        );
      } else {
        expect(prompt).not.toContain("Mode: ");
      }

      listener?.({ type: "agent_end" });
      await flushAsyncWork(1);
    }
  });

  it("uses the persisted Composer Intent slot when the send omits a slot override", async () => {
    mockAfxConfiguration({ "mode.active": "code", "composer.intent.slot": 2 });
    const { inbound } = setupWithView();

    inbound.fire({ type: "chat/send", requestId: "req-code-ask", content: "hello" });
    await flushAsyncWork(2);

    const prompt = (vi.mocked(agent.send).mock.calls[0] as [string] | undefined)?.[0] ?? "";
    expect(prompt).toContain("Mode: Ask");
    expect(prompt).toContain("hello");
    expect(prompt).not.toContain("[AFX EXPLORE MODE: READ ONLY]");
  });

  it("uses Default as zero Intent injection and suppresses Intent in Spec mode", async () => {
    const { inbound } = setupWithView();

    inbound.fire({
      type: "chat/send",
      requestId: "req-code-default",
      content: "hello",
      intentSlot: 1,
    });
    await flushAsyncWork(2);
    let prompt = (vi.mocked(agent.send).mock.calls[0] as [string] | undefined)?.[0] ?? "";
    expect(prompt).toBe("hello");

    mockAfxConfiguration({ "mode.active": "spec" });
    const { inbound: specInbound } = setupWithView();
    specInbound.fire({
      type: "chat/send",
      requestId: "req-spec-intent",
      content: "draft a plan",
      intentSlot: 4,
    });
    await flushAsyncWork(2);
    prompt = (vi.mocked(agent.send).mock.calls.at(-1) as [string] | undefined)?.[0] ?? "";
    expect(prompt).toContain("AFX SPEC MODE");
    expect(prompt).toContain("draft a plan");
    expect(prompt).not.toContain("Mode: Code");
    expect(prompt).not.toContain("Mode: PRD");
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

  it("prepends the Explore guardrail prompt to chat/steer and chat/followUp", async () => {
    mockAfxConfiguration({ "mode.active": "explore" });
    const { inbound } = setupWithView();
    const listener = firstAgentEventListener();

    listener?.({ type: "agent_start" });

    inbound.fire({ type: "chat/steer", requestId: "req-explore-steer", content: "redirect" });
    await flushAsyncWork(2);
    expect(agent.steer).toHaveBeenCalledOnce();
    expect(agent.steer).toHaveBeenCalledWith(
      expect.stringContaining("[AFX EXPLORE MODE: READ ONLY]"),
    );
    expect(agent.steer).toHaveBeenCalledWith(expect.stringContaining("redirect"));

    inbound.fire({
      type: "chat/followUp",
      requestId: "req-explore-follow",
      content: "next question",
    });
    await flushAsyncWork(2);
    expect(agent.followUp).toHaveBeenCalledOnce();
    expect(agent.followUp).toHaveBeenCalledWith(
      expect.stringContaining("[AFX EXPLORE MODE: READ ONLY]"),
    );
    expect(agent.followUp).toHaveBeenCalledWith(expect.stringContaining("next question"));
  });

  it("applies Composer Intent prompts to chat/steer and chat/followUp once per queued turn", async () => {
    const { inbound } = setupWithView();
    const listener = firstAgentEventListener();

    listener?.({ type: "agent_start" });

    inbound.fire({
      type: "chat/steer",
      requestId: "req-code-steer-intent",
      content: "redirect",
      intentSlot: 2,
    });
    await flushAsyncWork(2);
    const steerPrompt = (vi.mocked(agent.steer).mock.calls[0] as [string] | undefined)?.[0] ?? "";
    expect(steerPrompt.match(/Mode: Ask/g) ?? []).toHaveLength(1);
    expect(steerPrompt).toContain("redirect");

    inbound.fire({
      type: "chat/followUp",
      requestId: "req-code-follow-intent",
      content: "next question",
      intentSlot: 3,
    });
    await flushAsyncWork(2);
    const followUpPrompt =
      (vi.mocked(agent.followUp).mock.calls[0] as [string] | undefined)?.[0] ?? "";
    expect(followUpPrompt.match(/Mode: Architect/g) ?? []).toHaveLength(1);
    expect(followUpPrompt).toContain("next question");
  });

  it("chat/setMode delegates to the shared afx.setMode command", async () => {
    const executeCommand = vi.spyOn(vscode.commands, "executeCommand").mockResolvedValue(undefined);
    const inbound = setup();

    inbound.fire({ type: "chat/setMode", requestId: "req-mode", mode: "explore" });
    await new Promise((r) => setImmediate(r));

    expect(executeCommand).toHaveBeenCalledWith("afx.setMode", "explore");
  });

  /**
   * @see docs/specs/201-app-vscode-panels/design.md [DES-PANELS-MODE-WORKFLOW] [DES-PANELS-EXPLORE-PROMPT]
   * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-MODE-TOGGLE] [DES-COMPOSER-CONTEXT]
   */
  it("treats a newly selected Code mode as immediate for the next send", async () => {
    mockAfxConfiguration({ "mode.active": "explore" });
    let resolveModeChange!: () => void;
    const modeChangeGate = new Promise<void>((resolve) => {
      resolveModeChange = resolve;
    });
    vi.spyOn(vscode.commands, "executeCommand").mockImplementation(async (command: string) => {
      if (command === "afx.setMode") {
        await modeChangeGate;
      }
      return undefined;
    });
    const inbound = setup();

    inbound.fire({ type: "chat/setMode", requestId: "req-mode", mode: "code" });
    inbound.fire({ type: "chat/send", requestId: "req-send", content: "hello world" });
    await flushAsyncWork(2);

    expect(agent.send).toHaveBeenCalledOnce();
    const prompt = (vi.mocked(agent.send).mock.calls[0] as [string] | undefined)?.[0];
    expect(prompt).toContain("hello world");
    expect(prompt).toContain('<afx_internal_control mode_transition="explore_to_code">');
    expect(prompt).toContain("supersedes any prior AFX Explore read-only control block");
    expect(prompt).toContain("Do not acknowledge, quote, summarize, or mention");
    expect(prompt).not.toContain("You are now in Code mode");
    expect(prompt).not.toContain("[AFX EXPLORE MODE: READ ONLY]");

    resolveModeChange();
    await flushAsyncWork(2);
  });

  /**
   * @see docs/specs/201-app-vscode-panels/design.md [DES-PANELS-MODE-WORKFLOW] [DES-PANELS-EXPLORE-PROMPT]
   * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-MODE-TOGGLE] [DES-COMPOSER-CONTEXT]
   */
  it("keeps Code mode active for the next send after the mode command settles", async () => {
    mockAfxConfiguration({ "mode.active": "explore" });
    vi.spyOn(vscode.commands, "executeCommand").mockResolvedValue(undefined);
    const inbound = setup();

    inbound.fire({ type: "chat/setMode", requestId: "req-mode", mode: "code" });
    await flushAsyncWork(2);

    inbound.fire({ type: "chat/send", requestId: "req-send", content: "hello world" });
    await flushAsyncWork(2);

    expect(agent.send).toHaveBeenCalledOnce();
    const prompt = (vi.mocked(agent.send).mock.calls[0] as [string] | undefined)?.[0];
    expect(prompt).toContain("hello world");
    expect(prompt).toContain('<afx_internal_control mode_transition="explore_to_code">');
    expect(prompt).toContain("supersedes any prior AFX Explore read-only control block");
    expect(prompt).toContain("Do not acknowledge, quote, summarize, or mention");
    expect(prompt).not.toContain("You are now in Code mode");
    expect(prompt).not.toContain("[AFX EXPLORE MODE: READ ONLY]");
  });

  /**
   * @see docs/specs/201-app-vscode-panels/design.md [DES-PANELS-MODE-WORKFLOW] [DES-PANELS-EXPLORE-PROMPT]
   */
  it("only sends the Code mode reset prompt once after switching from Explore", async () => {
    mockAfxConfiguration({ "mode.active": "explore" });
    vi.spyOn(vscode.commands, "executeCommand").mockResolvedValue(undefined);
    const inbound = setup();
    const listener = firstAgentEventListener();

    inbound.fire({ type: "chat/setMode", requestId: "req-mode", mode: "code" });
    await flushAsyncWork(2);

    inbound.fire({ type: "chat/send", requestId: "req-send-1", content: "first" });
    await flushAsyncWork(2);
    listener?.({ type: "agent_end" });
    inbound.fire({ type: "chat/send", requestId: "req-send-2", content: "second" });
    await flushAsyncWork(2);

    expect(agent.send).toHaveBeenCalledTimes(2);
    const firstPrompt = (vi.mocked(agent.send).mock.calls[0] as [string] | undefined)?.[0];
    const secondPrompt = (vi.mocked(agent.send).mock.calls[1] as [string] | undefined)?.[0];
    expect(firstPrompt).toContain('<afx_internal_control mode_transition="explore_to_code">');
    expect(secondPrompt).toContain("second");
    expect(secondPrompt).not.toContain('<afx_internal_control mode_transition="explore_to_code">');
  });

  /**
   * @see docs/specs/201-app-vscode-panels/design.md [DES-PANELS-MODE-WORKFLOW] [DES-PANELS-EXPLORE-PROMPT]
   */
  it("does not send the Code mode reset prompt when Code was already active", async () => {
    mockAfxConfiguration({ "mode.active": "code" });
    const executeCommand = vi.spyOn(vscode.commands, "executeCommand").mockResolvedValue(undefined);
    const { inbound, postMessage } = setupWithView();

    inbound.fire({ type: "chat/setMode", requestId: "req-mode", mode: "code" });
    await flushAsyncWork(2);
    inbound.fire({ type: "chat/send", requestId: "req-send", content: "hello" });
    await flushAsyncWork(2);

    expect(executeCommand).not.toHaveBeenCalled();
    expect(agent.send).toHaveBeenCalledOnce();
    const prompt = (vi.mocked(agent.send).mock.calls[0] as [string] | undefined)?.[0];
    expect(prompt).toContain("hello");
    expect(prompt).not.toContain('<afx_internal_control mode_transition="explore_to_code">');
    expect(
      postMessage.mock.calls.some(([msg]) => {
        const posted = msg as { type?: string; content?: string };
        return (
          posted.type === "chat/messageStart" && /Switched to Code mode/.test(posted.content ?? "")
        );
      }),
    ).toBe(false);
  });

  /**
   * @see docs/specs/201-app-vscode-panels/design.md [DES-PANELS-MODE-WORKFLOW]
   * @see docs/specs/212-app-chat-messages/design.md [DES-MESSAGES-MOCKUP-SYSTEM]
   */
  it("adds a compact transcript info row when the workspace mode changes", async () => {
    const { values } = mockAfxConfiguration({ "mode.active": "explore" });
    vi.spyOn(vscode.commands, "executeCommand").mockImplementation(async (_command, mode) => {
      values.set("mode.active", mode);
      return undefined;
    });
    const { inbound, postMessage } = setupWithView();
    inbound.fire({ type: "chat/send", requestId: "seed", content: "hello" });
    await flushAsyncWork(2);
    postMessage.mockClear();

    inbound.fire({ type: "chat/setMode", requestId: "req-mode", mode: "code" });
    await flushAsyncWork(2);

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "chat/messageStart",
        role: "assistant",
        content: "ℹ Switched to Code mode. Normal workspace actions are available.",
      }),
    );
    expect(
      postMessage.mock.calls.some(([msg]) => {
        const posted = msg as { content?: string };
        return /afx_internal_control|You are now in Code mode/.test(posted.content ?? "");
      }),
    ).toBe(false);
  });

  it("does not hide empty-session onboarding with mode switch info rows", async () => {
    const { values } = mockAfxConfiguration({ "mode.active": "explore" });
    vi.spyOn(vscode.commands, "executeCommand").mockImplementation(async (_command, mode) => {
      values.set("mode.active", mode);
      return undefined;
    });
    const { inbound, postMessage } = setupWithView();

    inbound.fire({ type: "chat/setMode", requestId: "req-mode", mode: "code" });
    await flushAsyncWork(2);

    expect(
      postMessage.mock.calls.some(([msg]) => {
        const posted = msg as { type?: string; content?: string };
        return (
          posted.type === "chat/messageStart" && /Switched to Code mode/.test(posted.content ?? "")
        );
      }),
    ).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // Spec mode — guardrail prompt, exit reset, memento round-trip, doc-context replay.
  // @see docs/specs/201-app-vscode-panels/spec.md [FR-12]
  // @see docs/specs/201-app-vscode-panels/design.md [DES-PANELS-SPEC-GUARDRAIL] [DES-PANELS-SPEC-EXIT-PROMPT]
  // @see docs/specs/100-package-shared/spec.md [FR-11] [FR-12]
  // ---------------------------------------------------------------------------

  it("prefixes outbound sends with SPEC_MODE_PROMPT when workspace mode is Spec", async () => {
    mockAfxConfiguration({ "mode.active": "spec" });
    const inbound = setup();

    inbound.fire({ type: "chat/send", requestId: "req-send", content: "draft a feature" });
    await flushAsyncWork(2);

    expect(agent.send).toHaveBeenCalledOnce();
    const prompt = (vi.mocked(agent.send).mock.calls[0] as [string] | undefined)?.[0];
    expect(prompt).toContain("[AFX SPEC MODE: PLANNING ONLY]");
    expect(prompt).toContain("Strict planning-only policy");
    expect(prompt).toContain("draft a feature");
  });

  it("emits SPEC_MODE_EXIT_PROMPT once when leaving Spec for Code", async () => {
    const { values } = mockAfxConfiguration({ "mode.active": "spec" });
    vi.spyOn(vscode.commands, "executeCommand").mockImplementation(async (_cmd, mode) => {
      values.set("mode.active", mode);
      return undefined;
    });
    const inbound = setup();
    const listener = firstAgentEventListener();

    inbound.fire({ type: "chat/setMode", requestId: "req-mode", mode: "code" });
    await flushAsyncWork(2);
    inbound.fire({ type: "chat/send", requestId: "req-send-1", content: "first" });
    await flushAsyncWork(2);
    listener?.({ type: "agent_end" });
    inbound.fire({ type: "chat/send", requestId: "req-send-2", content: "second" });
    await flushAsyncWork(2);

    const first = (vi.mocked(agent.send).mock.calls[0] as [string] | undefined)?.[0] ?? "";
    const second = (vi.mocked(agent.send).mock.calls[1] as [string] | undefined)?.[0] ?? "";
    expect(first).toContain('mode_transition="spec_to_other"');
    expect(first).toContain("supersedes any prior AFX Spec planning-only control block");
    expect(second).not.toContain('mode_transition="spec_to_other"');
  });

  /**
   * Regression for B1 — spec→explore must layer the spec exit reset BEFORE the
   * explore guardrail, otherwise the agent stays in spec posture for one turn.
   *
   * @see docs/specs/201-app-vscode-panels/design.md [DES-PANELS-SPEC-EXIT-PROMPT]
   */
  it("layers SPEC_MODE_EXIT_PROMPT and EXPLORE_GUARDRAIL on spec→explore transition", async () => {
    const { values } = mockAfxConfiguration({ "mode.active": "spec" });
    vi.spyOn(vscode.commands, "executeCommand").mockImplementation(async (_cmd, mode) => {
      values.set("mode.active", mode);
      return undefined;
    });
    const inbound = setup();

    inbound.fire({ type: "chat/setMode", requestId: "req-mode", mode: "explore" });
    await flushAsyncWork(2);
    inbound.fire({ type: "chat/send", requestId: "req-send", content: "inspect please" });
    await flushAsyncWork(2);

    const prompt = (vi.mocked(agent.send).mock.calls[0] as [string] | undefined)?.[0] ?? "";
    expect(prompt).toContain('mode_transition="spec_to_other"');
    expect(prompt).toContain("[AFX EXPLORE MODE: READ ONLY]");
    expect(prompt.indexOf('mode_transition="spec_to_other"')).toBeLessThan(
      prompt.indexOf("[AFX EXPLORE MODE: READ ONLY]"),
    );
  });

  it("includes onboarding flags in the settings snapshot from workspaceState", async () => {
    mockAfxConfiguration({ "mode.active": "spec" });
    const stored = new Map<string, unknown>([
      ["afx.specModeOfferDismissed", true],
      ["afx.specModeTooltipSeen", false],
      ["afx.docActionsTooltipSeen", true],
    ]);
    const memento: vscode.Memento = {
      keys: () => Array.from(stored.keys()),
      get: <T>(key: string, defaultValue?: T) =>
        (stored.has(key) ? stored.get(key) : defaultValue) as T,
      update: vi.fn(async (key: string, value: unknown) => {
        if (value === undefined) stored.delete(key);
        else stored.set(key, value);
      }),
    };
    const { view, inbound } = makeMockView();
    createSidebarPanel({
      extensionUri: vscode.Uri.file("/tmp/agenticflowx"),
      extensionMode: vscode.ExtensionMode.Test,
      extensionVersion: "2.0.0-test",
      bundledPiNpmVersion: "@mariozechner/pi-coding-agent@0.70.2",
      bundledSkillsPath: "/tmp/agenticflowx/resources/skills/agenticflowx",
      agentManager: agent,
      logger,
      workspaceState: memento,
    }).resolveWebviewView(view, {} as never, {} as never);

    inbound.fire({ type: "chat/getSettingsSnapshot", requestId: "req-settings" });
    await flushAsyncWork(2);

    const postMessage = view.webview.postMessage as ReturnType<typeof vi.fn>;
    const snapshotCall = postMessage.mock.calls
      .map(([m]) => m as { type?: string; snapshot?: { onboarding?: unknown } })
      .find((m) => m.type === "agent/settingsSnapshot");
    expect(snapshotCall?.snapshot?.onboarding).toEqual({
      specModeOfferDismissed: true,
      specModeTooltipSeen: false,
      docActionsTooltipSeen: true,
    });
  });

  it("writes onboarding flag updates to workspaceState via chat/setOnboardingFlag", async () => {
    mockAfxConfiguration();
    const memento: vscode.Memento = {
      keys: () => [],
      get: <T>(_key: string, defaultValue?: T) => defaultValue as T,
      update: vi.fn(async () => {}),
    };
    const { view, inbound } = makeMockView();
    createSidebarPanel({
      extensionUri: vscode.Uri.file("/tmp/agenticflowx"),
      extensionMode: vscode.ExtensionMode.Test,
      extensionVersion: "2.0.0-test",
      bundledPiNpmVersion: "@mariozechner/pi-coding-agent@0.70.2",
      bundledSkillsPath: "/tmp/agenticflowx/resources/skills/agenticflowx",
      agentManager: agent,
      logger,
      workspaceState: memento,
    }).resolveWebviewView(view, {} as never, {} as never);

    inbound.fire({
      type: "chat/setOnboardingFlag",
      key: "specModeOfferDismissed",
      value: true,
    });
    await flushAsyncWork(2);

    expect(memento.update).toHaveBeenCalledWith("afx.specModeOfferDismissed", true);
  });

  it("replays the cached active doc context on chat/ready", async () => {
    mockAfxConfiguration({ "mode.active": "spec" });
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
    // Cache a payload BEFORE the webview resolves (simulating sprint-context
    // firing during extension activation while the chat panel is still hidden).
    provider.postActiveDocContext({
      format: "standard",
      section: "SPEC",
      docKind: "spec",
      feature: "auth",
      filePath: "/repo/docs/specs/auth/spec.md",
      approvalStatus: "Draft",
    });
    provider.resolveWebviewView(view, {} as never, {} as never);

    inbound.fire({ type: "chat/ready" });
    await flushAsyncWork(2);

    const postMessage = view.webview.postMessage as ReturnType<typeof vi.fn>;
    const replay = postMessage.mock.calls
      .map(([m]) => m as { type?: string; docKind?: string; feature?: string })
      .find((m) => m.type === "chat/activeDocContext");
    expect(replay).toMatchObject({
      type: "chat/activeDocContext",
      format: "standard",
      section: "SPEC",
      docKind: "spec",
      feature: "auth",
      filePath: "/repo/docs/specs/auth/spec.md",
      approvalStatus: "Draft",
    });
  });

  /**
   * Spec stepper bridge forwarding — siblingPaths + sectionOffsets must
   * survive round-tripping through postActiveDocContext, otherwise the
   * webview falls back to "<segment>.md not found" tooltips.
   *
   * @see docs/specs/211-app-chat-composer/spec.md [FR-17]
   * @see docs/specs/100-package-shared/design.md [DES-SHARED-CHAT-PROTOCOL]
   */
  it("forwards siblingPaths and sectionOffsets through postActiveDocContext", async () => {
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
    inbound.fire({ type: "chat/ready" });
    await flushAsyncWork(2);

    const postMessage = view.webview.postMessage as ReturnType<typeof vi.fn>;
    postMessage.mockClear();

    provider.postActiveDocContext({
      format: "standard",
      section: "DESIGN",
      docKind: "design",
      feature: "auth",
      filePath: "/repo/docs/specs/auth/design.md",
      approvalStatus: "Approved",
      siblingPaths: {
        spec: "/repo/docs/specs/auth/spec.md",
        design: "/repo/docs/specs/auth/design.md",
        tasks: "/repo/docs/specs/auth/tasks.md",
      },
      sectionOffsets: { sessions: 144 },
    });
    await flushAsyncWork(2);

    const forwarded = postMessage.mock.calls
      .map(([m]) => m as { type?: string })
      .find((m) => m.type === "chat/activeDocContext");
    expect(forwarded).toMatchObject({
      type: "chat/activeDocContext",
      docKind: "design",
      siblingPaths: {
        spec: "/repo/docs/specs/auth/spec.md",
        design: "/repo/docs/specs/auth/design.md",
        tasks: "/repo/docs/specs/auth/tasks.md",
      },
      sectionOffsets: { sessions: 144 },
    });
  });

  /**
   * @see docs/specs/211-app-chat-composer/spec.md [FR-4] [FR-8]
   * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-FLOW] [DES-COMPOSER-QUEUE]
   */
  it("serializes queued steer/follow-up injections so rapid steers preserve order", async () => {
    let resolveFirstSteer: (() => void) | undefined;
    agent.steer
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            resolveFirstSteer = resolve;
          }),
      )
      .mockImplementationOnce(async () => {});

    const { inbound } = setupWithView();
    const listener = firstAgentEventListener();
    listener?.({ type: "agent_start" });

    inbound.fire({ type: "chat/steer", requestId: "req-steer-1", content: "first steer" });
    inbound.fire({ type: "chat/steer", requestId: "req-steer-2", content: "second steer" });
    await flushAsyncWork(2);

    expect(agent.steer).toHaveBeenCalledTimes(1);
    expect(agent.steer).toHaveBeenNthCalledWith(1, "first steer");

    resolveFirstSteer?.();
    await flushAsyncWork(2);

    expect(agent.steer).toHaveBeenCalledTimes(2);
    expect(agent.steer).toHaveBeenNthCalledWith(2, "second steer");
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

  it("allows read-only runtime tool events in Explore mode", async () => {
    mockAfxConfiguration({ "mode.active": "explore" });
    const { inbound, postMessage } = setupWithView();
    const listener = firstAgentEventListener();

    inbound.fire({
      type: "chat/send",
      requestId: "req-explore-read",
      content: "Read the package and list docs.",
    });
    await flushAsyncWork(2);

    const tools = [
      {
        toolCallId: "tool-read",
        toolName: "read_file",
        args: { path: "package.json" },
        result: "package.json (24 lines)",
      },
      {
        toolCallId: "tool-list",
        toolName: "mcp__filesystem__list_directory",
        args: { path: "docs" },
        result: "docs/specs",
      },
      {
        toolCallId: "tool-web",
        toolName: "web_fetch",
        args: { url: "https://example.com" },
        result: "Example Domain",
      },
      {
        toolCallId: "tool-bash",
        toolName: "bash",
        args: {
          command:
            'pwd && ls -la apps && rg "createSidebarPanel" apps/vscode/src/panels/sidebar-panel.ts',
        },
        result: "apps/vscode/src/panels/sidebar-panel.ts",
      },
    ];
    for (const tool of tools) {
      listener?.({
        type: "tool_start",
        toolCallId: tool.toolCallId,
        toolName: tool.toolName,
        args: tool.args,
      });
      listener?.({
        type: "tool_end",
        toolCallId: tool.toolCallId,
        ok: true,
        result: { content: [{ type: "text", text: tool.result }] },
      });
    }
    listener?.({ type: "text_delta", id: "assistant-read", delta: "Read-only inspection done." });
    listener?.({ type: "message_end", role: "assistant", stopReason: "end_turn" });
    listener?.({ type: "agent_end" });
    await flushAsyncWork(2);

    expect(agent.abort).not.toHaveBeenCalled();
    for (const tool of tools) {
      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "chat/toolStart",
          toolCallId: tool.toolCallId,
          toolName: tool.toolName,
        }),
      );
      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "chat/toolEnd",
          toolCallId: tool.toolCallId,
          ok: true,
          summary: tool.result,
        }),
      );
    }
  });

  it("blocks mutating runtime tool execution events in Explore mode", async () => {
    mockAfxConfiguration({ "mode.active": "explore" });
    const { inbound, postMessage } = setupWithView();
    const listener = firstAgentEventListener();

    inbound.fire({
      type: "chat/send",
      requestId: "req-explore-tool",
      content: "I'll explore the repository and show files in the current directory.",
    });
    await flushAsyncWork(2);

    listener?.({
      type: "tool_start",
      toolCallId: "tool-explore",
      toolName: "edit_file",
      args: { path: "package.json" },
    });
    listener?.({
      type: "tool_end",
      toolCallId: "tool-explore",
      ok: true,
      result: { content: [{ type: "text", text: "leaked file content" }] },
    });
    listener?.({ type: "text_delta", id: "assistant-after-block", delta: "leaked" });
    listener?.({ type: "agent_end" });
    await flushAsyncWork(2);

    expect(agent.abort).toHaveBeenCalledOnce();
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "chat/error",
        requestId: "req-explore-tool",
        message: expect.stringContaining('blocked runtime tool "edit_file"'),
      }),
    );
    expect(
      postMessage.mock.calls.some(([msg]) => {
        const posted = msg as { type?: string; delta?: string; summary?: string };
        return (
          posted.type === "chat/toolStart" ||
          posted.type === "chat/toolEnd" ||
          posted.delta === "leaked" ||
          posted.summary === "leaked file content"
        );
      }),
    ).toBe(false);
  });

  it("blocks mutating bash runtime commands in Explore mode", async () => {
    mockAfxConfiguration({ "mode.active": "explore" });
    const { inbound, postMessage } = setupWithView();
    const listener = firstAgentEventListener();

    inbound.fire({
      type: "chat/send",
      requestId: "req-explore-bash",
      content: "Run the test suite.",
    });
    await flushAsyncWork(2);

    listener?.({
      type: "tool_start",
      toolCallId: "tool-bash-mutate",
      toolName: "bash",
      args: { command: "pnpm test" },
    });
    listener?.({
      type: "tool_end",
      toolCallId: "tool-bash-mutate",
      ok: true,
      result: { content: [{ type: "text", text: "leaked command output" }] },
    });
    listener?.({ type: "agent_end" });
    await flushAsyncWork(2);

    expect(agent.abort).toHaveBeenCalledOnce();
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "chat/error",
        requestId: "req-explore-bash",
        message: expect.stringContaining('blocked runtime tool "bash"'),
      }),
    );
    expect(
      postMessage.mock.calls.some(([msg]) => {
        const posted = msg as { type?: string; summary?: string };
        return posted.type === "chat/toolStart" || posted.summary === "leaked command output";
      }),
    ).toBe(false);
  });

  it("registers onEvent and onStderr listeners on resolveWebviewView", () => {
    setup();
    expect(agent.onEvent).toHaveBeenCalledOnce();
    expect(agent.onStderr).toHaveBeenCalledOnce();
  });

  describe("runCommand", () => {
    it("allows read-only shell execution in Explore mode", () => {
      mockAfxConfiguration({ "mode.active": "explore" });
      const { inbound, postMessage } = setupWithView();
      vi.spyOn(vscode.workspace, "workspaceFolders", "get").mockReturnValue([
        { uri: { fsPath: "/workspace" } } as vscode.WorkspaceFolder,
      ]);

      const proc = new EventEmitter();
      const stdout = new EventEmitter();
      const stderr = new EventEmitter();
      mockSpawn.mockReturnValue(Object.assign(proc, { stdout, stderr }));

      inbound.fire({ type: "chat/runCommand", requestId: "cmd-explore-ls", command: "ls -alth" });

      expect(mockSpawn).toHaveBeenCalledWith(
        process.platform === "win32" ? "cmd" : "/bin/bash",
        process.platform === "win32" ? ["/c", "ls -alth"] : ["-c", "ls -alth"],
        {
          cwd: "/workspace",
          timeout: 30_000,
        },
      );

      stdout.emit("data", Buffer.from("total 8\n"));
      proc.emit("close", 0, null);

      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "agent/commandOutput",
          requestId: "cmd-explore-ls",
          delta: "total 8\n",
          kind: "stdout",
        }),
      );
      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "agent/commandOutput",
          requestId: "cmd-explore-ls",
          done: true,
          exitCode: 0,
        }),
      );
    });

    it("blocks shell metacharacters in Explore mode before spawning", async () => {
      mockAfxConfiguration({ "mode.active": "explore" });
      const { inbound, postMessage } = setupWithView();

      inbound.fire({
        type: "chat/runCommand",
        requestId: "cmd-explore-meta",
        command: "ls -alth & pnpm test",
      });
      await flushAsyncWork(1);

      expect(mockSpawn).not.toHaveBeenCalled();
      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "agent/actionBlocked",
          requestId: "cmd-explore-meta",
          command: "ls -alth & pnpm test",
        }),
      );
    });

    it("blocks mutating web shell flags in Explore mode before spawning", async () => {
      mockAfxConfiguration({ "mode.active": "explore" });
      const { inbound, postMessage } = setupWithView();

      inbound.fire({
        type: "chat/runCommand",
        requestId: "cmd-explore-curl",
        command: "curl --request=POST https://example.com",
      });
      await flushAsyncWork(1);

      expect(mockSpawn).not.toHaveBeenCalled();
      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "agent/actionBlocked",
          requestId: "cmd-explore-curl",
          command: "curl --request=POST https://example.com",
        }),
      );
    });

    it("blocks mutating shell execution in Explore mode before spawning", async () => {
      mockAfxConfiguration({ "mode.active": "explore" });
      const { inbound, postMessage } = setupWithView();

      inbound.fire({ type: "chat/runCommand", requestId: "cmd-explore", command: "pnpm test" });
      await flushAsyncWork(1);

      expect(mockSpawn).not.toHaveBeenCalled();
      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "agent/actionBlocked",
          requestId: "cmd-explore",
          mode: "explore",
          action: "runCommand",
          title: "Shell command blocked in Explore mode",
          message:
            "Explore mode allows read-only shell commands only. Switch to Code to run mutating commands.",
          command: "pnpm test",
        }),
      );
    });

    it("emits commandOutput with error when no workspace folder is open", () => {
      const { inbound, postMessage } = setupWithView();
      vi.spyOn(vscode.workspace, "workspaceFolders", "get").mockReturnValue(undefined);

      inbound.fire({ type: "chat/runCommand", requestId: "cmd-1", command: "ls" });

      expect(postMessage).toHaveBeenCalledWith({
        type: "agent/commandOutput",
        requestId: "cmd-1",
        error: "No workspace folder open",
      });
    });

    it("streams stdout with kind: stdout", () => {
      const { inbound, postMessage } = setupWithView();
      vi.spyOn(vscode.workspace, "workspaceFolders", "get").mockReturnValue([
        { uri: { fsPath: "/workspace" } } as vscode.WorkspaceFolder,
      ]);

      const proc = new EventEmitter();
      const stdout = new EventEmitter();
      const stderr = new EventEmitter();
      mockSpawn.mockReturnValue(Object.assign(proc, { stdout, stderr }));

      inbound.fire({ type: "chat/runCommand", requestId: "cmd-2", command: "echo hello" });

      stdout.emit("data", Buffer.from("hello\n"));
      proc.emit("close", 0, null);

      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "agent/commandOutput",
          requestId: "cmd-2",
          delta: "hello\n",
          kind: "stdout",
        }),
      );
      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "agent/commandOutput",
          requestId: "cmd-2",
          done: true,
          exitCode: 0,
        }),
      );
    });

    it("streams stderr with kind: stderr", () => {
      const { inbound, postMessage } = setupWithView();
      vi.spyOn(vscode.workspace, "workspaceFolders", "get").mockReturnValue([
        { uri: { fsPath: "/workspace" } } as vscode.WorkspaceFolder,
      ]);

      const proc = new EventEmitter();
      const stdout = new EventEmitter();
      const stderr = new EventEmitter();
      mockSpawn.mockReturnValue(Object.assign(proc, { stdout, stderr }));

      inbound.fire({
        type: "chat/runCommand",
        requestId: "cmd-3",
        command: "node -e 'console.error(\"err\")'",
      });

      stderr.emit("data", Buffer.from("err\n"));
      proc.emit("close", 0, null);

      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "agent/commandOutput",
          requestId: "cmd-3",
          delta: "err\n",
          kind: "stderr",
        }),
      );
    });

    it("emits non-zero exit code", () => {
      const { inbound, postMessage } = setupWithView();
      vi.spyOn(vscode.workspace, "workspaceFolders", "get").mockReturnValue([
        { uri: { fsPath: "/workspace" } } as vscode.WorkspaceFolder,
      ]);

      const proc = new EventEmitter();
      const stdout = new EventEmitter();
      const stderr = new EventEmitter();
      mockSpawn.mockReturnValue(Object.assign(proc, { stdout, stderr }));

      inbound.fire({ type: "chat/runCommand", requestId: "cmd-4", command: "exit 1" });
      proc.emit("close", 1, null);

      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "agent/commandOutput",
          requestId: "cmd-4",
          done: true,
          exitCode: 1,
        }),
      );
    });

    it("emits error on spawn failure", () => {
      const { inbound, postMessage } = setupWithView();
      vi.spyOn(vscode.workspace, "workspaceFolders", "get").mockReturnValue([
        { uri: { fsPath: "/workspace" } } as vscode.WorkspaceFolder,
      ]);

      const proc = new EventEmitter();
      const stdout = new EventEmitter();
      const stderr = new EventEmitter();
      mockSpawn.mockReturnValue(Object.assign(proc, { stdout, stderr }));

      inbound.fire({ type: "chat/runCommand", requestId: "cmd-5", command: "unknown-cmd" });
      proc.emit("error", new Error("ENOENT: unknown-cmd"));

      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "agent/commandOutput",
          requestId: "cmd-5",
          error: "ENOENT: unknown-cmd",
        }),
      );
    });

    it("emits timeout error on SIGTERM", () => {
      const { inbound, postMessage } = setupWithView();
      vi.spyOn(vscode.workspace, "workspaceFolders", "get").mockReturnValue([
        { uri: { fsPath: "/workspace" } } as vscode.WorkspaceFolder,
      ]);

      const proc = new EventEmitter();
      const stdout = new EventEmitter();
      const stderr = new EventEmitter();
      mockSpawn.mockReturnValue(Object.assign(proc, { stdout, stderr }));

      inbound.fire({ type: "chat/runCommand", requestId: "cmd-6", command: "sleep 60" });
      proc.emit("close", null, "SIGTERM");

      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "agent/commandOutput",
          requestId: "cmd-6",
          done: true,
          exitCode: -1,
          error: "Command timed out after 30s",
        }),
      );
    });
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
