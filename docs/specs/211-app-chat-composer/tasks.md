---
afx: true
type: TASKS
status: Draft
owner: "@rixrix"
version: "1.0"
created_at: "2026-05-02T23:56:50.000Z"
updated_at: "2026-05-03T00:34:22.000Z"
tags: ["app", "chat", "composer", "webview"]
spec: spec.md
design: design.md
---

# App Chat Composer - Implementation Tasks

---

## Task Numbering Convention

- **0.x** - Migration preparation
- **1.x** - Composer source retargeting
- **2.x** - Future composer behavior changes
- **3.x** - Verification

---

## Phase 0: Migration Preparation

### 0.1 Confirm Composer Scope

- [ ] Identify composer-owned blocks in `apps/chat/src/views/chat.tsx`
- [ ] Identify helper components and parsing helpers

---

## Phase 1: Source Retargeting

### 1.1 Retarget Composer Files

<!-- files: apps/chat/src/views/chat.tsx, apps/chat/src/components/model-combobox.tsx, apps/chat/src/components/slash-popup.tsx, apps/chat/src/components/mention-popup.tsx, apps/chat/src/lib/composer-detect.ts, apps/chat/src/lib/mentions.ts -->
<!-- @see docs/specs/211-app-chat-composer/design.md [DES-FILES] | docs/specs/211-app-chat-composer/spec.md [FR-1] -->

- [ ] Replace retired chat spec references with composer spec references
- [ ] Keep non-composer refs pointed at their owning zones

---

## Phase 2: Future Composer Work

### 2.1 Footer And Queue Updates

- [ ] Update footer/queue requirements before source edits
- [ ] Add targeted tests for changed behavior

---

## Phase 3: Verification

### 3.1 Verify Composer Traceability

- [ ] Run stale-ref search for chat composer files
- [ ] Run relevant chat tests

---

## Implementation Flow

```text
Confirm route
    ↓
Retarget source refs
    ↓
Implement focused composer changes
    ↓
Verify helper/footer/queue behavior
```

---

## Cross-Reference Index

| Task | Spec Requirement       | Design Section        |
| ---- | ---------------------- | --------------------- |
| 1.1  | [FR-1], [FR-2], [FR-3] | [DES-FILES], [DES-UI] |
| 2.1  | [FR-2], [FR-4]         | [DES-UI], [DES-TEST]  |

---

## Notes

- This spec is the starting point for chat box footer instructions.

---

## Work Sessions

<!-- IMPORTANT: This section MUST remain the LAST section in tasks.md. Do not add content below it. -->
<!-- Task execution log — append-only, updated by /afx-task pick, /afx-task code, /afx-task complete -->

| Date       | Task | Action     | Files Modified                          | Agent | Human |
| ---------- | ---- | ---------- | --------------------------------------- | ----- | ----- |
| 2026-05-02 | 0.1  | Scaffolded | docs/specs/211-app-chat-composer/       | [x]   | []    |
| 2026-05-03 | 0.2  | Coded      | design.md, apps/chat/src/views/chat.tsx | [x]   | []    |
