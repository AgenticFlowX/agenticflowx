---
afx: true
type: TASKS
status: Draft
owner: "@rixrix"
version: "1.0"
created_at: "2026-05-03T03:28:22.000Z"
updated_at: "2026-05-03T03:28:22.000Z"
tags: ["app", "workbench", "board", "kanban", "markdown"]
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

## Implementation Flow

```
Phase 0: Traceability Migration
    ↓
Phase 1: Serializer Hardening
```

---

## Cross-Reference Index

| Task | Spec Requirement | Design Section            |
| ---- | ---------------- | ------------------------- |
| 0.1  | [FR-1], [FR-3]   | [DES-REFS]                |
| 1.1  | [FR-5]           | [DES-BOARD-SERIALIZATION] |

---

## Notes

- This child spec owns Board tab implementation only.

---

## Work Sessions

<!-- IMPORTANT: This section MUST remain the LAST section in tasks.md. Do not add content below it. -->

| Date | Task | Action | Files Modified | Agent | Human |
| ---- | ---- | ------ | -------------- | ----- | ----- |
