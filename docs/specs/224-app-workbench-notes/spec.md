---
afx: true
type: SPEC
status: Living
owner: "@rixrix"
version: "1.1"
created_at: "2026-05-03T03:28:22.000Z"
updated_at: "2026-07-19T03:16:29.000Z"
tags: ["app", "workbench", "notes", "capture", "markdown", "realtime", "multi-root"]
depends_on:
  [
    "100-package-shared",
    "130-package-ui",
    "220-app-workbench",
    "222-app-workbench-documents",
    "227-app-workbench-shell",
  ]
---

# App Workbench Notes - Product Specification

## References

- **Parent shell**: [docs/specs/220-app-workbench/spec.md](../220-app-workbench/spec.md)
- **Current implementation**: [apps/workbench/src/views/notes.tsx](../../../apps/workbench/src/views/notes.tsx)
- **Markdown preview owner**: [docs/specs/222-app-workbench-documents/design.md](../222-app-workbench-documents/design.md)

---

## Problem Statement

The Workbench Notes tab combines quick capture, markdown preview, timeline
grouping, search, date filters, and edit/delete actions. This is a distinct
bottom-panel surface with its own keyboard policy and bridge messages, so it
needs its own child spec instead of sharing the broad Workbench umbrella.

---

## User Stories

### Primary Users

Developers and agents recording lightweight context during spec-driven work.

### Stories

**As a** developer
**I want** to capture quick timestamped notes with Enter
**So that** important context is saved without leaving the bottom panel.

**As a** maintainer
**I want** note timeline/edit/time behavior documented at code level
**So that** future changes can target the exact helper or component.

**As a** developer editing `.afx/notes.md` manually
**I want** the timeline to reflect saved and unsaved editor changes in real time
**So that** Workbench, Chat, Canvas promotion, and the source editor never drift or overwrite one another.

---

## Requirements

### Functional Requirements

| ID    | Requirement                                                                                                                                                                                | Priority    |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------- |
| FR-1  | Render a persistent capture pane with markdown-enabled textarea                                                                                                                            | Must Have   |
| FR-2  | Save notes with Enter and allow newline with Shift+Enter                                                                                                                                   | Must Have   |
| FR-3  | Search and date-filter existing notes                                                                                                                                                      | Must Have   |
| FR-4  | Group notes by date and sort newest-first                                                                                                                                                  | Must Have   |
| FR-5  | Render note bodies as markdown                                                                                                                                                             | Must Have   |
| FR-6  | Edit and delete existing notes through host messages                                                                                                                                       | Must Have   |
| FR-7  | Render deterministic timestamps with seconds and relative labels                                                                                                                           | Must Have   |
| FR-8  | Explain fleeting-note sources and empty/new-project workflows                                                                                                                              | Must Have   |
| FR-9  | Render saved notes with subtle paper-like edges for reading                                                                                                                                | Should Have |
| FR-10 | Route capture, edit, checkbox, and delete mutations to the exact displayed notes source using workspace-root identity and a full stable note identity rather than a time-only lookup       | Must Have   |
| FR-11 | Update the timeline from saved, externally written, and unsaved open-editor changes; automatically reconcile clean state and show conflict/retry behavior for locally pending edits        | Must Have   |
| FR-12 | Preserve multiline Markdown, arbitrary headings, legacy inline notes, and unrelated content during edit/delete; remove only the selected note and clean empty date sections safely         | Must Have   |
| FR-13 | Keep capture/edit text until an acknowledged success, expose pending/error/retry states, and serialize competing mutations from Workbench, Chat, Canvas, and editor actions per notes file | Must Have   |

### Non-Functional Requirements

