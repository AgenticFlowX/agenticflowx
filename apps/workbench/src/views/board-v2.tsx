/**
 * Revision-aware Board surface with linked AFX work and accessible dnd-kit movement.
 *
 * @see docs/specs/221-app-workbench-board/spec.md [FR-1] [FR-4] [FR-11] [FR-15]
 * @see docs/specs/221-app-workbench-board/design.md [DES-BOARD-LIVE-SYNC] [DES-BOARD-DND] [DES-BOARD-SAVE]
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  AlertTriangle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Circle,
  Columns3,
  Copy,
  ExternalLink,
  GripVertical,
  Link2,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Rows3,
  Trash2,
} from "lucide-react";

import type {
  KanbanBoard,
  KanbanBoardMutation,
  KanbanCard,
  KanbanColumn,
  LinkedWorkItemRef,
} from "@afx/shared";
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
import { Badge } from "@afx/ui/components/badge";
import { Button } from "@afx/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@afx/ui/components/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@afx/ui/components/dropdown-menu";
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

import { LinkWorkPicker } from "../components/link-work-picker";
import { LinkedWorkItem } from "../components/linked-work-item";
import { useWorkbench } from "../context/workbench-context";
import { workbenchOn } from "../lib/bridge";
import { OpenActions } from "../lib/open-actions";

type EditTarget =
  | { kind: "card"; cardId: string; text: string }
  | { kind: "column"; columnId: string; text: string };

interface PendingBoardMutation {
  requestId: string;
  expectedRevision: string;
  mutation: KanbanBoardMutation;
}

interface PendingBoardLifecycle {
  requestId: string;
  kind: "create" | "rename" | "delete";
}

interface BoardProblem {
  kind: "error" | "conflict";
  message: string;
  failedBoard?: {
    expectedRevision: string;
    mutations: KanbanBoardMutation[];
    retryable: boolean;
  };
}

interface QueuedMutation {
  mutation: KanbanBoardMutation;
}

function requestId(prefix: string): string {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`}`;
}

function sourcePath(source: NonNullable<KanbanBoard["source"]>): string {
  return `${source.rootName}/${source.relativePath}`;
}

function featureName(relativePath: string): string {
  const parts = relativePath.replace(/\\/g, "/").split("/");
  return parts[parts.length - 2] ?? parts[parts.length - 1]?.replace(/\.md$/i, "") ?? relativePath;
}

function linkKey(ref: LinkedWorkItemRef): string {
  return `${ref.kind}:${ref.source.rootUri}:${ref.source.relativePath}:${ref.kind === "task" ? ref.wbsId : ""}`;
}

function normalizeBoard(board: KanbanBoard): KanbanBoard {
  return {
    ...board,
    columns: board.columns.map((column, columnIndex) => ({
      ...column,
      id: column.id ?? `legacy-column-${columnIndex}`,
      cards: column.cards.map((card, cardIndex) => ({
        ...card,
        id: card.id ?? `legacy-card-${columnIndex}-${cardIndex}`,
      })),
    })),
  };
}

/**
 * Apply one optimistic Board operation using stable column/card identities.
 * The host repeats the same operation against the lossless Markdown document
 * before acknowledging it.
 *
 * @see docs/specs/221-app-workbench-board/spec.md [FR-3] [FR-4] [FR-8] [FR-15]
 * @see docs/specs/221-app-workbench-board/design.md [DES-BOARD-STABILITY] [DES-BOARD-SERIALIZATION]
 * @see docs/specs/221-app-workbench-board/tasks.md [3.2] [5.1]
 */
function applyBoardMutation(board: KanbanBoard, mutation: KanbanBoardMutation): KanbanBoard {
  const normalized = normalizeBoard(board);
  if (mutation.kind === "addColumn") {
    return {
      ...normalized,
      columns: [
        ...normalized.columns,
        { id: requestId("column"), title: mutation.title, cards: [] },
      ],
    };
  }
  if (mutation.kind === "renameColumn") {
    return {
      ...normalized,
      columns: normalized.columns.map((column) =>
        column.id === mutation.columnId ? { ...column, title: mutation.title } : column,
      ),
    };
  }
  if (mutation.kind === "deleteColumn") {
    return {
      ...normalized,
      columns: normalized.columns.filter((column) => column.id !== mutation.columnId),
    };
  }
  if (mutation.kind === "addCard") {
    return {
      ...normalized,
      columns: normalized.columns.map((column) =>
        column.id === mutation.columnId
          ? {
              ...column,
              cards: [
                ...column.cards,
                { id: requestId("card"), text: mutation.text, link: mutation.link },
              ],
            }
          : column,
      ),
    };
  }
  if (mutation.kind === "editCard") {
    return {
      ...normalized,
      columns: normalized.columns.map((column) => ({
        ...column,
        cards: column.cards.map((card) =>
          card.id === mutation.cardId ? { ...card, text: mutation.text } : card,
        ),
      })),
    };
  }
  if (mutation.kind === "deleteCard") {
    return {
      ...normalized,
      columns: normalized.columns.map((column) => ({
        ...column,
        cards: column.cards.filter((card) => card.id !== mutation.cardId),
      })),
    };
  }
  if (mutation.kind === "moveColumn") {
    const columns = [...normalized.columns];
    const sourceIndex = columns.findIndex((column) => column.id === mutation.columnId);
    if (sourceIndex < 0) return normalized;
    const [column] = columns.splice(sourceIndex, 1);
    if (!column) return normalized;
    const targetIndex = mutation.beforeColumnId
      ? columns.findIndex((candidate) => candidate.id === mutation.beforeColumnId)
      : columns.length;
    columns.splice(targetIndex < 0 ? columns.length : targetIndex, 0, column);
    return { ...normalized, columns };
  }

  const columns = normalized.columns.map((column) => ({ ...column, cards: [...column.cards] }));
  let moved: KanbanCard | undefined;
  for (const column of columns) {
    const index = column.cards.findIndex((card) => card.id === mutation.cardId);
    if (index < 0) continue;
    [moved] = column.cards.splice(index, 1);
    break;
  }
  if (!moved) return normalized;
  const target = columns.find((column) => column.id === mutation.toColumnId);
  if (!target) return normalized;
  const targetIndex = mutation.beforeCardId
    ? target.cards.findIndex((card) => card.id === mutation.beforeCardId)
    : target.cards.length;
  target.cards.splice(targetIndex < 0 ? target.cards.length : targetIndex, 0, moved);
  return { ...normalized, columns };
}

