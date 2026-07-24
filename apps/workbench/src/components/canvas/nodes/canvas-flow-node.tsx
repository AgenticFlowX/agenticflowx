/**
 * Memoized React Flow renderer for standard JSON Canvas node kinds.
 *
 * @see docs/specs/229-app-workbench-canvas/tasks.md [8.1] [8.2]
 * @see docs/specs/229-app-workbench-canvas/design.md [DES-CANVAS-INTERACTIONS]
 */
import { memo, useEffect, useState } from "react";

import {
  Handle,
  type Node,
  type NodeProps,
  NodeResizer,
  NodeToolbar,
  Position,
} from "@xyflow/react";
import {
  BookOpen,
  ExternalLink,
  GitFork,
  LockKeyhole,
  MessageSquare,
  NotepadText,
  Pin,
  RefreshCw,
  Trash2,
} from "lucide-react";

import {
  type CanvasActionMetadata,
  type CanvasBoardPreviewSummary,
  type CanvasContentPreviewPayload,
  type CanvasFileNode,
  type CanvasNode,
  type CanvasNotesPreviewSummary,
  type CanvasTextNode,
  type CanvasUrlPreviewPayload,
  type WorkbenchSourceRevision,
  isMarkdownPath,
} from "@afx/shared";

import { MinimalMarkdown } from "../../../lib/markdown-render";
import { CanvasRunActionButton } from "../afx-actions";
import {
  canvasNodeDensityClass,
  canvasNodeShapeClass,
  canvasNodeTypographyClass,
  canvasNodeVisuals,
} from "../canvas-node-visuals";
import { CanvasSemanticIcon } from "../canvas-semantic-icon";
import { CanvasImageControls, readCanvasImagePresentation } from "./canvas-image-controls";

export interface CanvasFlowNodeData extends Record<string, unknown> {
  canvasNode: CanvasNode;
  preview?: CanvasNodePreview;
  fileContent?: string;
  /** 1-based badge number for annotation-styled text nodes (FR-46). */
  annotationIndex?: number;
  canRunCanvasActions?: boolean;
  showCanvasActions?: boolean;
  /** Count of declared dependencies not yet on the canvas (expand badge; 230). */
  expandableCount?: number;
  onUpdate: (nodeId: string, patch: Partial<CanvasNode>) => void;
  onAction: (
    nodeId: string,
    action: "open" | "preview" | "loadPreview" | "chat" | "note" | "delete" | "expand",
  ) => void;
  onRunCanvasAction: (nodeId: string, action: CanvasActionMetadata) => void;
  onFileContentMount?: (node: CanvasFileNode) => void | (() => void);
}

/** UI state for one host-mediated source or URL preview. */
export interface CanvasNodePreview {
  state: "loading" | "stale" | CanvasContentPreviewPayload["state"];
  payload?: CanvasContentPreviewPayload | CanvasUrlPreviewPayload;
  revision?: WorkbenchSourceRevision;
}

export type CanvasFlowNodeType = Node<CanvasFlowNodeData, "canvas">;

