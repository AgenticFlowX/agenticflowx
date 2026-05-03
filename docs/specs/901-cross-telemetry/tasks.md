---
afx: true
type: TASKS
status: Draft
owner: "@rixrix"
version: "1.0"
created_at: "2026-05-02T23:56:50.000Z"
updated_at: "2026-05-02T23:56:50.000Z"
tags: ["cross-cutting", "telemetry", "clarity"]
spec: spec.md
design: design.md
---

# Cross Telemetry - Implementation Tasks

---

## Task Numbering Convention

- **1.x** - Source retargeting
- **2.x** - Future telemetry work
- **3.x** - Verification

---

## Phase 1: Source Retargeting

### 1.1 Retarget Clarity Files

- [ ] Replace unnumbered telemetry refs in chat/workbench helpers

---

## Phase 2: Future Telemetry Work

### 2.1 Telemetry Behavior Updates

- [ ] Update privacy requirements before adding events
- [ ] Add no-op/privacy tests

---

## Phase 3: Verification

### 3.1 Verify Telemetry Routing

- [ ] Run stale-ref search for `vscode-clarity-telemetry`
- [ ] Run relevant app tests

---

## Implementation Flow

```text
Retarget telemetry refs
    ↓
Add/update events
    ↓
Verify privacy and no-op behavior
```

---

## Cross-Reference Index

| Task | Spec Requirement | Design Section         |
| ---- | ---------------- | ---------------------- |
| 1.1  | [FR-1]           | [DES-FILES], [DES-API] |
| 2.1  | [FR-2], [NFR-1]  | [DES-SEC], [DES-TEST]  |

---

## Notes

- This spec replaces the unnumbered Clarity telemetry spec for living behavior.

---

## Work Sessions

<!-- IMPORTANT: This section MUST remain the LAST section in tasks.md. Do not add content below it. -->
<!-- Task execution log — append-only, updated by /afx-task pick, /afx-task code, /afx-task complete -->

| Date       | Task | Action     | Files Modified                  | Agent | Human |
| ---------- | ---- | ---------- | ------------------------------- | ----- | ----- |
| 2026-05-02 | 1.1  | Scaffolded | docs/specs/901-cross-telemetry/ | [x]   | []    |
