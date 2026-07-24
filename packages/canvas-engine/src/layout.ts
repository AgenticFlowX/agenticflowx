/**
 * Pure, deterministic auto-layout proposals over the authoritative JSON Canvas
 * model, honoring pins, groups, and manual geometry.
 *
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-40] [NFR-11]
 * @see docs/specs/229-app-workbench-canvas/design.md [DES-DATA]
 */
import type { CanvasMutation, CanvasNode, JSONCanvas } from "@afx/shared";

import { serializeJSONCanvas } from "./parse";
import { canvasContentRevision } from "./revision";

export const MAX_CANVAS_LAYOUT_NODES = 10_000;
export const MAX_CANVAS_LAYOUT_EDGES = 50_000;

export type CanvasLayoutStrategy =
  | "grid"
  | "compact"
  | "radial"
  | "hierarchical"
  | "dependency"
  | "swimlane";

export type CanvasLayoutDirection = "horizontal" | "vertical";

export interface CanvasLayoutOptions {
  strategy: CanvasLayoutStrategy;
  /** Omit for the whole document; an empty array is a valid no-op selection. */
  nodeIds?: readonly string[];
  direction?: CanvasLayoutDirection;
  columns?: number;
  horizontalGap?: number;
  verticalGap?: number;
  radialRadius?: number;
  origin?: { x: number; y: number };
  /** Defaults to true. Set false only after an explicit user override. */
  respectPins?: boolean;
  /** Defaults to true and protects groups plus nodes geometrically inside them. */
  preserveGroups?: boolean;
}

export interface CanvasLayoutControl {
  /** Checked at deterministic bounded checkpoints; no asynchronous worker is required. */
  isCancelled?: () => boolean;
}

export interface CanvasLayoutChange {
  id: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
}

export interface CanvasLayoutProposal {
  status: "ready";
  strategy: CanvasLayoutStrategy;
  inputRevision: string;
  document: JSONCanvas;
  changes: CanvasLayoutChange[];
}

export interface CanvasLayoutCancelled {
  status: "cancelled";
  strategy: CanvasLayoutStrategy;
  inputRevision: string;
}

export type CanvasLayoutResult = CanvasLayoutProposal | CanvasLayoutCancelled;

export type CanvasLayoutReplacement = Extract<CanvasMutation, { kind: "replaceDocument" }>;

export class CanvasLayoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CanvasLayoutError";
  }
}

interface NormalizedOptions {
  strategy: CanvasLayoutStrategy;
  nodeIds?: string[];
  direction: CanvasLayoutDirection;
  columns?: number;
  horizontalGap: number;
  verticalGap: number;
  radialRadius?: number;
  origin?: { x: number; y: number };
  respectPins: boolean;
  preserveGroups: boolean;
}

interface Position {
  x: number;
  y: number;
}

interface LayoutMetadata {
  pinned?: boolean;
  locked?: boolean;
  rank?: number;
  lane?: string;
}

interface LayoutContext {
  nodes: CanvasNode[];
  movable: CanvasNode[];
  scoped: CanvasNode[];
  fixed: CanvasNode[];
  options: NormalizedOptions;
  origin: Position;
  checkpoint: () => boolean;
}

const STRATEGIES = new Set<CanvasLayoutStrategy>([
  "grid",
  "compact",
  "radial",
  "hierarchical",
  "dependency",
  "swimlane",
]);

/**
 * Build a deterministic preview document. The input and every retained edge,
 * group, style, and unknown extension field remain untouched.
 */
