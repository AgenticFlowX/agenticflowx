---
afx: true
type: DESIGN
status: Approved
owner: "@rixrix"
version: "1.1"
created_at: "2026-04-26T04:32:48.000Z"
updated_at: "2026-05-02T00:02:41.000Z"
tags: [app, workbench, webview, tasks, journal, board]
spec: spec.md
---

# apps/workbench — Technical Design

---

## [DES-OVR] Overview

`apps/workbench` is a React + Vite webview for the VSCode bottom panel. It provides tab-based navigation over spec-driven views (Tasks, Journal, Board, Pipeline, Documents, Notes, Analytics). The host (`apps/vscode`) scans the workspace, parses spec/design/tasks/journal markdown via `@afx/parsers`, and pushes typed `WorkbenchInbound` messages to the webview. The webview replies with `WorkbenchOutbound` for file open/save, task toggles, note appends, etc.

---

## [DES-ARCH] Architecture

```text
apps/workbench/src/
├── main.tsx                   ← entry point — calls initWorkbenchBridge()
├── app.tsx                    ← root + WorkbenchProvider wrap
├── index.css                  ← imports @afx/ui globals + .afx-surface-* utilities
├── lib/
│   ├── bridge.ts              ← initWorkbenchBridge / workbenchSend / workbenchOn
│   ├── pipeline.ts            ← pure pipeline transformations
│   ├── documents.ts           ← document grouping/attention helpers
│   ├── analytics.ts           ← analytics snapshot builder
│   ├── document-outline.ts    ← markdown TOC extraction
│   └── frontmatter.ts         ← metadata chip extraction
├── hooks/
│   ├── use-local-storage.ts
│   ├── use-backlinks-scan.ts
│   └── use-feature-enrichment.ts
├── context/
│   └── workbench-context.tsx  ← WorkbenchProvider + useWorkbench hook
├── views/
│   ├── workbench.tsx          ← Feature-scoped 4-column workbench
│   ├── notes.tsx              ← Quick notes timeline
│   ├── journal.tsx            ← Journal entries
│   ├── board.tsx              ← Kanban with DnD
│   ├── pipeline.tsx           ← Pipeline timeline/grid/kanban
│   ├── documents.tsx          ← Documents browser + reader
│   └── analytics.tsx          ← Project analytics
└── components/
    └── coming-soon.tsx        ← (kept for future tabs)
```

Host side (`apps/vscode/src/`):

```text
models/feature.ts              ← Feature data model
services/specs-data.ts         ← workspace scanner — getFeatures + getPanelData
panels/workbench-panel.ts      ← webview provider + dispatch + initial push
```

---

## [DES-UI] User Interface & UX

### Tabs

7 tabs at top: Workbench, Pipeline, Documents, Analytics, Journal, Board, Notes.

### Empty States

Every view that can have zero data uses `@afx/ui/components/empty` with friendly action-oriented copy:

| Tab       | Title               | Description                                          |
| --------- | ------------------- | ---------------------------------------------------- |
| Notes     | No notes yet        | Type a note and press Enter to capture it.           |
| Board     | No boards found     | Create a board to track tasks and ideas.             |
| Journal   | No discussions yet  | Run /afx-session note in chat to capture a decision. |
| Pipeline  | No features found   | Run /afx-scaffold spec my-feature to get started.    |
| Documents | No documents found  | AFX documents live in docs/specs/.                   |
| Analytics | Nothing to analyze  | Add features and tasks to see metrics here.          |
| Workbench | No feature selected | Select a feature from the dropdown above.            |

### Loading States

Skeleton placeholders while data loads (`isLoading: true` from context).

### Surface Hierarchy

```css
.afx-surface-subtle  → background mix
.afx-surface-card    → card surface
.afx-surface-toolbar → toolbar mix
.afx-field-surface   → input field mix
```

### Status Badges

Consistent color mapping across Journal, Pipeline, Documents (see migration plan `## UX Standards`).

---

## [DES-API] API Contracts

### Workbench Protocol

`WorkbenchInbound` (host → webview):

```typescript
type WorkbenchInbound =
  | {
      type: "afxUpdate";
      pipeline?: PipelineRow[];
      featureTasks?: FeatureTasksData[];
      documents?: DocumentRow[];
      journal?: JournalEntry[];
      kanban?: KanbanData | null;
      notes?: QuickNote[];
      notesFilePath?: string;
      ghostTasks?: GhostTaskResult;
    }
  | { type: "afxDocContent"; filePath: string; content: string };
```

`WorkbenchOutbound` (webview → host):

```typescript
type WorkbenchOutbound =
  | { type: "afxOpenFile"; path: string; mode: "editor" | "preview"; line?: number }
  | { type: "afxFetchDocContent"; filePath: string }
  | { type: "afxSelectFeature"; name: string }
  | { type: "afxChangeStatus"; filePath: string; status: string }
  | { type: "afxToggleTask"; path: string; line: number; completed: boolean }
  | {
      type: "afxToggleSession";
      filePath: string;
      sessionIndex: number;
      column: string;
      completed: boolean;
    }
  | { type: "afxSaveFile"; path: string; content: string }
  | { type: "afxAppendNote"; text: string }
  | { type: "afxDeleteNote"; timestamp: string };
```

### Bridge

```typescript
function initWorkbenchBridge(): void; // call once in main.tsx
function workbenchSend(msg: WorkbenchOutbound): void;
function workbenchOn<T extends WorkbenchInbound["type"]>(
  type: T,
  handler: (msg: Extract<WorkbenchInbound, { type: T }>) => void,
): () => void;
```

