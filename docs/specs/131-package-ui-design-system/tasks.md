---
afx: true
type: TASKS
status: Draft
owner: "@rixrix"
version: "1.0"
created_at: "2026-05-02T23:56:50.000Z"
updated_at: "2026-05-02T23:56:50.000Z"
tags: ["package", "ui", "design-system", "storybook", "theme"]
spec: spec.md
design: design.md
---

# Package UI Design System - Implementation Tasks

---

## Task Numbering Convention

Tasks use hierarchical numbering for cross-referencing:

- **0.x** - Pre-implementation cleanup
- **1.x** - Source reference migration
- **2.x** - Storybook/design-system setup
- **3.x** - Verification

---

## Phase 0: Pre-Implementation Cleanup

### 0.1 Confirm Design-System Scope

- [ ] Review `130-package-ui` for parent route-map updates
- [ ] Confirm whether Storybook starts package-local or repo-root

---

## Phase 1: Source Reference Migration

### 1.1 Retarget Shared Theme References

<!-- files: packages/ui/src/tokens, packages/ui/src/styles -->
<!-- @see docs/specs/131-package-ui-design-system/design.md [DES-FILES] | docs/specs/131-package-ui-design-system/spec.md [FR-1] -->

- [ ] Retarget shared UI/theme `@see` refs from retired docs
- [ ] Keep app-specific behavior in app child specs

---

## Phase 2: Storybook

### 2.1 Introduce Storybook Surface

- [ ] Add Storybook config under the agreed owner path
- [ ] Add first shared component/token stories
- [ ] Wire verification through the appropriate build/test spec

---

## Phase 3: Verification

### 3.1 Validate Routing

- [ ] Run stale-ref search for `chat-ui-theme-foundation`
- [ ] Run package UI and markdown verification

---

## Implementation Flow

```text
Scope design-system route
    ↓
Retarget shared UI refs
    ↓
Add Storybook docs/checks
    ↓
Verify package and source traceability
```

---

## Cross-Reference Index

| Task | Spec Requirement | Design Section        |
| ---- | ---------------- | --------------------- |
| 1.1  | [FR-1], [FR-3]   | [DES-FILES], [DES-UI] |
| 2.1  | [FR-2]           | [DES-UI], [DES-DEPS]  |
| 3.1  | [NFR-1], [NFR-3] | [DES-TEST]            |

---

## Notes

- This spec absorbs shared design-system material previously routed through chat theme docs.

---

## Work Sessions

<!-- IMPORTANT: This section MUST remain the LAST section in tasks.md. Do not add content below it. -->
<!-- Task execution log — append-only, updated by /afx-task pick, /afx-task code, /afx-task complete -->

| Date       | Task | Action     | Files Modified                           | Agent | Human |
| ---------- | ---- | ---------- | ---------------------------------------- | ----- | ----- |
| 2026-05-02 | 0.1  | Scaffolded | docs/specs/131-package-ui-design-system/ | [x]   | []    |
