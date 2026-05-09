---
afx: true
type: TASKS
status: Living
owner: "@rixrix"
version: "1.0"
created_at: "2026-05-03T03:28:22.000Z"
updated_at: "2026-05-09T12:21:59.000Z"
tags: ["app", "workbench", "pipeline", "progress", "features"]
spec: spec.md
design: design.md
---

# App Workbench Pipeline - Implementation Tasks

---

## Task Numbering Convention

Tasks use hierarchical numbering and link to spec/design IDs.

---

## Phase 0: Traceability Migration

### 0.1 Retarget Pipeline Anchors

<!-- files: apps/workbench/src/views/pipeline.tsx, apps/workbench/src/lib/pipeline.ts, apps/workbench/src/hooks/use-local-storage.ts, apps/workbench/src/views/pipeline.test.tsx -->
<!-- @see docs/specs/225-app-workbench-pipeline/design.md [DES-REFS] | docs/specs/225-app-workbench-pipeline/spec.md [FR-1] [FR-5] -->

- [ ] Point Pipeline view, helper, hook, and test refs at this child spec.

---

## Phase 1: Helper Coverage

### 1.1 Pipeline Helper Tests

- [ ] Add tests for group status, next action, grouping order, and date helpers.

---

## Implementation Flow

```
Phase 0: Traceability Migration
    ↓
Phase 1: Helper Coverage
```

---

## Cross-Reference Index

| Task | Spec Requirement | Design Section         |
| ---- | ---------------- | ---------------------- |
| 0.1  | [FR-1], [FR-5]   | [DES-REFS]             |
| 1.1  | [FR-5]           | [DES-PIPELINE-HELPERS] |

---

## Notes

- Pipeline analytics are owned by `226-app-workbench-analytics`.

---

## Work Sessions

<!-- IMPORTANT: This section MUST remain the LAST section in tasks.md. Do not add content below it. -->

| Date | Task | Action | Files Modified | Agent | Human |
| ---- | ---- | ------ | -------------- | ----- | ----- |
