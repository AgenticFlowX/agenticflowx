/**
 * Chat route and shell flag contract tests.
 *
 * @see docs/specs/216-app-chat-window-componentization/design.md [DES-API] [DES-ROLLOUT]
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { createMockTransport } from "@afx/transport";

import { initTransport } from "../../lib/bridge";
import Chat from "../../views/chat";
import { type ChatProps, ChatWindow } from "./chat-window";

function renderRoute(props: Partial<ChatProps> = {}) {
  initTransport(createMockTransport());
  return render(<Chat {...createChatProps(props)} />);
}

function renderWindow(props: Partial<ChatProps> = {}, flags = {}) {
  initTransport(createMockTransport());
  return render(<ChatWindow {...createChatProps(props)} flags={flags} />);
}

describe("Chat route contract", () => {
  it("keeps the default route export rendering the ChatWindow shell", () => {
    renderRoute();

    expect(screen.getByRole("button", { name: "New session" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Ask AFX about this workspace/i)).toBeInTheDocument();
  });

  it("wires reserved attachment action and composer hint accessibility through the shell", () => {
    renderWindow();

    expect(screen.getByRole("button", { name: "Attach file or image" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Chat composer" })).toHaveAttribute(
      "aria-describedby",
      "afx-chat-composer-hint",
    );
  });

  it("returns focus to the composer after top-bar session actions", async () => {
    renderWindow();

    fireEvent.click(screen.getByRole("button", { name: "New session" }));

    await waitFor(() => {
      expect(screen.getByRole("textbox", { name: "Chat composer" })).toHaveFocus();
    });
  });

  it("does not submit while IME composition is committing with Enter", () => {
    const onDraftChange = vi.fn();
    const transport = createMockTransport();
    initTransport(transport);
    render(
      <ChatWindow
        {...createChatProps({ draft: "かな", onDraftChange })}
        flags={{ topBar: false }}
      />,
    );
    const sentBefore = transport.getLog().filter((entry) => entry.type === "chat/send").length;

    screen.getByRole("textbox", { name: "Chat composer" }).dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        cancelable: true,
        isComposing: true,
      }),
    );

    const sentAfter = transport.getLog().filter((entry) => entry.type === "chat/send").length;
    expect(sentAfter).toBe(sentBefore);
    expect(onDraftChange).not.toHaveBeenCalledWith("");
  });

  it("lets internal region flags hide top-level regions without product settings", () => {
    renderWindow({}, { topBar: false, composerDock: false });

    expect(screen.queryByRole("button", { name: "New session" })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByText(/Chat-first by default/i)).toBeInTheDocument();
  });
});

function createChatProps(overrides: Partial<ChatProps> = {}): ChatProps {
  return {
    draft: "",
    onDraftChange: vi.fn(),
    promptHistory: [],
    onPromptHistoryAppend: vi.fn(),
    ...overrides,
  };
}
