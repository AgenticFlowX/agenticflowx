/**
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-34]
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { JSONCanvas } from "@afx/shared";

import { CanvasArchitectureExplorer } from "./canvas-architecture-explorer";

const canvas: JSONCanvas = {
  nodes: [
    { id: "ui", type: "text", text: "## Checkout UI", x: 0, y: 0, width: 180, height: 80 },
    { id: "api", type: "text", text: "## Order API", x: 240, y: 0, width: 180, height: 80 },
    { id: "db", type: "text", text: "## Orders DB", x: 480, y: 0, width: 180, height: 80 },
    { id: "note", type: "text", text: "Loose note", x: 0, y: 200, width: 180, height: 80 },
  ],
  edges: [
    { id: "one", fromNode: "ui", toNode: "api" },
    { id: "two", fromNode: "api", toNode: "db" },
  ],
};

describe("CanvasArchitectureExplorer", () => {
  it("searches and focuses a configurable relationship neighborhood", async () => {
    const user = userEvent.setup();
    const onFocus = vi.fn();
    render(<CanvasArchitectureExplorer canvas={canvas} onFocus={onFocus} onClearFocus={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Explore canvas architecture" }));
    await user.type(screen.getByRole("textbox", { name: "Search canvas nodes" }), "order api");
    await user.selectOptions(screen.getByRole("combobox", { name: "Relationship depth" }), "2");
    await user.click(screen.getByRole("button", { name: /Order API/ }));

    expect(onFocus).toHaveBeenCalledWith({
      nodeIds: ["api", "db", "ui"],
      edgeIds: ["one", "two"],
      distanceByNodeId: { api: 0, db: 1, ui: 1 },
      isolate: false,
      sourceNodeId: "api",
    });
  });

  it("supports isolate and clearing the topology focus", async () => {
    const user = userEvent.setup();
    const onFocus = vi.fn();
    const onClearFocus = vi.fn();
    render(
      <CanvasArchitectureExplorer canvas={canvas} onFocus={onFocus} onClearFocus={onClearFocus} />,
    );

    await user.click(screen.getByRole("button", { name: "Explore canvas architecture" }));
    await user.click(screen.getByRole("checkbox", { name: "Isolate the focused neighborhood" }));
    await user.click(screen.getByRole("button", { name: /Checkout UI/ }));
    expect(onFocus.mock.calls[0]?.[0]).toMatchObject({ isolate: true, sourceNodeId: "ui" });
    expect(screen.getByRole("navigation", { name: "Canvas focus breadcrumb" })).toHaveTextContent(
      "Checkout UI",
    );
    await user.click(screen.getByRole("button", { name: "Whole canvas" }));
    expect(onClearFocus).toHaveBeenCalledTimes(1);
  });

  it("surfaces isolated-node diagnostics and can focus the affected item", async () => {
    const user = userEvent.setup();
    const onFocus = vi.fn();
    render(<CanvasArchitectureExplorer canvas={canvas} onFocus={onFocus} onClearFocus={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Explore canvas architecture" }));
    await user.click(screen.getByRole("button", { name: /Diagnostics/ }));
    await user.click(screen.getByRole("button", { name: /Node note has no relationships/ }));

    expect(onFocus).toHaveBeenCalledWith(
      expect.objectContaining({ nodeIds: ["note"], isolate: false, sourceNodeId: "note" }),
    );
  });

  it("filters a multi-root map by workspace and color without hiding result scope", async () => {
    const user = userEvent.setup();
    const onOpenSource = vi.fn();
    const multiRoot: JSONCanvas = {
      nodes: [
        {
          id: "product-spec",
          type: "file",
          file: "docs/specs/product/spec.md",
          color: "4",
          afxSource: {
            rootUri: "file:///product",
            rootName: "product",
            relativePath: "docs/specs/product/spec.md",
          },
          afxSpec: { version: 1, documentKind: "spec", status: "Approved" },
          x: 0,
          y: 0,
          width: 240,
          height: 120,
        },
        {
          id: "platform-spec",
          type: "file",
          file: "docs/specs/platform/spec.md",
          color: "5",
          afxSource: {
            rootUri: "file:///platform",
            rootName: "platform",
            relativePath: "docs/specs/platform/spec.md",
          },
          afxSpec: { version: 1, documentKind: "sprint", status: "Living" },
          x: 300,
          y: 0,
          width: 240,
          height: 120,
        },
      ],
      edges: [],
    };
    render(
      <CanvasArchitectureExplorer
        canvas={multiRoot}
        onFocus={vi.fn()}
        onClearFocus={vi.fn()}
        onOpenSource={onOpenSource}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Explore canvas architecture" }));
    expect(screen.getByRole("status")).toHaveTextContent("2 matches");
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Workspace source" }),
      "file:///platform",
    );
    expect(screen.queryByRole("button", { name: /product\/spec\.md/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /platform\/spec\.md/i })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("1 match");
    expect(screen.getByRole("button", { name: /Living/ })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Open spec.md source" }));
    expect(onOpenSource).toHaveBeenCalledWith("platform-spec");

    await user.selectOptions(screen.getByRole("combobox", { name: "Spec status" }), "Approved");
    expect(screen.getByRole("status")).toHaveTextContent("0 matches");
    await user.selectOptions(screen.getByRole("combobox", { name: "Spec status" }), "all");

    await user.selectOptions(screen.getByRole("combobox", { name: "Canvas color" }), "4");
    expect(screen.getByRole("status")).toHaveTextContent("0 matches");
    expect(screen.getByText("No matching canvas item.")).toBeInTheDocument();
  });

  it("announces when a large result set is visually bounded", async () => {
    const user = userEvent.setup();
    const large: JSONCanvas = {
      nodes: Array.from({ length: 175 }, (_, index) => ({
        id: `service-${index}`,
        type: "text" as const,
        text: `Service ${index}`,
        x: index * 20,
        y: 0,
        width: 180,
        height: 80,
      })),
      edges: [],
    };
    render(<CanvasArchitectureExplorer canvas={large} onFocus={vi.fn()} onClearFocus={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Explore canvas architecture" }));
    expect(screen.getByRole("status")).toHaveTextContent("Showing 150 of 175 matches");
    expect(screen.getAllByRole("listitem")).toHaveLength(150);
  });
});
