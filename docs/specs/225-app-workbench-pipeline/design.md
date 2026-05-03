---
afx: true
type: DESIGN
status: Draft
owner: "@rixrix"
version: "1.0"
created_at: "2026-05-03T03:28:22.000Z"
updated_at: "2026-05-03T03:28:22.000Z"
tags: ["app", "workbench", "pipeline", "progress", "features"]
spec: spec.md
---

# App Workbench Pipeline - Technical Design

---

## [DES-OVR] Overview

The Pipeline tab turns `PipelineRow` data into project progress surfaces:
filters, persisted mode selection, simple summary, grouped timeline/grid cards,
and next-action links.

---

## [DES-ARCH] Architecture

```text
WorkbenchProvider pipeline[]
      |
      v
Pipeline
  ├─ search/status filters
  ├─ useLocalStorage("afx-pipeline-view-v3")
  ├─ SimplePipelineView
  │   ├─ summarizeRows
  │   └─ PipelineNextRow
  └─ GroupedPipelineView
      └─ PipelineCard

lib/pipeline.ts
  healthPct / getGroupStatus / getNextAction / groupByFeatureStatus
```

---

## [DES-UI] User Interface & UX

### [DES-PIPELINE-MOCKUP] Pipeline ASCII

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ [Search features...........] [All statuses v]             [Simple][Timeline][Grid] │
├──────────────────────────── simple overview ────────────────────────────────┤
│ Pipeline overview                                                           │
│ ┌ Features 12 ┐ ┌ Tasks 42/70 60% ┐ ┌ In flight 5 ┐ ┌ Complete 3 ┐         │
│ progress bar                                                               │
│ [In progress 3] [Ready 2] [Blocked 1] [Not started 6] [Complete 3]         │
│ Up next 6/12                                                               │
│ ┌ feature-name                                      [In progress] ┐        │
│ │ → Continue tasks                                  progress 2/5  │        │
│ └─────────────────────────────────────────────────────────────────┘        │
└──────────────────────────────────────────────────────────────────────────────┘
```

### [DES-PIPELINE-FILTERS] Pipeline Filters And Mode

`Pipeline` owns search, status filter, and persisted view mode
`afx-pipeline-view-v3`. The mode selector is a tablist with Simple, Timeline,
and Grid buttons.

### [DES-PIPELINE-SIMPLE] Simple Pipeline Overview

`SimplePipelineView` renders summary KPI tiles, total progress, per-status mini
counts, and the up-next list.

### [DES-PIPELINE-GROUPED] Grouped Timeline And Grid

`GroupedPipelineView` renders rows grouped by `GroupStatus`. Timeline mode uses
a vertical list; grid mode switches to responsive cards.

### [DES-PIPELINE-CARD] Pipeline Card And Next Row

`PipelineCard`, `PipelineNextRow`, `SummaryTile`, and `FileBadges` render
feature progress, next-action links, status badges, and available file badges.

### [DES-PIPELINE-HELPERS] Pipeline Helper Contracts

`healthPct`, `getGroupStatus`, `getNextAction`, `groupByFeatureStatus`,
`formatShortDate`, and `formatRelativeTime` are pure transforms from
`PipelineRow` into UI state.

---

## [DES-DEC] Key Decisions

| Decision     | Options Considered            | Choice          | Rationale                              |
| ------------ | ----------------------------- | --------------- | -------------------------------------- |
| Default mode | Timeline, grid, simple        | Simple          | Gives fastest bottom-panel scan.       |
| Persistence  | React state, local storage    | Local storage   | Keeps user mode choice across reloads. |
| Next action  | Static links, computed helper | Computed helper | Centralizes status-to-action policy.   |

---

## [DES-DATA] Data Model

### [DES-PIPELINE-DATA] Pipeline Data Shapes

The pipeline surface owns four shared types defined in
`packages/shared/src/workbench-types.ts`. Each declaration in that file should carry
`@see` to the matching anchor below.

| Type               | Owns                                                       | Local @see                                         |
| ------------------ | ---------------------------------------------------------- | -------------------------------------------------- |
| `PipelineRow`      | One feature in the pipeline: phase, status, counts         | `[DES-PIPELINE-DATA]` and `[DES-PIPELINE-CARD]`    |
| `TaskItemRow`      | One leaf task within a phase                               | `[DES-PIPELINE-DATA]`                              |
| `PhaseRow`         | A phase header with its task children                      | `[DES-PIPELINE-DATA]` and `[DES-PIPELINE-GROUPED]` |
| `FeatureTasksData` | Full task tree for a feature (phases + flat tasks + stats) | `[DES-PIPELINE-DATA]`                              |

`PipelineRow` comes from shared Workbench state. `GroupStatus` is UI-derived:
`in_progress`, `ready_to_build`, `complete`, `blocked`, or `not_started`.

---

## [DES-API] API Contracts

- `afxOpenFile { path, mode: "preview" }`

---

## [DES-FILES] File Structure

| File                                            | Purpose                           |
| ----------------------------------------------- | --------------------------------- |
| `apps/workbench/src/views/pipeline.tsx`         | Pipeline UI modes, filters, cards |
| `apps/workbench/src/lib/pipeline.ts`            | Pure status/action/date helpers   |
| `apps/workbench/src/hooks/use-local-storage.ts` | Persisted pipeline mode hook      |
| `apps/workbench/src/views/pipeline.test.tsx`    | Pipeline default overview test    |

---

## [DES-DEPS] Dependencies

- `@afx/shared` for `PipelineRow` and outbound protocol.
- `@afx/ui` for card, badge, button, input, select, progress, scroll area.

---

## [DES-SEC] Security Considerations

Pipeline only sends file-open requests to the host. It must not read files or
use VSCode APIs directly.

---

## [DES-ERR] Error Handling

- Empty pipeline renders scaffold guidance.
- Disabled next rows avoid sending when no path exists.
- Invalid dates in helper formatting return empty strings.

---

## [DES-TEST] Testing Strategy

- Existing React test covers simple overview default.
- Future helper tests should cover health percent, group status, next actions,
  grouping order, and date formatting.

---

## [DES-ROLLOUT] Migration / Rollout Plan

1. Retarget Pipeline source/test/helper refs to this child spec.
2. Add helper tests before changing status/action policy.

---

## [DES-PIPELINE-LOC] Code Locator Map

| Map ID               | Code anchor                                        | Messages/data          | Tests                                        |
| -------------------- | -------------------------------------------------- | ---------------------- | -------------------------------------------- |
| `[Pipeline.View]`    | `apps/workbench/src/views/pipeline.tsx` `Pipeline` | `pipeline[]`           | `apps/workbench/src/views/pipeline.test.tsx` |
| `[Pipeline.Simple]`  | `SimplePipelineView` block                         | `summarizeRows`        | pipeline.test.tsx                            |
| `[Pipeline.Grouped]` | `GroupedPipelineView` block                        | `groupByFeatureStatus` | future                                       |
| `[Pipeline.Helpers]` | `apps/workbench/src/lib/pipeline.ts`               | helpers                | future                                       |

## [DES-PIPELINE-TRACE] Functional Trace Matrix

| Requirement | Design nodes                                                             | Code anchors                                   | Verification        |
| ----------- | ------------------------------------------------------------------------ | ---------------------------------------------- | ------------------- |
| FR-1        | `[DES-PIPELINE-MOCKUP]`, `[DES-PIPELINE-DATA]`                           | `Pipeline`, `PipelineRow` shape                | pipeline.test.tsx   |
| FR-2        | `[DES-PIPELINE-FILTERS]`                                                 | search/status filter + persisted view mode     | manual              |
| FR-5        | `[DES-PIPELINE-HELPERS]`                                                 | `healthPct`, `getGroupStatus`, `getNextAction` | future helper tests |
| FR-6        | `[DES-PIPELINE-SIMPLE]`, `[DES-PIPELINE-GROUPED]`, `[DES-PIPELINE-CARD]` | view modes + cards                             | pipeline.test.tsx   |
| FR-7        | `[DES-PIPELINE-CARD]`                                                    | card render + next-action link                 | manual              |

---

## [DES-REFS] File Reference Map

| File                                            | Required @see                                                                                          |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `apps/workbench/src/views/pipeline.tsx`         | `spec.md [FR-1] [FR-6]` + `design.md [DES-PIPELINE-FILTERS] [DES-PIPELINE-SIMPLE] [DES-PIPELINE-CARD]` |
| `apps/workbench/src/lib/pipeline.ts`            | `spec.md [FR-5]` + `design.md [DES-PIPELINE-HELPERS]`                                                  |
| `apps/workbench/src/hooks/use-local-storage.ts` | `spec.md [FR-2]` + `design.md [DES-PIPELINE-FILTERS]`                                                  |
| `apps/workbench/src/views/pipeline.test.tsx`    | `spec.md [FR-3]` + `design.md [DES-TEST]`                                                              |
