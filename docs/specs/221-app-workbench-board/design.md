---
afx: true
type: DESIGN
status: Approved
owner: "@rixrix"
version: "1.1"
created_at: "2026-05-03T03:28:22.000Z"
updated_at: "2026-07-19T03:42:33.000Z"
tags:
  [
    "app",
    "workbench",
    "board",
    "kanban",
    "markdown",
    "realtime",
    "revisions",
    "linked-work-items",
    "dnd-kit",
    "multi-root",
  ]
spec: spec.md
---

# App Workbench Board - Technical Design

---

## [DES-OVR] Overview

The Board tab is a Workbench child surface for Markdown-backed Kanban boards.
It owns board selection, lifecycle dialogs, column/card rendering, recoverable
local drafts, and linked AFX work-item presentation. The VS Code host owns
source parsing, lossless range patching, path validation, revision checks, and
durable writes. A Board never treats a sent message or elapsed timer as proof of
save; it settles UI state only from a request-correlated host result.

The same surface supports free-text cards and live linked cards. Linked cards
are stored as ordinary Markdown links followed by a versioned `afx:card` HTML
comment, so non-AFX tools retain useful content while AFX can resolve live spec
or stable WBS task-section state.

<!-- @see spec.md [FR-1] [FR-5] [FR-11] [FR-12] [FR-13] [FR-14] [FR-15] [NFR-2] [NFR-5] -->

---

## [DES-ARCH] Architecture

```text
VS Code host
  WorkbenchFileState
    ├─ open TextDocument overlay (preferred over disk)
    ├─ Board + linked spec/tasks snapshots
    └─ revision + workspace-root identity
  WorkbenchRefreshCoordinator (debounced, latest wins)
  KanbanMarkdownDocument (lossless parse + range patch)
  WorkbenchMutationCoordinator (per-path FIFO)
      │ afxUpdate / afxMutationResult
      v
WorkbenchProvider
  ├─ board snapshots + linked-work resolution
  └─ send acknowledged board/work-item mutations
      v
Board
  ├─ board/source selector and lifecycle controls
  ├─ KanbanColumn[] -> KanbanCard[] | LinkedWorkItemCard[]
  ├─ LinkWorkPicker
  ├─ @dnd-kit pointer/touch/keyboard reorder
  └─ pending/error/conflict reconciliation
```

`Board` never imports VS Code or filesystem APIs. The host is the only
persistence boundary. Board-file mutations and linked task mutations share the
shell mutation coordinator but remain distinct commands and target identities.
Moving a linked card changes the Board document only; changing its checklist
changes the referenced task document only.

<!-- @see spec.md [FR-2] [FR-4] [FR-5] [FR-11] [FR-13] [FR-15] [NFR-1] [NFR-5] -->

---

## [DES-UI] User Interface & UX

### [DES-BOARD-MOCKUP] Board ASCII

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ [board select: Roadmap v] [rename] [delete] [Roadmap Backlog Q2]      active 3 cols · 9 cards            │
│                                                [Link work] [Open] [Preview] [Column] [New board]         │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ ┌──────────── Todo ────────────┐ ┌────────── In Progress ────────┐ ┌──────────── Done ────────────┐      │
│ │ grip · Todo        (3) ← → ✎ │ │ grip · In Progress (4) ← → ✎ │ │ grip · Done        (2) ← → ✎ │      │
│ │ ┌──────────────────────────┐ │ │ ┌──────────────────────────┐ │ │ ┌──────────────────────────┐ │      │
│ │ │ Card title               │ │ │ │ Task 2.4 · Canvas edges  │ │ │ │ Completed card           │ │      │
│ │ │ body preview up to 3ln   │ │ │ │ 3/5 · Open · Checklist   │ │ │ │                          │ │      │
│ │ └──────────────────────────┘ │ │ └──────────────────────────┘ │ │ └──────────────────────────┘ │      │
│ │ [Add card.................]+ │ │ [Add card.................]+ │ │ [Add card.................]+ │      │
│ └──────────────────────────────┘ └──────────────────────────────┘ └──────────────────────────────┘      │
│ Dialogs: new board · rename board · delete confirm · edit column/card                                    │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### [DES-BOARD-TOOLBAR] Board Selector And Dialogs

