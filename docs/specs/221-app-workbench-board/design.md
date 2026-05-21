---
afx: true
type: DESIGN
status: Living
owner: "@rixrix"
version: "1.0"
created_at: "2026-05-03T03:28:22.000Z"
updated_at: "2026-05-20T10:59:38.000Z"
tags: ["app", "workbench", "board", "kanban", "markdown"]
spec: spec.md
---

# App Workbench Board - Technical Design

---

## [DES-OVR] Overview

The Board tab is a Workbench child surface for markdown-backed Kanban boards.
It owns board selection, lifecycle dialogs, column/card rendering, optimistic
local edits, and markdown serialization back through the host bridge.
Rendering uses stable derived keys so duplicate column titles or card text do
not confuse React state during reorder.

---

## [DES-ARCH] Architecture

```text
WorkbenchProvider state
  kanban.boards[]
      |
      v
apps/workbench/src/views/board.tsx
  Board
    ├─ toolbar: select/rename/delete/new/open
    ├─ KanbanColumn[]
    │   └─ KanbanCard[]
    ├─ dialogs: create/rename/delete/edit
    └─ saveBoard -> serializeBoard -> send(afxSaveFile)
```

`Board` never writes files directly. Host messages are the only persistence
boundary.

---

## [DES-UI] User Interface & UX

### [DES-BOARD-MOCKUP] Board ASCII

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ [board select: Roadmap v] [rename] [delete] [Roadmap Backlog Q2]      active 3 cols · 9 cards            │
│                                                            [Open] [Preview] [Column] [New board]         │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ ┌──────────── Todo ────────────┐ ┌────────── In Progress ────────┐ ┌──────────── Done ────────────┐      │
│ │ grip · Todo        (3) ← → ✎ │ │ grip · In Progress (4) ← → ✎ │ │ grip · Done        (2) ← → ✎ │      │
│ │ ┌──────────────────────────┐ │ │ ┌──────────────────────────┐ │ │ ┌──────────────────────────┐ │      │
│ │ │ Card title               │ │ │ │ Drag/drop card           │ │ │ │ Completed card           │ │      │
│ │ │ body preview up to 3ln   │ │ │ │ [hover: edit/delete]     │ │ │ │                          │ │      │
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
edit/delete controls on hover/focus, uses a stable derived key, supports
double-click edit, and delegates drag/drop events to `Board`.

### [DES-BOARD-COLUMN] Kanban Column

`KanbanColumn` renders the draggable header, card count, always-discoverable
move-left/right buttons, delete gating, empty drop target, card list, and
add-card input.
Drop-target state is visualized by `isDropTarget`, `isColumnDragSource`, and
`isColumnDropTarget`.

### [DES-BOARD-EMPTY] Board Empty Guide

`BoardEmptyGuide` replaces the generic empty state when no `.afx/kanban/*.md`
boards exist. It keeps board creation visible in the bottom-panel viewport:
quick board templates, a compact custom-board form, and a slim mock board
preview show the destination before the first board file exists.

### [DES-BOARD-STABILITY] Stable Reorder Model

The board markdown schema does not require permanent IDs, so the UI derives
render keys from board path, column/card index, and text. Draft card inputs are
keyed by the derived column key rather than the mutable column title. This keeps
optimistic movement stable when users have duplicate column names, duplicate
card text, or rename a column while typing a new card.

---

## [DES-DEC] Key Decisions

| Decision        | Options Considered                  | Choice                 | Rationale                                                                      |
| --------------- | ----------------------------------- | ---------------------- | ------------------------------------------------------------------------------ |
| Drag/drop       | HTML5 events, `@dnd-kit`            | HTML5 events           | Current code already supports card/column movement without extra adapter work. |
| Persistence     | Host save per mutation, local batch | Host save per mutation | Keeps markdown source of truth and existing host bridge simple.                |
| Markdown format | Frontmatter + headings, JSON blob   | Frontmatter + headings | Keeps boards editable outside the UI.                                          |

---

## [DES-DATA] Data Model

### [DES-BOARD-DATA] Board Data Shapes

The board surface owns five shared types defined in
`packages/shared/src/workbench-types.ts`. Each declaration in that file should carry an
`@see` to the matching anchor below so the protocol/UI 1:1 parity is bidirectional.

| Type           | Owns                                              | Source declaration                       | Local @see                                         |
| -------------- | ------------------------------------------------- | ---------------------------------------- | -------------------------------------------------- |
| `KanbanCard`   | One card row (free-text, optional id)             | `packages/shared/src/workbench-types.ts` | `[DES-BOARD-CARD]` and `[DES-BOARD-DATA]`          |
| `KanbanColumn` | A column title + ordered cards                    | `packages/shared/src/workbench-types.ts` | `[DES-BOARD-COLUMN]` and `[DES-BOARD-DATA]`        |
| `KanbanMeta`   | Frontmatter slice (`title`, `status`, ...)        | `packages/shared/src/workbench-types.ts` | `[DES-BOARD-DATA]`                                 |
| `KanbanBoard`  | One board file: name, path, columns, raw markdown | `packages/shared/src/workbench-types.ts` | `[DES-BOARD-DATA]` and `[DES-BOARD-SERIALIZATION]` |
| `KanbanData`   | Workbench payload: array of boards + active key   | `packages/shared/src/workbench-types.ts` | `[DES-BOARD-DATA]`                                 |

`KanbanBoard` is delivered by the parent Workbench state payload.