export function proposeCanvasLayout(
  canvas: JSONCanvas,
  options: CanvasLayoutOptions,
  control: CanvasLayoutControl = {},
): CanvasLayoutResult {
  const normalized = normalizeOptions(options);
  const inputRevision = revisionOf(canvas);
  const nodes = canvas.nodes ?? [];
  const edges = canvas.edges ?? [];
  validateDocumentBounds(nodes, edges);
  assertUniqueNodeIds(nodes);
  const checkpoint = (): boolean => control.isCancelled?.() === true;
  if (checkpoint()) return cancelled(normalized.strategy, inputRevision);

  const scopeIds = resolveScopeIds(nodes, normalized.nodeIds);
  const scoped = nodes.filter((node) => scopeIds.has(node.id)).sort(compareNodeIds);
  const fixedIds = fixedNodeIds(nodes, scopeIds, normalized);
  const movable = scoped.filter((node) => !fixedIds.has(node.id));
  const movableIds = new Set(movable.map((node) => node.id));
  const fixed = nodes.filter((node) => !movableIds.has(node.id));
  const origin = normalized.origin ?? boundingOrigin(scoped);
  const context: LayoutContext = {
    nodes,
    movable,
    scoped,
    fixed,
    options: normalized,
    origin,
    checkpoint,
  };

  const proposed = strategyPositions(context, edges);
  if (!proposed) return cancelled(normalized.strategy, inputRevision);
  const positions = avoidFixedGeometry(context, proposed);
  if (!positions) return cancelled(normalized.strategy, inputRevision);

  const changes: CanvasLayoutChange[] = [];
  const nextNodes = nodes.map((node) => {
    const position = positions.get(node.id);
    if (!position || (position.x === node.x && position.y === node.y)) return node;
    changes.push({
      id: node.id,
      from: { x: node.x, y: node.y },
      to: position,
    });
    return { ...node, ...position };
  });
  changes.sort((left, right) => compareStrings(left.id, right.id));

  return {
    status: "ready",
    strategy: normalized.strategy,
    inputRevision,
    document: canvas.nodes === undefined ? { ...canvas } : { ...canvas, nodes: nextNodes },
    changes,
  };
}

/** Convert one accepted preview into the single mutation used by undo/history. */
export function createCanvasLayoutReplacement(
  current: JSONCanvas,
  proposal: CanvasLayoutProposal,
): CanvasLayoutReplacement {
  if (revisionOf(current) !== proposal.inputRevision) {
    throw new CanvasLayoutError(
      "The Canvas changed after the layout preview. Create a new preview before applying it.",
    );
  }
  return { kind: "replaceDocument", document: proposal.document };
}

function normalizeOptions(options: CanvasLayoutOptions): NormalizedOptions {
  if (!STRATEGIES.has(options.strategy)) {
    throw new CanvasLayoutError(`Unsupported Canvas layout strategy: ${String(options.strategy)}`);
  }
  const direction = options.direction ?? defaultDirection(options.strategy);
  if (direction !== "horizontal" && direction !== "vertical") {
    throw new CanvasLayoutError("Canvas layout direction must be horizontal or vertical.");
  }
  if (
    options.columns !== undefined &&
    (!Number.isInteger(options.columns) || options.columns < 1 || options.columns > 1_000)
  ) {
    throw new CanvasLayoutError("Canvas layout columns must be an integer between 1 and 1,000.");
  }
  const horizontalGap = finiteRange(options.horizontalGap ?? 80, "horizontalGap", 0, 10_000);
  const verticalGap = finiteRange(options.verticalGap ?? 72, "verticalGap", 0, 10_000);
  const radialRadius =
    options.radialRadius === undefined
      ? undefined
      : finiteRange(options.radialRadius, "radialRadius", 1, 1_000_000);
  if (
    options.origin &&
    (!Number.isFinite(options.origin.x) || !Number.isFinite(options.origin.y))
  ) {
    throw new CanvasLayoutError("Canvas layout origin must contain finite x and y values.");
  }
  if (options.nodeIds) {
    if (
      options.nodeIds.some((id) => typeof id !== "string" || !id) ||
      new Set(options.nodeIds).size !== options.nodeIds.length
    ) {
      throw new CanvasLayoutError("Canvas layout nodeIds must contain unique non-empty IDs.");
    }
  }
  return {
    strategy: options.strategy,
    ...(options.nodeIds ? { nodeIds: [...options.nodeIds] } : {}),
    direction,
    ...(options.columns === undefined ? {} : { columns: options.columns }),
    horizontalGap,
    verticalGap,
    ...(radialRadius === undefined ? {} : { radialRadius }),
    ...(options.origin ? { origin: { ...options.origin } } : {}),
    respectPins: options.respectPins !== false,
    preserveGroups: options.preserveGroups !== false,
  };
}

function finiteRange(value: number, name: string, minimum: number, maximum: number): number {
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new CanvasLayoutError(
      `Canvas layout ${name} must be a finite number between ${minimum} and ${maximum}.`,
    );
  }
  return value;
}

function defaultDirection(strategy: CanvasLayoutStrategy): CanvasLayoutDirection {
  return strategy === "dependency" || strategy === "swimlane" ? "horizontal" : "vertical";
}