`Board` owns the board selector, latest-five quick chips, rename/delete actions,
status metadata, total column/card counts, `OpenActions`, add-column popover,
and create-board dialog.

### [DES-BOARD-CARD] Kanban Card

`KanbanCard` splits text into title/body, renders a compact card, exposes
edit/delete controls on hover/focus, uses a stable render ID, supports
double-click edit, and exposes a dedicated sortable drag handle. Card links and
actions never activate drag sensors.

### [DES-BOARD-COLUMN] Kanban Column

`KanbanColumn` renders a sortable header handle, card count,
always-discoverable Move menu, delete gating, empty drop target, card list, and
add-card input. Dnd-kit active/over state drives source opacity and insertion
markers without making the entire column header draggable.

### [DES-BOARD-EMPTY] Board Empty Guide

`BoardEmptyGuide` replaces the generic empty state when no `.afx/kanban/*.md`
boards exist. It keeps board creation visible in the bottom-panel viewport:
quick board templates, a compact custom-board form, and a slim mock board
preview show the destination before the first board file exists.

### [DES-BOARD-STABILITY] Stable Reorder Model

Every parsed column and card receives a snapshot-local render ID derived from
its canonical source identity plus its source span and content fingerprint.
New cards receive a generated client ID that remains stable until the confirmed
host snapshot supplies a source-backed ID. Draft inputs are keyed by those IDs,
not mutable titles or array positions. This prevents duplicate column names,
duplicate card text, and reorders from transferring draft or drag state to the
wrong item.

### [DES-BOARD-LIVE-SYNC] Live Source Reconciliation

<!-- @see spec.md [FR-11] [NFR-5] [NFR-6] -->

The host snapshot carries canonical source identity, revision, dirty-buffer
state, and a monotonically increasing scan generation. When no Board mutation
or local edit is pending, a newer snapshot replaces the rendered board within
the shell debounce target. Unsaved editor content is rendered with a subtle
`Unsaved in editor` status and disables visual mutations until that document is
saved, because the host must not overwrite a dirty `TextDocument`.

When a newer source snapshot arrives while Board owns a local draft or pending
request, Board preserves the draft and enters an explicit conflict state. The
user can reload the confirmed source or copy/open the recoverable draft; there
is no implicit last-write-wins path. Stale results are ignored by `requestId`
and cannot clear newer pending work.

### [DES-BOARD-LINK-WORK] Linked AFX Work-Item Cards

<!-- @see spec.md [FR-12] [FR-13] [FR-14] -->

`LinkWorkPicker` is a bounded dialog/sheet with search, root/spec grouping,
multi-select, a target-column selector, and keyboard selection. It lists specs
and stable WBS task sections such as `2.4`, not individual line numbers. A
canonical key of `kind + workspaceFolderId + relativePath + wbsId?` prevents
duplicates in the selected board while permitting the same item on another
board.

`LinkedWorkItemCard` renders the stored link label, live host-resolved lifecycle
or task progress, an expandable source-owned checklist, and Open/Preview/Studio
actions. Checklist toggles target the source task document with its own expected
revision. Missing, moved, malformed, ambiguous, or cross-root references remain
visible as unresolved cards and never silently rebind.

### [DES-BOARD-DND] Accessible Movement

<!-- @see spec.md [FR-4] [FR-9] [FR-15] [NFR-7] -->

Card and column movement uses `@dnd-kit/core` and `@dnd-kit/sortable` with
pointer, touch, and keyboard sensors, collision detection appropriate to the
horizontal lane layout, visible insertion markers, and live-region
announcements. Drag handles are explicit buttons; activation is separated from
card links and actions. A keyboard-reachable Move menu remains the dependable
fallback for every card and column.

At widths below 720 px the toolbar moves secondary actions into `More`, columns
remain one compact horizontally scrollable row with snap points, and dialogs
use the viewport width with internal scrolling. At 360 px no primary action,
focus ring, status, or picker footer may be clipped.

---

## [DES-DEC] Key Decisions

