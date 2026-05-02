/**
 * @see docs/specs/chat-foundation/chat-foundation.md [FR-4] [DES-API] [DES-TEST]
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { type AgentRuntimeStatus, type Logger, createLogger, memorySink } from "@afx/shared";

import { type MockAgentManager, createMockAgentManager } from "./__fixtures__/mock-agent-manager";
import { createAgentRuntimeMonitor } from "./agent-runtime-monitor";

describe("agent runtime monitor", () => {
  let agent: MockAgentManager;
  let logger: Logger;

  beforeEach(() => {
    agent = createMockAgentManager();
    logger = createLogger({ scope: "test", level: "silent", sinks: [memorySink()] });
  });

  afterEach(() => {
    vi.useRealTimers();
    void agent.dispose();
  });

  it("checks status and emits a generic runtime snapshot", async () => {
    const monitor = createAgentRuntimeMonitor({ agentManager: agent, logger });
    const statuses: AgentRuntimeStatus[] = [];
    monitor.onStatus((status) => statuses.push(status));

    await monitor.check("status-1");

    expect(agent.getStatus).toHaveBeenCalledOnce();
    expect(statuses[0]?.phase).toBe("ready");
    expect(statuses[0]?.running).toBe(true);
    monitor.dispose();
  });

  it("restarts by stopping and then checking readiness", async () => {
    const monitor = createAgentRuntimeMonitor({ agentManager: agent, logger });
    const phases: string[] = [];
    monitor.onStatus((status) => phases.push(status.phase));

    await monitor.restart("restart-1");

    expect(agent.stop).toHaveBeenCalledOnce();
    expect(agent.getStatus).toHaveBeenCalledOnce();
    expect(phases).toEqual(["checking", "ready"]);
    monitor.dispose();
  });

  it("marks disconnected after repeated failures from a previously ready runtime", async () => {
    agent.getStatus
      .mockResolvedValueOnce({
        running: true,
        isStreaming: false,
        model: { provider: "openai", id: "gpt-5.2", name: "GPT-5.2" },
        thinkingLevel: "medium",
        isCompacting: false,
        steeringMode: "all",
        followUpMode: "all",
        autoCompactionEnabled: true,
        autoRetryEnabled: true,
        sessionId: "test-session",
        messageCount: 0,
        pendingMessageCount: 0,
      })
      .mockResolvedValue({
        running: false,
        isStreaming: false,
        model: { provider: "openai", id: "gpt-5.2", name: "GPT-5.2" },
        thinkingLevel: "medium",
        isCompacting: false,
        steeringMode: "all",
        followUpMode: "all",
        autoCompactionEnabled: true,
        autoRetryEnabled: true,
        sessionId: "test-session",
        messageCount: 0,
        pendingMessageCount: 0,
      });
    const monitor = createAgentRuntimeMonitor({ agentManager: agent, logger });

    await monitor.check();
    await monitor.check();
    await monitor.check();
    const status = await monitor.check();

    expect(status.phase).toBe("disconnected");
    expect(status.consecutiveFailures).toBe(3);
    monitor.dispose();
  });

  it("stops automatic polling when the runtime requires manual restart", async () => {
    vi.useFakeTimers();
    agent.getStatus.mockResolvedValue({
      running: false,
      isStreaming: false,
      restartRequired: true,
      info: "Automatic retries are stopped.",
    });
    const monitor = createAgentRuntimeMonitor({
      agentManager: agent,
      logger,
      intervals: { startingMs: 10, disconnectedMs: 10, readyMs: 10 },
    });

    monitor.start();
    const status = await monitor.check();
    const statusChecks = agent.getStatus.mock.calls.length;
    await vi.advanceTimersByTimeAsync(1_000);

    expect(status.phase).toBe("error");
    expect(status.restartRequired).toBe(true);
    expect(agent.getStatus).toHaveBeenCalledTimes(statusChecks);
    monitor.dispose();
  });
});
