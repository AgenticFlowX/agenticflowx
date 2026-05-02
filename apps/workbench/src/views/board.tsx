/**
 * Board view — kanban board with markdown serialization.
 * Editable in workbench; saves markdown via host.
 *
 * @see docs/specs/220-app-workbench/spec.md [FR-5] [FR-11]
 * @see docs/specs/220-app-workbench/design.md [DES-BOARD]
 */
import { useEffect, useMemo, useRef, useState } from "react";

import {
  ChevronLeft,
  ChevronRight,
  Circle,
  Columns3,
  GripVertical,
  LayoutDashboard,
  Loader2,
  Pencil,
  Plus,
  Rows3,
  Trash2,
} from "lucide-react";

import type { KanbanBoard } from "@afx/shared";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@afx/ui/components/alert-dialog";
import { Button, buttonVariants } from "@afx/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@afx/ui/components/dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@afx/ui/components/empty";
import { Input } from "@afx/ui/components/input";
import { Popover, PopoverContent, PopoverTrigger } from "@afx/ui/components/popover";
import { ScrollArea } from "@afx/ui/components/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@afx/ui/components/select";
import { Textarea } from "@afx/ui/components/textarea";

import { useWorkbench } from "../context/workbench-context";
import { OpenActions } from "../lib/open-actions";

type EditTarget =
  | { kind: "card"; colIdx: number; cardIdx: number; text: string }
  | { kind: "column"; colIdx: number; text: string };

