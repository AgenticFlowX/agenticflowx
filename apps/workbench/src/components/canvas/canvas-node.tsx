/**
 * Render and edit JSON Canvas nodes.
 *
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-5] [FR-6] [FR-7] [FR-8] [FR-14] [FR-15] [FR-16]
 * @see docs/specs/229-app-workbench-canvas/design.md [DES-UI]
 */
import {
  type CSSProperties,
  type MouseEvent,
  type PointerEvent,
  type ReactElement,
  useRef,
  useState,
} from "react";

import {
  Circle,
  CircleCheck,
  Edit3,
  ExternalLink,
  FileText,
  Link2,
  Maximize2,
  MessageSquare,
  Move as MoveIcon,
  NotepadText,
  Square as SquareIcon,
  Tag,
  Trash2,
  Type,
} from "lucide-react";

import type { CanvasEdge, CanvasNode as JSONCanvasNode } from "@afx/shared";
import { Button } from "@afx/ui/components/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@afx/ui/components/tooltip";

import { MinimalMarkdown } from "../../lib/markdown-render";

interface CanvasNodeProps {
  node: JSONCanvasNode;
  selected: boolean;
  zoom: number;
  linkingFrom: string | null;
  fileContent?: string;
  onSelect: (id: string, additive: boolean) => void;
  onMove: (id: string, point: { x: number; y: number }) => void;
  onResize: (id: string, size: { width: number; height: number }) => void;
  onRename: (id: string, title: string) => void;
  onUpdateText: (id: string, text: string) => void;
  onStartLink: (id: string) => void;
  onBeginLinkDrag: (
    id: string,
    point: { clientX: number; clientY: number },
    side?: CanvasLinkSide,
  ) => void;
  onLinkDragMove: (
    id: string,
    point: { clientX: number; clientY: number },
    side?: CanvasLinkSide,
  ) => void;
  onFinishLinkDrag: (id: string, point: { clientX: number; clientY: number }) => void;
  onCancelLinkDrag: () => void;
  onConnectTo: (id: string) => void;
  onPromote: (text: string) => void;
  onSendToChat: (text: string) => void;
  onOpenFile: (path: string) => void;
  onDelete: (id: string) => void;
}

type CanvasLinkSide = NonNullable<CanvasEdge["fromSide"]>;
type CanvasVisualKind = "text" | "note" | "label" | "file" | "group" | "link";

