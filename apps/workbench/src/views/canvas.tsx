/**
 * Experimental JSON Canvas Workbench view.
 *
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-2] [FR-5] [FR-11] [FR-12] [FR-15] [FR-16] [FR-20]
 * @see docs/specs/229-app-workbench-canvas/design.md [DES-OVR] [DES-UI] [DES-ERR]
 */
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";

import { AlertTriangle, FileText, StickyNote } from "lucide-react";

import type { CanvasEdge, JSONCanvas, CanvasNode as JSONCanvasNode } from "@afx/shared";
import { Button } from "@afx/ui/components/button";

import { CanvasEdges } from "../components/canvas/canvas-edges";
import { CanvasNode } from "../components/canvas/canvas-node";
import { CanvasSurface } from "../components/canvas/canvas-surface";
import { type CanvasSaveStatus, CanvasToolbar } from "../components/canvas/canvas-toolbar";
import {
  type CanvasPoint,
  canvasBounds,
  parsePointFromViewport,
  useCanvasModel,
} from "../components/canvas/use-canvas-model";
import { useWorkbench } from "../context/workbench-context";
import { workbenchOn } from "../lib/bridge";
import {
  JSONCanvasParseError,
  emptyCanvas,
  parseJSONCanvas,
  serializeJSONCanvas,
} from "../lib/json-canvas";

const PROJECT_CANVAS_PATH = ".afx/project.canvas";

interface HostCanvasState {
  seenContent: string;
  acceptedContent: string;
  pendingExternalContent: string | null;
}

