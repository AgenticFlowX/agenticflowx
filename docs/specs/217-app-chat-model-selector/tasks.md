---
afx: true
type: TASKS
status: Draft
owner: "@rixrix"
version: "1.0"
created_at: "2026-06-01T10:08:49.000Z"
updated_at: "2026-06-01T11:06:02.000Z"
tags: ["app", "chat", "model-selector", "composer", "search"]
spec: spec.md
design: design.md
---

# App Chat Model Selector - Implementation Tasks

## Task Numbering Convention

Tasks use hierarchical numbering. `[FR-X]` references `spec.md`, `[DES-X]` references `design.md`, and `[X.Y]` references this task file.

---

## Phase 0: Canonical Spec Setup

### 0.1 Create canonical docs

<!-- files: afx-vscode-v2/docs/specs/217-app-chat-model-selector/{spec.md,design.md,tasks.md,journal.md} -->
<!-- @see docs/specs/217-app-chat-model-selector/spec.md [FR-1] | docs/specs/217-app-chat-model-selector/design.md [DES-OVR] -->

- [x] Create focused spec/design/tasks/journal files for the composer model selector.
- [ ] Validate doc structure with AFX spec/design/task checks.

---

## Phase 1: Traceability Migration

### 1.1 Retarget selector source links

<!-- files: apps/chat/src/components/model-combobox.tsx, apps/chat/src/components/model-combobox*.test.tsx, apps/chat/e2e/model-selector.spec.ts -->
<!-- @see docs/specs/217-app-chat-model-selector/spec.md [FR-1] [FR-2] [FR-3] [FR-4] [FR-5] [FR-6] [FR-7] | docs/specs/217-app-chat-model-selector/design.md [DES-SEG] [DES-SEARCH] [DES-UI] -->

- [x] Replace fleet-sprint selector `@see` links with canonical links.
- [x] Rename or split any fleet-named e2e coverage into canonical selector e2e coverage.

### 1.2 Parent route links

<!-- files: docs/specs/210-app-chat/{spec.md,design.md}, docs/specs/211-app-chat-composer/{spec.md,design.md} -->
<!-- @see docs/specs/217-app-chat-model-selector/spec.md [FR-1] -->

- [ ] Route model-selector details out of broad chat/composer docs.

---

## Phase 2: Verification

### 2.1 Selector acceptance

<!-- files: apps/chat/src/components/model-combobox*.test.tsx, apps/chat/e2e/*.spec.ts -->
<!-- @see docs/specs/217-app-chat-model-selector/spec.md [FR-1] [FR-2] [FR-3] [FR-4] [FR-5] [FR-6] | docs/specs/217-app-chat-model-selector/design.md [DES-TEST] -->

- [ ] Re-run component tests.
- [ ] Capture Playwright screenshots for grouped selector, search, empty, and reconnecting states.
- [ ] Leave live/manual dual-auth validation open until user confirms.

---

## Cross-Reference Index

| Task | Spec Requirement                                       | Design Section                    |
| ---- | ------------------------------------------------------ | --------------------------------- |
| 0.1  | [FR-1]                                                 | [DES-OVR]                         |
| 1.1  | [FR-1], [FR-2], [FR-3], [FR-4], [FR-5], [FR-6], [FR-7] | [DES-SEG], [DES-SEARCH], [DES-UI] |
| 1.2  | [FR-1]                                                 | [DES-ARCH]                        |
| 2.1  | [FR-1], [FR-2], [FR-3], [FR-4], [FR-5], [FR-6]         | [DES-TEST]                        |

---

## Notes

- Host persistence belongs to `205-app-vscode-model-selection-state`.

---

## Work Sessions

<!-- IMPORTANT: This section MUST remain the LAST section in tasks.md. Do not add content below it. -->

| Date       | Task | Action                                                           | Files Modified                                                               | Agent | Human |
| ---------- | ---- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------- | ----- | ----- |
| 2026-06-01 | 0.1  | Created canonical model-selector spec set from fleet split plan. | this, spec.md, design.md, journal.md                                         | [x]   | [ ]   |
| 2026-06-01 | 1.1  | Completed traceability migration.                                | model-combobox.tsx, model-combobox.segments.test.tsx, model-selector.spec.ts | [x]   | [ ]   |
