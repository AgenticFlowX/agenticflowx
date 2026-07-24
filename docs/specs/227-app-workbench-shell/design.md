---
afx: true
type: DESIGN
status: Approved
owner: "@rixrix"
version: "1.4"
created_at: "2026-05-03T03:28:22.000Z"
updated_at: "2026-07-19T03:56:24.000Z"
tags:
  [
    "app",
    "workbench",
    "shell",
    "tabs",
    "bridge",
    "layout",
    "realtime",
    "mutations",
    "view-visibility",
    "multi-root",
  ]
spec: spec.md
---

# App Workbench Shell - Technical Design

---

## [DES-OVR] Overview

The Workbench shell is the VSCode bottom-panel webview container. It owns React
bootstrap, bridge lifecycle, state reducer, tab routing, loading/empty states,
the first-run launchpad, and the feature-scoped SDD Studio.

---

## [DES-ARCH] Architecture

```text
VSCode host
  ├─ WorkbenchFileState -> latest-wins refresh coordinator -> afxUpdate
  └─ WorkbenchMutationCoordinator -> per-path FIFO -> afxMutationResult
      |
      v
main.tsx -> initWorkbenchBridge()
  ├─ default -> App -> WorkbenchProvider -> WorkbenchShell
  │                                      ├─ Workbench -> 227
  │                                      ├─ Pipeline -> 225
  │                                      ├─ Documents -> 222
  │                                      ├─ Analytics -> 226
  │                                      ├─ Journal -> 223
  │                                      ├─ Board -> 221
  │                                      ├─ Notes -> 224
  │                                      └─ Canvas -> 229
  ├─ preview -> PreviewApp
  └─ canvas-editor -> CanvasEditorApp -> shared Canvas document components
```

---

## [DES-UI] User Interface & UX

### [DES-SHELL-MOCKUP] Bottom Panel Shell ASCII

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ AFX Workbench                                                                               │
│ [Workbench] [Pipeline] [Documents] [Analytics] [Journal] [Board] [Notes]                     │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│ Active child surface fills the remaining bottom-panel height.                                │
│ Loading state: centered skeleton/copy while host data arrives.                               │
│ Empty state: per-surface Empty component with next action.                                   │
│ Reserved next tab: Impact Lens -> 228, mounted only when implementation begins.               │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

### [DES-SHELL-TABS] Tab Routing

`WorkbenchShell` renders tab triggers and maps tab IDs to child surfaces. Child
tab internals must point at their child specs, not this shell spec.

### [DES-SHELL-TAB-VISIBILITY] Experimental view visibility

<!-- @see spec.md [FR-2] [FR-8] [FR-11] [FR-16] -->

`WORKBENCH_VIEWS` is one fixed ordered registry containing ID, label, icon,
capability predicate, lazy component, and owning spec. The workspace-scoped
`afx.experimental.workbenchHiddenViews` setting removes IDs after capability
checks. A controlled active ID falls back to the nearest visible neighbor when
hidden; if none remain, the shell renders Restore all and Open Settings actions.
Hiding a view never deletes data or disables editor-area entry points. Unknown
future registry IDs remain visible by default because persistence stores hidden,
not visible, IDs.

The active tab is controlled. When a visible tab becomes hidden, selection
moves to the closest visible registry neighbor (prefer the next item, then the
previous). The all-hidden recovery surface is rendered outside `<Tabs>` so it
cannot hide itself and sends the same request-correlated restore mutation used
by Settings. Tab hiding is independent from child file/data lifecycles.

### [DES-SHELL-SURFACE-STYLES] Shell Surface Styles

`index.css` imports shared `@afx/ui` globals, normalizes interactive cursors,
and defines Workbench-local surface classes used by shell cards, toolbars,
fields, and the notes capture strip.

### [DES-SHELL-STATE] Workbench State Provider

`WorkbenchProvider` stores host-fed state, exposes `send`, subscribes to
`afxUpdate`, and allows test `initialState` overrides.

### [DES-SHELL-LIVE-DOCUMENTS] Live source snapshots

