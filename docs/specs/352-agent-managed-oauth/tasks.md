---
afx: true
type: TASKS
status: Draft
owner: "@rixrix"
version: "1.0"
created_at: "2026-06-01T10:08:49.000Z"
updated_at: "2026-06-01T11:06:02.000Z"
tags: ["agent", "oauth", "managed-sdk", "subscription"]
spec: spec.md
design: design.md
---

# Agent Managed OAuth - Implementation Tasks

## Task Numbering Convention

Tasks use hierarchical numbering. `[FR-X]` references `spec.md`, `[DES-X]` references `design.md`, and `[X.Y]` references this task file.

---

## Phase 0: Canonical Spec Setup

### 0.1 Create canonical docs

<!-- files: afx-vscode-v2/docs/specs/352-agent-managed-oauth/{spec.md,design.md,tasks.md,journal.md} -->
<!-- @see docs/specs/352-agent-managed-oauth/spec.md [FR-1] | docs/specs/352-agent-managed-oauth/design.md [DES-POLICY] -->

- [x] Create focused spec/design/tasks/journal files for managed OAuth policy.
- [ ] Validate doc structure with AFX spec/design/task checks.

---

## Phase 1: Traceability Migration

### 1.1 Retarget policy links

<!-- files: apps/vscode/src/agent-factory.ts, apps/chat/src/components/provider-card.tsx -->
<!-- @see docs/specs/352-agent-managed-oauth/spec.md [FR-1] [FR-2] [FR-3] [FR-4] [FR-5] | docs/specs/352-agent-managed-oauth/design.md [DES-POLICY] [DES-SEC] -->

- [x] Replace policy-level fleet references with canonical managed-OAuth links.
- [x] Keep storage, flow, injection, and UI details on their child specs.

### 1.2 Parent route links

<!-- files: docs/specs/350-agent-manager/{spec.md,design.md}, docs/specs/351-agent-pi/{spec.md,design.md} -->
<!-- @see docs/specs/352-agent-managed-oauth/spec.md [FR-1] [FR-2] -->

- [ ] Add route pointers from agent manager/Pi specs to managed OAuth policy.

---

## Phase 2: Verification

### 2.1 Policy acceptance

<!-- files: apps/vscode/src/agent-factory.test.ts, apps/chat/src/components/provider-card.test.tsx -->
<!-- @see docs/specs/352-agent-managed-oauth/spec.md [FR-1] [FR-2] | docs/specs/352-agent-managed-oauth/design.md [DES-TEST] -->

- [ ] Verify managed SDK receives AFX OAuth where supported.
- [ ] Verify external runtime UI remains guidance-only.

---

## Cross-Reference Index

| Task | Spec Requirement                       | Design Section          |
| ---- | -------------------------------------- | ----------------------- |
| 0.1  | [FR-1]                                 | [DES-POLICY]            |
| 1.1  | [FR-1], [FR-2], [FR-3], [FR-4], [FR-5] | [DES-POLICY], [DES-SEC] |
| 1.2  | [FR-1], [FR-2]                         | [DES-ARCH]              |
| 2.1  | [FR-1], [FR-2]                         | [DES-TEST]              |

---

## Notes

- This is a policy/route spec. Concrete OAuth implementation lives in 353, 354, and 355.

---

## Work Sessions

<!-- IMPORTANT: This section MUST remain the LAST section in tasks.md. Do not add content below it. -->

| Date       | Task | Action                                                                 | Files Modified                       | Agent | Human |
| ---------- | ---- | ---------------------------------------------------------------------- | ------------------------------------ | ----- | ----- |
| 2026-06-01 | 0.1  | Created canonical managed-OAuth policy spec set from fleet split plan. | this, spec.md, design.md, journal.md | [x]   | [ ]   |
| 2026-06-01 | 1.1  | Completed traceability migration.                                      | agent-factory.ts, provider-card.tsx  | [x]   | [ ]   |
