---
afx: true
type: TASKS
status: Living
owner: "@rixrix"
version: "1.0"
created_at: "2026-05-03T03:28:22.000Z"
updated_at: "2026-05-09T12:21:59.000Z"
tags: ["app", "workbench", "documents", "reader", "markdown"]
spec: spec.md
design: design.md
---

# App Workbench Documents - Implementation Tasks

---

## Task Numbering Convention

Tasks use hierarchical numbering and link to spec/design IDs.

---

## Phase 0: Traceability Migration

### 0.1 Retarget Documents Anchors

<!-- files: apps/workbench/src/views/documents.tsx, apps/workbench/src/lib/documents.ts, apps/workbench/src/lib/document-outline.ts, apps/workbench/src/lib/frontmatter.ts, apps/workbench/src/lib/markdown-render.tsx -->
<!-- @see docs/specs/222-app-workbench-documents/design.md [DES-REFS] | docs/specs/222-app-workbench-documents/spec.md [FR-1] [FR-6] -->

- [ ] Point Documents view and helper files at this child spec.
- [ ] Add helper-level refs for tree, home, reader, metadata, outline, and markdown.

---

## Phase 1: Helper Tests

### 1.1 Document Helper Coverage

- [ ] Add focused tests for frontmatter, outline, renderability, and tree construction.

---

## Implementation Flow

```
Phase 0: Traceability Migration
    ↓
Phase 1: Helper Tests
```

---

## Cross-Reference Index

| Task | Spec Requirement | Design Section     |
| ---- | ---------------- | ------------------ |
| 0.1  | [FR-1], [FR-6]   | [DES-REFS]         |
| 1.1  | [FR-6]           | [DES-DOCS-HELPERS] |

---

## Notes

- This spec owns reader/tree helpers, not the Impact Lens index.

---

## Work Sessions

<!-- IMPORTANT: This section MUST remain the LAST section in tasks.md. Do not add content below it. -->

| Date | Task | Action | Files Modified | Agent | Human |
| ---- | ---- | ------ | -------------- | ----- | ----- |