<!-- @see spec.md [FR-3] [FR-17] [FR-19] [FR-20] -->

`WorkbenchFileState` classifies relevant Docs, Notes, Board, and Canvas URIs,
prefers open `TextDocument.getText()` content over disk, and hashes content into
a stable revision. It observes change, save, close, workspace-folder, and
filesystem events. A 150 ms trailing debounce feeds a single-flight
`WorkbenchRefreshCoordinator`; changes arriving during a scan request one more
scan and an obsolete generation is never cached or posted.

Notes and Board scan independently of `docs/`. All workspace folders plus
supported nested AFX roots retain explicit identity. Invalid unsaved Canvas JSON
does not erase the last valid graph and suspends Canvas autosave.

The service is URI-keyed and exposes one read contract:

```typescript
read(source: WorkbenchSourceIdentity): Promise<{
  text: string;
  revision: WorkbenchSourceRevision;
}>;
```

Resolution first matches `rootUri`, then joins and normalizes `relativePath`,
and finally verifies the result remains within that root. It never silently
falls back to the first workspace folder. Open document overlays are indexed by
URI and cleared/re-read on close so a discard returns to disk truth.

The refresh coordinator increments `requestedGeneration` for every debounced
event. One scan runs at a time; completion may publish only when its generation
still equals the requested generation. If events arrived during the scan, the
loop immediately performs one new consolidated scan. Cache replacement and
`afxUpdate` posting happen in the same generation check.

### [DES-SHELL-MUTATION-COORDINATOR] Acknowledged mutations

<!-- @see spec.md [FR-4] [FR-18] [FR-20] [NFR-2] [NFR-6] -->

Every mutation carries `requestId`, canonical target identity, and
`expectedRevision` except create. `WorkbenchMutationCoordinator` maintains one
FIFO promise chain per canonical URI, rejects outside-workspace, stale, dirty
buffer, missing, and collision cases, and posts exactly one
`afxMutationResult`. Success is posted only after the host operation completes
and a confirmed latest snapshot is available. Child surfaces retain input and
dirty state until their matching success; stale results cannot clear newer work.

Each canonical URI maps to a promise tail. A new operation chains after that
tail and removes the map entry only when its own tail settles. The coordinator
re-reads current content immediately before applying the mutation. A dirty open
document returns `dirty-document`; a clean open document is changed with
`WorkspaceEdit`; a closed document uses `workspace.fs`. Create operations key
their FIFO lane by canonical parent plus intended filename and fail on
collisions. No handler posts optimistic success.

### [DES-SHELL-BRIDGE] Webview Bridge

`initWorkbenchBridge`, `workbenchSend`, and `workbenchOn` wrap VSCode webview
postMessage when available and browser mock behavior when outside VSCode.

### [DES-SHELL-FEATURE-MOCKUP] SDD Studio ASCII

```text
┌──────────────────────────────────── SDD Studio ─────────────────────────────────────┐
│ [Current feature v] status | tasks | progress                    View: Overview/Focus/Compare │
├──────────── left guidance ───────────┬──────────────── active work ─────────────────┤
│ Workflow                             │ Overview: next work, role modes, active docs │
│ 1 Spec -> 2 Design -> 3 Tasks -> 4 Proof │ Focus: one doc reader with path/actions     │
│ Needs Attention                      │ Compare: resizable spec/design/tasks/session columns │
└──────────────────────────────────────┴──────────────────────────────────────────────┘
```

### [DES-SHELL-SDD-STUDIO] SDD Studio IA

`views/workbench.tsx` renders the feature-scoped SDD Studio. The Studio is the
default Workbench tab surface for specs and sprints, and it is optimized for a
constrained VSCode bottom-panel viewport.

Studio IA rules:

- The current feature selector is the only feature context surface. It shows
  feature title, status, task count, progress, and recent-feature selection.
- Overview mode is a guided hub. The left rail stacks Workflow and Needs
  Attention; the main area shows next work, role modes, and active docs.
- Focus mode keeps the same left rail and expands one selected document into a
  reading/work surface.
