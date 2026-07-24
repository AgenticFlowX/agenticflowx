import type { CanvasMutation, CanvasNode, JSONCanvas } from "@afx/shared";

export class CanvasMutationError extends Error {}

/**
 * Applies an ID-addressed mutation to the authoritative JSON Canvas model.
 * React Flow change objects never cross this boundary.
 *
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-4] [FR-13]
 * @see docs/specs/229-app-workbench-canvas/design.md [DES-DATA]
 * @see docs/specs/229-app-workbench-canvas/tasks.md [7.1] [13.1]
 */
export function applyCanvasMutation(canvas: JSONCanvas, mutation: CanvasMutation): JSONCanvas {
  const nodes = canvas.nodes ?? [];
  const edges = canvas.edges ?? [];
  switch (mutation.kind) {
    case "addNode":
      assertAvailable(canvas, mutation.node.id);
      return { ...canvas, nodes: [...nodes, mutation.node], edges };
    case "updateNode":
      return {
        ...canvas,
        nodes: replaceById(
          nodes,
          mutation.nodeId,
          (node) => ({ ...node, ...mutation.patch }) as CanvasNode,
        ),
        edges,
      };
    case "removeNodes": {
      const removed = new Set(mutation.nodeIds);
      return {
        ...canvas,
        nodes: nodes.filter((node) => !removed.has(node.id)),
        edges: edges.filter((edge) => !removed.has(edge.fromNode) && !removed.has(edge.toNode)),
      };
    }
    case "addEdge":
      assertAvailable(canvas, mutation.edge.id);
      assertNode(canvas, mutation.edge.fromNode);
      assertNode(canvas, mutation.edge.toNode);
      return { ...canvas, nodes, edges: [...edges, mutation.edge] };
    case "updateEdge":
      return {
        ...canvas,
        nodes,
        edges: replaceById(edges, mutation.edgeId, (edge) => ({ ...edge, ...mutation.patch })),
      };
    case "removeEdges": {
      const removed = new Set(mutation.edgeIds);
      return { ...canvas, nodes, edges: edges.filter((edge) => !removed.has(edge.id)) };
    }
    case "replaceDocument":
      return {
        ...mutation.document,
        nodes: mutation.document.nodes ?? [],
        edges: mutation.document.edges ?? [],
      };
  }
}

function replaceById<T extends { id: string }>(
  items: readonly T[],
  id: string,
  update: (item: T) => T,
): T[] {
  let found = false;
  const next = items.map((item) => {
    if (item.id !== id) return item;
    found = true;
    return update(item);
  });
  if (!found) throw new CanvasMutationError(`Canvas item no longer exists: ${id}`);
  return next;
}

function assertAvailable(canvas: JSONCanvas, id: string): void {
  if ([...(canvas.nodes ?? []), ...(canvas.edges ?? [])].some((item) => item.id === id)) {
    throw new CanvasMutationError(`Canvas id already exists: ${id}`);
  }
}

function assertNode(canvas: JSONCanvas, id: string): void {
  if (!(canvas.nodes ?? []).some((node) => node.id === id)) {
    throw new CanvasMutationError(`Canvas node no longer exists: ${id}`);
  }
}
