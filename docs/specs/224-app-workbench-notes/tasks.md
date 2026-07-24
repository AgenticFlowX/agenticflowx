---
afx: true
type: TASKS
owner: "@rixrix"
version: "1.1"
created_at: "2026-05-03T03:28:22.000Z"
updated_at: "2026-07-19T07:00:12.000Z"
tags:
  [
    "app",
    "workbench",
    "notes",
    "capture",
    "markdown",
    "realtime",
    "revisions",
    "acknowledged-mutations",
    "multi-root",
    "responsive",
  ]
spec: spec.md
design: design.md
---

# App Workbench Notes - Implementation Tasks

---

## Task Numbering Convention

Tasks use hierarchical numbering and link to spec/design IDs.

---

## Phase 0: Traceability Migration

### 0.1 Retarget Notes Anchors

<!-- files: apps/workbench/src/views/notes.tsx, apps/workbench/src/views/notes.test.tsx -->
<!-- @see docs/specs/224-app-workbench-notes/design.md [DES-REFS] | docs/specs/224-app-workbench-notes/spec.md [FR-1] [FR-7] -->

- [x] Point Notes source and tests at this child spec.
- [x] Add component/helper refs for capture, filters, timeline, item editing, and time labels.

---

## Phase 1: Keyboard Coverage

### 1.1 Capture And Edit Shortcuts

- [x] Test Enter save, Shift+Enter newline, Cmd/Ctrl+Enter edit save, and Escape cancel.

---

## Phase 2: Canonical Source And Realtime State

### 2.1 Add Notes Source Snapshots

<!-- files: packages/shared/src/workbench-types.ts, packages/shared/src/workbench-protocol.ts, apps/vscode/src/services/specs-data.ts, apps/workbench/src/context/workbench-context.tsx -->
<!-- @see docs/specs/224-app-workbench-notes/spec.md [FR-10] [FR-11] [NFR-5] [NFR-6] | docs/specs/224-app-workbench-notes/design.md [DES-NOTES-IDENTITY] [DES-NOTES-LIVE-SYNC] [DES-DATA] -->

- [x] Carry canonical workspace-folder identity, relative path, revision, scan generation, editor-dirty state, and opaque note IDs for every discovered Notes source, including notes-only and nested/second-root workspaces.

### 2.2 Reconcile Manual Editor And External Changes

<!-- files: apps/vscode/src/services/workbench-file-state.ts, apps/vscode/src/services/workbench-refresh-coordinator.ts, apps/workbench/src/views/notes.tsx, apps/workbench/src/views/notes.test.tsx -->
<!-- @see docs/specs/224-app-workbench-notes/spec.md [FR-11] [NFR-5] [NFR-6] | docs/specs/224-app-workbench-notes/design.md [DES-NOTES-LIVE-SYNC] -->

- [x] Prefer unsaved `TextDocument` content, apply only newer clean snapshots, disable writes against dirty editor content, retain the last valid timeline for malformed drafts, and suppress stale scans/results.

---

## Phase 3: Lossless Acknowledged Notes Mutations

### 3.1 Build The Notes Markdown Document

<!-- files: apps/vscode/src/services/notes-markdown.ts, apps/vscode/src/services/notes-markdown.test.ts, apps/vscode/src/services/specs-data.ts -->
<!-- @see docs/specs/224-app-workbench-notes/spec.md [FR-10] [FR-12] [NFR-3] [NFR-5] | docs/specs/224-app-workbench-notes/design.md [DES-NOTES-IDENTITY] [DES-NOTES-MARKDOWN] -->

- [x] Parse canonical and legacy note records into stable revision-scoped locators and prove byte-identical no-op plus localized append/edit/delete/checkbox patches across multiline, duplicate, arbitrary-heading, CRLF, and malformed fixtures.

### 3.2 Route Notes Through The Mutation Coordinator

