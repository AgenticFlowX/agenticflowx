---
afx: true
type: DESIGN
status: Draft
owner: "@rixrix"
version: "0.1"
created_at: "2026-07-23T15:24:06.000Z"
updated_at: "2026-07-23T15:24:06.000Z"
spec: spec.md
tags: ["app", "workbench", "canvas", "spec-authoring", "sdd", "frontmatter", "graph"]
---

# App Workbench Spec Authoring — Technical Design

## [DES-OVR] Overview

This feature generalizes the existing read-only `spec-dependency-indexer` into a
bidirectional **document-graph** subsystem and adds a **surgical frontmatter
editor** so a canvas gesture can write a relationship back into a governed
document.

Three layers, mapped to the existing architecture boundaries:

1. **Discovery + generation (host, `apps/vscode`)** — a generalized
   `doc-graph-indexer` discovers every `afx: true` document under `docs/**`,
   builds the typed relationship graph from frontmatter, and reconciles it onto
   the canvas idempotently and non-destructively (the current
   `spec-dependency-indexer` behavior, widened).
2. **Frontmatter write-back (host + `packages/parsers`)** — a new
   `editFrontmatterList` utility performs a surgical add/remove of one entry in a
   named list key, and a new `afxCanvasAuthorRelationship` protocol message
   drives it through the mutation coordinator with trust/confirm/conflict guards.
3. **Authoring UX (webview, `apps/workbench`)** — the React Flow surface maps a
   connect gesture between two AFX-doc nodes to a relationship (with a picker when
   ambiguous), a delete gesture to a symmetric removal offer, and styles nodes by
   kind and status.

The document is authoritative throughout; the canvas is a reconciled lens that
can now write through to frontmatter.

## [DES-ARCH] Architecture

```text
                 Sync / draw / delete
Workbench (webview)  ─────────────────────────►  apps/vscode host
  ReactFlowCanvas                                   handleMessage
   - connect gesture ─► afxCanvasAuthorRelationship ─► DocGraphAuthorService
   - delete edge     ─► (relationship, remove?)          - resolve source doc
   - Sync            ─► afxCanvasRefreshDependencies      - editFrontmatterList()  (@afx/parsers)
                                                          - mutationCoordinator.mutateText(specUri)
                                                          - re-run indexer.refresh(canvas)
   ◄─ afxCanvasDocument (reconciled) ─────────────────────┘
   ◄─ afxMutationResult (author/remove outcome) ──────────┘
```

- **DocGraphIndexer** (generalize `spec-dependency-indexer.ts`): discovery glob
  widens from `**/docs/specs/**/*.md` to `**/docs/**/*.md` (minus `_archive`,
  `.git`, `node_modules`); a document qualifies when `parseFrontmatter().data.afx === true`
  and `type` maps to an SDD kind (reuse `classifySddDocumentPath` for kind/feature).
  Generation emits one node per doc and one edge per frontmatter relationship
  across all three keys.
- **editFrontmatterList** (new in `@afx/parsers`): pure string→string surgical
  editor; no host or VS Code dependency; unit-testable in isolation.
- **DocGraphAuthorService** (new in `apps/vscode`): given (sourceDoc, targetKey,
  relationship, remove?), reads the source via file-state, applies
  `editFrontmatterList`, and writes through the mutation coordinator.

## [DES-DATA] Data Model

### Relationship keys and provenance

Three frontmatter list keys carry authored relationships:

- `depends_on: [<doc-id>, …]` — spec/sprint → spec
- `supersedes: [<doc-id>, …]` — adr → adr, spec → spec
- `relates_to: [<doc-id>, …]` — generic cross-kind (research "informs" folds here)

`<doc-id>` is the target document's folder identity (e.g. `110-package-cart`),
matching the existing `depends_on` resolution (`normalizeDependency` +
`aliases`), extended so ADR/research docs resolve by their stable id too.

Generated edge provenance widens the existing `CanvasEdgeProvenance`:

```ts
export interface CanvasEdgeProvenance {
  version: 1;
  kind: "declared-dependency" | "declared-relationship" | "soft-link";
  relationship?: "depends_on" | "supersedes" | "relates_to"; // for declared-relationship
  owner: string; // source doc id (the frontmatter that carries the entry)
  detached?: boolean;
  generatedEdgeId?: string;
  suppressionKey?: string;
}
```

`declared-dependency` is retained as the existing `depends_on` value for
backward compatibility; new typed edges use `declared-relationship` +
`relationship`. `soft-link` marks read-only `@see`-derived edges (FR-10), which
are never authored.

### Node metadata

Generated document nodes extend the existing `afxSpec` block into a kind-aware
`afxDoc`:

```ts
afxDoc?: {
  version: 1;
  kind: "spec" | "design" | "tasks" | "journal" | "sprint" | "adr" | "research";
  status?: string;      // from frontmatter `status`
  id: string;           // folder identity
};
```

`afxSpec` is kept as an alias for `documentKind: "spec"` nodes so existing
canvases and 229 code keep working.

## [DES-API] API Contracts

### Protocol (`@afx/shared` `workbench-protocol.ts`)

```ts
| {
    type: "afxCanvasAuthorRelationship";
    requestId: string;
    source: WorkbenchSourceIdentity;   // the document that will own the entry
    targetId: string;                  // resolved target doc id
    relationship: "depends_on" | "supersedes" | "relates_to";
    remove?: boolean;                  // true = delete-to-remove (FR-6)
    expectedRevision?: string;         // conflict guard on the source doc
  }
```

Result reuses `WorkbenchMutationResult` (`afxMutationResult`). On success the
host follows with a reconciled `afxCanvasDocument`/`afxCanvasEditorDocument`
push so the drawn edge becomes a generated typed edge. Failure codes reuse the
existing union, adding no new terminal states beyond those already present
(`untrusted-workspace`, `dirty-document`, `stale-revision`, `not-found`,
`write-failed`, `capability-unavailable`, `cancelled`).

### Frontmatter editor (`@afx/parsers` `frontmatter-edit.ts`)

```ts
export function editFrontmatterList(
  raw: string,
  key: string,
  entry: string,
  op: "add" | "remove",
): { content: string; changed: boolean };
```

Rules (FR-8):

- Operates only on the opening frontmatter block; body is untouched.
- `add`: no-op success if `entry` already present (idempotent, FR-9). Otherwise
  append to the existing list preserving its flow (`[a, b]`) or block (`- a`)
  style; if `key` is absent, insert it after the last known schema key
  (`tags`/`depends_on` region) in block style.
- `remove`: drop the matching entry; if the list becomes empty, remove the key
  line entirely.
- Never re-serializes unrelated keys; preserves indentation, quoting, and
  comment lines. Implemented as a line-scoped text transform over the
  frontmatter region, not a YAML load→dump.

### Host author service (`apps/vscode` `doc-graph-author-service.ts`)

```ts
interface DocGraphAuthorService {
  author(request: {
    requestId: string;
    source: WorkbenchSourceIdentity;
    targetId: string;
    relationship: "depends_on" | "supersedes" | "relates_to";
    remove?: boolean;
    expectedRevision?: string;
  }): Promise<WorkbenchMutationResult>;
}
```

Flow: resolve source URI via file-state → `mutationCoordinator.mutateText` with
`allowDirty: false` (conflict-aware), whose `transform` applies
`editFrontmatterList` → on success the caller re-runs the indexer refresh to
reconcile. Workspace-trust is checked before the mutation (reuse the existing
`resolveProjectTrust`/trust gating path used by other canvas writes).

## [DES-UI] User Interface & UX

- **Connect gesture** (`react-flow-canvas.tsx` `connect`): if both endpoints are
  authoring-eligible AFX-doc nodes, intercept the default manual-edge write;
  compute the valid relationships for the kind-pair (see spec Appendix table).
  One valid → confirm dialog naming doc/field/entry → `afxCanvasAuthorRelationship`.
  More than one → relationship picker (styled `@afx/ui` menu) → confirm → author.
  A `journal` endpoint (FR-13) or any non-AFX endpoint (FR-7) is **not**
  authoring-eligible → fall through to the existing manual-edge path (writes
  nothing).
- **Delete gesture** on a generated relationship edge: the existing detach model
  gains a "Remove from frontmatter" option (FR-6) — an AlertDialog with
  **Remove** (authors removal) and **Detach only** (current visual detach).
- **Node styling** (`canvas-flow-node.tsx` + `canvas-node-visuals.ts`): kind icon
  via `canvas-semantic-icon`, status→border tint from `afxDoc.status`
  (Draft/Approved/Living/Superseded).
- **Soft links** (FR-10): dashed, muted edges with a "relates (from @see)" label,
  rendered from `soft-link` provenance; not connectable/removable as authored.
- **Legibility** (FR-11): reuse Architecture Explorer's depth/isolate and add
  kind/status filters; expose incoming edges in the explorer list.
- **Empty state** (FR-12): the improved copyable-example card already landed in
  229; this spec extends its clear-condition to "generated document nodes exist"
  (already implemented) and keeps the example accurate for the widened graph.

### [DES-LIVE] Bidirectional live reconciliation (FR-14)