function CanvasFlowNodeComponent({ id, data, selected }: NodeProps<CanvasFlowNodeType>) {
  const node = data.canvasNode;
  const onFileContentMount = data.onFileContentMount;
  const visuals = canvasNodeVisuals(node);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(node.type === "text" ? node.text : "");
  const fileActions = node.type === "file" ? fileActionLabels(node, data.preview) : undefined;

  useEffect(() => {
    if (node.type !== "file") return;
    return onFileContentMount?.(node);
  }, [node, onFileContentMount]);

  const commit = (): void => {
    if (node.type === "text" && draft !== node.text) data.onUpdate(id, { text: draft });
    setEditing(false);
  };

  return (
    <article
      data-testid={`react-flow-canvas-node-${id}`}
      data-node-kind={node.type === "text" ? (node.afxNodeKind ?? "text") : node.type}
      className={`group relative h-full w-full border bg-card text-card-foreground shadow-sm ${canvasNodeShapeClass(visuals.shape)} ${
        selected ? "border-afx-brand ring-1 ring-afx-brand/40" : "border-border"
      } ${node.type === "group" ? "bg-muted/15" : ""} ${
        visuals.locked ? "" : "cursor-grab active:cursor-grabbing"
      }`}
      style={{
        borderLeftColor: canvasColor(node.color),
        borderLeftWidth: node.type === "group" ? 2 : 4,
        ...(node.type === "group" && node.color
          ? {
              backgroundColor: `color-mix(in srgb, ${canvasColor(node.color)} 12%, var(--card))`,
            }
          : {}),
      }}
      onDoubleClick={() => {
        if (node.type !== "text" || visuals.locked) return;
        setDraft(node.text);
        setEditing(true);
      }}
    >
      <NodeResizer
        isVisible={selected && !visuals.locked}
        minWidth={
          node.type === "text" &&
          (node.afxNodeKind === "label" || node.afxNodeKind === "annotation")
            ? 80
            : 160
        }
        minHeight={
          node.type === "text" &&
          (node.afxNodeKind === "label" || node.afxNodeKind === "annotation")
            ? 28
            : 80
        }
        color="var(--afx-brand, #c7a74f)"
      />
      {/* Bottom placement keeps node actions clear of the floating flow
          toolbar, which permanently occupies the top strip of the surface. */}
      <NodeToolbar
        isVisible={selected}
        position={Position.Bottom}
        className="flex rounded-sm border bg-popover p-0.5 shadow-md"
      >
        {data.showCanvasActions ? (
          <CanvasRunActionButton
            node={node}
            disabled={!data.canRunCanvasActions}
            onRun={(action) => data.onRunCanvasAction(id, action)}
          />
        ) : null}
        {node.type === "file" ? (
          <NodeAction
            label={fileActions?.open ?? "Open source"}
            onClick={() => data.onAction(id, "open")}
          >
            <ExternalLink size={12} />
          </NodeAction>
        ) : null}
        {node.type === "file" && isMarkdownPath(node.file) ? (
          <NodeAction
            label={fileActions?.preview ?? "Rendered preview"}
            onClick={() => data.onAction(id, "preview")}
          >
            <BookOpen size={12} />
          </NodeAction>
        ) : null}
        {node.type === "file" ? (
          <NodeAction label="Refresh preview" onClick={() => data.onAction(id, "loadPreview")}>
            <RefreshCw size={12} />
          </NodeAction>
        ) : null}
        {selected && node.type === "file" && isApprovedImagePreview(data.preview) ? (
          <CanvasImageControls node={node} onUpdate={(patch) => data.onUpdate(id, patch)} />
        ) : null}
        {node.type === "link" ? (
          <NodeAction label="Open URL" onClick={() => data.onAction(id, "open")}>
            <ExternalLink size={12} />
          </NodeAction>
        ) : null}
        {/* Integration actions carry visible text — icon-only buttons made the
            Chat/Notes handoffs undiscoverable without a manual. */}
        <NodeAction label="Send to Chat" onClick={() => data.onAction(id, "chat")}>
          <MessageSquare size={12} />
          <span className="text-[9px]">Chat</span>
        </NodeAction>
        {node.type === "text" ? (
          <NodeAction label="Promote to Notes" onClick={() => data.onAction(id, "note")}>
            <NotepadText size={12} />
            <span className="text-[9px]">Notes</span>
          </NodeAction>
        ) : null}
        <NodeAction label="Delete" onClick={() => data.onAction(id, "delete")}>
          <Trash2 size={12} />
        </NodeAction>
      </NodeToolbar>
      <header className="drag-handle flex h-7 cursor-grab items-center gap-1 border-b px-2 text-[10px] uppercase tracking-wide text-muted-foreground active:cursor-grabbing">
        {data.annotationIndex !== undefined ? (
          <span
            aria-label={`Annotation ${data.annotationIndex}`}
            className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-afx-brand font-mono text-[9px] font-semibold text-background"
            data-testid={`canvas-annotation-badge-${id}`}
          >
            {data.annotationIndex}
          </span>
        ) : null}
        {visuals.icon ? <CanvasSemanticIcon name={visuals.icon} className="shrink-0" /> : null}
        {docKindOf(node) ? (
          <span
            className="shrink-0 rounded-sm border border-afx-brand/40 bg-afx-brand/10 px-1 font-mono text-[8px] uppercase tracking-wide text-afx-brand-soft"
            data-testid={`canvas-doc-kind-${id}`}
          >
            {docKindOf(node)}
          </span>
        ) : null}
        <span className="truncate">{nodeTitle(node)}</span>
        {visuals.lane ? (
          <span
            className="ml-auto max-w-20 truncate rounded bg-muted px-1 text-[9px] normal-case"
            title={`Lane: ${visuals.lane}`}
          >
            {visuals.lane}
          </span>
        ) : null}
        {data.expandableCount && data.expandableCount > 0 ? (
          <button
            type="button"
            className="nodrag ml-auto flex shrink-0 items-center gap-0.5 rounded-sm border border-afx-brand/40 bg-afx-brand/10 px-1 text-[9px] text-afx-brand-soft hover:bg-afx-brand/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`Load ${data.expandableCount} dependencies`}
            title={`${data.expandableCount} declared ${
              data.expandableCount === 1 ? "dependency" : "dependencies"
            } not loaded — click to load`}
            onClick={() => data.onAction(id, "expand")}
            data-testid={`canvas-expand-badge-${id}`}
          >
            <GitFork size={9} /> {data.expandableCount}
          </button>
        ) : null}
        {visuals.pinned ? (
          <span aria-label="Pinned" title="Pinned" className="shrink-0">
            <Pin size={10} />
          </span>
        ) : null}
        {visuals.locked ? (
          <span aria-label="Locked" title="Locked" className="shrink-0">
            <LockKeyhole size={10} />
          </span>
        ) : null}
        {data.preview?.revision?.dirty ? (
          <span className="shrink-0 rounded bg-amber-500/15 px-1 text-[9px] text-amber-300">
            Unsaved
          </span>
        ) : null}
      </header>
      <div
        data-testid={`canvas-node-body-${id}`}
        className={`nowheel h-[calc(100%-1.75rem)] overflow-auto ${canvasNodeDensityClass(visuals.density)} ${canvasNodeTypographyClass(visuals.typography)}`}
      >
        {node.type === "text" && editing ? (
          <textarea
            autoFocus
            aria-label="Canvas node markdown"
            className="nodrag h-full min-h-16 w-full resize-none cursor-text bg-transparent font-mono text-xs outline-none"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setDraft(node.text);
                setEditing(false);
              }
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") commit();
            }}
          />
        ) : node.type === "text" ? (
          <MinimalMarkdown content={node.text} />
        ) : node.type === "file" || node.type === "link" ? (
          <CanvasPreviewBody node={node} preview={data.preview} onAction={data.onAction} />
        ) : node.type === "group" ? (
          <div className="space-y-1 text-muted-foreground">
            <p>{node.label || "Group"}</p>
            {isCollapsedGroup(node.afxGroup) ? (
              <p className="text-[10px] uppercase tracking-wide">Collapsed frame</p>
            ) : null}
            {node.background ? (
              <code className="block truncate text-[9px]" title={node.background}>
                {node.background}
              </code>
            ) : null}
          </div>
        ) : (
          <div className="space-y-1 text-muted-foreground">
            <p className="text-[10px] uppercase tracking-wide">
              Unsupported node type: {foreignNodeType(node)}
            </p>
            <p className="text-[10px]">Content is preserved and kept intact on save.</p>
          </div>
        )}
      </div>
      {([Position.Top, Position.Right, Position.Bottom, Position.Left] as const).flatMap(
        (position) => {
          const side = position.toLowerCase();
          return [
            <Handle
              key={`target:${side}`}
              id={side}
              type="target"
              position={position}
              className="!h-2 !w-2 !border-background !bg-afx-brand"
            />,
            <Handle
              key={`source:${side}`}
              id={side}
              type="source"
              position={position}
              className="!h-2 !w-2 !border-background !bg-afx-brand"
            />,
          ];
        },
      )}
    </article>
  );
}

