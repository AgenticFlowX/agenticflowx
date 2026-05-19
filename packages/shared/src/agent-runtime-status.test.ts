/**
 * @see docs/specs/350-agent-manager/spec.md [FR-1]
 * @see docs/specs/350-agent-manager/design.md [DES-API] [DES-TEST]
 */
import { describe, expect, it } from "vitest";

import {
  type AgentRuntimeStatus,
  createCheckingAgentRuntimeStatus,
  deriveAgentRuntimeStatus,
} from "./agent";

describe("agent runtime status derivation", () => {
  it("keeps startup false status in starting before the readiness threshold", () => {
    const status = deriveAgentRuntimeStatus({
      status: { running: false, isStreaming: false },
      now: 1_000,
      startedAt: 0,
    });

    expect(status.phase).toBe("starting");
    expect(status.running).toBe(false);
  });

  it("moves first ready status to ready and stores lastReadyAt", () => {
    const status = deriveAgentRuntimeStatus({
      status: { running: true, isStreaming: false },
      now: 2_000,
      startedAt: 0,
    });

    expect(status.phase).toBe("ready");
    expect(status.lastReadyAt).toBe(2_000);
    expect(status.consecutiveFailures).toBe(0);
  });

  it("maps streaming status to busy", () => {
    const status = deriveAgentRuntimeStatus({
      status: { running: true, isStreaming: true },
      now: 3_000,
      startedAt: 0,
    });

    expect(status.phase).toBe("busy");
  });

  it("marks disconnected after repeated failures once previously ready", () => {
    const ready: AgentRuntimeStatus = {
      phase: "ready",
      running: true,
      isStreaming: false,
      checkedAt: 1_000,
      lastReadyAt: 1_000,
      consecutiveFailures: 0,
    };
    const first = deriveAgentRuntimeStatus({
      previous: ready,
      status: { running: false, isStreaming: false },
      now: 2_000,
      startedAt: 0,
    });
    const second = deriveAgentRuntimeStatus({
      previous: first,
      status: { running: false, isStreaming: false },
      now: 3_000,
      startedAt: 0,
    });
    const third = deriveAgentRuntimeStatus({
      previous: second,
      status: { running: false, isStreaming: false },
      now: 4_000,
      startedAt: 0,
    });

    expect(first.phase).toBe("checking");
    expect(second.phase).toBe("checking");
    expect(third.phase).toBe("disconnected");
  });

  it("supports restart checking then ready transitions", () => {
    const checking = createCheckingAgentRuntimeStatus(5_000);
    const ready = deriveAgentRuntimeStatus({
      previous: checking,
      status: { running: true, isStreaming: false },
      now: 6_000,
      startedAt: 5_000,
    });

    expect(checking.phase).toBe("checking");
    expect(ready.phase).toBe("ready");
  });

  it("marks restart-required failures as immediate errors", () => {
    const status = deriveAgentRuntimeStatus({
      status: {
        running: false,
        isStreaming: false,
        restartRequired: true,
        info: "Automatic retries are stopped.",
      },
      now: 1_000,
      startedAt: 1_000,
    });

    expect(status.phase).toBe("error");
    expect(status.restartRequired).toBe(true);
    expect(status.info).toMatch(/automatic retries/i);
  });

  it("formats Error, string, and object failures once startup grace is exhausted", () => {
    const base = {
      status: { running: false, isStreaming: false },
      now: 31_000,
      startedAt: 0,
    };

    expect(deriveAgentRuntimeStatus({ ...base, error: new Error("boom") }).info).toBe("boom");
    expect(deriveAgentRuntimeStatus({ ...base, error: "plain failure" }).info).toBe(
      "plain failure",
    );
    expect(deriveAgentRuntimeStatus({ ...base, error: { code: "E_FAIL" } }).info).toBe(
      '{"code":"E_FAIL"}',
    );
  });

  it("carries forward runtime metadata from the previous status while checking", () => {
    const previous: AgentRuntimeStatus = {
      phase: "busy",
      running: true,
      isStreaming: true,
      model: {
        provider: "provider",
        id: "model",
        name: "Provider Model",
        source: "api-provider",
      },
      rpcEnabled: true,
      runtimeConfigured: true,
      checkedAt: 1_000,
      lastReadyAt: 1_000,
      consecutiveFailures: 0,
    };

    const status = deriveAgentRuntimeStatus({
      previous,
      status: { running: false, isStreaming: false },
      now: 2_000,
      startedAt: 0,
    });

    expect(status.phase).toBe("checking");
    expect(status.model).toEqual({
      provider: "provider",
      id: "model",
      name: "Provider Model",
      source: "api-provider",
    });
    expect(status.rpcEnabled).toBe(true);
    expect(status.runtimeConfigured).toBe(true);
    expect(status.lastReadyAt).toBe(1_000);
  });

  it("marks explicitly unconfigured runtimes without treating them as recovery failures", () => {
    const status = deriveAgentRuntimeStatus({
      status: {
        running: false,
        isStreaming: false,
        info: "No agent runtime configured",
        rpcEnabled: false,
        runtimeConfigured: false,
      },
      now: 1_000,
      startedAt: 1_000,
    });

    expect(status.phase).toBe("disconnected");
    expect(status.runtimeConfigured).toBe(false);
    expect(status.rpcEnabled).toBe(false);
    expect(status.consecutiveFailures).toBe(0);
  });
});
