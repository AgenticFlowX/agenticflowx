/**
 * Controlled React Flow interaction coverage. The renderer boundary is
 * replaced with a deterministic harness so selection and graph callbacks can
 * be verified without depending on browser layout in JSDOM.
 *
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-9] [FR-10] [FR-17] [FR-28] [FR-29]
 * @see docs/specs/229-app-workbench-canvas/tasks.md [8.2] [13.1] [16.1]
 * @see docs/specs/229-app-workbench-canvas/design.md [DES-CANVAS-INTERACTIONS] [DES-TEST]
 */
import { useEffect } from "react";

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CanvasActionMetadata, CanvasEdge, CanvasNode, JSONCanvas } from "@afx/shared";

import { ReactFlowCanvas, canvasExportReferenceStatuses } from "./react-flow-canvas";

const flowApi = vi.hoisted(() => ({
  fitView: vi.fn(),
  getViewport: vi.fn(() => ({ x: 0, y: 0, zoom: 1 })),
  setViewport: vi.fn(),
  getZoom: vi.fn(() => 1),
  zoomIn: vi.fn(),
  zoomOut: vi.fn(),
  zoomTo: vi.fn(),
}));

vi.mock("@xyflow/react", () => {
  interface HarnessNode {
    id: string;
    data?: Record<string, unknown>;
    draggable?: boolean;
    position?: { x: number; y: number };
    width?: number;
    height?: number;
    measured?: { width?: number; height?: number };
  }

  interface HarnessEdge {
    id: string;
    source: string;
    target: string;
    data?: Record<string, unknown>;
  }

  interface HarnessProps {
    nodes: HarnessNode[];
    edges: HarnessEdge[];
    children?: React.ReactNode;
    onNodesChange?: (changes: Array<Record<string, unknown>>) => void;
    onEdgesChange?: (changes: Array<{ type: "select"; id: string; selected: boolean }>) => void;
    onConnect?: (connection: {
      source: string;
      sourceHandle: string | null;
      target: string;
      targetHandle: string | null;
    }) => void;
    onReconnect?: (
      edge: HarnessEdge,
      connection: {
        source: string;
        sourceHandle: string | null;
        target: string;
        targetHandle: string | null;
      },
    ) => void;
    onInit?: (instance: typeof flowApi) => void;
    onMoveEnd?: (event: null, viewport: { x: number; y: number; zoom: number }) => void;
    onlyRenderVisibleElements?: boolean;
    zoomOnScroll?: boolean;
    zoomOnPinch?: boolean;
    zoomActivationKeyCode?: string | string[] | null;
    panOnScroll?: boolean;
    panOnScrollSpeed?: number;
    minZoom?: number;
    maxZoom?: number;
  }

  function ReactFlowHarness(props: HarnessProps) {
    const { onInit } = props;
    useEffect(() => onInit?.(flowApi), [onInit]);
    return (
      <div
        data-testid="react-flow-harness"
        data-visible-only={String(Boolean(props.onlyRenderVisibleElements))}
        data-zoom-on-scroll={String(Boolean(props.zoomOnScroll))}
        data-zoom-on-pinch={String(Boolean(props.zoomOnPinch))}
        data-zoom-activation-key-code={String(props.zoomActivationKeyCode)}
        data-pan-on-scroll={String(Boolean(props.panOnScroll))}
        data-pan-on-scroll-speed={String(props.panOnScrollSpeed)}
        data-min-zoom={String(props.minZoom)}
        data-max-zoom={String(props.maxZoom)}
      >
        <output data-testid="first-node-draggable">{String(props.nodes[0]?.draggable)}</output>
        <output data-testid="first-node-position">
          {JSON.stringify(props.nodes[0]?.position ?? null)}
        </output>
        <output data-testid="first-node-preview">
          {JSON.stringify(props.nodes[0]?.data?.["preview"] ?? null)}
        </output>
        <output data-testid="first-node-afx-actions">
          {String(Boolean(props.nodes[0]?.data?.["showCanvasActions"]))}
        </output>
        <output data-testid="first-edge-data">
          {JSON.stringify(props.edges[0]?.data ?? null)}
        </output>
        <button
          type="button"
          onClick={() => {
            const id = props.nodes[0]?.id;
            if (!id) return;
            props.onNodesChange?.([
              { type: "position", id, position: { x: 16, y: 16 }, dragging: true },
            ]);
            props.onNodesChange?.([
              { type: "position", id, position: { x: 32, y: 32 }, dragging: true },
            ]);
            props.onNodesChange?.([
              { type: "position", id, position: { x: 48, y: 48 }, dragging: false },
            ]);
          }}
        >
          Move first node gesture
        </button>
        <button
          type="button"
          onClick={() => {
            const id = props.nodes[0]?.id;
            if (id) {
              props.onNodesChange?.([
                { type: "position", id, position: { x: 16, y: 16 }, dragging: true },
              ]);
            }
          }}
        >
          Begin first node drag
        </button>
        <button
          type="button"
          onClick={() => {
            const node = props.nodes[0];
            if (node) {
              props.onNodesChange?.([
                { type: "position", id: node.id, position: node.position, dragging: false },
              ]);
            }
          }}
        >
          Finish first node drag
        </button>
        <button
          type="button"
          onClick={() => {
            const id = props.nodes[0]?.id;
            if (!id) return;
            props.onNodesChange?.([
              {
                type: "dimensions",
                id,
                dimensions: { width: 280, height: 140 },
                resizing: true,
              },
            ]);
            props.onNodesChange?.([
              {
                type: "dimensions",
                id,
                dimensions: { width: 300, height: 160 },
                resizing: false,
              },
            ]);
          }}
        >
          Resize first node gesture
        </button>
        <button
          type="button"
          onClick={() => props.onMoveEnd?.(null, { x: 120, y: -45, zoom: 1.4 })}
        >
          Move viewport
        </button>
        <button
          type="button"
          onClick={() =>
            props.onNodesChange?.(
              props.nodes.slice(0, 2).map((node) => ({
                type: "select",
                id: node.id,
                selected: true,
              })),
            )
          }
        >
          Select first two nodes
        </button>
        <button
          type="button"
          onClick={() => {
            const edge = props.edges[0];
            if (edge) props.onEdgesChange?.([{ type: "select", id: edge.id, selected: true }]);
          }}
        >
          Select first edge
        </button>
        <button
          type="button"
          onClick={() =>
            props.onEdgesChange?.(
              props.edges.map((edge) => ({ type: "select", id: edge.id, selected: true })),
            )
          }
        >
          Select all edges
        </button>
        <button
          type="button"
          onClick={() =>
            props.onConnect?.({
              source: "a",
              sourceHandle: "right",
              target: "b",
              targetHandle: "left",
            })
          }
        >
          Connect valid nodes
        </button>
        <button
          type="button"
          onClick={() =>
            props.onConnect?.({
              source: "a",
              sourceHandle: "right",
              target: "a",
              targetHandle: "left",
            })
          }
        >
          Connect node to itself
        </button>
        <button
          type="button"
          onClick={() => {
            const edge = props.edges[0];
            if (edge)
              props.onReconnect?.(edge, {
                source: edge.source,
                sourceHandle: "right",
                target: "c",
                targetHandle: "left",
              });
          }}
        >
          Reconnect first edge
        </button>
        {props.children}
      </div>
    );
  }

  return {
    ReactFlow: ReactFlowHarness,
    Background: (props: { variant?: string }) => (
      <div data-testid="react-flow-background" data-variant={String(props.variant)} />
    ),
    Controls: () => <div data-testid="react-flow-controls" />,
    MiniMap: () => <div data-testid="react-flow-minimap" />,
    Handle: () => null,
    NodeResizer: () => null,
    NodeToolbar: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
    BackgroundVariant: { Dots: "dots", Lines: "lines" },
    MarkerType: { ArrowClosed: "arrowclosed" },
    SelectionMode: { Partial: "partial" },
    Position: { Top: "top", Right: "right", Bottom: "bottom", Left: "left" },
    applyNodeChanges: (changes: Array<Record<string, unknown>>, nodes: HarnessNode[]) =>
      changes.reduce((current, change) => {
        if (change["type"] === "select") return current;
        return current.map((node) => {
          if (node.id !== change["id"]) return node;
          if (change["type"] === "position") {
            return { ...node, position: change["position"] as { x: number; y: number } };
          }
          if (change["type"] === "dimensions") {
            const dimensions = change["dimensions"] as { width: number; height: number };
            return {
              ...node,
              width: dimensions.width,
              height: dimensions.height,
              measured: dimensions,
            };
          }
          return node;
        });
      }, nodes),
    applyEdgeChanges: (_changes: unknown[], edges: HarnessEdge[]) => edges,
    reconnectEdge: (
      oldEdge: HarnessEdge,
      connection: { source: string; target: string },
      edges: HarnessEdge[],
    ) =>
      edges.map((edge) =>
        edge.id === oldEdge.id
          ? { ...edge, source: connection.source, target: connection.target }
          : edge,
      ),
  };
});

