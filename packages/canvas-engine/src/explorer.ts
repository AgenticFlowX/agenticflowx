/**
 * Pure architecture-explorer queries: node search, neighborhood focus, and
 * whole-canvas structural diagnostics.
 *
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-34]
 * @see docs/specs/229-app-workbench-canvas/design.md [DES-ARCH]
 */
import type { CanvasNode, JSONCanvas } from "@afx/shared";

export type CanvasNodeType = CanvasNode["type"];

export interface CanvasSearchOptions {
  query?: string;
  types?: readonly CanvasNodeType[];
  colors?: readonly string[];
  rootUris?: readonly string[];
  statuses?: readonly string[];
  limit?: number;
}

export interface CanvasSearchResult {
  nodeId: string;
  type: CanvasNodeType;
  title: string;
  detail: string;
  score: number;
  degree: number;
  documentKind?: "spec" | "sprint";
  status?: string;
}

export interface CanvasArchitectureDiagnostic {
  severity: "error" | "warning" | "info";
  code:
    | "duplicate-node-id"
    | "duplicate-edge-id"
    | "missing-edge-endpoint"
    | "self-loop"
    | "cycle"
    | "isolated-node";
  itemIds: string[];
  message: string;
}

export interface CanvasArchitectureAnalysis {
  nodes: number;
  edges: number;
  components: number;
  cyclic: boolean;
  diagnostics: CanvasArchitectureDiagnostic[];
}

export interface CanvasNeighborhood {
  nodeIds: string[];
  edgeIds: string[];
  distanceByNodeId: Record<string, number>;
}

const DEFAULT_SEARCH_LIMIT = 250;
const MAX_SEARCH_LIMIT = 10_000;

/** Search portable node content without requiring AFX metadata or host IO. */
export function searchCanvasNodes(
  canvas: JSONCanvas,
  options: CanvasSearchOptions = {},
): CanvasSearchResult[] {
  const terms = (options.query ?? "").trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const types = options.types ? new Set(options.types) : undefined;
  const colors = options.colors ? new Set(options.colors) : undefined;
  const roots = options.rootUris ? new Set(options.rootUris) : undefined;
  const statuses = options.statuses
    ? new Set(options.statuses.map((status) => status.trim().toLocaleLowerCase()))
    : undefined;
  const limit = normalizeLimit(options.limit);
  const degrees = nodeDegrees(canvas);

  return (canvas.nodes ?? [])
    .filter((node) => !types || types.has(node.type))
    .filter((node) => !colors || (node.color !== undefined && colors.has(node.color)))
    .filter((node) => {
      if (!roots) return true;
      return node.type === "file" && node.afxSource?.rootUri
        ? roots.has(node.afxSource.rootUri)
        : false;
    })
    .filter((node) => {
      if (!statuses) return true;
      const status = node.type === "file" ? node.afxSpec?.status : undefined;
      return typeof status === "string" && statuses.has(status.trim().toLocaleLowerCase());
    })
    .map((node) => {
      const title = nodeTitle(node);
      const detail = nodeDetail(node);
      const haystack = `${title}\n${detail}\n${node.id}`.toLocaleLowerCase();
      if (!terms.every((term) => haystack.includes(term))) return undefined;
      return {
        nodeId: node.id,
        type: node.type,
        title,
        detail,
        score: searchScore(terms, title, detail),
        degree: degrees.get(node.id) ?? 0,
        ...(node.type === "file" && node.afxSpec?.documentKind
          ? { documentKind: node.afxSpec.documentKind }
          : {}),
        ...(node.type === "file" && node.afxSpec?.status ? { status: node.afxSpec.status } : {}),
      } satisfies CanvasSearchResult;
    })
    .filter((result): result is CanvasSearchResult => Boolean(result))
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.degree - left.degree ||
        left.title.localeCompare(right.title) ||
        left.nodeId.localeCompare(right.nodeId),
    )
    .slice(0, limit);
}

