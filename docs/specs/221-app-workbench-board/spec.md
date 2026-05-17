---
afx: true
type: SPEC
status: Living
owner: "@rixrix"
version: "1.0"
created_at: "2026-05-03T03:28:22.000Z"
updated_at: "2026-05-17T09:04:20.000Z"
tags: ["app", "workbench", "board", "kanban", "markdown"]
depends_on: ["100-package-shared", "130-package-ui", "220-app-workbench"]
---

# App Workbench Board - Product Specification

## References

- **Parent shell**: [docs/specs/220-app-workbench/spec.md](../220-app-workbench/spec.md)
- **Current implementation**: [apps/workbench/src/views/board.tsx](../../../apps/workbench/src/views/board.tsx)
- **Types**: [packages/shared/src/workbench-types.ts](../../../packages/shared/src/workbench-types.ts)

---

## Problem Statement

The Workbench bottom panel needs a focused Kanban surface for `.afx/kanban/*.md`
boards. Treating this as generic Workbench behavior makes small board updates
hard to route, because board markdown serialization, optimistic saves, dialogs,
and drag/drop card interactions are unrelated to other bottom-panel tabs.

---

## User Stories

### Primary Users

Developers and agents maintaining project-state boards inside VSCode.

### Stories

**As a** developer
**I want** to create, select, edit, rename, and delete Kanban boards in the bottom panel
**So that** board state stays close to the code and specs I am editing.

**As a** coding agent
**I want** board code to reference specific spec/design nodes
**So that** future changes to card rendering, column behavior, or save flow do not require reading unrelated Workbench tabs.

---

## Requirements

### Functional Requirements

| ID   | Requirement                                                                  | Priority  |
| ---- | ---------------------------------------------------------------------------- | --------- |
| FR-1 | Render available Kanban boards from Workbench state                          | Must Have |
| FR-2 | Create, rename, delete, and select board markdown files via host messages    | Must Have |
| FR-3 | Render columns and cards with editable card/column dialogs                   | Must Have |
| FR-4 | Support card movement and column reordering from the visual board            | Must Have |
| FR-5 | Serialize board changes back to markdown without losing frontmatter/preamble | Must Have |
| FR-6 | Show empty-board and empty-column states with clear next actions             | Must Have |
| FR-7 | Expose open-in-editor and open-preview actions for the selected board file   | Must Have |

### Non-Functional Requirements

| ID    | Requirement                | Target                                              |
| ----- | -------------------------- | --------------------------------------------------- |
| NFR-1 | Webview-only architecture  | No direct VSCode, filesystem, or process imports    |
| NFR-2 | Optimistic responsiveness  | Card/column edits render immediately before refresh |
| NFR-3 | Markdown round-trip safety | Preserve board metadata and stable headings         |
| NFR-4 | Traceability               | Components and helpers reference specific DES IDs   |

---

## Acceptance Criteria

### Board Lifecycle

- [ ] Empty state can create a board name through `afxCreateKanbanBoard`.
- [ ] Rename sends `afxRenameKanbanBoard` and clears local selection until host refresh.
- [ ] Delete requires confirmation and sends `afxDeleteKanbanBoard`.

### Visual Board

- [ ] Cards render title and body preview.
- [ ] Card edit/delete actions appear on hover or focus.
- [ ] Columns show counts, move controls, delete gating, and add-card input.
- [ ] Saving emits `afxSaveFile` with serialized markdown.

---

## Non-Goals (Out of Scope)

- Full markdown raw editor in this child spec.
- Multi-user realtime board collaboration.
- Direct filesystem writes from `apps/workbench`.
- Replacing the parent Workbench shell or tab router.

---

## Open Questions

| #   | Question                                               | Status | Resolution                                              |
| --- | ------------------------------------------------------ | ------ | ------------------------------------------------------- |
| 1   | Should board drag/drop move to `@dnd-kit` primitives?  | Open   | Keep current HTML5 drag/drop until UX demands more.     |
| 2   | Should board markdown support richer card frontmatter? | Open   | Defer until parser/source format changes are requested. |

---

## Dependencies

- `220-app-workbench` for bottom-panel shell and state feed.
- `100-package-shared` for `KanbanBoard` and outbound message types.
- `130-package-ui` for buttons, dialogs, inputs, popovers, select, scroll area.

---

## Appendix

### Agent Entry Map

| Field           | Value                                                                                                |
| --------------- | ---------------------------------------------------------------------------------------------------- |
| Owned surface   | Workbench Board tab                                                                                  |
| Owned files     | `apps/workbench/src/views/board.tsx`, `apps/workbench/src/views/board.test.tsx`                      |
| Local anchors   | `Board`, `KanbanColumn`, `KanbanCard`, `serializeBoard`, `replaceBoard`, `saveBoard`                 |
| Bridge messages | `afxCreateKanbanBoard`, `afxRenameKanbanBoard`, `afxDeleteKanbanBoard`, `afxSaveFile`, `afxOpenFile` |
| Settings keys   | None                                                                                                 |
| Tests           | `apps/workbench/src/views/board.test.tsx`                                                            |
| Dependencies    | `220-app-workbench`, `100-package-shared`, `130-package-ui`                                          |
| Out of scope    | Shell tabs, pipeline analytics, documents reader                                                     |
| Example prompt  | "Change how board cards preview multiline text; start at 221-app-workbench-board."                   |
