---
afx: true
type: SPEC
status: Approved
owner: "@rixrix"
version: "0.1"
created_at: "2026-05-03T03:28:22.000Z"
updated_at: "2026-05-09T12:21:59.000Z"
tags: ["app", "workbench", "impact-lens", "traceability", "intent-ledger"]
depends_on:
  [
    "100-package-shared",
    "130-package-ui",
    "200-app-vscode",
    "220-app-workbench",
    "227-app-workbench-shell",
  ]
---

# App Workbench Impact Lens - Product Specification

## References

- **Upstream sprint brief**: [/Users/rix/Workspace/afx-project/docs/specs/001-vscode-impact-lens/001-vscode-impact-lens.md](/Users/rix/Workspace/afx-project/docs/specs/001-vscode-impact-lens/001-vscode-impact-lens.md)
- **Parent shell**: [docs/specs/220-app-workbench/spec.md](../220-app-workbench/spec.md)
- **Shell/tab route**: [docs/specs/227-app-workbench-shell/spec.md](../227-app-workbench-shell/spec.md)
- **Existing host `@see` providers**: [docs/specs/203-app-vscode-see-navigation/spec.md](../203-app-vscode-see-navigation/spec.md)

---

## Problem Statement

Impact Lens is the planned Workbench surface for reverse traceability: from a
spec/design/task/source node to linked code, tests, stale references, orphan
candidates, and verification context. This child spec reserves the Workbench
lane where the sprint brief graduates into the `afx-vscode` repo.

---

## User Stories

### Primary Users

Developers reviewing AI/agent-created code and maintainers validating AFX traceability.

### Stories

**As a** developer reviewing a requirement
**I want** to see linked source, tests, tasks, and trace-health issues
**So that** I can judge implementation impact before changing the requirement.

**As a** coding agent
**I want** deterministic impact context from the Workbench
**So that** verification does not depend on guessing from the currently open file.

---

## Requirements

### Functional Requirements

| ID   | Requirement                                                                          | Priority    |
| ---- | ------------------------------------------------------------------------------------ | ----------- |
| FR-1 | Add an Impact Lens tab to the Workbench shell                                        | Must Have   |
| FR-2 | Display reverse traceability metrics and prioritized issues                          | Must Have   |
| FR-3 | Support node-to-source and source-to-node exploration                                | Must Have   |
| FR-4 | Show ghost-file, ghost-node, stale, orphan, missing, and unverified states           | Must Have   |
| FR-5 | Open linked docs/source through existing Workbench/VSCode actions                    | Must Have   |
| FR-6 | Accept typed Impact Lens payloads through shared Workbench protocol                  | Must Have   |
| FR-7 | Provide explicit loading, refreshing, partial, empty, fatal, and verification states | Must Have   |
| FR-8 | Route agent verification through existing agent/sidebar boundaries                   | Should Have |

### Non-Functional Requirements

| ID    | Requirement             | Target                                                    |
| ----- | ----------------------- | --------------------------------------------------------- |
| NFR-1 | Local-first             | No network or external graph DB for indexing MVP          |
| NFR-2 | Architecture boundaries | Host scans, pure package indexes, Workbench renders       |
| NFR-3 | Privacy                 | Verification packets cap excerpts and avoid secrets       |
| NFR-4 | Traceability            | New source refs point at this child spec after graduation |

---

## Acceptance Criteria

### Workbench Surface

- [ ] Impact Lens tab appears in the bottom-panel shell after implementation.
- [ ] The tab renders headline metrics, filters, issue list, selected detail, and open actions.
- [ ] Loading/refresh/error/partial states are explicit and non-blank.

### Traceability

- [ ] Selecting a spec/design/task node shows linked source and tests.
- [ ] Selecting a source file shows upstream FR/NFR/DES/task anchors.
- [ ] Ghost/stale/orphan states are visible and actionable.

---

## Non-Goals (Out of Scope)

- Full GraphDB, Time Machine, AST symbol graph, embeddings index, or PR blast-radius simulator.
- Automatically inserting or rewriting `@see` annotations.
- Owning generic Analytics widgets; that belongs to `226-app-workbench-analytics`.

---

## Open Questions

| #   | Question                                                              | Status | Resolution                                           |
| --- | --------------------------------------------------------------------- | ------ | ---------------------------------------------------- |
| 1   | Should the upstream sprint be graduated into this folder before code? | Open   | This folder is the landing zone; promote when ready. |
| 2   | Should ghost/stale links also create VSCode Problems diagnostics?     | Open   | Keep primary surface in Impact Lens first.           |

---

## Dependencies

- `227-app-workbench-shell` for tab routing.
- `203-app-vscode-see-navigation` for existing forward `@see` parsing/navigation behavior.
- `100-package-shared` for typed payloads and protocol additions.
- A future pure Intent Ledger/indexer package or service.

---

## Appendix

### Agent Entry Map

| Field           | Value                                                                                              |
| --------------- | -------------------------------------------------------------------------------------------------- |
| Owned surface   | Future Workbench Impact Lens tab                                                                   |
| Owned files     | Future `apps/workbench/src/views/impact-lens.tsx`, shared payload types, host data/index services  |
| Local anchors   | TBD during sprint graduation                                                                       |
| Bridge messages | Future Impact Lens payload/update/select/verify messages                                           |
| Settings keys   | TBD                                                                                                |
| Tests           | Future pure index tests, host service tests, Workbench React tests, e2e command tests              |
| Dependencies    | `227-app-workbench-shell`, `203-app-vscode-see-navigation`, `100-package-shared`                   |
| Out of scope    | Analytics dashboard widgets, generic documents reader                                              |
| Example prompt  | "Implement Impact Lens MVP; start at 228-app-workbench-impact-lens and the upstream sprint brief." |
