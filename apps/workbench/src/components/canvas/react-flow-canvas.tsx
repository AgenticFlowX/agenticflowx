/**
 * Controlled React Flow projection for the authoritative JSON Canvas model.
 *
 * @see docs/specs/229-app-workbench-canvas/tasks.md [8.1] [8.2] [13.1]
 * @see docs/specs/229-app-workbench-canvas/design.md [DES-ARCH] [DES-CANVAS-INTERACTIONS]
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  Background,
  BackgroundVariant,
  type Connection,
  type Edge,
  type EdgeChange,
  MiniMap,
  type NodeChange,
  ReactFlow,
  type ReactFlowInstance,
  SelectionMode,
  type Viewport,
  applyEdgeChanges,
  applyNodeChanges,
  getNodesBounds,
  reconnectEdge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  ClipboardPaste,
  Copy,
  CopyPlus,
  Focus,
  Grid2x2,
  Grid3X3,
  Grip,
  Map as MapIcon,
  MessageSquare,
  MoreHorizontal,
  Palette,
  Redo2,
  Square,
  TextCursor,
  Trash2,
  Undo2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

import { type CanvasExportReferenceStatus, applyCanvasMutation } from "@afx/canvas-engine";
import type {
  CanvasActionMetadata,
  CanvasEdge,
  CanvasFileNode,
  CanvasNode,
  CanvasViewState,
  JSONCanvas,
} from "@afx/shared";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@afx/ui/components/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@afx/ui/components/tooltip";

import {
  type CanvasFlowNode,
  edgePatchFromFlow,
  mergeFlowGeometry,
  projectJSONCanvas,
} from "../../lib/json-canvas-react-flow";
import {
  CanvasArchitectureExplorer,
  type CanvasFocusRequest,
} from "./canvas-architecture-explorer";
import type { CanvasProfile } from "./canvas-command-registry";
import { CanvasCompositionControls } from "./canvas-composition-controls";
import { CanvasEdgeInspector } from "./canvas-edge-inspector";
import { CanvasExportControls, type CanvasExportRequest } from "./canvas-export-controls";
import { CanvasFlowEdge } from "./canvas-flow-edge";
import { CanvasLayoutControls } from "./canvas-layout-controls";
import { canvasNodeVisuals } from "./canvas-node-visuals";
import { CanvasPresentationControls } from "./canvas-presentation-controls";
import { CanvasFlowNode as CanvasFlowNodeRenderer } from "./nodes/canvas-flow-node";
import type { CanvasFlowNodeData, CanvasNodePreview } from "./nodes/canvas-flow-node";

export interface ReactFlowCanvasProps {
  canvas: JSONCanvas;
  documentKey: string;
  fileContents?: Readonly<Record<string, string>>;
  nodePreviews?: Readonly<Record<string, CanvasNodePreview>>;
  canRunCanvasActions?: boolean;
  viewState?: CanvasViewState;
  onViewStateChange?: (viewState: CanvasViewState) => void;
  onChange: (canvas: JSONCanvas, options?: { persist?: boolean }) => void;
  onNodeAction: (
    node: CanvasNode,
    action: "open" | "preview" | "loadPreview" | "chat" | "note" | "delete" | "expand",
  ) => void;
  onRunCanvasAction: (node: CanvasNode, action: CanvasActionMetadata) => void;
  onFileContentMount?: (node: CanvasFileNode) => void | (() => void);
  /** Per-node count of declared dependencies not yet loaded (badge; 230 FR-2). */
  expandableCountById?: Record<string, number>;
  profile?: CanvasProfile;
  documentLabel?: string;
  onExport?: (request: CanvasExportRequest) => void;
  commandRequest?: CanvasSurfaceCommandRequest;
  onSelectionAction?: (nodes: readonly CanvasNode[], action: "chat") => void;
  /** Returns true when a connect gesture is handled as relationship authoring. */
  onAuthorRelationship?: (source: CanvasNode, target: CanvasNode) => boolean;
  /** Returns true when deleting `edge` is handled as a frontmatter-removal offer. */
  onRemoveRelationship?: (edge: CanvasEdge) => boolean;
  /** True while a Spec Map dependency refresh is in flight — animates generated dependency edges (FR-47). */
  dependenciesRefreshing?: boolean;
}

export type CanvasSurfaceCommand =
  | "fit-view"
  | "search"
  | "undo"
  | "redo"
  | "auto-layout"
  | "composition"
  | "architecture-explorer"
  | "export"
  | "presentation"
  | "send-chat";

export interface CanvasSurfaceCommandRequest {
  id: number;
  command: CanvasSurfaceCommand;
}

const NODE_TYPES = { canvas: CanvasFlowNodeRenderer };
const EDGE_TYPES = { "canvas-edge": CanvasFlowEdge };
const VIEWPORT_STORAGE_PREFIX = "afx.canvas.viewport.v1:";
const CANVAS_TONE_STORAGE_KEY = "afx.canvas.tone.v1";
const CANVAS_BACKGROUND_STORAGE_KEY = "afx.canvas.background.v1";

type CanvasBackgroundPattern = "dots" | "grid" | "none";

const BACKGROUND_PATTERN_LABEL: Record<CanvasBackgroundPattern, string> = {
  dots: "Dots",
  grid: "Grid",
  none: "None",
};

const NEXT_BACKGROUND_PATTERN: Record<CanvasBackgroundPattern, CanvasBackgroundPattern> = {
  dots: "grid",
  grid: "none",
  none: "dots",
};

function readCanvasBackground(): CanvasBackgroundPattern {
  try {
    const stored = globalThis.localStorage?.getItem(CANVAS_BACKGROUND_STORAGE_KEY);
    return stored === "grid" || stored === "none" ? stored : "dots";
  } catch {
    return "dots";
  }
}

function readCanvasTone(): "theme" | "warm" {
  try {
    return globalThis.localStorage?.getItem(CANVAS_TONE_STORAGE_KEY) === "warm" ? "warm" : "theme";
  } catch {
    return "theme";
  }
}
const EMPTY_FILE_CONTENTS: Readonly<Record<string, string>> = {};
const EMPTY_NODE_PREVIEWS: Readonly<Record<string, CanvasNodePreview>> = {};
const CANVAS_MIN_ZOOM = 0.2;
const CANVAS_MAX_ZOOM = 3;
const CANVAS_WHEEL_ZOOM_SENSITIVITY = 0.0012;
const CANVAS_MAX_WHEEL_ZOOM_DELTA = 120;

/**
 * Provides lasso, touch/pointer graph movement, connection/reconnection,
 * resize, minimap, snap, clipboard, duplicate, undo/redo, and edge styling.
 */