export function CanvasNode({
  node,
  selected,
  zoom,
  linkingFrom,
  fileContent,
  onSelect,
  onMove,
  onResize,
  onRename,
  onUpdateText,
  onStartLink,
  onBeginLinkDrag,
  onLinkDragMove,
  onFinishLinkDrag,
  onCancelLinkDrag,
  onConnectTo,
  onPromote,
  onSendToChat,
  onOpenFile,
  onDelete,
}: CanvasNodeProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(node.type === "text" ? node.text : "");
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const dragStart = useRef<{ clientX: number; clientY: number; x: number; y: number } | null>(null);
  const linkDragActive = useRef(false);
  const linkDragMoved = useRef(false);
  const resizeStart = useRef<{
    clientX: number;
    clientY: number;
    width: number;
    height: number;
  } | null>(null);
  const isLinkTarget = !!linkingFrom && linkingFrom !== node.id;
  const visualKind = nodeVisualKind(node);
  const isLabel = visualKind === "label";
  const title = nodeTitle(node);
  const renameable = canRenameNode(node);
  const chatText = nodeToContext(node, fileContent);
  const labelTextStyle = isLabel ? labelTextStyleForNode(node, title) : undefined;
  const labelInputStyle = isLabel
    ? labelInputStyleForNode(node, titleDraft || title || "Label")
    : undefined;

  function startDrag(event: PointerEvent<HTMLElement>) {
    event.stopPropagation();
    dragStart.current = { clientX: event.clientX, clientY: event.clientY, x: node.x, y: node.y };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function drag(event: PointerEvent<HTMLElement>) {
    if (!dragStart.current) return;
    // No primary button held = a stray move (capture dropped on a fast drag, or a
    // plain hover after a missed pointerup); end the drag instead of teleporting.
    if (event.buttons === 0) {
      dragStart.current = null;
      return;
    }
    const start = dragStart.current;
    onMove(node.id, {
      x: start.x + (event.clientX - start.clientX) / zoom,
      y: start.y + (event.clientY - start.clientY) / zoom,
    });
  }

  function stopDrag(event: PointerEvent<HTMLElement>) {
    dragStart.current = null;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function startResize(event: PointerEvent<HTMLButtonElement>) {
    event.stopPropagation();
    resizeStart.current = {
      clientX: event.clientX,
      clientY: event.clientY,
      width: node.width,
      height: node.height,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function resize(event: PointerEvent<HTMLButtonElement>) {
    if (!resizeStart.current) return;
    if (event.buttons === 0) {
      resizeStart.current = null;
      return;
    }
    const start = resizeStart.current;
    onResize(node.id, {
      width: start.width + (event.clientX - start.clientX) / zoom,
      height: start.height + (event.clientY - start.clientY) / zoom,
    });
  }

  function stopResize(event: PointerEvent<HTMLButtonElement>) {
    resizeStart.current = null;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function editTextNode() {
    if (node.type !== "text") return;
    setDraft(node.text);
    setEditing(true);
  }

  function startTitleEdit() {
    if (!renameable) return;
    setTitleDraft(title);
    setEditingTitle(true);
  }

  function commitTitleEdit() {
    if (!editingTitle) return;
    const nextTitle = titleDraft.trim();
    setEditingTitle(false);
    if (!nextTitle || nextTitle === title) return;
    onRename(node.id, nextTitle);
  }

  function cancelTitleEdit() {
    setTitleDraft("");
    setEditingTitle(false);
  }

  function handleDoubleClick(event: MouseEvent<HTMLElement>) {
    if (node.type !== "text" || isInteractiveTarget(event.target)) return;
    event.stopPropagation();
    onSelect(node.id, false);
    if (isLabel) {
      startTitleEdit();
      return;
    }
    editTextNode();
  }

  function startLinkDrag(event: PointerEvent<HTMLButtonElement>) {
    const side = linkSideFromEvent(event);
    event.stopPropagation();
    linkDragActive.current = true;
    linkDragMoved.current = false;
    onBeginLinkDrag(node.id, { clientX: event.clientX, clientY: event.clientY }, side);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function moveLinkDrag(event: PointerEvent<HTMLButtonElement>) {
    if (!linkDragActive.current) return;
    const side = linkSideFromEvent(event);
    linkDragMoved.current = true;
    onLinkDragMove(node.id, { clientX: event.clientX, clientY: event.clientY }, side);
  }

  function stopLinkDrag(event: PointerEvent<HTMLButtonElement>) {
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (linkDragMoved.current) {
      onFinishLinkDrag(node.id, { clientX: event.clientX, clientY: event.clientY });
    } else {
      onStartLink(node.id);
    }
    linkDragActive.current = false;
    linkDragMoved.current = false;
  }

  function cancelLinkDrag() {
    linkDragActive.current = false;
    linkDragMoved.current = false;
    onCancelLinkDrag();
  }

  return (
    <article
      data-testid={`canvas-node-${node.id}`}
      data-node-id={node.id}
      data-node-type={node.type}
      data-node-kind={visualKind}
      className={nodeFrameClass(visualKind, selected, isLinkTarget)}
      style={{
        left: node.x,
        top: node.y,
        width: node.width,
        height: node.height,
        zIndex: nodeZIndex(visualKind, selected, isLinkTarget),
        borderLeftColor: canvasColor(node.color),
        borderLeftWidth: visualKind === "label" ? 0 : visualKind === "group" ? 2 : 4,
        color: visualKind === "label" && node.color ? canvasColor(node.color) : undefined,
      }}
      onClick={(event) => {
        event.stopPropagation();
        if (isLinkTarget) {
          onConnectTo(node.id);
          return;
        }
        onSelect(node.id, event.shiftKey || event.metaKey || event.ctrlKey);
      }}
      onDoubleClick={handleDoubleClick}
    >
      <header
        className={nodeHeaderClass(visualKind, selected)}
        onPointerDown={startDrag}
        onPointerMove={drag}
        onPointerUp={stopDrag}
        onPointerCancel={stopDrag}
        onLostPointerCapture={() => {
          dragStart.current = null;
        }}
      >
        {isLabel ? (
          <span
            aria-label="Drag node"
            title="Drag node"
            className="absolute -left-5 top-1/2 inline-flex -translate-y-1/2 shrink-0 cursor-move items-center text-muted-foreground opacity-0 transition group-hover/canvas-label-header:opacity-70 group-focus-within/canvas-label-header:opacity-70"
          >
            <MoveIcon size={13} aria-hidden="true" />
          </span>
        ) : null}
        {!isLabel ? <NodeKindIcon visualKind={visualKind} /> : null}
        {editingTitle && renameable ? (
          <input
            type="text"
            aria-label="Rename node label"
            value={titleDraft}
            onChange={(event) => setTitleDraft(event.target.value)}
            onBlur={commitTitleEdit}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                commitTitleEdit();
              }
              if (event.key === "Escape") {
                event.preventDefault();
                cancelTitleEdit();
              }
            }}
            className={
              isLabel
                ? "h-auto min-w-0 max-w-full border-0 bg-transparent px-0 font-semibold leading-none outline-none underline decoration-afx-brand/70 decoration-2 underline-offset-4"
                : "h-6 min-w-0 flex-1 rounded-[3px] border border-transparent bg-background/45 px-1.5 text-xs outline-none transition focus:border-afx-brand/30 focus:bg-background/70 focus:ring-1 focus:ring-afx-brand/20"
            }
            style={isLabel ? labelInputStyle : undefined}
            autoFocus
          />
        ) : renameable ? (
          <button
            type="button"
            className={
              isLabel
                ? "min-w-0 max-w-full truncate rounded-none px-0 text-left font-semibold leading-none outline-none hover:bg-transparent focus-visible:underline focus-visible:decoration-afx-brand/70 focus-visible:decoration-2 focus-visible:underline-offset-4"
                : "min-w-0 flex-1 truncate rounded-[3px] px-0.5 text-left text-xs font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-afx-brand/25 hover:bg-background/45"
            }
            style={labelTextStyle}
            onClick={(event) => {
              if (isLabel) {
                event.stopPropagation();
                onSelect(node.id, event.shiftKey || event.metaKey || event.ctrlKey);
                return;
              }
              event.stopPropagation();
              startTitleEdit();
            }}
            onDoubleClick={(event) => {
              if (!isLabel) return;
              event.stopPropagation();
              startTitleEdit();
            }}
            onPointerDown={(event) => {
              if (!isLabel) event.stopPropagation();
            }}
            aria-label={`Rename node label ${title}`}
            title={isLabel ? "Double-click to rename label" : "Rename label"}
          >
            {title}
          </button>
        ) : (
          <span
            className={`min-w-0 flex-1 truncate ${
              isLabel ? "px-0 text-sm font-semibold leading-none" : "px-0.5 text-xs font-medium"
            }`}
            style={labelTextStyle}
            title={title}
          >
            {title}
          </span>
        )}
        {!isLabel && renameable && !editingTitle ? (
          <IconButtonTooltip label="Rename label">
            <Button
              type="button"
              size="icon-xs"
              variant="ghost"
              className={`-ml-0.5 text-muted-foreground hover:text-foreground ${
                visualKind === "group"
                  ? "opacity-0 transition group-hover/canvas-node:opacity-100"
                  : ""
              }`}
              onClick={(event) => {
                event.stopPropagation();
                startTitleEdit();
              }}
              onPointerDown={(event) => event.stopPropagation()}
              aria-label="Rename node label"
            >
              <Edit3 size={12} />
            </Button>
          </IconButtonTooltip>
        ) : null}
        {!isLabel && visualKind !== "group" ? (
          <IconButtonTooltip label={selected ? "Remove from selection" : "Add to selection"}>
            <Button
              type="button"
              size="icon-xs"
              variant="ghost"
              className={`ml-auto text-muted-foreground hover:text-foreground ${
                selected ? "bg-afx-brand/15 text-afx-brand hover:text-afx-brand" : ""
              }`}
              onClick={(event) => {
                event.stopPropagation();
                onSelect(node.id, true);
              }}
              onPointerDown={(event) => event.stopPropagation()}
              aria-label={selected ? "Remove node from selection" : "Add node to selection"}
              aria-pressed={selected}
            >
              {selected ? <CircleCheck size={13} /> : <Circle size={13} />}
            </Button>
          </IconButtonTooltip>
        ) : null}
        {!isLabel ? (
          <span
            aria-label="Drag node"
            title="Drag to move"
            className={`-mr-1 ml-0.5 inline-flex shrink-0 cursor-move items-center ${
              visualKind === "group"
                ? "text-afx-brand opacity-0 transition group-hover/canvas-node:opacity-100"
                : "text-muted-foreground"
            }`}
          >
            <MoveIcon size={13} aria-hidden="true" />
          </span>
        ) : null}
        {isLabel ? (
          <div data-label-actions="true" className={labelActionsClass(selected, editingTitle)}>
            {renameable && !editingTitle ? (
              <IconButtonTooltip label="Rename label">
                <Button
                  type="button"
                  size="icon-xs"
                  variant="ghost"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={(event) => {
                    event.stopPropagation();
                    startTitleEdit();
                  }}
                  onPointerDown={(event) => event.stopPropagation()}
                  aria-label="Rename node label"
                >
                  <Edit3 size={12} />
                </Button>
              </IconButtonTooltip>
            ) : null}
            <IconButtonTooltip label={selected ? "Remove from selection" : "Add to selection"}>
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                className={`text-muted-foreground hover:text-foreground ${
                  selected ? "bg-afx-brand/15 text-afx-brand hover:text-afx-brand" : ""
                }`}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelect(node.id, true);
                }}
                onPointerDown={(event) => event.stopPropagation()}
                aria-label={selected ? "Remove node from selection" : "Add node to selection"}
                aria-pressed={selected}
              >
                {selected ? <CircleCheck size={13} /> : <Circle size={13} />}
              </Button>
            </IconButtonTooltip>
            <IconButtonTooltip label="Delete label">
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                className="text-muted-foreground hover:text-foreground"
                onClick={(event) => {
                  event.stopPropagation();
                  onDelete(node.id);
                }}
                onPointerDown={(event) => event.stopPropagation()}
                aria-label="Delete label"
              >
                <Trash2 size={13} />
              </Button>
            </IconButtonTooltip>
          </div>
        ) : null}
        {isLabel ? (
          <ResizeHandle
            visualKind={visualKind}
            selected={selected}
            onPointerDown={startResize}
            onPointerMove={resize}
            onPointerUp={stopResize}
            onPointerCancel={stopResize}
          />
        ) : null}
      </header>
      {!isLabel ? (
        <div
          data-canvas-scrollable="true"
          // While editing, inset the body so the editing box clears the 32px (h-8) header
          // and footer overlays on all four sides and reads as a contained field.
          className={
            editing
              ? "min-h-0 flex-1 overflow-hidden px-2.5 pb-9 pt-9"
              : nodeBodyShellClass(visualKind)
          }
        >
          <NodeBody
            node={node}
            visualKind={visualKind}
            editing={editing}
            draft={draft}
            fileContent={fileContent}
            setDraft={setDraft}
            commitText={() => {
              onUpdateText(node.id, draft);
              setEditing(false);
            }}
            cancelText={() => {
              setDraft(node.type === "text" ? node.text : "");
              setEditing(false);
            }}
          />
        </div>
      ) : null}
      {!isLabel ? (
        <footer className={nodeFooterClass(visualKind, selected)} data-node-actions="true">
          {node.type === "text" ? (
            <Button
              type="button"
              size="xs"
              variant="ghost"
              onClick={editTextNode}
              title="Edit text node"
            >
              Edit
            </Button>
          ) : null}
          {node.type === "file" ? (
            <IconButtonTooltip label="Open file">
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                onClick={() => onOpenFile(node.file)}
                aria-label="Open file"
              >
                <ExternalLink size={13} />
              </Button>
            </IconButtonTooltip>
          ) : null}
          <IconButtonTooltip label="Drag to connect">
            <Button
              type="button"
              size="icon-xs"
              variant="ghost"
              onClick={() => {
                if (linkDragMoved.current) return;
                onStartLink(node.id);
              }}
              data-link-side="right"
              onPointerDown={startLinkDrag}
              onPointerMove={moveLinkDrag}
              onPointerUp={stopLinkDrag}
              onPointerCancel={cancelLinkDrag}
              aria-label="Drag to connect"
            >
              <Link2 size={13} />
            </Button>
          </IconButtonTooltip>
          {visualKind !== "group" ? (
            <IconButtonTooltip label="Send node to chat">
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                onClick={() => onSendToChat(chatText)}
                aria-label="Send node to chat"
              >
                <MessageSquare size={13} />
              </Button>
            </IconButtonTooltip>
          ) : null}
          {node.type === "text" ? (
            <IconButtonTooltip label="Promote to note">
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                onClick={() => onPromote(node.text)}
                aria-label="Promote to note"
              >
                <NotepadText size={13} />
              </Button>
            </IconButtonTooltip>
          ) : null}
          <IconButtonTooltip label="Delete node">
            <Button
              type="button"
              size="icon-xs"
              variant="ghost"
              onClick={() => onDelete(node.id)}
              aria-label="Delete node"
            >
              <Trash2 size={13} />
            </Button>
          </IconButtonTooltip>
        </footer>
      ) : null}
      {!isLabel ? (
        <ResizeHandle
          visualKind={visualKind}
          selected={selected}
          onPointerDown={startResize}
          onPointerMove={resize}
          onPointerUp={stopResize}
          onPointerCancel={stopResize}
        />
      ) : null}
      {!isLabel
        ? (["top", "right", "bottom", "left"] as const).map((side) => (
            <ConnectionHandle
              key={side}
              side={side}
              active={linkingFrom === node.id}
              target={isLinkTarget}
              onPointerDown={startLinkDrag}
              onPointerMove={moveLinkDrag}
              onPointerUp={stopLinkDrag}
              onPointerCancel={cancelLinkDrag}
            />
          ))
        : null}
    </article>
  );
}

function NodeBody({
  node,
  visualKind,
  editing,
  draft,
  fileContent,
  setDraft,
  commitText,
  cancelText,
}: {
  node: JSONCanvasNode;
  visualKind: CanvasVisualKind;
  editing: boolean;
  draft: string;
  fileContent?: string;
  setDraft: (value: string) => void;
  commitText: () => void;
  cancelText: () => void;
}) {
  if (node.type === "text") {
    if (editing) {
      return (
        // Plain <textarea>, not the shared <Textarea>: the cn-textarea theme CSS paints a
        // blue focus ring at a higher specificity than Tailwind utilities can override. A
        // native control takes a single themed afx-brand rounded boundary instead. The parent
        // body shell insets it (px/pt/pb) so the box clears the header/footer overlays and
        // reads as a contained field on all four sides. text-inherit/[font-family:inherit]
        // match the rendered markdown.
        <textarea
          aria-label="Edit text node"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              cancelText();
            }
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              event.preventDefault();
              commitText();
            }
          }}
          onBlur={commitText}
          className="h-full min-h-full w-full resize-none rounded-md border border-afx-brand/55 bg-transparent p-2 text-xs leading-relaxed text-inherit caret-current outline-none [font-family:inherit]"
          autoFocus
        />
      );
    }
    if (visualKind === "note") {
      return (
        // Notes carry a structured `# Title` line 0 (header shows it); keep hideTitle so the
        // body starts on the 24px ruled grid instead of rendering a large duplicate H1.
        <div className="min-h-full bg-[linear-gradient(to_bottom,transparent_0,transparent_23px,rgba(245,197,66,0.22)_24px)] bg-[length:100%_24px]">
          <MinimalMarkdown content={node.text} hideTitle breaks density="default" />
        </div>
      );
    }
    // Render the full text (including line 0) so what shows at rest matches the edit
    // textarea. The header's title is a derived label, not the only home of the first line.
    // `breaks`: canvas text is free-form, so a single newline is a line break (not a
    // CommonMark soft break that collapses to a space).
    return <MinimalMarkdown content={node.text} breaks density="default" />;
  }

  if (node.type === "file") {
    if (!node.file.toLowerCase().endsWith(".md")) {
      return <FileChip label={node.file} sublabel="preview disabled for non-markdown files" />;
    }
    if (!fileContent) {
      return <FileChip label={node.file} sublabel="loading markdown..." />;
    }
    if (fileContent.startsWith("> File not found in workspace:")) {
      return <FileChip label={node.file} sublabel="file not found in workspace" />;
    }
    return <MinimalMarkdown content={fileContent} hideTitle density="default" />;
  }

  if (node.type === "link") {
    return <FileChip label={node.url} sublabel="link node, read-only in this experiment" />;
  }

  return <div aria-hidden="true" className="pointer-events-none h-full min-h-[4rem]" />;
}

