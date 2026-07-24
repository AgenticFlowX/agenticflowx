---
afx: true
type: DESIGN
status: Approved
owner: "@rixrix"
version: "0.2"
created_at: "2026-05-03T03:28:22.000Z"
updated_at: "2026-07-19T03:39:36.000Z"
tags:
  [
    "app",
    "workbench",
    "impact-lens",
    "traceability",
    "intent-ledger",
    "read-only",
    "canvas-projection",
  ]
spec: spec.md
---

# App Workbench Impact Lens - Technical Design

---

## [DES-OVR] Overview

Impact Lens is the approved Workbench boundary for computed reverse
traceability and verification context. Implementation remains future work, but
its ownership is explicit now: it may reuse Canvas graph projection components
only in read-only mode and never owns writable Canvas documents or declared
spec dependencies.

---

## [DES-ARCH] Architecture

```text
apps/vscode host
  scan docs/source/test files
  build or refresh Intent Ledger payload
      |
      v
packages/shared
  typed Impact Lens payload + Workbench protocol
      |
      v
apps/workbench
  Workbench shell tab -> Impact Lens view
  optional read-only Canvas graph projection adapter
      |
      v
Impact Lens
  metrics · filters · node/file list · details · open/verify actions
```

```text
computed Intent Ledger graph -> ImpactGraphProjection adapter -> shared Canvas renderer (readOnly)
                                                               - no connect handles
                                                               - no drag persistence
                                                               - no Canvas mutation messages

editable .canvas files / depends_on authoring -----------------> 229 only
```

---

## [DES-UI] User Interface & UX

### [DES-IMPACT-MOCKUP] Impact Lens ASCII

```text
┌──────────────────────── Impact Lens ───────────────────────────────────────────────┐
│ Coverage 82% · 614 refs · 12 ghost · 8 stale · 21 orphan candidates    [Refresh]   │
│ [All] [Ghost] [Stale] [Missing] [Orphan] [Unverified]   [Search intent/source...]  │
├──────────── nodes/files/issues ────────────┬──────────────── selected impact ──────┤
│ FR-4 Notes timeline              covered   │ docs/specs/224.../spec.md [FR-4]     │
│ DES-ANALYTICS-HEATMAP            covered   │ Linked source:                         │
│ apps/workbench/src/views/foo.tsx orphan    │  - analytics.tsx:Heatmap               │
│ docs/specs/old/path.md           ghost     │ Linked tests:                          │
│                                           │  - analytics.test.ts                   │
│                                           │ Issues: none                           │
│                                           │ [Open doc] [Open source] [Verify]      │
└───────────────────────────────────────────┴───────────────────────────────────────┘
States: first-load · refreshing · partial · empty · fatal · verification pending/success/failure
```

### [DES-IMPACT-STATES] Impact Lens States

The view must explicitly render first-load, ready, refreshing, partial-success,
empty, fatal-error, verification-pending, verification-success, and
verification-failure states.

### [DES-IMPACT-DETAIL] Impact Detail Pane

The selected detail pane shows upstream node/source identity, linked source
refs, linked tests, linked tasks, issue classification, excerpts, and open/copy/
verify actions.

### [DES-IMPACT-CANVAS-BOUNDARY] Read-Only Canvas Projection Boundary

After `229` stabilizes its graph projection API, Impact Lens may render the
computed dependency/trace graph through that component with `readOnly: true`,
`nodesDraggable: false`, `nodesConnectable: false`, and mutation callbacks
omitted. Selection and viewport may be local view state; node positions may be
ephemeral layout output. Impact Lens must not load a user `.canvas` document as
its writable model, persist positions/edges, edit `depends_on`, or expose AFX
Canvas command execution.

---

## [DES-DEC] Key Decisions

| Decision        | Options Considered                     | Choice            | Rationale                                                       |
| --------------- | -------------------------------------- | ----------------- | --------------------------------------------------------------- |
| Workbench route | Analytics badge, own tab               | Own tab           | Reverse traceability is broad enough to deserve a full surface. |
| Index location  | Workbench UI, VSCode host/pure package | Host/pure package | Webview cannot read files and indexing must be testable.        |
| Data flow       | Untyped payload, shared types          | Shared types      | Keeps bridge contract stable and inspectable.                   |

