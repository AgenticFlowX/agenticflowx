/**
 * SVG edge layer for JSON Canvas edges.
 *
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-9] [FR-18]
 * @see docs/specs/229-app-workbench-canvas/design.md [DES-UI]
 */
import { type PointerEvent, useRef, useState } from "react";

import { PencilLine, Trash2 } from "lucide-react";

import type { CanvasEdge, CanvasNode } from "@afx/shared";

import { type CanvasPoint, nodeCenter } from "./use-canvas-model";

interface CanvasEdgesProps {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  draftEdge?: { fromNode: string; fromSide?: CanvasEdge["fromSide"]; to: CanvasPoint } | null;
  retargetPreview?: {
    edgeId: string;
    end: CanvasEdgeEnd;
    point: CanvasPoint;
  } | null;
  onLabelEdge: (id: string, label: string) => void;
  onDeleteEdge: (id: string) => void;
  onBeginRetargetEdge: (
    id: string,
    end: CanvasEdgeEnd,
    point: { clientX: number; clientY: number },
  ) => void;
  onRetargetEdgeMove: (
    id: string,
    end: CanvasEdgeEnd,
    point: { clientX: number; clientY: number },
  ) => void;
  onFinishRetargetEdge: (
    id: string,
    end: CanvasEdgeEnd,
    point: { clientX: number; clientY: number },
  ) => void;
  onCancelRetargetEdge: () => void;
}

type CanvasEdgeEnd = "from" | "to";

