/**
 * Custom React Flow edge that preserves JSON Canvas endpoints while rendering
 * advanced route/stroke/waypoint metadata as an inert presentation overlay.
 *
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-28] [FR-41]
 */
import {
  BaseEdge,
  type Edge,
  type EdgeProps,
  getBezierPath,
  getSmoothStepPath,
  getStraightPath,
} from "@xyflow/react";

import type { CanvasEdge, CanvasEdgeRoute } from "@afx/shared";

export interface CanvasFlowEdgeData extends Record<string, unknown> {
  canvasEdge: CanvasEdge;
  /** Animated live state for generated dependency edges (FR-47). Never serialized. */
  live?: "refreshing" | "stale";
  /** True when this edge is an annotation's leader arrow (FR-46). */
  leader?: boolean;
}

export type CanvasFlowEdgeType = Edge<CanvasFlowEdgeData, "canvas-edge">;

export function CanvasFlowEdge({
  id,
  data,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerStart,
  markerEnd,
  style,
  selected,
}: EdgeProps<CanvasFlowEdgeType>) {
  const edge = data?.canvasEdge;
  const [path, labelX, labelY] = canvasEdgePath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    route: edge?.afxStyle?.route ?? "bezier",
    waypoints: edge?.afxStyle?.waypoints,
  });
  const live = data?.live;
  const leader = data?.leader === true;
  return (
    <BaseEdge
      id={id}
      path={path}
      className={
        [live ? "afx-edge-live" : "", leader ? "afx-edge-leader" : ""].join(" ").trim() || undefined
      }
      label={edge?.label}
      labelX={labelX}
      labelY={labelY}
      markerStart={markerStart}
      markerEnd={markerEnd}
      interactionWidth={20}
      style={{
        ...style,
        // Live edges pull the brand stroke; reduced-motion swaps animation for
        // this static emphasis alone (see .afx-edge-live in index.css).
        ...(live ? { stroke: "var(--afx-brand)" } : {}),
        opacity: edge?.afxStyle?.opacity ?? style?.opacity,
        strokeWidth: selected ? 2.5 : live ? 2 : (style?.strokeWidth ?? 1.5),
      }}
      labelStyle={{
        fill: "var(--foreground)",
        fontSize: 10,
        fontFamily: "var(--font-mono)",
      }}
      labelBgStyle={{
        fill: "var(--background)",
        fillOpacity: 0.92,
        stroke: selected ? "var(--afx-brand)" : "var(--border)",
        strokeWidth: 1,
      }}
      labelBgPadding={[5, 3]}
      labelBgBorderRadius={3}
    />
  );
}

export function canvasEdgePath(options: {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sourcePosition: Parameters<typeof getBezierPath>[0]["sourcePosition"];
  targetPosition: Parameters<typeof getBezierPath>[0]["targetPosition"];
  route: CanvasEdgeRoute;
  waypoints?: readonly { x: number; y: number }[];
}): [path: string, labelX: number, labelY: number] {
  const { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, route } = options;
  const waypoints = options.waypoints?.filter(
    (point) => Number.isFinite(point.x) && Number.isFinite(point.y),
  );
  if (waypoints && waypoints.length > 0) {
    const points = [{ x: sourceX, y: sourceY }, ...waypoints, { x: targetX, y: targetY }];
    const path = points
      .map(
        (point, index) =>
          `${index === 0 ? "M" : "L"} ${numberText(point.x)} ${numberText(point.y)}`,
      )
      .join(" ");
    const midpoint = polylineMidpoint(points);
    return [path, midpoint.x, midpoint.y];
  }
  if (route === "straight") {
    const [path, labelX, labelY] = getStraightPath({ sourceX, sourceY, targetX, targetY });
    return [path, labelX, labelY];
  }
  if (route === "step" || route === "smoothstep") {
    const [path, labelX, labelY] = getSmoothStepPath({
      sourceX,
      sourceY,
      targetX,
      targetY,
      sourcePosition,
      targetPosition,
      borderRadius: route === "step" ? 0 : 8,
    });
    return [path, labelX, labelY];
  }
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });
  return [path, labelX, labelY];
}

function polylineMidpoint(points: readonly { x: number; y: number }[]): { x: number; y: number } {
  const segments = points.slice(1).map((point, index) => {
    const previous = points[index];
    return { previous, point, length: Math.hypot(point.x - previous.x, point.y - previous.y) };
  });
  const total = segments.reduce((sum, segment) => sum + segment.length, 0);
  if (total === 0) return { ...points[0] };
  let remaining = total / 2;
  for (const segment of segments) {
    if (remaining > segment.length) {
      remaining -= segment.length;
      continue;
    }
    const ratio = segment.length === 0 ? 0 : remaining / segment.length;
    return {
      x: segment.previous.x + (segment.point.x - segment.previous.x) * ratio,
      y: segment.previous.y + (segment.point.y - segment.previous.y) * ratio,
    };
  }
  return { ...points[points.length - 1] };
}

function numberText(value: number): string {
  return Number(value.toFixed(3)).toString();
}
