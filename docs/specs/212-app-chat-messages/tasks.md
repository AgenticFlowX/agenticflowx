---
afx: true
type: TASKS
status: Living
owner: "@rixrix"
version: "1.0"
created_at: "2026-05-02T23:56:50.000Z"
updated_at: "2026-05-09T12:21:59.000Z"
tags: ["app", "chat", "messages", "streaming"]
spec: spec.md
design: design.md
---

# App Chat Messages - Implementation Tasks

---

## Task Numbering Convention

- **1.x** - Source retargeting
- **2.x** - Future message rendering work
- **3.x** - Verification

---

## Phase 1: Source Retargeting

### 1.1 Retarget Message Rendering Files

- [ ] Replace retired chat refs in message/tool rendering files
- [ ] Keep composer refs in `211-app-chat-composer`

---

## Phase 2: Future Message Work

### 2.1 Timeline Updates

- [ ] Update requirements before changing rendering behavior
- [ ] Add focused render tests

---

## Phase 3: Verification

### 3.1 Verify Message Routing

- [ ] Run stale-ref search for message files
- [ ] Run chat tests impacted by timeline rendering

---

## Implementation Flow

```text
Retarget message refs
    ↓
Implement timeline change
    ↓
Verify rendering
```

---

## Cross-Reference Index

| Task | Spec Requirement | Design Section       |
| ---- | ---------------- | -------------------- |
| 1.1  | [FR-1], [FR-2]   | [DES-FILES]          |
| 2.1  | [FR-1], [FR-3]   | [DES-UI], [DES-TEST] |

---

## Notes

- This spec owns chat output rendering, not composer input.

---

## Work Sessions

<!-- IMPORTANT: This section MUST remain the LAST section in tasks.md. Do not add content below it. -->
<!-- Task execution log — append-only, updated by /afx-task pick, /afx-task code, /afx-task complete -->

| Date       | Task | Action     | Files Modified                    | Agent | Human |
| ---------- | ---- | ---------- | --------------------------------- | ----- | ----- |
| 2026-05-02 | 1.1  | Scaffolded | docs/specs/212-app-chat-messages/ | [x]   | [x]   |