- Compare mode restores the resizable document columns for side-by-side spec,
  design, tasks, and sessions review.
- Workflow copy is stable across Overview and Focus: "Follow the artifact chain
  from intent to proof."
- Attention items are human-facing blockers, questions, proof checks, or task
  nudges. They stay close to Workflow guidance instead of occupying a detached
  right rail.
- Active docs explain which role uses each artifact and provide explicit Focus
  and Preview actions.

### [DES-SHELL-FEATURE-COLUMNS] Feature Column Layout

`views/workbench.tsx` owns SDD Studio layout, mode state, splitters, and bridge
routing. Document rendering itself belongs to `222`.

| Area              | Shell responsibility                                                             | Delegated design                                  |
| ----------------- | -------------------------------------------------------------------------------- | ------------------------------------------------- |
| Feature header    | Select current feature, derive spec/design/tasks paths, and show status/progress | Data shape from `WorkbenchState`                  |
| Studio mode       | Switch Overview, Focus, and Compare without losing selected feature or focus doc | Local Workbench webview state                     |
| Guidance rail     | Show workflow sequence and attention items for the active feature                | Attention source semantics from parsed documents  |
| Active docs       | Show role-oriented doc cards and route Focus/Preview actions                     | Internal document rendering from `DocumentStudio` |
| Column visibility | Show/hide spec, design, tasks, and sessions columns in Compare mode              | Accessible toggle labels and pressed state        |
| Column rail       | Horizontal rail in compact panels; expanded grid in zen/large panels             | Internal document rendering from `DocumentStudio` |
| Command routing   | Draft typed chat commands with `afxOpenChatCommand`                              | Command catalog behavior from child AFX workflows |
| Source toggles    | Forward task/session toggle messages to the host                                 | Mutation helpers in VSCode panel code             |
| Drift footer      | Show status, stale age, and ghost-reference hints in Compare mode                | Child document specs own source semantics         |

Layout rules:

- Compact bottom panel: visible columns keep a readable minimum width and scroll
  horizontally inside the Workbench region.
- Expanded or zen bottom panel: visible columns expand to fill the available
  panel so spec/design/tasks can be compared without opening a new editor group.
- Column containment: each pane clips to its paper surface, reserves internal
  scroll space, wraps long prose and paths, and lets tables/code blocks scroll
  inside their own element.
- Overview containment: the feature header owns feature context; the body does
  not repeat a separate feature card.
- Focus containment: Workflow and Needs Attention stay visible beside the
  active document so document reading does not hide the SDD sequence.

Command actions are scoped to the surface they affect:

| Column | Global actions                                               | Surgical actions                                                                        |
| ------ | ------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| Spec   | `/afx-spec refine`, `/afx-spec review`                       | Section-scoped actions from the shared document toolbar                                 |
| Design | `/afx-design refine`, `/afx-design review`                   | Section-scoped actions from the shared document toolbar                                 |
| Tasks  | `/afx-task refine`, `/afx-task status`, `/afx-task code all` | Per-phase `Code` action drafting `/afx-task code <feature>#<wbs> phase <number> <name>` |

All actions draft or send through `afxOpenChatCommand`; they do not mutate
markdown source directly.

### [DES-SHELL-LAUNCHPAD] First-Run Launchpad

The launchpad appears in empty Workbench, Pipeline, and Documents contexts. It
offers four durable next moves:

- Draft a full-spec command in Chat.
- Draft a sprint command in Chat.
- Create a sample complete SDD set in `docs/specs/sample-workbench-tour/`.
- Create a sample sprint markdown file in `docs/specs/sample-sprint-tour/`.

The launchpad is a usable control surface, not tutorial prose. It is designed
for the constrained bottom-panel viewport: compact header, dense starter
actions, and a slim workflow map that remains readable when the primary
sidebar, editor, and secondary sidebar are all visible. Shell tabs use
horizontal overflow rather than clipping when the panel width gets tight.

### [DES-SHELL-PREVIEW-MODE] Standalone Preview Boot Mode

The Workbench bundle has three boot targets from the same Vite entry. There are
no duplicate preview or Canvas builds.

