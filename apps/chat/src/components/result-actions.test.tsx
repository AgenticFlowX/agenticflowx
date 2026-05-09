/**
 * ResultActions component tests.
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-16]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-STRIP]
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { parseResultActions } from "../lib/result-actions";
import { ResultActions } from "./result-actions";

describe("ResultActions", () => {
  it("renders nothing when no actions are present", () => {
    const { container } = render(<ResultActions actions={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders parsed actions as a subtle inline row without composer strip chrome", () => {
    const actions = parseResultActions("Next: /afx-task verify 2.3\nNext: /afx-task code 2.4");

    render(<ResultActions actions={actions} onSend={vi.fn()} />);

    expect(screen.getByTestId("result-actions-row")).toHaveAccessibleName("Next actions");
    expect(screen.getByText("Run next")).toBeInTheDocument();
    expect(screen.queryByText("NEXT")).not.toBeInTheDocument();
    expect(screen.queryByText(/·\s*2/)).not.toBeInTheDocument();
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

    render(<ResultActions actions={actions} onSend={onSend} />);
    fireEvent.click(screen.getByTestId("result-action-button"));

    expect(onSend).toHaveBeenCalledWith("/afx-task verify 2.3", actions[0]);
    expect(onDraft).not.toHaveBeenCalled();
  });

  it("sends supported draft-first commands on normal click instead of drafting", () => {
    const onDraft = vi.fn();
    const onSend = vi.fn();
    const actions = parseResultActions("Next: /afx-task code 2.3");

    render(<ResultActions actions={actions} onSend={onSend} />);
    fireEvent.click(screen.getByTestId("result-action-button"));

    expect(onSend).toHaveBeenCalledWith("/afx-task code 2.3", actions[0]);
    expect(onDraft).not.toHaveBeenCalled();
  });

  it("keeps shift-click on supported commands on the same send path", () => {
    const onDraft = vi.fn();
    const onSend = vi.fn();
    const actions = parseResultActions("Next: /afx-task code 2.3");

    render(<ResultActions actions={actions} onSend={onSend} />);
    fireEvent.click(screen.getByTestId("result-action-button"), { shiftKey: true });

    expect(onSend).toHaveBeenCalledWith("/afx-task code 2.3", actions[0]);
    expect(onDraft).not.toHaveBeenCalled();
  });

  it("keeps unknown commands unavailable instead of silently drafting", () => {
    const onDraft = vi.fn();
    const onSend = vi.fn();
    const actions = parseResultActions("Next: /afx-task deploy prod");

    render(<ResultActions actions={actions} onSend={onSend} />);
    fireEvent.click(screen.getByTestId("result-action-button"), { shiftKey: true });

    expect(screen.getByTestId("result-action-button")).toHaveAttribute("aria-disabled", "true");
    expect(onDraft).not.toHaveBeenCalled();
    expect(onSend).not.toHaveBeenCalled();
  });
});