function validateDocumentBounds(nodes: readonly CanvasNode[], edges: readonly unknown[]): void {
  if (nodes.length > MAX_CANVAS_LAYOUT_NODES) {
    throw new CanvasLayoutError(
      `Canvas auto-layout supports at most ${MAX_CANVAS_LAYOUT_NODES.toLocaleString()} nodes per proposal.`,
    );
  }
  if (edges.length > MAX_CANVAS_LAYOUT_EDGES) {
    throw new CanvasLayoutError(
      `Canvas auto-layout supports at most ${MAX_CANVAS_LAYOUT_EDGES.toLocaleString()} edges per proposal.`,
    );
  }
}

function assertUniqueNodeIds(nodes: readonly CanvasNode[]): void {
  const ids = new Set<string>();
  for (const node of nodes) {
    if (ids.has(node.id)) throw new CanvasLayoutError(`Duplicate Canvas node ID: ${node.id}`);
    ids.add(node.id);
  }
}

function resolveScopeIds(nodes: readonly CanvasNode[], requested: readonly string[] | undefined) {
  if (!requested) return new Set(nodes.map((node) => node.id));
  const available = new Set(nodes.map((node) => node.id));
  for (const id of requested) {
    if (!available.has(id))
      throw new CanvasLayoutError(`Canvas layout contains unknown node ID: ${id}`);
  }
  return new Set(requested);
}

function fixedNodeIds(
  nodes: readonly CanvasNode[],
  scopeIds: ReadonlySet<string>,
  options: NormalizedOptions,
): Set<string> {
  const fixed = new Set(nodes.filter((node) => !scopeIds.has(node.id)).map((node) => node.id));
  if (options.respectPins) {
    for (const node of nodes) {
      const metadata = layoutMetadata(node);
      if (metadata.pinned === true || metadata.locked === true) fixed.add(node.id);
    }
  }
  if (options.preserveGroups) {
    const groups = nodes.filter((node) => node.type === "group");
    for (const group of groups) fixed.add(group.id);
    for (const node of nodes) {
      if (node.type === "group") continue;
      if (groups.some((group) => containedBy(node, group))) fixed.add(node.id);
    }
  }
  return fixed;
}

function containedBy(node: CanvasNode, group: CanvasNode): boolean {
  return (
    node.x >= group.x &&
    node.y >= group.y &&
    node.x + node.width <= group.x + group.width &&
    node.y + node.height <= group.y + group.height
  );
}

function boundingOrigin(nodes: readonly CanvasNode[]): Position {
  if (nodes.length === 0) return { x: 0, y: 0 };
  return {
    x: Math.min(...nodes.map((node) => node.x)),
    y: Math.min(...nodes.map((node) => node.y)),
  };
}

function strategyPositions(
  context: LayoutContext,
  edges: readonly { fromNode: string; toNode: string; afxProvenance?: unknown }[],
): Map<string, Position> | undefined {
  switch (context.options.strategy) {
    case "grid":
      return gridPositions(context, context.options.horizontalGap, context.options.verticalGap);
    case "compact":
      return gridPositions(
        context,
        Math.min(context.options.horizontalGap, 28),
        Math.min(context.options.verticalGap, 24),
        true,
      );
    case "radial":
      return radialPositions(context);
    case "hierarchical":
      return layeredPositions(context, edges, false);
    case "dependency":
      return layeredPositions(context, dependencyEdges(edges), true);
    case "swimlane":
      return swimlanePositions(context);
  }
}

function gridPositions(
  context: LayoutContext,
  horizontalGap: number,
  verticalGap: number,
  compact = false,
): Map<string, Position> | undefined {
  const nodes = context.movable;
  const positions = new Map<string, Position>();
  if (nodes.length === 0) return positions;
  const columns = Math.min(
    nodes.length,
    context.options.columns ??
      Math.max(1, Math.ceil(Math.sqrt(nodes.length) * (compact ? 1.25 : 1))),
  );
  const rows = Math.ceil(nodes.length / columns);
  const columnWidths = Array.from({ length: columns }, () => 0);
  const rowHeights = Array.from({ length: rows }, () => 0);
  for (let index = 0; index < nodes.length; index += 1) {
    if (context.checkpoint()) return undefined;
    const node = nodes[index]!;
    const column = index % columns;
    const row = Math.floor(index / columns);
    columnWidths[column] = Math.max(columnWidths[column] ?? 0, node.width);
    rowHeights[row] = Math.max(rowHeights[row] ?? 0, node.height);
  }
  const columnOffsets = cumulativeOffsets(columnWidths, horizontalGap, context.origin.x);
  const rowOffsets = cumulativeOffsets(rowHeights, verticalGap, context.origin.y);
  for (let index = 0; index < nodes.length; index += 1) {
    if (context.checkpoint()) return undefined;
    const node = nodes[index]!;
    positions.set(node.id, {
      x: columnOffsets[index % columns] ?? context.origin.x,
      y: rowOffsets[Math.floor(index / columns)] ?? context.origin.y,
    });
  }
  return positions;
}

