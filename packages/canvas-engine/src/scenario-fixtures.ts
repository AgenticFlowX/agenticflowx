import type { CanvasEdge, CanvasNode, JSONCanvas } from "@afx/shared";

import { serializeJSONCanvas } from "./parse";

/**
 * Stable QA and demonstration scenarios spanning the Canvas acceptance matrix.
 *
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-4] [FR-33] [NFR-3] [NFR-10]
 * @see docs/specs/229-app-workbench-canvas/design.md [DES-DATA] [DES-CANVAS-INTERACTIONS]
 */
export type CanvasScenarioFixtureId =
  "beginner" | "rich-architecture" | "multi-root-spec-map" | "nested-frame-presentation" | "stress";

/**
 * Optional sizing for the stress scenario. Small named scenarios reject it.
 *
 * @see docs/specs/229-app-workbench-canvas/spec.md [NFR-10]
 */
export interface CanvasScenarioFixtureOptions {
  nodeCount?: number;
  edgeCount?: number;
}

/**
 * Safe deterministic generation limits for stress fixtures.
 *
 * @see docs/specs/229-app-workbench-canvas/spec.md [NFR-10]
 */
export const CANVAS_STRESS_FIXTURE_BOUNDS = Object.freeze({
  minNodeCount: 2,
  maxNodeCount: 5_000,
  defaultNodeCount: 1_000,
  minEdgeCount: 0,
  maxEdgeCount: 10_000,
  defaultEdgeCount: 2_000,
});

/**
 * Creates a fresh, deterministic, standard JSON Canvas scenario document.
 * AFX fields are present only in scenarios explicitly exercising enhancements.
 *
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-4] [FR-33] [NFR-3] [NFR-10]
 * @see docs/specs/229-app-workbench-canvas/design.md [DES-DATA] [DES-CANVAS-INTERACTIONS]
 */
export function createCanvasScenarioFixture(
  scenario: CanvasScenarioFixtureId,
  options: CanvasScenarioFixtureOptions = {},
): JSONCanvas {
  if (scenario === "stress") return createStressFixture(options);
  assertNoStressSizing(scenario, options);

  switch (scenario) {
    case "beginner":
      return createBeginnerFixture();
    case "rich-architecture":
      return createRichArchitectureFixture();
    case "multi-root-spec-map":
      return createMultiRootSpecMapFixture();
    case "nested-frame-presentation":
      return createNestedFramePresentationFixture();
  }
}

/**
 * Serializes a generated scenario with stable indentation, ordering, and newline.
 *
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-4] [NFR-3]
 * @see docs/specs/229-app-workbench-canvas/design.md [DES-DATA]
 */
export function serializeCanvasScenarioFixture(
  scenario: CanvasScenarioFixtureId,
  options: CanvasScenarioFixtureOptions = {},
): string {
  return serializeJSONCanvas(createCanvasScenarioFixture(scenario, options));
}

function createBeginnerFixture(): JSONCanvas {
  const nodes: CanvasNode[] = [
    {
      id: "beginner-welcome",
      type: "text",
      text: "# Start here\n\nWrite down the outcome you want to create.",
      x: 0,
      y: 0,
      width: 280,
      height: 150,
      color: "4",
    },
    {
      id: "beginner-ideas",
      type: "text",
      text: "## Explore\n\nCapture ideas, evidence, and open questions.",
      x: 360,
      y: 0,
      width: 280,
      height: 150,
      color: "5",
    },
    {
      id: "beginner-next",
      type: "text",
      text: "## Choose a next step\n\nConnect the strongest idea to one concrete action.",
      x: 720,
      y: 0,
      width: 280,
      height: 150,
      color: "6",
    },
  ];
  const edges: CanvasEdge[] = [
    standardEdge("beginner-edge-explore", "beginner-welcome", "beginner-ideas", "explore"),
    standardEdge("beginner-edge-next", "beginner-ideas", "beginner-next", "decide"),
  ];
  return { nodes, edges };
}