function FileChip({ label, sublabel }: { label: string; sublabel: string }) {
  return (
    <div className="flex h-full min-h-[4rem] flex-col items-center justify-center gap-2 border border-dashed border-border bg-muted/20 px-3 text-center">
      <FileText size={18} className="text-muted-foreground" />
      <p className="max-w-full truncate font-mono text-xs">{label}</p>
      <p className="text-[10px] text-muted-foreground">{sublabel}</p>
    </div>
  );
}

function labelTextStyleForNode(node: JSONCanvasNode, title: string): CSSProperties {
  const fontSize = labelFontSizeForNode(node, title);
  return {
    fontSize,
    lineHeight: `${Math.round(fontSize * 1.1)}px`,
  };
}

function labelInputStyleForNode(node: JSONCanvasNode, title: string): CSSProperties {
  const text = title.trim() || "Label";
  return {
    ...labelTextStyleForNode(node, text),
    width: `${Math.max(1.5, Math.min(64, text.length + 0.5))}ch`,
  };
}

function labelFontSizeForNode(node: JSONCanvasNode, title: string): number {
  const textLength = Math.max(4, (title.trim() || "Label").length);
  const heightBased = node.height * 0.42;
  const widthBased = node.width / (textLength * 0.58);
  return Math.round(Math.max(10, Math.min(72, Math.min(heightBased, widthBased))));
}

