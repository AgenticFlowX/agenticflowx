---
afx: true
type: DESIGN
status: Living
owner: "@rix"
version: "1.0"
created_at: "2026-06-03T07:28:52.000Z"
updated_at: "2026-06-06T11:03:56.000Z"
tags: ["app", "workbench", "canvas", "json-canvas", "ideation", "experimental"]
spec: spec.md
---

# App Workbench Canvas — Technical Design

> **As-built.** Where the original canvas sprint plan diverged from shipped code, this design records reality; divergences are called out inline.

## [DES-OVR] Overview

<!-- @see spec.md [FR-1] [FR-2] [FR-3] [FR-4] [FR-11] [FR-19] -->

A gated Workbench tab renders an infinite canvas whose runtime state is a JSON Canvas object loaded from and saved to `.afx/project.canvas`. The surface is a thin custom React layer — a CSS-transform viewport (`canvas-surface.tsx`), absolutely-positioned node divs that wrap the existing Workbench markdown renderer (`canvas-node.tsx`), a corner resize handle, and an SVG edge layer (`canvas-edges.tsx`) — with no third-party graph library. The host (`apps/vscode`) reads/watches the single file (`canvas-data.ts`) and persists writes through the existing `afxSaveFile` bridge; reads arrive through the existing `afxUpdate` workbench-state path. JSON Canvas is the only data model, so the file round-trips losslessly to Obsidian and the feature stays disposable behind `afx.experimental.canvas`.

> **As-built note:** autosave is an inline debounced `useEffect` inside `views/canvas.tsx` (650 ms), **not** a separate `useAutosave()` hook as the sprint component diagram sketched. The model hook is `useCanvasModel`; the orchestrator `Canvas` owns selection, save status, external-edit guard, and the autosave effect.

## [DES-ARCH] Architecture

<!-- @see spec.md [FR-3] [FR-12] [FR-19] [NFR-1] [NFR-5] -->

### System Context

```text
.afx/project.canvas  (single JSON Canvas file — the only source of truth)
        ▲   │
  write │   │ read + watch
 (debounced)│
        │   ▼
apps/vscode (extension host)
  services/canvas-data.ts
    - createCanvasDataProvider: read .afx/project.canvas on init + fs watch
    - getCanvasUpdateFields() → afxUpdate { canvasEnabled, canvas? }
    - markSavedContent(content) echo-suppresses self-writes
  panels/workbench-panel.ts
    - computeCanvasEnabled() ← afx.experimental.canvas
    - join canvasFields into afxUpdate; afxSaveFile creates .afx/ on first canvas write
    - afxPickMarkdownFile dialog → afxMarkdownFilePicked
  package.json contributes.configuration → afx.experimental.canvas (boolean, default false)
        │
        │  WorkbenchInbound.afxUpdate { canvasEnabled?: boolean, canvas?: CanvasFilePayload }
        ▼
packages/shared
  workbench-types.ts   <- JSON Canvas types + CanvasFilePayload
  workbench-protocol.ts <- afxUpdate canvasEnabled/canvas; afxPickMarkdownFile/afxMarkdownFilePicked
  messages.ts          <- SettingsExperimentalSnapshot; experimental/setCanvasEnabled; chat/openWorkbench
        │
        ▼
apps/workbench (React webview)
  context/workbench-context.tsx   <- store canvasEnabled + canvas payload (reducer clears canvas when flag off)
  app.tsx                          <- gated Canvas tab (canvasEnabled)
  views/canvas.tsx                 <- orchestrator: parse → model, autosave, selection, file fetch, error guards
  components/canvas/
    canvas-surface.tsx             <- viewport (pan/zoom), world layer host
    canvas-node.tsx                <- node frame: drag, resize, inline md, node menu, group/link read-only
    canvas-edges.tsx               <- SVG edge layer + labels + retarget endpoints
    canvas-toolbar.tsx             <- add (text/note/label/group/file) / color / fit / zoom / send-selection
    use-canvas-model.ts            <- JSONCanvas {nodes,edges} state + mutations
  lib/json-canvas.ts               <- parse/serialize/validate (lossless)

apps/chat (Settings webview — FR-22)
  views/settings.tsx               <- Experimental group: Canvas switch, path field, Open Workbench
  lib/settings-copy.ts             <- EXPERIMENTAL copy block
  lib/settings-snapshot.ts         <- experimental { canvasEnabled, canvasPath } snapshot shape
```

