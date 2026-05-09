/**
 * ResultActions component tests.
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-15]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-STRIP]
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { parseResultActions } from "../lib/result-actions";
import { ResultActions } from "./result-actions";

describe("ResultActions", () => {
  it("renders nothing when no actions are present", () => {
    const { container } = render(<ResultActions actions={[]} onDraft={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders parsed actions as buttons", () => {
    const actions = parseResultActions("Next: /afx-task verify 2.3\nNext: /afx-task code 2.4");

    render(<ResultActions actions={actions} onDraft={vi.fn()} onSend={vi.fn()} />);

    expect(screen.getByText(/Next/i)).toBeInTheDocument();
    expect(screen.getByText(/·\s*2/)).toBeInTheDocument();
    expect(screen.getAllByTestId("result-action-button")).toHaveLength(2);
    expect(screen.getByRole("button", { name: /Verify: \/afx-task verify 2\.3/i }));
    expect(
      screen.getByRole("button", { name: /Verify: \/afx-task verify 2\.3/i }),
    ).not.toHaveAttribute("title");
    expect(screen.getByRole("button", { name: /Verify: \/afx-task verify 2\.3/i })).toHaveAttribute(
      "data-group",
      "quality",
    );
  });

  it("sends auto-send supported commands on normal click", () => {
    const onDraft = vi.fn();
    const onSend = vi.fn();
    const actions = parseResultActions("Next: /afx-task verify 2.3");

    render(<ResultActions actions={actions} onDraft={onDraft} onSend={onSend} />);
    fireEvent.click(screen.getByTestId("result-action-button"));

    expect(onSend).toHaveBeenCalledWith("/afx-task verify 2.3", actions[0]);
    expect(onDraft).not.toHaveBeenCalled();
  });

  it("drafts supported commands that are not auto-send on normal click", () => {
    const onDraft = vi.fn();
    const onSend = vi.fn();
    const actions = parseResultActions("Next: /afx-task code 2.3");

    render(<ResultActions actions={actions} onDraft={onDraft} onSend={onSend} />);
    fireEvent.click(screen.getByTestId("result-action-button"));

    expect(onDraft).toHaveBeenCalledWith("/afx-task code 2.3", actions[0]);
    expect(onSend).not.toHaveBeenCalled();
  });

  it("shift-click sends supported draft-first commands", () => {
    const onDraft = vi.fn();
    const onSend = vi.fn();
    const actions = parseResultActions("Next: /afx-task code 2.3");

    render(<ResultActions actions={actions} onDraft={onDraft} onSend={onSend} />);
    fireEvent.click(screen.getByTestId("result-action-button"), { shiftKey: true });

    expect(onSend).toHaveBeenCalledWith("/afx-task code 2.3", actions[0]);
    expect(onDraft).not.toHaveBeenCalled();
  });

  it("keeps unknown commands draft-only even on shift-click", () => {
    const onDraft = vi.fn();
    const onSend = vi.fn();
    const actions = parseResultActions("Next: /afx-task deploy prod");

    render(<ResultActions actions={actions} onDraft={onDraft} onSend={onSend} />);
    fireEvent.click(screen.getByTestId("result-action-button"), { shiftKey: true });

    expect(onDraft).toHaveBeenCalledWith("/afx-task deploy prod", actions[0]);
    expect(onSend).not.toHaveBeenCalled();
  });
});
