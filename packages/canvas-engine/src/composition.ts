/**
 * Pure composition mutations: frames, alignment, distribution, z-order, and
 * lock handling over the authoritative JSON Canvas model.
 *
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-38] [FR-41]
 * @see docs/specs/229-app-workbench-canvas/design.md [DES-DATA]
 */
import type { CanvasMutation, CanvasNode, JSONCanvas } from "@afx/shared";

import { serializeJSONCanvas } from "./parse";
import { canvasContentRevision } from "./revision";

export const MAX_CANVAS_COMPOSITION_NODES = 10_000;
export const MAX_CANVAS_COMPOSITION_EDGES = 50_000;

export type CanvasAlignment = "left" | "center" | "right" | "top" | "middle" | "bottom";
export type CanvasDistributionAxis = "horizontal" | "vertical";
export type CanvasEqualizeDimension = "width" | "height" | "both";
export type CanvasZOrder = "front" | "back" | "forward" | "backward";
export type CanvasContainedNodeTransform = "preserve" | "scale";

export interface CanvasCompositionBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CanvasFrameDefinition {
  id: string;
  label?: string;
  padding?: number;
  color?: string;
  background?: string;
  backgroundStyle?: "cover" | "ratio" | "repeat";
  metadata?: Record<string, unknown>;
}

export interface CanvasAfxStylePatch {
  shape?: string | null;
  icon?: string | null;
  typography?: string | null;
  density?: string | null;
}

export interface CanvasAfxLayoutPatch {
  lane?: string | null;
}

export interface CanvasGroupPatch {
  label?: string | null;
  background?: string | null;
  backgroundStyle?: "cover" | "ratio" | "repeat" | null;
  collapsed?: boolean;
  presentationOrder?: number | null;
}

export interface CanvasNodeStylePatch {
  color?: string | null;
  afxStyle?: CanvasAfxStylePatch;
  afxLayout?: CanvasAfxLayoutPatch;
}

export interface CanvasNodeStyleSnapshot {
  color?: string;
  background?: string;
  backgroundStyle?: "cover" | "ratio" | "repeat";
  afxStyle?: Record<string, unknown>;
}

export type CanvasCompositionOperation =
  | { kind: "align"; alignment: CanvasAlignment; nodeIds: readonly string[] }
  | { kind: "distribute"; axis: CanvasDistributionAxis; nodeIds: readonly string[] }
  | {
      kind: "equalizeSize";
      dimension: CanvasEqualizeDimension;
      nodeIds: readonly string[];
      referenceNodeId?: string;
    }
  | { kind: "zOrder"; order: CanvasZOrder; nodeIds: readonly string[] }
  | { kind: "setLocked"; locked: boolean; nodeIds: readonly string[] }
  | { kind: "setPinned"; pinned: boolean; nodeIds: readonly string[] }
  | { kind: "createFrame"; nodeIds: readonly string[]; frame: CanvasFrameDefinition }
  | {
      kind: "transformFrame";
      frameId: string;
      bounds: CanvasCompositionBounds;
      containedNodes: CanvasContainedNodeTransform;
    }
  | { kind: "pasteStyle"; nodeIds: readonly string[]; style: CanvasNodeStyleSnapshot }
  | { kind: "patchStyle"; nodeIds: readonly string[]; patch: CanvasNodeStylePatch }
  | { kind: "patchGroup"; frameId: string; patch: CanvasGroupPatch };

export interface CanvasCompositionProposal {
  inputRevision: string;
  operation: CanvasCompositionOperation;
  document: JSONCanvas;
  changedNodeIds: string[];
  addedNodeIds: string[];
}

export interface CanvasGroupMembership {
  groupId: string;
  parentGroupId?: string;
  containedNodeIds: string[];
  directNodeIds: string[];
}

export type CanvasCompositionReplacement = Extract<CanvasMutation, { kind: "replaceDocument" }>;

export class CanvasCompositionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CanvasCompositionError";
  }
}

interface NormalizedSelection {
  ids: string[];
  nodes: CanvasNode[];
}

interface CompositionResult {
  nodes: CanvasNode[];
  changedNodeIds: string[];
  addedNodeIds?: string[];
}

const ALIGNMENTS = new Set<CanvasAlignment>(["left", "center", "right", "top", "middle", "bottom"]);
const DISTRIBUTION_AXES = new Set<CanvasDistributionAxis>(["horizontal", "vertical"]);
const EQUALIZE_DIMENSIONS = new Set<CanvasEqualizeDimension>(["width", "height", "both"]);
const Z_ORDERS = new Set<CanvasZOrder>(["front", "back", "forward", "backward"]);
const CONTAINED_TRANSFORMS = new Set<CanvasContainedNodeTransform>(["preserve", "scale"]);
const FRAME_BACKGROUND_STYLES = new Set(["cover", "ratio", "repeat"]);
const FRAME_METADATA_RESERVED_KEYS = new Set([
  "id",
  "type",
  "x",
  "y",
  "width",
  "height",
  "label",
  "color",
  "background",
  "backgroundStyle",
]);
const STYLE_PATCH_KEYS = ["shape", "icon", "typography", "density"] as const;
const LAYOUT_PATCH_KEYS = ["lane"] as const;

/**
 * Produce one immutable composition proposal. Applying the proposal is a single
 * replaceDocument mutation so host undo/history never observes partial edits.
 */
export function proposeCanvasComposition(
  canvas: JSONCanvas,
  operation: CanvasCompositionOperation,
): CanvasCompositionProposal {
  const nodes = canvas.nodes ?? [];
  validateCanvas(canvas);
  const inputRevision = revisionOf(canvas);
  const normalized = normalizeOperation(nodes, canvas, operation);
  const result = applyOperation(nodes, normalized);
  const document =
    canvas.nodes === undefined && result.nodes.length === 0
      ? { ...canvas }
      : { ...canvas, nodes: result.nodes };
  return {
    inputRevision,
    operation: normalized,
    document,
    changedNodeIds: [...result.changedNodeIds].sort(compareStrings),
    addedNodeIds: [...(result.addedNodeIds ?? [])].sort(compareStrings),
  };
}

