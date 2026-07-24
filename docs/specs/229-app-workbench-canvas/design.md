---
afx: true
type: DESIGN
status: Draft
owner: "@rix"
version: "1.5"
created_at: "2026-06-03T07:28:52.000Z"
updated_at: "2026-07-22T19:40:39.000Z"
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
    "progressive-profiles",
    "universal-canvas",
    "beginner",
    "custom-editor",
    "realtime",
    "experimental",
  ]
spec: spec.md
---

# App Workbench Canvas — Technical Design

## [DES-OVR] Overview

<!-- @see spec.md [FR-1] [FR-2] [FR-3] [FR-4] [FR-11] [FR-19] [FR-24] [FR-25] [FR-31] [FR-32] [FR-33] [FR-34] [FR-35] [FR-36] [FR-37] [FR-38] [FR-40] [FR-43] [FR-44] -->

Canvas is a portable JSON Canvas planning system with optional AFX enhancement, rendered by
`@xyflow/react`. JSON Canvas remains the authoritative portable document; a
pure adapter projects it into controlled React Flow nodes/edges and applies
view changes without dropping standard, unknown, or namespaced fields.

AFX enhancement is optional, not an installation prerequisite or a separate
format. The same application starts in an Essentials profile for beginners and
non-AFX workspaces, expands into Architecture tools for topology and rich
composition, and exposes AFX integrations only when their capabilities exist.
Profiles affect affordance density, onboarding, and command visibility; they do
not mutate the document or make existing content disappear.

One document engine serves the bottom-panel Workbench tab and an optional
editor-area custom text editor. A host canvas library discovers the legacy
`.afx/project.canvas`, `.afx/canvases/*.canvas`, and explicitly opened
workspace-local `.canvas` files. A revision-aware document service combines
open text buffers with filesystem state, sequences writes, publishes manual
changes in real time, and exposes truthful dirty/saving/error/conflict state.

The post-2.4.0 north star evolves that stable document surface into an
architecture workbench: whole-workspace spec topology, rendered spec/Markdown,
file, image, safe URL, Note, and Board nodes; low- and high-fidelity composition;
rich semantic styling; and previewable auto-layout. The intended spatial freedom
and polish are comparable to Miro/Jamboard/Figma, but the domain remains software
architecture and SDD. This paragraph describes planned scope, not current-release
completion.

## [DES-ARCH] Architecture

<!-- @see spec.md [FR-3] [FR-4] [FR-11] [FR-12] [FR-19] [FR-20] [FR-24] [FR-25] [FR-26] [FR-30] [FR-31] [FR-32] [FR-34] [FR-35] [FR-36] [FR-37] [FR-40] [FR-43] [FR-44] [NFR-1] [NFR-4] [NFR-5] [NFR-9] [NFR-12] [NFR-13] -->

### System Context

```text
workspace TextDocuments + filesystem
  .afx/project.canvas
  .afx/canvases/*.canvas
  explicit workspace-local *.canvas
  docs/specs/**/{spec,design,tasks}.md + single-document Sprints
             │ change/save/close + fs watch
             ▼
apps/vscode
  WorkbenchFileState       open-buffer overlay + content revision
  WorkbenchRefreshCoordinator  single-flight/latest-wins updates
  WorkbenchMutationCoordinator per-path FIFO + revision/conflict guard
  CanvasLibraryService     discover/create/rename/duplicate/delete/select
  CanvasDocumentService    durable sessions, staged edits, save timers, history/revisions
  CanvasReferenceService   revisioned visible/on-demand source subscriptions
  SpecDependencyIndexer    four-file + Sprint depends_on resolution/cycles
  WorkspaceArchitectureIndex  complete spec topology + search/filter/focus
  CanvasReferenceService host-mediated revisioned Markdown/image/Board/Note data
  CanvasContentPreviewService bounded URL metadata + expanded preview requests
  CanvasLayoutService      preview/apply architecture layout requests
  AfxCanvasEditorProvider  editor-area CustomTextEditorProvider
             │ typed snapshots/results
             ▼
@afx/shared
  CanvasDescriptor / CanvasLibraryPayload / CanvasDocumentSnapshot
  WorkbenchMutationResult / SpecDependencyGraph / WorkbenchViewId
             │
             ▼
packages/canvas-engine
  lossless JSON Canvas parse/serialize + ID-based mutation reducer
             │
             ▼
apps/workbench
  CanvasApp(surface = "workbench" | "editor")
  CanvasDocumentClient      session projection + local viewport/selection/inspectors
  CanvasProfileController   Essentials | Architecture | AFX affordance policy
  JsonCanvasReactFlowAdapter lossless controlled projection
  ReactFlowCanvas           shared nodes/edges/toolbars/inspectors
  CanvasLibrary             compact document switcher and lifecycle actions
  PlanningGuide             blank/ideas/feature/roadmap/next-spec starters
  SpecMapTools              import/refresh/detach declared dependencies
  ArchitectureExplorer      search/filter/traverse/isolate whole-workspace graph
  PreviewNodes              spec/file/image/link/note/board renderers
  LayoutPreview             staged auto-layout diff + apply/cancel
```

### Component Diagram

```text
CanvasApp
├─ CanvasLibrary / profile + mode selector / save state
├─ CanvasDocumentClient
│  ├─ immediate ID-based operation staging to durable host session
│  ├─ acknowledged revisions + independent local viewport/selection
│  └─ external update: auto-apply clean | conflict dirty/pending
├─ ReactFlowProvider
│  └─ ReactFlowCanvas
│     ├─ controlled nodes/edges + selection/change reducers
│     ├─ AfxTextNode / AfxFileNode / AfxLinkNode / AfxGroupNode
│     ├─ AfxCanvasEdge + EdgeInspector + reconnect
│     ├─ NodeResizer / NodeToolbar / Background / Controls / MiniMap
│     ├─ lasso / keyboard / snap / fit / auto-pan / copy-paste
│     └─ frames / alignment / z-order / locks / presentation mode
├─ PlanningGuide / NextSpecConfirmation / ArchitectureExplorer
├─ ContentPreviewController / safe host preview cache
├─ LayoutPreview / Apply as one undo transaction
└─ SpecMapTools / DependencyIssues / NoteBoardAttachments
```

## [DES-UI] User Interface & UX

<!-- @see spec.md [FR-5] [FR-6] [FR-9] [FR-10] [FR-15] [FR-16] [FR-17] [FR-23] [FR-34] [FR-35] [FR-36] [FR-37] [FR-38] [FR-39] [FR-40] [FR-41] [FR-42] [FR-43] [FR-44] [NFR-12] -->

> Global design tokens (Tailwind, shadcn primitives, brand color `afx-brand`, `afx-surface-*`) live in `CLAUDE.md` and `@afx/ui`; only canvas-local composition is described here. Surface map IDs: `[Canvas.Toolbar]`, `[Canvas.Viewport]`, `[Canvas.Node]`, `[Canvas.Edge]`, `[Canvas.NodeMenu]`, `[Canvas.SaveStatus]`.

### Surface Map — Canvas tab (normal state)

```text
AFX Workbench / Canvas                                            [Canvas.Toolbar]
+--------------------------------------------------------------------------------+
| Workbench | Pipeline | Documents | Analytics | Journal | Board | Notes | Canvas |
+--------------------------------------------------------------------------------+
| [Card][Note][Label][Group]  [color▾][Doc▾]  [Chat 2]        [Fit] [- 100% +]    |
+--------------------------------------------------------------------------------+  [Canvas.SaveStatus] overlay: saved / saving / error
|                                                                                |
|     +------------------------+                +-------------------------+      |
|     | text node              |   relates_to   | file: 12-history.md     |      |
|     | "canvas stays plain    | -------------> | # History               |      |  [Canvas.Edge] (label editable, retargetable)
|     |  markdown, promote     |                | SPEC · Draft · 7 tasks  |      |
|     |  when ready"           |                +-------------------------+      |  [Canvas.Node] file → inline md
|     | [Send][Promote][⋮]    ◾|                                                 |
|     +------------------------+   ◾ = resize handle (bottom-right)              |
|                                                      (drag bg = pan, wheel = zoom)
+--------------------------------------------------------------------------------+
```

### Surface Map — empty / first-run state

```text
AFX Workbench / Canvas
+--------------------------------------------------------------------------------+
| [Card][Note][Label][Group]  [color▾][Doc▾]                  [Fit] [- 100% +]    |
+--------------------------------------------------------------------------------+
|                         ⌗  Empty canvas                                         |
|              Drop a thought to begin. Nothing here is required —                |
|              this is scratch space that can become specs later.                |
|              Saved as standard .canvas · openable in any JSON Canvas tool       |
+--------------------------------------------------------------------------------+
```

For a workspace without `.afx/`, the final line uses the selected workspace-local
`.canvas` path and never implies AFX setup is required. The first-run action row is
`[Add card] [Add file] [Add link] [Use starter]`; advanced architecture and AFX
commands stay available through profile switching and command search rather than
crowding the empty state.

### Progressive tool profiles

| Profile          | First-class users                        | Default surface                                                                                                                                                     | Capability behavior                                                                                             |
| ---------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| **Essentials**   | Beginners, non-AFX, general planning     | Card/text, file/image, link, group, basic connector/color, select/move/resize, undo/redo, search, fit, save/open/export, and starter templates in plain language.   | Default everywhere. No AFX capability is required; unsupported content remains a standard portable card.        |
| **Architecture** | Architects, advanced planners            | Essentials plus workspace explorer, semantic relationships, frames, alignment/distribution, palettes, legends, layout preview, minimap, rich edge/group inspectors. | Available independently of AFX; spec-specific indexing appears only when canonical specs are actually detected. |
| **AFX**          | AFX/SDD authors and workflow power users | Architecture plus Notes, Boards, Chat context, Spec/Sprint handoff, dependency refresh, Impact Lens evidence, and explicit allowlisted AFX actions.                 | Shown only when capabilities are present or explicitly requested; missing capabilities explain enablement.      |

The profile selector is a user preference, stored outside JSON Canvas content and
remembered per document/surface. It never auto-switches because a file contains AFX
metadata. Opening a canvas authored in a more advanced profile renders all content
in Essentials; advanced controls may be collapsed, but no node, edge, frame, label,
or status is hidden. Core commands and command search work in every profile.

### Surface Map — node context menu `[Canvas.NodeMenu]`

