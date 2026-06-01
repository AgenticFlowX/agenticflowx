---
afx: true
type: TASKS
status: Draft
owner: "@rixrix"
version: "1.0"
created_at: "2026-06-01T10:08:49.000Z"
updated_at: "2026-06-01T11:06:02.000Z"
tags: ["package", "shared", "provider-catalog", "providers", "models"]
spec: spec.md
design: design.md
---

# Package Provider Catalog - Implementation Tasks

## Task Numbering Convention

Tasks use hierarchical numbering. `[FR-X]` references `spec.md`, `[DES-X]` references `design.md`, and `[X.Y]` references this task file.

---

## Phase 0: Canonical Spec Setup

### 0.1 Create canonical docs

<!-- files: afx-vscode-v2/docs/specs/141-package-provider-catalog/{spec.md,design.md,tasks.md,journal.md} -->
<!-- @see docs/specs/141-package-provider-catalog/spec.md [FR-1] | docs/specs/141-package-provider-catalog/design.md [DES-OVR] -->

- [x] Create focused spec/design/tasks/journal files for provider catalog ownership.
- [ ] Validate doc structure with AFX spec/design/task checks.

---

## Phase 1: Traceability Migration

### 1.1 Retarget catalog source links

<!-- files: packages/shared/src/provider-catalog.ts, packages/shared/src/provider-catalog.test.ts -->
<!-- @see docs/specs/141-package-provider-catalog/spec.md [FR-1] [FR-2] [FR-3] [FR-4] [FR-5] [FR-6] | docs/specs/141-package-provider-catalog/design.md [DES-DATA] [DES-TEST] -->

- [x] Replace fleet-sprint `@see` links with canonical provider-catalog links.
- [x] Keep OAuth policy, Settings UI, and SDK injection references on their owning specs where applicable.

### 1.2 Parent route links

<!-- files: docs/specs/100-package-shared/{spec.md,design.md}, docs/specs/351-agent-pi/{spec.md,design.md} -->
<!-- @see docs/specs/141-package-provider-catalog/spec.md [FR-1] -->

- [ ] Route broad provider-catalog mentions from parent specs to this child zone.

---

## Phase 2: Verification

### 2.1 Provider drift check

<!-- files: packages/shared/src/provider-catalog.ts, packages/shared/src/provider-catalog.test.ts -->
<!-- @see docs/specs/141-package-provider-catalog/spec.md [FR-2] [FR-3] [FR-5] | docs/specs/141-package-provider-catalog/design.md [DES-TEST] -->

- [ ] Re-run catalog tests.
- [ ] Re-check provider ids/defaults against bundled Pi before release.

---

## Cross-Reference Index

| Task | Spec Requirement                               | Design Section        |
| ---- | ---------------------------------------------- | --------------------- |
| 0.1  | [FR-1]                                         | [DES-OVR]             |
| 1.1  | [FR-1], [FR-2], [FR-3], [FR-4], [FR-5], [FR-6] | [DES-DATA], [DES-API] |
| 1.2  | [FR-1]                                         | [DES-ARCH]            |
| 2.1  | [FR-2], [FR-3], [FR-5]                         | [DES-TEST]            |

---

## Notes

- This spec replaces provider-catalog portions of the transient fleet sprints, not OAuth storage or Settings UI.

---

## Work Sessions

<!-- IMPORTANT: This section MUST remain the LAST section in tasks.md. Do not add content below it. -->

| Date       | Task | Action                                                             | Files Modified                                         | Agent | Human |
| ---------- | ---- | ------------------------------------------------------------------ | ------------------------------------------------------ | ----- | ----- |
| 2026-06-01 | 0.1  | Created canonical provider-catalog spec set from fleet split plan. | this, spec.md, design.md, journal.md                   | [x]   | [ ]   |
| 2026-06-01 | 1.1  | Completed traceability migration.                                  | provider-catalog.ts, agent-factory.ts, secret-store.ts | [x]   | [ ]   |