Impact Lens reuses only a read-only Canvas projection rather than duplicating
the renderer or importing an editable Canvas document. Canvas remains the sole
owner of declared `depends_on` writes; Impact Lens reports computed
relationships and verification evidence.

---

## [DES-DATA] Data Model

### [DES-IMPACT-DATA] Impact Lens Data Shapes (placeholder until built)

Implementation has not landed yet. The shapes below are the contract proposed by
the upstream sprint at
[../../../../docs/specs/001-vscode-impact-lens/001-vscode-impact-lens.md](../../../../docs/specs/001-vscode-impact-lens/001-vscode-impact-lens.md)
[DES-SHARED]. When `packages/shared/src/workbench-types.ts` lands these, each new
type should carry `@see` to this anchor and the corresponding sub-anchor.

| Type (proposed)            | Owns                                                                        | Local @see (target after build)               |
| -------------------------- | --------------------------------------------------------------------------- | --------------------------------------------- |
| `ImpactNode`               | A `[FR-X]` / `[NFR-X]` / `[DES-X]` / task node with classification + refs   | `[DES-IMPACT-DATA]`                           |
| `ImpactSourceRef`          | One `@see` source reference (path, line, target ids, confidence)            | `[DES-IMPACT-DATA]`                           |
| `ImpactSourceFile`         | A scanned source file with status + upstream node ids                       | `[DES-IMPACT-DATA]`                           |
| `ImpactIssue`              | One classified issue (ghost-file, ghost-node, missing, stale, ...)          | `[DES-IMPACT-DATA]` and `[DES-IMPACT-STATES]` |
| `ImpactLensSummary`        | Top-strip metrics: coverage %, ghost/stale, orphans, unverified             | `[DES-IMPACT-DATA]`                           |
| `ImpactLensRuntimeStatus`  | 9-state runtime: `indexing` / `ready` / `refreshing` / `partial` / ...      | `[DES-IMPACT-STATES]`                         |
| `ImpactVerificationStatus` | Coding-agent verification state: `idle`/`verifying`/`verified`/`send-error` | `[DES-IMPACT-STATES]`                         |
| `ImpactLensData`           | Top-level workbench payload combining all of the above                      | `[DES-IMPACT-DATA]`                           |

`ImpactGraphProjection` is a read-only node/edge projection derived from
`ImpactLensData`; it deliberately has no persistence identity or mutation
target and links to `[DES-IMPACT-CANVAS-BOUNDARY]`.

Final payload types will be added during graduation. The expected model includes
trace nodes, source references, target refs, health states, metrics, issue rows,
and verification packet state.

---

## [DES-API] API Contracts

Future inbound payloads should travel through `WorkbenchInbound` update messages.
Future outbound actions should reuse `afxOpenFile` and add typed Impact
selection/refresh/verify messages only when required.

Impact Lens never emits `afxCanvasSave`, `afxCanvasApplyMutation`, Canvas
library lifecycle messages, or a declared-dependency write. If shared graph UI
is reused, all mutation callbacks are absent at the type boundary rather than
being installed as no-ops.

---

## [DES-FILES] File Structure

| File                                        | Purpose                              |
| ------------------------------------------- | ------------------------------------ |
| `apps/workbench/src/views/impact-lens.tsx`  | Future Workbench tab UI              |
| `packages/shared/src/workbench-types.ts`    | Future Impact Lens payload types     |
| `packages/shared/src/workbench-protocol.ts` | Future Impact Lens protocol messages |
| `apps/vscode/src/services/*impact*`         | Future host index/feed service       |

`apps/workbench/src/components/impact/impact-graph-projection.tsx` is
reserved for the future computed-data-to-read-only-graph adapter.

---

## [DES-DEPS] Dependencies

- `227-app-workbench-shell` for tab registration.
- `203-app-vscode-see-navigation` for existing `@see` syntax and resolver behavior.
- `100-package-shared` for typed payload/protocol ownership.
- `229-app-workbench-canvas` only for an optional stabilized read-only graph
  projection component; Impact Lens does not depend on its document store,
  persistence service, action execution, or mutation protocol.

