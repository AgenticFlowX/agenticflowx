---
afx: true
type: SPEC
status: Approved
owner: "@rixrix"
version: "1.0"
created_at: "2026-05-03T03:28:22.000Z"
updated_at: "2026-05-09T12:21:59.000Z"
tags: ["app", "workbench", "pipeline", "progress", "features"]
depends_on: ["100-package-shared", "130-package-ui", "220-app-workbench"]
---

# App Workbench Pipeline - Product Specification

## References

- **Parent shell**: [docs/specs/220-app-workbench/spec.md](../220-app-workbench/spec.md)
- **Current implementation**: [apps/workbench/src/views/pipeline.tsx](../../../apps/workbench/src/views/pipeline.tsx)
- **Pipeline helpers**: [apps/workbench/src/lib/pipeline.ts](../../../apps/workbench/src/lib/pipeline.ts)

---

## Problem Statement

The Pipeline tab converts feature/task/spec status into a compact progress
surface. It owns modes, filters, grouping, next-action routing, and pure
`PipelineRow` helpers, so it needs its own child spec for future surgical work.

---

## User Stories

### Primary Users

Developers tracking feature readiness and progress from the bottom panel.

### Stories

**As a** developer
**I want** a simple project pipeline overview and up-next list
**So that** I can choose the next spec/task action without scanning folders.

**As a** coding agent
**I want** pipeline helper rules documented
**So that** changes to grouping or next action labels are traceable.

---

## Requirements

### Functional Requirements

| ID   | Requirement                                                | Priority  |
| ---- | ---------------------------------------------------------- | --------- |
| FR-1 | Render pipeline rows with search and status filters        | Must Have |
| FR-2 | Persist selected pipeline mode                             | Must Have |
| FR-3 | Render simple overview with KPI tiles and progress         | Must Have |
| FR-4 | Render grouped timeline/grid modes                         | Must Have |
| FR-5 | Compute health percentage, group status, and next action   | Must Have |
| FR-6 | Open next-action files through Workbench outbound messages | Must Have |
| FR-7 | Render empty state when no features exist                  | Must Have |

### Non-Functional Requirements

| ID    | Requirement               | Target                                         |
| ----- | ------------------------- | ---------------------------------------------- |
| NFR-1 | Browser-safe architecture | No direct VSCode/fs/process access             |
| NFR-2 | Pure helper behavior      | Status and action helpers are deterministic    |
| NFR-3 | Compact display           | Simple mode is readable in the bottom panel    |
| NFR-4 | Traceability              | View and helper refs use pipeline-specific IDs |

---

## Acceptance Criteria

### Modes And Filters

- [ ] Search filters by feature name.
- [ ] Status filter uses `GroupStatus`.
- [ ] Simple, Timeline, and Grid modes are available and persisted.

### Next Actions

- [ ] Next action labels route to spec/design/tasks paths.
- [ ] Clicking an actionable row sends `afxOpenFile` in preview mode.
- [ ] Complete rows display complete status without breaking file badges.

---

## Non-Goals (Out of Scope)

- Kanban board editing, owned by `221-app-workbench-board`.
- Analytics trends, owned by `226-app-workbench-analytics`.
- Host parsing of tasks/spec files, owned by parent/VSCode data services.

---

## Open Questions

| #   | Question                                                | Status | Resolution                                                                  |
| --- | ------------------------------------------------------- | ------ | --------------------------------------------------------------------------- |
| 1   | Should grouped timeline have a true timeline connector? | Open   | Current grouped list is sufficient until visual timeline work is requested. |

---

## Dependencies

- `220-app-workbench` for pipeline data and shell.
- `100-package-shared` for `PipelineRow` and outbound messages.
- `130-package-ui` for cards, buttons, badges, progress, inputs, selects.

---

## Appendix

### Agent Entry Map

| Field           | Value                                                                                                                                                                                                            |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Owned surface   | Workbench Pipeline tab and pipeline helper rules                                                                                                                                                                 |
| Owned files     | `apps/workbench/src/views/pipeline.tsx`, `apps/workbench/src/lib/pipeline.ts`, `apps/workbench/src/hooks/use-local-storage.ts`, `apps/workbench/src/views/pipeline.test.tsx`                                     |
| Local anchors   | `Pipeline`, `SimplePipelineView`, `GroupedPipelineView`, `PipelineCard`, `PipelineNextRow`, `SummaryTile`, `FileBadges`, `summarizeRows`, `healthPct`, `getGroupStatus`, `getNextAction`, `groupByFeatureStatus` |
| Bridge messages | `afxOpenFile`                                                                                                                                                                                                    |
| Settings keys   | `afx-pipeline-view-v3` local storage key                                                                                                                                                                         |
| Tests           | `apps/workbench/src/views/pipeline.test.tsx`, future `lib/pipeline.test.ts`                                                                                                                                      |
| Dependencies    | `220-app-workbench`, `100-package-shared`, `130-package-ui`                                                                                                                                                      |
| Out of scope    | Analytics trends, board Kanban editing                                                                                                                                                                           |
| Example prompt  | "Change pipeline next-action ordering; start at 225-app-workbench-pipeline."                                                                                                                                     |
