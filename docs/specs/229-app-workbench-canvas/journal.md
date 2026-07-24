---
afx: true
type: JOURNAL
status: Living
owner: "@rix"
created_at: "2026-07-19T03:39:54.000Z"
updated_at: "2026-07-19T03:39:54.000Z"
tags: ["app", "workbench", "canvas", "react-flow", "json-canvas", "design-pivot"]
---

# App Workbench Canvas — Journal

## Discussion: React Flow and AFX-enhanced JSON Canvas program (2026-07-19T03:39:54.000Z)

### Context

The shipped experimental Canvas uses one `.afx/project.canvas`, a custom
DOM/SVG interaction engine, disk-only refresh, and fire-and-forget saves. The
user intends to rely on Canvas heavily for free planning and cross-spec maps,
requires multiple files and an editor-area surface, and explicitly requires
compatibility with the open JSON Canvas format used by Obsidian.

Board, Notes, and Canvas must also reflect manual edits, including unsaved open
VS Code buffers, without older scans or pending webview writes overwriting newer
work.

### Decision

- Keep standard JSON Canvas as the authoritative portable document.
- Use controlled `@xyflow/react` as the shared Workbench/editor interaction
  projection and retire the custom renderer only after parity evidence.
- Add optional versioned AFX metadata for mode, generated dependency provenance,
  missing edge styles, and explicit allowlisted actions. Standard content must
  remain useful when those fields are ignored, and file-provided actions never
  execute on load.
- Preserve `.afx/project.canvas`, add `.afx/canvases/*.canvas`, and support
  workspace-local files through a multi-root URI-first library.
- Use a custom text editor sharing one `CanvasDocumentService`, native
  `TextDocument` dirty/save/undo/redo behavior, per-path acknowledged mutations,
  and live manual-edit revisions.
- Deliver Freeform and Spec Map modes, planning starters, dependency refresh,
  rich connector controls, and explicit Notes/Chat/spec/sprint actions.
- Update `NOTICE` and generated standard third-party notices with exact licenses
  for every shipped runtime project and prove those files are packaged in the
  VSIX.

### Links

- ADR: `docs/adr/ADR-0009-react-flow-json-canvas-projection.md`
- Requirements: `spec.md` [FR-24] through [FR-33], [NFR-1] through [NFR-8]
- Design: `design.md` [DES-CANVAS-INTERACTIONS], [DES-CANVAS-DOCUMENT-SERVICE], [DES-CANVAS-EDITOR-AREA], [DES-CANVAS-PROTOCOL]
- Tasks: `tasks.md` Phases 6 through 16