/** Convert an accepted proposal into one stale-checked undo/history mutation. */
export function createCanvasCompositionReplacement(
  current: JSONCanvas,
  proposal: CanvasCompositionProposal,
): CanvasCompositionReplacement {
  if (revisionOf(current) !== proposal.inputRevision) {
    throw new CanvasCompositionError(
      "The Canvas changed after the composition proposal. Create a new proposal before applying it.",
    );
  }
  return { kind: "replaceDocument", document: proposal.document };
}

/** Capture only portable standard presentation plus inert AFX style metadata. */
export function copyCanvasNodeStyle(canvas: JSONCanvas, nodeId: string): CanvasNodeStyleSnapshot {
  validateCanvas(canvas);
  const node = findNode(canvas.nodes ?? [], nodeId, "Canvas style source");
  const snapshot: CanvasNodeStyleSnapshot = {};
  if (node.color !== undefined) snapshot.color = validateColor(node.color, "Canvas node color");
  const afxStyle = node["afxStyle"];
  if (afxStyle !== undefined) {
    if (!isRecord(afxStyle)) {
      throw new CanvasCompositionError("Canvas style source has malformed afxStyle metadata.");
    }
    snapshot.afxStyle = cloneRecord(afxStyle);
  }
  if (node.type === "group") {
    if (node.background !== undefined) snapshot.background = node.background;
    if (node.backgroundStyle !== undefined) snapshot.backgroundStyle = node.backgroundStyle;
  }
  return snapshot;
}

/**
 * Resolve transitive geometry membership plus each node's nearest direct group.
 * Equal-size overlapping groups use ID order to avoid cyclic parent identities.
 *
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-38] [NFR-6] [NFR-10]
 */
export function getCanvasGroupMembership(canvas: JSONCanvas): CanvasGroupMembership[] {
  validateCanvas(canvas);
  const nodes = canvas.nodes ?? [];
  const groups = nodes.filter((node) => node.type === "group").sort(compareNodeIds);
  if (groups.length === 0) return [];
  const parentByNodeId = new Map<string, string>();
  const groupRecords = groups.map((group) => ({
    group,
    area: group.width * group.height,
    containedNodeIds: [] as string[],
  }));
  for (const node of nodes) {
    const nodeArea = node.width * node.height;
    let nearest: (typeof groupRecords)[number] | undefined;
    for (const record of groupRecords) {
      const group = record.group;
      if (group.id === node.id || !containedBy(node, group)) continue;
      record.containedNodeIds.push(node.id);
      if (node.type === "group" && !(record.area > nodeArea || group.id < node.id)) {
        continue;
      }
      if (
        !nearest ||
        record.area < nearest.area ||
        (record.area === nearest.area && group.id < nearest.group.id)
      ) {
        nearest = record;
      }
    }
    if (nearest) parentByNodeId.set(node.id, nearest.group.id);
  }
  return groupRecords.map(({ group, containedNodeIds: unsortedContainedNodeIds }) => {
    const containedNodeIds = unsortedContainedNodeIds.sort(compareStrings);
    const directNodeIds = containedNodeIds
      .filter((id) => parentByNodeId.get(id) === group.id)
      .sort(compareStrings);
    const parentGroupId = parentByNodeId.get(group.id);
    return {
      groupId: group.id,
      ...(parentGroupId ? { parentGroupId } : {}),
      containedNodeIds,
      directNodeIds,
    };
  });
}

