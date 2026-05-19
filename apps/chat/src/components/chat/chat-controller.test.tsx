/**
 * Chat controller tests.
 *
 * @see docs/specs/216-app-chat-window-componentization/design.md [DES-ARCH] [DES-STATE]
 */
import { act } from "react";

import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { AgentToChat, MessageOf } from "@afx/shared";
import type { Transport } from "@afx/transport";

import { initTransport } from "../../lib/bridge";
import {
  collectPromptHistory,
  createChatUid,
  persistChatViewState,
  readPersistedChatViewState,
  useChatBridgeSubscriptions,
  useChatController,
} from "./chat-controller";

const LEGACY_MARKER = `AFX-UI-${"ACTIONS"}`;

function createStatefulTransport(initialState?: unknown): Transport & { state: unknown } {
  let state = initialState;
  return {
    send: vi.fn(),
    on: vi.fn((_type: AgentToChat["type"], _handler: (msg: AgentToChat) => void) => () => {}),
    dispose: vi.fn(),
    getState: vi.fn(() => state),
    setState: vi.fn((next: unknown) => {
      state = next;
    }),
    get state() {
      return state;
    },
  };
}

function createControllableTransport(initialState?: unknown): Transport & {
  emit<T extends AgentToChat["type"]>(msg: MessageOf<AgentToChat, T>): void;
  state: unknown;
} {
  const listeners = new Map<AgentToChat["type"], Set<(msg: AgentToChat) => void>>();
  let state = initialState;

  return {
    send: vi.fn(),
    on(type, handler) {
      const existing = listeners.get(type) ?? new Set<(msg: AgentToChat) => void>();
      existing.add(handler as (msg: AgentToChat) => void);
      listeners.set(type, existing);
      return () => {
        existing.delete(handler as (msg: AgentToChat) => void);
      };
    },
    dispose: vi.fn(),
    getState: vi.fn(() => state),
    setState: vi.fn((next: unknown) => {
      state = next;
    }),
    emit(msg) {
      listeners.get(msg.type)?.forEach((handler) => handler(msg));
    },
    get state() {
      return state;
    },
  };
}