| Boot target            | Selector                                                           | Mounted root          |
| ---------------------- | ------------------------------------------------------------------ | --------------------- |
| Bottom-panel Workbench | default                                                            | `<App />`             |
| Editor-area preview    | `body[data-afx-view="preview"]` or `?afx-view=preview`             | `<PreviewApp />`      |
| Editor-area Canvas     | `body[data-afx-view="canvas-editor"]` or `?afx-view=canvas-editor` | `<CanvasEditorApp />` |

`main.tsx` always initializes the bridge, appearance subscription, and telemetry
subscription once. Only the React root component changes.

Preview host contract:

| Step                     | Owner                         | Contract                                                                                                |
| ------------------------ | ----------------------------- | ------------------------------------------------------------------------------------------------------- |
| Mark preview HTML        | VSCode host                   | `loadWebviewHtml(..., { view: "preview" })` writes static `data-afx-view="preview"` on `<body>`.        |
| Mount preview root       | `apps/workbench/src/main.tsx` | Reads the body dataset or query fallback before rendering.                                              |
| Provide bridge context   | `PreviewApp`                  | Wraps content in `WorkbenchProvider` so `DocPreview` command buttons can call `send`.                   |
| Receive document content | `PreviewApp`                  | Subscribes to `afxPreviewShow`; it does not call `afxFetchDocContent`.                                  |
| Build document row       | `PreviewApp`                  | Parses frontmatter and builds a synthetic `DocumentRow` from `filePath` plus metadata.                  |
| Choose render mode       | `PreviewApp`                  | Uses `isFullAfxDoc`; full AFX docs get `mode="full"`, other markdown gets `mode="generic"`.             |
| Render                   | `DocPreview`                  | Uses `showAfxPreviewAction={false}` so the preview panel does not show a recursive open-preview button. |

The static body attribute is present before React mounts and is not an inline
script, so it does not require a CSP nonce or `script-src` change.

### [DES-SHELL-CANVAS-EDITOR-BOOT] Canvas Custom-Editor Boot

The VS Code `CustomTextEditorProvider` is owned by `229`, but the shared bundle
dispatch is owned here. `CanvasEditorApp` receives one document-addressed
`afxCanvasEditorDocument`, applies typed user mutations through
`afxCanvasApplyMutation`, and receives the common `afxMutationResult`. It does
not mount bottom-panel tabs or depend on their visibility.

Document state is URI/revision scoped and shared by the host across multiple
open editors; viewport and selection are view-local. The webview does not own a
save timer, and unmounting a hidden editor cannot cancel a host-side pending
save. Custom editor dirty/save/undo/hot-exit behavior remains backed by the VS
Code `TextDocument`/`WorkspaceEdit` lifecycle defined in `229`.

---

## [DES-DEC] Key Decisions

| Decision              | Options Considered           | Choice         | Rationale                                                             |
| --------------------- | ---------------------------- | -------------- | --------------------------------------------------------------------- |
| Parent responsibility | Own all tabs, own shell only | Own shell only | Child specs keep surgical routing.                                    |
| Bridge location       | Context, standalone lib      | Standalone lib | Tests and future surfaces can use the same wrappers.                  |
| Feature tab ownership | New spec now, shell spec     | Shell spec     | Current code is layout/state-heavy and colocated with shell behavior. |

Additional approved decisions use an open-document overlay instead of a
disk-only watcher, single-flight generations instead of concurrent publication,
per-path FIFO instead of one global mutation queue, a hidden-ID set instead of
a visible allowlist, and one boot selector instead of separate webview builds.

---

## [DES-DATA] Data Model

### [DES-SHELL-DATA] Shell Data Shapes

The shell surface owns the global `WorkbenchState` plus one ambient shared type defined in
`packages/shared/src/workbench-types.ts`. Each declaration in that file should carry
`@see` to the matching anchor below.

