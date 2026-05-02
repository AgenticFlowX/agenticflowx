---
afx: true
type: DESIGN
status: Approved
owner: "@rixrix"
version: "1.0"
created_at: "2026-04-26T04:32:48.000Z"
updated_at: "2026-04-28T01:37:40.000Z"
tags: [package, parsers, markdown, frontmatter, spec-driven]
spec: spec.md
---

# @afx/parsers — Technical Design

---

## [DES-OVR] Overview

`@afx/parsers` provides read-only parsers for AFX spec documents. All parsers are pure functions over strings, using `gray-matter` for YAML frontmatter extraction and custom markdown parsing for structured sections.

---

## [DES-ARCH] Architecture

### System Context

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

### Unit Tests

- `parsers.test.ts` covers all four parser functions
- Test fixtures use real AFX spec file formats

---

## [DES-ROLLOUT] Migration / Rollout Plan

### Initial Implementation

1. Implement `frontmatter.ts` (simplest — delegates to gray-matter)
2. Implement `spec.ts` (table parsing with regex)
3. Implement `tasks.ts` (checkbox + table parsing)
4. Implement `journal.ts` (entry extraction)

---

## File Reference Map

| Task | File                                  | Required @see                             |
| ---- | ------------------------------------- | ----------------------------------------- |
| —    | `packages/parsers/src/index.ts`       | `spec.md [FR-1]` + `design.md [DES-API]`  |
| —    | `packages/parsers/src/frontmatter.ts` | `spec.md [FR-1]` + `design.md [DES-API]`  |
| —    | `packages/parsers/src/spec.ts`        | `spec.md [FR-2]` + `design.md [DES-DATA]` |
| —    | `packages/parsers/src/tasks.ts`       | `spec.md [FR-3]` + `design.md [DES-DATA]` |
| —    | `packages/parsers/src/journal.ts`     | `spec.md [FR-4]` + `design.md [DES-DATA]` |
