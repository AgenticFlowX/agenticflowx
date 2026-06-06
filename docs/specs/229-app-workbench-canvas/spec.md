---
afx: true
type: SPEC
status: Living
owner: "@rix"
version: "1.0"
created_at: "2026-06-03T07:28:52.000Z"
updated_at: "2026-06-06T11:03:56.000Z"
tags: ["app", "workbench", "canvas", "json-canvas", "ideation", "experimental"]
depends_on:
  [
    "100-package-shared",
    "110-package-transport",
    "200-app-vscode",
    "214-app-chat-settings",
    "220-app-workbench",
    "227-app-workbench-shell",
  ]
---

# App Workbench Canvas — Product Specification

> **As-built.** This is the canonical canvas spec; FR/NFR/DES anchors are stable so code `@see` links resolve here. It reconciles the original canvas sprint plan with what actually shipped.

## References

- **Parent spec**: [App Workbench](../220-app-workbench/spec.md); shell host: [Workbench Shell](../227-app-workbench-shell/spec.md).
- **Scope boundary**: a freeform ideation surface, not a knowledge graph — backlinks, graph views, and reverse-index features are out of scope (see `[DES-ROLLOUT]`).
- **Reverse-traceability sibling**: the read-only impact/dependency canvas is deferred to the [228-app-workbench-impact-lens](../228-app-workbench-impact-lens/spec.md) track; this surface is freeform ideation only.
- **JSON Canvas spec 1.0**: <https://jsoncanvas.org/spec/1.0/> — the on-disk format (node types `text`/`file`/`link`/`group`, optional `nodes`/`edges`, `fromEnd`/`toEnd`, file `subpath`, six color presets).
- **Settings surface owner**: [214-app-chat-settings](../214-app-chat-settings/spec.md) — the chat Settings webview that hosts the Experimental toggle (FR-22) is co-owned here and there.
- **Storage analog**: `apps/workbench/src/views/notes.tsx` — the single-`.afx`-file model this feature mirrors (`.afx/notes.md` → `.afx/project.canvas`).
- **Markdown renderer reused**: `apps/workbench/src/lib/markdown-render.ts` (`MinimalMarkdown`) for inline node content.

---

## Problem Statement

Spec-driven development has a cold-start problem: the blank `spec.md` front-loads ceremony before the user knows what they are building. AFX answers this for _linear_ thinking — chat-first, Spec mode on demand. What is missing, for a heavy SDD user, is a place to think _spatially_ before anything is a spec: drop fragments, arrange them, link them, and let an idea harden at its own pace.

The feature fills that gap with an in-IDE surface: a freeform canvas that needs zero configuration, keeps its state in the workspace, and graduates into AFX's existing SDD flow — a thinking space, not a general-purpose whiteboard and not a knowledge graph.

Scope is deliberately minimal: a single freeform canvas, off by default behind the `afx.experimental.canvas` flag, persisted as one portable JSON Canvas file at `.afx/project.canvas`. The surface is self-contained and can be removed without affecting other Workbench tabs. A read-only impact/dependency canvas is out of scope and tracked separately under [`228-app-workbench-impact-lens`](../228-app-workbench-impact-lens/spec.md).

---

## User Stories

### Primary Users

- The AFX author and heavy SDD users who want a spatial scratch surface inside the IDE, with zero setup, that can promote into specs/notes when an idea is ready.
- (Secondary, observational) opt-in early users who enable the experiment flag and provide usage signal.

### Stories

**As a** heavy SDD user **I want** a freeform canvas inside the Workbench where I can drop idea cards and arrange them **So that** I can think spatially before committing to a spec, without leaving VS Code or configuring anything.

**As a** user mid-ideation **I want** to pull an existing markdown doc onto the canvas and read it inline next to my thoughts **So that** I can relate messy thinking to durable artifacts in one view.

**As a** user with a maturing idea **I want** to select a card and send it to chat as context **So that** a thought can become durable project memory without losing its messy source.