<!-- files: packages/shared/src/workbench-protocol.ts, apps/vscode/src/services/workbench-mutation-coordinator.ts, apps/vscode/src/panels/workbench-panel.ts, apps/vscode/src/utils/notes-utils.ts, apps/workbench/src/views/notes.tsx -->
<!-- @see docs/specs/224-app-workbench-notes/spec.md [FR-6] [FR-10] [FR-13] [NFR-5] | docs/specs/224-app-workbench-notes/design.md [DES-NOTES-MUTATION] [DES-API] -->

- [x] Replace timestamp-only/fire-and-forget writes with request-ID, canonical target, expected revision, per-path FIFO execution, and exactly one success/error/conflict result.

### 3.3 Make Draft And Checkbox UX Truthful

<!-- files: apps/workbench/src/views/notes.tsx, apps/workbench/src/views/notes.test.tsx, apps/workbench/src/lib/markdown-render.tsx -->
<!-- @see docs/specs/224-app-workbench-notes/spec.md [FR-10] [FR-12] [FR-13] | docs/specs/224-app-workbench-notes/design.md [DES-NOTES-ITEM] [DES-NOTES-MUTATION] -->

- [x] Retain capture/edit text until matching success, prevent duplicate submits, expose retry/reload/copy/open recovery, and target checkbox toggles by note ID plus item fingerprint instead of global line or timestamp.

---

## Phase 4: Multi-Source And Responsive Notes UX

### 4.1 Add Exact Notes Source Selection

<!-- files: apps/workbench/src/views/notes.tsx, apps/workbench/src/views/notes.test.tsx, packages/shared/src/workbench-types.ts -->
<!-- @see docs/specs/224-app-workbench-notes/spec.md [FR-10] [NFR-5] [NFR-7] | docs/specs/224-app-workbench-notes/design.md [DES-NOTES-IDENTITY] -->

- [x] Add a compact root/path source selector and guarantee capture, item mutations, Open, and Preview always address the displayed source with no first-root fallback.

### 4.2 Add Capture And Timeline Narrow Mode

<!-- files: apps/workbench/src/views/notes.tsx, apps/workbench/src/index.css, apps/workbench/src/views/notes.test.tsx -->
<!-- @see docs/specs/224-app-workbench-notes/spec.md [FR-1] [FR-3] [FR-6] [NFR-7] | docs/specs/224-app-workbench-notes/design.md [DES-NOTES-RESPONSIVE] -->

- [x] Keep the draggable split at desktop and switch below 720 px to state-preserving Capture/Timeline modes with bounded menus, visible Save/source controls, unclipped focus, and no hover-only action at 360 px.

### 4.3 Converge Cross-Surface Note Entry Points

<!-- files: apps/vscode/src/utils/notes-utils.ts, apps/vscode/src/panels/sidebar-panel.ts, apps/vscode/src/panels/workbench-panel.ts, apps/workbench/src/views/canvas.tsx -->
<!-- @see docs/specs/224-app-workbench-notes/spec.md [FR-10] [FR-11] [FR-13] [NFR-5] | docs/specs/224-app-workbench-notes/design.md [DES-NOTES-MUTATION] [DES-ARCH] -->

- [x] Adapt Workbench, Chat save-note, Canvas promotion, and editor actions into the same canonical source mutation coordinator and prove they update one live timeline without overlapping writes.

---

## Phase 5: Notes Regression And Evidence

### 5.1 Complete Parser Component And Host Regression

<!-- files: apps/vscode/src/services/notes-markdown.test.ts, apps/workbench/src/views/notes.test.tsx, apps/vscode/src/panels/workbench-panel.test.ts, apps/vscode/src/utils/notes-utils.test.ts -->
<!-- @see docs/specs/224-app-workbench-notes/spec.md [FR-1]–[FR-13] [NFR-3] [NFR-5] [NFR-7] | docs/specs/224-app-workbench-notes/design.md [DES-TEST] -->