const CANVAS: JSONCanvas = {
  nodes: [
    { id: "a", type: "text", text: "Idea A", x: 0, y: 0, width: 240, height: 120 },
    { id: "b", type: "text", text: "Idea B", x: 320, y: 0, width: 240, height: 120 },
    { id: "c", type: "text", text: "Idea C", x: 640, y: 0, width: 240, height: 120 },
  ],
  edges: [
    {
      id: "edge-a-b",
      fromNode: "a",
      fromSide: "right",
      toNode: "b",
      toSide: "left",
      toEnd: "arrow",
      label: "blocks",
      afxStyle: { version: 1, route: "bezier", stroke: "solid" },
      afxProvenance: {
        version: 1,
        kind: "declared-dependency",
        owner: "docs/specs/229-app-workbench-canvas/spec.md",
      },
    },
  ],
};
const EMPTY_FILE_CONTENTS = {} as const;

function renderSurface(onChange = vi.fn()) {
  render(
    <ReactFlowCanvas
      canvas={CANVAS}
      documentKey="file:///workspace::.afx/project.canvas"
      fileContents={EMPTY_FILE_CONTENTS}
      onChange={onChange}
      onNodeAction={vi.fn<
        (
          node: CanvasNode,
          action: "open" | "preview" | "loadPreview" | "chat" | "note" | "delete" | "expand",
        ) => void
      >()}
      onRunCanvasAction={vi.fn<(node: CanvasNode, action: CanvasActionMetadata) => void>()}
    />,
  );
  return onChange;
}

