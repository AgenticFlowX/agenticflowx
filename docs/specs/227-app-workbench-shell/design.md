---
afx: true
type: DESIGN
status: Living
owner: "@rixrix"
version: "1.0"
created_at: "2026-05-03T03:28:22.000Z"
updated_at: "2026-05-17T09:04:20.000Z"
tags: ["app", "workbench", "shell", "tabs", "bridge", "layout"]
spec: spec.md
---

# App Workbench Shell - Technical Design

---

## [DES-OVR] Overview

The Workbench shell is the VSCode bottom-panel webview container. It owns React
bootstrap, bridge lifecycle, state reducer, tab routing, loading/empty states,
and the feature-scoped four-column Workbench tab.

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

### [DES-SHELL-FEATURE-MOCKUP] Feature Four-Column ASCII

```text
┌──────────────────────── feature selector / toggles ────────────────────────┐
│ [feature v] status/progress                         [SPEC][DESIGN][TASKS][SESSIONS] │
├────────────── SPEC ─────────────┬──────────── DESIGN ────────┬──────── TASKS ───────┬──── SESSIONS ────┤
│ markdown preview / not-created │ markdown preview / edit    │ phases + checkboxes  │ session rows      │
│ [open editor] [preview]        │ [open editor] [preview]    │ progress footer      │ human/agent ticks │
└────────────────────────────────┴────────────────────────────┴──────────────────────┴──────────────────┘
Drift footer: spec/design/tasks status, stale age, ghost reference hint.
```

### [DES-SHELL-FEATURE-COLUMNS] Feature Column Layout

`views/workbench.tsx` owns selector, column toggles, resizable panels,
spec/design/tasks previews, task checklist, session ticks, and drift footer.

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

---

## [DES-FILES] File Structure

| File                                               | Purpose                                   |
| -------------------------------------------------- | ----------------------------------------- |
| `apps/workbench/src/main.tsx`                      | React entry and bridge init               |
| `apps/workbench/src/app.tsx`                       | Root shell, tab routing, loading state    |
| `apps/workbench/src/app.test.tsx`                  | Shell tab smoke tests                     |
| `apps/workbench/src/index.css`                     | Workbench-local surface and cursor styles |
| `apps/workbench/src/context/workbench-context.tsx` | State reducer/provider/hook               |
| `apps/workbench/src/lib/bridge.ts`                 | Typed webview bridge wrapper              |
| `apps/workbench/src/views/workbench.tsx`           | Feature-scoped four-column tab            |
| `apps/workbench/src/components/coming-soon.tsx`    | Shared placeholder surface                |

---

## [DES-DEPS] Dependencies

- `@afx/shared` for Workbench state/protocol.
- `@afx/ui` for tabs, resizable panels, empty states, scroll areas.
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
- Future tests should cover provider state update, bridge subscriptions, feature
  column toggles, task/session toggle messages, and Impact Lens tab addition.

---

## [DES-ROLLOUT] Migration / Rollout Plan

1. Retarget shell/source refs from `220-app-workbench` to this child spec where appropriate.
2. Keep `220-app-workbench` as the parent route map.
3. Add Impact Lens tab under this shell after `228` is approved.

---

## [DES-SHELL-LOC] Code Locator Map

| Map ID            | Code anchor                                                                            | Messages/data                           | Tests                             |
| ----------------- | -------------------------------------------------------------------------------------- | --------------------------------------- | --------------------------------- |
| `[Shell.App]`     | `apps/workbench/src/app.tsx` `App` + tab routing                                       | `WorkbenchInbound`, `afxUpdate`         | `apps/workbench/src/app.test.tsx` |
| `[Shell.Context]` | `apps/workbench/src/context/workbench-context.tsx` `WorkbenchProvider`                 | `WorkbenchState`                        | future context tests              |
| `[Shell.Bridge]`  | `apps/workbench/src/lib/bridge.ts` `initWorkbenchBridge`/`workbenchSend`/`workbenchOn` | `WorkbenchInbound`, `WorkbenchOutbound` | manual                            |
| `[Shell.Feature]` | `apps/workbench/src/views/workbench.tsx` four-column feature view                      | `selectedFeature` state                 | manual                            |

## [DES-SHELL-TRACE] Functional Trace Matrix

| Requirement | Design nodes                                                | Code anchors                      | Verification |
| ----------- | ----------------------------------------------------------- | --------------------------------- | ------------ |
| FR-1        | `[DES-SHELL-MOCKUP]`, `[DES-SHELL-TABS]`                    | `App`, `TabsList`, `TabsContent`  | app.test.tsx |
| FR-3        | `[DES-SHELL-STATE]`                                         | `WorkbenchProvider`, reducer      | future       |
| FR-5        | `[DES-SHELL-BRIDGE]`                                        | bridge bootstrap + handlers       | manual       |
| FR-6        | `[DES-SHELL-DATA]`                                          | `WorkSessionRow` strip            | manual       |
| FR-8        | `[DES-SHELL-FEATURE-MOCKUP]`, `[DES-SHELL-FEATURE-COLUMNS]` | `WorkbenchTab` four-column layout | manual       |

---

## [DES-REFS] File Reference Map

| File                                               | Required @see                                                                                |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `apps/workbench/src/main.tsx`                      | `spec.md [FR-1]` + `design.md [DES-SHELL-BRIDGE]`                                            |
| `apps/workbench/src/app.tsx`                       | `spec.md [FR-2] [FR-5]` + `design.md [DES-SHELL-TABS] [DES-SHELL-MOCKUP]`                    |
| `apps/workbench/src/app.test.tsx`                  | `spec.md [FR-2] [FR-5]` + `design.md [DES-TEST] [DES-SHELL-TABS]`                            |
| `apps/workbench/src/index.css`                     | `design.md [DES-SHELL-SURFACE-STYLES]`                                                       |
| `apps/workbench/src/context/workbench-context.tsx` | `spec.md [FR-3]` + `design.md [DES-SHELL-STATE]`                                             |
| `apps/workbench/src/lib/bridge.ts`                 | `spec.md [FR-4]` + `design.md [DES-SHELL-BRIDGE]`                                            |
| `apps/workbench/src/views/workbench.tsx`           | `spec.md [FR-6] [FR-7]` + `design.md [DES-SHELL-FEATURE-COLUMNS] [DES-SHELL-FEATURE-MOCKUP]` |
| `apps/workbench/src/components/coming-soon.tsx`    | `spec.md [FR-5]` + `design.md [DES-SHELL-TABS]`                                              |