function normalizeOperation(
  nodes: readonly CanvasNode[],
  canvas: JSONCanvas,
  operation: CanvasCompositionOperation,
): CanvasCompositionOperation {
  if (!operation || typeof operation !== "object") {
    throw new CanvasCompositionError("Canvas composition requires an operation.");
  }
  switch (operation.kind) {
    case "align": {
      if (!ALIGNMENTS.has(operation.alignment)) {
        throw new CanvasCompositionError("Canvas alignment is unsupported.");
      }
      const selection = normalizeSelection(nodes, operation.nodeIds, 2, "Canvas alignment");
      assertUnlocked(groupGeometrySelection(nodes, selection.nodes), "Canvas alignment");
      return {
        kind: "align",
        alignment: operation.alignment,
        nodeIds: selection.ids,
      };
    }
    case "distribute": {
      if (!DISTRIBUTION_AXES.has(operation.axis)) {
        throw new CanvasCompositionError(
          "Canvas distribution axis must be horizontal or vertical.",
        );
      }
      const selection = normalizeSelection(nodes, operation.nodeIds, 3, "Canvas distribution");
      assertUnlocked(groupGeometrySelection(nodes, selection.nodes), "Canvas distribution");
      return {
        kind: "distribute",
        axis: operation.axis,
        nodeIds: selection.ids,
      };
    }
    case "equalizeSize": {
      if (!EQUALIZE_DIMENSIONS.has(operation.dimension)) {
        throw new CanvasCompositionError("Canvas equalize dimension is unsupported.");
      }
      const selection = normalizeSelection(nodes, operation.nodeIds, 2, "Canvas equalize size");
      const referenceNodeId =
        operation.referenceNodeId ??
        nodes.find((node) => selection.ids.includes(node.id))?.id ??
        selection.ids[0];
      if (!referenceNodeId || !selection.ids.includes(referenceNodeId)) {
        throw new CanvasCompositionError(
          "Canvas equalize reference node must belong to the selection.",
        );
      }
      return {
        kind: "equalizeSize",
        dimension: operation.dimension,
        nodeIds: selection.ids,
        referenceNodeId,
      };
    }
    case "zOrder": {
      if (!Z_ORDERS.has(operation.order)) {
        throw new CanvasCompositionError("Canvas z-order operation is unsupported.");
      }
      return {
        kind: "zOrder",
        order: operation.order,
        nodeIds: normalizeSelection(nodes, operation.nodeIds, 1, "Canvas z-order").ids,
      };
    }
    case "setLocked": {
      assertBoolean(operation.locked, "Canvas locked state");
      return {
        kind: "setLocked",
        locked: operation.locked,
        nodeIds: normalizeSelection(nodes, operation.nodeIds, 1, "Canvas lock", true).ids,
      };
    }
    case "setPinned": {
      assertBoolean(operation.pinned, "Canvas pinned state");
      return {
        kind: "setPinned",
        pinned: operation.pinned,
        nodeIds: normalizeSelection(nodes, operation.nodeIds, 1, "Canvas pin").ids,
      };
    }
    case "createFrame": {
      const selection = normalizeSelection(nodes, operation.nodeIds, 1, "Canvas frame");
      return {
        kind: "createFrame",
        nodeIds: selection.ids,
        frame: normalizeFrameDefinition(canvas, operation.frame),
      };
    }
    case "transformFrame": {
      const frame = findNode(nodes, operation.frameId, "Canvas frame");
      if (frame.type !== "group") {
        throw new CanvasCompositionError("Canvas frame transform requires a group node.");
      }
      assertUnlocked([frame], "Canvas frame transform");
      if (!CONTAINED_TRANSFORMS.has(operation.containedNodes)) {
        throw new CanvasCompositionError(
          "Canvas frame transform must preserve or scale contained nodes.",
        );
      }
      const bounds = normalizeBounds(operation.bounds, "Canvas frame transform");
      const descendants = nodes.filter((node) => node.id !== frame.id && containedBy(node, frame));
      assertUnlocked(descendants, "Canvas frame transform");
      return {
        kind: "transformFrame",
        frameId: frame.id,
        bounds,
        containedNodes: operation.containedNodes,
      };
    }
    case "pasteStyle": {
      const selection = normalizeSelection(nodes, operation.nodeIds, 1, "Canvas paste style");
      return {
        kind: "pasteStyle",
        nodeIds: selection.ids,
        style: normalizeStyleSnapshot(operation.style),
      };
    }
    case "patchStyle": {
      const selection = normalizeSelection(nodes, operation.nodeIds, 1, "Canvas style patch");
      return {
        kind: "patchStyle",
        nodeIds: selection.ids,
        patch: normalizeStylePatch(operation.patch),
      };
    }
    case "patchGroup": {
      const frame = findNode(nodes, operation.frameId, "Canvas group patch");
      if (frame.type !== "group") {
        throw new CanvasCompositionError("Canvas group patch requires a group node.");
      }
      assertUnlocked([frame], "Canvas group patch");
      return {
        kind: "patchGroup",
        frameId: frame.id,
        patch: normalizeGroupPatch(operation.patch),
      };
    }
    default:
      throw new CanvasCompositionError("Unsupported Canvas composition operation.");
  }
}

function applyOperation(
  nodes: readonly CanvasNode[],
  operation: CanvasCompositionOperation,
): CompositionResult {
  switch (operation.kind) {
    case "align":
      return alignNodes(nodes, operation.nodeIds, operation.alignment);
    case "distribute":
      return distributeNodes(nodes, operation.nodeIds, operation.axis);
    case "equalizeSize":
      return equalizeNodes(
        nodes,
        operation.nodeIds,
        operation.dimension,
        operation.referenceNodeId,
      );
    case "zOrder":
      return reorderNodes(nodes, operation.nodeIds, operation.order);
    case "setLocked":
      return patchLayoutFlag(nodes, operation.nodeIds, "locked", operation.locked);
    case "setPinned":
      return patchLayoutFlag(nodes, operation.nodeIds, "pinned", operation.pinned);
    case "createFrame":
      return createFrame(nodes, operation.nodeIds, operation.frame);
    case "transformFrame":
      return transformFrame(nodes, operation.frameId, operation.bounds, operation.containedNodes);
    case "pasteStyle":
      return pasteStyle(nodes, operation.nodeIds, operation.style);
    case "patchStyle":
      return patchStyle(nodes, operation.nodeIds, operation.patch);
    case "patchGroup":
      return patchGroup(nodes, operation.frameId, operation.patch);
    default:
      return assertNever(operation);
  }
}

function alignNodes(
  nodes: readonly CanvasNode[],
  nodeIds: readonly string[],
  alignment: CanvasAlignment,
): CompositionResult {
  const selected = selectByIds(nodes, nodeIds);
  const bounds = boundsOf(selected);
  const patches = new Map<string, Partial<CanvasNode>>();
  for (const node of selected) {
    if (alignment === "left") patches.set(node.id, { x: bounds.x });
    if (alignment === "center") {
      patches.set(node.id, { x: bounds.x + bounds.width / 2 - node.width / 2 });
    }
    if (alignment === "right") {
      patches.set(node.id, { x: bounds.x + bounds.width - node.width });
    }
    if (alignment === "top") patches.set(node.id, { y: bounds.y });
    if (alignment === "middle") {
      patches.set(node.id, { y: bounds.y + bounds.height / 2 - node.height / 2 });
    }
    if (alignment === "bottom") {
      patches.set(node.id, { y: bounds.y + bounds.height - node.height });
    }
  }
  return applyNodePatches(nodes, withGroupTranslations(nodes, patches, nodeIds));
}

