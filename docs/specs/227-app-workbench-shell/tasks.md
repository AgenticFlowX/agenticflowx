---
afx: true
type: TASKS
status: Living
owner: "@rixrix"
version: "1.1"
created_at: "2026-05-03T03:28:22.000Z"
updated_at: "2026-05-23T11:03:30.000Z"
tags: ["app", "workbench", "shell", "tabs", "bridge", "layout"]
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

## Implementation Flow

```
Phase 0: Traceability Migration
    ↓
Phase 1: Impact Lens Slot
    ↓
Phase 2: Preview Boot Mode And Session Signoff
```

---

## Cross-Reference Index

| Task | Spec Requirement | Design Section                               |
| ---- | ---------------- | -------------------------------------------- |
| 0.1  | [FR-1], [FR-8]   | [DES-REFS]                                   |
| 1.1  | [FR-2]           | [DES-SHELL-TABS]                             |
| 2.1  | [FR-1], [FR-15]  | [DES-SHELL-BRIDGE], [DES-SHELL-PREVIEW-MODE] |
| 2.2  | [FR-7]           | [DES-API], [DES-SHELL-FEATURE-COLUMNS]       |

---

## Notes

- This is the Workbench shell, not every Workbench child surface.

---

## Work Sessions

<!-- IMPORTANT: This section MUST remain the LAST section in tasks.md. Do not add content below it. -->

| Date                     | Task | Action   | Files Modified                                                                                                                                                                                                                                    | Agent | Human |
| ------------------------ | ---- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 2026-05-22T10:17:22.000Z | 2.1  | Coded    | spec.md (FR-15), design.md (DES-SHELL-PREVIEW-MODE), apps/workbench/src/main.tsx, apps/workbench/src/preview-app.tsx, apps/workbench/src/preview-app.test.tsx                                                                                     | [x]   | [x]   |
| 2026-05-22T10:17:22.000Z | 2.2  | Coded    | spec.md (FR-7 extended), design.md (DES-API), packages/shared/src/workbench-protocol.ts, apps/vscode/src/panels/workbench-panel.ts, apps/vscode/src/panels/markdown-checkbox-toggle.ts, apps/workbench/src/components/session-signoff-toolbar.tsx | [x]   | [x]   |
| 2026-05-23T11:03:30.000Z | 3.0  | Verified | spec.md/design.md v1.2 (FR-7 signoff prose, DES-API bulk message list), tasks.md (Phase 2 ticked, Work Sessions backfill); pnpm verify green across vscode/workbench tests; preview boot tests and bulk signoff tests included                    | [x]   | [x]   |
