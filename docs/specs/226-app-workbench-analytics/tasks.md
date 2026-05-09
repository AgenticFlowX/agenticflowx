---
afx: true
type: TASKS
status: Living
owner: "@rixrix"
version: "1.0"
created_at: "2026-05-03T03:28:22.000Z"
updated_at: "2026-05-09T12:21:59.000Z"
tags: ["app", "workbench", "analytics", "metrics", "heatmap"]
spec: spec.md
design: design.md
---

# App Workbench Analytics - Implementation Tasks

---

## Task Numbering Convention

Tasks use hierarchical numbering and link to spec/design IDs.

---

## Phase 0: Traceability Migration

### 0.1 Retarget Analytics Anchors

<!-- files: apps/workbench/src/views/analytics.tsx, apps/workbench/src/lib/analytics.ts, apps/workbench/src/lib/analytics.test.ts -->
<!-- @see docs/specs/226-app-workbench-analytics/design.md [DES-REFS] | docs/specs/226-app-workbench-analytics/spec.md [FR-1] [FR-7] -->

- [ ] Point Analytics view/helper/test refs at this child spec.
- [ ] Add widget/helper refs for range, headline, sparkline, stage, top feature, heatmap, and snapshot.

---

## Phase 1: Widget Coverage

### 1.1 Dashboard Rendering Tests

- [ ] Add React tests for range state, headline cards, stage bar, and heatmap.

---

## Implementation Flow

```
Phase 0: Traceability Migration
    ↓
Phase 1: Widget Coverage
```

---

## Cross-Reference Index

| Task | Spec Requirement | Design Section                                    |
| ---- | ---------------- | ------------------------------------------------- |
| 0.1  | [FR-1], [FR-7]   | [DES-REFS]                                        |
| 1.1  | [FR-2], [FR-6]   | [DES-ANALYTICS-HEADLINE], [DES-ANALYTICS-HEATMAP] |

---

## Notes

- Impact Lens owns reverse traceability; Analytics may show only lightweight trace-health badges.

---

## Work Sessions

<!-- IMPORTANT: This section MUST remain the LAST section in tasks.md. Do not add content below it. -->

| Date | Task | Action | Files Modified | Agent | Human |
| ---- | ---- | ------ | -------------- | ----- | ----- |
