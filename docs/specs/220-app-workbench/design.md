---
afx: true
type: DESIGN
status: Living
owner: "@rixrix"
version: "1.2"
created_at: "2026-04-26T04:32:48.000Z"
updated_at: "2026-05-17T09:04:20.000Z"
tags:
  [
    "app",
    "workbench",
    "webview",
    "tasks",
    "journal",
    "board",
    "pipeline",
    "documents",
    "notes",
    "analytics",
    "traceability",
  ]
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

### [DES-WORKBENCH-TABS] Tabs

7 tabs at top: Workbench, Pipeline, Documents, Analytics, Journal, Board, Notes.

### [DES-WORKBENCH-EMPTY-STATES] Empty States

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

### [DES-WORKBENCH-LOADING] Loading States

Skeleton placeholders while data loads (`isLoading: true` from context).

### [DES-WORKBENCH-SURFACE-TOKENS] Surface Hierarchy

```css
.afx-surface-subtle  → background mix
.afx-surface-card    → card surface
.afx-surface-toolbar → toolbar mix
.afx-field-surface   → input field mix
```

### [DES-WORKBENCH-STATUS-BADGES] Status Badges

Consistent color mapping across Journal, Pipeline, Documents (see migration plan `## UX Standards`).

---

## [DES-WORKBENCH-MOCKUPS] ASCII UI Mockups

<!-- @see spec.md [FR-1] [FR-10] [FR-11] [FR-12] -->

These mockups are the stable visual contract for the bottom-panel webview. They
are intentionally component-aware so a future change can target one visible
region without rereading every Workbench view.

### [DES-WORKBENCH-MOCKUP-SHELL] Bottom Panel Shell

```text
+--------------------------------------------------------------------------------+
| Workbench | Pipeline | Documents | Analytics | Journal | Board | Notes         |
+--------------------------------------------------------------------------------+
|                                                                                |
| <TabsContent> one selected view owns this scroll/resize region                  |
|                                                                                |
| Workbench tab: feature columns                                                  |
| Pipeline tab: timeline/grid/kanban feature progress                             |
| Documents tab: document tree + reader                                           |
| Analytics tab: KPIs, stages, trends, attention                                  |
| Journal tab: searchable decisions + preview                                     |
| Board tab: markdown-backed kanban                                               |
| Notes tab: quick capture + timeline                                             |
|                                                                                |
+--------------------------------------------------------------------------------+
```

Source anchors:

- `apps/workbench/src/app.tsx` `WorkbenchShell`
- `apps/workbench/src/app.tsx` `WorkbenchTabTrigger`

### [DES-WORKBENCH-MOCKUP-FOUR-COLUMN] Feature Four-Column View

```text
+--------------------------------------------------------------------------------+
| [Feature selector]  progress  status                     [SPEC][DESIGN][TASKS] |
+--------------------------------------------------------------------------------+
| +----------------+ +----------------+ +----------------+ +-------------------+ |
| | SPEC           | | DESIGN         | | TASKS          | | SESSIONS          | |
| | [open/preview] | | [open/preview] | | phase progress | | date/task/action  | |
| | markdown       | | markdown       | | task checkboxes| | agent/human ticks | |
| +----------------+ +----------------+ +----------------+ +-------------------+ |
+--------------------------------------------------------------------------------+
| spec: Approved (2d)   design: Draft (5d)   tasks: In Progress                  |
+--------------------------------------------------------------------------------+
```

Source anchors:

- `apps/workbench/src/views/workbench.tsx` `Workbench`
- `apps/workbench/src/views/workbench.tsx` `ColumnDoc`
- `apps/workbench/src/views/workbench.tsx` `ColumnTasks`
- `apps/workbench/src/views/workbench.tsx` `ColumnSessions`
- `apps/workbench/src/views/workbench.tsx` `DriftIndicator`

### [DES-WORKBENCH-MOCKUP-LOADING-EMPTY] Loading And Empty States

```text
+------------------------------------------+
| Loading AgenticFlowX workspace...         |
| Parsing docs/specs, journal, notes...     |
+------------------------------------------+

+------------------------------------------+
| No features found                         |
| Run /afx-scaffold in chat to create one.  |
+------------------------------------------+

+------------------------------------------+
| No columns visible                        |
| Toggle a column above to get started.     |
+------------------------------------------+
```

Source anchors:

- `apps/workbench/src/app.tsx` `WorkbenchShell` loading card
- `apps/workbench/src/views/workbench.tsx` loading skeleton and empty states

---

## [DES-WORKBENCH-SHELL] Shell, State, And Bridge Ownership

<!-- @see spec.md [FR-1] [FR-2] [FR-3] [FR-12] -->

```text
main.tsx
|-- initWorkbenchBridge()
|-- workbenchOn("afxAppearanceUpdated") -> applyAppearanceClass()
|-- workbenchOn("afxTelemetryUpdated")  -> setClarityEnabled()
`-- createRoot(<App />)

