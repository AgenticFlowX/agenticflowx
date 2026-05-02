---
afx: true
type: SPEC
status: Draft
owner: "@rixrix"
version: "1.0"
created_at: 2026-04-29T06:31:24.000Z
updated_at: 2026-05-02T00:08:26.000Z
tags: [plan, workbench, traceability, vscode]
---

# Plan: Workbench Panel + IDE Traceability

## Approval Report (2026-04-29)

Final implementation audit completed against:

1. Current package scripts, lint boundaries, and app architecture.
2. Workbench panel and IDE traceability requirements.
3. This plan's manifest, phase gates, protocol contract, and delegation packets.

Result: **GO** (content-accurate and delegation-ready).

Go / No-Go checklist status:

1. Traceability completeness: ✅ Pass (Phase 0 gate + no-code-without-node rule present).
2. Protocol contract freeze: ✅ Pass (`afxOpenFile.path` invariant + malformed-message handling asserted).
3. Write-safety policy: ✅ Pass (parse-transform-serialize + fail-closed policy mandated).
4. Command parity controls: ✅ Pass (centralized command ID requirement + parity test gate present).
5. Delegation safety: ✅ Pass (disjoint Packet A-E ownership and done criteria).
6. Path correctness (`.afx/kanban`, `.afx/notes.md`): ✅ Pass.
7. Gate feasibility vs repo scripts: ✅ Pass with explicit precondition that `apps/workbench/package.json` adds `test:e2e` before Phase 5 gate execution.

## Context

Implementing the Workbench panel and IDE traceability features:

1. **Workbench panel** — 7 React tab views in `apps/workbench/`
2. **@see traceability providers** — 5 VSCode language providers in `apps/vscode/src/providers/`
3. **Right-click context menu** — `CodeActionsProvider` + `package.json` contributions

**Non-negotiables from `AGENTS.md` + project patterns:**

- `pnpm verify` passes after every change (types + lint + format + tests). Fix → verify loop.
- No OOP. Functional style throughout. No classes except where VSCode API requires it (only `AfxCodeActionProvider implements vscode.CodeActionProvider`).
- shadcn components exclusively via `@afx/ui/components/*`. CSS from `--background`, `--foreground`, `--afx-brand`, `--muted`, `--card`, `--border` tokens + `.afx-surface-*` utility classes (match `apps/chat/src/index.css` pattern).
- No inline CSS. No `--vscode-*` direct usage. No arbitrary values in Tailwind unless there is no token.
- Every new `.ts`/`.tsx` carries `@see` JSDoc linking to `docs/specs/220-app-workbench/` or `docs/specs/200-app-vscode/`.
- `apps/workbench` forbidden: VSCode API, filesystem, `@afx/agent-pi`.
- `apps/vscode` forbidden: React UI, browser-only APIs.
- Architecture boundary linter (`no-restricted-imports`) enforces all of the above for app source files (`apps/*/src/**/*.{ts,tsx}`); tests have explicit exemptions for fixture and boundary-guard patterns.
- Coverage thresholds enforced: 70% statements/branches/functions/lines (all packages).

---

## What I Know (Facts)

**Source check (2026-05-02):**

- `apps/workbench/vitest.config.unit.ts` — jsdom environment, 70% coverage thresholds, `@testing-library/jest-dom`, `failOnConsole` (errors + warns fail tests)
- `apps/workbench/vitest.setup.ts` — jest-dom + failOnConsole already wired
- `vitest.workspace.ts` already includes `apps/workbench/vitest.config.unit.ts`
- `apps/chat/playwright.config.ts` — Playwright against Vite dev server, `apps/chat/e2e/` has working examples
- `apps/vscode/src/__fixtures__/mock-agent-manager.ts` — complete vi.fn-backed mock of `AgentManager`
- `apps/vscode/src/panels/sidebar-panel.test.ts` — exact pattern for VSCode provider tests using `makeMockView()`
- Bridge pattern: `apps/chat/src/lib/bridge.ts` — module-level `_transport`, `initTransport()` once in `main.tsx`, `bridgeSend()` + `bridgeOn()` typed functions
- `packages/shared/src/workbench-types.ts` and `packages/shared/src/workbench-protocol.ts` now exist.
- `apps/workbench` now has context, typed bridge, utility libs, implemented tab views, markdown rendering, and Playwright e2e.
- `apps/vscode/src/services/specs-data.ts`, `apps/vscode/src/utils/editor-utils.ts`, and `apps/vscode/src/providers/` now exist.
- `apps/vscode/package.json` includes AFX context menu contributions.

**Key resolved design decisions:**

- Do NOT reuse `@afx/transport`'s `Transport` type for workbench IPC. That interface is typed to `ChatToAgent`/`AgentToChat`. Workbench uses its own protocol — same module-level bridge pattern as chat but with `WorkbenchInbound`/`WorkbenchOutbound` types.
- `parseFrontmatter` from `@afx/parsers` is used directly. The panel's metadata chip rendering is a pure function in `apps/workbench/src/lib/frontmatter.ts` — no port of the old `DocumentPreview.tsx` class structure.
- `EditorUtils` is a minimal two-function module — no class, no inheritance.
- `handleAction` in code-actions receives `agentManager: AgentManager` injected via closure — no global singleton lookup.
- Context key is `afx.loaded`.

**Naming convention (ground-up implementation):**