```text
text/note node selected       file node selected            label node
+----------------------+      +----------------------+      +------------------+
| Edit text            |      | Open file            |      | (inline rename)  |
| Send node to chat    |      | Send node to chat    |      | Send to chat     |
| Promote to note      |      | Drag to connect      |      | Delete           |
| Drag to connect      |      | Delete               |      +------------------+
| Delete               |      +----------------------+
+----------------------+
```

### [DES-CANVAS-INTERACTIONS] React Flow interactions

- **Progressive profiles**: Essentials, Architecture, and AFX integrations filter tool presentation through one command registry and capability matrix. Commands have stable IDs, visible disabled reasons, keyboard routes, and identical domain mutations regardless of entry point. The startup default is capability-aware: when `capabilities.afx` is detected and no profile is stored for the document, the client state upgrades to the AFX profile (state-only — `localStorage` is written only by an explicit user choice, which then persists per document). The architecture explorer mounts in every profile because it doubles as canvas search (`Ctrl+F`, "Find on canvas").
- **Universal baseline**: text/file/link/group/image-backed file authoring, connectors, color, undo/redo, search, open/save/export, external refresh, and errors work without `.afx/`, specs, Chat, Notes, Boards, or skills.
- **Library and mode**: a compact document switcher owns create/rename/duplicate/delete/open; Freeform and Spec Map change available tools, never the file format.
- **Add and organize**: node toolbar, drag/drop, multi-file picker, copy/paste, duplicate, lasso, multi-select, snap, grouping, keyboard delete, and undo/redo operate on controlled React Flow state.
- **Move and resize**: React Flow node changes and `NodeResizer` update JSON Canvas geometry through the adapter; `nodrag`, `nopan`, and `nowheel` protect embedded controls and Markdown readers.
- **Connect and inspect**: handles validate connections; reconnectable custom edges use `BaseEdge` plus the built-in bezier/straight/step/smooth-step path helpers. An edge toolbar edits route, stroke, marker, label, and color for one or many selected edges.
- **Viewport**: `Background`, `Controls`, fit view/selection, auto-pan, and an optional compact `MiniMap` are responsive. Visible-element rendering is enabled only after profiling.
- **Planning**: starter templates create ordinary editable JSON Canvas records. Next Spec previews selected nodes/relationships and the exact Chat command before sending.
- **Architecture exploration**: workspace search, filters, traversal, focus/isolate, breadcrumbs, overview/minimap, dependency diagnostics, and direct source opening remain usable without replacing the editable canvas.
- **Rich content**: spec/Markdown, image, URL, Note, and Board nodes share a loading/ready/stale/error/blocked shell. Expanded reading opens the existing owner surface; the canvas keeps only portable references and optional inert presentation metadata.
- **Composition**: low-fidelity cards and flows can graduate into presentation frames with alignment/distribution, z-order, locks, annotations, semantic shapes, palettes, legends, reusable templates, and read/present mode.
- **Auto-layout**: selection or full-canvas arrange opens a preview overlay. The user can compare, adjust options, cancel without mutation, or apply one undoable geometry transaction; pinned/manual/group geometry is protected by default.
- **AFX actions**: standard node content remains meaningful outside AFX. Namespaced actions appear as explicit overlays, never execute on load, and respect allowlists, capabilities, workspace trust, and confirmation policy.
- **Save state**: clean → dirty → saving → saved is request-correlated; error stays dirty/retryable, conflict suspends autosave, and a stale result cannot clear newer work.

## [DES-DEC] Key Decisions

<!-- @see spec.md [FR-3] [FR-4] [FR-11] [FR-20] [FR-21] [FR-24] [FR-25] [FR-26] [FR-30] [FR-31] [FR-32] [FR-33] [FR-34] [FR-35] [FR-36] [FR-37] [FR-38] [FR-40] [FR-43] [FR-44] [NFR-1] [NFR-3] [NFR-4] [NFR-8] [NFR-9] [NFR-11] [NFR-12] [NFR-13] -->

| Decision             | Options Considered                                                    | Choice                                                                          | Rationale                                                                                                                          |
| -------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Rendering engine     | Custom DOM/SVG; tldraw; React Flow                                    | **Controlled `@xyflow/react` projection**                                       | Mature graph interaction and accessibility while JSON Canvas stays authoritative; see ADR-0009.                                    |
| Storage              | Single file; hidden DB; canvas library                                | **Legacy Project Canvas + `.afx/canvases/*.canvas` + explicit workspace files** | Backward-compatible, portable, and suitable for distinct ideas, features, roadmaps, and spec maps.                                 |
| Format               | React Flow snapshot; proprietary node types; AFX-enhanced JSON Canvas | **Standard JSON Canvas core plus optional namespaced AFX metadata**             | Other tools retain readable standard content; AFX adds safe executable overlays without file-format lock-in.                       |
| Editor area          | Separate preview-like panel; custom text editor; Workbench only       | **Optional `CustomTextEditorProvider` sharing the Canvas app**                  | Native editor tab/file identity, live text-document changes, undo/save integration, and no duplicate renderer.                     |
| Persistence          | Generic fire-and-forget save; canvas-specific acknowledged save       | **Request/revision/result state machine with per-path FIFO**                    | Prevents false success, stale overwrites, tab-switch loss, and multi-instance races.                                               |
| Modes                | Separate formats/renderers; one behavior                              | **Freeform and Spec Map toolsets over one format**                              | Users can switch tools without destructive conversion; declared dependency data stays distinguishable from manual content.         |
| Dependency ownership | Canvas; Impact Lens; shared writable graph                            | **Canvas: declared spec relations; Impact Lens: computed reverse evidence**     | Avoids duplicate writable owners while allowing future reuse of the graph projection.                                              |
| Embedded content     | Copy source; direct webview fetch; host-backed references             | **Standard references plus host-mediated sanitized previews**                   | Keeps source ownership and portability while allowing rendered Markdown, local images, URL metadata, Notes, and Boards.            |
| Layout ownership     | Always automatic; always manual; previewed hybrid                     | **Manual-first, preview/apply auto-layout with pins**                           | Architecture maps need powerful reformatting without destroying intentional spatial meaning.                                       |
| Fidelity             | One generic card set; proprietary design format; standard+overlays    | **Portable JSON Canvas core plus inert presentation metadata**                  | Low/high-fidelity composition can be richer in AFX while remaining useful when extensions are ignored.                             |
| AFX actions          | Auto-run metadata; no actions; explicit overlays                      | **Allowlisted explicit actions only**                                           | A canvas file is untrusted input; standard content opens everywhere and consequential mutations require preview/confirmation.      |
| Progressive UX       | One dense toolbar; separate products; progressive profiles            | **Essentials → Architecture → AFX over one command registry**                   | Beginners get a complete general canvas while advanced/AFX depth remains discoverable without file conversion or content loss.     |
| Document lifetime    | React-local debounce; retained webview; host URI session              | **Durable host session with immediate operation staging**                       | A tab/view unmount cannot destroy the only copy of an accepted edit or its save timer; every operation receives a terminal result. |
| Reference refresh    | Raw-path cache; full eager fetch; revisioned source subscription      | **Owner/path/subpath/revision subscriptions, visible/on demand**                | Prevents stale/cross-root content, supports `.md`/`.markdown`, and keeps whole-workspace maps bounded.                             |
| Rollout              | Replace immediately; parallel permanent engines; gated migration      | **Incremental replacement behind `afx.experimental.canvas`**                    | Persistence and adapter parity can be proven before deleting custom interaction code.                                              |

## [DES-DATA] Data Model

<!-- @see spec.md [FR-4] [FR-13] [FR-18] [FR-20] [FR-24] [FR-25] [FR-26] [FR-28] [FR-30] [FR-31] [FR-33] [FR-34] [FR-35] [FR-36] [FR-37] [FR-38] [FR-39] [FR-40] [FR-41] [FR-43] [FR-44] [NFR-3] [NFR-8] [NFR-11] [NFR-13] -->

The authoritative document is JSON Canvas 1.0. React Flow node/edge objects are
derived view models and are never persisted directly. The shared types retain
the standard records and permit unknown fields so AFX can round-trip documents
from other tools.

