/**
 * Validation for optional namespaced AFX canvas metadata: actions, edge styles, and provenance.
 *
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-18] [FR-33]
 * @see docs/specs/229-app-workbench-canvas/design.md [DES-DATA]
 */
import type { CanvasActionMetadata, CanvasEdgeProvenance, CanvasEdgeStyle } from "@afx/shared";

const ACTIONS = new Set([
  "open-source",
  "send-chat",
  "promote-note",
  "prepare-spec",
  "prepare-sprint",
]);
const ROUTES = new Set(["bezier", "straight", "step", "smoothstep"]);
const STROKES = new Set(["solid", "dashed", "dotted"]);
const ACTION_KEYS = new Set(["version", "action", "label", "command"]);
const ACTION_LABEL_MAX_LENGTH = 80;
const ACTION_COMMAND_MAX_LENGTH = 512;
const EDGE_RELATIONSHIP_MAX_LENGTH = 64;
const EDGE_WAYPOINT_LIMIT = 64;

export function parseCanvasAction(value: unknown): CanvasActionMetadata | undefined {
  if (!isRecord(value) || value["version"] !== 1 || !ACTIONS.has(value["action"] as string)) {
    return undefined;
  }
  if (Object.keys(value).some((key) => !ACTION_KEYS.has(key))) return undefined;

  const label = value["label"];
  if (
    label !== undefined &&
    (typeof label !== "string" ||
      label.trim().length === 0 ||
      label.length > ACTION_LABEL_MAX_LENGTH ||
      hasControlCharacter(label))
  ) {
    return undefined;
  }

  const action = value["action"] as CanvasActionMetadata["action"];
  const command = value["command"];
  if (command !== undefined) {
    if (
      typeof command !== "string" ||
      command.trim() !== command ||
      command.length === 0 ||
      command.length > ACTION_COMMAND_MAX_LENGTH ||
      hasControlCharacter(command)
    ) {
      return undefined;
    }
    if (action === "prepare-spec" && !/^\/?afx-spec(?:\s|$)/.test(command)) return undefined;
    if (action === "prepare-sprint" && !/^\/?afx-sprint(?:\s|$)/.test(command)) return undefined;
    if (action !== "prepare-spec" && action !== "prepare-sprint") return undefined;
  }

  return {
    version: 1,
    action,
    ...(typeof label === "string" ? { label } : {}),
    ...(typeof command === "string" ? { command } : {}),
  };
}

export function parseCanvasEdgeStyle(value: unknown): CanvasEdgeStyle | undefined {
  if (!isRecord(value) || value["version"] !== 1) return undefined;
  if (value["route"] !== undefined && !ROUTES.has(value["route"] as string)) return undefined;
  if (value["stroke"] !== undefined && !STROKES.has(value["stroke"] as string)) return undefined;
  const relationship = value["relationship"];
  if (
    relationship !== undefined &&
    (typeof relationship !== "string" ||
      relationship.trim() !== relationship ||
      relationship.length === 0 ||
      relationship.length > EDGE_RELATIONSHIP_MAX_LENGTH ||
      hasControlCharacter(relationship))
  ) {
    return undefined;
  }
  const opacity = value["opacity"];
  if (
    opacity !== undefined &&
    (typeof opacity !== "number" || !Number.isFinite(opacity) || opacity < 0 || opacity > 1)
  ) {
    return undefined;
  }
  const waypoints = value["waypoints"];
  if (
    waypoints !== undefined &&
    (!Array.isArray(waypoints) ||
      waypoints.length > EDGE_WAYPOINT_LIMIT ||
      waypoints.some(
        (point) =>
          !isRecord(point) ||
          typeof point["x"] !== "number" ||
          !Number.isFinite(point["x"]) ||
          typeof point["y"] !== "number" ||
          !Number.isFinite(point["y"]),
      ))
  ) {
    return undefined;
  }
  return value as unknown as CanvasEdgeStyle;
}

export function parseCanvasEdgeProvenance(value: unknown): CanvasEdgeProvenance | undefined {
  if (
    !isRecord(value) ||
    value["version"] !== 1 ||
    value["kind"] !== "declared-dependency" ||
    typeof value["owner"] !== "string"
  ) {
    return undefined;
  }
  if (value["detached"] !== undefined && typeof value["detached"] !== "boolean") return undefined;
  for (const key of ["generatedEdgeId", "suppressionKey"] as const) {
    const identity = value[key];
    if (
      identity !== undefined &&
      (typeof identity !== "string" ||
        identity.length === 0 ||
        identity.length > 512 ||
        hasControlCharacter(identity))
    ) {
      return undefined;
    }
  }
  return value as unknown as CanvasEdgeProvenance;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasControlCharacter(value: string): boolean {
  return [...value].some((character) => {
    const code = character.codePointAt(0) ?? 0;
    return code < 32 || code === 127;
  });
}