- [x] Cover lossless syntax, duplicate identities, revisions, same-path FIFO, one terminal result, keyboard policy, pending/error/conflict retention, source routing, realtime replacement, and responsive accessibility.

### 5.2 Complete Realtime E2E And F5 Smoke

<!-- files: apps/workbench/e2e/workbench.spec.ts, apps/vscode-e2e/src, apps/vscode-e2e/artifacts -->
<!-- @see docs/specs/224-app-workbench-notes/spec.md [FR-10] [FR-11] [FR-12] [FR-13] [NFR-6] [NFR-7] | docs/specs/224-app-workbench-notes/design.md [DES-TEST] [DES-ROLLOUT] -->

- [ ] Verify 360 px through desktop, unsaved/manual/external edits, notes-only and multi-root projects, duplicate timestamps, malformed drafts, cross-surface appends, checkbox edits, and conflict recovery with review screenshots.

---

## Implementation Flow

```
Phase 0: Traceability Migration
    ↓
Phase 1: Keyboard Coverage
    ↓
Phase 2: Canonical Source And Realtime State
    ↓
Phase 3: Lossless Acknowledged Notes Mutations
    ↓
Phase 4: Multi-Source And Responsive Notes UX
    ↓
Phase 5: Notes Regression And Evidence
```

---

## Cross-Reference Index

| Task | Spec Requirement          | Design Section                                          |
| ---- | ------------------------- | ------------------------------------------------------- |
| 0.1  | [FR-1], [FR-7]            | [DES-REFS]                                              |
| 1.1  | [FR-2], [FR-6]            | [DES-NOTES-CAPTURE], [DES-NOTES-ITEM]                   |
| 2.1  | [FR-10], [FR-11]          | [DES-NOTES-IDENTITY], [DES-NOTES-LIVE-SYNC], [DES-DATA] |
| 2.2  | [FR-11]                   | [DES-NOTES-LIVE-SYNC]                                   |
| 3.1  | [FR-10], [FR-12]          | [DES-NOTES-IDENTITY], [DES-NOTES-MARKDOWN]              |
| 3.2  | [FR-6], [FR-10], [FR-13]  | [DES-NOTES-MUTATION], [DES-API]                         |
| 3.3  | [FR-10], [FR-12], [FR-13] | [DES-NOTES-ITEM], [DES-NOTES-MUTATION]                  |
| 4.1  | [FR-10]                   | [DES-NOTES-IDENTITY]                                    |
| 4.2  | [FR-1], [FR-3], [FR-6]    | [DES-NOTES-RESPONSIVE]                                  |
| 4.3  | [FR-10], [FR-11], [FR-13] | [DES-NOTES-MUTATION], [DES-ARCH]                        |
| 5.1  | [FR-1]–[FR-13]            | [DES-TEST]                                              |
| 5.2  | [FR-10]–[FR-13]           | [DES-TEST], [DES-ROLLOUT]                               |

---

## Notes

- Chat composer notes shortcuts are owned by `215-app-chat-notes`.
- Phase 5.2 remains open for the final manual F5 smoke of unsaved editor changes,
  external writes, Chat/Canvas convergence, and a second workspace root. The
  automated responsive and acknowledged-mutation E2E scenarios are complete.

---

## Work Sessions

<!-- IMPORTANT: This section MUST remain the LAST section in tasks.md. Do not add content below it. -->

| Date       | Task    | Action                   | Files Modified                       | Agent | Human |
| ---------- | ------- | ------------------------ | ------------------------------------ | ----- | ----- |
| 2026-07-19 | 2.1-5.2 | Reviewed                 | design.md, tasks.md                  | [x]   | []    |
| 2026-07-19 | 0.1-5.1 | Implemented and verified | Notes parser, host, UI, and tests    | [x]   | []    |
| 2026-07-19 | 5.2     | Automated E2E            | workbench.spec.ts, Notes screenshots | [x]   | []    |