```typescript
export type CanvasColor = string; // preset "1".."6" OR hex "#rrggbb"
export type CanvasExtensionFields = Record<string, unknown>; // round-trip carrier for unknown fields

export interface CanvasGenericNode extends CanvasExtensionFields {
  id: string;
  type: "text" | "file" | "link" | "group";
  x: number;
  y: number;
  width: number;
  height: number;
  color?: CanvasColor;
}
export interface CanvasTextNode extends CanvasGenericNode {
  type: "text";
  text: string; // markdown, stored inline
  afxNodeKind?: "note" | "label"; // AFX extension field — round-trips losslessly (FR-18)
}
export interface CanvasFileNode extends CanvasGenericNode {
  type: "file";
  file: string; // workspace-relative path
  subpath?: string; // optional "#heading"
}
export interface CanvasLinkNode extends CanvasGenericNode {
  type: "link";
  url: string;
}
export interface CanvasGroupNode extends CanvasGenericNode {
  type: "group";
  label?: string;
  background?: string;
  backgroundStyle?: "cover" | "ratio" | "repeat";
}
export type CanvasNode = CanvasTextNode | CanvasFileNode | CanvasLinkNode | CanvasGroupNode;

export interface CanvasEdge extends CanvasExtensionFields {
  id: string;
  fromNode: string;
  fromSide?: "top" | "right" | "bottom" | "left";
  fromEnd?: "none" | "arrow";
  toNode: string;
  toSide?: "top" | "right" | "bottom" | "left";
  toEnd?: "none" | "arrow";
  color?: CanvasColor;
  label?: string;
}
export interface JSONCanvas extends CanvasExtensionFields {
  nodes?: CanvasNode[];
  edges?: CanvasEdge[];
}

export interface AfxCanvasMetadata {
  afxSchemaVersion?: 1;
  afxCanvasKind?: "freeform" | "spec-map";
  afxPresentation?: { title?: string; palette?: string; frameOrder?: string[] };
}
export interface AfxCanvasNodeMetadata {
  afxNodeKind?: "note" | "label" | "spec" | "board" | "architecture" | "frame";
  afxSource?: {
    kind: "spec" | "file" | "image" | "url" | "note" | "board";
    path?: string; // portable path relative to the owning workspace root
    workspaceRootHint?: string; // optional logical folder name; never an absolute machine URI
    subpath?: string;
    url?: string;
  };
  afxStyle?: {
    shape?: string;
    border?: string;
    opacity?: number;
    icon?: string;
    textRole?: string;
  };
  afxLayout?: { pinned?: boolean; rank?: number; lane?: string };
  afxFrame?: { collapsed?: boolean; presentationOrder?: number };
}
export interface AfxCanvasEdgeMetadata {
  afxEdgeStyle?: {
    route?: "bezier" | "straight" | "step" | "smoothstep";
    stroke?: "solid" | "dashed" | "dotted";
  };
  afxEdgeOrigin?: "manual" | "declared-dependency";
  afxDependency?: { sourcePath: string; targetPath: string };
  afxDetachedDependency?: { sourcePath: string; targetPath: string }; // suppress regenerated duplicate
}
export interface AfxCanvasAction {
  version: 1;
  kind: "open" | "chat" | "note" | "spec" | "sprint" | "afx-command";
  command?: string; // allowlisted and never executed automatically
}
export interface CanvasDescriptor {
  id: string;
  path: string;
  name: string;
  kind: "freeform" | "spec-map";
  workspaceFolder: string;
  revision: string;
  updatedAt?: string;
  legacy?: boolean;
}
export interface CanvasDocumentSnapshot {
  descriptor: CanvasDescriptor;
  content: string;
  exists: boolean;
  dirtySource: boolean;
  valid: boolean;
}
export interface CanvasLibraryPayload {
  items: CanvasDescriptor[];
  activePath?: string;
  activeDocument?: CanvasDocumentSnapshot;
}
export type CanvasToolProfile = "essentials" | "architecture" | "afx";
export interface CanvasClientViewState {
  profile: CanvasToolProfile; // user preference; never serialized into JSON Canvas
  mode: "freeform" | "spec-map";
  viewport: { x: number; y: number; zoom: number };
  selectedIds: string[];
}
export interface CanvasReferenceKey {
  ownerRootId: string; // protocol/session identity only; not persisted in the canvas
  path: string;
  subpath?: string;
}
export interface CanvasReferenceSnapshot {
  key: CanvasReferenceKey;
  revision: string;
  state: "loading" | "ready" | "stale" | "missing" | "blocked" | "error";
  content?: string;
}
```

### Lossless round-trip rule

`@afx/canvas-engine` parses with a permissive schema that **preserves every
unknown field**. Standard records remain readable when all `afx*` fields are
ignored. AFX validates action metadata separately and treats it as untrusted;
parse/import/external refresh cannot execute an action. Adapter tests project to
React Flow and back before serialization, including parallel edges and absolute
group geometry. Render caches, fetched URL metadata, and derived spec/Board/Note
summaries are transient host state; they are never required to understand the
standard `file`, `link`, `text`, or `group` record. Optional `afx*` presentation,
layout, and provenance fields remain inert in other JSON Canvas tools.

### Durable document and view-state ownership

`CanvasDocumentService` owns one durable session per canonical canvas URI. The
session retains the latest accepted JSON Canvas content, session/sequence cursor,
revision, pending result set, save scheduling, last-valid external snapshot, and
conflict even when no Workbench tab or editor webview is mounted. Each completed
semantic mutation sends an `afxCanvasEdit` immediately; for continuous geometry,
drag/resize changes stay visual during the gesture and publish at gesture end. The
host applies the first open-`TextDocument` edit immediately and coalesces disk-only
Workbench persistence for 650 ms, never leaving the only queued copy in React-local
state. It emits exactly one success/superseded/conflict/error result per sequence
and broadcasts the authoritative revision.

`CanvasDocumentClient` projects that session into React Flow and owns only
surface-local viewport, selection, open inspectors, minimap visibility, and input
drafts that cannot yet form a domain operation. The host stores per-document
profile/mode/viewport preferences independently from JSON Canvas bytes. Switching
documents restores the correct named identity and state; same-document external
replacement explicitly rebases compatible ID-based history or clears invalid
entries with a visible explanation.

Pure `@afx/canvas-engine` reducers apply ID-based node/edge changes, reconnect,
style, template, dependency refresh/detach, layout, and AFX-action metadata before
the client serializes the resulting portable document into the edit envelope.
Detaching a generated dependency creates a new manual edge ID and a namespaced
suppression key; refresh consumes that declaration as detached and cannot emit a
second edge with the generated ID.

### Referenced-content identity and lifetime

The persisted file/link record stays portable. At runtime the host resolves it to
`CanvasReferenceKey(ownerRootId, path, subpath)`. A content snapshot is valid only
for the matching key and source revision; request IDs reject late responses. The
client subscribes when a node is visible, expanded, selected for context, or
explicitly previewed, and unsubscribes when those reasons disappear. Metadata may
remain in a bounded LRU, but full Markdown/image payloads are never fetched eagerly
for every node in a whole-workspace graph. Both `.md` and `.markdown` share the
Markdown renderer. Generated cross-root nodes always use their own resolved owner,
never the active canvas owner's root, for fetch, preview, and Open Source.

### Example `.afx/project.canvas`

```json
{
  "nodes": [
    {
      "id": "n-thought-1",
      "type": "text",
      "text": "Canvas stays plain markdown — promote when ready.",
      "x": 0,
      "y": 0,
      "width": 320,
      "height": 160,
      "color": "5"
    },
    {
      "id": "n-file-history",
      "type": "file",
      "file": "docs/specs/229-app-workbench-canvas/spec.md",
      "x": 420,
      "y": -20,
      "width": 420,
      "height": 280,
      "color": "6"
    }
  ],
  "edges": [
    {
      "id": "e-1",
      "fromNode": "n-thought-1",
      "fromSide": "right",
      "toNode": "n-file-history",
      "toSide": "left",
      "toEnd": "arrow",
      "label": "relates_to"
    }
  ]
}
```

## [DES-API] API Contracts

<!-- @see spec.md [FR-11] [FR-12] [FR-15] [FR-16] [FR-19] [FR-20] [FR-24] [FR-26] [FR-30] [FR-31] [FR-32] [FR-34] [FR-35] [FR-36] [FR-37] [FR-40] [FR-42] [FR-43] [FR-44] -->

### Workbench bridge (`packages/shared/src/workbench-protocol.ts`)

```typescript
type CanvasMutation =
  | {
      type: "afxCanvasCreate";
      requestId: string;
      root: string;
      name: string;
      kind: CanvasKind;
      template: CanvasTemplate;
    }
  | {
      type: "afxCanvasRename";
      requestId: string;
      path: string;
      name: string;
      expectedRevision: string;
    }
  | {
      type: "afxCanvasDuplicate";
      requestId: string;
      path: string;
      name: string;
      expectedRevision: string;
    }
  | { type: "afxCanvasDelete"; requestId: string; path: string; expectedRevision: string }
  | {
      type: "afxCanvasEdit";
      requestId: string;
      sessionId: string;
      sequence: number;
      documentId: string;
      baseRevision: string;
      content: string;
    };

type CanvasCommand =
  | { type: "afxCanvasAttachClient"; documentId: string; clientId: string }
  | { type: "afxCanvasDetachClient"; documentId: string; clientId: string }
  | { type: "afxCanvasSelect"; path: string }
  | { type: "afxOpenCanvasEditor"; path: string }
  | { type: "afxPickCanvasFiles"; canSelectMany: true }
  | {
      type: "afxCanvasSetClientPreferences";
      documentId: string;
      clientId: string;
      profile: CanvasToolProfile;
      mode: "freeform" | "spec-map";
    }
  | {
      type: "afxCanvasRefreshDependencies";
      requestId: string;
      path: string;
      expectedRevision: string;
    }
  | { type: "afxCanvasIndexWorkspace"; requestId: string; roots: string[] }
  | {
      type: "afxCanvasSubscribeReferences";
      requestId: string;
      documentId: string;
      references: CanvasReferenceKey[];
    }
  | {
      type: "afxCanvasUnsubscribeReferences";
      documentId: string;
      references: CanvasReferenceKey[];
    }
  | { type: "afxCanvasFetchPreview"; requestId: string; source: CanvasPreviewSource }
  | { type: "afxCanvasOpenAttachment"; source: "note" | "board" | "file"; path: string }
  | {
      type: "afxCanvasExport";
      requestId: string;
      path: string;
      scope: "all" | "viewport" | "selection" | "frame";
      format: "png" | "canvas";
    };

type WorkbenchInbound =
  | { type: "afxUpdate"; canvasEnabled?: boolean; canvasLibrary?: CanvasLibraryPayload }
  | {
      type: "afxCanvasDocumentChanged";
      document: CanvasDocumentSnapshot;
      reason: "buffer" | "save" | "external";
    }
  | {
      type: "afxCanvasEditResult";
      requestId: string;
      sessionId: string;
      sequence: number;
      documentId: string;
      status: "success" | "superseded" | "conflict" | "error";
      revision?: string;
      message?: string;
    }
  | {
      type: "afxCanvasReferenceSnapshot";
      requestId?: string;
      documentId: string;
      snapshot: CanvasReferenceSnapshot;
    }
  | {
      type: "afxCanvasPreviewResult";
      requestId: string;
      status: "success" | "error" | "blocked";
      preview?: CanvasPreviewPayload;
      message?: string;
    }
  | {
      type: "afxCanvasArchitectureIndex";
      requestId: string;
      graph: SpecDependencyGraph;
      revision: string;
    }
  | { type: "afxCanvasFilesPicked"; filePaths: string[] };
```

All mutating messages resolve exactly once. Library lifecycle operations compare
`expectedRevision`. Canvas edits form an immediate typed stream keyed by
`documentId` + `sessionId`, ordered by `sequence`, and guarded by `baseRevision`.
The host keeps the latest content per document/session, reports older queued edits
as `superseded`, and a result from an older sequence cannot clear newer pending
work. For an open `TextDocument`, the first edit is applied immediately through
VS Code's document model; disk-only Workbench edits are host-coalesced for 650 ms.
The queue and timer survive React unmount, and panel/editor disposal flushes or
secures the latest edit before releasing the session. Continuous geometry changes
publish one edit at gesture completion rather than flooding the stream.

