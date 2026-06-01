---
afx: true
type: TASKS
status: Draft
owner: "@rixrix"
version: "1.0"
created_at: "2026-06-01T10:08:49.000Z"
updated_at: "2026-06-01T11:19:52.000Z"
tags: ["agent", "oauth", "secret-storage", "credentials", "refresh"]
spec: spec.md
design: design.md
---

# Agent OAuth Credential Store - Implementation Tasks

## Task Numbering Convention

Tasks use hierarchical numbering. `[FR-X]` references `spec.md`, `[DES-X]` references `design.md`, and `[X.Y]` references this task file.

---

## Phase 0: Canonical Spec Setup

### 0.1 Create canonical docs

<!-- files: afx-vscode-v2/docs/specs/353-agent-oauth-credential-store/{spec.md,design.md,tasks.md,journal.md} -->
<!-- @see docs/specs/353-agent-oauth-credential-store/spec.md [FR-1] | docs/specs/353-agent-oauth-credential-store/design.md [DES-DATA] -->

- [x] Create focused spec/design/tasks/journal files for OAuth storage and refresh.
- [ ] Validate doc structure with AFX spec/design/task checks.

---

## Phase 1: Traceability Migration

### 1.1 Retarget credential store links

<!-- files: apps/vscode/src/secret-store.ts, apps/vscode/src/services/oauth/oauth-service.ts, packages/shared/src/oauth/**/*.ts -->
<!-- @see docs/specs/353-agent-oauth-credential-store/spec.md [FR-1] [FR-2] [FR-3] [FR-4] [FR-5] [FR-6] [FR-7] | docs/specs/353-agent-oauth-credential-store/design.md [DES-DATA] [DES-API] [DES-LOCK] [DES-SEC] -->

- [x] Replace credential-store fleet `@see` links with canonical links.
- [x] Keep provider-exchange links on `354-agent-oauth-provider-flows`.

### 1.2 Parent route links

<!-- files: docs/specs/200-app-vscode/{spec.md,design.md}, docs/specs/350-agent-manager/{spec.md,design.md} -->
<!-- @see docs/specs/353-agent-oauth-credential-store/spec.md [FR-1] [FR-4] -->

- [ ] Add route pointers from broad host/agent specs.

---

## Phase 2: Verification

### 2.1 Storage and refresh checks

<!-- files: apps/vscode/src/secret-store.test.ts, apps/vscode/src/services/oauth/oauth-service.test.ts -->
<!-- @see docs/specs/353-agent-oauth-credential-store/spec.md [FR-1] [FR-2] [FR-3] [FR-4] [FR-5] [FR-6] [FR-7] | docs/specs/353-agent-oauth-credential-store/design.md [DES-TEST] -->

- [ ] Re-run SecretStore and OAuthService tests.
- [ ] Verify no token appears in bridge/log/process-arg inspection.

---

## Cross-Reference Index

| Task | Spec Requirement                                       | Design Section                               |
| ---- | ------------------------------------------------------ | -------------------------------------------- |
| 0.1  | [FR-1]                                                 | [DES-DATA]                                   |
| 1.1  | [FR-1], [FR-2], [FR-3], [FR-4], [FR-5], [FR-6], [FR-7] | [DES-DATA], [DES-API], [DES-LOCK], [DES-SEC] |
| 1.2  | [FR-1], [FR-4]                                         | [DES-ARCH]                                   |
| 2.1  | [FR-1], [FR-2], [FR-3], [FR-4], [FR-5], [FR-6], [FR-7] | [DES-TEST]                                   |

---

## Notes

- This spec owns storage and refresh only; provider-specific exchange lives in 354.

---

## Work Sessions

<!-- IMPORTANT: This section MUST remain the LAST section in tasks.md. Do not add content below it. -->

| Date       | Task | Action                                                                   | Files Modified                                           | Agent | Human |
| ---------- | ---- | ------------------------------------------------------------------------ | -------------------------------------------------------- | ----- | ----- |
| 2026-06-01 | 0.1  | Created canonical OAuth credential-store spec set from fleet split plan. | this, spec.md, design.md, journal.md                     | [x]   | [ ]   |
| 2026-06-01 | 1.1  | Completed traceability migration.                                        | secret-store.ts, oauth-service.ts, shared oauth/messages | [x]   | [ ]   |
| 2026-06-01 | 1.1  | Reviewed AFX-specific OAuth comments.                                    | oauth-service.ts, shared oauth/types                     | [x]   | [ ]   |