### Component Diagram

```text
┌──────────────────────────── views/canvas.tsx (Canvas) ───────────────────────┐
│  useCanvasModel(parsed.canvas, acceptedContent) ── JSONCanvas, selection,dirty │
│  inline useEffect (650 ms debounce) → send(afxSaveFile)                        │
│  saveStatus = error | saving | saved  ·  external-edit guard  ·  fileContents  │
│  ┌── canvas-toolbar.tsx ──────────────────────────────────────────────────┐   │
│  │  [Card][Note][Label][Group]  [color▾][Doc▾]  [Chat N]   [Fit][- 100% +] │   │
│  └────────────────────────────────────────────────────────────────────────┘   │
│  ┌── canvas-surface.tsx (world: translate(x,y) scale(z), 0.25–3×) ─────────┐   │
│  │   ┌── canvas-edges.tsx (SVG layer; Q-curves; labels; retarget ends) ──┐ │   │
│  │   └────────────────────────────────────────────────────────────────────┘ │
│  │   ┌── canvas-node.tsx × N (abs-positioned; drag/resize/menu) ──────────┐ │   │
│  │   │  text/note/label · <MinimalMarkdown/> · file chip · group/link RO  │ │   │
│  │   └────────────────────────────────────────────────────────────────────┘ │
│  └────────────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────────────┘
```

## [DES-UI] User Interface & UX