Reference snapshots are correlated by `documentId`, request ID when present,
`CanvasReferenceKey`, and source revision. A snapshot with the wrong owner/path/
subpath or an older revision is ignored. The legacy raw-path `afxDocContent`
message is removed only after every Canvas consumer has migrated; it is never a
fallback for cross-root generated nodes.

Layout is a pure client/domain operation over an immutable geometry snapshot:
`prepareLayout(canvas, selection, strategy, options)` returns proposed integer
geometry and diagnostics; `applyLayout(previewId)` commits the exact preview as
one history entry. Content preview and export requests are separately correlated,
cancelable, and never mutate the JSON Canvas document as a side effect.

### Settings bridge (`packages/shared/src/messages.ts`) — FR-22

```text
SettingsExperimentalSnapshot { canvasEnabled: boolean; canvasPath: string; workbenchHiddenViews: WorkbenchViewId[] }
ChatToAgent (webview → host):  experimental/setCanvasEnabled { requestId, enabled }   // flip afx.experimental.canvas
                               experimental/setWorkbenchHiddenViews { requestId, hidden } // bottom-panel tab visibility
                               chat/openWorkbench { requestId }                       // "Open Workbench" button
chat/openSettings key union includes "afx.experimental.canvas"                        // deep-link the VS Code setting
```

## [DES-HOST] Extension Host Service

<!-- @see spec.md [FR-3] [FR-11] [FR-12] [FR-19] [FR-20] [FR-24] [FR-26] [FR-30] [FR-31] [FR-32] [FR-34] [FR-35] [FR-36] [FR-37] [FR-40] [FR-42] [FR-43] [FR-44] [NFR-2] [NFR-4] [NFR-5] [NFR-9] [NFR-12] [NFR-13] -->

`CanvasLibraryService` is URI-first and receives every workspace folder. It
discovers the legacy path, AFX canvas directories, and explicitly opened local
files; protects create/rename/delete collisions; and produces shortest-unique
labels without discarding root identity.

`CanvasDocumentService` subscribes to `WorkbenchFileState`. Reads prefer an open
`TextDocument.getText()` overlay and otherwise use `workspace.fs`. It stores the
last valid parsed document separately from raw content so temporarily invalid
JSON typed in a text editor shows an error without erasing the visible graph. A
canonical-URI session owns accepted operations and save scheduling independently
of webview lifetime; `retainContextWhenHidden` is not a data-safety mechanism.

`WorkbenchMutationCoordinator` serializes by canonical URI, checks revision and
dirty-buffer state, validates workspace containment, writes, then emits one
terminal result and confirmed snapshot. File events are revisions, not
single-content echo flags, so several canvases and editor instances remain safe.

`AfxCanvasEditorProvider` registers an optional custom text editor for
`*.canvas`. It opens explicitly through `vscode.openWith`; the contribution does
not forcibly replace other JSON Canvas editors. The provider loads the same
Workbench bundle with `data-afx-view="canvas-editor"`, sends the document URI and
snapshot, observes TextDocument changes, and routes edits through the shared
document/mutation services. Workbench and editor views never own separate file
stores.

### [DES-CANVAS-DOCUMENT-SERVICE] Document ownership

One `CanvasDocumentService` session exists per canonical URI. It owns the open
`TextDocument`, per-document/session latest-wins edit queue, sequence cursor, save
timer, last clean disk fingerprint, last valid parsed snapshot, mode/profile
preferences, and attached Workbench/editor clients. All accepted content edits
are applied through `WorkspaceEdit`, so native dirty state,
Save/Save All, undo, redo, revert, auto-save, hot exit, and text-editor edits
remain part of VS Code's document model. Host save timers survive React
unmounts and tab switches.

`WorkspaceArchitectureIndex` incrementally indexes canonical four-file spec
frontmatter, single-document Sprint frontmatter, and declared dependencies across
every workspace root, keyed by stable URI. It paginates or streams explicit totals
instead of silently truncating a fixed candidate list. It publishes searchable
graph revisions and consumes optional Impact Lens evidence read-only.
`CanvasReferenceService` resolves visible/on-demand file-backed spec/Markdown,
image, Note, and Board sources from open buffers first; URL metadata is fetched
only through the host with scheme, redirect, response-size, MIME, timeout, and
cache limits. `CanvasLayoutService` owns optional worker execution and cancellation
but returns geometry proposals only; the document controller owns apply/undo.

Library creation (`canvas-library-service.ts create`) writes
`.afx/canvases/<slug>.canvas` by default. When the webview sends
`pickLocation: true` (New-canvas dialog checkbox), the host shows a native
folder picker anchored at the workspace root: a dismissal returns the
`cancelled` mutation code (rendered as a quiet no-op, not an error banner), a
folder outside every workspace root returns `outside-workspace`, and a valid
pick creates `<picked>/<slug>.canvas` through the same collision-guarded
`requireMissing` coordinator write (FR-3). Discovery lists such files as
`external` kind.

Both hosts serve the library. The Workbench panel switches its own document in
place; the editor host (`canvas-editor-provider.ts`) is bound to one
TextDocument, so it maps the same operations to editor-tab semantics:
create/duplicate/select open their result via `vscode.openWith` as a separate
`afx.canvasEditor` tab (the switcher then snaps back to the tab's own
document), rename opens the renamed file and disposes the stale tab, and
delete disposes the tab whose backing file was removed.

### Release-foundation repair contract

The advanced Phase 17 program cannot begin until these observable contracts pass:

1. A completed semantic mutation leaves the webview immediately as a typed
   `afxCanvasEdit` carrying document/session/sequence/base revision and serialized
   portable content; continuous geometry publishes at gesture completion. The
   durable document session owns latest-wins coalescing (650 ms only for disk-only
   Workbench persistence); tab switch/hide, editor close, provider disposal, or
   React unmount cannot erase the latest edit, and disposal flushes/secures it.
2. There is no fire-and-forget compatibility path that clears dirty state without
   a matching terminal result. Success, superseded, conflict, and error outcomes
   are request/session/sequence-correlated and remain inspectable.
3. Reference content is subscribed by target-node owner/root, portable path,
   subpath, and revision. Manual `.md`/`.markdown` changes invalidate only matching
   consumers; late and cross-root payloads cannot overwrite another card.
4. Spec discovery covers both canonical artifact shapes in all roots and reports
   totals, duplicates, parse failures, unresolved targets, cycles, and any applied
   operational limit. Generated nodes retain their own source identity for preview
   and Open Source.
5. Dependency refresh is a pure idempotent reconciliation. Detach allocates a fresh
   manual ID and durable suppression/provenance; repeated refresh cannot recreate a
   duplicate generated edge ID or remove manual geometry/style.
6. Document-keyed history, mode, profile, title, viewport, selection, and pending
   state do not leak between named canvases. Same-document external replacement
   rebases compatible ID operations or invalidates history explicitly.
7. The universal capability-off path and React Flow authoring parity are release
   gates, including node color, link author/open, group label/background, multi-file
   insertion, and selected-set Chat where AFX is available.

### [DES-CANVAS-EDITOR-AREA] Editor-area integration

`AfxCanvasEditorProvider` implements `CustomTextEditorProvider` with view type
`afx.canvasEditor`, selector `*.canvas`, and `priority: "option"`. The provider
is registered during extension activation; when the experiment is disabled it
shows an enable/open-settings state instead of claiming the file. The explicit
command uses `vscode.openWith` and the Workbench bundle boots with
`data-afx-view="canvas-editor"`. Canonical content never lives in webview state
and `retainContextWhenHidden` stays disabled.

### [DES-CANVAS-MULTI-INSTANCE] Shared document, local view state

Workbench plus any number of split editor instances subscribe to the same URI
session and receive every authoritative document revision. Selection, viewport,
open inspectors, and minimap visibility are local to each webview; their last
values may be restored from host preferences. Closing one client cannot dispose
another or discard staged work; closing the last client releases heavy render
subscriptions only after pending operations and hot-exit/save state are secured.
Different files have independent queues, dirty state, save timers, conflicts,
history, mode, profile, title, and draft state.

### [DES-CANVAS-DIRTY-CONFLICT] Manual edit and conflict rules

`TextDocument.version` identifies an open document revision and a content hash
identifies the last clean disk revision. A clean manual change broadcasts
immediately. If a newer disk revision appears while the document is dirty or a
mutation is pending, autosave is suspended and the surface offers Reload from
Disk or Open as Text; AFX never silently force-overwrites. Temporarily malformed
JSON retains the last valid graph and exposes the raw parse error until a valid
revision arrives.

If a valid external replacement arrives for the same document, the session
rebases only history operations whose target IDs and preconditions remain valid.
Incompatible undo/redo entries are removed as one explicit history-reset event;
they are never replayed onto unrelated external content. A dirty/pending session
still enters conflict and does not auto-rebase.

### [DES-CANVAS-PROTOCOL] Canvas client protocol

Canvas messages use host-issued `documentId`, `clientId`, `requestId`, and
session identity; arbitrary webview write paths are not accepted. Pure client
reducers consume React Flow changes, then publish a typed `afxCanvasEdit` envelope
with monotonic `sequence`, `baseRevision`, and serialized portable content. The
host returns one `success`, `superseded`, `conflict`, or `error` result and
broadcasts the authoritative snapshot/save state. Only the newest compatible
sequence may clear dirty state; conflict requires refresh or explicit resolution.

Client attach returns capability flags and the last per-document client
preferences. Profiles gate command presentation, not protocol authority: the host
still validates every operation by workspace trust and capability. Reference
subscriptions are reason-counted (`visible`, `expanded`, `context`, `preview`),
cancel when the final reason is removed, and deliver only matching revisioned
snapshots.

## [DES-SETTINGS] Chat Settings Experimental Surface

<!-- @see spec.md [FR-1] [FR-22] [FR-24] [FR-32] -->

Chat Settings owns presentation of the Canvas feature flag and Workbench view
visibility; `214-app-chat-settings` remains the canonical Settings owner.

- Canvas enablement is independent from Workbench Canvas-tab visibility. A
  hidden tab does not disable `Open in Canvas Editor` or remove canvas files.
- The path hint explains the legacy Project Canvas and plural
  `.afx/canvases/` library instead of presenting one immutable path as the
  complete model.
- Experimental mutation tracking uses request IDs and rolls optimistic state
  back on failure.
- The eight Workbench view switches persist one workspace-scoped
  `afx.experimental.workbenchHiddenViews` set. If all are hidden, Workbench renders
  a recovery surface rather than a blank panel.

