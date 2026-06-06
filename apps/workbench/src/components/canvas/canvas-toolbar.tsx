/**
 * Toolbar for the experimental Workbench canvas.
 *
 * @see docs/specs/229-app-workbench-canvas/spec.md [FR-16] [FR-17]
 * @see docs/specs/229-app-workbench-canvas/design.md [DES-UI]
 */
import { type ReactElement, useState } from "react";

import {
  ChevronDown,
  FilePlus2,
  FolderOpen,
  MessageSquareText,
  Minus,
  NotebookPen,
  Palette,
  Plus,
  Scan,
  Square,
  Tag,
  Type,
} from "lucide-react";

import type { CanvasColor, DocumentRow } from "@afx/shared";
import { Button } from "@afx/ui/components/button";
import { Input } from "@afx/ui/components/input";
import { NativeSelect, NativeSelectOption } from "@afx/ui/components/native-select";
import { Popover, PopoverContent, PopoverTrigger } from "@afx/ui/components/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@afx/ui/components/tooltip";
import { cn } from "@afx/ui/lib/utils";

export type CanvasSaveStatus = "saved" | "saving" | "error";

const CANVAS_COLOR_SWATCHES: Array<{
  value: CanvasColor | undefined;
  label: string;
  className: string;
}> = [
  { value: undefined, label: "No color", className: "bg-transparent" },
  { value: "1", label: "Red", className: "bg-[#e5484d]" },
  { value: "2", label: "Orange", className: "bg-[#f76b15]" },
  { value: "3", label: "Yellow", className: "bg-[#f5c542]" },
  { value: "4", label: "Green", className: "bg-[#46a758]" },
  { value: "5", label: "Blue", className: "bg-[#00a2c7]" },
  { value: "6", label: "Purple", className: "bg-[#8e4ec6]" },
];

const TOOLBAR_BUTTON_CLASS =
  "h-7 rounded-sm border-transparent bg-transparent px-2 text-xs font-medium text-foreground/80 shadow-none hover:border-border/60 hover:bg-muted/65 hover:text-foreground disabled:opacity-40";
const TOOLBAR_ICON_BUTTON_CLASS =
  "size-7 rounded-sm border-transparent bg-transparent text-muted-foreground shadow-none hover:border-border/60 hover:bg-muted/65 hover:text-foreground disabled:opacity-40";
const TOOLBAR_RAIL_CLASS =
  "pointer-events-auto flex h-10 w-full min-w-0 items-center gap-1 rounded-md border border-border/70 bg-background/92 p-1 shadow-[0_1px_0_rgba(255,255,255,0.05),0_10px_28px_rgba(0,0,0,0.10)] backdrop-blur supports-[backdrop-filter]:bg-background/82";
const TOOLBAR_GROUP_CLASS = "flex min-w-0 items-center gap-0.5";
const TOOLBAR_DIVIDER_CLASS = "mx-0.5 h-5 w-px shrink-0 bg-border/70";

interface CanvasToolbarProps {
  documents: DocumentRow[];
  selectedDocument: string;
  documentPathInput: string;
  selectedCount: number;
  zoom: number;
  onDocumentChange: (path: string) => void;
  onDocumentPathInputChange: (path: string) => void;
  onAddText: () => void;
  onAddNote: () => void;
  onAddLabel: () => void;
  onAddGroup: () => void;
  onAddFile: () => void;
  onBrowseFile: () => void;
  onColorSelected: (color: CanvasColor | undefined) => void;
  onFit: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onSendSelection: () => void;
}