App
|-- browser-dev mock selection via MOCK_WORKBENCH_STATE
`-- WorkbenchProvider
    `-- WorkbenchShell
        |-- Loading card when context is loading
        |-- TabsList / WorkbenchTabTrigger x 7
        `-- TabsContent -> view components

WorkbenchProvider
|-- workbenchOn("afxUpdate") -> reducer merge
|-- send -> workbenchSend
`-- selectFeature -> local state + afxSelectFeature
```

### [DES-WORKBENCH-ENTRY] Entry Point

`apps/workbench/src/main.tsx` must initialize the bridge before rendering React
and must keep appearance/telemetry bridge subscriptions outside individual view
components.

### [DES-WORKBENCH-STATE] Context State Reducer

`WorkbenchProvider` owns the merged view state for pipeline, tasks, documents,
journal, kanban, notes, ghost tasks, selected feature, and loading state. The
reducer must preserve previous slices when partial `afxUpdate` messages omit a
field.

### [DES-WORKBENCH-BRIDGE] Webview Bridge

`initWorkbenchBridge` chooses the VSCode webview API when available and falls
back to `window.parent.postMessage` in browser development. `workbenchOn`
subscribes by typed inbound message, and `workbenchSend` owns the dev-only mock
document-content path for `afxFetchDocContent`.

### [DES-WORKBENCH-MOCK-DATA] Browser Development Data

`MOCK_WORKBENCH_STATE` exists only for browser development when no VSCode host
bridge is present. It must mimic `afxUpdate` payload shape and avoid extension
host or filesystem assumptions.

### [DES-WORKBENCH-OPEN-ACTIONS] Open Actions

`OpenActions` is the tiny editor/preview affordance shared by markdown preview
surfaces. It sends `afxOpenFile` only; host-side path validation remains outside
the webview.

### [DES-WORKBENCH-HOST-PANEL] Extension Host Panel

`apps/vscode/src/panels/workbench-panel.ts` owns the VSCode `WebviewViewProvider`
for the bottom panel. It loads the Workbench build, posts initial/refresh data,
watches docs/specs plus `.afx` files, and dispatches `WorkbenchOutbound`
messages to host services.

### [DES-WORKBENCH-HOST-DATA] Host Data Provider

`apps/vscode/src/services/specs-data.ts` scans workspace docs, parses AFX
documents, derives pipeline/documents/journal/board/notes payloads, and returns
the `afxUpdate` data consumed by `WorkbenchProvider`.

### [DES-WORKBENCH-SPRINT-SLICER] Sprint Section Slicer

`apps/vscode/src/services/sprint.ts` converts single-document sprint files into
virtual SPEC/DESIGN/TASKS/SESSIONS slices so Workbench columns can render them
like normal three-file specs.

---

## [DES-API] API Contracts

### [DES-WORKBENCH-PROTOCOL] Workbench Protocol

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

### [DES-WORKBENCH-BRIDGE-API] Bridge

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

`DES-NOTES` is the umbrella node for FR-4. Source should reference the smaller
children below when it implements a particular pane, card, or helper.

### [DES-WORKBENCH-NOTES-MOCKUP] Notes ASCII

```text
Surface: Workbench.Notes
@see apps/workbench/src/views/notes.tsx Notes

┌──────────────────────── Capture ───────────────────────┬──────────────────────── notes.md timeline ───────────────────────┐
│ .afx/notes.md                                           │ [timeline] 12/18  [search notes........] [All][Today][Week][Month] │
│                                                         │ [Open in editor] [Open in preview]                                  │
│ ┌─────────────────────────────────────────────────────┐ │                                                                    │
│ │ Quick note…                                         │ │ Today                                      May 3, 2026        3   │
│ │ Enter to save, Shift+Enter for newline              │ │  ├─ 1:14:15 PM · today                                           │
│ │ Markdown supported                                  │ │  │  Markdown rendered note body                                   │
│ └─────────────────────────────────────────────────────┘ │  │  [hover/focus: edit] [delete]                                  │
│ [Save]                                                  │  └─ 11:02:08 AM · today                                          │
│                                                         │ Yesterday                                  May 2, 2026        4   │
│ 18 notes · 5 days                                      │  └─ timestamped notes grouped newest-first                       │
└─────────────────────────────────────────────────────────┴────────────────────────────────────────────────────────────────────┘
```

### [DES-WORKBENCH-NOTES-CAPTURE] Capture Pane

`Notes` owns the left `ResizablePanel`, textarea focus affordance, Enter vs
Shift+Enter policy, disabled save button, footer counts, and outbound
`afxAppendNote { text }` message. Empty and loading states remain inside the
timeline pane so capture is always reachable.

### [DES-WORKBENCH-NOTES-FILTERS] Timeline Filters

The right toolbar owns search, `DATE_FILTERS`, visible count, date-window
selection (`all`, `today`, `week`, `month`), and `OpenActions` for the notes
file. Filtering is client-side and combines text match with `getDateRange`.

### [DES-WORKBENCH-NOTES-TIMELINE] Grouped Timeline

`DateSection` renders sticky day headers and ordered note lists. `groupByDate`
sorts groups newest-first and sorts notes within each date by timestamp
descending.

### [DES-WORKBENCH-NOTES-ITEM] Note Item Editing

`NoteItem` renders each markdown note body via `MinimalMarkdown`, reveals edit
and delete actions on hover/focus, sends `afxDeleteNote { timestamp }`, and
saves edits with `afxEditNote { timestamp, text }`. Editing supports
Cmd/Ctrl+Enter to save and Escape to cancel.

### [DES-WORKBENCH-NOTES-TIME] Note Time Formatting

`humanizeTimestamp`, `relativeTimestamp`, `formatClock`, `parseDate`, and
`startOfDay` keep display deterministic: primary time includes seconds,
secondary relative text is best-effort, and invalid timestamps fall back to
raw values.

## [DES-BOARD] Board View

`DES-BOARD` is the umbrella node for FR-5. Source should reference the smaller
children below for serialization, board selection, card/column composition, and
save behavior.

### [DES-WORKBENCH-BOARD-MOCKUP] Board ASCII

```text
Surface: Workbench.Board
@see apps/workbench/src/views/board.tsx Board

