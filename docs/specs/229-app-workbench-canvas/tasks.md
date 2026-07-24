---
afx: true
type: TASKS
owner: "@rix"
version: "2.2"
created_at: "2026-06-03T07:28:52.000Z"
updated_at: "2026-07-24T11:49:37.000Z"
tags:
  [
    "app",
    "workbench",
    "canvas",
    "json-canvas",
    "react-flow",
    "planning",
    "spec-map",
    "architecture-map",
    "media-preview",
    "auto-layout",
    "low-high-fidelity",
    "custom-editor",
    "realtime",
    "experimental",
    "licensing",
    "progressive-profiles",
    "universal-canvas",
    "beginner",
  ]
spec: spec.md
design: design.md
---

# App Workbench Canvas — Implementation Tasks

> Phases 1–5 record the shipped custom-renderer baseline. Phases 6–16 are the
> React Flow, multi-document, live-sync, planning, editor-area, and
> release-hardening program; unchecked Phase 16 tasks are explicit blocking
> repairs and evidence gaps. The target program supersedes the baseline without
> invalidating its completed evidence. Phases 17–24 are the post-2.4.0
> architecture-workbench north star and are deliberately unchecked.

## Task Numbering Convention

- **1.x** — Foundations: flag, types, persistence wiring
- **2.x** — Canvas surface + nodes + edges (core authoring)
- **3.x** — Live-node actions (promote / chat / open)
- **4.x** — Round-trip fidelity, rollout, verification
- **5.x** — As-built reconciliation (Settings surface, markdown picker, expanded authoring, cross-cutting tests)
- **6.x–15.x** — Stabilization and React Flow migration program
- **16.x** — Release-foundation re-audit, real-host E2E, and migration closeout
- **17.x–24.x** — Architecture workbench, rich content, composition, layout, export, and push-limit proof

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

## Phase 6: Live Document and Mutation Foundation

### 6.1 Open-buffer snapshots and latest-wins refresh

<!-- files: apps/vscode/src/services/workbench-file-state.ts, apps/vscode/src/services/workbench-refresh-coordinator.ts, apps/vscode/src/services/canvas-data.ts, apps/vscode/src/panels/workbench-panel.ts -->
<!-- @see spec.md [FR-12] [FR-20] [FR-30] [FR-31] [NFR-4] -->
<!-- @see design.md [DES-HOST] [DES-CANVAS-DOCUMENT-SERVICE] [DES-CANVAS-DIRTY-CONFLICT] -->

- [x] Implement open-`TextDocument` overlays, content revisions, relevant change/save/close/fs subscriptions, multi-root discovery, 150 ms coalescing, and a single-flight latest-wins refresh coordinator.

Acceptance: unsaved valid Canvas edits appear without save; malformed JSON retains the last valid graph and suspends autosave; a superseded scan cannot publish; closing a discarded buffer restores disk state.

### 6.2 Acknowledged conflict-safe mutations

<!-- files: packages/shared/src/workbench-protocol.ts, packages/shared/src/workbench-types.ts, apps/vscode/src/services/workbench-mutation-coordinator.ts, apps/workbench/src/hooks/use-workbench-mutation.ts -->
<!-- @see spec.md [FR-11] [FR-12] [FR-24] [FR-31] [NFR-4] [NFR-5] -->
<!-- @see design.md [DES-API] [DES-CANVAS-PROTOCOL] [DES-CANVAS-DIRTY-CONFLICT] -->

- [ ] Add request/revision/result contracts, canonical workspace-contained targets, per-path FIFO writes, dirty/stale/collision rejection, and truthful pending/error/conflict UI state.

Acceptance: every mutation receives exactly one terminal result; failed or stale writes never clear dirty state or overwrite newer content; different canvas paths remain independent.

## Phase 7: Portable Canvas Engine

### 7.1 Lossless JSON Canvas domain package

