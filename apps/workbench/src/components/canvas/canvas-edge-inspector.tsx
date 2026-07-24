/**
 * Multi-edge inspector for portable JSON Canvas fields and inert AFX edge style.
 *
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-28] [FR-39] [FR-41]
 */
import { useRef, useState } from "react";

import { Route } from "lucide-react";

import { detachGeneratedDependencies, parseCanvasEdgeStyle } from "@afx/canvas-engine";
import type {
  CanvasEdge,
  CanvasEdgeRoute,
  CanvasEdgeStroke,
  CanvasEdgeStyle,
  JSONCanvas,
} from "@afx/shared";
import { Button } from "@afx/ui/components/button";
import { Popover, PopoverContent, PopoverTrigger } from "@afx/ui/components/popover";

export interface CanvasEdgeInspectorProps {
  canvas: JSONCanvas;
  selectedEdgeIds: readonly string[];
  onApply: (nextCanvas: JSONCanvas) => void;
}

interface EdgeInspectorDraft {
  label: string;
  labelMixed: boolean;
  relationship: string;
  customRelationship: string;
  route: CanvasEdgeRoute | "mixed";
  stroke: CanvasEdgeStroke | "mixed";
  fromEnd: "none" | "arrow" | "mixed";
  toEnd: "none" | "arrow" | "mixed";
  color: string;
  colorMixed: boolean;
  opacity: string;
  opacityMixed: boolean;
  waypoints: Array<{ x: string; y: string }>;
}

interface KeyedDraft {
  key: string;
  value: EdgeInspectorDraft;
}

interface KeyedMessage {
  key: string;
  text: string;
}

interface EdgeStyleClipboard {
  color?: string;
  fromEnd?: CanvasEdge["fromEnd"];
  toEnd?: CanvasEdge["toEnd"];
  afxStyle?: CanvasEdgeStyle;
}

const RELATIONSHIPS = [
  { value: "depends-on", label: "Depends on", relationship: "depends on" },
  { value: "implements", label: "Implements", relationship: "implements" },
  { value: "emits", label: "Emits", relationship: "emits" },
  { value: "consumes", label: "Consumes", relationship: "consumes" },
  { value: "reads", label: "Reads", relationship: "reads" },
  { value: "writes", label: "Writes", relationship: "writes" },
  { value: "blocks", label: "Blocks", relationship: "blocks" },
  { value: "validates", label: "Validates", relationship: "validates" },
] as const;

const WAYPOINT_LIMIT = 64;
const WAYPOINT_BOUND = 1_000_000;

