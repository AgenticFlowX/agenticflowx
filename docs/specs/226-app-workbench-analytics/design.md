---
afx: true
type: DESIGN
status: Living
owner: "@rixrix"
version: "1.0"
created_at: "2026-05-03T03:28:22.000Z"
updated_at: "2026-05-20T10:59:38.000Z"
tags: ["app", "workbench", "analytics", "metrics", "heatmap"]
spec: spec.md
---

# App Workbench Analytics - Technical Design

---

## [DES-OVR] Overview

The Analytics tab is a pure-client dashboard over Workbench state. React renders
range controls and widgets; `lib/analytics.ts` builds the typed snapshot used by
those widgets.

---

## [DES-ARCH] Architecture

```text
WorkbenchProvider
  pipeline[] + featureTasks[] + journal[] + ghostTasks
      |
      v
Analytics
  ├─ useLocalStorage("afx-analytics-range")
  ├─ buildSnapshot(...)
  ├─ AnalyticsEmptyGuide when no signals exist
  ├─ HeadlineCard
  │   └─ Sparkline
  ├─ StageBar + StageDot
  ├─ Top feature card
  └─ Heatmap
      ├─ bucketIntoWeeks
      └─ cellClass
```

---

## [DES-UI] User Interface & UX

### [DES-ANALYTICS-MOCKUP] Analytics ASCII

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Analytics overview                                             [7d][30d][90d][All] │
├──────────────────────────────────────────────────────────────────────────────┤
│ ┌ Tasks ───────┐ ┌ Sessions ───────────────┐ ┌ Streak ───────────────┐       │
│ │ 42 / 70      │ │ 18 · 9 active days      │ │ 3d · best 8d          │       │
│ │ progress bar │ │ sparkline trend         │ │ On a roll             │       │
│ └──────────────┘ └─────────────────────────┘ └───────────────────────┘       │
│ ┌ Pipeline ───────────────────────────────────────────┐ ┌ Top feature ─────┐ │
│ │ 12 features                                         │ │ feature-name     │ │
│ │ [done][build][design][specify][backlog]             │ │ Most sessions    │ │
│ │ Done 3 Build 4 Design 2 Specify 1 Backlog 2         │ │ [2 in flight]    │ │
│ └─────────────────────────────────────────────────────┘ └──────────────────┘ │
│ Activity 2026-04-04 -> 2026-05-03                                            │
│ ░░ ░▒ ▒▓ █ contribution-style heatmap by week (Mon..Sun rows)                │
│ Less ░ ▒ ▓ █ More                                                            │
└──────────────────────────────────────────────────────────────────────────────┘
```

### [DES-ANALYTICS-RANGE] Analytics Range Header

`Analytics` persists `Range` in `afx-analytics-range`, recalculates
`buildSnapshot`, and renders 7d/30d/90d/All controls with `aria-pressed`.

### [DES-ANALYTICS-HEADLINE] Headline Cards

`HeadlineCard` renders Tasks, Sessions, and Streak cards. Tasks use `Progress`;
Sessions can embed `Sparkline`; Streak color reflects active streak state.

### [DES-ANALYTICS-SPARKLINE] Sessions Sparkline

`Sparkline` turns heatmap counts into a responsive inline SVG area and polyline
with an accessible trend label.

### [DES-ANALYTICS-STAGE] Stage Breakdown

`StageBar` and `StageDot` render done/build/design/specify/backlog
distribution. `StageBar` guards zero-feature state with a muted empty bar.

### [DES-ANALYTICS-TOP-FEATURE] Top Feature Attention Badges

The top-feature card displays the most active feature in range and conditionally
shows in-flight and ghost-reference badges.

### [DES-ANALYTICS-HEATMAP] Activity Heatmap

`Heatmap`, `cellClass`, and `bucketIntoWeeks` render a Monday-first,
week-column heatmap. Pad cells are transparent, zero-activity days are muted,
and active days scale through four brand-color intensities.

### [DES-ANALYTICS-EMPTY] Analytics Empty Guide

`AnalyticsEmptyGuide` replaces the generic empty state when no pipeline/task data
exists. It uses a compact bottom-panel layout: one header/action row, short
signal chips, and a mock dashboard strip. It can send
`afxCreateSampleDocs { kind: "full-spec" }` so new workspaces can see live data.

---

## [DES-DEC] Key Decisions

| Decision          | Options Considered                 | Choice         | Rationale                                      |
| ----------------- | ---------------------------------- | -------------- | ---------------------------------------------- |
| Charting          | External chart lib, inline SVG/CSS | Inline SVG/CSS | Keeps dashboard lightweight and deterministic. |
| Range persistence | React state, local storage         | Local storage  | Preserves dashboard preference across reloads. |
| Snapshot location | React component, pure helper       | Pure helper    | Enables unit tests and future reuse.           |

---

## [DES-DATA] Data Model

`Range`, `Stage`, `HeatmapCell`, and `AnalyticsSnapshot` live in
`apps/workbench/src/lib/analytics.ts`.

---

## [DES-API] API Contracts

Analytics consumes Workbench state and sends `afxCreateSampleDocs` only from the
empty guide. Its input contract is `pipeline`, `featureTasks`, `journal`,
`ghostTasks`, and the persisted `Range`.

---

## [DES-FILES] File Structure

| File                                       | Purpose                                 |
| ------------------------------------------ | --------------------------------------- |
| `apps/workbench/src/views/analytics.tsx`   | Dashboard widgets and heatmap rendering |
| `apps/workbench/src/lib/analytics.ts`      | Pure snapshot and streak helpers        |
| `apps/workbench/src/lib/analytics.test.ts` | Snapshot/streak tests                   |

---

## [DES-DEPS] Dependencies

- `@afx/shared` for input types.
- `@afx/ui` for badges, buttons, progress, scroll area, separator.
- `225-app-workbench-pipeline` for compatible feature-stage language.

---

## [DES-SEC] Security Considerations

Analytics reads only in-memory Workbench state and local storage. It must not
send source excerpts or read files directly.

---

## [DES-ERR] Error Handling

- No pipeline and no feature tasks renders the empty guide.
- Zero totals render zero percentages.
- Empty heatmap returns no heatmap body.
- Invalid date-like values are ignored by snapshot filters.

---

## [DES-TEST] Testing Strategy

- Existing unit tests cover streaks, empty KPIs, session aggregation, top
  feature, range filtering, heatmap length/counts, up-next, and stage breakdown.
- React tests cover the empty guide; future React tests should cover range button
  state and heatmap rendering.

---

## [DES-ROLLOUT] Migration / Rollout Plan

1. Retarget analytics view/helper/test refs to this child spec.
2. Keep Impact Lens reverse-index UI out of Analytics; reserve that for `228`.
3. Add React widget tests before changing dashboard layout.

---

## [DES-ANALYTICS-LOC] Code Locator Map

| Map ID                 | Code anchor                                                    | Messages/data                         | Tests                                      |
| ---------------------- | -------------------------------------------------------------- | ------------------------------------- | ------------------------------------------ |
| `[Analytics.View]`     | `apps/workbench/src/views/analytics.tsx` `Analytics`           | `pipeline[]`, `journals[]`, `notes[]` | `apps/workbench/src/lib/analytics.test.ts` |
| `[Analytics.Empty]`    | `apps/workbench/src/views/analytics.tsx` `AnalyticsEmptyGuide` | `afxCreateSampleDocs`                 | analytics view test                        |
| `[Analytics.Snapshot]` | `apps/workbench/src/lib/analytics.ts` `buildSnapshot`          | `AnalyticsSnapshot` shape             | analytics.test.ts                          |
| `[Analytics.Heatmap]`  | `Heatmap` block in analytics.tsx                               | `HeatmapCell[]`                       | analytics.test.ts                          |

## [DES-ANALYTICS-TRACE] Functional Trace Matrix

| Requirement | Design nodes                                                                       | Code anchors                              | Verification      |
| ----------- | ---------------------------------------------------------------------------------- | ----------------------------------------- | ----------------- |
| FR-1        | `[DES-ANALYTICS-MOCKUP]`, `[DES-ANALYTICS-RANGE]`, `[DES-ANALYTICS-HEADLINE]`      | `Analytics`, range header, headline cards | analytics.test.ts |
| FR-7        | `[DES-ANALYTICS-SNAPSHOT]`, `[DES-ANALYTICS-SPARKLINE]`, `[DES-ANALYTICS-HEATMAP]` | `buildSnapshot`, sparkline, heatmap       | analytics.test.ts |
| FR-8        | `[DES-ANALYTICS-STAGE]`, `[DES-ANALYTICS-TOP-FEATURE]`                             | stage breakdown + top-feature attention   | analytics.test.ts |
| FR-9        | `[DES-ANALYTICS-EMPTY]`                                                            | `AnalyticsEmptyGuide`                     | view + e2e        |

---

## [DES-REFS] File Reference Map

| File                                       | Required @see                                                                                                                             |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/workbench/src/views/analytics.tsx`   | `spec.md [FR-1] [FR-8] [FR-9]` + `design.md [DES-ANALYTICS-RANGE] [DES-ANALYTICS-HEADLINE] [DES-ANALYTICS-HEATMAP] [DES-ANALYTICS-EMPTY]` |
| `apps/workbench/src/lib/analytics.ts`      | `spec.md [FR-7]` + `design.md [DES-ANALYTICS-SNAPSHOT]`                                                                                   |
| `apps/workbench/src/lib/analytics.test.ts` | `spec.md [FR-7]` + `design.md [DES-TEST] [DES-ANALYTICS-SNAPSHOT]`                                                                        |

### [DES-ANALYTICS-SNAPSHOT] Analytics Snapshot Helpers

`pipelineRowToStage`, `computeCurrentStreak`, `computeLongestStreak`, and
`buildSnapshot` turn pipeline rows, feature tasks, journal entries, and ghost
task results into the view model consumed by `Analytics`.
