/**
 * Safe visual projection for optional AFX node presentation metadata.
 *
 * The source node remains a standard JSON Canvas node. These values only
 * affect presentation inside AFX and malformed/unknown metadata degrades to
 * the ordinary portable card.
 *
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-38] [FR-39] [FR-43]
 */
import type { CanvasNode } from "@afx/shared";

export type CanvasNodeShape = "card" | "component" | "service" | "database" | "decision";

export type CanvasNodeDensity = "compact" | "comfortable" | "spacious";
export type CanvasNodeTypography = "body" | "heading" | "mono";

export interface CanvasNodeVisuals {
  shape: CanvasNodeShape;
  density: CanvasNodeDensity;
  typography: CanvasNodeTypography;
  icon?: string;
  locked: boolean;
  pinned: boolean;
  lane?: string;
}

const SHAPES = new Set<CanvasNodeShape>(["card", "component", "service", "database", "decision"]);
const DENSITIES = new Set<CanvasNodeDensity>(["compact", "comfortable", "spacious"]);
const TYPOGRAPHY = new Set<CanvasNodeTypography>(["body", "heading", "mono"]);

export function canvasNodeVisuals(node: CanvasNode): CanvasNodeVisuals {
  const style = record(node["afxStyle"]);
  const layout = record(node["afxLayout"]);
  return {
    shape: enumValue(style?.["shape"], SHAPES, "card"),
    density: enumValue(style?.["density"], DENSITIES, "comfortable"),
    typography: enumValue(style?.["typography"], TYPOGRAPHY, "body"),
    icon: safeToken(style?.["icon"]),
    locked: layout?.["locked"] === true,
    pinned: layout?.["pinned"] === true,
    lane: safeLabel(layout?.["lane"]),
  };
}

export function canvasNodeShapeClass(shape: CanvasNodeShape): string {
  switch (shape) {
    case "component":
      return "rounded-sm border-double";
    case "service":
      return "rounded-xl";
    case "database":
      return "rounded-[45%/12%]";
    case "decision":
      return "rounded-none border-dashed";
    case "card":
      return "rounded-md";
  }
}

export function canvasNodeDensityClass(density: CanvasNodeDensity): string {
  if (density === "compact") return "p-1 text-[10px] leading-4";
  if (density === "spacious") return "p-4 text-sm leading-6";
  return "p-2 text-xs";
}

export function canvasNodeTypographyClass(typography: CanvasNodeTypography): string {
  if (typography === "heading") return "font-medium tracking-tight";
  if (typography === "mono") return "font-mono";
  return "";
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function enumValue<T extends string>(value: unknown, values: ReadonlySet<T>, fallback: T): T {
  return typeof value === "string" && values.has(value as T) ? (value as T) : fallback;
}

function safeToken(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLocaleLowerCase();
  return /^[a-z0-9][a-z0-9-]{0,31}$/.test(normalized) ? normalized : undefined;
}

function safeLabel(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= 64 && !/[\r\n\t]/.test(normalized)
    ? normalized
    : undefined;
}