- Use `afx*` prefix only for integration-facing symbols: VSCode commands, context keys, and host/webview protocol message types.
- Keep internal module-local names unprefixed when already scoped by file/module context (helpers, hooks, component names).

---

## UX Standards (Applied to Every View)

These are binding requirements derived from `docs/design-system/docs/rev-02-direction.md` and the existing `apps/chat` implementation. Every view must follow them — not as nice-to-haves but as first-class implementation requirements.

### Empty States

Every view that can have zero data MUST use the `<Empty>` component system from `@afx/ui/components/empty`. Never a blank `<div>` or raw "No data" text.

```typescript
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@afx/ui/components/empty"
import { NotepadText } from "lucide-react"

<Empty>
  <EmptyHeader>
    <EmptyMedia variant="icon"><NotepadText /></EmptyMedia>
    <EmptyTitle>No notes yet</EmptyTitle>
    <EmptyDescription>Type a note below and press Enter to save it.</EmptyDescription>
  </EmptyHeader>
</Empty>
```

**Per-tab empty states:**

| Tab       | Icon              | Title                    | Description                                                                                      |
| --------- | ----------------- | ------------------------ | ------------------------------------------------------------------------------------------------ |
| Notes     | `NotepadText`     | "No notes yet"           | "Type a note below and press Enter to capture it."                                               |
| Board     | `LayoutDashboard` | "No boards found"        | "Create a board to track tasks and ideas. Boards are saved as markdown files in `.afx/kanban/`." |
| Journal   | `BookOpen`        | "No discussions yet"     | "Run `/afx-session note` in the chat to capture a decision. It will appear here."                |
| Pipeline  | `GitBranch`       | "No features found"      | "Create a spec to get started — run `/afx-scaffold spec my-feature` in the chat."                |
| Documents | `Files`           | "No documents found"     | "AFX documents live in `docs/specs/`. Create one with `/afx-scaffold spec my-feature`."          |
| Analytics | `BarChart2`       | "Nothing to analyze yet" | "Add features and tasks to see your project metrics here."                                       |
| Workbench | `Layers`          | "No feature selected"    | "Select a feature from the dropdown above to view its spec, design, tasks, and sessions."        |

### Loading States

Every view that fetches async data MUST show a skeleton while `isLoading: true` from context.

```typescript
import { Skeleton } from "@afx/ui/components/skeleton"

if (isLoading) {
  return (
    <div className="flex flex-col gap-2 p-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full rounded-md" />
      ))}
    </div>
  )
}
```

### Error States

Inline error with ember border-left — no alert dialogs, no apology copy:

```typescript
<div className="border-l-2 border-destructive bg-destructive/10 px-3 py-2 text-xs text-destructive">
  {errorMessage}
</div>
```

### Trace Chips (Evidence Chips)

Node IDs and requirement anchors displayed in document previews:

```typescript
<Badge variant="outline" className="font-mono text-xs text-afx-brand">FR-2</Badge>
```

Clicking sends `workbenchSend({ type: "afxOpenFile", path, mode: "preview" })`.

### Surface Hierarchy

Add to `apps/workbench/src/index.css` (same as `apps/chat/src/index.css`):

```css
.afx-surface-subtle {
  background: color-mix(in srgb, var(--background) 92%, var(--muted) 8%);
}
.afx-surface-card {
  background: var(--card);
}
.afx-surface-toolbar {
  background: color-mix(in srgb, var(--card) 86%, var(--muted) 14%);
}
.afx-field-surface {
  background: color-mix(in srgb, var(--card) 84%, var(--muted) 16%);
  border-color: color-mix(in srgb, var(--border) 82%, transparent);
}
```

Usage per zone:

| Zone                | Class                                              |
| ------------------- | -------------------------------------------------- |
| Tab content root    | `bg-background text-foreground`                    |
| Sidebar / left pane | `afx-surface-subtle`                               |
| Content pane        | `bg-background`                                    |
| Toolbar / top bar   | `afx-surface-toolbar border-b border-border`       |
| Cards / list items  | `afx-surface-card rounded-md border border-border` |

### Typography

- Body/labels: `text-sm text-foreground`
- Secondary/metadata: `text-xs text-muted-foreground`
- Mono (IDs, timestamps, paths): `font-mono text-xs`
- Headings inside panes: `text-sm font-medium` (never larger — this is a panel)

### Spacing (compact)

- Section padding: `p-3` or `px-3 py-2`
- List item height: `h-8` or `h-9`
- Gap: `gap-1.5` or `gap-2`
- Resizable panel min: `minSize={15}`

### Status Badge Colors

```typescript
const STATUS_CLASSES: Record<string, string> = {
  approved: "bg-green-500/15 text-green-400 border-green-500/20",
  living: "bg-purple-500/15 text-purple-400 border-purple-500/20",
  draft: "bg-muted text-muted-foreground border-border",
  active: "bg-purple-500/15 text-purple-400 border-purple-500/20",
  blocked: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  closed: "bg-green-500/15 text-green-400 border-green-500/20",
  complete: "bg-green-500/15 text-green-400 border-green-500/20",
  "in-progress": "bg-afx-brand/15 text-afx-brand border-afx-brand/20",
  "not-started": "bg-muted text-muted-foreground border-border",
};
```

Always `<Badge variant="outline">` + override via `className`.

### Freshness Indicator (Workbench columns)

- `updatedAt` within 7 days → `className="text-green-400 border-green-500/20"` — "fresh"
- `updatedAt` older than 7 days → `className="text-amber-400 border-amber-500/20"` — "stale"
- Missing → `className="text-muted-foreground"` — "unknown"

