/**
 * Composer Intent strip tests.
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-1] [FR-3] [FR-9] [FR-13] [FR-17] [FR-18]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-STRIP]
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { IntentStrip, IntentStripHeaderExtras } from "./intent-strip";

describe("IntentStrip", () => {
  it("renders parent-aware slots and invokes onSlotChange for inactive steps", async () => {
    const user = userEvent.setup();
    const onSlotChange = vi.fn();

    render(<IntentStrip parentMode="explore" slot={1} onSlotChange={onSlotChange} />);

    expect(screen.getByRole("button", { name: "Default Intent" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "PRD Intent" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Code Intent" })).not.toBeInTheDocument();
    expect(screen.getByTestId("intent-tagline")).toHaveTextContent("Default");
    expect(screen.getByTestId("intent-tagline")).toHaveTextContent(
      "what you type is what you send",
    );

    await user.click(screen.getByRole("button", { name: "Ask Intent" }));
    expect(onSlotChange).toHaveBeenCalledWith(2);
  });

  it("uses semantic mode variables for the selected pill accent", () => {
    render(<IntentStrip parentMode="code" slot={2} onSlotChange={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Ask Intent" })).toHaveClass(
      "border-[var(--intent-accent-border)]",
      "bg-[var(--intent-accent-bg)]",
    );
  });
});

describe("IntentStripHeaderExtras", () => {
  it("shows no active-label chip or prompt annotation for expanded Default", () => {
    render(
      <IntentStripHeaderExtras
        parentMode="code"
        slot={1}
        onSlotChange={vi.fn()}
        collapsed={false}
      />,
    );

    expect(screen.queryByText("Default")).not.toBeInTheDocument();
    expect(screen.queryByText("Intent guide")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Preview injected prompt for Default" }),
    ).toBeInTheDocument();
  });

  it("turns the active-label chip into a switcher when collapsed", async () => {
    const user = userEvent.setup();
    const onSlotChange = vi.fn();

    render(
      <IntentStripHeaderExtras parentMode="code" slot={1} onSlotChange={onSlotChange} collapsed />,
    );

    await user.click(screen.getByRole("button", { name: "Switch Intent. Current: Default" }));
    await user.click(screen.getByRole("menuitemradio", { name: /Architect/ }));

    expect(onSlotChange).toHaveBeenCalledWith(3);
    expect(screen.queryByText("Intent guide")).not.toBeInTheDocument();
  });

  it("orders Preview before the collapsed intent switcher", () => {
    render(
      <IntentStripHeaderExtras
        parentMode="code"
        slot={1}
        onSlotChange={vi.fn()}
        collapsed
        previewAction={<button type="button">Preview</button>}
      />,
    );

    const preview = screen.getByRole("button", { name: "Preview" });
    const switcher = screen.getByRole("button", { name: "Switch Intent. Current: Default" });

    expect(preview.compareDocumentPosition(switcher)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("shows the prompt annotation for non-default intents", () => {
    render(
      <IntentStripHeaderExtras
        parentMode="explore"
        slot={4}
        onSlotChange={vi.fn()}
        collapsed={false}
      />,
    );

    expect(screen.getByText("Intent guide")).toHaveAttribute(
      "title",
      "Adds short intent guidance before your message. About 80 tokens.",
    );
    expect(screen.queryByText("PRD")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Preview injected prompt for PRD" }),
    ).toBeInTheDocument();
  });
});
