/**
 * Deterministic export projections: portable `.canvas` subsets, preflight
 * reference checks, and SVG rendering for full/selection/frame/viewport scopes.
 *
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-42]
 * @see docs/specs/229-app-workbench-canvas/design.md [DES-API]
 */
import type { CanvasEdge, CanvasNode, JSONCanvas } from "@afx/shared";

export interface CanvasExportBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type CanvasExportScope =
  | { kind: "full" }
  | { kind: "selection"; nodeIds: readonly string[] }
  | { kind: "frame"; nodeId: string }
  | { kind: "viewport"; bounds: CanvasExportBounds };

export interface CanvasExportOptions {
  scope: CanvasExportScope;
  translateToOrigin?: boolean;
}

export interface CanvasExportProjection {
  scope: CanvasExportScope;
  document: JSONCanvas;
  sourceBounds: CanvasExportBounds;
  bounds: CanvasExportBounds;
  includedNodeIds: string[];
  omittedEdgeIds: string[];
}

export type CanvasExportReferenceState = "missing" | "blocked" | "stale" | "external";

export interface CanvasExportReferenceStatus {
  nodeId: string;
  state: CanvasExportReferenceState;
  reference: string;
  message?: string;
}

export type CanvasExportPreflightIssue = CanvasExportReferenceStatus;

export interface CanvasExportPreflight {
  ready: boolean;
  issues: CanvasExportPreflightIssue[];
  summary: {
    nodes: number;
    edges: number;
    omittedEdges: number;
    missing: number;
    blocked: number;
    stale: number;
    external: number;
  };
}

export interface CanvasSvgExportOptions {
  padding?: number;
  scale?: number;
  background?: string;
  title?: string;
  maxTextCharacters?: number;
}

export class CanvasExportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CanvasExportError";
  }
}

const COLOR_PRESETS: Readonly<Record<string, string>> = {
  "1": "#ef4444",
  "2": "#f97316",
  "3": "#eab308",
  "4": "#22c55e",
  "5": "#06b6d4",
  "6": "#8b5cf6",
};

const REFERENCE_STATES = new Set<CanvasExportReferenceState>([
  "missing",
  "blocked",
  "stale",
  "external",
]);

/** Project a portable, deterministic JSON Canvas subset without mutating the source. */
export function createCanvasExportProjection(
  canvas: JSONCanvas,
  options: CanvasExportOptions,
): CanvasExportProjection {
  const nodes = canvas.nodes ?? [];
  const edges = canvas.edges ?? [];
  validateCanvasItems(nodes, edges);
  const selected = selectNodes(nodes, options.scope);
  const includedIds = new Set(selected.map((node) => node.id));
  const includedEdges: CanvasEdge[] = [];
  const omittedEdgeIds: string[] = [];
  for (const candidate of edges) {
    if (includedIds.has(candidate.fromNode) && includedIds.has(candidate.toNode)) {
      includedEdges.push(candidate);
    } else {
      omittedEdgeIds.push(candidate.id);
    }
  }
  selected.sort(compareItems);
  includedEdges.sort(compareItems);
  omittedEdgeIds.sort(compareStrings);

  const sourceBounds =
    options.scope.kind === "viewport" ? cloneBounds(options.scope.bounds) : boundsOf(selected);
  const offset = options.translateToOrigin
    ? { x: -sourceBounds.x, y: -sourceBounds.y }
    : { x: 0, y: 0 };
  const projectedNodes =
    offset.x === 0 && offset.y === 0
      ? [...selected]
      : selected.map((node) => ({
          ...node,
          x: node.x + offset.x,
          y: node.y + offset.y,
        }));
  const bounds = options.translateToOrigin
    ? { x: 0, y: 0, width: sourceBounds.width, height: sourceBounds.height }
    : cloneBounds(sourceBounds);

  return {
    scope: cloneScope(options.scope),
    document: {
      ...canvas,
      nodes: projectedNodes,
      edges: [...includedEdges],
    },
    sourceBounds,
    bounds,
    includedNodeIds: selected.map((node) => node.id),
    omittedEdgeIds,
  };
}

/** Canonical portable bytes: stable object keys plus ID-sorted node/edge arrays. */
export function serializePortableCanvasExport(projection: CanvasExportProjection): string {
  try {
    const serialized = JSON.stringify(canonicalize(projection.document), null, 2);
    if (serialized === undefined) throw new Error("Canvas is not serializable");
    return `${serialized}\n`;
  } catch (error) {
    throw new CanvasExportError(
      `Canvas export could not be serialized: ${error instanceof Error ? error.message : "invalid data"}`,
    );
  }
}

