/**
 * JSON Canvas model mutations for the experimental Workbench canvas.
 *
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-4] [FR-5] [FR-8] [FR-9]
 * @see docs/specs/229-app-workbench-canvas/design.md [DES-DATA]
 */
import { useCallback, useMemo, useState } from "react";

import type {
  CanvasColor,
  CanvasEdge,
  CanvasFileNode,
  CanvasGroupNode,
  CanvasNode,
  CanvasTextNode,
  JSONCanvas,
} from "@afx/shared";

import { emptyCanvas } from "../../lib/json-canvas";

export interface CanvasPoint {
  x: number;
  y: number;
}

export interface CanvasRect extends CanvasPoint {
  width: number;
  height: number;
}

interface CanvasModelState {
  resetKey: string;
  canvas: JSONCanvas;
  dirty: boolean;
  selectedIds: string[];
}

const DEFAULT_NODE_SIZE = { width: 320, height: 170 };
const LABEL_NODE_SIZE = { width: 180, height: 36 };
const DEFAULT_MIN_NODE_SIZE = { width: 180, height: 110 };
const LABEL_MIN_NODE_SIZE = { width: 80, height: 28 };

export function normalizeCanvas(canvas: JSONCanvas | undefined): JSONCanvas {
  return { ...(canvas ?? emptyCanvas()), nodes: canvas?.nodes ?? [], edges: canvas?.edges ?? [] };
}

