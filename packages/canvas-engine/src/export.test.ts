import { describe, expect, it } from "vitest";

import type { CanvasEdge, CanvasNode, JSONCanvas } from "@afx/shared";

import {
  CanvasExportError,
  createCanvasExportProjection,
  preflightCanvasExport,
  renderCanvasExportSvg,
  serializePortableCanvasExport,
} from "./export";
import { parseJSONCanvas } from "./parse";

function textNode(
  id: string,
  x: number,
  y: number,
  text = `## ${id}\n\nPlan the next step.`,
  extra: Record<string, unknown> = {},
): CanvasNode {
  return {
    id,
    type: "text",
    text,
    x,
    y,
    width: 180,
    height: 110,
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
    color: "5",
    afxStyle: { version: 1, route: "bezier", stroke: "dashed" },
    customEdge: { retained: true },
    ...extra,
  };
}

function exportFixture(): JSONCanvas {
  return {
    customRoot: { retained: true },
    nodes: [
      {
        id: "frame",
        type: "group",
        label: "Architecture",
        x: 0,
        y: 0,
        width: 500,
        height: 400,
        color: "6",
        customGroup: "keep",
      },
      textNode("alpha", 50, 60),
      textNode("bravo", 270, 210),
      {
        id: "external-link",
        type: "link",
        url: "https://example.test/roadmap?a=1&b=2",
        x: 620,
        y: 100,
        width: 240,
        height: 120,
        color: "2",
        customLink: true,
      },
    ],
    edges: [
      edge("parallel-b", "alpha", "bravo"),
      edge("parallel-a", "alpha", "bravo", { toEnd: "none" }),
      edge("outside", "bravo", "external-link"),
      edge("dangling", "alpha", "missing"),
    ],
  };
}

