/**
 * Selection-first composition controls backed by immutable Canvas engine proposals.
 *
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-38] [FR-39] [FR-41]
 */
import { useState } from "react";

import { SlidersHorizontal } from "lucide-react";

import {
  type CanvasCompositionOperation,
  type CanvasContainedNodeTransform,
  type CanvasNodeStyleSnapshot,
  copyCanvasNodeStyle,
  createCanvasCompositionReplacement,
  proposeCanvasComposition,
} from "@afx/canvas-engine";
import type { CanvasNode, JSONCanvas } from "@afx/shared";
import { Button } from "@afx/ui/components/button";
import { Popover, PopoverContent, PopoverTrigger } from "@afx/ui/components/popover";

export interface CanvasCompositionControlsProps {
  canvas: JSONCanvas;
  selectedNodeIds: readonly string[];
  onApply: (nextCanvas: JSONCanvas) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

interface FrameBoundsInput {
  x: string;
  y: string;
  width: string;
  height: string;
}

interface SelectionMessage {
  selectionKey: string;
  text: string;
}

interface FrameBoundsDraft {
  frameKey: string;
  bounds: FrameBoundsInput;
}

interface GroupPresentationDraft {
  frameKey: string;
  label: string;
  background: string;
  backgroundStyle: "cover" | "ratio" | "repeat";
  collapsed: boolean;
  presentationOrder: string;
}

const EMPTY_FRAME_BOUNDS: FrameBoundsInput = { x: "", y: "", width: "", height: "" };

const SHAPES = [
  { value: "none", label: "Default" },
  { value: "card", label: "Card" },
  { value: "component", label: "Component" },
  { value: "service", label: "Service" },
  { value: "database", label: "Database" },
  { value: "decision", label: "Decision" },
] as const;

const DENSITIES = [
  { value: "none", label: "Default" },
  { value: "compact", label: "Compact" },
  { value: "comfortable", label: "Comfortable" },
  { value: "spacious", label: "Spacious" },
] as const;

const TYPOGRAPHY = [
  { value: "none", label: "Default" },
  { value: "body", label: "Body" },
  { value: "heading", label: "Heading" },
  { value: "mono", label: "Monospace" },
] as const;

export function CanvasCompositionControls({
  canvas,
  selectedNodeIds,
  onApply,
  open: controlledOpen,
  onOpenChange,
}: CanvasCompositionControlsProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (next: boolean): void => {
    if (controlledOpen === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  };
  const [error, setError] = useState<SelectionMessage>();
  const [feedback, setFeedback] = useState<SelectionMessage>();
  const [copiedStyle, setCopiedStyle] = useState<CanvasNodeStyleSnapshot>();
  const [frameLabel, setFrameLabel] = useState("Frame");
  const [framePadding, setFramePadding] = useState("24");
  const [color, setColor] = useState("");
  const [shape, setShape] = useState("none");
  const [density, setDensity] = useState("none");
  const [typography, setTypography] = useState("none");
  const [icon, setIcon] = useState("");
  const [lane, setLane] = useState("");
  const [containedNodes, setContainedNodes] = useState<CanvasContainedNodeTransform>("preserve");
  const [frameBoundsDraft, setFrameBoundsDraft] = useState<FrameBoundsDraft>();
  const [groupPresentationDraft, setGroupPresentationDraft] = useState<GroupPresentationDraft>();

  const selectionKey = [...selectedNodeIds].sort().join("\u0000");
  const selectedNodes = selectedNodeIds
    .map((id) => canvas.nodes?.find((candidate) => candidate.id === id))
    .filter((node): node is CanvasNode => Boolean(node));
  const lockedCount = selectedNodes.filter((node) => hasLayoutFlag(node, "locked")).length;
  const pinnedCount = selectedNodes.filter((node) => hasLayoutFlag(node, "pinned")).length;
  const selectedFrame =
    selectedNodeIds.length === 1 && selectedNodes[0]?.type === "group"
      ? selectedNodes[0]
      : undefined;

  const selectedFrameKey = selectedFrame
    ? [
        selectedFrame.id,
        selectedFrame.x,
        selectedFrame.y,
        selectedFrame.width,
        selectedFrame.height,
        selectedFrame.label,
        selectedFrame.background,
        selectedFrame.backgroundStyle,
        selectedFrame.afxGroup?.collapsed,
        selectedFrame.afxGroup?.presentationOrder,
      ].join("\u0000")
    : "";
  const frameBounds =
    frameBoundsDraft?.frameKey === selectedFrameKey
      ? frameBoundsDraft.bounds
      : selectedFrame
        ? {
            x: String(selectedFrame.x),
            y: String(selectedFrame.y),
            width: String(selectedFrame.width),
            height: String(selectedFrame.height),
          }
        : EMPTY_FRAME_BOUNDS;
  const groupPresentation =
    groupPresentationDraft?.frameKey === selectedFrameKey
      ? groupPresentationDraft
      : {
          frameKey: selectedFrameKey,
          label: selectedFrame?.label ?? "",
          background: selectedFrame?.background ?? "",
          backgroundStyle: selectedFrame?.backgroundStyle ?? "cover",
          collapsed:
            selectedFrame?.afxGroup?.version === 1 && selectedFrame.afxGroup.collapsed === true,
          presentationOrder:
            selectedFrame?.afxGroup?.version === 1 &&
            typeof selectedFrame.afxGroup.presentationOrder === "number"
              ? String(selectedFrame.afxGroup.presentationOrder)
              : "",
        };

  const updateGroupPresentationDraft = (
    patch: Partial<Omit<GroupPresentationDraft, "frameKey">>,
  ): void => {
    setGroupPresentationDraft((current) => ({
      ...(current?.frameKey === selectedFrameKey ? current : groupPresentation),
      ...patch,
      frameKey: selectedFrameKey,
    }));
  };

  const errorMessage = error?.selectionKey === selectionKey ? error.text : undefined;
  const feedbackMessage = feedback?.selectionKey === selectionKey ? feedback.text : undefined;

  const canMutate = (minimum = 1): boolean =>
    selectedNodeIds.length >= minimum && lockedCount === 0;

  const disabledReason = (minimum: number): string | undefined => {
    if (lockedCount > 0) return "Unlock the selection before changing composition";
    if (selectedNodeIds.length < minimum) {
      return "Select at least " + minimum + " unlocked item" + (minimum === 1 ? "" : "s");
    }
    return undefined;
  };

  const apply = (label: string, operation: CanvasCompositionOperation): void => {
    try {
      const proposal = proposeCanvasComposition(canvas, operation);
      const replacement = createCanvasCompositionReplacement(canvas, proposal);
      onApply(replacement.document);
      setError(undefined);
      setFeedback({ selectionKey, text: label + " applied." });
    } catch (cause) {
      setFeedback(undefined);
      setError({
        selectionKey,
        text: cause instanceof Error ? cause.message : "Canvas composition failed.",
      });
    }
  };

  const copyStyle = (): void => {
    const sourceId = selectedNodeIds[0];
    if (!sourceId) return;
    try {
      setCopiedStyle(copyCanvasNodeStyle(canvas, sourceId));
      setError(undefined);
      setFeedback({ selectionKey, text: "Style copied. Select another item to paste it." });
    } catch (cause) {
      setFeedback(undefined);
      setError({
        selectionKey,
        text: cause instanceof Error ? cause.message : "Canvas style could not be copied.",
      });
    }
  };

  const createFrame = (): void => {
    apply("Frame", {
      kind: "createFrame",
      nodeIds: selectedNodeIds,
      frame: {
        id: nextFrameId(canvas),
        label: frameLabel.trim() || "Frame",
        padding: Number(framePadding),
        metadata: { afxNodeKind: "frame" },
      },
    });
  };

  const transformFrame = (): void => {
    if (!selectedFrame) return;
    apply("Frame transform", {
      kind: "transformFrame",
      frameId: selectedFrame.id,
      bounds: {
        x: Number(frameBounds.x),
        y: Number(frameBounds.y),
        width: Number(frameBounds.width),
        height: Number(frameBounds.height),
      },
      containedNodes,
    });
  };

  const frameBoundsValid =
    selectedFrame !== undefined &&
    [frameBounds.x, frameBounds.y, frameBounds.width, frameBounds.height].every(
      (value) => value.trim() !== "" && Number.isFinite(Number(value)),
    ) &&
    Number(frameBounds.width) > 0 &&
    Number(frameBounds.height) > 0;

  const status =
    feedbackMessage ??
    (selectedNodeIds.length === 0
      ? "Select at least one item to compose."
      : lockedCount > 0
        ? lockedCount +
          " locked item" +
          (lockedCount === 1 ? "" : "s") +
          " selected. Unlock before changing composition."
        : selectedNodeIds.length +
          " item" +
          (selectedNodeIds.length === 1 ? "" : "s") +
          " selected.");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Compose selection"
          title="Compose selection"
          className="rounded-sm p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <SlidersHorizontal size={13} aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        aria-label="Canvas composition"
        className="max-h-[min(80vh,42rem)] w-[min(24rem,calc(100vw-1rem))] overflow-y-auto p-2"
      >
        <div className="space-y-2">
          <div>
            <h2 className="text-xs font-medium">Composition</h2>
            <p className="text-[10px] leading-4 text-muted-foreground">
              Arrange, frame, and style the current selection. Each action is one undoable edit.
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

          <ControlSection title="Align">
            <ActionButton
              label="Align left"
              disabledReason={disabledReason(2)}
              onClick={() =>
                apply("Align left", {
                  kind: "align",
                  alignment: "left",
                  nodeIds: selectedNodeIds,
                })
              }
            />
            <ActionButton
              label="Align center"
              disabledReason={disabledReason(2)}
              onClick={() =>
                apply("Align center", {
                  kind: "align",
                  alignment: "center",
                  nodeIds: selectedNodeIds,
                })
              }
            />
            <ActionButton
              label="Align right"
              disabledReason={disabledReason(2)}
              onClick={() =>
                apply("Align right", {
                  kind: "align",
                  alignment: "right",
                  nodeIds: selectedNodeIds,
                })
              }
            />
            <ActionButton
              label="Align top"
              disabledReason={disabledReason(2)}
              onClick={() =>
                apply("Align top", {
                  kind: "align",
                  alignment: "top",
                  nodeIds: selectedNodeIds,
                })
              }
            />
            <ActionButton
              label="Align middle"
              disabledReason={disabledReason(2)}
              onClick={() =>
                apply("Align middle", {
                  kind: "align",
                  alignment: "middle",
                  nodeIds: selectedNodeIds,
                })
              }
            />
            <ActionButton
              label="Align bottom"
              disabledReason={disabledReason(2)}
              onClick={() =>
                apply("Align bottom", {
                  kind: "align",
                  alignment: "bottom",
                  nodeIds: selectedNodeIds,
                })
              }
            />
          </ControlSection>

          <ControlSection title="Space and size">
            <ActionButton
              label="Distribute horizontally"
              disabledReason={disabledReason(3)}
              onClick={() =>
                apply("Horizontal distribution", {
                  kind: "distribute",
                  axis: "horizontal",
                  nodeIds: selectedNodeIds,
                })
              }
            />
            <ActionButton
              label="Distribute vertically"
              disabledReason={disabledReason(3)}
              onClick={() =>
                apply("Vertical distribution", {
                  kind: "distribute",
                  axis: "vertical",
                  nodeIds: selectedNodeIds,
                })
              }
            />
            <ActionButton
              label="Equalize width"
              disabledReason={disabledReason(2)}
              onClick={() =>
                apply("Equal width", {
                  kind: "equalizeSize",
                  dimension: "width",
                  nodeIds: selectedNodeIds,
                })
              }
            />
            <ActionButton
              label="Equalize height"
              disabledReason={disabledReason(2)}
              onClick={() =>
                apply("Equal height", {
                  kind: "equalizeSize",
                  dimension: "height",
                  nodeIds: selectedNodeIds,
                })
              }
            />
            <ActionButton
              label="Equalize size"
              disabledReason={disabledReason(2)}
              onClick={() =>
                apply("Equal size", {
                  kind: "equalizeSize",
                  dimension: "both",
                  nodeIds: selectedNodeIds,
                })
              }
            />
          </ControlSection>

          <ControlSection title="Order and position">
            <ActionButton
              label="Bring to front"
              disabledReason={disabledReason(1)}
              onClick={() =>
                apply("Bring to front", {
                  kind: "zOrder",
                  order: "front",
                  nodeIds: selectedNodeIds,
                })
              }
            />
            <ActionButton
              label="Move forward"
              disabledReason={disabledReason(1)}
              onClick={() =>
                apply("Move forward", {
                  kind: "zOrder",
                  order: "forward",
                  nodeIds: selectedNodeIds,
                })
              }
            />
            <ActionButton
              label="Move backward"
              disabledReason={disabledReason(1)}
              onClick={() =>
                apply("Move backward", {
                  kind: "zOrder",
                  order: "backward",
                  nodeIds: selectedNodeIds,
                })
              }
            />
            <ActionButton
              label="Send to back"
              disabledReason={disabledReason(1)}
              onClick={() =>
                apply("Send to back", {
                  kind: "zOrder",
                  order: "back",
                  nodeIds: selectedNodeIds,
                })
              }
            />
          </ControlSection>

          <ControlSection title="Protect">
            <ActionButton
              label="Lock selection"
              disabledReason={
                selectedNodeIds.length === 0
                  ? "Select at least 1 item"
                  : lockedCount === selectedNodeIds.length
                    ? "The selection is already locked"
                    : undefined
              }
              onClick={() =>
                apply("Lock", { kind: "setLocked", locked: true, nodeIds: selectedNodeIds })
              }
            />
            <ActionButton
              label="Unlock selection"
              disabledReason={lockedCount === 0 ? "No locked items selected" : undefined}
              onClick={() =>
                apply("Unlock", { kind: "setLocked", locked: false, nodeIds: selectedNodeIds })
              }
            />
            <ActionButton
              label="Pin selection"
              disabledReason={
                disabledReason(1) ??
                (pinnedCount === selectedNodeIds.length
                  ? "The selection is already pinned"
                  : undefined)
              }
              onClick={() =>
                apply("Pin", { kind: "setPinned", pinned: true, nodeIds: selectedNodeIds })
              }
            />
            <ActionButton
              label="Unpin selection"
              disabledReason={
                lockedCount > 0
                  ? "Unlock the selection before changing pins"
                  : pinnedCount === 0
                    ? "No pinned items selected"
                    : undefined
              }
              onClick={() =>
                apply("Unpin", { kind: "setPinned", pinned: false, nodeIds: selectedNodeIds })
              }
            />
          </ControlSection>

          <section className="space-y-1 rounded-sm border p-1.5" aria-labelledby="frame-heading">
            <h3 id="frame-heading" className="text-[10px] font-medium uppercase tracking-wide">
              Frame
            </h3>
            <div className="grid grid-cols-[1fr_5rem_auto] gap-1">
              <label className="grid gap-0.5 text-[9px] text-muted-foreground">
                Label
                <input
                  aria-label="Frame label"
                  value={frameLabel}
                  onChange={(event) => setFrameLabel(event.target.value)}
                  className="min-w-0 rounded-sm border bg-background px-1.5 py-1 text-[10px] text-foreground"
                />
              </label>
              <label className="grid gap-0.5 text-[9px] text-muted-foreground">
                Padding
                <input
                  type="number"
                  aria-label="Frame padding"
                  min={0}
                  value={framePadding}
                  onChange={(event) => setFramePadding(event.target.value)}
                  className="min-w-0 rounded-sm border bg-background px-1.5 py-1 text-[10px] text-foreground"
                />
              </label>
              <Button
                size="xs"
                variant="outline"
                className="self-end"
                disabled={!canMutate(1)}
                title={disabledReason(1)}
                onClick={createFrame}
              >
                Create frame
              </Button>
            </div>
          </section>

          <section className="space-y-1 rounded-sm border p-1.5" aria-labelledby="style-heading">
            <h3 id="style-heading" className="text-[10px] font-medium uppercase tracking-wide">
              Style
            </h3>
            <div className="flex flex-wrap gap-1">
              <ActionButton
                label="Copy style"
                disabledReason={
                  selectedNodeIds.length !== 1
                    ? "Select exactly 1 item as the style source"
                    : undefined
                }
                onClick={copyStyle}
              />
              <ActionButton
                label="Paste style"
                disabledReason={
                  disabledReason(1) ?? (copiedStyle ? undefined : "Copy a style before pasting")
                }
                onClick={() => {
                  if (!copiedStyle) return;
                  apply("Paste style", {
                    kind: "pasteStyle",
                    nodeIds: selectedNodeIds,
                    style: copiedStyle,
                  });
                }}
              />
            </div>
            <div className="grid grid-cols-[1fr_auto_auto] gap-1">
              <label className="grid gap-0.5 text-[9px] text-muted-foreground">
                Color
                <input
                  aria-label="Node color"
                  value={color}
                  placeholder="1-6 or #RRGGBB"
                  onChange={(event) => setColor(event.target.value)}
                  className="min-w-0 rounded-sm border bg-background px-1.5 py-1 text-[10px] text-foreground"
                />
              </label>
              <Button
                size="xs"
                variant="outline"
                className="self-end"
                disabled={!canMutate(1) || color.trim() === ""}
                title={disabledReason(1) ?? (color.trim() === "" ? "Enter a color" : undefined)}
                onClick={() =>
                  apply("Color", {
                    kind: "patchStyle",
                    nodeIds: selectedNodeIds,
                    patch: { color: color.trim() },
                  })
                }
              >
                Apply color
              </Button>
              <Button
                size="xs"
                variant="ghost"
                className="self-end"
                disabled={!canMutate(1)}
                title={disabledReason(1)}
                onClick={() =>
                  apply("Clear color", {
                    kind: "patchStyle",
                    nodeIds: selectedNodeIds,
                    patch: { color: null },
                  })
                }
              >
                Clear color
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
              <label className="grid gap-0.5 text-[9px] text-muted-foreground">
                Shape
                <select
                  aria-label="Node shape"
                  value={shape}
                  onChange={(event) => setShape(event.target.value)}
                  className="min-w-0 rounded-sm border bg-background px-1 py-1 text-[10px] text-foreground"
                >
                  {SHAPES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-0.5 text-[9px] text-muted-foreground">
                Density
                <select
                  aria-label="Node density"
                  value={density}
                  onChange={(event) => setDensity(event.target.value)}
                  className="min-w-0 rounded-sm border bg-background px-1 py-1 text-[10px] text-foreground"
                >
                  {DENSITIES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-0.5 text-[9px] text-muted-foreground">
                Typography
                <select
                  aria-label="Node typography"
                  value={typography}
                  onChange={(event) => setTypography(event.target.value)}
                  className="min-w-0 rounded-sm border bg-background px-1 py-1 text-[10px] text-foreground"
                >
                  {TYPOGRAPHY.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-0.5 text-[9px] text-muted-foreground">
                Icon
                <input
                  aria-label="Node icon"
                  value={icon}
                  placeholder="server"
                  onChange={(event) => setIcon(event.target.value)}
                  className="min-w-0 rounded-sm border bg-background px-1.5 py-1 text-[10px] text-foreground"
                />
              </label>
            </div>
            <label className="grid gap-0.5 text-[9px] text-muted-foreground">
              Swimlane
              <input
                aria-label="Node swimlane"
                value={lane}
                placeholder="Application services"
                onChange={(event) => setLane(event.target.value)}
                className="min-w-0 rounded-sm border bg-background px-1.5 py-1 text-[10px] text-foreground"
              />
            </label>
            <div className="flex justify-end">
              <Button
                size="xs"
                variant="outline"
                disabled={!canMutate(1)}
                title={disabledReason(1)}
                onClick={() =>
                  apply("Node style", {
                    kind: "patchStyle",
                    nodeIds: selectedNodeIds,
                    patch: {
                      afxStyle: {
                        shape: shape === "none" ? null : shape,
                        density: density === "none" ? null : density,
                        typography: typography === "none" ? null : typography,
                        icon: icon.trim() || null,
                      },
                      afxLayout: { lane: lane.trim() || null },
                    },
                  })
                }
              >
                Apply node style
              </Button>
            </div>
          </section>

          <section
            className="space-y-1 rounded-sm border p-1.5"
            aria-labelledby="group-presentation-heading"
          >
            <h3
              id="group-presentation-heading"
              className="text-[10px] font-medium uppercase tracking-wide"
            >
              Group presentation
            </h3>
            <div className="grid grid-cols-2 gap-1">
              <label className="grid gap-0.5 text-[9px] text-muted-foreground">
                Label
                <input
                  aria-label="Group label"
                  disabled={!selectedFrame}
                  value={groupPresentation.label}
                  onChange={(event) => updateGroupPresentationDraft({ label: event.target.value })}
                  className="min-w-0 rounded-sm border bg-background px-1.5 py-1 text-[10px] text-foreground"
                />
              </label>
              <label className="grid gap-0.5 text-[9px] text-muted-foreground">
                Presentation order
                <input
                  type="number"
                  min={1}
                  max={10_000}
                  step={1}
                  aria-label="Group presentation order"
                  disabled={!selectedFrame}
                  value={groupPresentation.presentationOrder}
                  placeholder="Spatial"
                  onChange={(event) =>
                    updateGroupPresentationDraft({ presentationOrder: event.target.value })
                  }
                  className="min-w-0 rounded-sm border bg-background px-1.5 py-1 text-[10px] text-foreground"
                />
              </label>
              <label className="grid gap-0.5 text-[9px] text-muted-foreground">
                Background path
                <input
                  aria-label="Group background"
                  disabled={!selectedFrame}
                  value={groupPresentation.background}
                  placeholder="assets/context.png"
                  onChange={(event) =>
                    updateGroupPresentationDraft({ background: event.target.value })
                  }
                  className="min-w-0 rounded-sm border bg-background px-1.5 py-1 text-[10px] text-foreground"
                />
              </label>
            </div>
            <div className="grid grid-cols-[1fr_auto_auto] items-end gap-1">
              <label className="grid gap-0.5 text-[9px] text-muted-foreground">
                Background style
                <select
                  aria-label="Group background style"
                  disabled={!selectedFrame}
                  value={groupPresentation.backgroundStyle}
                  onChange={(event) =>
                    updateGroupPresentationDraft({
                      backgroundStyle: event.target.value as "cover" | "ratio" | "repeat",
                    })
                  }
                  className="rounded-sm border bg-background px-1 py-1 text-[10px] text-foreground"
                >
                  <option value="cover">Cover</option>
                  <option value="ratio">Keep ratio</option>
                  <option value="repeat">Repeat</option>
                </select>
              </label>
              <label className="flex h-6 items-center gap-1 text-[10px] text-muted-foreground">
                <input
                  type="checkbox"
                  aria-label="Collapse group"
                  disabled={!selectedFrame}
                  checked={groupPresentation.collapsed}
                  onChange={(event) =>
                    updateGroupPresentationDraft({ collapsed: event.target.checked })
                  }
                />
                Collapsed
              </label>
              <Button
                size="xs"
                variant="outline"
                disabled={!selectedFrame || lockedCount > 0}
                title={
                  selectedFrame
                    ? lockedCount > 0
                      ? "Unlock the group before changing presentation"
                      : undefined
                    : "Select exactly 1 group"
                }
                onClick={() => {
                  if (!selectedFrame) return;
                  apply("Group presentation", {
                    kind: "patchGroup",
                    frameId: selectedFrame.id,
                    patch: {
                      label: groupPresentation.label.trim() || null,
                      background: groupPresentation.background.trim() || null,
                      backgroundStyle: groupPresentation.background.trim()
                        ? groupPresentation.backgroundStyle
                        : null,
                      collapsed: groupPresentation.collapsed,
                      presentationOrder: groupPresentation.presentationOrder.trim()
                        ? Number(groupPresentation.presentationOrder)
                        : null,
                    },
                  });
                }}
              >
                Apply group
              </Button>
            </div>
          </section>

          <section
            className="space-y-1 rounded-sm border p-1.5"
            aria-labelledby="transform-frame-heading"
          >
            <h3
              id="transform-frame-heading"
              className="text-[10px] font-medium uppercase tracking-wide"
            >
              Transform selected frame
            </h3>
            <div className="grid grid-cols-4 gap-1">
              {(["x", "y", "width", "height"] as const).map((field) => (
                <label key={field} className="grid gap-0.5 text-[9px] text-muted-foreground">
                  {field === "x" || field === "y"
                    ? field.toUpperCase()
                    : field.charAt(0).toUpperCase() + field.slice(1)}
                  <input
                    type="number"
                    aria-label={"Frame " + field}
                    disabled={!selectedFrame}
                    value={frameBounds[field]}
                    onChange={(event) =>
                      setFrameBoundsDraft({
                        frameKey: selectedFrameKey,
                        bounds: { ...frameBounds, [field]: event.target.value },
                      })
                    }
                    className="min-w-0 rounded-sm border bg-background px-1 py-1 text-[10px] text-foreground"
                  />
                </label>
              ))}
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-1">
              <label className="grid gap-0.5 text-[9px] text-muted-foreground">
                Children
                <select
                  aria-label="Contained node behavior"
                  disabled={!selectedFrame}
                  value={containedNodes}
                  onChange={(event) =>
                    setContainedNodes(event.target.value as CanvasContainedNodeTransform)
                  }
                  className="rounded-sm border bg-background px-1 py-1 text-[10px] text-foreground"
                >
                  <option value="preserve">Preserve child sizes</option>
                  <option value="scale">Scale child geometry</option>
                </select>
              </label>
              <Button
                size="xs"
                variant="outline"
                className="self-end"
                disabled={!frameBoundsValid || lockedCount > 0}
                title={
                  selectedFrame
                    ? frameBoundsValid
                      ? lockedCount > 0
                        ? "Unlock the frame before transforming it"
                        : undefined
                      : "Enter valid positive frame bounds"
                    : "Select exactly 1 frame"
                }
                onClick={transformFrame}
              >
                Transform frame
              </Button>
            </div>
          </section>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ControlSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1 rounded-sm border p-1.5">
      <h3 className="text-[10px] font-medium uppercase tracking-wide">{title}</h3>
      <div className="flex flex-wrap gap-1">{children}</div>
    </section>
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

function hasLayoutFlag(node: CanvasNode, flag: "locked" | "pinned"): boolean {
  const metadata = node["afxLayout"];
  return (
    Boolean(metadata) &&
    typeof metadata === "object" &&
    !Array.isArray(metadata) &&
    (metadata as Record<string, unknown>)[flag] === true
  );
}

function nextFrameId(canvas: JSONCanvas): string {
  const used = new Set(
    [...(canvas.nodes ?? []), ...(canvas.edges ?? [])].map((candidate) => candidate.id),
  );
  let index = 1;
  while (used.has("frame-" + index)) index += 1;
  return "frame-" + index;
}
