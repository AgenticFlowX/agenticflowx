---
afx: true
type: SPEC
status: Living
owner: "@rixrix"
version: "1.4"
created_at: "2026-05-03T03:28:22.000Z"
updated_at: "2026-05-23T11:03:30.000Z"
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

| ID    | Requirement                                                                                                                                                                                                                                                                                                                                                                                      | Priority    |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------- |
| FR-1  | Render a searchable, type-filtered document tree                                                                                                                                                                                                                                                                                                                                                 | Must Have   |
| FR-2  | Show a library home with counts, type chips, recent docs, and stats                                                                                                                                                                                                                                                                                                                              | Must Have   |
| FR-3  | Render selected markdown documents with metadata chips and outline                                                                                                                                                                                                                                                                                                                               | Must Have   |
| FR-4  | Fetch selected document content through the Workbench bridge                                                                                                                                                                                                                                                                                                                                     | Must Have   |
| FR-5  | Open non-renderable documents in the editor through host messages                                                                                                                                                                                                                                                                                                                                | Must Have   |
| FR-6  | Provide reusable document/frontmatter/outline/markdown helpers                                                                                                                                                                                                                                                                                                                                   | Must Have   |
| FR-7  | Render an upgraded PRD/spec studio for selected planning documents                                                                                                                                                                                                                                                                                                                               | Must Have   |
| FR-8  | Render a launchpad/template state when no documents exist                                                                                                                                                                                                                                                                                                                                        | Must Have   |
| FR-9  | Clean AFX reader noise while preserving useful Markdown structure                                                                                                                                                                                                                                                                                                                                | Must Have   |
| FR-10 | Reuse the same document studio rendering in Documents and Workbench feature columns                                                                                                                                                                                                                                                                                                              | Must Have   |
| FR-11 | Standalone `DocPreview`: extract the `DocReader` rendering core into a reusable `<DocPreview>` component with a `mode` prop of `full` or `generic`. `full` renders metadata chips, quality pulse, outline rail, and `DocumentStudio`. `generic` renders `MinimalMarkdown` only with a minimal header (graceful degrade for non-AFX markdown). `isFullAfxDoc(frontmatter)` selects the mode       | Must Have   |
| FR-12 | Collapsible `full`-mode rail: a toolbar toggle minimises the quality-pulse + outline rail (content takes full width, slim re-expand affordance), persisted across reloads via guarded `localStorage` (`afx.workbench.preview.railCollapsed`, default expanded); identical in Documents tab and standalone panel                                                                                  | Should Have |
| FR-13 | Clickable outline rows: keyboard-accessible buttons that `scrollIntoView` the matching heading. Rendered h1–h4 carry a stable `id` from the shared `slugify` in `document-outline.ts` matching the outline `slug`; works in Documents tab and standalone panel                                                                                                                                   | Should Have |
| FR-14 | Reading display modes: a reading-options popover (width Comfortable/Wide, text size S/M/L/XL, paper tone Default/Warm, body font Sans/Serif) plus a Focus/Zen mode that hides the toolbar + rail (Esc or a floating control exits). Preferences persist via guarded `localStorage` (`afx.workbench.preview.reading`) and apply to both `full` and `generic` previews                             | Should Have |
| FR-15 | Copy markdown source: `full` and `generic` previews render a one-click "Copy markdown source" button that copies the raw markdown (frontmatter included) to the system clipboard. Inside the VSCode webview the copy routes through host `afxCopyMarkdown` (so VSCode owns the clipboard write); outside the webview it falls back to the browser Clipboard API                                  | Should Have |
| FR-16 | Inline AFX command actions live next to the section they affect: spec/design/tasks/journal/ADR previews surface refine/review/code/approve actions plus per-task `Code <wbs>` buttons drafted from the open tasks under each phase. Sprint previews segment the file into Spec/Design/Tasks/Sessions sections via `<!-- SPRINT-SECTION-START: X -->` markers and surface the same actions inline | Must Have   |
| FR-17 | Work Sessions signoff: `full` previews render a signoff toolbar above the Work Sessions table with per-row Agent/Human checkboxes, bulk "Select all" toggles, and an "Approve" action that checks every row where Agent is checked and Human is not. Toggles route through `afxToggleSession`/`afxToggleAllSessions`/`afxApproveSessions` so the host writes the source file                     | Must Have   |

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
- [ ] PRD/spec reader surfaces title, status, owner, outline, section health, and open/refine actions.
- [ ] PRD/spec reader hides frontmatter, HTML comments, `@see` lines, and trace anchors like `[DES-API]` from reader prose.
- [ ] PRD/spec reader renders GFM tables, task lists, links, blockquotes, and fenced code without corrupting examples.
- [ ] Empty library state offers full-spec, sprint, and sample-document creation actions.
- [ ] The same `design.md` rendered in Documents and Workbench uses the same studio primitives, cleanup, table rendering, and section highlight treatment.

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
| Tests           | Documents view/helper tests and Workbench e2e screenshots                                                                                                                                                            |
| Dependencies    | `220-app-workbench`, `100-package-shared`, `130-package-ui`                                                                                                                                                          |
| Out of scope    | Workbench shell, notes capture, Impact Lens reverse index                                                                                                                                                            |
| Example prompt  | "Change document outline behavior; start at 222-app-workbench-documents."                                                                                                                                            |