function radialPositions(context: LayoutContext): Map<string, Position> | undefined {
  const positions = new Map<string, Position>();
  const nodes = context.movable;
  if (nodes.length === 0) return positions;
  if (nodes.length === 1) {
    positions.set(nodes[0]!.id, { ...context.origin });
    return positions;
  }
  const maxSpan = Math.max(...nodes.map((node) => Math.max(node.width, node.height)));
  const radius =
    context.options.radialRadius ?? Math.max(220, (nodes.length * (maxSpan + 24)) / (2 * Math.PI));
  const center = {
    x: context.origin.x + radius + maxSpan / 2,
    y: context.origin.y + radius + maxSpan / 2,
  };
  for (let index = 0; index < nodes.length; index += 1) {
    if (context.checkpoint()) return undefined;
    const node = nodes[index]!;
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / nodes.length;
    positions.set(node.id, {
      x: rounded(center.x + Math.cos(angle) * radius - node.width / 2),
      y: rounded(center.y + Math.sin(angle) * radius - node.height / 2),
    });
  }
  return positions;
}

function layeredPositions(
  context: LayoutContext,
  edges: readonly { fromNode: string; toNode: string }[],
  reverse: boolean,
): Map<string, Position> | undefined {
  const ranks = graphRanks(context.scoped, edges, reverse, context.checkpoint);
  if (!ranks) return undefined;
  const layers = new Map<number, CanvasNode[]>();
  for (const node of context.movable) {
    const rank = ranks.get(node.id) ?? 0;
    layers.set(rank, [...(layers.get(rank) ?? []), node]);
  }
  for (const nodes of layers.values()) nodes.sort(compareNodeIds);
  const orderedRanks = [...layers.keys()].sort((left, right) => left - right);
  const positions = new Map<string, Position>();
  let primary = context.options.direction === "horizontal" ? context.origin.x : context.origin.y;
  for (const rank of orderedRanks) {
    if (context.checkpoint()) return undefined;
    const nodes = layers.get(rank) ?? [];
    let secondary =
      context.options.direction === "horizontal" ? context.origin.y : context.origin.x;
    let primarySpan = 0;
    for (const node of nodes) {
      if (context.checkpoint()) return undefined;
      positions.set(
        node.id,
        context.options.direction === "horizontal"
          ? { x: primary, y: secondary }
          : { x: secondary, y: primary },
      );
      primarySpan = Math.max(
        primarySpan,
        context.options.direction === "horizontal" ? node.width : node.height,
      );
      secondary +=
        (context.options.direction === "horizontal" ? node.height : node.width) +
        (context.options.direction === "horizontal"
          ? context.options.verticalGap
          : context.options.horizontalGap);
    }
    primary +=
      primarySpan +
      (context.options.direction === "horizontal"
        ? context.options.horizontalGap
        : context.options.verticalGap);
  }
  return positions;
}