function NodeKindIcon({ visualKind }: { visualKind: CanvasVisualKind }) {
  const className =
    visualKind === "note"
      ? "text-amber-700 dark:text-amber-200"
      : visualKind === "label"
        ? "text-afx-brand"
        : visualKind === "group"
          ? "text-afx-brand"
          : visualKind === "file"
            ? "text-sky-600 dark:text-sky-300"
            : "text-muted-foreground";
  const label =
    visualKind === "note"
      ? "Note icon"
      : visualKind === "label"
        ? "Label icon"
        : visualKind === "group"
          ? "Group icon"
          : visualKind === "file"
            ? "File icon"
            : visualKind === "link"
              ? "Link icon"
              : "Card icon";
  const Icon =
    visualKind === "note"
      ? NotepadText
      : visualKind === "label"
        ? Tag
        : visualKind === "group"
          ? SquareIcon
          : visualKind === "file"
            ? FileText
            : visualKind === "link"
              ? Link2
              : Type;
  return (
    <span
      data-node-icon={visualKind}
      aria-label={label}
      title={label}
      className={`inline-flex shrink-0 items-center ${className}`}
    >
      <Icon size={13} aria-hidden="true" />
    </span>
  );
}

function ResizeHandle({
  visualKind,
  selected,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}: {
  visualKind: CanvasVisualKind;
  selected: boolean;
  onPointerDown: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerCancel: (event: PointerEvent<HTMLButtonElement>) => void;
}) {
  const className =
    visualKind === "label"
      ? `pointer-events-auto absolute -bottom-1 -right-3 z-50 inline-flex size-4 cursor-nwse-resize items-center justify-center rounded-[3px] border border-border/40 bg-background/80 text-muted-foreground opacity-0 shadow-sm transition hover:bg-muted hover:text-foreground focus:opacity-100 focus:outline-none focus:ring-1 focus:ring-afx-brand group-focus-within/canvas-label-header:opacity-90 group-hover/canvas-label-header:opacity-80 ${
          selected ? "opacity-90" : ""
        }`
      : // Groups now share the standard hover-reveal handle: the group frame is
        // pointer-events-auto, so group-hover fires the same as every other card.
        `pointer-events-none absolute bottom-1 right-1 z-50 inline-flex size-5 cursor-nwse-resize items-center justify-center rounded-[3px] border border-transparent bg-background/70 text-muted-foreground opacity-0 shadow-sm transition hover:border-border/70 hover:bg-muted hover:text-foreground focus:opacity-100 focus:outline-none focus:ring-1 focus:ring-afx-brand group-focus-within/canvas-node:pointer-events-auto group-focus-within/canvas-node:opacity-100 group-hover/canvas-node:pointer-events-auto group-hover/canvas-node:opacity-100 ${
          selected ? "pointer-events-auto opacity-90" : ""
        } ${
          visualKind === "note"
            ? "text-amber-900 hover:bg-amber-200 dark:text-amber-50 dark:hover:bg-amber-900"
            : ""
        }`;

  return (
    <button
      type="button"
      className={className}
      aria-label="Resize node"
      title="Resize node"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onLostPointerCapture={onPointerCancel}
    >
      <Maximize2
        size={visualKind === "label" ? 10 : visualKind === "group" ? 13 : 12}
        aria-hidden="true"
      />
    </button>
  );
}

