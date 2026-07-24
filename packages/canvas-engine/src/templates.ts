/**
 * Portable canvas starter templates built from standard JSON Canvas nodes and edges.
 *
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-38]
 * @see docs/specs/229-app-workbench-canvas/design.md [DES-DATA]
 */
import type { CanvasEdge, CanvasNode, JSONCanvas } from "@afx/shared";

export type CanvasTemplateId =
  | "blank"
  | "ideas"
  | "feature"
  | "roadmap"
  | "next-spec"
  | "architecture"
  | "low-fidelity"
  | "high-fidelity";

/** Portable planning starters made entirely from standard text nodes/edges. */
export function createCanvasTemplate(template: CanvasTemplateId): JSONCanvas {
  if (template === "blank") return { nodes: [], edges: [] };
  if (template === "architecture") return architectureTemplate();
  if (template === "low-fidelity") return lowFidelityTemplate();
  if (template === "high-fidelity") return highFidelityTemplate();
  const titles: Record<Exclude<CanvasTemplateId, "blank">, string[]> = {
    ideas: ["Question", "Ideas", "Evidence", "Next experiment"],
    feature: ["Outcome", "User problem", "Constraints", "Acceptance", "Next spec"],
    roadmap: ["Now", "Next", "Later", "Risks"],
    "next-spec": ["Intent", "Scope", "Dependencies", "Open questions", "Handoff"],
    architecture: [],
    "low-fidelity": [],
    "high-fidelity": [],
  };
  const labels = titles[template];
  const nodes = labels.map((label, index) => ({
    id: `starter-${index + 1}`,
    type: "text" as const,
    text: `## ${label}\n\n${starterPrompt(template, label)}`,
    x: (index % 3) * 360,
    y: Math.floor(index / 3) * 240,
    width: 300,
    height: 170,
  }));
  const edges = nodes.slice(1).map((node, index) => ({
    id: `starter-edge-${index + 1}`,
    fromNode: nodes[index]!.id,
    toNode: node.id,
    toEnd: "arrow" as const,
    label: "guides",
  }));
  return { nodes, edges };
}

/**
 * A useful architecture map before any AFX enhancement is available. Group
 * frames double as presentation steps and all meaning remains in standard
 * labels, text, colors, geometry, and edges.
 */
function architectureTemplate(): JSONCanvas {
  const nodes: CanvasNode[] = [
    frame("architecture-context", "1 · Context", 0, 0, 760, 420, "4"),
    frame("architecture-system", "2 · System", 820, 0, 1_080, 720, "5"),
    frame("architecture-operations", "3 · Quality & operations", 1_960, 0, 760, 720, "6"),
    card(
      "architecture-outcome",
      "# Outcome\n\nWhat measurable change must this system create?",
      40,
      70,
      "4",
    ),
    card(
      "architecture-actors",
      "## Actors & entry points\n\nPeople, systems, channels, and trust boundaries.",
      400,
      70,
    ),
    card(
      "architecture-interface",
      "## Experience / API\n\nPrimary commands, queries, events, and failure states.",
      860,
      70,
      "5",
    ),
    card(
      "architecture-domain",
      "## Domain & services\n\nResponsibilities, ownership, invariants, and boundaries.",
      1_220,
      70,
    ),
    card(
      "architecture-data",
      "## Data & integrations\n\nStores, contracts, lineage, retention, and external systems.",
      1_580,
      70,
      "3",
    ),
    card(
      "architecture-runtime",
      "## Runtime & deployment\n\nProcesses, environments, scaling, and recovery.",
      1_040,
      360,
    ),
    card(
      "architecture-quality",
      "## Quality, security & risk\n\nSLOs, threats, observability, cost, and open decisions.",
      2_000,
      70,
      "6",
      660,
      220,
    ),
    card(
      "architecture-legend",
      "## Review legend\n\nLabel relationships with their meaning: calls, publishes, reads, owns, blocks, or depends on.",
      2_000,
      360,
      "2",
      660,
      220,
    ),
  ];
  const edges: CanvasEdge[] = [
    edge("architecture-edge-intent", "architecture-outcome", "architecture-interface", "drives"),
    edge("architecture-edge-entry", "architecture-actors", "architecture-interface", "uses"),
    edge("architecture-edge-domain", "architecture-interface", "architecture-domain", "calls"),
    edge("architecture-edge-data", "architecture-domain", "architecture-data", "reads / writes"),
    edge("architecture-edge-runtime", "architecture-domain", "architecture-runtime", "runs on"),
    edge(
      "architecture-edge-quality",
      "architecture-runtime",
      "architecture-quality",
      "must satisfy",
    ),
  ];
  return { nodes, edges };
}

