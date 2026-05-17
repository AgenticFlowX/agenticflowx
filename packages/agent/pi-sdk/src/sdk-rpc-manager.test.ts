import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Logger } from "@afx/shared";

import {
  buildBootstrapEnv,
  createPiSdkAgentManager,
  rewriteAfxCommandPrompt,
} from "./sdk-rpc-manager";

const mocks = vi.hoisted(() => {
  const clients: FakeClient[] = [];
  const createPiClient = vi.fn((options: unknown) => {
    const client = createFakeClient(options);
    clients.push(client);
    return client;
  });
  return { clients, createPiClient };
});

vi.mock("@afx/agent-pi", () => ({
  createPiClient: mocks.createPiClient,
}));

interface FakeClient {
  isRunning: boolean;
  options: unknown;
  requests: unknown[];
  sent: unknown[];
  eventListener?: (event: Record<string, unknown>) => void;
  start: () => Promise<void>;
  dispose: () => Promise<void>;
  request: <T>(cmd: unknown) => Promise<T>;
  send: (msg: unknown) => void;
  onEvent: (listener: (event: Record<string, unknown>) => void) => () => void;
  onExit: () => () => void;
  onStderr: () => () => void;
  getStderr: () => string;
}

function createFakeClient(options: unknown): FakeClient {
  return {
    isRunning: false,
    options,
    requests: [],
    sent: [],
    start: async function start(this: FakeClient) {
      this.isRunning = true;
    },
    dispose: async function dispose(this: FakeClient) {
      this.isRunning = false;
    },
    request: async function request<T>(this: FakeClient, cmd: unknown): Promise<T> {
      this.requests.push(cmd);
      const type = (cmd as { type?: string }).type;
      if (type === "get_available_models") {
        return {
          models: [
            { provider: "anthropic", id: "claude-opus-4-5", name: "Opus", reasoning: true },
            { provider: "openai", id: "gpt-5.2", name: "GPT", reasoning: true },
          ],
        } as T;
      }
      if (type === "get_state") {
        return {
          model: { provider: "anthropic", id: "claude-opus-4-5", name: "Opus" },
          sessionFile: "/tmp/session.jsonl",
        } as T;
      }
      if (type === "set_model") {
        const target = cmd as { provider: string; modelId: string };
        return { provider: target.provider, id: target.modelId, name: target.modelId } as T;
      }
      return null as T;
    },
    send: function send(this: FakeClient, msg: unknown) {
      this.sent.push(msg);
    },
    onEvent: function onEvent(
      this: FakeClient,
      listener: (event: Record<string, unknown>) => void,
    ) {
      this.eventListener = listener;
      return () => undefined;
    },
    onExit: () => () => undefined,
    onStderr: () => () => undefined,
    getStderr: () => "",
  };
}

