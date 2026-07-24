/**
 * @see docs/specs/229-app-workbench-canvas/tasks.md [7.1] [7.2]
 */
import { describe, expect, it } from "vitest";

import type { JSONCanvas } from "@afx/shared";

import {
  applyCanvasMutation,
  canvasContentRevision,
  createCanvasTemplate,
  emptyCanvas,
  parseCanvasAction,
  parseCanvasEdgeProvenance,
  parseCanvasEdgeStyle,
  parseJSONCanvas,
  serializeJSONCanvas,
} from "./index";

describe("canvas engine", () => {
  it("preserves unknown Obsidian and AFX fields through parse/mutation/serialize", () => {
    const source = JSON.stringify({
      vendor: { keep: true },
      nodes: [
        { id: "a", type: "text", text: "A", x: 0, y: 0, width: 200, height: 100, mystery: 7 },
      ],
      edges: [],
    });
    const parsed = parseJSONCanvas(source);
    const changed = applyCanvasMutation(parsed, {
      kind: "updateNode",
      nodeId: "a",
      patch: { x: 20 },
    });
    expect(parseJSONCanvas(serializeJSONCanvas(changed))).toMatchObject({
      vendor: { keep: true },
      nodes: [{ id: "a", x: 20, mystery: 7 }],
    });
  });

  it("keeps malformed or unsupported actions inert", () => {
    expect(parseCanvasAction({ version: 1, action: "shell", command: "rm" })).toBeUndefined();
    expect(
      parseCanvasAction({ version: 1, action: "prepare-spec", command: "rm -rf ." }),
    ).toBeUndefined();
    expect(
      parseCanvasAction({ version: 1, action: "prepare-sprint", command: "/afx-sprint next" }),
    ).toEqual({ version: 1, action: "prepare-sprint", command: "/afx-sprint next" });
    expect(
      parseCanvasAction({ version: 1, action: "send-chat", command: "anything" }),
    ).toBeUndefined();
    expect(
      parseCanvasAction({ version: 1, action: "send-chat", label: "Run\nDelete files" }),
    ).toBeUndefined();
    expect(parseCanvasAction({ version: 1, action: "send-chat", future: true })).toBeUndefined();
    expect(parseCanvasAction({ version: 1, action: "send-chat" })).toMatchObject({
      action: "send-chat",
    });
  });

  it("creates standard portable planning templates", () => {
    const roadmap = createCanvasTemplate("roadmap");
    expect(roadmap.nodes).toHaveLength(4);
    expect(roadmap.nodes?.every((node) => node.type === "text")).toBe(true);
  });

  it("accepts every standard node shape, edge option, and an empty document", () => {
    expect(parseJSONCanvas("  \n")).toEqual(emptyCanvas());
    const source: JSONCanvas = {
      nodes: [
        { id: "text", type: "text", text: "Text", x: 0, y: 0, width: 100, height: 80 },
        { id: "file", type: "file", file: "spec.md", x: 120, y: 0, width: 100, height: 80 },
        {
          id: "link",
          type: "link",
          url: "https://example.com",
          x: 240,
          y: 0,
          width: 100,
          height: 80,
        },
        { id: "group", type: "group", label: "Group", x: 0, y: 120, width: 400, height: 200 },
      ],
      edges: [
        {
          id: "edge",
          fromNode: "text",
          fromSide: "right",
          fromEnd: "none",
          toNode: "file",
          toSide: "left",
          toEnd: "arrow",
        },
      ],
    };

    expect(parseJSONCanvas(JSON.stringify(source))).toEqual(source);
    expect(serializeJSONCanvas(source).endsWith("\n")).toBe(true);
  });

  it.each([
    ["bad JSON", "{"],
    ["non-object root", "[]"],
    ["non-array nodes", '{"nodes":{}}'],
    ["non-array edges", '{"edges":{}}'],
    ["non-object node", '{"nodes":[null]}'],
    [
      "missing node geometry",
      '{"nodes":[{"id":"a","type":"text","text":"A","x":0,"y":0,"width":1}]}',
    ],
    [
      "missing type payload",
      '{"nodes":[{"id":"a","type":"file","x":0,"y":0,"width":1,"height":1}]}',
    ],
    ["non-object edge", '{"edges":[false]}'],
    ["invalid edge side", '{"edges":[{"id":"e","fromNode":"a","toNode":"b","fromSide":"middle"}]}'],
    ["invalid edge end", '{"edges":[{"id":"e","fromNode":"a","toNode":"b","toEnd":"circle"}]}'],
    [
      "duplicate cross-kind id",
      '{"nodes":[{"id":"same","type":"text","text":"A","x":0,"y":0,"width":1,"height":1}],"edges":[{"id":"same","fromNode":"same","toNode":"same"}]}',
    ],
  ])("rejects %s", (_label, content) => {
    expect(() => parseJSONCanvas(content)).toThrow();
  });

  it("preserves foreign node types verbatim instead of rejecting the document", () => {
    const source = {
      nodes: [
        { id: "a", type: "video", x: 0, y: 0, width: 320, height: 180, url: "clip.mp4" },
        { id: "b", type: "text", text: "Known", x: 400, y: 0, width: 200, height: 100 },
      ],
      edges: [{ id: "e", fromNode: "a", toNode: "b" }],
    };
    const parsed = parseJSONCanvas(JSON.stringify(source));
    expect(parsed).toEqual(source);
    expect(parseJSONCanvas(serializeJSONCanvas(parsed))).toEqual(source);
  });

  it("still rejects foreign-typed nodes without geometry", () => {
    expect(() =>
      parseJSONCanvas('{"nodes":[{"id":"a","type":"video","x":0,"y":0,"width":1}]}'),
    ).toThrow();
  });

  it("applies every ID-addressed mutation and removes incident edges", () => {
    const a = { id: "a", type: "text" as const, text: "A", x: 0, y: 0, width: 100, height: 80 };
    const b = { id: "b", type: "text" as const, text: "B", x: 120, y: 0, width: 100, height: 80 };
    const edge = { id: "e", fromNode: "a", toNode: "b", toEnd: "arrow" as const };
    let canvas = applyCanvasMutation(emptyCanvas(), { kind: "addNode", node: a });
    canvas = applyCanvasMutation(canvas, { kind: "addNode", node: b });
    canvas = applyCanvasMutation(canvas, { kind: "addEdge", edge });
    canvas = applyCanvasMutation(canvas, { kind: "updateNode", nodeId: "a", patch: { x: 25 } });
    canvas = applyCanvasMutation(canvas, {
      kind: "updateEdge",
      edgeId: "e",
      patch: { label: "links" },
    });

    expect(canvas).toMatchObject({
      nodes: [expect.objectContaining({ id: "a", x: 25 }), expect.objectContaining({ id: "b" })],
      edges: [expect.objectContaining({ id: "e", label: "links" })],
    });
    expect(applyCanvasMutation(canvas, { kind: "removeEdges", edgeIds: ["e"] }).edges).toEqual([]);
    expect(applyCanvasMutation(canvas, { kind: "removeNodes", nodeIds: ["a"] })).toMatchObject({
      nodes: [expect.objectContaining({ id: "b" })],
      edges: [],
    });
    expect(
      applyCanvasMutation(canvas, { kind: "replaceDocument", document: { custom: true } }),
    ).toEqual({ custom: true, nodes: [], edges: [] });
  });

  it("fails closed for duplicate, dangling, or stale mutations", () => {
    const node = { id: "a", type: "text" as const, text: "A", x: 0, y: 0, width: 100, height: 80 };
    const canvas = { nodes: [node], edges: [] };
    expect(() => applyCanvasMutation(canvas, { kind: "addNode", node })).toThrow(/already exists/);
    expect(() =>
      applyCanvasMutation(canvas, {
        kind: "addEdge",
        edge: { id: "e", fromNode: "a", toNode: "missing" },
      }),
    ).toThrow(/no longer exists/);
    expect(() =>
      applyCanvasMutation(canvas, { kind: "updateNode", nodeId: "missing", patch: { x: 1 } }),
    ).toThrow(/no longer exists/);
    expect(() =>
      applyCanvasMutation(canvas, { kind: "updateEdge", edgeId: "missing", patch: { label: "x" } }),
    ).toThrow(/no longer exists/);
  });

  it("validates optional AFX edge presentation and dependency provenance", () => {
    expect(parseCanvasEdgeStyle({ version: 1, route: "smoothstep", stroke: "dotted" })).toEqual({
      version: 1,
      route: "smoothstep",
      stroke: "dotted",
    });
    expect(parseCanvasEdgeStyle({ version: 2 })).toBeUndefined();
    expect(parseCanvasEdgeStyle({ version: 1, route: "arc" })).toBeUndefined();
    expect(parseCanvasEdgeStyle({ version: 1, stroke: "double" })).toBeUndefined();
    expect(
      parseCanvasEdgeStyle({
        version: 1,
        route: "bezier",
        relationship: "event flow",
        waypoints: [
          { x: 120, y: 40 },
          { x: 240, y: 80 },
        ],
        opacity: 0.65,
      }),
    ).toMatchObject({ relationship: "event flow", opacity: 0.65 });
    expect(parseCanvasEdgeStyle({ version: 1, relationship: "bad\nrelationship" })).toBeUndefined();
    expect(parseCanvasEdgeStyle({ version: 1, opacity: 2 })).toBeUndefined();
    expect(
      parseCanvasEdgeStyle({ version: 1, waypoints: [{ x: Number.NaN, y: 1 }] }),
    ).toBeUndefined();
    expect(
      parseCanvasEdgeProvenance({
        version: 1,
        kind: "declared-dependency",
        owner: "spec-a",
        detached: true,
      }),
    ).toMatchObject({ owner: "spec-a", detached: true });
    expect(
      parseCanvasEdgeProvenance({ version: 1, kind: "manual", owner: "spec-a" }),
    ).toBeUndefined();
    expect(parseCanvasEdgeProvenance({ version: 1, kind: "declared-dependency" })).toBeUndefined();
  });

  it("produces deterministic content revisions and portable unique starters", () => {
    expect(canvasContentRevision("same")).toBe(canvasContentRevision("same"));
    expect(canvasContentRevision("same")).not.toBe(canvasContentRevision("changed"));
    for (const template of [
      "blank",
      "ideas",
      "feature",
      "roadmap",
      "next-spec",
      "architecture",
      "low-fidelity",
      "high-fidelity",
    ] as const) {
      const canvas = createCanvasTemplate(template);
      expect(() => parseJSONCanvas(serializeJSONCanvas(canvas))).not.toThrow();
      const ids = [...(canvas.nodes ?? []), ...(canvas.edges ?? [])].map((item) => item.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("provides framed portable architecture and fidelity starters without required AFX metadata", () => {
    const architecture = createCanvasTemplate("architecture");
    const lowFidelity = createCanvasTemplate("low-fidelity");
    const highFidelity = createCanvasTemplate("high-fidelity");

    expect(architecture.nodes).toHaveLength(11);
    expect(lowFidelity.nodes).toHaveLength(9);
    expect(highFidelity.nodes).toHaveLength(12);
    for (const canvas of [architecture, lowFidelity, highFidelity]) {
      expect(canvas.nodes?.some((node) => node.type === "group")).toBe(true);
      expect(canvas.nodes?.some((node) => node.type === "text")).toBe(true);
      expect(canvas.edges?.every((edge) => edge.label && edge.toEnd === "arrow")).toBe(true);
      expect(JSON.stringify(canvas)).not.toContain("afx");
    }
  });
});
