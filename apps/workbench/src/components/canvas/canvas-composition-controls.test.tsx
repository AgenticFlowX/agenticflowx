import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { CanvasNode, JSONCanvas } from "@afx/shared";

import { CanvasCompositionControls } from "./canvas-composition-controls";

function nodeById(canvas: JSONCanvas, id: string): CanvasNode {
  const node = canvas.nodes?.find((candidate) => candidate.id === id);
  if (!node) throw new Error("Missing test node: " + id);
  return node;
}

function fixture(): JSONCanvas {
  return {
    customRoot: { retained: true },
    nodes: [
      {
        id: "frame",
        type: "group",
        label: "System",
        x: 0,
        y: 0,
        width: 700,
        height: 400,
        customGroup: true,
      },
      {
        id: "a",
        type: "text",
        text: "A",
        x: 40,
        y: 40,
        width: 100,
        height: 60,
        color: "1",
        afxStyle: { shape: "service", density: "comfortable", future: true },
      },
      {
        id: "b",
        type: "text",
        text: "B",
        x: 220,
        y: 150,
        width: 150,
        height: 90,
      },
      {
        id: "c",
        type: "text",
        text: "C",
        x: 500,
        y: 280,
        width: 100,
        height: 80,
      },
      {
        id: "locked",
        type: "text",
        text: "Locked",
        x: 760,
        y: 40,
        width: 120,
        height: 80,
        afxLayout: { locked: true, lane: "secure" },
      },
    ],
    edges: [
      { id: "a-b", fromNode: "a", toNode: "b", customEdge: true },
      { id: "b-c", fromNode: "b", toNode: "c" },
    ],
  };
}

async function openControls(): Promise<void> {
  await userEvent.click(screen.getByRole("button", { name: "Compose selection" }));
}