function distributeNodes(
  nodes: readonly CanvasNode[],
  nodeIds: readonly string[],
  axis: CanvasDistributionAxis,
): CompositionResult {
  const selected = selectByIds(nodes, nodeIds).sort((left, right) =>
    axis === "horizontal"
      ? left.x - right.x || compareStrings(left.id, right.id)
      : left.y - right.y || compareStrings(left.id, right.id),
  );
  const patches = new Map<string, Partial<CanvasNode>>();
  if (axis === "horizontal") {
    const first = selected[0]!;
    const last = selected[selected.length - 1]!;
    const totalSize = selected.reduce((sum, node) => sum + node.width, 0);
    const gap = (last.x + last.width - first.x - totalSize) / (selected.length - 1);
    let cursor = first.x;
    for (const node of selected) {
      patches.set(node.id, { x: normalizeNumber(cursor) });
      cursor += node.width + gap;
    }
  } else {
    const first = selected[0]!;
    const last = selected[selected.length - 1]!;
    const totalSize = selected.reduce((sum, node) => sum + node.height, 0);
    const gap = (last.y + last.height - first.y - totalSize) / (selected.length - 1);
    let cursor = first.y;
    for (const node of selected) {
      patches.set(node.id, { y: normalizeNumber(cursor) });
      cursor += node.height + gap;
    }
  }
  return applyNodePatches(nodes, withGroupTranslations(nodes, patches, nodeIds));
}

function withGroupTranslations(
  nodes: readonly CanvasNode[],
  directPatches: ReadonlyMap<string, Partial<CanvasNode>>,
  selectedNodeIds: readonly string[],
): Map<string, Partial<CanvasNode>> {
  const patches = new Map(directPatches);
  const selected = new Set(selectedNodeIds);
  const translatedGroups = nodes
    .filter((node) => node.type === "group" && selected.has(node.id))
    .map((group) => {
      const patch = directPatches.get(group.id);
      return {
        group,
        dx: typeof patch?.x === "number" ? patch.x - group.x : 0,
        dy: typeof patch?.y === "number" ? patch.y - group.y : 0,
      };
    })
    .filter(({ dx, dy }) => dx !== 0 || dy !== 0);
  for (const node of nodes) {
    if (selected.has(node.id)) continue;
    const owner = translatedGroups
      .filter(({ group }) => containedBy(node, group))
      .sort(
        (left, right) =>
          left.group.width * left.group.height - right.group.width * right.group.height ||
          compareStrings(left.group.id, right.group.id),
      )[0];
    if (!owner) continue;
    patches.set(node.id, {
      x: normalizeNumber(node.x + owner.dx),
      y: normalizeNumber(node.y + owner.dy),
    });
  }
  return patches;
}

function equalizeNodes(
  nodes: readonly CanvasNode[],
  nodeIds: readonly string[],
  dimension: CanvasEqualizeDimension,
  referenceNodeId: string | undefined,
): CompositionResult {
  if (!referenceNodeId) {
    throw new CanvasCompositionError("Canvas equalize size requires a reference node.");
  }
  const reference = findNode(nodes, referenceNodeId, "Canvas equalize reference");
  const patches = new Map<string, Partial<CanvasNode>>();
  for (const node of selectByIds(nodes, nodeIds)) {
    patches.set(node.id, {
      ...(dimension === "width" || dimension === "both" ? { width: reference.width } : {}),
      ...(dimension === "height" || dimension === "both" ? { height: reference.height } : {}),
    });
  }
  return applyNodePatches(nodes, patches);
}

function reorderNodes(
  nodes: readonly CanvasNode[],
  nodeIds: readonly string[],
  order: CanvasZOrder,
): CompositionResult {
  const selected = new Set(nodeIds);
  let reordered = [...nodes];
  if (order === "front") {
    reordered = [
      ...reordered.filter((node) => !selected.has(node.id)),
      ...reordered.filter((node) => selected.has(node.id)),
    ];
  } else if (order === "back") {
    reordered = [
      ...reordered.filter((node) => selected.has(node.id)),
      ...reordered.filter((node) => !selected.has(node.id)),
    ];
  } else if (order === "forward") {
    for (let index = reordered.length - 2; index >= 0; index -= 1) {
      if (selected.has(reordered[index]!.id) && !selected.has(reordered[index + 1]!.id)) {
        const current = reordered[index]!;
        reordered[index] = reordered[index + 1]!;
        reordered[index + 1] = current;
      }
    }
  } else {
    for (let index = 1; index < reordered.length; index += 1) {
      if (selected.has(reordered[index]!.id) && !selected.has(reordered[index - 1]!.id)) {
        const current = reordered[index]!;
        reordered[index] = reordered[index - 1]!;
        reordered[index - 1] = current;
      }
    }
  }
  const oldIndexes = new Map(nodes.map((node, index) => [node.id, index]));
  const changedNodeIds = reordered
    .filter((node, index) => oldIndexes.get(node.id) !== index)
    .map((node) => node.id);
  return { nodes: reordered, changedNodeIds };
}

function patchLayoutFlag(
  nodes: readonly CanvasNode[],
  nodeIds: readonly string[],
  key: "locked" | "pinned",
  enabled: boolean,
): CompositionResult {
  const patches = new Map<string, Partial<CanvasNode>>();
  for (const node of selectByIds(nodes, nodeIds)) {
    const existing = metadataRecord(node, "afxLayout");
    const next = { ...existing };
    if (enabled) next[key] = true;
    else delete next[key];
    patches.set(
      node.id,
      Object.keys(next).length > 0 ? { afxLayout: next } : { afxLayout: undefined },
    );
  }
  return applyNodePatches(nodes, patches);
}

