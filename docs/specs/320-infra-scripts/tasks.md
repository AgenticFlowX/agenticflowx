---
afx: true
type: TASKS
status: Living
owner: "@rixrix"
version: "1.0"
created_at: "2026-04-26T04:32:48.000Z"
updated_at: "2026-05-09T12:21:59.000Z"
tags: [infra, scripts, commitlint, scope-enum]
spec: spec.md
design: design.md
---

# Infra Scripts — Implementation Tasks

> `generate-scope-enum.mjs` is implemented. Use this file to track future changes to the generator or the hand-maintained scope list.
> The current `handMaintained` array is out of sync with `design.md [DES-INFRA-SCRIPTS-SCOPE-FLOW]`. This phase brings the code in line with the dependency / code-area lookup documented in the design.

---

## Task Numbering Convention

Tasks use WBS numbering `Phase.Task` (e.g. `1.1`, `1.2`). All tasks in this document belong to Phase 1 because they are surgical changes to a single file.

---

## Phase 1: Scope Registry Sync

- [x] Remove duplicate auto-generated scopes from handMaintained
  <!-- files: scripts/generate-scope-enum.mjs -->
  <!-- @see docs/specs/320-infra-scripts/spec.md [FR-2] | docs/specs/320-infra-scripts/design.md [DES-INFRA-SCRIPTS-SCOPE-FLOW] -->

  Acceptance criteria:
  - `chat` is removed from `handMaintained` (it remains in the final scope list because `apps/chat` is auto-generated from the `apps/*` glob)
  - `workbench` is removed from `handMaintained` (it remains in the final scope list because `apps/workbench` is auto-generated from the `apps/*` glob)
  - Final `handMaintained` array does not contain any scope that is also auto-generated from `pnpm-workspace.yaml` globs

- [x] Add missing chat subsystem scopes to handMaintained
  <!-- files: scripts/generate-scope-enum.mjs -->
  <!-- @see docs/specs/320-infra-scripts/design.md [DES-INFRA-SCRIPTS-SCOPE-FLOW] -->

  Acceptance criteria:
  - `chat/history` added (maps to `apps/chat/src/views/history.tsx`, spec `210-app-chat`)
  - `chat/settings` added (maps to `apps/chat/src/views/settings.tsx`, spec `210-app-chat`)

- [x] Add missing workbench subsystem scopes to handMaintained
  <!-- files: scripts/generate-scope-enum.mjs -->
  <!-- @see docs/specs/320-infra-scripts/design.md [DES-INFRA-SCRIPTS-SCOPE-FLOW] -->

  Acceptance criteria:
  - `workbench/analytics` added (maps to `apps/workbench/src/views/analytics.tsx`, spec `226-app-workbench-analytics`)
  - `workbench/documents` added (maps to `apps/workbench/src/views/documents.tsx`, spec `222-app-workbench-documents`)
  - `workbench/shell` added (maps to `apps/workbench/src/views/workbench.tsx`, spec `227-app-workbench-shell`)
  - `workbench/impact-lens` added (planned view, spec `228-app-workbench-impact-lens`)

- [x] Add missing process and cross-cutting scopes to handMaintained
  <!-- files: scripts/generate-scope-enum.mjs -->
  <!-- @see docs/specs/320-infra-scripts/spec.md [FR-2] | docs/specs/320-infra-scripts/design.md [DES-INFRA-SCRIPTS-SCOPE-FLOW] -->

  Acceptance criteria:
  - `scripts` added (covers `scripts/` generators and build utilities)
  - `e2e` added (covers cross-cutting end-to-end test infrastructure)
  - `agent` is **not** added to `handMaintained` because it is already auto-generated from the `packages/*` glob (the `packages/agent/` directory is listed)

- [x] Verify final scope list against design
  <!-- files: scripts/generate-scope-enum.mjs -->
  <!-- @see docs/specs/320-infra-scripts/spec.md [FR-3] | docs/specs/320-infra-scripts/design.md [DES-INFRA-SCRIPTS-SCOPE-FLOW] -->
  Acceptance criteria:
  - Run `node --input-type=module -e "import s from './scripts/generate-scope-enum.mjs'; console.log(s.join('\n'));"`
  - Output contains exactly 32 scopes (11 auto-generated + 21 hand-maintained)
  - No duplicate scopes in the final sorted array
  - All scopes listed in `design.md [DES-INFRA-SCRIPTS-SCOPE-FLOW]` are present

---

## Cross-Reference Index

| Task | Spec Requirements | Design Sections                          |
| ---- | ----------------- | ---------------------------------------- |
| 1.1  | spec.md [FR-2]    | design.md [DES-INFRA-SCRIPTS-SCOPE-FLOW] |
| 1.2  | spec.md [FR-2]    | design.md [DES-INFRA-SCRIPTS-SCOPE-FLOW] |
| 1.3  | spec.md [FR-2]    | design.md [DES-INFRA-SCRIPTS-SCOPE-FLOW] |
| 1.4  | spec.md [FR-2]    | design.md [DES-INFRA-SCRIPTS-SCOPE-FLOW] |
| 1.5  | spec.md [FR-3]    | design.md [DES-INFRA-SCRIPTS-SCOPE-FLOW] |

---

## Work Sessions

<!-- IMPORTANT: This section MUST remain the LAST section in tasks.md. Do not add content below it. -->

| Date       | Task              | Action    | Files Modified                                   | Agent | Human |
| ---------- | ----------------- | --------- | ------------------------------------------------ | ----- | ----- |
| 2026-04-26 | Phase 2           | Completed | docs/specs/320-infra-scripts/ (scaffolded)       | [x]   | [x]   |
| 2026-05-09 | Design refinement | Updated   | docs/specs/320-infra-scripts/design.md, tasks.md | [x]   | [x]   |
| 2026-05-09 | 1.1–1.5           | Coded     | scripts/generate-scope-enum.mjs                  | [x]   | [x]   |
| 2026-05-09 | 1.1–1.5           | Verified  | scripts/generate-scope-enum.mjs                  | [x]   | [x]   |
| 2026-05-09 | 1.1–1.5           | Completed | scripts/generate-scope-enum.mjs                  | [x]   | [x]   |
