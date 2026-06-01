---
afx: true
type: TASKS
status: Draft
owner: "@rixrix"
version: "1.0"
created_at: "2026-06-01T10:08:49.000Z"
updated_at: "2026-06-01T11:06:02.000Z"
tags: ["app", "vscode", "model-selection", "persistence", "runtime-state"]
spec: spec.md
design: design.md
---

# App VSCode Model Selection State - Implementation Tasks

## Task Numbering Convention

Tasks use hierarchical numbering. `[FR-X]` references `spec.md`, `[DES-X]` references `design.md`, and `[X.Y]` references this task file.

---

## Phase 0: Canonical Spec Setup

### 0.1 Create canonical docs

<!-- files: afx-vscode-v2/docs/specs/205-app-vscode-model-selection-state/{spec.md,design.md,tasks.md,journal.md} -->
<!-- @see docs/specs/205-app-vscode-model-selection-state/spec.md [FR-1] | docs/specs/205-app-vscode-model-selection-state/design.md [DES-OVR] -->

- [x] Create focused spec/design/tasks/journal files for model selection state.
- [ ] Validate doc structure with AFX spec/design/task checks.

---

## Phase 1: Traceability Migration

### 1.1 Retarget host state links

<!-- files: apps/vscode/src/model-default-selection.ts, apps/vscode/src/panels/sidebar-panel.ts, apps/vscode/src/extension.ts, packages/shared/src/agent.ts, packages/shared/src/messages.ts -->
<!-- @see docs/specs/205-app-vscode-model-selection-state/spec.md [FR-1] [FR-2] [FR-3] [FR-4] [FR-5] [FR-6] | docs/specs/205-app-vscode-model-selection-state/design.md [DES-FLOW] [DES-DATA] [DES-API] -->

- [x] Replace model-selection state `@see` links that still point to fleet sprint docs.
- [x] Keep selector JSX links on `217-app-chat-model-selector`.

### 1.2 Parent route links

<!-- files: docs/specs/200-app-vscode/{spec.md,design.md}, docs/specs/350-agent-manager/{spec.md,design.md} -->
<!-- @see docs/specs/205-app-vscode-model-selection-state/spec.md [FR-1] [FR-3] -->

- [ ] Add route pointers from broad host/agent docs to this child zone.

---

## Phase 2: Verification

### 2.1 Restore and fallback checks

<!-- files: apps/vscode/src/model-default-selection*.test.ts, apps/vscode/src/panels/sidebar-panel.test.ts -->
<!-- @see docs/specs/205-app-vscode-model-selection-state/spec.md [FR-1] [FR-2] [FR-4] [FR-5] [FR-6] | docs/specs/205-app-vscode-model-selection-state/design.md [DES-TEST] -->

- [ ] Re-run host selection tests.
- [ ] Confirm disabled external runtime fallback and stale SDK fallback.

---

## Cross-Reference Index

| Task | Spec Requirement                               | Design Section                    |
| ---- | ---------------------------------------------- | --------------------------------- |
| 0.1  | [FR-1]                                         | [DES-OVR]                         |
| 1.1  | [FR-1], [FR-2], [FR-3], [FR-4], [FR-5], [FR-6] | [DES-FLOW], [DES-DATA], [DES-API] |
| 1.2  | [FR-3]                                         | [DES-API]                         |
| 2.1  | [FR-1], [FR-2], [FR-4], [FR-5], [FR-6]         | [DES-TEST]                        |

---

## Notes

- This spec owns host persistence and bridge state, not selector rendering.

---

## Work Sessions

<!-- IMPORTANT: This section MUST remain the LAST section in tasks.md. Do not add content below it. -->

| Date       | Task | Action                                                                  | Files Modified                                                                                  | Agent | Human |
| ---------- | ---- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ----- | ----- |
| 2026-06-01 | 0.1  | Created canonical model-selection-state spec set from fleet split plan. | this, spec.md, design.md, journal.md                                                            | [x]   | [ ]   |
| 2026-06-01 | 1.1  | Completed traceability migration.                                       | model-default-selection.ts, multiplex-agent-manager.ts, sidebar-panel.ts, shared agent/messages | [x]   | [ ]   |