| Decision              | Options Considered                          | Choice                                          | Rationale                                                                                  |
| --------------------- | ------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Drag/drop             | HTML5 events, `@dnd-kit`                    | `@dnd-kit` plus explicit Move actions           | Pointer, touch, and keyboard sensors share one ordering model while Move remains reliable. |
| Persistence           | Fire-and-forget content save, host mutation | Revisioned acknowledged host mutation           | Prevents stale or dirty source replacement and makes pending/error UI truthful.            |
| Markdown mutation     | Full regeneration, source-range patching    | Lossless source-range patching                  | Preserves frontmatter, preamble, unknown blocks/comments, and supported card forms.        |
| Linked-card format    | Opaque JSON, Markdown-only heuristic        | Markdown link plus versioned `afx:card` comment | Remains useful in ordinary Markdown while retaining deterministic AFX identity.            |
| Work-item authority   | Board column, source AFX document           | Source AFX document                             | Board organizes work; spec/task files own lifecycle, progress, and completion.             |
| Realtime source edits | Disk watcher only, open-buffer overlay      | Open-buffer overlay preferred over disk         | Manual unsaved edits appear without allowing the Board to overwrite a dirty editor.        |

---

## [DES-DATA] Data Model

### [DES-BOARD-DATA] Board Data Shapes

<!-- @see spec.md [FR-5] [FR-8] [FR-11] [FR-13] [FR-14] [NFR-5] -->

Shared browser-safe contracts carry identity and resolved presentation data;
the host-only Markdown document retains raw spans and opaque syntax needed for
lossless mutation.

```typescript
interface WorkbenchSourceIdentity {
  workspaceFolderId: string;
  relativePath: string;
}

interface KanbanBoardSnapshot {
  source: WorkbenchSourceIdentity;
  revision: string;
  scanGeneration: number;
  editorDirty: boolean;
  name: string;
  meta: KanbanMeta;
  columns: KanbanColumn[];
}

interface KanbanColumn {
  id: string;
  title: string;
  cards: KanbanCard[];
}

interface KanbanCard {
  id: string;
  text: string;
  link?: LinkedWorkItemRef;
  resolved?: LinkedWorkItemSnapshot;
}

type LinkedWorkItemRef =
  | {
      version: 1;
      kind: "spec";
      source: WorkbenchSourceIdentity;
    }
  | {
      version: 1;
      kind: "task";
      source: WorkbenchSourceIdentity;
      wbsId: string;
    };

type LinkedWorkItemSnapshot =
  | {
      state: "resolved";
      sourceRevision: string;
      title: string;
      lifecycle?: string;
      completed: number;
      total: number;
      checklist?: Array<{
        fingerprint: string;
        text: string;
        completed: boolean;
      }>;
    }
  | {
      state: "unresolved";
      reason: "missing" | "moved" | "malformed" | "ambiguous" | "cross-root";
      message: string;
    };
```

The host-only `KanbanMarkdownDocument` stores each recognized column/card as an
immutable source span plus preserved leading/trailing trivia. Unsupported
blocks remain opaque spans. A mutation may proceed only when its target span is
unambiguous in the expected revision.

### [DES-BOARD-PORTABLE-LINK] Portable Linked-Card Encoding

The readable Markdown line is authoritative fallback content; the adjacent
comment is optional AFX enhancement data. JSON is compact, versioned, and
contains no absolute path or transient lifecycle value.

```markdown
- [Task 2.4 · Canvas edges](../../docs/specs/229-app-workbench-canvas/tasks.md#24-canvas-edges)
  <!-- afx:card {"v":1,"id":"work-7f2a","workItem":{"kind":"task","root":"afx-vscode-v2","path":"docs/specs/229-app-workbench-canvas/tasks.md","wbs":"2.4"}} -->
```

Unknown `afx:card` versions and unrelated HTML comments round-trip byte-for-byte
and render as ordinary cards without executing or trusting their metadata.

---

## [DES-API] API Contracts

<!-- @see spec.md [FR-2] [FR-7] [FR-11] [FR-12] [FR-13] [FR-15] [NFR-5] -->

Every durable operation uses the shell mutation result union. `create` omits an
expected revision; every mutation of an existing source requires one.

