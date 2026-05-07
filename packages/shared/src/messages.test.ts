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

  it("supports active-file context preference messages", () => {
    const message: ChatToAgent = {
      type: "chat/setIncludeActiveFileContext",
      requestId: "context-enabled",
      enabled: true,
    };

    expect(message.enabled).toBe(true);
  });

  it("supports workspace mode toggles", () => {
    const message: ChatToAgent = {
      type: "chat/setMode",
      requestId: "mode-enabled",
      mode: "explore",
    };

    expect(message.mode).toBe("explore");
  });

  it("supports blocked action responses", () => {
    const message: AgentToChat = {
      type: "agent/actionBlocked",
      requestId: "blocked-1",
      mode: "explore",
      action: "runCommand",
      title: "Shell command blocked in Explore mode",
      message: "Explore mode is read-only.",
      command: "pnpm test",
    };

    expect(message.action).toBe("runCommand");
  });

  it("supports active-file context snapshots", () => {
    const message: AgentToChat = {
      type: "agent/activeFileContext",
      snapshot: {
        name: "journal.md",
        path: "/workspace/src/notes/journal.md",
      },
    };

    expect(message.snapshot?.name).toBe("journal.md");
  });

  // @see docs/specs/100-package-shared/spec.md [FR-11]
  it("supports the 'spec' workspace mode variant on chat/setMode", () => {
    const message: ChatToAgent = {
      type: "chat/setMode",
      requestId: "mode-spec",
      mode: "spec",
    };
    expect(message.mode).toBe("spec");
  });

  // @see docs/specs/100-package-shared/spec.md [FR-12]
  it("supports the chat/activeDocContext host→webview message", () => {
    const message: AgentToChat = {
      type: "chat/activeDocContext",
      format: "standard",
      section: "SPEC",
      docKind: "spec",
      feature: "auth",
      approvalStatus: "Draft",
    };
    expect(message.docKind).toBe("spec");
    expect(message.feature).toBe("auth");
  });

  // @see docs/specs/100-package-shared/spec.md [FR-12]
  it("admits the full docKind union (spec/design/tasks/journal/adr/research/context)", () => {
    const kinds: Array<AgentToChat extends { type: "chat/activeDocContext" } ? never : never> = [];
    void kinds; // type-only check; the assertion is below.

    const all: ReadonlyArray<
      NonNullable<Extract<AgentToChat, { type: "chat/activeDocContext" }>["docKind"]>
    > = ["spec", "design", "tasks", "journal", "adr", "research", "context"];
    expect(all).toHaveLength(7);
  });

  // @see docs/specs/100-package-shared/spec.md [FR-12]
  it("supports chat/setOnboardingFlag mutations for the three persistent flags", () => {
    const flags: Array<ChatToAgent> = [
      { type: "chat/setOnboardingFlag", key: "specModeOfferDismissed", value: true },
      { type: "chat/setOnboardingFlag", key: "specModeTooltipSeen", value: false },
      { type: "chat/setOnboardingFlag", key: "docActionsTooltipSeen", value: true },
    ];
    expect(flags.map((f) => f.type === "chat/setOnboardingFlag" && f.key)).toEqual([
      "specModeOfferDismissed",
      "specModeTooltipSeen",
      "docActionsTooltipSeen",
    ]);
  });
});
