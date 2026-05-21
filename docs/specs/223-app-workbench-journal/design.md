---
afx: true
type: DESIGN
status: Living
owner: "@rixrix"
version: "1.0"
created_at: "2026-05-03T03:28:22.000Z"
updated_at: "2026-05-20T12:26:43.000Z"
tags: ["app", "workbench", "journal", "sessions", "markdown"]
spec: spec.md
---

# App Workbench Journal - Technical Design

---

## [DES-OVR] Overview

The Journal tab is a two-pane session reader. It filters and groups session
entries on the left, then fetches and renders selected markdown content on the
right with status metadata, summary, key decisions, and context before the raw
captured session body.

---

## [DES-ARCH] Architecture

```text
WorkbenchProvider journal[]
      |
      v
Journal
  ├─ JournalEmptyGuide when no entries exist
  ├─ toolbar filters: time/search/status
  ├─ groupByDate(filtered)
  ├─ JournalCard list
  └─ PreviewPanel
      ├─ send(afxFetchDocContent)
      ├─ workbenchOn(afxDocContent)
      ├─ trimRedundantHeader
      └─ MinimalMarkdown
```

---

## [DES-UI] User Interface & UX

### [DES-JOURNAL-MOCKUP] Journal ASCII

```text
┌──────────────────────── filters ────────────────────────────────────────────────────────────────────────┐
│ [Today][Week][Month][Year][All] [Search.................] [All status v]                               │
│ 14 of 22 · 7 features · 2 blocked · 6 active                 Auto-written by skills · /afx-session log │
├──────────────────────── timeline ───────────────────────╂──────────────────────── preview ─────────────┤
│ Today                                      May 3       4 │ active AUTH-D001 · feature-name      [Open] │
│  ● AUTH-D001 feature-name         2d                    │ Session title                              │
│    Decision captured with short context                  │ [decision chip] [decision chip]           │
│  ● AUTH-D002 feature-name                               │ Summary paragraph                          │
│ Yesterday                                  May 2       3 │ Rendered markdown body with redundant      │
│  ● ...                                                   │ header trimmed                             │
└─────────────────────────────────────────────────────────┴───────────────────────────────────────────────┘
```

### [DES-JOURNAL-FILTERS] Journal Filters

`Journal` owns time chips, search input, status select, visible counts, feature
counts, blocked/active counts, and the auto-written label.

### [DES-JOURNAL-CARD] Journal Timeline Card

`JournalCard` renders status dot/color, session id, feature slug, decision
count, title, and context/summary preview. When a decision exists, the card
surfaces the first decision instead of burying it behind generic context.
Selection updates preview state.

The card header uses non-wrapping IDs/status chips and truncates long feature
paths so dense session lists do not break into awkward stacked glyphs.

### [DES-JOURNAL-PREVIEW] Journal Preview Pane

`PreviewPanel` fetches entry markdown, listens for matching content, renders
status metadata, `OpenActions`, "what mattered" summary, key decisions, context
facts, and the sanitized `MinimalMarkdown` captured body. The right pane should
read like a session brief first and a transcript second.

Timeline and preview live in a horizontal `ResizablePanelGroup`. The splitter is
visible and keyboard/focus discoverable so users can widen the timeline for
triage or widen the preview for deep reading in a resized bottom panel.

### [DES-JOURNAL-TIME] Journal Time And Header Helpers

`isInTimeRange`, `formatDateHeader`, `formatShortDate`, `groupByDate`, and
`trimRedundantHeader` keep filtering, grouping, and preview content stable.

### [DES-JOURNAL-EMPTY] Journal Empty Guide

`JournalEmptyGuide` replaces the generic empty state for new projects. It uses a
compact bottom-panel layout with command actions in the header, short command
cards, and a mock timeline strip. It sends `afxOpenChatCommand` for
`/afx-session log` or `/afx-session note` so users can start from Chat.

---

## [DES-DEC] Key Decisions

| Decision          | Options Considered                  | Choice          | Rationale                                                    |
| ----------------- | ----------------------------------- | --------------- | ------------------------------------------------------------ |
| Preview fetch     | Preload all entries, fetch selected | Fetch selected  | Keeps initial payload compact.                               |
| Feature filtering | Dedicated select, search            | Search          | Current UI stays compact while still matching feature names. |
| Markdown body     | Raw content, trimmed content        | Trimmed content | Captured journals often duplicate title/date headers.        |

---

## [DES-DATA] Data Model

