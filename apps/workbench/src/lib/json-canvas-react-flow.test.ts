/**
 * @see docs/specs/229-app-workbench-canvas/tasks.md [8.1] [13.1]
 */
import { describe, expect, it } from "vitest";

import type { JSONCanvas } from "@afx/shared";

import { mergeFlowGeometry, projectJSONCanvas } from "./json-canvas-react-flow";

const CANVAS: JSONCanvas = {
  vendor: { keep: true },
  nodes: [
    { id: "a", type: "text", text: "A", x: 1, y: 2, width: 200, height: 100, mystery: 9 },
    { id: "b", type: "text", text: "B", x: 300, y: 2, width: 200, height: 100 },
  ],
  edges: [
    {
      id: "e",
      fromNode: "a",
      toNode: "b",
      toEnd: "arrow",
      afxStyle: {
        version: 1,
        route: "straight",
        stroke: "dashed",
        relationship: "depends on",
        waypoints: [{ x: 220, y: 40 }],
        opacity: 0.65,
      },
    },
  ],
};

describe("JSON Canvas React Flow projection", () => {
  it("projects a flat 1,000-node/2,000-edge fixture in source order", () => {
    const nodes = Array.from({ length: 1_000 }, (_, index) => ({
      id: `n-${index}`,
      type: "text" as const,
      text: `Node ${index}`,
      x: (index % 40) * 240,
      y: Math.floor(index / 40) * 160,
      width: 200,
      height: 120,
    }));
    const edges = Array.from({ length: 2_000 }, (_, index) => ({
      id: `e-${index}`,
      fromNode: nodes[index % nodes.length].id,
      toNode: nodes[(index + 1) % nodes.length].id,
    }));
    const canvas: JSONCanvas = { nodes, edges };

    const projected = projectJSONCanvas(canvas);

    expect(projected.nodes).toHaveLength(1_000);
    expect(projected.edges).toHaveLength(2_000);
    expect(projected.nodes.map((node) => node.id)).toEqual(nodes.map((node) => node.id));
  });

  it("projects direct subflow identities for a grouped 1,000-node architecture fixture", () => {
    const groups = Array.from({ length: 100 }, (_, index) => ({
      id: `group-${index}`,
      type: "group" as const,
      label: `Group ${index}`,
      x: (index % 10) * 2_000,
      y: Math.floor(index / 10) * 2_000,
      width: 1_800,
      height: 1_800,
    }));
    const nodes = Array.from({ length: 900 }, (_, index) => {
      const groupIndex = Math.floor(index / 9);
      const group = groups[groupIndex];
      return {
        id: `component-${index}`,
        type: "text" as const,
        text: `Component ${index}`,
        x: group.x + 100 + (index % 3) * 400,
        y: group.y + 100 + (Math.floor(index / 3) % 3) * 400,
        width: 300,
        height: 240,
      };
    });
    const canvas: JSONCanvas = { nodes: [...groups, ...nodes], edges: [] };

    const projected = projectJSONCanvas(canvas);

    expect(projected.nodes).toHaveLength(1_000);
    expect(projected.nodes.filter((node) => node.parentId !== undefined)).toHaveLength(900);
    expect(projected.nodes.find((node) => node.id === "component-899")).toMatchObject({
      parentId: "group-99",
      position: { x: 900, y: 900 },
    });
  });

  it("projects style metadata without replacing the domain model", () => {
    const projected = projectJSONCanvas(CANVAS);
    expect(projected.edges[0]).toMatchObject({
      type: "canvas-edge",
      style: { strokeDasharray: "8 5", opacity: 0.65 },
      data: {
        canvasEdge: {
          afxStyle: {
            route: "straight",
            relationship: "depends on",
            waypoints: [{ x: 220, y: 40 }],
          },
        },
      },
    });
    expect(CANVAS.edges?.[0]?.fromNode).toBe("a");
  });

  it("merges geometry while preserving unknown fields", () => {
    const projected = projectJSONCanvas(CANVAS);
    projected.nodes[0].position = { x: 50, y: 60 };
    const merged = mergeFlowGeometry(CANVAS, projected.nodes);
    expect(merged.vendor).toEqual({ keep: true });
    expect(merged.nodes?.find((node) => node.id === "a")).toMatchObject({
      id: "a",
      x: 50,
      y: 60,
      mystery: 9,
    });
  });

  it("projects nested JSON Canvas groups as React Flow subflows and merges absolute geometry", () => {
    const grouped: JSONCanvas = {
      nodes: [
        {
          id: "outer",
          type: "group",
          label: "System",
          x: 0,
          y: 0,
          width: 600,
          height: 500,
        },
        {
          id: "inner",
          type: "group",
          label: "Service boundary",
          x: 60,
          y: 70,
          width: 400,
          height: 300,
        },
        {
          id: "component",
          type: "text",
          text: "API",
          x: 120,
          y: 140,
          width: 180,
          height: 100,
          keep: "metadata",
        },
      ],
      edges: [],
    };
    const projected = projectJSONCanvas(grouped);

    expect(projected.nodes).toMatchObject([
      { id: "outer", position: { x: 0, y: 0 } },
      { id: "inner", parentId: "outer", position: { x: 60, y: 70 } },
      { id: "component", parentId: "inner", position: { x: 60, y: 70 } },
    ]);

    projected.nodes.find((node) => node.id === "outer")!.position = { x: 20, y: 30 };
    projected.nodes.find((node) => node.id === "component")!.position = { x: 80, y: 90 };
    const merged = mergeFlowGeometry(grouped, projected.nodes);

    expect(merged.nodes).toMatchObject([
      { id: "outer", x: 20, y: 30 },
      { id: "inner", x: 80, y: 100 },
      { id: "component", x: 160, y: 190, keep: "metadata" },
    ]);
  });

  it("hides descendants of collapsed groups without mutating portable geometry", () => {
    const grouped: JSONCanvas = {
      nodes: [
        {
          id: "outer",
          type: "group",
          label: "System",
          x: 0,
          y: 0,
          width: 600,
          height: 500,
          afxGroup: { version: 1, collapsed: true, future: "retained" },
        },
        {
          id: "inner",
          type: "group",
          label: "Boundary",
          x: 60,
          y: 70,
          width: 400,
          height: 300,
        },
        {
          id: "component",
          type: "text",
          text: "API",
          x: 120,
          y: 140,
          width: 180,
          height: 100,
        },
      ],
      edges: [],
    };

    const projected = projectJSONCanvas(grouped);

    expect(projected.nodes.find((node) => node.id === "outer")?.hidden).not.toBe(true);
    expect(projected.nodes.find((node) => node.id === "inner")?.hidden).toBe(true);
    expect(projected.nodes.find((node) => node.id === "component")?.hidden).toBe(true);
    expect(grouped.nodes?.[0]).toMatchObject({
      width: 600,
      height: 500,
      afxGroup: { version: 1, collapsed: true, future: "retained" },
    });
  });

  it("numbers annotation nodes in document order and marks their leader edges", () => {
    const canvas: JSONCanvas = {
      nodes: [
        { id: "target", type: "text", text: "Target", x: 400, y: 0, width: 200, height: 100 },
        {
          id: "callout-b",
          type: "text",
          text: "Second",
          x: 0,
          y: 200,
          width: 220,
          height: 88,
          afxNodeKind: "annotation",
        },
        {
          id: "callout-a",
          type: "text",
          text: "First",
          x: 0,
          y: 0,
          width: 220,
          height: 88,
          afxNodeKind: "annotation",
        },
      ],
      edges: [
        { id: "leader", fromNode: "callout-b", toNode: "target" },
        { id: "plain", fromNode: "target", toNode: "callout-a" },
      ],
    };

    const projected = projectJSONCanvas(canvas);

    // Document order, 1-based; non-annotations carry no index.
    expect(projected.nodes.find((node) => node.id === "callout-b")?.data.annotationIndex).toBe(1);
    expect(projected.nodes.find((node) => node.id === "callout-a")?.data.annotationIndex).toBe(2);
    expect(
      projected.nodes.find((node) => node.id === "target")?.data.annotationIndex,
    ).toBeUndefined();

    // Only the edge leaving an annotation is a leader; it defaults to dashed.
    const leader = projected.edges.find((edge) => edge.id === "leader");
    expect(leader?.data?.leader).toBe(true);
    expect(leader?.style?.strokeDasharray).toBe("8 5");
    expect(projected.edges.find((edge) => edge.id === "plain")?.data?.leader).toBeUndefined();
  });

  it("defaults an omitted toEnd to an arrowhead per JSON Canvas", () => {
    const canvas: JSONCanvas = {
      nodes: [
        { id: "a", type: "text", text: "A", x: 0, y: 0, width: 100, height: 60 },
        { id: "b", type: "text", text: "B", x: 300, y: 0, width: 100, height: 60 },
      ],
      edges: [
        { id: "omitted", fromNode: "a", toNode: "b" },
        { id: "explicit-none", fromNode: "b", toNode: "a", toEnd: "none" },
      ],
    };

    const projected = projectJSONCanvas(canvas);

    expect(projected.edges.find((edge) => edge.id === "omitted")?.markerEnd).toBeDefined();
    expect(projected.edges.find((edge) => edge.id === "explicit-none")?.markerEnd).toBeUndefined();
  });
});