| ID    | Requirement               | Target                                                                                                                              |
| ----- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| NFR-1 | Browser-safe architecture | No direct VSCode/fs/process access                                                                                                  |
| NFR-2 | Keyboard clarity          | Enter/Shift+Enter and edit shortcuts documented                                                                                     |
| NFR-3 | Deterministic time labels | Invalid timestamps degrade safely                                                                                                   |
| NFR-4 | Traceability              | Capture, timeline, item, and time helpers linked                                                                                    |
| NFR-5 | Data safety               | Full source identity, revision-protected acknowledged writes, no time-only ambiguity, and no silent loss on host or editor conflict |
| NFR-6 | Live-update latency       | Unsaved editor changes appear within 250 ms after typing pauses; saved/external changes appear within 150 ms on local filesystems   |
| NFR-7 | Responsive accessibility  | Capture/timeline stack or collapse below 720 px; all actions remain keyboard-reachable without clipped controls at 360 px           |

---

## Acceptance Criteria

### Capture

- [ ] Empty textarea cannot save.
- [ ] Enter saves trimmed note text.
- [ ] Shift+Enter inserts a newline.
- [ ] Footer shows total notes and unique day count.

### Timeline

- [ ] Search and date filters combine.
- [ ] Date headers are sticky and newest-first.
- [ ] Edit supports Cmd/Ctrl+Enter save and Escape cancel.
- [ ] Delete sends the notes source path, stable note identity, request ID, and expected revision.
- [ ] Capture text clears and edit mode closes only after the matching host success; errors retain the user's text and expose retry.
- [ ] A displayed nested or second-root notes file receives every mutation and watcher update; no operation falls back silently to the first workspace root.
- [ ] Notes-only workspaces load and update even when no `docs/` tree exists.
- [ ] Saved, externally written, and unsaved editor changes refresh the clean timeline without reopening it; pending local mutations produce an explicit conflict.
- [ ] Editing or deleting a section note uses full date/time/source identity and preserves Markdown headings, multiline bodies, legacy formats, and unrelated notes.

### Empty / New Project

- [ ] Empty Notes explains that notes are fleeting, local, and stored in `.afx/notes.md`.
- [ ] Empty Notes explains that users can capture from this pane, Chat save-note flows, or IDE right-click Save to Notes.
- [ ] Empty Notes shows a mock note stream so users know what saved notes will look like.
- [ ] Saved note cards use readable markdown rendering with a subtle paper edge/accent.

---

## Non-Goals (Out of Scope)

- Chat composer note capture shortcuts, which belong to `215-app-chat-notes`.
- Rich note tagging, backlinks, or notebooks.
- Direct file writes from the webview.
- Multi-user network collaboration or presence; local/editor/external file synchronization is required.

---

## Open Questions

| #   | Question                                        | Status | Resolution                             |
| --- | ----------------------------------------------- | ------ | -------------------------------------- |
| 1   | Should Notes support tag filtering?             | Open   | Defer until note schema supports tags. |
| 2   | Should note edit history be preserved visually? | Open   | Host/source format decision first.     |

---

## Dependencies

- `220-app-workbench` for shell and state feed.
- `222-app-workbench-documents` for `MinimalMarkdown`.
- `100-package-shared` for `QuickNote`.
- `130-package-ui` for textarea, inputs, buttons, resizable panes, empty states.
- `227-app-workbench-shell` for live document overlays, revisioned mutations, multi-root routing, and latest-wins refresh coordination.

---

## Appendix

### Agent Entry Map

| Field           | Value                                                                                                                                      |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Owned surface   | Workbench Notes tab                                                                                                                        |
| Owned files     | `apps/workbench/src/views/notes.tsx`, `apps/workbench/src/views/notes.test.tsx`                                                            |
| Local anchors   | `Notes`, `NotesEmptyGuide`, `DateSection`, `NoteItem`, `groupByDate`, `humanizeTimestamp`, `relativeTimestamp`, `formatClock`, `parseDate` |
| Bridge messages | `afxAppendNote`, `afxEditNote`, `afxDeleteNote`, `afxOpenFile`                                                                             |
| Settings keys   | None                                                                                                                                       |
| Tests           | `apps/workbench/src/views/notes.test.tsx`                                                                                                  |
| Dependencies    | `220-app-workbench`, `222-app-workbench-documents`, `100-package-shared`, `130-package-ui`                                                 |
| Out of scope    | Chat composer notes shortcut, documents reader tree                                                                                        |
| Example prompt  | "Change the Notes keyboard save policy; start at 224-app-workbench-notes."                                                                 |