| Type                      | Owns                                                        | Local @see                                        |
| ------------------------- | ----------------------------------------------------------- | ------------------------------------------------- |
| `WorkSessionRow`          | One session row in the recent-sessions strip                | `[DES-SHELL-DATA]`, `[DES-SHELL-FEATURE-COLUMNS]` |
| `WorkbenchState`          | Aggregate hidden IDs, capability flags, and child snapshots | `[DES-SHELL-STATE]`                               |
| `WorkbenchSourceIdentity` | Canonical workspace root plus relative path                 | `[DES-SHELL-LIVE-DOCUMENTS]`                      |
| `WorkbenchSourceRevision` | Projected content/disk/document version and dirty state     | `[DES-SHELL-LIVE-DOCUMENTS]`                      |
| `WorkbenchMutationResult` | One correlated success/conflict/error result                | `[DES-SHELL-MUTATION-COORDINATOR]`                |
| `WorkbenchViewDefinition` | Ordered ID, label, icon, capability, component, owner       | `[DES-SHELL-TAB-VISIBILITY]`                      |

`WorkbenchState` is shared across child surfaces. Shell initializes empty arrays,
selected feature state, ghost-task defaults, and loading state.

---

## [DES-API] API Contracts

Inbound:

- `afxUpdate`
- `afxDocContent`
- `afxMutationResult` — exactly one terminal response per mutating request
- `afxCanvasEditorDocument` — URI/revision-addressed document for Canvas editor boot
- `afxCanvasEditorState` — view-local selection/viewport restoration

Outbound:

- `afxReady`
- `afxOpenFile` — `mode: "editor" | "preview" | "afxPreview"`
- `afxFetchDocContent`
- `afxToggleTask`
- `afxToggleSession` — per-row Agent/Human signoff toggle (optional `line?` for exact source-line targeting)
- `afxToggleAllSessions` — bulk "Select all" for the chosen column (FR-7)
- `afxApproveSessions` — bulk Approve: check Human wherever Agent is already checked (FR-7)
- `afxCopyMarkdown` — copy raw markdown source through the host clipboard (see
  `222-app-workbench-documents [DES-DOCS-PREVIEW-STANDALONE]`)
- `afxOpenChatCommand`
- `afxCreateSampleDocs`
- `experimental/setWorkbenchHiddenViews` — request-correlated restore/hide mutation shared with Settings
- Source-backed Notes, Board, document, and Canvas mutations carry `requestId`, canonical target, and `expectedRevision`
- `afxCanvasEditorReady`, `afxCanvasApplyMutation`, `afxCanvasEditorSetViewState`

The bottom-panel ready handshake includes a client instance ID. The host may
serve multiple Workbench/preview/custom-editor clients, but mutation results are
routed to the originating webview and shared source updates fan out to every
client displaying that source.

---

## [DES-FILES] File Structure

| File                                                    | Purpose                                      |
| ------------------------------------------------------- | -------------------------------------------- |
| `apps/workbench/src/main.tsx`                           | React entry and bridge init                  |
| `apps/workbench/src/app.tsx`                            | Root shell, tab routing, loading state       |
| `apps/workbench/src/app.test.tsx`                       | Shell tab smoke tests                        |
| `apps/workbench/src/index.css`                          | Workbench-local surface and cursor styles    |
| `apps/workbench/src/context/workbench-context.tsx`      | State reducer/provider/hook                  |
| `apps/workbench/src/lib/bridge.ts`                      | Typed webview bridge wrapper                 |
| `apps/workbench/src/views/workbench.tsx`                | Feature-scoped thinking desk                 |
| `apps/workbench/src/components/workbench-launchpad.tsx` | First-run launchpad and sample creation CTAs |
| `apps/workbench/src/components/coming-soon.tsx`         | Shared placeholder surface                   |

New foundation files:

| File                                                         | Purpose                                               |
| ------------------------------------------------------------ | ----------------------------------------------------- |
| `apps/workbench/src/canvas-editor-app.tsx`                   | Editor-area Canvas root without tabs                  |
| `apps/workbench/src/lib/workbench-views.ts`                  | Ordered controlled registry and capability filter     |
| `apps/vscode/src/services/workbench-file-state.ts`           | Open-document overlay, multi-root identity, revisions |
| `apps/vscode/src/services/workbench-refresh-coordinator.ts`  | Debounced latest-wins publication                     |
| `apps/vscode/src/services/workbench-mutation-coordinator.ts` | Per-path FIFO, conflicts, terminal results            |
| `apps/vscode/src/panels/workbench-panel.ts`                  | Client lifecycle and update/result routing            |

---

## [DES-DEPS] Dependencies

- `@afx/shared` for Workbench state/protocol.
- `@afx/ui` for tabs, empty states, scroll areas, and controls.
- VS Code `workspace` document/filesystem events and `WorkspaceEdit` at the host boundary only.
- Child specs `221` through `227` for current tab internals.
- `228-app-workbench-impact-lens` as a reserved Workbench child surface until
  implementation starts.

---

## [DES-SEC] Security Considerations

The shell and child surfaces must use typed bridge messages only. The webview
must not import VSCode host APIs or read local files directly.

---

## [DES-ERR] Error Handling

- Missing provider throws a clear `useWorkbench` error.
- Loading state renders while host data is not ready.
- Browser mode uses mock data/read behavior for development.
- Child surfaces own their local empty/error states.
- An invalid dirty Canvas buffer keeps the last valid graph visible, marks it stale, and disables automatic Canvas writes until parsing recovers.
- A stale, dirty, outside-root, missing, collision, or failed mutation returns one typed terminal result; the child retains its unsaved intent and offers Retry/Open Source as appropriate.
- A source read failure is isolated to that source and does not clear the last successful state for unrelated children.

---

## [DES-TEST] Testing Strategy

- App tests cover tab labels and shell rendering.
- Launchpad tests cover command/sample CTA payloads.
- Workbench feature tests cover SDD Studio picker state, overview guidance,
  focus reading, contextual command actions, clean paper readers, and the
  internal responsive column rail.
- E2E screenshots cover populated tabs, standard and constrained first-run
  launchpad states, and compact/zen feature thinking desk layouts.
- Future tests should cover provider state update, bridge subscriptions, feature
  column toggles, task/session toggle messages, and Impact Lens tab addition.
- Host unit tests cover open unsaved overlays, save/close/discard, external file
  writes, nested/multi-root identity, debounce, overlapping scan generations,
  independent Notes/Board discovery, and last-valid invalid Canvas behavior.
- Mutation tests cover same-path FIFO, different-path concurrency, every
  conflict/error code, exactly-one result, create collision, and clean open
  `WorkspaceEdit` versus closed-file `workspace.fs` writes.
- Shell tests cover hidden/capability intersections, active fallback, all-hidden
  recovery, unknown IDs, and Canvas tab/editor independence.
- Boot tests cover exactly one bridge initialization for default, preview, and
  canvas-editor roots plus multiple Canvas editor client routing.

---

## [DES-ROLLOUT] Migration / Rollout Plan

1. Retarget shell/source refs from `220-app-workbench` to this child spec where appropriate.
2. Keep `220-app-workbench` as the parent route map.
3. Land shared identity/revision/result types, then the host file-state and
   refresh coordinators without changing child writes.
4. Migrate child mutations to correlated per-path FIFO one surface at a time;
   remove fire-and-forget success only after its tests pass.
5. Add the controlled hidden-view registry and all-hidden recovery before the
   Settings switches are exposed.
6. Add the Canvas editor boot target before registering the custom editor owned
   by `229`.
7. Add Impact Lens only after `228` implementation begins; keep its Canvas graph
   reuse read-only.

---

## [DES-SHELL-LOC] Code Locator Map

