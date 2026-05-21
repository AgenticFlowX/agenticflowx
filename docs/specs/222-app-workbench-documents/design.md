---
afx: true
type: DESIGN
status: Living
owner: "@rixrix"
version: "1.0"
created_at: "2026-05-03T03:28:22.000Z"
updated_at: "2026-05-20T13:04:07.000Z"
tags: ["app", "workbench", "documents", "reader", "markdown"]
spec: spec.md
---

# App Workbench Documents - Technical Design

---

## [DES-OVR] Overview

The Documents tab is a browser-safe documentation explorer for Workbench. It
owns tree construction, type/search filtering, document content fetching,
library home metrics, reader metadata, outline extraction, and shared markdown
preview rendering. Planning documents render in a PRD/spec studio view with
status, section health, outline, table-first readability, and next-action
affordances.

---

## [DES-ARCH] Architecture

```text
WorkbenchProvider documents[]
      |
      v
Documents
  ├─ buildDocumentTree(filtered)
  ├─ left pane: search/type filters + DocumentTree
  └─ right pane
      ├─ DocumentsHome
      └─ DocReader
          ├─ workbenchOn(afxDocContent)
          ├─ parseSimpleFrontmatter -> extractMetaChips
          ├─ extractOutline
          └─ MinimalMarkdown
```

---

## [DES-UI] User Interface & UX

### [DES-DOCS-MOCKUP] Documents ASCII

```text
┌──────────── library filters/tree ────────────┬──────────────────────── reader/home ─────────────────────┐
│ [Search documents...........]                 │ Knowledge base                    [Library mode]          │
│ [All types v]                                 │ 42 documents · 12 features · last activity 2h ago         │
│ docs                                          │ [Spec 12] [Design 10] [Tasks 10] [Journal 8] [ADR 2]      │
│  ▾ specs                                      │ Recently updated                                            │
│    ▾ 220-app-workbench                        │  doc row                    [DESIGN] May 3                 │
│      spec.md                         [SPEC]  │ Stats: AFX docs · External · Features · Drafts             │
│      design.md                     [DESIGN]  │                                                        or  │
│      tasks.md                       [TASKS]  │ [Library] title path                         [Open][Preview]│
│                                              │ metadata chips                                             │
│                                              │ Rendered markdown                         Outline sidecar   │
└──────────────────────────────────────────────┴──────────────────────────────────────────────────────────┘
```

### [DES-DOCS-TREE] Document Tree And Filters

`Documents` owns type filtering, search, selected document state, expanded tree
state, and content cache. `buildDocumentTree` converts flat `DocumentRow` rows
into nested `TreeNode` entries.

### [DES-DOCS-HOME] Documents Home

`DocumentsHome` renders the knowledge-base header, type chip strip, recent
document list, and stat tiles. Stats are derived by `computeStats`,
`recentDocs`, `featureFromPath`, `docDisplayName`, `formatShortDate`, and
`formatRelative`.

### [DES-DOCS-READER] Reader Pane And Outline

`DocReader` renders selected document content, `OpenActions`, frontmatter chips,
and an outline sidecar extracted from markdown headings. Headings shown in the
sidecar remove trace anchors such as `[FR-1]` and `[DES-API]`.

### [DES-DOCS-PRD-READER] PRD Reader Polish

The reader presents planning documents as a polished article:

- Hero: cleaned document title, short summary, and compact readiness metrics.
- Section highlights: first meaningful `##` sections with table syntax removed
  from excerpts so cards read like prose.
- Source document: sanitized Markdown article with duplicate leading H1 hidden.
- Right rail: quality pulse and cleaned outline for scanning.

### [DES-DOCS-STUDIO] PRD/Spec Studio

For `SPEC`, `DESIGN`, `TASKS`, and `JOURNAL` rows, the reader upgrades from a
plain preview into a document studio:

- Header: document title, type, status, owner, updated date, path, open actions.
- Quality pulse: missing owner/status/sections, linked tasks, and open questions.
- Section cards: overview, goals, requirements, scope, user stories, tasks, or
  work sessions when headings are present.
- Right rail: outline, metadata, and suggested next actions.

The studio must keep markdown as the source of truth. It renders a nicer page
from parsed headings/frontmatter but never mutates content directly.

`DocumentStudio` lives in `apps/workbench/src/lib/document-studio.tsx` so
Documents and the feature-scoped Workbench tab render the same `spec.md`,
`design.md`, and `tasks.md` with one reader contract. Documents may add the
tree, metadata toolbar, and outline sidecar around it; Workbench uses the column
variant with contextual command actions inside the paper surface.

### [DES-DOCS-LAUNCHPAD] Empty Library Launchpad

