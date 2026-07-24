---
afx: true
type: SPEC
status: Living
owner: "@rixrix"
version: "1.1"
created_at: "2026-05-03T03:28:22.000Z"
updated_at: "2026-07-19T03:16:29.000Z"
tags:
  ["app", "workbench", "board", "kanban", "markdown", "linked-work-items", "realtime", "dnd-kit"]
depends_on: ["100-package-shared", "130-package-ui", "220-app-workbench", "227-app-workbench-shell"]
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

**As an** AFX planner
**I want** to link specs and stable task sections into Board columns
**So that** the Board becomes a visual prioritization layer while the source AFX documents remain the authority for status and completion.

**As a** developer editing board or task markdown manually
**I want** the visible Board to update while I type or when another process saves the file
**So that** I never plan against stale state or have a pending Board write overwrite newer source changes.

---

## Requirements

### Functional Requirements

| ID    | Requirement                                                                                                                                                                                                  | Priority  |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- |
| FR-1  | Render available Kanban boards from Workbench state                                                                                                                                                          | Must Have |
| FR-2  | Create, rename, delete, and select board markdown files via host messages                                                                                                                                    | Must Have |
| FR-3  | Render columns and cards with editable card/column dialogs                                                                                                                                                   | Must Have |
| FR-4  | Support card movement and column reordering from the visual board                                                                                                                                            | Must Have |
| FR-5  | Serialize board changes back to markdown without losing frontmatter/preamble                                                                                                                                 | Must Have |
| FR-6  | Show empty-board and empty-column states with clear next actions                                                                                                                                             | Must Have |
| FR-7  | Expose open-in-editor and open-preview actions for the selected board file                                                                                                                                   | Must Have |
| FR-8  | Keep column/card rendering stable through duplicate titles and reorders                                                                                                                                      | Must Have |
| FR-9  | Provide visible, keyboard-reachable reorder controls as the reliable path                                                                                                                                    | Must Have |
| FR-10 | Teach empty/new projects with multi-board guidance and mock board preview                                                                                                                                    | Must Have |
| FR-11 | Update Board state in real time from saved, externally written, and unsaved open-editor changes; reconcile clean state automatically and surface a conflict instead of overwriting unconfirmed local changes | Must Have |
| FR-12 | Add a bounded, searchable, keyboard-accessible **Link work** picker that groups specs and stable WBS task sections, supports multi-select and target-column selection, and prevents accidental duplicates    | Must Have |
| FR-13 | Render linked spec/task cards with live source-owned title, status, progress, source actions, unresolved/ambiguous warnings, and checklist controls that mutate the task source rather than the Board file   | Must Have |
| FR-14 | Persist linked-card identity as portable Markdown plus versioned namespaced metadata containing only workspace-relative source identity; unknown metadata and ordinary free-text cards round-trip unchanged  | Must Have |
| FR-15 | Use reliable pointer, touch, and keyboard card/column movement with insertion feedback and explicit Move actions; dragging a linked card changes Board organization only and never changes source completion | Must Have |

### Non-Functional Requirements

| ID    | Requirement                | Target                                                                                                                              |
| ----- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| NFR-1 | Webview-only architecture  | No direct VSCode, filesystem, or process imports                                                                                    |
| NFR-2 | Optimistic responsiveness  | Card/column edits render immediately before refresh                                                                                 |
| NFR-3 | Markdown round-trip safety | Preserve board metadata and stable headings                                                                                         |
| NFR-4 | Traceability               | Components and helpers reference specific DES IDs                                                                                   |
| NFR-5 | Data safety                | Revisioned acknowledged writes, path-scoped ordering, collision checks, and no lossy rewrite of supported or unknown board Markdown |
| NFR-6 | Live-update latency        | Unsaved editor changes appear within 250 ms after typing pauses; saved/external changes appear within 150 ms on local filesystems   |
| NFR-7 | Responsive accessibility   | Link picker, board toolbar, cards, and movement work at 360 px by keyboard, pointer, and touch without clipped controls             |

---

## Acceptance Criteria

### Board Lifecycle

- [ ] Empty state can create a board name through `afxCreateKanbanBoard`.
- [ ] Empty state explains users can create multiple boards for roadmaps, bugs, sprints, or experiments.
- [ ] Empty state renders a mock board preview before any `.afx/kanban/*.md` file exists.
- [ ] Rename sends `afxRenameKanbanBoard` and clears local selection until host refresh.
- [ ] Delete requires confirmation and sends `afxDeleteKanbanBoard`.

### Visual Board

- [ ] Cards render title and body preview.
- [ ] Card edit/delete actions appear on hover or focus.
- [ ] Columns show counts, move controls, delete gating, and add-card input.
- [ ] Saving emits `afxSaveFile` with serialized markdown.
- [ ] Duplicate column titles and duplicate card text do not break optimistic reordering.
- [ ] Move-left/right controls remain visible enough to discover and pass keyboard/e2e verification.

### Live AFX Work Items

- [ ] Manual edits to the selected board, linked spec, or linked task document refresh the clean Board without reopening it; a dirty Board receives a conflict state and cannot silently overwrite the newer revision.
- [ ] Link work searches and groups specs plus WBS task sections, supports keyboard multi-select, and adds portable linked cards to a chosen column.
- [ ] Linked spec cards show live lifecycle/progress and open Spec/SDD Studio; linked task cards show live checklist progress and can toggle source tasks through revision-protected host mutations.
- [ ] Reordering or moving a linked card changes only `.afx/kanban/*.md`; source completion never follows a column name and source completion never moves a card automatically.
- [ ] Missing, moved, malformed, ambiguous, cross-root, and outside-workspace references show actionable unresolved states without rebinding silently.
- [ ] Free-text and linked cards, unknown metadata/comments, frontmatter, preamble, duplicate titles, multiline bodies, and reorders survive parse/save/reload.

---

## Non-Goals (Out of Scope)

- Full markdown raw editor in this child spec.
- Multi-user network collaboration or presence; local/editor/external file synchronization is required.
- Direct filesystem writes from `apps/workbench`.
- Replacing the parent Workbench shell or tab router.
- Treating Board as a second writable owner of spec lifecycle or task completion.
- Automatic card movement based on source status or column names in this iteration.

---

## Open Questions

| #   | Question                                              | Status   | Resolution                                                                                                               |
| --- | ----------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------ |
| 1   | Should board drag/drop move to `@dnd-kit` primitives? | Resolved | Yes. Use accessible pointer/touch/keyboard sensors and keep explicit Move actions as the dependable fallback.            |
| 2   | How should linked work persist?                       | Resolved | Human-readable Markdown link plus versioned `afx:card` HTML-comment metadata; source status remains transient host data. |

---

## Dependencies

- `220-app-workbench` for bottom-panel shell and state feed.
- `100-package-shared` for `KanbanBoard` and outbound message types.
- `130-package-ui` for buttons, dialogs, inputs, popovers, select, scroll area.
- `227-app-workbench-shell` for revisioned mutations, live document overlays, scan generations, and multi-root routing.

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
