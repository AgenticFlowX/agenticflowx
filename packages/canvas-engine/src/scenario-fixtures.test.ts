/**
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-4] [FR-33] [NFR-3] [NFR-10]
 * @see docs/specs/229-app-workbench-canvas/design.md [DES-DATA] [DES-CANVAS-INTERACTIONS]
 */
import { describe, expect, it } from "vitest";

import type { CanvasNode, JSONCanvas } from "@afx/shared";

import {
  CANVAS_STRESS_FIXTURE_BOUNDS,
  type CanvasScenarioFixtureId,
  createCanvasScenarioFixture,
  parseJSONCanvas,
  serializeCanvasScenarioFixture,
  serializeJSONCanvas,
} from "./index";

const SCENARIOS: readonly CanvasScenarioFixtureId[] = [
  "beginner",
  "rich-architecture",
  "multi-root-spec-map",
  "nested-frame-presentation",
  "stress",
];

describe("Canvas scenario fixtures", () => {
  it.each(SCENARIOS)("creates deterministic portable bytes for %s", (scenario) => {
    const first = serializeCanvasScenarioFixture(scenario);
    const second = serializeCanvasScenarioFixture(scenario);

    expect(first).toBe(second);
    expect(first.endsWith("\n")).toBe(true);
    expect(parseJSONCanvas(first)).toEqual(createCanvasScenarioFixture(scenario));
  });

  it.each(SCENARIOS)("uses globally unique IDs and valid edge endpoints for %s", (scenario) => {
    const canvas = createCanvasScenarioFixture(scenario);
    const nodes = canvas.nodes ?? [];
    const edges = canvas.edges ?? [];
    const nodeIds = new Set(nodes.map((node) => node.id));
    const allIds = [...nodes, ...edges].map((item) => item.id);

    expect(new Set(allIds).size).toBe(allIds.length);
    expect(edges.every((edge) => nodeIds.has(edge.fromNode) && nodeIds.has(edge.toNode))).toBe(
      true,
    );
  });

  it.each(SCENARIOS)("remains readable after every AFX extension is ignored for %s", (scenario) => {
    const canvas = createCanvasScenarioFixture(scenario);
    const standardOnly = stripAfxMetadata(canvas);

    expect(parseJSONCanvas(serializeJSONCanvas(standardOnly))).toEqual(standardOnly);
    expect(standardOnly.nodes).toHaveLength(canvas.nodes?.length ?? 0);
    expect(standardOnly.edges).toHaveLength(canvas.edges?.length ?? 0);
  });

  it("keeps the beginner fixture small, explanatory, and metadata-free", () => {
    const canvas = createCanvasScenarioFixture("beginner");

    expect(canvas.nodes).toHaveLength(3);
    expect(canvas.edges).toHaveLength(2);
    expect(canvas.nodes?.every((node) => node.type === "text")).toBe(true);
    expect(JSON.stringify(canvas)).not.toContain('"afx');
  });

  it("covers rich standard content with explicit optional AFX enhancements", () => {
    const canvas = createCanvasScenarioFixture("rich-architecture");
    const nodeTypes = new Set(canvas.nodes?.map((node) => node.type));

    expect(nodeTypes).toEqual(new Set(["text", "file", "link", "group"]));
    expect(canvas.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "file", file: expect.stringMatching(/\.png$/) }),
        expect.objectContaining({ type: "file", afxNodeKind: "board" }),
        expect.objectContaining({ type: "text", afxNodeKind: "note" }),
      ]),
    );
    expect(canvas.edges).toEqual(
      expect.arrayContaining([expect.objectContaining({ afxStyle: expect.any(Object) })]),
    );
  });

  it("identifies same-path specs from multiple roots without weakening standard file paths", () => {
    const canvas = createCanvasScenarioFixture("multi-root-spec-map");
    const specNodes = (canvas.nodes ?? []).filter(
      (node): node is Extract<CanvasNode, { type: "file" }> => node.type === "file",
    );
    const roots = new Set(specNodes.map((node) => node.afxSource?.rootName));

    expect(roots).toEqual(new Set(["frontend", "platform", "services"]));
    expect(
      specNodes.every((node) => node.file.includes(node.afxSource?.rootName ?? "missing")),
    ).toBe(true);
    expect(canvas.edges?.every((edge) => edge.afxProvenance?.kind === "declared-dependency")).toBe(
      true,
    );
  });

  it("provides spatially nested presentation groups with stable frame order", () => {
    const canvas = createCanvasScenarioFixture("nested-frame-presentation");
    const groups = (canvas.nodes ?? []).filter(
      (node): node is Extract<CanvasNode, { type: "group" }> => node.type === "group",
    );
    const overview = groups.find((group) => group.id === "presentation-frame-overview");
    const detail = groups.find((group) => group.id === "presentation-frame-detail");

    expect(overview).toBeDefined();
    expect(detail).toBeDefined();
    expect(isSpatiallyContained(detail!, overview!)).toBe(true);
    expect(groups.map((group) => group.afxGroup)).toEqual([
      { version: 1, presentationOrder: 1 },
      { version: 1, presentationOrder: 2 },
      { version: 1, presentationOrder: 3 },
    ]);
  });

  it("defaults the stress fixture to the release scale and standard metadata", () => {
    const canvas = createCanvasScenarioFixture("stress");

    expect(canvas.nodes).toHaveLength(CANVAS_STRESS_FIXTURE_BOUNDS.defaultNodeCount);
    expect(canvas.edges).toHaveLength(CANVAS_STRESS_FIXTURE_BOUNDS.defaultEdgeCount);
    expect(new Set(canvas.nodes?.map((node) => node.type))).toEqual(
      new Set(["text", "file", "link", "group"]),
    );
    expect(JSON.stringify(canvas)).not.toContain('"afx');
  });

  it("supports a bounded smaller stress fixture", () => {
    const canvas = createCanvasScenarioFixture("stress", { nodeCount: 12, edgeCount: 24 });

    expect(canvas.nodes).toHaveLength(12);
    expect(canvas.edges).toHaveLength(24);
    expect(serializeCanvasScenarioFixture("stress", { nodeCount: 12, edgeCount: 24 })).toBe(
      serializeJSONCanvas(canvas),
    );
  });

  it.each([
    [{ nodeCount: 1 }, /nodeCount/i],
    [{ nodeCount: CANVAS_STRESS_FIXTURE_BOUNDS.maxNodeCount + 1 }, /nodeCount/i],
    [{ nodeCount: 2.5 }, /nodeCount/i],
    [{ edgeCount: -1 }, /edgeCount/i],
    [{ edgeCount: CANVAS_STRESS_FIXTURE_BOUNDS.maxEdgeCount + 1 }, /edgeCount/i],
    [{ edgeCount: 1.5 }, /edgeCount/i],
  ] as const)("rejects unsafe stress parameters %o", (options, expected) => {
    expect(() => createCanvasScenarioFixture("stress", options)).toThrow(expected);
  });

  it("rejects stress sizing for a small named scenario", () => {
    expect(() => createCanvasScenarioFixture("beginner", { nodeCount: 10 })).toThrow(/stress/i);
  });
});

function stripAfxMetadata(canvas: JSONCanvas): JSONCanvas {
  return JSON.parse(
    JSON.stringify(canvas, (key, value: unknown) => (key.startsWith("afx") ? undefined : value)),
  ) as JSONCanvas;
}

function isSpatiallyContained(inner: CanvasNode, outer: CanvasNode): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  );
}