/**
 * Produce a portable recovery copy of an optimistic Board projection. This is
 * deliberately a recovery surface, not the durable lossless save path.
 *
 * @see docs/specs/221-app-workbench-board/spec.md [FR-5] [FR-11]
 * @see docs/specs/221-app-workbench-board/design.md [DES-BOARD-SERIALIZATION] [DES-BOARD-LIVE-SYNC]
 * @see docs/specs/221-app-workbench-board/tasks.md [2.3]
 */
function boardDraftMarkdown(board: KanbanBoard): string {
  return `${board.columns
    .map(
      (column) =>
        `## ${column.title}\n\n${column.cards.map((card) => `- ${card.text.replace(/\n+/g, " — ")}`).join("\n")}`,
    )
    .join("\n\n")}\n`;
}

function useReducedMotionPreference(): boolean {
  const query = "(prefers-reduced-motion: reduce)";
  const [reduced, setReduced] = useState(() => globalThis.matchMedia?.(query).matches ?? false);

  useEffect(() => {
    const media = globalThis.matchMedia?.(query);
    if (!media) return;
    const update = (): void => setReduced(media.matches);
    update();
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);

  return reduced;
}

interface SortableCardProps {
  card: KanbanCard;
  column: KanbanColumn;
  columnIndex: number;
  cardIndex: number;
  columnCount: number;
  cardCount: number;
  disabled: boolean;
  pendingTaskFingerprints: ReadonlySet<string>;
  onEdit: () => void;
  onDelete: () => void;
  onMove: (toColumnId: string, beforeCardId?: string) => void;
  onOpenLinked: (mode: "editor" | "afxPreview") => void;
  onOpenStudio: () => void;
  onToggleTask: (fingerprint: string, completed: boolean) => void;
  columns: KanbanColumn[];
}

/**
 * Accessible sortable Board card with linked-work rendering and explicit move
 * fallbacks for users who do not drag.
 *
 * @see docs/specs/221-app-workbench-board/spec.md [FR-3] [FR-4] [FR-9] [FR-13] [FR-15]
 * @see docs/specs/221-app-workbench-board/design.md [DES-BOARD-CARD] [DES-BOARD-DND] [DES-BOARD-STABILITY]
 * @see docs/specs/221-app-workbench-board/tasks.md [4.3] [5.1]
 */
function SortableCard({
  card,
  column,
  columnIndex,
  cardIndex,
  columnCount,
  cardCount,
  disabled,
  pendingTaskFingerprints,
  onEdit,
  onDelete,
  onMove,
  onOpenLinked,
  onOpenStudio,
  onToggleTask,
  columns,
}: SortableCardProps) {
  const reducedMotion = useReducedMotionPreference();
  const sortableId = `card:${card.id}`;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: sortableId,
    disabled,
    data: { kind: "card", cardId: card.id, columnId: column.id },
  });
  const [title, ...body] = card.text.split("\n").filter(Boolean);
  const previousCard = column.cards[cardIndex - 1];
  const nextCard = column.cards[cardIndex + 1];
  const previousColumn = columns[columnIndex - 1];
  const nextColumn = columns[columnIndex + 1];

  return (
    <article
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition: reducedMotion ? "none" : transition,
      }}
      className={`afx-surface-card group relative rounded-md border border-border px-2.5 py-2 text-sm transition-colors motion-reduce:transition-none hover:border-afx-brand/35 focus-within:border-afx-brand/45 ${
        isDragging ? "z-20 opacity-35" : ""
      }`}
      data-card-id={card.id}
    >
      <div className="flex min-w-0 items-start gap-1.5">
        <button
          type="button"
          {...attributes}
          {...listeners}
          disabled={disabled}
          className="mt-0.5 shrink-0 cursor-grab rounded-sm p-0.5 text-muted-foreground/50 outline-none hover:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40"
          aria-label={`Drag ${title || "card"}`}
        >
          <GripVertical size={12} />
        </button>
        <div className="min-w-0 flex-1">
          {card.link ? (
            <LinkedWorkItem
              card={card}
              disabled={disabled}
              pendingFingerprints={pendingTaskFingerprints}
              onOpen={onOpenLinked}
              onOpenStudio={onOpenStudio}
              onToggleTask={onToggleTask}
            />
          ) : (
            <>
              <p className="leading-relaxed text-foreground">{title}</p>
              {body.length ? (
                <p className="mt-1 line-clamp-3 whitespace-pre-line text-xs leading-5 text-muted-foreground">
                  {body.join("\n")}
                </p>
              ) : null}
            </>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="icon-xs"
              variant="ghost"
              className="shrink-0 text-muted-foreground opacity-70 group-focus-within:opacity-100 group-hover:opacity-100"
              aria-label={`Actions for ${title || "card"}`}
            >
              <MoreHorizontal size={12} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={onEdit} disabled={disabled}>
              <Pencil size={12} /> Edit card
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={disabled || cardIndex === 0}
              onClick={() => onMove(column.id ?? "", previousCard?.id)}
            >
              <ChevronUp size={12} /> Move up
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={disabled || cardIndex >= cardCount - 1}
              onClick={() =>
                onMove(column.id ?? "", nextCard ? column.cards[cardIndex + 2]?.id : undefined)
              }
            >
              <ChevronDown size={12} /> Move down
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={disabled || columnIndex === 0}
              onClick={() => previousColumn?.id && onMove(previousColumn.id)}
            >
              <ChevronLeft size={12} /> Move left
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={disabled || columnIndex >= columnCount - 1}
              onClick={() => nextColumn?.id && onMove(nextColumn.id)}
            >
              <ChevronRight size={12} /> Move right
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} disabled={disabled} className="text-destructive">
              <Trash2 size={12} /> Delete card
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </article>
  );
}

interface SortableColumnProps {
  column: KanbanColumn;
  columnIndex: number;
  columns: KanbanColumn[];
  disabled: boolean;
  draft: string;
  onDraftChange: (value: string) => void;
  onAddCard: () => void;
  onMutate: (mutation: KanbanBoardMutation) => void;
  onEditCard: (card: KanbanCard) => void;
  pendingTaskFingerprints: ReadonlySet<string>;
  onOpenLinked: (card: KanbanCard, mode: "editor" | "afxPreview") => void;
  onOpenStudio: (card: KanbanCard) => void;
  onToggleTask: (card: KanbanCard, fingerprint: string, completed: boolean) => void;
}

/**
 * Sortable Board column. Cards remain a nested sortable list while explicit
 * column controls preserve a dependable keyboard path.
 *
 * @see docs/specs/221-app-workbench-board/spec.md [FR-3] [FR-4] [FR-6] [FR-9] [FR-15]
 * @see docs/specs/221-app-workbench-board/design.md [DES-BOARD-COLUMN] [DES-BOARD-DND] [DES-BOARD-STABILITY]
 * @see docs/specs/221-app-workbench-board/tasks.md [5.1] [5.2]
 */
function SortableColumn({
  column,
  columnIndex,
  columns,
  disabled,
  draft,
  onDraftChange,
  onAddCard,
  onMutate,
  onEditCard,
  pendingTaskFingerprints,
  onOpenLinked,
  onOpenStudio,
  onToggleTask,
}: SortableColumnProps) {
  const reducedMotion = useReducedMotionPreference();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } =
    useSortable({
      id: `column:${column.id}`,
      disabled,
      data: { kind: "column", columnId: column.id },
    });
  const nextColumn = columns[columnIndex + 1];
  const previousColumn = columns[columnIndex - 1];
  const cardIds = column.cards.map((card) => `card:${card.id}`);

  return (
    <section
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition: reducedMotion ? "none" : transition,
      }}
      className={`afx-surface-subtle flex h-full min-h-0 w-[min(18rem,calc(100vw-2rem))] shrink-0 snap-start flex-col rounded-md border transition-colors motion-reduce:transition-none sm:w-72 ${
        isOver ? "border-afx-brand/70 ring-1 ring-afx-brand/25" : "border-border"
      } ${isDragging ? "opacity-35" : ""}`}
      data-column-id={column.id}
    >
      <header className="afx-surface-toolbar group flex shrink-0 items-center gap-2 border-b border-border px-2.5 py-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          disabled={disabled}
          className="shrink-0 cursor-grab rounded-sm p-0.5 text-muted-foreground/50 outline-none hover:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40"
          aria-label={`Drag ${column.title} column`}
        >
          <GripVertical size={12} />
        </button>
        <Circle size={9} className="shrink-0 text-afx-brand" aria-hidden />
        <h3 className="min-w-0 flex-1 truncate text-sm font-medium">{column.title}</h3>
        <span className="flex size-5 items-center justify-center rounded-full bg-muted font-mono text-[10px] text-muted-foreground">
          {column.cards.length}
        </span>
        <Button
          size="icon-xs"
          variant="ghost"
          disabled={disabled || columnIndex === 0}
          onClick={() =>
            onMutate({
              kind: "moveColumn",
              columnId: column.id ?? "",
              beforeColumnId: previousColumn?.id,
            })
          }
          aria-label={`Move ${column.title} column left`}
        >
          <ChevronLeft size={11} />
        </Button>
        <Button
          size="icon-xs"
          variant="ghost"
          disabled={disabled || columnIndex >= columns.length - 1}
          onClick={() =>
            onMutate({
              kind: "moveColumn",
              columnId: column.id ?? "",
              beforeColumnId: nextColumn ? columns[columnIndex + 2]?.id : undefined,
            })
          }
          aria-label={`Move ${column.title} column right`}
        >
          <ChevronRight size={11} />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="icon-xs"
              variant="ghost"
              aria-label={`Actions for ${column.title} column`}
            >
              <MoreHorizontal size={12} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem
              disabled={disabled || columnIndex === 0}
              onClick={() =>
                onMutate({
                  kind: "moveColumn",
                  columnId: column.id ?? "",
                  beforeColumnId: previousColumn?.id,
                })
              }
            >
              <ChevronLeft size={12} /> Move left
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={disabled || columnIndex >= columns.length - 1}
              onClick={() =>
                onMutate({
                  kind: "moveColumn",
                  columnId: column.id ?? "",
                  beforeColumnId: nextColumn ? columns[columnIndex + 2]?.id : undefined,
                })
              }
            >
              <ChevronRight size={12} /> Move right
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={disabled}
              onClick={() =>
                onMutate({ kind: "renameColumn", columnId: column.id ?? "", title: column.title })
              }
            >
              <Pencil size={12} /> Rename column
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={disabled || column.cards.length > 0}
              onClick={() => onMutate({ kind: "deleteColumn", columnId: column.id ?? "" })}
              className="text-destructive"
            >
              <Trash2 size={12} /> Delete column
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <ScrollArea className="min-h-0 flex-1">
        <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
          <div
            className="flex min-h-20 flex-col gap-2 p-2"
            data-testid={`column-cards-${column.id}`}
          >
            {column.cards.length ? (
              column.cards.map((card, cardIndex) => (
                <SortableCard
                  key={card.id}
                  card={card}
                  column={column}
                  columns={columns}
                  columnIndex={columnIndex}
                  cardIndex={cardIndex}
                  columnCount={columns.length}
                  cardCount={column.cards.length}
                  disabled={disabled}
                  pendingTaskFingerprints={pendingTaskFingerprints}
                  onEdit={() => onEditCard(card)}
                  onDelete={() => onMutate({ kind: "deleteCard", cardId: card.id ?? "" })}
                  onMove={(toColumnId, beforeCardId) =>
                    onMutate({
                      kind: "moveCard",
                      cardId: card.id ?? "",
                      toColumnId,
                      beforeCardId,
                    })
                  }
                  onOpenLinked={(mode) => onOpenLinked(card, mode)}
                  onOpenStudio={() => onOpenStudio(card)}
                  onToggleTask={(fingerprint, completed) =>
                    onToggleTask(card, fingerprint, completed)
                  }
                />
              ))
            ) : (
              <div className="flex min-h-24 flex-col items-center justify-center rounded-md border border-dashed border-border text-center">
                <Circle size={15} className="mb-1 text-muted-foreground/30" aria-hidden />
                <p className="text-xs text-muted-foreground">Drop or add cards here</p>
              </div>
            )}
          </div>
        </SortableContext>
      </ScrollArea>

      <div className="afx-surface-subtle flex shrink-0 items-center gap-1 border-t border-border p-2">
        <Input
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") onAddCard();
          }}
          disabled={disabled}
          placeholder="Add card…"
          className="afx-field-surface h-7 text-xs"
          aria-label={`Add card to ${column.title}`}
        />
        <Button
          size="icon-xs"
          variant="outline"
          onClick={onAddCard}
          disabled={disabled || !draft.trim()}
          aria-label={`Submit card to ${column.title}`}
        >
          <Plus size={12} />
        </Button>
      </div>
    </section>
  );
}

/**
 * Workbench Board tab. Durable operations settle only from matching host
 * results; clean live snapshots replace local state and dirty ones lock writes.
 *
 * @see docs/specs/221-app-workbench-board/spec.md [FR-1] [FR-2] [FR-4] [FR-11] [FR-15]
 * @see docs/specs/221-app-workbench-board/design.md [DES-BOARD-LIVE-SYNC] [DES-BOARD-SAVE] [DES-BOARD-DND]
 * @see docs/specs/221-app-workbench-board/tasks.md [2.1] [2.2] [2.3] [5.1] [5.2]
 */
export default function BoardV2() {
  const { kanban, pipeline, send, selectFeature } = useWorkbench();
  const remoteBoards = useMemo(() => (kanban?.boards ?? []).map(normalizeBoard), [kanban]);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const selectedRemote =
    remoteBoards.find((board) => board.filePath === selectedFilePath) ?? remoteBoards[0] ?? null;
  const [projection, setProjection] = useState<KanbanBoard | null>(null);
  const [pending, setPending] = useState<PendingBoardMutation | null>(null);
  const pendingRef = useRef<PendingBoardMutation | null>(null);
  const [pendingLifecycle, setPendingLifecycle] = useState<PendingBoardLifecycle | null>(null);
  const pendingLifecycleRef = useRef<PendingBoardLifecycle | null>(null);
  const queueRef = useRef<QueuedMutation[]>([]);
  const [awaitingRevision, setAwaitingRevision] = useState<string | null>(null);
  const [problem, setProblem] = useState<BoardProblem | null>(null);
  const [newCards, setNewCards] = useState<Record<string, string>>({});
  const [newColumnName, setNewColumnName] = useState("");
  const [columnPopoverOpen, setColumnPopoverOpen] = useState(false);
  const [linkPickerOpen, setLinkPickerOpen] = useState(false);
  const linkPickerTriggerRef = useRef<HTMLButtonElement>(null);
  const [newBoardOpen, setNewBoardOpen] = useState(false);
  const [newBoardName, setNewBoardName] = useState("");
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameDraft, setRenameDraft] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [activeDragLabel, setActiveDragLabel] = useState<string | null>(null);
  const [pendingTaskRequests, setPendingTaskRequests] = useState<
    Map<string, { fingerprint: string }>
  >(new Map());
  const pendingTaskRequestsRef = useRef(pendingTaskRequests);
  const selectedRemoteRef = useRef(selectedRemote);

  useEffect(() => {
    pendingRef.current = pending;
    pendingLifecycleRef.current = pendingLifecycle;
    pendingTaskRequestsRef.current = pendingTaskRequests;
    selectedRemoteRef.current = selectedRemote;
  }, [pending, pendingLifecycle, pendingTaskRequests, selectedRemote]);

  const rendered = projection ?? selectedRemote;
  const mutationDisabled = Boolean(
    rendered?.editorDirty ||
    rendered?.revision?.dirty ||
    pending ||
    pendingLifecycle ||
    awaitingRevision ||
    problem?.kind === "conflict" ||
    Boolean(problem?.failedBoard),
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function setPendingMutation(next: PendingBoardMutation | null): void {
    pendingRef.current = next;
    setPending(next);
  }

  const dispatchNext = useCallback(
    (expectedRevision: string): void => {
      const board = selectedRemoteRef.current;
      const next = queueRef.current.shift();
      if (!next || !board?.source) {
        pendingRef.current = null;
        setPending(null);
        setAwaitingRevision(expectedRevision);
        return;
      }
      const id = requestId("board");
      const nextPending = { requestId: id, expectedRevision, mutation: next.mutation };
      pendingRef.current = nextPending;
      setPending(nextPending);
      send({
        type: "afxMutateKanbanBoard",
        requestId: id,
        target: board.source,
        expectedRevision,
        mutation: next.mutation,
      });
    },
    [send],
  );

  useEffect(() => {
    return workbenchOn("afxMutationResult", (result) => {
      const lifecycle = pendingLifecycleRef.current;
      if (lifecycle?.requestId === result.requestId) {
        pendingLifecycleRef.current = null;
        setPendingLifecycle(null);
        if (result.outcome === "success") {
          setProblem(null);
          if (lifecycle.kind === "delete") setSelectedFilePath(null);
        } else {
          setProblem({ kind: result.outcome, message: result.message });
        }
        return;
      }
      const taskRequest = pendingTaskRequestsRef.current.get(result.requestId);
      if (taskRequest) {
        setPendingTaskRequests((current) => {
          const next = new Map(current);
          next.delete(result.requestId);
          return next;
        });
        if (result.outcome !== "success") {
          setProblem({ kind: result.outcome, message: result.message });
        }
        return;
      }

      if (pendingRef.current?.requestId !== result.requestId) return;
      if (result.outcome === "success") {
        setProblem(null);
        dispatchNext(result.revision.contentRevision);
        return;
      }
      const failedPending = pendingRef.current;
      const failedMutations = [
        failedPending.mutation,
        ...queueRef.current.map(({ mutation }) => mutation),
      ];
      queueRef.current = [];
      setPendingMutation(null);
      setProblem({
        kind: result.outcome,
        message: result.message,
        failedBoard: {
          expectedRevision: failedPending.expectedRevision,
          mutations: failedMutations,
          retryable: result.outcome === "error" && result.retryable,
        },
      });
    });
  }, [dispatchNext]);

  useEffect(() => {
    if (!selectedRemote) return;
    if (awaitingRevision && selectedRemote.revision?.contentRevision === awaitingRevision) {
      queueMicrotask(() => {
        setProjection(null);
        setAwaitingRevision(null);
        setProblem(null);
      });
      return;
    }
    const activePending = pendingRef.current;
    if (
      activePending &&
      selectedRemote.revision?.contentRevision !== activePending.expectedRevision &&
      selectedRemote.revision?.contentRevision !== awaitingRevision
    ) {
      queueMicrotask(() => {
        const failedMutations = [
          activePending.mutation,
          ...queueRef.current.map(({ mutation }) => mutation),
        ];
        queueRef.current = [];
        setPendingMutation(null);
        setProblem({
          kind: "conflict",
          message: "The board changed while this edit was pending. Your draft is preserved.",
          failedBoard: {
            expectedRevision: activePending.expectedRevision,
            mutations: failedMutations,
            retryable: false,
          },
        });
      });
      return;
    }
  }, [awaitingRevision, problem, selectedRemote]);

  function selectBoard(filePath: string): void {
    setProjection(null);
    setPendingMutation(null);
    setAwaitingRevision(null);
    setProblem(null);
    queueRef.current = [];
    setSelectedFilePath(filePath);
  }

  function mutate(mutations: KanbanBoardMutation | KanbanBoardMutation[]): void {
    const board = rendered;
    const list = Array.isArray(mutations) ? mutations : [mutations];
    if (!board || !list.length || mutationDisabled) return;
    let next = board;
    for (const mutation of list) next = applyBoardMutation(next, mutation);
    setProjection(next);
    if (!board.source || !board.revision) return;
    queueRef.current = list.map((mutation) => ({ mutation }));
    dispatchNext(board.revision.contentRevision);
  }

  function createBoard(): void {
    const name = newBoardName.trim();
    if (!name) return;
    if (selectedRemote?.source) {
      const id = requestId("board-create");
      const lifecycle = { requestId: id, kind: "create" as const };
      pendingLifecycleRef.current = lifecycle;
      setPendingLifecycle(lifecycle);
      send({
        type: "afxCreateKanbanBoard",
        name,
        requestId: id,
        targetRootUri: selectedRemote.source.rootUri,
      });
    } else {
      send({ type: "afxCreateKanbanBoard", name });
    }
    setNewBoardName("");
    setNewBoardOpen(false);
  }

  function renameBoard(): void {
    if (!rendered?.source || !rendered.revision || !renameDraft.trim()) return;
    const id = requestId("board-rename");
    const lifecycle = { requestId: id, kind: "rename" as const };
    pendingLifecycleRef.current = lifecycle;
    setPendingLifecycle(lifecycle);
    send({
      type: "afxRenameKanbanBoard",
      name: renameDraft.trim(),
      requestId: id,
      target: rendered.source,
      expectedRevision: rendered.revision.contentRevision,
    });
    setRenameOpen(false);
  }

  function deleteBoard(): void {
    if (!rendered?.source || !rendered.revision) return;
    const id = requestId("board-delete");
    const lifecycle = { requestId: id, kind: "delete" as const };
    pendingLifecycleRef.current = lifecycle;
    setPendingLifecycle(lifecycle);
    send({
      type: "afxDeleteKanbanBoard",
      requestId: id,
      target: rendered.source,
      expectedRevision: rendered.revision.contentRevision,
    });
    setDeleteOpen(false);
  }

  function addCard(column: KanbanColumn): void {
    const key = column.id ?? "";
    const text = newCards[key]?.trim();
    if (!text) return;
    mutate({ kind: "addCard", columnId: key, text });
    setNewCards((current) => ({ ...current, [key]: "" }));
  }

  function onDragStart(event: DragStartEvent): void {
    const data = event.active.data.current as
      | { kind?: string; cardId?: string; columnId?: string }
      | undefined;
    if (data?.kind === "card") {
      const card = rendered?.columns
        .flatMap((column) => column.cards)
        .find((item) => item.id === data.cardId);
      setActiveDragLabel(card?.text.split("\n", 1)[0] ?? "Card");
      return;
    }
    const column = rendered?.columns.find((item) => item.id === data?.columnId);
    setActiveDragLabel(column?.title ?? "Column");
  }

  function onDragEnd(event: DragEndEvent): void {
    setActiveDragLabel(null);
    if (!rendered || !event.over || event.active.id === event.over.id) return;
    const active = event.active.data.current as
      | { kind?: string; cardId?: string; columnId?: string }
      | undefined;
    const over = event.over.data.current as
      | { kind?: string; cardId?: string; columnId?: string }
      | undefined;
    if (active?.kind === "column" && active.columnId) {
      mutate({
        kind: "moveColumn",
        columnId: active.columnId,
        beforeColumnId: over?.columnId,
      });
      return;
    }
    if (active?.kind !== "card" || !active.cardId) return;
    const targetColumnId = over?.columnId;
    if (!targetColumnId) return;
    mutate({
      kind: "moveCard",
      cardId: active.cardId,
      toColumnId: targetColumnId,
      beforeCardId: over?.kind === "card" ? over.cardId : undefined,
    });
  }

  function openLinked(card: KanbanCard, mode: "editor" | "afxPreview"): void {
    if (!card.link) return;
    send({ type: "afxOpenFile", path: sourcePath(card.link.source), mode });
  }

  function openLinkedStudio(card: KanbanCard): void {
    if (!card.link) return;
    const name = featureName(card.link.source.relativePath);
    const matching = pipeline.find((row) => row.name === name || row.name.endsWith(`/${name}`));
    selectFeature(matching?.name ?? name);
  }

  function toggleLinkedTask(card: KanbanCard, fingerprint: string, completed: boolean): void {
    if (!card.link || card.link.kind !== "task" || card.resolved?.state !== "resolved") return;
    const id = requestId("linked-task");
    setPendingTaskRequests((current) => new Map(current).set(id, { fingerprint }));
    send({
      type: "afxToggleLinkedTask",
      requestId: id,
      target: card.link.source,
      expectedRevision: card.resolved.sourceRevision,
      wbsId: card.link.wbsId,
      itemFingerprint: fingerprint,
      completed,
    });
  }

  function reloadConfirmed(): void {
    queueRef.current = [];
    setProjection(null);
    setPendingMutation(null);
    setAwaitingRevision(null);
    setProblem(null);
  }

  function retryFailedMutation(): void {
    const failure = problem?.failedBoard;
    const board = selectedRemoteRef.current;
    if (!failure?.retryable || !board?.source || !board.revision || board.editorDirty) return;
    if (board.revision.dirty || board.revision.contentRevision !== failure.expectedRevision) {
      setProblem({
        kind: "conflict",
        message: "The source changed before retry. Reload it and review the preserved draft.",
        failedBoard: { ...failure, retryable: false },
      });
      return;
    }
    queueRef.current = failure.mutations.map((mutation) => ({ mutation }));
    setProblem(null);
    dispatchNext(failure.expectedRevision);
  }

  const existingLinkKeys = useMemo(
    () =>
      new Set(
        (rendered?.columns ?? [])
          .flatMap((column) => column.cards)
          .flatMap((card) => (card.link ? [linkKey(card.link)] : [])),
      ),
    [rendered],
  );
  const pendingFingerprints = new Set(
    [...pendingTaskRequests.values()].map((request) => request.fingerprint),
  );
  const canRetryFailedMutation = Boolean(
    problem?.failedBoard?.retryable &&
    selectedRemote?.revision &&
    !selectedRemote.editorDirty &&
    !selectedRemote.revision.dirty &&
    selectedRemote.revision.contentRevision === problem.failedBoard.expectedRevision,
  );

  if (!kanban || remoteBoards.length === 0 || !rendered) {
    return (
      <BoardEmptyGuide
        name={newBoardName}
        onNameChange={setNewBoardName}
        onCreate={createBoard}
        onTemplate={(name) => {
          setNewBoardName(name);
          queueMicrotask(() => send({ type: "afxCreateKanbanBoard", name }));
        }}
      />
    );
  }

  const totalCards = rendered.columns.reduce((sum, column) => sum + column.cards.length, 0);

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden">
      <div className="afx-surface-toolbar flex shrink-0 flex-wrap items-center gap-1.5 border-b border-border px-2 py-1.5 sm:px-3 sm:py-2">
        <Rows3 size={14} className="shrink-0 text-muted-foreground" aria-hidden />
        <Select value={rendered.filePath} onValueChange={selectBoard}>
          <SelectTrigger
            className="h-7 min-w-0 flex-1 text-xs sm:w-[180px] sm:flex-none"
            aria-label="Select board"
          >
            <SelectValue placeholder="Select board" />
          </SelectTrigger>
          <SelectContent>
            {remoteBoards.map((board) => (
              <SelectItem key={board.filePath} value={board.filePath}>
                {board.name} · {board.columns.reduce((sum, column) => sum + column.cards.length, 0)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            size="icon-xs"
            variant="ghost"
            onClick={() => {
              setRenameDraft(rendered.meta?.title ?? rendered.name);
              setRenameOpen(true);
            }}
            disabled={mutationDisabled}
            aria-label="Rename board"
          >
            <Pencil size={12} />
          </Button>
          <Button
            size="icon-xs"
            variant="ghost"
            onClick={() => setDeleteOpen(true)}
            disabled={mutationDisabled}
            aria-label="Delete board"
          >
            <Trash2 size={12} />
          </Button>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1">
          {/* Reserved slot: the save indicator swaps content without changing
              width, so the wrap-enabled toolbar never reflows mid-save. */}
          <span
            className="flex w-24 shrink-0 items-center justify-end gap-1 overflow-hidden whitespace-nowrap"
            aria-live="polite"
          >
            {pending || pendingLifecycle || awaitingRevision ? (
              <span className="flex items-center gap-1 text-[10px] text-afx-brand-soft">
                <Loader2 size={11} className="animate-spin motion-reduce:animate-none" /> Saving…
              </span>
            ) : rendered.editorDirty || rendered.revision?.dirty ? (
              <Badge variant="outline" className="border-amber-500/45 text-[9px] text-amber-500">
                Unsaved in editor
              </Badge>
            ) : null}
          </span>
          <span className="hidden font-mono text-[10px] text-muted-foreground min-[540px]:inline">
            {rendered.columns.length} cols · {totalCards} cards
          </span>
          <Button
            ref={linkPickerTriggerRef}
            size="sm"
            variant="outline"
            className="h-7 gap-1 px-2 text-xs"
            onClick={() => setLinkPickerOpen(true)}
            disabled={mutationDisabled || !(kanban.availableWorkItems?.length ?? 0)}
            aria-label="Link work"
          >
            <Link2 size={12} />
            <span className="hidden min-[420px]:inline">Link work</span>
          </Button>
          <OpenActions filePath={rendered.filePath} includeAfxPreview />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon-xs" variant="ghost" aria-label="More board actions">
                <MoreHorizontal size={13} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                onClick={() =>
                  send({ type: "afxOpenFile", path: rendered.filePath, mode: "editor" })
                }
              >
                <ExternalLink size={12} /> Open source
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  send({ type: "afxOpenFile", path: rendered.filePath, mode: "afxPreview" })
                }
              >
                <Rows3 size={12} /> AFX Preview
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setColumnPopoverOpen(true)}
                disabled={mutationDisabled}
              >
                <Columns3 size={12} /> Add column
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setNewBoardOpen(true)}>
                <Plus size={12} /> New board
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            size="sm"
            variant="outline"
            className="hidden h-7 gap-1 text-xs min-[720px]:inline-flex"
            onClick={() => setNewBoardOpen(true)}
          >
            <Plus size={12} /> New board
          </Button>
        </div>
      </div>

      {problem ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-2 z-20 flex justify-center px-2">
          <div
            className={`pointer-events-auto flex max-w-[min(44rem,100%)] shrink-0 flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-xs shadow-lg backdrop-blur ${
              problem.kind === "conflict"
                ? "border-amber-500/40 bg-amber-500/15 text-amber-400"
                : "border-destructive/30 bg-destructive/8 text-destructive"
            }`}
            role="alert"
          >
            <AlertTriangle size={13} className="shrink-0" />
            <span className="min-w-48 flex-1">{problem.message}</span>
            {problem.failedBoard?.retryable ? (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1"
                onClick={retryFailedMutation}
                disabled={!canRetryFailedMutation}
                title={
                  canRetryFailedMutation
                    ? "Retry the preserved Board mutation"
                    : "Reload the latest source before retrying"
                }
              >
                <RefreshCw size={11} /> Retry
              </Button>
            ) : null}
            <Button size="sm" variant="ghost" className="h-7 gap-1" onClick={reloadConfirmed}>
              <RefreshCw size={11} /> Reload source
            </Button>
            {projection ? (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1"
                onClick={() =>
                  send({
                    type: "afxCopyMarkdown",
                    content: boardDraftMarkdown(projection),
                    label: "Board draft",
                  })
                }
              >
                <Copy size={11} /> Copy draft
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1"
              onClick={() => send({ type: "afxOpenFile", path: rendered.filePath, mode: "editor" })}
            >
              <ExternalLink size={11} /> Open source
            </Button>
          </div>
        </div>
      ) : null}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={onDragStart}
        onDragCancel={() => setActiveDragLabel(null)}
        onDragEnd={onDragEnd}
        accessibility={{
          announcements: {
            onDragStart: () => `Picked up ${activeDragLabel ?? "board item"}.`,
            onDragOver: ({ over }) =>
              over ? `Moving over ${String(over.id)}.` : "Not over a drop target.",
            onDragEnd: ({ over }) =>
              over ? "Board item moved." : "Board item returned to its position.",
            onDragCancel: () => "Board movement cancelled.",
          },
        }}
      >
        <div
          className="min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain"
          data-testid="board-scroll-container"
        >
          <SortableContext
            items={rendered.columns.map((column) => `column:${column.id}`)}
            strategy={horizontalListSortingStrategy}
          >
            <div className="flex h-full w-max gap-2 p-2 sm:gap-3 sm:p-3">
              {rendered.columns.map((column, columnIndex) => (
                <SortableColumn
                  key={column.id}
                  column={column}
                  columnIndex={columnIndex}
                  columns={rendered.columns}
                  disabled={mutationDisabled}
                  draft={newCards[column.id ?? ""] ?? ""}
                  onDraftChange={(value) =>
                    setNewCards((current) => ({ ...current, [column.id ?? ""]: value }))
                  }
                  onAddCard={() => addCard(column)}
                  onMutate={(mutation) => {
                    if (mutation.kind === "renameColumn") {
                      setEditTarget({
                        kind: "column",
                        columnId: mutation.columnId,
                        text: column.title,
                      });
                      return;
                    }
                    mutate(mutation);
                  }}
                  onEditCard={(card) =>
                    setEditTarget({ kind: "card", cardId: card.id ?? "", text: card.text })
                  }
                  pendingTaskFingerprints={pendingFingerprints}
                  onOpenLinked={openLinked}
                  onOpenStudio={openLinkedStudio}
                  onToggleTask={toggleLinkedTask}
                />
              ))}
            </div>
          </SortableContext>
        </div>
        <DragOverlay dropAnimation={null}>
          {activeDragLabel ? (
            <div className="rounded-md border border-afx-brand/50 bg-background px-3 py-2 text-xs shadow-lg">
              {activeDragLabel}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <LinkWorkPicker
        open={linkPickerOpen}
        onOpenChange={setLinkPickerOpen}
        candidates={kanban.availableWorkItems ?? []}
        columns={rendered.columns.map((column) => ({ id: column.id ?? "", title: column.title }))}
        existingKeys={existingLinkKeys}
        returnFocusRef={linkPickerTriggerRef}
        onLink={(columnId, items) =>
          mutate(
            items.map((item) => ({ kind: "addCard", columnId, text: item.label, link: item.ref })),
          )
        }
      />

      <Popover open={columnPopoverOpen} onOpenChange={setColumnPopoverOpen}>
        <PopoverTrigger className="sr-only" aria-label="Add column popover" />
        <PopoverContent align="end" className="w-64 p-3">
          <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            New column
          </label>
          <div className="mt-1.5 flex items-center gap-1">
            <Input
              autoFocus
              value={newColumnName}
              onChange={(event) => setNewColumnName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && newColumnName.trim()) {
                  mutate({ kind: "addColumn", title: newColumnName.trim() });
                  setNewColumnName("");
                  setColumnPopoverOpen(false);
                }
              }}
              aria-label="New column name"
            />
            <Button
              size="icon-xs"
              disabled={!newColumnName.trim()}
              onClick={() => {
                mutate({ kind: "addColumn", title: newColumnName.trim() });
                setNewColumnName("");
                setColumnPopoverOpen(false);
              }}
            >
              <Plus size={12} />
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <Dialog open={editTarget !== null} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editTarget?.kind === "column" ? "Rename column" : "Edit card"}
            </DialogTitle>
            <DialogDescription>
              Changes are revision-checked before the source file is updated.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            autoFocus
            value={editTarget?.text ?? ""}
            onChange={(event) =>
              setEditTarget((current) =>
                current ? { ...current, text: event.target.value } : null,
              )
            }
            aria-label={editTarget?.kind === "column" ? "Column title" : "Card text"}
            rows={editTarget?.kind === "card" ? 6 : 2}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditTarget(null)}>
              Cancel
            </Button>
            <Button
              disabled={!editTarget?.text.trim()}
              onClick={() => {
                if (!editTarget) return;
                mutate(
                  editTarget.kind === "column"
                    ? {
                        kind: "renameColumn",
                        columnId: editTarget.columnId,
                        title: editTarget.text.trim(),
                      }
                    : { kind: "editCard", cardId: editTarget.cardId, text: editTarget.text.trim() },
                );
                setEditTarget(null);
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={newBoardOpen} onOpenChange={setNewBoardOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New board</DialogTitle>
            <DialogDescription>
              Create another Markdown board for a roadmap, sprint, bug queue, or experiment.
            </DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            value={newBoardName}
            onChange={(event) => setNewBoardName(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && createBoard()}
            aria-label="New board name"
            placeholder="Roadmap Q3"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNewBoardOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createBoard} disabled={!newBoardName.trim()}>
              Create board
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename board</DialogTitle>
            <DialogDescription>
              The board title and Markdown filename will be updated together.
            </DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            value={renameDraft}
            onChange={(event) => setRenameDraft(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && renameBoard()}
            aria-label="New board name"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenameOpen(false)}>
              Cancel
            </Button>
            <Button onClick={renameBoard} disabled={!renameDraft.trim()}>
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this board?</AlertDialogTitle>
            <AlertDialogDescription>
              The Markdown file <code>{rendered.filePath}</code> will be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteBoard}
              className="bg-destructive text-destructive-foreground"
            >
              Delete board
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function BoardEmptyGuide({
  name,
  onNameChange,
  onCreate,
  onTemplate,
}: {
  name: string;
  onNameChange: (value: string) => void;
  onCreate: () => void;
  onTemplate: (name: string) => void;
}) {
  return (
    <div className="flex h-full min-h-0 items-center justify-center overflow-auto p-4">
      <div className="w-full max-w-3xl space-y-4">
        <div className="text-center">
          <Rows3 size={24} className="mx-auto mb-2 text-afx-brand" />
          <h2 className="text-base font-medium">Make as many markdown boards as the work needs</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Separate roadmaps, sprint work, bugs, and experiments without leaving the workspace.
          </p>
        </div>
        <div className="mx-auto flex max-w-md flex-wrap justify-center gap-2">
          {["Roadmap", "Sprint", "Bug triage", "Ideas"].map((template) => (
            <Button key={template} variant="outline" size="sm" onClick={() => onTemplate(template)}>
              {template}
            </Button>
          ))}
        </div>
        <div className="mx-auto flex max-w-md items-center gap-2">
          <Input
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && onCreate()}
            placeholder="Custom board name"
            aria-label="New board name"
          />
          <Button onClick={onCreate} disabled={!name.trim()}>
            Create
          </Button>
        </div>
        <div
          className="grid grid-cols-3 gap-2 rounded-md border border-border bg-muted/20 p-2 opacity-70"
          aria-hidden
        >
          {["Backlog", "In progress", "Done"].map((column, index) => (
            <div key={column} className="min-w-0 rounded border border-border bg-background p-2">
              <p className="truncate font-mono text-[9px] uppercase text-muted-foreground">
                {column}
              </p>
              <div className="mt-2 h-8 rounded border border-border bg-muted/30" />
              {index < 2 ? (
                <div className="mt-1 h-8 rounded border border-border bg-muted/20" />
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
