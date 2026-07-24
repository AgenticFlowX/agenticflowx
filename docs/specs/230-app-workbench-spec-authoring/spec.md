---
afx: true
type: SPEC
status: Draft
owner: "@rixrix"
version: "0.1"
created_at: "2026-07-23T15:24:06.000Z"
updated_at: "2026-07-23T15:24:06.000Z"
tags:
  [
    "app",
    "workbench",
    "canvas",
    "spec-map",
    "spec-authoring",
    "sdd",
    "traceability",
    "frontmatter",
    "depends_on",
    "graph",
  ]
depends_on:
  [
    "100-package-shared",
    "120-package-parsers",
    "130-package-ui",
    "200-app-vscode",
    "227-app-workbench-shell",
    "229-app-workbench-canvas",
  ]
---

# App Workbench Spec Authoring — Product Specification

The authorable afx documentation graph: see every spec, design, task, journal,
sprint, ADR, and research document as spatial nodes, and author the
relationships between them by drawing arrows — writing the relationship back
into the source document's frontmatter.

## References

- **Host surface**: [App Workbench Canvas](../229-app-workbench-canvas/spec.md) — Spec Map mode is the home for this feature; this spec extends it.
- **Computed traceability sibling**: [App Workbench Impact Lens](../228-app-workbench-impact-lens/spec.md) — owns _computed, read-only_ reverse code/test/evidence traceability and will reuse Canvas's graph projection. This spec owns _authored, editable_ document relationships. The boundary is load-bearing (see Non-Goals).
- **Frontmatter parsing**: [Package Parsers](../120-package-parsers/spec.md) — the `parseFrontmatter` contract; this spec adds a surgical frontmatter list editor beside it.
- **Doc classification**: `packages/shared/src/sdd.ts` `classifySddDocumentPath` already recognizes all seven SDD kinds and the `docs/adr/` and `docs/research/` locations.
- **AFX frontmatter schema**: `AGENTS.md` → "AFX Frontmatter Schema" — the `afx: true` marker plus `type:` field identify an AFX-owned document.

---

## Problem Statement

AFX's whole premise is that documents govern the work: a spec declares intent,
a design records the how, an ADR pins a decision, research captures
exploration. These documents already carry machine-readable relationships in
their frontmatter — most visibly `depends_on` — but there has been no way to
_see_ the graph they form or to _author_ it without hand-editing YAML.

Spec Map (FR-25/FR-26 in 229) took the first step: it reads `depends_on` from
`spec.md`/Sprint files and draws a read-only dependency graph. But it is
one-directional (read, never write), narrow (only specs and sprints), and gives
a first-time user no idea how to create a dependency — the empty state can only
say "edit the frontmatter and re-sync."