export function CanvasEdges({
  nodes,
  edges,
  draftEdge,
  retargetPreview,
  onLabelEdge,
  onDeleteEdge,
  onBeginRetargetEdge,
  onRetargetEdgeMove,
  onFinishRetargetEdge,
  onCancelRetargetEdge,
}: CanvasEdgesProps) {
  const [editingEdgeId, setEditingEdgeId] = useState<string | null>(null);
  const [draftLabel, setDraftLabel] = useState("");
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const baseEdges = edges
    .map((edge) => {
      const from = nodeById.get(edge.fromNode);
      const to = nodeById.get(edge.toNode);
      if (!from || !to) return null;
      const start = anchorFor(from, edge.fromSide);
      const end = anchorFor(to, edge.toSide);
      return { edge, start, end };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);
  const pairCounts = new Map<string, number>();
  for (const item of baseEdges) {
    const key = edgePairKey(item.edge);
    pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
  }
  const pairSeen = new Map<string, number>();
  const rendered = baseEdges.map((item) => {
    const key = edgePairKey(item.edge);
    const index = pairSeen.get(key) ?? 0;
    pairSeen.set(key, index + 1);
    const count = pairCounts.get(key) ?? 1;
    const offset = (index - (count - 1) / 2) * 24;
    const start =
      retargetPreview?.edgeId === item.edge.id && retargetPreview.end === "from"
        ? retargetPreview.point
        : item.start;
    const end =
      retargetPreview?.edgeId === item.edge.id && retargetPreview.end === "to"
        ? retargetPreview.point
        : item.end;
    return { ...item, start, end, ...edgeGeometry(start, end, offset) };
  });
  const draftFrom = draftEdge ? nodeById.get(draftEdge.fromNode) : undefined;
  const draftStart = draftFrom ? anchorFor(draftFrom, draftEdge?.fromSide) : null;
  const draftGeometry = draftStart && draftEdge ? edgeGeometry(draftStart, draftEdge.to, 0) : null;

  function beginEditingEdge(edge: CanvasEdge) {
    setDraftLabel(edge.label ?? "");
    setEditingEdgeId(edge.id);
  }

  return (
    <>
      <svg
        className="pointer-events-none absolute left-0 top-0 overflow-visible"
        width="1"
        height="1"
        aria-hidden="true"
      >
        <defs>
          <marker
            id="afx-canvas-arrow"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
          </marker>
        </defs>
        {rendered.map((item) => {
          const { edge, path } = item;
          return (
            <path
              key={edge.id}
              data-edge-id={edge.id}
              d={path}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeOpacity={0.72}
              markerStart={
                edge.fromEnd && edge.fromEnd !== "none" ? "url(#afx-canvas-arrow)" : undefined
              }
              markerEnd={edge.toEnd === "none" ? undefined : "url(#afx-canvas-arrow)"}
            />
          );
        })}
        {draftGeometry ? (
          <path
            d={draftGeometry.path}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeDasharray="5 5"
            strokeOpacity={0.55}
            markerEnd="url(#afx-canvas-arrow)"
          />
        ) : null}
      </svg>
      {rendered.map((item) => {
        const hasLabel = !!item.edge.label?.trim();
        const label = hasLabel ? item.edge.label?.trim() || "" : "Add label";
        const isEditing = editingEdgeId === item.edge.id;

        if (isEditing) {
          return (
            <input
              key={`${item.edge.id}-label-input`}
              aria-label="Edge label"
              autoFocus
              className="absolute z-50 h-7 w-40 -translate-x-1/2 -translate-y-1/2 border border-afx-brand bg-background px-2 font-mono text-[11px] text-foreground shadow-sm outline-none"
              style={{ left: item.labelPoint.x, top: item.labelPoint.y }}
              value={draftLabel}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
              onFocus={(event) => event.currentTarget.select()}
              onChange={(event) => setDraftLabel(event.target.value)}
              onBlur={() => {
                onLabelEdge(item.edge.id, draftLabel.trim());
                setEditingEdgeId(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  onLabelEdge(item.edge.id, draftLabel.trim());
                  setEditingEdgeId(null);
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  setEditingEdgeId(null);
                }
              }}
            />
          );
        }

        return (
          <div
            key={`${item.edge.id}-label`}
            className={`group/edge-label absolute z-50 flex -translate-x-1/2 -translate-y-1/2 items-center border bg-background font-mono text-[10px] text-muted-foreground shadow-sm ${
              hasLabel ? "border-border" : "border-transparent bg-background/75"
            }`}
            style={{ left: item.labelPoint.x, top: item.labelPoint.y }}
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            <button
              type="button"
              title={hasLabel ? "Double-click to edit edge label" : "Add edge label"}
              className={
                hasLabel
                  ? "max-w-48 truncate px-2 py-1 hover:text-foreground"
                  : "flex size-5 items-center justify-center rounded-full hover:bg-afx-brand/10 hover:text-foreground"
              }
              onClick={(event) => {
                event.stopPropagation();
                if (!hasLabel) beginEditingEdge(item.edge);
              }}
              onPointerUp={(event) => {
                event.stopPropagation();
                if (!hasLabel) beginEditingEdge(item.edge);
              }}
              onDoubleClick={(event) => {
                event.stopPropagation();
                beginEditingEdge(item.edge);
              }}
              aria-label={`Edit edge label ${label}`}
            >
              {hasLabel ? label : <PencilLine size={11} />}
            </button>
            <button
              type="button"
              title="Delete edge"
              className={`flex size-5 items-center justify-center border-l border-border hover:bg-destructive/10 hover:text-destructive ${
                hasLabel
                  ? ""
                  : "w-0 overflow-hidden border-l-0 opacity-0 transition-all group-hover/edge-label:w-5 group-hover/edge-label:border-l group-hover/edge-label:opacity-100 focus:w-5 focus:border-l focus:opacity-100"
              }`}
              aria-label={`Delete edge ${label}`}
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onDeleteEdge(item.edge.id);
              }}
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                event.stopPropagation();
                onDeleteEdge(item.edge.id);
              }}
            >
              <Trash2 size={11} />
            </button>
          </div>
        );
      })}
      {rendered.map((item) => {
        const label = item.edge.label || item.edge.id;
        return (
          <EdgeEndpointHandle
            key={`${item.edge.id}-from-handle`}
            edgeId={item.edge.id}
            end="from"
            point={retargetHandlePoint(item.start, item.end)}
            label={label}
            onBeginRetargetEdge={onBeginRetargetEdge}
            onRetargetEdgeMove={onRetargetEdgeMove}
            onFinishRetargetEdge={onFinishRetargetEdge}
            onCancelRetargetEdge={onCancelRetargetEdge}
          />
        );
      })}
      {rendered.map((item) => {
        const label = item.edge.label || item.edge.id;
        return (
          <EdgeEndpointHandle
            key={`${item.edge.id}-to-handle`}
            edgeId={item.edge.id}
            end="to"
            point={retargetHandlePoint(item.end, item.start)}
            label={label}
            onBeginRetargetEdge={onBeginRetargetEdge}
            onRetargetEdgeMove={onRetargetEdgeMove}
            onFinishRetargetEdge={onFinishRetargetEdge}
            onCancelRetargetEdge={onCancelRetargetEdge}
          />
        );
      })}
    </>
  );
}

