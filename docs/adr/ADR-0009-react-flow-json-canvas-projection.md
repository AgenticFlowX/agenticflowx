---
afx: true
type: ADR
status: Accepted
owner: "@rix"
version: "1.0"
created_at: "2026-07-19T03:16:29.000Z"
updated_at: "2026-07-19T03:16:29.000Z"
tags: ["adr", "workbench", "canvas", "react-flow", "json-canvas", "realtime"]
---

# ADR 0009: React Flow as a JSON Canvas projection

## Context

The Workbench Canvas currently implements viewport, selection, node movement,
resizing, edge creation, edge retargeting, and labels with custom DOM, CSS, and
SVG code. That implementation is hard-wired to `.afx/project.canvas`, marks a
save complete before the extension host confirms the write, and contains
interaction and lifecycle races that can lose or overwrite work.

Canvas is becoming a heavily used planning surface with two modes: freeform
planning and a spec map driven by declared AFX dependencies. It must support
multiple canvas documents, mature graph interactions, configurable connectors,
external file updates, undo/redo, and dense dependency maps without replacing
the portable JSON Canvas file format.

## Decision

Use `@xyflow/react` as the controlled rendering and interaction projection for
the Workbench Canvas. JSON Canvas remains the authoritative on-disk and domain
model. A pure, lossless adapter maps JSON Canvas nodes and edges to React Flow
view models and maps controlled changes back while preserving unknown fields.

Retain `.afx/project.canvas` as the backward-compatible default and discover
additional documents under `.afx/canvases/*.canvas`. Canvas files carry a
namespaced mode (`freeform` or `spec-map`) and narrowly scoped namespaced edge
metadata only when JSON Canvas has no equivalent. All writes use the shared
acknowledged, revision-aware Workbench mutation protocol.

AFX treats these documents as **AFX-enhanced JSON Canvas**. Standard JSON Canvas
records remain the complete readable spatial core. Optional namespaced AFX
metadata and runtime overlays add planning guidance and explicit actions, but do
not introduce proprietary required node types or execute automatically.

## Rationale

React Flow already provides the interaction primitives the custom engine has
been reimplementing: controlled nodes and edges, selection, viewport controls,
connection validation, reconnecting, resizing, keyboard behavior, edge
variants, minimap, and visibility-aware rendering. Reusing those primitives
reduces bespoke pointer state and lets AFX focus on the differentiated product
layer: portable JSON Canvas, SDD planning guides, spec dependencies, AFX file
cards, and host-integrated persistence.

Keeping JSON Canvas authoritative avoids lock-in, preserves compatibility with
other JSON Canvas tools, and prevents React Flow's runtime snapshot format from
becoming a workspace storage contract.

## Consequences

- `apps/workbench` gains `@xyflow/react`; dependency and bundle-size gates must
  be rerun before release.
- The existing custom surface is replaced incrementally behind the experimental
  flag rather than maintained alongside React Flow indefinitely.
- A lossless adapter and round-trip suite become release-blocking infrastructure.
- React Flow groups cannot be mapped naively to JSON Canvas groups because their
  coordinate models differ; AFX groups remain absolute JSON Canvas peers.
- Multiple dirty canvases require per-path state, revisions, acknowledgements,
  external-change conflict handling, and watcher coverage.
- Declared dependency edges carry provenance so refresh never deletes or rewrites
  manually authored connections.
- Obsidian-compatible tools can ignore AFX metadata and still open the standard
  canvas; AFX guarantees lossless handling of unknown fields when it writes.
- File-provided action metadata is untrusted input: actions are allowlisted,
  capability-checked, workspace-trust-aware, and invoked only by explicit user
  interaction with confirmation for consequential mutations.

## Alternatives Considered

- **Continue the custom DOM/CSS/SVG engine**: rejected because interaction,
  performance, accessibility, and lifecycle behavior would remain bespoke and
  costly while the requested scope expands substantially.
- **Persist React Flow's save/restore object**: rejected because it is not JSON
  Canvas and would make workspace files AFX/React-Flow-specific.
- **Adopt a full whiteboard editor such as tldraw**: rejected because the product
  needs a graph/planning editor with explicit JSON Canvas and AFX spec semantics,
  not a second proprietary whiteboard document model.
- **Merge Canvas and Impact Lens**: rejected because editable planning/spec maps
  and reverse code/test trace-health analysis have different ownership and
  mutation semantics. Canvas owns declared spec relationships; Impact Lens owns
  reverse traceability and verification health.
