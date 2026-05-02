---
afx: true
type: TASKS
status: Draft
owner: "@rixrix"
version: "1.1"
created_at: "2026-04-26T04:32:48.000Z"
updated_at: "2026-04-28T01:37:40.000Z"
tags: [ci, release, release-please, changelog, semver, changelogen]
spec: spec.md
design: design.md
---

# CI Release — Implementation Tasks

> Spec updated to v1.1: trigger changed to `workflow_dispatch`, `changelogen` added for local preview.
> Phase 1 + 2 implemented. Phase 3 requires manual GitHub validation.

---

## Phase 1: Update Workflow Trigger

<!-- scope: .github/workflows/release-please.yml -->
<!-- @see docs/specs/510-ci-release/spec.md [FR-1] -->
<!-- @see docs/specs/510-ci-release/design.md [DES-ARCH] -->

- [x] 1.1 Change `release-please.yml` trigger from `push: branches: [main]` to `workflow_dispatch`
- [x] 1.2 Add a comment in the workflow YAML noting the automation toggle instruction

## Phase 2: Add Local Changelog Preview

<!-- scope: package.json -->
<!-- @see docs/specs/510-ci-release/spec.md [FR-5] -->
<!-- @see docs/specs/510-ci-release/design.md [DES-CHANGELOG] -->

- [x] 2.1 Add `changelogen` as a dev dependency (`pnpm add -D changelogen`)
- [x] 2.2 Add `"changelog": "changelogen --dry"` script to root `package.json`
- [x] 2.3 Verify `pnpm changelog` prints the expected CHANGELOG diff from local git log

## Phase 3: Validate Release Flow

<!-- scope: .github/workflows/release-please.yml -->
<!-- @see docs/specs/510-ci-release/spec.md [FR-2] [FR-3] [FR-4] [NFR-1] -->
<!-- @see docs/specs/510-ci-release/design.md [DES-ROLLOUT] -->

- [ ] 3.1 Trigger `release-please.yml` manually via GitHub UI (`workflow_dispatch`)
- [ ] 3.2 Confirm release PR is opened with correct CHANGELOG diff
- [ ] 3.3 Merge release PR; confirm git tag and GitHub Release are created

---

## Cross-Reference Index

| Task(s)       | Spec Requirement | Design Section |
| ------------- | ---------------- | -------------- |
| 1.1, 1.2      | FR-1             | DES-ARCH       |
| 2.1, 2.2, 2.3 | FR-5             | DES-CHANGELOG  |
| 3.1           | FR-2             | DES-ROLLOUT    |
| 3.2           | FR-3, NFR-1      | DES-ROLLOUT    |
| 3.3           | FR-3, FR-4       | DES-ROLLOUT    |

---

## Work Sessions

<!-- IMPORTANT: This section MUST remain the LAST section in tasks.md. Do not add content below it. -->

| Date       | Task      | Action    | Files Modified                                                                 | Agent | Human |
| ---------- | --------- | --------- | ------------------------------------------------------------------------------ | ----- | ----- |
| 2026-04-26 | Phase 2   | Completed | docs/specs/510-ci-release/ (scaffolded)                                        | [x]   | []    |
| 2026-04-26 | Spec v1.1 | Completed | spec.md, design.md, tasks.md — workflow_dispatch + changelogen + DES-CHANGELOG | [x]   | []    |
| 2026-04-26 | 1.1, 1.2  | Coded     | .github/workflows/release-please.yml                                           | [x]   | []    |
| 2026-04-26 | 2.1, 2.2  | Coded     | package.json, pnpm-lock.yaml                                                   | [x]   | []    |
| 2026-04-26 | 2.3       | Verified  | -                                                                              | [x]   | []    |