export function ReactFlowCanvas({
  canvas,
  documentKey,
  fileContents = EMPTY_FILE_CONTENTS,
  nodePreviews = EMPTY_NODE_PREVIEWS,
  canRunCanvasActions = false,
  viewState,
  onViewStateChange,
  onChange,
  onNodeAction,
  expandableCountById,
  onRunCanvasAction,
  onFileContentMount,
  profile = "essentials",
  documentLabel = "canvas",
  onExport,
  commandRequest,
  onSelectionAction,
  onAuthorRelationship,
  onRemoveRelationship,
  dependenciesRefreshing = false,
}: ReactFlowCanvasProps) {
  const canvasRef = useRef(canvas);
  const surfaceRef = useRef<HTMLElement>(null);
  const past = useRef<JSONCanvas[]>([]);
  const future = useRef<JSONCanvas[]>([]);
  const geometryGesture = useRef<
    { baseline: JSONCanvas; timer?: ReturnType<typeof setTimeout> } | undefined
  >(undefined);
  const [flow, setFlow] = useState(() => projectJSONCanvas(canvas, fileContents));
  const flowRef = useRef(flow);
  const [instance, setInstance] = useState<ReactFlowInstance<CanvasFlowNode, Edge> | null>(null);
  const [snap, setSnap] = useState(true);
  /** Live viewport zoom percentage for the toolbar readout (FR-45). */
  const [zoomPct, setZoomPct] = useState(100);
  /** Surface tone: follow the VS Code theme, or the previewer's warm paper. */
  const [surfaceTone, setSurfaceTone] = useState<"theme" | "warm">(readCanvasTone);
  useEffect(() => {
    try {
      // Lazy write: the default tone stores nothing, so host-scoped editor
      // surfaces keep their no-localStorage guarantee untouched.
      if (surfaceTone === "theme") globalThis.localStorage?.removeItem(CANVAS_TONE_STORAGE_KEY);
      else globalThis.localStorage?.setItem(CANVAS_TONE_STORAGE_KEY, surfaceTone);
    } catch {
      // Storage unavailable — tone stays in-memory for this session.
    }
  }, [surfaceTone]);
  /** Background pattern: dotted, ruled grid, or a clean surface. */
  const [backgroundPattern, setBackgroundPattern] =
    useState<CanvasBackgroundPattern>(readCanvasBackground);
  useEffect(() => {
    try {
      // Lazy write, same localStorage guarantee as the tone preference.
      if (backgroundPattern === "dots") {
        globalThis.localStorage?.removeItem(CANVAS_BACKGROUND_STORAGE_KEY);
      } else {
        globalThis.localStorage?.setItem(CANVAS_BACKGROUND_STORAGE_KEY, backgroundPattern);
      }
    } catch {
      // Storage unavailable — pattern stays in-memory for this session.
    }
  }, [backgroundPattern]);
  /** Sticky toolbar toggle: node dragging off, text selection on (FR-45). */
  const [textSelect, setTextSelect] = useState(false);
  /** Transient variant of the same mode while Alt is held. */
  const [altSelect, setAltSelect] = useState(false);
  const selectionMode = textSelect || altSelect;

  useEffect(() => {
    const down = (event: KeyboardEvent): void => {
      if (event.key === "Alt") setAltSelect(true);
    };
    const clear = (event: KeyboardEvent | FocusEvent): void => {
      if (!("key" in event) || event.key === "Alt") setAltSelect(false);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", clear);
    window.addEventListener("blur", clear);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", clear);
      window.removeEventListener("blur", clear);
    };
  }, []);
  const largeGraph = (canvas.nodes?.length ?? 0) > 80;
  const [showMinimap, setShowMinimap] = useState(() => !isNarrowViewport() && !largeGraph);
  const minimapManuallySet = useRef(false);
  const lastCommandRequestId = useRef<number | undefined>(undefined);
  const [clipboard, setClipboard] = useState<{ nodes: CanvasNode[]; edges: CanvasEdge[] } | null>(
    null,
  );
  const [historyAvailability, setHistoryAvailability] = useState({ undo: false, redo: false });
  const [layoutPreview, setLayoutPreview] = useState<JSONCanvas>();
  const [topologyFocus, setTopologyFocus] = useState<CanvasFocusRequest>();
  const [architectureOpen, setArchitectureOpen] = useState(false);
  const [layoutOpen, setLayoutOpen] = useState(false);
  const [compositionOpen, setCompositionOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [presentationActive, setPresentationActive] = useState(false);
  const [presentationStartRequest, setPresentationStartRequest] = useState<number>();
  const [viewportBounds, setViewportBounds] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  }>();
  const initialSelectedIds = viewState?.selectedIds ?? [];
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<string[]>(() =>
    initialSelectedIds.filter((id) => (canvas.edges ?? []).some((edge) => edge.id === id)),
  );
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>(() =>
    initialSelectedIds.filter((id) => (canvas.nodes ?? []).some((node) => node.id === id)),
  );
  const selectedNodeIdSet = useMemo(() => new Set(selectedNodeIds), [selectedNodeIds]);
  const selectedEdgeIdSet = useMemo(() => new Set(selectedEdgeIds), [selectedEdgeIds]);
  const exportReferenceStatuses = useMemo(
    () => canvasExportReferenceStatuses(canvas, nodePreviews),
    [canvas, nodePreviews],
  );
  const previousDocumentKey = useRef(documentKey);
  const restoredViewport =
    viewState ?? (onViewStateChange ? undefined : readCanvasViewport(documentKey));
  const canvasColorMode = useVSCodeCanvasColorMode();
  const viewportRef = useRef<Viewport>(
    restoredViewport
      ? { x: restoredViewport.x, y: restoredViewport.y, zoom: restoredViewport.zoom }
      : { x: 0, y: 0, zoom: 1 },
  );

  /**
   * Signature of the last view state THIS surface published. The host echoes
   * every publish back as the next viewState prop — re-applying our own echo
   * mid-gesture snaps the viewport backwards (the "jumpy pan" defect).
   */
  const lastPublishedViewState = useRef<string>("");

  const publishViewState = useCallback(
    (nodeIds: string[], edgeIds: string[], viewport = viewportRef.current) => {
      const next = {
        x: viewport.x,
        y: viewport.y,
        zoom: viewport.zoom,
        selectedIds: [...nodeIds, ...edgeIds],
      };
      lastPublishedViewState.current = viewStateSignature(next);
      onViewStateChange?.(next);
    },
    [onViewStateChange],
  );

  const replaceFlow = useCallback((next: typeof flow) => {
    flowRef.current = next;
    setFlow(next);
  }, []);

  const syncHistoryAvailability = useCallback(() => {
    setHistoryAvailability({ undo: past.current.length > 0, redo: future.current.length > 0 });
  }, []);

  const flushGeometryHistory = useCallback(() => {
    const gesture = geometryGesture.current;
    if (!gesture) return;
    if (gesture.timer) clearTimeout(gesture.timer);
    geometryGesture.current = undefined;
    if (gesture.baseline === canvasRef.current) return;
    past.current.push(gesture.baseline);
    if (past.current.length > 100) past.current.shift();
    future.current = [];
    syncHistoryAvailability();
  }, [syncHistoryAvailability]);

  useEffect(
    () => () => {
      const gesture = geometryGesture.current;
      if (gesture?.timer) clearTimeout(gesture.timer);
    },
    [],
  );

  useEffect(() => {
    const media = globalThis.matchMedia?.("(max-width: 639px)");
    if (!media) return;
    const update = (event: MediaQueryListEvent | MediaQueryList) => {
      if (!minimapManuallySet.current) setShowMinimap(!event.matches && !largeGraph);
    };
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, [largeGraph]);

  useEffect(() => {
    if (largeGraph && !minimapManuallySet.current) setShowMinimap(false);
  }, [largeGraph]);

  const commit = useCallback(
    (next: JSONCanvas, recordHistory = true) => {
      if (next === canvasRef.current) return;
      setLayoutPreview(undefined);
      if (recordHistory) {
        flushGeometryHistory();
        past.current.push(canvasRef.current);
        if (past.current.length > 100) past.current.shift();
        future.current = [];
      }
      canvasRef.current = next;
      replaceFlow(projectJSONCanvas(next, fileContents));
      syncHistoryAvailability();
      onChange(next);
    },
    [fileContents, flushGeometryHistory, onChange, replaceFlow, syncHistoryAvailability],
  );

  const commitGeometry = useCallback(
    (next: JSONCanvas, complete: boolean) => {
      if (next === canvasRef.current) {
        if (complete && geometryGesture.current?.baseline !== canvasRef.current) {
          onChange(canvasRef.current, { persist: true });
          flushGeometryHistory();
        }
        return;
      }
      const gesture = geometryGesture.current ?? { baseline: canvasRef.current };
      if (gesture.timer) clearTimeout(gesture.timer);
      geometryGesture.current = gesture;
      canvasRef.current = next;
      onChange(next, { persist: complete });
      if (complete) {
        flushGeometryHistory();
        return;
      }
      geometryGesture.current = {
        baseline: gesture.baseline,
        timer: setTimeout(flushGeometryHistory, 140),
      };
    },
    [flushGeometryHistory, onChange],
  );

  const updateNode = useCallback(
    (nodeId: string, patch: Partial<CanvasNode>) => {
      commit(applyCanvasMutation(canvasRef.current, { kind: "updateNode", nodeId, patch }));
    },
    [commit],
  );

  const actionNode = useCallback(
    (
      nodeId: string,
      action: "open" | "preview" | "loadPreview" | "chat" | "note" | "delete" | "expand",
    ) => {
      const node = (canvasRef.current.nodes ?? []).find((candidate) => candidate.id === nodeId);
      if (!node) return;
      if (action === "delete") {
        commit(applyCanvasMutation(canvasRef.current, { kind: "removeNodes", nodeIds: [nodeId] }));
        return;
      }
      onNodeAction(node, action);
    },
    [commit, onNodeAction],
  );

  const runCanvasAction = useCallback(
    (nodeId: string, action: CanvasActionMetadata) => {
      const node = (canvasRef.current.nodes ?? []).find((candidate) => candidate.id === nodeId);
      if (node) onRunCanvasAction(node, action);
    },
    [onRunCanvasAction],
  );

  useEffect(() => {
    const changedDocument = previousDocumentKey.current !== documentKey;
    const replacedSameDocument = !changedDocument && canvasRef.current !== canvas;
    previousDocumentKey.current = documentKey;
    if (changedDocument) {
      const gesture = geometryGesture.current;
      if (gesture?.timer) clearTimeout(gesture.timer);
      geometryGesture.current = undefined;
      past.current = [];
      future.current = [];
      setSelectedNodeIds([]);
      setSelectedEdgeIds([]);
      setTopologyFocus(undefined);
      setLayoutPreview(undefined);
      setArchitectureOpen(false);
      setLayoutOpen(false);
      setCompositionOpen(false);
      setExportOpen(false);
      setPresentationActive(false);
      setHistoryAvailability({ undo: false, redo: false });
    } else if (replacedSameDocument) {
      // Same document replaced from outside the flow surface (parent mutation,
      // Sync specs, starter, external edit): record the previous snapshot as an
      // undoable step instead of wiping local history (FR-50).
      const gesture = geometryGesture.current;
      if (gesture?.timer) clearTimeout(gesture.timer);
      geometryGesture.current = undefined;
      if (gesture && gesture.baseline !== canvasRef.current) past.current.push(gesture.baseline);
      past.current.push(canvasRef.current);
      while (past.current.length > 100) past.current.shift();
      future.current = [];
      const nodeIds = new Set((canvas.nodes ?? []).map((node) => node.id));
      const edgeIds = new Set((canvas.edges ?? []).map((edge) => edge.id));
      setSelectedNodeIds((current) => current.filter((id) => nodeIds.has(id)));
      setSelectedEdgeIds((current) => current.filter((id) => edgeIds.has(id)));
      setLayoutPreview(undefined);
      setHistoryAvailability({ undo: true, redo: false });
    }
    canvasRef.current = canvas;
  }, [canvas, documentKey]);

  useEffect(() => {
    // Preview payloads can arrive during a drag. Reproject the live mutable
    // geometry rather than the intentionally stale controlled canvas prop.
    replaceFlow(projectJSONCanvas(canvasRef.current, fileContents));
  }, [canvas, fileContents, replaceFlow]);

  useEffect(() => {
    if (!viewState) return;
    // Our own echo: local state is already at (or ahead of) this snapshot.
    if (viewStateSignature(viewState) === lastPublishedViewState.current) return;
    const selectedIds = new Set(viewState.selectedIds ?? []);
    const nodes = (canvas.nodes ?? []).map((node) => node.id).filter((id) => selectedIds.has(id));
    const edges = (canvas.edges ?? []).map((edge) => edge.id).filter((id) => selectedIds.has(id));
    viewportRef.current = { x: viewState.x, y: viewState.y, zoom: viewState.zoom };
    // Host snapshots are the authoritative external state for this custom-editor client.

    setSelectedNodeIds(nodes);
    setSelectedEdgeIds(edges);
    if (instance) void instance.setViewport(viewportRef.current, { duration: 0 });
  }, [canvas.edges, canvas.nodes, instance, viewState]);

  useEffect(() => {
    if (!instance) return;
    if (viewState && viewStateSignature(viewState) === lastPublishedViewState.current) return;
    const viewport = viewState ?? (onViewStateChange ? undefined : readCanvasViewport(documentKey));
    if (viewport) {
      viewportRef.current = { x: viewport.x, y: viewport.y, zoom: viewport.zoom };
      void instance.setViewport(viewportRef.current, { duration: 0 });
    } else {
      void instance.fitView({ padding: 0.2, duration: 0 });
    }
  }, [documentKey, instance, onViewStateChange, viewState]);

  const updateViewportBounds = useCallback(() => {
    const element = surfaceRef.current;
    if (!instance || !element || typeof instance.screenToFlowPosition !== "function") return;
    const bounds = element.getBoundingClientRect();
    const topLeft = instance.screenToFlowPosition({ x: bounds.left, y: bounds.top });
    const bottomRight = instance.screenToFlowPosition({ x: bounds.right, y: bounds.bottom });
    setViewportBounds({
      x: Math.min(topLeft.x, bottomRight.x),
      y: Math.min(topLeft.y, bottomRight.y),
      width: Math.abs(bottomRight.x - topLeft.x),
      height: Math.abs(bottomRight.y - topLeft.y),
    });
  }, [instance]);

  useEffect(() => {
    updateViewportBounds();
    const element = surfaceRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(updateViewportBounds);
    observer.observe(element);
    return () => observer.disconnect();
  }, [updateViewportBounds]);

  const handleNodesChange = useCallback(
    (changes: NodeChange<CanvasFlowNode>[]) => {
      const selectedChanges = changes.filter((change) => change.type === "select");
      if (selectedChanges.length > 0) {
        setSelectedNodeIds((current) => {
          const next = new Set(current);
          for (const change of selectedChanges) {
            if (change.selected) next.add(change.id);
            else next.delete(change.id);
          }
          const nextIds = [...next];
          publishViewState(nextIds, selectedEdgeIds);
          return nextIds;
        });
      }
      const current = flowRef.current;
      const flowChanges = changes.filter((change) => change.type !== "select");
      if (flowChanges.length === 0) return;
      const nodes = applyNodeChanges(flowChanges, current.nodes);
      const removedIds = changes
        .filter(
          (change): change is Extract<NodeChange<CanvasFlowNode>, { type: "remove" }> =>
            change.type === "remove",
        )
        .map((change) => change.id);
      const geometryChanges = changes.filter(
        (change) => change.type === "position" || change.type === "dimensions",
      );
      const persistentGeometryChanges = geometryChanges.filter(
        (change) => change.type !== "dimensions" || change.resizing !== undefined,
      );
      const otherStructural = changes.some(
        (change) =>
          change.type !== "select" && change.type !== "position" && change.type !== "dimensions",
      );
      const structural = persistentGeometryChanges.length > 0 || otherStructural;
      if (structural) {
        let next = mergeFlowGeometry(canvasRef.current, nodes);
        if (removedIds.length > 0) {
          next = applyCanvasMutation(next, { kind: "removeNodes", nodeIds: removedIds });
        }
        const gestureComplete = persistentGeometryChanges.some(
          (change) =>
            (change.type === "position" && change.dragging === false) ||
            (change.type === "dimensions" && change.resizing === false),
        );
        if (sameCanvasGeometry(canvasRef.current, next) && removedIds.length === 0) {
          replaceFlow({ ...current, nodes });
          if (!otherStructural && gestureComplete) commitGeometry(canvasRef.current, true);
          return;
        }
        if (otherStructural) {
          commit(next);
          return;
        } else {
          const gestureActive = persistentGeometryChanges.some(
            (change) =>
              (change.type === "position" && change.dragging === true) ||
              (change.type === "dimensions" && change.resizing === true),
          );
          commitGeometry(next, gestureComplete || !gestureActive);
        }
      }
      replaceFlow({ ...current, nodes });
    },
    [commit, commitGeometry, publishViewState, replaceFlow, selectedEdgeIds],
  );

  const handleEdgesChange = useCallback(
    (changes: EdgeChange<Edge>[]) => {
      const selectChanges = changes.filter((change) => change.type === "select");
      if (selectChanges.length > 0) {
        setSelectedEdgeIds((current) => {
          const next = new Set(current);
          for (const change of selectChanges) {
            if (change.selected) next.add(change.id);
            else next.delete(change.id);
          }
          const nextIds = [...next];
          publishViewState(selectedNodeIds, nextIds);
          return nextIds;
        });
      }
      const current = flowRef.current;
      const flowChanges = changes.filter((change) => change.type !== "select");
      if (flowChanges.length === 0) return;
      const edges = applyEdgeChanges(flowChanges, current.edges);
      const removedIds = changes
        .filter(
          (change): change is Extract<EdgeChange<Edge>, { type: "remove" }> =>
            change.type === "remove",
        )
        .map((change) => change.id);
      if (removedIds.length > 0) {
        commit(
          applyCanvasMutation(canvasRef.current, { kind: "removeEdges", edgeIds: removedIds }),
        );
        return;
      }
      replaceFlow({ ...current, edges });
    },
    [commit, publishViewState, replaceFlow, selectedNodeIds],
  );

  const connect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target || connection.source === connection.target)
        return;
      // Drawing between two authoring-eligible afx documents authors a typed
      // relationship into frontmatter instead of a plain edge (230 FR-4). The
      // handler returns true when it takes the authoring path; a journal or
      // non-afx endpoint (FR-7/FR-13) returns false and falls through to a
      // free-form manual edge.
      if (onAuthorRelationship) {
        const nodes = canvasRef.current.nodes ?? [];
        const sourceNode = nodes.find((node) => node.id === connection.source);
        const targetNode = nodes.find((node) => node.id === connection.target);
        if (sourceNode && targetNode && onAuthorRelationship(sourceNode, targetNode)) return;
      }
      const edge: CanvasEdge = {
        id: uniqueId("e"),
        fromNode: connection.source,
        toNode: connection.target,
        fromSide: handleSide(connection.sourceHandle),
        toSide: handleSide(connection.targetHandle),
        toEnd: "arrow",
        afxStyle: { version: 1, route: "bezier", stroke: "solid" },
      };
      commit(applyCanvasMutation(canvasRef.current, { kind: "addEdge", edge }));
    },
    [commit, onAuthorRelationship],
  );

  const reconnect = useCallback(
    (oldEdge: Edge, connection: Connection) => {
      const nextEdges = reconnectEdge(oldEdge, connection, flowRef.current.edges);
      replaceFlow({ ...flowRef.current, edges: nextEdges });
      commit(
        applyCanvasMutation(canvasRef.current, {
          kind: "updateEdge",
          edgeId: oldEdge.id,
          patch: edgePatchFromFlow(nextEdges.find((edge) => edge.id === oldEdge.id) ?? oldEdge),
        }),
      );
    },
    [commit, replaceFlow],
  );

  const undo = useCallback(() => {
    flushGeometryHistory();
    const previous = past.current.pop();
    if (!previous) return;
    future.current.push(canvasRef.current);
    commit(previous, false);
    syncHistoryAvailability();
  }, [commit, flushGeometryHistory, syncHistoryAvailability]);

  const redo = useCallback(() => {
    flushGeometryHistory();
    const next = future.current.pop();
    if (!next) return;
    past.current.push(canvasRef.current);
    commit(next, false);
    syncHistoryAvailability();
  }, [commit, flushGeometryHistory, syncHistoryAvailability]);

  const copySelection = useCallback(() => {
    const selected = new Set(selectedNodeIds);
    const nodes = (canvasRef.current.nodes ?? []).filter((node) => selected.has(node.id));
    const edges = (canvasRef.current.edges ?? []).filter(
      (edge) => selected.has(edge.fromNode) && selected.has(edge.toNode),
    );
    if (nodes.length > 0) setClipboard({ nodes, edges });
  }, [selectedNodeIds]);

  const duplicateGraph = useCallback(
    (source: { nodes: readonly CanvasNode[]; edges: readonly CanvasEdge[] }) => {
      if (source.nodes.length === 0) return;
      const ids = new Map<string, string>();
      for (const node of source.nodes) ids.set(node.id, uniqueId("n"));
      const nodes = source.nodes.map((node) => ({
        ...node,
        id: ids.get(node.id)!,
        x: node.x + 36,
        y: node.y + 36,
      }));
      const edges = source.edges.map((edge) => ({
        ...edge,
        id: uniqueId("e"),
        fromNode: ids.get(edge.fromNode)!,
        toNode: ids.get(edge.toNode)!,
      }));
      commit({
        ...canvasRef.current,
        nodes: [...(canvasRef.current.nodes ?? []), ...nodes],
        edges: [...(canvasRef.current.edges ?? []), ...edges],
      });
      setSelectedNodeIds(nodes.map((node) => node.id));
    },
    [commit],
  );

  const pasteSelection = useCallback(() => {
    if (!clipboard) return;
    duplicateGraph(clipboard);
  }, [clipboard, duplicateGraph]);

  const duplicateSelection = useCallback(() => {
    const selected = new Set(selectedNodeIds);
    const nodes = (canvasRef.current.nodes ?? []).filter((node) => selected.has(node.id));
    const edges = (canvasRef.current.edges ?? []).filter(
      (edge) => selected.has(edge.fromNode) && selected.has(edge.toNode),
    );
    duplicateGraph({ nodes, edges });
  }, [duplicateGraph, selectedNodeIds]);

  const projectedPreview = useMemo(
    () => (layoutPreview ? projectJSONCanvas(layoutPreview, fileContents) : undefined),
    [fileContents, layoutPreview],
  );
  const renderedFlow = projectedPreview ?? flow;
  const topologyNodeIds = useMemo(
    () => (topologyFocus?.isolate ? new Set(topologyFocus.nodeIds) : undefined),
    [topologyFocus],
  );
  const topologyEdgeIds = useMemo(
    () => (topologyFocus?.isolate ? new Set(topologyFocus.edgeIds) : undefined),
    [topologyFocus],
  );
  const renderedNodes = useMemo(
    () =>
      topologyNodeIds
        ? renderedFlow.nodes.filter((node) => topologyNodeIds.has(node.id))
        : renderedFlow.nodes,
    [renderedFlow.nodes, topologyNodeIds],
  );
  const renderedEdges = useMemo(
    () =>
      topologyEdgeIds
        ? renderedFlow.edges.filter((edge) => topologyEdgeIds.has(edge.id))
        : renderedFlow.edges,
    [renderedFlow.edges, topologyEdgeIds],
  );
  const decoratedNodes = useMemo(
    () =>
      renderedNodes.map((node) => {
        const preview = nodePreviews[node.id];
        const selected = selectedNodeIdSet.has(node.id);
        return {
          ...node,
          // Per-node draggable overrides the instance-level nodesDraggable,
          // so selection mode must be honored here too (FR-45).
          draggable: !canvasNodeVisuals(node.data.canvasNode).locked && !selectionMode,
          data: {
            ...node.data,
            preview,
            canRunCanvasActions: canRunCanvasActions && profile === "afx",
            showCanvasActions: profile === "afx",
            expandableCount: expandableCountById?.[node.id] ?? 0,
            onUpdate: updateNode,
            onAction: actionNode,
            onRunCanvasAction: runCanvasAction,
            onFileContentMount,
          } satisfies CanvasFlowNodeData,
          selected,
        } satisfies CanvasFlowNode;
      }),
    [
      actionNode,
      canRunCanvasActions,
      expandableCountById,
      nodePreviews,
      onFileContentMount,
      profile,
      renderedNodes,
      runCanvasAction,
      selectedNodeIdSet,
      selectionMode,
      updateNode,
    ],
  );
  const decoratedEdges = useMemo(
    () =>
      renderedEdges.map((edge) => {
        const provenance = (edge.data as { canvasEdge?: CanvasEdge } | undefined)?.canvasEdge
          ?.afxProvenance;
        const live =
          dependenciesRefreshing &&
          provenance?.kind === "declared-dependency" &&
          provenance.detached !== true;
        return {
          ...edge,
          selected: selectedEdgeIdSet.has(edge.id),
          ...(live ? { data: { ...edge.data, live: "refreshing" } } : {}),
        };
      }),
    [dependenciesRefreshing, renderedEdges, selectedEdgeIdSet],
  );

  const focusArchitecture = useCallback(
    (request: CanvasFocusRequest) => {
      setTopologyFocus(request);
      setSelectedNodeIds(request.nodeIds);
      setSelectedEdgeIds(request.edgeIds);
      publishViewState(request.nodeIds, request.edgeIds);
      const nodes = flowRef.current.nodes.filter((node) => request.nodeIds.includes(node.id));
      if (nodes.length > 0) {
        void instance?.fitView({
          nodes,
          padding: 0.25,
          duration: prefersReducedMotion() ? 0 : 180,
        });
      }
    },
    [instance, publishViewState],
  );

  const clearArchitectureFocus = useCallback(() => {
    setTopologyFocus(undefined);
    void instance?.fitView({ padding: 0.2, duration: prefersReducedMotion() ? 0 : 180 });
  }, [instance]);

  const fitSelectionOrCanvas = useCallback(() => {
    if (!instance) return;
    const surface = surfaceRef.current;
    const visible = flowRef.current.nodes.filter((node) => !node.hidden);
    const target =
      selectedNodeIds.length > 0
        ? visible.filter((node) => selectedNodeIdSet.has(node.id))
        : visible;
    const bounds = target.length > 0 ? getNodesBounds(target) : undefined;
    // Deterministic fit: frame from the nodes' own geometry and set the viewport
    // directly, so a just-added (not-yet-measured) node can't skew the centering.
    // Falls back to React Flow's fitView when geometry is unavailable.
    if (!surface || !bounds || bounds.width === 0 || bounds.height === 0) {
      void instance.fitView({
        padding: 0.2,
        maxZoom: 1,
        duration: prefersReducedMotion() ? 0 : 180,
      });
      return;
    }
    const rect = surface.getBoundingClientRect();
    const pad = 0.85; // leave a 15% margin around the framed content
    const zoom = Math.min(
      1, // never magnify past 1:1 — a sparse canvas stays readable
      (rect.width * pad) / bounds.width,
      (rect.height * pad) / bounds.height,
    );
    void instance.setViewport(
      {
        x: rect.width / 2 - (bounds.x + bounds.width / 2) * zoom,
        y: rect.height / 2 - (bounds.y + bounds.height / 2) * zoom,
        zoom,
      },
      { duration: prefersReducedMotion() ? 0 : 180 },
    );
  }, [instance, selectedNodeIdSet, selectedNodeIds.length]);

  /** Remove every selected node and edge through the standard change pipeline (FR-45). */
  const deleteSelection = useCallback(() => {
    // Deleting exactly one generated relationship edge offers frontmatter
    // removal vs detach-only (230 FR-6); the handler returns true when it takes
    // over, so the default removal is suppressed until the user chooses.
    if (onRemoveRelationship && selectedEdgeIds.length === 1 && selectedNodeIds.length === 0) {
      const edge = (canvasRef.current.edges ?? []).find((item) => item.id === selectedEdgeIds[0]);
      const provenance = edge?.afxProvenance;
      if (
        edge &&
        provenance &&
        provenance.detached !== true &&
        (provenance.kind === "declared-dependency" ||
          provenance.kind === "declared-relationship") &&
        onRemoveRelationship(edge)
      ) {
        return;
      }
    }
    if (selectedEdgeIds.length > 0) {
      handleEdgesChange(selectedEdgeIds.map((id) => ({ type: "remove" as const, id })));
    }
    if (selectedNodeIds.length > 0) {
      handleNodesChange(selectedNodeIds.map((id) => ({ type: "remove" as const, id })));
    }
  }, [
    handleEdgesChange,
    handleNodesChange,
    onRemoveRelationship,
    selectedEdgeIds,
    selectedNodeIds,
  ]);

  const clearSelection = useCallback(() => {
    if (selectedNodeIds.length > 0) {
      handleNodesChange(
        selectedNodeIds.map((id) => ({ type: "select" as const, id, selected: false })),
      );
    }
    if (selectedEdgeIds.length > 0) {
      handleEdgesChange(
        selectedEdgeIds.map((id) => ({ type: "select" as const, id, selected: false })),
      );
    }
  }, [handleEdgesChange, handleNodesChange, selectedEdgeIds, selectedNodeIds]);

  const zoomStep = useCallback(
    (direction: 1 | -1) => {
      if (!instance) return;
      const options = { duration: prefersReducedMotion() ? 0 : 120 };
      if (direction > 0) void instance.zoomIn?.(options);
      else void instance.zoomOut?.(options);
    },
    [instance],
  );

  const resetZoom = useCallback(() => {
    if (!instance) return;
    void instance.zoomTo?.(1, { duration: prefersReducedMotion() ? 0 : 120 });
    setZoomPct(100);
  }, [instance]);

  /**
   * Timestamp of the last modifier-wheel tick. Inside a burst the accumulated
   * viewportRef is authoritative — polling instance.getViewport() mid-gesture
   * reads half-applied values and makes successive steps fight each other.
   */
  const lastModifierWheelAt = useRef(0);
  const viewportPersistTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const handleModifierWheel = useCallback(
    (event: WheelEvent) => {
      // Modifier zoom must win everywhere on the surface — including over
      // scrollable node bodies (nowheel only reserves *plain* wheel scrolling).
      if ((!event.metaKey && !event.ctrlKey) || !instance) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const bounds = surfaceRef.current?.getBoundingClientRect();
      if (!bounds) return;
      const now = performance.now();
      const inBurst = now - lastModifierWheelAt.current < 200;
      lastModifierWheelAt.current = now;
      const current = inBurst ? viewportRef.current : instance.getViewport();
      const normalizedDelta =
        event.deltaMode === 1
          ? event.deltaY * 20
          : event.deltaMode === 2
            ? event.deltaY * 600
            : event.deltaY;
      const boundedDelta = clamp(
        normalizedDelta,
        -CANVAS_MAX_WHEEL_ZOOM_DELTA,
        CANVAS_MAX_WHEEL_ZOOM_DELTA,
      );
      const nextZoom = clamp(
        current.zoom * Math.exp(-boundedDelta * CANVAS_WHEEL_ZOOM_SENSITIVITY),
        CANVAS_MIN_ZOOM,
        CANVAS_MAX_ZOOM,
      );
      if (Math.abs(nextZoom - current.zoom) < 0.0001) return;

      const origin = {
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      };
      const scale = nextZoom / current.zoom;
      const nextViewport = {
        x: origin.x - (origin.x - current.x) * scale,
        y: origin.y - (origin.y - current.y) * scale,
        zoom: nextZoom,
      };
      viewportRef.current = nextViewport;
      // Apply immediately: at wheel-event rate the exponential steps ARE the
      // smoothing — starting a fresh animation per tick from a moving baseline
      // is what made the canvas visibly jump.
      void instance.setViewport(nextViewport, { duration: 0 });
      setZoomPct(Math.round(nextZoom * 100));
      // Persist once per gesture, not once per tick.
      if (viewportPersistTimer.current) clearTimeout(viewportPersistTimer.current);
      viewportPersistTimer.current = setTimeout(() => {
        viewportPersistTimer.current = undefined;
        const settled = viewportRef.current;
        if (onViewStateChange) publishViewState(selectedNodeIds, selectedEdgeIds, settled);
        else writeCanvasViewport(documentKey, settled);
      }, 200);
    },
    [documentKey, instance, onViewStateChange, publishViewState, selectedEdgeIds, selectedNodeIds],
  );

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;
    surface.addEventListener("wheel", handleModifierWheel, { capture: true, passive: false });
    return () => {
      surface.removeEventListener("wheel", handleModifierWheel, { capture: true });
      if (viewportPersistTimer.current) {
        clearTimeout(viewportPersistTimer.current);
        viewportPersistTimer.current = undefined;
      }
    };
  }, [handleModifierWheel]);

  const focusPresentationFrame = useCallback(
    (frameId: string) => {
      const frame = flowRef.current.nodes.find((node) => node.id === frameId);
      if (!frame) return;
      setSelectedNodeIds([frameId]);
      setSelectedEdgeIds([]);
      publishViewState([frameId], []);
      void instance?.fitView({
        nodes: [frame],
        padding: 0.12,
        duration: prefersReducedMotion() ? 0 : 220,
      });
    },
    [instance, publishViewState],
  );

  useEffect(() => {
    if (!commandRequest || lastCommandRequestId.current === commandRequest.id) return;
    lastCommandRequestId.current = commandRequest.id;
    const defer = (task: () => void): void => {
      if (globalThis.queueMicrotask) {
        globalThis.queueMicrotask(task);
        return;
      }
      globalThis.setTimeout(task, 0);
    };
    switch (commandRequest.command) {
      case "fit-view":
        fitSelectionOrCanvas();
        break;
      case "search":
      case "architecture-explorer":
        defer(() => setArchitectureOpen(true));
        break;
      case "undo":
        undo();
        break;
      case "redo":
        redo();
        break;
      case "auto-layout":
        defer(() => setLayoutOpen(true));
        break;
      case "composition":
        defer(() => setCompositionOpen(true));
        break;
      case "export":
        if (onExport) defer(() => setExportOpen(true));
        break;
      case "presentation":
        defer(() => setPresentationStartRequest(commandRequest.id));
        break;
      case "send-chat": {
        const selected = new Set(selectedNodeIds);
        onSelectionAction?.(
          (canvasRef.current.nodes ?? []).filter((node) => selected.has(node.id)),
          "chat",
        );
        break;
      }
    }
  }, [
    commandRequest,
    fitSelectionOrCanvas,
    onExport,
    onSelectionAction,
    redo,
    selectedNodeIds,
    undo,
  ]);

  return (
    <section
      ref={surfaceRef}
      data-testid="react-flow-canvas"
      className="afx-canvas-surface @container/canvas relative h-full min-h-0 w-full bg-background"
      data-afx-text-select={selectionMode ? "true" : "false"}
      data-afx-canvas-tone={surfaceTone}
      tabIndex={0}
      onKeyDown={(event) => {
        if (isFormControl(event.target)) return;
        const modifier = event.metaKey || event.ctrlKey;
        if (modifier && event.key.toLowerCase() === "z") {
          event.preventDefault();
          if (event.shiftKey) redo();
          else undo();
        }
        if (modifier && event.key.toLowerCase() === "c") copySelection();
        if (modifier && event.key.toLowerCase() === "v") pasteSelection();
        if (modifier && event.key.toLowerCase() === "d") {
          event.preventDefault();
          duplicateSelection();
        }
        if (modifier && event.key.toLowerCase() === "f") {
          event.preventDefault();
          setArchitectureOpen(true);
        }
        if (!modifier && event.key.toLowerCase() === "f") {
          event.preventDefault();
          fitSelectionOrCanvas();
        }
        // Route Delete/Backspace through deleteSelection so a generated
        // relationship edge can offer frontmatter removal (230 FR-6); React
        // Flow's own delete key is disabled below to avoid double handling.
        if (!modifier && (event.key === "Delete" || event.key === "Backspace")) {
          event.preventDefault();
          deleteSelection();
        }
      }}
    >
      <ReactFlow<CanvasFlowNode, Edge>
        nodes={decoratedNodes}
        edges={decoratedEdges}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={connect}
        onReconnect={reconnect}
        onInit={(flowInstance) => {
          setInstance(flowInstance);
          setZoomPct(Math.round((flowInstance.getZoom?.() ?? 1) * 100));
        }}
        fitView={!restoredViewport}
        defaultViewport={restoredViewport}
        onMoveEnd={(_event, viewport) => {
          viewportRef.current = viewport;
          setZoomPct(Math.round(viewport.zoom * 100));
          updateViewportBounds();
          if (onViewStateChange) publishViewState(selectedNodeIds, selectedEdgeIds, viewport);
          else writeCanvasViewport(documentKey, viewport);
        }}
        minZoom={CANVAS_MIN_ZOOM}
        maxZoom={CANVAS_MAX_ZOOM}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomActivationKeyCode={null}
        snapToGrid={snap}
        snapGrid={[16, 16]}
        selectionOnDrag
        selectionMode={SelectionMode.Partial}
        panOnDrag={[1, 2]}
        panOnScroll
        panOnScrollSpeed={0.35}
        autoPanOnNodeDrag
        autoPanOnConnect
        deleteKeyCode={null}
        multiSelectionKeyCode={["Meta", "Control", "Shift"]}
        nodesDraggable={!layoutPreview && !presentationActive && !selectionMode}
        nodesConnectable={!layoutPreview && !presentationActive && !selectionMode}
        elementsSelectable={!presentationActive}
        nodeDragThreshold={2}
        onlyRenderVisibleElements={(canvas.nodes?.length ?? 0) > 80}
        colorMode={canvasColorMode}
        className="afx-canvas-flow"
        proOptions={{ hideAttribution: false }}
      >
        {backgroundPattern !== "none" ? (
          <Background
            variant={
              backgroundPattern === "grid" ? BackgroundVariant.Lines : BackgroundVariant.Dots
            }
            gap={backgroundPattern === "grid" ? 24 : 16}
            size={1}
            color="var(--afx-canvas-dot)"
            // In dark color mode the pattern svg paints its own #141414
            // backdrop over the surface tone. The tone owns the backdrop.
            bgColor="transparent"
          />
        ) : null}
        {showMinimap ? (
          <MiniMap
            pannable
            zoomable
            nodeStrokeWidth={2}
            bgColor="var(--background)"
            maskColor="color-mix(in srgb, var(--background) 78%, transparent)"
            nodeColor="var(--muted)"
            nodeStrokeColor="var(--border)"
            className="!border !border-border !bg-background"
          />
        ) : null}
      </ReactFlow>

      {!presentationActive ? (
        <div className="afx-scrollbar-none absolute left-2 top-2 z-10 flex max-w-[calc(100%-1rem)] flex-nowrap items-center gap-1 overflow-x-auto rounded-md border bg-background/95 p-1 shadow-sm backdrop-blur">
          <ToolButton
            label="Undo"
            shortcut="Mod+Z"
            disabled={!historyAvailability.undo}
            onClick={undo}
          >
            <Undo2 size={13} />
          </ToolButton>
          <ToolButton
            label="Redo"
            shortcut="Mod+Shift+Z"
            disabled={!historyAvailability.redo}
            onClick={redo}
          >
            <Redo2 size={13} />
          </ToolButton>
          <ToolSeparator />
          <ToolButton
            label="Copy selection"
            shortLabel="Copy"
            shortcut="Mod+C"
            className="@max-[44rem]/canvas:hidden"
            disabled={selectedNodeIds.length === 0}
            onClick={copySelection}
          >
            <Copy size={13} />
          </ToolButton>
          <ToolButton
            label="Paste"
            shortcut="Mod+V"
            className="@max-[44rem]/canvas:hidden"
            disabled={!clipboard}
            onClick={pasteSelection}
          >
            <ClipboardPaste size={13} />
          </ToolButton>
          <ToolButton
            label="Duplicate selection"
            shortLabel="Duplicate"
            shortcut="Mod+D"
            className="@max-[44rem]/canvas:hidden"
            disabled={selectedNodeIds.length === 0}
            onClick={duplicateSelection}
          >
            <CopyPlus size={13} />
          </ToolButton>
          <ToolButton
            label="Delete selection"
            shortLabel="Delete"
            shortcut="Delete"
            disabled={selectedNodeIds.length === 0 && selectedEdgeIds.length === 0}
            onClick={deleteSelection}
          >
            <Trash2 size={13} />
          </ToolButton>
          {selectedNodeIds.length + selectedEdgeIds.length > 0 ? (
            <button
              type="button"
              aria-label={`${selectedNodeIds.length + selectedEdgeIds.length} selected — clear selection`}
              title="Clear selection"
              onClick={clearSelection}
              className="flex h-6 shrink-0 items-center gap-1 rounded-sm border border-afx-brand/40 bg-afx-brand/10 px-1.5 text-[10px] tabular-nums text-afx-brand-soft hover:bg-afx-brand/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {selectedNodeIds.length + selectedEdgeIds.length}
              <X size={11} aria-hidden />
            </button>
          ) : null}
          {onSelectionAction && selectedNodeIds.length > 0 ? (
            <button
              type="button"
              aria-label="Send selection to Chat"
              title="Send the selected cards to AFX Chat as context"
              onClick={() => {
                const selected = new Set(selectedNodeIds);
                onSelectionAction(
                  (canvasRef.current.nodes ?? []).filter((node) => selected.has(node.id)),
                  "chat",
                );
              }}
              className="flex h-6 shrink-0 items-center gap-1 rounded-sm border px-1.5 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <MessageSquare size={11} aria-hidden />
              Chat
            </button>
          ) : null}
          <ToolSeparator />
          <ToolButton label="Zoom out" onClick={() => zoomStep(-1)}>
            <ZoomOut size={13} />
          </ToolButton>
          <button
            type="button"
            aria-label={`Zoom ${zoomPct} percent — reset to 100%`}
            title="Reset zoom to 100%"
            onClick={resetZoom}
            className="flex h-6 w-11 shrink-0 items-center justify-center rounded-sm px-1 text-[10px] tabular-nums text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            data-testid="canvas-zoom-readout"
          >
            {zoomPct}%
          </button>
          <ToolButton label="Zoom in" onClick={() => zoomStep(1)}>
            <ZoomIn size={13} />
          </ToolButton>
          <ToolButton
            label="Fit selection or canvas"
            shortLabel="Fit"
            shortcut="F"
            onClick={fitSelectionOrCanvas}
          >
            <Focus size={13} />
          </ToolButton>
          <ToolButton
            label={snap ? "Disable snap" : "Enable snap"}
            className="@max-[44rem]/canvas:hidden"
            active={snap}
            onClick={() => setSnap((value) => !value)}
          >
            <Grid3X3 size={13} />
          </ToolButton>
          <ToolButton
            label={showMinimap ? "Hide minimap" : "Show minimap"}
            className="@max-[44rem]/canvas:hidden"
            active={showMinimap}
            onClick={() => {
              minimapManuallySet.current = true;
              setShowMinimap((value) => !value);
            }}
          >
            <MapIcon size={13} />
          </ToolButton>
          <ToolButton
            label={textSelect ? "Exit text selection" : "Text selection (or hold Alt)"}
            shortLabel="Select text"
            className="@max-[44rem]/canvas:hidden"
            active={textSelect}
            onClick={() => setTextSelect((value) => !value)}
          >
            <TextCursor size={13} />
          </ToolButton>
          <ToolButton
            label={surfaceTone === "warm" ? "Follow theme tone" : "Warm surface tone"}
            shortLabel="Warm"
            className="@max-[44rem]/canvas:hidden"
            active={surfaceTone === "warm"}
            onClick={() => setSurfaceTone((tone) => (tone === "warm" ? "theme" : "warm"))}
          >
            <Palette size={13} />
          </ToolButton>
          <ToolButton
            label={`Background: ${BACKGROUND_PATTERN_LABEL[backgroundPattern]} — switch to ${
              BACKGROUND_PATTERN_LABEL[NEXT_BACKGROUND_PATTERN[backgroundPattern]]
            }`}
            shortLabel={BACKGROUND_PATTERN_LABEL[backgroundPattern]}
            className="@max-[44rem]/canvas:hidden"
            active={backgroundPattern !== "dots"}
            onClick={() => setBackgroundPattern((pattern) => NEXT_BACKGROUND_PATTERN[pattern])}
          >
            {backgroundPattern === "grid" ? (
              <Grid2x2 size={13} />
            ) : backgroundPattern === "none" ? (
              <Square size={13} />
            ) : (
              <Grip size={13} />
            )}
          </ToolButton>
          {/* Narrow panels: hidden clipboard + view toggles collapse here. The
              trigger only renders below the width that hides them (FR-45). */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="More canvas tools"
                title="More canvas tools"
                className="hidden h-6 min-w-6 shrink-0 items-center justify-center rounded-sm px-1.5 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring @max-[44rem]/canvas:flex"
              >
                <MoreHorizontal size={13} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" sideOffset={6} className="w-56">
              <DropdownMenuLabel className="font-mono text-[10px] uppercase tracking-[0.14em]">
                Clipboard
              </DropdownMenuLabel>
              <DropdownMenuItem disabled={selectedNodeIds.length === 0} onSelect={copySelection}>
                <Copy size={12} /> Copy selection
              </DropdownMenuItem>
              <DropdownMenuItem disabled={!clipboard} onSelect={pasteSelection}>
                <ClipboardPaste size={12} /> Paste
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={selectedNodeIds.length === 0}
                onSelect={duplicateSelection}
              >
                <CopyPlus size={12} /> Duplicate selection
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="font-mono text-[10px] uppercase tracking-[0.14em]">
                View
              </DropdownMenuLabel>
              <DropdownMenuCheckboxItem
                checked={snap}
                onCheckedChange={() => setSnap((value) => !value)}
              >
                <Grid3X3 size={12} /> Snap to grid
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={showMinimap}
                onCheckedChange={() => {
                  minimapManuallySet.current = true;
                  setShowMinimap((value) => !value);
                }}
              >
                <MapIcon size={12} /> Minimap
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={textSelect}
                onCheckedChange={() => setTextSelect((value) => !value)}
              >
                <TextCursor size={12} /> Text selection
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={surfaceTone === "warm"}
                onCheckedChange={() =>
                  setSurfaceTone((tone) => (tone === "warm" ? "theme" : "warm"))
                }
              >
                <Palette size={12} /> Warm tone
              </DropdownMenuCheckboxItem>
              <DropdownMenuItem
                onSelect={() => setBackgroundPattern((pattern) => NEXT_BACKGROUND_PATTERN[pattern])}
              >
                <Grip size={12} /> Background: {BACKGROUND_PATTERN_LABEL[backgroundPattern]}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <ToolSeparator />
          {/* The explorer doubles as canvas search ("Find on canvas", Ctrl+F), which is
              promoted in every profile — so it must mount in every profile (FR-43). */}
          <CanvasArchitectureExplorer
            canvas={canvas}
            onFocus={focusArchitecture}
            onClearFocus={clearArchitectureFocus}
            onOpenSource={(nodeId) => {
              const node = (canvas.nodes ?? []).find((candidate) => candidate.id === nodeId);
              if (node?.type === "file") onNodeAction(node, "open");
            }}
            open={architectureOpen}
            onOpenChange={setArchitectureOpen}
          />
          {profile !== "essentials" ? (
            <CanvasLayoutControls
              canvas={canvas}
              selectedNodeIds={selectedNodeIds}
              onPreview={setLayoutPreview}
              onApply={(next) => commit(next)}
              open={layoutOpen}
              onOpenChange={setLayoutOpen}
            />
          ) : null}
          <CanvasCompositionControls
            canvas={canvas}
            selectedNodeIds={selectedNodeIds}
            onApply={(next) => commit(next)}
            open={compositionOpen}
            onOpenChange={setCompositionOpen}
          />
          {onExport ? (
            <CanvasExportControls
              canvas={canvas}
              selectedNodeIds={selectedNodeIds}
              viewportBounds={viewportBounds}
              referenceStatuses={exportReferenceStatuses}
              documentLabel={documentLabel}
              onExport={onExport}
              open={exportOpen}
              onOpenChange={setExportOpen}
            />
          ) : null}
        </div>
      ) : null}

      {layoutPreview ? (
        <div className="pointer-events-none absolute left-1/2 top-12 z-10 -translate-x-1/2 rounded-sm border border-afx-brand/50 bg-background/95 px-2 py-1 text-[10px] text-afx-brand-soft shadow-sm">
          Layout preview · editing paused until Apply or Cancel
        </div>
      ) : null}

      {topologyFocus?.isolate ? (
        <button
          type="button"
          className="absolute right-2 top-28 z-10 rounded-sm border bg-background/95 px-2 py-1 text-[10px] text-muted-foreground shadow-sm hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={clearArchitectureFocus}
        >
          Show all {canvas.nodes?.length ?? 0} nodes
        </button>
      ) : null}

      {profile !== "essentials" ? (
        <div className="absolute right-2 top-12 z-10 w-[min(20rem,calc(100%-1rem))]">
          <CanvasPresentationControls
            key={documentKey}
            nodes={canvas.nodes ?? []}
            startRequest={presentationStartRequest}
            onFocusFrame={focusPresentationFrame}
            onPresentationChange={setPresentationActive}
          />
        </div>
      ) : null}

      {selectedEdgeIds.length > 0 && !presentationActive ? (
        <div className="absolute bottom-2 left-1/2 z-10 -translate-x-1/2">
          <CanvasEdgeInspector
            canvas={canvas}
            selectedEdgeIds={selectedEdgeIds}
            onApply={(next) => commit(next)}
          />
        </div>
      ) : null}
    </section>
  );
}

