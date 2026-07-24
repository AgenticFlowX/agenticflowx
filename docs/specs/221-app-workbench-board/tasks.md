---
afx: true
type: TASKS
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
design: design.md
---

# App Workbench Board - Implementation Tasks

---

## Task Numbering Convention

Tasks use hierarchical numbering. Source references use `[FR-X]`, `[NFR-X]`,
`[DES-X]`, and task IDs.

---

## Phase 0: Traceability Migration

### 0.1 Retarget Board Anchors

<!-- files: apps/workbench/src/views/board.tsx, apps/workbench/src/views/board.test.tsx -->
<!-- @see docs/specs/221-app-workbench-board/design.md [DES-REFS] | docs/specs/221-app-workbench-board/spec.md [FR-1] -->

- [ ] Point Board source and tests at this child spec.
- [ ] Add component-level refs for card, column, serialization, and save flow.

---

## Phase 1: Serializer Hardening

### 1.1 Markdown Round Trip

- [ ] Add focused serializer tests for frontmatter and multiline cards.

---

## Phase 2: Realtime Source And Mutation Foundation

### 2.1 Adopt Canonical Board Snapshots

<!-- files: packages/shared/src/workbench-types.ts, packages/shared/src/workbench-protocol.ts, apps/workbench/src/context/workbench-context.tsx, apps/workbench/src/views/board.tsx -->
<!-- @see docs/specs/221-app-workbench-board/spec.md [FR-11] [NFR-5] [NFR-6] | docs/specs/221-app-workbench-board/design.md [DES-BOARD-DATA] [DES-BOARD-LIVE-SYNC] -->

- [ ] Carry workspace-folder identity, revision, scan generation, and editor-dirty state through the Board snapshot and reconcile only newer clean snapshots.

### 2.2 Replace Fire-And-Forget Board Saves

<!-- files: packages/shared/src/workbench-protocol.ts, apps/vscode/src/panels/workbench-panel.ts, apps/vscode/src/services/workbench-mutation-coordinator.ts, apps/workbench/src/views/board.tsx -->
<!-- @see docs/specs/221-app-workbench-board/spec.md [FR-2] [FR-5] [FR-11] [NFR-5] | docs/specs/221-app-workbench-board/design.md [DES-API] [DES-BOARD-SAVE] -->

- [ ] Replace `afxSaveFile` Board writes and timer-derived success with request-ID, expected-revision structured mutations and exactly one success/error/conflict result.

### 2.3 Add Recoverable Conflict UX

<!-- files: apps/workbench/src/views/board.tsx, apps/workbench/src/views/board.test.tsx -->
<!-- @see docs/specs/221-app-workbench-board/spec.md [FR-11] [NFR-5] [NFR-7] | docs/specs/221-app-workbench-board/design.md [DES-BOARD-LIVE-SYNC] [DES-ERR] -->

- [ ] Retain pending drafts across host errors/conflicts, suppress stale results, disable mutation against dirty editor content, and expose retry/reload/copy/open recovery actions.

---

## Phase 3: Lossless Board Markdown

### 3.1 Extract The Host Markdown Document

<!-- files: apps/vscode/src/services/kanban-markdown.ts, apps/vscode/src/services/kanban-markdown.test.ts, apps/vscode/src/services/specs-data.ts -->
<!-- @see docs/specs/221-app-workbench-board/spec.md [FR-5] [FR-8] [NFR-3] [NFR-5] | docs/specs/221-app-workbench-board/design.md [DES-BOARD-SERIALIZATION] -->

- [ ] Build a source-span parser with byte-identical no-op round trips and golden fixtures for frontmatter, preamble, duplicate headings/cards, multiline cards, comments, CRLF, Board Rules, and malformed ambiguity.

### 3.2 Implement Localized Board Mutations

<!-- files: apps/vscode/src/services/kanban-markdown.ts, apps/vscode/src/services/kanban-markdown.test.ts, apps/vscode/src/panels/workbench-panel.ts -->
<!-- @see docs/specs/221-app-workbench-board/spec.md [FR-3] [FR-4] [FR-5] [NFR-5] | docs/specs/221-app-workbench-board/design.md [DES-BOARD-SERIALIZATION] [DES-API] -->

