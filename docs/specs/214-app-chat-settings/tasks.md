---
afx: true
type: TASKS
status: Draft
owner: "@rixrix"
version: "1.0"
created_at: "2026-05-02T23:56:50.000Z"
updated_at: "2026-05-03T00:34:22.000Z"
tags: ["app", "chat", "settings", "providers"]
spec: spec.md
design: design.md
---

# App Chat Settings - Implementation Tasks

---

## Task Numbering Convention

- **1.x** - Source retargeting
- **2.x** - Future settings work
- **3.x** - Verification

---

## Phase 1: Source Retargeting

### 1.1 Retarget Settings Files

- [ ] Replace retired chat/runtime refs in settings view, provider cards, and snapshot helpers
- [ ] Keep shared theme refs pointed at `131-package-ui-design-system`

---

## Phase 2: Future Settings Work

### 2.1 Provider Runtime UX Updates

- [ ] Update requirements before changing provider/API key behavior
- [ ] Add focused settings tests

---

## Phase 3: Verification

### 3.1 Verify Settings Routing

- [ ] Run stale-ref search for settings files
- [ ] Run relevant chat tests

---

## Implementation Flow

```text
Retarget settings refs
    ↓
Update provider/runtime UX
    ↓
Verify settings behavior
```

---

## Cross-Reference Index

| Task | Spec Requirement | Design Section          |
| ---- | ---------------- | ----------------------- |
| 1.1  | [FR-1], [FR-2]   | [DES-FILES], [DES-DATA] |
| 2.1  | [FR-1], [FR-4]   | [DES-UI], [DES-API]     |

---

## Notes

- Shared token/theme contracts remain in `131-package-ui-design-system`.

---

## Work Sessions

<!-- IMPORTANT: This section MUST remain the LAST section in tasks.md. Do not add content below it. -->
<!-- Task execution log — append-only, updated by /afx-task pick, /afx-task code, /afx-task complete -->

| Date       | Task | Action     | Files Modified                              | Agent | Human |
| ---------- | ---- | ---------- | ------------------------------------------- | ----- | ----- |
| 2026-05-02 | 1.1  | Scaffolded | docs/specs/214-app-chat-settings/           | [x]   | []    |
| 2026-05-03 | 1.2  | Coded      | design.md, apps/chat/src/views/settings.tsx | [x]   | []    |