function createRichArchitectureFixture(): JSONCanvas {
  const nodes: CanvasNode[] = [
    {
      id: "rich-system-frame",
      type: "group",
      label: "Release architecture",
      x: 0,
      y: 0,
      width: 1_080,
      height: 650,
      color: "6",
    },
    {
      id: "rich-system-context",
      type: "text",
      text: "# System context\n\nUsers plan, inspect, and deliver work from one architecture surface.",
      x: 40,
      y: 60,
      width: 280,
      height: 170,
      color: "4",
    },
    {
      id: "rich-canvas-spec",
      type: "file",
      file: "docs/specs/229-app-workbench-canvas/spec.md",
      subpath: "#requirements",
      x: 390,
      y: 60,
      width: 280,
      height: 170,
      color: "5",
      afxNodeKind: "spec",
    },
    {
      id: "rich-system-image",
      type: "file",
      file: "docs/architecture/system-context.png",
      x: 740,
      y: 60,
      width: 280,
      height: 170,
      color: "3",
    },
    {
      id: "rich-decision-note",
      type: "text",
      text: "## Architecture note\n\nKeep JSON Canvas authoritative and presentation metadata optional.",
      x: 40,
      y: 350,
      width: 280,
      height: 170,
      color: "2",
      afxNodeKind: "note",
    },
    {
      id: "rich-delivery-board",
      type: "file",
      file: ".afx/boards/canvas-delivery.board.json",
      x: 390,
      y: 350,
      width: 280,
      height: 170,
      color: "1",
      afxNodeKind: "board",
    },
    {
      id: "rich-json-canvas-reference",
      type: "link",
      url: "https://jsoncanvas.org/spec/1.0/",
      x: 740,
      y: 350,
      width: 280,
      height: 170,
      color: "4",
    },
  ];
  const edges: CanvasEdge[] = [
    enhancedEdge(
      "rich-edge-context-spec",
      "rich-system-context",
      "rich-canvas-spec",
      "defined by",
      "straight",
      "solid",
    ),
    enhancedEdge(
      "rich-edge-spec-image",
      "rich-canvas-spec",
      "rich-system-image",
      "illustrated by",
      "smoothstep",
      "dashed",
    ),
    enhancedEdge(
      "rich-edge-note-board",
      "rich-decision-note",
      "rich-delivery-board",
      "tracked on",
      "bezier",
      "dotted",
    ),
    enhancedEdge(
      "rich-edge-reference-spec",
      "rich-json-canvas-reference",
      "rich-canvas-spec",
      "format contract",
      "bezier",
      "solid",
    ),
  ];
  return { afxSchemaVersion: 1, afxCanvasKind: "freeform", nodes, edges };
}

function createMultiRootSpecMapFixture(): JSONCanvas {
  const nodes: CanvasNode[] = [
    workspaceGroup("spec-map-frontend-group", "Frontend workspace", 0, "4"),
    workspaceGroup("spec-map-services-group", "Services workspace", 560, "5"),
    workspaceGroup("spec-map-platform-group", "Platform workspace", 1_120, "6"),
    workspaceSpecNode(
      "spec-map-frontend-checkout",
      "frontend",
      "docs/specs/101-checkout/spec.md",
      40,
      100,
      "4",
    ),
    workspaceSpecNode(
      "spec-map-services-checkout",
      "services",
      "docs/specs/101-checkout/spec.md",
      600,
      100,
      "5",
    ),
    workspaceSpecNode(
      "spec-map-services-orders",
      "services",
      "docs/specs/202-orders/spec.md",
      600,
      360,
      "5",
    ),
    workspaceSpecNode(
      "spec-map-platform-runtime",
      "platform",
      "docs/specs/301-runtime/spec.md",
      1_160,
      100,
      "6",
    ),
  ];
  const edges: CanvasEdge[] = [
    dependencyEdge(
      "spec-map-edge-ui-api",
      "spec-map-frontend-checkout",
      "spec-map-services-checkout",
      "uses checkout API",
      "frontend:docs/specs/101-checkout/spec.md",
    ),
    dependencyEdge(
      "spec-map-edge-checkout-orders",
      "spec-map-services-checkout",
      "spec-map-services-orders",
      "creates orders",
      "services:docs/specs/101-checkout/spec.md",
    ),
    dependencyEdge(
      "spec-map-edge-orders-runtime",
      "spec-map-services-orders",
      "spec-map-platform-runtime",
      "runs on",
      "services:docs/specs/202-orders/spec.md",
    ),
  ];
  return { afxSchemaVersion: 1, afxCanvasKind: "spec-map", nodes, edges };
}