- [ ] Patch only proven column/card ranges for add/edit/delete/move operations, preserve opaque syntax, and fail closed rather than regenerate an ambiguous document.

### 3.3 Support Portable Linked-Card Metadata

<!-- files: apps/vscode/src/services/kanban-markdown.ts, packages/shared/src/workbench-types.ts, apps/vscode/src/services/kanban-markdown.test.ts -->
<!-- @see docs/specs/221-app-workbench-board/spec.md [FR-14] [NFR-3] [NFR-5] | docs/specs/221-app-workbench-board/design.md [DES-BOARD-PORTABLE-LINK] -->

- [ ] Parse and write a standard Markdown link plus versioned `afx:card` HTML comment, move both as one card unit, and preserve unknown versions/comments unchanged.

---

## Phase 4: Live AFX Work Items

### 4.1 Discover And Resolve Stable Work Items

<!-- files: apps/vscode/src/services/linked-work-items.ts, apps/vscode/src/services/linked-work-items.test.ts, packages/shared/src/workbench-types.ts, apps/vscode/src/services/specs-data.ts -->
<!-- @see docs/specs/221-app-workbench-board/spec.md [FR-12] [FR-13] [FR-14] | docs/specs/221-app-workbench-board/design.md [DES-BOARD-LINK-WORK] [DES-BOARD-DATA] -->

- [ ] Discover specs and stable WBS task sections across workspace roots, resolve live title/status/progress, and return explicit missing/moved/malformed/ambiguous states without silent rebinding.

### 4.2 Build The Bounded Link Work Picker

<!-- files: apps/workbench/src/components/link-work-picker.tsx, apps/workbench/src/components/link-work-picker.test.tsx, apps/workbench/src/views/board.tsx -->
<!-- @see docs/specs/221-app-workbench-board/spec.md [FR-12] [NFR-7] | docs/specs/221-app-workbench-board/design.md [DES-BOARD-LINK-WORK] -->

- [ ] Add grouped search, keyboard multi-select, target-column choice, duplicate prevention, bounded scrolling, and focus restoration at sidebar widths.

### 4.3 Render And Mutate Linked Task State

<!-- files: apps/workbench/src/components/linked-work-item.tsx, apps/workbench/src/views/board.tsx, apps/vscode/src/services/linked-work-items.ts, apps/vscode/src/panels/workbench-panel.ts -->
<!-- @see docs/specs/221-app-workbench-board/spec.md [FR-13] [FR-15] [NFR-5] | docs/specs/221-app-workbench-board/design.md [DES-BOARD-LINK-WORK] [DES-API] -->

- [ ] Render live spec/task status and source actions, then toggle task checklist items through their own revision-protected source mutation without moving the Board card.

---

## Phase 5: Accessible Movement And Narrow Layout

### 5.1 Migrate Movement To Dnd Kit

<!-- files: apps/workbench/package.json, pnpm-lock.yaml, NOTICE, THIRD_PARTY_NOTICES.md, apps/workbench/src/views/board.tsx, apps/workbench/src/views/board.test.tsx -->
<!-- @see docs/specs/221-app-workbench-board/spec.md [FR-4] [FR-9] [FR-15] [NFR-7] | docs/specs/221-app-workbench-board/design.md [DES-BOARD-DND] [DES-BOARD-STABILITY] -->

- [ ] Replace HTML5 dragging with pointer/touch/keyboard sortable sensors, stable IDs, insertion feedback, announcements, reduced motion, explicit Move fallbacks, and complete packaged third-party license attribution for the resolved `@dnd-kit` dependencies.

### 5.2 Polish Responsive Board UX

<!-- files: apps/workbench/src/views/board.tsx, apps/workbench/src/index.css, apps/workbench/src/views/board.test.tsx -->
<!-- @see docs/specs/221-app-workbench-board/spec.md [FR-6] [FR-10] [FR-12] [NFR-7] | docs/specs/221-app-workbench-board/design.md [DES-BOARD-TOOLBAR] [DES-BOARD-DND] -->

- [ ] Collapse secondary toolbar actions, keep compact horizontally scrollable columns, and prove picker/footer/actions remain reachable at 360 px.

---

## Phase 6: Board Regression And Evidence