The gap this fills: make the canvas the place where the entire AFX document
graph is both **seen** (a bird's-eye map across all doc kinds) and **authored**
(draw an arrow → the relationship is written into the source document's
frontmatter, then reconciled back onto the map). This is the authoring half of
"spec-driven development meets spatial thinking"; Impact Lens will later add the
computed _code_ half read-only over the same projection.

The document remains authoritative. Every relationship lives in standard
frontmatter, readable and diffable outside AFX; the canvas is a lens that can
now write through to that source of truth — surgically, confirmably, and never
destructively.

---

## User Stories

### Primary Users

- **Spec authors and architects** mapping how features, packages, and decisions
  relate, who want to declare and revise `depends_on` and other links
  spatially instead of editing YAML by hand.
- **Newcomers to an AFX repo** who need a legible, whole-repo map of specs,
  designs, ADRs, and research to orient before touching anything.
- **Maintainers** auditing the health of the document graph — unresolved,
  ambiguous, cyclic, and orphaned relationships.

### Stories

**As a** spec author **I want** to draw an arrow from one spec card to another
and have it write `depends_on` into the source spec's frontmatter **So that** I
can declare dependencies from the map without hand-editing YAML.

**As an** architect **I want** every AFX document — spec, design, tasks,
journal, sprint, ADR, research — to appear as a distinct, kind-styled node
**So that** the canvas is a true bird's-eye view of the repository's intent,
not just its specs.

**As a** decision owner **I want** to link an ADR to the spec it supersedes or
informs, using the relationship that fits the kind-pair **So that** the graph
records the right semantic, not a generic line.

**As a** maintainer **I want** to delete a dependency edge on the canvas and be
offered removal from the source frontmatter **So that** I can revise the graph
in both directions from one surface.

**As a** careful author **I want** every write to a governed document to be
confirmed, trust-gated, conflict-aware, and formatting-preserving **So that**
authoring from the canvas never silently corrupts a spec or explodes a diff.

**As a** reviewer **I want** to see soft, read-only links inferred from body
`@see` references **So that** the map reflects relationships that exist in prose
even before they are formalized in frontmatter.

**As a** user of any JSON Canvas tool **I want** the relationships to live in
document frontmatter, not canvas-only metadata **So that** the authored graph
survives outside AFX and outside this canvas file.

---

## Requirements

### Functional Requirements

| ID    | Requirement                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Priority    |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------- |
| FR-1  | Index every AFX-owned document (`afx: true` frontmatter) across `docs/**` in all workspace roots — the seven SDD kinds `spec`, `design`, `tasks`, `journal`, `sprint`, `adr`, `research` — keyed by the frontmatter marker and `type`, not by folder; excluding `_archive`/`.git`/`node_modules`, with no cap. The compact index (id, title, kind, source, declared relationships; no file content) powers the Add-spec picker, dependency badges, and edge resolution. It is NOT rendered as a node per document. | Must Have   |
| FR-2  | The map holds only documents the user added (the Add-spec picker) or expanded (a dependency badge). Sync never auto-generates a node per discovered document; it draws typed relationship edges only between documents already present on the canvas, so a large repository is never dumped. Nodes are kind-styled (icon per kind, status-derived accent); reconciliation is idempotent and never moves or deletes manual content, and legacy auto-generated nodes are cleared on reconcile.                       | Must Have   |
| FR-3  | Generate typed relationship edges from frontmatter list fields: `depends_on` (spec/sprint → spec), `supersedes` (adr → adr, spec → spec), and `relates_to` (generic cross-kind, includes research → spec/design "informs"). Each generated edge carries typed provenance identifying its relationship and owner. Unresolved, ambiguous, and cyclic links are surfaced distinctly.                                                                                                                                  | Must Have   |
| FR-4  | Draw-to-author: connecting two AFX-document nodes writes the kind-appropriate relationship into the **source** document's frontmatter (the node the edge starts from), then reconciles the map so the edge becomes a generated typed edge. The write is a surgical frontmatter edit through the mutation coordinator.                                                                                                                                                                                              | Must Have   |
| FR-5  | Relationship picker: when a kind-pair permits more than one valid relationship, prompt the user to choose (e.g. spec → spec may be `depends_on` or `supersedes`); when exactly one is valid, use it without prompting. Every write is preceded by an explicit confirmation naming the document, field, and entry.                                                                                                                                                                                                  | Must Have   |
| FR-6  | Delete-to-remove (symmetric authoring): deleting a generated relationship edge offers, with confirmation, to remove that entry from the source document's frontmatter list, alongside the existing detach-only option. Removal is surgical and preserves surrounding frontmatter.                                                                                                                                                                                                                                  | Must Have   |
| FR-7  | An edge whose endpoints are not both AFX documents (a plain card, an external file, a non-AFX markdown) is a free-form manual edge: it renders normally and writes nothing to any frontmatter.                                                                                                                                                                                                                                                                                                                     | Must Have   |
| FR-8  | Surgical frontmatter editing MUST add or remove a single list entry in a named key while preserving key order, indentation, quoting style, comments, and unrelated content — never a full YAML round-trip. If the key is absent it is created in a deterministic location; if the resulting list is empty the key is removed.                                                                                                                                                                                      | Must Have   |
| FR-9  | Every write-back is gated by workspace trust, refused when the target document has unsaved editor changes (conflict-aware), idempotent (re-authoring an existing link is a no-op success), and leaves VS Code native undo able to revert the document edit.                                                                                                                                                                                                                                                        | Must Have   |
| FR-10 | Generate read-only "soft link" edges (visually distinct, dashed, never authored or written) from body `@see docs/…` references between AFX documents, so relationships expressed only in prose are visible on the map. Soft links never participate in draw-to-author or delete-to-remove.                                                                                                                                                                                                                         | Should Have |
| FR-11 | Provide graph legibility controls reusing the Architecture Explorer surface: filter by kind and by status, and isolate the N-hop neighborhood of a selected document. Incoming ("depended-on-by") as well as outgoing relationships are discoverable.                                                                                                                                                                                                                                                              | Should Have |
| FR-12 | The empty Spec Map state teaches the mechanism with a concrete, copyable frontmatter example and a one-click Sync, and clears as soon as generated document nodes exist (not only when dependency edges exist).                                                                                                                                                                                                                                                                                                    | Must Have   |
| FR-13 | `journal` documents are never authoring participants. They are discovered and rendered as nodes and may carry read-only soft links, but any edge a user draws to or from a journal node is a plain free-form manual edge (FR-7) that writes nothing — journals are agent-driven session logs, not hand-authored relationship stores.                                                                                                                                                                               | Must Have   |
| FR-14 | Bidirectional live reconciliation: the map reacts to external changes to any discovered document (a human or an LLM agent editing frontmatter behind the canvas), not only to canvas-initiated writes. On a debounced file change under `docs/**`, re-run discovery/generation and push the reconciled canvas non-destructively, preserving manual nodes/edges and suspending only while the canvas has unsaved local edits (then reconciling on resolve).                                                         | Must Have   |

### Non-Functional Requirements

| ID    | Requirement                | Target                                                                                                                                                                                            |
| ----- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NFR-1 | Source-of-truth integrity  | Relationships are stored only in document frontmatter. The canvas holds a reconciled projection plus optional presentation metadata; deleting the `.canvas` file loses no authored relationship.  |
| NFR-2 | Portability / losslessness | Every canvas validates as JSON Canvas 1.0 and round-trips through other tools; typed provenance is namespaced and optional. Frontmatter edits keep documents valid YAML and human-diffable.       |
| NFR-3 | Write safety               | No write-back path can corrupt a document, reorder unrelated keys, drop comments, or overwrite a concurrent edit. Trust, confirmation, and conflict checks precede every mutation.                |
| NFR-4 | Determinism                | Discovery, generation, and reconciliation are deterministic and idempotent: identical inputs yield an identical map and identical frontmatter; re-sync never duplicates nodes, edges, or entries. |
| NFR-5 | Architecture boundaries    | Discovery/graph/frontmatter-edit services live in `apps/vscode` and `packages/parsers`; the projection and interactions live in `apps/workbench`; shared protocol/types in `@afx/shared`.         |
| NFR-6 | Performance                | At 300 documents with 600 relationships, a full Sync completes within 2 s on reference hardware, and draw-to-author round-trips (confirm → write → reconcile) within 500 ms after confirmation.   |
| NFR-7 | Accessibility & clarity    | Relationship picker, confirmations, and kind/status styling are keyboard-navigable, screen-reader labeled, and legible in both themes at the documented viewport.                                 |

---

## Success Measures

- A newcomer to an AFX repo can open Spec Map, Sync, and get a legible,
  kind-styled map of the whole `docs/` graph with zero configuration.
- An author can declare a `depends_on` (or `supersedes`/`relates_to`)
  relationship end-to-end from the canvas — draw, confirm, done — without ever
  opening the YAML.
- Every authored relationship is present, correctly typed, and human-diffable in
  the source document's frontmatter, and survives deleting the canvas file.
- Zero reports of frontmatter corruption, key reordering, or comment loss from
  write-back.

## Acceptance Criteria

### Discovery & Generation

- [ ] All seven AFX doc kinds across `docs/**` (all roots) appear as kind-styled
      nodes after Sync; `_archive` and ignored trees are excluded; no cap.
- [ ] `depends_on`, `supersedes`, and `relates_to` produce correctly typed,
      provenance-tagged edges; unresolved/ambiguous/cyclic links are visibly
      distinct; re-sync is idempotent and preserves manual content.

### Authoring (write-back)

- [ ] Drawing an arrow between two AFX docs writes the kind-appropriate entry
      into the source frontmatter after an explicit confirmation, then the edge
      reconciles to a generated typed edge.
- [ ] A kind-pair with multiple valid relationships prompts a picker; a
      single-valid pair does not.
- [ ] Deleting a generated edge offers frontmatter removal and detach-only;
      removal is surgical.
- [ ] Free-form edges (non-AFX endpoints) write nothing.

### Write Safety

- [ ] Frontmatter add/remove preserves key order, indentation, quoting, and
      comments; empty list removes the key; absent key is created deterministically.
- [ ] Write-back is trust-gated, refused on a dirty target, idempotent, and
      revertible via native undo on the document.

### Read-only & Legibility

- [ ] Body `@see` references between AFX docs render as dashed soft links that
      never author or remove frontmatter.
- [ ] Kind/status filters and N-hop isolate operate over the doc graph; incoming
      relationships are discoverable.
- [ ] The empty state shows a copyable frontmatter example and clears once
      generated document nodes exist.

---

## Non-Goals (Out of Scope)

- **Computed code/test/evidence traceability.** Which source files implement a
  requirement, which tests cover it, stale `@see`, and orphan-source detection
  belong to Impact Lens (228), which will consume this graph's projection
  read-only. This spec authors _document-to-document_ relationships only; it does
  not read or draw the code graph. The 228 spec already assigns editable
  `depends_on` to Canvas and computed reverse traceability to Impact Lens; this
  spec keeps that boundary.
- **Inferring relationships from imports or the build graph.** Relationships are
  only what a document's frontmatter or body `@see` declares. No static-analysis
  seeding of `depends_on`.
- **Configurable spec roots beyond `docs/`.** Discovery targets `docs/**` per
  AFX convention. A configurable root set is a possible follow-up, not part of
  this spec.
- **New document creation from the graph.** Authoring edits relationships on
  existing documents; scaffolding new specs/ADRs remains `/afx-scaffold`'s job.
- **Non-frontmatter relationship stores.** Relationships are frontmatter lists;
  this spec does not introduce a sidecar graph file.

## Open Questions

| ID    | Question                                                         | Status   | Resolution                                                                                                                            |
| ----- | ---------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| SA-Q1 | Relationship vocabulary — single `depends_on` or typed set?      | Resolved | Typed set: `depends_on`, `supersedes`, `relates_to` (research→ counts as `relates_to`/"informs"). Picker only when pair is ambiguous. |
| SA-Q2 | Delete-to-remove — should deleting an edge write to frontmatter? | Resolved | Yes, symmetric authoring with confirmation; detach-only remains available.                                                            |
| SA-Q3 | Which frontmatter key carries the generic cross-kind link?       | Resolved | `relates_to`. Confirmed by owner.                                                                                                     |
| SA-Q4 | Should authoring leave a journal breadcrumb for provenance?      | Resolved | No. Journals are agent-driven and out of the authoring path (FR-13); native document undo covers reversibility.                       |

## Dependencies

- **229 Canvas** — Spec Map mode, React Flow projection, edge provenance/detach
  model, mutation coordinator, confirm-dialog pattern, Architecture Explorer.
- **120 Parsers** — `parseFrontmatter`; this spec adds the surgical list editor.
- **100 Shared** — `sdd.ts` doc classification; workbench protocol/types.
- **200 app-vscode** — host file-state, mutation coordinator, workspace trust.

## Appendix

### Relationship model (kind-pair → field)

| Source kind  | Target kind  | Relationship | Frontmatter key |
| ------------ | ------------ | ------------ | --------------- |
| spec, sprint | spec         | depends on   | `depends_on`    |
| spec         | spec         | supersedes   | `supersedes`    |
| adr          | adr          | supersedes   | `supersedes`    |
| research     | spec, design | informs      | `relates_to`    |
| any AFX      | any AFX      | relates to   | `relates_to`    |

When more than one row matches a drawn pair, FR-5's picker chooses; otherwise the
single match applies.
