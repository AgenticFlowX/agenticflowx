---
afx: true
type: TASKS
status: Living
owner: "@rixrix"
version: "1.0"
created_at: "2026-05-02T23:56:50.000Z"
updated_at: "2026-05-09T12:21:59.000Z"
tags: ["app", "vscode", "editor-actions", "commands"]
spec: spec.md
design: design.md
---

# App VSCode Editor Actions - Implementation Tasks

---

## Task Numbering Convention

- **1.x** - Source/manifest retargeting
- **2.x** - Future editor action work
- **3.x** - Verification

---

## Phase 1: Source Retargeting

### 1.1 Retarget Editor Action Files

- [ ] Point editor action provider docs at this spec
- [ ] Keep notes payload refs pointed at `215-app-chat-notes`

---

## Phase 2: Future Editor Action Work

### 2.1 Add Or Change Editor Action

- [ ] Update command/menu requirements first
- [ ] Add or update provider/manifest tests

---

## Phase 3: Verification

### 3.1 Verify Editor Action Routing

- [ ] Run stale-ref search for editor action files
- [ ] Run VSCode targeted tests if command behavior changed

---

## Implementation Flow

```text
Update action spec
    ↓
Change manifest/provider
    ↓
Verify command dispatch
```

---

## Cross-Reference Index

| Task | Spec Requirement | Design Section         |
| ---- | ---------------- | ---------------------- |
| 1.1  | [FR-1], [FR-2]   | [DES-FILES], [DES-API] |
| 2.1  | [FR-1], [FR-3]   | [DES-UI], [DES-TEST]   |

---

## Notes

- This is the right starting point for editor right-click/menu/gutter action work.

---

## Work Sessions

<!-- IMPORTANT: This section MUST remain the LAST section in tasks.md. Do not add content below it. -->
<!-- Task execution log — append-only, updated by /afx-task pick, /afx-task code, /afx-task complete -->

| Date       | Task | Action     | Files Modified                            | Agent | Human |
| ---------- | ---- | ---------- | ----------------------------------------- | ----- | ----- |
| 2026-05-02 | 1.1  | Scaffolded | docs/specs/202-app-vscode-editor-actions/ | [x]   | [x]   |
| 2026-05-03 | 1.2  | Coded      | design.md, editor-action source comments  | [x]   | [x]   |
