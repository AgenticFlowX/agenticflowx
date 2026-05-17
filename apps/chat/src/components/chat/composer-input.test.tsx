/**
 * ComposerInput tests.
 *
 * @see docs/specs/216-app-chat-window-componentization/design.md [DES-FILES] [DES-A11Y]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-KEYS]
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ComposerInput, getComposerPlaceholder } from "./composer-input";

describe("ComposerInput", () => {
  it("renders accessible compose form and dispatches textarea events", () => {
    const onChange = vi.fn();
    const onKeyDown = vi.fn();

    render(
      <ComposerInput
        workspaceMode="code"
        draft="hello"
        onChange={onChange}
        onKeyDown={onKeyDown}
        placeholder="Ask AFX"
        disabled={false}
        isSystemCommand={false}
        describedBy="footer-hint"
      >
        <button type="button">Send</button>
      </ComposerInput>,
    );

    expect(screen.getByRole("form", { name: "Compose message" })).toBeInTheDocument();
    const textbox = screen.getByRole("textbox", { name: "Chat composer" });
    expect(textbox).toHaveValue("hello");
    expect(textbox).toHaveAttribute("aria-describedby", "footer-hint");

    fireEvent.change(textbox, { target: { value: "hello!" } });
    fireEvent.keyDown(textbox, { key: "Enter" });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onKeyDown).toHaveBeenCalledTimes(1);
  });

  it("mounts helper popovers through the input boundary", () => {
    render(
      <ComposerInput
        workspaceMode="code"
        draft=""
        onChange={vi.fn()}
        onKeyDown={vi.fn()}
        placeholder="Ask AFX"
        disabled={false}
        isSystemCommand={false}
        helpers={<div>Slash helper</div>}
      >
        <button type="button">Send</button>
      </ComposerInput>,
    );

    expect(screen.getByText("Slash helper")).toBeInTheDocument();
  });

  it("anchors helpers above the textarea so popovers stay attached to the composer", () => {
    render(
      <ComposerInput
        workspaceMode="code"
        draft="/af"
        onChange={vi.fn()}
        onKeyDown={vi.fn()}
        placeholder="Ask AFX"
        disabled={false}
        isSystemCommand={false}
        helpers={<div data-testid="slash-popover">Slash items</div>}
      >
        <button type="button">Send</button>
      </ComposerInput>,
    );

    const popover = screen.getByTestId("slash-popover");
    const form = screen.getByRole("form", { name: "Compose message" });
    // Popover must precede the form in DOM order so it visually sits above the textarea.
    expect(popover.compareDocumentPosition(form) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("forwards prompt-history navigation keys to the parent handler", () => {
    const onKeyDown = vi.fn();
    render(
      <ComposerInput
        workspaceMode="code"
        draft=""
        onChange={vi.fn()}
        onKeyDown={onKeyDown}
        placeholder="Ask AFX"
        disabled={false}
        isSystemCommand={false}
      >
        <button type="button">Send</button>
      </ComposerInput>,
    );

    const textbox = screen.getByRole("textbox", { name: "Chat composer" });
    fireEvent.keyDown(textbox, { key: "ArrowUp" });
    fireEvent.keyDown(textbox, { key: "ArrowDown" });

    expect(onKeyDown).toHaveBeenCalledTimes(2);
    expect(onKeyDown.mock.calls[0][0].key).toBe("ArrowUp");
    expect(onKeyDown.mock.calls[1][0].key).toBe("ArrowDown");
  });

  it("forwards IME composition state on Enter so the parent can guard submit", () => {
    const onKeyDown = vi.fn();
    render(
      <ComposerInput
        workspaceMode="code"
        draft="日本"
        onChange={vi.fn()}
        onKeyDown={onKeyDown}
        placeholder="Ask AFX"
        disabled={false}
        isSystemCommand={false}
      >
        <button type="button">Send</button>
      </ComposerInput>,
    );

    const textbox = screen.getByRole("textbox", { name: "Chat composer" });
    // Enter pressed mid-composition should still reach the parent so it can decide whether to submit.
    fireEvent.keyDown(textbox, { key: "Enter", isComposing: true });
    expect(onKeyDown).toHaveBeenCalledTimes(1);
    const event = onKeyDown.mock.calls[0][0];
    expect(event.key).toBe("Enter");
    // The parent reads `event.nativeEvent.isComposing` — verify the field is reachable on the event.
    expect("isComposing" in event.nativeEvent).toBe(true);
  });

  it("builds state-aware placeholders", () => {
    expect(
      getComposerPlaceholder({
        isCheckingAgent: false,
        runtimeUnconfigured: false,
        rpcEnabled: false,
        runtimeUnavailable: false,
        isCompacting: false,
        isStreaming: false,
        workspaceMode: "spec",
      }),
    ).toMatch(/Spec mode/);
  });

  it("renders shell warning row for system commands", () => {
    render(
      <ComposerInput
        workspaceMode="code"
        draft="!ls"
        onChange={vi.fn()}
        onKeyDown={vi.fn()}
        placeholder="Run shell"
        disabled={false}
        isSystemCommand
      >
        <button type="button">Send</button>
      </ComposerInput>,
    );

    expect(screen.getByText("⚠ Shell · output is local only")).toBeInTheDocument();
  });
});
