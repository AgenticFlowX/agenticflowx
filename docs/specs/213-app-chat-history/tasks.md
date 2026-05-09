---
afx: true
type: TASKS
status: Living
owner: "@rixrix"
version: "1.0"
created_at: "2026-05-02T23:56:50.000Z"
updated_at: "2026-05-09T12:21:59.000Z"
tags: ["app", "chat", "history"]
spec: spec.md
design: design.md
---

# App Chat History - Implementation Tasks

---

## Task Numbering Convention

- **1.x** - Source retargeting
- **2.x** - Future history work
- **3.x** - Verification

---

## Phase 1: Source Retargeting

### 1.1 Retarget History Files

- [ ] Replace retired chat refs in history view/helpers

---

## Phase 2: Future History Work

### 2.1 History View Updates

- [ ] Update requirements before changing history UI
- [ ] Add tests for history event mapping

---

## Phase 3: Verification

### 3.1 Verify History Routing

- [ ] Run stale-ref search for history files
- [ ] Run relevant chat tests

---

## Implementation Flow

```text
Retarget history refs
    ↓
Update history behavior
    ↓
Verify event/list states
```

---

## Cross-Reference Index

| Task | Spec Requirement | Design Section       |
| ---- | ---------------- | -------------------- |
| 1.1  | [FR-1], [FR-2]   | [DES-FILES]          |
| 2.1  | [FR-1]           | [DES-UI], [DES-TEST] |

---

## Notes

- This spec owns conversation history navigation.

---

## Work Sessions

<!-- IMPORTANT: This section MUST remain the LAST section in tasks.md. Do not add content below it. -->
<!-- Task execution log — append-only, updated by /afx-task pick, /afx-task code, /afx-task complete -->

| Date       | Task | Action     | Files Modified                   | Agent | Human |
| ---------- | ---- | ---------- | -------------------------------- | ----- | ----- |
| 2026-05-02 | 1.1  | Scaffolded | docs/specs/213-app-chat-history/ | [x]   | [x]   |
