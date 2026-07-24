---
afx: true
type: TASKS
owner: "@rixrix"
version: "1.2"
created_at: "2026-05-03T03:28:22.000Z"
updated_at: "2026-07-19T03:56:24.000Z"
tags:
  [
    "app",
    "workbench",
    "shell",
    "tabs",
    "bridge",
    "layout",
    "realtime",
    "mutations",
    "view-visibility",
    "multi-root",
    "canvas-editor",
  ]
spec: spec.md
design: design.md
---

# App Workbench Shell - Implementation Tasks

---

## Task Numbering Convention

Tasks use hierarchical numbering and link to spec/design IDs.

---

## Phase 0: Traceability Migration

### 0.1 Retarget Shell Anchors

<!-- files: apps/workbench/src/main.tsx, apps/workbench/src/app.tsx, apps/workbench/src/context/workbench-context.tsx, apps/workbench/src/lib/bridge.ts, apps/workbench/src/views/workbench.tsx, apps/workbench/src/components/coming-soon.tsx -->
<!-- @see docs/specs/227-app-workbench-shell/design.md [DES-REFS] | docs/specs/227-app-workbench-shell/spec.md [FR-1] [FR-8] -->

- [x] Point shell/state/bridge/feature-tab refs at this child spec.
- [x] Keep child tab internals pointed at `221` through `228`.

---

## Phase 1: Impact Lens Slot

### 1.1 Add Future Impact Lens Tab

- [ ] Add shell tab routing after `228-app-workbench-impact-lens` is approved.

---

## Phase 2: Preview Boot Mode And Session Signoff

<!-- files: apps/workbench/src/main.tsx, apps/workbench/src/preview-app.tsx, apps/workbench/src/lib/bridge.ts -->
<!-- @see docs/specs/227-app-workbench-shell/spec.md [FR-7] [FR-15] | docs/specs/227-app-workbench-shell/design.md [DES-SHELL-PREVIEW-MODE] [DES-SHELL-FEATURE-COLUMNS] -->

### 2.1 Standalone Preview Boot

- [x] Branch `main.tsx` on `document.body.dataset.afxView === "preview"` (or `?afx-view=preview`) to mount `<PreviewApp/>` instead of the tab shell.
- [x] Subscribe to `afxPreviewShow` in `<PreviewApp/>` and wrap in `WorkbenchProvider` so `DocPreview` `send` works.
- [x] Keep `initWorkbenchBridge()` and appearance/telemetry subscriptions in both boot modes.

### 2.2 Session Signoff Wiring

- [x] Extend `WorkbenchOutbound` with `afxToggleAllSessions` and `afxApproveSessions`; tighten `afxToggleSession.column` to `"agent" | "human"` and add optional `line?`.
- [x] Route preview signoff toolbar messages through the bridge unchanged in both Workbench feature columns and the editor-area preview.

---

## Phase 3: Live Source State

### 3.1 Open-Document Overlay And Multi-Root Identity

<!-- files: apps/vscode/src/services/workbench-file-state.ts, apps/vscode/src/services/workbench-file-state.test.ts, apps/vscode/src/panels/workbench-panel.ts -->
<!-- @see docs/specs/227-app-workbench-shell/spec.md [FR-17] [FR-20] [NFR-5] [NFR-6] | docs/specs/227-app-workbench-shell/design.md [DES-SHELL-LIVE-DOCUMENTS] -->

- [x] Add a URI-keyed host service that prefers open `TextDocument` content, tracks change/save/close/discard and external writes, emits stable source revisions, and resolves every supported root without first-folder fallback.

### 3.2 Latest-Wins Refresh Coordination

<!-- files: apps/vscode/src/services/specs-data.ts, apps/vscode/src/services/specs-data.test.ts, apps/vscode/src/panels/workbench-panel.ts -->
<!-- @see docs/specs/227-app-workbench-shell/spec.md [FR-17] [FR-19] [NFR-5] [NFR-6] | docs/specs/227-app-workbench-shell/design.md [DES-SHELL-LIVE-DOCUMENTS] -->

- [x] Debounce relevant source events, run one scan at a time, suppress obsolete generations before cache/post, and discover Board and Notes independently of `docs/`.

## Phase 4: Acknowledged Mutation Foundation

### 4.1 Per-Path FIFO Coordinator

<!-- files: apps/vscode/src/services/workbench-mutation-coordinator.ts, apps/vscode/src/services/workbench-mutation-coordinator.test.ts, apps/vscode/src/panels/workbench-panel.ts -->
<!-- @see docs/specs/227-app-workbench-shell/spec.md [FR-18] [FR-20] [NFR-6] | docs/specs/227-app-workbench-shell/design.md [DES-SHELL-MUTATION-COORDINATOR] -->

- [ ] Serialize mutations per canonical URI, re-check expected revision immediately before write, reject dirty/stale/outside/missing/collision cases, use `WorkspaceEdit` for clean open documents, and emit exactly one terminal result.

### 4.2 Bridge And Child Migration Harness

<!-- files: apps/vscode/src/panels/workbench-panel.ts, apps/vscode/src/panels/workbench-panel.test.ts, apps/workbench/src/context/workbench-context.tsx, apps/workbench/src/context/workbench-context.test.tsx -->
<!-- @see docs/specs/227-app-workbench-shell/spec.md [FR-3] [FR-4] [FR-18] | docs/specs/227-app-workbench-shell/design.md [DES-SHELL-STATE] [DES-SHELL-BRIDGE] [DES-SHELL-MUTATION-COORDINATOR] -->

