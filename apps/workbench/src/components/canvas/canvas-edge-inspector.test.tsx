import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { CanvasEdge, JSONCanvas } from "@afx/shared";

import { CanvasEdgeInspector } from "./canvas-edge-inspector";

vi.mock("@afx/ui/components/popover", async () => {
  const React = await import("react");
  const PopoverContext = React.createContext<{
    open: boolean;
    onOpenChange?: (open: boolean) => void;
  }>({ open: false });
  return {
    Popover: ({
      open = false,
      onOpenChange,
      children,
    }: {
      open?: boolean;
      onOpenChange?: (open: boolean) => void;
      children: React.ReactNode;
    }) => (
      <PopoverContext.Provider value={{ open, onOpenChange }}>{children}</PopoverContext.Provider>
    ),
    PopoverTrigger: ({
      children,
    }: {
      children: React.ReactElement<{ onClick?: () => void } & React.AriaAttributes>;
    }) => {
      const context = React.useContext(PopoverContext);
      return React.cloneElement(children, {
        "aria-expanded": context.open,
        onClick: () => {
          children.props.onClick?.();
          context.onOpenChange?.(!context.open);
        },
      });
    },
    PopoverContent: ({
      children,
      align: _align,
      ...props
    }: React.HTMLAttributes<HTMLDivElement> & { align?: string }) => {
      const context = React.useContext(PopoverContext);
      return context.open ? <div {...props}>{children}</div> : null;
    },
  };
});

function fixture(): JSONCanvas {
  return {
    customRoot: { retained: true },
    nodes: [
      { id: "a", type: "text", text: "A", x: 0, y: 0, width: 100, height: 80 },
      { id: "b", type: "text", text: "B", x: 200, y: 0, width: 100, height: 80 },
      { id: "c", type: "text", text: "C", x: 400, y: 0, width: 100, height: 80 },
    ],
    edges: [
      {
        id: "e1",
        fromNode: "a",
        toNode: "b",
        fromEnd: "none",
        toEnd: "arrow",
        label: "reads",
        color: "1",
        afxStyle: {
          version: 1,
          route: "straight",
          stroke: "dashed",
          relationship: "reads",
          opacity: 0.7,
          waypoints: [{ x: 100, y: 20 }],
        },
        customEdge: { retained: true },
      },
      {
        id: "e2",
        fromNode: "b",
        toNode: "c",
        fromEnd: "arrow",
        toEnd: "none",
        label: "writes",
        color: "5",
        afxStyle: {
          version: 1,
          route: "bezier",
          stroke: "dotted",
          relationship: "writes",
          opacity: 0.4,
        },
      },
      {
        id: "generated",
        fromNode: "a",
        toNode: "c",
        toEnd: "arrow",
        label: "depends on",
        afxStyle: { version: 1, route: "smoothstep", stroke: "solid" },
        afxProvenance: {
          version: 1,
          kind: "declared-dependency",
          owner: "spec-a",
          detached: false,
        },
      },
    ],
  };
}

function edgeById(canvas: JSONCanvas, id: string): CanvasEdge {
  const edge = canvas.edges?.find((candidate) => candidate.id === id);
  if (!edge) throw new Error("Missing test edge: " + id);
  return edge;
}

async function openInspector(): Promise<ReturnType<typeof userEvent.setup>> {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Inspect selected edges" }));
  return user;
}