describe("ReactFlowCanvas controls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.localStorage.clear();
  });

  it("multi-selects, copies, pastes, and traverses undo/redo history", () => {
    const onChange = renderSurface();
    fireEvent.click(screen.getByRole("button", { name: "Select first two nodes" }));
    expect(screen.getByRole("button", { name: "Copy selection" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Copy selection" }));
    expect(screen.getByRole("button", { name: "Paste" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Paste" }));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        nodes: expect.arrayContaining([
          expect.objectContaining({ text: "Idea A", x: 36, y: 36 }),
          expect.objectContaining({ text: "Idea B", x: 356, y: 36 }),
        ]),
      }),
    );

    expect(screen.getByRole("button", { name: "Undo" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(onChange).toHaveBeenLastCalledWith(CANVAS);
    fireEvent.click(screen.getByRole("button", { name: "Redo" }));
    expect((onChange.mock.lastCall?.[0].nodes ?? []).length).toBe(5);
  });

  it("records a same-document external replacement as an undoable step", () => {
    const onChange = vi.fn();
    const props = {
      documentKey: "file:///workspace::.afx/project.canvas",
      fileContents: EMPTY_FILE_CONTENTS,
      onChange,
      onNodeAction: vi.fn(),
      onRunCanvasAction: vi.fn(),
    };
    const view = render(<ReactFlowCanvas {...props} canvas={CANVAS} />);
    fireEvent.click(screen.getByRole("button", { name: "Select first two nodes" }));
    fireEvent.click(screen.getByRole("button", { name: "Duplicate selection" }));
    expect(screen.getByRole("button", { name: "Undo" })).toBeEnabled();

    const external: JSONCanvas = {
      ...CANVAS,
      nodes: [
        ...(CANVAS.nodes ?? []),
        { id: "external", type: "text", text: "External", x: 0, y: 220, width: 240, height: 120 },
      ],
    };
    view.rerender(<ReactFlowCanvas {...props} canvas={external} />);

    // Parent-driven replacements (starter, Sync specs, external edit) push
    // history instead of wiping it, so Undo restores the pre-replacement state.
    expect(screen.getByRole("button", { name: "Undo" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Redo" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    const restored = onChange.mock.lastCall?.[0] as JSONCanvas;
    expect((restored.nodes ?? []).some((node) => node.id === "external")).toBe(false);
    expect((restored.nodes ?? []).length).toBe(5);
    expect(screen.getByRole("button", { name: "Redo" })).toBeEnabled();
  });

  it("keeps AFX node actions hidden until the AFX profile is active", () => {
    const props = {
      canvas: CANVAS,
      documentKey: "profile-boundary",
      onChange: vi.fn(),
      onNodeAction: vi.fn(),
      onRunCanvasAction: vi.fn(),
    };
    const view = render(<ReactFlowCanvas {...props} profile="essentials" />);
    expect(screen.getByTestId("first-node-afx-actions")).toHaveTextContent("false");
    expect(screen.getByRole("button", { name: "Compose selection" })).toBeInTheDocument();

    view.rerender(<ReactFlowCanvas {...props} profile="afx" />);
    expect(screen.getByTestId("first-node-afx-actions")).toHaveTextContent("true");
  });

  it("duplicates the current selection directly without waiting for clipboard state", () => {
    const onChange = renderSurface();
    fireEvent.click(screen.getByRole("button", { name: "Select first two nodes" }));

    fireEvent.keyDown(screen.getByTestId("react-flow-canvas"), { key: "d", metaKey: true });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.lastCall?.[0].nodes).toHaveLength(5);
    expect(onChange.mock.lastCall?.[0].edges).toHaveLength(2);
  });

  it("batches each drag and resize gesture into one undoable geometry mutation", () => {
    const onChange = renderSurface();

    fireEvent.click(screen.getByRole("button", { name: "Move first node gesture" }));
    expect(onChange.mock.calls.map(([, options]) => options?.persist)).toEqual([
      false,
      false,
      true,
    ]);
    expect(onChange.mock.lastCall?.[0].nodes?.[0]).toEqual(
      expect.objectContaining({ x: 48, y: 48 }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(onChange).toHaveBeenLastCalledWith(CANVAS);
    expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Resize first node gesture" }));
    expect(onChange.mock.calls.slice(-2).map(([, options]) => options?.persist)).toEqual([
      false,
      true,
    ]);
    expect(onChange.mock.lastCall?.[0].nodes?.[0]).toEqual(
      expect.objectContaining({ width: 300, height: 160 }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(onChange).toHaveBeenLastCalledWith(CANVAS);
    expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled();
  });

  it("does not reset an in-flight drag when preview content refreshes", () => {
    const onChange = vi.fn();
    const props = {
      canvas: CANVAS,
      documentKey: "file:///workspace::.afx/project.canvas",
      onChange,
      onNodeAction: vi.fn(),
      onRunCanvasAction: vi.fn(),
    };
    const view = render(<ReactFlowCanvas {...props} fileContents={EMPTY_FILE_CONTENTS} />);

    fireEvent.click(screen.getByRole("button", { name: "Begin first node drag" }));
    expect(screen.getByTestId("first-node-position")).toHaveTextContent('{"x":16,"y":16}');

    view.rerender(<ReactFlowCanvas {...props} fileContents={{ a: "# Refreshed preview" }} />);
    expect(screen.getByTestId("first-node-position")).toHaveTextContent('{"x":16,"y":16}');

    fireEvent.click(screen.getByRole("button", { name: "Finish first node drag" }));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        nodes: expect.arrayContaining([expect.objectContaining({ id: "a", x: 16, y: 16 })]),
      }),
      { persist: true },
    );
  });

  it("enables visible-only rendering once an architecture map crosses the large-graph limit", () => {
    const canvas: JSONCanvas = {
      nodes: Array.from({ length: 81 }, (_, index) => ({
        id: `file-${index}`,
        type: "file",
        file: `docs/specs/${index}/spec.md`,
        x: index * 320,
        y: 0,
        width: 280,
        height: 140,
      })),
      edges: [],
    };
    const onFileContentMount = vi.fn();

    render(
      <ReactFlowCanvas
        canvas={canvas}
        documentKey="large-architecture-map"
        onChange={vi.fn()}
        onNodeAction={vi.fn()}
        onRunCanvasAction={vi.fn()}
        onFileContentMount={onFileContentMount}
      />,
    );

    expect(screen.getByTestId("react-flow-harness")).toHaveAttribute("data-visible-only", "true");
    expect(onFileContentMount).not.toHaveBeenCalled();
  });

  it("decorates mounted nodes with previews and disables dragging for locked nodes", () => {
    const canvas: JSONCanvas = {
      nodes: [
        {
          id: "locked",
          type: "text",
          text: "Locked service",
          x: 0,
          y: 0,
          width: 240,
          height: 120,
          afxLayout: { locked: true },
        },
      ],
      edges: [],
    };
    render(
      <ReactFlowCanvas
        canvas={canvas}
        documentKey="locked-preview"
        nodePreviews={{
          locked: {
            state: "ready",
            payload: { kind: "file", state: "ready", excerpt: "Service contract" },
          },
        }}
        onChange={vi.fn()}
        onNodeAction={vi.fn()}
        onRunCanvasAction={vi.fn()}
      />,
    );

    expect(screen.getByTestId("first-node-draggable")).toHaveTextContent("false");
    expect(screen.getByTestId("first-node-preview")).toHaveTextContent("Service contract");
  });

  it("stores and restores viewport state independently for each Canvas document", () => {
    const onChange = vi.fn();
    const props = {
      canvas: CANVAS,
      fileContents: EMPTY_FILE_CONTENTS,
      onChange,
      onNodeAction:
        vi.fn<
          (
            node: CanvasNode,
            action: "open" | "preview" | "loadPreview" | "chat" | "note" | "delete" | "expand",
          ) => void
        >(),
      onRunCanvasAction: vi.fn<(node: CanvasNode, action: CanvasActionMetadata) => void>(),
    };
    const view = render(<ReactFlowCanvas {...props} documentKey="canvas-a" />);
    fireEvent.click(screen.getByRole("button", { name: "Move viewport" }));

    view.rerender(<ReactFlowCanvas {...props} documentKey="canvas-b" />);
    view.rerender(<ReactFlowCanvas {...props} documentKey="canvas-a" />);

    expect(flowApi.setViewport).toHaveBeenLastCalledWith(
      { x: 120, y: -45, zoom: 1.4 },
      { duration: 0 },
    );
  });

  it("keeps wheel pan separate from bounded modifier-wheel zoom", () => {
    renderSurface();
    const harness = screen.getByTestId("react-flow-harness");
    expect(harness).toHaveAttribute("data-zoom-on-scroll", "false");
    expect(harness).toHaveAttribute("data-zoom-on-pinch", "false");
    expect(harness).toHaveAttribute("data-zoom-activation-key-code", "null");
    expect(harness).toHaveAttribute("data-pan-on-scroll", "true");
    expect(harness).toHaveAttribute("data-pan-on-scroll-speed", "0.35");
    expect(harness).toHaveAttribute("data-min-zoom", "0.2");
    expect(harness).toHaveAttribute("data-max-zoom", "3");

    const surface = screen.getByTestId("react-flow-canvas");
    fireEvent.wheel(surface, { deltaY: 800, metaKey: true, clientX: 120, clientY: 80 });

    // Wheel steps apply immediately — per-tick animations are what made the
    // canvas visibly jump during a zoom gesture.
    expect(flowApi.setViewport).toHaveBeenLastCalledWith(
      expect.objectContaining({
        zoom: expect.closeTo(0.8659, 3),
      }),
      { duration: 0 },
    );
  });

  it("accumulates a wheel burst monotonically instead of re-reading animated viewports", () => {
    renderSurface();
    const surface = screen.getByTestId("react-flow-canvas");
    flowApi.setViewport.mockClear();
    // getViewport always reports zoom 1 (an animation-lagged value); the burst
    // must still compound from its own accumulated target, strictly zooming out.
    for (let tick = 0; tick < 4; tick += 1) {
      fireEvent.wheel(surface, { deltaY: 200, metaKey: true, clientX: 120, clientY: 80 });
    }
    const zooms = flowApi.setViewport.mock.calls.map((call) => (call[0] as { zoom: number }).zoom);
    expect(zooms).toHaveLength(4);
    for (let index = 1; index < zooms.length; index += 1) {
      expect(zooms[index]).toBeLessThan(zooms[index - 1]);
    }
  });

  it("uses host-scoped view state for a custom editor without touching shared localStorage", () => {
    const onViewStateChange = vi.fn();
    const props = {
      canvas: CANVAS,
      documentKey: "shared-canvas",
      fileContents: EMPTY_FILE_CONTENTS,
      onChange: vi.fn(),
      onNodeAction:
        vi.fn<
          (
            node: CanvasNode,
            action: "open" | "preview" | "loadPreview" | "chat" | "note" | "delete" | "expand",
          ) => void
        >(),
      onRunCanvasAction: vi.fn<(node: CanvasNode, action: CanvasActionMetadata) => void>(),
      onViewStateChange,
    };
    const view = render(
      <ReactFlowCanvas
        {...props}
        viewState={{ x: -20, y: 80, zoom: 0.8, selectedIds: ["a", "edge-a-b"] }}
      />,
    );

    expect(flowApi.setViewport).toHaveBeenLastCalledWith(
      { x: -20, y: 80, zoom: 0.8 },
      { duration: 0 },
    );
    fireEvent.click(screen.getByRole("button", { name: "Move viewport" }));
    expect(onViewStateChange).toHaveBeenLastCalledWith({
      x: 120,
      y: -45,
      zoom: 1.4,
      selectedIds: ["a", "edge-a-b"],
    });
    expect(globalThis.localStorage.length).toBe(0);

    view.rerender(
      <ReactFlowCanvas {...props} viewState={{ x: 300, y: 10, zoom: 1.2, selectedIds: ["b"] }} />,
    );
    expect(flowApi.setViewport).toHaveBeenLastCalledWith(
      { x: 300, y: 10, zoom: 1.2 },
      { duration: 0 },
    );
  });

  it("validates connections, reconnects an edge, and maps endpoint sides", () => {
    const onChange = renderSurface();
    fireEvent.click(screen.getByRole("button", { name: "Connect node to itself" }));
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Connect valid nodes" }));
    const connected = onChange.mock.lastCall?.[0];
    expect(connected?.edges).toHaveLength(2);
    expect(connected?.edges?.[1]).toEqual(
      expect.objectContaining({
        fromNode: "a",
        fromSide: "right",
        toNode: "b",
        toSide: "left",
        toEnd: "arrow",
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Reconnect first edge" }));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        edges: expect.arrayContaining([
          expect.objectContaining({ id: "edge-a-b", fromNode: "a", toNode: "c" }),
        ]),
      }),
    );
  });

  it("styles selected edges and toggles compact graph affordances", () => {
    const onChange = renderSurface();
    fireEvent.click(screen.getByRole("button", { name: "Select first edge" }));
    fireEvent.click(screen.getByRole("button", { name: "Inspect selected edges" }));

    fireEvent.change(screen.getByRole("combobox", { name: "Edge route" }), {
      target: { value: "straight" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Edge stroke" }), {
      target: { value: "dashed" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Start marker" }), {
      target: { value: "arrow" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "End marker" }), {
      target: { value: "none" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply connector" }));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        edges: expect.arrayContaining([
          expect.objectContaining({
            id: "edge-a-b",
            fromEnd: "arrow",
            toEnd: "none",
            afxStyle: expect.objectContaining({ route: "straight", stroke: "dashed" }),
          }),
        ]),
      }),
    );
    fireEvent.change(screen.getByRole("textbox", { name: "Edge color" }), {
      target: { value: "5" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply appearance" }));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        edges: expect.arrayContaining([
          expect.objectContaining({
            id: "edge-a-b",
            color: "5",
          }),
        ]),
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Detach generated dependency" }));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        edges: expect.arrayContaining([
          expect.objectContaining({
            id: "edge-a-b:manual",
            afxProvenance: expect.objectContaining({
              detached: true,
              generatedEdgeId: "edge-a-b",
              suppressionKey: expect.stringContaining("edge-a-b"),
            }),
          }),
        ]),
      }),
    );

    expect(screen.getByTestId("react-flow-minimap")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Hide minimap" }));
    expect(screen.queryByTestId("react-flow-minimap")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Disable snap" }));
    expect(screen.getByRole("button", { name: "Enable snap" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fit selection or canvas" })).toBeEnabled();
  });

  it("applies an inspector edit to every selected edge", () => {
    const onChange = vi.fn();
    const secondEdge: CanvasEdge = {
      id: "edge-b-c",
      fromNode: "b",
      fromSide: "right",
      toNode: "c",
      toSide: "left",
      toEnd: "arrow",
      afxStyle: { version: 1, route: "bezier", stroke: "solid" },
    };
    render(
      <ReactFlowCanvas
        canvas={{ ...CANVAS, edges: [...(CANVAS.edges ?? []), secondEdge] }}
        documentKey="multi-edge-canvas"
        fileContents={EMPTY_FILE_CONTENTS}
        onChange={onChange}
        onNodeAction={vi.fn()}
        onRunCanvasAction={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Select all edges" }));
    fireEvent.click(screen.getByRole("button", { name: "Inspect selected edges" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Edge color" }), {
      target: { value: "6" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply appearance" }));

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        edges: expect.arrayContaining([
          expect.objectContaining({ id: "edge-a-b", color: "6" }),
          expect.objectContaining({ id: "edge-b-c", color: "6" }),
        ]),
      }),
    );
  });

  it("derives truthful export preflight statuses for local and remote references", () => {
    const referenced: JSONCanvas = {
      nodes: [
        { id: "ready", type: "file", file: "docs/ready.md", x: 0, y: 0, width: 200, height: 100 },
        {
          id: "missing",
          type: "file",
          file: "docs/missing.md",
          x: 0,
          y: 120,
          width: 200,
          height: 100,
        },
        {
          id: "loading",
          type: "file",
          file: "docs/loading.md",
          x: 0,
          y: 240,
          width: 200,
          height: 100,
        },
        {
          id: "uninspected",
          type: "file",
          file: "docs/uninspected.md",
          x: 0,
          y: 360,
          width: 200,
          height: 100,
        },
        {
          id: "remote",
          type: "link",
          url: "https://example.com",
          x: 0,
          y: 480,
          width: 200,
          height: 100,
        },
      ],
      edges: [],
    };

    expect(
      canvasExportReferenceStatuses(referenced, {
        ready: {
          state: "ready",
          payload: { kind: "markdown", state: "ready", content: "# Ready" },
        },
        missing: {
          state: "missing",
          payload: { kind: "markdown", state: "missing", message: "Gone" },
        },
        loading: { state: "loading" },
      }),
    ).toEqual([
      expect.objectContaining({ nodeId: "loading", state: "stale" }),
      expect.objectContaining({ nodeId: "missing", state: "missing", message: "Gone" }),
      expect.objectContaining({ nodeId: "remote", state: "external" }),
      expect.objectContaining({ nodeId: "uninspected", state: "external" }),
    ]);
  });

  it("marks non-detached dependency edges live only while a refresh is in flight (FR-47)", () => {
    const props = {
      documentKey: "file:///workspace::.afx/project.canvas",
      fileContents: EMPTY_FILE_CONTENTS,
      onChange: vi.fn(),
      onNodeAction: vi.fn(),
      onRunCanvasAction: vi.fn(),
    };
    const view = render(
      <ReactFlowCanvas {...props} canvas={CANVAS} dependenciesRefreshing={false} />,
    );
    expect(screen.getByTestId("first-edge-data").textContent).not.toContain("refreshing");

    view.rerender(<ReactFlowCanvas {...props} canvas={CANVAS} dependenciesRefreshing />);
    expect(screen.getByTestId("first-edge-data").textContent).toContain('"live":"refreshing"');

    // A detached dependency edge never animates.
    const detached: JSONCanvas = {
      ...CANVAS,
      edges: [
        {
          ...(CANVAS.edges ?? [])[0],
          afxProvenance: {
            version: 1,
            kind: "declared-dependency",
            owner: "docs/specs/229-app-workbench-canvas/spec.md",
            detached: true,
          },
        },
      ],
    };
    view.rerender(<ReactFlowCanvas {...props} canvas={detached} dependenciesRefreshing />);
    expect(screen.getByTestId("first-edge-data").textContent).not.toContain("refreshing");
  });

  it("shows a live zoom readout that resets to 100% (FR-45)", () => {
    renderSurface();
    const readout = screen.getByTestId("canvas-zoom-readout");
    expect(readout).toHaveTextContent("100%");
    fireEvent.click(readout);
    expect(flowApi.zoomTo).toHaveBeenCalledWith(1, expect.anything());
    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(flowApi.zoomIn).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Zoom out" }));
    expect(flowApi.zoomOut).toHaveBeenCalled();
  });

  it("deletes the current selection from the toolbar (FR-45)", () => {
    const onChange = renderSurface();
    expect(screen.getByRole("button", { name: "Delete selection" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Select first two nodes" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete selection" }));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        nodes: [expect.objectContaining({ id: "c" })],
      }),
    );
  });

  it("cycles the background pattern dots -> grid -> none and persists lazily", () => {
    renderSurface();
    const background = () => screen.queryByTestId("react-flow-background");
    expect(background()).toHaveAttribute("data-variant", "dots");
    // Default pattern writes nothing (host-scoped surfaces stay storage-free).
    expect(globalThis.localStorage.getItem("afx.canvas.background.v1")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Background: Dots/ }));
    expect(background()).toHaveAttribute("data-variant", "lines");
    expect(globalThis.localStorage.getItem("afx.canvas.background.v1")).toBe("grid");

    fireEvent.click(screen.getByRole("button", { name: /Background: Grid/ }));
    expect(background()).toBeNull();
    expect(globalThis.localStorage.getItem("afx.canvas.background.v1")).toBe("none");

    fireEvent.click(screen.getByRole("button", { name: /Background: None/ }));
    expect(background()).toHaveAttribute("data-variant", "dots");
    expect(globalThis.localStorage.getItem("afx.canvas.background.v1")).toBeNull();
  });
});