### Accessibility

- Icon-only buttons: `aria-label` required
- Overflow lists: `<ScrollArea>` always (never raw `overflow-y-auto`)
- Keyboard: Escape closes/returns in Documents and Board editor
- Delete confirmations: hover state inline (no `window.confirm`)

---

## UI Component Rule

**Shadcn always first.** Use `@afx/ui/components/*` for everything. Custom UI only when shadcn provably cannot cover the need — stop and ask before inventing.

Confirmed available: accordion, alert, alert-dialog, avatar, badge, breadcrumb, button, button-group, calendar, card, carousel, chart, checkbox, collapsible, combobox, command, context-menu, dialog, drawer, dropdown-menu, **empty**, field, hover-card, input, input-group, item, label, menubar, navigation-menu, pagination, popover, progress, radio-group, **resizable**, scroll-area, select, separator, sheet, sidebar, **skeleton**, slider, sonner, **spinner**, switch, table, tabs, textarea, toggle, toggle-group, tooltip

---

## What Else Was Missing (Pre-work Gaps)

1. `apps/workbench/src/index.css` — add `.afx-surface-*` classes before any view work.
2. `apps/workbench/playwright.config.ts` — e2e config (Phase 5).
3. `apps/workbench/vitest.config.unit.ts` — add `@afx/shared` path alias (currently missing, tests will fail to resolve shared types).
4. `apps/workbench/src/no-boundary-imports.test.ts` — boundary enforcement test (guards against `vscode`/`@afx/agent-pi` slipping into browser bundle).
5. `apps/workbench/src/lib/markdown.ts` — `react-markdown` + `remark-gfm` renderer for preview panes. Add `react-markdown` and `remark-gfm` to `apps/workbench/package.json`.
6. Spec gate pre-check — verify `docs/specs/220-app-workbench/spec.md` has FR nodes before writing `@see` links.
7. `apps/workbench/src/views/workbench.tsx` needs local `useState<Record<string, string>>` for `afxDocContent` responses — this is per-view state, not context state.
8. `apps/vscode/src/services/specs-data.ts` must also scan `.afx/kanban/*.md` and `.afx/notes.md` — without this Board and Notes tabs are always empty.

---

## Implementation Guardrails (Logic-First)

### Rewrite Instead of Reusing

The following known-fragile patterns must be avoided:

1. Host-side text mutation by regex/index surgery (`status` frontmatter replacement, work-session table toggles).
2. Code-actions singleton/global dispatch patterns (dynamic provider lookup). Use injected `AgentManager` only.
3. DocumentLink click-navigation behavior as a primary navigation path (keep DefinitionProvider as canonical).
4. Mixed message payload keys for identical message types (`path` vs `filePath` for open-file semantics).

### Behaviors To Preserve

The following behavior goals are good candidates to keep with current typing/lint standards:

1. Workbench domain type shapes from `types.ts` (Phase 1 source list).
2. Data derivations (`feature -> pipeline/tasks/journal`) from the specs-data flow.
3. Lazy enrichment/backlinks scan architecture (request-on-demand + cache + `afxDocContent` fan-in), reimplemented with strict typed handlers.

---

## Coding Standards

### React / Webview

```typescript
// ✅ Functional, named/default exports
export default function Notes() { ... }
export function useWorkbench() { ... }

// ✅ shadcn imports
import { Button } from "@afx/ui/components/button"
import { ScrollArea } from "@afx/ui/components/scroll-area"

// ✅ Theme tokens only
className="flex h-full flex-col bg-background text-foreground"
className="afx-surface-subtle rounded-md border border-border px-3 py-2"
className="text-muted-foreground text-xs"
className="text-afx-brand"

// ✅ State — hooks only
const [value, setValue] = useState("")
const result = useMemo(() => compute(data), [data])

// ❌ Never
class MyComponent extends React.Component {}
import * as vscode from "vscode"         // boundary violation
```

### VSCode Extension

```typescript
// ✅ Functional factory pattern
export function createSpecCodeLensProvider(
  getFeatures: () => Promise<Feature[]>,
  getRoot: () => string,
): vscode.CodeLensProvider { ... }

// ✅ Logger always from @afx/shared
const log = parentLogger.child("spec-codelens")
log.info("registered")
log.debug(() => `loaded: ${features.length}`)   // lazy callback

// ✅ JSDoc @see on every file
/**
 * @see docs/specs/200-app-vscode/spec.md [FR-X]
 * @see docs/specs/200-app-vscode/design.md [DES-SECTION]
 */

// ❌ Never
console.log(...)
output.appendLine(...)
class MyProvider { ... }    // except CodeActionProvider (VSCode requires it)
```

### Testing

```typescript
// ✅ Mirror source path: src/views/notes.tsx → src/views/notes.test.tsx
// ✅ Context wrapper helper in every view test file
function renderWithContext(ui: React.ReactElement, state?: Partial<WorkbenchState>) {
  return render(<WorkbenchProvider initialState={state}>{ui}</WorkbenchProvider>)
}
// ✅ Mock bridge in view tests
vi.mock("../lib/bridge", () => ({ workbenchSend: vi.fn(), workbenchOn: vi.fn(() => () => {}) }))
// ✅ VSCode panel tests: use makeMockView() pattern from sidebar-panel.test.ts
// ✅ Playwright e2e: apps/workbench/e2e/ against Vite dev server
```

