---
afx: true
type: TASKS
status: Draft
owner: "@rixrix"
version: "1.1"
created_at: "2026-05-02T23:56:50.000Z"
updated_at: "2026-05-05T12:03:56.000Z"
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

### 2.2 Active File Context Preference

- [x] Add the default-on active-file context switch to the Settings view
- [x] Mirror the same setting through the chat composer quick toggle
- [x] Add tests for snapshot hydration, persistence, and small-screen behavior

---

## Phase 3: Verification

### 3.1 Verify Settings Routing

- [x] Run stale-ref search for settings files
- [x] Run relevant chat tests

---

## Implementation Flow

```text
Retarget settings refs
    ↓
Update provider/runtime UX
    ↓
Add active-file context preference
    ↓
Verify settings behavior
```

---

## Cross-Reference Index

| Task | Spec Requirement | Design Section          |
| ---- | ---------------- | ----------------------- |
| 1.1  | [FR-1], [FR-2]   | [DES-FILES], [DES-DATA] |
| 2.1  | [FR-1], [FR-4]   | [DES-UI], [DES-API]     |
| 2.2  | [FR-5]           | [DES-SETTINGS-CONTEXT]  |

---

## Notes

- Shared token/theme contracts remain in `131-package-ui-design-system`.
- Active-file context is a durable preference mirrored by the composer quick toggle.

---

## Work Sessions

<!-- IMPORTANT: This section MUST remain the LAST section in tasks.md. Do not add content below it. -->
<!-- Task execution log — append-only, updated by /afx-task pick, /afx-task code, /afx-task complete -->

| Date                     | Task | Action      | Files Modified                                                                                                                                    | Agent | Human |
| ------------------------ | ---- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 2026-05-02               | 1.1  | Scaffolded  | docs/specs/214-app-chat-settings/                                                                                                                 | [x]   | []    |
| 2026-05-03               | 1.2  | Coded       | design.md, apps/chat/src/views/settings.tsx                                                                                                       | [x]   | []    |
| 2026-05-05               | 2.2  | In progress | spec.md, design.md                                                                                                                                | [x]   | []    |
| 2026-05-05T11:53:21.000Z | 2.2  | Coded       | apps/chat/src/views/settings.tsx, apps/chat/src/lib/settings-snapshot.ts, apps/chat/src/lib/settings-snapshot.test.ts, apps/chat/src/app.test.tsx | [x]   | []    |
| 2026-05-05T12:03:56.000Z | 2.2  | Completed   | apps/chat/src/views/settings.tsx, apps/chat/src/lib/settings-snapshot.ts, apps/chat/src/lib/settings-snapshot.test.ts, apps/chat/src/app.test.tsx | [x]   | []    |
