---
afx: true
type: DESIGN
status: Living
owner: "@rixrix"
version: "1.0"
created_at: "2026-05-03T03:28:22.000Z"
updated_at: "2026-05-20T13:04:07.000Z"
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

`views/workbench.tsx` owns selector, column toggles, the responsive column rail,
spec/design/tasks readers, contextual command actions, task checklist, session
ticks, and drift footer. The feature tab intentionally treats spec/design/tasks
as a decision surface: document columns use the shared `DocumentStudio` reader
from Documents, strip AFX trace noise, render tables through GFM, and place
content in a paper-like card with a constrained reading measure.

The column toggles are explicit show/hide controls. The toolbar labels the
group as "Show/hide docs", each toggle exposes a `Show ... document column` or
`Hide ... document column` accessible name, and the pressed state mirrors
visibility so the buttons read as layout controls instead of ordinary document
actions.

The column rail must behave differently at the two common bottom-panel sizes:

- Compact bottom panel: keep each visible column at a readable minimum width and
  scroll horizontally inside the Workbench region, avoiding page-level overflow
  when primary sidebar, editor, and secondary sidebar are all visible.
- Expanded or zen bottom panel: let the same columns expand to fill the panel so
  users can read, compare, and refine spec/design/tasks without opening a new
  editor group.
- Column containment: each pane clips to its own paper surface, reserves space
  for its internal scroll rail, and wraps long prose/paths while keeping code
  blocks and tables horizontally scrollable inside their own element.

Command actions live inside the surface they affect. Spec cards expose
`/afx-spec refine` and `/afx-spec review`; design cards expose
`/afx-design refine` and `/afx-design review`; tasks expose
`/afx-task refine`, `/afx-task status`, and `/afx-task code all`. Each task
phase also exposes a compact `Code` action that drafts `/afx-task code
<feature>#<wbs> phase <number> <name>` for the first open task in that phase,
making surgical implementation starts possible from the Workbench itself. These
actions draft typed chat commands through `afxOpenChatCommand`; they do not
mutate docs directly.

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
- `afxOpenFile`
- `afxFetchDocContent`
- `afxToggleTask`
- `afxToggleSession`
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