/** Return an undirected one-to-three-hop focus set for topology exploration. */
export function focusCanvasNeighborhood(
  canvas: JSONCanvas,
  startNodeIds: readonly string[],
  hops = 1,
): CanvasNeighborhood {
  if (!Number.isInteger(hops) || hops < 0 || hops > 3) {
    throw new Error("Canvas neighborhood hops must be an integer from 0 to 3.");
  }
  const nodes = canvas.nodes ?? [];
  const available = new Set(nodes.map((node) => node.id));
  const starts = [...new Set(startNodeIds)].sort(compareStrings);
  const unknown = starts.filter((id) => !available.has(id));
  if (unknown.length > 0) {
    throw new Error(`Canvas neighborhood contains unknown node IDs: ${unknown.join(", ")}`);
  }
  const adjacency = new Map<string, Array<{ nodeId: string; edgeId: string }>>();
  for (const edge of canvas.edges ?? []) {
    if (!available.has(edge.fromNode) || !available.has(edge.toNode)) continue;
    addNeighbor(adjacency, edge.fromNode, edge.toNode, edge.id);
    addNeighbor(adjacency, edge.toNode, edge.fromNode, edge.id);
  }
  const distance = new Map<string, number>(starts.map((id) => [id, 0]));
  const queue = [...starts];
  const edgeIds = new Set<string>();
  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index]!;
    const currentDistance = distance.get(current)!;
    if (currentDistance >= hops) continue;
    const neighbors = [...(adjacency.get(current) ?? [])].sort(
      (left, right) =>
        compareStrings(left.nodeId, right.nodeId) || compareStrings(left.edgeId, right.edgeId),
    );
    for (const neighbor of neighbors) {
      edgeIds.add(neighbor.edgeId);
      if (distance.has(neighbor.nodeId)) continue;
      distance.set(neighbor.nodeId, currentDistance + 1);
      queue.push(neighbor.nodeId);
    }
  }
  const nodeIds = [...distance.keys()].sort(
    (left, right) => distance.get(left)! - distance.get(right)! || compareStrings(left, right),
  );
  const visible = new Set(nodeIds);
  const includedEdges = (canvas.edges ?? [])
    .filter(
      (edge) => visible.has(edge.fromNode) && visible.has(edge.toNode) && edgeIds.has(edge.id),
    )
    .map((edge) => edge.id)
    .sort(compareStrings);
  return {
    nodeIds,
    edgeIds: includedEdges,
    distanceByNodeId: Object.fromEntries(nodeIds.map((id) => [id, distance.get(id)!])),
  };
}

/** Report structural problems without rewriting or silently dropping graph items. */
export function analyzeCanvasArchitecture(canvas: JSONCanvas): CanvasArchitectureAnalysis {
  const nodes = canvas.nodes ?? [];
  const edges = canvas.edges ?? [];
  const diagnostics: CanvasArchitectureDiagnostic[] = [];
  const nodeCounts = counts(nodes.map((node) => node.id));
  const edgeCounts = counts(edges.map((edge) => edge.id));
  for (const [id, count] of [...nodeCounts].sort(compareEntries)) {
    if (count > 1) {
      diagnostics.push({
        severity: "error",
        code: "duplicate-node-id",
        itemIds: [id],
        message: `Node ID ${id} appears ${count} times.`,
      });
    }
  }
  for (const [id, count] of [...edgeCounts].sort(compareEntries)) {
    if (count > 1) {
      diagnostics.push({
        severity: "error",
        code: "duplicate-edge-id",
        itemIds: [id],
        message: `Edge ID ${id} appears ${count} times.`,
      });
    }
  }
  const available = new Set(nodeCounts.keys());
  const validEdges = edges.filter((edge) => {
    const missing = [edge.fromNode, edge.toNode].filter((id) => !available.has(id));
    if (missing.length > 0) {
      diagnostics.push({
        severity: "error",
        code: "missing-edge-endpoint",
        itemIds: [edge.id, ...missing],
        message: `Edge ${edge.id} references missing node ${missing.join(", ")}.`,
      });
      return false;
    }
    if (edge.fromNode === edge.toNode) {
      diagnostics.push({
        severity: "warning",
        code: "self-loop",
        itemIds: [edge.id, edge.fromNode],
        message: `Edge ${edge.id} loops back to ${edge.fromNode}.`,
      });
    }
    return true;
  });
  const degree = nodeDegrees({ nodes, edges: validEdges });
  for (const node of [...nodes].sort((left, right) => compareStrings(left.id, right.id))) {
    if ((degree.get(node.id) ?? 0) === 0) {
      diagnostics.push({
        severity: "info",
        code: "isolated-node",
        itemIds: [node.id],
        message: `Node ${node.id} has no relationships.`,
      });
    }
  }
  const cycle = findDirectedCycle(available, validEdges);
  if (cycle.length > 0) {
    diagnostics.push({
      severity: "warning",
      code: "cycle",
      itemIds: cycle,
      message: `Relationship cycle detected: ${cycle.join(" → ")}.`,
    });
  }
  diagnostics.sort(
    (left, right) =>
      severityOrder(left.severity) - severityOrder(right.severity) ||
      compareStrings(left.code, right.code) ||
      compareStrings(left.itemIds.join("\0"), right.itemIds.join("\0")),
  );
  return {
    nodes: nodes.length,
    edges: edges.length,
    components: connectedComponents(available, validEdges),
    cyclic: cycle.length > 0,
    diagnostics,
  };
}

