/**
 * Safe Canvas export preflight. Host IO is supplied by the caller so the
 * reusable Workbench/editor UI never writes arbitrary paths itself.
 *
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-42] [NFR-9]
 * @see docs/specs/229-app-workbench-canvas/design.md [DES-CANVAS-EXPORT]
 */
import { useMemo, useState } from "react";

import { Download } from "lucide-react";

import {
  type CanvasExportBounds,
  type CanvasExportReferenceStatus,
  createCanvasExportProjection,
  preflightCanvasExport,
  renderCanvasExportSvg,
  serializePortableCanvasExport,
} from "@afx/canvas-engine";
import type { CanvasExportPayload, JSONCanvas } from "@afx/shared";
import { Button } from "@afx/ui/components/button";
import { Popover, PopoverContent, PopoverTrigger } from "@afx/ui/components/popover";

import {
  CANVAS_PNG_PLATFORM_BOUNDARY,
  type CanvasPngRasterization,
  rasterizeCanvasExportSvg,
} from "../../lib/canvas-png-export";

export type CanvasExportRequest = CanvasExportPayload & { suggestedName: string };

export interface CanvasExportControlsProps {
  canvas: JSONCanvas;
  selectedNodeIds: readonly string[];
  viewportBounds?: CanvasExportBounds;
  referenceStatuses?: readonly CanvasExportReferenceStatus[];
  documentLabel?: string;
  onExport: (request: CanvasExportRequest) => void;
  rasterizePng?: (svg: string) => Promise<CanvasPngRasterization>;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function CanvasExportControls({
  canvas,
  selectedNodeIds,
  viewportBounds,
  referenceStatuses = [],
  documentLabel = "canvas",
  onExport,
  rasterizePng = rasterizeCanvasExportSvg,
  open: controlledOpen,
  onOpenChange,
}: CanvasExportControlsProps) {
  const [scope, setScope] = useState<"full" | "selection" | "frame" | "viewport">("full");
  const [format, setFormat] = useState<CanvasExportPayload["format"]>("canvas");
  const [acknowledgedIssues, setAcknowledgedIssues] = useState(false);
  const [rasterError, setRasterError] = useState<string>();
  const [rasterizing, setRasterizing] = useState(false);
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (next: boolean): void => {
    if (controlledOpen === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  };
  const selectedFrameId =
    selectedNodeIds.length === 1 &&
    canvas.nodes?.find((node) => node.id === selectedNodeIds[0])?.type === "group"
      ? selectedNodeIds[0]
      : undefined;

  const result = useMemo(() => {
    try {
      const projection = createCanvasExportProjection(canvas, {
        scope:
          scope === "selection"
            ? { kind: "selection", nodeIds: selectedNodeIds }
            : scope === "frame" && selectedFrameId
              ? { kind: "frame", nodeId: selectedFrameId }
              : scope === "viewport" && viewportBounds
                ? { kind: "viewport", bounds: viewportBounds }
                : { kind: "full" },
        translateToOrigin: format === "canvas",
      });
      return {
        projection,
        preflight: preflightCanvasExport(projection, referenceStatuses),
      };
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Canvas export failed." };
    }
  }, [canvas, format, referenceStatuses, scope, selectedFrameId, selectedNodeIds, viewportBounds]);

  const exportNow = async (): Promise<void> => {
    if (!("projection" in result) || !result.projection) return;
    if (!result.preflight.ready && !acknowledgedIssues) return;
    const baseName = safeBaseName(documentLabel);
    if (format === "canvas") {
      onExport({
        format,
        encoding: "utf8",
        content: serializePortableCanvasExport(result.projection),
        suggestedName: `${baseName}.canvas`,
      });
      setOpen(false);
      return;
    }
    const svg = renderCanvasExportSvg(result.projection, {
      title: `${documentLabel} Canvas export`,
      background: "#ffffff",
    });
    if (format === "svg") {
      onExport({
        format,
        encoding: "utf8",
        content: svg,
        suggestedName: `${baseName}.svg`,
      });
      setOpen(false);
      return;
    }
    setRasterError(undefined);
    setRasterizing(true);
    try {
      const png = await rasterizePng(svg);
      onExport({
        format: "png",
        encoding: png.encoding,
        content: png.content,
        suggestedName: `${baseName}.png`,
      });
    } catch (error) {
      setRasterError(error instanceof Error ? error.message : "PNG rasterization failed.");
      return;
    } finally {
      setRasterizing(false);
    }
    setOpen(false);
  };

  const preflight = "preflight" in result ? result.preflight : undefined;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setAcknowledgedIssues(false);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Export canvas"
          title="Export canvas"
          className="rounded-sm p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Download size={13} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[min(22rem,calc(100vw-1rem))] gap-2 p-2"
        aria-label="Canvas export"
      >
        <div>
          <h2 className="text-xs font-medium">Export canvas</h2>
          <p className="text-[10px] leading-4 text-muted-foreground">
            Export never changes the source. Referenced content is summarized before saving.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="grid gap-1 text-[10px] text-muted-foreground">
            Area
            <select
              aria-label="Export area"
              value={scope}
              onChange={(event) => {
                setScope(event.target.value as typeof scope);
                setAcknowledgedIssues(false);
              }}
              className="rounded-sm border bg-background px-1.5 py-1 text-[11px] text-foreground"
            >
              <option value="full">Whole canvas</option>
              <option value="selection" disabled={selectedNodeIds.length === 0}>
                Selection ({selectedNodeIds.length})
              </option>
              <option value="frame" disabled={!selectedFrameId}>
                Selected frame
              </option>
              <option value="viewport" disabled={!viewportBounds}>
                Current view
              </option>
            </select>
          </label>
          <label className="grid gap-1 text-[10px] text-muted-foreground">
            Format
            <select
              aria-label="Export format"
              value={format}
              onChange={(event) => {
                setFormat(event.target.value as CanvasExportPayload["format"]);
                setRasterError(undefined);
              }}
              className="rounded-sm border bg-background px-1.5 py-1 text-[11px] text-foreground"
            >
              <option value="canvas">Portable .canvas</option>
              <option value="svg">Safe SVG image</option>
              <option value="png">PNG image</option>
            </select>
          </label>
        </div>
        {format === "png" ? (
          <p className="text-[10px] leading-4 text-muted-foreground">
            {CANVAS_PNG_PLATFORM_BOUNDARY}
          </p>
        ) : null}
        {rasterError ? (
          <p
            role="alert"
            className="rounded-sm border border-destructive/40 bg-destructive/10 p-1.5 text-[10px] text-destructive"
          >
            {rasterError}
          </p>
        ) : "error" in result ? (
          <p
            role="alert"
            className="rounded-sm border border-destructive/40 bg-destructive/10 p-1.5 text-[10px] text-destructive"
          >
            {result.error}
          </p>
        ) : preflight ? (
          <div className="rounded-sm border bg-muted/20 p-2 text-[10px]">
            <p role="status">
              {preflight.summary.nodes} nodes · {preflight.summary.edges} edges
              {preflight.summary.omittedEdges > 0
                ? ` · ${preflight.summary.omittedEdges} outside edges omitted`
                : ""}
            </p>
            {preflight.issues.length > 0 ? (
              <div className="mt-1.5 space-y-1 border-t pt-1.5">
                <p className="font-medium text-amber-500">
                  {preflight.issues.length} reference issue
                  {preflight.issues.length === 1 ? "" : "s"}
                </p>
                <ul className="max-h-24 overflow-y-auto pl-4 text-muted-foreground">
                  {preflight.issues.map((issue) => (
                    <li key={`${issue.nodeId}:${issue.state}:${issue.reference}`}>
                      {issue.state}: {issue.reference}
                    </li>
                  ))}
                </ul>
                <label className="flex items-start gap-2 pt-1">
                  <input
                    type="checkbox"
                    checked={acknowledgedIssues}
                    onChange={(event) => setAcknowledgedIssues(event.target.checked)}
                  />
                  Export the safe fallback without embedding unavailable content
                </label>
              </div>
            ) : (
              <p className="mt-1 text-muted-foreground">Preflight ready.</p>
            )}
          </div>
        ) : null}
        <div className="flex justify-end">
          <Button
            size="xs"
            disabled={
              !("projection" in result) ||
              !result.projection ||
              rasterizing ||
              Boolean(preflight && !preflight.ready && !acknowledgedIssues)
            }
            onClick={() => void exportNow()}
          >
            {rasterizing
              ? "Rasterizing PNG…"
              : `Save ${format === "canvas" ? ".canvas" : format.toUpperCase()}…`}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function safeBaseName(value: string): string {
  const normalized = value
    .trim()
    .replace(/\.canvas$/i, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "canvas";
}