export default function Canvas() {
  const { canvasEnabled, canvas, documents, send } = useWorkbench();
  const incomingContent = canvas?.content ?? "";
  const [hostCanvas, setHostCanvas] = useState<HostCanvasState>(() => ({
    seenContent: incomingContent,
    acceptedContent: incomingContent,
    pendingExternalContent: null,
  }));
  const [fileContents, setFileContents] = useState<Record<string, string>>({});
  const [selectedDocument, setSelectedDocument] = useState("");
  const [documentPathInput, setDocumentPathInput] = useState("");
  const [pan, setPan] = useState({ x: 56, y: 44 });
  const [zoom, setZoom] = useState(1);
  const [linkingFrom, setLinkingFrom] = useState<string | null>(null);
  const [linkPreview, setLinkPreview] = useState<{
    fromNode: string;
    fromSide?: CanvasEdge["fromSide"];
    to: CanvasPoint;
  } | null>(null);
  const [retargetPreview, setRetargetPreview] = useState<{
    edgeId: string;
    end: "from" | "to";
    point: CanvasPoint;
  } | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);

  const parsed = useMemo(
    () => parseCanvasForView(hostCanvas.acceptedContent),
    [hostCanvas.acceptedContent],
  );
  const model = useCanvasModel(parsed.canvas, hostCanvas.acceptedContent);
  const nodes = useMemo(() => model.canvas.nodes ?? [], [model.canvas.nodes]);
  const edges = useMemo(() => model.canvas.edges ?? [], [model.canvas.edges]);
  const serialized = useMemo(() => serializeJSONCanvas(model.canvas), [model.canvas]);
  const saveStatus: CanvasSaveStatus = saveFailed
    ? "error"
    : model.dirty && !parsed.error
      ? "saving"
      : "saved";

  const worldPointFromClient = useCallback(
    (point: { clientX: number; clientY: number }): CanvasPoint => {
      const surface = document.querySelector<HTMLElement>('[data-testid="canvas-surface"]');
      const rect = surface?.getBoundingClientRect();
      return parsePointFromViewport(
        { x: point.clientX - (rect?.left ?? 0), y: point.clientY - (rect?.top ?? 0) },
        pan,
        zoom,
      );
    },
    [pan, zoom],
  );

  const finishLinkDrag = useCallback(
    (fromNode: string, point: { clientX: number; clientY: number }) => {
      const worldPoint = worldPointFromClient(point);
      const target = findNodeAtPoint(nodes, worldPoint, fromNode);
      if (target) {
        model.connect(fromNode, target.id);
      }
      setLinkingFrom(null);
      setLinkPreview(null);
    },
    [model, nodes, worldPointFromClient],
  );

  const finishRetargetEdge = useCallback(
    (edgeId: string, end: "from" | "to", point: { clientX: number; clientY: number }) => {
      const worldPoint = worldPointFromClient(point);
      const edge = edges.find((item) => item.id === edgeId);
      const oppositeNode = end === "from" ? edge?.toNode : edge?.fromNode;
      const target = findNodeAtPoint(nodes, worldPoint, oppositeNode);
      if (target) {
        model.retargetEdge(edgeId, end, target.id);
      }
      setRetargetPreview(null);
    },
    [edges, model, nodes, worldPointFromClient],
  );

  if (hostCanvas.seenContent !== incomingContent) {
    setHostCanvas(
      model.dirty
        ? { ...hostCanvas, seenContent: incomingContent, pendingExternalContent: incomingContent }
        : {
            seenContent: incomingContent,
            acceptedContent: incomingContent,
            pendingExternalContent: null,
          },
    );
  }

  useEffect(() => {
    return workbenchOn("afxDocContent", (msg) => {
      setFileContents((current) => ({ ...current, [msg.filePath]: msg.content }));
    });
  }, []);

  useEffect(() => {
    return workbenchOn("afxMarkdownFilePicked", (msg) => {
      setDocumentPathInput(msg.filePath);
      model.addFile(msg.filePath, calculateInsertPoint(nodes.length, pan, zoom));
    });
  }, [model, nodes.length, pan, zoom]);

  useEffect(() => {
    for (const node of nodes) {
      if (node.type !== "file") continue;
      if (!isMarkdownFile(node.file)) continue;
      if (fileContents[node.file] !== undefined) continue;
      send({ type: "afxFetchDocContent", filePath: node.file });
    }
  }, [fileContents, nodes, send]);

  useEffect(() => {
    if (!model.dirty || parsed.error) return;
    const timer = setTimeout(() => {
      try {
        send({ type: "afxSaveFile", path: PROJECT_CANVAS_PATH, content: serialized });
        setSaveFailed(false);
        model.setClean();
        setHostCanvas((current) => ({ ...current, acceptedContent: serialized }));
      } catch {
        setSaveFailed(true);
      }
    }, 650);
    return () => clearTimeout(timer);
  }, [model, parsed.error, send, serialized]);

  if (!canvasEnabled) {
    return (
      <div className="flex h-full items-center justify-center bg-background text-sm text-muted-foreground">
        Canvas experiment disabled.
      </div>
    );
  }

  function nextInsertPoint() {
    return calculateInsertPoint(nodes.length, pan, zoom);
  }

  function sendSelectionToChat() {
    const selected = nodes.filter((node) => model.selectedIds.includes(node.id));
    if (selected.length < 2) return;
    const command = selected
      .map((node) => canvasNodeToContext(node, fileContents))
      .join("\n\n---\n\n");
    send({ type: "afxOpenChatCommand", command, mode: "send" });
    model.clearSelection();
  }

  function fitToView() {
    const bounds = canvasBounds(nodes);
    if (!bounds) {
      setPan({ x: 56, y: 44 });
      setZoom(1);
      return;
    }
    setZoom(1);
    setPan({ x: 72 - bounds.x, y: 56 - bounds.y });
  }

  function addSelectedDocumentNode() {
    const filePath = (documentPathInput.trim() || selectedDocument).trim();
    if (!filePath) return;
    model.addFile(filePath, nextInsertPoint());
    setDocumentPathInput("");
  }

  return (
    <section
      className="relative flex h-full min-h-0 flex-col overflow-hidden bg-background text-foreground"
      tabIndex={0}
      onKeyDown={(event) => {
        if (isFormTarget(event.target)) return;
        if (event.key.toLowerCase() === "t") {
          event.preventDefault();
          model.addText(nextInsertPoint(), "New thought");
        }
        if (event.key.toLowerCase() === "l") {
          event.preventDefault();
          model.addLabel(nextInsertPoint());
        }
        if (event.key.toLowerCase() === "f") {
          event.preventDefault();
          addSelectedDocumentNode();
        }
      }}
    >
      <CanvasToolbar
        documents={documents}
        selectedDocument={selectedDocument}
        documentPathInput={documentPathInput}
        selectedCount={model.selectedIds.length}
        zoom={zoom}
        onDocumentChange={setSelectedDocument}
        onDocumentPathInputChange={setDocumentPathInput}
        onAddText={() => model.addText(nextInsertPoint(), "New thought")}
        onAddNote={() => model.addNote(nextInsertPoint())}
        onAddLabel={() => model.addLabel(nextInsertPoint())}
        onAddGroup={() => model.addGroup(nextInsertPoint())}
        onAddFile={addSelectedDocumentNode}
        onBrowseFile={() => send({ type: "afxPickMarkdownFile" })}
        onColorSelected={model.colorSelected}
        onFit={fitToView}
        onZoomIn={() => setZoom((current) => Math.min(3, Number((current + 0.1).toFixed(2))))}
        onZoomOut={() => setZoom((current) => Math.max(0.25, Number((current - 0.1).toFixed(2))))}
        onSendSelection={sendSelectionToChat}
      />
      <CanvasSurface
        pan={pan}
        zoom={zoom}
        onPan={setPan}
        onZoom={setZoom}
        onClearSelection={model.clearSelection}
      >
        <CanvasEdges
          nodes={nodes}
          edges={edges}
          draftEdge={linkPreview}
          retargetPreview={retargetPreview}
          onLabelEdge={model.labelEdge}
          onDeleteEdge={model.removeEdge}
          onBeginRetargetEdge={(edgeId, end, point) => {
            setRetargetPreview({ edgeId, end, point: worldPointFromClient(point) });
          }}
          onRetargetEdgeMove={(edgeId, end, point) => {
            setRetargetPreview({ edgeId, end, point: worldPointFromClient(point) });
          }}
          onFinishRetargetEdge={finishRetargetEdge}
          onCancelRetargetEdge={() => setRetargetPreview(null)}
        />
        {nodes.map((node) => (
          <CanvasNode
            key={node.id}
            node={node}
            selected={model.selectedIds.includes(node.id)}
            zoom={zoom}
            linkingFrom={linkingFrom}
            fileContent={node.type === "file" ? fileContents[node.file] : undefined}
            onSelect={(id, additive) => {
              if (additive) model.toggleSelected(id);
              else model.selectOnly(id);
            }}
            onMove={model.move}
            onResize={model.resize}
            onRename={model.renameNode}
            onUpdateText={model.updateText}
            onStartLink={(id) => {
              setLinkingFrom(id);
              setLinkPreview(null);
            }}
            onBeginLinkDrag={(id, point, side) => {
              setLinkingFrom(id);
              setLinkPreview({ fromNode: id, fromSide: side, to: worldPointFromClient(point) });
            }}
            onLinkDragMove={(id, point, side) => {
              setLinkPreview({ fromNode: id, fromSide: side, to: worldPointFromClient(point) });
            }}
            onFinishLinkDrag={finishLinkDrag}
            onCancelLinkDrag={() => {
              setLinkingFrom(null);
              setLinkPreview(null);
            }}
            onConnectTo={(id) => {
              if (!linkingFrom) return;
              model.connect(linkingFrom, id);
              setLinkingFrom(null);
              setLinkPreview(null);
            }}
            onPromote={(text) => send({ type: "afxAppendNote", text })}
            onSendToChat={(command) => send({ type: "afxOpenChatCommand", command, mode: "send" })}
            onOpenFile={(path) => send({ type: "afxOpenFile", path, mode: "afxPreview" })}
            onDelete={model.removeNode}
          />
        ))}
        {nodes.length === 0 && !parsed.error ? (
          <EmptyCanvas
            onAddText={() => model.addText(nextInsertPoint(), "Start here")}
            onAddDoc={() => {
              const firstDoc =
                selectedDocument || documents.find((doc) => isMarkdownFile(doc.filePath))?.filePath;
              if (firstDoc) model.addFile(firstDoc, nextInsertPoint());
            }}
          />
        ) : null}
      </CanvasSurface>
      <CanvasSaveOverlay status={saveStatus} />
      <div className="pointer-events-none absolute bottom-3 left-3 right-3 z-50 flex flex-col items-center gap-2">
        {parsed.error ? (
          <CanvasBanner tone="error" title="Malformed canvas file">
            <span>{parsed.error.message}</span>
            <Button
              type="button"
              size="xs"
              variant="outline"
              onClick={() =>
                send({ type: "afxOpenFile", path: PROJECT_CANVAS_PATH, mode: "editor" })
              }
            >
              Open file
            </Button>
          </CanvasBanner>
        ) : null}
        {hostCanvas.pendingExternalContent !== null ? (
          <CanvasBanner tone="warning" title="External canvas update available">
            <span>Reload from disk or keep your local unsaved canvas.</span>
            <Button
              type="button"
              size="xs"
              variant="outline"
              onClick={() => {
                setSaveFailed(false);
                setHostCanvas((current) =>
                  current.pendingExternalContent === null
                    ? current
                    : {
                        seenContent: current.seenContent,
                        acceptedContent: current.pendingExternalContent,
                        pendingExternalContent: null,
                      },
                );
              }}
            >
              Reload
            </Button>
            <Button
              type="button"
              size="xs"
              variant="ghost"
              onClick={() =>
                setHostCanvas((current) => ({ ...current, pendingExternalContent: null }))
              }
            >
              Keep local
            </Button>
          </CanvasBanner>
        ) : null}
      </div>
    </section>
  );
}