```typescript
type KanbanBoardMutation =
  | { kind: "addColumn"; title: string }
  | { kind: "renameColumn"; columnId: string; title: string }
  | { kind: "deleteColumn"; columnId: string }
  | { kind: "addCard"; columnId: string; text: string; link?: LinkedWorkItemRef }
  | { kind: "editCard"; cardId: string; text: string }
  | { kind: "deleteCard"; cardId: string }
  | { kind: "moveCard"; cardId: string; toColumnId: string; beforeCardId?: string }
  | { kind: "moveColumn"; columnId: string; beforeColumnId?: string };

type BoardToHost =
  | { type: "afxCreateKanbanBoard"; requestId: string; targetRootId: string; name: string }
  | {
      type: "afxRenameKanbanBoard";
      requestId: string;
      target: WorkbenchSourceIdentity;
      expectedRevision: string;
      name: string;
    }
  | {
      type: "afxDeleteKanbanBoard";
      requestId: string;
      target: WorkbenchSourceIdentity;
      expectedRevision: string;
    }
  | {
      type: "afxMutateKanbanBoard";
      requestId: string;
      target: WorkbenchSourceIdentity;
      expectedRevision: string;
      mutation: KanbanBoardMutation;
    }
  | {
      type: "afxToggleLinkedTask";
      requestId: string;
      target: WorkbenchSourceIdentity;
      expectedRevision: string;
      wbsId: string;
      itemFingerprint: string;
      completed: boolean;
    }
  | { type: "afxOpenFile"; path: string; mode: "editor" | "preview" | "afxPreview" };
```

The host posts exactly one `afxMutationResult` with the same `requestId`:
`success` includes the confirmed revision; `conflict` includes the latest
revision and an actionable message; `error` includes a safe message and retry
classification. Results never include source contents. The next `afxUpdate`
remains the authoritative snapshot.

---

## [DES-FILES] File Structure

| File                                                 | Purpose                                                          |
| ---------------------------------------------------- | ---------------------------------------------------------------- |
| `apps/workbench/src/views/board.tsx`                 | Board UI and request/result reconciliation                       |
| `apps/workbench/src/views/board.test.tsx`            | Component, responsive, conflict, and movement tests              |
| `apps/workbench/src/components/link-work-picker.tsx` | Bounded searchable spec/WBS picker                               |
| `apps/workbench/src/components/linked-work-item.tsx` | Live resolved linked-card presentation                           |
| `apps/vscode/src/services/kanban-markdown.ts`        | Host-only lossless parser and source-range mutation engine       |
| `apps/vscode/src/services/kanban-markdown.test.ts`   | Golden round-trip and adversarial fixture tests                  |
| `apps/vscode/src/services/linked-work-items.ts`      | Multi-root discovery, stable WBS resolution, transient snapshots |
| `packages/shared/src/workbench-types.ts`             | Board snapshots, source identity, linked-work contracts          |
| `packages/shared/src/workbench-protocol.ts`          | Revisioned mutation/result discriminated unions                  |

---

## [DES-DEPS] Dependencies

- `@afx/shared` for domain and protocol types.
- `@afx/ui` for dialogs, buttons, inputs, popovers, selects, scroll areas.
- `@dnd-kit/core` and `@dnd-kit/sortable` for accessible pointer, touch, and keyboard movement.
- `220-app-workbench` for provider state and bridge ownership.
- `227-app-workbench-shell` for live document overlays, latest-wins refreshes,
  multi-root resolution, and acknowledged per-path mutations.

No Markdown AST dependency is introduced initially. The range parser is small,
fixture-driven, and fails closed when it cannot prove a safe patch boundary.
The packaged dependency inventory and third-party notices must include the
resolved `@dnd-kit` packages and their license texts before the feature ships.

---

## [DES-SEC] Security Considerations

The webview sends structured mutations, never arbitrary destination paths plus
replacement Markdown. The host resolves canonical source identities within a
known workspace folder, rejects traversal/outside-workspace targets and dirty
documents, and validates expected revision before mutation. Linked-card
metadata is untrusted data: it never executes commands, absolute paths are
ignored, unknown versions do not resolve, and labels/Markdown render through
the existing safe renderer. The Board tab does not import VS Code, filesystem,
or process APIs.