function EdgeEndpointHandle({
  edgeId,
  end,
  point,
  label,
  onBeginRetargetEdge,
  onRetargetEdgeMove,
  onFinishRetargetEdge,
  onCancelRetargetEdge,
}: {
  edgeId: string;
  end: CanvasEdgeEnd;
  point: CanvasPoint;
  label: string;
  onBeginRetargetEdge: CanvasEdgesProps["onBeginRetargetEdge"];
  onRetargetEdgeMove: CanvasEdgesProps["onRetargetEdgeMove"];
  onFinishRetargetEdge: CanvasEdgesProps["onFinishRetargetEdge"];
  onCancelRetargetEdge: CanvasEdgesProps["onCancelRetargetEdge"];
}) {
  const moved = useRef(false);
  const endLabel = end === "from" ? "source" : "target";

  function startRetarget(event: PointerEvent<HTMLButtonElement>) {
    event.stopPropagation();
    moved.current = false;
    onBeginRetargetEdge(edgeId, end, { clientX: event.clientX, clientY: event.clientY });
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function moveRetarget(event: PointerEvent<HTMLButtonElement>) {
    if (!event.currentTarget.hasPointerCapture?.(event.pointerId)) return;
    moved.current = true;
    onRetargetEdgeMove(edgeId, end, { clientX: event.clientX, clientY: event.clientY });
  }

  function stopRetarget(event: PointerEvent<HTMLButtonElement>) {
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (moved.current) {
      onFinishRetargetEdge(edgeId, end, { clientX: event.clientX, clientY: event.clientY });
    } else {
      onCancelRetargetEdge();
    }
    moved.current = false;
  }

  return (
    <button
      type="button"
      aria-label={`Retarget ${endLabel} for edge ${label}`}
      title={`Drag to retarget edge ${endLabel}`}
      className="absolute z-50 flex size-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-afx-brand/45 bg-background text-afx-brand shadow-sm hover:scale-110 hover:border-afx-brand focus:outline-none focus:ring-1 focus:ring-afx-brand"
      style={{ left: point.x, top: point.y }}
      onPointerDown={startRetarget}
      onPointerMove={moveRetarget}
      onPointerUp={stopRetarget}
      onPointerCancel={() => {
        moved.current = false;
        onCancelRetargetEdge();
      }}
    >
      <span className="block size-1.5 rounded-full bg-current" />
    </button>
  );
}

function anchorFor(node: CanvasNode, side: CanvasEdge["fromSide"]) {
  const center = nodeCenter(node);
  if (side === undefined) return center;
  switch (side) {
    case "top":
      return { x: center.x, y: node.y };
    case "right":
      return { x: node.x + node.width, y: center.y };
    case "bottom":
      return { x: center.x, y: node.y + node.height };
    case "left":
      return { x: node.x, y: center.y };
    default:
      return center;
  }
}

function edgePairKey(edge: CanvasEdge): string {
  return [edge.fromNode, edge.toNode].sort().join("::");
}

function edgeGeometry(start: CanvasPoint, end: CanvasPoint, offset: number) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy) || 1;
  const normal = { x: -dy / length, y: dx / length };
  const labelPoint = {
    x: (start.x + end.x) / 2 + normal.x * offset,
    y: (start.y + end.y) / 2 + normal.y * offset,
  };
  return {
    labelPoint,
    path: `M ${start.x} ${start.y} Q ${labelPoint.x} ${labelPoint.y} ${end.x} ${end.y}`,
  };
}

function retargetHandlePoint(anchor: CanvasPoint, opposite: CanvasPoint): CanvasPoint {
  const dx = opposite.x - anchor.x;
  const dy = opposite.y - anchor.y;
  const length = Math.hypot(dx, dy) || 1;
  return {
    x: anchor.x + (dx / length) * 18,
    y: anchor.y + (dy / length) * 18,
  };
}