┌──────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ [board select: Roadmap v] [rename] [delete] [quick chips: Roadmap Backlog Q2]      active 3 cols · 9 cards │
│                                                                    [Open] [Preview] [Column] [New board] │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ ┌──────────── Todo ────────────┐ ┌────────── In Progress ────────┐ ┌──────────── Done ────────────┐      │
│ │ grip · Todo        (3) ← → ✎ │ │ grip · In Progress (4) ← → ✎ │ │ grip · Done        (2) ← → ✎ │      │
│ │ ┌──────────────────────────┐ │ │ ┌──────────────────────────┐ │ │ ┌──────────────────────────┐ │      │
│ │ │ Card title               │ │ │ │ Drag/drop card           │ │ │ │ Completed card           │ │      │
│ │ │ body preview up to 3ln   │ │ │ │ [hover: edit/delete]     │ │ │ │                          │ │      │
│ │ └──────────────────────────┘ │ │ └──────────────────────────┘ │ │ └──────────────────────────┘ │      │
│ │ [Add card.................]+ │ │ [Add card.................]+ │ │ [Add card.................]+ │      │
│ └──────────────────────────────┘ └──────────────────────────────┘ └──────────────────────────────┘      │
│ Dialogs: new board · rename board · delete confirm · edit column/card                                    │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### [DES-WORKBENCH-BOARD-SERIALIZATION] Markdown Serialization

`serializeBoard` preserves any raw frontmatter/preamble before the first
matching column heading, emits columns as `##`, simple one-line cards as `-`,
and multiline cards as `### title` plus body. `escapeRegExp` protects heading
matching and `replaceBoard` applies optimistic local replacement by file path.

### [DES-WORKBENCH-BOARD-TOOLBAR] Board Selector And Dialogs

`Board` owns board selection, latest-five quick-pick chips, create/rename/delete
dialogs, selected file `OpenActions`, status metadata, total column/card counts,
and the short saving indicator.

### [DES-WORKBENCH-BOARD-CARD] Kanban Card

`KanbanCard` is the draggable card unit. It splits text into title/body, exposes
edit/delete controls on hover/focus, supports double-click edit, and delegates
drag/drop events back to `Board`.

### [DES-WORKBENCH-BOARD-COLUMN] Kanban Column

`KanbanColumn` renders a draggable column header, move-left/right controls,
delete gating while cards remain, empty drop target copy, add-card input, and
card drop targets. Drop-target styles are driven by `isDropTarget`,
`isColumnDragSource`, and `isColumnDropTarget`.

### [DES-WORKBENCH-BOARD-SAVE] Optimistic Save Flow

`saveBoard` updates local boards immediately, sends
`afxSaveFile { path, content }`, then shows a transient saving indicator.
Create, rename, and delete use dedicated outbound messages and clear local
selection so the next host update becomes authoritative.

## [DES-JOURNAL] Journal View

`DES-JOURNAL` is the umbrella node for FR-6. Source should reference the smaller
children below for filtering, timeline cards, preview content, and time helpers.

### [DES-WORKBENCH-JOURNAL-MOCKUP] Journal ASCII

