/**
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-28] [FR-41]
 */
import { Position } from "@xyflow/react";
import { describe, expect, it } from "vitest";

import { canvasEdgePath } from "./canvas-flow-edge";

const endpoints = {
  sourceX: 0,
  sourceY: 20,
  targetX: 300,
  targetY: 120,
  sourcePosition: Position.Right,
  targetPosition: Position.Left,
};

describe("CanvasFlowEdge", () => {
  it.each(["bezier", "straight", "step", "smoothstep"] as const)(
    "renders the %s route as an SVG path",
    (route) => {
      const [path, labelX, labelY] = canvasEdgePath({ ...endpoints, route });

      expect(path).toMatch(/^M/);
      expect(Number.isFinite(labelX)).toBe(true);
      expect(Number.isFinite(labelY)).toBe(true);
    },
  );

  it("renders deterministic waypoints and locates the label on the path midpoint", () => {
    const [path, labelX, labelY] = canvasEdgePath({
      ...endpoints,
      route: "bezier",
      waypoints: [
        { x: 100, y: 20 },
        { x: 100, y: 120 },
      ],
    });

    expect(path).toBe("M 0 20 L 100 20 L 100 120 L 300 120");
    expect({ labelX, labelY }).toEqual({ labelX: 100, labelY: 120 });
  });

  it("ignores invalid waypoints rather than emitting invalid SVG", () => {
    const [path] = canvasEdgePath({
      ...endpoints,
      route: "straight",
      waypoints: [
        { x: Number.NaN, y: 20 },
        { x: 150, y: 70 },
      ],
    });

    expect(path).toBe("M 0 20 L 150 70 L 300 120");
    expect(path).not.toContain("NaN");
  });
});