function lowFidelityTemplate(): JSONCanvas {
  const nodes: CanvasNode[] = [
    frame("low-frame-understand", "Understand", 0, 0, 720, 560, "4"),
    frame("low-frame-explore", "Explore", 780, 0, 1_080, 560, "3"),
    frame("low-frame-test", "Test next", 1_920, 0, 720, 560, "5"),
    card("low-audience", "## Audience\n\nWho are we designing with and for?", 40, 70, "4"),
    card("low-problem", "## Problem moment\n\nWhat happens today? Where is the friction?", 380, 70),
    card("low-flow", "## Rough flow\n\n1. Start\n2. Decide\n3. Act\n4. Recover", 820, 70, "3"),
    card("low-option-a", "## Option A\n\nSketch the smallest useful path.", 1_160, 70),
    card("low-option-b", "## Option B\n\nSketch a meaningfully different path.", 1_500, 70),
    card(
      "low-questions",
      "## Questions & experiment\n\nWhat must be true? What can we test next?",
      1_960,
      70,
      "5",
      640,
      220,
    ),
  ];
  return {
    nodes,
    edges: [
      edge("low-edge-problem", "low-audience", "low-problem", "experiences"),
      edge("low-edge-flow", "low-problem", "low-flow", "shapes"),
      edge("low-edge-a", "low-flow", "low-option-a", "explore"),
      edge("low-edge-b", "low-flow", "low-option-b", "compare"),
      edge("low-edge-test-a", "low-option-a", "low-questions", "test"),
      edge("low-edge-test-b", "low-option-b", "low-questions", "test"),
    ],
  };
}

function highFidelityTemplate(): JSONCanvas {
  const nodes: CanvasNode[] = [
    frame("high-frame-narrative", "1 · Narrative", 0, 0, 760, 640, "4"),
    frame("high-frame-experience", "2 · Experience", 820, 0, 760, 640, "5"),
    frame("high-frame-architecture", "3 · Architecture", 1_640, 0, 1_080, 640, "3"),
    frame("high-frame-assurance", "4 · Assurance", 2_780, 0, 760, 640, "6"),
    card(
      "high-outcome",
      "# Architecture narrative\n\nState the outcome, audience, and one-sentence system story.",
      40,
      70,
      "4",
      680,
      220,
    ),
    card(
      "high-decisions",
      "## Key decisions\n\nList the decisions reviewers need to understand or approve.",
      40,
      340,
      "2",
      680,
      220,
    ),
    card(
      "high-experience",
      "## Experience surface\n\nShow entry points, core path, exceptions, and recovery.",
      860,
      70,
      "5",
      680,
      220,
    ),
    card(
      "high-contracts",
      "## Contracts\n\nName the commands, queries, events, and compatibility promises.",
      860,
      340,
      undefined,
      680,
      220,
    ),
    card(
      "high-services",
      "## Services & ownership\n\nMap boundaries and responsibilities.",
      1_680,
      70,
      "3",
    ),
    card(
      "high-data",
      "## Data flow\n\nMap sources, transformations, stores, and sinks.",
      2_020,
      70,
    ),
    card("high-runtime", "## Runtime\n\nMap deployment, scale, and failure boundaries.", 2_360, 70),
    card(
      "high-assurance",
      "## Security & operations\n\nThreats, controls, SLOs, observability, cost, ownership, and next decisions.",
      2_820,
      70,
      "6",
      680,
      490,
    ),
  ];
  return {
    nodes,
    edges: [
      edge("high-edge-story", "high-outcome", "high-experience", "frames"),
      edge("high-edge-decisions", "high-decisions", "high-services", "constrains"),
      edge("high-edge-contracts", "high-experience", "high-contracts", "defines"),
      edge("high-edge-services", "high-contracts", "high-services", "implemented by"),
      edge("high-edge-data", "high-services", "high-data", "reads / writes"),
      edge("high-edge-runtime", "high-data", "high-runtime", "runs through"),
      edge("high-edge-assurance", "high-runtime", "high-assurance", "assured by"),
    ],
  };
}

function frame(
  id: string,
  label: string,
  x: number,
  y: number,
  width: number,
  height: number,
  color?: string,
): CanvasNode {
  return { id, type: "group", label, x, y, width, height, ...(color ? { color } : {}) };
}

function card(
  id: string,
  text: string,
  x: number,
  y: number,
  color?: string,
  width = 300,
  height = 190,
): CanvasNode {
  return { id, type: "text", text, x, y, width, height, ...(color ? { color } : {}) };
}

function edge(id: string, fromNode: string, toNode: string, label: string): CanvasEdge {
  return { id, fromNode, toNode, toEnd: "arrow", label };
}

function starterPrompt(template: Exclude<CanvasTemplateId, "blank">, label: string): string {
  if (template === "architecture") {
    return `Map ${label.toLocaleLowerCase()} and connect it to the systems it influences.`;
  }
  if (template === "low-fidelity") {
    return `Capture rough ${label.toLocaleLowerCase()} without polishing too early.`;
  }
  if (template === "high-fidelity") {
    return `Document presentation-ready ${label.toLocaleLowerCase()}, evidence, and ownership.`;
  }
  return "Add notes here.";
}