---

## Implementation Phases

### Phase 0 — Spec gate

1. Read `docs/specs/220-app-workbench/spec.md`, `design.md`, and `tasks.md`.
2. Confirm each has valid AFX frontmatter (`afx: true`, `type`, `status`, `created_at`, `updated_at`).
3. Confirm spec.md has FR/NFR nodes that cover each workbench tab and each IPC message type.
4. Confirm design.md has DES-\* sections that cover bridge, context, views, and host-panel data flow.
5. **If any node is missing:** add it to the relevant spec/design file _before writing any code_. This is not optional — every `@see` link in every new source file must resolve to a real node. Do not write placeholder anchors.
6. Document which nodes were added/verified in the Phase 0 gate log before proceeding to Phase 1.

---

### Phase 1 — Shared types + config pre-work

**Config pre-work (do before any code):**

- `apps/workbench/vitest.config.unit.ts` — add `@afx/shared` path alias (same pattern as existing `@afx/ui` and `@afx/transport` aliases). Without this, any test importing from `@afx/shared` will fail to resolve.
- `apps/workbench/src/index.css` — add `.afx-surface-*` utility classes (see Surface Hierarchy section above). Must exist before any view imports them.

---

### Phase 1 — Shared types

**`packages/shared/src/workbench-types.ts`** (new)

Define shared workbench row/data types:
`PipelineRow`, `DocumentRow`, `SearchMatch`, `SearchHit`, `TaskItemRow`, `PhaseRow`, `WorkSessionRow`, `FeatureTasksData`, `KanbanCard`, `KanbanColumn`, `KanbanMeta`, `KanbanBoard`, `KanbanData`, `JournalEntry`, `QuickNote`, `GhostTaskResult`

**`packages/shared/src/workbench-protocol.ts`** (new)

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

**Protocol invariants (non-negotiable):**

1. `afxOpenFile` uses `path` only (never `filePath`).
2. Every inbound host message is runtime-validated before dispatch.
3. Unknown message types are logged and ignored (no throw path in webview message loop).
4. File-mutation messages (`afxChangeStatus`, `afxToggleTask`, `afxToggleSession`, `afxSaveFile`) must return structured success/failure telemetry to logs.

**`packages/shared/src/index.ts`** — re-export both files.

**Tests:** `workbench-types.test.ts` — `satisfies` operator shape checks.

---

### Phase 2 — Workbench bridge + context

**`apps/workbench/src/lib/bridge.ts`** — replace stub with module-level bridge:

```typescript
export function initWorkbenchBridge(): void { ... }      // called once in main.tsx
export function workbenchSend(msg: WorkbenchOutbound): void { ... }
export function workbenchOn<T>(type: T, handler): () => void { ... }
```

VSCode path: `acquireVsCodeApi().postMessage`. Browser path: `window.parent.postMessage`.

**`apps/workbench/src/context/workbench-context.tsx`** — state shape mirrors `AfxPanelContext.tsx`:

```typescript
{
  (pipeline,
    featureTasks,
    documents,
    journal,
    kanban,
    notes,
    notesFilePath,
    ghostTasks,
    selectedFeature,
    isLoading);
}
```

`useEffect` subscribes to `workbenchOn("afxUpdate", ...)`, merges with `??`. Exports `WorkbenchProvider` + `useWorkbench()`.

**Tests:** bridge send/unsubscribe, context afxUpdate merge, isLoading transitions.

---

### Phase 3 — Utility libraries (pure functions + hooks)

Each with co-located `.test.ts`:

| File                                  | Key exports                                                                                                                    |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `src/lib/pipeline.ts`                 | `healthPct`, `getNextAction`, `getGroupStatus`, `groupByFeatureStatus`, `groupByLane`, `formatShortDate`, `formatRelativeTime` |
| `src/lib/documents.ts`                | `isRenderable`, `groupByType`, `attentionFor`, `fileIconFor`                                                                   |
| `src/lib/analytics.ts`                | `buildSnapshot`, `pipelineRowToStage`, `entryKind`                                                                             |
| `src/lib/document-outline.ts`         | `extractOutline`                                                                                                               |
| `src/lib/frontmatter.ts`              | `extractMetaChips` (wraps `@afx/parsers` `parseFrontmatter`)                                                                   |
| `src/lib/markdown.ts`                 | `MarkdownContent` component (`react-markdown` + `remark-gfm`)                                                                  |
| `src/hooks/use-local-storage.ts`      | `useLocalStorage<T>`                                                                                                           |
| `src/hooks/use-backlinks-scan.ts`     | `useBacklinksScan`                                                                                                             |
| `src/hooks/use-feature-enrichment.ts` | lazy frontmatter load on demand                                                                                                |

---

### Phase 4 — Tab views

**Dependency additions first:** `@dnd-kit/core`, `@dnd-kit/sortable`, `react-markdown`, `remark-gfm` → `apps/workbench/package.json`.

Each view: `src/views/<name>.tsx` + `<name>.test.tsx`. Each uses `useWorkbench()` for data and `workbenchSend()` for actions.

**Implementation order:**

#### 4.1 Notes

- Left: `<Textarea>` (Enter=save, Shift+Enter=newline) + `<Button>`
- Right: `<ScrollArea>` timeline, sticky date headers, `<Input>` search + `<Select>` date range
- Delete: hover confirmation inline
- Sends: `afxAppendNote`, `afxDeleteNote`
- Tests: empty state, submit on Enter, no-submit on Shift+Enter, delete flow, search filter, date range filter

