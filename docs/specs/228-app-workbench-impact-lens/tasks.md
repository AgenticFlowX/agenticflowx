---
afx: true
type: TASKS
owner: "@rixrix"
version: "0.2"
created_at: "2026-05-03T03:28:22.000Z"
updated_at: "2026-07-19T03:39:36.000Z"
tags:
  [
    "app",
    "workbench",
    "impact-lens",
    "traceability",
    "intent-ledger",
    "read-only",
    "canvas-projection",
  ]
spec: spec.md
design: design.md
---

# App Workbench Impact Lens - Implementation Tasks

---

## Task Numbering Convention

Tasks use hierarchical numbering and link to spec/design IDs.

---

## Phase 0: Graduation Prep

### 0.1 Promote Sprint Brief

<!-- files: docs/specs/228-app-workbench-impact-lens/spec.md, docs/specs/228-app-workbench-impact-lens/design.md -->
<!-- @see docs/specs/228-app-workbench-impact-lens/design.md [DES-ROLLOUT] | docs/specs/228-app-workbench-impact-lens/spec.md [FR-1] -->

- [ ] Compare upstream sprint brief with current repo state.
- [ ] Promote final MVP requirements into this folder before code work.

---

## Phase 1: MVP Implementation

### 1.1 Impact Lens Surface

- [ ] Add typed payloads, host index feed, Workbench tab, and verification action.

---

## Phase 2: Read-Only Canvas Projection Boundary

### 2.1 Reuse Projection Without Writable Ownership

<!-- files: apps/workbench/src/components/impact/impact-graph-projection.tsx, apps/workbench/src/components/impact/impact-graph-projection.test.tsx, apps/workbench/src/views/impact-lens.tsx -->
<!-- @see docs/specs/228-app-workbench-impact-lens/spec.md [FR-9] | docs/specs/228-app-workbench-impact-lens/design.md [DES-IMPACT-CANVAS-BOUNDARY] -->

- [ ] After the Canvas projection API stabilizes, adapt computed Impact data into read-only nodes/edges with local selection/viewport only, retain the accessible list fallback, and prove no Canvas/dependency mutation or AFX action path is reachable.

---

## Implementation Flow

```
Phase 0: Graduation Prep
    ↓
Phase 1: MVP Implementation
    ↓
Phase 2: Optional read-only Canvas projection reuse
```

---

## Cross-Reference Index

| Task | Spec Requirement | Design Section                           |
| ---- | ---------------- | ---------------------------------------- |
| 0.1  | [FR-1]           | [DES-ROLLOUT]                            |
| 1.1  | [FR-1], [FR-8]   | [DES-IMPACT-MOCKUP], [DES-IMPACT-STATES] |

| Task | Spec Requirement | Design Section               |
| ---- | ---------------- | ---------------------------- |
| 2.1  | [FR-9]           | [DES-IMPACT-CANVAS-BOUNDARY] |

---

## Notes

- This folder is the Workbench landing zone for Impact Lens.

---

## Work Sessions

<!-- IMPORTANT: This section MUST remain the LAST section in tasks.md. Do not add content below it. -->

| Date | Task | Action | Files Modified | Agent | Human |
| ---- | ---- | ------ | -------------- | ----- | ----- |