---

## [DES-ERR] Error Handling

- Empty board list renders creation-focused guide with multi-board copy and mock preview.
- Delete requires confirmation.
- Empty edit text is rejected locally.
- Each request has one visible pending state keyed by `requestId`; only its
  matching success settles that state.
- Error retains the user's draft and exposes Retry plus Open source.
- Conflict retains the draft, disables further mutation, and exposes Reload
  confirmed source plus Copy/Open draft recovery.
- Dirty editor, stale revision, missing source, ambiguous range, duplicate
  link, and unsupported metadata produce distinct concise messages.
- If linked work cannot resolve, the card remains visible and editable as Board
  content; no source mutation action is offered.

---

## [DES-TEST] Testing Strategy

- Parser/unit: golden byte-preserving no-op round trips; localized add/edit/
  delete/move patches; frontmatter, preamble, arbitrary headings, reserved
  rules, list cards, multiline cards, comments, unknown `afx:card` versions,
  duplicate titles/text, CRLF, malformed/ambiguous fixtures, and stable WBS
  extraction.
- Component: clean realtime replacement, unsaved-editor state, stale result
  suppression, success/error/conflict recovery, duplicate-link prevention,
  resolved/unresolved linked cards, source-owned checklist mutation, and draft
  retention.
- Accessibility: pointer/touch/keyboard `@dnd-kit` sensors, live announcements,
  explicit Move fallback, focus restoration, picker multi-select, and reduced
  motion.
- Responsive/e2e: 360 px, 480 px, sidebar, and desktop panel widths; toolbar
  overflow, horizontal columns, bounded Link work picker, manual unsaved edit,
  external save, multi-root board/task, malformed metadata, and conflict flow.
- Host: same-path FIFO ordering, expected-revision rejection, dirty-buffer
  rejection, outside-workspace rejection, one terminal result, and latest-wins
  refresh generation.

---

## [DES-ROLLOUT] Migration / Rollout Plan

1. Land shared source identity/result contracts and the shell live-document and
   mutation coordinators behind existing Board UI.
2. Extract the host lossless parser/patcher and prove it with golden fixtures;
   keep the visual Board read-only on any ambiguous fixture.
3. Switch lifecycle and card/column changes from `afxSaveFile` to revisioned
   mutations, then remove timer-derived save success.
4. Add linked-work discovery/format/resolution and source-owned task toggles.
5. Replace HTML5 dragging with `@dnd-kit`, retain explicit Move actions, and
   complete narrow-width/accessibility coverage.
6. Run targeted unit/host/e2e suites, full repository gates, and F5 smoke for
   unsaved editor, external write, conflict, duplicate labels, and second root.

---

## [DES-BOARD-LOC] Code Locator Map

| Map ID               | Code anchor                                            | Messages/data                             | Tests                                     |
| -------------------- | ------------------------------------------------------ | ----------------------------------------- | ----------------------------------------- |
| `[Board.View]`       | `apps/workbench/src/views/board.tsx` `Board`           | snapshots, mutations, `afxMutationResult` | `apps/workbench/src/views/board.test.tsx` |
| `[Board.Empty]`      | `apps/workbench/src/views/board.tsx` `BoardEmptyGuide` | `afxCreateKanbanBoard`                    | board.test.tsx                            |
| `[Board.Card]`       | `KanbanCard`, `LinkedWorkItemCard`                     | card/link/resolution shapes               | board.test.tsx                            |
| `[Board.LinkPicker]` | `components/link-work-picker.tsx`                      | `LinkedWorkItemRef[]`                     | link-work-picker.test.tsx                 |
| `[Board.Markdown]`   | `apps/vscode/src/services/kanban-markdown.ts`          | raw spans + `KanbanBoardMutation`         | kanban-markdown.test.ts                   |
| `[Board.LiveSource]` | shell `WorkbenchFileState`, Board reconciliation       | revision, generation, editor-dirty        | host + board tests                        |
| `[Board.Movement]`   | Board dnd context, sortable columns/cards, Move menu   | stable IDs + structured move mutations    | board tests + e2e                         |

