---
afx: true
type: SPEC
status: Approved
owner: "@rixrix"
version: "1.0"
created_at: "2026-05-03T03:28:22.000Z"
updated_at: "2026-05-09T12:21:59.000Z"
tags: ["app", "workbench", "journal", "sessions", "markdown"]
depends_on:
  ["100-package-shared", "130-package-ui", "220-app-workbench", "222-app-workbench-documents"]
---

# App Workbench Journal - Product Specification

## References

- **Parent shell**: [docs/specs/220-app-workbench/spec.md](../220-app-workbench/spec.md)
- **Current implementation**: [apps/workbench/src/views/journal.tsx](../../../apps/workbench/src/views/journal.tsx)
- **Markdown preview owner**: [docs/specs/222-app-workbench-documents/design.md](../222-app-workbench-documents/design.md)

---

## Problem Statement

The Workbench Journal tab is a session/discussion reader with timeline filters,
status color, decision badges, and markdown preview. Its behavior is distinct
from generic Workbench shell concerns and needs its own spec for surgical changes
to session filters, card rendering, preview fetch, and time/header helpers.

---

## User Stories

### Primary Users

Developers reviewing captured AFX sessions, notes, decisions, and status history.

### Stories

**As a** developer
**I want** searchable journal discussions grouped by date
**So that** I can recover recent decisions and session context quickly.

**As a** coding agent
**I want** journal preview behavior to be traceable to specific design nodes
**So that** changes to filtering or markdown trimming can be targeted.

---

## Requirements

### Functional Requirements

| ID   | Requirement                                                        | Priority  |
| ---- | ------------------------------------------------------------------ | --------- |
| FR-1 | Filter journal entries by time range, status, and search text      | Must Have |
| FR-2 | Group filtered entries by date newest-first                        | Must Have |
| FR-3 | Render compact timeline cards with status, feature, title, context | Must Have |
| FR-4 | Auto-select the latest visible entry when none is selected         | Must Have |
| FR-5 | Fetch and render selected journal markdown content                 | Must Have |
| FR-6 | Trim redundant captured headers before preview rendering           | Must Have |
| FR-7 | Provide empty and no-match states                                  | Must Have |

### Non-Functional Requirements

| ID    | Requirement               | Target                                           |
| ----- | ------------------------- | ------------------------------------------------ |
| NFR-1 | Browser-safe architecture | No direct VSCode/fs/process access               |
| NFR-2 | Deterministic grouping    | Date and status helpers are pure                 |
| NFR-3 | Readable timeline density | Compact cards fit bottom-panel constraints       |
| NFR-4 | Traceability              | Card, preview, filters, and helpers have DES IDs |

---

## Acceptance Criteria

### Timeline

- [ ] Time chips filter entries to today/week/month/year/all.
- [ ] Search matches title, id, feature, context, and summary.
- [ ] Status counts and blocked/active labels update with the journal state.

### Preview

- [ ] Selecting an entry fetches content through `afxFetchDocContent`.
- [ ] Preview shows status, feature, date, decisions, open actions, summary, and markdown body.
- [ ] Empty preview explains how to select a discussion.

---

## Non-Goals (Out of Scope)

- Editing journal entries in the Workbench.
- Owning note capture or documents reader implementation.
- Replacing append-only journal/session conventions.

---

## Open Questions

| #   | Question                                          | Status | Resolution                                              |
| --- | ------------------------------------------------- | ------ | ------------------------------------------------------- |
| 1   | Should feature filtering be explicit in the UI?   | Open   | Current implementation uses search; add only if needed. |
| 2   | Should decisions become a first-class side panel? | Open   | Keep decision chips in preview for now.                 |

---

## Dependencies

- `220-app-workbench` for shell and state feed.
- `222-app-workbench-documents` for `MinimalMarkdown` preview behavior.
- `100-package-shared` for `JournalEntry`.
- `130-package-ui` for badges, selects, toggles, inputs, and scroll areas.

---

## Appendix

### Agent Entry Map

| Field           | Value                                                                                           |
| --------------- | ----------------------------------------------------------------------------------------------- |
| Owned surface   | Workbench Journal tab                                                                           |
| Owned files     | `apps/workbench/src/views/journal.tsx`                                                          |
| Local anchors   | `Journal`, `JournalCard`, `PreviewPanel`, `isInTimeRange`, `groupByDate`, `trimRedundantHeader` |
| Bridge messages | `afxFetchDocContent`, `afxDocContent`, `afxOpenFile`                                            |
| Settings keys   | None                                                                                            |
| Tests           | Future journal view/helper tests                                                                |
| Dependencies    | `220-app-workbench`, `222-app-workbench-documents`, `100-package-shared`, `130-package-ui`      |
| Out of scope    | Documents tree, notes capture, Impact Lens                                                      |
| Example prompt  | "Change journal date grouping labels; start at 223-app-workbench-journal."                      |