function createFrame(
  nodes: readonly CanvasNode[],
  nodeIds: readonly string[],
  frame: CanvasFrameDefinition,
): CompositionResult {
  const selected = selectByIds(nodes, nodeIds);
  const bounds = boundsOf(selected);
  const padding = frame.padding ?? 24;
  const metadata = frame.metadata ? cloneRecord(frame.metadata) : {};
  const group: CanvasNode = {
    ...metadata,
    id: frame.id,
    type: "group",
    ...(frame.label === undefined ? {} : { label: frame.label }),
    x: bounds.x - padding,
    y: bounds.y - padding,
    width: bounds.width + padding * 2,
    height: bounds.height + padding * 2,
    ...(frame.color === undefined ? {} : { color: frame.color }),
    ...(frame.background === undefined ? {} : { background: frame.background }),
    ...(frame.backgroundStyle === undefined ? {} : { backgroundStyle: frame.backgroundStyle }),
  };
  const selectedIds = new Set(nodeIds);
  const insertAt = nodes.findIndex((node) => selectedIds.has(node.id));
  const next = [...nodes];
  next.splice(Math.max(0, insertAt), 0, group);
  return { nodes: next, changedNodeIds: [], addedNodeIds: [group.id] };
}

function transformFrame(
  nodes: readonly CanvasNode[],
  frameId: string,
  bounds: CanvasCompositionBounds,
  containedNodes: CanvasContainedNodeTransform,
): CompositionResult {
  const frame = findNode(nodes, frameId, "Canvas frame");
  const descendants = nodes.filter((node) => node.id !== frame.id && containedBy(node, frame));
  const patches = new Map<string, Partial<CanvasNode>>([
    [frame.id, { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }],
  ]);
  const scaleX = bounds.width / frame.width;
  const scaleY = bounds.height / frame.height;
  for (const node of descendants) {
    const x =
      containedNodes === "scale"
        ? bounds.x + (node.x - frame.x) * scaleX
        : node.x + (bounds.x - frame.x);
    const y =
      containedNodes === "scale"
        ? bounds.y + (node.y - frame.y) * scaleY
        : node.y + (bounds.y - frame.y);
    patches.set(node.id, {
      x: normalizeNumber(x),
      y: normalizeNumber(y),
      ...(containedNodes === "scale"
        ? {
            width: normalizeNumber(node.width * scaleX),
            height: normalizeNumber(node.height * scaleY),
          }
        : {}),
    });
  }
  return applyNodePatches(nodes, patches);
}

function pasteStyle(
  nodes: readonly CanvasNode[],
  nodeIds: readonly string[],
  style: CanvasNodeStyleSnapshot,
): CompositionResult {
  const patches = new Map<string, Partial<CanvasNode>>();
  for (const node of selectByIds(nodes, nodeIds)) {
    const patch: Record<string, unknown> = {};
    patch["color"] = style.color;
    patch["afxStyle"] = style.afxStyle ? cloneRecord(style.afxStyle) : undefined;
    if (node.type === "group") {
      patch["background"] = style.background;
      patch["backgroundStyle"] = style.backgroundStyle;
    }
    patches.set(node.id, patch);
  }
  return applyNodePatches(nodes, patches);
}

function patchStyle(
  nodes: readonly CanvasNode[],
  nodeIds: readonly string[],
  patch: CanvasNodeStylePatch,
): CompositionResult {
  const patches = new Map<string, Partial<CanvasNode>>();
  for (const node of selectByIds(nodes, nodeIds)) {
    const nodePatch: Record<string, unknown> = {};
    if (patch.color !== undefined)
      nodePatch["color"] = patch.color === null ? undefined : patch.color;
    if (patch.afxStyle !== undefined) {
      const next = { ...metadataRecord(node, "afxStyle") };
      for (const key of STYLE_PATCH_KEYS) {
        const value = patch.afxStyle[key];
        if (value === undefined) continue;
        if (value === null) delete next[key];
        else next[key] = value;
      }
      nodePatch["afxStyle"] = Object.keys(next).length > 0 ? next : undefined;
    }
    if (patch.afxLayout !== undefined) {
      const next = { ...metadataRecord(node, "afxLayout") };
      for (const key of LAYOUT_PATCH_KEYS) {
        const value = patch.afxLayout[key];
        if (value === undefined) continue;
        if (value === null) delete next[key];
        else next[key] = value;
      }
      nodePatch["afxLayout"] = Object.keys(next).length > 0 ? next : undefined;
    }
    patches.set(node.id, nodePatch);
  }
  return applyNodePatches(nodes, patches);
}

function patchGroup(
  nodes: readonly CanvasNode[],
  frameId: string,
  patch: CanvasGroupPatch,
): CompositionResult {
  const frame = findNode(nodes, frameId, "Canvas group patch");
  if (frame.type !== "group") {
    throw new CanvasCompositionError("Canvas group patch requires a group node.");
  }
  const nodePatch: Record<string, unknown> = {};
  if (patch.label !== undefined)
    nodePatch["label"] = patch.label === null ? undefined : patch.label;
  if (patch.background !== undefined) {
    nodePatch["background"] = patch.background === null ? undefined : patch.background;
  }
  if (patch.backgroundStyle !== undefined) {
    nodePatch["backgroundStyle"] =
      patch.backgroundStyle === null ? undefined : patch.backgroundStyle;
  }
  if (patch.collapsed !== undefined || patch.presentationOrder !== undefined) {
    const next: Record<string, unknown> = { ...metadataRecord(frame, "afxGroup"), version: 1 };
    if (patch.collapsed !== undefined) {
      if (patch.collapsed) next["collapsed"] = true;
      else delete next["collapsed"];
    }
    if (patch.presentationOrder !== undefined) {
      if (patch.presentationOrder === null) delete next["presentationOrder"];
      else next["presentationOrder"] = patch.presentationOrder;
    }
    nodePatch["afxGroup"] = Object.keys(next).length > 1 ? next : undefined;
  }
  return applyNodePatches(nodes, new Map([[frameId, nodePatch]]));
}