function createNestedFramePresentationFixture(): JSONCanvas {
  const nodes: CanvasNode[] = [
    presentationFrame("presentation-frame-overview", "1 · System overview", 0, 0, 900, 650, 1, "4"),
    presentationFrame("presentation-frame-detail", "2 · Request detail", 80, 190, 720, 380, 2, "5"),
    presentationFrame(
      "presentation-frame-roadmap",
      "3 · Delivery roadmap",
      1_020,
      0,
      760,
      650,
      3,
      "6",
    ),
    {
      id: "presentation-overview-title",
      type: "text",
      text: "# Architecture story\n\nStart with the outcome, then enter the request path.",
      x: 60,
      y: 50,
      width: 340,
      height: 110,
      color: "4",
    },
    {
      id: "presentation-client",
      type: "text",
      text: "## Client\n\nStarts a planning request.",
      x: 120,
      y: 270,
      width: 220,
      height: 130,
      color: "5",
    },
    {
      id: "presentation-service",
      type: "text",
      text: "## Planning service\n\nValidates and records the plan.",
      x: 500,
      y: 270,
      width: 240,
      height: 130,
      color: "5",
    },
    {
      id: "presentation-roadmap-now",
      type: "text",
      text: "## Now\n\nStabilize authoring and persistence.",
      x: 1_080,
      y: 100,
      width: 280,
      height: 150,
      color: "6",
    },
    {
      id: "presentation-roadmap-next",
      type: "text",
      text: "## Next\n\nGraduate architecture and presentation workflows.",
      x: 1_440,
      y: 360,
      width: 280,
      height: 150,
      color: "6",
    },
  ];
  const edges: CanvasEdge[] = [
    standardEdge(
      "presentation-edge-request",
      "presentation-client",
      "presentation-service",
      "request",
    ),
    standardEdge(
      "presentation-edge-roadmap",
      "presentation-roadmap-now",
      "presentation-roadmap-next",
      "then",
    ),
  ];
  return {
    afxSchemaVersion: 1,
    afxPresentation: {
      title: "Canvas architecture walkthrough",
      frameOrder: [
        "presentation-frame-overview",
        "presentation-frame-detail",
        "presentation-frame-roadmap",
      ],
    },
    nodes,
    edges,
  };
}

function createStressFixture(options: CanvasScenarioFixtureOptions): JSONCanvas {
  const nodeCount = boundedInteger(
    "nodeCount",
    options.nodeCount ?? CANVAS_STRESS_FIXTURE_BOUNDS.defaultNodeCount,
    CANVAS_STRESS_FIXTURE_BOUNDS.minNodeCount,
    CANVAS_STRESS_FIXTURE_BOUNDS.maxNodeCount,
  );
  const edgeCount = boundedInteger(
    "edgeCount",
    options.edgeCount ?? CANVAS_STRESS_FIXTURE_BOUNDS.defaultEdgeCount,
    CANVAS_STRESS_FIXTURE_BOUNDS.minEdgeCount,
    CANVAS_STRESS_FIXTURE_BOUNDS.maxEdgeCount,
  );
  const nodeIdWidth = String(nodeCount).length;
  const edgeIdWidth = Math.max(1, String(edgeCount).length);
  const columns = Math.ceil(Math.sqrt(nodeCount));
  const nodes = Array.from({ length: nodeCount }, (_, index) =>
    stressNode(index, nodeIdWidth, columns),
  );
  const edges = Array.from({ length: edgeCount }, (_, index) =>
    stressEdge(index, edgeIdWidth, nodes),
  );
  return { nodes, edges };
}