#### 4.2 Board

- `<Select>` board selector + quick-pick strip + new-board `<Input>`
- View toggle: visual ↔ raw `<Textarea>`
- Columns: `@dnd-kit/sortable` horizontal DnD, double-click rename, delete empty
- Cards: HTML5 `draggable`, double-click edit, delete
- Serialization: YAML frontmatter + `## Column` + `- card` format
- Sends: `afxSaveFile`
- Tests: renders boards, selector change, view mode toggle, add card

#### 4.3 Journal

- Left: `<Input>` search + `<Select>` status/feature filters, grouped list
- Right: header (ID + status `<Badge>` + title) + content
- Status badge colors per `STATUS_CLASSES` map
- Tests: renders entries, filter by status, filter by text, selection shows preview

#### 4.4 Pipeline

- 3 view modes (Timeline / Grid / Kanban) via button group, `useLocalStorage("afx-pipeline-view")`
- `<Input>` search + `<Select>` status + `<Select>` sort
- Uses `pipeline.ts` helpers + `use-feature-enrichment.ts`
- Tests: default timeline mode, view mode switch, search filter, empty state

#### 4.5 Documents

- Left `<ResizablePanel>`: type `<Select>` + `<Input>` search + tree list
- Right `<ResizablePanel>`: `home | reader | search` state
  - Home: recent docs + attention cards
  - Reader: sticky `extractMetaChips()` header + `<ScrollArea>` body + outline + backlinks
  - Search: expandable match snippets
- Escape → home; non-renderable → `afxOpenFile`
- Tests: home default, click shows reader, Escape returns home, search pane, non-renderable triggers afxOpenFile

#### 4.6 Analytics

- 6 sections from `buildSnapshot()`
- `<Select>` range persisted via `useLocalStorage("afx-analytics-range")`
- Tests: no crash on empty data, correct task count, range selector changes data

#### 4.7 Workbench

- Feature `<Select>` at top
- 4 columns: SPEC, DESIGN, TASKS, SESSIONS via `<ResizablePanelGroup>`
- Column visibility + widths via `useLocalStorage`
- Per-column `"preview" | "edit" | "external"` mode in `useState`
- Preview: `<MarkdownContent>` from `src/lib/markdown.ts`
- TASKS: `<Progress>` + checkboxes → `afxToggleTask`
- SESSIONS: table of `WorkSessionRow[]` → `afxToggleSession`
- Edit: `<Textarea>` + save → `afxSaveFile`
- Local `useState<Record<string, string>>` for `afxDocContent` responses
- Freshness `<Badge>` in column footer
- Tests: 4 columns visible, visibility toggle hides column, feature select sends afxSelectFeature, task toggle sends afxToggleTask, edit mode shows textarea

**Update `app.tsx`:** wrap in `<WorkbenchProvider>`, replace all `<ComingSoon>` stubs.
**Update `main.tsx`:** call `initWorkbenchBridge()` before mount.

---

### Phase 5 — Playwright e2e

`apps/workbench/playwright.config.ts` — mirror `apps/chat/playwright.config.ts`, including `webServer` management (do not require manual server startup).

`apps/workbench/e2e/workbench.spec.ts`:

```typescript
test("workbench root mounts");
test("has no console errors on load");
test("renders all 7 tabs");
test("Notes tab is reachable");
test("Board tab is reachable");
test("Pipeline tab shows empty state in browser");
```

---

### Phase 6 — VSCode: Feature model + data service

**`apps/vscode/src/models/feature.ts`** — `Feature` interface (type-only, no tests needed):

```typescript
interface Feature {
  name: string;
  dirPath: string;
  status: string;
  spec?: DocFile;
  design?: DocFile;
  tasks?: DocFile;
  journal?: DocFile;
  taskStats: TaskStats;
  discussions: Discussion[];
}
```

**`apps/vscode/src/services/specs-data.ts`** — `createSpecsDataProvider(getRoot, log)`:

- Scans `docs/specs/` via `vscode.workspace.fs.readDirectory`
- Reads each doc file via `vscode.workspace.fs.readFile`
- Uses `@afx/parsers`: `parseFrontmatter`, `parseTasks`, `parseJournal`
- Derives `PipelineRow[]`, `FeatureTasksData[]`, `DocumentRow[]`, `JournalEntry[]`
- Also scans `.afx/kanban/*.md` → `KanbanData` and `.afx/notes.md` → `QuickNote[]`
- `refresh()` clears cache

**Tests:** empty specs dir, frontmatter parse, task completion derivation, refresh clears cache.

---

### Phase 7 — VSCode: Workbench panel data push

Extend `workbench-panel.ts` — add `specsData: SpecsDataProvider` + `logger: Logger` to deps.

In `resolveWebviewView`:

1. `webview.onDidReceiveMessage` — handle all `WorkbenchOutbound` types
2. Push initial `afxUpdate` from `specsData.getPanelData()`
3. `createFileSystemWatcher` for spec/tasks/journal/kanban/notes files → `refresh()` + re-push

Handlers (all `WorkbenchOutbound` variants): `afxOpenFile`, `afxFetchDocContent`, `afxSelectFeature`, `afxChangeStatus`, `afxToggleTask`, `afxToggleSession`, `afxSaveFile`, `afxAppendNote`, `afxDeleteNote`.