/** Summarize caller-supplied reference health. This function performs no I/O. */
export function preflightCanvasExport(
  projection: CanvasExportProjection,
  references: readonly CanvasExportReferenceStatus[],
): CanvasExportPreflight {
  const included = new Set(projection.includedNodeIds);
  const issues: CanvasExportPreflightIssue[] = [];
  for (const reference of references) {
    if (!included.has(reference.nodeId)) continue;
    if (!REFERENCE_STATES.has(reference.state)) {
      throw new CanvasExportError(`Unsupported Canvas export reference state: ${reference.state}`);
    }
    issues.push({ ...reference });
  }
  issues.sort(
    (left, right) =>
      compareStrings(left.nodeId, right.nodeId) ||
      compareStrings(left.state, right.state) ||
      compareStrings(left.reference, right.reference),
  );
  const count = (state: CanvasExportReferenceState): number =>
    issues.filter((issue) => issue.state === state).length;
  return {
    ready: issues.length === 0,
    issues,
    summary: {
      nodes: projection.document.nodes?.length ?? 0,
      edges: projection.document.edges?.length ?? 0,
      omittedEdges: projection.omittedEdgeIds.length,
      missing: count("missing"),
      blocked: count("blocked"),
      stale: count("stale"),
      external: count("external"),
    },
  };
}

/** Render safe deterministic SVG primitives; no HTML, active links, file reads, or network access. */
export function renderCanvasExportSvg(
  projection: CanvasExportProjection,
  options: CanvasSvgExportOptions = {},
): string {
  const padding = finiteRange(options.padding ?? 24, "padding", 0, 100_000);
  const scale = finiteRange(options.scale ?? 1, "scale", 0.01, 16);
  const maxTextCharacters = integerRange(
    options.maxTextCharacters ?? 280,
    "maxTextCharacters",
    8,
    20_000,
  );
  const background = safeBackground(options.background ?? "#ffffff");
  const bounds = projection.bounds;
  validateBounds(bounds, "SVG bounds", true);
  const viewWidth = Math.max(1, bounds.width + padding * 2);
  const viewHeight = Math.max(1, bounds.height + padding * 2);
  const viewX = bounds.x - padding;
  const viewY = bounds.y - padding;
  const width = viewWidth * scale;
  const height = viewHeight * scale;
  const nodes = [...(projection.document.nodes ?? [])].sort(compareItems);
  const edges = [...(projection.document.edges ?? [])].sort(compareItems);
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const groups = nodes.filter((node) => node.type === "group");
  const regular = nodes.filter((node) => node.type !== "group");
  const parallel = parallelEdgeIndexes(edges);
  const title = sanitizeXmlText(options.title ?? "AFX Canvas export");
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${numberText(width)}" height="${numberText(height)}" viewBox="${numberText(viewX)} ${numberText(viewY)} ${numberText(viewWidth)} ${numberText(viewHeight)}" role="img" aria-labelledby="afx-export-title">`,
    `<title id="afx-export-title">${escapeXml(title)}</title>`,
    `<rect x="${numberText(viewX)}" y="${numberText(viewY)}" width="${numberText(viewWidth)}" height="${numberText(viewHeight)}" fill="${escapeXml(background)}"/>`,
    '<defs><marker id="afx-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke"/></marker></defs>',
  ];
  for (const group of groups) parts.push(renderNode(group, maxTextCharacters));
  for (const candidate of edges) {
    const from = byId.get(candidate.fromNode);
    const to = byId.get(candidate.toNode);
    if (!from || !to) continue;
    parts.push(renderEdge(candidate, from, to, parallel.get(candidate.id)));
  }
  for (const node of regular) parts.push(renderNode(node, maxTextCharacters));
  parts.push("</svg>");
  return `${parts.join("\n")}\n`;
}

