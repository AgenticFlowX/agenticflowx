import { describe, expect, it } from "vitest";

import type { CanvasEdge, CanvasNode, JSONCanvas } from "@afx/shared";

import {
  CanvasCompositionError,
  type CanvasCompositionProposal,
  copyCanvasNodeStyle,
  createCanvasCompositionReplacement,
  getCanvasGroupMembership,
  proposeCanvasComposition,
} from "./composition";
import { applyCanvasMutation } from "./mutations";
import { parseJSONCanvas, serializeJSONCanvas } from "./parse";

function textNode(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  extra: Record<string, unknown> = {},
): CanvasNode {
  return {
    id,
    type: "text",
    text: "## " + id,
    x,
    y,
    width,
    height,
    customNode: { id, retained: true },
    ...extra,
  };
}

function edge(id: string, fromNode: string, toNode: string): CanvasEdge {
  return {
    id,
    fromNode,
    toNode,
    toEnd: "arrow",
    label: id,
    customEdge: { retained: true },
  };
}

function compositionFixture(): JSONCanvas {
  return {
    customRoot: { retained: true },
    nodes: [
      {
        id: "outer",
        type: "group",
        label: "Outer frame",
        x: 0,
        y: 0,
        width: 700,
        height: 500,
        color: "6",
        background: "outer.png",
        backgroundStyle: "cover",
        customGroup: { retained: true },
      },
      {
        id: "inner",
        type: "group",
        label: "Inner frame",
        x: 50,
        y: 50,
        width: 350,
        height: 260,
        customGroup: { retained: true },
      },
      textNode("a", 80, 80, 100, 60, {
        color: "1",
        afxLayout: { rank: 2 },
        afxStyle: {
          shape: "architecture",
          icon: "server",
          typography: "heading",
          density: "comfortable",
          futureStyle: { retained: true },
        },
      }),
      textNode("b", 240, 150, 140, 90, {
        afxStyle: { border: "thin", futureB: 9 },
      }),
      textNode("c", 500, 320, 100, 100),
      textNode("locked", 760, 40, 120, 80, {
        afxLayout: { locked: true, lane: "secure" },
      }),
      textNode("outside", 1_000, 300, 160, 100),
    ],
    edges: [
      edge("parallel-a", "a", "b"),
      edge("parallel-b", "a", "b"),
      edge("outward", "c", "outside"),
    ],
  };
}

function nodeById(canvas: JSONCanvas, id: string): CanvasNode {
  const node = canvas.nodes?.find((candidate) => candidate.id === id);
  if (!node) throw new Error("Missing test node: " + id);
  return node;
}

function proposal(
  canvas: JSONCanvas,
  operation: Parameters<typeof proposeCanvasComposition>[1],
): CanvasCompositionProposal {
  return proposeCanvasComposition(canvas, operation);
}