<!-- files: packages/canvas-engine/**, packages/shared/src/workbench-types.ts -->
<!-- @see spec.md [FR-4] [FR-13] [FR-14] [FR-18] [FR-33] [NFR-3] [NFR-8] -->
<!-- @see design.md [DES-DATA] [DES-CANVAS-PROTOCOL] -->

- [ ] Create framework-neutral `@afx/canvas-engine` parse/serialize/revision/ID-mutation modules that preserve standard, unknown, and namespaced root/node/edge fields.

Acceptance: standard JSON Canvas, Obsidian-authored fixtures, parallel edges, group geometry, unknown fields, and ignored AFX metadata round-trip byte-semantically without required proprietary node types.

### 7.2 AFX-enhanced compatibility and action schema

<!-- files: packages/canvas-engine/src/afx-metadata.ts, packages/canvas-engine/src/fixtures/** -->
<!-- @see spec.md [FR-26] [FR-28] [FR-33] [NFR-8] -->
<!-- @see design.md [DES-DATA] [DES-SEC] -->

- [ ] Define optional versioned AFX mode, edge provenance/style, and action metadata with strict validation, unknown-field preservation, and never-auto-run defaults.

Acceptance: removing or ignoring every AFX field leaves a useful standard canvas; malformed/untrusted action metadata is inert.

## Phase 8: Shared React Flow Surface

### 8.1 Controlled projection and parity renderer

<!-- files: apps/workbench/package.json, apps/workbench/src/lib/json-canvas-react-flow.ts, apps/workbench/src/components/canvas/react-flow-canvas.tsx, apps/workbench/src/components/canvas/nodes/** -->
<!-- @see spec.md [FR-4] [FR-5] [FR-8] [FR-10] [FR-13] [FR-14] [FR-23] [FR-29] [NFR-1] -->
<!-- @see design.md [DES-ARCH] [DES-CANVAS-INTERACTIONS] [DES-DEPS] -->

- [ ] Add `@xyflow/react`, build the controlled lossless adapter and memoized node renderers, and reach current text/file/group/link/color/move/resize parity behind the existing experiment.

Acceptance: projection never becomes the persisted model; parity fixtures and component tests pass before the custom renderer is retired; disabled Canvas does not eagerly load the feature chunk.

### 8.2 Mature graph interactions

<!-- files: apps/workbench/src/components/canvas/react-flow-canvas.tsx, apps/workbench/src/components/canvas/canvas-toolbar.tsx, apps/workbench/src/components/canvas/edges/** -->
<!-- @see spec.md [FR-9] [FR-10] [FR-17] [FR-28] [FR-29] [NFR-6] [NFR-7] -->
<!-- @see design.md [DES-CANVAS-INTERACTIONS] -->

- [ ] Implement lasso/multi-select, validated connections, reconnect, resizers/toolbars, snap, auto-pan, background, controls, optional minimap, keyboard delete, copy/duplicate/paste, undo/redo, fit view/selection, touch, and reduced motion.

Acceptance: pointer, touch, and keyboard suites pass at 360 px and desktop; 150 nodes/200 edges meet the documented event-to-paint gate.

## Phase 9: Multi-Canvas Library

### 9.1 Discovery and lifecycle service

<!-- files: apps/vscode/src/services/canvas-library-service.ts, apps/workbench/src/components/canvas/canvas-library.tsx -->
<!-- @see spec.md [FR-3] [FR-19] [FR-24] [FR-30] [NFR-2] [NFR-4] -->
<!-- @see design.md [DES-HOST] [DES-CANVAS-TARGET-LOC] -->

- [ ] Discover Project Canvas and named canvases across workspace roots; implement create/select/rename/duplicate/delete/open-existing with shortest-unique labels, confirmation, collision protection, and last-active persistence.

Acceptance: legacy `.afx/project.canvas` is never moved; several files retain independent draft/viewport/save state; ambiguous, outside-workspace, and colliding targets never bind or overwrite silently.

## Phase 10: Editor-Area Canvas

### 10.1 Custom text editor provider and shared boot

<!-- files: apps/vscode/package.json, apps/vscode/src/editors/canvas-editor-provider.ts, apps/vscode/src/services/canvas-document-service.ts, apps/workbench/src/canvas-editor-app.tsx, apps/workbench/src/main.tsx -->
<!-- @see spec.md [FR-11] [FR-12] [FR-31] [FR-32] [NFR-4] [NFR-5] -->
<!-- @see design.md [DES-CANVAS-EDITOR-AREA] [DES-CANVAS-DOCUMENT-SERVICE] [DES-CANVAS-MULTI-INSTANCE] -->

- [ ] Register `afx.canvasEditor` as an optional `*.canvas` custom text editor and reuse the same Canvas document UI/service for Workbench, split editor views, text edits, native dirty/save/undo/redo/revert, and hot exit.

Acceptance: Workbench plus two editor instances stay synchronized while view state remains local; disabling the experiment shows recovery; the extension never claims all `.canvas` files by default.

## Phase 11: Freeform and Spec Map Modes

### 11.1 Non-destructive mode tools

<!-- files: apps/workbench/src/components/canvas/canvas-app.tsx, apps/workbench/src/components/canvas/spec-map-tools.tsx -->
<!-- @see spec.md [FR-21] [FR-25] [FR-26] [NFR-3] -->
<!-- @see design.md [DES-DEC] [DES-CANVAS-INTERACTIONS] -->

- [ ] Add Freeform and Spec Map toolsets over one JSON Canvas document without destructive conversion or hidden mode-specific formats.

### 11.2 Declared dependency import and refresh

<!-- files: apps/vscode/src/services/spec-dependency-indexer.ts, apps/workbench/src/components/canvas/spec-map-tools.tsx -->
<!-- @see spec.md [FR-21] [FR-26] [FR-30] -->
<!-- @see design.md [DES-ARCH] [DES-ERR] -->

- [ ] Import and idempotently refresh canonical `depends_on` nodes/edges, identify owning specs, report unresolved/cyclic references, preserve manual layout/styles/content, and detach generated relationships into manual edges.

## Phase 12: Planning Guide and Explicit AFX Actions

### 12.1 Ideas, feature, roadmap, and next-spec starters

<!-- files: apps/workbench/src/components/canvas/planning-guide.tsx, apps/workbench/src/components/canvas/canvas-app.tsx -->
<!-- @see spec.md [FR-15] [FR-16] [FR-27] [FR-33] -->
<!-- @see design.md [DES-CANVAS-INTERACTIONS] [DES-SEC] -->

- [ ] Add editable blank/ideas/feature/roadmap/next-spec starters and selection actions to open source, send Chat context, promote Notes, and prepare spec/sprint handoffs with an exact preflight preview.

### 12.2 Safe executable overlays

<!-- files: apps/workbench/src/components/canvas/afx-actions.tsx, apps/vscode/src/services/canvas-action-service.ts -->
<!-- @see spec.md [FR-33] [NFR-8] -->
<!-- @see design.md [DES-SEC] [DES-CANVAS-PROTOCOL] -->

- [ ] Render only versioned allowlisted actions, capability-check and workspace-trust-check them, require explicit activation, and confirm consequential AFX commands; never execute while loading, parsing, importing, or refreshing.

## Phase 13: Connector and Edge Authoring

### 13.1 Edge inspector and multi-edit

<!-- files: apps/workbench/src/components/canvas/edges/**, packages/canvas-engine/src/mutations.ts -->
<!-- @see spec.md [FR-9] [FR-18] [FR-28] -->
<!-- @see design.md [DES-CANVAS-INTERACTIONS] [DES-DATA] -->

- [ ] Add bezier/straight/step/smooth-step routing, solid/dashed/dotted strokes, start/end markers, labels, colors, reconnect, and multi-edge apply using standard JSON Canvas fields first and optional namespaced style metadata only when necessary.

## Phase 14: Workbench Visibility Integration

### 14.1 Independent Canvas capability and tab visibility

<!-- files: apps/workbench/src/app.tsx, apps/chat/src/views/settings.tsx, apps/vscode/package.json -->
<!-- @see spec.md [FR-1] [FR-2] [FR-22] [FR-32] -->
<!-- @see design.md [DES-SETTINGS] [DES-CANVAS-EDITOR-AREA] -->

- [ ] Integrate the shell-owned hidden-view registry so hiding Canvas removes only the Workbench tab, leaves editor-area capability intact, and participates in the all-hidden recovery state.

## Phase 15: Open-Source Attribution and Packaging

### 15.1 Generated third-party notices

<!-- files: NOTICE, THIRD_PARTY_NOTICES.md, package.json, scripts/**, apps/vscode/.vscodeignore, apps/vscode/src/configuration-manifest.test.ts -->
<!-- @see spec.md [NFR-1] [NFR-8] -->
<!-- @see design.md [DES-DEPS] [DES-ROLLOUT] -->

- [ ] Generate a workspace-aware inventory of shipped runtime packages, acknowledge each upstream project including React Flow and JSON Canvas, include its exact license text/source, enforce the approved license allowlist, and fail on unknown/missing licenses.

Acceptance: `NOTICE` and standard third-party notices are reproducible, reviewable, contain no development-only packages, cover any React Flow/dnd/layout additions, and are proven present in the packaged VSIX.

## Phase 16: Regression, Evidence, and Migration Closeout

### 16.1 Full verification and captures

<!-- files: apps/workbench/e2e/canvas.spec.ts, apps/vscode-e2e/**, apps/vscode-e2e/artifacts/** -->
<!-- @see spec.md [FR-1] [FR-33] [FR-43] [FR-44] [NFR-1] [NFR-8] [NFR-12] [NFR-13] -->
<!-- @see design.md [DES-TEST] [DES-ROLLOUT] -->

- [ ] Run domain/unit/component/host/protocol/responsive/extension-host suites, `pnpm run verify`, full E2E, VSIX packaging/license checks, `git diff --check`, and manual F5 smoke across legacy/named/multi-root canvases, external edits, editor splits, planning, dependencies, actions, and connectors.

Acceptance: dedicated old/new/realtime/editor/narrow/desktop screenshots are stored under the VS Code E2E artifact tree; no custom renderer is removed until parity, accessibility, performance, data-safety, and interoperability evidence is approved.

### 16.2 Durable document lifetime and truthful saves

<!-- files: apps/vscode/src/services/canvas-document-service.ts, apps/vscode/src/services/workbench-mutation-coordinator.ts, apps/workbench/src/hooks/use-canvas-document.ts -->
<!-- @see spec.md [FR-11] [FR-24] [FR-31] [NFR-4] -->
<!-- @see design.md [DES-CANVAS-DOCUMENT-SERVICE] [DES-CANVAS-DIRTY-CONFLICT] [DES-CANVAS-PROTOCOL] -->

- [ ] Add the immediate typed `afxCanvasEdit { requestId, sessionId, sequence, documentId, baseRevision, content }` stream and `afxCanvasEditResult { success | superseded | conflict | error }`; keep per-document/session latest-wins coalescing, pending outcomes, and document-keyed history in a durable canonical-URI session; apply the first open-`TextDocument` edit immediately, debounce only disk-backed Workbench persistence for 650 ms, publish geometry at gesture completion, flush/secure on disposal, and remove every fallback that clears dirty state without a matching result.

Acceptance: editing then immediately switching Workbench tabs, changing Canvas files, unmounting React, closing the editor, disposing the last webview, or restoring through hot exit loses no accepted operation; stale/error/conflict results cannot clear newer dirty state; each request terminates exactly once; named canvases retain independent title/mode/profile/history/save state.

### 16.3 Revisioned referenced-content subscriptions

<!-- files: packages/shared/src/workbench-{types,protocol}.ts, apps/vscode/src/services/canvas-reference-service.ts, apps/workbench/src/hooks/use-canvas-references.ts -->
<!-- @see spec.md [FR-20] [FR-30] [FR-35] [NFR-13] -->
<!-- @see design.md [DES-DATA] [DES-API] [DES-HOST] -->

- [ ] Replace raw-path/eager Markdown caching with owner-root + portable path + subpath + revision subscriptions, visible/on-demand fetch/cancel, `.md`/`.markdown` parity, and stale/cross-root response rejection.

Acceptance: two workspace roots may contain the same relative path without cache collision; manual edits update only matching visible/expanded consumers; late responses are ignored; generated nodes fetch/preview/open through their own source identity; a 1,000-node map does not fetch 1,000 full Markdown bodies.

### 16.4 Canonical Spec Map discovery and deterministic detach

<!-- files: apps/vscode/src/services/spec-dependency-indexer.ts, packages/canvas-engine/src/dependencies.ts, apps/workbench/src/components/canvas/spec-map-tools.tsx -->
<!-- @see spec.md [FR-21] [FR-26] [FR-30] [FR-34] [NFR-10] [NFR-13] -->
<!-- @see design.md [DES-ARCH] [DES-DATA] [DES-ERR] -->

- [ ] Index four-file specs and single-document Sprints across every workspace root with explicit totals/limits/duplicates/errors, then make refresh/detach an idempotent reconciliation using fresh manual IDs and durable detached-dependency suppression/provenance.

Acceptance: repeated refresh produces no duplicates; refresh → detach → refresh twice retains one manual relationship with its style/geometry and no duplicate ID; multi-root spec/Sprint fixtures expose every expected resolved/unresolved/cyclic/duplicate relation; no silent 1,000-candidate cap remains.

### 16.5 React Flow parity and per-document state repair

<!-- files: apps/workbench/src/components/canvas/{canvas-app,react-flow-canvas,canvas-toolbar}.tsx, apps/workbench/src/components/canvas/nodes/**, apps/workbench/src/components/canvas/edges/** -->
<!-- @see spec.md [FR-9] [FR-17] [FR-23] [FR-24] [FR-29] [FR-31] -->
<!-- @see design.md [DES-CANVAS-INTERACTIONS] [DES-CANVAS-MULTI-INSTANCE] -->

- [ ] Complete authoring parity for node color, link URL/open, group rename/background, multi-file insertion, selected-set Chat, route/style editing, and explicit read-only states; restore the correct named title, mode, profile, viewport, selection, and history per document and rebase/reset history safely on external replacement.

Acceptance: every displayed editable property has a pointer/touch/keyboard authoring route; intentional read-only values are announced; switching among three named canvases and two split clients leaks no state; undo never applies a prior document's or incompatible external revision's operation.

### 16.6 Progressive profiles and universal capability-off baseline

<!-- files: apps/workbench/src/components/canvas/{canvas-profile-selector,canvas-command-registry,canvas-empty-state}.tsx, apps/vscode/src/services/canvas-capabilities.ts -->
<!-- @see spec.md [FR-33] [FR-43] [FR-44] [NFR-12] -->
<!-- @see design.md [DES-UI] [DES-CANVAS-INTERACTIONS] [DES-DEC] -->

- [ ] Implement one capability-aware command registry with Essentials as the plain-language default, Architecture as the rich topology/composition profile, and AFX as the optional Notes/Boards/Chat/spec/action profile; profile switching changes no Canvas bytes and hides no authored content.

Acceptance: a workspace with no `.afx/`, specs, Chat, Notes, Boards, or skills completes create/open/text/file/image/link/group/connect/color/save/undo/redo/external-refresh/export; unavailable enhancements explain recovery without breaking core work; command search and core shortcuts remain available at 360 px and desktop.

### 16.7 Foundation real-host E2E and fault matrix

<!-- files: apps/workbench/e2e/canvas-foundation.spec.ts, apps/vscode-e2e/src/canvas-foundation.test.ts, apps/vscode-e2e/fixtures/**, apps/vscode-e2e/artifacts/extension-captures/workbench/canvas/** -->
<!-- @see spec.md [FR-11] [FR-20] [FR-24] [FR-26] [FR-30] [FR-31] [FR-43] [FR-44] [NFR-4] [NFR-7] [NFR-12] [NFR-13] -->
<!-- @see design.md [DES-TEST] [DES-ROLLOUT] -->

- [ ] Add deterministic browser plus real extension-host tests for immediate tab switch, editor close/hot exit, stale acknowledgement, write failure/retry, same-document external history, named/multi-root state, cross-root preview/open, `.markdown`, repeated detach/refresh, capability-off Essentials, package installation, touch/keyboard, high contrast, reduced motion, and 360 px/editor/desktop captures.

Acceptance: the real host—not only a mocked `acquireVsCodeApi` bridge—performs disk and editor lifecycle operations; zero silent-loss/false-saved failures are tolerated; all artifacts live under `apps/vscode-e2e`; this task and 16.1 remain unchecked until the complete gate has actually run.

## Phase 17: Whole-Workspace Architecture Explorer

### 17.1 Build the complete revisioned architecture index

<!-- files: apps/vscode/src/services/workspace-architecture-index.ts, apps/vscode/src/services/spec-dependency-indexer.ts, packages/shared/src/workbench-{types,protocol}.ts -->
<!-- @see spec.md [FR-21] [FR-26] [FR-34] [NFR-10] -->
<!-- @see design.md [DES-ARCH] [DES-HOST] [DES-API] -->

- [ ] Build an incremental, cancelable, revisioned index for every four-file spec, Sprint, declared dependency, logical workspace owner, lifecycle/type status, and optional read-only Impact Lens evidence across all roots; stream explicit totals and diagnostics without rewriting source specs.

Acceptance: the complete multi-root fixture has no silent cap, stale scan, or first-root binding; expected duplicates/unresolved/orphans/cycles are exact; updates publish only the latest revision; 1,000-node/2,000-edge index timing and memory are recorded.

### 17.2 Deliver the Architecture-profile explorer workflow

<!-- files: apps/workbench/src/components/canvas/architecture-explorer.tsx, apps/workbench/src/components/canvas/architecture-breadcrumbs.tsx, apps/workbench/src/components/canvas/react-flow-canvas.tsx -->
<!-- @see spec.md [FR-34] [FR-43] [NFR-7] [NFR-10] [NFR-12] -->
<!-- @see design.md [DES-UI] [DES-CANVAS-INTERACTIONS] -->

- [ ] Add search, type/status/root filters, relationship traversal, three-hop focus/isolate, breadcrumbs, overview/minimap, ownership/status cues, diagnostics, and one-action source opening through the Architecture profile while preserving manual canvas content.

Acceptance: import and refresh preserve manual nodes, relationships, styles, pins, frames, and geometry; the architecture depth success script completes by keyboard and pointer at 360 px and editor/desktop sizes; returning to Essentials keeps all content visible without architecture control clutter.

## Phase 18: Rich Portable Content Nodes

### 18.1 Implement bounded rich-content acquisition

<!-- files: apps/vscode/src/services/{canvas-reference-service,canvas-content-preview-service}.ts, packages/shared/src/workbench-{types,protocol}.ts -->
<!-- @see spec.md [FR-7] [FR-14] [FR-17] [FR-20] [FR-35] [FR-36] [FR-37] [NFR-9] -->
<!-- @see design.md [DES-API] [DES-HOST] [DES-SEC] -->

- [ ] Add visible/on-demand, cancelable host acquisition for spec/Markdown, general files, supported local images, sanitized bounded URL metadata, and file-backed Notes/Boards with owner/path/subpath/revision identity, cache limits, CSP-safe webview resources, and explicit state/error contracts.

Acceptance: no preview executes HTML/script or escapes the workspace; manual source edits update matching consumers; unsupported/blocked content yields portable metadata and an explicit open action; offscreen nodes do not trigger full-body fan-out; URL abuse cases meet size/time/redirect/MIME limits.

### 18.2 Render portable rich nodes and owner actions

<!-- files: apps/workbench/src/components/canvas/nodes/{spec,file,image,url,note,board}-node.tsx, apps/workbench/src/components/canvas/content-state-shell.tsx -->
<!-- @see spec.md [FR-14] [FR-23] [FR-35] [FR-36] [FR-37] [FR-44] [NFR-3] [NFR-9] -->
<!-- @see design.md [DES-UI] [DES-DATA] [DES-SEC] -->

- [ ] Render readable loading/ready/stale/missing/blocked/error cards with unique source identity, Markdown/spec status and headings, image contain/cover + alt/caption, URL open/refresh, Note/Board summaries, and source/AFX-preview/owner-surface actions where capabilities exist.

Acceptance: Canvas files persist only standard file/link/text/group records plus optional inert AFX metadata; capability-off Essentials still shows a useful card and Open Source/URL; AFX profile adds owner actions without duplicating content ownership; every state has pointer/keyboard/accessibility and visual coverage.

## Phase 19: Low- and High-Fidelity Composition

### 19.1 Graduate whiteboards into presentation-ready architecture maps

<!-- files: packages/canvas-engine/src/presentation.ts, apps/workbench/src/components/canvas/composition/** -->
<!-- @see spec.md [FR-27] [FR-38] [FR-39] [NFR-3] [NFR-11] -->
<!-- @see design.md [DES-CANVAS-INTERACTIONS] [DES-DATA] -->

- [ ] Add standard-node-backed frames, alignment/distribution, z-order, locks, annotations, semantic shapes/icons, typography density, palettes, legends, copy/paste style, and multi-selection property editing through the Architecture profile.

Acceptance: every composition/style operation is undoable, multi-select aware, keyboard reachable, deterministic after reload, and still understandable when another JSON Canvas tool ignores AFX presentation metadata; Essentials can read and move the result without exposing the full inspector.

### 19.2 Add reusable starters, frames, and presentation flow

<!-- files: packages/canvas-engine/src/templates.ts, apps/workbench/src/components/canvas/composition/{template-picker,frame-navigator,presentation-mode}.tsx -->
<!-- @see spec.md [FR-27] [FR-38] [FR-43] [NFR-11] [NFR-12] -->
<!-- @see design.md [DES-UI] [DES-CANVAS-INTERACTIONS] -->

- [ ] Add editable blank/ideas/roadmap/architecture/low-fidelity/high-fidelity templates, frame create/reorder/rename, and read/presentation navigation without proprietary required node types.

Acceptance: templates produce ordinary editable records with collision-free IDs; frame order and presentation state survive reload; cancel leaves no partial content; low-fidelity work can graduate in place without rebuilding or destructive conversion.

## Phase 20: Previewable Auto-Layout and Reformatting

### 20.1 Select and harden the layout engine

<!-- files: packages/canvas-engine/src/layout/benchmarks/**, docs/adr/**, NOTICE, THIRD_PARTY_NOTICES.md -->
<!-- @see spec.md [FR-40] [NFR-1] [NFR-10] [NFR-11] -->
<!-- @see design.md [DES-DEPS] [DES-TEST] -->

- [ ] Benchmark ELK, Dagre, and a deterministic in-house candidate on compound groups, pins, labels, cancellation, worker support, determinism, bundle/license cost, and 1,000-node/2,000-edge fixtures; record the selected engine and rejected trade-offs in an ADR before adding a runtime dependency.

Acceptance: raw benchmark evidence is reproducible with documented hardware/build; the winner passes license/NOTICE and bundle gates and has a cancel/timeout fallback; no dependency is selected by preference alone.

### 20.2 Implement preview/apply/cancel layout transactions

<!-- files: packages/canvas-engine/src/layout/**, apps/workbench/src/components/canvas/layout-preview.tsx -->
<!-- @see spec.md [FR-40] [NFR-10] [NFR-11] -->
<!-- @see design.md [DES-CANVAS-INTERACTIONS] [DES-DATA] [DES-ERR] -->

- [ ] Implement hierarchical, dependency, radial, grid, swimlane, and compact strategies for selection/full canvas with an immutable input revision, exact preview diff, options, pins/locks, group constraints, cancellation, stale-result rejection, and one-step apply/undo.

Acceptance: Cancel is byte-semantic no-op; Apply commits the exact reviewed preview as one undo transaction; stale results cannot apply; pinned/manual offsets, groups, labels, and manual edges remain intact unless explicitly overridden.

## Phase 21: Architecture Connectors, Groups, and Semantics

### 21.1 Complete rich relationship authoring

<!-- files: packages/canvas-engine/src/mutations.ts, apps/workbench/src/components/canvas/edges/**, apps/workbench/src/components/canvas/groups/** -->
<!-- @see spec.md [FR-9] [FR-28] [FR-39] [FR-41] -->
<!-- @see design.md [DES-CANVAS-INTERACTIONS] [DES-DATA] -->

- [ ] Add typed relationships, route/stroke/marker/color/label combinations, parallel edges, supported waypoints, reconnect, multi-edge apply, copy/paste style, and semantic legends using standard JSON Canvas fields first and namespaced metadata only for absent concepts.

Acceptance: the connector matrix round-trips losslessly, retains endpoint semantics and parallel identity, survives auto-layout/reopen, and works by pointer, touch, and keyboard at narrow and editor widths.

### 21.2 Complete groups, nested frames, and dependency detach

<!-- files: packages/canvas-engine/src/{mutations,dependencies}.ts, apps/workbench/src/components/canvas/groups/**, apps/workbench/src/components/canvas/spec-map-tools.tsx -->
<!-- @see spec.md [FR-26] [FR-38] [FR-41] [NFR-3] [NFR-11] -->
<!-- @see design.md [DES-CANVAS-INTERACTIONS] [DES-DATA] [DES-ERR] -->

- [ ] Add group label/background authoring, nested frame parenting, collapse/expand, group selection/move, deterministic child geometry, and generated-edge detach with fresh ID + durable suppression while preserving manual styles and relationships.

Acceptance: nested group and detach/refresh matrices survive reload, layout, and external refresh; collapsing never deletes content; detach → refresh twice cannot create duplicate IDs or resurrect a generated relationship over the manual edge.

## Phase 22: Export and Presentation Handoff

### 22.1 Build deterministic export projections

<!-- files: apps/vscode/src/services/canvas-export-service.ts, apps/workbench/src/components/canvas/export-dialog.tsx -->
<!-- @see spec.md [FR-42] [NFR-3] [NFR-9] [NFR-11] -->
<!-- @see design.md [DES-API] [DES-SEC] -->

- [ ] Build pure export projections for full canvas, current viewport, selection, and presentation frames to portable `.canvas` and deterministic PNG, with stable bounds/background/scale/font policy and no mutation of the source/history.

Acceptance: equal input/options produce equal portable bytes and pixel-stable output within the documented renderer tolerance; source JSON/history are unchanged; unknown fields remain intact in `.canvas` export.

### 22.2 Add preflight, security, and handoff UX

<!-- files: apps/vscode/src/services/canvas-export-service.ts, apps/workbench/src/components/canvas/export-dialog.tsx -->
<!-- @see spec.md [FR-42] [FR-44] [NFR-9] [NFR-11] [NFR-12] -->
<!-- @see design.md [DES-API] [DES-SEC] [DES-ERR] -->

- [ ] Add an Essentials-accessible export dialog that previews bounds/output, lists stale/blocked/omitted/external content and credentials, lets users cancel or choose safe fallbacks, and writes only to an explicitly selected workspace/user target.

Acceptance: export never leaks outside-workspace content, hidden credentials, or blocked remote assets; cancel writes nothing; capability-off workflows can export; failures are retryable and preserve the editable source.

## Phase 23: React Flow Push-Limit Interaction Program

### 23.1 Exercise the complete practical interaction surface under load

<!-- files: apps/workbench/e2e/canvas-architecture.spec.ts, packages/canvas-engine/src/**/*.test.ts -->
<!-- @see spec.md [FR-10] [FR-17] [FR-29] [FR-34]–[FR-42] [NFR-6] [NFR-7] [NFR-10] -->
<!-- @see design.md [DES-TEST] -->

