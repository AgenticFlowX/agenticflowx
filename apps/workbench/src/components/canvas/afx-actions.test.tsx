/**
 * @see docs/specs/229-app-workbench-canvas/tasks.md [12.2]
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { CanvasNode } from "@afx/shared";

import { CanvasRunActionButton, canvasActionConfirmation } from "./afx-actions";

function node(afxAction: unknown): CanvasNode {
  return {
    id: "idea-1",
    type: "text",
    text: "Plan the next feature",
    x: 0,
    y: 0,
    width: 240,
    height: 120,
    afxAction,
  };
}

describe("Canvas AFX actions", () => {
  it("renders Run only for strict versioned allowlisted metadata", () => {
    const onRun = vi.fn();
    const { rerender } = render(
      <CanvasRunActionButton
        node={node({ version: 1, action: "prepare-sprint", label: "Plan sprint" })}
        onRun={onRun}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Run Plan sprint" }));
    expect(onRun).toHaveBeenCalledWith({
      version: 1,
      action: "prepare-sprint",
      label: "Plan sprint",
    });

    rerender(
      <CanvasRunActionButton
        node={node({ version: 1, action: "shell", command: "rm -rf ." })}
        onRun={onRun}
      />,
    );
    expect(screen.queryByRole("button", { name: /Run/ })).not.toBeInTheDocument();

    rerender(
      <CanvasRunActionButton
        node={node({ version: 1, action: "send-chat", future: true })}
        onRun={onRun}
      />,
    );
    expect(screen.queryByRole("button", { name: /Run/ })).not.toBeInTheDocument();
  });

  it("disables a valid action when the host cannot safely run it", () => {
    render(
      <CanvasRunActionButton
        node={node({ version: 1, action: "send-chat" })}
        disabled
        onRun={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Run send-chat" })).toBeDisabled();
  });

  it("shows the exact target, node IDs, action kind, and command in confirmation", () => {
    const confirmation = canvasActionConfirmation(
      ".afx/canvases/release.canvas",
      ["idea-1", "spec-2"],
      { version: 1, action: "prepare-spec", command: "/afx-spec refine checkout" },
    );

    expect(confirmation).toBe(
      `Run this exact Canvas action?\n\n${JSON.stringify(
        {
          target: ".afx/canvases/release.canvas",
          nodes: ["idea-1", "spec-2"],
          action: {
            version: 1,
            action: "prepare-spec",
            command: "/afx-spec refine checkout",
          },
        },
        null,
        2,
      )}`,
    );
  });
});