function serializeBoard(board: KanbanBoard): string {
  const title = board.meta?.title ?? board.name;
  const status = board.meta?.status ?? "active";
  const firstColumn = board.columns[0]?.title;
  const firstColumnIndex = firstColumn
    ? board.rawContent?.search(new RegExp(`^##\\s+${escapeRegExp(firstColumn)}\\s*$`, "m"))
    : -1;
  const prefix =
    firstColumnIndex !== undefined && firstColumnIndex > -1
      ? (board.rawContent ?? "").slice(0, firstColumnIndex).replace(/\s*$/, "\n\n")
      : [
          "---",
          "afx: true",
          "type: KANBAN",
          `title: "${title.replace(/"/g, '\\"')}"`,
          `status: ${status}`,
          "---",
          "",
          `# ${title}`,
          "",
        ].join("\n");
  const lines = [prefix.trimEnd(), ""];
  for (const column of board.columns) {
    lines.push(`## ${column.title}`, "");
    for (const card of column.cards) {
      const [first, ...rest] = card.text.trim().split("\n");
      if (!first) continue;
      if (rest.length === 0) {
        lines.push(`- ${first}`);
      } else {
        lines.push(`### ${first}`, "", ...rest, "");
      }
    }
    lines.push("");
  }
  return `${lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()}\n`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceBoard(boards: KanbanBoard[], next: KanbanBoard): KanbanBoard[] {
  const idx = boards.findIndex((board) => board.filePath === next.filePath);
  if (idx === -1) return boards;
  const updated = [...boards];
  updated[idx] = next;
  return updated;
}

// Kanban card — HTML5 draggable; edit/delete shown on hover only.
function KanbanCard({
  text,
  isDragging,
  onEdit,
  onDelete,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: {
  text: string;
  isDragging: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onDragStart: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
}) {
  const [title, ...body] = text.split("\n").filter(Boolean);
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDoubleClick={onEdit}
      className={`afx-surface-card group relative cursor-grab rounded-md border border-border px-3 py-2 text-sm transition-colors hover:border-afx-brand/30 active:cursor-grabbing ${
        isDragging ? "opacity-40" : ""
      }`}
    >
      <p className="leading-relaxed text-foreground">{title}</p>
      <div className="afx-surface-card pointer-events-none absolute right-1 top-1 flex items-center gap-0.5 rounded-md border border-border opacity-0 transition-opacity group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100">
        <Button variant="ghost" size="icon-xs" onClick={onEdit} aria-label="Edit card">
          <Pencil size={11} />
        </Button>
        <Button variant="ghost" size="icon-xs" onClick={onDelete} aria-label="Delete card">
          <Trash2 size={11} />
        </Button>
      </div>
      {body.length > 0 ? (
        <p className="mt-1 line-clamp-3 whitespace-pre-line text-xs leading-5 text-muted-foreground">
          {body.join("\n")}
        </p>
      ) : null}
    </div>
  );
}

// Kanban column - pre-computed icon
function KanbanColumn({
  title,
  cards,
  newCardText,
  onNewCardText,
  onAddCard,
  onEditColumn,
  onDeleteColumn,
  onMoveColumnLeft,
  onMoveColumnRight,
  onEditCard,
  onDeleteCard,
  draggingCard,
  onCardDragStart,
  onCardDragEnd,
  onCardDragOverCard,
  onCardDropOnCard,
  onColumnDragOver,
  onColumnDropAtEnd,
  onColumnHeaderDragStart,
  onColumnHeaderDragEnd,
  onColumnHeaderDrop,
  isDropTarget,
  isColumnDragSource,
  isColumnDropTarget,
  canMoveLeft,
  canMoveRight,
  colIdx,
}: {
  title: string;
  colIdx: number;
  cards: { text: string }[];
  newCardText: string;
  onNewCardText: (text: string) => void;
  onAddCard: () => void;
  onEditColumn: () => void;
  onDeleteColumn: () => void;
  onMoveColumnLeft: () => void;
  onMoveColumnRight: () => void;
  onEditCard: (cardIdx: number) => void;
  onDeleteCard: (cardIdx: number) => void;
  draggingCard: { colIdx: number; cardIdx: number } | null;
  onCardDragStart: (cardIdx: number) => void;
  onCardDragEnd: () => void;
  onCardDragOverCard: (cardIdx: number, e: React.DragEvent) => void;
  onCardDropOnCard: (cardIdx: number, e: React.DragEvent) => void;
  onColumnDragOver: (e: React.DragEvent) => void;
  onColumnDropAtEnd: (e: React.DragEvent) => void;
  onColumnHeaderDragStart: (e: React.DragEvent) => void;
  onColumnHeaderDragEnd: () => void;
  onColumnHeaderDrop: (e: React.DragEvent) => void;
  isDropTarget: boolean;
  isColumnDragSource: boolean;
  isColumnDropTarget: boolean;
  canMoveLeft: boolean;
  canMoveRight: boolean;
}) {
  const ringClass = isColumnDropTarget
    ? "border-afx-brand"
    : isDropTarget
      ? "border-afx-brand/50"
      : "border-border";
  return (
    <div
      onDragOver={onColumnDragOver}
      onDrop={onColumnDropAtEnd}
      className={`afx-surface-subtle flex h-full min-h-0 w-72 shrink-0 flex-col rounded-md border transition-all ${ringClass} ${
        isColumnDragSource ? "opacity-40" : ""
      } ${isColumnDropTarget ? "ring-2 ring-afx-brand/40" : ""}`}
    >
      <header
        draggable
        onDragStart={onColumnHeaderDragStart}
        onDragEnd={onColumnHeaderDragEnd}
        onDrop={onColumnHeaderDrop}
        onDragOver={(e) => e.preventDefault()}
        onDoubleClick={onEditColumn}
        className="afx-surface-toolbar group flex shrink-0 cursor-grab items-center justify-between gap-2 border-b border-border px-3 py-2 active:cursor-grabbing"
      >
        <div className="flex min-w-0 items-center gap-2">
          <GripVertical
            size={12}
            className="shrink-0 text-muted-foreground/40 group-hover:text-muted-foreground"
            aria-hidden
          />
          <Circle size={10} className="shrink-0 text-afx-brand" />
          <h3 className="truncate text-sm font-medium">{title}</h3>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <span className="flex size-5 items-center justify-center rounded-full bg-muted font-mono text-[10px] text-muted-foreground">
            {cards.length}
          </span>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={(e) => {
              e.stopPropagation();
              onMoveColumnLeft();
            }}
            disabled={!canMoveLeft}
            aria-label={`Move ${title} column left`}
            title="Move column left"
            className="opacity-0 transition-opacity group-hover:opacity-100"
          >
            <ChevronLeft size={11} />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={(e) => {
              e.stopPropagation();
              onMoveColumnRight();
            }}
            disabled={!canMoveRight}
            aria-label={`Move ${title} column right`}
            title="Move column right"
            className="opacity-0 transition-opacity group-hover:opacity-100"
          >
            <ChevronRight size={11} />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={(e) => {
              e.stopPropagation();
              onEditColumn();
            }}
            aria-label="Edit column"
            className="opacity-0 transition-opacity group-hover:opacity-100"
          >
            <Pencil size={11} />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteColumn();
            }}
            disabled={cards.length > 0}
            aria-label="Delete column"
            title={cards.length > 0 ? "Move or delete cards before deleting the column" : undefined}
            className="opacity-0 transition-opacity group-hover:opacity-100"
          >
            <Trash2 size={11} />
          </Button>
        </div>
      </header>
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-2 p-2">
          {cards.length > 0 ? (
            cards.map((card, idx) => (
              <KanbanCard
                key={card.text}
                text={card.text}
                isDragging={draggingCard?.colIdx === colIdx && draggingCard?.cardIdx === idx}
                onEdit={() => onEditCard(idx)}
                onDelete={() => onDeleteCard(idx)}
                onDragStart={() => onCardDragStart(idx)}
                onDragEnd={onCardDragEnd}
                onDragOver={(e) => onCardDragOverCard(idx, e)}
                onDrop={(e) => onCardDropOnCard(idx, e)}
              />
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Circle size={16} className="mb-1 text-muted-foreground/30" />
              <p className="text-xs text-muted-foreground">Drop cards here</p>
            </div>
          )}
        </div>
      </ScrollArea>
      <div className="afx-surface-subtle flex shrink-0 items-center gap-1 border-t border-border p-2">
        <Input
          value={newCardText}
          onChange={(event) => onNewCardText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") onAddCard();
          }}
          placeholder="Add card..."
          className="afx-field-surface h-7 text-xs"
          aria-label={`Add card to ${title}`}
        />
        <Button size="icon-xs" variant="outline" onClick={onAddCard} disabled={!newCardText.trim()}>
          <Plus size={12} />
        </Button>
      </div>
    </div>
  );
}