function applyNodePatches(
  nodes: readonly CanvasNode[],
  patches: ReadonlyMap<string, Partial<CanvasNode>>,
): CompositionResult {
  const changedNodeIds: string[] = [];
  const next = nodes.map((node) => {
    const patch = patches.get(node.id);
    if (!patch) return node;
    const candidate = { ...node, ...patch } as CanvasNode;
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) delete candidate[key];
    }
    if (shallowNodeEqual(node, candidate)) return node;
    changedNodeIds.push(node.id);
    return candidate;
  });
  return { nodes: next, changedNodeIds };
}

function normalizeSelection(
  nodes: readonly CanvasNode[],
  nodeIds: readonly string[],
  minimum: number,
  owner: string,
  allowLocked = false,
): NormalizedSelection {
  const candidateIds: readonly unknown[] = nodeIds;
  if (!Array.isArray(candidateIds)) {
    throw new CanvasCompositionError(owner + " requires a node selection.");
  }
  if (candidateIds.length < minimum) {
    throw new CanvasCompositionError(owner + " requires at least " + minimum + " selected nodes.");
  }
  if (candidateIds.some((id) => typeof id !== "string" || id.length === 0)) {
    throw new CanvasCompositionError(owner + " requires non-empty node IDs.");
  }
  const ids = candidateIds.filter((id): id is string => typeof id === "string");
  if (new Set(ids).size !== ids.length) {
    throw new CanvasCompositionError(owner + " requires unique node IDs.");
  }
  ids.sort(compareStrings);
  const available = new Map(nodes.map((node) => [node.id, node]));
  const missing = ids.filter((id) => !available.has(id));
  if (missing.length > 0) {
    throw new CanvasCompositionError(owner + " contains unknown nodes: " + missing.join(", "));
  }
  const selected = ids.map((id) => available.get(id)!);
  if (!allowLocked) assertUnlocked(selected, owner);
  return { ids, nodes: selected };
}

function normalizeFrameDefinition(
  canvas: JSONCanvas,
  frame: CanvasFrameDefinition,
): CanvasFrameDefinition {
  if (!frame || typeof frame !== "object" || typeof frame.id !== "string" || !frame.id) {
    throw new CanvasCompositionError("Canvas frame requires a non-empty ID.");
  }
  if ([...(canvas.nodes ?? []), ...(canvas.edges ?? [])].some((item) => item.id === frame.id)) {
    throw new CanvasCompositionError("Canvas frame ID already exists: " + frame.id);
  }
  const padding = finiteRange(frame.padding ?? 24, "Canvas frame padding", 0, 100_000);
  if (frame.label !== undefined) validateText(frame.label, "Canvas frame label", 1_000, true);
  if (frame.color !== undefined) validateColor(frame.color, "Canvas frame color");
  if (frame.background !== undefined) {
    validateText(frame.background, "Canvas frame background", 10_000, true);
  }
  if (frame.backgroundStyle !== undefined && !FRAME_BACKGROUND_STYLES.has(frame.backgroundStyle)) {
    throw new CanvasCompositionError("Canvas frame backgroundStyle is unsupported.");
  }
  const metadata = frame.metadata ? normalizeFrameMetadata(frame.metadata) : undefined;
  return {
    id: frame.id,
    ...(frame.label === undefined ? {} : { label: frame.label }),
    padding,
    ...(frame.color === undefined ? {} : { color: frame.color }),
    ...(frame.background === undefined ? {} : { background: frame.background }),
    ...(frame.backgroundStyle === undefined ? {} : { backgroundStyle: frame.backgroundStyle }),
    ...(metadata ? { metadata } : {}),
  };
}

function normalizeFrameMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  if (!isRecord(metadata)) {
    throw new CanvasCompositionError("Canvas frame metadata must be an object.");
  }
  const reserved = Object.keys(metadata).filter((key) => FRAME_METADATA_RESERVED_KEYS.has(key));
  if (reserved.length > 0) {
    throw new CanvasCompositionError(
      "Canvas frame metadata cannot override reserved fields: " + reserved.sort().join(", "),
    );
  }
  return cloneRecord(metadata);
}

function normalizeStyleSnapshot(style: CanvasNodeStyleSnapshot): CanvasNodeStyleSnapshot {
  if (!isPlainObject(style)) {
    throw new CanvasCompositionError("Canvas pasted style must be an object.");
  }
  const allowed = new Set(["color", "background", "backgroundStyle", "afxStyle"]);
  const unknown = Object.keys(style).filter((key) => !allowed.has(key));
  if (unknown.length > 0) {
    throw new CanvasCompositionError("Canvas pasted style has unsupported fields.");
  }
  const normalized: CanvasNodeStyleSnapshot = {};
  if (style.color !== undefined)
    normalized.color = validateColor(style.color, "Canvas style color");
  if (style.background !== undefined) {
    normalized.background = validateText(style.background, "Canvas style background", 10_000, true);
  }
  if (style.backgroundStyle !== undefined) {
    if (!FRAME_BACKGROUND_STYLES.has(style.backgroundStyle)) {
      throw new CanvasCompositionError("Canvas style backgroundStyle is unsupported.");
    }
    normalized.backgroundStyle = style.backgroundStyle;
  }
  if (style.afxStyle !== undefined) {
    if (!isRecord(style.afxStyle)) {
      throw new CanvasCompositionError("Canvas pasted afxStyle must be an object.");
    }
    normalized.afxStyle = cloneRecord(style.afxStyle);
  }
  return normalized;
}