> **214 dual-anchor:** the Settings Experimental group is owned by `214-app-chat-settings` [FR-14] (the settings surface) and the canvas feature by `229-app-workbench-canvas` [FR-22]. The three settings files dual-anchor both.

## [DES-FILES] File Structure

<!-- @see spec.md [FR-1] [FR-3] [FR-22] [FR-24] [FR-26] [FR-32] [FR-34] [FR-35] [FR-36] [FR-37] [FR-40] [FR-42] [DES-ARCH] -->

| File                                                                               | Purpose                                                                             |
| ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `apps/workbench/src/views/canvas.tsx`                                              | Thin Workbench route mounting shared `CanvasApp`                                    |
| `apps/workbench/src/views/canvas-editor.tsx`                                       | Editor-area boot target mounting shared `CanvasApp`                                 |
| `apps/workbench/src/components/canvas/canvas-app.tsx`                              | Shared library/mode/document shell                                                  |
| `apps/workbench/src/components/canvas/react-flow-canvas.tsx`                       | Controlled React Flow viewport and interactions                                     |
| `apps/workbench/src/components/canvas/nodes/*`                                     | Memoized AFX text/file/link/group node renderers                                    |
| `apps/workbench/src/components/canvas/edges/*`                                     | Custom edge renderer, toolbar, inspector, reconnect                                 |
| `apps/workbench/src/components/canvas/canvas-library.tsx`                          | Multi-document switcher and lifecycle UI                                            |
| `apps/workbench/src/components/canvas/planning-guide.tsx`                          | Ideas/feature/roadmap/next-spec starters and handoff                                |
| `apps/workbench/src/components/canvas/spec-map-tools.tsx`                          | Dependency import, issues, refresh, detach                                          |
| `apps/workbench/src/components/canvas/architecture-explorer.tsx`                   | Whole-workspace search, filters, traversal, focus/isolate                           |
| `apps/workbench/src/components/canvas/nodes/{spec,image,url,note,board}-node.tsx`  | Rendered portable-reference node variants                                           |
| `apps/workbench/src/components/canvas/layout-preview.tsx`                          | Auto-layout strategy/options comparison, apply/cancel                               |
| `packages/canvas-engine/src/{layout,style,frames}.ts`                              | Pure layout proposals and portable presentation mutations                           |
| `apps/workbench/src/hooks/use-canvas-document.ts`                                  | Revision/pending/conflict/history controller                                        |
| `packages/canvas-engine/src/{json-canvas,mutations,reducer,revision}.ts`           | Framework-neutral lossless model and ID-based reducer                               |
| `apps/workbench/src/lib/json-canvas-react-flow.ts`                                 | Pure JSON Canvas ↔ React Flow projection                                            |
| `apps/vscode/src/services/workbench-file-state.ts`                                 | Open-buffer/disk snapshots and revisions                                            |
| `apps/vscode/src/services/workbench-mutation-coordinator.ts`                       | Per-path ordered acknowledged mutations                                             |
| `apps/vscode/src/services/canvas-library-service.ts`                               | Discovery and lifecycle operations                                                  |
| `apps/vscode/src/services/canvas-document-service.ts`                              | Shared live document state and last-valid parsing                                   |
| `apps/vscode/src/services/spec-dependency-indexer.ts`                              | Canonical `depends_on` graph                                                        |
| `apps/vscode/src/services/canvas-reference-service.ts`                             | Revisioned visible/on-demand file/image/Note/Board source subscriptions             |
| `apps/vscode/src/services/canvas-content-preview-service.ts`                       | Sanitized URL metadata and expanded preview requests                                |
| `apps/vscode/src/services/workspace-architecture-index.ts`                         | Incremental whole-workspace topology                                                |
| `apps/vscode/src/editors/canvas-editor-provider.ts`                                | Optional custom text editor provider                                                |
| `packages/shared/src/{workbench-types,workbench-protocol,messages}.ts`             | Library, document, mutation, Settings, and editor contracts                         |
| `apps/chat/src/{views/settings.tsx,lib/settings-copy.ts,lib/settings-snapshot.ts}` | Canvas flag and Workbench view visibility                                           |
| `apps/vscode/package.json`                                                         | Canvas/custom-editor/settings contributions; JSON traceability lives in this design |
| `NOTICE`, `THIRD_PARTY_NOTICES.md`                                                 | Open-source attribution and shipped third-party licenses                            |

## [DES-DEPS] Dependencies

<!-- @see spec.md [FR-40] [NFR-1] [NFR-3] [NFR-10] -->

- `@xyflow/react` is the required graph interaction dependency.
- `@dagrejs/dagre` is optional only if measured dependency-map arrange behavior
  is approved; otherwise the first release uses deterministic placement without
  another runtime dependency.
- ELK, Dagre, and an in-house deterministic layout are benchmark candidates for
  the north-star compound/pinned-node layout matrix; no new engine is selected
  until Open Question 11 is resolved with bundle, license, worker, and stress data.
- Existing React, `@afx/ui`, Lucide, `MinimalMarkdown`, and `@afx/shared` remain.
- Every shipped dependency must pass the license allowlist, bundle-size gate,
  and NOTICE/third-party attribution generation before release.

## [DES-SEC] Security Considerations

<!-- @see spec.md [FR-7] [FR-20] [FR-30] [FR-33] [FR-35] [FR-36] [FR-37] [FR-42] [NFR-5] [NFR-8] [NFR-9] -->

- Every path resolves to a canonical URI inside an explicit workspace root;
  absolute outside-workspace and traversal targets are rejected.
- The webview never reads files directly. Inline Markdown uses the existing
  sanitized renderer. Local images use host-issued webview URIs and MIME/size
  validation; unsupported content remains a non-executing file card.
- URL previews allow only `https`/`http`, cap redirects/time/bytes, sanitize
  extracted metadata, never load returned HTML as a document, never run scripts,
  and keep navigation behind an explicit Open URL action. CSP forbids arbitrary
  frames and remote execution.
- Canvas action metadata is untrusted. Only versioned allowlisted action kinds
  render; no action executes on parse/open/refresh; workspace trust and host
  capability are checked; consequential commands show exact context and confirm.
- Dependency refresh reads declared metadata but cannot rewrite a spec.
- Custom-editor CSP, nonce, local-resource roots, and command routing match the
  hardened preview/webview boundary.

## [DES-ERR] Error Handling

<!-- @see spec.md [FR-11] [FR-12] [FR-20] [FR-24] [FR-26] [FR-30] [FR-31] [FR-32] [FR-33] [FR-34] [FR-35] [FR-36] [FR-37] [FR-40] [FR-42] [FR-43] [FR-44] -->

| Scenario                              | Handling                                                                                                                     |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Missing canvas                        | Project Canvas opens empty; named creation writes only after collision-safe host confirmation.                               |
| Temporarily malformed manual JSON     | Retain last valid graph, show raw-source error and Open Text action, suspend autosave, and accept the next valid revision.   |
| Save failure                          | Keep dirty state/content/history, show error and Retry/Open Source; never acknowledge saved.                                 |
| Newer manual edit while clean         | Apply the latest snapshot to all Workbench/editor consumers and preserve view-local viewport where possible.                 |
| Newer manual edit while dirty/pending | Suspend autosave and show Reload External / Keep Local; Keep Local retries only against the new explicit base revision.      |
| Stale acknowledgement                 | Ignore it for state-clearing purposes; log diagnostic correlation only.                                                      |
| Last view closes with staged work     | Durable URI session retains the operation/timer and hands unsaved state to VS Code hot exit; no React cleanup clears it.     |
| Stale/cross-root reference response   | Reject by document/key/revision; retain the matching prior card state and request the current owner source if still visible. |
| Library collision/missing path        | Return one error result; do not overwrite/delete/rebind; keep dialog input available.                                        |
| Unresolved/cyclic dependency          | Render an issue node/edge state and source action; refresh remains idempotent and never removes manual content.              |
| Duplicate generated/detached edge     | Reject duplicate IDs, retain the manual edge, record a diagnostic, and recompute from declaration + detach suppression.      |
| Invalid/untrusted AFX action          | Render inert explanatory UI; never send a host command.                                                                      |
| AFX capability unavailable            | Keep universal controls active; hide or disable only the dependent command with a reason and Settings/recovery action.       |
| Missing/unsupported preview source    | Keep the portable file/link card, show precise blocked/error state, and offer Open Source/Open URL where safe.               |
| Remote URL timeout/redirect/MIME fail | Cancel the bounded request, do not cache attacker-controlled HTML, and show a retryable metadata-preview error.              |
| Auto-layout failure/cancel            | Leave document/history unchanged; retain the prior preview options and explain unsupported compound constraints.             |
| Workspace graph superseded            | Discard stale index results by revision; keep current canvas and manual relationships intact.                                |
| Canvas tab hidden                     | Preserve files and editor-area capability; if all Workbench views are hidden, show Settings recovery.                        |

## [DES-TEST] Testing Strategy

<!-- @see spec.md [FR-4] [FR-11] [FR-12] [FR-13] [FR-18] [FR-20] [FR-24] [FR-26] [FR-28] [FR-29] [FR-30] [FR-31] [FR-32] [FR-33] [FR-34] [FR-35] [FR-36] [FR-37] [FR-38] [FR-39] [FR-40] [FR-41] [FR-42] [FR-43] [FR-44] [NFR-1] [NFR-3] [NFR-4] [NFR-6] [NFR-7] [NFR-8] [NFR-9] [NFR-10] [NFR-11] [NFR-12] [NFR-13] -->