<!-- @see spec.md [FR-5] [FR-6] [FR-9] [FR-10] [FR-15] [FR-16] [FR-17] [FR-23] -->

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
|              Saved to .afx/project.canvas · openable in any JSON Canvas tool    |
+--------------------------------------------------------------------------------+
```

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

### Interaction notes (as built)

- **Add nodes**: toolbar `Card` (text), `Note` (`afxNodeKind:"note"`, color "3"), `Label` (`afxNodeKind:"label"`, compact), `Group` (group node); keyboard `t` add text, `l` add label, `f` add selected doc (handled in `canvas.tsx`, not the toolbar).
- **Add file node**: `Doc▾` popover (native-select of markdown docs + path input) or `Browse` → `afxPickMarkdownFile` → `afxMarkdownFilePicked`; content renders inline read-only via `afxFetchDocContent`/`afxDocContent`.
- **Move / resize**: pointer-drag the node body (coords divided by zoom); drag the bottom-right `ResizeHandle` to resize. Both write geometry to the model and mark dirty.
- **Link**: per-node connection handles + "Drag to connect" enter link-drag; click/drag to a target creates an edge (`toEnd:"arrow"`, computed sides); double-click an edge label to edit; drag an endpoint to retarget; trash to delete.
- **Pan / zoom**: drag empty background to pan (`isCanvasInteractionTarget` guards nodes/inputs); wheel to zoom (clamp 0.25–3×, step 0.08); shift+wheel pans; `Fit to view` recenters to node bounds.
- **Color**: toolbar color popover (`CANVAS_COLOR_SWATCHES`) → `updateNodeColor` on the selection.
- **Save status** `[Canvas.SaveStatus]`: `CanvasSaveOverlay` shows saved / saving / error (debounced; reflects the last `afxSaveFile` round-trip; error on save failure).

## [DES-DEC] Key Decisions

<!-- @see spec.md [FR-4] [FR-13] [FR-18] [NFR-1] [NFR-3] [NFR-4] -->

| Decision                     | Options Considered                               | Choice                                                     | Rationale                                                                                                                                                                                                                                                                                                                                         |
| ---------------------------- | ------------------------------------------------ | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rendering engine             | React Flow; tldraw; `json-canvas-viewer`; custom | **Custom DOM+SVG**                                         | JSON Canvas stays the single source of truth (no model mapping, no round-trip bugs); zero deps; full styling control to reuse AFX cards; disposable behind a flag.                                                                                                                                                                                |
| `json-canvas-viewer` library | Use now; use later; not at all                   | **Later, for Impact Lens only**                            | Source review confirmed it is view-only (load-once, pan/zoom/click) — cannot author. Its React node slots fit the future read-only impact map, not this editor.                                                                                                                                                                                   |
| Storage shape                | One file; per-feature canvases; hidden DB        | **One file `.afx/project.canvas`**                         | Reads as the workspace/project map; mirrors `.afx/notes.md`; zero config; nothing to organize (NFR-7).                                                                                                                                                                                                                                            |
| Format                       | Strict JSON Canvas 1.0; AFX-extended `.canvas`   | **Strict 1.0 + one namespaced extension field**            | Portable to Obsidian/any tool. **As-built reconciliation:** the sprint promised "no AFX-proprietary fields," but text nodes persist `afxNodeKind` ("note"/"label"). It is sanctioned because it round-trips losslessly via `CanvasExtensionFields` and other tools ignore unknown fields (NFR-3 unharmed). No proprietary _node types_ are added. |
| Persistence path             | New `afxSaveCanvas` msg; reuse `afxSaveFile`     | **Reuse `afxSaveFile`**                                    | The whole small file is rewritten on debounced save; reads piggyback on `afxUpdate` like notes.                                                                                                                                                                                                                                                   |
| Node content rendering       | New renderer; reuse `markdown-render`            | **Reuse `MinimalMarkdown`**                                | Keeps nodes "live" (actions, chat bridge) for free.                                                                                                                                                                                                                                                                                               |
| Authoring scope              | text/file only; + group; full                    | **text/file + note/label/group, color, rename, edge edit** | **As-built reconciliation:** the sprint scoped group authoring out ("render + round-trip only"); shipped code authors group nodes (`addGroup`), note/label variants, color, rename, and edge retarget/delete (FR-23). `link`-node authoring remains out.                                                                                          |
| Default state                | On; on for owner; off behind flag                | **Off behind `afx.experimental.canvas`**                   | Cheap to validate, cheap to remove; answers the usage question with data.                                                                                                                                                                                                                                                                         |

## [DES-DATA] Data Model

<!-- @see spec.md [FR-4] [FR-13] [FR-18] [FR-23] [NFR-3] -->

The on-disk file and the in-memory state are the same JSON Canvas 1.0 object. No database. Verbatim from `packages/shared/src/workbench-types.ts` (canvas region):

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

// Bridge payload (host → webview): the raw file + its path, mirroring notesFilePath.
export interface CanvasFilePayload {
  path: string; // ".afx/project.canvas"
  content: string; // raw JSON text (parsed in the webview)
  exists: boolean; // false on first run (no file yet)
}
```

### Lossless round-trip rule

`lib/json-canvas.ts` parses with a permissive schema that **preserves any unknown fields** (spread-through), so authoring tools' extensions and node types AFX does not author (`link`) survive a save. `parseJSONCanvas` empty/whitespace → `emptyCanvas()`; `JSON.parse` failure → typed `JSONCanvasParseError`; non-object root → throws; validators assert presence of required keys only (never strip). `serializeJSONCanvas` writes `JSON.stringify({...canvas, nodes, edges}, null, 2)` + trailing newline — pretty-printed, no field stripping (FR-13/18).

### Model mutations (`use-canvas-model.ts`)

