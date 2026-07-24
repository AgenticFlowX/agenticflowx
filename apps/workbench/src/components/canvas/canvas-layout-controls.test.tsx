/**
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-40]
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { JSONCanvas } from "@afx/shared";

import { CanvasLayoutControls } from "./canvas-layout-controls";

const canvas: JSONCanvas = {
  nodes: [
    { id: "a", type: "text", text: "A", x: 80, y: 90, width: 200, height: 100 },
    { id: "b", type: "text", text: "B", x: 20, y: 10, width: 200, height: 100 },
  ],
  edges: [{ id: "e", fromNode: "a", toNode: "b" }],
};

describe("CanvasLayoutControls", () => {
  it("previews without mutating the source and applies one replacement", async () => {
    const user = userEvent.setup();
    const onPreview = vi.fn();
    const onApply = vi.fn();
    render(
      <CanvasLayoutControls
        canvas={canvas}
        selectedNodeIds={[]}
        onPreview={onPreview}
        onApply={onApply}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Reformat canvas" }));
    await user.click(screen.getByRole("button", { name: "Preview" }));

    expect(onPreview).toHaveBeenCalledTimes(1);
    expect(onPreview.mock.calls[0]?.[0]).not.toBe(canvas);
    expect(canvas.nodes?.[0]).toMatchObject({ x: 80, y: 90 });
    expect(screen.getByRole("status")).toHaveTextContent("canvas is unchanged until Apply");

    await user.click(screen.getByRole("button", { name: "Apply" }));
    expect(onApply).toHaveBeenCalledTimes(1);
  });

  it("supports selection scope and cancel restores the authoritative canvas", async () => {
    const user = userEvent.setup();
    const onPreview = vi.fn();
    render(
      <CanvasLayoutControls
        canvas={canvas}
        selectedNodeIds={["a"]}
        onPreview={onPreview}
        onApply={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Reformat canvas" }));
    await user.selectOptions(screen.getByRole("combobox", { name: "Layout scope" }), "selection");
    await user.click(screen.getByRole("button", { name: "Preview" }));
    await user.click(screen.getByRole("button", { name: "Cancel preview" }));

    expect(onPreview).toHaveBeenLastCalledWith(undefined);
  });

  it("reports an empty-selection error instead of altering geometry", async () => {
    const user = userEvent.setup();
    render(
      <CanvasLayoutControls
        canvas={canvas}
        selectedNodeIds={[]}
        onPreview={vi.fn()}
        onApply={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Reformat canvas" }));
    expect(screen.getByRole("option", { name: /Selection \(0\)/ })).toBeDisabled();
  });
});
