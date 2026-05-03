---
afx: true
type: TASKS
status: Draft
owner: "@rixrix"
version: "1.0"
created_at: "2026-05-02T23:56:50.000Z"
updated_at: "2026-05-03T00:34:22.000Z"
tags: ["app", "vscode", "see-navigation", "traceability"]
spec: spec.md
design: design.md
---

# App VSCode See Navigation - Implementation Tasks

---

## Task Numbering Convention

- **1.x** - Source retargeting
- **2.x** - Future navigation work
- **3.x** - Verification

---

## Phase 1: Source Retargeting

### 1.1 Retarget See Navigation Providers

- [ ] Point `@see` provider files at this spec

---

## Phase 2: Future Navigation Work

### 2.1 Update Provider Behavior

- [ ] Update requirements before changing completion/link/hover/CodeLens behavior
- [ ] Add provider tests for changed behavior

---

## Phase 3: Verification

### 3.1 Verify Navigation Routing

- [ ] Run trace checks for provider files
- [ ] Run VSCode provider tests

---

## Implementation Flow

```text
Retarget provider refs
    ↓
Change navigation behavior
    ↓
Verify providers
```

---

## Cross-Reference Index

| Task | Spec Requirement | Design Section         |
| ---- | ---------------- | ---------------------- |
| 1.1  | [FR-1], [FR-2]   | [DES-FILES], [DES-API] |
| 2.1  | [FR-1], [FR-3]   | [DES-TEST]             |

---

## Notes

- This spec is intentionally separate from generic editor menu/action work.

---

## Work Sessions

<!-- IMPORTANT: This section MUST remain the LAST section in tasks.md. Do not add content below it. -->
<!-- Task execution log — append-only, updated by /afx-task pick, /afx-task code, /afx-task complete -->

| Date       | Task | Action     | Files Modified                            | Agent | Human |
| ---------- | ---- | ---------- | ----------------------------------------- | ----- | ----- |
| 2026-05-02 | 1.1  | Scaffolded | docs/specs/203-app-vscode-see-navigation/ | [x]   | []    |
| 2026-05-03 | 1.2  | Coded      | design.md, @see provider source comments  | [x]   | []    |