function selectNodes(nodes: readonly CanvasNode[], scope: CanvasExportScope): CanvasNode[] {
  switch (scope.kind) {
    case "full":
      return [...nodes];
    case "selection": {
      if (scope.nodeIds.length === 0) {
        throw new CanvasExportError("Canvas export selection requires at least one node.");
      }
      if (new Set(scope.nodeIds).size !== scope.nodeIds.length) {
        throw new CanvasExportError("Canvas export selection requires unique node IDs.");
      }
      const requested = new Set(scope.nodeIds);
      const selected = nodes.filter((node) => requested.has(node.id));
      if (selected.length !== requested.size) {
        const available = new Set(nodes.map((node) => node.id));
        const missing = scope.nodeIds.filter((id) => !available.has(id)).sort(compareStrings);
        throw new CanvasExportError(
          `Canvas export contains unknown node IDs: ${missing.join(", ")}`,
        );
      }
      return selected;
    }
    case "frame": {
      const frame = nodes.find((node) => node.id === scope.nodeId);
      if (!frame) throw new CanvasExportError(`Canvas export frame was not found: ${scope.nodeId}`);
      if (frame.type !== "group") {
        throw new CanvasExportError(
          `Canvas export frame must reference a group node: ${scope.nodeId}`,
        );
      }
      return nodes.filter((node) => node.id === frame.id || containedBy(node, frame));
    }
    case "viewport":
      validateBounds(scope.bounds, "Canvas export viewport");
      return nodes.filter((node) => intersects(node, scope.bounds));
    default:
      throw new CanvasExportError("Unsupported canvas export scope.");
  }
}

function validateCanvasItems(nodes: readonly CanvasNode[], edges: readonly CanvasEdge[]): void {
  const ids = new Set<string>();
  for (const node of nodes) {
    if (ids.has(node.id)) throw new CanvasExportError(`Duplicate Canvas export ID: ${node.id}`);
    ids.add(node.id);
    validateBounds(node, `Canvas node ${node.id}`);
  }
  for (const candidate of edges) {
    if (ids.has(candidate.id)) {
      throw new CanvasExportError(`Duplicate Canvas export ID: ${candidate.id}`);
    }
    ids.add(candidate.id);
  }
}