`useCanvasModel(initialCanvas, resetKey)` returns: `canvas, dirty, selectedIds, setClean, selectOnly, toggleSelected, clearSelection, addText, addNote, addLabel, addGroup, addFile, updateText, renameNode, move, resize, connect, labelEdge, retargetEdge, removeEdge, colorSelected, removeNode`. Pure mutators (exported, JSON-Canvas-shaped, id-stable `n-`/`e-`): `addTextNode`, `addLabelNode`, `addFileNode`, `addGroupNode`, `updateTextNode`, `renameNode`, `moveNode`, `resizeNode`, `connectNodes` (self-loop guard; `toEnd:"arrow"` + computed sides), `updateEdgeLabel`, `retargetEdge`, `deleteEdge`, `updateNodeColor`, `deleteNode`, plus geometry helpers `nodeCenter`, `canvasBounds`, `parsePointFromViewport`.

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

<!-- @see spec.md [FR-11] [FR-12] [FR-15] [FR-16] [FR-19] [FR-20] -->

### Workbench bridge (`packages/shared/src/workbench-protocol.ts`)

```text
WorkbenchInbound (host → webview):
  afxUpdate { ...workbench state..., canvasEnabled?: boolean, canvas?: CanvasFilePayload }  // FR-12/FR-19
  afxDocContent { filePath, content }                       // file-node markdown content (FR-6/FR-20)
  afxMarkdownFilePicked { filePath }                        // host file-picker result (FR-20)

WorkbenchOutbound (webview → host) — existing messages reused, no new write path:
  afxSaveFile        { path: ".afx/project.canvas", content }  // debounced autosave (FR-11)
  afxFetchDocContent { filePath }                              // request file-node markdown (FR-20)
  afxPickMarkdownFile {}                                       // open host markdown picker (FR-20)
  afxAppendNote      { text }                                  // promote text node (FR-15)
  afxOpenChatCommand { command, mode: "send" }                // send to chat (FR-16) — as-built mode is "send"
  afxOpenFile        { path, mode: "afxPreview" | "editor" }  // open file-node target
```

> **As-built reconciliation:** (1) send-to-chat ships `mode: "send"` (the sprint plan said `"insert"`; the protocol allows both). (2) File-node insertion uses the `afxPickMarkdownFile`/`afxMarkdownFilePicked` host picker round-trip, which the sprint API contract omitted.

### Settings bridge (`packages/shared/src/messages.ts`) — FR-22

```text
SettingsExperimentalSnapshot { canvasEnabled: boolean; canvasPath: string }   // in SettingsSnapshot.experimental?
ChatToAgent (webview → host):  experimental/setCanvasEnabled { requestId, enabled }   // flip afx.experimental.canvas
                               chat/openWorkbench { requestId }                       // "Open Workbench" button
chat/openSettings key union includes "afx.experimental.canvas"                        // deep-link the VS Code setting
```

## [DES-HOST] Extension Host Service

<!-- @see spec.md [FR-3] [FR-12] [FR-19] [NFR-2] [NFR-5] -->

`apps/vscode/src/services/canvas-data.ts` (verbatim as-built):

```typescript
export const PROJECT_CANVAS_PATH = ".afx/project.canvas";

export interface CanvasDataProvider {
  getCanvasUpdateFields(): Promise<{ canvasEnabled: boolean; canvas?: CanvasFilePayload }>;
  getCanvasPayload(): Promise<CanvasFilePayload>;
  markSavedContent(content: string): void; // echo-suppression entry point
  onDidChange(cb: () => void): vscode.Disposable;
  dispose(): void;
}

interface CanvasDataProviderOptions {
  getWorkspaceRoot(): vscode.Uri | undefined;
  isEnabled(): boolean; // reads afx.experimental.canvas
  logger?: Logger; // OPTIONAL as-built
}

export function createCanvasDataProvider(opts: CanvasDataProviderOptions): CanvasDataProvider;
```

