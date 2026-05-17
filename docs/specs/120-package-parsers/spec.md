---
afx: true
type: SPEC
status: Living
owner: "@rixrix"
version: "1.0"
created_at: "2026-04-26T04:32:48.000Z"
updated_at: "2026-05-17T09:04:20.000Z"
tags: [package, parsers, markdown, frontmatter, spec-driven]
---

# @afx/parsers — Product Specification

## References

- **Architecture**: [AGENTS.md — packages/parsers](../../../AGENTS.md)

---

## Problem Statement

The workbench panel and agent tools need to read AFX spec documents (spec.md, tasks.md, journal.md) as structured data. Without a shared parser library, each consumer reimplements frontmatter and markdown parsing differently.

---

## User Stories

### Primary Users

`apps/workbench` (displaying tasks/journal), `apps/vscode` (agent tool implementations), future CLI tooling.

### Stories

**As a** workbench panel
**I want** to read task checkboxes and Work Sessions from tasks.md
**So that** I can display progress without parsing raw markdown

**As an** agent tool
**I want** to parse spec.md requirement tables
**So that** I can validate implementation against FRs

---

## Requirements

### Functional Requirements

| ID   | Requirement                                                                            | Priority  |
| ---- | -------------------------------------------------------------------------------------- | --------- |
| FR-1 | Parse YAML frontmatter from any AFX document using gray-matter                         | Must Have |
| FR-2 | Parse spec.md: extract frontmatter, FR table rows, NFR table rows, acceptance criteria | Must Have |
| FR-3 | Parse tasks.md: extract phase sections, task checkboxes, Work Sessions table rows      | Must Have |
| FR-4 | Parse journal.md: extract timestamped entries with tags                                | Must Have |

### Non-Functional Requirements

| ID    | Requirement                                               | Target                       |
| ----- | --------------------------------------------------------- | ---------------------------- |
| NFR-1 | Zero React or VSCode API dependencies                     | Enforced by package tsconfig |
| NFR-2 | Pure TypeScript, single external dependency (gray-matter) | Keep minimal                 |

---

## Acceptance Criteria

### Frontmatter

- [ ] `parseFrontmatter(content)` returns typed AFX frontmatter fields
- [ ] Unknown frontmatter fields are preserved but not typed

### Spec Parser

- [ ] `parseSpec(content)` returns `{ frontmatter, requirements: FR[], nfrs: NFR[] }`
- [ ] Requirement IDs follow `FR-X` and `NFR-X` naming

### Tasks Parser

- [ ] `parseTasks(content)` returns `{ phases, tasks, sessions }`
- [ ] Completed checkboxes (`[x]`) are distinguished from open (`[ ]`)
- [ ] Work Sessions rows parse date, task ID, action, files, agent/human columns

### Journal Parser

- [ ] `parseJournal(content)` returns entries sorted by timestamp

---

## Non-Goals

- No writing/serializing back to markdown (read-only parsers)
- No validation of parsed content against schema
- No rendering (display is app responsibility)

---

## Dependencies

- `gray-matter` (external — YAML frontmatter parsing)
