/**
 * Pan/zoom viewport for the experimental Workbench canvas.
 *
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-10] [FR-17] [NFR-1]
 * @see docs/specs/229-app-workbench-canvas/design.md [DES-ARCH]
 */
import { type PointerEvent, type ReactNode, useRef } from "react";

import type { CanvasPoint } from "./use-canvas-model";

interface CanvasSurfaceProps {
  pan: CanvasPoint;
  zoom: number;
  children: ReactNode;
  onPan: (next: CanvasPoint) => void;
  onZoom: (next: number) => void;
  onClearSelection: () => void;
}

export function CanvasSurface({
  pan,
  zoom,
  children,
  onPan,
  onZoom,
  onClearSelection,
}: CanvasSurfaceProps) {
  const panStart = useRef<{ clientX: number; clientY: number; pan: CanvasPoint } | null>(null);
  const dotGridSize = Math.max(16, 22 * zoom);
  const majorGridSize = dotGridSize * 5;

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (isCanvasInteractionTarget(event.target)) return;
    onClearSelection();
    panStart.current = { clientX: event.clientX, clientY: event.clientY, pan };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!panStart.current) return;
    const start = panStart.current;
    onPan({
      x: start.pan.x + event.clientX - start.clientX,
      y: start.pan.y + event.clientY - start.clientY,
    });
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    panStart.current = null;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function onPointerCancel(event: PointerEvent<HTMLDivElement>) {
    panStart.current = null;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  return (
    <div
      data-testid="canvas-surface"
      className="relative min-h-0 flex-1 touch-none overflow-hidden bg-background cursor-grab active:cursor-grabbing"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onWheel={(event) => {
        if (isNestedScrollableTarget(event.target)) return;
        event.preventDefault();
        if (event.shiftKey) {
          if (event.metaKey || event.ctrlKey) {
            const delta = event.deltaY || event.deltaX;
            onPan({ x: pan.x, y: pan.y - delta });
            return;
          }
          const delta = event.deltaX || event.deltaY;
          onPan({ x: pan.x - delta, y: pan.y });
          return;
        }
        const direction = event.deltaY > 0 ? -0.08 : 0.08;
        onZoom(Math.min(3, Math.max(0.25, Number((zoom + direction).toFixed(2)))));
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.14]"
        style={{
          backgroundImage: "radial-gradient(circle, currentColor 1px, transparent 1.35px)",
          backgroundSize: `${dotGridSize}px ${dotGridSize}px`,
          backgroundPosition: `${pan.x}px ${pan.y}px`,
          color: "var(--muted-foreground)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.045]"
        style={{
          backgroundImage:
            "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
          backgroundSize: `${majorGridSize}px ${majorGridSize}px`,
          backgroundPosition: `${pan.x}px ${pan.y}px`,
          color: "var(--muted-foreground)",
        }}
      />
      <div
        data-testid="canvas-world"
        className="absolute left-0 top-0 min-h-full min-w-full origin-top-left"
        style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
      >
        {children}
      </div>
    </div>
  );
}

function isCanvasInteractionTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return !!target.closest(
    "[data-node-id],button,input,textarea,select,a,[role='button'],[data-canvas-scrollable='true']",
  );
}

function isNestedScrollableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return !!target.closest("[data-canvas-scrollable='true']");
}
