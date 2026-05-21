/**
 * @see docs/specs/100-package-shared/spec.md [FR-1] [FR-2] [FR-4]
 * @see docs/specs/100-package-shared/design.md [DES-TEST]
 */
import { describe, expect, it } from "vitest";

import type { AgentCommand, AgentStatus } from "./agent";
import type { AgentToChat, ChatToAgent, MessageOf } from "./messages";
import type { FocusGroup, FocusOption, SignOffSummary } from "./workbench-types";

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
      filePath: "docs/specs/auth/spec.md",
      approvalStatus: "Draft",
    };
    expect(message.docKind).toBe("spec");
    expect(message.feature).toBe("auth");
    expect(message.filePath).toBe("docs/specs/auth/spec.md");
  });

  // @see docs/specs/100-package-shared/design.md [DES-SHARED-CHAT-PROTOCOL]
  it("supports additive active-doc context fields without requiring them", () => {
    type ActiveDocContextMessage = MessageOf<AgentToChat, "chat/activeDocContext">;
    const oldPayload: ActiveDocContextMessage = {
      type: "chat/activeDocContext",
      format: "standard",
      section: "TASKS",
      docKind: "tasks",
      feature: "auth",
      // tasks.md goes Draft → Living; pre-Sign-Off state is Draft.
      approvalStatus: "Draft",
    };
    const newPayload: ActiveDocContextMessage = {
      ...oldPayload,
      taskPhases: [
        {
          number: 1,
          name: "Build",
          completed: 0,
          total: 1,
          line: 12,
          items: [{ text: "Wire bridge", completed: false, line: 13 }],
        },
      ],
      signOff: {
        ready: true,
        signable: true,
        allTasksChecked: true,
        allAgentVerified: true,
        pendingTasks: 0,
        pendingAgentRows: 0,
        pendingHumanRows: 2,
        alreadyLiving: false,
      },
      parsedFocuses: [
        {
          id: "phase-1",
          label: "Phase 1: Build",
          slug: "phase-1-build",
          excerpt: "Bridge tasks for the active phase.",
        },
      ],
      specStatus: "Approved",
      designStatus: "Approved",
      // sibling tasks.md still Draft (not yet signed off)
      tasksStatus: "Draft",
      tasksCompleted: 3,
      tasksTotal: 4,
      workSessionsSigned: 1,
      workSessionsTotal: 2,
      siblingPaths: {
        spec: "docs/specs/auth/spec.md",
        design: "docs/specs/auth/design.md",
        tasks: "docs/specs/auth/tasks.md",
        journal: "docs/specs/auth/journal.md",
      },
      sectionOffsets: {
        sessions: 120,
      },
    };

    expect(oldPayload.taskPhases).toBeUndefined();
    expect(newPayload.taskPhases?.[0]?.items[0]?.text).toBe("Wire bridge");
    expect(newPayload.parsedFocuses?.[0]?.excerpt).toBe("Bridge tasks for the active phase.");
    expect(newPayload.signOff?.pendingHumanRows).toBe(2);
    expect(newPayload.siblingPaths?.journal).toBe("docs/specs/auth/journal.md");
    expect(newPayload.sectionOffsets?.sessions).toBe(120);
    expect(newPayload.workSessionsSigned).toBe(1);
  });

  // @see docs/specs/211-app-chat-composer/spec.md [FR-15]
  it("exports focus and sign-off shared types for future UI payloads", () => {
    const focus: FocusOption = {
      id: "des-data",
      label: "[DES-DATA] Data Model",
      slug: "data-model",
      commandSuffix: "des-data",
      excerpt: "State shape and persistence boundaries.",
      line: 42,
    };
    const group: FocusGroup = { label: "FROM THIS DOC", items: [focus] };
    const signOff: SignOffSummary = {
      ready: false,
      signable: false,
      allTasksChecked: true,
      allAgentVerified: false,
      pendingTasks: 0,
      pendingAgentRows: 1,
      pendingHumanRows: 0,
      alreadyLiving: false,
    };

    expect(group.items[0]?.commandSuffix).toBe("des-data");
    expect(group.items[0]?.excerpt).toBe("State shape and persistence boundaries.");
    expect(signOff.ready).toBe(false);
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

  it("supports chat/openWorkbench from onboarding surfaces", () => {
    const msg: ChatToAgent = { type: "chat/openWorkbench", requestId: "workbench" };
    expect(msg.type).toBe("chat/openWorkbench");
  });

  it("supports scoped Composer Intent settings mutations", () => {
    const messages: ChatToAgent[] = [
      { type: "chat/setIntentScope", requestId: "intent-global", scope: "global", slot: 2 },
      {
        type: "chat/setIntentScope",
        requestId: "intent-workspace",
        scope: "workspace",
        slot: 4,
        minimized: true,
      },
      { type: "chat/clearIntentWorkspace", requestId: "intent-clear" },
    ];

    expect(messages.map((message) => message.type)).toEqual([
      "chat/setIntentScope",
      "chat/setIntentScope",
      "chat/clearIntentWorkspace",
    ]);
  });
});
