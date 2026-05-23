---
afx: true
type: SPEC
status: Living
owner: "@rixrix"
version: "1.2"
created_at: "2026-05-03T03:28:22.000Z"
updated_at: "2026-05-23T11:03:30.000Z"
tags: ["app", "workbench", "shell", "tabs", "bridge", "layout"]
depends_on: ["100-package-shared", "110-package-transport", "130-package-ui", "220-app-workbench"]
---

# App Workbench Shell - Product Specification

## References

- **Parent bottom-panel spec**: [docs/specs/220-app-workbench/spec.md](../220-app-workbench/spec.md)
- **Root shell**: [apps/workbench/src/app.tsx](../../../apps/workbench/src/app.tsx)
- **Workbench feature view**: [apps/workbench/src/views/workbench.tsx](../../../apps/workbench/src/views/workbench.tsx)
- **Bridge**: [apps/workbench/src/lib/bridge.ts](../../../apps/workbench/src/lib/bridge.ts)
- **Context**: [apps/workbench/src/context/workbench-context.tsx](../../../apps/workbench/src/context/workbench-context.tsx)

---

## Problem Statement

In this repo, "Workbench" means the VSCode bottom panel. The panel contains
multiple child surfaces, so shell/router/state behavior needs its own spec that
does not absorb notes, analytics, board, or future Impact Lens details.

---

## User Stories

### Primary Users

Developers and agents using the bottom panel as the AFX control plane.

### Stories

**As a** developer
**I want** stable bottom-panel tabs and loading/empty behavior
**So that** each Workbench surface is discoverable and consistent.

**As a** coding agent
**I want** shell, bridge, context, and feature-column behavior documented separately
**So that** tab routing and provider changes do not require reading every child surface.

---

## Requirements

### Functional Requirements

| ID    | Requirement                                                                                                                                                                                                                                                                                      | Priority  |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- |
| FR-1  | Bootstrap the Workbench React app and bridge once                                                                                                                                                                                                                                                | Must Have |
| FR-2  | Render bottom-panel tabs for Workbench child surfaces                                                                                                                                                                                                                                            | Must Have |
| FR-3  | Store typed Workbench state from host updates                                                                                                                                                                                                                                                    | Must Have |
| FR-4  | Provide typed send/on bridge wrappers for Workbench messages                                                                                                                                                                                                                                     | Must Have |
| FR-5  | Render loading and friendly empty states                                                                                                                                                                                                                                                         | Must Have |
| FR-6  | Render the feature-scoped Workbench tab                                                                                                                                                                                                                                                          | Must Have |
| FR-7  | Support open actions and task/session toggles from the feature tab. Session signoff covers per-row Agent/Human toggles, bulk "Select all" toggles (`afxToggleAllSessions`), and a bulk Approve action (`afxApproveSessions`) routed through the host                                             | Must Have |
| FR-8  | Keep child surfaces routed to their own specs                                                                                                                                                                                                                                                    | Must Have |
| FR-9  | Render a first-run launchpad when no AFX docs/features exist                                                                                                                                                                                                                                     | Must Have |
| FR-10 | Let the launchpad draft chat commands or create sample docs                                                                                                                                                                                                                                      | Must Have |
| FR-11 | Keep shell tabs and launchpad usable in constrained bottom panels                                                                                                                                                                                                                                | Must Have |
| FR-12 | Keep feature docs readable as a thinking/refinement workspace                                                                                                                                                                                                                                    | Must Have |
| FR-13 | Place AFX command actions inside the relevant spec/design/tasks surface, including phase-scoped task code drafts                                                                                                                                                                                 | Must Have |
| FR-14 | Label feature document toggles as show/hide controls and contain column content inside each pane                                                                                                                                                                                                 | Must Have |
| FR-15 | Preview boot mode: the Workbench bundle supports a standalone preview mode selected by a `data-afx-view="preview"` attribute on `<body>` (read in `main.tsx`). In this mode it mounts `<PreviewApp/>` (wrapped in `WorkbenchProvider`) instead of the tab shell, subscribing to `afxPreviewShow` | Must Have |

### Non-Functional Requirements

| ID    | Requirement      | Target                                             |
| ----- | ---------------- | -------------------------------------------------- |
| NFR-1 | Webview boundary | No direct VSCode/fs/process access                 |
| NFR-2 | Typed protocol   | All host/webview messages use shared types         |
| NFR-3 | Shell stability  | Child tabs can be added without rewriting children |
| NFR-4 | Traceability     | Shell/state/bridge refs use shell-specific IDs     |

