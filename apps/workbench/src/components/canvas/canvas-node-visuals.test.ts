import { describe, expect, it } from "vitest";

import type { CanvasNode } from "@afx/shared";

import {
  canvasNodeDensityClass,
  canvasNodeShapeClass,
  canvasNodeTypographyClass,
  canvasNodeVisuals,
} from "./canvas-node-visuals";

const base: CanvasNode = {
  id: "service",
  type: "text",
  text: "API",
  x: 0,
  y: 0,
  width: 240,
  height: 140,
};

describe("canvas node visuals", () => {
  it("projects supported semantic style and layout metadata", () => {
    expect(
      canvasNodeVisuals({
        ...base,
        afxStyle: {
          shape: "service",
          density: "compact",
          typography: "heading",
          icon: "Server-2",
        },
        afxLayout: { locked: true, pinned: true, lane: "Platform" },
      }),
    ).toEqual({
      shape: "service",
      density: "compact",
      typography: "heading",
      icon: "server-2",
      locked: true,
      pinned: true,
      lane: "Platform",
    });
  });

  it("degrades malformed and unknown metadata to a portable card", () => {
    expect(
      canvasNodeVisuals({
        ...base,
        afxStyle: { shape: "architecture", density: "tiny", icon: "<script>" },
        afxLayout: { locked: "yes", pinned: 1, lane: "bad\nlabel" },
      }),
    ).toEqual({
      shape: "card",
      density: "comfortable",
      typography: "body",
      icon: undefined,
      locked: false,
      pinned: false,
      lane: undefined,
    });
  });

  it("maps each semantic option to bounded utility classes", () => {
    expect(canvasNodeShapeClass("database")).toContain("rounded");
    expect(canvasNodeShapeClass("decision")).toContain("dashed");
    expect(canvasNodeDensityClass("spacious")).toContain("p-4");
    expect(canvasNodeTypographyClass("mono")).toContain("font-mono");
  });
});