export default function Board() {
  const { kanban, send } = useWorkbench();
  const remoteBoards = useMemo(() => kanban?.boards ?? [], [kanban]);
  const [localBoards, setLocalBoards] = useState<{
    source: KanbanBoard[];
    boards: KanbanBoard[];
  } | null>(null);
  const boards = localBoards?.source === remoteBoards ? localBoards.boards : remoteBoards;
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [pendingBoardSlug, setPendingBoardSlug] = useState<string | null>(null);
  const [boardDialogOpen, setBoardDialogOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameDraft, setRenameDraft] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [columnPopoverOpen, setColumnPopoverOpen] = useState(false);
  const [newBoardName, setNewBoardName] = useState("");
  const [newColumnName, setNewColumnName] = useState("");
  const [newCards, setNewCards] = useState<Record<string, string>>({});
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [draggingCard, setDraggingCard] = useState<{ colIdx: number; cardIdx: number } | null>(
    null,
  );
  const [dropTargetCol, setDropTargetCol] = useState<number | null>(null);
  const [draggingColumn, setDraggingColumn] = useState<number | null>(null);
  const [dropTargetColumnIdx, setDropTargetColumnIdx] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  // Auto-navigate to a freshly created board: when the host's afxUpdate arrives
  // with the new file, prefer it over selectedFilePath until the user picks elsewhere.
  const pendingMatch = pendingBoardSlug
    ? boards.find((b) => b.filePath.endsWith(`${pendingBoardSlug}.md`))
    : null;
  const effectiveFilePath = pendingMatch?.filePath ?? selectedFilePath;
  const selected = boards.find((b) => b.filePath === effectiveFilePath) ?? boards[0] ?? null;

  function selectBoard(filePath: string) {
    setSelectedFilePath(filePath);
    setPendingBoardSlug(null);
    setLocalBoards(null);
  }

  // Calculate totals
  const totalColumns = selected?.columns.length ?? 0;
  const totalCards = selected?.columns.reduce((sum, col) => sum + col.cards.length, 0) ?? 0;

  function createBoard() {
    const name = newBoardName.trim();
    if (!name) return;
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    setPendingBoardSlug(slug);
    send({ type: "afxCreateKanbanBoard", name });
    setNewBoardName("");
    setBoardDialogOpen(false);
  }

  function openRenameDialog() {
    if (!selected) return;
    setRenameDraft(selected.meta?.title ?? selected.name);
    setRenameDialogOpen(true);
  }

  function renameBoard() {
    if (!selected) return;
    const name = renameDraft.trim();
    if (!name) return;
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    send({ type: "afxRenameKanbanBoard", filePath: selected.filePath, name });
    setPendingBoardSlug(slug);
    setSelectedFilePath(null);
    setLocalBoards(null);
    setRenameDialogOpen(false);
  }

  function deleteBoard() {
    if (!selected) return;
    send({ type: "afxDeleteKanbanBoard", filePath: selected.filePath });
    setSelectedFilePath(null);
    setPendingBoardSlug(null);
    setLocalBoards(null);
    setDeleteConfirmOpen(false);
  }

  function saveBoard(next: KanbanBoard) {
    setLocalBoards((current) => {
      const base = current?.source === remoteBoards ? current.boards : remoteBoards;
      return { source: remoteBoards, boards: replaceBoard(base, next) };
    });
    send({ type: "afxSaveFile", path: next.filePath, content: serializeBoard(next) });
    setIsSaving(true);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => setIsSaving(false), 800);
  }

  function updateSelected(mutator: (board: KanbanBoard) => KanbanBoard) {
    if (!selected) return;
    saveBoard(mutator(selected));
  }

  function addColumn() {
    const title = newColumnName.trim();
    if (!title) return;
    updateSelected((board) => ({
      ...board,
      columns: [...board.columns, { title, cards: [] }],
    }));
    setNewColumnName("");
    setColumnPopoverOpen(false);
  }

  function deleteColumn(colIdx: number) {
    updateSelected((board) => ({
      ...board,
      columns: board.columns.filter((_, idx) => idx !== colIdx),
    }));
  }

  function addCard(colIdx: number, draftKey: string) {
    const text = newCards[draftKey]?.trim();
    if (!text) return;
    updateSelected((board) => ({
      ...board,
      columns: board.columns.map((col, idx) =>
        idx === colIdx ? { ...col, cards: [...col.cards, { text }] } : col,
      ),
    }));
    setNewCards((prev) => ({ ...prev, [draftKey]: "" }));
  }

  function deleteCard(colIdx: number, cardIdx: number) {
    updateSelected((board) => ({
      ...board,
      columns: board.columns.map((col, idx) =>
        idx === colIdx ? { ...col, cards: col.cards.filter((_, i) => i !== cardIdx) } : col,
      ),
    }));
  }

  function moveCardTo(
    fromColIdx: number,
    fromCardIdx: number,
    toColIdx: number,
    toCardIdx: number,
  ) {
    updateSelected((board) => {
      if (toColIdx < 0 || toColIdx >= board.columns.length) return board;
      const columns = board.columns.map((col) => ({ ...col, cards: [...col.cards] }));
      const source = columns[fromColIdx];
      const target = columns[toColIdx];
      if (!source || !target) return board;
      const [card] = source.cards.splice(fromCardIdx, 1);
      if (!card) return board;
      const insertAt = Math.max(0, Math.min(target.cards.length, toCardIdx));
      target.cards.splice(insertAt, 0, card);
      return { ...board, columns };
    });
  }

  function reorderColumn(fromIdx: number, toIdx: number) {
    if (fromIdx === toIdx) return;
    updateSelected((board) => {
      if (toIdx < 0 || toIdx >= board.columns.length) return board;
      const columns = [...board.columns];
      const [col] = columns.splice(fromIdx, 1);
      if (!col) return board;
      columns.splice(toIdx, 0, col);
      return { ...board, columns };
    });
  }

  function markCardDropTarget(colIdx: number): void {
    setDropTargetCol((current) => (current === colIdx ? current : colIdx));
  }

  function markColumnDropTarget(colIdx: number): void {
    setDropTargetColumnIdx((current) => (current === colIdx ? current : colIdx));
  }

  function saveEditTarget() {
    if (!editTarget) return;
    const text = editTarget.text.trim();
    if (!text) return;
    updateSelected((board) => ({
      ...board,
      columns: board.columns.map((col, colIdx) => {
        if (editTarget.kind === "column" && colIdx === editTarget.colIdx) {
          return { ...col, title: text };
        }
        if (editTarget.kind === "card" && colIdx === editTarget.colIdx) {
          return {
            ...col,
            cards: col.cards.map((card, cardIdx) =>
              cardIdx === editTarget.cardIdx ? { text } : card,
            ),
          };
        }
        return col;
      }),
    }));
    setEditTarget(null);
  }

  if (!kanban || boards.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <LayoutDashboard size={32} />
          </EmptyMedia>
          <EmptyTitle>No boards found</EmptyTitle>
          <EmptyDescription>
            Boards live as markdown files in <code>.afx/kanban/</code>. Create one to get started.
          </EmptyDescription>
          <div className="mt-3 flex w-full max-w-xs items-center gap-2">
            <Input
              value={newBoardName}
              onChange={(event) => setNewBoardName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") createBoard();
              }}
              placeholder="Board name"
              className="afx-field-surface h-8 text-xs"
              aria-label="Board name"
            />
            <Button size="sm" onClick={createBoard} disabled={!newBoardName.trim()}>
              <Plus size={14} className="mr-1" />
              Create
            </Button>
          </div>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {/* Board selector + stats */}
      <div className="afx-surface-toolbar flex items-center gap-2 border-b border-border px-3 py-2">
        <Rows3 size={14} className="shrink-0 text-muted-foreground" />
        <Select value={selected?.filePath ?? ""} onValueChange={selectBoard}>
          <SelectTrigger className="h-7 w-[180px] cursor-pointer text-xs">
            <SelectValue placeholder="Select board" />
          </SelectTrigger>
          <SelectContent>
            {boards.map((b) => {
              const cardCount = b.columns.reduce((sum, col) => sum + col.cards.length, 0);
              return (
                <SelectItem key={b.filePath} value={b.filePath} className="text-xs">
                  <div className="flex items-center justify-between gap-4">
                    <span>{b.name}</span>
                    <span className="text-muted-foreground">{cardCount}</span>
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
        {selected && (
          <div className="flex shrink-0 items-center gap-0.5">
            <Button
              size="icon-xs"
              variant="ghost"
              onClick={openRenameDialog}
              aria-label="Rename board"
              title="Rename board"
              className="size-7 text-muted-foreground hover:text-foreground"
            >
              <Pencil size={12} />
            </Button>
            <Button
              size="icon-xs"
              variant="ghost"
              onClick={() => setDeleteConfirmOpen(true)}
              aria-label="Delete board"
              title="Delete board"
              className="size-7 text-muted-foreground hover:text-destructive"
            >
              <Trash2 size={12} />
            </Button>
          </div>
        )}

        {/* Latest-5 quick-pick chips */}
        {boards.length > 1 && (
          <div className="flex min-w-0 items-center gap-1 overflow-x-auto">
            {boards.slice(0, 5).map((b) => {
              const isActive = b.filePath === selected?.filePath;
              return (
                <button
                  key={b.filePath}
                  type="button"
                  onClick={() => selectBoard(b.filePath)}
                  className={`shrink-0 cursor-pointer rounded-md px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider transition-colors ${
                    isActive
                      ? "bg-afx-brand/15 text-afx-brand"
                      : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                  }`}
                  title={b.name}
                >
                  {b.name}
                </button>
              );
            })}
          </div>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
          {isSaving && (
            <span
              className="flex items-center gap-1 text-[10px] text-afx-brand-soft"
              aria-live="polite"
            >
              <Loader2 size={11} className="animate-spin" />
              Saving…
            </span>
          )}
          {selected?.meta?.status && (
            <span className="font-mono text-[10px] uppercase tracking-widest">
              {selected.meta.status}
            </span>
          )}
          <span className="font-mono">
            {totalColumns} cols · {totalCards} cards
          </span>
          {selected && <OpenActions filePath={selected.filePath} />}
          <Popover open={columnPopoverOpen} onOpenChange={setColumnPopoverOpen}>
            <PopoverTrigger
              className={buttonVariants({
                size: "sm",
                variant: "ghost",
                className: "h-7 gap-1 text-xs",
              })}
              aria-label="Add column"
            >
              <Columns3 size={12} />
              Column
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64 p-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  New column
                </label>
                <div className="flex items-center gap-1">
                  <Input
                    autoFocus
                    value={newColumnName}
                    onChange={(event) => setNewColumnName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") addColumn();
                    }}
                    placeholder="Column title"
                    className="afx-field-surface h-7 text-xs"
                    aria-label="New column name"
                  />
                  <Button
                    size="icon-xs"
                    variant="outline"
                    onClick={addColumn}
                    disabled={!newColumnName.trim()}
                    aria-label="Add column"
                  >
                    <Plus size={12} />
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1 text-xs"
            onClick={() => setBoardDialogOpen(true)}
            aria-label="Create a new board"
          >
            <Plus size={12} />
            New board
          </Button>
        </div>
      </div>

      {/* Kanban columns */}
      <div
        className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden"
        data-testid="board-scroll-container"
      >
        <div className="flex h-full w-max gap-3 p-3">
          {selected?.columns.map((col, colIdx) => {
            const draftKey = col.title;
            return (
              <KanbanColumn
                key={col.title}
                title={col.title}
                cards={col.cards}
                newCardText={newCards[draftKey] ?? ""}
                onNewCardText={(text) => setNewCards((prev) => ({ ...prev, [draftKey]: text }))}
                onAddCard={() => addCard(colIdx, draftKey)}
                onEditColumn={() => setEditTarget({ kind: "column", colIdx, text: col.title })}
                onDeleteColumn={() => deleteColumn(colIdx)}
                onMoveColumnLeft={() => reorderColumn(colIdx, colIdx - 1)}
                onMoveColumnRight={() => reorderColumn(colIdx, colIdx + 1)}
                onEditCard={(cardIdx) =>
                  setEditTarget({
                    kind: "card",
                    colIdx,
                    cardIdx,
                    text: col.cards[cardIdx]?.text ?? "",
                  })
                }
                onDeleteCard={(cardIdx) => deleteCard(colIdx, cardIdx)}
                colIdx={colIdx}
                draggingCard={draggingCard}
                onCardDragStart={(cardIdx) => setDraggingCard({ colIdx, cardIdx })}
                onCardDragEnd={() => {
                  setDraggingCard(null);
                  setDropTargetCol(null);
                }}
                onCardDragOverCard={(_cardIdx, e) => {
                  if (!draggingCard) return;
                  e.preventDefault();
                  markCardDropTarget(colIdx);
                }}
                onCardDropOnCard={(cardIdx, e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!draggingCard) return;
                  const insertAt =
                    draggingCard.colIdx === colIdx && draggingCard.cardIdx < cardIdx
                      ? cardIdx
                      : cardIdx;
                  moveCardTo(draggingCard.colIdx, draggingCard.cardIdx, colIdx, insertAt);
                  setDraggingCard(null);
                  setDropTargetCol(null);
                }}
                onColumnDragOver={(e) => {
                  if (draggingCard) {
                    e.preventDefault();
                    markCardDropTarget(colIdx);
                    return;
                  }
                  if (draggingColumn !== null && draggingColumn !== colIdx) {
                    e.preventDefault();
                    markColumnDropTarget(colIdx);
                  }
                }}
                onColumnDropAtEnd={(e) => {
                  if (draggingCard) {
                    e.preventDefault();
                    const targetEnd = selected?.columns[colIdx]?.cards.length ?? 0;
                    moveCardTo(draggingCard.colIdx, draggingCard.cardIdx, colIdx, targetEnd);
                    setDraggingCard(null);
                    setDropTargetCol(null);
                    return;
                  }
                  if (draggingColumn !== null && draggingColumn !== colIdx) {
                    e.preventDefault();
                    e.stopPropagation();
                    reorderColumn(draggingColumn, colIdx);
                    setDraggingColumn(null);
                    setDropTargetColumnIdx(null);
                  }
                }}
                onColumnHeaderDragStart={(e) => {
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", col.title);
                  setDraggingColumn(colIdx);
                }}
                onColumnHeaderDragEnd={() => {
                  setDraggingColumn(null);
                  setDropTargetColumnIdx(null);
                }}
                onColumnHeaderDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (draggingColumn !== null && draggingColumn !== colIdx) {
                    reorderColumn(draggingColumn, colIdx);
                  }
                  setDraggingColumn(null);
                  setDropTargetColumnIdx(null);
                }}
                isDropTarget={dropTargetCol === colIdx}
                isColumnDragSource={draggingColumn === colIdx}
                isColumnDropTarget={
                  draggingColumn !== null &&
                  draggingColumn !== colIdx &&
                  dropTargetColumnIdx === colIdx
                }
                canMoveLeft={colIdx > 0}
                canMoveRight={colIdx < selected.columns.length - 1}
              />
            );
          })}
        </div>
      </div>

      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename board</DialogTitle>
            <DialogDescription>
              The underlying file will be renamed and the title updated inside the markdown.
            </DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            value={renameDraft}
            onChange={(event) => setRenameDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") renameBoard();
            }}
            placeholder="Board name"
            className="afx-field-surface"
            aria-label="New board name"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={renameBoard}
              disabled={
                !renameDraft.trim() ||
                renameDraft.trim() === (selected?.meta?.title ?? selected?.name ?? "")
              }
            >
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this board?</AlertDialogTitle>
            <AlertDialogDescription>
              The markdown file{" "}
              <code className="font-mono text-foreground">{selected?.filePath}</code> will be
              removed. This action cannot be undone from the workbench.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteBoard}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete board
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={boardDialogOpen} onOpenChange={setBoardDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New board</DialogTitle>
            <DialogDescription>
              Boards live as markdown files in <code className="font-mono">.afx/kanban/</code>.
            </DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            value={newBoardName}
            onChange={(event) => setNewBoardName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") createBoard();
            }}
            placeholder="e.g. Roadmap, Backlog, Q2 Goals"
            className="afx-field-surface"
            aria-label="New board name"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setBoardDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createBoard} disabled={!newBoardName.trim()}>
              <Plus size={14} className="mr-1" />
              Create board
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editTarget !== null} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editTarget?.kind === "column" ? "Edit column" : "Edit card"}</DialogTitle>
            <DialogDescription>
              Changes are saved back to the selected kanban markdown file.
            </DialogDescription>
          </DialogHeader>
          {editTarget?.kind === "column" ? (
            <Input
              value={editTarget.text}
              onChange={(event) => setEditTarget({ ...editTarget, text: event.target.value })}
              aria-label="Column title"
            />
          ) : editTarget ? (
            <Textarea
              value={editTarget.text}
              onChange={(event) => setEditTarget({ ...editTarget, text: event.target.value })}
              className="min-h-32"
              aria-label="Card text"
            />
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>
              Cancel
            </Button>
            <Button onClick={saveEditTarget} disabled={!editTarget?.text.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