```text
Surface: Workbench.Journal
@see apps/workbench/src/views/journal.tsx Journal

┌──────────────────────── filters ────────────────────────────────────────────────────────────────────────┐
│ [Today][Week][Month][Year][All] [Search.................] [All status v]                               │
│ 14 of 22 · 7 features · 2 blocked · 6 active                 Auto-written by skills · /afx-session log │
├──────────────────────── timeline ───────────────────────┬──────────────────────── preview ─────────────┤
│ Today                                      May 3       4 │ active AUTH-D001 · feature-name      [Open] │
│  ● AUTH-D001 feature-name         2d                    │ Session title                              │
│    Decision captured with short context                  │ [decision chip] [decision chip]           │
│  ● AUTH-D002 feature-name                               │                                           │
│ Yesterday                                  May 2       3 │ Summary paragraph                          │
│  ● ...                                                   │ Rendered markdown body with redundant      │
│                                                         │ header trimmed                             │
└─────────────────────────────────────────────────────────┴───────────────────────────────────────────────┘
```

### [DES-WORKBENCH-JOURNAL-FILTERS] Journal Filters

`Journal` owns time chips, search, status select, feature/status counts, and the
auto-written label. Filtering combines `isInTimeRange`, status, and text match
across title, id, feature, context, and summary.

### [DES-WORKBENCH-JOURNAL-CARD] Journal Timeline Card

`JournalCard` renders compact session identity, status dot/color, feature slug,
decision count badge, title, and context/summary preview. Selection is visual
only and updates the preview pane.

### [DES-WORKBENCH-JOURNAL-PREVIEW] Journal Preview Pane

`PreviewPanel` fetches entry markdown with `afxFetchDocContent`, listens for
`afxDocContent`, displays status metadata, decisions, `OpenActions`, summary,
and `MinimalMarkdown` content.

### [DES-WORKBENCH-JOURNAL-TIME] Journal Time And Header Helpers

`formatDateHeader`, `formatShortDate`, `groupByDate`, `isInTimeRange`, and
`trimRedundantHeader` keep timeline grouping, labels, and preview content stable
without changing host data.

## [DES-PIPELINE] Pipeline View

`DES-PIPELINE` is the umbrella node for FR-7. Source should reference the
smaller children below for mode selection, summary, cards, next actions, and
pure pipeline helpers.

### [DES-WORKBENCH-PIPELINE-MOCKUP] Pipeline ASCII

```text
Surface: Workbench.Pipeline
@see apps/workbench/src/views/pipeline.tsx Pipeline

┌──────────────────────────────────────────────────────────────────────────────┐
│ [Search features...........] [All statuses v]             [Simple][Timeline][Grid] │
├──────────────────────────── simple overview ────────────────────────────────┤
│ Pipeline overview                                                           │
│ ┌ Features 12 ┐ ┌ Tasks 42/70 60% ┐ ┌ In flight 5 ┐ ┌ Complete 3 ┐         │
│ progress bar                                                               │
│ [In progress 3] [Ready 2] [Blocked 1] [Not started 6] [Complete 3]         │
│ Up next 6/12                                                               │
│ ┌ feature-name                                      [In progress] ┐        │
│ │ → Continue tasks                                  progress 2/5  │        │
│ └─────────────────────────────────────────────────────────────────┘        │
└──────────────────────────────────────────────────────────────────────────────┘
```

### [DES-WORKBENCH-PIPELINE-FILTERS] Pipeline Filters And Mode

`Pipeline` owns search, status filter, and persisted view mode
`afx-pipeline-view-v3`. The mode selector is a tablist with Simple, Timeline,
and Grid buttons.

### [DES-WORKBENCH-PIPELINE-SIMPLE] Simple Pipeline Overview

`SimplePipelineView` renders summary KPI tiles, total progress, per-status mini
counts, and the up-next list. It is the default mode for fastest project-state
read.

### [DES-WORKBENCH-PIPELINE-GROUPED] Grouped Timeline And Grid

`GroupedPipelineView` renders features grouped by `GroupStatus`; timeline mode
uses a vertical list, grid mode switches to responsive cards.

### [DES-WORKBENCH-PIPELINE-CARD] Pipeline Card

`PipelineCard`, `PipelineNextRow`, `SummaryTile`, and `FileBadges` render
feature progress, next action links, status badges, and available spec/design/
tasks file badges. Clickable next actions send `afxOpenFile` in preview mode.

### [DES-WORKBENCH-PIPELINE-HELPERS] Pipeline Helper Contracts

`healthPct`, `getGroupStatus`, `getNextAction`, `groupByFeatureStatus`,
`formatShortDate`, and `formatRelativeTime` are pure transformations from
`PipelineRow` into UI state.

## [DES-DOCS] Documents View

`DES-DOCS` is the umbrella node for FR-8. Source should reference the smaller
children below for the tree, library home, reader, metadata helpers, and
markdown rendering.

### [DES-WORKBENCH-DOCS-MOCKUP] Documents ASCII

