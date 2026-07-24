/**
 * Lossless projection between authoritative JSON Canvas records and React Flow
 * view records. Only standard geometry/endpoints and sanctioned AFX style
 * metadata are mapped back; unknown fields stay on the source objects.
 *
 * @see docs/specs/229-app-workbench-canvas/tasks.md [8.1] [13.1]
 * @see docs/specs/229-app-workbench-canvas/design.md [DES-ARCH] [DES-DATA]
 */
import { MarkerType, Position } from "@xyflow/react";
import type { Edge, Node } from "@xyflow/react";

import { getCanvasGroupMembership } from "@afx/canvas-engine";
import type { CanvasEdge, CanvasNode, JSONCanvas } from "@afx/shared";

export interface CanvasFlowNodeData extends Record<string, unknown> {
  canvasNode: CanvasNode;
  fileContent?: string;
  /** 1-based badge number for annotation-styled text nodes (FR-46). */
  annotationIndex?: number;
}

export type CanvasFlowNode = Node<CanvasFlowNodeData, "canvas">;

/**
 * Build the controlled React Flow view without changing JSON Canvas order or
 * metadata. Flat canvases take the allocation-light source-order path used by
 * the 1,000-node/2,000-edge stress fixture.
 *
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-4] [NFR-6] [NFR-10]
 */
export function projectJSONCanvas(
  canvas: JSONCanvas,
  fileContents: Readonly<Record<string, string>> = {},
): { nodes: CanvasFlowNode[]; edges: Edge[] } {
  const nodes = canvas.nodes ?? [];
  // Stable 1-based numbering for annotation callouts, in document order (FR-46).
  const annotationIndexById = new Map<string, number>();
  for (const node of nodes) {
    if (node.type === "text" && node.afxNodeKind === "annotation") {
      annotationIndexById.set(node.id, annotationIndexById.size + 1);
    }
  }
  const parentByNodeId = new Map<string, string>();
  for (const membership of getCanvasGroupMembership(canvas)) {
    for (const nodeId of membership.directNodeIds) parentByNodeId.set(nodeId, membership.groupId);
  }
  const hasGroups = parentByNodeId.size > 0;
  const byId = hasGroups ? new Map(nodes.map((node) => [node.id, node])) : undefined;
  const collapsedGroupIds = new Set(
    nodes
      .filter((node) => node.type === "group" && isCollapsedGroup(node["afxGroup"]))
      .map((node) => node.id),
  );
  const orderedNodes = !hasGroups
    ? nodes
    : (() => {
        const indexById = new Map(nodes.map((node, index) => [node.id, index]));
        const depths = nodeDepths(parentByNodeId);
        return [...nodes].sort(
          (left, right) =>
            (depths.get(left.id) ?? 0) - (depths.get(right.id) ?? 0) ||
            (indexById.get(left.id) ?? 0) - (indexById.get(right.id) ?? 0),
        );
      })();
  return {
    nodes: orderedNodes.map((node) => {
      const parentId = parentByNodeId.get(node.id);
      const parent = parentId ? byId?.get(parentId) : undefined;
      return {
        id: node.id,
        type: "canvas",
        position: {
          x: node.x - (parent?.x ?? 0),
          y: node.y - (parent?.y ?? 0),
        },
        width: node.width,
        height: node.height,
        style: { width: node.width, height: node.height },
        data: {
          canvasNode: node,
          ...(node.type === "file" && fileContents[node.id] !== undefined
            ? { fileContent: fileContents[node.id] }
            : {}),
          ...(annotationIndexById.has(node.id)
            ? { annotationIndex: annotationIndexById.get(node.id) }
            : {}),
        },
        ...(parentId ? { parentId } : {}),
        ...(hasCollapsedAncestor(node.id, parentByNodeId, collapsedGroupIds)
          ? { hidden: true }
          : {}),
        sourcePosition: sideToPosition("right"),
        targetPosition: sideToPosition("left"),
        zIndex: node.type === "group" ? -1 : 1,
      } satisfies CanvasFlowNode;
    }),
    edges: (canvas.edges ?? []).map((edge) => projectEdge(edge, annotationIndexById)),
  };
}

function isCollapsedGroup(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    (value as Record<string, unknown>)["version"] === 1 &&
    (value as Record<string, unknown>)["collapsed"] === true
  );
}

function hasCollapsedAncestor(
  nodeId: string,
  parentByNodeId: ReadonlyMap<string, string>,
  collapsedGroupIds: ReadonlySet<string>,
): boolean {
  const seen = new Set<string>();
  let parentId = parentByNodeId.get(nodeId);
  while (parentId && !seen.has(parentId)) {
    if (collapsedGroupIds.has(parentId)) return true;
    seen.add(parentId);
    parentId = parentByNodeId.get(parentId);
  }
  return false;
}