- [ ] Build deterministic mixed-content scenarios covering lasso, multi-select, drag/resize, reconnect, touch, keyboard, copy/paste, undo/redo, grouping, styling, auto-pan, minimap, viewport persistence, visible/on-demand previews, auto-layout cancellation, external refresh, conflict recovery, export, and 1,000-node/2,000-edge architecture maps.

Acceptance: measured event-to-paint and long-task gates pass on documented hardware; 360 px, desktop, editor splits, reduced motion, high contrast, focus restoration, and failure states have assertions and dedicated review captures rather than screenshot-only evidence.

### 23.2 Prove outcome depth in real extension-host scenarios

<!-- files: apps/vscode-e2e/src/canvas-architecture.test.ts, apps/vscode-e2e/fixtures/canvas/**, apps/vscode-e2e/artifacts/extension-captures/workbench/canvas/** -->
<!-- @see spec.md [FR-34]–[FR-44] [NFR-4] [NFR-6] [NFR-7] [NFR-10]–[NFR-13] -->
<!-- @see design.md [DES-TEST] [DES-ROLLOUT] -->

- [ ] Run real VS Code scenarios for the beginner Essentials completion script, capability-off universal baseline, Architecture three-hop topology/source-open script, AFX Notes/Boards/Chat/spec actions, split editors, manual source edits, conflicts, package install, and restart/hot exit with dedicated captures and machine-readable timing/reliability results.

Acceptance: deterministic E2E scripts pass 100%; the moderated beginner script records completion/time separately; architecture indexing finds 100% of expected fixtures and diagnostics; the no-loss matrix has zero tolerated failures; 150-node/200-edge event-to-paint p95 is ≤ 32 ms with no interaction long task > 100 ms.

## Phase 24: Architecture Workbench Rollout

### 24.1 Approve the advanced Canvas as a separate release program

<!-- files: docs/specs/229-app-workbench-canvas/**, NOTICE, THIRD_PARTY_NOTICES.md, apps/vscode-e2e/artifacts/** -->
<!-- @see spec.md [FR-34]–[FR-44] [NFR-9]–[NFR-13] -->
<!-- @see design.md [DES-TEST] [DES-ROLLOUT] -->

- [ ] Reconcile implemented-versus-full-feature traceability, run full unit/component/host/protocol/browser/extension-host/package/security/license gates, review beginner/universal/architecture/AFX outcome evidence and rich-content/stress captures, complete manual F5 on representative general and architecture workspaces, and obtain explicit owner approval before graduating the experiment.

Acceptance: no Phase 17–24 item is used as a 2.4.0 claim; unresolved URL/layout/presentation portability decisions remain explicit; beginner completion, architecture depth, no-loss reliability, p95 interaction, interoperability, and capability-off gates meet the spec; raw opens/node counts do not substitute for outcomes; the final candidate has a clean, reviewable diff and separately versioned evidence.

## Cross-Reference Index

| Task | Spec Requirement                                                       | Design Section                                                                       |
| ---- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 1.1  | [FR-1], [FR-2], [FR-19]                                                | [DES-UI], [DES-API]                                                                  |
| 1.2  | [FR-4], [FR-13], [FR-18], [FR-19]                                      | [DES-DATA], [DES-API]                                                                |
| 1.3  | [FR-3], [FR-12], [FR-19], [NFR-2], [NFR-5]                             | [DES-HOST], [DES-ARCH], [DES-FILES]                                                  |
| 1.4  | [FR-4], [FR-13], [FR-18], [NFR-3]                                      | [DES-DATA]                                                                           |
| 2.1  | [FR-4], [FR-11]                                                        | [DES-DATA], [DES-OVR]                                                                |
| 2.2  | [FR-10], [FR-17], [NFR-1], [NFR-6]                                     | [DES-ARCH], [DES-DEC], [DES-DEPS]                                                    |
| 2.3  | [FR-5], [FR-6], [FR-7], [FR-8], [FR-17]                                | [DES-UI], [DES-API]                                                                  |
| 2.4  | [FR-9], [FR-18]                                                        | [DES-UI]                                                                             |
| 3.1  | [FR-15], [FR-16]                                                       | [DES-UI], [DES-API]                                                                  |
| 4.1  | [FR-14]                                                                | [DES-ERR], [DES-SEC]                                                                 |
| 4.2  | [FR-13], [FR-18], [FR-19], [FR-20], [NFR-3], [NFR-4], [NFR-6], [NFR-7] | [DES-TEST]                                                                           |
| 4.3  | [FR-21]                                                                | [DES-ROLLOUT]                                                                        |
| 5.1  | [FR-1], [FR-22]                                                        | [DES-SETTINGS]                                                                       |
| 5.2  | [FR-20], [FR-23]                                                       | [DES-API], [DES-DATA]                                                                |
| 5.3  | [FR-1], [FR-6], [FR-19], [FR-20], [FR-22]                              | [DES-TEST]                                                                           |
| 6.1  | [FR-12], [FR-20], [FR-30], [FR-31], [NFR-4]                            | [DES-HOST], [DES-CANVAS-DOCUMENT-SERVICE], [DES-CANVAS-DIRTY-CONFLICT]               |
| 6.2  | [FR-11], [FR-12], [FR-24], [FR-31], [NFR-4], [NFR-5]                   | [DES-API], [DES-CANVAS-PROTOCOL], [DES-CANVAS-DIRTY-CONFLICT]                        |
| 7.1  | [FR-4], [FR-13], [FR-14], [FR-18], [FR-33], [NFR-3], [NFR-8]           | [DES-DATA], [DES-CANVAS-PROTOCOL]                                                    |
| 7.2  | [FR-26], [FR-28], [FR-33], [NFR-8]                                     | [DES-DATA], [DES-SEC]                                                                |
| 8.1  | [FR-4], [FR-5], [FR-8], [FR-10], [FR-13], [FR-14], [FR-23], [FR-29]    | [DES-ARCH], [DES-CANVAS-INTERACTIONS], [DES-DEPS]                                    |
| 8.2  | [FR-9], [FR-10], [FR-17], [FR-28], [FR-29], [NFR-6], [NFR-7]           | [DES-CANVAS-INTERACTIONS]                                                            |
| 9.1  | [FR-3], [FR-19], [FR-24], [FR-30], [NFR-2], [NFR-4]                    | [DES-HOST], [DES-CANVAS-TARGET-LOC]                                                  |
| 10.1 | [FR-11], [FR-12], [FR-31], [FR-32], [NFR-4], [NFR-5]                   | [DES-CANVAS-EDITOR-AREA], [DES-CANVAS-DOCUMENT-SERVICE], [DES-CANVAS-MULTI-INSTANCE] |
| 11.1 | [FR-21], [FR-25], [FR-26], [NFR-3]                                     | [DES-DEC], [DES-CANVAS-INTERACTIONS]                                                 |
| 11.2 | [FR-21], [FR-26], [FR-30]                                              | [DES-ARCH], [DES-ERR]                                                                |
| 12.1 | [FR-15], [FR-16], [FR-27], [FR-33]                                     | [DES-CANVAS-INTERACTIONS], [DES-SEC]                                                 |
| 12.2 | [FR-33], [NFR-8]                                                       | [DES-SEC], [DES-CANVAS-PROTOCOL]                                                     |
| 13.1 | [FR-9], [FR-18], [FR-28]                                               | [DES-CANVAS-INTERACTIONS], [DES-DATA]                                                |
| 14.1 | [FR-1], [FR-2], [FR-22], [FR-32]                                       | [DES-SETTINGS], [DES-CANVAS-EDITOR-AREA]                                             |
| 15.1 | [NFR-1], [NFR-8]                                                       | [DES-DEPS], [DES-ROLLOUT]                                                            |
| 16.1 | [FR-1]–[FR-44], [NFR-1]–[NFR-13]                                       | [DES-TEST], [DES-ROLLOUT]                                                            |
| 16.2 | [FR-11], [FR-24], [FR-31], [NFR-4]                                     | [DES-CANVAS-DOCUMENT-SERVICE], [DES-CANVAS-DIRTY-CONFLICT], [DES-CANVAS-PROTOCOL]    |
| 16.3 | [FR-20], [FR-30], [FR-35], [NFR-13]                                    | [DES-DATA], [DES-API], [DES-HOST]                                                    |
| 16.4 | [FR-21], [FR-26], [FR-30], [FR-34], [NFR-10], [NFR-13]                 | [DES-ARCH], [DES-DATA], [DES-ERR]                                                    |
| 16.5 | [FR-9], [FR-17], [FR-23], [FR-24], [FR-29], [FR-31]                    | [DES-CANVAS-INTERACTIONS], [DES-CANVAS-MULTI-INSTANCE]                               |
| 16.6 | [FR-33], [FR-43], [FR-44], [NFR-12]                                    | [DES-UI], [DES-CANVAS-INTERACTIONS], [DES-DEC]                                       |
| 16.7 | [FR-11], [FR-20], [FR-24], [FR-26], [FR-30], [FR-31], [FR-43], [FR-44] | [DES-TEST], [DES-ROLLOUT]                                                            |
| 17.1 | [FR-21], [FR-26], [FR-34], [NFR-10]                                    | [DES-ARCH], [DES-HOST], [DES-CANVAS-INTERACTIONS]                                    |
| 17.2 | [FR-34], [FR-43], [NFR-7], [NFR-10], [NFR-12]                          | [DES-UI], [DES-CANVAS-INTERACTIONS]                                                  |
| 18.1 | [FR-7], [FR-14], [FR-17], [FR-20], [FR-35]–[FR-37], [NFR-9]            | [DES-API], [DES-HOST], [DES-SEC]                                                     |
| 18.2 | [FR-14], [FR-23], [FR-35]–[FR-37], [FR-44], [NFR-3], [NFR-9]           | [DES-UI], [DES-DATA], [DES-SEC]                                                      |
| 19.1 | [FR-27], [FR-38], [FR-39], [NFR-3], [NFR-11]                           | [DES-CANVAS-INTERACTIONS], [DES-DATA]                                                |
| 19.2 | [FR-27], [FR-38], [FR-43], [NFR-11], [NFR-12]                          | [DES-UI], [DES-CANVAS-INTERACTIONS]                                                  |
| 20.1 | [FR-40], [NFR-1], [NFR-10], [NFR-11]                                   | [DES-CANVAS-INTERACTIONS], [DES-DEPS], [DES-ERR]                                     |
| 20.2 | [FR-40], [NFR-10], [NFR-11]                                            | [DES-CANVAS-INTERACTIONS], [DES-DATA], [DES-ERR]                                     |
| 21.1 | [FR-9], [FR-28], [FR-39], [FR-41]                                      | [DES-CANVAS-INTERACTIONS], [DES-DATA]                                                |
| 21.2 | [FR-26], [FR-38], [FR-41], [NFR-3], [NFR-11]                           | [DES-CANVAS-INTERACTIONS], [DES-DATA], [DES-ERR]                                     |
| 22.1 | [FR-42], [NFR-3], [NFR-9], [NFR-11]                                    | [DES-API], [DES-SEC]                                                                 |
| 22.2 | [FR-42], [FR-44], [NFR-9], [NFR-11], [NFR-12]                          | [DES-API], [DES-SEC], [DES-ERR]                                                      |
| 23.1 | [FR-10], [FR-17], [FR-29], [FR-34]–[FR-42], [NFR-6], [NFR-7], [NFR-10] | [DES-TEST]                                                                           |
| 23.2 | [FR-34]–[FR-44], [NFR-4], [NFR-6]–[NFR-7], [NFR-10]–[NFR-13]           | [DES-TEST], [DES-ROLLOUT]                                                            |
| 24.1 | [FR-34]–[FR-44], [NFR-9]–[NFR-13]                                      | [DES-TEST], [DES-ROLLOUT]                                                            |

## Notes

- This zone owns the Workbench Canvas surface and the Chat Settings Experimental toggle (dual-owned with `214-app-chat-settings`).
- Computed reverse Impact Lens analysis remains separately owned. Multi-canvas, native undo/redo/revert, editable declared-dependency maps, planning starters, editor-area Canvas, progressive profiles, universal capability-off behavior, and the release-foundation re-audit belong to Phases 6–16. Rich architecture discovery/content/composition/layout/export belongs to the distinct, unchecked Phases 17–24 program.

## Work Sessions

<!-- IMPORTANT: This section MUST remain the LAST section in tasks.md. -->
<!-- Columns: Date | Task | Action | Files Modified | Agent ([x]/[]) | Human ([x]/[]) -->

| Date                     | Task                                       | Action             | Files Modified                                                                                                                                                                                                                                                                                                                             | Agent | Human |
| ------------------------ | ------------------------------------------ | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- | ----- |
| 2026-06-03               | 1.1-4.3                                    | Coded/Verified     | apps/vscode/package.json, apps/vscode/src/services/canvas-data.ts, apps/vscode/src/panels/workbench-panel.ts, apps/workbench/src/views/canvas.tsx, apps/workbench/src/components/canvas/\*, apps/workbench/src/lib/json-canvas.ts, packages/shared/src/{workbench-types,workbench-protocol}.ts, canvas tests/e2e                           | [x]   | [x]   |
| 2026-06-04               | 5.1-5.3                                    | Graduated/Verified | Graduated the canvas sprint → `229-app-workbench-canvas` (spec.md/design.md/tasks.md); reconciled as-built (Settings surface FR-22, picker, FR-23 expanded authoring, `afxNodeKind`, `mode:"send"`, `CanvasDataProviderOptions`); retargeted `@see` across the canvas source + added missing `@see`; built `[DES-CANVAS-TRACE]` 1:1 matrix | [x]   | [x]   |
| 2026-07-19               | 6.1-16.1                                   | Reviewed           | spec.md, design.md, tasks.md, ADR-0009-react-flow-json-canvas-projection.md                                                                                                                                                                                                                                                                | [x]   | [x]   |
| 2026-07-19               | 6.1                                        | Coded              | apps/vscode/src/services/workbench-file-state.ts, apps/vscode/src/services/specs-data.ts, apps/vscode/src/services/canvas-data.ts, apps/vscode/src/panels/workbench-panel.ts, apps/vscode/src/extension.ts, apps/workbench/src/views/canvas.tsx, targeted tests                                                                            | [x]   | []    |
| 2026-07-19               | 6.1                                        | Verified           | 62 VS Code host tests, 15 Canvas tests, 6 Canvas Playwright tests, VS Code and Workbench typechecks                                                                                                                                                                                                                                        | [x]   | []    |
| 2026-07-19T08:27:53.000Z | 17.1-24.1                                  | Planned            | Captured the post-2.4.0 architecture-workbench north star in spec.md, design.md, and tasks.md; no implementation or owner verification claimed                                                                                                                                                                                             | [x]   | []    |
| 2026-07-19T09:29:02.000Z | 16.2-24.1                                  | Reviewed           | Refined spec.md, design.md, and tasks.md for universal/beginner/AFX users, Essentials/Architecture/AFX profiles, release-foundation blockers, measurable outcome gates, and implementation-ready advanced phases; no code, test execution, task completion, or owner verification claimed                                                  | [x]   | []    |
| 2026-07-24T11:49:37.000Z | 6.2, 8.2, 9.1, 10.1, 11.2, 16.2-16.5, 18.1 | Coded/Verified     | Hardened multi-client edit ordering, two-host terminal responses, canonical document identity, Project Canvas guards, native undo, DNS-pinned URL previews, portable invalidation, and drag-preview synchronization; added focused regression coverage across host and Workbench suites                                                    | [x]   | []    |