**Write-path policy (must avoid fragile mutation logic):**

1. No regex-only frontmatter mutation.
2. No index-based table surgery without structural parse guard.
3. Parse-transform-serialize flow required for status/tasks/session updates using `@afx/parsers`-backed helpers.
4. On parse failure, do not write; log error and return a typed failure result.

**Tests** (using `makeMockView()` pattern): initial afxUpdate push, each message handler.

---

### Phase 8 — IDE traceability providers

All in `apps/vscode/src/providers/`. All functional factories. Implement behavior against current architecture boundaries (`afx.` command namespace, injected deps, no singleton lookups):

| File                    | Signature                                          | Registration                                   |
| ----------------------- | -------------------------------------------------- | ---------------------------------------------- |
| `spec-codelens.ts`      | `createSpecCodeLensProvider(getFeatures, getRoot)` | `registerCodeLensProvider`                     |
| `spec-hover.ts`         | `createSpecHoverProvider(getFeatures, getRoot)`    | `registerHoverProvider`                        |
| `spec-definition.ts`    | `createSpecDefinitionProvider(getRoot)`            | `registerDefinitionProvider`                   |
| `see-document-links.ts` | `createSeeDocumentLinkProvider(getRoot)`           | `registerDocumentLinkProvider`                 |
| `see-completion.ts`     | `createSeeCompletionProvider(getRoot)`             | `registerCompletionItemProvider(... "/", "#")` |

Languages: `typescript`, `javascript`, `typescriptreact`, `javascriptreact`, `python`, `go`.

Each has a `.test.ts` covering core behavior (CodeLens labels, Hover markdown, Definition location, Link ranges, Completion items at each cascade level).

---

### Phase 9 — Right-click context menu

**`apps/vscode/src/utils/editor-utils.ts`** — two functions: `getEffectiveRange`, `getEditorContext`. Tests: mock active editor, assert range/context output.

**`apps/vscode/src/providers/afx-code-actions.ts`** — implement with:

1. Import from `../utils/editor-utils`
2. All commands prefixed `afx.` (not `agenticflowx.`)
3. Signature: `createAfxCodeActionProvider(context, logger, agentManager: AgentManager)`
4. `handleAction` calls `agentManager.send(prompt)`
5. No singleton/provider global lookup for dispatch
6. Command ID source-of-truth is centralized (single typed list used by registration + package contribution checks)

Tests: code actions for `.ts` files, spec actions for `spec.md`, tasks + dispatch actions for `tasks.md`, `agentManager.send` called with prompt.

**`apps/vscode/package.json`** — add 23 commands + `contributes.submenus` + `contributes.menus` with `when: "afx.loaded"` gates.

**`apps/vscode/src/extension.ts`** — register providers, call `setContext("afx.loaded", true)` after initialization.

---

## File Manifest

