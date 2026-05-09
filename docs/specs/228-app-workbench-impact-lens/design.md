---
afx: true
type: DESIGN
status: Approved
owner: "@rixrix"
version: "0.1"
created_at: "2026-05-03T03:28:22.000Z"
updated_at: "2026-05-09T12:21:59.000Z"
tags: ["app", "workbench", "impact-lens", "traceability", "intent-ledger"]
spec: spec.md
---

# App Workbench Impact Lens - Technical Design

---

## [DES-OVR] Overview

Impact Lens will be the Workbench child surface for reverse traceability and
verification context. This design is a landing-zone draft that reserves UI,
protocol, and traceability ownership before the upstream sprint brief graduates.

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
      |
      v
Impact Lens
  metrics · filters · node/file list · details · open/verify actions
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

---

## [DES-DEC] Key Decisions

| Decision        | Options Considered                     | Choice            | Rationale                                                       |
| --------------- | -------------------------------------- | ----------------- | --------------------------------------------------------------- |
| Workbench route | Analytics badge, own tab               | Own tab           | Reverse traceability is broad enough to deserve a full surface. |
| Index location  | Workbench UI, VSCode host/pure package | Host/pure package | Webview cannot read files and indexing must be testable.        |
| Data flow       | Untyped payload, shared types          | Shared types      | Keeps bridge contract stable and inspectable.                   |

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

Final payload types will be added during graduation. The expected model includes
trace nodes, source references, target refs, health states, metrics, issue rows,
and verification packet state.

---

## [DES-API] API Contracts

Future inbound payloads should travel through `WorkbenchInbound` update messages.
Future outbound actions should reuse `afxOpenFile` and add typed Impact
selection/refresh/verify messages only when required.

---

## [DES-FILES] File Structure

| File                                        | Purpose                              |
| ------------------------------------------- | ------------------------------------ |
| `apps/workbench/src/views/impact-lens.tsx`  | Future Workbench tab UI              |
| `packages/shared/src/workbench-types.ts`    | Future Impact Lens payload types     |
| `packages/shared/src/workbench-protocol.ts` | Future Impact Lens protocol messages |
| `apps/vscode/src/services/*impact*`         | Future host index/feed service       |

---

## [DES-DEPS] Dependencies

- `227-app-workbench-shell` for tab registration.
- `203-app-vscode-see-navigation` for existing `@see` syntax and resolver behavior.
- `100-package-shared` for typed payload/protocol ownership.

---

## [DES-SEC] Security Considerations

Indexing is local-first. Verification packets must cap excerpts, avoid
secret-looking values, and require explicit user action before dispatch.

---

## [DES-ERR] Error Handling

Impact Lens must keep the last successful payload visible during refresh, show
partial parse/read failures with copy/open-logs actions, and render fatal errors
with retry and copy-details actions.

---

## [DES-TEST] Testing Strategy

Future tests should include pure parser/index fixtures, host service refresh
behavior, Workbench UI states, editor Show Impact command behavior, and mocked
agent verification dispatch.

---

## [DES-ROLLOUT] Migration / Rollout Plan

1. Graduate the upstream sprint brief into this folder when implementation starts.
2. Add typed shared payloads and host index service.
3. Add Workbench shell tab route.
4. Retarget new implementation `@see` links to this child spec.

---

## [DES-IMPACT-LOC] Code Locator Map (placeholder until built)

| Map ID             | Code anchor (planned)                                                    | Messages/data                           | Tests   |
| ------------------ | ------------------------------------------------------------------------ | --------------------------------------- | ------- |
| `[Impact.View]`    | `apps/workbench/src/views/impact.tsx` `ImpactView` (not yet implemented) | `ImpactLensData`                        | not yet |
| `[Impact.Service]` | `apps/vscode/src/services/impact-lens-data.ts` (not yet implemented)     | feeds `afxUpdate.impactLens`            | not yet |
| `[Impact.Ledger]`  | `packages/intent-ledger/` package (not yet implemented)                  | pure scan -> ImpactNode/ImpactSourceRef | not yet |

## [DES-IMPACT-TRACE] Functional Trace Matrix (placeholder until built)

| Requirement | Design nodes                                 | Code anchors (planned)                     | Verification |
| ----------- | -------------------------------------------- | ------------------------------------------ | ------------ |
| FR-1..FR-5  | `[DES-IMPACT-MOCKUP]`, `[DES-IMPACT-DATA]`   | future Impact view + ledger pure functions | future       |
| FR-9..FR-12 | `[DES-IMPACT-STATES]`, `[DES-IMPACT-DETAIL]` | future selection / verify dispatch         | future       |

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