function graphRanks(
  nodes: readonly CanvasNode[],
  edges: readonly { fromNode: string; toNode: string }[],
  reverse: boolean,
  checkpoint: () => boolean,
): Map<string, number> | undefined {
  const ids = nodes.map((node) => node.id).sort(compareStrings);
  const known = new Set(ids);
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const arcs: Array<[string, string]> = [];
  for (const edge of edges) {
    if (checkpoint()) return undefined;
    const from = reverse ? edge.toNode : edge.fromNode;
    const to = reverse ? edge.fromNode : edge.toNode;
    if (known.has(from) && known.has(to)) arcs.push([from, to]);
  }
  arcs.sort(
    (left, right) => compareStrings(left[0], right[0]) || compareStrings(left[1], right[1]),
  );
  const components = stronglyConnectedComponents(ids, arcs, checkpoint);
  if (!components) return undefined;
  const componentByNode = new Map<string, number>();
  components.forEach((component, index) => {
    for (const id of component) componentByNode.set(id, index);
  });
  const outgoing = components.map(() => new Set<number>());
  const indegree = components.map(() => 0);
  for (const [from, to] of arcs) {
    const source = componentByNode.get(from);
    const target = componentByNode.get(to);
    if (source === undefined || target === undefined || source === target) continue;
    const targets = outgoing[source]!;
    if (!targets.has(target)) {
      targets.add(target);
      indegree[target] = (indegree[target] ?? 0) + 1;
    }
  }
  const ranks = components.map((component) =>
    Math.max(
      0,
      ...component.map((id) => {
        const node = nodeById.get(id);
        const rank = node ? layoutMetadata(node).rank : undefined;
        return typeof rank === "number" && Number.isFinite(rank) ? Math.max(0, rank) : 0;
      }),
    ),
  );
  const ready = components
    .map((component, index) => ({ index, key: component[0] ?? "" }))
    .filter(({ index }) => indegree[index] === 0)
    .sort((left, right) => compareStrings(left.key, right.key));
  while (ready.length > 0) {
    if (checkpoint()) return undefined;
    const current = ready.shift()!;
    const targets = [...(outgoing[current.index] ?? [])].sort((left, right) =>
      compareStrings(components[left]?.[0] ?? "", components[right]?.[0] ?? ""),
    );
    for (const target of targets) {
      ranks[target] = Math.max(ranks[target] ?? 0, (ranks[current.index] ?? 0) + 1);
      indegree[target] = (indegree[target] ?? 0) - 1;
      if (indegree[target] === 0) {
        insertSorted(ready, { index: target, key: components[target]?.[0] ?? "" }, (left, right) =>
          compareStrings(left.key, right.key),
        );
      }
    }
  }
  return new Map(ids.map((id) => [id, ranks[componentByNode.get(id) ?? 0] ?? 0]));
}

function stronglyConnectedComponents(
  ids: readonly string[],
  arcs: readonly [string, string][],
  checkpoint: () => boolean,
): string[][] | undefined {
  const adjacency = new Map(ids.map((id) => [id, [] as string[]]));
  const reverse = new Map(ids.map((id) => [id, [] as string[]]));
  for (const [from, to] of arcs) {
    adjacency.get(from)?.push(to);
    reverse.get(to)?.push(from);
  }
  for (const values of [...adjacency.values(), ...reverse.values()]) {
    values.sort(compareStrings);
  }

  const visited = new Set<string>();
  const finished: string[] = [];
  for (const start of ids) {
    if (visited.has(start)) continue;
    const stack: Array<{ id: string; next: number }> = [{ id: start, next: 0 }];
    visited.add(start);
    while (stack.length > 0) {
      if (checkpoint()) return undefined;
      const frame = stack[stack.length - 1]!;
      const neighbors = adjacency.get(frame.id) ?? [];
      const next = neighbors[frame.next];
      if (next !== undefined) {
        frame.next += 1;
        if (!visited.has(next)) {
          visited.add(next);
          stack.push({ id: next, next: 0 });
        }
      } else {
        finished.push(frame.id);
        stack.pop();
      }
    }
  }

  const assigned = new Set<string>();
  const components: string[][] = [];
  for (let index = finished.length - 1; index >= 0; index -= 1) {
    const start = finished[index]!;
    if (assigned.has(start)) continue;
    const component: string[] = [];
    const stack = [start];
    assigned.add(start);
    while (stack.length > 0) {
      if (checkpoint()) return undefined;
      const current = stack.pop()!;
      component.push(current);
      for (const neighbor of reverse.get(current) ?? []) {
        if (!assigned.has(neighbor)) {
          assigned.add(neighbor);
          stack.push(neighbor);
        }
      }
    }
    component.sort(compareStrings);
    components.push(component);
  }
  components.sort((left, right) => compareStrings(left[0] ?? "", right[0] ?? ""));
  return components;
}

function dependencyEdges(
  edges: readonly { fromNode: string; toNode: string; afxProvenance?: unknown }[],
) {
  const declared = edges.filter((candidate) => {
    const provenance = candidate.afxProvenance;
    return (
      isRecord(provenance) &&
      provenance["kind"] === "declared-dependency" &&
      provenance["detached"] !== true
    );
  });
  return declared.length > 0 ? declared : edges;
}

