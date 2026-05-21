---
afx: true
type: SPEC
status: Living
owner: "@rixrix"
version: "1.0"
created_at: "2026-05-03T03:28:22.000Z"
updated_at: "2026-05-20T09:57:03.000Z"
tags: ["app", "workbench", "analytics", "metrics", "heatmap"]
depends_on:
  ["100-package-shared", "130-package-ui", "220-app-workbench", "225-app-workbench-pipeline"]
---

# App Workbench Analytics - Product Specification

## References

- **Parent shell**: [docs/specs/220-app-workbench/spec.md](../220-app-workbench/spec.md)
- **Current implementation**: [apps/workbench/src/views/analytics.tsx](../../../apps/workbench/src/views/analytics.tsx)
- **Analytics helpers**: [apps/workbench/src/lib/analytics.ts](../../../apps/workbench/src/lib/analytics.ts)

---

## Problem Statement

The Analytics tab turns Workbench pipeline, task, journal, and ghost-reference
state into dashboard metrics. It owns range selection, KPI cards, stage
breakdowns, top-feature badges, heatmap rendering, and pure snapshot helpers,
so it needs its own Workbench child spec.

---

## User Stories

### Primary Users

Developers tracking project velocity, task completion, feature stage, and trace-health hints.

### Stories

**As a** developer
**I want** a glanceable analytics dashboard
**So that** I can see project health without manually reading tasks and journals.

**As a** coding agent
**I want** analytics helper rules documented
**So that** changes to streaks, heatmap buckets, or stage classification are precise.

---

## Requirements

### Functional Requirements

| ID   | Requirement                                                            | Priority  |
| ---- | ---------------------------------------------------------------------- | --------- |
| FR-1 | Persist and render analytics range controls for 7d/30d/90d/all         | Must Have |
| FR-2 | Render task, session, and streak headline cards                        | Must Have |
| FR-3 | Render sessions sparkline from heatmap data                            | Must Have |
| FR-4 | Render pipeline stage distribution and legend                          | Must Have |
| FR-5 | Render top feature and attention badges for in-flight/ghost references | Must Have |
| FR-6 | Render Monday-first activity heatmap with intensity buckets            | Must Have |
| FR-7 | Build snapshot metrics from pipeline, feature tasks, journal, ghosts   | Must Have |
| FR-8 | Render empty state when no analytics input data exists                 | Must Have |
| FR-9 | Teach empty/new projects with preview metrics and starter actions      | Must Have |

### Non-Functional Requirements

| ID    | Requirement           | Target                                         |
| ----- | --------------------- | ---------------------------------------------- |
| NFR-1 | Browser-safe UI       | No direct VSCode/fs/process access             |
| NFR-2 | Pure snapshot helpers | Analytics logic is testable without React      |
| NFR-3 | Compact dashboard     | Cards and heatmap fit bottom-panel constraints |
| NFR-4 | Traceability          | Each widget/helper points at a specific DES ID |

---

## Acceptance Criteria

### Dashboard

- [ ] Range buttons update persisted range and recompute snapshot.
- [ ] Headline cards render tasks, sessions, and streak states.
- [ ] Stage bar renders zero-feature muted state and nonzero segment widths.
- [ ] Heatmap rows align Monday through Sunday.

### Snapshot

- [ ] Streak helpers handle empty, isolated, and consecutive days.
- [ ] `buildSnapshot` aggregates sessions, active days, top feature, heatmap, up-next, recent journal, ghost count, and stage breakdown.

### Empty / New Project

- [ ] Empty Analytics explains which markdown signals power the dashboard.
- [ ] Empty Analytics shows a mock dashboard preview so users know what will appear.
- [ ] Empty Analytics can offer a sample SDD creation action through the Workbench bridge.

---

## Non-Goals (Out of Scope)

- Impact Lens reverse traceability implementation.
- Host-side analytics persistence.
- Charts library adoption unless dashboard complexity grows.

---

## Open Questions

| #   | Question                                            | Status | Resolution                                                                |
| --- | --------------------------------------------------- | ------ | ------------------------------------------------------------------------- |
| 1   | Should Analytics display Impact Lens issue metrics? | Open   | Route full reverse-index UI to `228`; lightweight badges may remain here. |

---

## Dependencies

- `220-app-workbench` for shell and state feed.
- `225-app-workbench-pipeline` for compatible pipeline stage semantics.
- `100-package-shared` for pipeline, feature-task, journal, and ghost-task types.
- `130-package-ui` for badges, buttons, progress, scroll area, separator.

---

## Appendix

### Agent Entry Map

| Field           | Value                                                                                                                                                                                     |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Owned surface   | Workbench Analytics tab and analytics snapshot helpers                                                                                                                                    |
| Owned files     | `apps/workbench/src/views/analytics.tsx`, `apps/workbench/src/lib/analytics.ts`, `apps/workbench/src/lib/analytics.test.ts`                                                               |
| Local anchors   | `Analytics`, `AnalyticsEmptyGuide`, `HeadlineCard`, `Sparkline`, `StageBar`, `StageDot`, `Heatmap`, `cellClass`, `bucketIntoWeeks`, `pipelineRowToStage`, `buildSnapshot`, streak helpers |
| Bridge messages | `afxCreateSampleDocs` from empty onboarding; otherwise consumes Workbench state                                                                                                           |
| Settings keys   | `afx-analytics-range` local storage key                                                                                                                                                   |
| Tests           | `apps/workbench/src/lib/analytics.test.ts`                                                                                                                                                |
| Dependencies    | `220-app-workbench`, `225-app-workbench-pipeline`, `100-package-shared`, `130-package-ui`                                                                                                 |
| Out of scope    | Impact Lens reverse index, Documents reader, Pipeline cards                                                                                                                               |
| Example prompt  | "Change heatmap intensity buckets; start at 226-app-workbench-analytics."                                                                                                                 |