Authoring is only one direction; the map must also follow the documents. The
host already watches source files via `fileState.onDidChange`. This feature
subscribes the Spec Map to changes under `docs/**`: on a debounced change
(≈250 ms) to any discovered document, re-run `doc-graph-indexer.refresh` against
the current canvas and push the reconciled `afxCanvasDocument`. Because
generation is idempotent and non-destructive, an agent editing a spec's
`depends_on` behind the canvas surfaces as new/updated generated edges without
disturbing manual content. Guard: while the canvas has unsaved local edits
(dirty/pendingSave) or a layout preview is active, the reconcile is deferred and
runs once that resolves, so a background file change never clobbers in-flight
user work. Canvas→file (authoring) and file→canvas (this) share the same
non-destructive reconcile, so the two directions converge on the frontmatter as
the single source of truth (NFR-1, NFR-4).

## [DES-DEC] Key Decisions

<!-- @see spec.md [FR-3] [FR-4] [FR-5] [FR-6] [FR-8] -->

- **Typed vocabulary, minimal set.** `depends_on`/`supersedes`/`relates_to`
  cover the real kind-pairs without an open-ended ontology; the picker only
  appears when a pair is genuinely ambiguous (spec→spec). Resolves SA-Q1.
- **Symmetric authoring.** Delete offers frontmatter removal so the canvas is a
  full editor, not an append-only one; detach-only is preserved for
  visual-only intent. Resolves SA-Q2.
- **Surgical text edit, never YAML round-trip.** Governed documents must keep
  key order, comments, and formatting; a load→dump would reflow every file and
  destroy diffs. The editor is a line-scoped transform (FR-8) with its own
  exhaustive unit suite.
- **Frontmatter is the only store.** No sidecar graph. Relationships survive
  outside AFX and outside the canvas file (NFR-1), and any JSON Canvas tool
  still round-trips the map.
- **Boundary with Impact Lens.** This spec authors doc↔doc relationships; Impact
  Lens computes code/test reverse traceability read-only over the same
  projection. The 228 spec already codifies this split.

## [DES-FILES] File Structure

```text
packages/parsers/src/
  frontmatter-edit.ts            # NEW surgical list editor + tests
apps/vscode/src/services/
  doc-graph-indexer.ts           # RENAMED/generalized spec-dependency-indexer
  doc-graph-author-service.ts    # NEW write-back service + tests
apps/vscode/src/panels/workbench-panel.ts          # route afxCanvasAuthorRelationship
apps/vscode/src/editors/canvas-editor-provider.ts  # route afxCanvasAuthorRelationship
packages/shared/src/
  workbench-protocol.ts          # afxCanvasAuthorRelationship
  workbench-types.ts             # afxDoc, widened CanvasEdgeProvenance
apps/workbench/src/components/canvas/
  react-flow-canvas.tsx          # connect/delete → author; picker
  nodes/canvas-flow-node.tsx     # kind/status styling
  canvas-flow-edge.tsx           # declared-relationship + soft-link render
  canvas-app.tsx                 # relationship picker + confirm wiring
apps/workbench/src/lib/json-canvas-react-flow.ts   # project typed provenance + soft links
```

## [DES-SEC] Security Considerations

- Write-back only touches files inside an open, **trusted** workspace root;
  untrusted workspaces get `untrusted-workspace` and no write.
- The mutation coordinator's dirty/stale-revision guards prevent clobbering a
  concurrent edit; `remove` and `add` are both idempotent.
- `editFrontmatterList` never executes document content and never touches the
  body; a malformed frontmatter block yields `changed: false` (no write), never a
  partial corruption.

## [DES-TEST] Testing Strategy

- **Unit (`@afx/parsers`)**: `editFrontmatterList` matrix — add to flow list, add
  to block list, create absent key, idempotent add, remove middle/last entry,
  empty-list key removal, comment/quote/indent preservation, malformed-block
  no-op.
- **Unit (host)**: `doc-graph-indexer` discovers all kinds across `docs/**`,
  excludes `_archive`, generates typed edges, idempotent re-sync;
  `doc-graph-author-service` add/remove/idempotent/dirty-refusal/trust-refusal.
- **Unit (webview)**: connect maps kind-pair → relationship/picker; delete offers
  removal; non-AFX pair writes a manual edge only.
- **E2E**: draw spec→spec dependency (author outbound assert + reconciled edge),
  picker path (spec→spec ambiguous), delete-to-remove, soft-link render,
  non-AFX free-form edge writes nothing, widened discovery renders multiple
  kinds.

## [DES-ROLLOUT] Migration / Rollout Plan

- Ships in 2.4.0 as an extension of Spec Map; no flag beyond the existing canvas
  experiment gate.
- `spec-dependency-indexer` → `doc-graph-indexer` is a superset; existing
  `depends_on` maps and `declared-dependency` provenance keep working. Existing
  `.canvas` files re-sync cleanly with no migration.
- Backwards-compatible protocol/types additions only.
