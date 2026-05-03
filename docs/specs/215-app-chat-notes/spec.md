---
afx: true
type: SPEC
status: Draft
owner: "@rixrix"
version: "1.0"
created_at: "2026-05-02T23:56:50.000Z"
updated_at: "2026-05-03T00:25:11.000Z"
tags: ["app", "chat", "notes"]
depends_on:
  [
    "100-package-shared",
    "110-package-transport",
    "202-app-vscode-editor-actions",
    "210-app-chat",
    "211-app-chat-composer",
  ]
---

# App Chat Notes - Product Specification

## References

- **Parent Spec**: [App Chat](../210-app-chat/spec.md)

---

## Problem Statement

Source annotations currently point at a missing notes plan path. Chat note capture, editor save-to-notes actions, and the `afxAppendNote` bridge need a living spec before future notes UX can be updated safely.

---

## User Stories

### Primary Users

Users capturing notes from chat/editor context and developers wiring notes actions.

### Stories

**As a** user
**I want** to save useful chat or editor context into notes quickly
**So that** I can preserve context for later work

**As an** AI agent
**I want** notes entry points to route to one spec
**So that** chat/editor notes updates do not require broad source analysis

---

## Requirements

### Functional Requirements

| ID   | Requirement                                                                               | Priority    |
| ---- | ----------------------------------------------------------------------------------------- | ----------- |
| FR-1 | Own chat note capture affordances and note-related composer events                        | Must Have   |
| FR-2 | Own the shared/bridge contract for appending notes from webview surfaces                  | Must Have   |
| FR-3 | Coordinate with `202-app-vscode-editor-actions` for editor save-to-notes command behavior | Must Have   |
| FR-4 | Keep workbench notes read/edit surface separate unless the feature crosses surfaces       | Should Have |

### Non-Functional Requirements

| ID    | Requirement                   | Target                                                               |
| ----- | ----------------------------- | -------------------------------------------------------------------- |
| NFR-1 | Notes capture is low-friction | No modal-heavy flow for simple capture                               |
| NFR-2 | Notes payloads are explicit   | Include source/context metadata where useful without leaking secrets |

---

## Acceptance Criteria

### Notes Ownership

- [ ] Missing `900-fleet` references are retargeted here
- [ ] Chat note bridge messages and editor notes actions have a numbered spec home
- [ ] Workbench notes surface remains a separate workbench child route when needed

---

## Non-Goals (Out of Scope)

- Full workbench notes editor
- Markdown parser implementation
- General chat composer behavior not specific to notes

---

## Open Questions

None.

---

## Dependencies

- `100-package-shared`
- `110-package-transport`
- `202-app-vscode-editor-actions`
- `211-app-chat-composer`

---

## Appendix

### Agent Entry Map

| Field           | Values                                                                                                                                                              |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Owned surface   | Chat/editor note capture entry points and append-note bridge                                                                                                        |
| Owned files     | `apps/chat/src/views/chat.tsx` note handlers, `apps/vscode/src/utils/notes-utils.ts`, `apps/vscode/src/providers/afx-code-actions.ts`, shared note message payloads |
| Local anchors   | `chat/saveNote` payload, note timeline event helpers, editor save-to-notes action, note append utility                                                              |
| Bridge messages | `afxAppendNote` and related note capture payloads                                                                                                                   |
| Settings keys   | Notes path/settings if introduced                                                                                                                                   |
| Commands        | Editor save-to-notes action and chat note capture actions                                                                                                           |
| Tests           | Notes utility tests, code action tests, chat note event tests                                                                                                       |
| Dependencies    | `202-app-vscode-editor-actions`, `211-app-chat-composer`, future `224-app-workbench-notes`                                                                          |
| Out of scope    | Workbench notes browsing/editing, parser internals                                                                                                                  |
| Example prompts | "Fix save selection to notes", "Add chat note shortcut", "Change note append payload"                                                                               |

### Glossary

| Term         | Definition                                                                      |
| ------------ | ------------------------------------------------------------------------------- |
| Note capture | A lightweight action that appends selected/chat context to the user notes store |
