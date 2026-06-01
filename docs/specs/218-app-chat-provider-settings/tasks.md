---
afx: true
type: TASKS
status: Draft
owner: "@rixrix"
version: "1.0"
created_at: "2026-06-01T10:08:49.000Z"
updated_at: "2026-06-01T11:06:02.000Z"
tags: ["app", "chat", "settings", "providers", "subscription-accounts"]
spec: spec.md
design: design.md
---

# App Chat Provider Settings - Implementation Tasks

## Task Numbering Convention

Tasks use hierarchical numbering. `[FR-X]` references `spec.md`, `[DES-X]` references `design.md`, and `[X.Y]` references this task file.

---

## Phase 0: Canonical Spec Setup

### 0.1 Create canonical docs

<!-- files: afx-vscode-v2/docs/specs/218-app-chat-provider-settings/{spec.md,design.md,tasks.md,journal.md} -->
<!-- @see docs/specs/218-app-chat-provider-settings/spec.md [FR-1] | docs/specs/218-app-chat-provider-settings/design.md [DES-OVR] -->

- [x] Create focused spec/design/tasks/journal files for provider Settings UX.
- [x] Validate doc structure with AFX spec/design/task checks.

---

## Phase 1: Traceability Migration

### 1.1 Retarget Settings provider links

<!-- files: apps/chat/src/views/settings.tsx, apps/chat/src/components/provider-card.tsx, apps/chat/src/lib/settings-copy.ts, apps/chat/src/lib/settings-snapshot.ts -->
<!-- @see docs/specs/218-app-chat-provider-settings/spec.md [FR-1] [FR-2] [FR-3] [FR-4] [FR-5] [FR-6] [FR-7] | docs/specs/218-app-chat-provider-settings/design.md [DES-UI] [DES-DATA] [DES-API] -->

- [x] Replace provider-card/settings fleet `@see` links with canonical links.
- [x] Keep generic Settings shell links on `214-app-chat-settings`.

### 1.2 Parent route links

<!-- files: docs/specs/214-app-chat-settings/{spec.md,design.md} -->
<!-- @see docs/specs/218-app-chat-provider-settings/spec.md [FR-1] -->

- [ ] Route built-in provider-card and subscription-account details out of broad Settings docs.

---

## Phase 2: Verification

### 2.1 Settings provider acceptance

<!-- files: apps/chat/src/components/provider-card.test.tsx, apps/chat/src/views/settings.tsx, apps/chat/e2e/*.spec.ts -->
<!-- @see docs/specs/218-app-chat-provider-settings/spec.md [FR-1] [FR-2] [FR-3] [FR-4] [FR-5] [FR-6] | docs/specs/218-app-chat-provider-settings/design.md [DES-TEST] -->

- [ ] Re-run provider card and Settings tests.
- [ ] Capture Playwright screenshots for subscription accounts and setup-field providers.
- [ ] Leave live provider sign-in acceptance open until user confirms.

---

## Cross-Reference Index

| Task | Spec Requirement                                       | Design Section                  |
| ---- | ------------------------------------------------------ | ------------------------------- |
| 0.1  | [FR-1]                                                 | [DES-OVR]                       |
| 1.1  | [FR-1], [FR-2], [FR-3], [FR-4], [FR-5], [FR-6], [FR-7] | [DES-UI], [DES-DATA], [DES-API] |
| 1.2  | [FR-1]                                                 | [DES-ARCH]                      |
| 2.1  | [FR-1], [FR-2], [FR-3], [FR-4], [FR-5], [FR-6]         | [DES-TEST]                      |

---

## Notes

- This spec owns built-in provider Settings UX, not custom-model editor internals.

---

## Work Sessions

<!-- IMPORTANT: This section MUST remain the LAST section in tasks.md. Do not add content below it. -->

| Date       | Task | Action                                                                                                         | Files Modified                                                              | Agent | Human |
| ---------- | ---- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ----- | ----- |
| 2026-06-01 | 0.1  | Created canonical provider-settings spec set from fleet split plan.                                            | this, spec.md, design.md, journal.md                                        | [x]   | [ ]   |
| 2026-06-01 | 0.1  | Expanded UI ASCII Surface Maps, restored canonical design sections, and validated spec/design/tasks structure. | this, design.md                                                             | [x]   | [ ]   |
| 2026-06-01 | 1.1  | Completed traceability migration.                                                                              | settings.tsx, provider-card.tsx, settings-snapshot.ts, messages.ts, mock.ts | [x]   | [ ]   |
