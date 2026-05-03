/**
 * @see docs/specs/100-package-shared/spec.md [FR-1] [FR-2] [FR-4]
 * @see docs/specs/100-package-shared/design.md [DES-TEST]
 */
import { describe, expect, it } from "vitest";

import type { AgentCommand, AgentStatus } from "./agent";
import type { AgentToChat, ChatToAgent } from "./messages";

describe("chat-foundation shared protocol", () => {
  it("supports structured status models", () => {
    const status: AgentStatus = {
      running: true,
      isStreaming: false,
      model: { provider: "openai", id: "gpt-5.2", name: "GPT-5.2" },
      pendingMessageCount: 0,
    };
    expect(status.model?.provider).toBe("openai");
  });

  it("supports chat/send mentions", () => {
    const message: ChatToAgent = {
      type: "chat/send",
      requestId: "r1",
      content: "Review @src/foo.ts",
      mentions: ["src/foo.ts"],
    };
    expect(message.mentions).toEqual(["src/foo.ts"]);
  });

  it("supports command response variants", () => {
    const command: AgentCommand = {
      name: "skill:afx-task",
      source: "skill",
      description: "Manage tasks",
    };
    const message: AgentToChat = {
      type: "agent/commands",
      requestId: "r1",
      commands: [command],
    };
    expect(message.commands[0]?.source).toBe("skill");
  });

  it("supports generic runtime status and recovery commands", () => {
    const retry: ChatToAgent = { type: "agent/checkStatus", requestId: "status-1" };
    const restart: ChatToAgent = { type: "agent/restart", requestId: "restart-1" };
    const status: AgentToChat = {
      type: "agent/status",
      requestId: "status-1",
      status: {
        phase: "ready",
        running: true,
        isStreaming: false,
        checkedAt: 1,
        lastReadyAt: 1,
        consecutiveFailures: 0,
      },
    };

    expect(retry.type).toBe("agent/checkStatus");
    expect(restart.type).toBe("agent/restart");
    expect(status.status.phase).toBe("ready");
  });

  it("supports Pi RPC opt-in settings messages", () => {
    const message: ChatToAgent = {
      type: "external/setRpcEnabled",
      requestId: "rpc-enabled",
      enabled: true,
    };

    expect(message.enabled).toBe(true);
  });
});