function nodeTitle(node: CanvasNode): string {
  if (node.type === "text") {
    return (
      node.text.match(/^#{1,6}\s+(.+)$/m)?.[1]?.trim() ??
      node.text.split(/\r?\n/)[0]?.trim() ??
      "Text"
    );
  }
  if (node.type === "file") return node.file.split("/").pop() || node.file;
  if (node.type === "link") return node.url;
  return node.label?.trim() || "Frame";
}

function nodeDetail(node: CanvasNode): string {
  if (node.type === "text") return node.text;
  if (node.type === "file") {
    return [
      node.afxSource?.rootName,
      node.afxSpec?.documentKind,
      node.afxSpec?.status,
      node.file,
      node.subpath,
    ]
      .filter(Boolean)
      .join(" · ");
  }
  if (node.type === "link") return node.url;
  return [node.label, node.background].filter(Boolean).join(" · ");
}

function searchScore(terms: readonly string[], title: string, detail: string): number {
  const normalizedTitle = title.toLocaleLowerCase();
  const normalizedDetail = detail.toLocaleLowerCase();
  if (terms.length === 0) return 0;
  return terms.reduce((score, term) => {
    if (normalizedTitle === term) return score + 100;
    if (normalizedTitle.startsWith(term)) return score + 50;
    if (normalizedTitle.includes(term)) return score + 25;
    if (normalizedDetail.includes(term)) return score + 5;
    return score;
  }, 0);
}

function nodeDegrees(canvas: JSONCanvas): Map<string, number> {
  const degrees = new Map((canvas.nodes ?? []).map((node) => [node.id, 0]));
  for (const edge of canvas.edges ?? []) {
    if (degrees.has(edge.fromNode)) degrees.set(edge.fromNode, degrees.get(edge.fromNode)! + 1);
    if (degrees.has(edge.toNode)) degrees.set(edge.toNode, degrees.get(edge.toNode)! + 1);
  }
  return degrees;
}

function findDirectedCycle(
  nodeIds: ReadonlySet<string>,
  edges: readonly { fromNode: string; toNode: string }[],
): string[] {
  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    const next = adjacency.get(edge.fromNode) ?? [];
    next.push(edge.toNode);
    adjacency.set(edge.fromNode, next);
  }
  for (const next of adjacency.values()) next.sort(compareStrings);
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const stack: string[] = [];
  const walk = (nodeId: string): string[] => {
    if (visiting.has(nodeId)) {
      const index = stack.indexOf(nodeId);
      return [...stack.slice(index), nodeId];
    }
    if (visited.has(nodeId)) return [];
    visited.add(nodeId);
    visiting.add(nodeId);
    stack.push(nodeId);
    for (const next of adjacency.get(nodeId) ?? []) {
      const cycle = walk(next);
      if (cycle.length > 0) return cycle;
    }
    stack.pop();
    visiting.delete(nodeId);
    return [];
  };
  for (const nodeId of [...nodeIds].sort(compareStrings)) {
    const cycle = walk(nodeId);
    if (cycle.length > 0) return cycle;
  }
  return [];
}

function connectedComponents(
  nodeIds: ReadonlySet<string>,
  edges: readonly { fromNode: string; toNode: string }[],
): number {
  const adjacency = new Map<string, Set<string>>();
  for (const edge of edges) {
    (adjacency.get(edge.fromNode) ?? setAndStore(adjacency, edge.fromNode)).add(edge.toNode);
    (adjacency.get(edge.toNode) ?? setAndStore(adjacency, edge.toNode)).add(edge.fromNode);
  }
  const remaining = new Set(nodeIds);
  let components = 0;
  while (remaining.size > 0) {
    components += 1;
    const start = [...remaining].sort(compareStrings)[0]!;
    remaining.delete(start);
    const queue = [start];
    for (let index = 0; index < queue.length; index += 1) {
      for (const neighbor of adjacency.get(queue[index]!) ?? []) {
        if (!remaining.delete(neighbor)) continue;
        queue.push(neighbor);
      }
    }
  }
  return components;
}

function addNeighbor(
  adjacency: Map<string, Array<{ nodeId: string; edgeId: string }>>,
  from: string,
  to: string,
  edgeId: string,
): void {
  const entries = adjacency.get(from) ?? [];
  entries.push({ nodeId: to, edgeId });
  adjacency.set(from, entries);
}

function counts(values: readonly string[]): Map<string, number> {
  const result = new Map<string, number>();
  for (const value of values) result.set(value, (result.get(value) ?? 0) + 1);
  return result;
}

function setAndStore(map: Map<string, Set<string>>, key: string): Set<string> {
  const value = new Set<string>();
  map.set(key, value);
  return value;
}

function normalizeLimit(limit: number | undefined): number {
  if (limit === undefined) return DEFAULT_SEARCH_LIMIT;
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_SEARCH_LIMIT) {
    throw new Error(`Canvas search limit must be an integer from 1 to ${MAX_SEARCH_LIMIT}.`);
  }
  return limit;
}

function severityOrder(severity: CanvasArchitectureDiagnostic["severity"]): number {
  return severity === "error" ? 0 : severity === "warning" ? 1 : 2;
}

function compareEntries(left: readonly [string, number], right: readonly [string, number]): number {
  return compareStrings(left[0], right[0]);
}

function compareStrings(left: string, right: string): number {
  return left.localeCompare(right);
}
