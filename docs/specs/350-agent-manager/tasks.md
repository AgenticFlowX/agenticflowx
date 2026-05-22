---
afx: true
type: TASKS
status: Living
owner: "@rixrix"
version: "1.0"
created_at: "2026-05-02T23:56:50.000Z"
updated_at: "2026-05-22T05:56:29.000Z"
tags: ["agent", "runtime", "manager"]
spec: spec.md
design: design.md
---

# Agent Manager - Implementation Tasks

---

## Task Numbering Convention

- **1.x** - Source retargeting
- **2.x** - Future manager work
- **3.x** - Verification

---

## Phase 1: Source Retargeting

### 1.1 Retarget Agent Manager Files

- [ ] Replace retired chat/Pi plan refs in shared contracts and VSCode manager files
- [ ] Keep Pi adapter refs pointed at `351-agent-pi`

---

## Phase 2: Future Manager Work

### 2.1 Runtime Selection Updates

- [ ] Update requirements before changing runtime/provider selection
- [ ] Add tests for status and fallback behavior

---

## Phase 3: Verification

### 3.1 Verify Manager Routing

- [ ] Run stale-ref search for manager files
- [ ] Run shared/vscode runtime tests

---

## Implementation Flow

```text
Retarget manager refs
    ↓
Update runtime abstraction
    ↓
Verify manager and webview status payloads
```

---

## Cross-Reference Index

| Task | Spec Requirement | Design Section         |
| ---- | ---------------- | ---------------------- |
| 1.1  | [FR-1], [FR-2]   | [DES-FILES], [DES-API] |
| 2.1  | [FR-1], [FR-4]   | [DES-TEST]             |

---

## Notes

- This spec owns runtime abstraction; `351-agent-pi` owns Pi-specific implementation.

---

## Work Sessions

<!-- IMPORTANT: This section MUST remain the LAST section in tasks.md. Do not add content below it. -->
<!-- Task execution log — append-only, updated by /afx-task pick, /afx-task code, /afx-task complete -->

| Date                     | Task | Action     | Files Modified                                                                                                                                                                                                                          | Agent | Human |
| ------------------------ | ---- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 2026-05-02               | 1.1  | Scaffolded | docs/specs/350-agent-manager/                                                                                                                                                                                                           | [x]   | [x]   |
| 2026-05-03               | 1.2  | Coded      | design.md, agent manager source comments                                                                                                                                                                                                | [x]   | [x]   |
| 2026-05-17T12:34:48.000Z | FR-5 | Fixed      | extension.ts, agent-factory.ts, Pi RPC/SDK manager args, host overlay docs/tests                                                                                                                                                        | [x]   | [ ]   |
| 2026-05-17T13:11:29.000Z | FR-5 | Fixed      | apps/vscode/resources/harness-overlays/common/agenticflowx-vscode.md, apps/vscode/src/host-overlay-content.test.ts, docs/specs/350-agent-manager/spec.md, docs/specs/350-agent-manager/design.md, docs/specs/350-agent-manager/tasks.md | [x]   | [ ]   |
| 2026-05-22T05:56:29.000Z | FR-2 | Fixed      | apps/vscode/src/panels/sidebar-panel.ts, apps/vscode/src/panels/sidebar-panel.test.ts, packages/agent/pi-sdk/src/sdk-rpc-manager.test.ts, docs/specs/350-agent-manager/design.md, docs/specs/350-agent-manager/tasks.md                 | [x]   | [ ]   |
