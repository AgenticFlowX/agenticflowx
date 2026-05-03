---
afx: true
type: DESIGN
status: Draft
owner: "@rixrix"
version: "1.1"
created_at: "2026-04-26T04:32:48.000Z"
updated_at: "2026-05-03T03:07:51.000Z"
tags: ["package", "parsers", "markdown", "frontmatter", "spec-driven", "traceability"]
spec: spec.md
---

# @afx/parsers — Technical Design

---

## [DES-OVR] Overview

`@afx/parsers` provides read-only parsers for AFX spec documents. All parsers are pure functions over strings, using `gray-matter` for YAML frontmatter extraction and custom markdown parsing for structured sections.

---

## [DES-ARCH] Architecture

### [DES-PARSERS-SYSTEM-CONTEXT] System Context

```text
packages/parsers/
└── src/
    ├── index.ts         ← barrel
    ├── frontmatter.ts   ← parseFrontmatter() — gray-matter wrapper
    ├── spec.ts          ← parseSpec() — requirements + sections
    ├── tasks.ts         ← parseTasks() — phases + checkboxes + Work Sessions
    └── journal.ts       ← parseJournal() — timestamped entries
```

All functions take raw file content (string) and return typed result objects.

---

## [DES-PARSERS-FLOW] ASCII Parser Flow

<!-- @see spec.md [FR-1] [FR-2] [FR-3] [FR-4] -->

```text
raw markdown string
  |
  +-- parseFrontmatter(raw)
  |     -> { data, content }
  |
  +-- parseSpec(raw)
  |     -> frontmatter + FR/NFR rows + non-goals
  |
  +-- parseTasks(raw)
  |     -> phase groups + checkbox tasks + stats
  |
  `-- parseJournal(raw)
        -> discussion entries + counts
```

### [DES-PARSERS-FRONTMATTER] Frontmatter Parser

`packages/parsers/src/frontmatter.ts` is the only gray-matter wrapper. It returns
typed `data` plus body `content` without validating AFX schema.

### [DES-PARSERS-SPEC] Spec Parser

`packages/parsers/src/spec.ts` extracts frontmatter, requirement rows, NFR rows,
and non-goal lines from markdown. It is intentionally tolerant of in-progress
specs.

### [DES-PARSERS-TASKS] Tasks Parser

`packages/parsers/src/tasks.ts` extracts phase headings, task checkboxes, stats,
and Work Sessions rows. Source line numbers are preserved for Workbench toggles.

### [DES-PARSERS-JOURNAL] Journal Parser

`packages/parsers/src/journal.ts` extracts discussion entries by heading/date/id
signals and returns counts for Workbench Journal surfaces.

---

## [DES-DEC] Key Decisions

| Decision                | Options Considered                              | Choice                           | Rationale                                                                                          |
| ----------------------- | ----------------------------------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------- |
| Frontmatter library     | Manual YAML, js-yaml, gray-matter               | gray-matter                      | Battle-tested, handles edge cases (e.g. frontmatter-only files), returns `{data, content}` cleanly |
| Parser architecture     | Class-based, functional                         | Pure functions                   | Simpler to test; no state to manage                                                                |
| Strict vs loose parsing | Throw on malformed, return null, return partial | Return partial with typed fields | Spec docs may be in-progress; partial parse is useful                                              |

---

## [DES-DATA] Data Model

```typescript
interface AfxFrontmatter {
  afx: true;
  type: "SPEC" | "DESIGN" | "TASKS" | "JOURNAL" | "ADR" | "RES";
  status: string;
  owner: string;
  version: string;
  created_at: string;
  updated_at: string;
  tags: string[];
  spec?: string;
  design?: string;
  depends_on?: string[];
}

interface ParsedSpec {
  frontmatter: AfxFrontmatter;
  requirements: Array<{ id: string; text: string; priority: string }>;
  nfrs: Array<{ id: string; text: string; target: string }>;
}

interface ParsedTask {
  id: string;
  phase: string;
  title: string;
  completed: boolean;
}

interface WorkSession {
  date: string;
  task: string;
  action: string;
  files: string;
  agent: boolean;
  human: boolean;
}

interface ParsedTasks {
  frontmatter: AfxFrontmatter;
  tasks: ParsedTask[];
  sessions: WorkSession[];
}

