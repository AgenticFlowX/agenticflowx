/**
 * Lossless JSON Canvas 1.0 parse/serialize helpers.
 *
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-4] [FR-13] [FR-18] [NFR-3]
 * @see docs/specs/229-app-workbench-canvas/design.md [DES-DATA]
 */
import type { CanvasEdge, CanvasNode, JSONCanvas } from "@afx/shared";

export class JSONCanvasParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JSONCanvasParseError";
  }
}

const NODE_TYPES = new Set(["text", "file", "link", "group"]);
const EDGE_ENDS = new Set(["none", "arrow"]);
const SIDES = new Set(["top", "right", "bottom", "left"]);

export function emptyCanvas(): JSONCanvas {
  return { nodes: [], edges: [] };
}

/**
 * Parses a `.canvas` file while preserving unknown object fields.
 *
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-13] [FR-18]
 */
export function parseJSONCanvas(content: string): JSONCanvas {
  if (!content.trim()) return emptyCanvas();

  let value: unknown;
  try {
    value = JSON.parse(content);
  } catch (err) {
    throw new JSONCanvasParseError(err instanceof Error ? err.message : "Invalid JSON");
  }

  if (!isObject(value)) {
    throw new JSONCanvasParseError("Canvas root must be an object");
  }

  const canvas = value as JSONCanvas;
  if (canvas.nodes !== undefined) {
    if (!Array.isArray(canvas.nodes)) {
      throw new JSONCanvasParseError("Canvas nodes must be an array");
    }
    canvas.nodes.forEach(validateNode);
  }
  if (canvas.edges !== undefined) {
    if (!Array.isArray(canvas.edges)) {
      throw new JSONCanvasParseError("Canvas edges must be an array");
    }
    canvas.edges.forEach(validateEdge);
  }
  return { ...canvas, nodes: canvas.nodes ?? [], edges: canvas.edges ?? [] };
}

export function serializeJSONCanvas(canvas: JSONCanvas): string {
  return `${JSON.stringify({ ...canvas, nodes: canvas.nodes ?? [], edges: canvas.edges ?? [] }, null, 2)}\n`;
}

function validateNode(node: unknown, index: number): asserts node is CanvasNode {
  if (!isObject(node)) throw new JSONCanvasParseError(`Node ${index + 1} must be an object`);
  const id = requireString(node, "id", `Node ${index + 1}`);
  const type = requireString(node, "type", `Node ${index + 1}`);
  if (!NODE_TYPES.has(type)) throw new JSONCanvasParseError(`Node ${id} has invalid type`);
  requireNumber(node, "x", `Node ${id}`);
  requireNumber(node, "y", `Node ${id}`);
  requireNumber(node, "width", `Node ${id}`);
  requireNumber(node, "height", `Node ${id}`);

  if (type === "text") requireString(node, "text", `Node ${id}`);
  if (type === "file") requireString(node, "file", `Node ${id}`);
  if (type === "link") requireString(node, "url", `Node ${id}`);
}

function validateEdge(edge: unknown, index: number): asserts edge is CanvasEdge {
  if (!isObject(edge)) throw new JSONCanvasParseError(`Edge ${index + 1} must be an object`);
  const id = requireString(edge, "id", `Edge ${index + 1}`);
  requireString(edge, "fromNode", `Edge ${id}`);
  requireString(edge, "toNode", `Edge ${id}`);
  validateOptionalEnum(edge, "fromSide", SIDES, `Edge ${id}`);
  validateOptionalEnum(edge, "toSide", SIDES, `Edge ${id}`);
  validateOptionalEnum(edge, "fromEnd", EDGE_ENDS, `Edge ${id}`);
  validateOptionalEnum(edge, "toEnd", EDGE_ENDS, `Edge ${id}`);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function requireString(object: Record<string, unknown>, key: string, owner: string): string {
  const value = object[key];
  if (typeof value !== "string") {
    throw new JSONCanvasParseError(`${owner} requires string ${key}`);
  }
  return value;
}

function requireNumber(object: Record<string, unknown>, key: string, owner: string): number {
  const value = object[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new JSONCanvasParseError(`${owner} requires numeric ${key}`);
  }
  return value;
}

function validateOptionalEnum(
  object: Record<string, unknown>,
  key: string,
  allowed: Set<string>,
  owner: string,
): void {
  const value = object[key];
  if (value === undefined) return;
  if (typeof value !== "string" || !allowed.has(value)) {
    throw new JSONCanvasParseError(`${owner} has invalid ${key}`);
  }
}
