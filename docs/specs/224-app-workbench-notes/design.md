---
afx: true
type: DESIGN
status: Approved
owner: "@rixrix"
version: "1.0"
created_at: "2026-05-03T03:28:22.000Z"
updated_at: "2026-05-09T12:21:59.000Z"
tags: ["app", "workbench", "notes", "capture", "markdown"]
spec: spec.md
---

# App Workbench Notes - Technical Design

---

## [DES-OVR] Overview

The Notes tab is a split-pane quick-capture surface. It owns the left capture
pane, right timeline/search/filter pane, note item editing, timestamp display,
and outbound note messages.

---

## [DES-ARCH] Architecture

```text
WorkbenchProvider notes[]
      |
      v
Notes
  ├─ capture pane
  │   ├─ textarea
  │   └─ send(afxAppendNote)
  └─ timeline pane
      ├─ search/date filters
      ├─ groupByDate(filtered)
      └─ DateSection
          └─ NoteItem
              ├─ MinimalMarkdown
              ├─ send(afxEditNote)
              └─ send(afxDeleteNote)
```

---

## [DES-UI] User Interface & UX

### [DES-NOTES-MOCKUP] Notes ASCII

```text
┌──────────────────────── Capture ───────────────────────┬──────────────────────── notes.md timeline ───────────────────────┐
│ .afx/notes.md                                           │ [timeline] 12/18  [search notes........] [All][Today][Week][Month] │
│                                                         │ [Open in editor] [Open in preview]                                  │
│ ┌─────────────────────────────────────────────────────┐ │                                                                    │
│ │ Quick note…                                         │ │ Today                                      May 3, 2026        3   │
│ │ Enter to save, Shift+Enter for newline              │ │  ├─ 1:14:15 PM · today                                           │
│ │ Markdown supported                                  │ │  │  Markdown rendered note body                                   │
│ └─────────────────────────────────────────────────────┘ │  │  [hover/focus: edit] [delete]                                  │
│ [Save]                                                  │  └─ 11:02:08 AM · today                                          │
│                                                         │ Yesterday                                  May 2, 2026        4   │
│ 18 notes · 5 days                                      │  └─ timestamped notes grouped newest-first                       │
└─────────────────────────────────────────────────────────┴────────────────────────────────────────────────────────────────────┘
```

### [DES-NOTES-CAPTURE] Capture Pane

`Notes` owns the left `ResizablePanel`, textarea focus affordance, Enter vs
Shift+Enter policy, disabled save button, footer counts, and outbound
`afxAppendNote { text }` message.

### [DES-NOTES-FILTERS] Timeline Filters

The timeline toolbar owns search, date filter buttons, visible count, and
`OpenActions`. Filtering combines text match with date windows from
`getDateRange`.

### [DES-NOTES-TIMELINE] Grouped Timeline

`DateSection` renders sticky headers and note lists. `groupByDate` sorts groups
newest-first and sorts notes inside each date by timestamp descending.

### [DES-NOTES-ITEM] Note Item Editing

`NoteItem` renders markdown content, hover/focus edit/delete actions, edit mode,
Cmd/Ctrl+Enter save, and Escape cancel.

### [DES-NOTES-TIME] Note Time Formatting

`humanizeTimestamp`, `relativeTimestamp`, `formatClock`, `parseDate`, and
`startOfDay` produce deterministic display labels and safe fallbacks.

---

## [DES-DEC] Key Decisions

| Decision      | Options Considered    | Choice            | Rationale                                    |
| ------------- | --------------------- | ----------------- | -------------------------------------------- |
| Save shortcut | Enter, Cmd/Ctrl+Enter | Enter for capture | Quick notes should be one-keystroke capture. |
| Edit shortcut | Enter, Cmd/Ctrl+Enter | Cmd/Ctrl+Enter    | Avoid accidental multiline edit saves.       |
| Rendering     | Plain text, markdown  | Markdown          | Notes often carry lists, code, and headings. |

