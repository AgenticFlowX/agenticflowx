/**
 * Canvas presentation navigation and accessibility coverage.
 *
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-34]
 * @see docs/specs/229-app-workbench-canvas/design.md [DES-CANVAS-PRESENTATION]
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { CanvasNode } from "@afx/shared";

import { CanvasPresentationControls } from "./canvas-presentation-controls";

const NODES: CanvasNode[] = [
  { id: "note", type: "text", text: "Not a frame", x: 0, y: 0, width: 200, height: 100 },
  {
    id: "build",
    type: "group",
    label: "Build",
    x: 0,
    y: 320,
    width: 640,
    height: 280,
  },
  {
    id: "details",
    type: "group",
    label: "Details",
    x: 480,
    y: 0,
    width: 640,
    height: 280,
  },
  {
    id: "intro",
    type: "group",
    label: "Intro",
    x: 0,
    y: 0,
    width: 640,
    height: 280,
  },
];

function renderControls(nodes: readonly CanvasNode[] = NODES) {
  const onFocusFrame = vi.fn();
  const onPresentationChange = vi.fn();
  const view = render(
    <CanvasPresentationControls
      nodes={nodes}
      onFocusFrame={onFocusFrame}
      onPresentationChange={onPresentationChange}
    />,
  );
  return { ...view, onFocusFrame, onPresentationChange };
}

describe("CanvasPresentationControls", () => {
  it("keeps inactive presentation chrome compact and avoids an empty frame selector", () => {
    renderControls();

    expect(screen.getByText("3 frames")).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Presentation frame" })).not.toBeInTheDocument();
  });

  it("orders group frames spatially and announces the first frame on entry", () => {
    const { onFocusFrame, onPresentationChange } = renderControls();

    fireEvent.click(screen.getByRole("button", { name: "Start presentation" }));

    expect(onPresentationChange).toHaveBeenCalledWith(true);
    expect(onFocusFrame).toHaveBeenCalledWith("intro");
    expect(screen.getByRole("status")).toHaveTextContent("Frame 1 of 3: Intro");
    expect(screen.getByRole("combobox", { name: "Presentation frame" })).toHaveValue("intro");
  });

  it("moves previous, next, and directly to a selected frame", () => {
    const { onFocusFrame } = renderControls();
    fireEvent.click(screen.getByRole("button", { name: "Start presentation" }));

    fireEvent.click(screen.getByRole("button", { name: "Next frame" }));
    expect(onFocusFrame).toHaveBeenLastCalledWith("details");
    expect(screen.getByRole("status")).toHaveTextContent("Frame 2 of 3: Details");

    fireEvent.click(screen.getByRole("button", { name: "Previous frame" }));
    expect(onFocusFrame).toHaveBeenLastCalledWith("intro");

    fireEvent.change(screen.getByRole("combobox", { name: "Presentation frame" }), {
      target: { value: "build" },
    });
    expect(onFocusFrame).toHaveBeenLastCalledWith("build");
    expect(screen.getByRole("status")).toHaveTextContent("Frame 3 of 3: Build");
    expect(screen.getByRole("button", { name: "Next frame" })).toBeDisabled();
  });

  it("uses an authored presentation order before spatial fallback", () => {
    const ordered: CanvasNode[] = [
      {
        id: "spatial-first",
        type: "group",
        label: "Spatial first",
        x: 0,
        y: 0,
        width: 400,
        height: 240,
        afxGroup: { version: 1, presentationOrder: 2 },
      },
      {
        id: "authored-first",
        type: "group",
        label: "Authored first",
        x: 900,
        y: 900,
        width: 400,
        height: 240,
        afxGroup: { version: 1, presentationOrder: 1 },
      },
      {
        id: "unordered",
        type: "group",
        label: "Unordered",
        x: -100,
        y: -100,
        width: 400,
        height: 240,
      },
    ];
    const { onFocusFrame } = renderControls(ordered);

    fireEvent.click(screen.getByRole("button", { name: "Start presentation" }));
    expect(onFocusFrame).toHaveBeenLastCalledWith("authored-first");
    fireEvent.click(screen.getByRole("button", { name: "Next frame" }));
    expect(onFocusFrame).toHaveBeenLastCalledWith("spatial-first");
    fireEvent.click(screen.getByRole("button", { name: "Next frame" }));
    expect(onFocusFrame).toHaveBeenLastCalledWith("unordered");
  });

  it("handles ArrowLeft, ArrowRight, and Escape while presentation is active", () => {
    const { onFocusFrame, onPresentationChange } = renderControls();
    fireEvent.click(screen.getByRole("button", { name: "Start presentation" }));

    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(onFocusFrame).toHaveBeenLastCalledWith("details");
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(onFocusFrame).toHaveBeenLastCalledWith("intro");
    fireEvent.keyDown(window, { key: "Escape" });

    expect(onPresentationChange).toHaveBeenLastCalledWith(false);
    expect(screen.getByRole("button", { name: "Start presentation" })).toBeInTheDocument();
  });

  it("exits through the visible control and does not react to keys while inactive", () => {
    const { onFocusFrame, onPresentationChange } = renderControls();
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(onFocusFrame).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Start presentation" }));
    fireEvent.click(screen.getByRole("button", { name: "Exit presentation" }));

    expect(onPresentationChange).toHaveBeenLastCalledWith(false);
  });

  it("handles a Canvas without group frames", () => {
    const { onFocusFrame, onPresentationChange } = renderControls([NODES[0]]);

    expect(screen.getByText("No presentation frames")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start presentation" })).toBeDisabled();
    expect(screen.queryByRole("combobox", { name: "Presentation frame" })).not.toBeInTheDocument();
    expect(onFocusFrame).not.toHaveBeenCalled();
    expect(onPresentationChange).not.toHaveBeenCalled();
  });

  it("uses deterministic fallback titles and sidebar-safe reduced-motion styling", () => {
    renderControls([{ id: "untitled", type: "group", x: 0, y: 0, width: 400, height: 300 }]);
    fireEvent.click(screen.getByRole("button", { name: "Start presentation" }));

    expect(screen.getByRole("status")).toHaveTextContent("Frame 1 of 1: Frame 1");
    expect(screen.getByTestId("canvas-presentation-controls")).toHaveClass(
      "min-w-0",
      "max-w-full",
      "motion-reduce:transition-none",
    );
  });
});