| Map ID              | Code anchor                                                                            | Messages/data                               | Tests                             |
| ------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------- | --------------------------------- |
| `[Shell.App]`       | `apps/workbench/src/app.tsx` `App` + tab routing                                       | `WorkbenchInbound`, `afxUpdate`             | `apps/workbench/src/app.test.tsx` |
| `[Shell.Context]`   | `apps/workbench/src/context/workbench-context.tsx` `WorkbenchProvider`                 | `WorkbenchState`                            | future context tests              |
| `[Shell.Bridge]`    | `apps/workbench/src/lib/bridge.ts` `initWorkbenchBridge`/`workbenchSend`/`workbenchOn` | `WorkbenchInbound`, `WorkbenchOutbound`     | manual                            |
| `[Shell.Feature]`   | `apps/workbench/src/views/workbench.tsx` SDD Studio                                    | `selectedFeature`, studio mode, focus doc   | workbench.test.tsx + e2e          |
| `[Shell.Launchpad]` | `apps/workbench/src/components/workbench-launchpad.tsx` first-run actions              | `afxOpenChatCommand`, `afxCreateSampleDocs` | launchpad tests + e2e screenshots |

| Map ID               | Code anchor                                                  | Messages/data                          | Tests                  |
| -------------------- | ------------------------------------------------------------ | -------------------------------------- | ---------------------- |
| `[Shell.Views]`      | `apps/workbench/src/lib/workbench-views.ts`                  | View IDs, hidden IDs, capabilities     | App and responsive e2e |
| `[Shell.FileState]`  | `apps/vscode/src/services/workbench-file-state.ts`           | Source identity/revision, open overlay | Host service tests     |
| `[Shell.Refresh]`    | `apps/vscode/src/services/workbench-refresh-coordinator.ts`  | Scan generations, latest update        | Host concurrency tests |
| `[Shell.Mutations]`  | `apps/vscode/src/services/workbench-mutation-coordinator.ts` | Request, revision, terminal result     | Host mutation tests    |
| `[Shell.CanvasBoot]` | `canvas-editor-app.tsx`, `main.tsx`                          | Editor document/mutation/state         | Boot and editor e2e    |

## [DES-SHELL-TRACE] Functional Trace Matrix

| Requirement | Design nodes                                                                          | Code anchors                                                                          | Verification      |
| ----------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ----------------- |
| FR-1        | `[DES-SHELL-BRIDGE]`                                                                  | `main.tsx`, `initWorkbenchBridge`                                                     | app.test.tsx      |
| FR-2        | `[DES-SHELL-TABS]`, `[DES-SHELL-MOCKUP]`                                              | `App`, `TabsList`, `TabsContent`                                                      | app + e2e         |
| FR-3        | `[DES-SHELL-STATE]`, `[DES-SHELL-DATA]`                                               | `WorkbenchProvider`, reducer                                                          | app + view tests  |
| FR-4        | `[DES-SHELL-BRIDGE]`, `[DES-API]`                                                     | `workbenchSend`, `workbenchOn`                                                        | launchpad tests   |
| FR-5        | `[DES-SHELL-MOCKUP]`, `[DES-SHELL-LAUNCHPAD]`                                         | loading state, empty launchpad                                                        | app + e2e         |
| FR-6        | `[DES-SHELL-SDD-STUDIO]`, `[DES-SHELL-FEATURE-MOCKUP]`, `[DES-SHELL-FEATURE-COLUMNS]` | `Workbench`, Studio components, column components                                     | workbench + e2e   |
| FR-7        | `[DES-SHELL-FEATURE-COLUMNS]`, `[DES-API]`                                            | `OpenActions`, task/session ticks                                                     | workbench + board |
| FR-8        | `[DES-SHELL-TABS]`                                                                    | child route mapping                                                                   | app.test.tsx      |
| FR-9        | `[DES-SHELL-LAUNCHPAD]`                                                               | `WorkbenchLaunchpad`                                                                  | app/workbench/e2e |
| FR-10       | `[DES-SHELL-LAUNCHPAD]`, `[DES-API]`                                                  | launchpad bridge buttons                                                              | launchpad tests   |
| FR-11       | `[DES-SHELL-TABS]`, `[DES-SHELL-LAUNCHPAD]`                                           | tabs + launchpad compact layout                                                       | compact e2e       |
| FR-12       | `[DES-SHELL-SDD-STUDIO]`, `[DES-SHELL-FEATURE-COLUMNS]`, `[DES-API]`                  | `Workbench`, `SddStudioHeader`, `SddStudioCockpit`, `SddStudioFocusView`, `ColumnDoc` | workbench + e2e   |

