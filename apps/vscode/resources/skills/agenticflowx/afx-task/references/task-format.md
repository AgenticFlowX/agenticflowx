# Template Format Rules (CRITICAL)

The AFX `tasks.md` format is strict by design. Downstream consumers — the CLI, the AgenticFlowX VS Code extension, and any other AFX-aware tool — parse it with strict regex patterns. Deviations cause **silent failures** in tools that render tasks (e.g., the VS Code extension shows 0 phases and 0 tasks). These rules are **non-negotiable**.

## Phase Headers

**Required format**: `## Phase N: {Phase Name}`

- MUST start with `## ` (h2 markdown heading)
- MUST contain the word `Phase` followed by a space and a digit
- Colon after the digit is conventional but optional for the parser
- Example: `## Phase 1: Core Types`, `## Phase 3: Integration Testing`
- **NOT**: `## 1. Core Types`, `## Step 1:`, `### Phase 1:`, `# Phase 1:`
- Parser regex: `/^##\s+Phase\s+(\d+):?\s+(.*)$/`

## Task Groups and Completion Criteria

Each `### N.N {Task Group Name}` heading is one stable, dispatchable task. Its WBS ID is the identity used by `/afx-task pick`, `code`, `verify`, and `complete`.

The column-zero checkboxes beneath that heading are the task group's completion criteria:

**Required format**: `- [ ] {Task text}` or `- [x] {Task text}` at column 0

- MUST start at the beginning of the line (column 0) — NO indentation
- MUST use `- [ ] ` (incomplete) or `- [x] ` / `- [X] ` (complete)
- A task group is complete only when it has at least one completion criterion and every criterion is checked
- Do NOT use checkboxes for nested notes, evidence, or sub-items; keep those as plain indented bullets or HTML comments
- File scope and `@see` links go in HTML comments beneath the task-group heading
- **NOT**: `  - [ ] indented`, `* [ ] asterisk`, `- [ ] **1.1** bold-prefixed`
- Parser regex: `/^-\s+\[([ xX])\]\s+(.*)$/`

## Section Order

After frontmatter, the parser expects this order:

1. `# Title`
2. `## Task Numbering Convention` (optional)
3. `## Phase 0:` through `## Phase N:` (phases in order)
4. `## Implementation Flow` (optional)
5. `## Cross-Reference Index`
6. `## Notes` (optional)
7. `## Work Sessions` — **MUST be last**

**CRITICAL**: `## Cross-Reference Index` must come AFTER all Phase sections. `## Work Sessions` must be the absolute last section — nothing below it.

## Work Sessions Table

- Header regex: `/^##\s+Work\s+Sessions/i`
- Row format: `| YYYY-MM-DD | task-id | Action | files | [x]/[] | [x]/[] |`
- Date column must start with a 4-digit year
- Row regex: `/^\|\s*(\d{4}-\d{2}-\d{2}(?:T[\d:.]+Z?)?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|/`