function CanvasPreviewBody({
  node,
  preview,
  onAction,
}: {
  node: Extract<CanvasNode, { type: "file" | "link" }>;
  preview?: CanvasNodePreview;
  onAction: CanvasFlowNodeData["onAction"];
}) {
  if (!preview) {
    if (node.type === "link") {
      return (
        <div className="space-y-2">
          <span className="block break-all text-afx-brand-soft">{node.url}</span>
          <button
            type="button"
            className="rounded-sm border px-2 py-1 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => onAction(node.id, "loadPreview")}
          >
            Load URL preview
          </button>
        </div>
      );
    }
    return <code>{node.file}</code>;
  }

  if (preview.state === "loading") {
    return <PreviewStatus>Loading preview…</PreviewStatus>;
  }

  const payload = preview.payload;
  if (!payload) return <PreviewStatus>Preview unavailable.</PreviewStatus>;

  if (preview.state !== "stale" && payload.state !== "ready") {
    return (
      <PreviewStatus>
        {payload.message ?? defaultPreviewMessage(payload.state)}
        <button
          type="button"
          className="mt-2 block rounded-sm border px-2 py-1 text-[10px] hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => onAction(node.id, "loadPreview")}
        >
          Retry
        </button>
      </PreviewStatus>
    );
  }

  return (
    <div className="space-y-2">
      {preview.state === "stale" ? (
        <div role="status" className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <RefreshCw size={10} className="animate-spin motion-reduce:animate-none" />
          Refreshing…
        </div>
      ) : null}
      {isUrlPreview(payload) ? (
        <UrlPreview payload={payload} fallbackUrl={node.type === "link" ? node.url : undefined} />
      ) : (
        <LocalPreview payload={payload} fileNode={node.type === "file" ? node : undefined} />
      )}
    </div>
  );
}

