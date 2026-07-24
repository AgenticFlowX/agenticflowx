/**
 * Notes view — quick note capture with deterministic timestamp display.
 *
 * @see docs/specs/224-app-workbench-notes/spec.md [FR-1] [FR-7] [FR-8]
 * @see docs/specs/224-app-workbench-notes/design.md [DES-NOTES-CAPTURE] [DES-NOTES-TIMELINE] [DES-NOTES-ITEM] [DES-NOTES-TIME] [DES-NOTES-EMPTY]
 */
import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";

import {
  CheckCircle,
  CircleAlert,
  FileText,
  Lightbulb,
  MessageSquare,
  MousePointer2,
  NotepadText,
  Pencil,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";

import type {
  NotesMutation,
  NotesSourceSnapshot,
  QuickNote,
  WorkbenchMutationResult,
  WorkbenchSourceIdentity,
} from "@afx/shared";
import { Button } from "@afx/ui/components/button";
import { Input } from "@afx/ui/components/input";
import { NativeSelect, NativeSelectOption } from "@afx/ui/components/native-select";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@afx/ui/components/resizable";
import { ScrollArea } from "@afx/ui/components/scroll-area";
import { Textarea } from "@afx/ui/components/textarea";

import { CopyMarkdownButton } from "../components/copy-markdown-button";
import { DocumentReader } from "../components/document-reader";
import { useWorkbench } from "../context/workbench-context";
import { workbenchOn } from "../lib/bridge";
import { OpenActions } from "../lib/open-actions";

interface DateGroup {
  date: string;
  label: string;
  shortLabel: string;
  notes: QuickNote[];
}

type DateFilter = "all" | "today" | "week" | "month";

const DATE_FILTERS: Array<{ value: DateFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "today", label: "Today" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
];

type NarrowPane = "capture" | "timeline";

interface PendingNotesMutation {
  requestId: string;
  targetKey: string;
  target: WorkbenchSourceIdentity;
  expectedRevision?: string;
  mutation: NotesMutation;
  draft?: string;
  submittedCapture?: {
    value: string;
    generation: number;
  };
  confirmedRevision?: string;
}

interface FailedNotesMutation {
  result: Extract<WorkbenchMutationResult, { outcome: "conflict" | "error" }>;
  targetKey: string;
  target: WorkbenchSourceIdentity;
  expectedRevision?: string;
  mutation: NotesMutation;
  draft?: string;
  submittedCapture?: PendingNotesMutation["submittedCapture"];
}

let requestSequence = 0;

function sourceKey(snapshot: NotesSourceSnapshot): string {
  return JSON.stringify([snapshot.source.rootUri, snapshot.source.relativePath]);
}

function nextRequestId(): string {
  requestSequence += 1;
  return globalThis.crypto?.randomUUID?.() ?? `notes-${Date.now()}-${requestSequence}`;
}

function sourceLabel(source: WorkbenchSourceIdentity): string {
  return `${source.rootName}/${source.relativePath}`;
}

function settleSubmittedCapture(
  current: string,
  currentGeneration: number,
  submitted: NonNullable<PendingNotesMutation["submittedCapture"]>,
): string {
  if (currentGeneration === submitted.generation && current === submitted.value) return "";
  if (current.length > submitted.value.length && current.startsWith(submitted.value)) {
    return current.slice(submitted.value.length).replace(/^\r?\n/, "");
  }
  return current;
}

function useNarrowNotesLayout(): boolean {
  const query = "(max-width: 719px)";
  const [narrow, setNarrow] = useState(() => globalThis.matchMedia?.(query).matches ?? false);

  useEffect(() => {
    const media = globalThis.matchMedia?.(query);
    if (!media) return;
    const update = (): void => setNarrow(media.matches);
    update();
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);

  return narrow;
}

/**
 * Split-pane note capture and timeline surface.
 *
 * @see docs/specs/224-app-workbench-notes/spec.md [FR-1] [FR-6]
 * @see docs/specs/224-app-workbench-notes/design.md [DES-NOTES-CAPTURE] [DES-NOTES-FILTERS]
 */
export default function Notes() {
  const { notes, notesSources, isLoading, notesFilePath, send } = useWorkbench();
  const firstSource =
    notesSources.find((source) => source.revision.contentRevision) ?? notesSources[0];
  const [activeSourceKey, setActiveSourceKey] = useState(() =>
    firstSource ? sourceKey(firstSource) : "",
  );
  const [captureDrafts, setCaptureDrafts] = useState<Record<string, string>>({});
  const [textareaFocused, setTextareaFocused] = useState(false);
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [narrowPane, setNarrowPane] = useState<NarrowPane>("capture");
  const [pending, setPending] = useState<PendingNotesMutation | null>(null);
  const [failure, setFailure] = useState<FailedNotesMutation | null>(null);
  const pendingRef = useRef<PendingNotesMutation | null>(null);
  /** Focus target when a dismissed alert unmounts the focused button. */
  const rootRef = useRef<HTMLDivElement>(null);
  const captureGenerationsRef = useRef<Record<string, number>>({});
  const isNarrow = useNarrowNotesLayout();

  const activeSource =
    notesSources.find((source) => sourceKey(source) === activeSourceKey) ?? firstSource;
  const currentSourceKey = activeSource ? sourceKey(activeSource) : "legacy";
  const text = captureDrafts[currentSourceKey] ?? "";
  const activeNotes = activeSource?.notes ?? notes;
  const multipleRoots = new Set(notesSources.map((source) => source.source.rootUri)).size > 1;
  const activeFilePath = activeSource
    ? `${multipleRoots ? `${activeSource.source.rootName}/` : ""}${activeSource.source.relativePath}`
    : notesFilePath || ".afx/notes.md";
  const failureTargetLabel = failure ? sourceLabel(failure.target) : null;
  const writesDisabled = Boolean(activeSource?.revision.dirty || activeSource?.parseError);

  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  useEffect(
    () =>
      workbenchOn("afxMutationResult", (result) => {
        const current = pendingRef.current;
        if (!current || current.requestId !== result.requestId) return;
        if (result.outcome === "success") {
          setPending({ ...current, confirmedRevision: result.revision.contentRevision });
          return;
        }
        setFailure({
          result,
          targetKey: current.targetKey,
          target: current.target,
          expectedRevision: current.expectedRevision,
          mutation: current.mutation,
          draft: current.draft,
          submittedCapture: current.submittedCapture,
        });
        setPending(null);
      }),
    [],
  );

  useEffect(() => {
    if (!pending?.confirmedRevision) return;
    const targetSource = notesSources.find((source) => sourceKey(source) === pending.targetKey);
    if (targetSource?.revision.contentRevision !== pending.confirmedRevision) return;
    const submittedCapture = pending.submittedCapture;
    if (pending.mutation.kind === "append" && submittedCapture) {
      setCaptureDrafts((drafts) => {
        const current = drafts[pending.targetKey] ?? "";
        const currentGeneration = captureGenerationsRef.current[pending.targetKey] ?? 0;
        const settled = settleSubmittedCapture(current, currentGeneration, submittedCapture);
        if (settled !== current) {
          captureGenerationsRef.current[pending.targetKey] = currentGeneration + 1;
        }
        return { ...drafts, [pending.targetKey]: settled };
      });
    }
    setFailure(null);
    setPending(null);
  }, [notesSources, pending]);

  const filtered = useMemo(() => {
    let result = activeNotes;
    const cutoff = getDateRange(dateFilter);
    if (cutoff) {
      result = result.filter((note) => new Date(note.timestamp).getTime() >= cutoff.getTime());
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((note) => note.text.toLowerCase().includes(q));
    }
    return result;
  }, [activeNotes, dateFilter, search]);

  const grouped = useMemo(() => groupByDate(filtered), [filtered]);
  const uniqueDays = useMemo(
    () => new Set(activeNotes.map((note) => note.date)).size,
    [activeNotes],
  );

  function updateCaptureDraft(value: string): void {
    captureGenerationsRef.current[currentSourceKey] =
      (captureGenerationsRef.current[currentSourceKey] ?? 0) + 1;
    setCaptureDrafts((drafts) => ({ ...drafts, [currentSourceKey]: value }));
  }

  function dispatchMutation(
    mutation: NotesMutation,
    draft?: string,
    submittedCapture?: PendingNotesMutation["submittedCapture"],
  ): void {
    if (!activeSource || writesDisabled || pending) return;
    const requestId = nextRequestId();
    const expectedRevision = activeSource.revision.contentRevision || undefined;
    const nextPending: PendingNotesMutation = {
      requestId,
      targetKey: sourceKey(activeSource),
      target: activeSource.source,
      expectedRevision,
      mutation,
      draft,
      submittedCapture,
    };
    setFailure(null);
    setPending(nextPending);
    send({
      type: "afxMutateNotes",
      requestId,
      target: activeSource.source,
      expectedRevision,
      mutation,
    });
  }

  function handleSubmit() {
    const draft = text.trim();
    if (!draft) return;
    dispatchMutation({ kind: "append", text: draft }, draft, {
      value: text,
      generation: captureGenerationsRef.current[currentSourceKey] ?? 0,
    });
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  function retryFailure(): void {
    if (!failure || pending) return;
    const requestId = nextRequestId();
    setPending({
      requestId,
      targetKey: failure.targetKey,
      target: failure.target,
      expectedRevision: failure.expectedRevision,
      mutation: failure.mutation,
      draft: failure.draft,
      submittedCapture: failure.submittedCapture,
    });
    setFailure(null);
    send({
      type: "afxMutateNotes",
      requestId,
      target: failure.target,
      expectedRevision: failure.expectedRevision,
      mutation: failure.mutation,
    });
  }

  function reloadAfterFailure(): void {
    setFailure(null);
    send({ type: "afxReady" });
  }

  const sourceControl = notesSources.length > 1 && (
    <NativeSelect
      size="sm"
      aria-label="Notes source"
      value={currentSourceKey}
      disabled={Boolean(pending)}
      onChange={(event) => setActiveSourceKey(event.target.value)}
      className="min-w-0 max-w-56"
    >
      {notesSources.map((source) => (
        <NativeSelectOption key={sourceKey(source)} value={sourceKey(source)}>
          {source.source.rootName} · {source.source.relativePath}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  );

  const capturePane = (
    <aside className="afx-surface-subtle flex h-full min-h-0 min-w-0 flex-col border-r border-border">
      <div className="afx-surface-toolbar flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
        <MessageSquare size={14} className="shrink-0 text-afx-brand" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium">Capture</p>
          {notesSources.length <= 1 ? (
            <p className="truncate font-mono text-[10px] text-muted-foreground">{activeFilePath}</p>
          ) : null}
        </div>
        {!isNarrow ? sourceControl : null}
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-2 p-3">
        <Textarea
          aria-label="New note"
          value={text}
          onChange={(event) => updateCaptureDraft(event.target.value)}
          onFocus={() => setTextareaFocused(true)}
          onBlur={() => setTextareaFocused(false)}
          onKeyDown={onKeyDown}
          disabled={writesDisabled}
          placeholder="Quick note… (Enter to save, Shift+Enter for newline)
Markdown supported — # heading, **bold**, - list, `code`."
          className={`afx-field-surface afx-notes-capture-input min-h-[4.5rem] flex-1 resize-none text-sm transition-all ${
            textareaFocused ? "border-l-4 border-l-afx-brand pl-3" : ""
          }`}
        />
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={!text.trim() || writesDisabled || Boolean(pending)}
          className="afx-notes-capture-save h-8 w-full"
        >
          {pending?.mutation.kind === "append" ? (
            <RefreshCw size={14} className="mr-1 animate-spin motion-reduce:animate-none" />
          ) : (
            <CheckCircle size={14} className="mr-1" />
          )}
          {pending?.mutation.kind === "append"
            ? pending.confirmedRevision
              ? "Saved · syncing"
              : "Saving"
            : "Save"}
        </Button>
      </div>
      <div className="flex shrink-0 items-center gap-2 border-t border-border px-3 py-1 text-[10px] text-muted-foreground">
        <span>
          <span className="font-mono">{activeNotes.length}</span> notes ·{" "}
          <span className="font-mono">{uniqueDays}</span> day{uniqueDays === 1 ? "" : "s"}
        </span>
        <span className="ml-auto truncate">Enter saves · Shift+Enter newline</span>
      </div>
    </aside>
  );

  const timelinePane = (
    <section className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
      <div className="afx-surface-toolbar flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <FileText size={14} className="shrink-0 text-muted-foreground" />
        <span className="truncate text-xs font-medium">{activeFilePath}</span>
        <span className="font-mono text-[10px] text-muted-foreground">
          {filtered.length}/{activeNotes.length}
        </span>
        <div className="relative min-w-28 flex-1 sm:ml-2 sm:max-w-[220px]">
          <Search
            size={11}
            className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search notes…"
            className="afx-field-surface h-7 pl-6 text-xs"
            aria-label="Search notes"
          />
        </div>
        {isNarrow ? (
          <NativeSelect
            size="sm"
            aria-label="Date filter"
            value={dateFilter}
            onChange={(event) => setDateFilter(event.target.value as DateFilter)}
          >
            {DATE_FILTERS.map((filter) => (
              <NativeSelectOption key={filter.value} value={filter.value}>
                {filter.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        ) : (
          <div className="flex shrink-0 items-center gap-1" aria-label="Date filter">
            {DATE_FILTERS.map((filter) => (
              <Button
                key={filter.value}
                type="button"
                size="xs"
                variant={dateFilter === filter.value ? "secondary" : "ghost"}
                onClick={() => setDateFilter(filter.value)}
                aria-pressed={dateFilter === filter.value}
                className="h-6 px-2 font-mono text-[10px]"
              >
                {filter.label}
              </Button>
            ))}
          </div>
        )}
        <OpenActions filePath={activeFilePath} includeAfxPreview />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-8">
          <p className="text-sm text-muted-foreground">Loading notes…</p>
        </div>
      ) : activeNotes.length === 0 ? (
        <NotesEmptyGuide />
      ) : grouped.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-muted-foreground">No notes match “{search}”.</p>
        </div>
      ) : (
        <ScrollArea className="min-h-0 flex-1">
          <div className="mx-auto w-full max-w-3xl px-3 py-4 sm:px-5">
            {grouped.map((group) => (
              <DateSection
                key={group.date}
                group={group}
                pending={pending}
                failure={failure}
                writesDisabled={writesDisabled}
                onDelete={(noteId) => dispatchMutation({ kind: "delete", noteId })}
                onEdit={(noteId, nextText) =>
                  dispatchMutation({ kind: "edit", noteId, text: nextText }, nextText)
                }
                onToggle={(noteId, itemFingerprint, completed) =>
                  dispatchMutation({
                    kind: "toggleCheckbox",
                    noteId,
                    itemFingerprint,
                    completed,
                  })
                }
              />
            ))}
          </div>
        </ScrollArea>
      )}
    </section>
  );

  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      className="relative flex h-full min-h-0 min-w-0 flex-col overflow-hidden outline-none"
    >
      {/* Alerts float over the view — appearing/disappearing feedback must not
          push the tabs and panes below it. */}
      {(activeSource?.revision.dirty || activeSource?.parseError || failure) && (
        <div className="pointer-events-none absolute inset-x-0 bottom-2 z-20 flex justify-center px-2">
          <div
            className="pointer-events-auto flex max-w-[min(44rem,100%)] shrink-0 flex-col gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/15 px-3 py-1.5 text-xs shadow-lg backdrop-blur sm:flex-row sm:items-center sm:gap-2"
            role="alert"
            aria-live="assertive"
          >
            <div className="flex min-w-0 items-start gap-2 sm:flex-1 sm:items-center">
              <CircleAlert size={13} className="mt-0.5 shrink-0 text-amber-500 sm:mt-0" />
              <span className="min-w-0 leading-snug">
                {failure?.result.message ??
                  activeSource?.parseError ??
                  "Unsaved in editor. Save or discard the editor changes before modifying Notes here."}
                {failureTargetLabel ? (
                  <span className="ml-1 font-mono text-[10px] text-muted-foreground">
                    Target: {failureTargetLabel}
                  </span>
                ) : null}
              </span>
            </div>
            <div className="flex max-w-full shrink-0 items-center justify-end gap-1 overflow-x-auto">
              {failure?.draft ? (
                <CopyMarkdownButton
                  content={failure.draft}
                  label="unsaved Notes draft"
                  ariaLabel="Copy unsaved Notes draft"
                />
              ) : null}
              {failure?.result.retryable ? (
                <Button
                  size="xs"
                  variant="outline"
                  onClick={retryFailure}
                  disabled={Boolean(pending)}
                  aria-label={`Retry failed change in ${failureTargetLabel}`}
                >
                  <RefreshCw size={11} className="mr-1" />
                  Retry
                </Button>
              ) : null}
              {failure ? (
                <Button size="xs" variant="ghost" onClick={reloadAfterFailure}>
                  <RefreshCw size={11} className="mr-1" />
                  Reload
                </Button>
              ) : null}
              <OpenActions filePath={failureTargetLabel ?? activeFilePath} />
              {failure ? (
                <Button
                  size="icon-xs"
                  variant="ghost"
                  aria-label="Dismiss error"
                  onClick={() => {
                    rootRef.current?.focus();
                    setFailure(null);
                  }}
                >
                  <X size={11} />
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      )}
      {pending ? (
        <span className="sr-only" role="status" aria-live="polite">
          {pending.confirmedRevision ? "Note saved; refreshing timeline" : "Saving note"}
        </span>
      ) : null}
      {isNarrow ? (
        <>
          <div className="afx-surface-toolbar flex shrink-0 flex-wrap items-center gap-1 border-b border-border p-1">
            <div className="flex min-w-40 flex-1" role="tablist" aria-label="Notes pane">
              {(["capture", "timeline"] as const).map((pane) => (
                <Button
                  key={pane}
                  role="tab"
                  aria-selected={narrowPane === pane}
                  variant={narrowPane === pane ? "secondary" : "ghost"}
                  size="sm"
                  className="h-7 flex-1 capitalize"
                  onClick={() => setNarrowPane(pane)}
                >
                  {pane}
                </Button>
              ))}
            </div>
            {sourceControl}
          </div>
          <div className="min-h-0 flex-1" role="tabpanel">
            {narrowPane === "capture" ? capturePane : timelinePane}
          </div>
        </>
      ) : (
        <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1 overflow-hidden">
          <ResizablePanel defaultSize="36%" minSize="280px" maxSize="58%">
            {capturePane}
          </ResizablePanel>
          <ResizableHandle
            withHandle
            className="w-2 bg-border/60 transition-colors hover:bg-afx-brand/35 focus-visible:bg-afx-brand/35"
          />
          <ResizablePanel defaultSize="64%" minSize="320px">
            {timelinePane}
          </ResizablePanel>
        </ResizablePanelGroup>
      )}
    </div>
  );
}

/**
 * Empty Notes onboarding that explains fleeting-note sources and the timeline
 * users get after notes arrive.
 *
 * @see docs/specs/224-app-workbench-notes/spec.md [FR-8]
 * @see docs/specs/224-app-workbench-notes/design.md [DES-NOTES-EMPTY]
 */
function NotesEmptyGuide() {
  const sources = [
    {
      icon: NotepadText,
      label: "Workbench capture",
      body: "Type on the left and press Enter for quick repo-backed notes.",
    },
    {
      icon: MessageSquare,
      label: "From chat",
      body: "Send a useful thought, snippet, or decision into the same notes file.",
    },
    {
      icon: MousePointer2,
      label: "IDE right click",
      body: "Capture selected code or markdown without breaking your editor flow.",
    },
  ];
  const preview = [
    "Check release wording after screenshots pass.",
    "PRD reader needs a quality pulse, not just pretty markdown.",
    "Follow up: board columns need explicit move controls.",
  ];

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden bg-background">
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex min-h-full flex-col gap-2 p-3">
          <header className="flex min-w-0 items-center gap-2.5 border-b border-border pb-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-afx-brand/25 bg-afx-brand/10 text-afx-brand">
              <Lightbulb size={17} aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-afx-brand-soft">
                Fleeting notes
              </p>
              <h2 className="truncate text-base font-semibold leading-tight">
                Catch the thought before it becomes a task
              </h2>
            </div>
          </header>

          <section className="grid grid-cols-[repeat(auto-fit,minmax(110px,1fr))] gap-2">
            {sources.map(({ icon: Icon, label, body }) => (
              <div key={label} className="rounded-md border border-border bg-muted/20 px-2.5 py-2">
                <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  <Icon size={11} className="text-afx-brand-soft" aria-hidden />
                  {label}
                </div>
                <p className="mt-1 line-clamp-1 text-[11px] leading-4 text-foreground/85">{body}</p>
              </div>
            ))}
          </section>

          <section className="min-w-0 rounded-md border border-border bg-muted/15 p-2.5">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium">Timeline after capture</span>
              <span className="font-mono text-[10px] text-muted-foreground">mock</span>
            </div>
            <div className="grid gap-2 md:grid-cols-3">
              {preview.map((text, index) => (
                <article
                  key={text}
                  className="rounded-md border border-border/90 bg-background px-3 py-2 shadow-[0_1px_0_rgba(255,255,255,0.04),0_8px_22px_rgba(0,0,0,0.04)]"
                >
                  <header className="font-mono text-[10px] uppercase tracking-[0.12em] text-afx-brand-soft">
                    {index === 0 ? "just now" : index === 1 ? "today" : "yesterday"}
                  </header>
                  <p className="mt-1 line-clamp-2 text-xs leading-4 text-foreground/90">{text}</p>
                </article>
              ))}
            </div>
          </section>
        </div>
      </ScrollArea>
    </div>
  );
}

/**
 * Sticky day section in the notes timeline.
 *
 * @see docs/specs/224-app-workbench-notes/spec.md [FR-4]
 * @see docs/specs/224-app-workbench-notes/design.md [DES-NOTES-TIMELINE]
 */
function DateSection({
  group,
  pending,
  failure,
  writesDisabled,
  onDelete,
  onEdit,
  onToggle,
}: {
  group: DateGroup;
  pending: PendingNotesMutation | null;
  failure: FailedNotesMutation | null;
  writesDisabled: boolean;
  onDelete: (noteId: string) => void;
  onEdit: (noteId: string, text: string) => void;
  onToggle: (noteId: string, itemFingerprint: string, completed: boolean) => void;
}) {
  return (
    <section className="mb-6">
      <header className="afx-surface-subtle sticky top-0 z-10 mb-3 flex items-center gap-2 rounded-md border border-border/40 px-3 py-1.5 backdrop-blur">
        <span
          className="size-1.5 rounded-full bg-afx-brand shadow-[0_0_6px_var(--afx-brand)]"
          aria-hidden
        />
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground">
          {group.label}
        </span>
        <span className="text-[10px] text-muted-foreground/70" title={group.date}>
          {group.shortLabel}
        </span>
        <span className="ml-auto font-mono text-[10px] text-muted-foreground">
          {group.notes.length} {group.notes.length === 1 ? "note" : "notes"}
        </span>
      </header>
      <ol className="relative ml-3 border-l border-dashed border-border/70 pl-6">
        {group.notes.map((note, index) => (
          <NoteItem
            key={note.id ?? `${note.timestamp}-${index}`}
            note={note}
            pending={pending}
            failure={failure}
            writesDisabled={writesDisabled}
            onDelete={onDelete}
            onEdit={onEdit}
            onToggle={onToggle}
          />
        ))}
      </ol>
    </section>
  );
}

/**
 * Single timeline note item with markdown preview and inline edit/delete.
 *
 * @see docs/specs/224-app-workbench-notes/spec.md [FR-5] [FR-6] [FR-7]
 * @see docs/specs/224-app-workbench-notes/design.md [DES-NOTES-ITEM] [DES-NOTES-TIME]
 */
function NoteItem({
  note,
  pending,
  failure,
  writesDisabled,
  onDelete,
  onEdit,
  onToggle,
}: {
  note: QuickNote;
  pending: PendingNotesMutation | null;
  failure: FailedNotesMutation | null;
  writesDisabled: boolean;
  onDelete: (noteId: string) => void;
  onEdit: (noteId: string, text: string) => void;
  onToggle: (noteId: string, itemFingerprint: string, completed: boolean) => void;
}) {
  const time = humanizeTimestamp(note.timestamp, note.displayTime);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.text);
  const [submittedText, setSubmittedText] = useState<string | null>(null);
  const notePending = Boolean(
    note.id && pending && pending.mutation.kind !== "append" && pending.mutation.noteId === note.id,
  );
  const noteFailed = Boolean(
    note.id && failure && failure.mutation.kind !== "append" && failure.mutation.noteId === note.id,
  );
  const editConfirmed = Boolean(
    submittedText && note.text.trim() === submittedText && !notePending,
  );
  const isEditing = editing && !editConfirmed;

  function startEdit(): void {
    setDraft(note.text);
    setEditing(true);
  }

  function cancel(): void {
    if (notePending) return;
    setEditing(false);
    setSubmittedText(null);
    setDraft(note.text);
  }

  function save(): void {
    const next = draft.trim();
    if (!next || next === note.text.trim()) {
      cancel();
      return;
    }
    if (!note.id || notePending || writesDisabled) return;
    setSubmittedText(next);
    onEdit(note.id, next);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>): void {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      save();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancel();
    }
  }

  return (
    <li className="group relative mb-3 last:mb-0">
      <span
        className="absolute -left-[31px] top-3.5 flex size-4 items-center justify-center rounded-full border border-afx-brand/40 bg-background ring-2 ring-background"
        aria-hidden
      >
        <span className="size-1.5 rounded-full bg-afx-brand" />
      </span>
      <article
        className={`afx-surface-card relative rounded-md border bg-background px-4 py-3 shadow-[0_1px_0_rgba(255,255,255,0.04),0_8px_24px_rgba(0,0,0,0.05)] transition-all before:absolute before:bottom-3 before:left-0 before:top-3 before:w-0.5 before:rounded-r before:bg-afx-brand/35 ${
          isEditing
            ? "border-afx-brand/60 ring-1 ring-afx-brand/20"
            : "border-border hover:-translate-y-px hover:border-afx-brand/40"
        }`}
      >
        <header
          className="mb-2 flex items-baseline gap-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground"
          title={time.tooltip}
        >
          <span className="text-afx-brand-soft">{time.primary}</span>
          {time.secondary && <span className="text-muted-foreground/60">{time.secondary}</span>}
          {!isEditing && (
            <div className="ml-auto flex items-center gap-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
              <CopyMarkdownButton
                content={note.text}
                label={`note ${note.timestamp}`}
                ariaLabel="Copy note markdown source"
              />
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="Edit note"
                title="Edit note"
                onClick={startEdit}
                disabled={!note.id || writesDisabled || Boolean(pending)}
              >
                <Pencil size={11} />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="Delete note"
                title="Delete note"
                onClick={() => note.id && onDelete(note.id)}
                disabled={!note.id || writesDisabled || Boolean(pending)}
              >
                <Trash2 size={11} />
              </Button>
            </div>
          )}
        </header>
        {isEditing ? (
          <div className="flex flex-col gap-2">
            <Textarea
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              aria-label="Edit note text"
              disabled={notePending}
              className="afx-field-surface min-h-32 resize-y text-sm"
            />
            <div className="flex items-center justify-end gap-1.5 text-[10px] text-muted-foreground">
              <span className="mr-auto" role={noteFailed ? "alert" : undefined}>
                {notePending
                  ? pending?.confirmedRevision
                    ? "Saved · syncing timeline"
                    : "Saving edit…"
                  : noteFailed
                    ? "Save failed — draft retained"
                    : "⌘/Ctrl+Enter to save · Esc to cancel"}
              </span>
              <Button variant="ghost" size="xs" onClick={cancel} disabled={notePending}>
                <X size={11} className="mr-1" />
                Cancel
              </Button>
              <Button
                size="xs"
                onClick={save}
                disabled={!draft.trim() || notePending || writesDisabled}
              >
                {notePending ? (
                  <RefreshCw size={11} className="mr-1 animate-spin motion-reduce:animate-none" />
                ) : (
                  <CheckCircle size={11} className="mr-1" />
                )}
                {notePending ? "Saving" : "Save"}
              </Button>
            </div>
          </div>
        ) : (
          <DocumentReader
            preset="note"
            chrome="none"
            content={note.text}
            onCheckboxToggle={(target) => {
              if (!note.id || writesDisabled || pending) return;
              const checkbox =
                target.checkboxIndex === undefined
                  ? undefined
                  : note.checkboxes?.[target.checkboxIndex];
              if (!checkbox) return;
              onToggle(note.id, checkbox.fingerprint, target.completed);
            }}
          />
        )}
      </article>
    </li>
  );
}

/**
 * Group notes into newest-first day sections.
 *
 * @see docs/specs/224-app-workbench-notes/spec.md [FR-3] [FR-4]
 * @see docs/specs/224-app-workbench-notes/design.md [DES-NOTES-FILTERS] [DES-NOTES-TIMELINE]
 */
function groupByDate(notes: QuickNote[]): DateGroup[] {
  const groups = new Map<string, QuickNote[]>();
  for (const note of notes) {
    const list = groups.get(note.date) ?? [];
    list.push(note);
    groups.set(note.date, list);
  }
  return Array.from(groups.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, list]) => {
      const sorted = [...list].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      return {
        date,
        label: dayLabel(date),
        shortLabel: shortDateLabel(date),
        notes: sorted,
      };
    });
}

/**
 * Human-facing date header label for the note timeline.
 *
 * @see docs/specs/224-app-workbench-notes/spec.md [FR-7]
 * @see docs/specs/224-app-workbench-notes/design.md [DES-NOTES-TIME]
 */
function dayLabel(dateStr: string): string {
  const d = parseDate(dateStr);
  if (!d) return dateStr;
  const today = startOfDay(new Date());
  const target = startOfDay(d);
  const diffDays = Math.round((today.getTime() - target.getTime()) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return d.toLocaleDateString(undefined, { weekday: "long" });
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

/**
 * Compact absolute date label used beside sticky day headers.
 *
 * @see docs/specs/224-app-workbench-notes/spec.md [FR-7]
 * @see docs/specs/224-app-workbench-notes/design.md [DES-NOTES-TIME]
 */
function shortDateLabel(dateStr: string): string {
  const d = parseDate(dateStr);
  if (!d) return dateStr;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/**
 * Convert the active date filter to a cutoff date.
 *
 * @see docs/specs/224-app-workbench-notes/spec.md [FR-3]
 * @see docs/specs/224-app-workbench-notes/design.md [DES-NOTES-FILTERS]
 */
function getDateRange(filter: DateFilter): Date | null {
  if (filter === "all") return null;
  const now = new Date();
  if (filter === "today") return startOfDay(now);
  const cutoff = new Date(now);
  if (filter === "week") {
    cutoff.setDate(cutoff.getDate() - 7);
    return cutoff;
  }
  cutoff.setMonth(cutoff.getMonth() - 1);
  return cutoff;
}

interface HumanTime {
  primary: string;
  secondary?: string;
  tooltip: string;
}

/**
 * Build the primary/secondary/tooltip timestamp text for a note.
 *
 * @see docs/specs/224-app-workbench-notes/spec.md [FR-7]
 * @see docs/specs/224-app-workbench-notes/design.md [DES-NOTES-TIME]
 */
function humanizeTimestamp(timestamp: string, fallback?: string): HumanTime {
  const d = new Date(timestamp);
  if (Number.isNaN(d.getTime())) {
    return { primary: fallback ?? timestamp, tooltip: timestamp };
  }
  const tooltip = d.toLocaleString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  return { primary: formatClock(d), secondary: relativeTimestamp(d), tooltip };
}

/**
 * Best-effort relative label shown beside the exact note time.
 *
 * @see docs/specs/224-app-workbench-notes/spec.md [FR-7]
 * @see docs/specs/224-app-workbench-notes/design.md [DES-NOTES-TIME]
 */
function relativeTimestamp(d: Date): string | undefined {
  const now = Date.now();
  const diffMs = now - d.getTime();
  if (diffMs < 0) return undefined;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMs < 60_000) return "just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  const sameDay = startOfDay(new Date(now)).getTime() === startOfDay(d).getTime();
  if (sameDay) return "today";
  const diffHr = Math.floor(diffMs / 3_600_000);
  if (diffHr < 24 * 2) return "yesterday";
  return undefined;
}

/**
 * Exact 12-hour clock including seconds.
 *
 * @see docs/specs/224-app-workbench-notes/spec.md [FR-7]
 * @see docs/specs/224-app-workbench-notes/design.md [DES-NOTES-TIME]
 */
function formatClock(d: Date): string {
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

/**
 * Parse date-only and timestamp strings for note grouping.
 *
 * @see docs/specs/224-app-workbench-notes/spec.md [FR-7]
 * @see docs/specs/224-app-workbench-notes/design.md [DES-NOTES-TIME]
 */
function parseDate(value: string): Date | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number) as [number, number, number];
    return new Date(year, month - 1, day);
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Normalize a date to local-day midnight for range and relative calculations.
 *
 * @see docs/specs/224-app-workbench-notes/spec.md [FR-7]
 * @see docs/specs/224-app-workbench-notes/design.md [DES-NOTES-TIME]
 */
function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