export function CanvasToolbar({
  documents,
  selectedDocument,
  documentPathInput,
  selectedCount,
  zoom,
  onDocumentChange,
  onDocumentPathInputChange,
  onAddText,
  onAddNote,
  onAddLabel,
  onAddGroup,
  onAddFile,
  onBrowseFile,
  onColorSelected,
  onFit,
  onZoomIn,
  onZoomOut,
  onSendSelection,
}: CanvasToolbarProps) {
  const [docPickerOpen, setDocPickerOpen] = useState(false);
  const mdDocs = documents.filter((doc) => doc.filePath.toLowerCase().endsWith(".md"));
  const canAddFile = selectedDocument.trim().length > 0 || documentPathInput.trim().length > 0;
  const canSendSelection = selectedCount >= 2;
  const selectedLabel = selectedCount > 99 ? "99+" : String(selectedCount);

  return (
    <div className="pointer-events-none absolute left-2 right-2 top-2 z-[60] text-xs">
      <div className={TOOLBAR_RAIL_CLASS} data-testid="canvas-toolbar">
        <div className={cn(TOOLBAR_GROUP_CLASS, "shrink-0")}>
          <TooltippedButton label="Add text node" tooltip="Add a markdown thought card.">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className={TOOLBAR_BUTTON_CLASS}
              onClick={onAddText}
              aria-label="Add text node"
            >
              <Type size={13} />
              <span className="hidden min-[520px]:inline">Card</span>
            </Button>
          </TooltippedButton>
          <TooltippedButton label="Add notepad node" tooltip="Add a yellow markdown note card.">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className={TOOLBAR_BUTTON_CLASS}
              onClick={onAddNote}
              aria-label="Add notepad node"
            >
              <NotebookPen size={13} />
              <span className="hidden min-[520px]:inline">Note</span>
            </Button>
          </TooltippedButton>
          <TooltippedButton label="Add label" tooltip="Add a plain canvas label.">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className={TOOLBAR_BUTTON_CLASS}
              onClick={onAddLabel}
              aria-label="Add label"
            >
              <Tag size={13} />
              <span className="hidden min-[520px]:inline">Label</span>
            </Button>
          </TooltippedButton>
          <TooltippedButton label="Add group" tooltip="Add a group for clustering related cards.">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className={TOOLBAR_BUTTON_CLASS}
              onClick={onAddGroup}
              aria-label="Add group"
            >
              <Square size={13} />
              <span className="hidden min-[520px]:inline">Group</span>
            </Button>
          </TooltippedButton>
        </div>
        <div className={TOOLBAR_DIVIDER_CLASS} />
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className={TOOLBAR_BUTTON_CLASS}
              disabled={selectedCount === 0}
              aria-label="Set selected node color"
              title={
                selectedCount === 0 ? "Select a node to color it." : "Set selected node color."
              }
            >
              <Palette size={13} />
              <span className="hidden min-[680px]:inline">Color</span>
              <ChevronDown size={12} className="hidden text-muted-foreground min-[680px]:block" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            side="bottom"
            align="start"
            sideOffset={6}
            className="z-[70] w-auto rounded-md p-2"
          >
            <div className="grid grid-cols-7 gap-1" aria-label="Canvas node colors">
              {CANVAS_COLOR_SWATCHES.map((swatch) => (
                <Tooltip key={swatch.label}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label={`Set selected nodes color ${swatch.label}`}
                      className={cn(
                        "size-6 rounded-[3px] border border-border/70 ring-offset-background transition hover:scale-105 hover:ring-1 hover:ring-afx-brand/35 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                        swatch.value === undefined && "bg-background/80",
                        swatch.className,
                      )}
                      onClick={() => onColorSelected(swatch.value)}
                    />
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    Set selected nodes color: {swatch.label}
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </PopoverContent>
        </Popover>
        <Popover open={docPickerOpen} onOpenChange={setDocPickerOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className={TOOLBAR_BUTTON_CLASS}
              aria-label="Open markdown document picker"
              title="Add a markdown file node from specs, notes, or a path."
            >
              <FilePlus2 size={13} />
              <span className="hidden min-[520px]:inline">Doc</span>
              <ChevronDown size={12} className="hidden text-muted-foreground min-[520px]:block" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            side="bottom"
            align="start"
            sideOffset={6}
            className="z-[70] w-[min(34rem,calc(100vw-2rem))] rounded-md p-2"
          >
            <div className="flex min-w-0 flex-col gap-2">
              <div className="flex items-center gap-2">
                <FilePlus2 size={13} className="shrink-0 text-afx-brand" />
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  Markdown doc
                </span>
              </div>
              <div className="grid min-w-0 gap-1.5 min-[520px]:grid-cols-[minmax(10rem,15rem)_minmax(0,1fr)]">
                <NativeSelect
                  size="sm"
                  value={selectedDocument}
                  onChange={(event) => onDocumentChange(event.target.value)}
                  aria-label="Document for file node"
                  className="[&_[data-slot=native-select]]:h-7 [&_[data-slot=native-select]]:rounded-sm [&_[data-slot=native-select]]:border-border/60 [&_[data-slot=native-select]]:bg-muted/35 [&_[data-slot=native-select]]:font-mono [&_[data-slot=native-select]]:text-[10px]"
                >
                  <NativeSelectOption value="">Select markdown doc</NativeSelectOption>
                  {mdDocs.map((doc) => (
                    <NativeSelectOption key={doc.filePath} value={doc.filePath}>
                      {doc.name || doc.filePath}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                <Input
                  value={documentPathInput}
                  onChange={(event) => onDocumentPathInputChange(event.target.value)}
                  placeholder="docs/spec.md or /path/note.md"
                  aria-label="Markdown path for file node"
                  className="h-7 min-w-0 rounded-sm border-border/60 bg-muted/35 font-mono text-[10px] placeholder:text-muted-foreground/70"
                />
              </div>
              <div className="flex items-center justify-end gap-1">
                <TooltippedButton
                  label="Browse markdown file"
                  tooltip="Pick a markdown file from any folder VS Code can read."
                >
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    className={TOOLBAR_ICON_BUTTON_CLASS}
                    onClick={onBrowseFile}
                    aria-label="Browse markdown file"
                  >
                    <FolderOpen size={13} />
                  </Button>
                </TooltippedButton>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 rounded-sm px-2 text-xs"
                  disabled={!canAddFile}
                  onClick={() => {
                    onAddFile();
                    setDocPickerOpen(false);
                  }}
                  aria-label="Add file node"
                  title="Add selected or typed markdown path as a file node"
                >
                  <FilePlus2 size={13} />
                  Add doc
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
        <div className={TOOLBAR_DIVIDER_CLASS} />
        <div className="min-w-4 flex-1" />
        <TooltippedButton
          label={canSendSelection ? `Chat with ${selectedLabel} selected` : "Chat with 2+ selected"}
          tooltip={
            canSendSelection
              ? "Send the selected canvas cards as one combined chat context."
              : "Select at least two cards to enable a combined chat context."
          }
        >
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className={TOOLBAR_BUTTON_CLASS}
            disabled={!canSendSelection}
            onClick={onSendSelection}
            aria-label="Send selected canvas context to chat"
            title={
              canSendSelection
                ? `Send ${selectedLabel} selected canvas cards to chat`
                : "Select 2 or more canvas cards to send a batch to chat"
            }
          >
            <MessageSquareText size={13} />
            <span className="hidden min-[700px]:inline">
              {canSendSelection ? `Chat ${selectedLabel}` : "Chat 2+"}
            </span>
          </Button>
        </TooltippedButton>
        <div className={TOOLBAR_DIVIDER_CLASS} />
        <div className={cn(TOOLBAR_GROUP_CLASS, "shrink-0")}>
          <TooltippedButton
            label="Fit to view"
            tooltip="Fit all canvas nodes into the visible area."
          >
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className={TOOLBAR_BUTTON_CLASS}
              onClick={onFit}
              aria-label="Fit to view"
            >
              <Scan size={13} />
              <span className="hidden min-[720px]:inline">Fit</span>
            </Button>
          </TooltippedButton>
          <TooltippedButton label="Zoom out" tooltip="Zoom the canvas out.">
            <Button
              type="button"
              size="icon-xs"
              variant="ghost"
              className={TOOLBAR_ICON_BUTTON_CLASS}
              onClick={onZoomOut}
              aria-label="Zoom out"
            >
              <Minus size={13} />
            </Button>
          </TooltippedButton>
          <span className="w-10 shrink-0 text-center font-mono text-[10px] tabular-nums text-muted-foreground">
            {Math.round(zoom * 100)}%
          </span>
          <TooltippedButton label="Zoom in" tooltip="Zoom the canvas in.">
            <Button
              type="button"
              size="icon-xs"
              variant="ghost"
              className={TOOLBAR_ICON_BUTTON_CLASS}
              onClick={onZoomIn}
              aria-label="Zoom in"
            >
              <Plus size={13} />
            </Button>
          </TooltippedButton>
        </div>
      </div>
    </div>
  );
}

function TooltippedButton({
  label,
  tooltip,
  children,
}: {
  label: string;
  tooltip: string;
  children: ReactElement;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-[220px] text-[11px] leading-snug">
        <span className="font-medium">{label}</span>
        <span className="block text-muted-foreground">{tooltip}</span>
      </TooltipContent>
    </Tooltip>
  );
}