const logger: Logger = {
  level: "debug",
  setLevel: vi.fn(),
  child: () => logger,
  trace: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

describe("createPiSdkAgentManager", () => {
  beforeEach(() => {
    mocks.clients.length = 0;
    mocks.createPiClient.mockClear();
    vi.mocked(logger.info).mockClear();
    vi.mocked(logger.warn).mockClear();
    vi.mocked(logger.error).mockClear();
    mocks.createPiClient.mockImplementation((options: unknown) => {
      const client = createFakeClient(options);
      mocks.clients.push(client);
      return client;
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("wires bootstrap path, session args, and provider env into Pi RPC client", async () => {
    const manager = createPiSdkAgentManager({
      logger,
      bootstrapPath: "/extension/dist/bootstrap.js",
      provider: "anthropic",
      modelId: "claude-opus-4-5",
      sessionDir: "/sessions",
      getApiKey: () => "secret-key",
    });

    await manager.send("/afx-next");

    expect(mocks.createPiClient).toHaveBeenCalledOnce();
    expect(mocks.clients[0]!.options).toMatchObject({
      binaryPath: process.execPath,
      commandPrefixArgs: ["/extension/dist/bootstrap.js"],
      args: ["--session-dir", "/sessions"],
      env: {
        AFX_PROVIDER: "anthropic",
        AFX_MODEL_ID: "claude-opus-4-5",
        AFX_API_KEY_ANTHROPIC: "secret-key",
        PI_PACKAGE_DIR: "/extension/dist",
        AFX_SESSION_DIR: "/sessions",
        PI_CODING_AGENT_DIR: "/sessions",
      },
    });
    expect(mocks.clients[0]!.requests[0]).toEqual({
      type: "prompt",
      message: "/skill:afx-next",
    });
  });

  it("passes host overlay system prompt paths to the Pi SDK RPC client without extension loading", async () => {
    const manager = createPiSdkAgentManager({
      logger,
      bootstrapPath: "/extension/dist/bootstrap.js",
      provider: "anthropic",
      modelId: "claude-opus-4-5",
      sessionDir: "/sessions",
      getApiKey: () => "secret-key",
      additionalSkillPaths: ["/extension/resources/skills/agenticflowx"],
      defaultConfigPath: "/extension/resources/defaults/.afx.yaml",
      additionalSystemPromptPaths: [
        "/extension/resources/harness-overlays/common/agenticflowx-vscode.md",
      ],
    });

    await manager.getStatus();

    expect(mocks.clients[0]!.options).toMatchObject({
      args: [
        "--session-dir",
        "/sessions",
        "--skill",
        "/extension/resources/skills/agenticflowx",
        "--append-system-prompt",
        "/extension/resources/defaults/.afx.yaml",
        "--append-system-prompt",
        "/extension/resources/harness-overlays/common/agenticflowx-vscode.md",
      ],
    });
  });

  it("logs sanitized SDK RPC calls and responses to the host logger", async () => {
    const manager = createPiSdkAgentManager({
      logger,
      bootstrapPath: "/extension/dist/bootstrap.js",
      provider: "openai",
      modelId: "gpt-5.4",
      getApiKey: () => "secret-key",
    });

    await manager.getAvailableModels();
    await manager.send("hello from sdk");

    expect(logger.info).toHaveBeenCalledWith(
      "rpc call",
      expect.objectContaining({ command: "get_available_models" }),
    );
    expect(logger.info).toHaveBeenCalledWith(
      "rpc response",
      expect.objectContaining({
        command: "get_available_models",
        modelsCount: 2,
      }),
    );
    expect(logger.info).toHaveBeenCalledWith(
      "rpc call",
      expect.objectContaining({
        command: "prompt",
        messageLength: "hello from sdk".length,
        messagePreview: "hello from sdk",
      }),
    );
    expect(logger.info).toHaveBeenCalledWith(
      "rpc response",
      expect.objectContaining({ command: "prompt", responseKind: "null" }),
    );
    expect(JSON.stringify(vi.mocked(logger.info).mock.calls)).not.toContain("secret-key");
  });

  it("logs raw and normalized SDK events with bounded response previews", async () => {
    const manager = createPiSdkAgentManager({
      logger,
      bootstrapPath: "/extension/dist/bootstrap.js",
      provider: "openai",
      modelId: "gpt-5.4",
      getApiKey: () => "secret-key",
    });
    const events: unknown[] = [];
    manager.onEvent((event) => events.push(event));
    await manager.getStatus();

    mocks.clients[0]!.eventListener?.({
      type: "message_update",
      assistantMessageEvent: {
        type: "text_delta",
        delta: "hello from the assistant",
      },
    });

    expect(events).toEqual([
      expect.objectContaining({
        type: "text_delta",
        delta: "hello from the assistant",
      }),
    ]);
    expect(logger.info).toHaveBeenCalledWith(
      "rpc event",
      expect.objectContaining({
        rawType: "message_update",
        normalizedType: "text_delta",
        assistantEventType: "text_delta",
        deltaLength: "hello from the assistant".length,
        deltaPreview: "hello from the assistant",
      }),
    );
    expect(JSON.stringify(vi.mocked(logger.info).mock.calls)).not.toContain("secret-key");
  });

  it("normalizes assistant message_end provider failures into chat-visible errors", async () => {
    const manager = createPiSdkAgentManager({
      logger,
      bootstrapPath: "/extension/dist/bootstrap.js",
      provider: "openai",
      modelId: "gpt-5.3-codex",
      getApiKey: () => "secret-key",
    });
    const events: unknown[] = [];
    manager.onEvent((event) => events.push(event));
    await manager.getStatus();

    mocks.clients[0]!.eventListener?.({
      type: "message_start",
      message: {
        role: "assistant",
        stopReason: "stop",
      },
    });
    mocks.clients[0]!.eventListener?.({
      type: "message_end",
      message: {
        role: "assistant",
        stopReason: "error",
        errorMessage: "You exceeded your current quota.",
      },
    });
    mocks.clients[0]!.eventListener?.({
      type: "turn_end",
      message: {
        role: "assistant",
        stopReason: "error",
        errorMessage: "You exceeded your current quota.",
      },
    });
    mocks.clients[0]!.eventListener?.({ type: "agent_end" });

    expect(events).toEqual([
      {
        type: "error",
        message: "You exceeded your current quota.",
      },
      { type: "agent_end" },
    ]);
    expect(logger.info).toHaveBeenCalledWith(
      "rpc event",
      expect.objectContaining({
        rawType: "message_start",
        normalizedType: "ignored",
        role: "assistant",
        stopReason: "stop",
      }),
    );
    expect(logger.info).toHaveBeenCalledWith(
      "rpc event",
      expect.objectContaining({
        rawType: "message_end",
        normalizedType: "error",
        role: "assistant",
        stopReason: "error",
        errorMessage: "You exceeded your current quota.",
        error: "You exceeded your current quota.",
      }),
    );
    expect(logger.info).toHaveBeenCalledWith(
      "rpc event",
      expect.objectContaining({
        rawType: "turn_end",
        normalizedType: "ignored",
        role: "assistant",
        stopReason: "error",
        errorMessage: "You exceeded your current quota.",
      }),
    );
  });

  it("normalizes SDK context overflow as recoverable compaction events", async () => {
    const manager = createPiSdkAgentManager({
      logger,
      bootstrapPath: "/extension/dist/bootstrap.js",
      provider: "openai",
      modelId: "gpt-5.3-codex",
      getApiKey: () => "secret-key",
    });
    const events: unknown[] = [];
    manager.onEvent((event) => events.push(event));
    await manager.getStatus();

    mocks.clients[0]!.eventListener?.({
      type: "message_end",
      message: {
        role: "assistant",
        stopReason: "error",
        errorMessage:
          "Your input exceeds the context window of this model. Please adjust your input and try again.",
      },
    });
    mocks.clients[0]!.eventListener?.({ type: "compaction_start", reason: "overflow" });
    mocks.clients[0]!.eventListener?.({
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

    expect(events).toEqual([
      {
        type: "context_overflow",
        message:
          "Your input exceeds the context window of this model. Please adjust your input and try again.",
      },
      { type: "compaction_start", reason: "overflow" },
      {
        type: "compaction_end",
        reason: "overflow",
        result: {
          summary: "Kept the important AFX session details.",
          firstKeptEntryId: "entry-2",
          tokensBefore: 250_000,
        },
        aborted: false,
        willRetry: true,
        errorMessage: undefined,
      },
    ]);
    expect(logger.info).toHaveBeenCalledWith(
      "rpc event",
      expect.objectContaining({
        rawType: "message_end",
        normalizedType: "context_overflow",
        error: expect.stringContaining("context window"),
      }),
    );
    expect(logger.info).toHaveBeenCalledWith(
      "rpc event",
      expect.objectContaining({
        rawType: "compaction_end",
        normalizedType: "compaction_end",
        reason: "overflow",
        willRetry: true,
        tokensBefore: 250_000,
      }),
    );
  });

  it("normalizes SDK auto-retry events for transient provider failures", async () => {
    const manager = createPiSdkAgentManager({
      logger,
      bootstrapPath: "/extension/dist/bootstrap.js",
      provider: "openai",
      modelId: "gpt-5.3-codex",
      getApiKey: () => "secret-key",
    });
    const events: unknown[] = [];
    manager.onEvent((event) => events.push(event));
    await manager.getStatus();

    mocks.clients[0]!.eventListener?.({
      type: "message_end",
      message: {
        role: "assistant",
        stopReason: "error",
        errorMessage: "overloaded_error: upstream service unavailable",
      },
    });
    mocks.clients[0]!.eventListener?.({
      type: "auto_retry_start",
      attempt: 1,
      maxAttempts: 3,
      delayMs: 1_000,
      errorMessage: "overloaded_error: upstream service unavailable",
    });
    mocks.clients[0]!.eventListener?.({ type: "auto_retry_end", success: true, attempt: 1 });

    expect(events).toEqual([
      {
        type: "retryable_error",
        message: "overloaded_error: upstream service unavailable",
      },
      {
        type: "auto_retry_start",
        attempt: 1,
        maxAttempts: 3,
        delayMs: 1_000,
        errorMessage: "overloaded_error: upstream service unavailable",
      },
      {
        type: "auto_retry_end",
        success: true,
        attempt: 1,
        finalError: undefined,
      },
    ]);
    expect(logger.info).toHaveBeenCalledWith(
      "rpc event",
      expect.objectContaining({
        rawType: "auto_retry_start",
        normalizedType: "auto_retry_start",
        attempt: 1,
        maxAttempts: 3,
        delayMs: 1_000,
      }),
    );
  });

  it("tags and filters models to configured API providers", async () => {
    const manager = createPiSdkAgentManager({
      logger,
      bootstrapPath: "/bootstrap.js",
      provider: "anthropic",
      modelId: "claude-opus-4-5",
      apiProviders: ["anthropic", "openai"],
      getApiKey: () => undefined,
    });

    await expect(manager.getAvailableModels()).resolves.toEqual([
      expect.objectContaining({
        provider: "anthropic",
        id: "claude-opus-4-5",
        source: "api-provider",
        instanceLabel: "anthropic",
      }),
      expect.objectContaining({
        provider: "openai",
        id: "gpt-5.2",
        source: "api-provider",
        instanceLabel: "anthropic",
      }),
    ]);
  });

  it("keeps configured provider models visible when discovery fails", async () => {
    mocks.createPiClient.mockImplementation((options: unknown) => {
      const client = createFakeClient(options);
      client.request = async function request<T>(this: FakeClient, cmd: unknown): Promise<T> {
        this.requests.push(cmd);
        if ((cmd as { type?: string }).type === "get_available_models") {
          throw new Error("invalid api key");
        }
        return null as T;
      };
      mocks.clients.push(client);
      return client;
    });
    const manager = createPiSdkAgentManager({
      logger,
      bootstrapPath: "/bootstrap.js",
      provider: "anthropic",
      modelId: "claude-opus-4-5",
      apiProviders: ["anthropic"],
      getApiKey: () => "not-a-real-key",
    });

    await expect(manager.getAvailableModels()).resolves.toEqual([
      expect.objectContaining({
        provider: "anthropic",
        id: "claude-opus-4-5",
        source: "api-provider",
      }),
    ]);
  });

  it("forwards switchSession through the Pi RPC protocol", async () => {
    const manager = createPiSdkAgentManager({
      logger,
      bootstrapPath: "/bootstrap.js",
      provider: "anthropic",
      modelId: "claude-opus-4-5",
      getApiKey: () => undefined,
    });

    await expect(manager.switchSession?.("/sessions/a.jsonl")).resolves.toEqual({
      cancelled: false,
    });
    expect(mocks.clients[0]!.requests.at(-1)).toEqual({
      type: "switch_session",
      sessionPath: "/sessions/a.jsonl",
    });
  });

  it("allows setModel routing across configured API providers", async () => {
    const manager = createPiSdkAgentManager({
      logger,
      bootstrapPath: "/bootstrap.js",
      provider: "anthropic",
      modelId: "claude-opus-4-5",
      apiProviders: ["anthropic", "openai"],
      getApiKey: () => undefined,
    });

    await expect(manager.setModel({ provider: "openai", modelId: "gpt-5.2" })).resolves.toEqual(
      expect.objectContaining({ provider: "openai", id: "gpt-5.2" }),
    );
  });

  it("preserves reasoning support in runtime status", async () => {
    mocks.createPiClient.mockImplementation((options: unknown) => {
      const client = createFakeClient(options);
      client.request = async function request<T>(this: FakeClient, cmd: unknown): Promise<T> {
        this.requests.push(cmd);
        if ((cmd as { type?: string }).type === "get_state") {
          return {
            model: {
              provider: "anthropic",
              id: "claude-opus-4-7",
              name: "Claude Opus 4.7",
              reasoning: true,
            },
          } as T;
        }
        return null as T;
      };
      mocks.clients.push(client);
      return client;
    });
    const manager = createPiSdkAgentManager({
      logger,
      bootstrapPath: "/bootstrap.js",
      provider: "anthropic",
      modelId: "claude-opus-4-7",
      getApiKey: () => "anthropic-key",
    });

    await expect(manager.getStatus()).resolves.toMatchObject({
      running: true,
      model: {
        provider: "anthropic",
        id: "claude-opus-4-7",
        reasoning: true,
      },
    });
  });

  it("starts on the selected provider when setModel is the first SDK action", async () => {
    const manager = createPiSdkAgentManager({
      logger,
      bootstrapPath: "/bootstrap.js",
      provider: "anthropic",
      modelId: "claude-opus-4-5",
      apiProviders: ["anthropic", "cerebras"],
      getApiKey: (provider) => (provider === "cerebras" ? "cerebras-key" : undefined),
    });

    await manager.setModel({ provider: "cerebras", modelId: "llama-4-scout" });

    expect(mocks.clients[0]!.options).toMatchObject({
      env: {
        AFX_PROVIDER: "cerebras",
        AFX_MODEL_ID: "llama-4-scout",
        AFX_API_KEY_CEREBRAS: "cerebras-key",
        CEREBRAS_API_KEY: "cerebras-key",
      },
    });
    expect(mocks.clients[0]!.requests[0]).toEqual({
      type: "set_model",
      provider: "cerebras",
      modelId: "llama-4-scout",
    });
  });

  it("stops automatic bootstrap retries after three failed starts until manual restart", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    mocks.createPiClient.mockImplementation((options: unknown) => {
      const client = createFakeClient(options);
      client.start = async () => {
        throw new Error("spawn EPERM");
      };
      mocks.clients.push(client);
      return client;
    });
    const manager = createPiSdkAgentManager({
      logger,
      bootstrapPath: "/bootstrap.js",
      provider: "anthropic",
      modelId: "claude-opus-4-5",
      getApiKey: () => undefined,
    });

    await expect(manager.getStatus()).resolves.toMatchObject({
      running: false,
      restartRequired: false,
    });
    vi.setSystemTime(10_001);
    await expect(manager.getStatus()).resolves.toMatchObject({
      running: false,
      restartRequired: false,
    });
    vi.setSystemTime(20_002);
    await expect(manager.getStatus()).resolves.toMatchObject({
      running: false,
      restartRequired: true,
      info: expect.stringMatching(/automatic retries are stopped/i),
    });
    vi.setSystemTime(30_003);
    await expect(manager.getStatus()).resolves.toMatchObject({
      running: false,
      restartRequired: true,
    });

    expect(mocks.createPiClient).toHaveBeenCalledTimes(3);
    mocks.createPiClient.mockImplementation((options: unknown) => {
      const client = createFakeClient(options);
      mocks.clients.push(client);
      return client;
    });
    await manager.stop();
    const recovered = await manager.getStatus();
    expect(recovered.running).toBe(true);
    expect(recovered.restartRequired).toBeUndefined();
    expect(mocks.createPiClient).toHaveBeenCalledTimes(4);
  });
});

describe("buildBootstrapEnv", () => {
  it("normalizes provider-specific API key env names", () => {
    expect(
      buildBootstrapEnv({
        provider: "open-router",
        modelId: "model",
        apiKeys: { "open-router": "key" },
        packageDir: "/extension/resources/pi-sdk",
        ollamaBaseUrl: "http://127.0.0.1:11434",
      }),
    ).toMatchObject({
      AFX_PROVIDER: "open-router",
      AFX_MODEL_ID: "model",
      PI_PACKAGE_DIR: "/extension/resources/pi-sdk",
      AFX_API_KEY_OPEN_ROUTER: "key",
      OPEN_ROUTER_API_KEY: "key",
      AFX_OLLAMA_BASE_URL: "http://127.0.0.1:11434",
    });
    expect(
      buildBootstrapEnv({
        provider: "minimax",
        modelId: "minimax-m2",
        apiKeys: { minimax: "minimax-key", "kimi-coding": "kimi-key" },
      }),
    ).toMatchObject({
      AFX_API_KEY_MINIMAX: "minimax-key",
      MINIMAX_API_KEY: "minimax-key",
      AFX_API_KEY_KIMI_CODING: "kimi-key",
      KIMI_API_KEY: "kimi-key",
    });
  });
});

describe("rewriteAfxCommandPrompt", () => {
  it("rewrites only leading AFX commands", () => {
    expect(rewriteAfxCommandPrompt(" /afx-next")).toBe(" /skill:afx-next");
    expect(rewriteAfxCommandPrompt("please run /afx-next")).toBe("please run /afx-next");
  });
});