function normalizeStylePatch(patch: CanvasNodeStylePatch): CanvasNodeStylePatch {
  if (!isPlainObject(patch)) {
    throw new CanvasCompositionError("Canvas style patch must be an object.");
  }
  const unknown = Object.keys(patch).filter(
    (key) => key !== "color" && key !== "afxStyle" && key !== "afxLayout",
  );
  if (unknown.length > 0) {
    throw new CanvasCompositionError("Canvas style patch has unsupported fields.");
  }
  const normalized: CanvasNodeStylePatch = {};
  if (patch.color !== undefined) {
    normalized.color =
      patch.color === null ? null : validateColor(patch.color, "Canvas style patch color");
  }
  if (patch.afxStyle !== undefined) {
    if (!isPlainObject(patch.afxStyle)) {
      throw new CanvasCompositionError("Canvas afxStyle patch must be an object.");
    }
    const unknownStyle = Object.keys(patch.afxStyle).filter(
      (key) => !STYLE_PATCH_KEYS.includes(key as (typeof STYLE_PATCH_KEYS)[number]),
    );
    if (unknownStyle.length > 0) {
      throw new CanvasCompositionError("Canvas afxStyle patch has unsupported fields.");
    }
    const afxStyle: CanvasAfxStylePatch = {};
    for (const key of STYLE_PATCH_KEYS) {
      const value = patch.afxStyle[key];
      if (value === undefined || value === null) {
        if (value === null) afxStyle[key] = null;
        continue;
      }
      afxStyle[key] = validateText(value, "Canvas afxStyle " + key, 128);
    }
    normalized.afxStyle = afxStyle;
  }
  if (patch.afxLayout !== undefined) {
    if (!isPlainObject(patch.afxLayout)) {
      throw new CanvasCompositionError("Canvas afxLayout patch must be an object.");
    }
    const unknownLayout = Object.keys(patch.afxLayout).filter(
      (key) => !LAYOUT_PATCH_KEYS.includes(key as (typeof LAYOUT_PATCH_KEYS)[number]),
    );
    if (unknownLayout.length > 0) {
      throw new CanvasCompositionError("Canvas afxLayout patch has unsupported fields.");
    }
    const afxLayout: CanvasAfxLayoutPatch = {};
    const lane = patch.afxLayout.lane;
    if (lane === null) afxLayout.lane = null;
    else if (lane !== undefined) afxLayout.lane = validateText(lane, "Canvas lane", 64);
    normalized.afxLayout = afxLayout;
  }
  return normalized;
}

function normalizeGroupPatch(patch: CanvasGroupPatch): CanvasGroupPatch {
  if (!isPlainObject(patch)) {
    throw new CanvasCompositionError("Canvas group patch must be an object.");
  }
  const allowed = new Set([
    "label",
    "background",
    "backgroundStyle",
    "collapsed",
    "presentationOrder",
  ]);
  const unknown = Object.keys(patch).filter((key) => !allowed.has(key));
  if (unknown.length > 0) {
    throw new CanvasCompositionError("Canvas group patch has unsupported fields.");
  }
  const normalized: CanvasGroupPatch = {};
  if (patch.label !== undefined) {
    normalized.label =
      patch.label === null ? null : validateText(patch.label, "Canvas group label", 1_000, true);
  }
  if (patch.background !== undefined) {
    normalized.background =
      patch.background === null
        ? null
        : validateText(patch.background, "Canvas group background", 10_000, true);
  }
  if (patch.backgroundStyle !== undefined) {
    if (patch.backgroundStyle !== null && !FRAME_BACKGROUND_STYLES.has(patch.backgroundStyle)) {
      throw new CanvasCompositionError("Canvas group backgroundStyle is unsupported.");
    }
    normalized.backgroundStyle = patch.backgroundStyle;
  }
  if (patch.collapsed !== undefined) {
    assertBoolean(patch.collapsed, "Canvas group collapsed state");
    normalized.collapsed = patch.collapsed;
  }
  if (patch.presentationOrder !== undefined) {
    if (patch.presentationOrder === null) normalized.presentationOrder = null;
    else {
      if (
        typeof patch.presentationOrder !== "number" ||
        !Number.isInteger(patch.presentationOrder) ||
        patch.presentationOrder < 1 ||
        patch.presentationOrder > 10_000
      ) {
        throw new CanvasCompositionError(
          "Canvas presentation order must be an integer from 1 to 10000.",
        );
      }
      normalized.presentationOrder = patch.presentationOrder;
    }
  }
  return normalized;
}

function validateCanvas(canvas: JSONCanvas): void {
  const nodes = canvas.nodes ?? [];
  const edges = canvas.edges ?? [];
  if (nodes.length > MAX_CANVAS_COMPOSITION_NODES) {
    throw new CanvasCompositionError(
      "Canvas composition supports at most " +
        MAX_CANVAS_COMPOSITION_NODES.toLocaleString() +
        " nodes.",
    );
  }
  if (edges.length > MAX_CANVAS_COMPOSITION_EDGES) {
    throw new CanvasCompositionError(
      "Canvas composition supports at most " +
        MAX_CANVAS_COMPOSITION_EDGES.toLocaleString() +
        " edges.",
    );
  }
  const ids = new Set<string>();
  const nodeIds = new Set<string>();
  for (const node of nodes) {
    if (!node.id) throw new CanvasCompositionError("Canvas composition found an empty node ID.");
    if (ids.has(node.id)) {
      throw new CanvasCompositionError("Canvas composition found duplicate ID: " + node.id);
    }
    ids.add(node.id);
    nodeIds.add(node.id);
    normalizeBounds(node, "Canvas node " + node.id);
  }
  for (const edge of edges) {
    if (!edge.id) throw new CanvasCompositionError("Canvas composition found an empty edge ID.");
    if (ids.has(edge.id)) {
      throw new CanvasCompositionError("Canvas composition found duplicate ID: " + edge.id);
    }
    ids.add(edge.id);
    if (!nodeIds.has(edge.fromNode) || !nodeIds.has(edge.toNode)) {
      throw new CanvasCompositionError(
        "Canvas composition found dangling edge " +
          edge.id +
          ": " +
          edge.fromNode +
          " -> " +
          edge.toNode,
      );
    }
  }
}