---

## [DES-SEC] Security Considerations

Indexing is local-first. Verification packets must cap excerpts, avoid
secret-looking values, and require explicit user action before dispatch.

---

## [DES-ERR] Error Handling

Impact Lens must keep the last successful payload visible during refresh, show
partial parse/read failures with copy/open-logs actions, and render fatal errors
with retry and copy-details actions.

If the reusable Canvas projection is unavailable or rejects the computed graph,
Impact Lens falls back to its accessible list/detail representation. It must not
open or mutate a `.canvas` file as recovery.

---

## [DES-TEST] Testing Strategy

Future tests should include pure parser/index fixtures, host service refresh
behavior, Workbench UI states, editor Show Impact command behavior, and mocked
agent verification dispatch.

Boundary tests must mount the optional graph projection and assert no Canvas
mutation messages, connect handles, drag persistence, dependency writes, or AFX
action execution are reachable by pointer or keyboard. A contract test should
also prove the list/detail fallback works without importing the Canvas document
store.

---

## [DES-ROLLOUT] Migration / Rollout Plan

1. Graduate the upstream sprint brief into this folder when implementation starts.
2. Add typed shared payloads and host index service.
3. Add Workbench shell tab route and the list/detail surface first.
4. Reuse Canvas projection only after `229` exposes a stable read-only API and
   boundary tests prove there is no writable ownership.
5. Retarget new implementation `@see` links to this child spec.

---

## [DES-IMPACT-LOC] Code Locator Map (placeholder until built)

| Map ID             | Code anchor (planned)                                                    | Messages/data                           | Tests   |
| ------------------ | ------------------------------------------------------------------------ | --------------------------------------- | ------- |
| `[Impact.View]`    | `apps/workbench/src/views/impact.tsx` `ImpactView` (not yet implemented) | `ImpactLensData`                        | not yet |
| `[Impact.Service]` | `apps/vscode/src/services/impact-lens-data.ts` (not yet implemented)     | feeds `afxUpdate.impactLens`            | not yet |
| `[Impact.Ledger]`  | `packages/intent-ledger/` package (not yet implemented)                  | pure scan -> ImpactNode/ImpactSourceRef | not yet |

## [DES-IMPACT-TRACE] Functional Trace Matrix (placeholder until built)

| Requirement | Design nodes                               | Code anchors (planned)                     | Verification |
| ----------- | ------------------------------------------ | ------------------------------------------ | ------------ |
| FR-1..FR-5  | `[DES-IMPACT-MOCKUP]`, `[DES-IMPACT-DATA]` | future Impact view + ledger pure functions | future       |

| Requirement | Design nodes                   | Code anchors                        | Verification   |
| ----------- | ------------------------------ | ----------------------------------- | -------------- |
| FR-9        | `[DES-IMPACT-CANVAS-BOUNDARY]` | Future read-only projection adapter | Boundary tests |

The implementation graduates per the upstream sprint at
`docs/specs/001-vscode-impact-lens/001-vscode-impact-lens.md`. Until it lands, this zone routes
existing reverse-trace work to the upstream brief.

---

## [DES-REFS] File Reference Map

| File                                        | Required @see                                                                                     |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `apps/workbench/src/views/impact-lens.tsx`  | `spec.md [FR-1] [FR-7]` + `design.md [DES-IMPACT-MOCKUP] [DES-IMPACT-STATES] [DES-IMPACT-DETAIL]` |
| `packages/shared/src/workbench-types.ts`    | `spec.md [FR-6]` + `design.md [DES-DATA]`                                                         |
| `packages/shared/src/workbench-protocol.ts` | `spec.md [FR-6]` + `design.md [DES-API]`                                                          |

| File                                                               | Required @see                                              |
| ------------------------------------------------------------------ | ---------------------------------------------------------- |
| `apps/workbench/src/components/impact/impact-graph-projection.tsx` | `spec.md [FR-9]`; `design.md [DES-IMPACT-CANVAS-BOUNDARY]` |
