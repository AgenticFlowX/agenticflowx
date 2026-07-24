import { describe, expect, it } from "vitest";

import type { JSONCanvas } from "@afx/shared";

import { analyzeCanvasArchitecture, focusCanvasNeighborhood, searchCanvasNodes } from "./explorer";

const canvas: JSONCanvas = {
  nodes: [
    {
      id: "ui",
      type: "text",
      text: "## Checkout UI\n\nCustomer entry point",
      x: 0,
      y: 0,
      width: 200,
      height: 100,
    },
    { id: "api", type: "text", text: "## Order API", x: 260, y: 0, width: 200, height: 100 },
    {
      id: "spec",
      type: "file",
      file: "docs/specs/checkout/spec.md",
      afxSource: {
        rootUri: "file:///product",
        rootName: "product",
        relativePath: "docs/specs/checkout/spec.md",
      },
      afxSpec: { version: 1, documentKind: "spec", status: "Approved" },
      x: 520,
      y: 0,
      width: 220,
      height: 120,
    },
    { id: "db", type: "text", text: "## Orders DB", x: 780, y: 0, width: 200, height: 100 },
    { id: "note", type: "text", text: "Unsorted thought", x: 0, y: 260, width: 200, height: 100 },
  ],
  edges: [
    { id: "e1", fromNode: "ui", toNode: "api" },
    { id: "e2", fromNode: "api", toNode: "spec" },
    { id: "e3", fromNode: "spec", toNode: "db" },
  ],
};

describe("Canvas architecture explorer", () => {
  it("searches titles, content, paths, and root identity deterministically", () => {
    expect(searchCanvasNodes(canvas, { query: "checkout customer" })).toMatchObject([
      { nodeId: "ui", title: "Checkout UI", degree: 1 },
    ]);
    expect(searchCanvasNodes(canvas, { query: "checkout spec", types: ["file"] })).toMatchObject([
      { nodeId: "spec", type: "file" },
    ]);
    expect(searchCanvasNodes(canvas, { rootUris: ["file:///product"] })).toMatchObject([
      { nodeId: "spec" },
    ]);
    expect(searchCanvasNodes(canvas, { statuses: ["approved"] })).toMatchObject([
      { nodeId: "spec", documentKind: "spec", status: "Approved" },
    ]);
    expect(searchCanvasNodes(canvas, { statuses: ["draft"] })).toEqual([]);
  });

  it("returns a bounded one-to-three-hop neighborhood", () => {
    expect(focusCanvasNeighborhood(canvas, ["api"], 1)).toEqual({
      nodeIds: ["api", "spec", "ui"],
      edgeIds: ["e1", "e2"],
      distanceByNodeId: { api: 0, spec: 1, ui: 1 },
    });
    expect(focusCanvasNeighborhood(canvas, ["api"], 2).nodeIds).toEqual([
      "api",
      "spec",
      "ui",
      "db",
    ]);
    expect(() => focusCanvasNeighborhood(canvas, ["api"], 4)).toThrow(/0 to 3/);
  });

  it("reports components, isolates, dangling edges, duplicates, and cycles", () => {
    const broken: JSONCanvas = {
      nodes: [...(canvas.nodes ?? []), { ...(canvas.nodes?.[0] ?? {}), id: "ui" } as never],
      edges: [
        ...(canvas.edges ?? []),
        { id: "e3", fromNode: "db", toNode: "api" },
        { id: "self", fromNode: "note", toNode: "note" },
        { id: "missing", fromNode: "api", toNode: "gone" },
      ],
    };
    const analysis = analyzeCanvasArchitecture(broken);

    expect(analysis).toMatchObject({ nodes: 6, edges: 6, components: 2, cyclic: true });
    expect(analysis.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
      expect.arrayContaining([
        "duplicate-node-id",
        "duplicate-edge-id",
        "missing-edge-endpoint",
        "self-loop",
        "cycle",
      ]),
    );
  });

  it("stays deterministic and bounded at 1,000 nodes", () => {
    const large: JSONCanvas = {
      nodes: Array.from({ length: 1_000 }, (_, index) => ({
        id: `n-${index.toString().padStart(4, "0")}`,
        type: "text" as const,
        text: `Service ${index}`,
        x: index * 10,
        y: 0,
        width: 160,
        height: 80,
      })),
      edges: Array.from({ length: 999 }, (_, index) => ({
        id: `e-${index}`,
        fromNode: `n-${index.toString().padStart(4, "0")}`,
        toNode: `n-${(index + 1).toString().padStart(4, "0")}`,
      })),
    };

    expect(searchCanvasNodes(large, { query: "service", limit: 25 })).toHaveLength(25);
    expect(focusCanvasNeighborhood(large, ["n-0500"], 3).nodeIds).toHaveLength(7);
    expect(analyzeCanvasArchitecture(large)).toMatchObject({ components: 1, cyclic: false });
  });
});
