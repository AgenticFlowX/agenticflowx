import { describe, expect, it } from "vitest";

import type { CanvasEdge, CanvasNode, JSONCanvas } from "@afx/shared";

import {
  CanvasLayoutError,
  type CanvasLayoutProposal,
  type CanvasLayoutStrategy,
  MAX_CANVAS_LAYOUT_NODES,
  createCanvasLayoutReplacement,
  proposeCanvasLayout,
} from "./layout";
import { applyCanvasMutation } from "./mutations";
import { parseJSONCanvas, serializeJSONCanvas } from "./parse";

const STRATEGIES: CanvasLayoutStrategy[] = [
  "grid",
  "compact",
  "radial",
  "hierarchical",
  "dependency",
  "swimlane",
];

function textNode(
  id: string,
  x: number,
  y: number,
  extra: Record<string, unknown> = {},
): CanvasNode {
  return {
    id,
    type: "text",
    text: `## ${id}`,
    x,
    y,
    width: 180 + id.length,
    height: 100 + id.length,
    customNode: { id, retained: true },
    ...extra,
  };
}

function edge(id: string, fromNode: string, toNode: string, extra = {}): CanvasEdge {
  return {
    id,
    fromNode,
    toNode,
    toEnd: "arrow",
    label: id,
    afxStyle: { version: 1, route: "smoothstep", stroke: "dashed" },
    customEdge: { retained: true },
    ...extra,
  };
}

function baseCanvas(): JSONCanvas {
  return {
    customRoot: { retained: true },
    nodes: [
      textNode("delta", 1_500, 900),
      textNode("alpha", 1_100, 1_200),
      textNode("charlie", 1_900, 1_600),
      textNode("bravo", 1_300, 1_800),
    ],
    edges: [
      edge("manual-a", "alpha", "bravo"),
      edge("manual-b", "bravo", "charlie"),
      edge("manual-c", "charlie", "alpha"),
    ],
  };
}

function requireReady(result: ReturnType<typeof proposeCanvasLayout>): CanvasLayoutProposal {
  expect(result.status).toBe("ready");
  if (result.status !== "ready") throw new Error("Expected a ready layout proposal");
  return result;
}

function nodeById(canvas: JSONCanvas, id: string): CanvasNode {
  const node = canvas.nodes?.find((candidate) => candidate.id === id);
  if (!node) throw new Error(`Missing test node: ${id}`);
  return node;
}