function CanvasSaveOverlay({ status }: { status: CanvasSaveStatus }) {
  return (
    <div
      className="pointer-events-none absolute bottom-3 right-3 z-40 flex min-h-8 items-center gap-2 border border-border bg-background/95 px-2.5 font-mono text-[10px] text-muted-foreground shadow-lg"
      aria-label={`Canvas save status ${status}`}
      role="status"
    >
      <span>{PROJECT_CANVAS_PATH}</span>
      <span
        className={
          status === "error"
            ? "text-destructive"
            : status === "saving"
              ? "text-afx-brand"
              : "text-afx-success"
        }
      >
        {status}
      </span>
    </div>
  );
}

function CanvasBanner({
  tone,
  title,
  children,
}: {
  tone: "error" | "warning";
  title: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`pointer-events-auto flex min-h-9 w-fit max-w-[min(52rem,calc(100vw-2rem))] items-center gap-2 border px-3 text-xs shadow-lg ${
        tone === "error"
          ? "border-destructive/30 bg-background text-destructive"
          : "border-amber-500/40 bg-background text-foreground"
      }`}
      role="status"
    >
      <AlertTriangle size={14} />
      <strong>{title}</strong>
      <div className="flex min-w-0 flex-1 items-center gap-2">{children}</div>
    </div>
  );
}