```text
Surface: Workbench.Documents
@see apps/workbench/src/views/documents.tsx Documents

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

### [DES-WORKBENCH-DOCS-TREE] Document Tree And Filters

`Documents` owns type filtering, search, selected document state, expanded tree
state, content cache, and non-renderable file fallback to `afxOpenFile`.
`buildDocumentTree` converts flat `DocumentRow` data into nested `TreeNode`
entries.

### [DES-WORKBENCH-DOCS-HOME] Documents Home

`DocumentsHome` renders the knowledge-base header, type chips, recent document
list, and stat tiles. It derives counts with `computeStats`, `recentDocs`,
`featureFromPath`, `docDisplayName`, `formatShortDate`, and `formatRelative`.

### [DES-WORKBENCH-DOCS-READER] Reader Pane And Outline

`DocReader` renders selected document content, `OpenActions`, frontmatter chips,
and an outline sidecar extracted from markdown headings.

### [DES-WORKBENCH-DOCS-HELPERS] Document Helper Contracts

`isRenderable`, `groupByType`, `attentionFor`, `fileIconFor`,
`parseSimpleFrontmatter`, `extractMetaChips`, `slugify`, and `extractOutline`
are pure helpers used by documents, analytics attention, and markdown readers.

### [DES-WORKBENCH-DOCS-MARKDOWN] Shared Markdown Preview

`MinimalMarkdown` strips frontmatter and renders GFM markdown for notes,
journal previews, document reader panes, and Workbench spec/design/tasks columns.
It owns the rendered typography, tables, links, task-list checkboxes, and code
block treatment.

## [DES-ANALYTICS] Analytics View

`DES-ANALYTICS` is the umbrella node for FR-9. Source should reference the
smaller children below for range, KPI cards, stage bar, heatmap, and snapshot
helpers.

### [DES-WORKBENCH-ANALYTICS-MOCKUP] Analytics ASCII

```text
Surface: Workbench.Analytics
@see apps/workbench/src/views/analytics.tsx Analytics