When `documents.length === 0`, Documents reuses the Workbench launchpad instead
of a dead empty state. The visible actions create sample docs or draft chat
commands so the first open of the bottom panel produces momentum.

### [DES-DOCS-MARKDOWN] Shared Markdown Preview

`MinimalMarkdown` strips frontmatter and renders GFM markdown for documents,
notes, journal previews, and Workbench spec/design/tasks columns. The shared
cleanup removes HTML comments, `@see` trace lines, and inline trace anchors from
visible prose while preserving fenced code blocks, links, tables, and task
lists.

The renderer must be safe inside both full-page Documents and narrow Workbench
columns. Prose, headings, links, and inline code wrap within their pane; tables
and fenced code blocks keep internal horizontal scrolling so ASCII diagrams and
large markdown tables remain readable without bleeding into adjacent columns.
Mermaid diagrams are not rendered yet; adding Mermaid should be a dedicated
slice that validates license output, CSP-safe SVG rendering, theming, fallback
errors, and screenshot coverage.

---

## [DES-DEC] Key Decisions

| Decision          | Options Considered                    | Choice                 | Rationale                                                        |
| ----------------- | ------------------------------------- | ---------------------- | ---------------------------------------------------------------- |
| Reader source     | Webview direct file read, host fetch  | Host fetch             | Preserves webview security boundary.                             |
| Tree model        | Render flat list, nested tree         | Nested tree            | Matches spec folder structure and reduces scan noise.            |
| Markdown renderer | Custom parser, `react-markdown` + GFM | `react-markdown` + GFM | Already supports tables and task lists used by AFX docs.         |
| Reader cleanup    | Raw source, sanitized visible copy    | Sanitized visible copy | Keeps source files traceable while making PRDs pleasant to read. |

---

## [DES-DATA] Data Model

### [DES-DOCS-DATA] Documents Data Shapes

The documents surface owns four shared types defined in
`packages/shared/src/workbench-types.ts`. Each declaration in that file should carry
`@see` to the matching anchor below.

| Type              | Owns                                               | Local @see                                         |
| ----------------- | -------------------------------------------------- | -------------------------------------------------- |
| `DocumentRow`     | One markdown row: path, kind, title, status, mtime | `[DES-DOCS-DATA]` and `[DES-DOCS-TREE]`            |
| `SearchMatch`     | One occurrence within a document (line + excerpt)  | `[DES-DOCS-DATA]`                                  |
| `SearchHit`       | A document plus its matching occurrences           | `[DES-DOCS-DATA]`                                  |
| `GhostTaskResult` | Documents-side reverse-trace summary (Impact seed) | `[DES-DOCS-DATA]` and (future) `[DES-IMPACT-DATA]` |

`DocumentRow` is delivered by Workbench state. `TreeNode`, `TypeChip`, and
`MetaChip` are UI-local helper shapes that compose `DocumentRow` for rendering.

---

## [DES-API] API Contracts

- `afxFetchDocContent { filePath }`
- `afxDocContent { filePath, content }`
- `afxOpenFile { path, mode }`

---

## [DES-FILES] File Structure

| File                                         | Purpose                                          |
| -------------------------------------------- | ------------------------------------------------ |
| `apps/workbench/src/views/documents.tsx`     | Documents view, tree, home, reader               |
| `apps/workbench/src/lib/document-studio.tsx` | Shared PRD/spec studio reader and action rail    |
| `apps/workbench/src/lib/documents.ts`        | Renderability, grouping, attention, icon helpers |
| `apps/workbench/src/lib/document-outline.ts` | Markdown heading outline                         |
| `apps/workbench/src/lib/frontmatter.ts`      | Simple frontmatter and metadata chips            |
| `apps/workbench/src/lib/markdown-cleanup.ts` | Reader-safe Markdown cleanup helpers             |
| `apps/workbench/src/lib/markdown-render.tsx` | Shared markdown preview component                |

---

## [DES-DEPS] Dependencies

- `@afx/shared` for document rows and Workbench protocol types.
- `@afx/ui` for inputs, selects, badges, resizable panes, scroll areas.
- `react-markdown` and `remark-gfm` for markdown preview.

---

## [DES-SEC] Security Considerations

The Documents tab never reads local files directly. It requests content from the
host and opens files through typed outbound messages.

---

## [DES-ERR] Error Handling

- No documents renders the shared launchpad.
- Non-renderable documents open in the editor instead of preview.
- Missing fetched content renders a loading placeholder.
- Invalid frontmatter and dates degrade to empty chips or fallback labels.

---

## [DES-TEST] Testing Strategy