| File                                                      | Action                                                          |
| --------------------------------------------------------- | --------------------------------------------------------------- |
| `packages/shared/src/workbench-types.ts`                  | NEW                                                             |
| `packages/shared/src/workbench-types.test.ts`             | NEW                                                             |
| `packages/shared/src/workbench-protocol.ts`               | NEW                                                             |
| `packages/shared/src/index.ts`                            | EXTEND                                                          |
| `apps/workbench/src/index.css`                            | EXTEND (add `.afx-surface-*`)                                   |
| `apps/workbench/vitest.config.unit.ts`                    | EXTEND (add `@afx/shared` alias)                                |
| `apps/workbench/src/lib/bridge.ts`                        | REPLACE                                                         |
| `apps/workbench/src/lib/bridge.test.ts`                   | NEW                                                             |
| `apps/workbench/src/context/workbench-context.tsx`        | NEW                                                             |
| `apps/workbench/src/context/workbench-context.test.tsx`   | NEW                                                             |
| `apps/workbench/src/lib/pipeline.ts`                      | NEW                                                             |
| `apps/workbench/src/lib/pipeline.test.ts`                 | NEW                                                             |
| `apps/workbench/src/lib/documents.ts`                     | NEW                                                             |
| `apps/workbench/src/lib/documents.test.ts`                | NEW                                                             |
| `apps/workbench/src/lib/analytics.ts`                     | NEW                                                             |
| `apps/workbench/src/lib/analytics.test.ts`                | NEW                                                             |
| `apps/workbench/src/lib/document-outline.ts`              | NEW                                                             |
| `apps/workbench/src/lib/document-outline.test.ts`         | NEW                                                             |
| `apps/workbench/src/lib/frontmatter.ts`                   | NEW                                                             |
| `apps/workbench/src/lib/frontmatter.test.ts`              | NEW                                                             |
| `apps/workbench/src/lib/markdown.ts`                      | NEW                                                             |
| `apps/workbench/src/lib/markdown.test.tsx`                | NEW                                                             |
| `apps/workbench/src/hooks/use-local-storage.ts`           | NEW                                                             |
| `apps/workbench/src/hooks/use-local-storage.test.ts`      | NEW                                                             |
| `apps/workbench/src/hooks/use-backlinks-scan.ts`          | NEW                                                             |
| `apps/workbench/src/hooks/use-backlinks-scan.test.ts`     | NEW                                                             |
| `apps/workbench/src/hooks/use-feature-enrichment.ts`      | NEW                                                             |
| `apps/workbench/src/hooks/use-feature-enrichment.test.ts` | NEW                                                             |
| `apps/workbench/src/no-boundary-imports.test.ts`          | NEW                                                             |
| `apps/workbench/src/views/notes.tsx`                      | IMPLEMENTED                                                     |
| `apps/workbench/src/views/notes.test.tsx`                 | NEW                                                             |
| `apps/workbench/src/views/board.tsx`                      | IMPLEMENTED                                                     |
| `apps/workbench/src/views/board.test.tsx`                 | NEW                                                             |
| `apps/workbench/src/views/journal.tsx`                    | IMPLEMENTED                                                     |
| `apps/workbench/src/views/journal.test.tsx`               | NEW                                                             |
| `apps/workbench/src/views/pipeline.tsx`                   | IMPLEMENTED                                                     |
| `apps/workbench/src/views/pipeline.test.tsx`              | NEW                                                             |
| `apps/workbench/src/views/documents.tsx`                  | IMPLEMENTED                                                     |
| `apps/workbench/src/views/documents.test.tsx`             | NEW                                                             |
| `apps/workbench/src/views/analytics.tsx`                  | IMPLEMENTED                                                     |
| `apps/workbench/src/views/analytics.test.tsx`             | NEW                                                             |
| `apps/workbench/src/views/workbench.tsx`                  | IMPLEMENTED                                                     |
| `apps/workbench/src/views/workbench.test.tsx`             | NEW                                                             |
| `apps/workbench/src/app.tsx`                              | EXTEND                                                          |
| `apps/workbench/src/main.tsx`                             | EXTEND                                                          |
| `apps/workbench/package.json`                             | EXTEND (`@dnd-kit`, `react-markdown`, `remark-gfm`, `test:e2e`) |
| `apps/workbench/playwright.config.ts`                     | NEW                                                             |
| `apps/workbench/e2e/workbench.spec.ts`                    | NEW                                                             |
| `apps/vscode/src/models/feature.ts`                       | NEW                                                             |
| `apps/vscode/src/services/specs-data.ts`                  | NEW                                                             |
| `apps/vscode/src/services/specs-data.test.ts`             | NEW                                                             |
| `apps/vscode/src/utils/editor-utils.ts`                   | NEW                                                             |
| `apps/vscode/src/utils/editor-utils.test.ts`              | NEW                                                             |
| `apps/vscode/src/panels/workbench-panel.ts`               | EXTEND                                                          |
| `apps/vscode/src/panels/workbench-panel.test.ts`          | NEW                                                             |
| `apps/vscode/src/providers/spec-codelens.ts`              | NEW                                                             |
| `apps/vscode/src/providers/spec-codelens.test.ts`         | NEW                                                             |
| `apps/vscode/src/providers/spec-hover.ts`                 | NEW                                                             |
| `apps/vscode/src/providers/spec-hover.test.ts`            | NEW                                                             |
| `apps/vscode/src/providers/spec-definition.ts`            | NEW                                                             |
| `apps/vscode/src/providers/spec-definition.test.ts`       | NEW                                                             |
| `apps/vscode/src/providers/see-document-links.ts`         | NEW                                                             |
| `apps/vscode/src/providers/see-document-links.test.ts`    | NEW                                                             |
| `apps/vscode/src/providers/see-completion.ts`             | NEW                                                             |
| `apps/vscode/src/providers/see-completion.test.ts`        | NEW                                                             |
| `apps/vscode/src/providers/afx-code-actions.ts`           | NEW                                                             |
| `apps/vscode/src/providers/afx-code-actions.test.ts`      | NEW                                                             |
| `apps/vscode/src/extension.ts`                            | EXTEND                                                          |
| `apps/vscode/package.json`                                | EXTEND                                                          |

**Total: 69 files** (52 new entries + 17 changed entries)

---

## Verification Gates

After every phase: `pnpm verify` — read output, fix before proceeding.

| Gate      | Command                                                                                      |
| --------- | -------------------------------------------------------------------------------------------- |
| Phase 1   | `pnpm --filter @afx/shared exec tsc --noEmit`                                                |
| Phase 3   | `pnpm --filter apps/workbench test` — coverage ≥ 70%                                         |
| Phase 4   | `pnpm --filter apps/workbench test && pnpm --filter apps/workbench build`                    |
| Phase 5   | `pnpm --filter apps/workbench test:e2e` (Playwright `webServer` auto-starts Vite dev server) |
| Phase 6–7 | `pnpm --filter agenticflowx test`                                                            |
| Phase 8–9 | `pnpm --filter agenticflowx test && pnpm --filter agenticflowx check:types`                  |
| Final     | `pnpm verify:full` — all green                                                               |

Additional mandatory assertions before plan sign-off:

1. Protocol invariant tests: reject/ignore malformed message payloads; accept canonical payloads only (`afxOpenFile.path`).
2. Host write-path tests: parser failure paths do not write files and emit typed failure logs/results.
3. Command parity test: registered `afx.*` code-action commands exactly match `apps/vscode/package.json` contributions (no missing or orphan IDs).
4. Kanban path test: scanner + watcher cover `.afx/kanban/*.md` and notes cover `.afx/notes.md`.

---

## Delegation Packets (Parallel-Safe)

Use these packets to split work across multiple coding agents with non-overlapping write ownership.

### Packet A — Shared Contract + Bridge Foundation

**Owner files:**