- `getCanvasUpdateFields()` returns `{ canvasEnabled: false }` (no read/watch) when disabled; else `{ canvasEnabled: true, canvas: await getCanvasPayload() }`.
- `getCanvasPayload()` reads `.afx/project.canvas`; missing/unreadable → `{ path: PROJECT_CANVAS_PATH, content: "", exists: false }`.
- `markSavedContent(content)` stores `lastSavedContent`; the watcher echo-suppresses when `lastSavedContent === payload.content`.
- `onDidChange()` returns a no-op disposable when disabled; else lazily creates `createFileSystemWatcher(PROJECT_CANVAS_PATH)` watching change/create/delete.
- **Writes** use the existing `afxSaveFile` handler in `workbench-panel.ts`: for `.afx/project.canvas` it creates `.afx/` first (`fs.createDirectory`) and calls `markCanvasSaved(content)` → `canvasData.markSavedContent(content)` for echo-suppression. `computeCanvasEnabled()` reads `afx.experimental.canvas`; a config change stops/starts the watcher and re-pushes `afxUpdate`.

> **As-built reconciliation vs sprint [DES-HOST]:** options are a named `CanvasDataProviderOptions` interface with `logger?` **optional** (sprint said required inline literal), and `markSavedContent(content)` is part of the public interface (sprint narrated echo-suppression in prose but omitted the method).

## [DES-SETTINGS] Chat Settings Experimental Surface

<!-- @see spec.md [FR-1] [FR-22] -->

> **New section — undocumented in the sprint.** The canvas experiment flag is toggled from the Chat Settings webview (dual-owned with `214-app-chat-settings`).

- **`apps/chat/src/views/settings.tsx`** — a `SETTINGS_SECTIONS` entry `{ id: "experimental", label: "Experimental", shortLabel: "Exp" }` and an `<SettingsCard id="experimental" icon={Sparkles}>` containing: a `SwitchRow` bound to `experimentalSettings.canvasEnabled` whose `onCheckedChange` is `setExperimentalCanvasEnabled`; a read-only `ConfigField` showing `canvasPath` with `settingKey="afx.experimental.canvas"` (deep-link, not in-webview editable); and an "Open Workbench" `Button` firing `chat/openWorkbench`. `setExperimentalCanvasEnabled(enabled)` optimistically patches the local snapshot, then sends `experimental/setCanvasEnabled { requestId: trackExperimentalMutation("Canvas " + (enabled?"enabled":"disabled")), enabled }`. `pendingExperimentalMutations` (a `Map<requestId,label>`) resolves to a success toast on the next `agent/settingsSnapshot`, or an error toast on `chat/error`.
- **`apps/chat/src/lib/settings-copy.ts`** — `export const EXPERIMENTAL = { groupTitle, groupDescription, canvasLabel:"Workbench Canvas", canvasDescription, canvasTooltip, canvasPathLabel, canvasPathHint, openWorkbenchLabel:"Open Workbench" }`.
- **`apps/chat/src/lib/settings-snapshot.ts`** — `composeSettingsSnapshot` emits `experimental: { canvasEnabled: input.canvasEnabled ?? false, canvasPath: ".afx/project.canvas" }`. `canvasPath` is hard-coded; only `canvasEnabled` is mutable.
- **Host side** (`apps/vscode/src/panels/sidebar-panel.ts`): `case "experimental/setCanvasEnabled"` → `handleSetExperimentalCanvasEnabled(requestId, enabled)` updates `afx.experimental.canvas` at `ConfigurationTarget.Global` and re-emits the settings snapshot; the chat snapshot carries `experimental: { canvasEnabled, canvasPath: ".afx/project.canvas" }`.

> **214 dual-anchor:** the Settings Experimental group is owned by `214-app-chat-settings` [FR-14] (the settings surface) and the canvas feature by `229-app-workbench-canvas` [FR-22]. The three settings files dual-anchor both.

