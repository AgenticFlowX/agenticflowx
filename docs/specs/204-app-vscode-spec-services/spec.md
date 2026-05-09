---
afx: true
type: SPEC
status: Approved
owner: "@rixrix"
version: "1.0"
created_at: "2026-05-03T07:46:18.000Z"
updated_at: "2026-05-09T12:21:59.000Z"
tags: ["app", "vscode", "spec-services", "sprint", "parsers", "host"]
depends_on: ["120-package-parsers", "200-app-vscode", "220-app-workbench"]
---

# App VSCode Spec Services - Product Specification

## References

- **Parent Spec**: [App VSCode](../200-app-vscode/spec.md)
- **Related**: [App Workbench](../220-app-workbench/spec.md), [Package Parsers](../120-package-parsers/spec.md)

---

## Problem Statement

The extension host runs services that scan, parse, cache, and slice spec documents on disk:
`specs-data` (workspace-wide spec discovery feeding the workbench panel), `sprint` (sprint
section detection and slicing), and `sprint-context` (VSCode `setContext` keys for the editor
title menu). These are not editor-affordances and not panels — they are data services that feed
the workbench, code-actions, and `@see` providers.

Putting them in their own zone gives "specs cache stale", "sprint section detection broken", or
"AFX command appears in wrong file types" a single home.

---

## User Stories

### Primary Users

Extension engineers, AFX agents updating spec parsing or sprint detection.

### Stories

**As a** developer
**I want** spec data + sprint context to be a separate concern from panels and providers
**So that** I do not have to grep the host for "where does the workbench learn about specs?"

**As an** AFX agent
**I want** sprint section detection documented as a service
**So that** changes to sprint-aware editor menus route through one place, not multiple files

---

## Requirements

### Functional Requirements

| ID   | Requirement                                                                                                                                     | Priority  |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| FR-1 | Discover spec docs across the workspace (`docs/specs/**/*.md`) and child project roots, slice sprint files, expose typed payloads to workbench  | Must Have |
| FR-2 | Parse spec frontmatter, FR/NFR/DES/task anchors using `@afx/parsers`                                                                            | Must Have |
| FR-3 | Detect when the active editor is inside a sprint section (`SPEC` / `DESIGN` / `TASKS`) and set `afx.isSprint`, `afx.sprintSection` context keys | Must Have |
| FR-4 | Provide spec/design/task validate/review/approve commands as data services that read frontmatter and emit toast feedback                        | Must Have |
| FR-5 | Cache parsed payloads with debounced refresh on file changes                                                                                    | Must Have |
| FR-6 | Service contracts must be testable without launching VSCode (pure parsing in `@afx/parsers`; host adapters in this zone)                        | Must Have |

### Non-Functional Requirements

| ID    | Requirement                                               | Target                                                                        |
| ----- | --------------------------------------------------------- | ----------------------------------------------------------------------------- |
| NFR-1 | Sprint detection updates within one selection-change tick | <= 16ms compute; setContext calls debounced if more than one change per frame |
| NFR-2 | Spec scan does not block extension activation             | Lazy first scan triggered by workbench `afxReady` or first command            |
| NFR-3 | Cache invalidation on file change is correct              | mtime/version tracked; stale entries dropped before next read                 |

---

## Acceptance Criteria

- [ ] Workbench documents tab populates from `specs-data` payload
- [ ] Editor title menu shows AFX submenu only on `spec.md` / `design.md` / `tasks.md` / sprint files
- [ ] `afx.sprintSection` context key flips between `SPEC` / `DESIGN` / `TASKS` as the cursor moves through a sprint file
- [ ] `afx.action.specValidate` and friends correctly read frontmatter status before emitting toast
- [ ] Cache survives editor save/format with no double-scan within debounce window

---

## Non-Goals (Out of Scope)

- Editor right-click action surface (lives in `202-app-vscode-editor-actions`)
- `@see` provider behavior (lives in `203-app-vscode-see-navigation`)
- Webview registration (lives in `201-app-vscode-panels`)

---

## Open Questions

None.

---

## Dependencies

- `120-package-parsers` (frontmatter, spec, tasks, journal parsers)
- `200-app-vscode` (extension host + activation lifecycle)
- `220-app-workbench` (consumer of `specs-data` payload)
- `202-app-vscode-editor-actions` (commands like `specValidate` are dispatched from there into this layer)

---

## Appendix

### Agent Entry Map

| Field           | Values                                                                                                                                                                                                                                  |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Owned surface   | Spec discovery + cache, sprint section detection, sprint context keys, host-side spec/design/task validate/review/approve dispatch                                                                                                      |
| Owned files     | `apps/vscode/src/services/specs-data.ts`, `apps/vscode/src/services/sprint.ts`, `apps/vscode/src/services/sprint-context.ts`                                                                                                            |
| Local anchors   | `createSpecsDataProvider`, `isSprintFile`, `sliceSprintSection`, `findSectionAt`, `createSprintContextSync`                                                                                                                             |
| Bridge messages | None directly (workbench panel consumes via `afxUpdate`)                                                                                                                                                                                |
| Settings keys   | None                                                                                                                                                                                                                                    |
| Commands        | `afx.action.specValidate`, `afx.action.specReview`, `afx.action.specApprove`, `afx.action.designValidate`, `afx.action.designReview`, `afx.action.designApprove`, `afx.action.taskCode`, `afx.action.taskVerify`, `afx.action.taskPick` |
| Context keys    | `afx.isSprint`, `afx.sprintSection`                                                                                                                                                                                                     |
| Tests           | `apps/vscode/src/services/sprint.test.ts`, future specs-data tests                                                                                                                                                                      |
| Dependencies    | `120-package-parsers`, `200-app-vscode`, `220-app-workbench`                                                                                                                                                                            |
| Out of scope    | UI rendering (workbench), editor right-click submenu (`202`), `@see` providers (`203`)                                                                                                                                                  |
| Example prompts | "Spec scan misses a folder", "Sprint detection wrong section", "AFX submenu shows on wrong files", "Add a spec validate stage"                                                                                                          |

### Glossary

| Term           | Definition                                                                                         |
| -------------- | -------------------------------------------------------------------------------------------------- |
| Spec data      | The cached payload describing all spec documents in the workspace                                  |
| Sprint section | Top-level marker (`SPEC`, `DESIGN`, `TASKS`) inside a single-document sprint file                  |
| Sprint context | VSCode `setContext` keys (`afx.isSprint`, `afx.sprintSection`) that gate editor title menu entries |