| Layer                | Required proof                                                                                                                                                                                                                                   |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Format/adapter       | Standard and Obsidian-compatible fixtures; unknown fields; all node types; z-order; groups; links; parallel edges; extension-ignore readability; JSON Canvas → React Flow → JSON Canvas property fixtures.                                       |
| State machine        | Immediate stage + delayed persistence, tab switch/view unmount/editor close/hot exit, pending save, failure/retry, stale result, external conflict, per-document history/profile/mode/title, history rebase/reset, invalid-manual-JSON recovery. |
| Host                 | Open-buffer overlay, saved/external watcher, latest-wins scans, stable URI session after last-client detach, multi-root node owner paths, containment, FIFO mutations, collision lifecycle, custom-editor multi-instance.                        |
| References           | Owner/path/subpath/revision cache key, `.md` + `.markdown`, visible/on-demand subscribe/cancel, manual invalidation, stale/cross-root response rejection, bounded payload/cache diagnostics.                                                     |
| Dependencies/actions | Four-file + Sprint discovery across roots with explicit totals; resolved/unresolved/duplicate/cycle; repeated idempotent refresh/detach/manual preservation/fresh IDs; allowlist/trust/confirmation and never-auto-run tests.                    |
| React Flow           | Parity authoring for color/link/group/multi-file/multi-chat; lasso, pointer/touch/keyboard selection, reconnect, resize, edge routes/strokes/markers, fit, snap, auto-pan, controls/minimap, focus restoration, reduced motion.                  |
| Profiles             | Essentials capability-off beginner script, Architecture depth script, AFX capability matrix, non-mutating profile switches, command search, hidden-control readability, narrow/touch/keyboard coverage.                                          |
| E2E                  | Mocked bridge plus real extension-host immediate tab switch, editor close/hot exit, stale/failure retry, named/multi-root canvases, cross-root preview/open, external `.markdown`, repeated detach/refresh, packaged VSIX.                       |
| Performance/release  | 150 nodes/200 edges interaction trace, bundle size, license allowlist, NOTICE/third-party notices, full verify/E2E/security gates.                                                                                                               |
| North-star content   | Rendered spec/Markdown, general file, local image, URL metadata, Notes, and Boards across ready/loading/stale/error/blocked/manual-edit states.                                                                                                  |
| North-star scenarios | Whole-workspace architecture, low/high fidelity, palettes, frames, nested groups, rich connector matrix, layout preview/cancel/apply/undo, export, 360 px/editor/desktop visual captures.                                                        |
| Push limits          | Mixed-content 1,000-node/2,000-edge fixture, complete practical React Flow interaction matrix, incremental graph refresh, layout cancellation, memory/paint/input traces, deterministic re-open.                                                 |

## [DES-ROLLOUT] Migration / Rollout Plan

<!-- @see spec.md [FR-3] [FR-11] [FR-20] [FR-21] [FR-24] [FR-26] [FR-30] [FR-31] [FR-32] [FR-33] [FR-43] [FR-44] [NFR-1] [NFR-3] [NFR-4] [NFR-12] [NFR-13] -->

1. Land the durable URI document session and acknowledged operation protocol; prove
   no loss on tab switch, unmount, editor close, hot exit, stale result, and failure.
2. Replace raw-path preview caching and incomplete spec discovery with revisioned
   reference subscriptions, four-file + Sprint multi-root indexing, and idempotent
   dependency detach/refresh before advanced features.
3. Build the lossless adapter and React Flow parity behind the existing flag;
   keep the custom renderer available only until fixture and interaction gates pass.
4. Add the library and editor-area provider without moving `.afx/project.canvas`.
5. Establish Essentials as the complete capability-off default, then add
   Architecture and AFX tool profiles over the same command registry/document.
6. Add Freeform/Spec Map tools, planning starters, dependencies, actions, and edge inspector.
7. Remove the custom interaction implementation after parity, conflict, E2E,
   accessibility, performance, and interoperability approval.
8. Keep `afx.experimental.canvas` default false during heavy dogfooding. Workbench
   tab visibility is independent; editor-area opening remains explicit.
9. Before packaging, update NOTICE and standard third-party notices for React
   Flow and every added shipped dependency, include license details, run the
   license allowlist/security gate, and verify the files are included in the VSIX.
10. Treat whole-workspace architecture, rich rendered attachments, low/high
    fidelity composition, and auto-layout as a post-2.4.0 north-star program.
    Land it in independently reviewable phases; do not relabel current 2.4.0
    evidence as proof of FR-34–FR-44.

## [DES-CANVAS-PRO] Pro Canvas Identity, Toolbar & Live Semantics

<!-- @see spec.md [FR-45] [FR-46] [FR-47] [FR-48] [FR-49] [FR-50] [FR-51] [NFR-7] [NFR-11] [NFR-12] -->

The 2.4.x visual/UX upgrade layers identity and live semantics onto the React Flow projection without touching document bytes.

### Toolbar clusters (FR-45)

`react-flow-canvas.tsx` renders one toolbar composed of separator-divided clusters, in order: **history** (undo, redo) · **clipboard** (copy, paste, duplicate — each with a distinct lucide icon: `Copy`, `ClipboardPaste`, `CopyPlus`) · **insert** (add node, delete selection) · **view** (zoom out, live percentage button that resets to 100%, zoom in, fit, snap, minimap) · **tools** (architecture explorer, layout, composition, presentation) · **export**. Every `ToolButton` tooltip appends the shortcut hint when one exists (`⌘Z`, `⇧⌘Z`, `⌘C`, `⌘V`, `⌘D`, `F`, `Delete`) and mirrors it via `aria-keyshortcuts`. A selection chip (`N selected · Clear`) appears after the insert cluster when nodes or edges are selected. The zoom readout subscribes to viewport changes via `useStore`; clicking it sets zoom to 1.0 about the viewport center. Overflow behavior (horizontal scroll at narrow widths) and the ≥920 px label mode are unchanged.

### Annotation nodes (FR-46)

`afxNodeKind: "annotation"` joins `"note" | "label"` on `CanvasTextNode`. `canvas-flow-node.tsx` renders annotations as Meridian callout cards — serif-italic body and a brass number badge (1-based, document order via `annotationIndexById` in `json-canvas-react-flow.ts`). Any standard edge leaving an annotation node is projected with `data.leader = true` and rendered as a dashed leader arrow (`.afx-edge-leader` on the `BaseEdge` path). Add-annotation is reachable from the toolbar and the `add-annotation` command in the ⌘K registry. Export renders annotations as their text (standard text node path). No new file fields beyond the existing namespaced `afxNodeKind`.

### Live edge state (FR-47)

The projection (`json-canvas-react-flow.ts`) decorates an edge as `data.live = "refreshing" | "stale"` when its `afxDependency` provenance matches an in-flight Spec Map refresh (webview `pendingOperation`) or a host-reported stale dependency. `canvas-flow-edge.tsx` renders `live` edges with an animated dash offset (CSS `@keyframes`, disabled under `prefers-reduced-motion` in favor of a pulsing dot at the edge midpoint) and keeps `label` text on a legible background chip. Animation state never serializes.

### Sub-flow containment (FR-48)

Group drag containment is projection-side: `projectJSONCanvas` derives React Flow `parentId` relationships from `getCanvasGroupMembership` (geometric containment), positions children relative to their group, depth-sorts render order, and hides members of collapsed groups. The `parentId` exists only in the in-memory projection — `mergeFlowGeometry` converts positions back to absolute coordinates and no `parent` field ever reaches the file, so serialization remains geometry-only and Obsidian-compatible. Dropping a node inside/outside group bounds updates membership on the next projection.

### Foreign node fallback (FR-49)

`nodeTitle()` and the body renderer in `canvas-flow-node.tsx` guard the text-node fallthrough with an `isTextNode` check (`type === "text"` plus a runtime `typeof text === "string"` probe, since the permissive engine parse admits any `type` string with geometry). A foreign-typed node renders a fallback card titled `String(node.type)` with an "Unsupported node type … content is preserved and kept intact on save" body — mirroring `export.ts`'s foreign-node label and keeping NFR-3 losslessness visible to the user instead of crashing the unbounded React subtree.

### Undo continuity (FR-50)

The reprojection effect in `react-flow-canvas.tsx` distinguishes a `documentKey` switch (full history/selection/panel reset, unchanged) from a same-document canvas replacement. The latter flushes any pending geometry gesture, pushes the previous `canvasRef` snapshot onto `past` (capped at 100), clears `future`, and prunes node/edge selection to surviving ids — so Sync specs, starters, parent toolbar mutations, and external file edits are all undoable. Own edits are excluded by object identity: `canvas-app.tsx` stores the exact object the surface emitted through `onChange`, and `applyIncomingCanvasContent` returns the current state unchanged for own-echo content, so identity-equal props never double-push history.

### Spec Map empty state (FR-51)

`canvas-app.tsx` overlays `canvas-spec-map-empty` (absolute, pointer-events-none wrapper) when `mode === "spec-map"`, no operation is pending, and no edge carries `afxProvenance.kind === "declared-dependency"`. The card explains that Spec Map draws arrows from each spec's `depends_on` frontmatter, offers a "Sync specs now" button when a workspace source and revision exist, and otherwise instructs saving the canvas into the workspace. Floating placement keeps the surface layout stable per FR-45's no-layout-shift rule.

### Node toolbar placement

`NodeToolbar` renders below the node (`Position.Bottom`): the floating flow toolbar permanently occupies the surface's top strip, and top-placed node toolbars for top-row nodes were unreachable beneath it. The integration actions carry visible text ("Chat", "Notes") beside their icons, and a labeled "Chat" selection handoff sits next to the toolbar selection chip whenever nodes are selected.

### Meridian identity (NFR-11, NFR-12)

Node cards, controls, minimap, and background move to Meridian tokens: elevated card shadow + hover lift, brass (`--afx-brand`) selection ring (already themed), dotted background at reduced contrast per theme, minimap/Controls surfaces on `--background`/`--border`. All styling is webview CSS only — document bytes unchanged.

## [DES-CANVAS-TARGET-LOC] Target Code Locator Map

<!-- @see spec.md [FR-4] [FR-11] [FR-20] [FR-24] [FR-26] [FR-32] [FR-33] [FR-43] [FR-44] [NFR-3] [NFR-5] [NFR-12] [NFR-13] -->