---

## [DES-FILES] File Structure

| File                                               | Purpose                  |
| -------------------------------------------------- | ------------------------ |
| `apps/workbench/src/main.tsx`                      | Entry point              |
| `apps/workbench/src/app.tsx`                       | Root + WorkbenchProvider |
| `apps/workbench/src/lib/bridge.ts`                 | Transport bridge         |
| `apps/workbench/src/context/workbench-context.tsx` | State context + hook     |
| `apps/workbench/src/views/*.tsx`                   | Tab views                |

---

## [DES-DEPS] Dependencies

| Package             | Purpose                |
| ------------------- | ---------------------- |
| `@afx/shared`       | Domain types, protocol |
| `@afx/ui`           | Components             |
| `@dnd-kit/core`     | Board column DnD       |
| `@dnd-kit/sortable` | Card sorting           |
| `react-markdown`    | Markdown preview       |
| `remark-gfm`        | GFM tables, task lists |

---

## [DES-DATA] Data Model

See `WorkbenchInbound` / `WorkbenchOutbound` above. All types live in `packages/shared/src/workbench-types.ts` and `packages/shared/src/workbench-protocol.ts`.

---

## [DES-NOTES] Notes View

- Left: textarea (Enter=save, Shift+Enter=newline) + button
- Right: timeline grouped by date with sticky headers
- Send `afxAppendNote { text }` on submit
- Send `afxDeleteNote { timestamp }` on delete

## [DES-BOARD] Board View

- Selector for boards in `.afx/boards/*.md`
- View toggle: visual ↔ raw markdown editor
- Columns horizontal DnD via `@dnd-kit/sortable`
- Cards within column draggable
- Send `afxSaveFile { path, content }` on changes

## [DES-JOURNAL] Journal View

- Left: list with search + status + feature filters
- Right: entry preview pane
- Status badge color: active=purple, blocked=amber, closed=green

## [DES-PIPELINE] Pipeline View

- Three modes: timeline / grid / kanban
- Persisted via `useLocalStorage("afx-pipeline-view", ...)`
- Search + status + sort filters

## [DES-DOCS] Documents View

- Left resizable: type filter + search + tree
- Right resizable: home / reader / search states
- Escape returns home

## [DES-ANALYTICS] Analytics View

- Range selector: 7d / 30d / 90d / all
- KPI cards + stage breakdown + up-next + trends + attention + traceability

## [DES-WORKBENCH-VIEW] Workbench Tab

- Feature selector dropdown
- 4 columns: SPEC, DESIGN, TASKS, SESSIONS
- Per-column view mode: preview / edit / external
- Resizable panel widths persisted

---

## [DES-SEC] Security Considerations

- All filesystem operations happen in the host
- Webview sends paths only — host validates and resolves against workspace root
- No shell execution
- Standard VSCode webview CSP

---

## [DES-ERR] Error Handling

- Parse failures on host: do not write file, log structured error
- Webview shows inline error via destructive-bordered banner (no alert dialogs)

---

## [DES-TEST] Testing Strategy

### Unit Tests (Vitest + RTL)

- All views have co-located `.test.tsx`
- Context provider has `.test.tsx`
- Bridge has `.test.ts`
- All lib/_and hooks/_ have `.test.ts`
- Coverage threshold: 70%

### E2E Tests (Playwright)

- `apps/workbench/e2e/workbench.spec.ts`
- Runs against Vite dev server
- Mock transport auto-selected in browser

---

## [DES-ROLLOUT] Rollout Plan

Workbench rollout follows the plan in `docs/specs/000-plans/plan-workbench-traceability-migration.md`. Host data push lives in `apps/vscode/src/services/specs-data.ts` and is wired into `apps/vscode/src/panels/workbench-panel.ts`.

---

## File Reference Map

| Task | File                                               | Required @see                                        |
| ---- | -------------------------------------------------- | ---------------------------------------------------- |
| —    | `apps/workbench/src/main.tsx`                      | `spec.md [FR-2]` + `design.md [DES-ARCH]`            |
| —    | `apps/workbench/src/app.tsx`                       | `spec.md [FR-1]` + `design.md [DES-UI]`              |
| —    | `apps/workbench/src/lib/bridge.ts`                 | `spec.md [FR-3]` + `design.md [DES-API]`             |
| —    | `apps/workbench/src/context/workbench-context.tsx` | `spec.md [FR-3]` + `design.md [DES-API]`             |
| —    | `apps/workbench/src/views/workbench.tsx`           | `spec.md [FR-10]` + `design.md [DES-WORKBENCH-VIEW]` |
| —    | `apps/workbench/src/views/notes.tsx`               | `spec.md [FR-4]` + `design.md [DES-NOTES]`           |
| —    | `apps/workbench/src/views/board.tsx`               | `spec.md [FR-5]` + `design.md [DES-BOARD]`           |
| —    | `apps/workbench/src/views/journal.tsx`             | `spec.md [FR-6]` + `design.md [DES-JOURNAL]`         |
| —    | `apps/workbench/src/views/pipeline.tsx`            | `spec.md [FR-7]` + `design.md [DES-PIPELINE]`        |
| —    | `apps/workbench/src/views/documents.tsx`           | `spec.md [FR-8]` + `design.md [DES-DOCS]`            |
| —    | `apps/workbench/src/views/analytics.tsx`           | `spec.md [FR-9]` + `design.md [DES-ANALYTICS]`       |
