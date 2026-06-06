---
afx: true
type: TASKS
status: Living
owner: "@rix"
version: "1.0"
created_at: "2026-06-03T07:28:52.000Z"
updated_at: "2026-06-06T11:03:56.000Z"
tags: ["app", "workbench", "canvas", "json-canvas", "ideation", "experimental"]
spec: spec.md
design: design.md
---

# App Workbench Canvas — Implementation Tasks

> All canvas work shipped (every box `[x]`). Phase 5 records the as-built surfaces the original canvas sprint did not enumerate (Settings toggle, markdown picker, expanded authoring).

## Task Numbering Convention

- **1.x** — Foundations: flag, types, persistence wiring
- **2.x** — Canvas surface + nodes + edges (core authoring)
- **3.x** — Live-node actions (promote / chat / open)
- **4.x** — Round-trip fidelity, rollout, verification
- **5.x** — As-built reconciliation (Settings surface, markdown picker, expanded authoring, cross-cutting tests)

References use Node IDs: `[FR-X]`, `[NFR-X]` (spec.md), `[DES-X]` (design.md), `[X.Y]` (tasks).

## Phase 1: Foundations — flag, types, persistence

### 1.1 Experiment flag + gated Canvas tab

<!-- files: apps/vscode/package.json, apps/workbench/src/app.tsx -->
<!-- @see spec.md [FR-1] [FR-2] [FR-19] -->
<!-- @see design.md [DES-UI] [DES-API] -->

- [x] Add `afx.experimental.canvas` (boolean, default false) to `apps/vscode/package.json` `contributes.configuration`
- [x] Plumb the setting to Workbench through `afxUpdate.canvasEnabled`; config changes post a refreshed update without reading the canvas when false
- [x] Add gated `Canvas` `WorkbenchTabTrigger` + `TabsContent` in `app.tsx` (hidden when flag off)
- [x] Verify: flag off → seven tabs, `canvasEnabled:false`, no `canvas` payload/read/watch; flag on → Canvas tab visible

### 1.2 JSON Canvas types + payload

<!-- files: packages/shared/src/workbench-types.ts, packages/shared/src/workbench-protocol.ts -->
<!-- @see spec.md [FR-4] [FR-13] [FR-18] [FR-19] -->
<!-- @see design.md [DES-DATA] [DES-API] -->

- [x] Add JSON Canvas 1.0 types (`CanvasNode` union, `CanvasEdge`, `JSONCanvas`) to `workbench-types.ts`
- [x] Add `CanvasFilePayload`
- [x] Extend `afxUpdate` inbound payload with `canvasEnabled?: boolean` and `canvas?: CanvasFilePayload`

### 1.3 Host read/watch service

<!-- files: apps/vscode/src/services/canvas-data.ts, apps/vscode/src/panels/workbench-panel.ts -->
<!-- @see spec.md [FR-3] [FR-12] [FR-19] [NFR-2] [NFR-5] -->
<!-- @see design.md [DES-HOST] [DES-ARCH] [DES-FILES] -->

- [x] Implement `createCanvasDataProvider` (setting false → `{ canvasEnabled:false }`; setting true → read `.afx/project.canvas`, `exists:false` when missing); `markSavedContent` echo-suppression
- [x] Add a gated fs watcher for `.afx/project.canvas` only while the flag is enabled; echo-suppress self-writes
- [x] Include `canvasEnabled` and, only when enabled, `canvas` payload in `afxUpdate` from `workbench-panel.ts`
- [x] Extend the existing `afxSaveFile` handler so saving `.afx/project.canvas` creates `.afx/` before the first write; no new write path

### 1.4 Context wiring + lossless parser

<!-- files: apps/workbench/src/context/workbench-context.tsx, apps/workbench/src/lib/json-canvas.ts -->
<!-- @see spec.md [FR-4] [FR-13] [FR-18] [NFR-3] -->
<!-- @see design.md [DES-DATA] -->