function LocalPreview({
  payload,
  fileNode,
}: {
  payload: CanvasContentPreviewPayload;
  fileNode?: CanvasFileNode;
}) {
  const name = fileNode ? fileName(fileNode.file) : "Preview";
  switch (payload.kind) {
    case "markdown":
      return <MinimalMarkdown content={payload.content ?? ""} />;
    case "file":
      return (
        <pre className="whitespace-pre-wrap break-words font-mono text-[10px] leading-relaxed">
          {payload.excerpt ?? "No text preview available."}
        </pre>
      );
    case "image":
      if (!payload.resourceUri) return <PreviewStatus>Preview blocked by policy.</PreviewStatus>;
      {
        const presentation = fileNode
          ? readCanvasImagePresentation(fileNode)
          : { version: 1 as const, fit: "contain" as const };
        return (
          <figure className="flex h-full min-h-0 flex-col gap-1">
            <div className="min-h-0 flex-1 overflow-hidden">
              <img
                src={payload.resourceUri}
                alt={presentation.alt ?? name}
                className={`h-full w-full ${presentation.fit === "cover" ? "object-cover" : "object-contain"}`}
              />
            </div>
            {presentation.caption ? (
              <figcaption className="shrink-0 break-words text-[10px] leading-relaxed text-muted-foreground">
                {presentation.caption}
              </figcaption>
            ) : null}
          </figure>
        );
      }
    case "notes":
      return <NotesPreview summary={payload.summary as CanvasNotesPreviewSummary | undefined} />;
    case "board":
      return <BoardPreview summary={payload.summary as CanvasBoardPreviewSummary | undefined} />;
  }
}

function NotesPreview({ summary }: { summary?: CanvasNotesPreviewSummary }) {
  if (!summary) return <PreviewStatus>No notes found.</PreviewStatus>;
  return (
    <div className="space-y-1">
      <p className="text-[10px] text-muted-foreground">{summary.totalNotes} notes</p>
      <ul className="space-y-1">
        {summary.items.map((item, index) => (
          <li key={`${item.timestamp}:${index}`} className="rounded-sm bg-muted/40 px-1.5 py-1">
            <span className="mr-1 text-[9px] text-muted-foreground">{item.timestamp}</span>
            {item.text}
          </li>
        ))}
      </ul>
    </div>
  );
}