function normalizeBounds(bounds: CanvasCompositionBounds, owner: string): CanvasCompositionBounds {
  if (
    !bounds ||
    ![bounds.x, bounds.y, bounds.width, bounds.height].every(
      (value) => typeof value === "number" && Number.isFinite(value),
    )
  ) {
    throw new CanvasCompositionError(owner + " requires finite x, y, width, and height.");
  }
  if (bounds.width <= 0) throw new CanvasCompositionError(owner + " width must be positive.");
  if (bounds.height <= 0) throw new CanvasCompositionError(owner + " height must be positive.");
  return {
    x: normalizeNumber(bounds.x),
    y: normalizeNumber(bounds.y),
    width: normalizeNumber(bounds.width),
    height: normalizeNumber(bounds.height),
  };
}

function boundsOf(nodes: readonly CanvasNode[]): CanvasCompositionBounds {
  const x = Math.min(...nodes.map((node) => node.x));
  const y = Math.min(...nodes.map((node) => node.y));
  const right = Math.max(...nodes.map((node) => node.x + node.width));
  const bottom = Math.max(...nodes.map((node) => node.y + node.height));
  return { x, y, width: right - x, height: bottom - y };
}

function containedBy(node: CanvasNode, group: CanvasNode): boolean {
  return (
    node.x >= group.x &&
    node.y >= group.y &&
    node.x + node.width <= group.x + group.width &&
    node.y + node.height <= group.y + group.height
  );
}

function selectByIds(nodes: readonly CanvasNode[], nodeIds: readonly string[]): CanvasNode[] {
  const selected = new Set(nodeIds);
  return nodes.filter((node) => selected.has(node.id));
}

function groupGeometrySelection(
  nodes: readonly CanvasNode[],
  selectedNodes: readonly CanvasNode[],
): CanvasNode[] {
  const selectedGroups = selectedNodes.filter((node) => node.type === "group");
  if (selectedGroups.length === 0) return [...selectedNodes];
  const included = new Set(selectedNodes.map((node) => node.id));
  for (const node of nodes) {
    if (selectedGroups.some((group) => containedBy(node, group))) included.add(node.id);
  }
  return nodes.filter((node) => included.has(node.id));
}

function assertUnlocked(nodes: readonly CanvasNode[], owner: string): void {
  const locked = nodes
    .filter(isLocked)
    .map((node) => node.id)
    .sort(compareStrings);
  if (locked.length > 0) {
    throw new CanvasCompositionError(owner + " contains locked nodes: " + locked.join(", "));
  }
}

function isLocked(node: CanvasNode): boolean {
  const metadata = node["afxLayout"];
  return isRecord(metadata) && metadata["locked"] === true;
}

function metadataRecord(node: CanvasNode, key: string): Record<string, unknown> {
  const value = node[key];
  if (value === undefined) return {};
  if (!isRecord(value)) {
    throw new CanvasCompositionError("Canvas node " + node.id + " has malformed " + key + ".");
  }
  return value;
}

function findNode(nodes: readonly CanvasNode[], nodeId: string, owner: string): CanvasNode {
  const node = nodes.find((candidate) => candidate.id === nodeId);
  if (!node) throw new CanvasCompositionError(owner + " was not found: " + nodeId);
  return node;
}

function validateColor(value: string, owner: string): string {
  if (
    typeof value !== "string" ||
    (!/^[1-6]$/.test(value) &&
      !/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(value))
  ) {
    throw new CanvasCompositionError(owner + " must be preset 1-6 or a hexadecimal color.");
  }
  return value;
}

function validateText(value: string, owner: string, maximum: number, allowEmpty = false): string {
  if (
    typeof value !== "string" ||
    (!allowEmpty && value.length === 0) ||
    value.length > maximum ||
    hasControlCharacters(value)
  ) {
    throw new CanvasCompositionError(owner + " must be bounded inert text.");
  }
  return value;
}

function hasControlCharacters(value: string): boolean {
  return [...value].some((character) => {
    const code = character.codePointAt(0) ?? 0;
    return code < 32 || code === 127;
  });
}

function finiteRange(value: number, owner: string, minimum: number, maximum: number): number {
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new CanvasCompositionError(
      owner + " must be a finite number between " + minimum + " and " + maximum + ".",
    );
  }
  return normalizeNumber(value);
}

function assertBoolean(value: boolean, owner: string): void {
  if (typeof value !== "boolean") {
    throw new CanvasCompositionError(owner + " must be a boolean.");
  }
}

function cloneRecord(value: Record<string, unknown>): Record<string, unknown> {
  try {
    return structuredClone(value);
  } catch {
    throw new CanvasCompositionError("Canvas composition metadata must be cloneable.");
  }
}

function revisionOf(canvas: JSONCanvas): string {
  try {
    return canvasContentRevision(serializeJSONCanvas(canvas));
  } catch {
    throw new CanvasCompositionError("Canvas composition input must be serializable.");
  }
}

function shallowNodeEqual(left: CanvasNode, right: CanvasNode): boolean {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every((key) => Object.is(left[key], right[key]));
}

function normalizeNumber(value: number): number {
  return Object.is(value, -0) ? 0 : value;
}

function compareNodeIds(left: CanvasNode, right: CanvasNode): number {
  return compareStrings(left.id, right.id);
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isPlainObject(value: unknown): boolean {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function assertNever(value: never): never {
  throw new CanvasCompositionError("Unsupported Canvas composition operation: " + String(value));
}
