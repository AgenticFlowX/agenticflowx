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

  it("renders parsed actions as a single run-next rail without composer strip chrome", () => {
    const actions = parseResultActions("Next: /afx-task verify 2.3\nNext: /afx-task code 2.4");

    render(<ResultActions actions={actions} onSend={vi.fn()} onInsert={vi.fn()} />);

    expect(screen.getByTestId("result-actions-row")).toHaveAccessibleName("Next actions");
    expect(screen.getByText("Run next")).toBeInTheDocument();
    expect(screen.queryByText("NEXT")).not.toBeInTheDocument();
    expect(screen.queryByText(/·\s*2/)).not.toBeInTheDocument();
    expect(screen.getAllByTestId("result-action-button")).toHaveLength(2);
    expect(screen.getByRole("button", { name: /Run Verify: \/afx-task verify 2\.3/i }));
    expect(
      screen.getByRole("button", { name: /Run Verify: \/afx-task verify 2\.3/i }),
    ).not.toHaveAttribute("title");
    expect(
      screen.getByRole("button", { name: /Run Verify: \/afx-task verify 2\.3/i }),
    ).toHaveAttribute("data-group", "quality");
  });

  it("sends auto-send supported commands on normal click", () => {
    const onDraft = vi.fn();
    const onSend = vi.fn();
    const actions = parseResultActions("Next: /afx-task verify 2.3");

    render(<ResultActions actions={actions} onSend={onSend} onInsert={onDraft} />);
    fireEvent.click(screen.getByTestId("result-action-button"));

    expect(onSend).toHaveBeenCalledWith("/afx-task verify 2.3", actions[0]);
    expect(onDraft).not.toHaveBeenCalled();
  });

  it("inserts supported draft-first commands on normal click", () => {
    const onDraft = vi.fn();
    const onSend = vi.fn();
    const actions = parseResultActions("Next: /afx-task code 2.3");

    render(<ResultActions actions={actions} onSend={onSend} onInsert={onDraft} />);
    fireEvent.click(screen.getByTestId("result-action-button"));

    expect(onDraft).toHaveBeenCalledWith("/afx-task code 2.3", actions[0]);
    expect(onSend).not.toHaveBeenCalled();
  });

  it("keeps shift-click on draft-first commands on the insert path", () => {
    const onDraft = vi.fn();
    const onSend = vi.fn();
    const actions = parseResultActions("Next: /afx-task code 2.3");

    render(<ResultActions actions={actions} onSend={onSend} onInsert={onDraft} />);
    fireEvent.click(screen.getByTestId("result-action-button"), { shiftKey: true });

    expect(onDraft).toHaveBeenCalledWith("/afx-task code 2.3", actions[0]);
    expect(onSend).not.toHaveBeenCalled();
  });

  it("keeps unknown commands unavailable instead of silently drafting", () => {
    const onDraft = vi.fn();
    const onSend = vi.fn();
    const actions = parseResultActions("Next: /afx-task deploy prod");

    render(<ResultActions actions={actions} onSend={onSend} onInsert={onDraft} />);
    fireEvent.click(screen.getByTestId("result-action-button"), { shiftKey: true });

    expect(screen.getByTestId("result-action-button")).toHaveAttribute("aria-disabled", "true");
    expect(onDraft).not.toHaveBeenCalled();
    expect(onSend).not.toHaveBeenCalled();
  });

  it("preserves long commands in accessible names and truncates visible command text", () => {
    const longSpec = "dapi-394-warm-container-app-poc-with-approval-gates-and-long-name";
    const longCommand = `/afx-sprint design ${longSpec} --approve`;
    const actions = parseResultActions(`Next: ${longCommand}`);

    render(<ResultActions actions={actions} onSend={vi.fn()} onInsert={vi.fn()} />);

    const button = screen.getByRole("button", {
      name: `Insert Refine Design: ${longCommand}`,
    });
    expect(button).toHaveAccessibleName(`Insert Refine Design: ${longCommand}`);
    expect(button).toHaveAttribute("data-mode", "insert");
    expect(screen.getByText(longCommand)).toHaveClass("truncate");
  });
});
