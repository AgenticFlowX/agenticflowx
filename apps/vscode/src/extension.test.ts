/**
 * Extension activation contract.
 *
 * Verifies: activate() registers both webview view providers, contributed
 * commands, the status bar item, and the output channel — and adds them to
 * context.subscriptions so deactivate releases everything.
 *
 * @see docs/specs/200-app-vscode/spec.md [FR-1] [FR-4] [FR-6]
 * @see docs/specs/200-app-vscode/design.md [DES-TEST]
 */
import { type MockInstance, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as vscode from "vscode";

import { type MockAgentManager, createMockAgentManager } from "./__fixtures__/mock-agent-manager";

vi.mock("./agent-factory", () => ({
  createConfiguredAgentInstances: vi.fn(),
}));

vi.mock("./panels/sidebar-panel", () => ({
  SIDEBAR_VIEW_TYPE: "afx-sidebar",
  createSidebarPanel: vi.fn(() => ({
    resolveWebviewView: vi.fn(),
    refreshRuntimeConfiguration: vi.fn(),
    sendExternalPrompt: vi.fn(),
    appendToDraft: vi.fn(),
  })),
}));

vi.mock("./panels/workbench-panel", () => ({
  WORKBENCH_VIEW_TYPE: "afx-workbench",
  createWorkbenchPanel: vi.fn(() => ({ resolveWebviewView: vi.fn() })),
}));

let agentManager: MockAgentManager;
let agentInstance: { id: string; label: string; runtime: string; manager: MockAgentManager };
let createConfiguredAgentInstances: ReturnType<typeof vi.fn>;

interface MockExtensionContext extends vscode.ExtensionContext {
  fireSecretChange(key: string): void;
}

function makeContext(): MockExtensionContext {
  const secretEmitter = new vscode.EventEmitter<vscode.SecretStorageChangeEvent>();
  return {
    subscriptions: [] as vscode.Disposable[],
    extensionUri: vscode.Uri.file("/tmp/agenticflowx"),
    globalStorageUri: vscode.Uri.file("/tmp/agenticflowx-global"),
    extensionMode: vscode.ExtensionMode.Test,
    extension: { packageJSON: { version: "2.0.0-test" } },
    secrets: {
      get: vi.fn(async () => undefined),
      store: vi.fn(async () => {}),
      delete: vi.fn(async () => {}),
      onDidChange: secretEmitter.event,
    },
    fireSecretChange(key: string) {
      secretEmitter.fire({ key });
    },
  } as unknown as MockExtensionContext;
}

describe("extension.activate", () => {
  // Spy types use the permissive `MockInstance` because vi.spyOn returns a generic whose precise
  // shape depends on the overloaded API being spied on, AND the mocked vscode module
  // (`apps/vscode/__mocks__/vscode.ts`) exposes a constrained type that doesn't structurally match
  // the real vscode API's spyOn signature. The mock interactions tested here (toHaveBeenCalledWith /
  // mock.calls) are runtime, so widening the declared type is safe.
  let registerCommand: MockInstance;
  let registerWebview: MockInstance;
  let createStatus: MockInstance;
  let createOutput: MockInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    agentManager = createMockAgentManager();
    agentInstance = { id: "pi", label: "Pi", runtime: "pi", manager: agentManager };
    const factoryMod = await import("./agent-factory");
    createConfiguredAgentInstances = vi.mocked(factoryMod.createConfiguredAgentInstances);
    createConfiguredAgentInstances.mockResolvedValue([agentInstance]);
    registerCommand = vi.spyOn(vscode.commands, "registerCommand");
    registerWebview = vi.spyOn(vscode.window, "registerWebviewViewProvider");
    createStatus = vi.spyOn(vscode.window, "createStatusBarItem");
    createOutput = vi.spyOn(vscode.window, "createOutputChannel");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("registers both webview view providers", async () => {
    const { activate } = await import("./extension");
    const ctx = makeContext();
    await activate(ctx);

    const ids = registerWebview.mock.calls.map((c) => c[0]);
    expect(ids).toContain("afx-sidebar");
    expect(ids).toContain("afx-workbench");
  });

  it("registers contributed commands", async () => {
    const { activate } = await import("./extension");
    const ctx = makeContext();
    await activate(ctx);

    const cmds = registerCommand.mock.calls.map((c) => c[0]);
    expect(cmds).toEqual(
      expect.arrayContaining([
        "afx.openSidebar",
        "afx.openWorkbench",
        "afx.showLogs",
        "afx.agentSmokeTest",
        "afx.agentRestart",
        "afx.setProviderApiKey",
        "afx.clearProviderApiKey",
        "afx.detectPiBinary",
      ]),
    );
  });

  it("awaits runtime reconfiguration after saving a provider key", async () => {
    const { activate } = await import("./extension");
    const ctx = makeContext();
    await activate(ctx);

    const handler = registerCommand.mock.calls.find(
      ([command]) => command === "afx.setProviderApiKey",
    )?.[1] as ((provider?: string, key?: string) => Promise<void>) | undefined;
    expect(handler).toBeTypeOf("function");

    await handler?.("MiniMax", " secret ");

    expect(ctx.secrets.store).toHaveBeenCalledWith("afx.apiKey.minimax", "secret");
    expect(createConfiguredAgentInstances).toHaveBeenCalledTimes(2);
  });

  it("does not double-rebuild when the keychain echoes a command-owned provider key change", async () => {
    const { activate } = await import("./extension");
    const ctx = makeContext();
    await activate(ctx);

    const handler = registerCommand.mock.calls.find(
      ([command]) => command === "afx.setProviderApiKey",
    )?.[1] as ((provider?: string, key?: string) => Promise<void>) | undefined;
    expect(handler).toBeTypeOf("function");

    await handler?.("OpenAI", "sk-test");
    ctx.fireSecretChange("afx.apiKey.openai");
    await new Promise((resolve) => setImmediate(resolve));

    expect(createConfiguredAgentInstances).toHaveBeenCalledTimes(2);
  });

  it("rebuilds runtimes when provider credentials change outside the save command", async () => {
    const { activate } = await import("./extension");
    const ctx = makeContext();
    await activate(ctx);

    ctx.fireSecretChange("afx.apiKey.openai");
    await new Promise((resolve) => setImmediate(resolve));

    expect(createConfiguredAgentInstances).toHaveBeenCalledTimes(2);
  });

  it("does not rebuild runtimes when only the remembered SDK default model changes", async () => {
    let configListener:
      | ((event: { affectsConfiguration: (key: string) => boolean }) => void)
      | undefined;
    vi.spyOn(vscode.workspace, "onDidChangeConfiguration").mockImplementation((listener) => {
      configListener = listener as typeof configListener;
      return { dispose: vi.fn() };
    });

    const { activate } = await import("./extension");
    const ctx = makeContext();
    await activate(ctx);

    configListener?.({
      affectsConfiguration: (key: string) => key === "afx.sdk.defaultModel",
    });
    await Promise.resolve();

    expect(createConfiguredAgentInstances).toHaveBeenCalledTimes(1);
  });

  it("rebuilds runtimes when Pi RPC is toggled", async () => {
    let configListener:
      | ((event: { affectsConfiguration: (key: string) => boolean }) => void)
      | undefined;
    vi.spyOn(vscode.workspace, "onDidChangeConfiguration").mockImplementation((listener) => {
      configListener = listener as typeof configListener;
      return { dispose: vi.fn() };
    });

    const { activate } = await import("./extension");
    const ctx = makeContext();
    await activate(ctx);

    configListener?.({
      affectsConfiguration: (key: string) => key === "afx.rpc.enabled",
    });
    await new Promise((resolve) => setImmediate(resolve));

    expect(createConfiguredAgentInstances).toHaveBeenCalledTimes(2);
    const sidebarProvider = registerWebview.mock.calls.find(([id]) => id === "afx-sidebar")?.[1] as
      | { refreshRuntimeConfiguration?: ReturnType<typeof vi.fn> }
      | undefined;
    expect(sidebarProvider?.refreshRuntimeConfiguration).toHaveBeenCalledOnce();
  });

  it("creates configured agent instances from VSCode settings", async () => {
    vi.spyOn(vscode.workspace, "getConfiguration").mockReturnValue({
      get: vi.fn(<T>(key: string, defaultValue?: T): T | undefined => {
        if (key === "agentBinaryPath") return " /usr/local/bin/pi " as T;
        if (key === "agentEphemeralSession") return false as T;
        return defaultValue;
      }),
      has: () => false,
      inspect: () => undefined,
      update: async () => {},
    });
    Object.defineProperty(vscode.workspace, "workspaceFolders", {
      configurable: true,
      get: () => [{ uri: vscode.Uri.file("/tmp/workspace"), name: "workspace", index: 0 }],
    });

    const { activate } = await import("./extension");
    const ctx = makeContext();
    await activate(ctx);

    expect(createConfiguredAgentInstances).toHaveBeenCalledWith(
      expect.objectContaining({
        binaryPath: undefined,
        piAvailable: false,
        rpcEnabled: false,
        ephemeral: false,
        sessionDir: "/tmp/agenticflowx-global/sessions",
        cwd: "/tmp/workspace",
      }),
    );
  });

  it("creates an output channel and status bar item", async () => {
    const { activate } = await import("./extension");
    const ctx = makeContext();
    await activate(ctx);

    expect(createOutput).toHaveBeenCalledWith("AgenticFlowX");
    expect(createStatus).toHaveBeenCalled();
  });

  it("pushes disposables onto context.subscriptions", async () => {
    const { activate } = await import("./extension");
    const ctx = makeContext();
    await activate(ctx);

    // 1 channel + 1 onDidChangeConfig + 1 specsData + 1 runtimeMonitor + 1 status
    // + 2 webview providers + 5 commands + 5 trace providers + 5 action providers/cmds = 22
    expect(ctx.subscriptions.length).toBeGreaterThan(15);
  });

  it("deactivate resolves without throwing when not activated", async () => {
    const { deactivate } = await import("./extension");
    await expect(deactivate()).resolves.toBeUndefined();
  });

  it("deactivate disposes configured agent instances", async () => {
    const { activate, deactivate } = await import("./extension");
    const ctx = makeContext();
    await activate(ctx);

    await deactivate();

    expect(agentManager.dispose).toHaveBeenCalled();
  });

  it("reports smoke test failure when the agent is not running", async () => {
    agentManager.getStatus.mockResolvedValueOnce({
      running: false,
      isStreaming: false,
    });
    const showError = vi.spyOn(vscode.window, "showErrorMessage");
    const { activate } = await import("./extension");
    const ctx = makeContext();
    await activate(ctx);

    const smoke = registerCommand.mock.calls.find((c) => c[0] === "afx.agentSmokeTest")?.[1];
    expect(smoke).toBeTypeOf("function");
    await (smoke as () => Promise<void>)();

    expect(showError).toHaveBeenCalledWith(
      expect.stringContaining("AgenticFlowX: agent smoke-test failed"),
    );
  });
});
