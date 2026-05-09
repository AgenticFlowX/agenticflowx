---
afx: true
type: DESIGN
status: Approved
owner: "@rixrix"
version: "1.0"
created_at: "2026-05-03T03:28:22.000Z"
updated_at: "2026-05-09T12:21:59.000Z"
tags: ["app", "workbench", "documents", "reader", "markdown"]
spec: spec.md
---

# App Workbench Documents - Technical Design

---

## [DES-OVR] Overview

The Documents tab is a browser-safe documentation explorer for Workbench. It
owns tree construction, type/search filtering, document content fetching,
library home metrics, reader metadata, outline extraction, and shared markdown
preview rendering.

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
and an outline sidecar extracted from markdown headings.

### [DES-DOCS-MARKDOWN] Shared Markdown Preview

`MinimalMarkdown` strips frontmatter and renders GFM markdown for documents,
notes, journal previews, and Workbench spec/design/tasks columns.

---

## [DES-DEC] Key Decisions

| Decision          | Options Considered                    | Choice                 | Rationale                                                |
| ----------------- | ------------------------------------- | ---------------------- | -------------------------------------------------------- |
| Reader source     | Webview direct file read, host fetch  | Host fetch             | Preserves webview security boundary.                     |
| Tree model        | Render flat list, nested tree         | Nested tree            | Matches spec folder structure and reduces scan noise.    |
| Markdown renderer | Custom parser, `react-markdown` + GFM | `react-markdown` + GFM | Already supports tables and task lists used by AFX docs. |

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
| `apps/workbench/src/lib/documents.ts`        | Renderability, grouping, attention, icon helpers |
| `apps/workbench/src/lib/document-outline.ts` | Markdown heading outline                         |
| `apps/workbench/src/lib/frontmatter.ts`      | Simple frontmatter and metadata chips            |
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

- No documents renders an empty state.
- Non-renderable documents open in the editor instead of preview.
- Missing fetched content renders a loading placeholder.
- Invalid frontmatter and dates degrade to empty chips or fallback labels.

---

## [DES-TEST] Testing Strategy

- Future unit tests for `buildDocumentTree`, `parseSimpleFrontmatter`,
  `extractMetaChips`, `extractOutline`, and `isRenderable`.
- React tests for home stats, reader content fetch, and non-renderable open flow.

---

## [DES-ROLLOUT] Migration / Rollout Plan

1. Retarget document view/helper source refs from `220-app-workbench` to this spec.
2. Keep shared markdown rendering documented here because Documents is its primary owner.
3. Add helper tests before adding richer reader interactions.

---

## [DES-DOCS-LOC] Code Locator Map

| Map ID           | Code anchor                                                  | Messages/data                          | Tests                  |
| ---------------- | ------------------------------------------------------------ | -------------------------------------- | ---------------------- |
| `[Docs.View]`    | `apps/workbench/src/views/documents.tsx` `Documents`         | `documents[]`, `afxFetchDocContent`    | future docs view tests |
| `[Docs.Tree]`    | `apps/workbench/src/views/documents.tsx` `buildDocumentTree` | `DocumentRow[]`                        | future tree test       |
| `[Docs.Helpers]` | `apps/workbench/src/lib/documents.ts`                        | helper exports                         | future helpers tests   |
| `[Docs.Reader]`  | `DocReader` block in documents.tsx                           | `afxDocContent`, outline, front matter | manual                 |

## [DES-DOCS-TRACE] Functional Trace Matrix

| Requirement | Design nodes                              | Code anchors                    | Verification |
| ----------- | ----------------------------------------- | ------------------------------- | ------------ |
| FR-1        | `[DES-DOCS-MOCKUP]`, `[DES-DOCS-TREE]`    | `Documents`, `DocumentTree`     | manual       |
| FR-2        | `[DES-DOCS-DATA]` (SearchHit/SearchMatch) | search filtering in `Documents` | manual       |
| FR-6        | `[DES-DOCS-HELPERS]`, `[DES-DOCS-READER]` | helpers, `DocReader`            | manual       |

---

## [DES-REFS] File Reference Map

| File                                         | Required @see                                                                           |
| -------------------------------------------- | --------------------------------------------------------------------------------------- |
| `apps/workbench/src/views/documents.tsx`     | `spec.md [FR-1] [FR-4]` + `design.md [DES-DOCS-TREE] [DES-DOCS-HOME] [DES-DOCS-READER]` |
| `apps/workbench/src/lib/documents.ts`        | `spec.md [FR-6]` + `design.md [DES-DOCS-HELPERS]`                                       |
| `apps/workbench/src/lib/document-outline.ts` | `spec.md [FR-6]` + `design.md [DES-DOCS-HELPERS]`                                       |
| `apps/workbench/src/lib/frontmatter.ts`      | `spec.md [FR-6]` + `design.md [DES-DOCS-HELPERS]`                                       |
| `apps/workbench/src/lib/markdown-render.tsx` | `spec.md [FR-3] [FR-6]` + `design.md [DES-DOCS-MARKDOWN]`                               |

### [DES-DOCS-HELPERS] Document Helper Contracts

`isRenderable`, `groupByType`, `attentionFor`, `fileIconFor`,
`parseSimpleFrontmatter`, `extractMetaChips`, `slugify`, and `extractOutline`
are pure helpers used by documents, analytics attention, and markdown previews.