function stressNode(index: number, idWidth: number, columns: number): CanvasNode {
  const ordinal = index + 1;
  const id = `stress-node-${pad(ordinal, idWidth)}`;
  const x = (index % columns) * 270;
  const y = Math.floor(index / columns) * 190;
  const variant = index % 10;
  const geometry = { id, x, y, width: 230, height: 150 };

  if (variant === 0) {
    return { ...geometry, type: "group", label: `Domain ${ordinal}`, color: "6" };
  }
  if (variant === 1) {
    return {
      ...geometry,
      type: "file",
      file: `docs/specs/${pad(ordinal, idWidth)}-feature/spec.md`,
      color: "5",
    };
  }
  if (variant === 2) {
    return {
      ...geometry,
      type: "link",
      url: `https://example.test/architecture/${ordinal}`,
      color: "4",
    };
  }
  if (variant === 3) {
    return {
      ...geometry,
      type: "file",
      file: `docs/architecture/diagram-${pad(ordinal, idWidth)}.png`,
      color: "3",
    };
  }
  return {
    ...geometry,
    type: "text",
    text: `## Component ${ordinal}\n\nDeterministic stress scenario content.`,
    color: String((index % 6) + 1),
  };
}

function stressEdge(index: number, idWidth: number, nodes: readonly CanvasNode[]): CanvasEdge {
  const fromIndex = index % nodes.length;
  const layer = Math.floor(index / nodes.length);
  const offset = 1 + (layer % (nodes.length - 1));
  const toIndex = (fromIndex + offset) % nodes.length;
  const ordinal = index + 1;
  return {
    id: `stress-edge-${pad(ordinal, idWidth)}`,
    fromNode: nodes[fromIndex]!.id,
    fromSide: "right",
    toNode: nodes[toIndex]!.id,
    toSide: "left",
    toEnd: "arrow",
    color: String((index % 6) + 1),
    ...(index % 10 === 0 ? { label: `dependency ${ordinal}` } : {}),
  };
}

function workspaceGroup(id: string, label: string, x: number, color: string): CanvasNode {
  return { id, type: "group", label, x, y: 0, width: 480, height: 650, color };
}

function workspaceSpecNode(
  id: string,
  rootName: string,
  relativePath: string,
  x: number,
  y: number,
  color: string,
): CanvasNode {
  return {
    id,
    type: "file",
    file: `${rootName}/${relativePath}`,
    x,
    y,
    width: 400,
    height: 180,
    color,
    afxNodeKind: "spec",
    afxSource: {
      rootUri: `afx-workspace://${rootName}`,
      rootName,
      relativePath,
    },
  };
}

function presentationFrame(
  id: string,
  label: string,
  x: number,
  y: number,
  width: number,
  height: number,
  presentationOrder: number,
  color: string,
): CanvasNode {
  return {
    id,
    type: "group",
    label,
    x,
    y,
    width,
    height,
    color,
    afxNodeKind: "frame",
    afxGroup: { version: 1, presentationOrder },
  };
}

function standardEdge(id: string, fromNode: string, toNode: string, label: string): CanvasEdge {
  return {
    id,
    fromNode,
    fromSide: "right",
    toNode,
    toSide: "left",
    toEnd: "arrow",
    label,
  };
}

function enhancedEdge(
  id: string,
  fromNode: string,
  toNode: string,
  label: string,
  route: "bezier" | "straight" | "step" | "smoothstep",
  stroke: "solid" | "dashed" | "dotted",
): CanvasEdge {
  return {
    ...standardEdge(id, fromNode, toNode, label),
    afxStyle: { version: 1, route, stroke, relationship: label },
  };
}

function dependencyEdge(
  id: string,
  fromNode: string,
  toNode: string,
  label: string,
  owner: string,
): CanvasEdge {
  return {
    ...standardEdge(id, fromNode, toNode, label),
    afxProvenance: { version: 1, kind: "declared-dependency", owner },
  };
}

function assertNoStressSizing(
  scenario: Exclude<CanvasScenarioFixtureId, "stress">,
  options: CanvasScenarioFixtureOptions,
): void {
  if (options.nodeCount !== undefined || options.edgeCount !== undefined) {
    throw new RangeError(`Stress sizing is not supported for the ${scenario} scenario`);
  }
}

function boundedInteger(name: string, value: number, minimum: number, maximum: number): number {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new RangeError(`${name} must be an integer between ${minimum} and ${maximum}`);
  }
  return value;
}

function pad(value: number, width: number): string {
  return String(value).padStart(width, "0");
}