┌──────────────────────────────────────────────────────────────────────────────┐
│ Analytics overview                                             [7d][30d][90d][All] │
├──────────────────────────────────────────────────────────────────────────────┤
│ ┌ Tasks ───────┐ ┌ Sessions ───────────────┐ ┌ Streak ───────────────┐       │
│ │ 42 / 70      │ │ 18 · 9 active days      │ │ 3d · best 8d          │       │
│ │ progress bar │ │ sparkline trend         │ │ On a roll             │       │
│ └──────────────┘ └─────────────────────────┘ └───────────────────────┘       │
│ ┌ Pipeline ───────────────────────────────────────────┐ ┌ Top feature ─────┐ │
│ │ 12 features                                         │ │ feature-name     │ │
│ │ [done][build][design][specify][backlog]             │ │ Most sessions    │ │
│ │ Done 3 Build 4 Design 2 Specify 1 Backlog 2         │ │ [2 in flight]    │ │
│ └─────────────────────────────────────────────────────┘ └──────────────────┘ │
│ Activity 2026-04-04 → 2026-05-03                                             │
│ ░░ ░▒ ▒▓ █ contribution-style heatmap by week (Mon..Sun rows)                │
│ Less ░ ▒ ▓ █ More                                                            │
└──────────────────────────────────────────────────────────────────────────────┘
```

### [DES-WORKBENCH-ANALYTICS-RANGE] Analytics Range Header

`Analytics` persists `Range` in `afx-analytics-range`, recalculates
`buildSnapshot`, and renders 7d/30d/90d/All controls with `aria-pressed`.

### [DES-WORKBENCH-ANALYTICS-HEADLINE] Headline Cards

`HeadlineCard` renders Tasks, Sessions, and Streak cards. Tasks use
`Progress`; Sessions can embed `Sparkline`; Streak color changes based on
active streak state.

### [DES-WORKBENCH-ANALYTICS-SPARKLINE] Sessions Sparkline

`Sparkline` turns heatmap counts into a responsive inline SVG area + polyline
with an accessible trend label and no extra runtime dependency.

### [DES-WORKBENCH-ANALYTICS-STAGE] Stage Breakdown

`StageBar` and `StageDot` render done/build/design/specify/backlog distribution.
`StageBar` guards zero-feature state with a muted empty bar.

### [DES-WORKBENCH-ANALYTICS-TOP-FEATURE] Top Feature Attention Badges

The top-feature card displays the most active feature in range and conditionally
shows in-flight and ghost-reference badges.

### [DES-WORKBENCH-ANALYTICS-HEATMAP] Activity Heatmap

`Heatmap`, `cellClass`, and `bucketIntoWeeks` render a Monday-first,
week-column heatmap. Empty pad cells are transparent, zero-activity days are
muted, and active days scale through four brand-color intensities.

### [DES-WORKBENCH-ANALYTICS-SNAPSHOT] Analytics Snapshot Helpers

`pipelineRowToStage`, `computeCurrentStreak`, `computeLongestStreak`, and
`buildSnapshot` turn pipeline rows, feature tasks, journal entries, and ghost
task results into the view model consumed by `Analytics`.

## [DES-WORKBENCH-VIEW] Workbench Tab

- Feature selector dropdown
- 4 columns: SPEC, DESIGN, TASKS, SESSIONS
- Per-column view mode: preview / edit / external
- Resizable panel widths persisted

### [DES-WORKBENCH-VIEW-SELECTOR] Feature Selector And Column Toggles

`Workbench` derives the selected feature from context, renders progress/status
metadata, and lets users toggle the SPEC/DESIGN/TASKS/SESSIONS columns without
discarding fetched document content.

### [DES-WORKBENCH-VIEW-COLUMNS] Resizable Column Region

`ResizablePanelGroup` owns the horizontal column layout. Each column is rendered
through `ColumnDoc`, `ColumnTasks`, or `ColumnSessions` depending on selected
feature data and visible column state.

### [DES-WORKBENCH-VIEW-TASKS] Tasks Column

`ColumnTasks` renders phase progress, task checkboxes, and the overall progress
footer. Checkbox toggles send `afxToggleTask` with the tasks file path and source
line.

### [DES-WORKBENCH-VIEW-SESSIONS] Sessions Column

`ColumnSessions` renders the tasks work-session table and sends
`afxToggleSession` for agent/human verification ticks.

### [DES-WORKBENCH-VIEW-DOCS] Spec/Design/Tasks Document Columns

`ColumnDoc` renders not-created, loading, or markdown preview states for spec,
design, and tasks files. It uses `MinimalMarkdown` for preview content and
`OpenActions` for editor/preview affordances.

### [DES-WORKBENCH-VIEW-DRIFT] Drift Indicator Footer

`DriftIndicator` renders spec/design/tasks status plus staleness age. The age is
display-only and intentionally calculated at render time.

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

### [DES-WORKBENCH-TEST-UNIT] Unit Tests (Vitest + RTL)

- All views have co-located `.test.tsx`
- Context provider has `.test.tsx`
- Bridge has `.test.ts`
- All lib/_and hooks/_ have `.test.ts`
- Coverage threshold: 70%

### [DES-WORKBENCH-TEST-E2E] E2E Tests (Playwright)

- `apps/workbench/e2e/workbench.spec.ts`
- Runs against Vite dev server
- Mock transport auto-selected in browser

---

## [DES-ROLLOUT] Rollout Plan

Workbench rollout follows the plan in `docs/specs/000-plans/plan-workbench-traceability-migration.md`. Host data push lives in `apps/vscode/src/services/specs-data.ts` and is wired into `apps/vscode/src/panels/workbench-panel.ts`.

---

## [DES-WORKBENCH-LOC] Code Locator Map

<!-- @see spec.md [FR-1] [FR-2] [FR-3] [FR-4] [FR-5] [FR-6] [FR-7] [FR-8] [FR-9] [FR-10] [FR-11] [FR-12] -->

| Surface / behavior                | Code anchor                                                                           | Design node                                                                                                     | Tests                                            |
| --------------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| React entry and bridge bootstrap  | `apps/workbench/src/main.tsx`                                                         | `[DES-WORKBENCH-ENTRY]`                                                                                         | `apps/workbench/src/app.test.tsx`                |
| Workbench provider and root shell | `apps/workbench/src/app.tsx`                                                          | `[DES-WORKBENCH-SHELL]`, `[DES-WORKBENCH-TABS]`, `[DES-WORKBENCH-LOADING]`                                      | `apps/workbench/src/app.test.tsx`                |
| Context reducer and selected row  | `apps/workbench/src/context/workbench-context.tsx`                                    | `[DES-WORKBENCH-STATE]`                                                                                         | `apps/workbench/src/app.test.tsx`                |
| Bridge send/on/readiness          | `apps/workbench/src/lib/bridge.ts`                                                    | `[DES-WORKBENCH-BRIDGE]`, `[DES-WORKBENCH-BRIDGE-API]`                                                          | `apps/workbench/src/app.test.tsx`                |
| Host panel provider               | `apps/vscode/src/panels/workbench-panel.ts`                                           | `[DES-WORKBENCH-HOST-PANEL]`                                                                                    | `apps/vscode/src/panels/workbench-panel.test.ts` |
| Host data provider                | `apps/vscode/src/services/specs-data.ts`                                              | `[DES-WORKBENCH-HOST-DATA]`                                                                                     | Future host data provider test                   |
| Sprint section slicer             | `apps/vscode/src/services/sprint.ts`                                                  | `[DES-WORKBENCH-SPRINT-SLICER]`                                                                                 | `apps/vscode/src/services/sprint.test.ts`        |
| Browser development fixture       | `apps/workbench/src/lib/mock-data.ts`                                                 | `[DES-WORKBENCH-MOCK-DATA]`                                                                                     | Browser dev loop                                 |
| Feature selector/toggles          | `apps/workbench/src/views/workbench.tsx` `Workbench`                                  | `[DES-WORKBENCH-VIEW-SELECTOR]`                                                                                 | Future targeted view test                        |
| Resizable columns                 | `apps/workbench/src/views/workbench.tsx` `ResizablePanel*`                            | `[DES-WORKBENCH-VIEW-COLUMNS]`, `[DES-WORKBENCH-MOCKUP-FOUR-COLUMN]`                                            | `apps/workbench/src/app.test.tsx`                |
| Tasks column                      | `apps/workbench/src/views/workbench.tsx` `ColumnTasks`                                | `[DES-WORKBENCH-VIEW-TASKS]`                                                                                    | Future targeted view test                        |
| Sessions column                   | `apps/workbench/src/views/workbench.tsx` `ColumnSessions`                             | `[DES-WORKBENCH-VIEW-SESSIONS]`                                                                                 | Future targeted view test                        |
| Spec/design/tasks preview columns | `apps/workbench/src/views/workbench.tsx` `ColumnDoc`                                  | `[DES-WORKBENCH-VIEW-DOCS]`                                                                                     | Future targeted view test                        |
| Drift footer                      | `apps/workbench/src/views/workbench.tsx` `DriftIndicator`                             | `[DES-WORKBENCH-VIEW-DRIFT]`                                                                                    | Future targeted view test                        |
| Notes capture and timeline        | `apps/workbench/src/views/notes.tsx`                                                  | `224-app-workbench-notes` `[DES-NOTES-CAPTURE]`, `[DES-NOTES-TIMELINE]`                                         | `apps/workbench/src/views/notes.test.tsx`        |
| Notes item editing/time           | `apps/workbench/src/views/notes.tsx`                                                  | `224-app-workbench-notes` `[DES-NOTES-ITEM]`, `[DES-NOTES-TIME]`                                                | `apps/workbench/src/views/notes.test.tsx`        |
| Board selector/serialization      | `apps/workbench/src/views/board.tsx`                                                  | `221-app-workbench-board` `[DES-BOARD-TOOLBAR]`, `[DES-BOARD-SERIALIZATION]`                                    | `apps/workbench/src/views/board.test.tsx`        |
| Board cards/columns/save          | `apps/workbench/src/views/board.tsx`                                                  | `221-app-workbench-board` `[DES-BOARD-CARD]`, `[DES-BOARD-COLUMN]`, `[DES-BOARD-SAVE]`                          | `apps/workbench/src/views/board.test.tsx`        |
| Journal filters/cards/preview     | `apps/workbench/src/views/journal.tsx`                                                | `223-app-workbench-journal` `[DES-JOURNAL-FILTERS]`, `[DES-JOURNAL-CARD]`, `[DES-JOURNAL-PREVIEW]`              | Future targeted view test                        |
| Pipeline modes/cards/helpers      | `apps/workbench/src/views/pipeline.tsx`, `lib/pipeline.ts`                            | `225-app-workbench-pipeline` `[DES-PIPELINE-FILTERS]`, `[DES-PIPELINE-CARD]`, `[DES-PIPELINE-HELPERS]`          | `apps/workbench/src/views/pipeline.test.tsx`     |
| Documents tree/home/reader        | `apps/workbench/src/views/documents.tsx`                                              | `222-app-workbench-documents` `[DES-DOCS-TREE]`, `[DES-DOCS-HOME]`, `[DES-DOCS-READER]`                         | Future targeted view test                        |
| Documents helpers/markdown        | `apps/workbench/src/lib/{documents,document-outline,frontmatter,markdown-render}.ts*` | `222-app-workbench-documents` `[DES-DOCS-HELPERS]`, `[DES-DOCS-MARKDOWN]`                                       | Future helper tests                              |
| Analytics dashboard/snapshot      | `apps/workbench/src/views/analytics.tsx`, `lib/analytics.ts`                          | `226-app-workbench-analytics` `[DES-ANALYTICS-HEADLINE]`, `[DES-ANALYTICS-HEATMAP]`, `[DES-ANALYTICS-SNAPSHOT]` | `apps/workbench/src/lib/analytics.test.ts`       |

---

## [DES-WORKBENCH-TRACE] 1:1 Code/Spec Matrix

| Requirement | Design node                                                                                                                                | Source anchor                                                                        |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| `[FR-1]`    | `[DES-WORKBENCH-TABS]`, `[DES-WORKBENCH-MOCKUP-SHELL]`                                                                                     | `apps/workbench/src/app.tsx` `WorkbenchShell`                                        |
| `[FR-2]`    | `[DES-WORKBENCH-ENTRY]`, `[DES-WORKBENCH-SHELL]`                                                                                           | `apps/workbench/src/main.tsx`, `apps/vscode/src/panels/workbench-panel.ts`           |
| `[FR-3]`    | `[DES-WORKBENCH-BRIDGE]`, `[DES-WORKBENCH-STATE]`, `[DES-WORKBENCH-PROTOCOL]`                                                              | `apps/workbench/src/lib/bridge.ts`, `context/workbench-context.tsx`                  |
| `[FR-4]`    | `224-app-workbench-notes` `[DES-NOTES-CAPTURE]`, `[DES-NOTES-TIMELINE]`, `[DES-NOTES-ITEM]`                                                | `apps/workbench/src/views/notes.tsx`                                                 |
| `[FR-5]`    | `221-app-workbench-board` `[DES-BOARD-SERIALIZATION]`, `[DES-BOARD-TOOLBAR]`, `[DES-BOARD-CARD]`, `[DES-BOARD-COLUMN]`, `[DES-BOARD-SAVE]` | `apps/workbench/src/views/board.tsx`                                                 |
| `[FR-6]`    | `223-app-workbench-journal` `[DES-JOURNAL-FILTERS]`, `[DES-JOURNAL-CARD]`, `[DES-JOURNAL-PREVIEW]`                                         | `apps/workbench/src/views/journal.tsx`                                               |
| `[FR-7]`    | `225-app-workbench-pipeline` `[DES-PIPELINE-FILTERS]`, `[DES-PIPELINE-SIMPLE]`, `[DES-PIPELINE-CARD]`, `[DES-PIPELINE-HELPERS]`            | `apps/workbench/src/views/pipeline.tsx`, `apps/workbench/src/lib/pipeline.ts`        |
| `[FR-8]`    | `222-app-workbench-documents` `[DES-DOCS-TREE]`, `[DES-DOCS-HOME]`, `[DES-DOCS-READER]`, `[DES-DOCS-HELPERS]`                              | `apps/workbench/src/views/documents.tsx`, `lib/documents.ts`, `lib/open-actions.tsx` |
| `[FR-9]`    | `226-app-workbench-analytics` `[DES-ANALYTICS-RANGE]`, `[DES-ANALYTICS-HEADLINE]`, `[DES-ANALYTICS-HEATMAP]`, `[DES-ANALYTICS-SNAPSHOT]`   | `apps/workbench/src/views/analytics.tsx`, `apps/workbench/src/lib/analytics.ts`      |
| `[FR-10]`   | `227-app-workbench-shell` `[DES-SHELL-FEATURE-MOCKUP]`, `[DES-SHELL-FEATURE-COLUMNS]`                                                      | `apps/workbench/src/views/workbench.tsx`                                             |
| `[FR-11]`   | `[DES-WORKBENCH-EMPTY-STATES]`, view-specific nodes                                                                                        | all `apps/workbench/src/views/*.tsx`                                                 |
| `[FR-12]`   | `[DES-WORKBENCH-LOADING]`, `[DES-WORKBENCH-MOCKUP-LOADING-EMPTY]`                                                                          | `apps/workbench/src/app.tsx`, `apps/workbench/src/views/workbench.tsx`               |

---

## [DES-WORKBENCH-REFS] File Reference Map

| Task | File                                               | Required @see                                                                             |
| ---- | -------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| —    | `apps/workbench/src/main.tsx`                      | `227-app-workbench-shell spec.md [FR-1]` + `design.md [DES-SHELL-BRIDGE]`                 |
| —    | `apps/workbench/src/app.tsx`                       | `227-app-workbench-shell spec.md [FR-2] [FR-5]` + `design.md [DES-SHELL-TABS]`            |
| —    | `apps/workbench/src/lib/bridge.ts`                 | `227-app-workbench-shell spec.md [FR-4]` + `design.md [DES-SHELL-BRIDGE]`                 |
| —    | `apps/workbench/src/context/workbench-context.tsx` | `227-app-workbench-shell spec.md [FR-3]` + `design.md [DES-SHELL-STATE]`                  |
| —    | `apps/workbench/src/views/workbench.tsx`           | `227-app-workbench-shell spec.md [FR-6] [FR-7]` + `design.md [DES-SHELL-FEATURE-COLUMNS]` |
| —    | `apps/workbench/src/views/notes.tsx`               | `224-app-workbench-notes` capture/timeline/item/time IDs                                  |
| —    | `apps/workbench/src/views/board.tsx`               | `221-app-workbench-board` serialization/toolbar/card/column/save IDs                      |
| —    | `apps/workbench/src/views/journal.tsx`             | `223-app-workbench-journal` filters/card/preview/time IDs                                 |
| —    | `apps/workbench/src/views/pipeline.tsx`            | `225-app-workbench-pipeline` filters/simple/card IDs                                      |
| —    | `apps/workbench/src/views/documents.tsx`           | `222-app-workbench-documents` tree/home/reader IDs                                        |
| —    | `apps/workbench/src/views/analytics.tsx`           | `226-app-workbench-analytics` range/headline/heatmap IDs                                  |
