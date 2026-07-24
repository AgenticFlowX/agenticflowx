import type { CanvasEdge, CanvasNode, JSONCanvas } from "@afx/shared";

export class JSONCanvasParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JSONCanvasParseError";
  }
}

const EDGE_ENDS = new Set(["none", "arrow"]);
const SIDES = new Set(["top", "right", "bottom", "left"]);

export function emptyCanvas(): JSONCanvas {
  return { nodes: [], edges: [] };
}

/**
 * Parses standard JSON Canvas while retaining all unknown root/node/edge keys.
 *
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-4] [FR-13]
 * @see docs/specs/229-app-workbench-canvas/design.md [DES-DATA]
 * @see docs/specs/229-app-workbench-canvas/tasks.md [7.1]
 */
export function parseJSONCanvas(content: string): JSONCanvas {
  if (!content.trim()) return emptyCanvas();
  let value: unknown;
  try {
    value = JSON.parse(content);
  } catch (error) {
    throw new JSONCanvasParseError(error instanceof Error ? error.message : "Invalid JSON");
  }
  if (!isObject(value)) throw new JSONCanvasParseError("Canvas root must be an object");
  const canvas = value as JSONCanvas;
  if (canvas.nodes !== undefined && !Array.isArray(canvas.nodes)) {
    throw new JSONCanvasParseError("Canvas nodes must be an array");
  }
  if (canvas.edges !== undefined && !Array.isArray(canvas.edges)) {
    throw new JSONCanvasParseError("Canvas edges must be an array");
  }
  (canvas.nodes ?? []).forEach(validateNode);
  (canvas.edges ?? []).forEach(validateEdge);
  assertUniqueIds(canvas);
  return { ...canvas, nodes: canvas.nodes ?? [], edges: canvas.edges ?? [] };
}

export function serializeJSONCanvas(canvas: JSONCanvas): string {
  return `${JSON.stringify({ ...canvas, nodes: canvas.nodes ?? [], edges: canvas.edges ?? [] }, null, 2)}\n`;
}

export function assertUniqueIds(canvas: JSONCanvas): void {
  const ids = new Set<string>();
  for (const item of [...(canvas.nodes ?? []), ...(canvas.edges ?? [])]) {
    if (ids.has(item.id)) throw new JSONCanvasParseError(`Duplicate canvas id: ${item.id}`);
    ids.add(item.id);
  }
}

function validateNode(node: unknown, index: number): asserts node is CanvasNode {
  if (!isObject(node)) throw new JSONCanvasParseError(`Node ${index + 1} must be an object`);
  const id = requireString(node, "id", `Node ${index + 1}`);
  const type = requireString(node, "type", `Node ${index + 1}`);
  for (const key of ["x", "y", "width", "height"]) requireNumber(node, key, `Node ${id}`);
  // Foreign/future node types (Obsidian plugins, later JSON Canvas revisions)
  // are preserved verbatim rather than rejecting the whole document: geometry
  // stays required so consumers can place a fallback card, while type-specific
  // payloads are only enforced for the types this engine understands.
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
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function requireString(object: Record<string, unknown>, key: string, owner: string): string {
  const value = object[key];
  if (typeof value !== "string") throw new JSONCanvasParseError(`${owner} requires string ${key}`);
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
  allowed: ReadonlySet<string>,
  owner: string,
): void {
  const value = object[key];
  if (value !== undefined && (typeof value !== "string" || !allowed.has(value))) {
    throw new JSONCanvasParseError(`${owner} has invalid ${key}`);
  }
}