## [DES-FILES] File Structure

<!-- @see spec.md [FR-1] [FR-3] [FR-22] [DES-ARCH] -->

| File                                                       | Purpose                                                                                                                                  |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/workbench/src/views/canvas.tsx`                      | Orchestrator: parse payload → model, selection, autosave, file fetch, error guards                                                       |
| `apps/workbench/src/components/canvas/canvas-surface.tsx`  | `[Canvas.Viewport]` — pan/zoom world layer                                                                                               |
| `apps/workbench/src/components/canvas/canvas-node.tsx`     | `[Canvas.Node]` — drag, resize, inline markdown, node menu, group/link read-only                                                         |
| `apps/workbench/src/components/canvas/canvas-edges.tsx`    | `[Canvas.Edge]` — SVG edges, labels, retarget endpoints                                                                                  |
| `apps/workbench/src/components/canvas/canvas-toolbar.tsx`  | `[Canvas.Toolbar]` — add/color/doc/fit/zoom/send-selection                                                                               |
| `apps/workbench/src/components/canvas/use-canvas-model.ts` | In-memory `JSONCanvas` state + mutations + dirty                                                                                         |
| `apps/workbench/src/lib/json-canvas.ts`                    | Parse / serialize / validate JSON Canvas 1.0 (lossless)                                                                                  |
| `apps/workbench/src/app.tsx`                               | (edit) gated `Canvas` tab trigger + content                                                                                              |
| `apps/workbench/src/context/workbench-context.tsx`         | (edit) store `canvasEnabled`/`canvas` payload; clear on flag off                                                                         |
| `packages/shared/src/workbench-types.ts`                   | (edit) JSON Canvas types + `CanvasFilePayload`                                                                                           |
| `packages/shared/src/workbench-protocol.ts`                | (edit) `afxUpdate` canvas fields; `afxPickMarkdownFile`/`afxMarkdownFilePicked`                                                          |
| `packages/shared/src/messages.ts`                          | (edit) `SettingsExperimentalSnapshot`; `experimental/setCanvasEnabled`; `chat/openWorkbench`                                             |
| `apps/vscode/src/services/canvas-data.ts`                  | Host read/watch of `.afx/project.canvas`; echo-suppressed publish                                                                        |
| `apps/vscode/src/panels/workbench-panel.ts`                | (edit) join `canvasEnabled`/`canvas` into `afxUpdate`; `.afx/` creation; markdown picker                                                 |
| `apps/vscode/src/panels/sidebar-panel.ts`                  | (edit) `experimental/setCanvasEnabled` handler + settings snapshot fields                                                                |
| `apps/vscode/package.json`                                 | (edit) `contributes.configuration` → `afx.experimental.canvas` (boolean, default false). **JSON cannot carry `@see`; traced here only.** |
| `apps/chat/src/views/settings.tsx`                         | (edit) Experimental group: Canvas switch, path field, Open Workbench (dual-anchor `214`)                                                 |
| `apps/chat/src/lib/settings-copy.ts`                       | (edit) `EXPERIMENTAL` copy block (dual-anchor `214`)                                                                                     |
| `apps/chat/src/lib/settings-snapshot.ts`                   | (edit) `experimental { canvasEnabled, canvasPath }` snapshot (dual-anchor `214`)                                                         |

## [DES-DEPS] Dependencies

<!-- @see spec.md [NFR-1] -->

- No new runtime npm dependencies (NFR-1). Uses React, existing `@afx/ui` primitives, Lucide icons, and `MinimalMarkdown`.
- Internal: `@afx/shared` types, `useWorkbench()` context, the `afxSaveFile`/`afxUpdate`/`afxFetchDocContent`/`afxPickMarkdownFile`/`afxOpenChatCommand`/`afxAppendNote`/`afxOpenFile` messages, and the settings `experimental/setCanvasEnabled`/`chat/openWorkbench` messages.

## [DES-SEC] Security Considerations

<!-- @see spec.md [FR-7] [FR-20] [NFR-5] -->

- File-node paths are workspace-relative and read by the host through `vscode.workspace.fs`; the webview never reads files directly (NFR-5). Non-markdown / unresolved / out-of-workspace paths render a `FileChip` placeholder, never an embed.
- Inline markdown is rendered by `MinimalMarkdown`; no raw HTML execution beyond what that renderer permits.
- "Send to chat" sends user-selected content only. Autosave writes only to `.afx/project.canvas`.

## [DES-ERR] Error Handling

<!-- @see spec.md [FR-11] [FR-12] -->

| Scenario                                      | Handling                                                                                                                                                                   |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.afx/project.canvas` missing (first run)     | Treat as empty (`exists:false`); create `.afx/` + file on first save.                                                                                                      |
| Malformed/invalid JSON                        | `parseCanvasForView` catches `JSONCanvasParseError` → empty model + a "Malformed canvas file" banner with Open file / Reload; **never auto-overwrite** (no `afxSaveFile`). |
| File node points at missing/non-markdown path | `FileChip` placeholder ("file not found in workspace" / "preview disabled for non-markdown files"); no embed.                                                              |
| Save (`afxSaveFile`) fails                    | `saveFailed` → `saveStatus:"error"` overlay; in-memory state kept; never lose edits silently.                                                                              |
| External edit while open                      | `afxUpdate` re-publishes; if local dirty, stash into `pendingExternalContent` and show "External canvas update available" with Reload / Keep local; else accept directly.  |
| Flag toggled off while tab open               | Reducer clears `canvas`; host stops watcher; tab hidden next render; files left intact.                                                                                    |

