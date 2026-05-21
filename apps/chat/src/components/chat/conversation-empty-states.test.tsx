/**
 * Conversation empty-state tests.
 *
 * @see docs/specs/216-app-chat-window-componentization/design.md [DES-UI]
 * @see docs/specs/212-app-chat-messages/design.md [DES-MESSAGES-WELCOME-SPEC]
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { createMockTransport } from "@afx/transport";

import { initTransport } from "../../lib/bridge";
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

  it("renders Code welcome action tiles and opens Spec planning", () => {
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

    fireEvent.click(screen.getByRole("button", { name: "Spec: Plan" }));
    expect(onSwitchToSpec).toHaveBeenCalled();
    expect(onInsert).toHaveBeenCalledWith("/afx-spec new ");
  });

  it("opens Workbench from the Code welcome workflow tile", () => {
    const transport = createMockTransport();
    initTransport(transport);

    render(<EmptyState workspaceMode="code" onInsert={vi.fn()} rpcEnabled={false} />);

    fireEvent.click(screen.getByRole("button", { name: "Workflow: Open" }));

    expect(transport.getLog().some((entry) => entry.type === "chat/openWorkbench")).toBe(true);
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

  it("opens Workbench from Spec onboarding", () => {
    const transport = createMockTransport();
    initTransport(transport);

    render(<SpecModeWelcome docContext={EMPTY_DOC_CTX} onInsert={vi.fn()} onAutoSend={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Open Workbench/i }));

    expect(transport.getLog().some((entry) => entry.type === "chat/openWorkbench")).toBe(true);
  });
});
