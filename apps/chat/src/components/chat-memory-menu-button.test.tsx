/**
 * ChatMemoryMenuButton component tests.
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-15]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-STRIP]
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ChatMemoryMenuButton } from "./chat-memory-menu-button";

describe("ChatMemoryMenuButton", () => {
  it("opens the shared memory catalog with one click", async () => {
    const user = userEvent.setup();

    render(<ChatMemoryMenuButton onSelect={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Open memory menu" }));

    expect(await screen.findByText("SESSION MEMORY")).toBeInTheDocument();
    expect(screen.getByText("/afx-context save")).toBeInTheDocument();
    expect(screen.getByText("/afx-context history")).toBeInTheDocument();
    expect(screen.getByText("DISCUSSION")).toBeInTheDocument();
  });

  it("routes Save through the same dropdown catalog", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(<ChatMemoryMenuButton onSelect={onSelect} />);

    await user.click(screen.getByRole("button", { name: "Open memory menu" }));
    await user.click(
      await screen.findByRole("menuitem", { name: /Save: \/afx-context save Draft first/i }),
    );

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "context-save" }));
  });

  it("uses the quiet model-selector treatment in the composer toolbar", async () => {
    render(<ChatMemoryMenuButton onSelect={vi.fn()} size="composer" />);

    const menuButton = screen.getByRole("button", { name: "Open memory menu" });

    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(menuButton).toHaveAttribute("data-variant", "ghost");
    expect(menuButton).toHaveClass("font-mono");
    expect(menuButton.className).not.toContain("border-border");
    expect(menuButton).toHaveTextContent("Memory");
  });
});