/** Convert host preview health into an explicit export preflight; uninspected content is never implied to be embedded. */
export function canvasExportReferenceStatuses(
  canvas: JSONCanvas,
  previews: Readonly<Record<string, CanvasNodePreview>>,
): CanvasExportReferenceStatus[] {
  const statuses: CanvasExportReferenceStatus[] = [];
  for (const node of canvas.nodes ?? []) {
    if (node.type === "link") {
      statuses.push({
        nodeId: node.id,
        state: "external",
        reference: node.url,
        message: "Remote URL content is not embedded in the export.",
      });
      continue;
    }
    if (node.type !== "file") continue;
    const preview = previews[node.id];
    if (!preview) {
      statuses.push({
        nodeId: node.id,
        state: "external",
        reference: node.file,
        message: "The referenced file has not been inspected in this Canvas session.",
      });
      continue;
    }
    if (preview.state === "loading" || preview.state === "stale") {
      statuses.push({
        nodeId: node.id,
        state: "stale",
        reference: node.file,
        ...(preview.state === "loading"
          ? { message: "Reference inspection is still running." }
          : {}),
      });
      continue;
    }
    const payload = preview.payload;
    if (payload?.state === "ready") continue;
    statuses.push({
      nodeId: node.id,
      state: payload?.state === "missing" ? "missing" : "blocked",
      reference: node.file,
      ...(payload?.message ? { message: payload.message } : {}),
    });
  }
  return statuses.sort(
    (left, right) =>
      left.nodeId.localeCompare(right.nodeId) || left.state.localeCompare(right.state),
  );
}