- [x] Store `canvas` payload in the workbench reducer; expose via `useWorkbench()`; clear when flag off
- [x] Implement `json-canvas.ts` parse/serialize/validate with unknown-field preservation
- [x] Unit-test: round-trip stability, group/link survival, malformed → typed error, empty → `{nodes:[],edges:[]}`

## Phase 2: Canvas surface — viewport, nodes, edges

### 2.1 Model hook + autosave

<!-- files: apps/workbench/src/components/canvas/use-canvas-model.ts, apps/workbench/src/views/canvas.tsx -->
<!-- @see spec.md [FR-4] [FR-11] -->
<!-- @see design.md [DES-DATA] [DES-OVR] -->

- [x] `useCanvasModel`: hold `JSONCanvas` state, selection, dirty flag; mutations for add/move/resize/connect/label/delete
- [x] `canvas.tsx`: parse payload → model; debounced (650 ms) inline autosave `useEffect` → `send(afxSaveFile)`; saved/saving/error status
- [x] Unit-test mutations produce valid JSON Canvas

### 2.2 Viewport (pan/zoom)

<!-- files: apps/workbench/src/components/canvas/canvas-surface.tsx -->
<!-- @see spec.md [FR-10] [FR-17] [NFR-1] [NFR-6] -->
<!-- @see design.md [DES-ARCH] [DES-DEC] [DES-DEPS] -->

- [x] Single transformed world layer (`translate(x,y) scale(z)`); wheel-zoom (clamp 0.25–3×), drag-bg pan, shift+wheel pan
- [x] `Fit to view` from node bounds (`canvasBounds`)

### 2.3 Nodes (create, drag, resize, inline markdown)

<!-- files: apps/workbench/src/components/canvas/canvas-node.tsx, apps/workbench/src/components/canvas/canvas-toolbar.tsx -->
<!-- @see spec.md [FR-5] [FR-6] [FR-7] [FR-8] [FR-17] -->
<!-- @see design.md [DES-UI] [DES-API] -->

- [x] Text node: inline markdown editor (edit source / render via `MinimalMarkdown`)
- [x] File node: picker insert; markdown content fetched through `afxFetchDocContent`/`afxDocContent` (fetch in `canvas.tsx`); non-md → filename chip (FR-7)
- [x] Drag to move, corner handle to resize → write geometry to model
- [x] Toolbar: add (`Card`/`Note`/`Label`/`Group`), color, doc picker, `Fit`, zoom; keyboard `t`/`l`/`f` (in `canvas.tsx`)

### 2.4 Edges (connect, label, render)

<!-- files: apps/workbench/src/components/canvas/canvas-edges.tsx -->
<!-- @see spec.md [FR-9] [FR-18] -->
<!-- @see design.md [DES-UI] -->

- [x] SVG edge layer in the world transform; anchor from live node geometry (honor sides), Q-curve fan-out
- [x] "Drag to connect" → create edge; double-click label to edit; drag endpoints to retarget; delete edge
- [x] Preserve `toEnd`/`fromEnd`/`color`/sides on render + save

## Phase 3: Live-node actions

### 3.1 Promote + send-to-chat + open

<!-- files: apps/workbench/src/components/canvas/canvas-node.tsx, apps/workbench/src/views/canvas.tsx -->
<!-- @see spec.md [FR-15] [FR-16] -->
<!-- @see design.md [DES-UI] [DES-API] -->

- [x] Node menu: "Promote to note" → `afxAppendNote` (source node stays)
- [x] "Send node to chat" (single + multi-select "Chat N") → `afxOpenChatCommand { mode:"send" }`
- [x] File node "Open file" / "Open in AFX preview" → `afxOpenFile`

## Phase 4: Fidelity, rollout, verification

### 4.1 Group/link render + error states

<!-- files: apps/workbench/src/components/canvas/canvas-node.tsx -->
<!-- @see spec.md [FR-14] -->
<!-- @see design.md [DES-ERR] [DES-SEC] -->