function boundsOf(nodes: readonly CanvasNode[]): CanvasExportBounds {
  if (nodes.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  const x = Math.min(...nodes.map((node) => node.x));
  const y = Math.min(...nodes.map((node) => node.y));
  const right = Math.max(...nodes.map((node) => node.x + node.width));
  const bottom = Math.max(...nodes.map((node) => node.y + node.height));
  return { x, y, width: right - x, height: bottom - y };
}

function validateBounds(bounds: CanvasExportBounds, owner: string, allowEmpty = false): void {
  if (![bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isFinite)) {
    throw new CanvasExportError(`${owner} must contain finite coordinates and dimensions.`);
  }
  const minimum = allowEmpty ? 0 : Number.EPSILON;
  if (bounds.width < minimum)
    throw new CanvasExportError(`${owner} width must be greater than zero.`);
  if (bounds.height < minimum) {
    throw new CanvasExportError(`${owner} height must be greater than zero.`);
  }
}

function containedBy(node: CanvasNode, frame: CanvasNode): boolean {
  return (
    node.x >= frame.x &&
    node.y >= frame.y &&
    node.x + node.width <= frame.x + frame.width &&
    node.y + node.height <= frame.y + frame.height
  );
}

function intersects(node: CanvasNode, bounds: CanvasExportBounds): boolean {
  return !(
    node.x + node.width <= bounds.x ||
    node.x >= bounds.x + bounds.width ||
    node.y + node.height <= bounds.y ||
    node.y >= bounds.y + bounds.height
  );
}

function renderNode(node: CanvasNode, maxTextCharacters: number): string {
  const fill = nodeColor(node.color, node.type === "group" ? "#8b5cf6" : "#f8fafc");
  const stroke = node.type === "group" ? fill : "#64748b";
  const groupAttributes =
    node.type === "group" ? ' fill-opacity="0.08" stroke-dasharray="12 8"' : ' fill-opacity="1"';
  const lines = nodeText(node, maxTextCharacters);
  const textX = node.x + 12;
  const textY = node.y + 23;
  const maximumLines = Math.max(1, Math.floor((node.height - 20) / 17));
  const visible = lines.slice(0, maximumLines);
  const tspans = visible
    .map(
      (line, index) =>
        `<tspan x="${numberText(textX)}" y="${numberText(textY + index * 17)}">${escapeXml(line)}</tspan>`,
    )
    .join("");
  return [
    `<g data-node-id="${escapeXml(node.id)}" data-node-type="${node.type}">`,
    `<rect x="${numberText(node.x)}" y="${numberText(node.y)}" width="${numberText(node.width)}" height="${numberText(node.height)}" rx="${node.type === "group" ? "4" : "8"}" fill="${escapeXml(fill)}" stroke="${escapeXml(stroke)}" stroke-width="${node.type === "group" ? "2" : "1.5"}"${groupAttributes}/>`,
    `<text font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="12" fill="#0f172a">${tspans}</text>`,
    "</g>",
  ].join("");
}

function nodeText(node: CanvasNode, maxTextCharacters: number): string[] {
  const source =
    node.type === "text"
      ? node.text
      : node.type === "file"
        ? `File\n${node.file}${node.subpath ?? ""}`
        : node.type === "link"
          ? `Link\n${node.url}`
          : node.type === "group"
            ? node.label || "Group"
            : // Foreign node types are preserved by the parser; label them by
              // type. The cast is safe: the union is exhausted for TS, but
              // permissive parse can hand through nodes outside it at runtime.
              String((node as { type: string }).type);
  const summarized = summarizeMarkdown(source, maxTextCharacters);
  const lineLength = Math.max(8, Math.floor((node.width - 24) / 7));
  return wrapText(summarized, lineLength);
}

function summarizeMarkdown(source: string, maximum: number): string {
  const plain = sanitizeXmlText(source)
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/!\[([^\]]*)\]\(([^)]*)\)/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]*)\)/g, "$1 ($2)")
    .replace(/^\s*[-*+]\s+/gm, "• ")
    .replace(/[*_~`]/g, "")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();
  return plain.length <= maximum ? plain : `${plain.slice(0, Math.max(1, maximum - 1))}…`;
}

function wrapText(source: string, maximum: number): string[] {
  const output: string[] = [];
  for (const rawLine of source.split("\n")) {
    const words = rawLine.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      output.push("");
      continue;
    }
    let line = "";
    for (const word of words) {
      if (!line) {
        line = word;
      } else if (`${line} ${word}`.length <= maximum) {
        line = `${line} ${word}`;
      } else {
        output.push(line);
        line = word;
      }
      while (line.length > maximum) {
        output.push(line.slice(0, maximum));
        line = line.slice(maximum);
      }
    }
    if (line) output.push(line);
  }
  return output;
}

function renderEdge(
  candidate: CanvasEdge,
  from: CanvasNode,
  to: CanvasNode,
  parallel: { index: number; count: number } | undefined,
): string {
  const start = nodeAnchor(from, candidate.fromSide, to);
  const end = nodeAnchor(to, candidate.toSide, from);
  const offset = ((parallel?.index ?? 0) - ((parallel?.count ?? 1) - 1) / 2) * 16;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.max(1, Math.hypot(dx, dy));
  const control = {
    x: (start.x + end.x) / 2 + (-dy / length) * offset,
    y: (start.y + end.y) / 2 + (dx / length) * offset,
  };
  const path =
    from.id === to.id
      ? selfLoopPath(from, offset)
      : `M ${numberText(start.x)} ${numberText(start.y)} Q ${numberText(control.x)} ${numberText(control.y)} ${numberText(end.x)} ${numberText(end.y)}`;
  const labelPoint =
    from.id === to.id
      ? { x: from.x + from.width + 28 + offset, y: from.y - 20 - offset }
      : {
          x: start.x * 0.25 + control.x * 0.5 + end.x * 0.25,
          y: start.y * 0.25 + control.y * 0.5 + end.y * 0.25,
        };
  const stroke = nodeColor(candidate.color, "#64748b");
  const dash =
    candidate.afxStyle?.stroke === "dashed"
      ? ' stroke-dasharray="10 7"'
      : candidate.afxStyle?.stroke === "dotted"
        ? ' stroke-dasharray="2 6"'
        : "";
  // JSON Canvas defaults: fromEnd "none", toEnd "arrow" — files that omit the
  // fields (Obsidian does) must still export with a directional arrowhead.
  const markers = `${candidate.fromEnd === "arrow" ? ' marker-start="url(#afx-arrow)"' : ""}${(candidate.toEnd ?? "arrow") === "arrow" ? ' marker-end="url(#afx-arrow)"' : ""}`;
  const label = candidate.label
    ? `<text x="${numberText(labelPoint.x)}" y="${numberText(labelPoint.y - 5)}" text-anchor="middle" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="11" fill="#334155">${escapeXml(clip(sanitizeXmlText(candidate.label), 160))}</text>`
    : "";
  return `<g data-edge-id="${escapeXml(candidate.id)}"><path d="${path}" fill="none" stroke="${escapeXml(stroke)}" stroke-width="2"${dash}${markers}/>${label}</g>`;
}

function nodeAnchor(
  node: CanvasNode,
  side: CanvasEdge["fromSide"],
  other: CanvasNode,
): { x: number; y: number } {
  const resolved = side ?? automaticSide(node, other);
  if (resolved === "top") return { x: node.x + node.width / 2, y: node.y };
  if (resolved === "right") return { x: node.x + node.width, y: node.y + node.height / 2 };
  if (resolved === "bottom") return { x: node.x + node.width / 2, y: node.y + node.height };
  return { x: node.x, y: node.y + node.height / 2 };
}

function automaticSide(node: CanvasNode, other: CanvasNode): NonNullable<CanvasEdge["fromSide"]> {
  const dx = other.x + other.width / 2 - (node.x + node.width / 2);
  const dy = other.y + other.height / 2 - (node.y + node.height / 2);
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? "right" : "left";
  return dy >= 0 ? "bottom" : "top";
}

function selfLoopPath(node: CanvasNode, offset: number): string {
  const x = node.x + node.width;
  const y = node.y + node.height / 2;
  const radius = 36 + Math.abs(offset);
  return `M ${numberText(x)} ${numberText(y)} C ${numberText(x + radius)} ${numberText(y - radius)} ${numberText(x + radius)} ${numberText(y + radius)} ${numberText(x)} ${numberText(y + 2)}`;
}

function parallelEdgeIndexes(
  edges: readonly CanvasEdge[],
): Map<string, { index: number; count: number }> {
  const groups = new Map<string, CanvasEdge[]>();
  for (const candidate of edges) {
    const key = `${candidate.fromNode}\u0000${candidate.toNode}`;
    groups.set(key, [...(groups.get(key) ?? []), candidate]);
  }
  const result = new Map<string, { index: number; count: number }>();
  for (const group of groups.values()) {
    group.sort(compareItems);
    group.forEach((candidate, index) => result.set(candidate.id, { index, count: group.length }));
  }
  return result;
}

function safeBackground(value: string): string {
  if (value === "transparent" || isHexColor(value)) return value;
  throw new CanvasExportError("SVG background must be transparent or a hexadecimal color.");
}

function nodeColor(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  const preset = COLOR_PRESETS[value];
  if (preset) return preset;
  return isHexColor(value) ? value : fallback;
}

function isHexColor(value: string): boolean {
  return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(value);
}

function finiteRange(value: number, name: string, minimum: number, maximum: number): number {
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new CanvasExportError(`${name} must be between ${minimum} and ${maximum}.`);
  }
  return value;
}

function integerRange(value: number, name: string, minimum: number, maximum: number): number {
  if (!Number.isInteger(value)) throw new CanvasExportError(`${name} must be an integer.`);
  return finiteRange(value, name, minimum, maximum);
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isRecord(value)) return value;
  const output: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort(compareStrings)) {
    if (value[key] !== undefined) output[key] = canonicalize(value[key]);
  }
  return output;
}

function cloneScope(scope: CanvasExportScope): CanvasExportScope {
  if (scope.kind === "selection") return { kind: "selection", nodeIds: [...scope.nodeIds] };
  if (scope.kind === "frame") return { ...scope };
  if (scope.kind === "viewport") return { kind: "viewport", bounds: cloneBounds(scope.bounds) };
  return { kind: "full" };
}

function cloneBounds(bounds: CanvasExportBounds): CanvasExportBounds {
  return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
}

function clip(value: string, maximum: number): string {
  return value.length <= maximum ? value : `${value.slice(0, Math.max(1, maximum - 1))}…`;
}

function sanitizeXmlText(value: string): string {
  return [...value]
    .filter((character) => {
      const code = character.codePointAt(0) ?? 0;
      return code === 9 || code === 10 || code === 13 || code >= 32;
    })
    .join("");
}

function escapeXml(value: string): string {
  return sanitizeXmlText(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function numberText(value: number): string {
  return Object.is(value, -0) ? "0" : String(value);
}

function compareItems(left: { id: string }, right: { id: string }): number {
  return compareStrings(left.id, right.id);
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
