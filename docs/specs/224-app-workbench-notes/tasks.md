---
afx: true
type: TASKS
status: Living
owner: "@rixrix"
version: "1.0"
created_at: "2026-05-03T03:28:22.000Z"
updated_at: "2026-05-09T12:21:59.000Z"
tags: ["app", "workbench", "notes", "capture", "markdown"]
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

- [ ] Point Notes source and tests at this child spec.
- [ ] Add component/helper refs for capture, filters, timeline, item editing, and time labels.

---

## Phase 1: Keyboard Coverage

### 1.1 Capture And Edit Shortcuts

- [ ] Test Enter save, Shift+Enter newline, Cmd/Ctrl+Enter edit save, and Escape cancel.

---

## Implementation Flow

```
Phase 0: Traceability Migration
    ↓
Phase 1: Keyboard Coverage
```

---

## Cross-Reference Index

| Task | Spec Requirement | Design Section                        |
| ---- | ---------------- | ------------------------------------- |
| 0.1  | [FR-1], [FR-7]   | [DES-REFS]                            |
| 1.1  | [FR-2], [FR-6]   | [DES-NOTES-CAPTURE], [DES-NOTES-ITEM] |

---

## Notes

- Chat composer notes shortcuts are owned by `215-app-chat-notes`.

---

## Work Sessions

<!-- IMPORTANT: This section MUST remain the LAST section in tasks.md. Do not add content below it. -->

| Date | Task | Action | Files Modified | Agent | Human |
| ---- | ---- | ------ | -------------- | ----- | ----- |