## [DES-TEST] Testing Strategy

<!-- @see spec.md [FR-13] [FR-18] [FR-19] [FR-20] [NFR-3] [NFR-6] -->

As-built coverage (7 dedicated + 4 cross-cutting files):

| Coverage                                                                                                                                                                                                                                                                                            | Test file                                                       |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Parser: empty → `{nodes:[],edges:[]}`, Obsidian round-trip (group/link/subpath/unknown fields survive), malformed → typed error                                                                                                                                                                     | `apps/workbench/src/lib/json-canvas.test.ts`                    |
| Model mutations: add text/file/note/label/group, color, move/resize, rename, connect/label/retarget/delete edge, viewport→world                                                                                                                                                                     | `apps/workbench/src/components/canvas/use-canvas-model.test.ts` |
| React: file-node fetch + non-md chip, autosave `afxSaveFile`, malformed banner (no save), external-update prompt, edge label/delete, node kinds + z-index, modified-wheel pan vs nested scroll, inline rename, picker insert, send-to-chat `mode:"send"`, multi-select "Chat N", additive selection | `apps/workbench/src/views/canvas.test.tsx`                      |
| Host service: disabled → no read/watch, enabled read + `exists:false`, payload publish, one watcher + safe dispose, echo-suppression                                                                                                                                                                | `apps/vscode/src/services/canvas-data.test.ts`                  |
| Host panel: gated watcher, `.afx/` creation on save, `canvasEnabled:false` on `afxReady`, `afxPickMarkdownFile`→`afxMarkdownFilePicked`                                                                                                                                                             | `apps/vscode/src/panels/workbench-panel.test.ts`                |
| Manifest: `afx.experimental.canvas` boolean default false                                                                                                                                                                                                                                           | `apps/vscode/src/configuration-manifest.test.ts`                |
| VS Code e2e: setting defaults false, updatable/readable                                                                                                                                                                                                                                             | `apps/vscode-e2e/src/extension.test.ts`                         |
| Workbench Playwright: tab hidden by default; create/drag/resize/link/retarget/label/delete; file-node markdown; colors/resize-clamp/external-update; light-theme quietness; 144-node stress                                                                                                         | `apps/workbench/e2e/canvas.spec.ts`                             |
| Settings UI (canvas toggle → `experimental/setCanvasEnabled`; open-setting deep-link)                                                                                                                                                                                                               | `apps/chat/src/app.test.tsx`                                    |
| Shared protocol (experimental + markdown-picker messages)                                                                                                                                                                                                                                           | `packages/shared/src/messages.test.ts`                          |

