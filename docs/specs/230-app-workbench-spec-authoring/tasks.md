---
afx: true
type: TASKS
owner: "@rixrix"
version: "0.1"
created_at: "2026-07-23T15:24:06.000Z"
updated_at: "2026-07-24T11:49:37.000Z"
tags: ["app", "workbench", "canvas", "spec-authoring", "sdd", "frontmatter", "graph"]
spec: spec.md
design: design.md
---

# App Workbench Spec Authoring — Implementation Tasks

> Extends 229 Spec Map into a bidirectional, all-kind, authorable document
> graph. Build order is non-destructive-first: widen the read side, then add the
> surgical write side behind trust/confirm/conflict guards. All phases ship in
> 2.4.0.

References use Node IDs: `[FR-X]`, `[NFR-X]` (spec.md), `[DES-X]` (design.md), `[X.Y]` (tasks).

## Phase 1: Widen discovery + typed generation (non-destructive)

### 1.1 Generalize the indexer

- [x] Rename `spec-dependency-indexer.ts` → `doc-graph-indexer.ts`; widen glob to
      `**/docs/**/*.md` minus `_archive`/`.git`/`node_modules`; qualify by
      `afx: true` + SDD `type` via `classifySddDocumentPath`. [FR-1] [DES-ARCH]
- [x] Emit one kind-styled node per doc with `afxDoc {kind,status,id}`; keep
      `afxSpec` alias for spec nodes. [FR-2] [DES-DATA]

### 1.2 Typed relationship edges

- [x] Read `depends_on`, `supersedes`, `relates_to`; emit `declared-relationship`
      provenance with `relationship`; retain `declared-dependency` for
      `depends_on` back-compat; surface unresolved/ambiguous/cyclic. [FR-3] [DES-DATA]
- [x] Widen target resolution so adr/research resolve by stable id. [FR-3]

### 1.3 Node/edge styling + projection

- [x] Kind icon + status border in `canvas-flow-node.tsx`/`canvas-node-visuals.ts`. [FR-2] [DES-UI]
- [ ] Project typed provenance in `json-canvas-react-flow.ts`; typed-edge render
      in `canvas-flow-edge.tsx`. [FR-3] [DES-UI]

## Phase 2: Surgical frontmatter editor (`@afx/parsers`)

### 2.1 editFrontmatterList

- [x] Implement line-scoped add/remove preserving order/quoting/indent/comments;
      absent-key create; empty-list key removal; malformed-block no-op. [FR-8] [DES-API]
- [x] Exhaustive unit matrix (flow + block lists, idempotent add, empty removal,
      preservation, malformed). [DES-TEST]

## Phase 3: Write-back (draw-to-author + delete-to-remove)

### 3.1 Protocol + host service

- [x] Add `afxCanvasAuthorRelationship` to protocol; widen `CanvasEdgeProvenance`. [FR-4] [DES-API]
- [x] `doc-graph-author-service.ts`: resolve source, `editFrontmatterList` via
      mutation coordinator (`allowDirty:false`), trust gate, reconcile. [FR-4] [FR-9] [DES-API] [DES-SEC]
- [x] Route in both hosts (`workbench-panel.ts`, `canvas-editor-provider.ts`);
      never drop the request silently. [FR-4]

### 3.2 Authoring gestures

- [x] Connect between two AFX docs → kind-pair relationship; picker when
      ambiguous; confirm; author. Non-AFX pair → manual edge only. [FR-4] [FR-5] [FR-7] [DES-UI]
- [x] Delete generated edge → Remove-from-frontmatter vs Detach-only. [FR-6] [DES-UI]

## Phase 4: Read-only soft links + legibility

### 4.1 Soft links (DEFERRED post-2.4.0)

- [ ] Derive `soft-link` edges from body `@see docs/…` between AFX docs; dashed,
      non-authorable. Provenance kind `soft-link` is reserved in
      `CanvasEdgeProvenance`; derivation + render not yet built. [FR-10] [DES-UI]

### 4.3 Live re-sync (FR-14)

- [x] Webview-driven debounced re-sync on `afxDocContentInvalidated` in Spec Map
      mode; deferred while dirty/pending (conflict-aware). [FR-14] [DES-LIVE]

### 4.2 Legibility

- [ ] Kind/status filters + N-hop isolate + incoming edges in Architecture
      Explorer; empty-state example kept accurate. [FR-11] [FR-12] [DES-UI]

## Phase 5: Verification

### 5.1 Gates

- [ ] Unit (parsers/host/webview) + E2E (author, picker, delete-to-remove,
      soft-link, free-form, widened discovery). [DES-TEST]
- [x] `pnpm verify`, rebuild both bundles, CHANGELOG entry, spec-map registration.

## Work Sessions

| Date                     | Session focus             | Files touched                                  | Outcome                                                                                                                                         |
| ------------------------ | ------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-07-23T15:24:06.000Z | Spec/design/tasks drafted | docs/specs/230-app-workbench-spec-authoring/\* | Draft authored; SA-Q1 (typed) + SA-Q2 (symmetric) resolved; implementation queued.                                                              |
| 2026-07-24T11:49:37.000Z | Adversarial repair pass   | parsers, indexer, author service, both hosts   | Frontmatter edits, author-token resolution, timeout preservation, coordinator sharing, and host response parity hardened with regression tests. |
