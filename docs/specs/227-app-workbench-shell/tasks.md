---
afx: true
type: TASKS
status: Living
owner: "@rixrix"
version: "1.0"
created_at: "2026-05-03T03:28:22.000Z"
updated_at: "2026-05-09T12:21:59.000Z"
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

- [ ] Point shell/state/bridge/feature-tab refs at this child spec.
- [ ] Keep child tab internals pointed at `221` through `228`.

---

## Phase 1: Impact Lens Slot

### 1.1 Add Future Impact Lens Tab

- [ ] Add shell tab routing after `228-app-workbench-impact-lens` is approved.

---

## Implementation Flow

```
Phase 0: Traceability Migration
    ↓
Phase 1: Impact Lens Slot
```

---

## Cross-Reference Index

| Task | Spec Requirement | Design Section   |
| ---- | ---------------- | ---------------- |
| 0.1  | [FR-1], [FR-8]   | [DES-REFS]       |
| 1.1  | [FR-2]           | [DES-SHELL-TABS] |

---

## Notes

- This is the Workbench shell, not every Workbench child surface.

---

## Work Sessions

<!-- IMPORTANT: This section MUST remain the LAST section in tasks.md. Do not add content below it. -->

| Date | Task | Action | Files Modified | Agent | Human |
| ---- | ---- | ------ | -------------- | ----- | ----- |