describe("deterministic Canvas export", () => {
  it("projects full Canvas content while dropping only dangling edges", () => {
    const input = exportFixture();
    const before = structuredClone(input);
    const projection = createCanvasExportProjection(input, { scope: { kind: "full" } });

    expect(input).toEqual(before);
    expect(projection.document["customRoot"]).toEqual({ retained: true });
    expect(projection.document.nodes?.map((node) => node.id)).toEqual([
      "alpha",
      "bravo",
      "external-link",
      "frame",
    ]);
    expect(projection.document.edges?.map((candidate) => candidate.id)).toEqual([
      "outside",
      "parallel-a",
      "parallel-b",
    ]);
    expect(projection.omittedEdgeIds).toEqual(["dangling"]);
    expect(projection.bounds).toEqual({ x: 0, y: 0, width: 860, height: 400 });
    expect(projection.document.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "parallel-a", customEdge: { retained: true } }),
        expect.objectContaining({ id: "parallel-b", afxStyle: expect.any(Object) }),
      ]),
    );
  });

  it("exports a selection with valid parallel edges and optional origin translation", () => {
    const projection = createCanvasExportProjection(exportFixture(), {
      scope: { kind: "selection", nodeIds: ["bravo", "alpha"] },
      translateToOrigin: true,
    });

    expect(projection.document.nodes?.map((node) => node.id)).toEqual(["alpha", "bravo"]);
    expect(projection.document.edges?.map((candidate) => candidate.id)).toEqual([
      "parallel-a",
      "parallel-b",
    ]);
    expect(projection.omittedEdgeIds).toEqual(["dangling", "outside"]);
    expect(projection.sourceBounds).toEqual({ x: 50, y: 60, width: 400, height: 260 });
    expect(projection.bounds).toEqual({ x: 0, y: 0, width: 400, height: 260 });
    expect(projection.document.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "alpha", x: 0, y: 0, customNode: expect.any(Object) }),
        expect.objectContaining({ id: "bravo", x: 220, y: 150 }),
      ]),
    );
  });

  it("exports an explicit group frame and every fully contained node", () => {
    const projection = createCanvasExportProjection(exportFixture(), {
      scope: { kind: "frame", nodeId: "frame" },
    });

    expect(projection.document.nodes?.map((node) => node.id)).toEqual(["alpha", "bravo", "frame"]);
    expect(projection.document.edges?.map((candidate) => candidate.id)).toEqual([
      "parallel-a",
      "parallel-b",
    ]);
    expect(projection.bounds).toEqual({ x: 0, y: 0, width: 500, height: 400 });
  });

  it("uses exact viewport bounds and includes intersecting nodes", () => {
    const projection = createCanvasExportProjection(exportFixture(), {
      scope: { kind: "viewport", bounds: { x: 200, y: 150, width: 500, height: 220 } },
    });

    expect(projection.document.nodes?.map((node) => node.id)).toEqual([
      "alpha",
      "bravo",
      "external-link",
      "frame",
    ]);
    expect(projection.sourceBounds).toEqual({ x: 200, y: 150, width: 500, height: 220 });
    expect(projection.bounds).toEqual(projection.sourceBounds);
  });

  it.each([
    [{ kind: "selection", nodeIds: [] }, /at least one/i],
    [{ kind: "selection", nodeIds: ["alpha", "alpha"] }, /unique/i],
    [{ kind: "selection", nodeIds: ["missing"] }, /unknown/i],
    [{ kind: "frame", nodeId: "missing" }, /not found/i],
    [{ kind: "frame", nodeId: "alpha" }, /group/i],
    [{ kind: "viewport", bounds: { x: 0, y: 0, width: 0, height: 10 } }, /width/i],
    [{ kind: "viewport", bounds: { x: Number.NaN, y: 0, width: 10, height: 10 } }, /finite/i],
  ] as const)("rejects invalid export scope %o", (scope, expected) => {
    expect(() => createCanvasExportProjection(exportFixture(), { scope })).toThrow(
      CanvasExportError,
    );
    expect(() => createCanvasExportProjection(exportFixture(), { scope })).toThrow(expected);
  });

  it("allows an empty full export but rejects unsafe render options", () => {
    const projection = createCanvasExportProjection(
      { customRoot: true, nodes: [], edges: [] },
      { scope: { kind: "full" } },
    );
    expect(projection.document).toEqual({ customRoot: true, nodes: [], edges: [] });
    expect(projection.bounds).toEqual({ x: 0, y: 0, width: 0, height: 0 });
    expect(() => renderCanvasExportSvg(projection, { background: "url(https://evil)" })).toThrow(
      /background/i,
    );
    expect(() => renderCanvasExportSvg(projection, { scale: 0 })).toThrow(/scale/i);
  });

  it("serializes canonical deterministic portable JSON bytes", () => {
    const projection = createCanvasExportProjection(exportFixture(), {
      scope: { kind: "selection", nodeIds: ["alpha", "bravo"] },
    });
    const first = serializePortableCanvasExport(projection);
    const second = serializePortableCanvasExport(
      createCanvasExportProjection(exportFixture(), {
        scope: { kind: "selection", nodeIds: ["bravo", "alpha"] },
      }),
    );

    expect(first).toBe(second);
    expect(first.endsWith("\n")).toBe(true);
    expect(parseJSONCanvas(first)).toEqual(projection.document);
  });

  it("preflights supplied missing, blocked, stale, and external references without mutation", () => {
    const projection = createCanvasExportProjection(exportFixture(), {
      scope: { kind: "full" },
    });
    const before = structuredClone(projection);
    const preflight = preflightCanvasExport(projection, [
      { nodeId: "bravo", state: "stale", reference: "docs/spec.md" },
      { nodeId: "alpha", state: "missing", reference: "missing.png", message: "Not found" },
      { nodeId: "external-link", state: "external", reference: "https://example.test" },
      { nodeId: "bravo", state: "blocked", reference: "private-board" },
      { nodeId: "not-in-export", state: "missing", reference: "ignored" },
    ]);

    expect(projection).toEqual(before);
    expect(preflight.ready).toBe(false);
    expect(preflight.issues.map((issue) => `${issue.nodeId}:${issue.state}`)).toEqual([
      "alpha:missing",
      "bravo:blocked",
      "bravo:stale",
      "external-link:external",
    ]);
    expect(preflight.summary).toEqual({
      nodes: 4,
      edges: 3,
      omittedEdges: 1,
      missing: 1,
      blocked: 1,
      stale: 1,
      external: 1,
    });
  });

  it("renders deterministic SVG dimensions, groups, colors, markers, labels, and parallel edges", () => {
    const projection = createCanvasExportProjection(exportFixture(), {
      scope: { kind: "frame", nodeId: "frame" },
    });
    const first = renderCanvasExportSvg(projection, {
      padding: 10,
      scale: 2,
      background: "#101820",
      title: "Architecture export",
    });
    const second = renderCanvasExportSvg(projection, {
      padding: 10,
      scale: 2,
      background: "#101820",
      title: "Architecture export",
    });

    expect(first).toBe(second);
    expect(first).toContain('width="1040"');
    expect(first).toContain('height="840"');
    expect(first).toContain('viewBox="-10 -10 520 420"');
    expect(first).toContain('fill="#101820"');
    expect(first).toContain('data-node-id="frame"');
    expect(first).toContain('stroke-dasharray="10 7"');
    expect(first).toContain('marker-end="url(#afx-arrow)"');
    expect(first).toContain('data-edge-id="parallel-a"');
    expect(first).toContain('data-edge-id="parallel-b"');
    expect(first).toContain("parallel-a");
  });

  it("defaults omitted toEnd to an arrowhead per JSON Canvas, and omitted fromEnd to none", () => {
    const projection = createCanvasExportProjection(
      {
        nodes: [
          { id: "a", type: "text", text: "A", x: 0, y: 0, width: 100, height: 60 },
          { id: "b", type: "text", text: "B", x: 300, y: 0, width: 100, height: 60 },
        ],
        // Obsidian-authored edges routinely omit both end fields.
        edges: [{ id: "plain", fromNode: "a", toNode: "b" }],
      },
      { scope: { kind: "full" } },
    );
    const svg = renderCanvasExportSvg(projection, { padding: 0, scale: 1 });
    expect(svg).toContain('marker-end="url(#afx-arrow)"');
    expect(svg).not.toContain("marker-start=");
  });

  it("escapes hostile IDs, Markdown, labels, and URLs without active HTML or links", () => {
    const hostile: JSONCanvas = {
      nodes: [
        textNode(
          'node" onload="alert(1)',
          0,
          0,
          '# Hello </text><script>alert("x&y")</script> [bad](javascript:alert(1))',
        ),
        {
          id: "link",
          type: "link",
          url: 'https://example.test/?q=<script>&name="x"',
          x: 240,
          y: 0,
          width: 280,
          height: 120,
        },
      ],
      edges: [
        edge('edge" onclick="evil', 'node" onload="alert(1)', "link", {
          label: "</text><script>edge()</script>",
        }),
      ],
    };
    const svg = renderCanvasExportSvg(
      createCanvasExportProjection(hostile, { scope: { kind: "full" } }),
    );

    expect(svg).not.toMatch(/<script/i);
    expect(svg).not.toMatch(/<foreignObject/i);
    expect(svg).not.toMatch(/\shref=/i);
    expect(svg).not.toContain('onload="alert(1)"');
    expect(svg).toContain("&lt;script&gt;");
    expect(svg).toContain("&amp;");
    expect(svg).toContain("&quot;");
  });

  it("retains exact finite dimensions for very large coordinate bounds", () => {
    const projection = createCanvasExportProjection(
      {
        nodes: [
          textNode("far-left", -1_000_000_000, -500_000_000),
          textNode("far-right", 1_000_000_000, 500_000_000),
        ],
        edges: [],
      },
      { scope: { kind: "full" } },
    );
    const svg = renderCanvasExportSvg(projection, { padding: 0 });

    expect(projection.bounds).toEqual({
      x: -1_000_000_000,
      y: -500_000_000,
      width: 2_000_000_180,
      height: 1_000_000_110,
    });
    expect(svg).toContain('viewBox="-1000000000 -500000000 2000000180 1000000110"');
    expect(svg).not.toContain("Infinity");
    expect(svg).not.toContain("NaN");
  });

  it("exports deterministic portable JSON and SVG for 1,000 nodes", () => {
    const nodes = Array.from({ length: 1_000 }, (_, index) =>
      textNode(
        `node-${index.toString().padStart(4, "0")}`,
        (index % 40) * 220,
        Math.floor(index / 40) * 150,
      ),
    );
    const edges = nodes
      .slice(1)
      .map((node, index) =>
        edge(`edge-${index.toString().padStart(4, "0")}`, nodes[index]!.id, node.id),
      );
    const projection = createCanvasExportProjection({ nodes, edges }, { scope: { kind: "full" } });
    const json = serializePortableCanvasExport(projection);
    const svg = renderCanvasExportSvg(projection, { maxTextCharacters: 48 });

    expect(parseJSONCanvas(json).nodes).toHaveLength(1_000);
    expect(parseJSONCanvas(json).edges).toHaveLength(999);
    expect(svg.match(/data-node-id=/g)).toHaveLength(1_000);
    expect(svg.match(/data-edge-id=/g)).toHaveLength(999);
    expect(renderCanvasExportSvg(projection, { maxTextCharacters: 48 })).toBe(svg);
  });
});