function BoardPreview({ summary }: { summary?: CanvasBoardPreviewSummary }) {
  if (!summary) return <PreviewStatus>No board cards found.</PreviewStatus>;
  return (
    <div className="space-y-1">
      <p className="text-[10px] text-muted-foreground">
        {summary.totalCards} cards · {summary.totalColumns} columns
      </p>
      {summary.columns.map((column) => (
        <section key={column.title} className="rounded-sm border border-border/60 p-1.5">
          <h4 className="mb-1 text-[10px] font-medium">
            {column.title} · {column.cardCount}
          </h4>
          <ul className="space-y-0.5 text-[10px] text-muted-foreground">
            {column.items.map((item, index) => (
              <li key={`${item}:${index}`}>{item}</li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function UrlPreview({
  payload,
  fallbackUrl,
}: {
  payload: CanvasUrlPreviewPayload;
  fallbackUrl?: string;
}) {
  return (
    <div className="space-y-1">
      {payload.metadata?.title ? <strong className="block">{payload.metadata.title}</strong> : null}
      {payload.metadata?.description ? (
        <p className="text-muted-foreground">{payload.metadata.description}</p>
      ) : null}
      <span className="block break-all text-[10px] text-afx-brand-soft">
        {payload.finalUrl ?? fallbackUrl}
      </span>
    </div>
  );
}

function PreviewStatus({ children }: { children: React.ReactNode }) {
  return (
    <div role="status" className="text-muted-foreground">
      {children}
    </div>
  );
}

function isUrlPreview(
  payload: CanvasContentPreviewPayload | CanvasUrlPreviewPayload,
): payload is CanvasUrlPreviewPayload {
  return !("kind" in payload);
}

function isApprovedImagePreview(preview: CanvasNodePreview | undefined): boolean {
  const payload = preview?.payload;
  return Boolean(
    payload &&
    "kind" in payload &&
    payload.kind === "image" &&
    payload.state === "ready" &&
    payload.resourceUri,
  );
}

function fileActionLabels(
  node: CanvasFileNode,
  preview: CanvasNodePreview | undefined,
): { open: string; preview: string } {
  const payload = preview?.payload;
  const previewKind = payload && "kind" in payload ? payload.kind : undefined;
  const normalizedPath = node.file.replace(/\\/g, "/").toLocaleLowerCase();
  if (previewKind === "notes" || /(^|\/)\.afx\/notes\.md$/.test(normalizedPath)) {
    return { open: "Open Notes file", preview: "Preview Notes" };
  }
  if (previewKind === "board" || /(^|\/)\.afx\/kanban\/[^/]+\.md$/.test(normalizedPath)) {
    return { open: "Open Board file", preview: "Preview Board" };
  }
  return { open: "Open source", preview: "Rendered preview" };
}

function defaultPreviewMessage(state: CanvasContentPreviewPayload["state"]): string {
  switch (state) {
    case "missing":
      return "Source file is missing.";
    case "blocked":
      return "Preview blocked by policy.";
    case "offline":
      return "Preview unavailable while offline.";
    case "error":
      return "Preview failed.";
    case "ready":
      return "Preview ready.";
  }
}

function fileName(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] ?? path;
}

function NodeAction({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className="nodrag flex items-center gap-0.5 rounded-sm p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

/** Short kind tag (SPEC/ADR/…) for a generated afx-document node (230 FR-2). */
function docKindOf(node: CanvasNode): string | undefined {
  const meta = (node as { afxDoc?: unknown }).afxDoc;
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return undefined;
  const kind = (meta as Record<string, unknown>)["kind"];
  return typeof kind === "string" ? kind : undefined;
}

function nodeTitle(node: CanvasNode): string {
  if (node.type === "file") {
    const parts = node.file.split("/");
    return parts[parts.length - 1] ?? node.file;
  }
  if (node.type === "link") return "Link";
  if (node.type === "group") return node.label || "Group";
  // Foreign node types pass permissive parse with only geometry guaranteed; `text`
  // and afx fields may be absent, so title them by their raw type instead.
  if (!isTextNode(node)) return foreignNodeType(node);
  if (node.afxNodeKind === "annotation") return "Annotation";
  return (
    node.text.match(/^#{1,6}\s+(.+)$/m)?.[1] ?? (node.afxNodeKind === "label" ? node.text : "Text")
  );
}

function isTextNode(node: CanvasNode): node is CanvasTextNode {
  return node.type === "text" && typeof node.text === "string";
}

function foreignNodeType(node: CanvasNode): string {
  return String((node as { type: string }).type);
}

function canvasColor(color: string | undefined): string {
  return (
    (
      {
        "1": "#ef4444",
        "2": "#f97316",
        "3": "#eab308",
        "4": "#22c55e",
        "5": "#06b6d4",
        "6": "#8b5cf6",
      } as Record<string, string>
    )[color ?? ""] ??
    color ??
    "var(--border)"
  );
}

function isCollapsedGroup(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    (value as Record<string, unknown>)["version"] === 1 &&
    (value as Record<string, unknown>)["collapsed"] === true
  );
}

function areCanvasFlowNodePropsEqual(
  previous: NodeProps<CanvasFlowNodeType>,
  next: NodeProps<CanvasFlowNodeType>,
): boolean {
  return (
    previous.id === next.id &&
    previous.selected === next.selected &&
    previous.data.canvasNode === next.data.canvasNode &&
    previous.data.preview === next.data.preview &&
    previous.data.fileContent === next.data.fileContent &&
    previous.data.canRunCanvasActions === next.data.canRunCanvasActions &&
    previous.data.showCanvasActions === next.data.showCanvasActions &&
    previous.data.onUpdate === next.data.onUpdate &&
    previous.data.onAction === next.data.onAction &&
    previous.data.onRunCanvasAction === next.data.onRunCanvasAction &&
    previous.data.onFileContentMount === next.data.onFileContentMount
  );
}

export const CanvasFlowNode = memo(CanvasFlowNodeComponent, areCanvasFlowNodePropsEqual);