### [DES-JOURNAL-DATA] Journal Data Shapes

The journal surface owns one shared type defined in
`packages/shared/src/workbench-types.ts`. Its declaration should carry `@see` to the
anchor below.

| Type           | Owns                                                                | Local @see                                    |
| -------------- | ------------------------------------------------------------------- | --------------------------------------------- |
| `JournalEntry` | One journal record: feature, file path, timestamps, status, excerpt | `[DES-JOURNAL-DATA]` and `[DES-JOURNAL-CARD]` |

`JournalEntry` comes from shared Workbench state. UI-local filter state includes
`TimeFilter`, search text, status filter, and selected entry.

---

## [DES-API] API Contracts

- `afxFetchDocContent { filePath }`
- `afxDocContent { filePath, content }`
- `afxOpenFile { path, mode, line? }`
- `afxOpenChatCommand { command, mode }`

---

## [DES-FILES] File Structure

| File                                         | Purpose                                          |
| -------------------------------------------- | ------------------------------------------------ |
| `apps/workbench/src/views/journal.tsx`       | Journal filters, cards, preview, helpers         |
| `apps/workbench/src/lib/markdown-render.tsx` | Shared markdown preview, owned by Documents spec |

---

## [DES-DEPS] Dependencies

- `@afx/shared` for `JournalEntry`.
- `@afx/ui` for input, select, badges, toggles, scroll areas.
- `222-app-workbench-documents` for `MinimalMarkdown`.

---

## [DES-SEC] Security Considerations

The Journal tab only requests host-owned content and opens files through typed
messages. It must not read local files directly.

---

## [DES-ERR] Error Handling

- Empty journal renders onboarding copy.
- No matches render a compact no-discussions message.
- No selection renders a dashed preview empty state.
- Loading content renders inline placeholder text.
- Empty Journal renders command starters and a mock timeline preview.

---

## [DES-TEST] Testing Strategy

- Tests cover empty guide command actions, decision-first selected entry
  rendering, content fetch, and redundant header trimming. Future tests cover
  time filtering and grouping edge cases.
- Trace validation for `Journal`, `JournalCard`, `PreviewPanel`, and helper IDs.

---

## [DES-ROLLOUT] Migration / Rollout Plan

1. Retarget `journal.tsx` from `220-app-workbench` to this child spec.
2. Add focused helper tests before changing session parsing or feature filters.

---

## [DES-JOURNAL-LOC] Code Locator Map

| Map ID              | Code anchor                                                | Messages/data        | Tests                    |
| ------------------- | ---------------------------------------------------------- | -------------------- | ------------------------ |
| `[Journal.View]`    | `apps/workbench/src/views/journal.tsx` `Journal`           | `journals[]`         | future journal view test |
| `[Journal.Empty]`   | `apps/workbench/src/views/journal.tsx` `JournalEmptyGuide` | `afxOpenChatCommand` | journal view test        |
| `[Journal.Card]`    | `apps/workbench/src/views/journal.tsx` `JournalCard`       | `JournalEntry`       | future                   |
| `[Journal.Helpers]` | `apps/workbench/src/lib/journal.ts`                        | filter helpers       | future                   |

## [DES-JOURNAL-TRACE] Functional Trace Matrix

| Requirement | Design nodes                                  | Code anchors                         | Verification |
| ----------- | --------------------------------------------- | ------------------------------------ | ------------ |
| FR-1        | `[DES-JOURNAL-MOCKUP]`, `[DES-JOURNAL-DATA]`  | `Journal` view, `JournalEntry` shape | manual       |
| FR-7        | `[DES-JOURNAL-FILTERS]`, `[DES-JOURNAL-TIME]` | filters + time formatting            | future       |
| FR-8        | `[DES-JOURNAL-EMPTY]`                         | `JournalEmptyGuide`                  | view + e2e   |
| FR-9        | `[DES-JOURNAL-CARD]`, `[DES-JOURNAL-PREVIEW]` | `JournalCard`, `PreviewPanel`        | unit + e2e   |

---

## [DES-REFS] File Reference Map

| File                                   | Required @see                                                                                                                                      |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/workbench/src/views/journal.tsx` | `spec.md [FR-1] [FR-5] [FR-8]` + `design.md [DES-JOURNAL-FILTERS] [DES-JOURNAL-CARD] [DES-JOURNAL-PREVIEW] [DES-JOURNAL-TIME] [DES-JOURNAL-EMPTY]` |