function ConnectionHandle({
  side,
  active,
  target,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}: {
  side: CanvasLinkSide;
  active: boolean;
  target: boolean;
  onPointerDown: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerCancel: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={`Drag ${side} connector`}
      title={`Drag ${side} connector to another node`}
      data-link-side={side}
      className={`pointer-events-auto absolute z-40 flex size-4 items-center justify-center rounded-full border border-afx-brand/70 bg-background shadow-sm transition hover:scale-110 hover:bg-afx-brand hover:text-afx-brand-foreground focus:scale-110 focus:opacity-100 focus:outline-none focus:ring-1 focus:ring-afx-brand ${
        target || active ? "opacity-100" : "opacity-0 group-hover/canvas-node:opacity-80"
      } ${connectionHandlePosition(side)}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      <span className="block size-1.5 rounded-full bg-current" />
    </button>
  );
}

function connectionHandlePosition(side: CanvasLinkSide): string {
  if (side === "top") return "left-1/2 top-0 -translate-x-1/2 -translate-y-1/2";
  if (side === "right") return "right-0 top-1/2 -translate-y-1/2 translate-x-1/2";
  if (side === "bottom") return "bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2";
  return "left-0 top-1/2 -translate-x-1/2 -translate-y-1/2";
}

function linkSideFromEvent(event: PointerEvent<HTMLButtonElement>): CanvasLinkSide | undefined {
  const side = event.currentTarget.dataset["linkSide"];
  return side === "top" || side === "right" || side === "bottom" || side === "left"
    ? side
    : undefined;
}

function nodeFrameClass(
  visualKind: CanvasVisualKind,
  selected: boolean,
  isLinkTarget: boolean,
): string {
  const base =
    visualKind === "label"
      ? "group/canvas-node pointer-events-none absolute flex flex-col overflow-visible border text-card-foreground"
      : "group/canvas-node absolute flex flex-col overflow-visible border text-card-foreground shadow-sm";
  const variant =
    visualKind === "note"
      ? "border-amber-500/60 bg-amber-100 text-amber-950 shadow-[0_10px_30px_rgba(245,197,66,0.10)] dark:bg-amber-950/90 dark:text-amber-50"
      : visualKind === "label"
        ? "border-transparent bg-transparent text-foreground shadow-none hover:z-20"
        : visualKind === "group"
          ? "border border-dashed border-muted-foreground/35 bg-muted/[0.03] shadow-none dark:bg-muted/[0.04]"
          : visualKind === "file"
            ? "border-sky-500/35 bg-card hover:z-20"
            : "border-border bg-card hover:z-20";
  const state = selected
    ? visualKind === "label"
      ? "text-afx-brand"
      : "border-afx-brand ring-1 ring-afx-brand/40"
    : isLinkTarget
      ? "ring-2 ring-afx-brand/70"
      : "";
  return `${base} ${variant} ${state}`;
}

function nodeHeaderClass(visualKind: CanvasVisualKind, selected: boolean): string {
  if (visualKind === "label")
    return "group/canvas-label-header pointer-events-auto relative flex h-fit min-h-0 w-fit max-w-full touch-none cursor-move items-center gap-1 bg-transparent px-0 text-foreground";
  const layout =
    "absolute top-0 left-0 right-0 z-30 flex h-8 touch-none cursor-move items-center gap-1 border-b px-2 shadow-sm backdrop-blur-sm transition duration-150";
  // A group keeps its header (label + dashed frame) visible at rest — only its options
  // and resize handle hover-reveal. Every other node reveals the whole header on
  // hover / focus / select, mirroring the footer, so it shows only content at rest.
  // (Single pointer-events/opacity per branch — no conflicting classes.)
  const reveal =
    visualKind === "group" || selected
      ? "pointer-events-auto opacity-100"
      : "pointer-events-none opacity-0 group-focus-within/canvas-node:pointer-events-auto group-focus-within/canvas-node:opacity-100 group-hover/canvas-node:pointer-events-auto group-hover/canvas-node:opacity-100";
  const variant =
    visualKind === "note"
      ? "border-amber-500/35 bg-amber-200/90 text-amber-950 dark:bg-amber-900/80 dark:text-amber-50"
      : visualKind === "group"
        ? "border-muted-foreground/20 bg-background/85 text-muted-foreground"
        : visualKind === "file"
          ? "border-sky-500/25 bg-background/90"
          : "border-border bg-background/90";
  return `${layout} ${reveal} ${variant}`;
}

function labelActionsClass(selected: boolean, editingTitle: boolean): string {
  const visibility = editingTitle
    ? "opacity-0"
    : selected
      ? "opacity-100"
      : "opacity-0 group-focus-within/canvas-label-header:opacity-100 group-hover/canvas-label-header:opacity-100";
  return `pointer-events-auto absolute bottom-full right-0 z-50 mb-1 inline-flex items-center gap-0.5 rounded-[3px] border border-border/70 bg-background/95 px-1 py-0.5 text-muted-foreground shadow-sm backdrop-blur-sm transition ${visibility}`;
}

function nodeBodyShellClass(visualKind: CanvasVisualKind): string {
  const base = "min-h-0 flex-1 overflow-auto p-2";
  if (visualKind === "note")
    return `${base} bg-amber-100/95 text-amber-950 dark:bg-amber-950/80 dark:text-amber-50`;
  if (visualKind === "label") return "hidden";
  if (visualKind === "group") return `${base} overflow-visible bg-transparent p-1`;
  return base;
}

function nodeFooterClass(visualKind: CanvasVisualKind, selected: boolean): string {
  const base =
    "pointer-events-none absolute bottom-0 left-0 right-0 z-30 flex h-8 items-center gap-1 border-t px-1.5 opacity-0 shadow-sm backdrop-blur-sm transition duration-150 group-focus-within/canvas-node:pointer-events-auto group-focus-within/canvas-node:opacity-100 group-hover/canvas-node:pointer-events-auto group-hover/canvas-node:opacity-100";
  const state = selected ? "pointer-events-auto opacity-100" : "";
  if (visualKind === "note")
    return `${base} ${state} border-amber-500/35 bg-amber-200/90 text-amber-950 dark:bg-amber-900/80 dark:text-amber-50 [&_button]:text-amber-950 [&_svg]:text-amber-950 dark:[&_button]:text-amber-50 dark:[&_svg]:text-amber-50`;
  if (visualKind === "label") return "hidden";
  if (visualKind === "group")
    return `${base} ${state} border-muted-foreground/20 bg-background/85 text-muted-foreground`;
  if (visualKind === "file") return `${base} ${state} border-sky-500/25 bg-background/90`;
  return `${base} ${state} border-border bg-background/90`;
}

function nodeZIndex(
  visualKind: CanvasVisualKind,
  selected: boolean,
  isLinkTarget: boolean,
): number {
  if (selected || isLinkTarget) return 30;
  if (visualKind === "group") return 1;
  return 10;
}

function nodeVisualKind(node: JSONCanvasNode): CanvasVisualKind {
  if (node.type === "text") {
    if (node.afxNodeKind === "label") {
      return "label";
    }
    if (node.afxNodeKind === "note" || (node.color === "3" && /^#\s*Note\b/i.test(node.text))) {
      return "note";
    }
    return "text";
  }
  return node.type;
}

function nodeTitle(node: JSONCanvasNode): string {
  if (node.type === "text") return cleanMarkdownTitle(node.text.split(/\n/)[0] ?? "") || "Text";
  if (node.type === "file") return node.file.split("/").pop() || node.file;
  if (node.type === "link") return node.url;
  return node.label || "Group";
}

function canRenameNode(node: JSONCanvasNode): boolean {
  return node.type === "text" || node.type === "group";
}

function cleanMarkdownTitle(title: string): string {
  return title.replace(/^#{1,6}\s+/, "").slice(0, 60);
}

function nodeToContext(node: JSONCanvasNode, fileContent?: string): string {
  if (node.type === "text") return node.text;
  if (node.type === "file") return fileContent ? `${node.file}\n\n${fileContent}` : node.file;
  if (node.type === "link") return node.url;
  return node.label || "Group";
}

function canvasColor(color?: string): string {
  if (!color) return "transparent";
  if (color.startsWith("#")) return color;
  const presets: Record<string, string> = {
    "1": "#e5484d",
    "2": "#f76b15",
    "3": "#f5c542",
    "4": "#46a758",
    "5": "#00a2c7",
    "6": "#8e4ec6",
  };
  return presets[color] ?? "transparent";
}

function IconButtonTooltip({ label, children }: { label: string; children: ReactElement }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return !!target.closest("button,input,textarea,select,a");
}
