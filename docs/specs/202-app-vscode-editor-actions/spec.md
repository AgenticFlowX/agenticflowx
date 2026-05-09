---
afx: true
type: SPEC
status: Approved
owner: "@rixrix"
version: "1.0"
created_at: "2026-05-02T23:56:50.000Z"
updated_at: "2026-05-09T12:21:59.000Z"
tags: ["app", "vscode", "editor-actions", "commands"]
depends_on: ["100-package-shared", "200-app-vscode", "215-app-chat-notes"]
---

# App VSCode Editor Actions - Product Specification

## References

- **Parent Spec**: [App VSCode](../200-app-vscode/spec.md)

---

## Problem Statement

Editor right-click menus, editor title menus, gutter/code actions, and runtime command dispatch span manifest contribution points plus TypeScript providers. They need a spec that is narrower than the whole VSCode extension host.

---

## User Stories

### Primary Users

VSCode users invoking AFX from editor context and developers adding editor actions.

### Stories

**As a** user
**I want** editor actions to appear in predictable right-click/title/code-action locations
**So that** I can send code, save notes, generate tests, or run spec actions from context

**As an** AI agent
**I want** menu declarations and runtime dispatch mapped together
**So that** adding a small action does not require reading the whole extension host

---

## Requirements

### Functional Requirements

| ID   | Requirement                                                                           | Priority  |
| ---- | ------------------------------------------------------------------------------------- | --------- |
| FR-1 | Own editor context menu, editor title menu, and code-action contribution behavior     | Must Have |
| FR-2 | Own runtime dispatch from editor actions into commands, chat, notes, and spec helpers | Must Have |
| FR-3 | Own action availability/context-key rules for editor selection and sprint context     | Must Have |
| FR-4 | Coordinate with `203-app-vscode-see-navigation` for `@see` navigation actions         | Must Have |
| FR-5 | Keep webview UI behavior in app webview specs                                         | Must Have |

### Non-Functional Requirements

| ID    | Requirement                                                 | Target                                                              |
| ----- | ----------------------------------------------------------- | ------------------------------------------------------------------- |
| NFR-1 | Actions remain discoverable without cluttering VSCode menus | Commands are grouped and context-gated                              |
| NFR-2 | Dispatch remains safe                                       | Missing selection/runtime state produces no destructive side effect |

---

## Acceptance Criteria

### Editor Action Ownership

- [ ] `package.json` editor menu contributions and editor action providers route here
- [ ] Adding a right-click or title action starts from this spec
- [ ] Notes actions depend on `215-app-chat-notes` for note payload behavior

---

## Non-Goals (Out of Scope)

- `@see` completion/definition/hover behavior owned by `203-app-vscode-see-navigation`
- Sidebar/workbench panel registration
- Chat webview UI implementation

---

## Open Questions

None.

---

## Dependencies

- `200-app-vscode`
- `100-package-shared`
- `215-app-chat-notes`
- `203-app-vscode-see-navigation`

---

## Appendix

### Agent Entry Map

| Field           | Values                                                                                                                                                      |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Owned surface   | VSCode editor context menu, editor title menu, code actions, command dispatch                                                                               |
| Owned files     | `apps/vscode/package.json`, `apps/vscode/src/providers/afx-code-actions.ts`, command registration in `apps/vscode/src/extension.ts`, editor context helpers |
| Local anchors   | `ACTIONS` registry, dispatch kinds, code action provider, command registration blocks, editor context helpers                                               |
| Bridge messages | Commands/actions that send editor selection to chat or notes                                                                                                |
| Settings keys   | Editor/action/context settings if introduced                                                                                                                |
| Commands        | `afx.editorContext.*`, code action commands, save-to-notes/send/review/explain/test/spec commands                                                           |
| Tests           | Code action provider tests, command dispatch tests, package manifest contribution checks                                                                    |
| Dependencies    | `203-app-vscode-see-navigation`, `215-app-chat-notes`, `350-agent-manager`                                                                                  |
| Out of scope    | Webview rendering, Pi RPC internals, `@see` link resolution internals                                                                                       |
| Example prompts | "Add editor right-click action", "Change gutter code action", "Update editor title menu grouping"                                                           |

### Glossary

| Term          | Definition                                                              |
| ------------- | ----------------------------------------------------------------------- |
| Editor action | A command exposed through VSCode editor menu/title/code-action surfaces |
