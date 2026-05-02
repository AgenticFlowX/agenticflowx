---
afx: true
type: SPEC
status: Approved
owner: "@rixrix"
version: "1.0"
created_at: "2026-04-26T04:32:48.000Z"
updated_at: "2026-04-28T01:37:40.000Z"
tags: ["overview", "afx", "spec-driven", "architecture"]
---

# AgenticFlowX — Project Overview

## References

- **ADR**: [ADR-0001 Pi Engine Integration](../../adr/ADR-0001-pi-engine-integration.md)
- **Research**: [Pi Integration Strategy](../../research/pi/res-pi-integration-strategy.md)

---

## Problem Statement

AgenticFlowX is a spec-driven VSCode coding agent. This overview spec defines the governing conventions — spec naming, traceability rules, and the change gate — so all contributors and AI agents operate from the same shared model.

---

## User Stories

### Primary Users

Developers and AI coding agents working in the AFX repo.

### Stories

**As a** developer
**I want** to understand the spec-naming convention at a glance
**So that** I can create new specs without renumbering existing ones

**As an** AI agent
**I want** clear traceability rules
**So that** I can find the spec for any source file by following `@see` annotations

**As a** contributor
**I want** a documented change gate
**So that** architectural decisions are never made implicitly in code

---

## Requirements

### Functional Requirements

| ID   | Requirement                                                                                              | Priority  |
| ---- | -------------------------------------------------------------------------------------------------------- | --------- |
| FR-1 | All feature work starts with a spec in `docs/specs/` before code is written                              | Must Have |
| FR-2 | Spec folders use 3-digit ranged numbering by category (001, 100–199, 200–299, 300–399, 400–499, 500–599) | Must Have |
| FR-3 | Numbers within each range are spaced by 10 to allow insertion without renumbering                        | Must Have |
| FR-4 | Every `.ts` and `.tsx` source file carries a top-level JSDoc `@see` linking to its spec and design       | Must Have |
| FR-5 | Cross-cutting architectural decisions use ADRs in `docs/adr/`                                            | Must Have |
| FR-6 | `tasks.md` Work Sessions table is always the last section and is append-only                             | Must Have |

### Non-Functional Requirements

| ID    | Requirement                                           | Target                 |
| ----- | ----------------------------------------------------- | ---------------------- |
| NFR-1 | Spec documents are parseable by `@afx/parsers`        | Required for workbench |
| NFR-2 | `/afx-check trace` reports zero orphaned source files | Enforced in CI         |

---

## Acceptance Criteria

### Spec Naming

- [ ] New insertion between 100 and 110 uses 105, never renumbers existing specs
- [ ] Category prefix is encoded in the number (100s = packages, 200s = apps, etc.)
- [ ] `001-overview` is a singleton outside all ranges

### Traceability

- [ ] Every `.ts` and `.tsx` file in `packages/` and `apps/` has dual `@see` links
- [ ] Scripts (`.mjs`) carry inline `// @see` comments
- [ ] Workflow YAML files carry inline `# @see` comments at the top

### Change Gate

- [ ] No new package, app, or architecture pattern ships without a spec or ADR in this repo

---

## Non-Goals

- Feature-specific requirements (each feature has its own spec folder)
- Build or CI configuration (see `310-infra-build`, `400-dx-conventions`)

---

## Appendix

### Spec Numbering Ranges

```text
001        — overview (singleton)
100–199    — packages  (100, 110, 120 … insert at 105)
200–299    — apps      (200, 210, 220 …)
300–399    — infra     (300, 310, 320 …)
400–499    — dx        (400, 410, 420 …)
500–599    — ci        (500, 510, 520 …)
```

### Glossary

| Term        | Definition                                                        |
| ----------- | ----------------------------------------------------------------- |
| Spec        | A `docs/specs/XXX-name/` folder with spec.md, design.md, tasks.md |
| ADR         | Architecture Decision Record in `docs/adr/`                       |
| Change Gate | Rule: spec or ADR precedes code                                   |
| `@see`      | JSDoc annotation linking source file to its governing spec        |
