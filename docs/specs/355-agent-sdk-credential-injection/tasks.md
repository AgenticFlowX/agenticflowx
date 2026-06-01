---
afx: true
type: TASKS
status: Draft
owner: "@rixrix"
version: "1.0"
created_at: "2026-06-01T10:08:49.000Z"
updated_at: "2026-06-01T11:19:52.000Z"
tags: ["agent", "pi-sdk", "credentials", "bootstrap", "provider-overrides"]
spec: spec.md
design: design.md
---

# Agent SDK Credential Injection - Implementation Tasks

## Task Numbering Convention

Tasks use hierarchical numbering. `[FR-X]` references `spec.md`, `[DES-X]` references `design.md`, and `[X.Y]` references this task file.

---

## Phase 0: Canonical Spec Setup

### 0.1 Create canonical docs

<!-- files: afx-vscode-v2/docs/specs/355-agent-sdk-credential-injection/{spec.md,design.md,tasks.md,journal.md} -->
<!-- @see docs/specs/355-agent-sdk-credential-injection/spec.md [FR-1] | docs/specs/355-agent-sdk-credential-injection/design.md [DES-FLOW] -->

- [x] Create focused spec/design/tasks/journal files for managed SDK credential injection.
- [ ] Validate doc structure with AFX spec/design/task checks.

---

## Phase 1: Traceability Migration

### 1.1 Retarget injection source links

<!-- files: apps/vscode/src/agent-factory.ts, packages/agent/pi-sdk/src/sdk-rpc-manager.ts, packages/agent/pi-sdk/src/options.ts, packages/agent/pi-sdk/bootstrap/*.ts -->
<!-- @see docs/specs/355-agent-sdk-credential-injection/spec.md [FR-1] [FR-2] [FR-3] [FR-4] [FR-5] [FR-6] [FR-7] | docs/specs/355-agent-sdk-credential-injection/design.md [DES-FLOW] [DES-OVERRIDES] [DES-EXTERNAL] [DES-SEC] -->

- [x] Replace SDK injection fleet `@see` links with canonical links.
- [x] Keep provider-catalog setup metadata links on `141-package-provider-catalog`.

### 1.2 Parent route links

<!-- files: docs/specs/351-agent-pi/{spec.md,design.md}, docs/specs/350-agent-manager/{spec.md,design.md} -->
<!-- @see docs/specs/355-agent-sdk-credential-injection/spec.md [FR-1] [FR-6] -->

- [ ] Route Pi SDK credential injection details out of broad Pi/agent docs.

---

## Phase 2: Verification

### 2.1 Injection acceptance

<!-- files: apps/vscode/src/agent-factory.test.ts, packages/agent/pi-sdk/**/*.test.ts -->
<!-- @see docs/specs/355-agent-sdk-credential-injection/spec.md [FR-1] [FR-2] [FR-3] [FR-4] [FR-5] [FR-6] [FR-7] | docs/specs/355-agent-sdk-credential-injection/design.md [DES-TEST] -->

- [ ] Re-run agent factory and Pi SDK bootstrap tests.
- [ ] Verify no OAuth token appears in process args.
- [ ] Verify external Pi RPC env scrub.

---

## Cross-Reference Index

| Task | Spec Requirement                                       | Design Section                                         |
| ---- | ------------------------------------------------------ | ------------------------------------------------------ |
| 0.1  | [FR-1]                                                 | [DES-FLOW]                                             |
| 1.1  | [FR-1], [FR-2], [FR-3], [FR-4], [FR-5], [FR-6], [FR-7] | [DES-FLOW], [DES-OVERRIDES], [DES-EXTERNAL], [DES-SEC] |
| 1.2  | [FR-1], [FR-6]                                         | [DES-ARCH]                                             |
| 2.1  | [FR-1], [FR-2], [FR-3], [FR-4], [FR-5], [FR-6], [FR-7] | [DES-TEST]                                             |

---

## Notes

- This spec owns the host-to-managed-SDK injection boundary; external runtime auth remains user-owned.

---

## Work Sessions

<!-- IMPORTANT: This section MUST remain the LAST section in tasks.md. Do not add content below it. -->

| Date       | Task | Action                                                                     | Files Modified                                                    | Agent | Human |
| ---------- | ---- | -------------------------------------------------------------------------- | ----------------------------------------------------------------- | ----- | ----- |
| 2026-06-01 | 0.1  | Created canonical SDK credential-injection spec set from fleet split plan. | this, spec.md, design.md, journal.md                              | [x]   | [ ]   |
| 2026-06-01 | 1.1  | Completed traceability migration.                                          | agent-factory.ts, sdk-rpc-manager.ts, options.ts, bootstrap/\*.ts | [x]   | [ ]   |
| 2026-06-01 | 1.1  | Reviewed AFX-specific SDK override comments.                               | agent-factory.ts, provider-overrides-bootstrap.ts                 | [x]   | [ ]   |
