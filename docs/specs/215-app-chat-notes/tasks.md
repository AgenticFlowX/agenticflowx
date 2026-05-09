---
afx: true
type: TASKS
status: Living
owner: "@rixrix"
version: "1.0"
created_at: "2026-05-02T23:56:50.000Z"
updated_at: "2026-05-09T12:21:59.000Z"
tags: ["app", "chat", "notes"]
spec: spec.md
design: design.md
---

# App Chat Notes - Implementation Tasks

---

## Task Numbering Convention

- **1.x** - Source retargeting
- **2.x** - Future notes capture work
- **3.x** - Verification

---

## Phase 1: Source Retargeting

### 1.1 Retarget Missing Notes Paths

- [ ] Replace legacy sprint note refs with this spec
- [ ] Confirm editor action and chat note flows point at notes owner

---

## Phase 2: Future Notes Work

### 2.1 Notes Capture Updates

- [ ] Update note capture requirements before source edits
- [ ] Add tests for changed note payload behavior

---

## Phase 3: Verification

### 3.1 Verify Notes Routing

- [ ] Run stale-ref search for legacy sprint refs
- [ ] Run relevant chat/vscode tests

---

## Implementation Flow

```text
Retarget missing notes refs
    ↓
Update note capture behavior
    ↓
Verify chat/editor notes paths
```

---

## Cross-Reference Index

| Task | Spec Requirement       | Design Section         |
| ---- | ---------------------- | ---------------------- |
| 1.1  | [FR-1], [FR-2], [FR-3] | [DES-FILES], [DES-API] |
| 2.1  | [FR-1], [FR-2]         | [DES-UI], [DES-TEST]   |

---

## Notes

- This spec replaces the missing notes plan reference.

---

## Work Sessions

<!-- IMPORTANT: This section MUST remain the LAST section in tasks.md. Do not add content below it. -->
<!-- Task execution log — append-only, updated by /afx-task pick, /afx-task code, /afx-task complete -->

| Date       | Task | Action     | Files Modified                 | Agent | Human |
| ---------- | ---- | ---------- | ------------------------------ | ----- | ----- |
| 2026-05-02 | 1.1  | Scaffolded | docs/specs/215-app-chat-notes/ | [x]   | [x]   |