- [x] Render `group` frame + `link` chip read-only when present
- [x] Malformed-file banner (no auto-overwrite), unresolved/non-md path chip, save-fail error overlay, external-edit reload guard

### 4.2 Round-trip, e2e, and screen validation

<!-- files: apps/workbench/src/lib/json-canvas.test.ts, apps/workbench/e2e/canvas.spec.ts, apps/vscode/src/services/canvas-data.test.ts, apps/vscode/src/panels/workbench-panel.test.ts, apps/vscode/src/configuration-manifest.test.ts, apps/vscode-e2e/src/extension.test.ts -->
<!-- @see spec.md [FR-13] [FR-18] [FR-19] [FR-20] [NFR-3] [NFR-4] [NFR-6] [NFR-7] -->
<!-- @see design.md [DES-TEST] -->

- [x] Obsidian-authored fixture (group+link+colors+sides+subpath+unknown fields) round-trips losslessly
- [x] Unit/React coverage for parser, model mutations, tab gating, file-node fetch, send-to-chat, empty/error states
- [x] Host unit coverage for setting false/true, `.afx/` creation, watcher refresh, echo suppression, payload shape
- [x] Workbench Playwright e2e: flag off → no tab; create/drag/resize/link/retarget/label/delete; file-node markdown; colors/resize-clamp/external-update; light-theme; 144-node stress
- [x] VS Code e2e + manifest: setting defaults false, updatable/readable, boolean default false
- [x] Disposability: no non-experimental view imports canvas internals

### 4.3 Scope-boundary note

<!-- files: docs/specs/229-app-workbench-canvas/design.md -->
<!-- @see spec.md [FR-21] -->
<!-- @see design.md [DES-ROLLOUT] -->

- [x] Record the scope boundary in the design: experimental in-IDE freeform ideation surface behind a flag; knowledge-graph/backlink features out of scope

## Phase 5: As-built reconciliation (graduation)

### 5.1 Chat Settings Experimental toggle (FR-22)

<!-- files: apps/chat/src/views/settings.tsx, apps/chat/src/lib/settings-copy.ts, apps/chat/src/lib/settings-snapshot.ts, packages/shared/src/messages.ts, apps/vscode/src/panels/sidebar-panel.ts -->
<!-- @see spec.md [FR-1] [FR-22] -->
<!-- @see design.md [DES-SETTINGS] -->

- [x] Settings "Experimental" group: Canvas `SwitchRow` → `experimental/setCanvasEnabled`, read-only path `ConfigField`, "Open Workbench" button
- [x] `SettingsExperimentalSnapshot { canvasEnabled, canvasPath }`; host `handleSetExperimentalCanvasEnabled` updates `afx.experimental.canvas` (Global) + re-emits snapshot
- [x] Dual-anchor the settings files `229` (feature) + `214-app-chat-settings` (surface)

### 5.2 Markdown file-picker round-trip (FR-20) + expanded authoring (FR-23)

<!-- files: packages/shared/src/workbench-protocol.ts, apps/vscode/src/panels/workbench-panel.ts, apps/workbench/src/components/canvas/use-canvas-model.ts -->
<!-- @see spec.md [FR-20] [FR-23] -->
<!-- @see design.md [DES-API] [DES-DATA] -->

- [x] `afxPickMarkdownFile` → host dialog → `afxMarkdownFilePicked { filePath }`; webview inserts the file node
- [x] Expanded authoring verbs: note/label (`afxNodeKind`), group, color, rename, edge retarget/delete
- [x] `afxNodeKind` sanctioned as a lossless AFX extension field (FR-18 / [DES-DEC] Format)

### 5.3 Cross-cutting canvas test traceability

<!-- files: apps/vscode/src/panels/workbench-panel.test.ts, apps/chat/src/app.test.tsx, packages/shared/src/messages.test.ts, apps/vscode/src/configuration-manifest.test.ts, apps/vscode-e2e/src/extension.test.ts -->
<!-- @see spec.md [FR-1] [FR-6] [FR-19] [FR-20] [FR-22] -->
<!-- @see design.md [DES-TEST] -->