- `apps/workbench/vitest.config.unit.ts` (EXTEND — add `@afx/shared` alias)
- `apps/workbench/src/index.css` (EXTEND — add `.afx-surface-*` classes)
- `packages/shared/src/workbench-types.ts`
- `packages/shared/src/workbench-types.test.ts`
- `packages/shared/src/workbench-protocol.ts`
- `packages/shared/src/index.ts`
- `apps/workbench/src/lib/bridge.ts`
- `apps/workbench/src/lib/bridge.test.ts`
- `apps/workbench/src/context/workbench-context.tsx`
- `apps/workbench/src/context/workbench-context.test.tsx`

**Done criteria:**

1. `@afx/shared` alias resolves in `apps/workbench` tests — no import resolution errors.
2. `.afx-surface-*` classes present in `index.css` before any view is written.
3. Protocol invariants encoded in types and validated in host-facing boundaries.
4. Bridge/context tests pass and assert malformed-message handling behavior.

### Packet B — Workbench Utilities + Hooks

**Owner files:**

- `apps/workbench/src/lib/pipeline.ts`
- `apps/workbench/src/lib/pipeline.test.ts`
- `apps/workbench/src/lib/documents.ts`
- `apps/workbench/src/lib/documents.test.ts`
- `apps/workbench/src/lib/analytics.ts`
- `apps/workbench/src/lib/analytics.test.ts`
- `apps/workbench/src/lib/document-outline.ts`
- `apps/workbench/src/lib/document-outline.test.ts`
- `apps/workbench/src/lib/frontmatter.ts`
- `apps/workbench/src/lib/frontmatter.test.ts`
- `apps/workbench/src/lib/markdown.ts`
- `apps/workbench/src/lib/markdown.test.tsx`
- `apps/workbench/src/hooks/use-local-storage.ts`
- `apps/workbench/src/hooks/use-local-storage.test.ts`
- `apps/workbench/src/hooks/use-backlinks-scan.ts`
- `apps/workbench/src/hooks/use-backlinks-scan.test.ts`
- `apps/workbench/src/hooks/use-feature-enrichment.ts`
- `apps/workbench/src/hooks/use-feature-enrichment.test.ts`

**Done criteria:**

1. Hooks avoid global listener leaks and are deterministic under repeated mount/unmount.
2. Markdown/frontmatter/document logic uses parser-backed behavior where applicable.

### Packet C — Workbench Views + App Wiring

**Owner files:**

- `apps/workbench/src/views/*.tsx`
- `apps/workbench/src/views/*.test.tsx`
- `apps/workbench/src/app.tsx`
- `apps/workbench/src/main.tsx`
- `apps/workbench/src/index.css`
- `apps/workbench/src/no-boundary-imports.test.ts`
- `apps/workbench/package.json`
- `apps/workbench/playwright.config.ts`
- `apps/workbench/e2e/workbench.spec.ts`

**Done criteria:**

1. All 7 tabs replace stubs and satisfy empty/loading/error/accessibility standards.
2. E2E smoke tests run via Playwright `webServer` (no manual server dependency).

### Packet D — VSCode Data Service + Panel Host

**Owner files:**

- `apps/vscode/src/models/feature.ts`
- `apps/vscode/src/services/specs-data.ts`
- `apps/vscode/src/services/specs-data.test.ts`
- `apps/vscode/src/panels/workbench-panel.ts`
- `apps/vscode/src/panels/workbench-panel.test.ts`

**Done criteria:**

1. Scanner/watchers cover `docs/specs/**`, `.afx/kanban/*.md`, `.afx/notes.md`.
2. All `WorkbenchOutbound` handlers implemented with parse-transform-serialize write policy.
3. Parse failure paths are fail-closed and test-covered.

### Packet E — IDE Traceability + Context Menu

**Owner files:**

- `apps/vscode/src/utils/editor-utils.ts`
- `apps/vscode/src/utils/editor-utils.test.ts`
- `apps/vscode/src/providers/spec-codelens.ts`
- `apps/vscode/src/providers/spec-codelens.test.ts`
- `apps/vscode/src/providers/spec-hover.ts`
- `apps/vscode/src/providers/spec-hover.test.ts`
- `apps/vscode/src/providers/spec-definition.ts`
- `apps/vscode/src/providers/spec-definition.test.ts`
- `apps/vscode/src/providers/see-document-links.ts`
- `apps/vscode/src/providers/see-document-links.test.ts`
- `apps/vscode/src/providers/see-completion.ts`
- `apps/vscode/src/providers/see-completion.test.ts`
- `apps/vscode/src/providers/afx-code-actions.ts`
- `apps/vscode/src/providers/afx-code-actions.test.ts`
- `apps/vscode/src/extension.ts`
- `apps/vscode/package.json`

**Done criteria:**

1. Command IDs are centralized and parity-tested against `package.json` contributions.
2. No singleton/global action-dispatch lookup; `AgentManager` dependency injected.
3. Definition provider is canonical path for `@see` navigation correctness.

---

## Go / No-Go Checklist

Plan is **Go** only if all checks below are true:

1. Every new source file in the manifest has planned `@see` anchors pointing to existing spec/design nodes.
2. Protocol contract table and invariants are internally consistent (no duplicate payload semantics).
3. Write-path policy is parse-transform-serialize for all host mutations with fail-closed behavior.
4. Delegation packets have disjoint ownership and explicit done criteria.
5. Verification gates + additional mandatory assertions are executable with current repo scripts.

If any check fails, mark **No-Go**, patch plan, and re-run this checklist before implementation starts.
