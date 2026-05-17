/**
 * ChatWindow render-isolation tests.
 *
 * @see docs/specs/216-app-chat-window-componentization/design.md [DES-PERF]
 */
import { memo, useState } from "react";

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { AgentRuntimeStatus, AgentToChat } from "@afx/shared";
import type { Transport } from "@afx/transport";

import { initTransport } from "../../lib/bridge";
import { ChatWindow } from "./chat-window";

const timelineRender = vi.hoisted(() => ({ count: 0 }));
const topBarRender = vi.hoisted(() => ({ count: 0 }));
const footerRender = vi.hoisted(() => ({ count: 0 }));
const actionsRender = vi.hoisted(() => ({ count: 0 }));

vi.mock("./conversation-timeline", () => ({
  ConversationTimeline: memo(function MockConversationTimeline() {
    timelineRender.count += 1;
    return <div role="log">timeline</div>;
  }),
}));

vi.mock("./chat-top-bar", () => ({
  ChatTopBar: memo(function MockChatTopBar() {
    topBarRender.count += 1;
    return <div data-testid="mock-top-bar" />;
  }),
}));

vi.mock("./composer-footer", () => ({
  ComposerFooter: memo(function MockComposerFooter() {
    footerRender.count += 1;
    return <div data-testid="mock-footer" />;
  }),
}));

vi.mock("./composer-actions", () => ({
  ComposerActions: memo(function MockComposerActions() {
    actionsRender.count += 1;
    return <div data-testid="mock-actions" />;
  }),
}));

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

const readyStatus: AgentRuntimeStatus = {
  phase: "ready",
  running: true,
  isStreaming: false,
  checkedAt: 1,
  consecutiveFailures: 0,
};

const busyStatus: AgentRuntimeStatus = {
  ...readyStatus,
  phase: "busy",
  isStreaming: true,
};

describe("ChatWindow render isolation", () => {
  it("does not rerender the memoized timeline when only composer draft changes", () => {
    timelineRender.count = 0;
    initTransport(
      createStatefulTransport({
        chatView: {
          messages: [{ id: "m1", role: "user", content: "hello", createdAt: 1 }],
          commandOutputs: [],
          noteEvents: [],
          workspaceMode: "code",
        },
      }),
    );

    const onPromptHistoryAppend = vi.fn();
    function Wrapper() {
      const [draft, setDraft] = useState("");
      return (
        <ChatWindow
          draft={draft}
          onDraftChange={setDraft}
          promptHistory={[]}
          onPromptHistoryAppend={onPromptHistoryAppend}
        />
      );
    }

    render(<Wrapper />);
    const initialTimelineRenders = timelineRender.count;
    expect(initialTimelineRenders).toBeGreaterThan(0);

    fireEvent.change(screen.getByRole("textbox", { name: "Chat composer" }), {
      target: { value: "typing" },
    });

    expect(timelineRender.count).toBe(initialTimelineRenders);
  });

  it("does not rerender the memoized timeline when only activity/status props change", () => {
    timelineRender.count = 0;
    initTransport(
      createStatefulTransport({
        chatView: {
          messages: [{ id: "m1", role: "user", content: "hello", createdAt: 1 }],
          commandOutputs: [],
          noteEvents: [],
          workspaceMode: "code",
        },
      }),
    );

    const props = {
      draft: "",
      onDraftChange: vi.fn(),
      promptHistory: [] as string[],
      onPromptHistoryAppend: vi.fn(),
    };
    const { rerender } = render(<ChatWindow {...props} agentStatus={readyStatus} />);
    const initialTimelineRenders = timelineRender.count;
    expect(initialTimelineRenders).toBeGreaterThan(0);

    rerender(<ChatWindow {...props} agentStatus={busyStatus} />);

    expect(timelineRender.count).toBe(initialTimelineRenders);
  });

  it("does not rerender the memoized ChatTopBar when only the composer draft changes", () => {
    topBarRender.count = 0;
    initTransport(createStatefulTransport({}));

    const onPromptHistoryAppend = vi.fn();
    function Wrapper() {
      const [draft, setDraft] = useState("");
      return (
        <ChatWindow
          draft={draft}
          onDraftChange={setDraft}
          promptHistory={[]}
          onPromptHistoryAppend={onPromptHistoryAppend}
        />
      );
    }

    render(<Wrapper />);
    const initialTopBarRenders = topBarRender.count;
    expect(initialTopBarRenders).toBeGreaterThan(0);

    fireEvent.change(screen.getByRole("textbox", { name: "Chat composer" }), {
      target: { value: "typing" },
    });

    expect(topBarRender.count).toBe(initialTopBarRenders);
  });

  it("does not rerender the memoized ComposerFooter when only the composer draft changes", () => {
    footerRender.count = 0;
    initTransport(createStatefulTransport({}));

    const onPromptHistoryAppend = vi.fn();
    function Wrapper() {
      const [draft, setDraft] = useState("");
      return (
        <ChatWindow
          draft={draft}
          onDraftChange={setDraft}
          promptHistory={[]}
          onPromptHistoryAppend={onPromptHistoryAppend}
        />
      );
    }

    render(<Wrapper />);
    const initialFooterRenders = footerRender.count;
    expect(initialFooterRenders).toBeGreaterThan(0);

    fireEvent.change(screen.getByRole("textbox", { name: "Chat composer" }), {
      target: { value: "typing" },
    });

    expect(footerRender.count).toBe(initialFooterRenders);
  });

  it("does not rerender the memoized ComposerActions when draft transitions are non-emptiness toggles", () => {
    // Only empty/non-empty transitions should affect ComposerActions props.
    actionsRender.count = 0;
    initTransport(createStatefulTransport({}));

    const onPromptHistoryAppend = vi.fn();
    function Wrapper() {
      const [draft, setDraft] = useState("typing");
      return (
        <ChatWindow
          draft={draft}
          onDraftChange={setDraft}
          promptHistory={[]}
          onPromptHistoryAppend={onPromptHistoryAppend}
        />
      );
    }

    render(<Wrapper />);
    const initialActionsRenders = actionsRender.count;
    expect(initialActionsRenders).toBeGreaterThan(0);

    // Same `canSend` value (still has draft, still not disabled) — no rerender.
    fireEvent.change(screen.getByRole("textbox", { name: "Chat composer" }), {
      target: { value: "typing more" },
    });

    expect(actionsRender.count).toBe(initialActionsRenders);
  });
});
