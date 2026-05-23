/**
 * Sanitized markdown preview fixtures. These mirror real AFX and generic doc
 * shapes from the repo and private docs without copying private source text.
 *
 * @see docs/specs/222-app-workbench-documents/spec.md [FR-3] [FR-9] [FR-11]
 * @see docs/specs/222-app-workbench-documents/design.md [DES-DOCS-MARKDOWN] [DES-DOCS-PREVIEW-STANDALONE] [DES-TEST]
 */
export interface PreviewFixture {
  id: string;
  filePath: string;
  content: string;
  isAfxHint: boolean;
  title: string;
  requiredText: string[];
  finalText: string;
  tableCell?: string;
  checkboxLabel?: string;
  rawTextAbsent?: RegExp;
}

export const AFX_PREVIEW_FIXTURES: PreviewFixture[] = [
  {
    id: "spec",
    filePath: "docs/specs/910-preview-hardening/spec.md",
    isAfxHint: true,
    title: "Preview Hardening - Product Specification",
    requiredText: ["Functional Requirements", "Acceptance Criteria", "Final spec fixture marker"],
    finalText: "Final spec fixture marker",
    tableCell: "Render AFX and generic markdown without layout drift",
    content: `---
afx: true
type: SPEC
status: Living
owner: "@fixture"
version: "1.0"
created_at: "2026-05-23T01:00:00.000Z"
updated_at: "2026-05-23T01:00:00.000Z"
tags: ["preview", "markdown", "fixtures"]
depends_on: ["222-app-workbench-documents"]
---

# Preview Hardening - Product Specification

## References

- **Parent spec**: [Workbench Documents](../222-app-workbench-documents/spec.md)
- **Renderer**: [markdown-render.tsx](../../../apps/workbench/src/lib/markdown-render.tsx)

---

## Problem Statement

The preview must keep long planning documents readable while preserving tables,
task checkboxes, links, blockquotes, and code blocks.

---

## Requirements

### Functional Requirements

| ID   | Requirement                                           | Priority  |
| ---- | ----------------------------------------------------- | --------- |
| FR-1 | Render AFX and generic markdown without layout drift  | Must Have |
| FR-2 | Preserve checkboxes as clickable controls             | Must Have |
| FR-3 | Keep long paths and identifiers inside the reader pane | Must Have |

### Non-Functional Requirements

| ID    | Requirement | Target                                |
| ----- | ----------- | ------------------------------------- |
| NFR-1 | Resilience  | Tables and code never escape the pane |
| NFR-2 | Privacy     | Fixtures use sanitized wording only   |

---

## Acceptance Criteria

- [x] The preview renders the title and requirement table.
- [ ] The preview toggles open task checkboxes.
- [] Compact checkbox markers normalize before rendering.

## Open Questions

| #   | Question                                  | Status |
| --- | ----------------------------------------- | ------ |
| 1   | Should every large doc get a fixture row? | Open   |

## Appendix

Final spec fixture marker
`,
  },
  {
    id: "design",
    filePath: "docs/specs/910-preview-hardening/design.md",
    isAfxHint: true,
    title: "Preview Hardening - Technical Design",
    requiredText: ["Architecture", "File Structure", "Final design fixture marker"],
    finalText: "Final design fixture marker",
    tableCell: "PreviewApp",
    content: `---
afx: true
type: DESIGN
status: Living
owner: "@fixture"
version: "1.0"
created_at: "2026-05-23T01:00:00.000Z"
updated_at: "2026-05-23T01:00:00.000Z"
tags: ["preview", "design"]
spec: spec.md
---

# Preview Hardening - Technical Design

---

## [DES-OVR] Overview

Render markdown through one shared path, then layer AFX actions and outline
metadata only when frontmatter marks the document as a full AFX artifact.

---

## [DES-ARCH] Architecture

~~~text
PreviewApp
  -> DocPreview
  -> DocumentStudio
  -> MinimalMarkdown
~~~

### Component Diagram

| Component        | Responsibility                         |
| ---------------- | -------------------------------------- |
| PreviewApp       | Receives host preview payloads         |
| DocPreview       | Chooses full or generic reader mode    |
| MinimalMarkdown  | Renders markdown safely inside a pane  |

---

## [DES-DATA] Data Model

~~~typescript
export interface PreviewDocument {
  filePath: string;
  content: string;
  isAfxHint?: boolean;
}
~~~

## [DES-FILES] File Structure

| File                                                  | Purpose                    |
| ----------------------------------------------------- | -------------------------- |
| \`apps/workbench/src/preview-app.tsx\`                | Standalone preview surface |
| \`apps/workbench/src/lib/markdown-render.tsx\`        | Markdown renderer          |
| \`apps/workbench/e2e/preview.spec.ts\`                | Browser coverage           |

## [DES-TEST] Testing Strategy

- Use sanitized AFX fixtures for spec, design, tasks, sprint, ADR, and research files.
- Use generic fixtures for README, changelog, and framework guide shapes.

Final design fixture marker
`,
  },
  {
    id: "tasks",
    filePath: "docs/specs/910-preview-hardening/tasks.md",
    isAfxHint: true,
    title: "Preview Hardening - Implementation Tasks",
    requiredText: ["Open tasks", "Work Sessions", "Final task row marker"],
    finalText: "Final task row marker",
    tableCell: "1.2",
    checkboxLabel: "Toggle human signoff row 2",
    rawTextAbsent: /\| 2026-05-23 \| 1\.2 \| Final task row marker/i,
    content: `---
afx: true
type: TASKS
status: Living
owner: "@fixture"
version: "1.0"
created_at: "2026-05-23T01:00:00.000Z"
updated_at: "2026-05-23T01:00:00.000Z"
tags: ["preview", "tasks"]
spec: spec.md
design: design.md
---

# Preview Hardening - Implementation Tasks

---

## Phase 1: Renderer coverage

### 1.1 Finished baseline

<!-- files: apps/workbench/src/lib/markdown-render.tsx -->
<!-- @see docs/specs/910-preview-hardening/design.md [DES-TEST] -->

- [x] Render existing markdown fixtures.
- [x] Keep long file references inside the pane.

### 1.2 Browser fixture coverage

<!-- files: apps/workbench/e2e/preview.spec.ts -->
<!-- @see docs/specs/910-preview-hardening/spec.md [FR-1] [FR-2] -->

- [ ] Add Playwright coverage for AFX docs.
- [] Add compact checkbox coverage.
- [ ] Add generic markdown fallback coverage.

---

## Cross-Reference Index

| Task | Spec Requirement | Design Section |
| ---- | ---------------- | -------------- |
| 1.1  | [FR-1]           | [DES-TEST]     |
| 1.2  | [FR-1], [FR-2]   | [DES-TEST]     |

---

## Work Sessions

<!-- IMPORTANT: This section MUST remain the LAST section in tasks.md. -->
<!-- Columns: Date (YYYY-MM-DD) | Task (WBS ID) | Action | Files Modified | Agent ([x] or []) | Human ([x] or []) -->

| Date | Task | Action | Files Modified | Agent | Human |
| ---- | ---- | ------ | -------------- | ----- | ----- |

| 2026-05-23 | 1.1 | Completed | apps/workbench/src/lib/markdown-render.tsx | [x] | [x] |
| 2026-05-23 | 1.2 | Final task row marker | apps/workbench/e2e/preview.spec.ts | [x] | [] |
`,
  },
  {
    id: "sprint",
    filePath: "docs/specs/910-preview-hardening/preview-hardening.md",
    isAfxHint: true,
    title: "Preview Hardening Sprint Brief",
    requiredText: ["Refine spec", "Verify tasks", "Final sprint row marker"],
    finalText: "Final sprint row marker",
    tableCell: "2.1",
    checkboxLabel: "Toggle human signoff row 1",
    rawTextAbsent: /\| 2026-05-23 \| 2\.1 \| Final sprint row marker/i,
    content: `---
afx: true
type: SPRINT
status: Approved
owner: "@fixture"
version: "1.0"
created_at: "2026-05-23T01:00:00.000Z"
updated_at: "2026-05-23T01:00:00.000Z"
tags: ["preview", "sprint"]
approval:
  spec: Approved
  design: Approved
  tasks: Approved
---

# Preview Hardening Sprint Brief

<!-- SPRINT-SECTION-START: SPEC (maps to spec.md on graduation) -->

## References

- **Research**: sanitized browser-render notes

## 1. Spec

### Problem Statement

The preview must make single-file sprint docs feel as readable as split docs.

### Requirements

#### Functional Requirements

| ID   | Requirement                             | Priority  |
| ---- | --------------------------------------- | --------- |
| FR-1 | Render all four sprint sections clearly | Must Have |
| FR-2 | Keep task and session checkboxes live   | Must Have |

### Acceptance Criteria

- [ ] A task checkbox can be toggled from the sprint preview.
- [ ] Work Session signoff cells render as checkboxes.

<!-- SPRINT-SECTION-END: SPEC -->

---

<!-- SPRINT-SECTION-START: DESIGN (maps to design.md on graduation) -->

## 2. Design

### [DES-OVR] Overview

Each sprint section renders with its own action group followed by markdown.

### [DES-UI] User Interface & UX

| Area     | Behavior                                  |
| -------- | ----------------------------------------- |
| Spec     | Show refinement and approval controls     |
| Design   | Show author and review controls           |
| Tasks    | Show open task code controls              |
| Sessions | Render durable signoff checkboxes         |

### [DES-API] API Contracts

~~~typescript
type SprintSection = "SPEC" | "DESIGN" | "TASKS" | "SESSIONS";
~~~

<!-- SPRINT-SECTION-END: DESIGN -->

---

<!-- SPRINT-SECTION-START: TASKS (maps to tasks.md on graduation) -->

## 3. Tasks

### Phase 2: Browser verification

#### 2.1 Exercise full sprint preview

<!-- files: apps/workbench/e2e/preview.spec.ts -->
<!-- @see docs/specs/910-preview-hardening/preview-hardening.md [FR-1] [DES-UI] -->

- [ ] Assert section controls are visible.
- [] Assert compact checkboxes normalize.
- [ ] Assert Work Sessions stays a table.

### Cross-Reference Index

| Task | Spec Requirement | Design Section |
| ---- | ---------------- | -------------- |
| 2.1  | [FR-1], [FR-2]   | [DES-UI]       |

<!-- SPRINT-SECTION-END: TASKS -->

---

<!-- SPRINT-SECTION-START: SESSIONS (appended to tasks.md on graduation) -->

## 4. Work Sessions

<!-- Columns: Date (YYYY-MM-DD) | Task (WBS ID) | Action | Files Modified | Agent ([x] or []) | Human ([x] or []) -->

| Date | Task | Action | Files Modified | Agent | Human |
| ---- | ---- | ------ | -------------- | ----- | ----- |

| 2026-05-23 | 2.1 | Final sprint row marker | apps/workbench/e2e/preview.spec.ts | [x] | [] |

<!-- SPRINT-SECTION-END: SESSIONS -->
`,
  },
  {
    id: "adr",
    filePath: "docs/adr/ADR-0091-preview-sanitized-fixtures.md",
    isAfxHint: true,
    title: "ADR-0091: Use Sanitized Preview Fixtures",
    requiredText: ["Context", "Decision", "Final ADR fixture marker"],
    finalText: "Final ADR fixture marker",
    content: `---
afx: true
type: ADR
status: Accepted
owner: "@fixture"
version: "1.0"
created_at: "2026-05-23T01:00:00.000Z"
updated_at: "2026-05-23T01:00:00.000Z"
tags: ["adr", "preview"]
---

# ADR-0091: Use Sanitized Preview Fixtures

## Context

The preview needs coverage for private-doc shapes without carrying private
wording into the public repository.

## Decision

Use synthetic examples that keep the same frontmatter, heading, table, checkbox,
and code-block patterns.

## Consequences

- Tests stay representative.
- The fixture corpus can live in the public repo.
- Final ADR fixture marker
`,
  },
  {
    id: "research",
    filePath: "docs/research/res-preview-rendering-taxonomy.md",
    isAfxHint: true,
    title: "Preview Rendering Taxonomy",
    requiredText: ["Findings", "Recommendations", "Final research fixture marker"],
    finalText: "Final research fixture marker",
    tableCell: "Long-form guide",
    content: `---
afx: true
type: RES
status: Living
owner: "@fixture"
version: "0.1.0"
created_at: "2026-05-23T01:00:00.000Z"
updated_at: "2026-05-23T01:00:00.000Z"
tags: ["research", "preview"]
---

# Preview Rendering Taxonomy

## Context

This sanitized note captures document shapes the preview must support.

---

## Findings

| Shape          | Renderer pressure                         |
| -------------- | ----------------------------------------- |
| Long-form guide | Deep headings, blockquotes, and lists     |
| Research note  | Tables, links, and recommendation bullets |
| Sprint brief   | Section markers and Work Sessions tables  |

### Long-form guide

> A quoted summary should wrap cleanly even when the surrounding pane is narrow.

## Recommendations

- Keep table rows inside table markup.
- Keep code blocks scrollable inside the paper sheet.
- Final research fixture marker
`,
  },
];