---

## Acceptance Criteria

### Shell

- [ ] App initializes Workbench bridge exactly once.
- [ ] Tabs render all current bottom-panel surfaces.
- [ ] Loading state appears before data is ready.
- [ ] Empty/coming-soon surfaces use shared empty state styling.

### State And Feature Columns

- [ ] `WorkbenchProvider` stores host updates and exposes `send`.
- [ ] Feature-scoped Workbench tab renders selector, columns, tasks, sessions, docs, and drift footer.
- [ ] Task/session toggles and open actions send typed messages.
- [ ] Empty Workbench/Pipeline/Documents surfaces show a launchpad with clear creation paths.
- [ ] Launchpad sample actions create either a complete SDD set or a sprint document and refresh state.
- [ ] Launchpad chat actions open Chat with the generated command in the composer.
- [ ] Launchpad and shell tabs avoid horizontal page overflow when primary sidebar, editor, and secondary sidebar are visible.
- [ ] Feature spec/design/tasks columns keep a readable paper-like measure in compact bottom panels and expanded zen layouts.
- [ ] Feature spec/design/tasks columns do not let long prose, paths, tables, or code blocks paint into neighboring panes.
- [ ] Feature document buttons communicate that they show or hide the spec/design/tasks/session panes.
- [ ] Feature tab offers contextual actions inside spec/design/tasks cards, using real AFX verbs from the workflow skills.
- [ ] Tasks surface can draft implementation-oriented commands such as task status, task refinement, code-all runs, and phase-scoped surgical code runs for the next open task in a phase.

---

## Non-Goals (Out of Scope)

- Board, documents, journal, notes, pipeline, analytics, and Impact Lens widget internals.
- VSCode extension host panel registration details, which remain in `200/201` host specs.
- Direct parser implementation.

---

## Open Questions

| #   | Question                                                                 | Status | Resolution                                                          |
| --- | ------------------------------------------------------------------------ | ------ | ------------------------------------------------------------------- |
| 1   | Should the feature-scoped Workbench tab become its own `229` spec later? | Open   | Keep in shell while its code is colocated with tab/splitter layout. |

---

## Dependencies

- `220-app-workbench` for parent bottom-panel boundary.
- `100-package-shared` for state and protocol contracts.
- `130-package-ui` for tabs, empty/loading primitives, scroll areas, and controls.
- Child specs `221` through `228` for tab internals.

---

## Appendix

### Agent Entry Map

| Field           | Value                                                                                                                                                                                                                                              |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Owned surface   | Workbench bottom-panel shell, tabs, state provider, bridge, feature-scoped Workbench tab                                                                                                                                                           |
| Owned files     | `apps/workbench/src/main.tsx`, `apps/workbench/src/app.tsx`, `apps/workbench/src/context/workbench-context.tsx`, `apps/workbench/src/lib/bridge.ts`, `apps/workbench/src/views/workbench.tsx`, `apps/workbench/src/components/coming-soon.tsx`     |
| Local anchors   | `App`, `WorkbenchShell`, `WorkbenchTabTrigger`, `WorkbenchProvider`, `reducer`, `initWorkbenchBridge`, `workbenchSend`, `workbenchOn`, `Workbench`, `ColumnToggle`, `ColumnHeader`, `ColumnTasks`, `ColumnSessions`, `ColumnDoc`, `DriftIndicator` |
| Bridge messages | `afxReady`, `afxUpdate`, `afxOpenFile`, `afxFetchDocContent`, `afxToggleTask`, `afxToggleSession`, `afxOpenChatCommand`, `afxCreateSampleDocs`                                                                                                     |
| Settings keys   | Column visibility state, tab state                                                                                                                                                                                                                 |
| Tests           | `apps/workbench/src/app.test.tsx`, `apps/workbench/src/views/workbench.test.tsx`, e2e Workbench tests                                                                                                                                              |
| Dependencies    | `220-app-workbench`, `100-package-shared`, `130-package-ui`                                                                                                                                                                                        |
| Out of scope    | Child tab widget internals, Impact Lens index internals                                                                                                                                                                                            |
| Example prompt  | "Add a Workbench bottom-panel tab; start at 227-app-workbench-shell."                                                                                                                                                                              |