> **As-built reconciliation:** no per-component `*.test.tsx` exist (React coverage is all in `views/canvas.test.tsx`); there is no `afxAppendNote`/"promote" test (send-to-chat is the shipped verb); `workbench-panel.test.ts`, `app.test.tsx`, `messages.test.ts`, `configuration-manifest.test.ts`, `extension.test.ts` carry canvas assertions inside other-spec-owned files.

## [DES-ROLLOUT] Migration / Rollout Plan

<!-- @see spec.md [FR-21] [NFR-4] -->

- **Flag**: ships `afx.experimental.canvas: false`. No migration — the file is created on first use.
- **Dogfood**: author enables the flag and uses it as the primary scratch surface.
- **Kill criterion (pre-committed)**: if the author does not open the Canvas tab during a normal working week within ~4 weeks of dogfooding, remove the feature (delete the flag, `views/canvas.tsx` + `components/canvas/*`, the host service, the protocol fields, the Settings Experimental group). Removal is clean because JSON Canvas is the only model and the surface is isolated (NFR-4). Capture the decision in `journal.md`.
- **Scope boundary (FR-21)**: this is an experimental in-IDE freeform ideation surface trialed behind a flag; knowledge-graph, backlink, and reverse-index features are out of scope.

## [DES-CANVAS-LOC] Code Locator Map

<!-- @see spec.md [NFR-3] -->

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

## [DES-CANVAS-TRACE] Functional Trace Matrix (1:1, bidirectional)

<!-- @see spec.md [FR-1] [FR-22] [NFR-3] -->

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
| `packages/shared/src/workbench-types.ts`                                                                                                                       | `spec.md [FR-4] [FR-13] [FR-18]` · `design.md [DES-DATA]`                                                  |
| `packages/shared/src/workbench-protocol.ts`                                                                                                                    | `spec.md [FR-19]` · `design.md [DES-API]`                                                                  |
| `packages/shared/src/messages.ts`                                                                                                                              | `spec.md [FR-1] [FR-2]` (+ `214` dual-anchor) · `design.md [DES-SETTINGS] [DES-API]`                       |
| `apps/vscode/src/services/canvas-data.ts`                                                                                                                      | `spec.md [FR-3] [FR-12] [FR-19]` · `design.md [DES-HOST]`                                                  |
| `apps/vscode/src/panels/workbench-panel.ts`                                                                                                                    | `spec.md [FR-3] [FR-12] [FR-19] [NFR-2] [NFR-5]` · `design.md [DES-HOST] [DES-ARCH] [DES-FILES]`           |
| `apps/vscode/src/panels/sidebar-panel.ts`                                                                                                                      | `spec.md [FR-1] [FR-2]` (inline at the handler)                                                            |
| `apps/vscode/package.json`                                                                                                                                     | `design.md [DES-FILES]` — `contributes.configuration` → `afx.experimental.canvas` (JSON, no inline `@see`) |
| `apps/workbench/src/views/canvas.tsx`                                                                                                                          | `spec.md [FR-2] [FR-5] [FR-11] [FR-12] [FR-15] [FR-16] [FR-20]` · `design.md [DES-OVR] [DES-UI] [DES-ERR]` |
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
| Tests (`json-canvas`, `use-canvas-model`, `canvas`, `canvas-data`, `workbench-panel`, `configuration-manifest`, `extension`, `canvas.spec`, `app`, `messages`) | per-file `spec.md [FR-…]` · `design.md [DES-TEST]`                                                         |