/** Stable identity for a published view state — used for own-echo suppression. */
function viewStateSignature(state: CanvasViewState): string {
  return `${state.x.toFixed(2)}:${state.y.toFixed(2)}:${state.zoom.toFixed(4)}:${[
    ...(state.selectedIds ?? []),
  ]
    .sort()
    .join(",")}`;
}

/** True on macOS webviews — picks the ⌘ prefix for shortcut hints. */
const IS_MAC = /mac/i.test(globalThis.navigator?.platform ?? "");

/** Render a canvas shortcut hint for the current platform, e.g. "⌘Z" / "Ctrl+Z". */
function shortcutHint(keys: string): string {
  return keys.replace("Mod", IS_MAC ? "⌘" : "Ctrl+").replace("Shift", IS_MAC ? "⇧" : "Shift+");
}

function ToolSeparator() {
  return <span aria-hidden className="mx-0.5 my-0.5 w-px shrink-0 self-stretch bg-border/70" />;
}

function ToolButton({
  label,
  shortLabel,
  shortcut,
  disabled,
  active,
  onClick,
  children,
  className,
}: {
  label: string;
  shortLabel?: string;
  /** Platform-neutral shortcut, e.g. "Mod+Z" or "F" — rendered in the tooltip. */
  shortcut?: string;
  disabled?: boolean;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  /** Responsive tier classes, e.g. hide below a container width. */
  className?: string;
}) {
  const visibleLabel = shortLabel ?? label;
  const hint = shortcut ? shortcutHint(shortcut) : undefined;
  return (
    <TooltipProvider delayDuration={250}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={label}
            title={hint ? `${label} (${hint})` : label}
            aria-keyshortcuts={shortcut?.replace("Mod", IS_MAC ? "Meta" : "Control")}
            aria-pressed={active}
            disabled={disabled}
            onClick={onClick}
            className={`flex h-6 min-w-6 shrink-0 items-center justify-center gap-1 rounded-sm px-1.5 py-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-30 ${active ? "bg-muted text-foreground" : ""} ${className ?? ""}`}
          >
            {children}
            <span className="hidden max-w-24 truncate text-[10px] @[58rem]/canvas:inline">
              {visibleLabel}
            </span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {label}
          {hint ? (
            <span className="ml-1.5 rounded-sm border border-border/60 bg-muted/40 px-1 font-mono text-[9px]">
              {hint}
            </span>
          ) : null}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function useVSCodeCanvasColorMode(): "dark" | "light" {
  const read = () =>
    globalThis.document?.body.classList.contains("vscode-dark") ||
    globalThis.document?.body.classList.contains("vscode-high-contrast")
      ? "dark"
      : "light";
  const [mode, setMode] = useState<"dark" | "light">(read);

  useEffect(() => {
    const body = globalThis.document?.body;
    if (!body || typeof MutationObserver === "undefined") return;
    const observer = new MutationObserver(() => setMode(read()));
    observer.observe(body, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return mode;
}

function handleSide(handle: string | null): CanvasEdge["fromSide"] {
  if (!handle) return undefined;
  const parts = handle.split(":");
  const side = parts[parts.length - 1];
  return side === "top" || side === "right" || side === "bottom" || side === "left"
    ? side
    : undefined;
}

function uniqueId(prefix: "n" | "e"): string {
  const random =
    globalThis.crypto?.randomUUID?.().slice(0, 8) ?? Math.random().toString(36).slice(2, 10);
  return `${prefix}-${random}`;
}

function prefersReducedMotion(): boolean {
  return globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

function sameCanvasGeometry(left: JSONCanvas, right: JSONCanvas): boolean {
  const leftNodes = left.nodes ?? [];
  const rightNodes = right.nodes ?? [];
  if (leftNodes.length !== rightNodes.length) return false;
  return leftNodes.every((node, index) => {
    const other = rightNodes[index];
    return (
      other?.id === node.id &&
      other.x === node.x &&
      other.y === node.y &&
      other.width === node.width &&
      other.height === node.height
    );
  });
}

function isNarrowViewport(): boolean {
  return (
    globalThis.matchMedia?.("(max-width: 639px)").matches ??
    (typeof globalThis.innerWidth === "number" && globalThis.innerWidth < 640)
  );
}

function isFormControl(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(target.tagName))
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function readCanvasViewport(documentKey: string): Viewport | undefined {
  try {
    const raw = globalThis.localStorage?.getItem(`${VIEWPORT_STORAGE_PREFIX}${documentKey}`);
    if (!raw) return undefined;
    const value = JSON.parse(raw) as Partial<Viewport>;
    if (
      typeof value.x !== "number" ||
      !Number.isFinite(value.x) ||
      typeof value.y !== "number" ||
      !Number.isFinite(value.y) ||
      typeof value.zoom !== "number" ||
      !Number.isFinite(value.zoom) ||
      value.zoom <= 0
    ) {
      return undefined;
    }
    return { x: value.x, y: value.y, zoom: value.zoom };
  } catch {
    return undefined;
  }
}

function writeCanvasViewport(documentKey: string, viewport: Viewport): void {
  try {
    globalThis.localStorage?.setItem(
      `${VIEWPORT_STORAGE_PREFIX}${documentKey}`,
      JSON.stringify({ x: viewport.x, y: viewport.y, zoom: viewport.zoom }),
    );
  } catch {
    // Viewport persistence is best-effort and never blocks Canvas editing.
  }
}
