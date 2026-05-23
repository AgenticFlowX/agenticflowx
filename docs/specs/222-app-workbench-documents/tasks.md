---
afx: true
type: TASKS
status: Living
owner: "@rixrix"
version: "1.1"
created_at: "2026-05-03T03:28:22.000Z"
updated_at: "2026-05-23T11:03:30.000Z"
tags: ["app", "workbench", "documents", "reader", "markdown"]
spec: spec.md
design: design.md
---

# App Workbench Documents - Implementation Tasks

---

## Task Numbering Convention

Tasks use hierarchical numbering and link to spec/design IDs.

---

## Phase 0: Traceability Migration

### 0.1 Retarget Documents Anchors

<!-- files: apps/workbench/src/views/documents.tsx, apps/workbench/src/lib/documents.ts, apps/workbench/src/lib/document-outline.ts, apps/workbench/src/lib/frontmatter.ts, apps/workbench/src/lib/markdown-render.tsx -->
<!-- @see docs/specs/222-app-workbench-documents/design.md [DES-REFS] | docs/specs/222-app-workbench-documents/spec.md [FR-1] [FR-6] -->

- [x] Point Documents view and helper files at this child spec.
- [x] Add helper-level refs for tree, home, reader, metadata, outline, and markdown.

---

## Phase 1: Helper Tests

### 1.1 Document Helper Coverage

- [x] Add focused tests for frontmatter, outline, renderability, and tree construction.

---

## Phase 2: Standalone Preview And Reader Polish

<!-- files: apps/workbench/src/preview-app.tsx, apps/workbench/src/components/doc-preview.tsx, apps/workbench/src/components/document-reader.tsx, apps/workbench/src/components/command-toolbar.tsx, apps/workbench/src/components/copy-markdown-button.tsx, apps/workbench/src/components/session-signoff-toolbar.tsx, apps/workbench/src/lib/markdown-fence.ts, apps/workbench/src/lib/markdown-table.ts, apps/workbench/src/lib/sprint-sections.ts, apps/workbench/src/lib/work-sessions.ts, apps/workbench/src/lib/reading-prefs.ts, apps/workbench/src/lib/frontmatter.ts -->
<!-- @see docs/specs/222-app-workbench-documents/spec.md [FR-11] [FR-12] [FR-13] [FR-14] [FR-15] [FR-16] [FR-17] | docs/specs/222-app-workbench-documents/design.md [DES-DOCS-PREVIEW-STANDALONE] [DES-DOCS-MARKDOWN] [DES-DOCS-READER] -->

### 2.1 Extract Reusable `<DocPreview>`

- [x] Move the `DocReader` rendering core into a `<DocPreview>` component with `mode="full" | "generic"`.
- [x] Add `isFullAfxDoc` to frontmatter helpers and drive mode selection from it.
- [x] Delegate `DocReader` to `<DocPreview mode="full">` so the Documents tab and the standalone preview share the engine.

### 2.2 Reading-First Polish

- [x] Switch the full variant to a reading-first paper sheet with `max-w-[68ch]` measure and collapsible rail (FR-12).
- [x] Clickable outline rows scroll to ID-anchored headings using the shared `slugify` helper (FR-13).
- [x] Reading-options popover (width/size/tone/font) + Focus/Zen mode persisted in guarded localStorage (FR-14).

### 2.3 Inline AFX Action Verbs

- [x] Render `<CommandToolbar>` inline above the section it affects with refine/review/code/approve verbs (FR-16).
- [x] Render per-task `Code <wbs>` buttons for open tasks in `tasks.md` and within sprint `TASKS` segments.
- [x] Split sprint documents via `<!-- SPRINT-SECTION-START -->` markers using `lib/sprint-sections.ts`.

### 2.4 Copy And Session Signoff

- [x] `<CopyMarkdownButton>` copies raw markdown source through `afxCopyMarkdown` inside the webview, browser fallback outside (FR-15).
- [x] `<SessionSignoffToolbar>` renders bulk Select-all / Approve controls above Work Sessions tables (FR-17).
- [x] Per-row Agent/Human checkboxes route through `afxToggleSession` with `line?` set to the source line.

---

## Phase 3: Verification

### 3.1 Preview Coverage

