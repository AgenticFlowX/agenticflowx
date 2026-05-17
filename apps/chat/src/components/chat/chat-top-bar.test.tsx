/**
 * ChatTopBar tests.
 *
 * @see docs/specs/216-app-chat-window-componentization/design.md [DES-UI] [DES-FILES]
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { AgentRuntimeStatus } from "@afx/shared";

import { ChatTopBar, type ChatTopBarRuntime } from "./chat-top-bar";

const readyStatus: AgentRuntimeStatus = {
  phase: "ready",
  running: true,
  isStreaming: false,
  checkedAt: 1,
  consecutiveFailures: 0,
};

const runtime: ChatTopBarRuntime = {
  thinkingLevel: "medium",
  steeringMode: "all",
  followUpMode: "one-at-a-time",
  autoCompactionEnabled: true,
  autoRetryEnabled: true,
  isCompacting: false,
  sessionId: "s1",
  sessionName: "Session",
  messageCount: 0,
  pendingMessageCount: 0,
  rpcEnabled: false,
};

describe("ChatTopBar", () => {
  it("dispatches top-bar actions", () => {
    const onNewSession = vi.fn();
    const onCompact = vi.fn();
    const onRestartAgent = vi.fn();

    render(
      <ChatTopBar
        status={readyStatus}
        runtime={runtime}
        onNewSession={onNewSession}
        onCompact={onCompact}
        onMemorySelect={vi.fn()}
        onRestartAgent={onRestartAgent}
      />,
    );

    expect(screen.getByRole("toolbar", { name: "Chat actions" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Compact session" }));
    fireEvent.click(screen.getByRole("button", { name: "New session" }));
    fireEvent.click(screen.getByRole("button", { name: "Restart agent" }));

    expect(onCompact).toHaveBeenCalledTimes(1);
    expect(onNewSession).toHaveBeenCalledTimes(1);
    expect(onRestartAgent).toHaveBeenCalledTimes(1);
  });

  it("accepts reserved extra actions without relayout", () => {
    render(
      <ChatTopBar
        status={readyStatus}
        runtime={runtime}
        onNewSession={vi.fn()}
        onCompact={vi.fn()}
        onMemorySelect={vi.fn()}
        onRestartAgent={vi.fn()}
        extraActions={<button type="button">Load history</button>}
      />,
    );

    expect(screen.getByRole("button", { name: "Load history" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New session" })).toBeInTheDocument();
  });

  it("disables compact/new-session when runtime is busy or disconnected", () => {
    render(
      <ChatTopBar
        checking={false}
        status={{ ...readyStatus, phase: "disconnected", running: false, isStreaming: true }}
        runtime={runtime}
        onNewSession={vi.fn()}
        onCompact={vi.fn()}
        onMemorySelect={vi.fn()}
        onRestartAgent={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Compact session" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "New session" })).toBeDisabled();
  });
});