describe("CanvasEdgeInspector", () => {
  it("explains an empty selection and disables edge actions", async () => {
    render(<CanvasEdgeInspector canvas={fixture()} selectedEdgeIds={[]} onApply={vi.fn()} />);

    await openInspector();

    expect(screen.getByRole("status")).toHaveTextContent("Select at least one edge");
    expect(screen.getByRole("button", { name: "Apply label" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Apply connector" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Copy edge style" })).toBeDisabled();
  });

  it("shows mixed values and applies one label to multiple edges without losing fields", async () => {
    const canvas = fixture();
    const onApply = vi.fn();
    render(
      <CanvasEdgeInspector canvas={canvas} selectedEdgeIds={["e2", "e1"]} onApply={onApply} />,
    );

    const user = await openInspector();

    expect(screen.getByRole("combobox", { name: "Edge route" })).toHaveValue("mixed");
    expect(screen.getByRole("combobox", { name: "Edge stroke" })).toHaveValue("mixed");
    expect(screen.getByRole("textbox", { name: "Edge label" })).toHaveAttribute(
      "placeholder",
      "Mixed values",
    );
    await user.type(screen.getByRole("textbox", { name: "Edge label" }), "shared");
    await user.click(screen.getByRole("button", { name: "Apply label" }));

    const next = onApply.mock.calls[0]?.[0] as JSONCanvas;
    expect(edgeById(next, "e1").label).toBe("shared");
    expect(edgeById(next, "e2").label).toBe("shared");
    expect(edgeById(next, "e1")["customEdge"]).toEqual({ retained: true });
    expect(next["customRoot"]).toEqual({ retained: true });
    expect(canvas).toEqual(fixture());
  });

  it("applies semantic presets and bounded custom relationships to standard labels", async () => {
    const onApply = vi.fn();
    render(<CanvasEdgeInspector canvas={fixture()} selectedEdgeIds={["e1"]} onApply={onApply} />);

    const user = await openInspector();
    await user.selectOptions(screen.getByRole("combobox", { name: "Relationship" }), "depends-on");
    await user.click(screen.getByRole("button", { name: "Apply relationship" }));

    const preset = edgeById(onApply.mock.calls[0]?.[0] as JSONCanvas, "e1");
    expect(preset.label).toBe("depends on");
    expect(preset.afxStyle?.relationship).toBe("depends on");

    await user.selectOptions(screen.getByRole("combobox", { name: "Relationship" }), "custom");
    await user.type(screen.getByRole("textbox", { name: "Custom relationship" }), "x".repeat(65));
    await user.click(screen.getByRole("button", { name: "Apply relationship" }));
    expect(screen.getByRole("alert")).toHaveTextContent("64 characters");
    expect(onApply).toHaveBeenCalledTimes(1);
  });

  it("updates route, stroke, and both markers while preserving unedited style", async () => {
    const onApply = vi.fn();
    render(<CanvasEdgeInspector canvas={fixture()} selectedEdgeIds={["e1"]} onApply={onApply} />);

    const user = await openInspector();
    await user.selectOptions(screen.getByRole("combobox", { name: "Edge route" }), "smoothstep");
    await user.selectOptions(screen.getByRole("combobox", { name: "Edge stroke" }), "dotted");
    await user.selectOptions(screen.getByRole("combobox", { name: "Start marker" }), "arrow");
    await user.selectOptions(screen.getByRole("combobox", { name: "End marker" }), "none");
    await user.click(screen.getByRole("button", { name: "Apply connector" }));

    expect(edgeById(onApply.mock.calls[0]?.[0] as JSONCanvas, "e1")).toMatchObject({
      fromEnd: "arrow",
      toEnd: "none",
      afxStyle: {
        route: "smoothstep",
        stroke: "dotted",
        relationship: "reads",
        opacity: 0.7,
        waypoints: [{ x: 100, y: 20 }],
      },
    });
  });

  it("leaves mixed connector fields untouched until an explicit value is chosen", async () => {
    const onApply = vi.fn();
    render(
      <CanvasEdgeInspector canvas={fixture()} selectedEdgeIds={["e1", "e2"]} onApply={onApply} />,
    );

    const user = await openInspector();
    await user.selectOptions(screen.getByRole("combobox", { name: "Edge route" }), "step");
    await user.click(screen.getByRole("button", { name: "Apply connector" }));

    const next = onApply.mock.calls[0]?.[0] as JSONCanvas;
    expect(edgeById(next, "e1").afxStyle).toMatchObject({ route: "step", stroke: "dashed" });
    expect(edgeById(next, "e2").afxStyle).toMatchObject({ route: "step", stroke: "dotted" });
  });

  it("applies validated preset or hex color and bounded opacity", async () => {
    const onApply = vi.fn();
    render(<CanvasEdgeInspector canvas={fixture()} selectedEdgeIds={["e1"]} onApply={onApply} />);

    const user = await openInspector();
    await user.clear(screen.getByRole("textbox", { name: "Edge color" }));
    await user.type(screen.getByRole("textbox", { name: "Edge color" }), "#abcdef");
    await user.clear(screen.getByRole("spinbutton", { name: "Edge opacity" }));
    await user.type(screen.getByRole("spinbutton", { name: "Edge opacity" }), "0.45");
    await user.click(screen.getByRole("button", { name: "Apply appearance" }));

    expect(edgeById(onApply.mock.calls[0]?.[0] as JSONCanvas, "e1")).toMatchObject({
      color: "#abcdef",
      afxStyle: { opacity: 0.45 },
    });

    await user.clear(screen.getByRole("textbox", { name: "Edge color" }));
    await user.type(screen.getByRole("textbox", { name: "Edge color" }), "red");
    await user.click(screen.getByRole("button", { name: "Apply appearance" }));
    expect(screen.getByRole("alert")).toHaveTextContent("preset 1-6 or a hexadecimal color");
    expect(onApply).toHaveBeenCalledTimes(1);
  });

  it("adds, edits, removes, and bounds finite waypoints for one edge", async () => {
    const onApply = vi.fn();
    render(<CanvasEdgeInspector canvas={fixture()} selectedEdgeIds={["e1"]} onApply={onApply} />);

    const user = await openInspector();
    await user.clear(screen.getByRole("spinbutton", { name: "Waypoint 1 x" }));
    await user.type(screen.getByRole("spinbutton", { name: "Waypoint 1 x" }), "120");
    await user.click(screen.getByRole("button", { name: "Add waypoint" }));
    await user.clear(screen.getByRole("spinbutton", { name: "Waypoint 2 x" }));
    await user.type(screen.getByRole("spinbutton", { name: "Waypoint 2 x" }), "240");
    await user.clear(screen.getByRole("spinbutton", { name: "Waypoint 2 y" }));
    await user.type(screen.getByRole("spinbutton", { name: "Waypoint 2 y" }), "80");
    await user.click(screen.getByRole("button", { name: "Apply waypoints" }));

    expect(edgeById(onApply.mock.calls[0]?.[0] as JSONCanvas, "e1").afxStyle?.waypoints).toEqual([
      { x: 120, y: 20 },
      { x: 240, y: 80 },
    ]);

    await user.click(screen.getByRole("button", { name: "Remove waypoint 1" }));
    await user.clear(screen.getByRole("spinbutton", { name: "Waypoint 1 x" }));
    await user.type(screen.getByRole("spinbutton", { name: "Waypoint 1 x" }), "1000001");
    await user.click(screen.getByRole("button", { name: "Apply waypoints" }));
    expect(screen.getByRole("alert")).toHaveTextContent("between -1,000,000 and 1,000,000");
    expect(onApply).toHaveBeenCalledTimes(1);
  });

  it("retains copied edge style across selection changes without copying labels", async () => {
    const onApply = vi.fn();
    const view = render(
      <CanvasEdgeInspector canvas={fixture()} selectedEdgeIds={["e1"]} onApply={onApply} />,
    );

    const user = await openInspector();
    await user.click(screen.getByRole("button", { name: "Copy edge style" }));
    view.rerender(
      <CanvasEdgeInspector canvas={fixture()} selectedEdgeIds={["e2"]} onApply={onApply} />,
    );
    await user.click(screen.getByRole("button", { name: "Paste edge style" }));

    const pasted = edgeById(onApply.mock.calls[0]?.[0] as JSONCanvas, "e2");
    expect(pasted).toMatchObject({
      label: "writes",
      color: "1",
      fromEnd: "none",
      toEnd: "arrow",
      afxStyle: edgeById(fixture(), "e1").afxStyle,
    });
  });

  it("detaches generated dependencies into fresh manual IDs with durable suppression", async () => {
    const onApply = vi.fn();
    render(
      <CanvasEdgeInspector canvas={fixture()} selectedEdgeIds={["generated"]} onApply={onApply} />,
    );

    const user = await openInspector();
    await user.click(screen.getByRole("button", { name: "Detach generated dependency" }));

    const next = onApply.mock.calls[0]?.[0] as JSONCanvas;
    expect(next.edges).toHaveLength(3);
    expect(next.edges?.some((edge) => edge.id === "generated")).toBe(false);
    expect(edgeById(next, "generated:manual").afxProvenance).toEqual({
      version: 1,
      kind: "declared-dependency",
      owner: "spec-a",
      detached: true,
      generatedEdgeId: "generated",
      suppressionKey: "afx:declared-dependency:spec-a:generated",
    });
    expect(screen.getByRole("status")).toHaveTextContent("fresh manual edge");
  });

  it("reports unknown edges and restricts waypoint editing to one selection", async () => {
    const onApply = vi.fn();
    const view = render(
      <CanvasEdgeInspector canvas={fixture()} selectedEdgeIds={["missing"]} onApply={onApply} />,
    );

    const user = await openInspector();
    await user.type(screen.getByRole("textbox", { name: "Edge label" }), "label");
    await user.click(screen.getByRole("button", { name: "Apply label" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Unknown selected edges: missing");
    expect(onApply).not.toHaveBeenCalled();

    view.rerender(
      <CanvasEdgeInspector canvas={fixture()} selectedEdgeIds={["e1", "e2"]} onApply={onApply} />,
    );
    expect(screen.getByRole("button", { name: "Add waypoint" })).toBeDisabled();
    expect(screen.getByText("Select exactly one edge to edit waypoints.")).toBeInTheDocument();
  });
});
