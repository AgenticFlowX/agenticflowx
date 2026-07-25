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
  const assertSessionPathAllowed = vi.fn(async () => undefined);
  const piSessionRoots = vi.fn((sessionDir?: string, agentDir?: string) =>
    [
      sessionDir,
      agentDir ? `${agentDir}/sessions` : undefined,
      "/home/test/.pi/agent/sessions",
    ].filter((root): root is string => typeof root === "string"),
  );
  return { clients, createPiClient, assertSessionPathAllowed, piSessionRoots };
});

vi.mock("@afx/agent-pi", () => ({
  assertSessionPathAllowed: mocks.assertSessionPathAllowed,
  createPiClient: mocks.createPiClient,
  normalizePiToolArgs: (raw: { args?: unknown }) => raw.args,
  piSessionRoots: mocks.piSessionRoots,
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
            {
              provider: "anthropic",
              id: "claude-opus-4-5",
              name: "Opus",
              reasoning: true,
              input: ["text", "image"],
            },
            { provider: "openai", id: "gpt-5.2", name: "GPT", reasoning: true, input: ["text"] },
          ],
        } as T;
      }
      if (type === "get_available_thinking_levels") {
        return { levels: ["off", "medium", "max"] } as T;
      }
      if (type === "get_state") {
        return {
          model: {
            provider: "anthropic",
            id: "claude-opus-4-5",
            name: "Opus",
            input: ["text", "image"],
          },
          sessionFile: "/tmp/session.jsonl",
        } as T;
      }
      if (type === "get_commands") {
        return {
          commands: [
            {
              name: "skill:custom-docs",
              description: "Custom docs workflow",
              source: "skill",
              sourceInfo: {
                path: "/workspace/custom-skills/custom-docs/SKILL.md",
                source: "path",
                scope: "temporary",
                origin: "top-level",
                baseDir: "/workspace/custom-skills",
              },
            },
            {
              name: "skill:afx-qa-methodology",
              description: "External QA workflow",
              source: "skill",
              sourceInfo: {
                path: "/external/qa/afx-qa-methodology/SKILL.md",
                source: "path",
                scope: "temporary",
                origin: "top-level",
                baseDir: "/external/qa",
              },
            },
            {
              name: "skill:afx-clean-code",
              description: "External development workflow",
              source: "skill",
              sourceInfo: {
                path: "/external/dev/afx-clean-code/SKILL.md",
                source: "path",
                scope: "temporary",
                origin: "top-level",
                baseDir: "/external/dev",
              },
            },
            {
              name: "skill:afx-security-audit",
              description: "External security workflow",
              source: "skill",
              sourceInfo: {
                path: "/external/security/afx-security-audit/SKILL.md",
                source: "path",
                scope: "temporary",
                origin: "top-level",
                baseDir: "/external/security",
              },
            },
          ],
        } as T;
      }
      if (type === "compact") {
        return {
          summary: "Compacted previous context.",
          firstKeptEntryId: "entry-kept",
          tokensBefore: 88_000,
          estimatedTokensAfter: 2_400,
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
    mocks.assertSessionPathAllowed.mockClear();
    mocks.piSessionRoots.mockClear();
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

  it("marks subscription credentials in bootstrap env so tokens stay off CLI args", async () => {
    const manager = createPiSdkAgentManager({
      logger,
      bootstrapPath: "/extension/dist/bootstrap.js",
      provider: "openai-codex",
      modelId: "gpt-5.4",
      apiProviders: ["openai-codex"],
      getApiKey: () => "oauth-access-token",
      getAuthMethod: () => "subscription",
    });

    await manager.getStatus();

    expect(mocks.clients[0]!.options).toMatchObject({
      env: {
        AFX_PROVIDER: "openai-codex",
        AFX_MODEL_ID: "gpt-5.4",
        AFX_AUTH_METHOD_OPENAI_CODEX: "subscription",
        AFX_API_KEY_OPENAI_CODEX: "oauth-access-token",
        OPENAI_API_KEY: "oauth-access-token",
      },
    });
    const spawnedEnv = (mocks.clients[0]!.options as { env: Record<string, string> }).env;
    expect(JSON.parse(spawnedEnv["AFX_PROVIDER_OVERRIDES_JSON"]!)).toEqual({
      overrides: { "openai-codex": { apiKeyEnv: "AFX_API_KEY_OPENAI_CODEX" } },
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
        "/extension/resources/harness-overlays/common/agenticflowx-vscode.md",
      ],
    });
  });

  it("passes Pi 0.80 trust, excluded tools, and external QA/dev/security skill paths", async () => {
    const manager = createPiSdkAgentManager({
      logger,
      bootstrapPath: "/extension/dist/bootstrap.js",
      provider: "anthropic",
      modelId: "claude-opus-4-5",
      getApiKey: () => "secret-key",
      projectTrust: "ignore",
      excludedTools: ["bash", "write"],
      additionalSkillPaths: [
        "/extension/resources/skills/agenticflowx",
        "/external/qa",
        "/external/dev",
        "/external/security",
      ],
    });

    await manager.getStatus();

    expect(mocks.clients[0]!.options).toMatchObject({
      args: [
        "--no-approve",
        "--exclude-tools",
        "bash,write",
        "--skill",
        "/extension/resources/skills/agenticflowx",
        "--skill",
        "/external/qa",
        "--skill",
        "/external/dev",
        "--skill",
        "/external/security",
      ],
    });
  });

  it("preserves Pi 0.80 command source info and compaction metadata", async () => {
    const manager = createPiSdkAgentManager({
      logger,
      bootstrapPath: "/extension/dist/bootstrap.js",
      provider: "anthropic",
      modelId: "claude-opus-4-5",
      getApiKey: () => "secret-key",
    });

    await expect(manager.getCommands()).resolves.toEqual([
      {
        name: "skill:custom-docs",
        description: "Custom docs workflow",
        source: "skill",
        sourceInfo: {
          path: "/workspace/custom-skills/custom-docs/SKILL.md",
          source: "path",
          scope: "temporary",
          origin: "top-level",
          baseDir: "/workspace/custom-skills",
        },
      },
      {
        name: "skill:afx-qa-methodology",
        description: "External QA workflow",
        source: "skill",
        sourceInfo: {
          path: "/external/qa/afx-qa-methodology/SKILL.md",
          source: "path",
          scope: "temporary",
          origin: "top-level",
          baseDir: "/external/qa",
        },
      },
      {
        name: "skill:afx-clean-code",
        description: "External development workflow",
        source: "skill",
        sourceInfo: {
          path: "/external/dev/afx-clean-code/SKILL.md",
          source: "path",
          scope: "temporary",
          origin: "top-level",
          baseDir: "/external/dev",
        },
      },
      {
        name: "skill:afx-security-audit",
        description: "External security workflow",
        source: "skill",
        sourceInfo: {
          path: "/external/security/afx-security-audit/SKILL.md",
          source: "path",
          scope: "temporary",
          origin: "top-level",
          baseDir: "/external/security",
        },
      },
    ]);
    await expect(manager.compact()).resolves.toEqual({
      summary: "Compacted previous context.",
      firstKeptEntryId: "entry-kept",
      tokensBefore: 88_000,
      estimatedTokensAfter: 2_400,
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

  it("passes image attachments to SDK prompt requests", async () => {
    const manager = createPiSdkAgentManager({
      logger,
      bootstrapPath: "/extension/dist/bootstrap.js",
      provider: "openai",
      modelId: "gpt-5.4",
      getApiKey: () => "secret-key",
    });

    await manager.send("describe this", [
      { type: "image", mimeType: "image/png", data: "iVBORw0KGgo=" },
    ]);

    expect(mocks.clients.at(-1)?.requests.at(-1)).toEqual({
      type: "prompt",
      message: "describe this",
      images: [{ type: "image", mimeType: "image/png", data: "iVBORw0KGgo=" }],
    });
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

  it("resets streaming state when stop disposes an active SDK client", async () => {
    const manager = createPiSdkAgentManager({
      logger,
      bootstrapPath: "/extension/dist/bootstrap.js",
      provider: "openai",
      modelId: "gpt-5.3-codex",
      getApiKey: () => "secret-key",
    });

    await manager.getStatus();
    mocks.clients[0]!.eventListener?.({ type: "agent_start" });

    await expect(manager.getStatus()).resolves.toMatchObject({
      running: true,
      isStreaming: true,
    });

    await manager.stop();

    expect(mocks.clients[0]!.isRunning).toBe(false);
    await expect(manager.getStatus()).resolves.toMatchObject({
      running: true,
      isStreaming: false,
    });
  });

  it("exposes Pi 0.82 thinking levels from wrapped RPC responses", async () => {
    const manager = createPiSdkAgentManager({
      logger,
      bootstrapPath: "/extension/dist/bootstrap.js",
      provider: "openai",
      modelId: "gpt-5.4",
      getApiKey: () => "secret-key",
    });

    await expect(manager.getAvailableThinkingLevels?.()).resolves.toEqual(["off", "medium", "max"]);
  });

  it("normalizes accumulated SDK tool updates and direct bash chunks as deltas", async () => {
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
      type: "tool_execution_start",
      toolCallId: "call-1",
      toolName: "bash",
      args: { command: "printf hello" },
    });
    mocks.clients[0]!.eventListener?.({
      type: "tool_execution_update",
      toolCallId: "call-1",
      partialResult: { content: [{ type: "text", text: "hello" }] },
    });
    mocks.clients[0]!.eventListener?.({
      type: "tool_execution_update",
      toolCallId: "call-1",
      partialResult: { content: [{ type: "text", text: "hello world" }] },
    });
    mocks.clients[0]!.eventListener?.({
      type: "bash_execution_update",
      id: "req-1",
      delta: "line\n",
    });

    expect(events).toContainEqual(
      expect.objectContaining({ type: "tool_start", toolCallId: "call-1", toolName: "bash" }),
    );
    expect(events).toContainEqual({ type: "tool_delta", toolCallId: "call-1", delta: "hello" });
    expect(events).toContainEqual({
      type: "tool_delta",
      toolCallId: "call-1",
      delta: " world",
    });
    expect(events).toContainEqual({ type: "bash_delta", id: "req-1", delta: "line\n" });
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

    await expect(manager.getAvailableModels()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provider: "anthropic",
          id: "claude-opus-4-5",
          source: "api-provider",
          instanceLabel: "anthropic",
          input: ["text", "image"],
        }),
        expect.objectContaining({
          provider: "openai",
          id: "gpt-5.2",
          source: "api-provider",
          instanceLabel: "anthropic",
        }),
      ]),
    );
    const models = await manager.getAvailableModels();
    expect(new Set(models.map((model) => model.provider))).toEqual(
      new Set(["anthropic", "openai"]),
    );
  });

  it("fills missing configured providers with lightweight default models when discovery is incomplete", async () => {
    const manager = createPiSdkAgentManager({
      logger,
      bootstrapPath: "/bootstrap.js",
      provider: "anthropic",
      modelId: "claude-opus-4-5",
      apiProviders: ["anthropic", "openai-codex"],
      getApiKey: () => undefined,
    });

    const models = await manager.getAvailableModels();
    const codexIds = models
      .filter((model) => model.provider === "openai-codex")
      .map((model) => model.id);

    expect(codexIds).toEqual(["gpt-5.5"]);
    expect(models).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provider: "anthropic",
          id: "claude-opus-4-5",
          source: "api-provider",
        }),
      ]),
    );
  });

  it("falls back to the configured/default model when Pi has no registry entry", async () => {
    const manager = createPiSdkAgentManager({
      logger,
      bootstrapPath: "/bootstrap.js",
      provider: "faux-provider",
      modelId: "faux-model",
      apiProviders: ["faux-provider"],
      getApiKey: () => undefined,
    });

    await expect(manager.getAvailableModels()).resolves.toEqual([
      expect.objectContaining({
        provider: "faux-provider",
        id: "faux-model",
        source: "api-provider",
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

    await expect(manager.getAvailableModels()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provider: "anthropic",
          id: "claude-opus-4-5",
          source: "api-provider",
        }),
      ]),
    );
  });

  it("forwards switchSession through the Pi RPC protocol", async () => {
    const manager = createPiSdkAgentManager({
      logger,
      bootstrapPath: "/bootstrap.js",
      provider: "anthropic",
      modelId: "claude-opus-4-5",
      sessionDir: "/sessions",
      getApiKey: () => undefined,
    });

    await expect(manager.switchSession?.("/sessions/a.jsonl")).resolves.toEqual({
      cancelled: false,
    });
    expect(mocks.assertSessionPathAllowed).toHaveBeenCalledWith("/sessions/a.jsonl", [
      "/sessions",
      "/home/test/.pi/agent/sessions",
    ]);
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

  it("marks subscription providers configured through provider override env references", () => {
    const env = buildBootstrapEnv({
      provider: "openai-codex",
      modelId: "gpt-5.5",
      apiKeys: { "openai-codex": "oauth-access-token" },
      authMethods: { "openai-codex": "subscription" },
    });

    expect(JSON.parse(env["AFX_PROVIDER_OVERRIDES_JSON"]!)).toEqual({
      overrides: { "openai-codex": { apiKeyEnv: "AFX_API_KEY_OPENAI_CODEX" } },
    });
  });

  it("merges subscription credential references with existing provider overrides", () => {
    const env = buildBootstrapEnv({
      provider: "github-copilot",
      modelId: "gpt-5.4",
      apiKeys: { "github-copilot": "copilot-token" },
      authMethods: { "github-copilot": "subscription" },
      extraEnv: {
        AFX_PROVIDER_OVERRIDES_JSON: JSON.stringify({
          overrides: {
            "github-copilot": { baseUrl: "https://api.corp.ghe.com" },
          },
        }),
      },
    });

    expect(JSON.parse(env["AFX_PROVIDER_OVERRIDES_JSON"]!)).toEqual({
      overrides: {
        "github-copilot": {
          baseUrl: "https://api.corp.ghe.com",
          apiKeyEnv: "AFX_API_KEY_GITHUB_COPILOT",
        },
      },
    });
  });
});

describe("rewriteAfxCommandPrompt", () => {
  it("rewrites only leading AFX commands", () => {
    expect(rewriteAfxCommandPrompt(" /afx-next")).toBe(" /skill:afx-next");
    expect(rewriteAfxCommandPrompt("please run /afx-next")).toBe("please run /afx-next");
  });
});