**As a** user organizing fragments **I want** to resize cards, draw labeled links, group them in a box, and color them **So that** the spatial arrangement itself carries meaning.

**As the** maintainer of a portable workspace **I want** the canvas stored as a single standard `.canvas` file in `.afx/` **So that** it is diff-able, commit-able, and openable by any JSON Canvas tool without lock-in.

**As the** product owner running an experiment **I want** the feature off by default behind a flag with a pre-committed kill criterion **So that** building it is cheap to validate and cheap to remove.

---

## Requirements

### Functional Requirements

| ID    | Requirement                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Priority    |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------- |
| FR-1  | Gate the entire feature behind a VS Code setting `afx.experimental.canvas` (boolean, default `false`); when off, the Canvas tab and all canvas code paths are not surfaced                                                                                                                                                                                                                                                                                                                                                                                                                 | Must Have   |
| FR-2  | When enabled, add a `Canvas` tab to the Workbench bottom panel using the existing tab registration pattern, with its own icon and label                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Must Have   |
| FR-3  | Persist canvas state as a single JSON Canvas file at `.afx/project.canvas`, mirroring how `.afx/notes.md` backs the Notes tab (one workspace-level file, AFX-owned location, no setup)                                                                                                                                                                                                                                                                                                                                                                                                     | Must Have   |
| FR-4  | The in-memory canvas state IS the JSON Canvas object (`{ nodes, edges }`); there is no separate runtime model and no lossy serializer                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Must Have   |
| FR-5  | Create a freeform **text node** (markdown stored inline in the node's `text` field) at a chosen canvas position                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Must Have   |
| FR-6  | Create a **file node** referencing an existing workspace markdown file; render its content inline using the existing Workbench markdown renderer                                                                                                                                                                                                                                                                                                                                                                                                                                           | Must Have   |
| FR-7  | Render only markdown for inline file-node content; non-markdown files (PDF, image, etc.) show a filename chip placeholder, never an embed                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Must Have   |
| FR-8  | Move nodes (drag) and resize nodes (corner handle), writing back to `x` / `y` / `width` / `height`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Must Have   |
| FR-9  | Connect two nodes with an **edge**, with an optional editable text label; edges can be retargeted and deleted                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Must Have   |
| FR-10 | Pan (drag background) and zoom (wheel) the infinite canvas viewport                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Must Have   |
| FR-11 | Autosave canvas changes back to `.afx/project.canvas` (debounced) via the existing `afxSaveFile` bridge message; show a lightweight saved / saving / error indicator                                                                                                                                                                                                                                                                                                                                                                                                                       | Must Have   |
| FR-12 | Load `.afx/project.canvas` on Workbench init and on external file change, delivered through the existing `afxUpdate` workbench-state path                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Must Have   |
| FR-13 | Read and write the **full** JSON Canvas 1.0 format losslessly — including `group` and `link` node types and all unknown/optional fields — even though v1 only authors text/file/group nodes and edges                                                                                                                                                                                                                                                                                                                                                                                      | Must Have   |
| FR-14 | Render `group` and `link` nodes if present in a loaded file (e.g. authored in Obsidian), read-only for `link`, so an externally-authored canvas is not mangled                                                                                                                                                                                                                                                                                                                                                                                                                             | Should Have |
| FR-15 | Select a text node and **promote** it to a quick note (reusing the `afxAppendNote` flow), leaving the original node in place                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Should Have |
| FR-16 | Select one or more nodes and **send to chat** as context, via the existing `afxOpenChatCommand` bridge (`mode: "send"`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Should Have |
| FR-17 | Provide quick-add affordances (toolbar buttons and/or keyboard) for: add text node, add file node, fit-to-view                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Should Have |
| FR-18 | Preserve `color` (preset `"1"`–`"6"` or hex), edge `fromSide`/`toSide`/`toEnd`/`label`, and file-node `subpath` on round-trip even when not editable. AFX **may** persist namespaced extension fields (`afxNodeKind`) on nodes; these MUST round-trip losslessly through `CanvasExtensionFields` and MUST NOT break other-tool reads                                                                                                                                                                                                                                                       | Must Have   |
| FR-19 | Deliver a `canvasEnabled` boolean in the existing `afxUpdate` payload; only include `canvas` payload/read/watch work when the experiment flag is true                                                                                                                                                                                                                                                                                                                                                                                                                                      | Must Have   |
| FR-20 | File nodes resolve and fetch markdown content through the existing host bridge — a markdown file picker (`afxPickMarkdownFile` → `afxMarkdownFilePicked`) for selection and `afxFetchDocContent` → `afxDocContent` for content; the webview never reads files directly                                                                                                                                                                                                                                                                                                                     | Must Have   |
| FR-21 | Record the experiment scope boundary in the design — freeform ideation only; knowledge-graph, backlink, and reverse-index features are out of scope                                                                                                                                                                                                                                                                                                                                                                                                                                        | Must Have   |
| FR-22 | Chat Settings exposes a Workbench Canvas experiment toggle in an **Experimental** group. The settings webview renders a switch bound to `experimental.canvasEnabled` that, on change, sends `experimental/setCanvasEnabled { requestId, enabled }` and optimistically patches the local snapshot; a read-only display of the canvas file path (`canvasPath`, deep-linking the `afx.experimental.canvas` VS Code setting, not in-webview editable); and an "Open Workbench" action. Mutations are tracked by `requestId` and resolved/toasted on the next settings snapshot or `chat/error` | Should Have |
| FR-23 | Provide the expanded authoring verbs beyond the v1 minimum: **note** and **label** text-node variants (`afxNodeKind`), **group** node authoring, per-node **color**, node **rename**, and edge **retarget**/**delete**. (`link`-node authoring remains out of scope — read/render/round-trip only)                                                                                                                                                                                                                                                                                         | Should Have |

### Non-Functional Requirements

| ID    | Requirement                | Target                                                                                                                                                                              |
| ----- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NFR-1 | Zero dependencies          | The canvas surface uses no third-party graph/canvas library (no React Flow, tldraw, or `json-canvas-viewer`). DOM + CSS transform + SVG only.                                       |
| NFR-2 | Zero configuration         | Works with no user setup beyond toggling the experiment flag; the `.canvas` file is created on first use, no path or vault config.                                                  |
| NFR-3 | Portability / losslessness | `.afx/project.canvas` validates against JSON Canvas 1.0 and round-trips through Obsidian without field loss or node-type loss (including AFX extension fields).                     |
| NFR-4 | Disposability              | The feature is removable by deleting the flag, the `Canvas` view, and the canvas files; no schema migration, no entanglement with non-experimental surfaces.                        |
| NFR-5 | Architecture boundaries    | No edits to `packages/ui/src` (managed shadcn). Host IO (`afxSaveFile` write, file read/watch) stays in `apps/vscode`; UI stays in `apps/workbench`; shared types in `@afx/shared`. |
| NFR-6 | Performance                | Smooth pan/zoom and drag at a single-canvas working scale (target ≤ ~150 nodes); autosave debounced (≥ 500 ms) so typing/dragging never blocks on disk IO.                          |
| NFR-7 | Low maintenance            | Opening the canvas must never require tidying or migration; a stale or messy canvas remains valid and openable indefinitely.                                                        |

---

## Acceptance Criteria

### Gating & Persistence

- [x] With `afx.experimental.canvas` unset/false, the Workbench shows the original seven tabs and no Canvas surface, file read/watch, or `canvas` payload exists (`canvasEnabled:false` in `afxUpdate` is allowed).
- [x] With the flag true, a `Canvas` tab appears and opens an infinite canvas surface.
- [x] First open with no `.afx/project.canvas` present shows an empty canvas; creating the first node creates `.afx/` if missing and writes a valid `.canvas` file.
- [x] Editing the canvas triggers a debounced autosave via `afxSaveFile` and the save indicator reflects saved / saving / error; an external edit to the file refreshes the view via `afxUpdate`.

### Authoring

- [x] A created text node stores its markdown inline; reloading the canvas restores it identically.
- [x] A file node pointing at an existing `.md` renders that file's markdown inline via the shared renderer; pointing at a `.pdf`/image shows a filename chip, not an embed.
- [x] Dragging a node updates its `x`/`y`; resizing updates `width`/`height`; both persist across reload.
- [x] Connecting two nodes creates an edge; adding a label persists it; retargeting/deleting an edge persists; the edge survives reload.
- [x] Pan and zoom move/scale the viewport without moving nodes relative to each other.
- [x] Note/label/group nodes, per-node color, and node rename author correctly and persist _(FR-23)_.

### Fidelity, Live actions & Settings

- [x] Loading a `.canvas` authored in Obsidian (containing `group`/`link` nodes, colors, edge sides, subpaths) renders without error and, after an AFX edit + save, retains every original node type and field — and AFX `afxNodeKind` extension fields round-trip losslessly _(FR-13/18, NFR-3)_.
- [x] Promoting a text node appends a quick note and leaves the source node intact _(FR-15)_.
- [x] Selecting nodes and "send to chat" sends the selected content via `afxOpenChatCommand { mode: "send" }` _(FR-16)_.
- [x] A file node for an existing markdown file selects via `afxPickMarkdownFile`/`afxMarkdownFilePicked` and renders the returned `afxDocContent`; a missing/non-markdown file never attempts direct webview file IO _(FR-20)_.
- [x] Chat Settings → Experimental shows the Workbench Canvas toggle; flipping it sends `experimental/setCanvasEnabled` and the Workbench tab appears/disappears _(FR-22)_.
- [x] Removing the flag, the `Canvas` view files, and the canvas files leaves the rest of the Workbench fully functional (disposability check) _(NFR-4)_.

---

## Non-Goals (Out of Scope)

- The read-only **impact/dependency canvas** (spec/code/test projection) — deferred to the `228-app-workbench-impact-lens` track.
- **New-user onboarding** flows — owned by the workbench planner track. This canvas is an expert ideation surface, not an onboarding funnel.
- **Authoring of `link` nodes** in v1 (they are read/rendered/round-tripped, but not created/edited through the UI). _(Group authoring, originally out of scope, shipped — see FR-23.)_
- Inline **PDF, image, video, or live-HTML** embedding inside nodes (filename chip only).
- **Multiplayer / real-time collaboration**, comments, presence.
- **Rich WYSIWYG markdown editing** inside a node (edit the source; render markdown — no in-node rich editor).
- **Multiple canvases / canvas browser** — exactly one canvas (`.afx/project.canvas`).
- **Auto-layout / generated graphs** — every node is placed by the user.
- **Third-party canvas libraries** — explicitly not used (NFR-1).

---

## Open Questions

| #   | Question                                  | Status   | Blocking | Resolution                                                                                                                                                                                                                                                         |
| --- | ----------------------------------------- | -------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Storage location of the canvas file       | Resolved | No       | `.afx/project.canvas` — single workspace-level project map, mirrors `.afx/notes.md`.                                                                                                                                                                               |
| 2   | Tab name                                  | Resolved | No       | `Canvas`. Plain and literal.                                                                                                                                                                                                                                       |
| 3   | React Flow vs custom surface              | Resolved | No       | Custom (DOM + CSS transform + SVG). Keeps JSON Canvas as the single source of truth, zero deps, disposable.                                                                                                                                                        |
| 4   | Strict JSON Canvas vs AFX-extended format | Resolved | No       | Strict JSON Canvas 1.0 on disk for portability, **plus** a single namespaced extension field `afxNodeKind` ("note"/"label") that round-trips losslessly via `CanvasExtensionFields` and is ignored by other tools. No structural/proprietary node types are added. |
| 5   | Persistence mechanism                     | Resolved | No       | Reuse existing `afxSaveFile { path, content }` outbound for writes; extend `afxUpdate` with `canvas` for reads.                                                                                                                                                    |
| 6   | Depends on the deferred impact canvas?    | Resolved | No       | No. Freeform ideation only.                                                                                                                                                                                                                                        |
| 7   | Ship enabled?                             | Resolved | No       | No — off by default with a kill criterion (`[DES-ROLLOUT]`).                                                                                                                                                                                                       |
| 8   | Within the ideation scope boundary?       | Resolved | No       | Recorded in FR-21. Freeform ideation surface, not a graph/backlink store.                                                                                                                                                                                          |

---

## Dependencies

- `apps/workbench` shell (`app.tsx`) and context reducer (`workbench-context.tsx`) — `227-app-workbench-shell`.
- `packages/shared/src/workbench-protocol.ts` (`afxSaveFile`, `afxUpdate`, `afxOpenChatCommand`, `afxAppendNote`, `afxFetchDocContent`/`afxDocContent`, `afxPickMarkdownFile`/`afxMarkdownFilePicked`) — `100-package-shared`.
- `apps/workbench/src/lib/markdown-render.ts` for inline node content.
- `apps/vscode` host for reading/watching `.afx/project.canvas`, registering the setting, and contributing the gated view.
- `apps/chat` Settings webview for the Experimental toggle (FR-22) — `214-app-chat-settings`.
- VS Code settings contribution (`apps/vscode/package.json`) for `afx.experimental.canvas`.

---

## Appendix

### Agent Entry Map

| Field           | Values                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Owned surface   | Workbench `Canvas` tab (viewport, nodes, edges, toolbar, node menu), the `.afx/project.canvas` store, and the Chat Settings → Experimental canvas toggle                                                                                                                                                                                                                                                                                                                                  |
| Owned files     | `apps/workbench/src/views/canvas.tsx`, `apps/workbench/src/components/canvas/{canvas-surface,canvas-node,canvas-edges,canvas-toolbar,use-canvas-model}.tsx`, `apps/workbench/src/lib/json-canvas.ts`, `apps/vscode/src/services/canvas-data.ts`; shared `packages/shared/src/{workbench-types,workbench-protocol}.ts` (canvas region); Settings `apps/chat/src/views/settings.tsx` (Experimental), `apps/chat/src/lib/{settings-copy,settings-snapshot}.ts` (dual-owned with `214`)       |
| Local anchors   | `Canvas`, `CanvasSurface`, `CanvasNode`, `CanvasEdges`, `CanvasToolbar`, `useCanvasModel`, `parseJSONCanvas`, `serializeJSONCanvas`, `createCanvasDataProvider`                                                                                                                                                                                                                                                                                                                           |
| Bridge messages | Inbound `afxUpdate { canvasEnabled?, canvas?: CanvasFilePayload }`, `afxDocContent`, `afxMarkdownFilePicked`; outbound `afxSaveFile`, `afxFetchDocContent`, `afxPickMarkdownFile`, `afxAppendNote`, `afxOpenChatCommand`, `afxOpenFile`; Settings `experimental/setCanvasEnabled`                                                                                                                                                                                                         |
| Settings keys   | `afx.experimental.canvas` (boolean, default false)                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Tests           | `apps/workbench/src/lib/json-canvas.test.ts`, `apps/workbench/src/components/canvas/use-canvas-model.test.ts`, `apps/workbench/src/views/canvas.test.tsx`, `apps/vscode/src/services/canvas-data.test.ts`, `apps/vscode/src/panels/workbench-panel.test.ts`, `apps/vscode/src/configuration-manifest.test.ts`, `apps/vscode-e2e/src/extension.test.ts`, `apps/workbench/e2e/canvas.spec.ts`, plus canvas cases in `apps/chat/src/app.test.tsx` and `packages/shared/src/messages.test.ts` |
| Out of scope    | Impact Lens projection, `link`-node authoring, inline non-markdown embeds, multi-canvas, auto-layout                                                                                                                                                                                                                                                                                                                                                                                      |
