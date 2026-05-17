/**
 * ConversationPane tests.
 *
 * @see docs/specs/216-app-chat-window-componentization/design.md [DES-STATE] [DES-A11Y]
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ConversationPane } from "./conversation-pane";

describe("ConversationPane", () => {
  it("renders scroll viewport content and composes the scroll-to-latest button", () => {
    const onScrollToLatest = vi.fn();

    render(
      <ConversationPane showScrollButton onScrollToLatest={onScrollToLatest}>
        <div>timeline content</div>
      </ConversationPane>,
    );

    expect(screen.getByRole("region", { name: "Conversation" })).toBeInTheDocument();
    expect(screen.getByText("timeline content")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Scroll to latest" }));
    expect(onScrollToLatest).toHaveBeenCalledTimes(1);
  });
});