```typescript
interface KanbanBoard {
  name: string;
  filePath: string;
  rawContent?: string;
  meta?: { title?: string; status?: string };
  columns: Array<{ title: string; cards: Array<{ text: string }> }>;
}
```

---

## [DES-API] API Contracts

Outbound messages:

- `afxCreateKanbanBoard { name }`
- `afxRenameKanbanBoard { filePath, name }`
- `afxDeleteKanbanBoard { filePath }`
- `afxSaveFile { path, content }`
- `afxOpenFile { path, mode }`

---

## [DES-FILES] File Structure

| File                                        | Purpose                                                 |
| ------------------------------------------- | ------------------------------------------------------- |
| `apps/workbench/src/views/board.tsx`        | Board UI, helpers, optimistic save flow                 |
| `apps/workbench/src/views/board.test.tsx`   | Board movement, open actions, optimistic add-card tests |
| `packages/shared/src/workbench-types.ts`    | `KanbanBoard` payload shape                             |
| `packages/shared/src/workbench-protocol.ts` | Board outbound messages                                 |

---

## [DES-DEPS] Dependencies

- `@afx/shared` for domain and protocol types.
- `@afx/ui` for dialogs, buttons, inputs, popovers, selects, scroll areas.
- `220-app-workbench` for provider state and bridge ownership.

---

## [DES-SEC] Security Considerations

The webview sends paths and markdown content to the host. The host must validate
path ownership before writing. The Board tab must not import VSCode, filesystem,
or process APIs.

---

## [DES-ERR] Error Handling

- Empty board list renders creation-focused guide with multi-board copy and mock preview.
- Delete requires confirmation.
- Empty edit text is rejected locally.
- Saving indicator is optimistic and transient; host errors are handled by the
  parent Workbench update/error flow.

---

## [DES-TEST] Testing Strategy

- Unit: board column movement, duplicate title stability, optimistic card add,
  open actions, and board empty guide.
- Future: serializeBoard round-trip tests for frontmatter, heading, one-line card,
  and multiline card cases.
- Trace: `@see` links on `Board`, `KanbanColumn`, `KanbanCard`, and helpers.

---

## [DES-ROLLOUT] Migration / Rollout Plan

1. Retarget Board source refs from `220-app-workbench` umbrella IDs to this child spec.
2. Keep parent `220-app-workbench` as the shell/router map.
3. Add focused serializer tests before expanding board markdown features.

---

## [DES-BOARD-LOC] Code Locator Map

| Map ID              | Code anchor                                             | Messages/data                                                          | Tests                                     |
| ------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------- |
| `[Board.View]`      | `apps/workbench/src/views/board.tsx` `Board`            | `KanbanData`, `afxToggleTask`                                          | `apps/workbench/src/views/board.test.tsx` |
| `[Board.Empty]`     | `apps/workbench/src/views/board.tsx` `BoardEmptyGuide`  | `afxCreateKanbanBoard`                                                 | board.test.tsx                            |
| `[Board.Card]`      | `apps/workbench/src/views/board.tsx` `KanbanCard` row   | `KanbanCard` shape                                                     | (covered by Board view test)              |
| `[Board.Toolbar]`   | `apps/workbench/src/views/board.tsx` selector + dialogs | `afxCreateKanbanBoard`, `afxRenameKanbanBoard`, `afxDeleteKanbanBoard` | manual                                    |
| `[Board.Stability]` | `stableColumnKey`, `stableCardKey`, draft key usage     | optimistic local board state                                           | board.test.tsx                            |

## [DES-BOARD-TRACE] Functional Trace Matrix

| Requirement | Design nodes                                                   | Code anchors                                    | Verification            |
| ----------- | -------------------------------------------------------------- | ----------------------------------------------- | ----------------------- |
| FR-1        | `[DES-BOARD-MOCKUP]`, `[DES-BOARD-CARD]`, `[DES-BOARD-COLUMN]` | `Board`, column/card render                     | board.test.tsx          |
| FR-7        | `[DES-BOARD-SAVE]`, `[DES-BOARD-SERIALIZATION]`                | `afxToggleTask` dispatch + serialization helper | board.test.tsx + manual |
| FR-8        | `[DES-BOARD-STABILITY]`                                        | stable keys + draft state                       | board.test.tsx          |
| FR-9        | `[DES-BOARD-COLUMN]`, `[DES-BOARD-STABILITY]`                  | visible move controls                           | board.test.tsx + e2e    |
| FR-10       | `[DES-BOARD-EMPTY]`                                            | `BoardEmptyGuide`                               | board.test.tsx + e2e    |

---

## [DES-REFS] File Reference Map

| File                                      | Required @see                                                                                                        |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `apps/workbench/src/views/board.tsx`      | `spec.md [FR-1] [FR-5] [FR-10]` + `design.md [DES-BOARD-CARD] [DES-BOARD-COLUMN] [DES-BOARD-SAVE] [DES-BOARD-EMPTY]` |
| `apps/workbench/src/views/board.test.tsx` | `spec.md [FR-3] [FR-4] [FR-7] [FR-10]` + `design.md [DES-TEST] [DES-BOARD-EMPTY]`                                    |

### [DES-BOARD-SERIALIZATION] Markdown Serialization

`serializeBoard` preserves raw frontmatter/preamble before the first matching
column heading, emits columns as `##`, one-line cards as list items, and
multiline cards as `### title` plus body. `escapeRegExp` protects heading
matching.

### [DES-BOARD-SAVE] Optimistic Save Flow

`saveBoard` updates local boards immediately, sends `afxSaveFile`, then shows
a short saving indicator while waiting for the next authoritative host update.