function EmptyCanvas({ onAddText, onAddDoc }: { onAddText: () => void; onAddDoc: () => void }) {
  return (
    <div className="absolute left-16 top-16 flex w-[min(26rem,70vw)] flex-col items-start gap-3 border border-dashed border-border bg-card/88 p-4 shadow-sm">
      <div className="flex items-center gap-2 text-sm font-medium">
        <StickyNote size={16} className="text-afx-brand" />
        Empty canvas
      </div>
      <p className="text-xs leading-5 text-muted-foreground">
        Drop a thought or markdown doc. The file is stored at `.afx/project.canvas`.
      </p>
      <div className="flex gap-2">
        <Button type="button" size="sm" onClick={onAddText}>
          <StickyNote size={14} />
          Add thought
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onAddDoc}>
          <FileText size={14} />
          Add doc
        </Button>
      </div>
    </div>
  );
}

function parseCanvasForView(content: string): {
  canvas: JSONCanvas;
  error: JSONCanvasParseError | null;
} {
  try {
    return { canvas: parseJSONCanvas(content), error: null };
  } catch (err) {
    return {
      canvas: emptyCanvas(),
      error: err instanceof JSONCanvasParseError ? err : new JSONCanvasParseError(String(err)),
    };
  }
}

function isMarkdownFile(filePath: string): boolean {
  return filePath.toLowerCase().endsWith(".md") || filePath.toLowerCase().endsWith(".markdown");
}

function findNodeAtPoint(
  nodes: JSONCanvasNode[],
  point: CanvasPoint,
  excludeNodeId?: string,
): JSONCanvasNode | undefined {
  return [...nodes]
    .reverse()
    .find(
      (node) =>
        node.id !== excludeNodeId &&
        point.x >= node.x &&
        point.x <= node.x + node.width &&
        point.y >= node.y &&
        point.y <= node.y + node.height,
    );
}

function calculateInsertPoint(nodeCount: number, pan: CanvasPoint, zoom: number): CanvasPoint {
  const surface =
    typeof document === "undefined"
      ? null
      : document.querySelector<HTMLElement>('[data-testid="canvas-surface"]');
  const surfaceWidth = surface?.getBoundingClientRect().width ?? 760;
  const base = parsePointFromViewport({ x: 72, y: 76 }, pan, zoom);

  if (surfaceWidth < 900) {
    const stepY = 196;
    const slots = [
      { col: 0, row: 0 },
      { col: 1, row: 0 },
      { col: 0, row: 1 },
      { col: 1, row: 1 },
      { col: 0, row: 2 },
      { col: 1, row: 2 },
      { col: 0, row: 3 },
      { col: 1, row: 3 },
    ];
    const slot = slots[nodeCount % slots.length] ?? slots[0];
    const page = Math.floor(nodeCount / slots.length);
    const stepX = Math.max(320, Math.min(360, surfaceWidth - 420));
    return {
      x: base.x + slot.col * stepX + page * 36,
      y: base.y + slot.row * stepY + page * 36,
    };
  }

  const columns = Math.max(1, Math.min(3, Math.floor((surfaceWidth - 96) / 320)));
  const cycle = Math.max(1, columns * 4);
  const index = nodeCount % cycle;
  const page = Math.floor(nodeCount / cycle);
  const col = index % columns;
  const row = Math.floor(index / columns);
  const stepX = Math.max(240, Math.min(320, (surfaceWidth - 160) / columns));
  const stepY = 240;
  return {
    x: base.x + col * stepX + page * 36,
    y: base.y + row * stepY + page * 36,
  };
}

function canvasNodeToContext(node: JSONCanvasNode, fileContents: Record<string, string>): string {
  if (node.type === "text") return node.text;
  if (node.type === "file")
    return fileContents[node.file] ? `${node.file}\n\n${fileContents[node.file]}` : node.file;
  if (node.type === "link") return node.url;
  return node.label || "Group";
}

function isFormTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(target.tagName);
}