| Requirement | Design nodes                                                     | Code anchors                                 | Verification           |
| ----------- | ---------------------------------------------------------------- | -------------------------------------------- | ---------------------- |
| FR-16       | `[DES-SHELL-TAB-VISIBILITY]`, `[DES-SHELL-STATE]`, `[DES-API]`   | Controlled registry and recovery             | App and responsive e2e |
| FR-17       | `[DES-SHELL-LIVE-DOCUMENTS]`                                     | File state and VS Code listeners             | Host service tests     |
| FR-18       | `[DES-SHELL-MUTATION-COORDINATOR]`, `[DES-API]`                  | Mutation coordinator and child reducers      | Host and child tests   |
| FR-19       | `[DES-SHELL-LIVE-DOCUMENTS]`                                     | Refresh coordinator and independent scanners | Concurrency tests      |
| FR-20       | `[DES-SHELL-LIVE-DOCUMENTS]`, `[DES-SHELL-MUTATION-COORDINATOR]` | Multi-root resolver/watcher                  | Host and e2e           |

---

## [DES-REFS] File Reference Map

| File                                                    | Required @see                                                                                    |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `apps/workbench/src/main.tsx`                           | `spec.md [FR-1]` + `design.md [DES-SHELL-BRIDGE]`                                                |
| `apps/workbench/src/app.tsx`                            | `spec.md [FR-2] [FR-5] [FR-11]` + `design.md [DES-SHELL-TABS] [DES-SHELL-MOCKUP]`                |
| `apps/workbench/src/app.test.tsx`                       | `spec.md [FR-2] [FR-5]` + `design.md [DES-TEST] [DES-SHELL-TABS]`                                |
| `apps/workbench/src/index.css`                          | `design.md [DES-SHELL-SURFACE-STYLES]`                                                           |
| `apps/workbench/src/context/workbench-context.tsx`      | `spec.md [FR-3]` + `design.md [DES-SHELL-STATE]`                                                 |
| `apps/workbench/src/lib/bridge.ts`                      | `spec.md [FR-4]` + `design.md [DES-SHELL-BRIDGE]`                                                |
| `apps/workbench/src/views/workbench.tsx`                | `spec.md [FR-6] [FR-7] [FR-12]` + `design.md [DES-SHELL-SDD-STUDIO] [DES-SHELL-FEATURE-COLUMNS]` |
| `apps/workbench/src/components/workbench-launchpad.tsx` | `spec.md [FR-9] [FR-10] [FR-11]` + `design.md [DES-SHELL-LAUNCHPAD]`                             |
| `apps/workbench/src/components/coming-soon.tsx`         | `spec.md [FR-5]` + `design.md [DES-SHELL-TABS]`                                                  |

| File                                                                  | Required @see                                                             |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `apps/workbench/src/lib/workbench-views.ts`                           | `spec.md [FR-16]`; `design.md [DES-SHELL-TAB-VISIBILITY]`                 |
| `apps/workbench/src/canvas-editor-app.tsx`                            | `spec.md [FR-1] [FR-16]`; `design.md [DES-SHELL-CANVAS-EDITOR-BOOT]`      |
| `apps/vscode/src/services/workbench-file-state.ts`                    | `spec.md [FR-17] [FR-20]`; `design.md [DES-SHELL-LIVE-DOCUMENTS]`         |
| `apps/vscode/src/services/specs-data.ts` latest-wins scan coordinator | `spec.md [FR-17] [FR-19]`; `design.md [DES-SHELL-LIVE-DOCUMENTS]`         |
| `apps/vscode/src/services/workbench-mutation-coordinator.ts`          | `spec.md [FR-18] [FR-20]`; `design.md [DES-SHELL-MUTATION-COORDINATOR]`   |
| `apps/vscode/src/panels/workbench-panel.ts`                           | `spec.md [FR-17] [FR-18] [FR-19] [FR-20]`; live and mutation design nodes |