export function CanvasEdgeInspector({
  canvas,
  selectedEdgeIds,
  onApply,
}: CanvasEdgeInspectorProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<KeyedDraft>();
  const [error, setError] = useState<KeyedMessage>();
  const [feedback, setFeedback] = useState<KeyedMessage>();
  const [clipboard, setClipboard] = useState<EdgeStyleClipboard>();
  const clipboardRef = useRef<EdgeStyleClipboard | undefined>(undefined);

  const selectionKey = [...selectedEdgeIds].sort().join("\u0000");
  const selectedEdges = (canvas.edges ?? []).filter((edge) => selectedEdgeIds.includes(edge.id));
  const editorKey =
    selectionKey +
    "\u0001" +
    JSON.stringify(
      selectedEdges.map((edge) => ({
        id: edge.id,
        label: edge.label,
        color: edge.color,
        fromEnd: edge.fromEnd,
        toEnd: edge.toEnd,
        afxStyle: edge.afxStyle,
        afxProvenance: edge.afxProvenance,
      })),
    );
  const currentDraft = draft?.key === editorKey ? draft.value : deriveDraft(selectedEdges);
  const errorMessage = error?.key === selectionKey ? error.text : undefined;
  const feedbackMessage = feedback?.key === selectionKey ? feedback.text : undefined;
  const detachableCount = selectedEdges.filter(
    (edge) =>
      edge.afxProvenance?.kind === "declared-dependency" && edge.afxProvenance.detached !== true,
  ).length;

  const updateDraft = (patch: Partial<EdgeInspectorDraft>): void => {
    setDraft((current) => ({
      key: editorKey,
      value: {
        ...(current?.key === editorKey ? current.value : deriveDraft(selectedEdges)),
        ...patch,
      },
    }));
  };

  const reportFailure = (cause: unknown, fallback: string): void => {
    setFeedback(undefined);
    setError({
      key: selectionKey,
      text: cause instanceof Error ? cause.message : fallback,
    });
  };

  const runValidated = (action: () => void, fallback: string): void => {
    try {
      action();
    } catch (cause) {
      reportFailure(cause, fallback);
    }
  };

  const applyToSelected = (
    label: string,
    update: (edge: CanvasEdge) => CanvasEdge,
    successMessage = label + " applied.",
  ): void => {
    try {
      const edges = requireSelectedEdges(canvas, selectedEdgeIds);
      const selected = new Set(edges.map((edge) => edge.id));
      const next: JSONCanvas = {
        ...canvas,
        edges: (canvas.edges ?? []).map((edge) => (selected.has(edge.id) ? update(edge) : edge)),
      };
      onApply(next);
      setError(undefined);
      setFeedback({ key: selectionKey, text: successMessage });
    } catch (cause) {
      reportFailure(cause, "Canvas edge update failed.");
    }
  };

  const applyLabel = (): void => {
    runValidated(() => {
      const label = validateSafeText(currentDraft.label, "Edge label", 160, true);
      applyToSelected("Label", (edge) =>
        patchEdge(edge, { label: label.length === 0 ? undefined : label }),
      );
    }, "Canvas edge label could not be applied.");
  };

  const applyRelationship = (): void => {
    if (currentDraft.relationship === "mixed") {
      setError({ key: selectionKey, text: "Choose a relationship before applying it." });
      return;
    }
    runValidated(() => {
      const relationship =
        currentDraft.relationship === "custom"
          ? validateSafeText(currentDraft.customRelationship.trim(), "Custom relationship", 64)
          : RELATIONSHIPS.find((item) => item.value === currentDraft.relationship)?.relationship;
      applyToSelected("Relationship", (edge) => {
        const style = mutableStyle(edge);
        if (relationship) style.relationship = relationship;
        else delete style.relationship;
        return patchEdge(edge, {
          afxStyle: validateStyle(style),
          ...(relationship ? { label: relationship } : {}),
        });
      });
    }, "Canvas edge relationship could not be applied.");
  };

  const applyConnector = (): void => {
    applyToSelected("Connector", (edge) => {
      const style = mutableStyle(edge);
      if (currentDraft.route !== "mixed") style.route = currentDraft.route;
      if (currentDraft.stroke !== "mixed") style.stroke = currentDraft.stroke;
      return patchEdge(edge, {
        afxStyle: validateStyle(style),
        ...(currentDraft.fromEnd === "mixed" ? {} : { fromEnd: currentDraft.fromEnd }),
        ...(currentDraft.toEnd === "mixed" ? {} : { toEnd: currentDraft.toEnd }),
      });
    });
  };

  const applyAppearance = (): void => {
    runValidated(() => {
      const color =
        currentDraft.color.trim() === "" && currentDraft.colorMixed
          ? undefined
          : validateColor(currentDraft.color.trim());
      const opacity =
        currentDraft.opacity.trim() === "" && currentDraft.opacityMixed
          ? undefined
          : validateOpacity(currentDraft.opacity);
      applyToSelected("Appearance", (edge) => {
        const style = mutableStyle(edge);
        if (opacity !== undefined) style.opacity = opacity;
        return patchEdge(edge, {
          afxStyle: validateStyle(style),
          ...(color === undefined ? {} : { color }),
        });
      });
    }, "Canvas edge appearance could not be applied.");
  };

  const applyWaypoints = (): void => {
    if (selectedEdgeIds.length !== 1) {
      setError({ key: selectionKey, text: "Select exactly one edge to edit waypoints." });
      return;
    }
    runValidated(() => {
      const waypoints = currentDraft.waypoints.map((point, index) => ({
        x: validateWaypointCoordinate(point.x, index, "x"),
        y: validateWaypointCoordinate(point.y, index, "y"),
      }));
      applyToSelected("Waypoints", (edge) => {
        const style = mutableStyle(edge);
        if (waypoints.length > 0) style.waypoints = waypoints;
        else delete style.waypoints;
        return patchEdge(edge, { afxStyle: validateStyle(style) });
      });
    }, "Canvas edge waypoints could not be applied.");
  };

  const copyStyle = (): void => {
    try {
      const [edge] = requireSelectedEdges(canvas, selectedEdgeIds);
      if (!edge || selectedEdgeIds.length !== 1) {
        throw new Error("Select exactly one edge as the style source.");
      }
      const copied = {
        ...(edge.color === undefined ? {} : { color: edge.color }),
        ...(edge.fromEnd === undefined ? {} : { fromEnd: edge.fromEnd }),
        ...(edge.toEnd === undefined ? {} : { toEnd: edge.toEnd }),
        ...(edge.afxStyle === undefined ? {} : { afxStyle: structuredClone(edge.afxStyle) }),
      } satisfies EdgeStyleClipboard;
      clipboardRef.current = copied;
      setClipboard(copied);
      setError(undefined);
      setFeedback({ key: selectionKey, text: "Edge style copied. Select edges to paste it." });
    } catch (cause) {
      reportFailure(cause, "Canvas edge style could not be copied.");
    }
  };

  const pasteStyle = (): void => {
    const copied = clipboardRef.current ?? clipboard;
    if (!copied) return;
    applyToSelected("Edge style", (edge) =>
      patchEdge(edge, {
        color: copied.color,
        fromEnd: copied.fromEnd,
        toEnd: copied.toEnd,
        afxStyle: copied.afxStyle ? structuredClone(copied.afxStyle) : undefined,
      }),
    );
  };

  const detachGenerated = (): void => {
    try {
      const next = detachGeneratedDependencies(canvas, selectedEdgeIds);
      onApply(next);
      setError(undefined);
      setFeedback({
        key: selectionKey,
        text: "Detached generated dependency as a fresh manual edge with durable suppression.",
      });
    } catch (cause) {
      reportFailure(cause, "Canvas dependency detach failed.");
    }
  };

  const status =
    feedbackMessage ??
    (selectedEdgeIds.length === 0
      ? "Select at least one edge to inspect."
      : selectedEdgeIds.length +
        " edge" +
        (selectedEdgeIds.length === 1 ? "" : "s") +
        " selected.");
  const selectionDisabled = selectedEdgeIds.length === 0;
  const waypointDisabled = selectedEdgeIds.length !== 1;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Inspect selected edges"
          title="Inspect selected edges"
          className="rounded-sm p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Route size={13} aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        aria-label="Canvas edge inspector"
        className="max-h-[min(80vh,44rem)] w-[min(24rem,calc(100vw-1rem))] overflow-y-auto p-2"
      >
        <div className="space-y-2">
          <div>
            <h2 className="text-xs font-medium">Edge inspector</h2>
            <p className="text-[10px] leading-4 text-muted-foreground">
              Edit portable labels and markers with optional AFX relationship and routing style.
            </p>
          </div>
          <p
            role="status"
            className="rounded-sm border bg-muted/20 px-2 py-1 text-[10px] text-muted-foreground"
          >
            {status}
          </p>
          {errorMessage ? (
            <p
              role="alert"
              className="rounded-sm border border-destructive/40 bg-destructive/10 p-1.5 text-[10px] text-destructive"
            >
              {errorMessage}
            </p>
          ) : null}

          <InspectorSection title="Label">
            <div className="grid grid-cols-[1fr_auto] gap-1">
              <label className="grid gap-0.5 text-[9px] text-muted-foreground">
                Label
                <input
                  aria-label="Edge label"
                  value={currentDraft.label}
                  placeholder={currentDraft.labelMixed ? "Mixed values" : "Optional label"}
                  onChange={(event) =>
                    updateDraft({ label: event.target.value, labelMixed: false })
                  }
                  className="min-w-0 rounded-sm border bg-background px-1.5 py-1 text-[10px] text-foreground"
                />
              </label>
              <Button
                size="xs"
                variant="outline"
                className="self-end"
                disabled={selectionDisabled}
                title={selectionDisabled ? "Select at least one edge" : undefined}
                onClick={applyLabel}
              >
                Apply label
              </Button>
            </div>
          </InspectorSection>

          <InspectorSection title="Relationship">
            <div className="grid grid-cols-[1fr_1fr_auto] gap-1">
              <label className="grid gap-0.5 text-[9px] text-muted-foreground">
                Semantic type
                <select
                  aria-label="Relationship"
                  value={currentDraft.relationship}
                  onChange={(event) => updateDraft({ relationship: event.target.value })}
                  className="min-w-0 rounded-sm border bg-background px-1 py-1 text-[10px] text-foreground"
                >
                  {currentDraft.relationship === "mixed" ? (
                    <option value="mixed">Mixed</option>
                  ) : null}
                  <option value="none">None</option>
                  {RELATIONSHIPS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                  <option value="custom">Custom…</option>
                </select>
              </label>
              <label className="grid gap-0.5 text-[9px] text-muted-foreground">
                Custom
                <input
                  aria-label="Custom relationship"
                  disabled={currentDraft.relationship !== "custom"}
                  value={currentDraft.customRelationship}
                  onChange={(event) => updateDraft({ customRelationship: event.target.value })}
                  className="min-w-0 rounded-sm border bg-background px-1.5 py-1 text-[10px] text-foreground"
                />
              </label>
              <Button
                size="xs"
                variant="outline"
                className="self-end"
                disabled={selectionDisabled || currentDraft.relationship === "mixed"}
                title={
                  selectionDisabled
                    ? "Select at least one edge"
                    : currentDraft.relationship === "mixed"
                      ? "Choose one relationship"
                      : undefined
                }
                onClick={applyRelationship}
              >
                Apply relationship
              </Button>
            </div>
          </InspectorSection>

          <InspectorSection title="Connector">
            <div className="grid grid-cols-2 gap-1">
              <EdgeSelect
                label="Edge route"
                value={currentDraft.route}
                mixed={currentDraft.route === "mixed"}
                options={[
                  ["bezier", "Bezier"],
                  ["straight", "Straight"],
                  ["step", "Step"],
                  ["smoothstep", "Smooth step"],
                ]}
                onChange={(value) => updateDraft({ route: value as EdgeInspectorDraft["route"] })}
              />
              <EdgeSelect
                label="Edge stroke"
                value={currentDraft.stroke}
                mixed={currentDraft.stroke === "mixed"}
                options={[
                  ["solid", "Solid"],
                  ["dashed", "Dashed"],
                  ["dotted", "Dotted"],
                ]}
                onChange={(value) => updateDraft({ stroke: value as EdgeInspectorDraft["stroke"] })}
              />
              <EdgeSelect
                label="Start marker"
                value={currentDraft.fromEnd}
                mixed={currentDraft.fromEnd === "mixed"}
                options={[
                  ["none", "None"],
                  ["arrow", "Arrow"],
                ]}
                onChange={(value) =>
                  updateDraft({ fromEnd: value as EdgeInspectorDraft["fromEnd"] })
                }
              />
              <EdgeSelect
                label="End marker"
                value={currentDraft.toEnd}
                mixed={currentDraft.toEnd === "mixed"}
                options={[
                  ["none", "None"],
                  ["arrow", "Arrow"],
                ]}
                onChange={(value) => updateDraft({ toEnd: value as EdgeInspectorDraft["toEnd"] })}
              />
            </div>
            <div className="flex justify-end pt-1">
              <Button
                size="xs"
                variant="outline"
                disabled={selectionDisabled}
                title={selectionDisabled ? "Select at least one edge" : undefined}
                onClick={applyConnector}
              >
                Apply connector
              </Button>
            </div>
          </InspectorSection>

          <InspectorSection title="Appearance">
            <div className="grid grid-cols-[1fr_5rem_auto] gap-1">
              <label className="grid gap-0.5 text-[9px] text-muted-foreground">
                Color
                <input
                  aria-label="Edge color"
                  value={currentDraft.color}
                  placeholder={currentDraft.colorMixed ? "Mixed values" : "1-6 or #RRGGBB"}
                  onChange={(event) =>
                    updateDraft({ color: event.target.value, colorMixed: false })
                  }
                  className="min-w-0 rounded-sm border bg-background px-1.5 py-1 text-[10px] text-foreground"
                />
              </label>
              <label className="grid gap-0.5 text-[9px] text-muted-foreground">
                Opacity
                <input
                  type="number"
                  aria-label="Edge opacity"
                  min={0}
                  max={1}
                  step={0.05}
                  value={currentDraft.opacity}
                  placeholder={currentDraft.opacityMixed ? "Mixed" : "1"}
                  onChange={(event) =>
                    updateDraft({ opacity: event.target.value, opacityMixed: false })
                  }
                  className="min-w-0 rounded-sm border bg-background px-1 py-1 text-[10px] text-foreground"
                />
              </label>
              <Button
                size="xs"
                variant="outline"
                className="self-end"
                disabled={selectionDisabled}
                title={selectionDisabled ? "Select at least one edge" : undefined}
                onClick={applyAppearance}
              >
                Apply appearance
              </Button>
            </div>
          </InspectorSection>

          <InspectorSection title="Waypoints">
            {waypointDisabled ? (
              <p className="text-[10px] text-muted-foreground">
                Select exactly one edge to edit waypoints.
              </p>
            ) : (
              <div className="space-y-1">
                {currentDraft.waypoints.map((point, index) => (
                  <div key={index} className="grid grid-cols-[1fr_1fr_auto] gap-1">
                    <label className="grid gap-0.5 text-[9px] text-muted-foreground">
                      X
                      <input
                        type="number"
                        aria-label={"Waypoint " + (index + 1) + " x"}
                        value={point.x}
                        onChange={(event) =>
                          updateDraft({
                            waypoints: currentDraft.waypoints.map((candidate, candidateIndex) =>
                              candidateIndex === index
                                ? { ...candidate, x: event.target.value }
                                : candidate,
                            ),
                          })
                        }
                        className="min-w-0 rounded-sm border bg-background px-1 py-1 text-[10px] text-foreground"
                      />
                    </label>
                    <label className="grid gap-0.5 text-[9px] text-muted-foreground">
                      Y
                      <input
                        type="number"
                        aria-label={"Waypoint " + (index + 1) + " y"}
                        value={point.y}
                        onChange={(event) =>
                          updateDraft({
                            waypoints: currentDraft.waypoints.map((candidate, candidateIndex) =>
                              candidateIndex === index
                                ? { ...candidate, y: event.target.value }
                                : candidate,
                            ),
                          })
                        }
                        className="min-w-0 rounded-sm border bg-background px-1 py-1 text-[10px] text-foreground"
                      />
                    </label>
                    <Button
                      size="xs"
                      variant="ghost"
                      className="self-end"
                      aria-label={"Remove waypoint " + (index + 1)}
                      title={"Remove waypoint " + (index + 1)}
                      onClick={() =>
                        updateDraft({
                          waypoints: currentDraft.waypoints.filter(
                            (_candidate, candidateIndex) => candidateIndex !== index,
                          ),
                        })
                      }
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-end gap-1 pt-1">
              <Button
                size="xs"
                variant="ghost"
                disabled={waypointDisabled || currentDraft.waypoints.length >= WAYPOINT_LIMIT}
                title={
                  waypointDisabled
                    ? "Select exactly one edge"
                    : currentDraft.waypoints.length >= WAYPOINT_LIMIT
                      ? "Waypoint limit reached"
                      : undefined
                }
                onClick={() =>
                  updateDraft({
                    waypoints: [...currentDraft.waypoints, { x: "0", y: "0" }],
                  })
                }
              >
                Add waypoint
              </Button>
              <Button
                size="xs"
                variant="outline"
                disabled={waypointDisabled}
                title={waypointDisabled ? "Select exactly one edge" : undefined}
                onClick={applyWaypoints}
              >
                Apply waypoints
              </Button>
            </div>
          </InspectorSection>

          <InspectorSection title="Reuse and ownership">
            <div className="flex flex-wrap gap-1">
              <ActionButton
                label="Copy edge style"
                disabledReason={
                  selectedEdgeIds.length === 1
                    ? undefined
                    : "Select exactly one edge as the style source"
                }
                onClick={copyStyle}
              />
              <ActionButton
                label="Paste edge style"
                disabledReason={
                  selectionDisabled
                    ? "Select at least one edge"
                    : clipboard
                      ? undefined
                      : "Copy an edge style before pasting"
                }
                onClick={pasteStyle}
              />
              <ActionButton
                label="Detach generated dependency"
                disabledReason={
                  detachableCount > 0 ? undefined : "No generated dependency selected"
                }
                onClick={detachGenerated}
              />
            </div>
            {detachableCount > 0 ? (
              <p className="text-[9px] leading-4 text-muted-foreground">
                Detach keeps the stable dependency identity as a durable suppression record.
              </p>
            ) : null}
          </InspectorSection>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function deriveDraft(edges: readonly CanvasEdge[]): EdgeInspectorDraft {
  const label = commonValue(edges, (edge) => edge.label ?? "");
  const relationship = commonValue(edges, (edge) => edge.afxStyle?.relationship ?? "");
  const route = commonValue(edges, (edge) => edge.afxStyle?.route ?? "bezier");
  const stroke = commonValue(edges, (edge) => edge.afxStyle?.stroke ?? "solid");
  const fromEnd = commonValue(edges, (edge) => edge.fromEnd ?? "none");
  const toEnd = commonValue(edges, (edge) => edge.toEnd ?? "arrow");
  const color = commonValue(edges, (edge) => edge.color ?? "");
  const opacity = commonValue(edges, (edge) => edge.afxStyle?.opacity ?? 1);
  const relationshipPreset = relationship.mixed
    ? "mixed"
    : relationship.value === ""
      ? "none"
      : (RELATIONSHIPS.find((item) => item.relationship === relationship.value)?.value ?? "custom");
  return {
    label: label.mixed ? "" : label.value,
    labelMixed: label.mixed,
    relationship: relationshipPreset,
    customRelationship: relationshipPreset === "custom" ? relationship.value : "",
    route: route.mixed ? "mixed" : route.value,
    stroke: stroke.mixed ? "mixed" : stroke.value,
    fromEnd: fromEnd.mixed ? "mixed" : fromEnd.value,
    toEnd: toEnd.mixed ? "mixed" : toEnd.value,
    color: color.mixed ? "" : color.value,
    colorMixed: color.mixed,
    opacity: opacity.mixed ? "" : String(opacity.value),
    opacityMixed: opacity.mixed,
    waypoints:
      edges.length === 1
        ? (edges[0]?.afxStyle?.waypoints ?? []).map((point) => ({
            x: String(point.x),
            y: String(point.y),
          }))
        : [],
  };
}

function commonValue<T>(
  edges: readonly CanvasEdge[],
  read: (edge: CanvasEdge) => T,
): { mixed: boolean; value: T } {
  const first = edges[0];
  if (!first) return { mixed: false, value: read(emptyEdge()) };
  const value = read(first);
  return {
    mixed: edges.slice(1).some((edge) => !Object.is(read(edge), value)),
    value,
  };
}

function emptyEdge(): CanvasEdge {
  return { id: "", fromNode: "", toNode: "" };
}

function requireSelectedEdges(
  canvas: JSONCanvas,
  selectedEdgeIds: readonly string[],
): CanvasEdge[] {
  if (selectedEdgeIds.length === 0) throw new Error("Select at least one edge.");
  if (new Set(selectedEdgeIds).size !== selectedEdgeIds.length) {
    throw new Error("Selected edge IDs must be unique.");
  }
  const byId = new Map((canvas.edges ?? []).map((edge) => [edge.id, edge]));
  const missing = [...selectedEdgeIds].filter((id) => !byId.has(id)).sort();
  if (missing.length > 0) throw new Error("Unknown selected edges: " + missing.join(", "));
  return selectedEdgeIds.map((id) => byId.get(id)!);
}

function mutableStyle(edge: CanvasEdge): CanvasEdgeStyle {
  return { ...edge.afxStyle, version: 1 };
}

function validateStyle(style: CanvasEdgeStyle): CanvasEdgeStyle {
  const parsed = parseCanvasEdgeStyle(style);
  if (!parsed) throw new Error("Edge style contains unsupported or unsafe values.");
  return parsed;
}

function patchEdge(edge: CanvasEdge, patch: Partial<CanvasEdge>): CanvasEdge {
  const next = { ...edge, ...patch };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) delete next[key];
  }
  return next;
}

function validateSafeText(
  value: string,
  owner: string,
  maximum: number,
  allowEmpty = false,
): string {
  const normalized = value.trim();
  const hasControl = [...normalized].some((character) => {
    const code = character.codePointAt(0) ?? 0;
    return code < 32 || code === 127;
  });
  if ((!allowEmpty && normalized.length === 0) || normalized.length > maximum || hasControl) {
    throw new Error(
      owner +
        " must be safe text between " +
        (allowEmpty ? 0 : 1) +
        " and " +
        maximum +
        " characters.",
    );
  }
  return normalized;
}

function validateColor(value: string): string {
  if (
    !/^[1-6]$/.test(value) &&
    !/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(value)
  ) {
    throw new Error("Edge color must be preset 1-6 or a hexadecimal color.");
  }
  return value;
}

function validateOpacity(value: string): number {
  const opacity = Number(value);
  if (value.trim() === "" || !Number.isFinite(opacity) || opacity < 0 || opacity > 1) {
    throw new Error("Edge opacity must be a finite number between 0 and 1.");
  }
  return opacity;
}

function validateWaypointCoordinate(value: string, index: number, axis: "x" | "y"): number {
  const coordinate = Number(value);
  if (
    value.trim() === "" ||
    !Number.isFinite(coordinate) ||
    coordinate < -WAYPOINT_BOUND ||
    coordinate > WAYPOINT_BOUND
  ) {
    throw new Error(
      "Waypoint " + (index + 1) + " " + axis + " must be between -1,000,000 and 1,000,000.",
    );
  }
  return coordinate;
}

function InspectorSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1 rounded-sm border p-1.5">
      <h3 className="text-[10px] font-medium uppercase tracking-wide">{title}</h3>
      {children}
    </section>
  );
}

function EdgeSelect({
  label,
  value,
  mixed,
  options,
  onChange,
}: {
  label: string;
  value: string;
  mixed: boolean;
  options: ReadonlyArray<readonly [string, string]>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-0.5 text-[9px] text-muted-foreground">
      {label}
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-sm border bg-background px-1 py-1 text-[10px] text-foreground"
      >
        {mixed ? <option value="mixed">Mixed</option> : null}
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function ActionButton({
  label,
  disabledReason,
  onClick,
}: {
  label: string;
  disabledReason?: string;
  onClick: () => void;
}) {
  return (
    <Button
      size="xs"
      variant="outline"
      disabled={Boolean(disabledReason)}
      title={disabledReason ?? label}
      onClick={onClick}
    >
      {label}
    </Button>
  );
}