export function makeCanvasId(prefix: "n" | "e"): string {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${random}`;
}

export function addTextNode(
  canvas: JSONCanvas,
  at: CanvasPoint,
  text = "New thought",
  id = makeCanvasId("n"),
  color?: CanvasColor,
  afxNodeKind?: CanvasTextNode["afxNodeKind"],
): JSONCanvas {
  const node: CanvasTextNode = {
    id,
    type: "text",
    text,
    x: Math.round(at.x),
    y: Math.round(at.y),
    ...(color ? { color } : {}),
    ...(afxNodeKind ? { afxNodeKind } : {}),
    ...DEFAULT_NODE_SIZE,
  };
  return { ...canvas, nodes: [...(canvas.nodes ?? []), node], edges: canvas.edges ?? [] };
}

/**
 * Add a lightweight label annotation while preserving JSON Canvas text-node compatibility.
 *
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-5] [FR-8]
 * @see docs/specs/229-app-workbench-canvas/design.md [DES-DATA]
 */
export function addLabelNode(
  canvas: JSONCanvas,
  at: CanvasPoint,
  text = "Label",
  id = makeCanvasId("n"),
  color?: CanvasColor,
): JSONCanvas {
  const node: CanvasTextNode = {
    id,
    type: "text",
    text,
    x: Math.round(at.x),
    y: Math.round(at.y),
    ...(color ? { color } : {}),
    afxNodeKind: "label",
    ...LABEL_NODE_SIZE,
  };
  return { ...canvas, nodes: [...(canvas.nodes ?? []), node], edges: canvas.edges ?? [] };
}

export function addFileNode(
  canvas: JSONCanvas,
  file: string,
  at: CanvasPoint,
  id = makeCanvasId("n"),
): JSONCanvas {
  const node: CanvasFileNode = {
    id,
    type: "file",
    file,
    x: Math.round(at.x),
    y: Math.round(at.y),
    width: 380,
    height: 230,
  };
  return { ...canvas, nodes: [...(canvas.nodes ?? []), node], edges: canvas.edges ?? [] };
}

export function addGroupNode(
  canvas: JSONCanvas,
  at: CanvasPoint,
  label = "Group",
  id = makeCanvasId("n"),
  color: CanvasColor = "5",
): JSONCanvas {
  const node: CanvasGroupNode = {
    id,
    type: "group",
    label,
    x: Math.round(at.x),
    y: Math.round(at.y),
    width: 360,
    height: 220,
    color,
  };
  return { ...canvas, nodes: [...(canvas.nodes ?? []), node], edges: canvas.edges ?? [] };
}

export function updateTextNode(canvas: JSONCanvas, id: string, text: string): JSONCanvas {
  return updateNode(canvas, id, (node) => (node.type === "text" ? { ...node, text } : node));
}

/**
 * Rename editable canvas labels while preserving JSON Canvas-compatible node payloads.
 *
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-5] [FR-8]
 * @see docs/specs/229-app-workbench-canvas/design.md [DES-DATA]
 */
export function renameNode(canvas: JSONCanvas, id: string, title: string): JSONCanvas {
  const cleanTitle = title.trim();
  if (!cleanTitle) return canvas;
  return updateNode(canvas, id, (node) => {
    if (node.type === "group") return { ...node, label: cleanTitle };
    if (node.type !== "text") return node;
    return { ...node, text: renameMarkdownTitle(node.text, cleanTitle) };
  });
}

export function moveNode(canvas: JSONCanvas, id: string, point: CanvasPoint): JSONCanvas {
  return updateNode(canvas, id, (node) => ({
    ...node,
    x: Math.round(point.x),
    y: Math.round(point.y),
  }));
}

export function resizeNode(
  canvas: JSONCanvas,
  id: string,
  size: Pick<CanvasRect, "width" | "height">,
): JSONCanvas {
  return updateNode(canvas, id, (node) => {
    const minSize =
      node.type === "text" && node.afxNodeKind === "label"
        ? LABEL_MIN_NODE_SIZE
        : DEFAULT_MIN_NODE_SIZE;
    return {
      ...node,
      width: Math.max(minSize.width, Math.round(size.width)),
      height: Math.max(minSize.height, Math.round(size.height)),
    };
  });
}

export function connectNodes(
  canvas: JSONCanvas,
  fromNode: string,
  toNode: string,
  label = "",
  id = makeCanvasId("e"),
): JSONCanvas {
  if (fromNode === toNode) return canvas;
  const sides = connectionSides(canvas.nodes ?? [], fromNode, toNode);
  const edge: CanvasEdge = {
    id,
    fromNode,
    toNode,
    ...sides,
    toEnd: "arrow",
    ...(label ? { label } : {}),
  };
  return { ...canvas, nodes: canvas.nodes ?? [], edges: [...(canvas.edges ?? []), edge] };
}

export function updateEdgeLabel(canvas: JSONCanvas, id: string, label: string): JSONCanvas {
  return {
    ...canvas,
    nodes: canvas.nodes ?? [],
    edges: (canvas.edges ?? []).map((edge) => (edge.id === id ? { ...edge, label } : edge)),
  };
}

export function retargetEdge(
  canvas: JSONCanvas,
  id: string,
  end: "from" | "to",
  nodeId: string,
): JSONCanvas {
  const nodes = canvas.nodes ?? [];
  if (!nodes.some((node) => node.id === nodeId)) return canvas;
  return {
    ...canvas,
    nodes,
    edges: (canvas.edges ?? []).map((edge) => {
      if (edge.id !== id) return edge;
      const fromNode = end === "from" ? nodeId : edge.fromNode;
      const toNode = end === "to" ? nodeId : edge.toNode;
      if (fromNode === toNode) return edge;
      return {
        ...edge,
        fromNode,
        toNode,
        ...connectionSides(nodes, fromNode, toNode),
      };
    }),
  };
}

export function deleteEdge(canvas: JSONCanvas, id: string): JSONCanvas {
  return {
    ...canvas,
    nodes: canvas.nodes ?? [],
    edges: (canvas.edges ?? []).filter((edge) => edge.id !== id),
  };
}

export function updateNodeColor(
  canvas: JSONCanvas,
  ids: string[],
  color: CanvasColor | undefined,
): JSONCanvas {
  const selected = new Set(ids);
  return {
    ...canvas,
    nodes: (canvas.nodes ?? []).map((node) =>
      selected.has(node.id) ? { ...node, color: color || undefined } : node,
    ),
    edges: canvas.edges ?? [],
  };
}

export function deleteNode(canvas: JSONCanvas, id: string): JSONCanvas {
  return {
    ...canvas,
    nodes: (canvas.nodes ?? []).filter((node) => node.id !== id),
    edges: (canvas.edges ?? []).filter((edge) => edge.fromNode !== id && edge.toNode !== id),
  };
}

export function nodeCenter(node: CanvasNode): CanvasPoint {
  return { x: node.x + node.width / 2, y: node.y + node.height / 2 };
}

export function canvasBounds(nodes: CanvasNode[]): CanvasRect | null {
  if (nodes.length === 0) return null;
  const minX = Math.min(...nodes.map((node) => node.x));
  const minY = Math.min(...nodes.map((node) => node.y));
  const maxX = Math.max(...nodes.map((node) => node.x + node.width));
  const maxY = Math.max(...nodes.map((node) => node.y + node.height));
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function parsePointFromViewport(
  point: CanvasPoint,
  pan: CanvasPoint,
  zoom: number,
): CanvasPoint {
  return { x: (point.x - pan.x) / zoom, y: (point.y - pan.y) / zoom };
}

function updateNode(
  canvas: JSONCanvas,
  id: string,
  updater: (node: CanvasNode) => CanvasNode,
): JSONCanvas {
  return {
    ...canvas,
    nodes: (canvas.nodes ?? []).map((node) => (node.id === id ? updater(node) : node)),
    edges: canvas.edges ?? [],
  };
}

export function useCanvasModel(initialCanvas: JSONCanvas, resetKey: string) {
  const [state, setState] = useState<CanvasModelState>(() => ({
    resetKey,
    canvas: normalizeCanvas(initialCanvas),
    dirty: false,
    selectedIds: [],
  }));

  if (state.resetKey !== resetKey) {
    setState({
      resetKey,
      canvas: normalizeCanvas(initialCanvas),
      dirty: false,
      selectedIds: [],
    });
  }

  const mutate = useCallback((updater: (current: JSONCanvas) => JSONCanvas) => {
    setState((current) => ({
      ...current,
      canvas: updater(current.canvas),
      dirty: true,
    }));
  }, []);

  const setClean = useCallback(() => {
    setState((current) => ({ ...current, dirty: false }));
  }, []);

  const selectOnly = useCallback((id: string) => {
    setState((current) => ({ ...current, selectedIds: [id] }));
  }, []);

  const toggleSelected = useCallback((id: string) => {
    setState((current) => ({
      ...current,
      selectedIds: current.selectedIds.includes(id)
        ? current.selectedIds.filter((item) => item !== id)
        : [...current.selectedIds, id],
    }));
  }, []);

  const clearSelection = useCallback(() => {
    setState((current) => ({ ...current, selectedIds: [] }));
  }, []);

  return useMemo(
    () => ({
      canvas: state.canvas,
      dirty: state.dirty,
      selectedIds: state.selectedIds,
      setClean,
      selectOnly,
      toggleSelected,
      clearSelection,
      addText: (at: CanvasPoint, text?: string) =>
        mutate((current) => addTextNode(current, at, text)),
      addNote: (at: CanvasPoint) =>
        mutate((current) => addTextNode(current, at, "# Note\n\n", makeCanvasId("n"), "3", "note")),
      addLabel: (at: CanvasPoint) => mutate((current) => addLabelNode(current, at)),
      addGroup: (at: CanvasPoint) => mutate((current) => addGroupNode(current, at)),
      addFile: (file: string, at: CanvasPoint) =>
        mutate((current) => addFileNode(current, file, at)),
      updateText: (id: string, text: string) =>
        mutate((current) => updateTextNode(current, id, text)),
      renameNode: (id: string, title: string) =>
        mutate((current) => renameNode(current, id, title)),
      move: (id: string, point: CanvasPoint) => mutate((current) => moveNode(current, id, point)),
      resize: (id: string, size: Pick<CanvasRect, "width" | "height">) =>
        mutate((current) => resizeNode(current, id, size)),
      connect: (fromNode: string, toNode: string, label?: string) =>
        mutate((current) => connectNodes(current, fromNode, toNode, label)),
      labelEdge: (id: string, label: string) =>
        mutate((current) => updateEdgeLabel(current, id, label)),
      retargetEdge: (id: string, end: "from" | "to", nodeId: string) =>
        mutate((current) => retargetEdge(current, id, end, nodeId)),
      removeEdge: (id: string) => mutate((current) => deleteEdge(current, id)),
      colorSelected: (color: CanvasColor | undefined) =>
        mutate((current) => updateNodeColor(current, state.selectedIds, color)),
      removeNode: (id: string) => mutate((current) => deleteNode(current, id)),
    }),
    [
      clearSelection,
      mutate,
      selectOnly,
      setClean,
      state.canvas,
      state.dirty,
      state.selectedIds,
      toggleSelected,
    ],
  );
}

function renameMarkdownTitle(text: string, title: string): string {
  const lines = text.split(/\n/);
  const first = lines[0] ?? "";
  const prefix = first.match(/^(#{1,6}\s+)/)?.[1] ?? "";
  if (lines.length === 0) return title;
  lines[0] = `${prefix}${title}`;
  return lines.join("\n");
}

function connectionSides(
  nodes: CanvasNode[],
  fromNodeId: string,
  toNodeId: string,
): Pick<CanvasEdge, "fromSide" | "toSide"> {
  const fromNode = nodes.find((node) => node.id === fromNodeId);
  const toNode = nodes.find((node) => node.id === toNodeId);
  if (!fromNode || !toNode) return {};
  const from = nodeCenter(fromNode);
  const to = nodeCenter(toNode);
  const dx = to.x - from.x;
  const dy = to.y - from.y;

  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? { fromSide: "right", toSide: "left" } : { fromSide: "left", toSide: "right" };
  }

  return dy >= 0 ? { fromSide: "bottom", toSide: "top" } : { fromSide: "top", toSide: "bottom" };
}
