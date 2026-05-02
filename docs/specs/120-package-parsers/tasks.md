---
afx: true
type: TASKS
status: Living
owner: "@rixrix"
version: "1.1"
created_at: "2026-04-26T04:32:48.000Z"
updated_at: "2026-04-28T01:37:40.000Z"
tags: [package, parsers, markdown, frontmatter]
spec: spec.md
design: design.md
---

# @afx/parsers — Implementation Tasks

> Phases below were backfilled on 2026-04-27 to give a traceable record of the implementation that already shipped. Each task references the FR/DES anchor it implements.

---

## Phase 1 — Parser modules

### 1.1 Frontmatter parsing

<!-- files: packages/parsers/src/frontmatter.ts -->
<!-- @see docs/specs/120-package-parsers/spec.md [FR-1] [DES-DATA] [DES-API] -->

- [x] Implement YAML frontmatter parser using `gray-matter` so any AFX document can be split into typed metadata + body.
- [x] Export the public types consumed by the spec/tasks/journal parsers.

### 1.2 Spec parser

<!-- files: packages/parsers/src/spec.ts -->
<!-- @see docs/specs/120-package-parsers/spec.md [FR-2] [DES-API] -->

- [x] Parse `spec.md`: extract frontmatter + functional requirements (FR table rows), non-functional requirements (NFR table rows), and acceptance criteria sections.
- [x] Type the parsed shape with the domain types from `@afx/shared` so the workbench can render it without re-deriving structure.

### 1.3 Tasks parser

<!-- files: packages/parsers/src/tasks.ts -->
<!-- @see docs/specs/120-package-parsers/spec.md [FR-3] [DES-API] -->

- [x] Parse `tasks.md`: extract phase headings, task checkboxes (with completion state), and the Work Sessions table rows in append order.
- [x] Preserve task numbering ([X.Y]) so workbench ↔ tasks.md round-trips don't lose anchors.

### 1.4 Journal parser

<!-- files: packages/parsers/src/journal.ts -->
<!-- @see docs/specs/120-package-parsers/spec.md [FR-4] [DES-API] -->

- [x] Parse `journal.md`: extract timestamped session entries with their tag list.

### 1.5 Barrel + tests

<!-- files: packages/parsers/src/index.ts, packages/parsers/src/parsers.test.ts -->
<!-- @see docs/specs/120-package-parsers/spec.md [FR-1] [FR-2] [FR-3] [FR-4] [DES-TEST] -->

- [x] Re-export every parser from `./index.ts` so consumers can `import { parseSpec, parseTasks, parseJournal, parseFrontmatter } from "@afx/parsers"`.
- [x] Add `parsers.test.ts` exercising each parser against representative fixtures (4 tests, run via `pnpm --filter "./packages/parsers" test`).

---

## Work Sessions

<!-- IMPORTANT: This section MUST remain the LAST section in tasks.md. Do not add content below it. -->

| Date       | Task    | Action    | Files Modified                                                                                                              | Agent | Human |
| ---------- | ------- | --------- | --------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 2026-04-26 | Phase 1 | Completed | packages/parsers/src/{frontmatter,spec,tasks,journal,index}.ts, packages/parsers/src/parsers.test.ts                        | [x]   | []    |
| 2026-04-27 | audit   | Reviewed  | Backfilled phase breakdown from `> Package is implemented` placeholder; all FRs cross-referenced to actual files and tests. | [x]   | []    |