- [ ] Route correlated mutation results to the originating client, fan out confirmed source updates, and give child reducers request-safe pending/conflict state without removing legacy paths until each child migration passes.

## Phase 5: Controlled Views And Canvas Boot

### 5.1 Hidden-View Registry And Recovery

<!-- files: apps/workbench/src/lib/workbench-views.ts, apps/workbench/src/app.tsx, apps/workbench/src/app.test.tsx, apps/workbench/e2e/workbench.spec.ts -->
<!-- @see docs/specs/227-app-workbench-shell/spec.md [FR-2] [FR-11] [FR-16] | docs/specs/227-app-workbench-shell/design.md [DES-SHELL-TAB-VISIBILITY] -->

- [ ] Replace ad-hoc tab conditionals with the fixed ordered registry, capability-plus-hidden filtering, deterministic active fallback, and an accessible all-hidden recovery surface outside the tab container.

### 5.2 Canvas Editor Bundle Boot

<!-- files: apps/workbench/src/main.tsx, apps/workbench/src/canvas-editor-app.tsx, apps/workbench/src/canvas-editor-app.test.tsx, apps/workbench/src/lib/bridge.ts -->
<!-- @see docs/specs/227-app-workbench-shell/spec.md [FR-1] [FR-16] | docs/specs/227-app-workbench-shell/design.md [DES-SHELL-CANVAS-EDITOR-BOOT] -->

- [ ] Add the `canvas-editor` boot selector and root, initialize bridge/appearance/telemetry exactly once, keep view state local, and prove editor boot is independent from Canvas tab visibility.

---

## Implementation Flow

```
Phase 0: Traceability Migration
    ↓
Phase 1: Impact Lens Slot
    ↓
Phase 2: Preview Boot Mode And Session Signoff
    ↓
Phase 3: Live Source State
    ↓
Phase 4: Acknowledged Mutation Foundation
    ↓
Phase 5: Controlled Views And Canvas Boot
```

---

## Cross-Reference Index

| Task | Spec Requirement | Design Section                               |
| ---- | ---------------- | -------------------------------------------- |
| 0.1  | [FR-1], [FR-8]   | [DES-REFS]                                   |
| 1.1  | [FR-2]           | [DES-SHELL-TABS]                             |
| 2.1  | [FR-1], [FR-15]  | [DES-SHELL-BRIDGE], [DES-SHELL-PREVIEW-MODE] |
| 2.2  | [FR-7]           | [DES-API], [DES-SHELL-FEATURE-COLUMNS]       |

| Task | Spec Requirement                   | Design Section                                                          |
| ---- | ---------------------------------- | ----------------------------------------------------------------------- |
| 3.1  | [FR-17], [FR-20], [NFR-5], [NFR-6] | [DES-SHELL-LIVE-DOCUMENTS]                                              |
| 3.2  | [FR-17], [FR-19], [NFR-5], [NFR-6] | [DES-SHELL-LIVE-DOCUMENTS]                                              |
| 4.1  | [FR-18], [FR-20], [NFR-6]          | [DES-SHELL-MUTATION-COORDINATOR]                                        |
| 4.2  | [FR-3], [FR-4], [FR-18]            | [DES-SHELL-STATE], [DES-SHELL-BRIDGE], [DES-SHELL-MUTATION-COORDINATOR] |
| 5.1  | [FR-2], [FR-11], [FR-16]           | [DES-SHELL-TAB-VISIBILITY]                                              |
| 5.2  | [FR-1], [FR-16]                    | [DES-SHELL-CANVAS-EDITOR-BOOT]                                          |

---

## Notes

- This is the Workbench shell, not every Workbench child surface.

---

## Work Sessions

<!-- IMPORTANT: This section MUST remain the LAST section in tasks.md. Do not add content below it. -->

| Date                     | Task    | Action   | Files Modified                                                                                                                                                                                                                                                  | Agent | Human |
| ------------------------ | ------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 2026-05-22T10:17:22.000Z | 2.1     | Coded    | spec.md (FR-15), design.md (DES-SHELL-PREVIEW-MODE), apps/workbench/src/main.tsx, apps/workbench/src/preview-app.tsx, apps/workbench/src/preview-app.test.tsx                                                                                                   | [x]   | [x]   |
| 2026-05-22T10:17:22.000Z | 2.2     | Coded    | spec.md (FR-7 extended), design.md (DES-API), packages/shared/src/workbench-protocol.ts, apps/vscode/src/panels/workbench-panel.ts, apps/vscode/src/panels/markdown-checkbox-toggle.ts, apps/workbench/src/components/session-signoff-toolbar.tsx               | [x]   | [x]   |
| 2026-05-23T11:03:30.000Z | 3.0     | Verified | spec.md/design.md v1.2 (FR-7 signoff prose, DES-API bulk message list), tasks.md (Phase 2 ticked, Work Sessions backfill); pnpm verify green across vscode/workbench tests; preview boot tests and bulk signoff tests included                                  | [x]   | [x]   |
| 2026-07-19               | 3.1-3.2 | Coded    | apps/vscode/src/services/workbench-file-state.ts, apps/vscode/src/services/specs-data.ts, apps/vscode/src/services/canvas-data.ts, apps/vscode/src/panels/workbench-panel.ts, apps/vscode/src/extension.ts, apps/workbench/src/views/canvas.tsx, targeted tests | [x]   | []    |
| 2026-07-19               | 3.1-3.2 | Verified | 62 VS Code host tests, 15 Canvas tests, 6 Canvas Playwright tests, VS Code and Workbench typechecks                                                                                                                                                             | [x]   | []    |