| Responsibility                                            | Target location                                                                                                              |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Portable domain, parser, serializer, mutations, revisions | `packages/canvas-engine/src/*`                                                                                               |
| React Flow projection                                     | `apps/workbench/src/lib/json-canvas-react-flow.ts`                                                                           |
| Shared document renderer/controller                       | `apps/workbench/src/components/canvas/{canvas-app,react-flow-canvas}.tsx`, `apps/workbench/src/hooks/use-canvas-document.ts` |
| Library, planning, spec-map, and edge tools               | `apps/workbench/src/components/canvas/{canvas-library,planning-guide,spec-map-tools}.tsx`, `edges/*`                         |
| Workbench and editor boot targets                         | `apps/workbench/src/views/canvas.tsx`, `apps/workbench/src/canvas-editor-app.tsx`, `apps/workbench/src/main.tsx`             |
| Live source and ordered mutation foundation               | `apps/vscode/src/services/{workbench-file-state,workbench-refresh-coordinator,workbench-mutation-coordinator}.ts`            |
| Canvas library/document/dependency host services          | `apps/vscode/src/services/{canvas-library-service,canvas-document-service,spec-dependency-indexer}.ts`                       |
| Reference subscriptions and rich previews                 | `apps/vscode/src/services/{canvas-reference-service,canvas-content-preview-service}.ts`                                      |
| Progressive profile/command presentation                  | `apps/workbench/src/components/canvas/{canvas-profile-selector,canvas-command-registry}.ts{x}`                               |
| Custom editor                                             | `apps/vscode/src/editors/canvas-editor-provider.ts`                                                                          |
| Shared contracts                                          | `packages/shared/src/{workbench-types,workbench-protocol,messages}.ts`                                                       |
| Experiment/settings contributions                         | `apps/vscode/package.json`, `apps/chat/src/{views/settings.tsx,lib/settings-copy.ts,lib/settings-snapshot.ts}`               |
| Attribution/package evidence                              | `NOTICE`, `THIRD_PARTY_NOTICES.md`, license inventory script and VSIX tests                                                  |

## [DES-CANVAS-TARGET-TRACE] Target Trace Matrix

<!-- @see spec.md [FR-1] [FR-44] [NFR-1] [NFR-13] -->

| Requirements                           | Design owners                                                               | Primary implementation/tests                                                                  |
| -------------------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| FR-1–FR-3, FR-19, FR-22, FR-24         | DES-ARCH, DES-SETTINGS, DES-HOST                                            | tab registry/settings, `CanvasLibraryService`, library component, manifest/host/component/E2E |
| FR-4, FR-13, FR-14, FR-18              | DES-DATA, DES-DEC                                                           | `@afx/canvas-engine`, adapter fixtures, Obsidian/unknown-field property tests                 |
| FR-5–FR-10, FR-17, FR-23, FR-28, FR-29 | DES-CANVAS-INTERACTIONS, DES-DATA                                           | shared React Flow surface/nodes/edges/inspector; pointer, touch, keyboard, responsive E2E     |
| FR-11, FR-12, FR-31                    | DES-CANVAS-DOCUMENT-SERVICE, DES-CANVAS-DIRTY-CONFLICT, DES-CANVAS-PROTOCOL | live buffer overlay, host document sessions, FIFO mutations, save/conflict/failure tests      |
| FR-15, FR-16, FR-27, FR-33             | DES-CANVAS-INTERACTIONS, DES-SEC                                            | explicit action overlays, planning guide, preview/allowlist/trust tests                       |
| FR-20, FR-30                           | DES-HOST, DES-SEC                                                           | multi-root canonical resolver, referenced-document refresh, containment/ambiguity tests       |
| FR-21, FR-26                           | DES-ARCH, DES-DEC                                                           | dependency index/import/refresh/detach and Impact Lens boundary tests                         |
| FR-25                                  | DES-CANVAS-INTERACTIONS, DES-DATA                                           | non-destructive Freeform/Spec Map switching and round-trip tests                              |
| FR-32                                  | DES-CANVAS-EDITOR-AREA, DES-CANVAS-MULTI-INSTANCE                           | custom editor manifest/provider, shared app boot, split/editor/Workbench coherence E2E        |
| FR-34                                  | DES-ARCH, DES-HOST, DES-CANVAS-INTERACTIONS                                 | architecture index/explorer, search/filter/traversal, whole-workspace dependency E2E          |
| FR-35–FR-37                            | DES-UI, DES-HOST, DES-SEC                                                   | content preview service and spec/file/image/URL/Note/Board node matrix                        |
| FR-38–FR-39                            | DES-CANVAS-INTERACTIONS, DES-DATA                                           | frames/templates/alignment/style/palette/presentation component and visual E2E                |
| FR-40                                  | DES-CANVAS-INTERACTIONS, DES-DATA, DES-ERR                                  | pure layout preview/apply/undo, pins/groups/manual-preservation and stress tests              |
| FR-41–FR-42                            | DES-CANVAS-INTERACTIONS, DES-SEC, DES-API                                   | connector/group matrix and preflighted portable/image export scenarios                        |
| FR-43–FR-44                            | DES-UI, DES-CANVAS-INTERACTIONS, DES-DEC                                    | progressive profile command registry, capability-off baseline, beginner/architecture/AFX E2E  |
| NFR-1–NFR-3                            | DES-DEPS, DES-DATA, DES-ROLLOUT                                             | size/license gates, zero-migration fixtures, JSON Canvas interoperability                     |
| NFR-4–NFR-5                            | DES-CANVAS-DOCUMENT-SERVICE, DES-CANVAS-DIRTY-CONFLICT, DES-SEC             | unmount/failure/concurrency/containment/host-boundary tests                                   |
| NFR-6–NFR-7                            | DES-CANVAS-INTERACTIONS, DES-TEST                                           | 150-node/200-edge performance trace and accessibility matrix                                  |
| NFR-8                                  | DES-SEC, DES-DATA                                                           | unknown/AFX metadata round-trip plus never-auto-run/trust/confirmation tests                  |
| NFR-9                                  | DES-SEC, DES-HOST                                                           | URL/image/Markdown isolation, CSP, scheme/redirect/size/time/MIME abuse tests                 |
| NFR-10–NFR-11                          | DES-TEST, DES-DATA                                                          | 1,000/2,000 push-limit traces plus deterministic layout/style/reopen property tests           |
| NFR-12–NFR-13                          | DES-UI, DES-HOST, DES-TEST                                                  | first-run profile scripts, revisioned on-demand reference tests, explicit scale/cache metrics |

## [DES-CANVAS-BASELINE-LOC] Legacy Code Locator Map

<!-- @see spec.md [NFR-3] -->

This map records the current custom-renderer baseline solely to make the
replacement reviewable. It is not the target architecture.

| Symbol                                                                                  | Location                                                   |
| --------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `Canvas` (orchestrator)                                                                 | `apps/workbench/src/views/canvas.tsx`                      |
| `useCanvasModel` + pure mutators                                                        | `apps/workbench/src/components/canvas/use-canvas-model.ts` |
| `parseJSONCanvas` / `serializeJSONCanvas` / `JSONCanvasParseError` / `emptyCanvas`      | `apps/workbench/src/lib/json-canvas.ts`                    |
| `CanvasSurface` (pan/zoom world layer)                                                  | `apps/workbench/src/components/canvas/canvas-surface.tsx`  |
| `CanvasNode` (drag/resize/menu/render)                                                  | `apps/workbench/src/components/canvas/canvas-node.tsx`     |
| `CanvasEdges` (SVG, labels, retarget)                                                   | `apps/workbench/src/components/canvas/canvas-edges.tsx`    |
| `CanvasToolbar` + `CanvasSaveStatus` type + `CANVAS_COLOR_SWATCHES`                     | `apps/workbench/src/components/canvas/canvas-toolbar.tsx`  |
| `createCanvasDataProvider` / `PROJECT_CANVAS_PATH`                                      | `apps/vscode/src/services/canvas-data.ts`                  |
| `computeCanvasEnabled` / canvas `afxUpdate` wiring / `afxPickMarkdownFile`              | `apps/vscode/src/panels/workbench-panel.ts`                |
| `handleSetExperimentalCanvasEnabled` / settings snapshot fields                         | `apps/vscode/src/panels/sidebar-panel.ts`                  |
| `CanvasNode`/`CanvasEdge`/`JSONCanvas`/`CanvasFilePayload` types                        | `packages/shared/src/workbench-types.ts`                   |
| `afxUpdate` canvas fields                                                               | `packages/shared/src/workbench-protocol.ts`                |
| `SettingsExperimentalSnapshot` / `experimental/setCanvasEnabled` / `chat/openWorkbench` | `packages/shared/src/messages.ts`                          |
| `setExperimentalCanvasEnabled` / Experimental `SettingsCard`                            | `apps/chat/src/views/settings.tsx`                         |
| `EXPERIMENTAL` copy                                                                     | `apps/chat/src/lib/settings-copy.ts`                       |
| `composeSettingsSnapshot` experimental shape                                            | `apps/chat/src/lib/settings-snapshot.ts`                   |

## [DES-CANVAS-BASELINE-TRACE] Legacy Functional Trace Matrix

<!-- @see spec.md [FR-1] [FR-22] [NFR-3] -->

The rows below describe the already-shipped FR-1–FR-23 implementation. The
target matrix above supersedes its architecture and test expectations for the
React Flow migration.

