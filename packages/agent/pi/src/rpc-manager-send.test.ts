/**
 * @see docs/specs/351-agent-pi/spec.md [FR-1]
 * @see docs/specs/351-agent-pi/design.md [DES-TEST]
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const requests: unknown[] = [];
let running = false;
let eventHandler: ((event: unknown) => void) | undefined;

const fakeClient = {
  get isRunning() {
    return running;
  },
  start: vi.fn(async () => {
    running = true;
  }),
  stop: vi.fn(async () => {}),
  dispose: vi.fn(async () => {}),
  request: vi.fn(async (cmd: unknown) => {
    requests.push(cmd);
    return {};
  }),
  send: vi.fn(),
  onEvent: vi.fn((listener: (event: unknown) => void) => {
    eventHandler = listener;
    return vi.fn();
  }),
  onExit: vi.fn(),
  onStderr: vi.fn(),
  getStderr: vi.fn(() => ""),
};

vi.mock("./rpc-client", () => ({
  createPiClient: vi.fn(() => fakeClient),
}));

describe("PiRpcManager send rewrite", () => {
  beforeEach(() => {
    requests.length = 0;
    running = false;
    eventHandler = undefined;
    vi.clearAllMocks();
    fakeClient.start.mockImplementation(async () => {
      running = true;
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("sends rewritten AFX skill commands to Pi prompt", async () => {
    const { createAgentManager } = await import("./rpc-manager");
    const manager = createAgentManager({
      logger: createLogger(),
      ephemeral: true,
      cwd: "/tmp/workspace",
    });

    await manager.send("/afx-task code T-001");

    expect(requests.at(-1)).toEqual({
      type: "prompt",
      message: "/skill:afx-task code T-001",
    });
  });

  it("passes shared session dir to Pi when sessions are persistent", async () => {
    const clientMod = await import("./rpc-client");
    const { createAgentManager } = await import("./rpc-manager");
    const manager = createAgentManager({
      logger: createLogger(),
      ephemeral: false,
      sessionDir: "/tmp/agenticflowx-sessions",
      cwd: "/tmp/workspace",
    });

    await manager.getStatus();

    expect(vi.mocked(clientMod.createPiClient)).toHaveBeenCalledWith(
      expect.objectContaining({
        args: expect.arrayContaining(["--session-dir", "/tmp/agenticflowx-sessions"]),
      }),
    );
  });

  it("passes environment overrides to the spawned runtime", async () => {
    const clientMod = await import("./rpc-client");
    const { createAgentManager } = await import("./rpc-manager");
    const manager = createAgentManager({
      logger: createLogger(),
      ephemeral: false,
      cwd: "/tmp/workspace",
      env: { AFX_SESSION_DIR: "/tmp/agenticflowx-sessions" },
    });

    await manager.getStatus();

    expect(vi.mocked(clientMod.createPiClient)).toHaveBeenCalledWith(
      expect.objectContaining({
        env: { AFX_SESSION_DIR: "/tmp/agenticflowx-sessions" },
      }),
    );
  });

  it("does not retry a failed start on every status poll", async () => {
    const clientMod = await import("./rpc-client");
    const { createAgentManager } = await import("./rpc-manager");
    fakeClient.start.mockRejectedValueOnce(new Error("spawn ENOENT"));
    const manager = createAgentManager({
      logger: createLogger(),
      ephemeral: true,
      cwd: "/tmp/workspace",
    });

    await expect(manager.getStatus()).resolves.toMatchObject({ running: false });
    await expect(manager.getStatus()).resolves.toMatchObject({ running: false });

    expect(vi.mocked(clientMod.createPiClient)).toHaveBeenCalledTimes(1);

    await manager.stop();
    await expect(manager.getStatus()).resolves.toMatchObject({ running: true });
    expect(vi.mocked(clientMod.createPiClient)).toHaveBeenCalledTimes(2);
  });

  it("stops automatic start retries after three failed attempts until manual restart", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const clientMod = await import("./rpc-client");
    const { createAgentManager } = await import("./rpc-manager");
    fakeClient.start.mockRejectedValue(new Error("spawn EPERM"));
    const manager = createAgentManager({
      logger: createLogger(),
      ephemeral: true,
      cwd: "/tmp/workspace",
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
    expect(vi.mocked(clientMod.createPiClient)).toHaveBeenCalledTimes(3);

    fakeClient.start.mockImplementation(async () => {
      running = true;
    });
    await manager.stop();
    const recovered = await manager.getStatus();
    expect(recovered.running).toBe(true);
    expect(recovered.restartRequired).toBeUndefined();
    expect(vi.mocked(clientMod.createPiClient)).toHaveBeenCalledTimes(4);
  });

  it("switches sessions through Pi RPC", async () => {
    const { createAgentManager } = await import("./rpc-manager");
    const manager = createAgentManager({
      logger: createLogger(),
      ephemeral: false,
      cwd: "/tmp/workspace",
    });

    await manager.switchSession?.("/tmp/agenticflowx-sessions/session.jsonl");

    expect(requests.at(-1)).toEqual({
      type: "switch_session",
      sessionPath: "/tmp/agenticflowx-sessions/session.jsonl",
    });
  });

  it("normalizes Pi queue updates and assistant message boundaries", async () => {
    const { createAgentManager } = await import("./rpc-manager");
    const manager = createAgentManager({
      logger: createLogger(),
      ephemeral: true,
      cwd: "/tmp/workspace",
    });
    const events: unknown[] = [];
    manager.onEvent((evt) => events.push(evt));

    await manager.send("hello");
    eventHandler?.({ type: "queue_update", steering: ["tighten"], followUp: ["next"] });
    eventHandler?.({
      type: "message_start",
      message: { role: "user", content: [{ type: "text", text: "tighten" }] },
    });
    eventHandler?.({
      type: "message_update",
      assistantMessageEvent: { type: "thinking_delta", delta: "thinking" },
    });
    eventHandler?.({
      type: "message_end",
      message: { role: "assistant", stopReason: "end_turn" },
    });

    expect(events).toContainEqual({
      type: "queue_update",
      steeringCount: 1,
      followUpCount: 1,
      pendingMessageCount: 2,
    });
    expect(events).toContainEqual({
      type: "message_start",
      role: "user",
      content: "tighten",
    });
    expect(events).toContainEqual(
      expect.objectContaining({ type: "thinking_delta", delta: "thinking" }),
    );
    expect(events).toContainEqual({
      type: "message_end",
      role: "assistant",
      stopReason: "end_turn",
    });
  });

  it("normalizes assistant message_end provider failures into errors", async () => {
    const { createAgentManager } = await import("./rpc-manager");
    const manager = createAgentManager({
      logger: createLogger(),
      ephemeral: true,
      cwd: "/tmp/workspace",
    });
    const events: unknown[] = [];
    manager.onEvent((evt) => events.push(evt));

    await manager.send("hello");
    eventHandler?.({
      type: "message_end",
      message: {
        role: "assistant",
        stopReason: "error",
        errorMessage: "You exceeded your current quota.",
      },
    });

    expect(events).toContainEqual({
      type: "error",
      message: "You exceeded your current quota.",
    });
  });

  it("normalizes context overflow as recoverable compaction events", async () => {
    const { createAgentManager } = await import("./rpc-manager");
    const manager = createAgentManager({
      logger: createLogger(),
      ephemeral: true,
      cwd: "/tmp/workspace",
    });
    const events: unknown[] = [];
    manager.onEvent((evt) => events.push(evt));

    await manager.send("/afx-session");
    eventHandler?.({
      type: "message_end",
      message: {
        role: "assistant",
        stopReason: "error",
        errorMessage:
          "Your input exceeds the context window of this model. Please adjust your input and try again.",
      },
    });
    eventHandler?.({ type: "compaction_start", reason: "overflow" });
    eventHandler?.({
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

    expect(events).toContainEqual({
      type: "context_overflow",
      message:
        "Your input exceeds the context window of this model. Please adjust your input and try again.",
    });
    expect(events).toContainEqual({
      type: "compaction_start",
      reason: "overflow",
    });
    expect(events).toContainEqual({
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
    });
    expect(events).not.toContainEqual(
      expect.objectContaining({
        type: "error",
        message: expect.stringMatching(/context window/i),
      }),
    );
  });

  it("normalizes Pi auto-retry events for transient provider failures", async () => {
    const { createAgentManager } = await import("./rpc-manager");
    const manager = createAgentManager({
      logger: createLogger(),
      ephemeral: true,
      cwd: "/tmp/workspace",
    });
    const events: unknown[] = [];
    manager.onEvent((evt) => events.push(evt));

    await manager.send("hello");
    eventHandler?.({
      type: "message_end",
      message: {
        role: "assistant",
        stopReason: "error",
        errorMessage: "overloaded_error: upstream service unavailable",
      },
    });
    eventHandler?.({
      type: "auto_retry_start",
      attempt: 1,
      maxAttempts: 3,
      delayMs: 1_000,
      errorMessage: "overloaded_error: upstream service unavailable",
    });
    eventHandler?.({ type: "auto_retry_end", success: true, attempt: 1 });

    expect(events).toContainEqual({
      type: "retryable_error",
      message: "overloaded_error: upstream service unavailable",
    });
    expect(events).toContainEqual({
      type: "auto_retry_start",
      attempt: 1,
      maxAttempts: 3,
      delayMs: 1_000,
      errorMessage: "overloaded_error: upstream service unavailable",
    });
    expect(events).toContainEqual({
      type: "auto_retry_end",
      success: true,
      attempt: 1,
      finalError: undefined,
    });
  });
});

function createLogger() {
  return {
    level: "info" as const,
    child: () => createLogger(),
    trace: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    setLevel: vi.fn(),
  };
}
