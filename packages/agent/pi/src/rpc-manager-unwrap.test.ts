/**
 * Regression tests for the Pi response-shape unwrap.
 *
 * Pi RPC responses for `get_available_models` and `get_commands` are wrapped
 * objects (`data: { models: Model[] }` and `data: { commands: RpcSlashCommand[] }`),
 * not bare arrays. Earlier versions of `getAvailableModels` / `getCommands`
 * checked `Array.isArray(response)` directly and returned `[]` against the real
 * pi shape — leading to an empty model selector and an empty slash-command popup.
 * These tests pin the unwrap behavior.
 *
 * @see docs/specs/300-infra-pi/spec.md [FR-9]
 * @see docs/specs/chat-foundation/chat-foundation.md [FR-4] [FR-7]
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

let running = false;
let getModelsResponse: unknown = null;
let getCommandsResponse: unknown = null;
let getStateResponse: unknown = null;

const fakeClient = {
  get isRunning() {
    return running;
  },
  start: vi.fn(async () => {
    running = true;
  }),
  stop: vi.fn(async () => {}),
  dispose: vi.fn(async () => {}),
  request: vi.fn(async (cmd: { type: string }) => {
    if (cmd.type === "get_available_models") return getModelsResponse;
    if (cmd.type === "get_commands") return getCommandsResponse;
    if (cmd.type === "get_state") return getStateResponse;
    return {};
  }),
  send: vi.fn(),
  onEvent: vi.fn(),
  onExit: vi.fn(),
  onStderr: vi.fn(),
  getStderr: vi.fn(() => ""),
};

vi.mock("./rpc-client", () => ({
  createPiClient: vi.fn(() => fakeClient),
}));

const PI_MODEL = {
  provider: "anthropic",
  id: "claude-opus-4-7",
  name: "Claude Opus 4.7",
  reasoning: true,
  contextWindow: 1_000_000,
  maxTokens: 128_000,
};

const PI_COMMAND = { name: "skill:afx-task", description: "Task workflow", source: "skill" };

describe("PiRpcManager response unwrap", () => {
  beforeEach(() => {
    running = false;
    getModelsResponse = null;
    getCommandsResponse = null;
    getStateResponse = null;
    vi.clearAllMocks();
  });

  describe("getAvailableModels", () => {
    it("unwraps `{ models: [...] }` (real Pi shape)", async () => {
      getModelsResponse = { models: [PI_MODEL] };
      const { createAgentManager } = await import("./rpc-manager");
      const manager = createAgentManager({ logger: createLogger(), ephemeral: true });

      const result = await manager.getAvailableModels();
      expect(result).toHaveLength(1);
      expect(result[0]?.provider).toBe("anthropic");
    });

    it("accepts a bare array response (legacy / mock shape)", async () => {
      getModelsResponse = [PI_MODEL];
      const { createAgentManager } = await import("./rpc-manager");
      const manager = createAgentManager({ logger: createLogger(), ephemeral: true });

      const result = await manager.getAvailableModels();
      expect(result).toHaveLength(1);
    });

    it("returns [] when neither shape is present", async () => {
      getModelsResponse = { unexpected: true };
      const { createAgentManager } = await import("./rpc-manager");
      const manager = createAgentManager({ logger: createLogger(), ephemeral: true });

      const result = await manager.getAvailableModels();
      expect(result).toEqual([]);
    });
  });

  describe("getCommands", () => {
    it("unwraps `{ commands: [...] }` (real Pi shape)", async () => {
      getCommandsResponse = { commands: [PI_COMMAND] };
      const { createAgentManager } = await import("./rpc-manager");
      const manager = createAgentManager({ logger: createLogger(), ephemeral: true });

      const result = await manager.getCommands();
      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe("skill:afx-task");
      expect(result[0]?.source).toBe("skill");
    });

    it("accepts a bare array response (legacy / mock shape)", async () => {
      getCommandsResponse = [PI_COMMAND];
      const { createAgentManager } = await import("./rpc-manager");
      const manager = createAgentManager({ logger: createLogger(), ephemeral: true });

      const result = await manager.getCommands();
      expect(result).toHaveLength(1);
    });

    it("returns [] when neither shape is present", async () => {
      getCommandsResponse = null;
      const { createAgentManager } = await import("./rpc-manager");
      const manager = createAgentManager({ logger: createLogger(), ephemeral: true });

      const result = await manager.getCommands();
      expect(result).toEqual([]);
    });
  });

  describe("getStatus", () => {
    it("maps Pi pendingMessageCount from get_state", async () => {
      getStateResponse = {
        steeringMode: "one-at-a-time",
        followUpMode: "all",
        sessionFile: "/tmp/agenticflowx-sessions/session.jsonl",
        pendingMessageCount: 2,
      };
      const { createAgentManager } = await import("./rpc-manager");
      const manager = createAgentManager({ logger: createLogger(), ephemeral: true });

      const result = await manager.getStatus();
      expect(result.pendingMessageCount).toBe(2);
      expect(result.sessionFile).toBe("/tmp/agenticflowx-sessions/session.jsonl");
      expect(result.steeringMode).toBe("one-at-a-time");
      expect(result.followUpMode).toBe("all");
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
