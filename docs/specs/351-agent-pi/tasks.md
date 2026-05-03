---
afx: true
type: TASKS
status: Draft
owner: "@rixrix"
version: "1.0"
created_at: "2026-05-02T23:56:50.000Z"
updated_at: "2026-05-03T00:34:22.000Z"
tags: ["agent", "pi", "rpc", "sdk"]
spec: spec.md
design: design.md
---

# Agent Pi - Implementation Tasks

---

## Task Numbering Convention

- **1.x** - Source retargeting
- **2.x** - Future Pi adapter work
- **3.x** - Verification

---

## Phase 1: Source Retargeting

### 1.1 Retarget Pi Files

- [ ] Replace retired chat/Pi plan refs in adapter and SDK files
- [ ] Keep generic manager refs pointed at `350-agent-manager`

---

## Phase 2: Future Pi Work

### 2.1 Pi SDK Bootstrap Updates

- [ ] Update requirements before changing bootstrap/bundling
- [ ] Add platform-focused tests for changed behavior

---

## Phase 3: Verification

### 3.1 Verify Pi Routing

- [ ] Run stale-ref search for Pi files
- [ ] Run Pi adapter tests

---

## Implementation Flow

```text
Retarget Pi refs
    ↓
Update adapter/bootstrap behavior
    ↓
Verify RPC, SDK, and runtime status
```

---

## Cross-Reference Index

| Task | Spec Requirement       | Design Section         |
| ---- | ---------------------- | ---------------------- |
| 1.1  | [FR-1], [FR-2], [FR-3] | [DES-FILES], [DES-API] |
| 2.1  | [FR-2], [NFR-3]        | [DES-TEST]             |

---

## Notes

- This spec explicitly supersedes Pi-specific content from the old plan once retargeting completes.

---

## Work Sessions

<!-- IMPORTANT: This section MUST remain the LAST section in tasks.md. Do not add content below it. -->
<!-- Task execution log — append-only, updated by /afx-task pick, /afx-task code, /afx-task complete -->

| Date       | Task | Action     | Files Modified                        | Agent | Human |
| ---------- | ---- | ---------- | ------------------------------------- | ----- | ----- |
| 2026-05-02 | 1.1  | Scaffolded | docs/specs/351-agent-pi/              | [x]   | []    |
| 2026-05-03 | 1.2  | Coded      | design.md, Pi adapter source comments | [x]   | []    |