- Unit tests cover `buildDocumentTree`, `parseSimpleFrontmatter`,
  `extractMetaChips`, `extractOutline`, reader cleanup, Markdown tables, reader
  content fetch, studio quality chips, and non-renderable open flow.
- E2E screenshots cover the document studio page and a real-spec-style PRD with
  tables and sanitized trace noise.

---

## [DES-ROLLOUT] Migration / Rollout Plan

1. Retarget document view/helper source refs from `220-app-workbench` to this spec.
2. Keep shared markdown rendering documented here because Documents is its primary owner.
3. Add helper tests before adding richer reader interactions.

---

## [DES-DOCS-LOC] Code Locator Map

| Map ID           | Code anchor                                                   | Messages/data                          | Tests                             |
| ---------------- | ------------------------------------------------------------- | -------------------------------------- | --------------------------------- |
| `[Docs.View]`    | `apps/workbench/src/views/documents.tsx` `Documents`          | `documents[]`, `afxFetchDocContent`    | future docs view tests            |
| `[Docs.Tree]`    | `apps/workbench/src/views/documents.tsx` `buildDocumentTree`  | `DocumentRow[]`                        | future tree test                  |
| `[Docs.Helpers]` | `apps/workbench/src/lib/documents.ts`                         | helper exports                         | future helpers tests              |
| `[Docs.Reader]`  | `DocReader` block in documents.tsx                            | `afxDocContent`, outline, front matter | documents tests                   |
| `[Docs.Studio]`  | `apps/workbench/src/lib/document-studio.tsx` `DocumentStudio` | quality pulse + next actions           | documents + workbench tests + e2e |

## [DES-DOCS-TRACE] Functional Trace Matrix

| Requirement | Design nodes                                   | Code anchors                          | Verification                      |
| ----------- | ---------------------------------------------- | ------------------------------------- | --------------------------------- |
| FR-1        | `[DES-DOCS-MOCKUP]`, `[DES-DOCS-TREE]`         | `Documents`, `DocumentTree`           | manual                            |
| FR-2        | `[DES-DOCS-DATA]` (SearchHit/SearchMatch)      | search filtering in `Documents`       | manual                            |
| FR-6        | `[DES-DOCS-HELPERS]`, `[DES-DOCS-READER]`      | helpers, `DocReader`                  | manual                            |
| FR-7/FR-10  | `[DES-DOCS-STUDIO]`, `[DES-DOCS-READER]`       | `DocumentStudio`                      | documents + workbench tests + e2e |
| FR-8        | `[DES-DOCS-LAUNCHPAD]`                         | `WorkbenchLaunchpad`                  | launchpad tests                   |
| FR-9        | `[DES-DOCS-MARKDOWN]`, `[DES-DOCS-PRD-READER]` | `markdown-cleanup`, `MinimalMarkdown` | unit + e2e                        |

---

## [DES-REFS] File Reference Map

| File                                         | Required @see                                                                                                                                |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/workbench/src/views/documents.tsx`     | `spec.md [FR-1] [FR-4] [FR-7] [FR-8]` + `design.md [DES-DOCS-TREE] [DES-DOCS-HOME] [DES-DOCS-READER] [DES-DOCS-STUDIO] [DES-DOCS-LAUNCHPAD]` |
| `apps/workbench/src/lib/documents.ts`        | `spec.md [FR-6]` + `design.md [DES-DOCS-HELPERS]`                                                                                            |
| `apps/workbench/src/lib/document-outline.ts` | `spec.md [FR-6]` + `design.md [DES-DOCS-HELPERS]`                                                                                            |
| `apps/workbench/src/lib/frontmatter.ts`      | `spec.md [FR-6]` + `design.md [DES-DOCS-HELPERS]`                                                                                            |
| `apps/workbench/src/lib/markdown-cleanup.ts` | `spec.md [FR-3] [FR-6] [FR-9]` + `design.md [DES-DOCS-MARKDOWN] [DES-DOCS-PRD-READER]`                                                       |
| `apps/workbench/src/lib/markdown-render.tsx` | `spec.md [FR-3] [FR-6] [FR-9]` + `design.md [DES-DOCS-MARKDOWN]`                                                                             |
| `apps/workbench/src/lib/document-studio.tsx` | `spec.md [FR-3] [FR-4] [FR-7] [FR-9]` + `design.md [DES-DOCS-READER] [DES-DOCS-STUDIO] [DES-DOCS-MARKDOWN]`                                  |

### [DES-DOCS-HELPERS] Document Helper Contracts

`isRenderable`, `groupByType`, `attentionFor`, `fileIconFor`,
`parseSimpleFrontmatter`, `extractMetaChips`, `slugify`, and `extractOutline`
are pure helpers used by documents, analytics attention, and markdown previews.