describe("chat controller", () => {
  it("reads and writes persisted chat view state without mutating unrelated state", () => {
    const transport = createStatefulTransport({ draft: "keep me" });
    initTransport(transport);

    persistChatViewState({
      messages: [{ id: "m1", role: "user", content: "hi", createdAt: 1 }],
      commandOutputs: [],
      noteEvents: [],
      workspaceMode: "spec",
    });

    expect(transport.state).toMatchObject({
      draft: "keep me",
      chatView: { workspaceMode: "spec" },
    });
    expect(readPersistedChatViewState()).toMatchObject({
      messages: [{ id: "m1", role: "user", content: "hi", createdAt: 1 }],
      workspaceMode: "spec",
    });

    persistChatViewState(null);
    expect(transport.state).toEqual({ draft: "keep me" });
  });

  it("hydrates mode-only empty chat state to avoid welcome-card flashes", () => {
    initTransport(
      createStatefulTransport({
        chatView: { messages: [], commandOutputs: [], noteEvents: [], workspaceMode: "spec" },
      }),
    );

    expect(readPersistedChatViewState()).toMatchObject({
      messages: [],
      commandOutputs: [],
      noteEvents: [],
      workspaceMode: "spec",
    });
  });

  it("scrubs obsolete machine-action blocks from persisted assistant rows", () => {
    initTransport(
      createStatefulTransport({
        chatView: {
          messages: [
            {
              id: "a1",
              role: "assistant",
              content: `Before.
<!-- ${LEGACY_MARKER}:START -->
{"actions":[]}
<!-- ${LEGACY_MARKER}:END -->
After.`,
              createdAt: 1,
            },
          ],
          commandOutputs: [],
          noteEvents: [],
        },
      }),
    );

    expect(readPersistedChatViewState()?.messages[0]).toMatchObject({
      id: "a1",
      content: "Before.\nAfter.",
    });
  });

  it("owns bridge subscription cleanup through a controller helper", () => {
    const unsubscribe = vi.fn();
    const transport = createStatefulTransport();
    vi.mocked(transport.on).mockReturnValue(unsubscribe);
    initTransport(transport);

    const { unmount } = renderHook(() =>
      useChatBridgeSubscriptions((bridge) => [bridge.on("chat/state", vi.fn())], []),
    );

    expect(transport.on).toHaveBeenCalledWith("chat/state", expect.any(Function));
    act(() => unmount());
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("collects bounded prompt history without duplicate adjacent prompts", () => {
    expect(
      collectPromptHistory(
        [
          { id: "u1", role: "user", content: "hello", createdAt: 1 },
          { id: "a1", role: "assistant", content: "hi", createdAt: 2 },
          { id: "u2", role: "user", content: "hello", createdAt: 3 },
          { id: "u3", role: "user", content: "next", createdAt: 4 },
        ],
        ["next", "local"],
      ),
    ).toEqual(["hello", "next", "local"]);
  });

  it("creates local chat ids when randomUUID is unavailable", () => {
    expect(createChatUid()).toMatch(/^(local-|[0-9a-f-]{10,})/i);
  });

  it("memoizes region slices so unrelated flag updates keep unaffected slice identities", () => {
    initTransport(createStatefulTransport());

    const { result, rerender } = renderHook(
      ({ chatHistory }) => useChatController({ flags: { chatHistory } }),
      { initialProps: { chatHistory: false } },
    );
    const { topBar, conversation, composer, footer, history } = result.current.slices;

    rerender({ chatHistory: true });

    expect(result.current.slices.topBar).toBe(topBar);
    expect(result.current.slices.conversation).toBe(conversation);
    expect(result.current.slices.composer).toBe(composer);
    expect(result.current.slices.footer).toBe(footer);
    expect(result.current.slices.history).not.toBe(history);
    expect(result.current.slices.history.enabled).toBe(true);
  });

  it("merges flags and keeps controller action identity stable across rerenders", () => {
    initTransport(createStatefulTransport());

    const { result, rerender } = renderHook(
      ({ topBar }) => useChatController({ flags: { topBar } }),
      {
        initialProps: { topBar: false },
      },
    );
    const persistAction = result.current.actions.persistChatViewState;
    const abort = result.current.actions.abort;
    const setMode = result.current.actions.setMode;
    const setThinkingLevel = result.current.actions.setThinkingLevel;
    const dispatchHostAction = result.current.actions.dispatchHostAction;

    expect(result.current.flags.topBar).toBe(false);
    expect(result.current.flags.composerDock).toBe(true);
    expect(result.current.historyStore).toBeNull();
    expect(result.current.slices.topBar.enabled).toBe(false);

    rerender({ topBar: true });

    expect(result.current.flags.topBar).toBe(true);
    expect(result.current.actions.persistChatViewState).toBe(persistAction);
    expect(result.current.actions.abort).toBe(abort);
    expect(result.current.actions.setMode).toBe(setMode);
    expect(result.current.actions.setThinkingLevel).toBe(setThinkingLevel);
    expect(result.current.actions.dispatchHostAction).toBe(dispatchHostAction);
  });

  it("hydrates lifted state from the persisted view-state on first mount", () => {
    initTransport(
      createStatefulTransport({
        chatView: {
          messages: [{ id: "m1", role: "user", content: "hello", createdAt: 1 }],
          commandOutputs: [
            {
              requestId: "r1",
              command: "ls",
              stdout: "out",
              stderr: "",
              createdAt: 1,
            },
          ],
          noteEvents: [{ id: "n1", content: "note", savedAt: 1 }],
          workspaceMode: "spec",
        },
      }),
    );

    const { result } = renderHook(() => useChatController());

    expect(result.current.state.messages).toHaveLength(1);
    expect(result.current.state.messages[0].id).toBe("m1");
    expect(result.current.state.commandOutputs).toHaveLength(1);
    expect(result.current.state.noteEvents).toHaveLength(1);
    expect(result.current.state.workspaceMode).toBe("spec");
    expect(result.current.state.hasReceivedStateSnapshot).toBe(true);
    expect(result.current.state.hasReceivedSettingsSnapshot).toBe(true);
    expect(result.current.state.runtime).toEqual({});
    expect(result.current.state.usage).toBeNull();
    expect(result.current.state.queued).toEqual([]);
  });

  it("starts in a clean state when no persisted view-state exists", () => {
    initTransport(createStatefulTransport());
    const { result } = renderHook(() => useChatController());

    expect(result.current.state.messages).toEqual([]);
    expect(result.current.state.workspaceMode).toBe("code");
    expect(result.current.state.hasReceivedStateSnapshot).toBe(false);
    expect(result.current.state.hasReceivedSettingsSnapshot).toBe(false);
  });

  it("preserves additive active-doc context fields from the host bridge", () => {
    const transport = createControllableTransport();
    initTransport(transport);
    const { result } = renderHook(() => useChatController());

    act(() => {
      transport.emit({
        type: "chat/activeDocContext",
        format: "sprint",
        section: "SPEC",
        docKind: "spec",
        feature: "postgresql-marketplace-backend-rewrite",
        filePath: "/repo/docs/specs/999-fleet/postgresql-marketplace-backend-rewrite.md",
        approvalStatus: "Draft",
        specStatus: "Draft",
        designStatus: "Draft",
        tasksStatus: "Draft",
        workSessionsSigned: 1,
        workSessionsTotal: 2,
        siblingPaths: {
          journal: "/repo/docs/specs/999-fleet/journal.md",
        },
        sectionOffsets: {
          spec: 22,
          design: 84,
          tasks: 140,
          sessions: 220,
        },
      });
    });

    expect(result.current.state.activeDocContext).toMatchObject({
      format: "sprint",
      docKind: "spec",
      feature: "postgresql-marketplace-backend-rewrite",
      siblingPaths: {
        journal: "/repo/docs/specs/999-fleet/journal.md",
      },
      sectionOffsets: {
        spec: 22,
        design: 84,
        tasks: 140,
        sessions: 220,
      },
      workSessionsSigned: 1,
      workSessionsTotal: 2,
    });
  });

  it("forces Intent compact when doc-actions is visible in Code or Explore mode", () => {
    const transport = createControllableTransport();
    initTransport(transport);
    const { result } = renderHook(() => useChatController());

    act(() => {
      transport.emit({
        type: "chat/activeDocContext",
        format: "sprint",
        section: "SPEC",
        docKind: "spec",
        feature: "postgresql-marketplace-backend-rewrite",
        filePath: "/repo/docs/specs/999-fleet/postgresql-marketplace-backend-rewrite.md",
        approvalStatus: "Draft",
      });
    });

    const intentPanel = result.current.composerPanelStackConfig.panels.find(
      (panel) => panel.id === "intent",
    );
    const docActionsPanel = result.current.composerPanelStackConfig.panels.find(
      (panel) => panel.id === "doc-actions",
    );

    expect(intentPanel?.forcedCollapsed).toBe(true);
    expect(docActionsPanel).toBeTruthy();
    expect(docActionsPanel?.actions).toBeTruthy();
    expect(
      result.current.composerPanelStackConfig.panels.some((panel) => panel.id === "mode-suggest"),
    ).toBe(false);
  });

  it("clears stale active-doc add-ons when a non-AFX file becomes active", () => {
    const transport = createControllableTransport();
    initTransport(transport);
    const { result } = renderHook(() => useChatController());

    act(() => {
      transport.emit({
        type: "chat/activeDocContext",
        format: "sprint",
        section: "SPEC",
        docKind: "spec",
        feature: "auth",
        filePath: "/repo/docs/specs/auth/auth.md",
        approvalStatus: "Draft",
        sectionOffsets: { spec: 11, design: 40, tasks: 80 },
      });
      transport.emit({
        type: "chat/activeDocContext",
        format: null,
        section: null,
        docKind: null,
        feature: null,
        filePath: null,
        approvalStatus: null,
      });
    });

    expect(result.current.state.activeDocContext).toEqual({
      format: null,
      section: null,
      docKind: null,
      feature: null,
      filePath: null,
      approvalStatus: null,
    });
  });

  it("shows modified files again when a fresh edit tool starts after dismissal", () => {
    const transport = createControllableTransport();
    initTransport(transport);
    const { result } = renderHook(() => useChatController());

    act(() => {
      transport.emit({
        type: "chat/messageStart",
        id: "a1",
        role: "assistant",
        createdAt: 1,
      });
      transport.emit({
        type: "chat/toolStart",
        toolCallId: "t1",
        toolName: "edit_file",
        args: { path: "apps/chat/src/views/chat.tsx" },
      });
    });

    expect(
      result.current.composerPanelStackConfig.panels.some((p) => p.id === "modified-files"),
    ).toBe(true);

    act(() => {
      result.current.actions.dismissComposerPanel("modified-files");
    });

    expect(
      result.current.composerPanelStackConfig.panels.some((p) => p.id === "modified-files"),
    ).toBe(false);

    act(() => {
      transport.emit({
        type: "chat/messageStart",
        id: "a2",
        role: "assistant",
        createdAt: 2,
      });
      transport.emit({
        type: "chat/toolStart",
        toolCallId: "t2",
        toolName: "edit_file",
        args: { path: "apps/chat/src/views/chat.tsx" },
      });
    });

    expect(
      result.current.composerPanelStackConfig.panels.some((p) => p.id === "modified-files"),
    ).toBe(true);
  });

  it("exposes derived flags and region slices instead of raw writers", () => {
    initTransport(createStatefulTransport());

    const { result } = renderHook(() => useChatController());

    // Writers are no longer part of the public surface — state ownership is
    // entirely encapsulated; ChatWindow consumes via state + actions + slices.
    expect("writers" in result.current).toBe(false);

    // Derived flags expose the computed view.
    expect(typeof result.current.derived.isStreaming).toBe("boolean");
    expect(typeof result.current.derived.isCompacting).toBe("boolean");
    expect(typeof result.current.derived.runtimeUnavailable).toBe("boolean");

    // Region slices are present and have the right shape.
    expect(result.current.slices.topBar.actions.onMemorySelect).toBeTypeOf("function");
    expect(result.current.slices.composer.workspaceMode).toBeTypeOf("string");
    expect(result.current.slices.footer.usageStatsEnabled).toBeTypeOf("boolean");
  });

  it("acceptHostWorkspaceMode honors a pending local intent set by setMode", () => {
    const transport = createStatefulTransport();
    initTransport(transport);

    const { result } = renderHook(() => useChatController());

    // User sets mode to "spec" — recorded as pending; bridge dispatch fires.
    act(() => {
      result.current.actions.setMode("spec");
    });
    expect(result.current.state.workspaceMode).toBe("spec");
    expect(transport.send).toHaveBeenCalledWith(
      expect.objectContaining({ type: "chat/setMode", mode: "spec" }),
    );

    // Late host snapshot says "code" — should be rejected because user's intent is "spec".
    let acceptedStaleHostMode = true;
    act(() => {
      acceptedStaleHostMode = result.current.actions.acceptHostWorkspaceMode("code");
    });
    expect(acceptedStaleHostMode).toBe(false);
    expect(result.current.state.workspaceMode).toBe("spec");

    // Host catches up and confirms "spec" — clears the pending intent.
    let acceptedConfirmingHostMode = false;
    act(() => {
      acceptedConfirmingHostMode = result.current.actions.acceptHostWorkspaceMode("spec");
    });
    expect(acceptedConfirmingHostMode).toBe(true);

    // After the pending is cleared, a host-driven mode change is accepted again.
    let acceptedFreshHostMode = false;
    act(() => {
      acceptedFreshHostMode = result.current.actions.acceptHostWorkspaceMode("explore");
    });
    expect(acceptedFreshHostMode).toBe(true);
    expect(result.current.state.workspaceMode).toBe("explore");
  });

  it("wires Composer Intent panels, footer labels, and bridge dispatch", () => {
    const transport = createStatefulTransport();
    initTransport(transport);

    const { result } = renderHook(() => useChatController());

    expect(result.current.composerPanelStackConfig.panels.some((p) => p.id === "intent")).toBe(
      true,
    );
    expect(result.current.slices.footer.intentLabel).toBeNull();

    act(() => {
      result.current.actions.setIntentSlot(2);
    });

    expect(result.current.slices.footer.intentLabel).toBe("Ask");
    expect(transport.send).toHaveBeenCalledWith(
      expect.objectContaining({ type: "chat/setIntentSlot", slot: 2 }),
    );

    act(() => {
      result.current.actions.submit({ draft: "Explain this" });
    });

    expect(transport.send).toHaveBeenCalledWith(
      expect.objectContaining({ type: "chat/send", content: "Explain this", intentSlot: 2 }),
    );

    act(() => {
      result.current.actions.setMode("explore");
    });
    expect(result.current.composerPanelStackConfig.panels.some((p) => p.id === "intent")).toBe(
      true,
    );

    act(() => {
      result.current.actions.setMode("spec");
    });
    expect(result.current.composerPanelStackConfig.panels.some((p) => p.id === "intent")).toBe(
      false,
    );
  });

  it("keeps fresh local Intent changes over stale host snapshots until confirmed", () => {
    const transport = createControllableTransport();
    initTransport(transport);

    const { result } = renderHook(() => useChatController());

    act(() => {
      result.current.actions.setIntentSlot(3);
      transport.emit({
        type: "agent/settingsSnapshot",
        requestId: "stale-intent",
        snapshot: {
          appearance: { theme: "meridian", style: "lyra", themes: [], styles: [] },
          engine: {
            rpcEnabled: false,
            agentBinary: "pi",
            bundledSkillsPath: "resources/skills/agenticflowx",
            bundledSkillCount: 0,
            ephemeral: false,
          },
          sdk: {
            enabled: true,
            defaultModel: "anthropic:claude-opus-4-5",
            ollamaBaseUrl: "",
            sessionDir: "",
          },
          context: { includeActiveFileContext: true },
          mode: { active: "code" },
          intent: {
            effective: { slot: 1, minimized: false },
            global: { slot: 1, minimized: false },
            hasWorkspaceOverride: false,
          },
          providers: [],
          externalAgents: [],
          diagnostics: { logLevel: "info" },
          telemetry: { enabled: true, vscodeTelemetryEnabled: true, effectiveEnabled: true },
          about: { extensionVersion: "2.0.0", bundledPiNpmVersion: "?" },
        },
      });
    });

    expect(result.current.slices.footer.intentLabel).toBe("Architect");

    act(() => {
      transport.emit({
        type: "agent/settingsSnapshot",
        requestId: "confirmed-intent",
        snapshot: {
          appearance: { theme: "meridian", style: "lyra", themes: [], styles: [] },
          engine: {
            rpcEnabled: false,
            agentBinary: "pi",
            bundledSkillsPath: "resources/skills/agenticflowx",
            bundledSkillCount: 0,
            ephemeral: false,
          },
          sdk: {
            enabled: true,
            defaultModel: "anthropic:claude-opus-4-5",
            ollamaBaseUrl: "",
            sessionDir: "",
          },
          context: { includeActiveFileContext: true },
          mode: { active: "code" },
          intent: {
            effective: { slot: 3, minimized: false },
            global: { slot: 3, minimized: false },
            hasWorkspaceOverride: false,
          },
          providers: [],
          externalAgents: [],
          diagnostics: { logLevel: "info" },
          telemetry: { enabled: true, vscodeTelemetryEnabled: true, effectiveEnabled: true },
          about: { extensionVersion: "2.0.0", bundledPiNpmVersion: "?" },
        },
      });
    });

    expect(result.current.slices.footer.intentLabel).toBe("Architect");
  });

  it("setThinkingLevel updates runtime locally and dispatches the bridge message", () => {
    const transport = createStatefulTransport();
    initTransport(transport);

    const { result } = renderHook(() => useChatController());

    act(() => {
      result.current.actions.setThinkingLevel("high");
    });

    expect(result.current.state.runtime.thinkingLevel).toBe("high");
    expect(transport.send).toHaveBeenCalledWith(
      expect.objectContaining({ type: "chat/setThinkingLevel", level: "high" }),
    );
  });

  it("abort and dispatchHostAction send their bridge messages", () => {
    const transport = createStatefulTransport();
    initTransport(transport);

    const { result } = renderHook(() => useChatController());

    act(() => {
      result.current.actions.abort();
    });
    expect(transport.send).toHaveBeenCalledWith({ type: "chat/abort" });

    act(() => {
      result.current.actions.dispatchHostAction("tasks.signOff", "file:///tasks.md");
    });
    expect(transport.send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "chat/hostAction",
        action: "tasks.signOff",
        uri: "file:///tasks.md",
      }),
    );
  });
});
