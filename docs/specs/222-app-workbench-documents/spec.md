---
afx: true
type: SPEC
status: Approved
owner: "@rixrix"
version: "1.0"
created_at: "2026-05-03T03:28:22.000Z"
updated_at: "2026-05-09T12:21:59.000Z"
tags: ["app", "workbench", "documents", "reader", "markdown"]
depends_on: ["100-package-shared", "130-package-ui", "220-app-workbench"]
---

# App Workbench Documents - Product Specification

## References

- **Parent shell**: [docs/specs/220-app-workbench/spec.md](../220-app-workbench/spec.md)
- **Current implementation**: [apps/workbench/src/views/documents.tsx](../../../apps/workbench/src/views/documents.tsx)
- **Document helpers**: [apps/workbench/src/lib/documents.ts](../../../apps/workbench/src/lib/documents.ts)

---

## Problem Statement

The Workbench needs a documents surface for browsing AFX specs, designs, tasks,
journals, ADRs, and research docs. This surface has its own tree, reader,
frontmatter, outline, markdown rendering, and open-file affordances, so it needs
its own routing spec instead of living under generic Workbench.

---

## User Stories

### Primary Users

Developers and agents reading project documentation inside the VSCode bottom panel.

### Stories

**As a** developer
**I want** a searchable document tree and reader pane
**So that** I can inspect specs/designs/tasks without leaving the Workbench.

**As a** coding agent
**I want** document helper behavior documented at function level
**So that** frontmatter, outline, markdown, and freshness changes are surgical.

---

## Requirements

### Functional Requirements

| ID   | Requirement                                                         | Priority  |
| ---- | ------------------------------------------------------------------- | --------- |
| FR-1 | Render a searchable, type-filtered document tree                    | Must Have |
| FR-2 | Show a library home with counts, type chips, recent docs, and stats | Must Have |
| FR-3 | Render selected markdown documents with metadata chips and outline  | Must Have |
| FR-4 | Fetch selected document content through the Workbench bridge        | Must Have |
| FR-5 | Open non-renderable documents in the editor through host messages   | Must Have |
| FR-6 | Provide reusable document/frontmatter/outline/markdown helpers      | Must Have |

### Non-Functional Requirements

| ID    | Requirement           | Target                                          |
| ----- | --------------------- | ----------------------------------------------- |
| NFR-1 | Browser-safe UI       | No direct VSCode/fs/process access              |
| NFR-2 | Large-doc resilience  | Reader and tree use scroll areas                |
| NFR-3 | Deterministic helpers | Tree, metadata, and outline transforms are pure |
| NFR-4 | Traceability          | View and helper files point at specific DES IDs |

---

## Acceptance Criteria

### Library And Tree

- [ ] Documents can be filtered by type and search text.
- [ ] Nested `docs/specs/...` paths render as expandable tree nodes.
- [ ] Non-renderable docs open in editor instead of reader.

### Reader

- [ ] Selected renderable docs fetch content via `afxFetchDocContent`.
- [ ] Reader renders metadata chips and markdown outline.
- [ ] Home view shows recent documents and stats when no document is selected.

---

## Non-Goals (Out of Scope)

- Editing document content in the Workbench reader.
- Replacing source-of-truth markdown files.
- AST-level or semantic doc search.
- Owning Impact Lens reverse traceability UI.

---

## Open Questions

| #   | Question                                        | Status | Resolution                                       |
| --- | ----------------------------------------------- | ------ | ------------------------------------------------ |
| 1   | Should the reader support in-pane anchor jumps? | Open   | Defer until outline click behavior is requested. |

---

## Dependencies

- `220-app-workbench` for shell and host-fed document rows.
- `100-package-shared` for `DocumentRow`.
- `130-package-ui` for reader, tree, badge, select, input, and resizable primitives.

---

## Appendix

### Agent Entry Map

| Field           | Value                                                                                                                                                                                                                |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Owned surface   | Workbench Documents tab and shared Workbench markdown reader helpers                                                                                                                                                 |
| Owned files     | `apps/workbench/src/views/documents.tsx`, `apps/workbench/src/lib/documents.ts`, `apps/workbench/src/lib/document-outline.ts`, `apps/workbench/src/lib/frontmatter.ts`, `apps/workbench/src/lib/markdown-render.tsx` |
| Local anchors   | `Documents`, `DocumentsHome`, `DocumentTree`, `DocReader`, `buildDocumentTree`, `MinimalMarkdown`, `extractOutline`, `parseSimpleFrontmatter`                                                                        |
| Bridge messages | `afxFetchDocContent`, `afxDocContent`, `afxOpenFile`                                                                                                                                                                 |
| Settings keys   | None                                                                                                                                                                                                                 |
| Tests           | Future documents view/helper tests                                                                                                                                                                                   |
| Dependencies    | `220-app-workbench`, `100-package-shared`, `130-package-ui`                                                                                                                                                          |
| Out of scope    | Workbench shell, notes capture, Impact Lens reverse index                                                                                                                                                            |
| Example prompt  | "Change document outline behavior; start at 222-app-workbench-documents."                                                                                                                                            |