export const GENERIC_PREVIEW_FIXTURES: PreviewFixture[] = [
  {
    id: "readme",
    filePath: "README.md",
    isAfxHint: false,
    title: "Demo Project",
    requiredText: ["Install", "Usage", "Final README fixture marker"],
    finalText: "Final README fixture marker",
    tableCell: "pnpm verify",
    content: `# Demo Project

> A generic repository README with badges, links, tables, images, and code.

[Website](https://example.test) | [Docs](./docs/README.md)

## Install

\`\`\`bash
pnpm install
pnpm verify
\`\`\`

## Usage

| Command       | Purpose                  |
| ------------- | ------------------------ |
| pnpm dev      | Start local development  |
| pnpm verify   | Run the fast quality set |

<p align="center">
  <img src="https://example.test/preview.png" alt="Preview image" width="320">
</p>

Final README fixture marker
`,
  },
  {
    id: "changelog",
    filePath: "CHANGELOG.md",
    isAfxHint: false,
    title: "Changelog",
    requiredText: ["Added", "Fixed", "Final changelog fixture marker"],
    finalText: "Final changelog fixture marker",
    content: `# Changelog

## [9.9.0] - 2026-05-23

### Added

- Preview fixtures cover full AFX and generic markdown paths.
- Long entries use inline \`code-like-identifiers-that-should-wrap-cleanly\`.

### Fixed

- Work Session tables remain tables even when authors leave blank lines.
- Final changelog fixture marker
`,
  },
  {
    id: "guide-frontmatter",
    filePath: "docs/agenticflowx/sanitized-guide.md",
    isAfxHint: false,
    title: "Sanitized Workflow Guide",
    requiredText: ["Daily flow", "Reference table", "Final guide fixture marker"],
    finalText: "Final guide fixture marker",
    tableCell: "Review",
    content: `---
afx: true
type: GUIDE
owner: "@fixture"
tags: ["guide", "preview"]
---

# Sanitized Workflow Guide

## Daily flow

1. Capture the request.
2. Draft the plan.
3. Implement the smallest useful change.
4. Verify before handoff.

## Reference table

| Step   | Signal             |
| ------ | ------------------ |
| Draft  | Document changed   |
| Review | Tests are passing  |

- [x] Complete local setup
- [ ] Confirm final review

Final guide fixture marker
`,
  },
];

export const ALL_PREVIEW_FIXTURES = [...AFX_PREVIEW_FIXTURES, ...GENERIC_PREVIEW_FIXTURES];
