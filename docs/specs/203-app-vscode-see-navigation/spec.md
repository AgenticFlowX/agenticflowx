---
afx: true
type: SPEC
status: Draft
owner: "@rixrix"
version: "1.0"
created_at: "2026-05-02T23:56:50.000Z"
updated_at: "2026-05-03T00:25:11.000Z"
tags: ["app", "vscode", "see-navigation", "traceability"]
depends_on: ["001-overview", "120-package-parsers", "200-app-vscode"]
---

# App VSCode See Navigation - Product Specification

## References

- **Parent Spec**: [App VSCode](../200-app-vscode/spec.md)
- **Routing Spec**: [Project Overview](../001-overview/spec.md)

---

## Problem Statement

`@see` completion, link navigation, definitions, hover, CodeLens, and resolver behavior are editor intelligence features that should not be mixed with generic right-click/editor command work.

---

## User Stories

### Primary Users

Developers navigating spec-driven source and AI agents retargeting traceability.

### Stories

**As a** developer
**I want** `@see` links to complete, resolve, and navigate reliably
**So that** source files stay connected to living specs

**As an** AI agent
**I want** `@see` navigation source mapped to one spec
**So that** traceability tooling can be changed surgically

---

## Requirements

### Functional Requirements

| ID   | Requirement                                                                               | Priority  |
| ---- | ----------------------------------------------------------------------------------------- | --------- |
| FR-1 | Own `@see` completion, document links, resolver, definition, hover, and CodeLens behavior | Must Have |
| FR-2 | Own spec/design anchor navigation semantics in VSCode editor surfaces                     | Must Have |
| FR-3 | Coordinate with `001-overview` for annotation format rules                                | Must Have |
| FR-4 | Keep generic editor actions in `202-app-vscode-editor-actions`                            | Must Have |

### Non-Functional Requirements

| ID    | Requirement                     | Target                                                           |
| ----- | ------------------------------- | ---------------------------------------------------------------- |
| NFR-1 | Navigation remains fast         | Providers do not scan the whole repo on every keystroke          |
| NFR-2 | Missing targets are explainable | Broken links surface actionable diagnostics or fallback behavior |

---

## Acceptance Criteria

### See Navigation Ownership

- [ ] `@see` completion/link/definition/hover/CodeLens files point at this spec
- [ ] Annotation format changes start from `001-overview`, then update this spec for VSCode behavior
- [ ] Generic editor action work remains in `202-app-vscode-editor-actions`

---

## Non-Goals (Out of Scope)

- Spec numbering policy itself
- Generic editor context menu commands
- Parser implementation internals beyond VSCode usage

---

## Open Questions

None.

---

## Dependencies

- `001-overview`
- `120-package-parsers`
- `200-app-vscode`

---

## Appendix

### Agent Entry Map

| Field           | Values                                                                                                                                               |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Owned surface   | VSCode `@see` completion, document links, definition, hover, CodeLens navigation                                                                     |
| Owned files     | `apps/vscode/src/providers/see-completion.ts`, `see-document-links.ts`, `see-resolver.ts`, `spec-codelens.ts`, `spec-definition.ts`, `spec-hover.ts` |
| Local anchors   | Completion provider, document link provider, resolver functions, definition/hover providers, CodeLens provider                                       |
| Bridge messages | None directly                                                                                                                                        |
| Settings keys   | Trace/navigation settings if introduced                                                                                                              |
| Commands        | Commands that open/resolve `@see` targets                                                                                                            |
| Tests           | Provider tests for completion/link/definition/hover/codelens                                                                                         |
| Dependencies    | `001-overview`, `120-package-parsers`, `202-app-vscode-editor-actions`                                                                               |
| Out of scope    | Editor right-click command groups, source annotation policy                                                                                          |
| Example prompts | "Fix @see completion", "Add CodeLens for spec links", "Resolve design anchor navigation"                                                             |

### Glossary

| Term              | Definition                                                                  |
| ----------------- | --------------------------------------------------------------------------- |
| `@see` navigation | Editor intelligence that resolves source annotations to spec/design targets |