---

## [DES-DATA] Data Model

`QuickNote` comes from shared Workbench state. UI-local `DateGroup` groups notes
by date label, short label, and sorted notes.

---

## [DES-API] API Contracts

- `afxAppendNote { text }`
- `afxEditNote { timestamp, text }`
- `afxDeleteNote { timestamp }`
- `afxOpenFile { path, mode }`

---

## [DES-FILES] File Structure

| File                                         | Purpose                                             |
| -------------------------------------------- | --------------------------------------------------- |
| `apps/workbench/src/views/notes.tsx`         | Notes capture, timeline, item editing, time helpers |
| `apps/workbench/src/views/notes.test.tsx`    | Timestamp and date-filter behavior                  |
| `apps/workbench/src/lib/markdown-render.tsx` | Shared markdown preview, owned by Documents spec    |
| `apps/workbench/src/index.css`               | Local capture input/save edge styling               |

---

## [DES-DEPS] Dependencies

- `@afx/shared` for `QuickNote`.
- `@afx/ui` for panes, textarea, input, buttons, empty state, scroll area.
- `222-app-workbench-documents` for `MinimalMarkdown`.

---

## [DES-SEC] Security Considerations

The Notes tab sends text and timestamps through host messages. It must not
import VSCode or filesystem APIs.

---

## [DES-ERR] Error Handling

- Empty capture text does not send.
- Empty notes render onboarding empty state.
- Search/date no-match renders a simple no-match message.
- Invalid timestamps display fallback strings.

---

## [DES-TEST] Testing Strategy

- Existing tests cover deterministic seconds display and recent-note filtering.
- Future tests should cover save shortcut, edit shortcut, and markdown rendering.

---

## [DES-ROLLOUT] Migration / Rollout Plan

1. Retarget `notes.tsx` and `notes.test.tsx` to this child spec.
2. Keep shared markdown rendering in `222-app-workbench-documents`.
3. Add keyboard interaction tests before changing shortcut policy.

---

## [DES-NOTES-VIEW-LOC] Code Locator Map

| Map ID                | Code anchor                                                | Messages/data                               | Tests  |
| --------------------- | ---------------------------------------------------------- | ------------------------------------------- | ------ |
| `[NotesView.View]`    | `apps/workbench/src/views/notes.tsx` `Notes`               | `notes[]`, `afxAppendNote`                  | future |
| `[NotesView.Capture]` | `apps/workbench/src/views/notes.tsx` capture pane          | `afxAppendNote`                             | future |
| `[NotesView.Item]`    | `apps/workbench/src/views/notes.tsx` `NoteItem` row + edit | `QuickNote`, `afxEditNote`, `afxDeleteNote` | future |

## [DES-NOTES-VIEW-TRACE] Functional Trace Matrix

| Requirement | Design nodes                                | Code anchors                    | Verification |
| ----------- | ------------------------------------------- | ------------------------------- | ------------ |
| FR-1        | `[DES-NOTES-MOCKUP]`, `[DES-NOTES-CAPTURE]` | `Notes` view, capture pane      | manual       |
| FR-7        | `[DES-NOTES-TIMELINE]`, `[DES-NOTES-ITEM]`  | timeline render + edit-in-place | future       |

---

## [DES-REFS] File Reference Map

| File                                      | Required @see                                                                                                    |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `apps/workbench/src/views/notes.tsx`      | `spec.md [FR-1] [FR-7]` + `design.md [DES-NOTES-CAPTURE] [DES-NOTES-TIMELINE] [DES-NOTES-ITEM] [DES-NOTES-TIME]` |
| `apps/workbench/src/views/notes.test.tsx` | `spec.md [FR-3] [FR-7]` + `design.md [DES-TEST] [DES-NOTES-TIME]`                                                |
| `apps/workbench/src/index.css`            | `design.md [DES-NOTES-CAPTURE]`                                                                                  |