- [x] Unit tests for `PreviewApp` cover full + generic render, copy markdown, task code buttons, session toggles, bulk signoff, focus mode, outline scroll, reading prefs persistence.
- [x] Playwright e2e: `preview.spec.ts`, `preview-canonical-sprint.spec.ts`, `preview-corpus.spec.ts` (with helpers in `preview-test-helpers.ts`) cover the standalone webview boot, sprint segmentation, and the doc corpus.
- [x] Manifest test asserts the new `afx.openAfxPreview` command, title icon, submenu, and group order.

---

## Implementation Flow

```
Phase 0: Traceability Migration
    ↓
Phase 1: Helper Tests
    ↓
Phase 2: Standalone Preview And Reader Polish
    ↓
Phase 3: Verification
```

---

## Cross-Reference Index

| Task | Spec Requirement          | Design Section                                     |
| ---- | ------------------------- | -------------------------------------------------- |
| 0.1  | [FR-1], [FR-6]            | [DES-REFS]                                         |
| 1.1  | [FR-6]                    | [DES-DOCS-HELPERS]                                 |
| 2.1  | [FR-11]                   | [DES-DOCS-PREVIEW-STANDALONE]                      |
| 2.2  | [FR-12], [FR-13], [FR-14] | [DES-DOCS-PREVIEW-STANDALONE]                      |
| 2.3  | [FR-16]                   | [DES-DOCS-PREVIEW-STANDALONE], [DES-DOCS-STUDIO]   |
| 2.4  | [FR-15], [FR-17]          | [DES-DOCS-PREVIEW-STANDALONE], [DES-DOCS-MARKDOWN] |
| 3.1  | [FR-11], [FR-15], [FR-17] | [DES-TEST]                                         |

---

## Notes

- This spec owns reader/tree helpers, not the Impact Lens index.

---

## Work Sessions

<!-- IMPORTANT: This section MUST remain the LAST section in tasks.md. Do not add content below it. -->

| Date                     | Task | Action   | Files Modified                                                                                                                                                                                                                                                                                                                    | Agent | Human |
| ------------------------ | ---- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 2026-05-22T11:34:16.000Z | 2.1  | Coded    | spec.md (FR-11), design.md (DES-DOCS-PREVIEW-STANDALONE), apps/workbench/src/components/doc-preview.tsx, apps/workbench/src/components/document-reader.tsx, apps/workbench/src/views/documents.tsx, apps/workbench/src/lib/frontmatter.ts                                                                                         | [x]   | [x]   |
| 2026-05-22T11:34:16.000Z | 2.2  | Coded    | spec.md (FR-12 FR-13 FR-14), design.md, apps/workbench/src/lib/reading-prefs.ts, apps/workbench/src/lib/document-outline.ts, apps/workbench/src/lib/markdown-render.tsx, apps/workbench/src/index.css                                                                                                                             | [x]   | [x]   |
| 2026-05-22T11:34:16.000Z | 2.3  | Coded    | apps/workbench/src/components/command-toolbar.tsx, apps/workbench/src/lib/sprint-sections.ts, apps/workbench/src/lib/markdown-fence.ts, apps/workbench/src/lib/markdown-table.ts, apps/workbench/src/lib/document-studio.tsx, apps/workbench/src/lib/open-actions.tsx, apps/vscode/src/services/sprint.ts                         | [x]   | [x]   |
| 2026-05-22T11:34:16.000Z | 2.4  | Coded    | apps/workbench/src/components/copy-markdown-button.tsx, apps/workbench/src/components/session-signoff-toolbar.tsx, apps/workbench/src/lib/work-sessions.ts, packages/shared/src/workbench-protocol.ts                                                                                                                             | [x]   | [x]   |
| 2026-05-22T11:34:16.000Z | 3.1  | Verified | apps/workbench/src/preview-app.test.tsx, apps/workbench/src/lib/preview-fixtures.test-data.ts, apps/workbench/e2e/preview.spec.ts, apps/workbench/e2e/preview-canonical-sprint.spec.ts, apps/workbench/e2e/preview-corpus.spec.ts, apps/workbench/e2e/preview-test-helpers.ts, apps/vscode/src/providers/afx-code-actions.test.ts | [x]   | [x]   |
| 2026-05-23T11:03:30.000Z | 3.2  | Verified | spec.md (FR-15 FR-16 FR-17), design.md (DES-DOCS-PREVIEW-STANDALONE FR-15/16/17 sub-sections, DES-API), tasks.md (Phase 2/3, ticked checkboxes, Work Sessions backfill); pnpm verify green (315 vscode tests pass incl. preview/copy/checkbox-toggle suites)                                                                      | [x]   | [x]   |