describe("deterministic Canvas composition", () => {
  it.each([
    ["left", { a: { x: 80 }, b: { x: 80 } }, ["b"]],
    ["center", { a: { x: 180 }, b: { x: 160 } }, ["a", "b"]],
    ["right", { a: { x: 280 }, b: { x: 240 } }, ["a"]],
    ["top", { a: { y: 80 }, b: { y: 80 } }, ["b"]],
    ["middle", { a: { y: 130 }, b: { y: 115 } }, ["a", "b"]],
    ["bottom", { a: { y: 180 }, b: { y: 150 } }, ["a"]],
  ] as const)("aligns a selection to %s", (alignment, expected, changedNodeIds) => {
    const input = compositionFixture();
    const before = structuredClone(input);
    const result = proposal(input, { kind: "align", alignment, nodeIds: ["b", "a"] });

    expect(input).toEqual(before);
    expect(nodeById(result.document, "a")).toMatchObject(expected.a);
    expect(nodeById(result.document, "b")).toMatchObject(expected.b);
    expect(result.changedNodeIds).toEqual(changedNodeIds);
    expect(result.operation).toEqual({ kind: "align", alignment, nodeIds: ["a", "b"] });
    expect(result.document.edges).toEqual(input.edges);
    expect(result.document["customRoot"]).toEqual({ retained: true });
  });

  it.each([
    ["horizontal", { a: { x: 80 }, b: { x: 270 }, c: { x: 500 } }],
    ["vertical", { a: { y: 80 }, b: { y: 185 }, c: { y: 320 } }],
  ] as const)("distributes a selection %sly with equal gaps", (axis, expected) => {
    const result = proposal(compositionFixture(), {
      kind: "distribute",
      axis,
      nodeIds: ["c", "a", "b"],
    });

    for (const [id, geometry] of Object.entries(expected)) {
      expect(nodeById(result.document, id)).toMatchObject(geometry);
    }
    expect(result.changedNodeIds).toEqual(["b"]);
  });

  it("equalizes width, height, or both against an explicit reference", () => {
    const input = compositionFixture();
    const width = proposal(input, {
      kind: "equalizeSize",
      dimension: "width",
      nodeIds: ["c", "a", "b"],
      referenceNodeId: "b",
    });
    const height = proposal(input, {
      kind: "equalizeSize",
      dimension: "height",
      nodeIds: ["c", "a", "b"],
      referenceNodeId: "b",
    });
    const both = proposal(input, {
      kind: "equalizeSize",
      dimension: "both",
      nodeIds: ["c", "a", "b"],
      referenceNodeId: "b",
    });

    expect(["a", "b", "c"].map((id) => nodeById(width.document, id).width)).toEqual([
      140, 140, 140,
    ]);
    expect(["a", "b", "c"].map((id) => nodeById(height.document, id).height)).toEqual([90, 90, 90]);
    expect(
      ["a", "b", "c"].map((id) => {
        const node = nodeById(both.document, id);
        return [node.width, node.height];
      }),
    ).toEqual([
      [140, 90],
      [140, 90],
      [140, 90],
    ]);
  });

  it.each([
    ["front", ["a", "c", "e", "b", "d"]],
    ["back", ["b", "d", "a", "c", "e"]],
    ["forward", ["a", "c", "b", "e", "d"]],
    ["backward", ["b", "a", "d", "c", "e"]],
  ] as const)("moves a multi-selection one deterministic z-order step: %s", (order, expected) => {
    const input: JSONCanvas = {
      nodes: ["a", "b", "c", "d", "e"].map((id, index) => textNode(id, index * 150, 0, 100, 80)),
      edges: [edge("kept", "a", "e")],
    };
    const result = proposal(input, { kind: "zOrder", order, nodeIds: ["d", "b"] });

    expect(result.document.nodes?.map((node) => node.id)).toEqual(expected);
    expect(result.document.edges).toEqual(input.edges);
  });

  it("locks, unlocks, pins, and unpins while retaining unrelated layout metadata", () => {
    const input = compositionFixture();
    const locked = proposal(input, { kind: "setLocked", nodeIds: ["a"], locked: true });
    expect(nodeById(locked.document, "a")["afxLayout"]).toEqual({ rank: 2, locked: true });

    const unlocked = proposal(input, {
      kind: "setLocked",
      nodeIds: ["locked"],
      locked: false,
    });
    expect(nodeById(unlocked.document, "locked")["afxLayout"]).toEqual({ lane: "secure" });

    const pinned = proposal(input, { kind: "setPinned", nodeIds: ["a"], pinned: true });
    expect(nodeById(pinned.document, "a")["afxLayout"]).toEqual({ rank: 2, pinned: true });
    const unpinned = proposal(pinned.document, {
      kind: "setPinned",
      nodeIds: ["a"],
      pinned: false,
    });
    expect(nodeById(unpinned.document, "a")["afxLayout"]).toEqual({ rank: 2 });
  });

  it("creates a portable frame around a selection and inserts it behind the content", () => {
    const input = compositionFixture();
    const result = proposal(input, {
      kind: "createFrame",
      nodeIds: ["b", "a"],
      frame: {
        id: "selection-frame",
        label: "Service boundary",
        padding: 20,
        color: "5",
        metadata: { afxNodeKind: "frame", customFrame: { retained: true } },
      },
    });

    expect(nodeById(result.document, "selection-frame")).toEqual({
      id: "selection-frame",
      type: "group",
      label: "Service boundary",
      x: 60,
      y: 60,
      width: 340,
      height: 200,
      color: "5",
      afxNodeKind: "frame",
      customFrame: { retained: true },
    });
    expect(result.document.nodes?.map((node) => node.id).slice(0, 5)).toEqual([
      "outer",
      "inner",
      "selection-frame",
      "a",
      "b",
    ]);
    expect(result.addedNodeIds).toEqual(["selection-frame"]);
    expect(result.document.edges).toEqual(input.edges);
    expect(() => parseJSONCanvas(serializeJSONCanvas(result.document))).not.toThrow();
  });

  it("derives deterministic direct and transitive membership for nested groups", () => {
    expect(getCanvasGroupMembership(compositionFixture())).toEqual([
      {
        groupId: "inner",
        parentGroupId: "outer",
        containedNodeIds: ["a", "b"],
        directNodeIds: ["a", "b"],
      },
      {
        groupId: "outer",
        containedNodeIds: ["a", "b", "c", "inner"],
        directNodeIds: ["c", "inner"],
      },
    ]);
  });

  it("uses stable IDs to break equal-size overlapping group parent ties", () => {
    const canvas: JSONCanvas = {
      nodes: [
        { id: "group-b", type: "group", x: 0, y: 0, width: 400, height: 300 },
        { id: "component", type: "text", text: "C", x: 20, y: 20, width: 80, height: 60 },
        { id: "group-a", type: "group", x: 0, y: 0, width: 400, height: 300 },
      ],
      edges: [],
    };

    expect(getCanvasGroupMembership(canvas)).toEqual([
      {
        groupId: "group-a",
        containedNodeIds: ["component", "group-b"],
        directNodeIds: ["component", "group-b"],
      },
      {
        groupId: "group-b",
        parentGroupId: "group-a",
        containedNodeIds: ["component", "group-a"],
        directNodeIds: [],
      },
    ]);
  });

  it("moves a frame and its descendants while preserving contained-node size and offsets", () => {
    const input = compositionFixture();
    const result = proposal(input, {
      kind: "transformFrame",
      frameId: "inner",
      bounds: { x: 100, y: 100, width: 400, height: 300 },
      containedNodes: "preserve",
    });

    expect(nodeById(result.document, "inner")).toMatchObject({
      x: 100,
      y: 100,
      width: 400,
      height: 300,
    });
    expect(nodeById(result.document, "a")).toMatchObject({
      x: 130,
      y: 130,
      width: 100,
      height: 60,
    });
    expect(nodeById(result.document, "b")).toMatchObject({
      x: 290,
      y: 200,
      width: 140,
      height: 90,
    });
    expect(nodeById(result.document, "outer")).toEqual(nodeById(input, "outer"));
  });

  it("scales nested frame descendants through one affine geometry change", () => {
    const result = proposal(compositionFixture(), {
      kind: "transformFrame",
      frameId: "inner",
      bounds: { x: 100, y: 100, width: 700, height: 520 },
      containedNodes: "scale",
    });

    expect(nodeById(result.document, "a")).toMatchObject({
      x: 160,
      y: 160,
      width: 200,
      height: 120,
    });
    expect(nodeById(result.document, "b")).toMatchObject({
      x: 480,
      y: 300,
      width: 280,
      height: 180,
    });
  });

  it("aligns a selected outer frame with every nested descendant moving exactly once", () => {
    const result = proposal(compositionFixture(), {
      kind: "align",
      alignment: "right",
      nodeIds: ["outside", "outer"],
    });

    expect(nodeById(result.document, "outer")).toMatchObject({ x: 460 });
    expect(nodeById(result.document, "inner")).toMatchObject({ x: 510 });
    expect(nodeById(result.document, "a")).toMatchObject({ x: 540 });
    expect(nodeById(result.document, "b")).toMatchObject({ x: 700 });
    expect(nodeById(result.document, "c")).toMatchObject({ x: 960 });
    expect(result.changedNodeIds).toEqual(["a", "b", "c", "inner", "outer"]);
  });

  it("copies and pastes complete inert node style without changing node content", () => {
    const input = compositionFixture();
    const copied = copyCanvasNodeStyle(input, "a");
    const result = proposal(input, {
      kind: "pasteStyle",
      nodeIds: ["c", "b"],
      style: copied,
    });

    expect(copied).toEqual({
      color: "1",
      afxStyle: {
        shape: "architecture",
        icon: "server",
        typography: "heading",
        density: "comfortable",
        futureStyle: { retained: true },
      },
    });
    for (const id of ["b", "c"]) {
      expect(nodeById(result.document, id)).toMatchObject({
        text: "## " + id,
        color: "1",
        afxStyle: copied.afxStyle,
        customNode: { id, retained: true },
      });
    }
    expect(result.document.edges).toEqual(input.edges);
  });

  it("patches selected colors and inert AFX style fields while retaining unknown style fields", () => {
    const result = proposal(compositionFixture(), {
      kind: "patchStyle",
      nodeIds: ["b", "a"],
      patch: {
        color: "#abcdef",
        afxStyle: {
          shape: "component",
          icon: null,
          typography: "body",
          density: "compact",
        },
      },
    });

    expect(nodeById(result.document, "a")).toMatchObject({
      color: "#abcdef",
      afxStyle: {
        shape: "component",
        typography: "body",
        density: "compact",
        futureStyle: { retained: true },
      },
    });
    expect(nodeById(result.document, "a")["afxStyle"]).not.toHaveProperty("icon");
    expect(nodeById(result.document, "b")).toMatchObject({
      color: "#abcdef",
      afxStyle: {
        border: "thin",
        futureB: 9,
        shape: "component",
        typography: "body",
        density: "compact",
      },
    });
  });

  it("patches swimlane metadata without losing other layout fields", () => {
    const result = proposal(compositionFixture(), {
      kind: "patchStyle",
      nodeIds: ["a", "b"],
      patch: { afxLayout: { lane: "Application services" } },
    });

    expect(nodeById(result.document, "a")["afxLayout"]).toEqual({
      rank: 2,
      lane: "Application services",
    });
    expect(nodeById(result.document, "b")["afxLayout"]).toEqual({
      lane: "Application services",
    });
  });

  it("authors portable group presentation and inert collapse state", () => {
    const input = compositionFixture();
    const outer = nodeById(input, "outer");
    if (outer.type !== "group") throw new Error("Expected group fixture");
    outer.afxGroup = { version: 1, future: { retained: true } };
    const result = proposal(input, {
      kind: "patchGroup",
      frameId: "outer",
      patch: {
        label: "System context",
        background: "assets/context.png",
        backgroundStyle: "ratio",
        collapsed: true,
        presentationOrder: 2,
      },
    });

    expect(nodeById(result.document, "outer")).toMatchObject({
      label: "System context",
      background: "assets/context.png",
      backgroundStyle: "ratio",
      afxGroup: {
        version: 1,
        collapsed: true,
        presentationOrder: 2,
        future: { retained: true },
      },
      customGroup: { retained: true },
    });
    const expanded = proposal(result.document, {
      kind: "patchGroup",
      frameId: "outer",
      patch: { background: null, collapsed: false, presentationOrder: null },
    });
    expect(nodeById(expanded.document, "outer")).not.toHaveProperty("background");
    expect(nodeById(expanded.document, "outer")["afxGroup"]).toEqual({
      version: 1,
      future: { retained: true },
    });
  });

  it("copies standard group presentation fields only onto another group", () => {
    const input = compositionFixture();
    const copied = copyCanvasNodeStyle(input, "outer");
    const result = proposal(input, {
      kind: "pasteStyle",
      nodeIds: ["inner", "a"],
      style: copied,
    });

    expect(copied).toEqual({ color: "6", background: "outer.png", backgroundStyle: "cover" });
    expect(nodeById(result.document, "inner")).toMatchObject(copied);
    expect(nodeById(result.document, "a")).toMatchObject({ color: "6" });
    expect(nodeById(result.document, "a")).not.toHaveProperty("background");
  });

  it("returns one stale-checked document replacement for undo/history", () => {
    const input = compositionFixture();
    const result = proposal(input, { kind: "align", alignment: "left", nodeIds: ["a", "b"] });
    const replacement = createCanvasCompositionReplacement(input, result);

    expect(replacement).toEqual({ kind: "replaceDocument", document: result.document });
    expect(applyCanvasMutation(input, replacement)).toEqual(result.document);
    expect(() =>
      createCanvasCompositionReplacement({ ...input, changedAfterPreview: true }, result),
    ).toThrow(/changed after the composition proposal/i);
  });

  it.each([
    [{ kind: "align", alignment: "left", nodeIds: ["a"] }, /at least 2/i],
    [{ kind: "distribute", axis: "horizontal", nodeIds: ["a", "b"] }, /at least 3/i],
    [{ kind: "equalizeSize", dimension: "both", nodeIds: ["a"] }, /at least 2/i],
    [{ kind: "align", alignment: "left", nodeIds: ["a", "a"] }, /unique/i],
    [{ kind: "align", alignment: "left", nodeIds: ["a", "missing"] }, /unknown.*missing/i],
    [{ kind: "align", alignment: "left", nodeIds: ["a", "locked"] }, /locked.*locked/i],
    [
      {
        kind: "equalizeSize",
        dimension: "both",
        nodeIds: ["a", "b"],
        referenceNodeId: "c",
      },
      /reference.*selection/i,
    ],
    [{ kind: "createFrame", nodeIds: ["a"], frame: { id: "a", padding: 20 } }, /already exists/i],
    [
      {
        kind: "transformFrame",
        frameId: "a",
        bounds: { x: 0, y: 0, width: 100, height: 100 },
        containedNodes: "preserve",
      },
      /group/i,
    ],
    [
      {
        kind: "transformFrame",
        frameId: "inner",
        bounds: { x: 0, y: 0, width: 0, height: 100 },
        containedNodes: "scale",
      },
      /width/i,
    ],
    [
      {
        kind: "patchStyle",
        nodeIds: ["a"],
        patch: { afxStyle: { shape: "bad\nshape" } },
      },
      /shape/i,
    ],
    [{ kind: "patchGroup", frameId: "a", patch: { collapsed: true } }, /group/i],
  ] as const)("rejects invalid or too-small composition operation %o", (operation, expected) => {
    expect(() => proposal(compositionFixture(), operation as never)).toThrow(
      CanvasCompositionError,
    );
    expect(() => proposal(compositionFixture(), operation as never)).toThrow(expected);
  });

  it("rejects a frame transform that would move a locked descendant", () => {
    const input = compositionFixture();
    const nodes = (input.nodes ?? []).map((node) =>
      node.id === "locked" ? { ...node, x: 100, y: 100 } : node,
    );

    expect(() =>
      proposal(
        { ...input, nodes },
        {
          kind: "transformFrame",
          frameId: "inner",
          bounds: { x: 60, y: 60, width: 350, height: 260 },
          containedNodes: "preserve",
        },
      ),
    ).toThrow(/locked.*locked/i);
  });

  it("is deterministic for selection ordering and remains portable", () => {
    const input = compositionFixture();
    const first = proposal(input, {
      kind: "patchStyle",
      nodeIds: ["c", "a", "b"],
      patch: { color: "3", afxStyle: { density: "compact" } },
    });
    const second = proposal(input, {
      kind: "patchStyle",
      nodeIds: ["b", "c", "a"],
      patch: { color: "3", afxStyle: { density: "compact" } },
    });

    expect(first).toEqual(second);
    expect(parseJSONCanvas(serializeJSONCanvas(first.document))).toEqual(first.document);
  });

  it("handles 1,000 selected nodes deterministically without dropping relationships", () => {
    const nodeIds = Array.from({ length: 1_000 }, (_, index) => "node-" + index);
    const input: JSONCanvas = {
      benchmark: { retained: true },
      nodes: nodeIds.map((id, index) =>
        textNode(id, 1_000 + index * 3, index * 5, 120, 80, { benchmarkIndex: index }),
      ),
      edges: nodeIds.slice(1).map((id, index) => edge("edge-" + index, nodeIds[index]!, id)),
    };
    const first = proposal(input, {
      kind: "align",
      alignment: "left",
      nodeIds,
    });
    const second = proposal(input, {
      kind: "align",
      alignment: "left",
      nodeIds: [...nodeIds].reverse(),
    });

    expect(first).toEqual(second);
    expect(first.document.nodes).toHaveLength(1_000);
    expect(first.document.nodes?.every((node) => node.x === 1_000)).toBe(true);
    expect(first.document.edges).toEqual(input.edges);
    expect(first.document["benchmark"]).toEqual({ retained: true });
  });
});
