/**
 * Preview/apply/cancel shell for deterministic Canvas layouts.
 *
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-40]
 * @see docs/specs/229-app-workbench-canvas/design.md [DES-CANVAS-AUTO-LAYOUT]
 */
import { useState } from "react";

import { LayoutDashboard } from "lucide-react";

import {
  CanvasLayoutError,
  type CanvasLayoutProposal,
  type CanvasLayoutStrategy,
  createCanvasLayoutReplacement,
  proposeCanvasLayout,
} from "@afx/canvas-engine";
import type { JSONCanvas } from "@afx/shared";
import { Button } from "@afx/ui/components/button";
import { Popover, PopoverContent, PopoverTrigger } from "@afx/ui/components/popover";

export interface CanvasLayoutControlsProps {
  canvas: JSONCanvas;
  selectedNodeIds: readonly string[];
  onPreview: (canvas: JSONCanvas | undefined) => void;
  onApply: (canvas: JSONCanvas) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const STRATEGIES: readonly { id: CanvasLayoutStrategy; label: string; help: string }[] = [
  { id: "hierarchical", label: "Hierarchy", help: "Layer connected systems by direction." },
  { id: "dependency", label: "Dependencies", help: "Prioritize declared dependency flow." },
  { id: "radial", label: "Radial", help: "Place items around a shared center." },
  { id: "grid", label: "Grid", help: "Use a regular planning grid." },
  { id: "swimlane", label: "Swimlanes", help: "Arrange items by their lane metadata." },
  { id: "compact", label: "Compact", help: "Pack items into a dense overview." },
];

export function CanvasLayoutControls({
  canvas,
  selectedNodeIds,
  onPreview,
  onApply,
  open: controlledOpen,
  onOpenChange,
}: CanvasLayoutControlsProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (next: boolean): void => {
    if (controlledOpen === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  };
  const [strategy, setStrategy] = useState<CanvasLayoutStrategy>("hierarchical");
  const [scope, setScope] = useState<"all" | "selection">("all");
  const [direction, setDirection] = useState<"horizontal" | "vertical">("horizontal");
  const [respectPins, setRespectPins] = useState(true);
  const [preserveGroups, setPreserveGroups] = useState(true);
  const [proposal, setProposal] = useState<CanvasLayoutProposal>();
  const [error, setError] = useState<string>();

  const cancel = (): void => {
    setProposal(undefined);
    setError(undefined);
    onPreview(undefined);
  };

  const preview = (): void => {
    try {
      const result = proposeCanvasLayout(canvas, {
        strategy,
        direction,
        respectPins,
        preserveGroups,
        ...(scope === "selection" ? { nodeIds: selectedNodeIds } : {}),
      });
      if (result.status === "cancelled") return;
      setProposal(result);
      setError(undefined);
      onPreview(result.document);
    } catch (cause) {
      setProposal(undefined);
      onPreview(undefined);
      setError(cause instanceof Error ? cause.message : "Canvas layout failed.");
    }
  };

  const apply = (): void => {
    if (!proposal) return;
    try {
      const replacement = createCanvasLayoutReplacement(canvas, proposal);
      onApply(replacement.document);
      setProposal(undefined);
      setError(undefined);
      onPreview(undefined);
      setOpen(false);
    } catch (cause) {
      setProposal(undefined);
      onPreview(undefined);
      setError(
        cause instanceof CanvasLayoutError ? cause.message : "Canvas changed; preview it again.",
      );
    }
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) cancel();
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Reformat canvas"
          title="Reformat canvas"
          className="rounded-sm p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <LayoutDashboard size={13} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[min(22rem,calc(100vw-1rem))] gap-2 p-2"
        aria-label="Canvas layout"
      >
        <div>
          <h2 className="text-xs font-medium">Reformat canvas</h2>
          <p className="text-[10px] leading-4 text-muted-foreground">
            Preview first. Pinned items, frames, content, links, and styles stay intact.
          </p>
        </div>
        <label className="grid gap-1 text-[10px] text-muted-foreground">
          Layout
          <select
            aria-label="Layout strategy"
            value={strategy}
            onChange={(event) => {
              cancel();
              setStrategy(event.target.value as CanvasLayoutStrategy);
            }}
            className="rounded-sm border bg-background px-1.5 py-1 text-[11px] text-foreground"
          >
            {STRATEGIES.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label} — {item.help}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="grid gap-1 text-[10px] text-muted-foreground">
            Scope
            <select
              aria-label="Layout scope"
              value={scope}
              onChange={(event) => {
                cancel();
                setScope(event.target.value as "all" | "selection");
              }}
              className="rounded-sm border bg-background px-1.5 py-1 text-[11px] text-foreground"
            >
              <option value="all">Whole canvas</option>
              <option value="selection" disabled={selectedNodeIds.length === 0}>
                Selection ({selectedNodeIds.length})
              </option>
            </select>
          </label>
          <label className="grid gap-1 text-[10px] text-muted-foreground">
            Direction
            <select
              aria-label="Layout direction"
              value={direction}
              onChange={(event) => {
                cancel();
                setDirection(event.target.value as "horizontal" | "vertical");
              }}
              className="rounded-sm border bg-background px-1.5 py-1 text-[11px] text-foreground"
            >
              <option value="horizontal">Left to right</option>
              <option value="vertical">Top to bottom</option>
            </select>
          </label>
        </div>
        <label className="flex items-center gap-2 text-[10px]">
          <input
            type="checkbox"
            checked={respectPins}
            onChange={(event) => {
              cancel();
              setRespectPins(event.target.checked);
            }}
          />
          Keep pinned and locked items in place
        </label>
        <label className="flex items-center gap-2 text-[10px]">
          <input
            type="checkbox"
            checked={preserveGroups}
            onChange={(event) => {
              cancel();
              setPreserveGroups(event.target.checked);
            }}
          />
          Preserve frame contents
        </label>
        {error ? (
          <p
            role="alert"
            className="rounded-sm border border-destructive/40 bg-destructive/10 p-1.5 text-[10px] text-destructive"
          >
            {error}
          </p>
        ) : null}
        {proposal ? (
          <p role="status" className="rounded-sm border bg-muted/30 p-1.5 text-[10px]">
            Previewing {proposal.changes.length} changed position
            {proposal.changes.length === 1 ? "" : "s"}. The canvas is unchanged until Apply.
          </p>
        ) : null}
        <div className="flex justify-end gap-1">
          {proposal ? (
            <Button size="xs" variant="ghost" onClick={cancel}>
              Cancel preview
            </Button>
          ) : null}
          <Button size="xs" variant="outline" onClick={preview}>
            Preview
          </Button>
          <Button size="xs" disabled={!proposal} onClick={apply}>
            Apply
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