function swimlanePositions(context: LayoutContext): Map<string, Position> | undefined {
  const lanes = new Map<string, CanvasNode[]>();
  for (const node of context.movable) {
    if (context.checkpoint()) return undefined;
    const lane = layoutMetadata(node).lane?.trim() || "Unassigned";
    lanes.set(lane, [...(lanes.get(lane) ?? []), node]);
  }
  const positions = new Map<string, Position>();
  let laneOffset = context.options.direction === "horizontal" ? context.origin.y : context.origin.x;
  for (const lane of [...lanes.keys()].sort(compareStrings)) {
    if (context.checkpoint()) return undefined;
    const nodes = (lanes.get(lane) ?? []).sort((left, right) => {
      const leftRank = layoutMetadata(left).rank ?? Number.MAX_SAFE_INTEGER;
      const rightRank = layoutMetadata(right).rank ?? Number.MAX_SAFE_INTEGER;
      return leftRank - rightRank || compareNodeIds(left, right);
    });
    let progression =
      context.options.direction === "horizontal" ? context.origin.x : context.origin.y;
    let laneSpan = 0;
    for (const node of nodes) {
      if (context.checkpoint()) return undefined;
      positions.set(
        node.id,
        context.options.direction === "horizontal"
          ? { x: progression, y: laneOffset }
          : { x: laneOffset, y: progression },
      );
      progression +=
        (context.options.direction === "horizontal" ? node.width : node.height) +
        (context.options.direction === "horizontal"
          ? context.options.horizontalGap
          : context.options.verticalGap);
      laneSpan = Math.max(
        laneSpan,
        context.options.direction === "horizontal" ? node.height : node.width,
      );
    }
    laneOffset +=
      laneSpan +
      (context.options.direction === "horizontal"
        ? context.options.verticalGap * 2 + 40
        : context.options.horizontalGap * 2 + 40);
  }
  return positions;
}

function avoidFixedGeometry(
  context: LayoutContext,
  proposed: ReadonlyMap<string, Position>,
): Map<string, Position> | undefined {
  const occupied = context.fixed.map((node) => ({
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
  }));
  const resolved = new Map<string, Position>();
  for (const node of context.movable) {
    if (context.checkpoint()) return undefined;
    const initial = proposed.get(node.id);
    if (!initial) continue;
    const position = { ...initial };
    for (let attempt = 0; attempt <= occupied.length; attempt += 1) {
      const collision = occupied.find((candidate) => intersects(position, node, candidate));
      if (!collision) break;
      position.y = rounded(collision.y + collision.height + context.options.verticalGap);
      if (attempt === occupied.length) {
        throw new CanvasLayoutError(`Unable to place Canvas node without overlap: ${node.id}`);
      }
    }
    resolved.set(node.id, position);
    occupied.push({ ...position, width: node.width, height: node.height });
  }
  return resolved;
}

function intersects(
  position: Position,
  node: Pick<CanvasNode, "width" | "height">,
  other: { x: number; y: number; width: number; height: number },
): boolean {
  return !(
    position.x + node.width <= other.x ||
    position.x >= other.x + other.width ||
    position.y + node.height <= other.y ||
    position.y >= other.y + other.height
  );
}

function layoutMetadata(node: CanvasNode): LayoutMetadata {
  const value = node["afxLayout"];
  if (!isRecord(value)) return {};
  return {
    ...(typeof value["pinned"] === "boolean" ? { pinned: value["pinned"] } : {}),
    ...(typeof value["locked"] === "boolean" ? { locked: value["locked"] } : {}),
    ...(typeof value["rank"] === "number" && Number.isFinite(value["rank"])
      ? { rank: Math.max(0, value["rank"]) }
      : {}),
    ...(typeof value["lane"] === "string" ? { lane: value["lane"] } : {}),
  };
}

function cumulativeOffsets(sizes: readonly number[], gap: number, origin: number): number[] {
  const offsets: number[] = [];
  let next = origin;
  for (const size of sizes) {
    offsets.push(rounded(next));
    next += size + gap;
  }
  return offsets;
}

function revisionOf(canvas: JSONCanvas): string {
  return canvasContentRevision(serializeJSONCanvas(canvas));
}

function cancelled(strategy: CanvasLayoutStrategy, inputRevision: string): CanvasLayoutCancelled {
  return { status: "cancelled", strategy, inputRevision };
}

function rounded(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function compareNodeIds(left: CanvasNode, right: CanvasNode): number {
  return compareStrings(left.id, right.id);
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function insertSorted<T>(values: T[], value: T, compare: (left: T, right: T) => number): void {
  let low = 0;
  let high = values.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (compare(values[middle]!, value) <= 0) low = middle + 1;
    else high = middle;
  }
  values.splice(low, 0, value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