describe("CanvasCompositionControls", () => {
  it("explains empty selection and disables selection-dependent actions", async () => {
    render(<CanvasCompositionControls canvas={fixture()} selectedNodeIds={[]} onApply={vi.fn()} />);

    await openControls();

    expect(screen.getByRole("status")).toHaveTextContent("Select at least one item");
    expect(screen.getByRole("button", { name: "Align left" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Create frame" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Copy style" })).toBeDisabled();
  });

  it("applies align, distribute, and equalize as independent immutable documents", async () => {
    const canvas = fixture();
    const onApply = vi.fn();
    render(
      <CanvasCompositionControls
        canvas={canvas}
        selectedNodeIds={["c", "a", "b"]}
        onApply={onApply}
      />,
    );

    await openControls();
    await userEvent.click(screen.getByRole("button", { name: "Align left" }));
    await userEvent.click(screen.getByRole("button", { name: "Distribute horizontally" }));
    await userEvent.click(screen.getByRole("button", { name: "Equalize width" }));

    expect(onApply).toHaveBeenCalledTimes(3);
    const aligned = onApply.mock.calls[0]?.[0] as JSONCanvas;
    expect(["a", "b", "c"].map((id) => nodeById(aligned, id).x)).toEqual([40, 40, 40]);
    const distributed = onApply.mock.calls[1]?.[0] as JSONCanvas;
    expect(nodeById(distributed, "b").x).toBe(245);
    const equalized = onApply.mock.calls[2]?.[0] as JSONCanvas;
    expect(["a", "b", "c"].map((id) => nodeById(equalized, id).width)).toEqual([100, 100, 100]);
    expect(canvas).toEqual(fixture());
    expect(aligned.edges).toEqual(canvas.edges);
  });

  it("supports z-order, lock, and pin operations through one callback", async () => {
    const onApply = vi.fn();
    render(
      <CanvasCompositionControls canvas={fixture()} selectedNodeIds={["b"]} onApply={onApply} />,
    );

    await openControls();
    await userEvent.click(screen.getByRole("button", { name: "Bring to front" }));
    await userEvent.click(screen.getByRole("button", { name: "Lock selection" }));
    await userEvent.click(screen.getByRole("button", { name: "Pin selection" }));

    expect(((onApply.mock.calls[0]?.[0] as JSONCanvas).nodes ?? []).slice(-1)[0]?.id).toBe("b");
    expect(nodeById(onApply.mock.calls[1]?.[0] as JSONCanvas, "b")["afxLayout"]).toEqual({
      locked: true,
    });
    expect(nodeById(onApply.mock.calls[2]?.[0] as JSONCanvas, "b")["afxLayout"]).toEqual({
      pinned: true,
    });
  });

  it("identifies locked selections, disables mutation actions, and keeps unlock available", async () => {
    const onApply = vi.fn();
    render(
      <CanvasCompositionControls
        canvas={fixture()}
        selectedNodeIds={["a", "locked"]}
        onApply={onApply}
      />,
    );

    await openControls();

    expect(screen.getByRole("status")).toHaveTextContent("1 locked item");
    expect(screen.getByRole("button", { name: "Align left" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Pin selection" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Unlock selection" })).toBeEnabled();
    await userEvent.click(screen.getByRole("button", { name: "Unlock selection" }));

    expect(nodeById(onApply.mock.calls[0]?.[0] as JSONCanvas, "locked")["afxLayout"]).toEqual({
      lane: "secure",
    });
  });

  it("creates a labeled frame with deterministic identity and requested padding", async () => {
    const onApply = vi.fn();
    render(
      <CanvasCompositionControls
        canvas={fixture()}
        selectedNodeIds={["a", "b"]}
        onApply={onApply}
      />,
    );

    await openControls();
    await userEvent.clear(screen.getByRole("textbox", { name: "Frame label" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Frame label" }), "Services");
    await userEvent.clear(screen.getByRole("spinbutton", { name: "Frame padding" }));
    await userEvent.type(screen.getByRole("spinbutton", { name: "Frame padding" }), "20");
    await userEvent.click(screen.getByRole("button", { name: "Create frame" }));

    expect(nodeById(onApply.mock.calls[0]?.[0] as JSONCanvas, "frame-1")).toMatchObject({
      type: "group",
      label: "Services",
      x: 20,
      y: 20,
      width: 370,
      height: 240,
      afxNodeKind: "frame",
    });
  });

  it("retains a copied style across selection changes and pastes it without changing content", async () => {
    const onApply = vi.fn();
    const view = render(
      <CanvasCompositionControls canvas={fixture()} selectedNodeIds={["a"]} onApply={onApply} />,
    );

    await openControls();
    await userEvent.click(screen.getByRole("button", { name: "Copy style" }));
    view.rerender(
      <CanvasCompositionControls canvas={fixture()} selectedNodeIds={["b"]} onApply={onApply} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Paste style" }));

    expect(nodeById(onApply.mock.calls[0]?.[0] as JSONCanvas, "b")).toMatchObject({
      text: "B",
      color: "1",
      afxStyle: { shape: "service", density: "comfortable", future: true },
    });
  });

  it("patches color, shape, icon, density, typography, and swimlane for a multi-selection", async () => {
    const onApply = vi.fn();
    render(
      <CanvasCompositionControls
        canvas={fixture()}
        selectedNodeIds={["a", "b"]}
        onApply={onApply}
      />,
    );

    await openControls();
    await userEvent.clear(screen.getByRole("textbox", { name: "Node color" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Node color" }), "#abcdef");
    await userEvent.click(screen.getByRole("button", { name: "Apply color" }));
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Node shape" }),
      "component",
    );
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Node density" }),
      "compact",
    );
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Node typography" }),
      "heading",
    );
    await userEvent.type(screen.getByRole("textbox", { name: "Node icon" }), "server");
    await userEvent.type(screen.getByRole("textbox", { name: "Node swimlane" }), "Application");
    await userEvent.click(screen.getByRole("button", { name: "Apply node style" }));

    const colored = onApply.mock.calls[0]?.[0] as JSONCanvas;
    expect(["a", "b"].map((id) => nodeById(colored, id).color)).toEqual(["#abcdef", "#abcdef"]);
    const styled = onApply.mock.calls[1]?.[0] as JSONCanvas;
    for (const id of ["a", "b"]) {
      expect(nodeById(styled, id)["afxStyle"]).toMatchObject({
        shape: "component",
        icon: "server",
        density: "compact",
        typography: "heading",
      });
      expect(nodeById(styled, id)["afxLayout"]).toMatchObject({ lane: "Application" });
    }
  });

  it("authors group label, background, style, and collapsed presentation", async () => {
    const onApply = vi.fn();
    render(
      <CanvasCompositionControls
        canvas={fixture()}
        selectedNodeIds={["frame"]}
        onApply={onApply}
      />,
    );

    await openControls();
    await userEvent.clear(screen.getByRole("textbox", { name: "Group label" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Group label" }), "System context");
    await userEvent.type(
      screen.getByRole("textbox", { name: "Group background" }),
      "assets/context.png",
    );
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Group background style" }),
      "ratio",
    );
    await userEvent.click(screen.getByRole("checkbox", { name: "Collapse group" }));
    await userEvent.type(screen.getByRole("spinbutton", { name: "Group presentation order" }), "2");
    await userEvent.click(screen.getByRole("button", { name: "Apply group" }));

    expect(nodeById(onApply.mock.calls[0]?.[0] as JSONCanvas, "frame")).toMatchObject({
      label: "System context",
      background: "assets/context.png",
      backgroundStyle: "ratio",
      afxGroup: { version: 1, collapsed: true, presentationOrder: 2 },
      customGroup: true,
    });
  });

  it("offers preserve and scale choices when transforming one selected frame", async () => {
    const onApply = vi.fn();
    render(
      <CanvasCompositionControls
        canvas={fixture()}
        selectedNodeIds={["frame"]}
        onApply={onApply}
      />,
    );

    await openControls();
    expect(screen.getByRole("option", { name: "Preserve child sizes" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Scale child geometry" })).toBeInTheDocument();
    await userEvent.clear(screen.getByRole("spinbutton", { name: "Frame x" }));
    await userEvent.type(screen.getByRole("spinbutton", { name: "Frame x" }), "100");
    await userEvent.clear(screen.getByRole("spinbutton", { name: "Frame width" }));
    await userEvent.type(screen.getByRole("spinbutton", { name: "Frame width" }), "1400");
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Contained node behavior" }),
      "scale",
    );
    await userEvent.click(screen.getByRole("button", { name: "Transform frame" }));

    const transformed = onApply.mock.calls[0]?.[0] as JSONCanvas;
    expect(nodeById(transformed, "frame")).toMatchObject({ x: 100, width: 1400 });
    expect(nodeById(transformed, "a")).toMatchObject({ x: 180, width: 200 });
  });

  it("surfaces precise engine errors and never calls onApply for an invalid selection", async () => {
    const onApply = vi.fn();
    render(
      <CanvasCompositionControls
        canvas={fixture()}
        selectedNodeIds={["a", "missing"]}
        onApply={onApply}
      />,
    );

    await openControls();
    await userEvent.click(screen.getByRole("button", { name: "Align left" }));

    expect(screen.getByRole("alert")).toHaveTextContent("unknown nodes: missing");
    expect(onApply).not.toHaveBeenCalled();
  });

  it("communicates minimum selection sizes in disabled action labels", async () => {
    render(
      <CanvasCompositionControls
        canvas={fixture()}
        selectedNodeIds={["a", "b"]}
        onApply={vi.fn()}
      />,
    );

    await openControls();

    expect(screen.getByRole("button", { name: "Distribute horizontally" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Distribute horizontally" })).toHaveAttribute(
      "title",
      "Select at least 3 unlocked items",
    );
    expect(screen.getByRole("button", { name: "Align left" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Equalize width" })).toBeEnabled();
  });
});
