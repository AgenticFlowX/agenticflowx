/**
 * Unit tests for createMockTransport — verifies all scenarios fire correct
 * message sequences and the log captures both directions.
 */
import { describe, expect, it, vi } from "vitest";

import { createMockTransport } from "./mock";

describe("createMockTransport", () => {
  it("responds to chat/ready with state + runtime status", () => {
    const t = createMockTransport();
    const types: string[] = [];
    t.on("chat/state", () => types.push("chat/state"));
    t.on("agent/status", () => types.push("agent/status"));
    t.send({ type: "chat/ready" });
    expect(types).toEqual(["chat/state", "agent/status"]);
    t.dispose();
  });

  it("responds to chat/abort with aborted + runtime status", () => {
    const t = createMockTransport();
    const types: string[] = [];
    t.on("chat/aborted", () => types.push("chat/aborted"));
    t.on("agent/status", () => types.push("agent/status"));
    t.send({ type: "chat/abort" });
    expect(types).toContain("chat/aborted");
    t.dispose();
  });

  it("unsubscribe stops receiving messages", () => {
    const t = createMockTransport();
    const handler = vi.fn();
    const off = t.on("agent/status", handler);
    t.send({ type: "chat/ready" });
    expect(handler).toHaveBeenCalledTimes(1);
    off();
    t.send({ type: "chat/ready" });
    expect(handler).toHaveBeenCalledTimes(1);
    t.dispose();
  });

  it("logs outbound send messages", () => {
    const t = createMockTransport();
    t.send({ type: "chat/ready" });
    const log = t.getLog();
    expect(log.some((e) => e.dir === "out" && e.type === "chat/ready")).toBe(true);
    t.dispose();
  });

  it("logs inbound emitted messages", () => {
    const t = createMockTransport();
    t.send({ type: "chat/ready" });
    const log = t.getLog();
    expect(log.some((e) => e.dir === "in" && e.type === "chat/state")).toBe(true);
    t.dispose();
  });

  it("replays tool metadata in chat/state after an edit scenario", async () => {
    vi.useFakeTimers();
    const t = createMockTransport();
    let messages: unknown[] = [];
    t.on("chat/state", (msg) => {
      messages = msg.messages;
    });

    t.scenarios["tool-edit-file"]?.();
    await vi.runAllTimersAsync();
    t.send({ type: "chat/getState" });

    expect(JSON.stringify(messages)).toContain('"toolName":"edit_file"');
    expect(JSON.stringify(messages)).toContain('"firstChangedLine":142');
    t.dispose();
    vi.useRealTimers();
  });

  it("onLog fires for each message", () => {
    const t = createMockTransport();
    const entries: string[] = [];
    t.onLog((e) => entries.push(`${e.dir}:${e.type}`));
    t.send({ type: "chat/ready" });
    expect(entries).toContain("out:chat/ready");
    expect(entries).toContain("in:chat/state");
    t.dispose();
  });

  it("onLog unsubscribe works", () => {
    const t = createMockTransport();
    const entries: string[] = [];
    const off = t.onLog((e) => entries.push(e.type));
    t.send({ type: "chat/ready" });
    const countAfterFirst = entries.length;
    off();
    t.send({ type: "chat/ready" });
    expect(entries.length).toBe(countAfterFirst);
    t.dispose();
  });

  it("setStreamSpeed is accepted without error", () => {
    const t = createMockTransport();
    expect(() => t.setStreamSpeed(10)).not.toThrow();
    t.dispose();
  });

  it("all named scenarios exist", () => {
    const t = createMockTransport();
    const expected = [
      "quick-reply",
      "streaming-reply",
      "large-response",
      "coding-benchmark",
      "thinking-reply",
      "steer",
      "follow-up",
      "tool-bash",
      "tool-read-file",
      "tool-edit-file",
      "spec-doc-actions",
      "spec-doc-clear",
      "spec-doc-preview",
      "sprint-doc-actions",
      "journal-doc-actions",
      "global-journal-doc-actions",
      "multi-tool",
      "tool-error",
      "provider-error",
      "abort",
      "startup",
      "disconnected",
      "long-disconnect",
      "retry-recovery",
      "restart-recovery",
      "context-near-full",
      "runtimeSettingsLoaded",
      "compacting",
      "modelsLoaded",
      "modelsEmpty",
      "commandsLoaded",
      "filesListed",
      "stderrLoaded",
      "settingsSnapshotLoaded",
      "providersEmpty",
      "providersAnthropicConfigured",
      "providersMultiConfigured",
      "externalAgentOnly",
      "bothConfigured",
      "appearancePreview",
    ];
    for (const name of expected) {
      expect(t.scenarios[name], `scenario "${name}" missing`).toBeDefined();
    }
    t.dispose();
  });

  it("disconnected scenario fires runtime status running=false", () => {
    const t = createMockTransport();
    let running: boolean | undefined;
    let phase: string | undefined;
    t.on("agent/status", (msg) => {
      running = msg.status.running;
      phase = msg.status.phase;
    });
    t.scenarios["disconnected"]?.();
    expect(running).toBe(false);
    expect(phase).toBe("disconnected");
    t.dispose();
  });

  it("coding benchmark scenario hydrates a long code-heavy transcript", () => {
    const t = createMockTransport();
    let messages: unknown[] = [];
    t.on("chat/state", (msg) => {
      messages = msg.messages;
    });

    t.scenarios["coding-benchmark"]?.();

    expect(messages.length).toBeGreaterThanOrEqual(40);
    expect(JSON.stringify(messages)).toContain("Benchmark refactor slice 24");
    expect(messages.some((message) => isRole(message, "compactionSummary"))).toBe(true);
    t.dispose();
  });

  it("sprint doc-actions scenario includes section offsets for in-file stepper jumps", () => {
    const t = createMockTransport();
    let payload: unknown;
    t.on("chat/activeDocContext", (msg) => {
      payload = msg;
    });

    t.scenarios["sprint-doc-actions"]?.();

    expect(payload).toMatchObject({
      format: "sprint",
      docKind: "spec",
      filePath: "/workspace/docs/specs/999-fleet/postgresql-marketplace-backend-rewrite.md",
      sectionOffsets: {
        spec: 22,
        design: 84,
        tasks: 140,
        sessions: 220,
      },
    });
    t.dispose();
  });

  it("doc context clear and preview scenarios drive the stepper state", () => {
    const t = createMockTransport();
    const payloads: unknown[] = [];
    t.on("chat/activeDocContext", (msg) => {
      payloads.push(msg);
    });

    t.scenarios["spec-doc-preview"]?.();
    t.scenarios["spec-doc-clear"]?.();

    expect(payloads[0]).toMatchObject({
      format: "standard",
      section: "SPEC",
      docKind: "spec",
      filePath: "/workspace/docs/specs/auth/spec.md",
    });
    expect(payloads[1]).toMatchObject({
      format: null,
      section: null,
      docKind: null,
      filePath: null,
    });
    t.dispose();
  });

  it("global journal scenario has no feature or workflow siblings", () => {
    const t = createMockTransport();
    let payload: unknown;
    t.on("chat/activeDocContext", (msg) => {
      payload = msg;
    });

    t.scenarios["global-journal-doc-actions"]?.();

    expect(payload).toMatchObject({
      format: "standard",
      section: null,
      docKind: "journal",
      feature: null,
      filePath: "/workspace/docs/specs/journal.md",
    });
    expect(payload).not.toHaveProperty("siblingPaths");
    expect(payload).not.toHaveProperty("sectionOffsets");
    t.dispose();
  });

  it("responds to agent/checkStatus with generic runtime status", () => {
    const t = createMockTransport();
    const phases: string[] = [];
    t.on("agent/status", (msg) => phases.push(msg.status.phase));
    t.send({ type: "agent/checkStatus", requestId: "status-1" });
    expect(phases).toEqual(["ready"]);
    t.dispose();
  });

  it("simulates restart recovery through checking then ready", async () => {
    vi.useFakeTimers();
    const t = createMockTransport();
    const phases: string[] = [];
    t.on("agent/status", (msg) => phases.push(msg.status.phase));
    t.send({ type: "agent/restart", requestId: "restart-1" });
    await vi.runAllTimersAsync();
    expect(phases).toEqual(["checking", "ready"]);
    t.dispose();
    vi.useRealTimers();
  });

  it("provider-error scenario fires chat/error", async () => {
    vi.useFakeTimers();
    const t = createMockTransport();
    const errors: string[] = [];
    t.on("chat/error", (msg) => errors.push(msg.message));
    t.scenarios["provider-error"]?.();
    await vi.runAllTimersAsync();
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toMatch(/rate limit|429|Provider/i);
    t.dispose();
    vi.useRealTimers();
  });

  it("responds to new foundation request messages", () => {
    const t = createMockTransport();
    const types: string[] = [];
    t.on("agent/models", () => types.push("agent/models"));
    t.on("agent/commands", () => types.push("agent/commands"));
    t.on("agent/files", () => types.push("agent/files"));
    t.on("agent/settingsSnapshot", () => types.push("agent/settingsSnapshot"));
    t.on("agent/runtimeSettings", () => types.push("agent/runtimeSettings"));
    t.on("agent/compacted", () => types.push("agent/compacted"));
    t.send({ type: "chat/getModels", requestId: "m1" });
    t.send({ type: "chat/getCommands", requestId: "c1" });
    t.send({ type: "chat/listFiles", requestId: "f1" });
    t.send({ type: "chat/getSettingsSnapshot", requestId: "s1" });
    t.send({ type: "chat/setThinkingLevel", requestId: "r1", level: "high" });
    t.send({ type: "chat/setSteeringMode", requestId: "r2", mode: "one-at-a-time" });
    t.send({ type: "chat/setFollowUpMode", requestId: "r3", mode: "all" });
    t.send({ type: "chat/setAutoCompaction", requestId: "r4", enabled: false });
    t.send({ type: "chat/setAutoRetry", requestId: "r5", enabled: true });
    expect(types).toEqual([
      "agent/models",
      "agent/commands",
      "agent/files",
      "agent/settingsSnapshot",
      "agent/runtimeSettings",
      "agent/runtimeSettings",
      "agent/runtimeSettings",
      "agent/runtimeSettings",
      "agent/runtimeSettings",
    ]);
    t.dispose();
  });

  it("handles appearance update messages and preview scenario", () => {
    const t = createMockTransport();
    const appearances: string[] = [];
    t.on("agent/appearanceUpdated", (msg) => appearances.push(msg.appearance.style));

    t.send({ type: "appearance/update", requestId: "appearance-1", style: "sera" });
    t.scenarios["appearancePreview"]?.();

    expect(appearances).toEqual(["sera", "mira"]);
    t.dispose();
  });

  it("handles provider settings request messages", () => {
    const t = createMockTransport();
    const snapshots: string[] = [];
    t.on("agent/settingsSnapshot", (msg) => {
      snapshots.push(msg.requestId ?? "");
    });

    t.send({
      type: "provider/setApiKey",
      requestId: "key-set",
      provider: "anthropic",
      key: "secret",
    });
    t.send({ type: "provider/clearApiKey", requestId: "key-clear", provider: "anthropic" });
    t.send({
      type: "provider/setDefaultModel",
      requestId: "model-default",
      provider: "anthropic",
      modelId: "claude-opus-4",
    });
    t.send({ type: "external/detectPiBinary", requestId: "detect-pi" });
    t.send({ type: "external/setRpcEnabled", requestId: "rpc-enabled", enabled: true });
    t.send({ type: "external/setEphemeral", requestId: "ephemeral", enabled: false });

    expect(snapshots).toEqual([
      "key-set",
      "key-clear",
      "model-default",
      "detect-pi",
      "rpc-enabled",
      "ephemeral",
    ]);
    t.dispose();
  });

  it("runs provider configuration scenarios", () => {
    const t = createMockTransport();
    const snapshots: Array<{ providers: unknown[]; externalAgents?: unknown[] }> = [];
    const modelCounts: number[] = [];
    t.on("agent/settingsSnapshot", (msg) => snapshots.push(msg.snapshot));
    t.on("agent/models", (msg) => modelCounts.push(msg.models.length));

    t.scenarios["providersEmpty"]?.();
    t.scenarios["providersAnthropicConfigured"]?.();
    t.scenarios["providersMultiConfigured"]?.();
    t.scenarios["externalAgentOnly"]?.();
    t.scenarios["bothConfigured"]?.();

    expect(snapshots).toHaveLength(5);
    expect(snapshots[0]?.providers).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "minimax", state: "empty" })]),
    );
    expect(snapshots[2]?.providers).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "ollama", state: "no-key-needed" })]),
    );
    expect(modelCounts).toEqual([1, 3]);
    t.dispose();
  });

  it("simulates compaction lifecycle", async () => {
    vi.useFakeTimers();
    const t = createMockTransport();
    const events: string[] = [];
    t.on("agent/runtimeSettings", (msg) => {
      events.push(msg.settings.isCompacting ? "compacting" : "idle");
    });
    t.on("agent/compacted", () => events.push("compacted"));
    t.send({ type: "chat/compact", requestId: "compact-1" });
    await vi.runAllTimersAsync();
    expect(events).toEqual(["compacting", "compacted", "idle"]);
    t.dispose();
    vi.useRealTimers();
  });

  it("rejects steer when no turn is streaming", () => {
    const t = createMockTransport();
    const errors: string[] = [];
    t.on("chat/error", (msg) => errors.push(msg.message));
    t.send({ type: "chat/steer", requestId: "steer-1", content: "tighten focus" });
    expect(errors[0]).toMatch(/no turn is currently streaming/i);
    t.dispose();
  });

  it("applies steer to the active assistant turn", async () => {
    vi.useFakeTimers();
    const t = createMockTransport();
    const deltas: string[] = [];
    t.setStreamSpeed(10);
    t.on("chat/messageDelta", (msg) => deltas.push(msg.delta));
    t.send({ type: "chat/send", requestId: "send-1", content: "explain everything" });
    await vi.advanceTimersByTimeAsync(80);
    t.send({ type: "chat/steer", requestId: "steer-1", content: "focus on debug panel only" });
    await vi.runAllTimersAsync();
    expect(deltas.join("")).toContain("Steer applied at next agent step");
    expect(deltas.join("")).toContain("focus on debug panel only");
    t.dispose();
    vi.useRealTimers();
  });

  it("applies all queued steers together when steering mode is all", async () => {
    vi.useFakeTimers();
    const t = createMockTransport();
    const deltas: string[] = [];
    t.setStreamSpeed(10);
    t.on("chat/messageDelta", (msg) => deltas.push(msg.delta));
    t.send({ type: "chat/setSteeringMode", requestId: "mode-1", mode: "all" });
    t.send({ type: "chat/send", requestId: "send-1", content: "explain everything" });
    await vi.advanceTimersByTimeAsync(80);
    t.send({ type: "chat/steer", requestId: "steer-1", content: "focus on debug panel" });
    t.send({ type: "chat/steer", requestId: "steer-2", content: "skip the architecture recap" });
    await vi.runAllTimersAsync();
    const joined = deltas.join("");
    expect(joined).toContain("2 queued messages");
    expect(joined).toContain("focus on debug panel");
    expect(joined).toContain("skip the architecture recap");
    t.dispose();
    vi.useRealTimers();
  });

  it("queues follow-up until the active assistant turn completes", async () => {
    vi.useFakeTimers();
    const t = createMockTransport();
    const assistantStarts: number[] = [];
    const deltas: string[] = [];
    t.setStreamSpeed(10);
    t.on("chat/messageStart", (msg) => {
      if (msg.role === "assistant") assistantStarts.push(msg.createdAt);
    });
    t.on("chat/messageDelta", (msg) => deltas.push(msg.delta));
    t.send({ type: "chat/send", requestId: "send-1", content: "first request" });
    await vi.advanceTimersByTimeAsync(80);
    t.send({ type: "chat/followUp", requestId: "follow-1", content: "now cover mode toggles" });
    expect(assistantStarts.length).toBe(1);
    await vi.runAllTimersAsync();
    expect(assistantStarts.length).toBeGreaterThan(1);
    expect(deltas.join("")).toContain("Following up on the queued message");
    expect(deltas.join("")).toContain("now cover mode toggles");
    t.dispose();
    vi.useRealTimers();
  });

  it("dispose clears all listeners", () => {
    const t = createMockTransport();
    const handler = vi.fn();
    t.on("agent/status", handler);
    t.dispose();
    t.send({ type: "chat/ready" });
    expect(handler).not.toHaveBeenCalled();
  });
});

function isRole(value: unknown, role: string): boolean {
  return (
    value !== null &&
    typeof value === "object" &&
    "role" in value &&
    (value as { role?: unknown }).role === role
  );
}