## [DES-BOARD-TRACE] Functional Trace Matrix

| Requirement | Design nodes                                                        | Code anchors                                  | Verification           |
| ----------- | ------------------------------------------------------------------- | --------------------------------------------- | ---------------------- |
| FR-1–FR-3   | `[DES-BOARD-MOCKUP]`, `[DES-BOARD-CARD]`, `[DES-BOARD-COLUMN]`      | Board lifecycle and card/column components    | board + host tests     |
| FR-4, FR-9  | `[DES-BOARD-DND]`, `[DES-BOARD-STABILITY]`                          | dnd-kit sensors and explicit Move actions     | a11y + e2e             |
| FR-5        | `[DES-BOARD-SERIALIZATION]`, `[DES-BOARD-PORTABLE-LINK]`            | host lossless Markdown document               | golden fixtures        |
| FR-6–FR-10  | `[DES-BOARD-TOOLBAR]`, `[DES-BOARD-EMPTY]`, `[DES-BOARD-STABILITY]` | Board view and source actions                 | component + e2e        |
| FR-11       | `[DES-BOARD-LIVE-SYNC]`, `[DES-BOARD-SAVE]`                         | snapshot reconciliation + mutation result     | host + component       |
| FR-12–FR-14 | `[DES-BOARD-LINK-WORK]`, `[DES-BOARD-PORTABLE-LINK]`                | picker, resolver, linked cards, source toggle | unit + component + e2e |
| FR-15       | `[DES-BOARD-DND]`                                                   | sortable cards/columns + move mutation        | pointer/touch/keyboard |

---

## [DES-REFS] File Reference Map

<!-- @see spec.md [NFR-4] -->

| File                                                 | Required @see                                                                                                |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `apps/workbench/src/views/board.tsx`                 | `spec.md [FR-1] [FR-4] [FR-11] [FR-15]` + `design.md [DES-BOARD-LIVE-SYNC] [DES-BOARD-DND] [DES-BOARD-SAVE]` |
| `apps/workbench/src/components/link-work-picker.tsx` | `spec.md [FR-12] [FR-14]` + `design.md [DES-BOARD-LINK-WORK] [DES-BOARD-PORTABLE-LINK]`                      |
| `apps/workbench/src/components/linked-work-item.tsx` | `spec.md [FR-13]` + `design.md [DES-BOARD-LINK-WORK]`                                                        |
| `apps/vscode/src/services/kanban-markdown.ts`        | `spec.md [FR-5] [FR-14] [NFR-5]` + `design.md [DES-BOARD-SERIALIZATION] [DES-BOARD-PORTABLE-LINK]`           |
| `apps/workbench/src/views/board.test.tsx`            | `spec.md [FR-3] [FR-4] [FR-11] [FR-15]` + `design.md [DES-TEST] [DES-BOARD-LIVE-SYNC] [DES-BOARD-DND]`       |

### [DES-BOARD-SERIALIZATION] Markdown Serialization

<!-- @see spec.md [FR-5] [FR-14] [NFR-3] [NFR-5] -->

`KanbanMarkdownDocument` tokenizes frontmatter, preamble, recognized `##`
columns, list cards, `###` multiline card blocks, adjacent metadata comments,
and opaque ranges. A no-op parse/serialize is byte-identical. Mutations patch
only the proven target ranges and preserve newline style, unsupported blocks,
unknown comments/metadata, and Board Rules content. A card move carries its
adjacent `afx:card` comment as one unit. The parser returns a safe error instead
of regenerating the file when headings or spans are ambiguous.

### [DES-BOARD-SAVE] Optimistic Save Flow

<!-- @see spec.md [FR-11] [NFR-5] -->

Board applies a recoverable optimistic projection keyed by `requestId`, sends a
structured mutation with the current expected revision, and shows pending
status. Only the matching `afxMutationResult.success` plus confirmed snapshot
commits and clears that draft. Error/conflict retains the draft; a newer request
cannot be settled by an older result. Mutations targeting the same canonical
source are queued in the host and never overlap on disk.
