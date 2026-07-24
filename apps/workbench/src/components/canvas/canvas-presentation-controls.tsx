/**
 * Compact presentation navigation for group-based Canvas frames.
 *
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-34]
 * @see docs/specs/229-app-workbench-canvas/design.md [DES-CANVAS-PRESENTATION]
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ChevronLeft, ChevronRight, Presentation, X } from "lucide-react";

import type { CanvasGroupNode, CanvasNode } from "@afx/shared";
import { Button } from "@afx/ui/components/button";

interface CanvasPresentationControlsProps {
  nodes: readonly CanvasNode[];
  startRequest?: number;
  onFocusFrame: (frameId: string) => void;
  onPresentationChange: (active: boolean) => void;
}

interface PresentationFrame {
  id: string;
  title: string;
}

/**
 * Derives spatially ordered group frames and exposes pointer, select, and
 * keyboard presentation controls without owning React Flow viewport behavior.
 *
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-34]
 * @see docs/specs/229-app-workbench-canvas/design.md [DES-CANVAS-PRESENTATION]
 */
export function CanvasPresentationControls({
  nodes,
  startRequest,
  onFocusFrame,
  onPresentationChange,
}: CanvasPresentationControlsProps) {
  const frames = useMemo(() => presentationFrames(nodes), [nodes]);
  const [active, setActive] = useState(false);
  const [currentFrameId, setCurrentFrameId] = useState<string>();
  const handledStartRequest = useRef<number | undefined>(undefined);
  const currentIndex = Math.max(
    0,
    frames.findIndex((frame) => frame.id === currentFrameId),
  );
  const currentFrame = frames[currentIndex];
  const hasFrames = frames.length > 0;

  const focusIndex = useCallback(
    (index: number) => {
      const frame = frames[index];
      if (!frame) return;
      setCurrentFrameId(frame.id);
      onFocusFrame(frame.id);
    },
    [frames, onFocusFrame],
  );

  const start = useCallback(() => {
    if (!frames[0]) return;
    setActive(true);
    onPresentationChange(true);
    focusIndex(0);
  }, [focusIndex, frames, onPresentationChange]);

  const exit = useCallback(() => {
    if (!active) return;
    setActive(false);
    onPresentationChange(false);
  }, [active, onPresentationChange]);

  useEffect(() => {
    if (startRequest === undefined || handledStartRequest.current === startRequest) return;
    handledStartRequest.current = startRequest;
    start();
  }, [start, startRequest]);

  const previous = useCallback(() => {
    focusIndex(Math.max(0, currentIndex - 1));
  }, [currentIndex, focusIndex]);

  const next = useCallback(() => {
    focusIndex(Math.min(frames.length - 1, currentIndex + 1));
  }, [currentIndex, focusIndex, frames.length]);

  useEffect(() => {
    if (!active) return;
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (isFormControl(event.target)) return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        previous();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        next();
      } else if (event.key === "Escape") {
        event.preventDefault();
        exit();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [active, exit, next, previous]);

  const status = !hasFrames
    ? "No presentation frames"
    : active && currentFrame
      ? `Frame ${currentIndex + 1} of ${frames.length}: ${currentFrame.title}`
      : `${frames.length} presentation frame${frames.length === 1 ? "" : "s"}`;

  return (
    <section
      data-testid="canvas-presentation-controls"
      aria-label="Canvas presentation controls"
      className="flex w-full min-w-0 max-w-full flex-wrap items-center gap-1 rounded-md border border-border/70 bg-background/92 p-1 text-xs shadow-sm transition-colors motion-reduce:transition-none"
    >
      {active ? (
        <Button
          type="button"
          size="icon-xs"
          variant="ghost"
          aria-label="Exit presentation"
          title="Exit presentation (Escape)"
          onClick={exit}
        >
          <X size={12} />
        </Button>
      ) : (
        <Button
          type="button"
          size="icon-xs"
          variant="ghost"
          aria-label="Start presentation"
          title="Start presentation"
          disabled={!hasFrames}
          onClick={start}
        >
          <Presentation size={12} />
        </Button>
      )}

      {active ? (
        <div className="flex min-w-0 max-w-full flex-1 items-center gap-0.5 overflow-x-auto">
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            aria-label="Previous frame"
            aria-keyshortcuts="ArrowLeft"
            title="Previous frame (Left arrow)"
            disabled={currentIndex <= 0}
            onClick={previous}
          >
            <ChevronLeft size={12} />
          </Button>

          <select
            aria-label="Presentation frame"
            className="h-6 min-w-0 max-w-40 flex-1 truncate rounded-sm border border-border bg-background px-1 text-[10px] text-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring motion-reduce:transition-none"
            value={currentFrame?.id ?? ""}
            onChange={(event) => {
              const index = frames.findIndex((frame) => frame.id === event.target.value);
              if (index >= 0) focusIndex(index);
            }}
          >
            {frames.map((frame, index) => (
              <option key={frame.id} value={frame.id}>
                {index + 1}. {frame.title}
              </option>
            ))}
          </select>

          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            aria-label="Next frame"
            aria-keyshortcuts="ArrowRight"
            title="Next frame (Right arrow)"
            disabled={currentIndex >= frames.length - 1}
            onClick={next}
          >
            <ChevronRight size={12} />
          </Button>
        </div>
      ) : (
        <span
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="min-w-0 flex-1 truncate px-1 text-[10px] text-muted-foreground"
        >
          {hasFrames
            ? `${frames.length} frame${frames.length === 1 ? "" : "s"}`
            : "No presentation frames"}
        </span>
      )}

      {active ? (
        <span
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="min-w-0 max-w-full flex-1 basis-full truncate px-1 text-[10px] text-muted-foreground sm:basis-auto"
        >
          {status}
        </span>
      ) : null}
    </section>
  );
}

function presentationFrames(nodes: readonly CanvasNode[]): PresentationFrame[] {
  return nodes
    .filter((node): node is CanvasGroupNode => node.type === "group")
    .sort(
      (left, right) =>
        presentationOrder(left) - presentationOrder(right) ||
        left.y - right.y ||
        left.x - right.x ||
        left.id.localeCompare(right.id),
    )
    .map((node, index) => ({ id: node.id, title: node.label?.trim() || `Frame ${index + 1}` }));
}

function presentationOrder(node: CanvasGroupNode): number {
  const value = node.afxGroup?.version === 1 ? node.afxGroup.presentationOrder : undefined;
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : Number.POSITIVE_INFINITY;
}

function isFormControl(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}