describe("deterministic Canvas auto-layout", () => {
  it.each(STRATEGIES)(
    "%s returns a deterministic preview without mutating or losing portable fields",
    (strategy) => {
      const input = baseCanvas();
      const before = structuredClone(input);
      const first = requireReady(proposeCanvasLayout(input, { strategy }));
      const second = requireReady(proposeCanvasLayout(input, { strategy }));

      expect(input).toEqual(before);
      expect(first).toEqual(second);
      expect(first.document).not.toBe(input);
      expect(first.document["customRoot"]).toEqual({ retained: true });
      expect(first.document.edges).toEqual(input.edges);
      expect(first.changes.map((change) => change.id)).toEqual(
        [...first.changes.map((change) => change.id)].sort(),
      );
      for (const original of input.nodes ?? []) {
        const proposed = nodeById(first.document, original.id);
        expect(proposed).toMatchObject({
          id: original.id,
          type: original.type,
          width: original.width,
          height: original.height,
          customNode: { id: original.id, retained: true },
        });
        expect(Number.isFinite(proposed.x)).toBe(true);
        expect(Number.isFinite(proposed.y)).toBe(true);
      }
      expect(() => parseJSONCanvas(serializeJSONCanvas(first.document))).not.toThrow();
    },
  );

  it("applies a ready proposal as one stale-checked document replacement", () => {
    const input = baseCanvas();
    const proposal = requireReady(proposeCanvasLayout(input, { strategy: "grid" }));
    const replacement = createCanvasLayoutReplacement(input, proposal);

    expect(replacement).toEqual({ kind: "replaceDocument", document: proposal.document });
    expect(applyCanvasMutation(input, replacement)).toEqual(proposal.document);
    expect(() =>
      createCanvasLayoutReplacement({ ...input, changedAfterPreview: true }, proposal),
    ).toThrow(/changed after the layout preview/i);
  });

  it("cancels before or during work without producing a document", () => {
    const input = baseCanvas();
    expect(proposeCanvasLayout(input, { strategy: "grid" }, { isCancelled: () => true })).toEqual(
      expect.objectContaining({ status: "cancelled", strategy: "grid" }),
    );
    expect(input).toEqual(baseCanvas());

    let checkpoints = 0;
    const during = proposeCanvasLayout(
      {
        nodes: Array.from({ length: 80 }, (_, index) => textNode(`n-${index}`, index, index)),
        edges: [],
      },
      { strategy: "radial" },
      { isCancelled: () => ++checkpoints > 8 },
    );
    expect(during).toEqual(expect.objectContaining({ status: "cancelled" }));
    expect(checkpoints).toBeGreaterThan(8);
  });

  it.each([
    [{ strategy: "spiral" }, /strategy/i],
    [{ strategy: "grid", columns: 0 }, /columns/i],
    [{ strategy: "grid", columns: 1.5 }, /columns/i],
    [{ strategy: "compact", horizontalGap: -1 }, /horizontalGap/i],
    [{ strategy: "radial", radialRadius: Number.NaN }, /radialRadius/i],
    [{ strategy: "grid", direction: "diagonal" }, /direction/i],
    [{ strategy: "grid", nodeIds: ["alpha", "alpha"] }, /unique/i],
    [{ strategy: "grid", nodeIds: ["missing"] }, /unknown/i],
  ] as const)("rejects invalid options %o", (options, expected) => {
    expect(() => proposeCanvasLayout(baseCanvas(), options as never)).toThrowError(
      CanvasLayoutError,
    );
    expect(() => proposeCanvasLayout(baseCanvas(), options as never)).toThrow(expected);
  });

  it("preserves pinned, locked, group, and group-contained geometry by default", () => {
    const input: JSONCanvas = {
      nodes: [
        {
          id: "frame",
          type: "group",
          label: "Architecture frame",
          x: 1_000,
          y: 1_000,
          width: 600,
          height: 420,
          color: "5",
          customGroup: true,
        },
        textNode("inside", 1_050, 1_080),
        textNode("pinned", 2_100, 1_100, {
          afxLayout: { pinned: true, lane: "foundation" },
        }),
        textNode("locked", 2_400, 1_400, { afxLayout: { locked: true } }),
        textNode("free", 3_200, 2_200),
      ],
      edges: [edge("manual", "inside", "free")],
    };
    const proposal = requireReady(proposeCanvasLayout(input, { strategy: "compact" }));

    for (const id of ["frame", "inside", "pinned", "locked"]) {
      expect(nodeById(proposal.document, id)).toMatchObject({
        x: nodeById(input, id).x,
        y: nodeById(input, id).y,
      });
    }
    expect(nodeById(proposal.document, "frame")).toMatchObject({
      color: "5",
      customGroup: true,
    });
    expect(nodeById(proposal.document, "free")).not.toMatchObject({ x: 3_200, y: 2_200 });
    expect(proposal.document.edges).toEqual(input.edges);
  });

  it("moves protected geometry only after explicit pin and group overrides", () => {
    const input: JSONCanvas = {
      nodes: [
        {
          id: "frame",
          type: "group",
          label: "Movable frame",
          x: 1_000,
          y: 1_000,
          width: 500,
          height: 400,
        },
        textNode("inside", 1_050, 1_050),
        textNode("pinned", 2_000, 2_000, { afxLayout: { pinned: true } }),
      ],
      edges: [],
    };
    const proposal = requireReady(
      proposeCanvasLayout(input, {
        strategy: "grid",
        origin: { x: 0, y: 0 },
        respectPins: false,
        preserveGroups: false,
      }),
    );

    expect(proposal.changes.map((change) => change.id)).toEqual(["frame", "inside", "pinned"]);
    expect(nodeById(proposal.document, "frame")).not.toMatchObject({ x: 1_000, y: 1_000 });
    expect(nodeById(proposal.document, "pinned")).not.toMatchObject({ x: 2_000, y: 2_000 });
  });

  it("lays out a selected subset and leaves every other node byte-semantic unchanged", () => {
    const input = baseCanvas();
    const proposal = requireReady(
      proposeCanvasLayout(input, { strategy: "grid", nodeIds: ["alpha", "bravo"] }),
    );

    expect(nodeById(proposal.document, "charlie")).toEqual(nodeById(input, "charlie"));
    expect(nodeById(proposal.document, "delta")).toEqual(nodeById(input, "delta"));
    expect(proposal.changes.every((change) => ["alpha", "bravo"].includes(change.id))).toBe(true);
  });

  it("handles cycles and disconnected components in hierarchical layouts", () => {
    const input: JSONCanvas = {
      nodes: ["a", "b", "c", "d", "e", "orphan"].map((id, index) =>
        textNode(id, 2_000 + index * 50, 2_000),
      ),
      edges: [
        edge("a-b", "a", "b"),
        edge("b-c", "b", "c"),
        edge("c-a", "c", "a"),
        edge("d-e", "d", "e"),
      ],
    };
    const proposal = requireReady(
      proposeCanvasLayout(input, { strategy: "hierarchical", direction: "horizontal" }),
    );
    const positions = (proposal.document.nodes ?? []).map((node) => `${node.x}:${node.y}`);

    expect(new Set(positions).size).toBe(positions.length);
    expect(proposal.document.nodes).toSatisfy((nodes: CanvasNode[] | undefined) =>
      (nodes ?? []).every((node) => Number.isFinite(node.x) && Number.isFinite(node.y)),
    );
    expect(
      proposeCanvasLayout(input, { strategy: "hierarchical", direction: "horizontal" }),
    ).toEqual(proposal);
  });

  it("puts dependencies before dependants and honors declared rank metadata", () => {
    const input: JSONCanvas = {
      nodes: [
        textNode("app", 2_000, 1_000),
        textNode("service", 1_800, 1_200),
        textNode("database", 1_600, 1_400, { afxLayout: { rank: 0 } }),
      ],
      edges: [
        edge("app-service", "app", "service", {
          afxProvenance: {
            version: 1,
            kind: "declared-dependency",
            owner: "app",
            detached: false,
          },
        }),
        edge("service-database", "service", "database", {
          afxProvenance: {
            version: 1,
            kind: "declared-dependency",
            owner: "service",
            detached: false,
          },
        }),
      ],
    };
    const proposal = requireReady(
      proposeCanvasLayout(input, { strategy: "dependency", direction: "horizontal" }),
    );

    expect(nodeById(proposal.document, "database").x).toBeLessThan(
      nodeById(proposal.document, "service").x,
    );
    expect(nodeById(proposal.document, "service").x).toBeLessThan(
      nodeById(proposal.document, "app").x,
    );
  });

  it("uses stable lane and rank metadata for swimlanes", () => {
    const input: JSONCanvas = {
      nodes: [
        textNode("alpha-2", 1_000, 1_000, { afxLayout: { lane: "Alpha", rank: 2 } }),
        textNode("beta-0", 1_100, 1_100, { afxLayout: { lane: "Beta", rank: 0 } }),
        textNode("alpha-0", 1_200, 1_200, { afxLayout: { lane: "Alpha", rank: 0 } }),
        textNode("unassigned", 1_300, 1_300),
      ],
      edges: [],
    };
    const proposal = requireReady(
      proposeCanvasLayout(input, { strategy: "swimlane", direction: "horizontal" }),
    );

    expect(nodeById(proposal.document, "alpha-0").y).toBe(nodeById(proposal.document, "alpha-2").y);
    expect(nodeById(proposal.document, "alpha-0").x).toBeLessThan(
      nodeById(proposal.document, "alpha-2").x,
    );
    expect(nodeById(proposal.document, "beta-0").y).not.toBe(
      nodeById(proposal.document, "alpha-0").y,
    );
  });

  it("returns a valid no-op proposal for an empty document", () => {
    const input: JSONCanvas = { customRoot: true, nodes: [], edges: [] };
    const proposal = requireReady(proposeCanvasLayout(input, { strategy: "grid" }));

    expect(proposal.document).toEqual(input);
    expect(proposal.changes).toEqual([]);
  });

  it("is deterministic across generated graph shapes and preserves every edge", () => {
    for (let seed = 1; seed <= 24; seed += 1) {
      const count = 4 + (seed % 13);
      const nodes = Array.from({ length: count }, (_, index) =>
        textNode(`s${seed}-n${index}`, 5_000 - index * 17, 4_000 + index * 23, {
          afxLayout: {
            lane: `lane-${index % 3}`,
            rank: index % 5,
            pinned: index === seed % count,
          },
        }),
      );
      const edges = nodes.flatMap((node, index) => {
        const next = nodes[(index + 1) % nodes.length];
        return next ? [edge(`s${seed}-e${index}`, node.id, next.id)] : [];
      });
      const input: JSONCanvas = { seed, nodes, edges };
      for (const strategy of STRATEGIES) {
        const first = requireReady(proposeCanvasLayout(input, { strategy }));
        const second = requireReady(proposeCanvasLayout(input, { strategy }));
        expect(first).toEqual(second);
        expect(first.document.edges).toEqual(edges);
        expect(first.document.nodes).toHaveLength(nodes.length);
      }
    }
  });

  it("handles 1,000 nodes and rejects inputs outside the pure-engine bound", () => {
    const nodes = Array.from({ length: 1_000 }, (_, index) =>
      textNode(`node-${index.toString().padStart(4, "0")}`, index * 3, index * 2, {
        afxLayout: {
          lane: `lane-${index % 12}`,
          pinned: index % 127 === 0,
        },
      }),
    );
    const edges = nodes
      .slice(1)
      .map((node, index) => edge(`edge-${index}`, nodes[index]!.id, node.id));
    const input: JSONCanvas = { nodes, edges };

    for (const strategy of STRATEGIES) {
      const proposal = requireReady(proposeCanvasLayout(input, { strategy }));
      expect(proposal.document.nodes).toHaveLength(1_000);
      expect(proposal.document.edges).toEqual(edges);
      expect(proposal.changes.length).toBeGreaterThan(900);
    }

    const tooLarge: JSONCanvas = {
      nodes: Array.from({ length: MAX_CANVAS_LAYOUT_NODES + 1 }, (_, index) =>
        textNode(`too-many-${index}`, index, index),
      ),
      edges: [],
    };
    expect(() => proposeCanvasLayout(tooLarge, { strategy: "grid" })).toThrow(/at most/i);
  });
});