| Req   | Design                 | Source (file · symbol)                                                                                                            | Test                                                                                 |
| ----- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| FR-1  | DES-ARCH, DES-SETTINGS | `apps/vscode/package.json` `afx.experimental.canvas`; `workbench-panel.ts` `computeCanvasEnabled`; `app.tsx` `canvasEnabled` gate | `configuration-manifest.test.ts`, `extension.test.ts`, `canvas.spec.ts` (tab hidden) |
| FR-2  | DES-UI                 | `app.tsx` gated `WorkbenchTabTrigger`/`TabsContent` value="canvas"                                                                | `app.test.tsx`, `canvas.spec.ts`                                                     |
| FR-3  | DES-HOST               | `canvas-data.ts` `getCanvasPayload`/`PROJECT_CANVAS_PATH`; `workbench-panel.ts` `.afx/` create                                    | `canvas-data.test.ts`, `workbench-panel.test.ts`                                     |
| FR-4  | DES-DATA               | `workbench-types.ts` `JSONCanvas`; `use-canvas-model.ts` `useCanvasModel`                                                         | `use-canvas-model.test.ts`                                                           |
| FR-5  | DES-UI, DES-DATA       | `use-canvas-model.ts` `addTextNode`; `canvas-node.tsx` text body                                                                  | `use-canvas-model.test.ts`, `canvas.test.tsx`                                        |
| FR-6  | DES-API                | `canvas.tsx` `afxFetchDocContent`; `canvas-node.tsx` `MinimalMarkdown`                                                            | `canvas.test.tsx`, `workbench-panel.test.ts`                                         |
| FR-7  | DES-SEC                | `canvas-node.tsx` `FileChip` (non-md)                                                                                             | `canvas.test.tsx`, `canvas.spec.ts`                                                  |
| FR-8  | DES-UI, DES-DATA       | `canvas-node.tsx` drag/resize → `use-canvas-model.ts` `moveNode`/`resizeNode`                                                     | `use-canvas-model.test.ts`, `canvas.spec.ts`                                         |
| FR-9  | DES-UI                 | `canvas-edges.tsx`; `use-canvas-model.ts` `connectNodes`/`updateEdgeLabel`/`retargetEdge`/`deleteEdge`                            | `use-canvas-model.test.ts`, `canvas.test.tsx`                                        |
| FR-10 | DES-ARCH               | `canvas-surface.tsx` pan/zoom world layer                                                                                         | `canvas.test.tsx`, `canvas.spec.ts`                                                  |
| FR-11 | DES-API, DES-ERR       | `canvas.tsx` autosave `useEffect` + `saveStatus`                                                                                  | `canvas.test.tsx`                                                                    |
| FR-12 | DES-HOST, DES-ERR      | `canvas-data.ts` watcher; `canvas.tsx` external-edit guard                                                                        | `canvas-data.test.ts`, `canvas.test.tsx`                                             |
| FR-13 | DES-DATA               | `json-canvas.ts` `parseJSONCanvas`/`serializeJSONCanvas`                                                                          | `json-canvas.test.ts`                                                                |
| FR-14 | DES-UI                 | `canvas-node.tsx` group frame + link `FileChip` (read-only)                                                                       | `canvas.test.tsx`, `json-canvas.test.ts`                                             |
| FR-15 | DES-UI                 | `canvas-node.tsx` Promote → `canvas.tsx` `afxAppendNote`                                                                          | `canvas.test.tsx`                                                                    |
| FR-16 | DES-API, DES-UI        | `canvas.tsx` `afxOpenChatCommand {mode:"send"}`; `canvas-toolbar.tsx` "Chat N"                                                    | `canvas.test.tsx`, `canvas.spec.ts`                                                  |
| FR-17 | DES-UI                 | `canvas-toolbar.tsx` add/fit/zoom; `canvas.tsx` keyboard `t`/`l`/`f`                                                              | `canvas.spec.ts`                                                                     |
| FR-18 | DES-DATA, DES-DEC      | `workbench-types.ts` `CanvasExtensionFields`/`afxNodeKind`; `json-canvas.ts` spread-through                                       | `json-canvas.test.ts`, `use-canvas-model.test.ts`                                    |
| FR-19 | DES-API, DES-HOST      | `workbench-protocol.ts` `afxUpdate` fields; `workbench-panel.ts` join                                                             | `canvas-data.test.ts`, `workbench-panel.test.ts`                                     |
| FR-20 | DES-API                | `canvas.tsx` `afxFetchDocContent`/`afxPickMarkdownFile`/`afxMarkdownFilePicked`                                                   | `canvas.test.tsx`, `workbench-panel.test.ts`, `messages.test.ts`                     |
| FR-21 | DES-ROLLOUT            | `[DES-ROLLOUT]` scope-boundary note                                                                                               | — (doc)                                                                              |
| FR-22 | DES-SETTINGS           | `settings.tsx` `setExperimentalCanvasEnabled`; `messages.ts` `experimental/setCanvasEnabled`                                      | `app.test.tsx`, `messages.test.ts`                                                   |
| FR-23 | DES-DATA, DES-DEC      | `use-canvas-model.ts` `addNote`/`addLabel`/`addGroup`/`updateNodeColor`/`renameNode`/`retargetEdge`                               | `use-canvas-model.test.ts`, `canvas.test.tsx`                                        |
| NFR-1 | DES-DEC, DES-DEPS      | `canvas-surface.tsx` DOM+CSS+SVG (no graph lib)                                                                                   | code review / `package.json` deps                                                    |
| NFR-2 | DES-HOST               | `.afx/project.canvas` created on first save; no config                                                                            | `workbench-panel.test.ts`                                                            |
| NFR-3 | DES-DATA               | `json-canvas.ts` lossless round-trip                                                                                              | `json-canvas.test.ts`                                                                |
| NFR-4 | DES-ROLLOUT            | isolated gated files (disposability)                                                                                              | knip / code review                                                                   |
| NFR-5 | DES-SEC                | host IO in `apps/vscode`; webview never reads files                                                                               | `canvas-data.test.ts`                                                                |
| NFR-6 | DES-ARCH               | 650 ms debounce; 144-node stress                                                                                                  | `canvas.spec.ts` (stress), `canvas.test.tsx` (nested scroll)                         |
| NFR-7 | DES-ROLLOUT            | stale canvas stays valid; no migration                                                                                            | code review                                                                          |

## [DES-REFS] File Reference Map

<!-- @see spec.md [NFR-3] -->

| File                                                                                                                                                           | Required `@see`                                                                                            |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `packages/canvas-engine/src/{json-canvas,mutations,reducer,revision}.ts`                                                                                       | `spec.md [FR-4] [FR-13] [FR-18] [NFR-3]` · `design.md [DES-DATA] [DES-CANVAS-PROTOCOL]`                    |
| `packages/shared/src/workbench-types.ts`                                                                                                                       | `spec.md [FR-4] [FR-13] [FR-18]` · `design.md [DES-DATA]`                                                  |
| `packages/shared/src/workbench-protocol.ts`                                                                                                                    | `spec.md [FR-19]` · `design.md [DES-API]`                                                                  |
| `packages/shared/src/messages.ts`                                                                                                                              | `spec.md [FR-1] [FR-2]` (+ `214` dual-anchor) · `design.md [DES-SETTINGS] [DES-API]`                       |
| `apps/vscode/src/services/canvas-data.ts`                                                                                                                      | `spec.md [FR-3] [FR-12] [FR-19]` · `design.md [DES-HOST]`                                                  |
| `apps/vscode/src/services/canvas-{library,document}-service.ts`                                                                                                | `spec.md [FR-11] [FR-12] [FR-24] [FR-31]` · `design.md [DES-HOST] [DES-CANVAS-DOCUMENT-SERVICE]`           |
| `apps/vscode/src/editors/canvas-editor-provider.ts`                                                                                                            | `spec.md [FR-32]` · `design.md [DES-CANVAS-EDITOR-AREA] [DES-CANVAS-MULTI-INSTANCE]`                       |
| `apps/vscode/src/panels/workbench-panel.ts`                                                                                                                    | `spec.md [FR-3] [FR-12] [FR-19] [NFR-2] [NFR-5]` · `design.md [DES-HOST] [DES-ARCH] [DES-FILES]`           |
| `apps/vscode/src/panels/sidebar-panel.ts`                                                                                                                      | `spec.md [FR-1] [FR-2]` (inline at the handler)                                                            |
| `apps/vscode/package.json`                                                                                                                                     | `design.md [DES-FILES]` — `contributes.configuration` → `afx.experimental.canvas` (JSON, no inline `@see`) |
| `apps/workbench/src/views/canvas.tsx`                                                                                                                          | `spec.md [FR-2] [FR-5] [FR-11] [FR-12] [FR-15] [FR-16] [FR-20]` · `design.md [DES-OVR] [DES-UI] [DES-ERR]` |
| `apps/workbench/src/canvas-editor-app.tsx`                                                                                                                     | `spec.md [FR-32]` · `design.md [DES-CANVAS-EDITOR-AREA] [DES-CANVAS-MULTI-INSTANCE]`                       |
| `apps/workbench/src/components/canvas/react-flow-canvas.tsx`                                                                                                   | `spec.md [FR-5] [FR-10] [FR-17] [FR-29]` · `design.md [DES-CANVAS-INTERACTIONS]`                           |
| `apps/workbench/src/components/canvas/use-canvas-model.ts`                                                                                                     | `spec.md [FR-4] [FR-5] [FR-8] [FR-9] [FR-23]` · `design.md [DES-DATA]`                                     |
| `apps/workbench/src/lib/json-canvas.ts`                                                                                                                        | `spec.md [FR-4] [FR-13] [FR-18] [NFR-3]` · `design.md [DES-DATA]`                                          |
| `apps/workbench/src/app.tsx`                                                                                                                                   | inline `spec.md [FR-1] [FR-2]` · `design.md [DES-UI]` (header owned by `227`)                              |
| `apps/workbench/src/context/workbench-context.tsx`                                                                                                             | inline `spec.md [FR-12] [FR-19]` · `design.md [DES-DATA] [DES-API]` (header owned by `227`)                |
| `apps/workbench/src/components/canvas/canvas-surface.tsx`                                                                                                      | `spec.md [FR-10] [FR-17] [NFR-1]` · `design.md [DES-ARCH]`                                                 |
| `apps/workbench/src/components/canvas/canvas-node.tsx`                                                                                                         | `spec.md [FR-5] [FR-6] [FR-7] [FR-8] [FR-14] [FR-15] [FR-16]` · `design.md [DES-UI]`                       |
| `apps/workbench/src/components/canvas/canvas-edges.tsx`                                                                                                        | `spec.md [FR-9] [FR-18]` · `design.md [DES-UI]`                                                            |
| `apps/workbench/src/components/canvas/canvas-toolbar.tsx`                                                                                                      | `spec.md [FR-16] [FR-17]` · `design.md [DES-UI]`                                                           |
| `apps/chat/src/views/settings.tsx`                                                                                                                             | `spec.md [FR-1] [FR-22]` (+ `214` dual-anchor) · `design.md [DES-SETTINGS]`                                |
| `apps/chat/src/lib/settings-copy.ts`                                                                                                                           | `spec.md [FR-1] [FR-22]` (+ `214`) · `design.md [DES-SETTINGS]`                                            |
| `apps/chat/src/lib/settings-snapshot.ts`                                                                                                                       | `spec.md [FR-1] [FR-22]` (+ `214`) · `design.md [DES-SETTINGS] [DES-DATA]`                                 |
| `NOTICE`, `THIRD_PARTY_NOTICES.md`, license inventory script                                                                                                   | `spec.md [NFR-1] [NFR-8]` · `design.md [DES-DEPS] [DES-ROLLOUT]`                                           |
| Tests (`json-canvas`, `use-canvas-model`, `canvas`, `canvas-data`, `workbench-panel`, `configuration-manifest`, `extension`, `canvas.spec`, `app`, `messages`) | per-file `spec.md [FR-…]` · `design.md [DES-TEST]`                                                         |
