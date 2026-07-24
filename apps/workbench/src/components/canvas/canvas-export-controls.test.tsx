/**
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-42] [NFR-9]
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { JSONCanvas } from "@afx/shared";

import { CanvasExportControls } from "./canvas-export-controls";

const canvas: JSONCanvas = {
  nodes: [
    { id: "a", type: "text", text: "A", x: 0, y: 0, width: 200, height: 100 },
    { id: "b", type: "file", file: "docs/spec.md", x: 260, y: 0, width: 220, height: 120 },
  ],
  edges: [{ id: "e", fromNode: "a", toNode: "b" }],
};

describe("CanvasExportControls", () => {
  it("exports deterministic portable Canvas bytes without mutating the source", async () => {
    const user = userEvent.setup();
    const onExport = vi.fn();
    render(
      <CanvasExportControls
        canvas={canvas}
        selectedNodeIds={[]}
        documentLabel="Architecture Map.canvas"
        onExport={onExport}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Export canvas" }));
    expect(screen.getByRole("status")).toHaveTextContent("2 nodes · 1 edges");
    await user.click(screen.getByRole("button", { name: "Save .canvas…" }));

    expect(onExport).toHaveBeenCalledWith(
      expect.objectContaining({
        format: "canvas",
        encoding: "utf8",
        suggestedName: "Architecture-Map.canvas",
        content: expect.stringContaining('"nodes"'),
      }),
    );
    expect(canvas.nodes?.[0]).toMatchObject({ x: 0, y: 0 });
  });

  it("blocks export until reference issues are explicitly acknowledged", async () => {
    const user = userEvent.setup();
    const onExport = vi.fn();
    render(
      <CanvasExportControls
        canvas={canvas}
        selectedNodeIds={[]}
        referenceStatuses={[{ nodeId: "b", state: "missing", reference: "docs/spec.md" }]}
        onExport={onExport}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Export canvas" }));
    expect(screen.getByRole("button", { name: "Save .canvas…" })).toBeDisabled();
    await user.click(
      screen.getByRole("checkbox", {
        name: /Export the safe fallback without embedding unavailable content/,
      }),
    );
    await user.click(screen.getByRole("button", { name: "Save .canvas…" }));

    expect(onExport).toHaveBeenCalledTimes(1);
  });

  it("exports safe non-interactive SVG for an image handoff", async () => {
    const user = userEvent.setup();
    const onExport = vi.fn();
    render(<CanvasExportControls canvas={canvas} selectedNodeIds={[]} onExport={onExport} />);

    await user.click(screen.getByRole("button", { name: "Export canvas" }));
    await user.selectOptions(screen.getByRole("combobox", { name: "Export format" }), "svg");
    await user.click(screen.getByRole("button", { name: "Save SVG…" }));

    expect(onExport).toHaveBeenCalledWith(
      expect.objectContaining({
        format: "svg",
        encoding: "utf8",
        suggestedName: "canvas.svg",
        content: expect.stringMatching(/^<svg /),
      }),
    );
    expect(onExport.mock.calls[0]?.[0].content).not.toContain("<script");
  });

  it("rasterizes the safe SVG projection into an explicitly encoded PNG payload", async () => {
    const user = userEvent.setup();
    const onExport = vi.fn();
    const rasterizePng = vi.fn().mockResolvedValue({
      content: "iVBORw0KGgo=",
      encoding: "base64" as const,
      width: 480,
      height: 240,
      byteLength: 8,
    });
    render(
      <CanvasExportControls
        canvas={canvas}
        selectedNodeIds={[]}
        onExport={onExport}
        rasterizePng={rasterizePng}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Export canvas" }));
    await user.selectOptions(screen.getByRole("combobox", { name: "Export format" }), "png");
    expect(screen.getByText(/PNG pixels can vary/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Save PNG…" }));

    expect(rasterizePng).toHaveBeenCalledWith(expect.stringMatching(/^<svg /));
    expect(onExport).toHaveBeenCalledWith({
      format: "png",
      encoding: "base64",
      content: "iVBORw0KGgo=",
      suggestedName: "canvas.png",
    });
  });

  it("keeps the export dialog open and reports PNG rasterization failures", async () => {
    const user = userEvent.setup();
    const onExport = vi.fn();
    render(
      <CanvasExportControls
        canvas={canvas}
        selectedNodeIds={[]}
        onExport={onExport}
        rasterizePng={vi.fn().mockRejectedValue(new Error("PNG bitmap unavailable"))}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Export canvas" }));
    await user.selectOptions(screen.getByRole("combobox", { name: "Export format" }), "png");
    await user.click(screen.getByRole("button", { name: "Save PNG…" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("PNG bitmap unavailable");
    expect(screen.getByRole("combobox", { name: "Export format" })).toHaveValue("png");
    expect(onExport).not.toHaveBeenCalled();
  });

  it("exports a selected frame with all fully contained items", async () => {
    const user = userEvent.setup();
    const onExport = vi.fn();
    const framed: JSONCanvas = {
      nodes: [
        { id: "frame", type: "group", label: "System", x: 0, y: 0, width: 600, height: 400 },
        { id: "inside", type: "text", text: "Inside", x: 40, y: 60, width: 200, height: 100 },
        { id: "outside", type: "text", text: "Outside", x: 800, y: 0, width: 200, height: 100 },
      ],
      edges: [{ id: "crossing", fromNode: "inside", toNode: "outside" }],
    };
    render(
      <CanvasExportControls
        canvas={framed}
        selectedNodeIds={["frame"]}
        documentLabel="System map"
        onExport={onExport}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Export canvas" }));
    await user.selectOptions(screen.getByRole("combobox", { name: "Export area" }), "frame");
    expect(screen.getByRole("status")).toHaveTextContent(
      "2 nodes · 0 edges · 1 outside edges omitted",
    );
    await user.click(screen.getByRole("button", { name: "Save .canvas…" }));

    const content = onExport.mock.calls[0]?.[0].content as string;
    expect(content).toContain('"id": "frame"');
    expect(content).toContain('"id": "inside"');
    expect(content).not.toContain('"id": "outside"');
  });
});