export function mergeFlowGeometry(
  canvas: JSONCanvas,
  nodes: readonly CanvasFlowNode[],
): JSONCanvas {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const absolutePositions = new Map<string, { x: number; y: number }>();
  const visiting = new Set<string>();
  const absolutePosition = (node: CanvasFlowNode): { x: number; y: number } => {
    const cached = absolutePositions.get(node.id);
    if (cached) return cached;
    if (visiting.has(node.id)) return node.position;
    visiting.add(node.id);
    const parent = node.parentId ? byId.get(node.parentId) : undefined;
    const parentPosition = parent ? absolutePosition(parent) : { x: 0, y: 0 };
    const position = {
      x: node.position.x + parentPosition.x,
      y: node.position.y + parentPosition.y,
    };
    visiting.delete(node.id);
    absolutePositions.set(node.id, position);
    return position;
  };
  return {
    ...canvas,
    nodes: (canvas.nodes ?? []).map((node) => {
      const projected = byId.get(node.id);
      if (!projected) return node;
      const position = absolutePosition(projected);
      return {
        ...node,
        x: Math.round(position.x),
        y: Math.round(position.y),
        width: Math.round(projected.measured?.width ?? projected.width ?? node.width),
        height: Math.round(projected.measured?.height ?? projected.height ?? node.height),
      };
    }),
  };
}

function nodeDepths(parentByNodeId: ReadonlyMap<string, string>): ReadonlyMap<string, number> {
  const depths = new Map<string, number>();
  for (const nodeId of parentByNodeId.keys()) {
    let depth = 0;
    let current: string | undefined = nodeId;
    const seen = new Set<string>();
    while (current && !seen.has(current)) {
      seen.add(current);
      current = parentByNodeId.get(current);
      if (current) depth += 1;
    }
    depths.set(nodeId, depth);
  }
  return depths;
}

export function edgePatchFromFlow(edge: Edge): Partial<CanvasEdge> {
  return {
    fromNode: edge.source,
    toNode: edge.target,
    ...(edge.sourceHandle ? { fromSide: handleToSide(edge.sourceHandle) } : {}),
    ...(edge.targetHandle ? { toSide: handleToSide(edge.targetHandle) } : {}),
  };
}

function projectEdge(edge: CanvasEdge, annotationIndexById?: ReadonlyMap<string, number>): Edge {
  const stroke = edge.afxStyle?.stroke;
  // An edge leaving an annotation callout is its leader arrow (FR-46).
  const leader = annotationIndexById?.has(edge.fromNode) ?? false;
  return {
    id: edge.id,
    source: edge.fromNode,
    target: edge.toNode,
    sourceHandle: edge.fromSide,
    targetHandle: edge.toSide,
    type: "canvas-edge",
    label: edge.label,
    markerStart: edge.fromEnd === "arrow" ? { type: MarkerType.ArrowClosed } : undefined,
    // JSON Canvas defaults toEnd to "arrow" — files that omit it (Obsidian
    // does) must still render a directional arrowhead.
    markerEnd: (edge.toEnd ?? "arrow") === "arrow" ? { type: MarkerType.ArrowClosed } : undefined,
    style: {
      stroke: canvasColor(edge.color),
      strokeDasharray:
        stroke === "dashed" || (leader && !stroke)
          ? "8 5"
          : stroke === "dotted"
            ? "2 5"
            : undefined,
      opacity: edge.afxStyle?.opacity,
    },
    data: { canvasEdge: edge, ...(leader ? { leader: true } : {}) },
    reconnectable: edge.afxProvenance?.detached !== false,
  };
}

function sideToPosition(side: NonNullable<CanvasEdge["fromSide"]>): Position {
  return {
    top: Position.Top,
    right: Position.Right,
    bottom: Position.Bottom,
    left: Position.Left,
  }[side];
}

function handleToSide(handle: string): NonNullable<CanvasEdge["fromSide"]> {
  const parts = handle.split(":");
  const side = parts[parts.length - 1];
  return side === "top" || side === "right" || side === "bottom" || side === "left"
    ? side
    : "right";
}

function canvasColor(color: string | undefined): string {
  const palette: Record<string, string> = {
    "1": "#ef4444",
    "2": "#f97316",
    "3": "#eab308",
    "4": "#22c55e",
    "5": "#06b6d4",
    "6": "#8b5cf6",
  };
  return color ? (palette[color] ?? color) : "var(--border)";
}