### 6.1 Complete Unit And Host Regression

<!-- files: apps/workbench/src/views/board.test.tsx, apps/workbench/src/components/link-work-picker.test.tsx, apps/vscode/src/services/kanban-markdown.test.ts, apps/vscode/src/services/linked-work-items.test.ts, apps/vscode/src/panels/workbench-panel.test.ts -->
<!-- @see docs/specs/221-app-workbench-board/spec.md [FR-1] [FR-15] [NFR-3] [NFR-5] [NFR-7] | docs/specs/221-app-workbench-board/design.md [DES-TEST] -->

- [ ] Cover parser safety, revisions, same-path FIFO, realtime replacement, conflict recovery, linked resolution, source-owned toggles, all movement inputs, and accessibility states.

### 6.2 Complete Responsive E2E And F5 Smoke

<!-- files: apps/workbench/e2e/workbench.spec.ts, apps/vscode-e2e/src, apps/vscode-e2e/artifacts -->
<!-- @see docs/specs/221-app-workbench-board/spec.md [FR-4] [FR-11] [FR-12] [FR-13] [FR-15] [NFR-6] [NFR-7] | docs/specs/221-app-workbench-board/design.md [DES-TEST] [DES-ROLLOUT] -->

- [ ] Verify 360 px through desktop, unsaved/manual/external edits, multi-root sources, malformed metadata, keyboard/touch/pointer movement, and conflict recovery with review screenshots.

---

## Implementation Flow

```
Phase 0: Traceability Migration
    ↓
Phase 1: Serializer Hardening
    ↓
Phase 2: Realtime Source And Mutation Foundation
    ↓
Phase 3: Lossless Board Markdown
    ↓
Phase 4: Live AFX Work Items
    ↓
Phase 5: Accessible Movement And Narrow Layout
    ↓
Phase 6: Board Regression And Evidence
```

---

## Cross-Reference Index

| Task | Spec Requirement          | Design Section                          |
| ---- | ------------------------- | --------------------------------------- |
| 0.1  | [FR-1], [FR-3]            | [DES-REFS]                              |
| 1.1  | [FR-5]                    | [DES-BOARD-SERIALIZATION]               |
| 2.1  | [FR-11]                   | [DES-BOARD-DATA], [DES-BOARD-LIVE-SYNC] |
| 2.2  | [FR-2], [FR-5], [FR-11]   | [DES-API], [DES-BOARD-SAVE]             |
| 2.3  | [FR-11]                   | [DES-BOARD-LIVE-SYNC], [DES-ERR]        |
| 3.1  | [FR-5], [FR-8]            | [DES-BOARD-SERIALIZATION]               |
| 3.2  | [FR-3], [FR-4], [FR-5]    | [DES-BOARD-SERIALIZATION], [DES-API]    |
| 3.3  | [FR-14]                   | [DES-BOARD-PORTABLE-LINK]               |
| 4.1  | [FR-12], [FR-13], [FR-14] | [DES-BOARD-LINK-WORK], [DES-BOARD-DATA] |
| 4.2  | [FR-12]                   | [DES-BOARD-LINK-WORK]                   |
| 4.3  | [FR-13], [FR-15]          | [DES-BOARD-LINK-WORK], [DES-API]        |
| 5.1  | [FR-4], [FR-9], [FR-15]   | [DES-BOARD-DND], [DES-BOARD-STABILITY]  |
| 5.2  | [FR-6], [FR-10], [FR-12]  | [DES-BOARD-TOOLBAR], [DES-BOARD-DND]    |
| 6.1  | [FR-1]–[FR-15]            | [DES-TEST]                              |
| 6.2  | [FR-4], [FR-11]–[FR-15]   | [DES-TEST], [DES-ROLLOUT]               |

---

## Notes

- This child spec owns Board tab implementation only.

---

## Work Sessions

<!-- IMPORTANT: This section MUST remain the LAST section in tasks.md. Do not add content below it. -->

| Date       | Task    | Action   | Files Modified      | Agent | Human |
| ---------- | ------- | -------- | ------------------- | ----- | ----- |
| 2026-07-19 | 2.1-6.2 | Reviewed | design.md, tasks.md | [x]   | []    |
