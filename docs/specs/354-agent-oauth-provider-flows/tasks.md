---
afx: true
type: TASKS
status: Draft
owner: "@rixrix"
version: "1.0"
created_at: "2026-06-01T10:08:49.000Z"
updated_at: "2026-06-01T11:19:52.000Z"
tags: ["agent", "oauth", "pkce", "device-code", "providers"]
spec: spec.md
design: design.md
---

# Agent OAuth Provider Flows - Implementation Tasks

## Task Numbering Convention

Tasks use hierarchical numbering. `[FR-X]` references `spec.md`, `[DES-X]` references `design.md`, and `[X.Y]` references this task file.

---

## Phase 0: Canonical Spec Setup

### 0.1 Create canonical docs

<!-- files: afx-vscode-v2/docs/specs/354-agent-oauth-provider-flows/{spec.md,design.md,tasks.md,journal.md} -->
<!-- @see docs/specs/354-agent-oauth-provider-flows/spec.md [FR-1] | docs/specs/354-agent-oauth-provider-flows/design.md [DES-PKCE] -->

- [x] Create focused spec/design/tasks/journal files for provider OAuth flows.
- [ ] Validate doc structure with AFX spec/design/task checks.

---

## Phase 1: Traceability Migration

### 1.1 Retarget flow source links

<!-- files: apps/vscode/src/services/oauth/pkce*.ts, apps/vscode/src/services/oauth/device-code.ts, apps/vscode/src/services/oauth/providers/*.ts -->
<!-- @see docs/specs/354-agent-oauth-provider-flows/spec.md [FR-1] [FR-2] [FR-3] [FR-4] [FR-5] [FR-6] [FR-7] | docs/specs/354-agent-oauth-provider-flows/design.md [DES-PKCE] [DES-DEVICE] [DES-PROVIDERS] -->

- [x] Replace provider-flow fleet `@see` links with canonical links.
- [x] Keep credential persistence links on `353-agent-oauth-credential-store`.

---

## Phase 2: Verification

### 2.1 Provider flow checks

<!-- files: apps/vscode/src/services/oauth/**/*.test.ts -->
<!-- @see docs/specs/354-agent-oauth-provider-flows/spec.md [FR-1] [FR-2] [FR-3] [FR-4] [FR-5] [FR-6] [FR-7] | docs/specs/354-agent-oauth-provider-flows/design.md [DES-TEST] -->

- [ ] Re-run PKCE, device-code, and provider adapter tests.
- [ ] Keep live Anthropic/OpenAI Codex/GitHub Copilot sign-in acceptance open for human verification.

---

## Cross-Reference Index

| Task | Spec Requirement                                       | Design Section                            |
| ---- | ------------------------------------------------------ | ----------------------------------------- |
| 0.1  | [FR-1]                                                 | [DES-PKCE]                                |
| 1.1  | [FR-1], [FR-2], [FR-3], [FR-4], [FR-5], [FR-6], [FR-7] | [DES-PKCE], [DES-DEVICE], [DES-PROVIDERS] |
| 2.1  | [FR-1], [FR-2], [FR-3], [FR-4], [FR-5], [FR-6], [FR-7] | [DES-TEST]                                |

---

## Notes

- This spec owns sign-in exchange mechanics, not storage or provider-card layout.

---

## Work Sessions

<!-- IMPORTANT: This section MUST remain the LAST section in tasks.md. Do not add content below it. -->

| Date       | Task | Action                                                                | Files Modified                                                               | Agent | Human |
| ---------- | ---- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ----- | ----- |
| 2026-06-01 | 0.1  | Created canonical OAuth provider-flow spec set from fleet split plan. | this, spec.md, design.md, journal.md                                         | [x]   | [ ]   |
| 2026-06-01 | 1.1  | Completed traceability migration.                                     | pkce.ts, pkce-loopback.ts, device-code.ts, providers/\*.ts, oauth-service.ts | [x]   | [ ]   |
| 2026-06-01 | 1.1  | Reviewed AFX-specific OAuth provider comments.                        | pkce.ts, pkce-loopback.ts, device-code.ts, providers/\*.ts                   | [x]   | [ ]   |