interface JournalEntry {
  date: string;
  content: string;
  tags: string[];
}
```

---

## [DES-API] API Contracts

```typescript
function parseFrontmatter(content: string): AfxFrontmatter;
function parseSpec(content: string): ParsedSpec;
function parseTasks(content: string): ParsedTasks;
function parseJournal(content: string): JournalEntry[];
```

---

## [DES-FILES] File Structure

| File                                  | Purpose                                           |
| ------------------------------------- | ------------------------------------------------- |
| `packages/parsers/src/index.ts`       | Barrel — all public exports                       |
| `packages/parsers/src/frontmatter.ts` | `parseFrontmatter()` gray-matter wrapper          |
| `packages/parsers/src/spec.ts`        | `parseSpec()` — requirement table extraction      |
| `packages/parsers/src/tasks.ts`       | `parseTasks()` — checkbox + Work Sessions parsing |
| `packages/parsers/src/journal.ts`     | `parseJournal()` — timestamped entry parsing      |

---

## [DES-DEPS] Dependencies

| Package       | Version | Purpose                  |
| ------------- | ------- | ------------------------ |
| `gray-matter` | ^4.x    | YAML frontmatter parsing |

---

## [DES-SEC] Security Considerations

- Parsers are read-only; no filesystem access, no writes
- Input is trusted spec document content — no sanitisation needed

---

## [DES-ERR] Error Handling

| Scenario            | Handling                                     |
| ------------------- | -------------------------------------------- |
| Missing frontmatter | Returns empty `AfxFrontmatter` with defaults |
| Malformed table row | Row is skipped; rest of table parsed         |
| Empty content       | Returns empty result object                  |

---

## [DES-TEST] Testing Strategy

### [DES-PARSERS-TEST-UNIT] Unit Tests

- `parsers.test.ts` covers all four parser functions
- Test fixtures use real AFX spec file formats

---

## [DES-ROLLOUT] Migration / Rollout Plan

### [DES-PARSERS-ROLLOUT-INITIAL] Initial Implementation

1. Implement `frontmatter.ts` (simplest — delegates to gray-matter)
2. Implement `spec.ts` (table parsing with regex)
3. Implement `tasks.ts` (checkbox + table parsing)
4. Implement `journal.ts` (entry extraction)

---

## [DES-PARSERS-LOC] Code Locator Map

<!-- @see spec.md [FR-1] [FR-2] [FR-3] [FR-4] -->

| Parser surface   | Source anchor                         | Design node                 | Tests                                  |
| ---------------- | ------------------------------------- | --------------------------- | -------------------------------------- |
| Barrel exports   | `packages/parsers/src/index.ts`       | `[DES-API]`                 | `packages/parsers/src/parsers.test.ts` |
| Frontmatter      | `packages/parsers/src/frontmatter.ts` | `[DES-PARSERS-FRONTMATTER]` | `packages/parsers/src/parsers.test.ts` |
| Spec document    | `packages/parsers/src/spec.ts`        | `[DES-PARSERS-SPEC]`        | `packages/parsers/src/parsers.test.ts` |
| Tasks document   | `packages/parsers/src/tasks.ts`       | `[DES-PARSERS-TASKS]`       | `packages/parsers/src/parsers.test.ts` |
| Journal document | `packages/parsers/src/journal.ts`     | `[DES-PARSERS-JOURNAL]`     | `packages/parsers/src/parsers.test.ts` |

---

## [DES-PARSERS-TRACE] 1:1 Code/Spec Matrix

| Requirement | Design node                 | Source anchor                         |
| ----------- | --------------------------- | ------------------------------------- |
| `[FR-1]`    | `[DES-PARSERS-FRONTMATTER]` | `packages/parsers/src/frontmatter.ts` |
| `[FR-2]`    | `[DES-PARSERS-SPEC]`        | `packages/parsers/src/spec.ts`        |
| `[FR-3]`    | `[DES-PARSERS-TASKS]`       | `packages/parsers/src/tasks.ts`       |
| `[FR-4]`    | `[DES-PARSERS-JOURNAL]`     | `packages/parsers/src/journal.ts`     |
| `[NFR-1]`   | `[DES-DEPS]`                | package typecheck/import boundary     |
| `[NFR-2]`   | `[DES-DEPS]`                | `packages/parsers/package.json`       |

---

## [DES-PARSERS-REFS] File Reference Map

| Task | File                                  | Required @see                                            |
| ---- | ------------------------------------- | -------------------------------------------------------- |
| —    | `packages/parsers/src/index.ts`       | `spec.md [FR-1]` + `design.md [DES-API]`                 |
| —    | `packages/parsers/src/frontmatter.ts` | `spec.md [FR-1]` + `design.md [DES-PARSERS-FRONTMATTER]` |
| —    | `packages/parsers/src/spec.ts`        | `spec.md [FR-2]` + `design.md [DES-PARSERS-SPEC]`        |
| —    | `packages/parsers/src/tasks.ts`       | `spec.md [FR-3]` + `design.md [DES-PARSERS-TASKS]`       |
| —    | `packages/parsers/src/journal.ts`     | `spec.md [FR-4]` + `design.md [DES-PARSERS-JOURNAL]`     |
