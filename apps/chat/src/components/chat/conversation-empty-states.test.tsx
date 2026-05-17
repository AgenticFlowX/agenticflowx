/**
 * Conversation empty-state tests.
 *
 * @see docs/specs/216-app-chat-window-componentization/design.md [DES-UI]
 * @see docs/specs/212-app-chat-messages/design.md [DES-MESSAGES-WELCOME-SPEC]
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { EMPTY_DOC_CTX } from "../../lib/doc-actions";
import {
  AgentSetupState,
  EmptyState,
  SpecModeWelcome,
  WelcomeShell,
} from "./conversation-empty-states";

describe("conversation empty states", () => {
  it("renders the initial agent setup and workspace loading shells", () => {
    const { rerender } = render(<AgentSetupState />);
    expect(screen.getByText("Connecting to agent…")).toBeInTheDocument();

    rerender(<WelcomeShell />);
    expect(screen.getByText("Loading workspace…")).toBeInTheDocument();
  });

  it("renders Code welcome actions and inserts starter prompts", () => {
    const onInsert = vi.fn();
    const onSwitchToSpec = vi.fn();

    render(
      <EmptyState
        workspaceMode="code"
        onInsert={onInsert}
        onSwitchToSpec={onSwitchToSpec}
        rpcEnabled={false}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Plan in Spec mode" }));
    expect(onSwitchToSpec).toHaveBeenCalled();
    expect(onInsert).toHaveBeenCalledWith("/afx-spec new ");
  });

  it("renders Explore copy without Code-only planning CTA", () => {
    render(<EmptyState workspaceMode="explore" onInsert={vi.fn()} />);

    expect(screen.getByText(/Read-only\. Use it to inspect code/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Plan in Spec mode" })).not.toBeInTheDocument();
  });

  it("renders Spec onboarding and auto-sends deterministic actions", () => {
    const onAutoSend = vi.fn();

    render(
      <SpecModeWelcome docContext={EMPTY_DOC_CTX} onInsert={vi.fn()} onAutoSend={onAutoSend} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Resume workflow.*next best move/i }));
    fireEvent.click(screen.getByRole("button", { name: "Run" }));

    expect(onAutoSend).toHaveBeenCalledWith("/afx-next");
  });
});