- [x] Add canvas `@see` anchors to the cross-cutting tests that assert canvas behavior in other-spec-owned files

## Cross-Reference Index

| Task | Spec Requirement                                                       | Design Section                      |
| ---- | ---------------------------------------------------------------------- | ----------------------------------- |
| 1.1  | [FR-1], [FR-2], [FR-19]                                                | [DES-UI], [DES-API]                 |
| 1.2  | [FR-4], [FR-13], [FR-18], [FR-19]                                      | [DES-DATA], [DES-API]               |
| 1.3  | [FR-3], [FR-12], [FR-19], [NFR-2], [NFR-5]                             | [DES-HOST], [DES-ARCH], [DES-FILES] |
| 1.4  | [FR-4], [FR-13], [FR-18], [NFR-3]                                      | [DES-DATA]                          |
| 2.1  | [FR-4], [FR-11]                                                        | [DES-DATA], [DES-OVR]               |
| 2.2  | [FR-10], [FR-17], [NFR-1], [NFR-6]                                     | [DES-ARCH], [DES-DEC], [DES-DEPS]   |
| 2.3  | [FR-5], [FR-6], [FR-7], [FR-8], [FR-17]                                | [DES-UI], [DES-API]                 |
| 2.4  | [FR-9], [FR-18]                                                        | [DES-UI]                            |
| 3.1  | [FR-15], [FR-16]                                                       | [DES-UI], [DES-API]                 |
| 4.1  | [FR-14]                                                                | [DES-ERR], [DES-SEC]                |
| 4.2  | [FR-13], [FR-18], [FR-19], [FR-20], [NFR-3], [NFR-4], [NFR-6], [NFR-7] | [DES-TEST]                          |
| 4.3  | [FR-21]                                                                | [DES-ROLLOUT]                       |
| 5.1  | [FR-1], [FR-22]                                                        | [DES-SETTINGS]                      |
| 5.2  | [FR-20], [FR-23]                                                       | [DES-API], [DES-DATA]               |
| 5.3  | [FR-1], [FR-6], [FR-19], [FR-20], [FR-22]                              | [DES-TEST]                          |

## Notes

- This zone owns the Workbench Canvas surface and the Chat Settings Experimental toggle (dual-owned with `214-app-chat-settings`).
- True rewind/revert, link-node authoring, multi-canvas, and the Impact Lens projection are out of scope.

## Work Sessions

<!-- IMPORTANT: This section MUST remain the LAST section in tasks.md. -->
<!-- Columns: Date | Task | Action | Files Modified | Agent ([x]/[]) | Human ([x]/[]) -->

| Date       | Task    | Action             | Files Modified                                                                                                                                                                                                                                                                                                                             | Agent | Human |
| ---------- | ------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- | ----- |
| 2026-06-03 | 1.1-4.3 | Coded/Verified     | apps/vscode/package.json, apps/vscode/src/services/canvas-data.ts, apps/vscode/src/panels/workbench-panel.ts, apps/workbench/src/views/canvas.tsx, apps/workbench/src/components/canvas/\*, apps/workbench/src/lib/json-canvas.ts, packages/shared/src/{workbench-types,workbench-protocol}.ts, canvas tests/e2e                           | [x]   | [x]   |
| 2026-06-04 | 5.1-5.3 | Graduated/Verified | Graduated the canvas sprint → `229-app-workbench-canvas` (spec.md/design.md/tasks.md); reconciled as-built (Settings surface FR-22, picker, FR-23 expanded authoring, `afxNodeKind`, `mode:"send"`, `CanvasDataProviderOptions`); retargeted `@see` across the canvas source + added missing `@see`; built `[DES-CANVAS-TRACE]` 1:1 matrix | [x]   | [x]   |
