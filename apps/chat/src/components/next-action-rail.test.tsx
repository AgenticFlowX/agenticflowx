/** NextActionRail component tests. */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { type AfxUiAction, NextActionRail } from "./next-action-rail";

const actions: AfxUiAction[] = [
  {
    rank: 2,
    label: "Review design",
    command: "/afx-design review onboarding",
    mode: "insert",
    vocabulary: "Review = quality judgment for ambiguity, risk, and readiness.",
  },
  {
    rank: 1,
    label: "Approve spec",
    command: "/afx-spec approve onboarding",
    mode: "run",
    reason: "No critical issues found.",
    vocabulary: "Approve = advance a lifecycle gate.",
  },
  {
    rank: 3,
    label: "Pick next task",
    command: "/afx-task pick onboarding",
    mode: "run",
  },
  {
    rank: 4,
    label: "Verify tasks",
    command: "/afx-task verify onboarding",
    mode: "run",
  },
];

describe("NextActionRail", () => {
  it("renders nothing when no valid actions are present", () => {
    const { container } = render(
      <NextActionRail
        actions={[
          {
            rank: 1,
            label: "Unsafe",
            command: "!rm -rf workspace",
            mode: "run",
          },
        ]}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("renders up to three ranked actions with label before command", () => {
    render(<NextActionRail actions={actions} onRun={vi.fn()} onInsert={vi.fn()} />);

    expect(screen.getByTestId("next-action-rail")).toHaveAccessibleName("Ranked next actions");
    expect(screen.getAllByTestId("next-action-button")).toHaveLength(3);
    expect(screen.getAllByTestId("next-action-button")[0]).toHaveAccessibleName(
      "Run Approve spec: /afx-spec approve onboarding",
    );
    expect(screen.getAllByTestId("next-action-button")[1]).toHaveAccessibleName(
      "Insert Review design: /afx-design review onboarding",
    );
    expect(screen.queryByText("/afx-task verify onboarding")).not.toBeInTheDocument();
  });

  it("dispatches run and insert actions to the matching callbacks", () => {
    const onRun = vi.fn();
    const onInsert = vi.fn();

    render(<NextActionRail actions={actions} onRun={onRun} onInsert={onInsert} />);
    fireEvent.click(screen.getByRole("button", { name: /Run Approve spec/i }));
    fireEvent.click(screen.getByRole("button", { name: /Insert Review design/i }));

    expect(onRun).toHaveBeenCalledWith("/afx-spec approve onboarding", actions[1]);
    expect(onInsert).toHaveBeenCalledWith("/afx-design review onboarding", actions[0]);
  });

  it("marks an action unavailable when its mode handler is missing", () => {
    render(<NextActionRail actions={actions.slice(0, 1)} onRun={vi.fn()} />);

    const button = screen.getByTestId("next-action-button");
    expect(button).toHaveAttribute("aria-disabled", "true");

    fireEvent.click(button);
  });
});
