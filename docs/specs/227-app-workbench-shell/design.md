---
afx: true
type: DESIGN
status: Living
owner: "@rixrix"
version: "1.2"
created_at: "2026-05-03T03:28:22.000Z"
updated_at: "2026-05-23T11:28:05.000Z"
tags: ["app", "workbench", "shell", "tabs", "bridge", "layout"]
spec: spec.md
---

# App Workbench Shell - Technical Design

---

## [DES-OVR] Overview

The Workbench shell is the VSCode bottom-panel webview container. It owns React
bootstrap, bridge lifecycle, state reducer, tab routing, loading/empty states,
the first-run launchpad, and the feature-scoped Workbench thinking desk.

---

## [DES-ARCH] Architecture

```text
main.tsx
  └─ initWorkbenchBridge()
      └─ App
          └─ WorkbenchProvider
              └─ WorkbenchShell
                  ├─ Tabs
                  ├─ Workbench tab -> views/workbench.tsx
                  ├─ Pipeline -> 225
                  ├─ Documents -> 222
                  ├─ Analytics -> 226
                  ├─ Journal -> 223
                  ├─ Board -> 221
                  ├─ Notes -> 224
                  └─ Impact Lens -> 228 reserved route
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

### [DES-SHELL-SURFACE-STYLES] Shell Surface Styles

`index.css` imports shared `@afx/ui` globals, normalizes interactive cursors,
and defines Workbench-local surface classes used by shell cards, toolbars,
fields, and the notes capture strip.

### [DES-SHELL-STATE] Workbench State Provider

`WorkbenchProvider` stores host-fed state, exposes `send`, subscribes to
`afxUpdate`, and allows test `initialState` overrides.

### [DES-SHELL-BRIDGE] Webview Bridge

`initWorkbenchBridge`, `workbenchSend`, and `workbenchOn` wrap VSCode webview
postMessage when available and browser mock behavior when outside VSCode.

### [DES-SHELL-FEATURE-MOCKUP] Feature Thinking Desk ASCII

```text
┌──────────────────────────── feature selector / toggles ────────────────────────────┐
│ [feature v] status/progress                               [SPEC][DESIGN][TASKS]    │
├────────────── SPEC paper ────────────┬────────── DESIGN paper ─────────┬──── TASKS ─┤
│ PRD Studio + [Refine][Review]        │ PRD Studio + [Refine][Review]   │ phases + [Code] │
│ clean markdown + tables              │ clean markdown + code blocks    │ [Status][Code all] │
└──────────────────────────────────────┴────────────────────────────────┴────────────┘
Compact panels: columns keep a readable minimum width and scroll inside the Workbench.
Zen panels: columns expand into a paper-like reading surface with the same controls.
Drift footer: spec/design/tasks status, stale age, ghost reference hint.
```

### [DES-SHELL-FEATURE-COLUMNS] Feature Column Layout

`views/workbench.tsx` owns the feature-scoped thinking desk. It is a shell
surface because the implementation is primarily layout, tab state, splitters,
and bridge routing; document rendering itself belongs to `222`.

| Area              | Shell responsibility                                                 | Delegated design                                  |
| ----------------- | -------------------------------------------------------------------- | ------------------------------------------------- |
| Feature selector  | Select current feature and derive spec/design/tasks paths            | Data shape from `WorkbenchState`                  |
| Column visibility | Show/hide spec, design, tasks, and sessions columns                  | Accessible toggle labels and pressed state        |
| Column rail       | Horizontal rail in compact panels; expanded grid in zen/large panels | Internal document rendering from `DocumentStudio` |
| Command routing   | Draft typed chat commands with `afxOpenChatCommand`                  | Command catalog behavior from child AFX workflows |
| Source toggles    | Forward task/session toggle messages to the host                     | Mutation helpers in VSCode panel code             |
| Drift footer      | Show status, stale age, and ghost-reference hints                    | Child document specs own source semantics         |

Layout rules:

- Compact bottom panel: visible columns keep a readable minimum width and scroll
  horizontally inside the Workbench region.
- Expanded or zen bottom panel: visible columns expand to fill the available
  panel so spec/design/tasks can be compared without opening a new editor group.
- Column containment: each pane clips to its paper surface, reserves internal
  scroll space, wraps long prose and paths, and lets tables/code blocks scroll
  inside their own element.

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

The Workbench bundle has two boot targets from the same Vite entry. There is no
separate preview build.

| Boot target            | Selector                                               | Mounted root     |
| ---------------------- | ------------------------------------------------------ | ---------------- |
| Bottom-panel Workbench | default                                                | `<App />`        |
| Editor-area preview    | `body[data-afx-view="preview"]` or `?afx-view=preview` | `<PreviewApp />` |

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

---

## [DES-DEC] Key Decisions

| Decision              | Options Considered           | Choice         | Rationale                                                             |
| --------------------- | ---------------------------- | -------------- | --------------------------------------------------------------------- |
| Parent responsibility | Own all tabs, own shell only | Own shell only | Child specs keep surgical routing.                                    |
| Bridge location       | Context, standalone lib      | Standalone lib | Tests and future surfaces can use the same wrappers.                  |
| Feature tab ownership | New spec now, shell spec     | Shell spec     | Current code is layout/state-heavy and colocated with shell behavior. |

---

## [DES-DATA] Data Model

### [DES-SHELL-DATA] Shell Data Shapes

The shell surface owns the global `WorkbenchState` plus one ambient shared type defined in
`packages/shared/src/workbench-types.ts`. Each declaration in that file should carry
`@see` to the matching anchor below.

| Type             | Owns                                                                    | Local @see                                           |
| ---------------- | ----------------------------------------------------------------------- | ---------------------------------------------------- |
| `WorkSessionRow` | One session row in the recent-sessions strip                            | `[DES-SHELL-DATA]` and `[DES-SHELL-FEATURE-COLUMNS]` |
| `WorkbenchState` | Aggregate UI state container (constructed from inbound update messages) | `[DES-SHELL-STATE]`                                  |

`WorkbenchState` is shared across child surfaces. Shell initializes empty arrays,
selected feature state, ghost-task defaults, and loading state.

---

## [DES-API] API Contracts

Inbound:

- `afxUpdate`
- `afxDocContent`

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

---

## [DES-DEPS] Dependencies

- `@afx/shared` for Workbench state/protocol.
- `@afx/ui` for tabs, empty states, scroll areas, and controls.
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

---

## [DES-TEST] Testing Strategy

- App tests cover tab labels and shell rendering.
- Launchpad tests cover command/sample CTA payloads.
- Workbench feature tests cover contextual command actions, clean paper readers, and
  the internal responsive column rail.
- E2E screenshots cover populated tabs, standard and constrained first-run
  launchpad states, and compact/zen feature thinking desk layouts.
- Future tests should cover provider state update, bridge subscriptions, feature
  column toggles, task/session toggle messages, and Impact Lens tab addition.

---

## [DES-ROLLOUT] Migration / Rollout Plan

1. Retarget shell/source refs from `220-app-workbench` to this child spec where appropriate.
2. Keep `220-app-workbench` as the parent route map.
3. Add Impact Lens tab under this shell after `228` is approved.

---

## [DES-SHELL-LOC] Code Locator Map

| Map ID              | Code anchor                                                                            | Messages/data                               | Tests                             |
| ------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------- | --------------------------------- |
| `[Shell.App]`       | `apps/workbench/src/app.tsx` `App` + tab routing                                       | `WorkbenchInbound`, `afxUpdate`             | `apps/workbench/src/app.test.tsx` |
| `[Shell.Context]`   | `apps/workbench/src/context/workbench-context.tsx` `WorkbenchProvider`                 | `WorkbenchState`                            | future context tests              |
| `[Shell.Bridge]`    | `apps/workbench/src/lib/bridge.ts` `initWorkbenchBridge`/`workbenchSend`/`workbenchOn` | `WorkbenchInbound`, `WorkbenchOutbound`     | manual                            |
| `[Shell.Feature]`   | `apps/workbench/src/views/workbench.tsx` thinking desk                                 | `selectedFeature` state                     | workbench.test.tsx + e2e          |
| `[Shell.Launchpad]` | `apps/workbench/src/components/workbench-launchpad.tsx` first-run actions              | `afxOpenChatCommand`, `afxCreateSampleDocs` | launchpad tests + e2e screenshots |

## [DES-SHELL-TRACE] Functional Trace Matrix

| Requirement | Design nodes                                                | Code anchors                      | Verification      |
| ----------- | ----------------------------------------------------------- | --------------------------------- | ----------------- |
| FR-1        | `[DES-SHELL-BRIDGE]`                                        | `main.tsx`, `initWorkbenchBridge` | app.test.tsx      |
| FR-2        | `[DES-SHELL-TABS]`, `[DES-SHELL-MOCKUP]`                    | `App`, `TabsList`, `TabsContent`  | app + e2e         |
| FR-3        | `[DES-SHELL-STATE]`, `[DES-SHELL-DATA]`                     | `WorkbenchProvider`, reducer      | app + view tests  |
| FR-4        | `[DES-SHELL-BRIDGE]`, `[DES-API]`                           | `workbenchSend`, `workbenchOn`    | launchpad tests   |
| FR-5        | `[DES-SHELL-MOCKUP]`, `[DES-SHELL-LAUNCHPAD]`               | loading state, empty launchpad    | app + e2e         |
| FR-6        | `[DES-SHELL-FEATURE-MOCKUP]`, `[DES-SHELL-FEATURE-COLUMNS]` | `Workbench`, column components    | workbench + e2e   |
| FR-7        | `[DES-SHELL-FEATURE-COLUMNS]`, `[DES-API]`                  | `OpenActions`, task/session ticks | workbench + board |
| FR-8        | `[DES-SHELL-TABS]`                                          | child route mapping               | app.test.tsx      |
| FR-9        | `[DES-SHELL-LAUNCHPAD]`                                     | `WorkbenchLaunchpad`              | app/workbench/e2e |
| FR-10       | `[DES-SHELL-LAUNCHPAD]`, `[DES-API]`                        | launchpad bridge buttons          | launchpad tests   |
| FR-11       | `[DES-SHELL-TABS]`, `[DES-SHELL-LAUNCHPAD]`                 | tabs + launchpad compact layout   | compact e2e       |
| FR-12       | `[DES-SHELL-FEATURE-COLUMNS]`, `[DES-API]`                  | `Workbench`, `ColumnDoc`          | workbench + e2e   |

---

## [DES-REFS] File Reference Map

| File                                                    | Required @see                                                                                        |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `apps/workbench/src/main.tsx`                           | `spec.md [FR-1]` + `design.md [DES-SHELL-BRIDGE]`                                                    |
| `apps/workbench/src/app.tsx`                            | `spec.md [FR-2] [FR-5] [FR-11]` + `design.md [DES-SHELL-TABS] [DES-SHELL-MOCKUP]`                    |
| `apps/workbench/src/app.test.tsx`                       | `spec.md [FR-2] [FR-5]` + `design.md [DES-TEST] [DES-SHELL-TABS]`                                    |
| `apps/workbench/src/index.css`                          | `design.md [DES-SHELL-SURFACE-STYLES]`                                                               |
| `apps/workbench/src/context/workbench-context.tsx`      | `spec.md [FR-3]` + `design.md [DES-SHELL-STATE]`                                                     |
| `apps/workbench/src/lib/bridge.ts`                      | `spec.md [FR-4]` + `design.md [DES-SHELL-BRIDGE]`                                                    |
| `apps/workbench/src/views/workbench.tsx`                | `spec.md [FR-6] [FR-7] [FR-12]` + `design.md [DES-SHELL-FEATURE-COLUMNS] [DES-SHELL-FEATURE-MOCKUP]` |
| `apps/workbench/src/components/workbench-launchpad.tsx` | `spec.md [FR-9] [FR-10] [FR-11]` + `design.md [DES-SHELL-LAUNCHPAD]`                                 |
| `apps/workbench/src/components/coming-soon.tsx`         | `spec.md [FR-5]` + `design.md [DES-SHELL-TABS]`                                                      |
