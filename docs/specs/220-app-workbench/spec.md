---
afx: true
type: SPEC
status: Approved
owner: "@rixrix"
version: "1.1"
created_at: "2026-04-26T04:32:48.000Z"
updated_at: "2026-05-02T00:08:26.000Z"
tags: [app, workbench, webview, tasks, journal, board, pipeline, documents, notes, analytics]
depends_on: [100-package-shared, 130-package-ui, 120-package-parsers]
---

# apps/workbench — Product Specification

## References

- **Architecture**: [AGENTS.md — apps/workbench](../../../AGENTS.md)
- **Implementation plan**: [docs/specs/000-plans/plan-workbench-traceability-migration.md](../000-plans/plan-workbench-traceability-migration.md)

---

## Problem Statement

The workbench panel surfaces spec-driven context (tasks, journal, board, analytics, pipeline, documents, notes) in the VSCode bottom panel, giving users a persistent view of project state alongside the chat.

---

## User Stories

### Primary Users

Users who want visibility into tasks and spec progress without leaving VSCode.

### Stories

**As a** user
**I want** a tab-based bottom panel showing task progress, journal, board, pipeline, documents, notes, and analytics
**So that** I can keep track of spec-driven work while coding

---

## Requirements

### Functional Requirements

| ID    | Requirement                                                                        | Priority  |
| ----- | ---------------------------------------------------------------------------------- | --------- |
| FR-1  | Tab-based navigation: Tasks, Journal, Board, Pipeline, Documents, Notes, Analytics | Must Have |
| FR-2  | Workbench panel loads as VSCode bottom panel webview                               | Must Have |
| FR-3  | Transport bridge between webview and extension host                                | Must Have |
| FR-4  | Notes view — quick timestamped note capture with timeline                          | Must Have |
| FR-5  | Board view — kanban with markdown serialization                                    | Must Have |
| FR-6  | Journal view — sessions, decisions, statuses                                       | Must Have |
| FR-7  | Pipeline view — feature progress with timeline / grid / kanban                     | Must Have |
| FR-8  | Documents view — spec/design/tasks/journal browser with reader pane                | Must Have |
| FR-9  | Analytics view — task counts, stage breakdowns, trends                             | Must Have |
| FR-10 | Workbench tab — feature-scoped 4-column view (spec/design/tasks/sessions)          | Must Have |
| FR-11 | Friendly empty states for every view                                               | Must Have |
| FR-12 | Loading skeletons while data fetches                                               | Must Have |

### Non-Functional Requirements

| ID    | Requirement                                        | Target             |
| ----- | -------------------------------------------------- | ------------------ |
| NFR-1 | Zero direct VSCode API imports                     | Enforced by ESLint |
| NFR-2 | Coverage ≥ 70% statements/branches/functions/lines | Vitest             |
| NFR-3 | All UI uses `@afx/ui` shadcn components first      | Manual review      |
| NFR-4 | Theme tokens only (no `--vscode-*` direct usage)   | Manual review      |

---

## Acceptance Criteria

### Navigation

- [ ] Tab bar renders all 7 view names
- [ ] Active tab highlights correctly
- [ ] Each tab renders its view

### Bridge

- [ ] `initWorkbenchBridge()` initializes once on mount
- [ ] `workbenchSend()` posts typed messages to host
- [ ] `workbenchOn()` subscribes to typed inbound messages

---

## Non-Goals

- Full filesystem access from webview (host owns all I/O)
- Direct engine/agent invocation from webview

---

## Dependencies

- `@afx/shared` (domain types, workbench protocol)
- `@afx/ui` (component library)
- `@afx/parsers` (frontmatter, tasks, journal parsers — host side)

---

## Appendix

### Agent Entry Map (routing-only parent)

This is a parent spec. It owns the workbench webview boundary (tab routing shell, transport bridge,
context provider) and **does not** own per-zone functional requirements. The table below routes
incoming requests to the right child zone before reading any source file.

| Field           | Values                                                                                                                                                                                                                                                        |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Owned surface   | Workbench webview shell, tab routing, context provider, bridge bootstrap; **routing only** for tab content                                                                                                                                                    |
| Owned files     | `apps/workbench/src/index.tsx`, `apps/workbench/src/app.tsx` (tab routing only), `apps/workbench/src/context/workbench-context.tsx`, `apps/workbench/src/lib/bridge.ts`                                                                                       |
| Children        | `221-board`, `222-documents`, `223-journal`, `224-notes`, `225-pipeline`, `226-analytics`, `227-shell`, `228-impact-lens`                                                                                                                                     |
| Routing rules   | "kanban/board/task card" -> 221; "documents explorer/spec viewer" -> 222; "journal entries/timeline" -> 223; "notes view" -> 224; "pipeline/phase/progress" -> 225; "analytics/heatmap" -> 226; "tabs/shell/state" -> 227; "Impact Lens/reverse trace" -> 228 |
| Out of scope    | Functional requirements for any specific tab; those live in the child specs                                                                                                                                                                                   |
| Example prompts | "Board drag-drop bug" -> 221; "Add filter to documents" -> 222; "Journal time format" -> 223; "Notes edit-in-place" -> 224; "Pipeline next-action policy" -> 225; "Heatmap range" -> 226; "Tab persistence" -> 227; "Show ghost-node count" -> 228            |
