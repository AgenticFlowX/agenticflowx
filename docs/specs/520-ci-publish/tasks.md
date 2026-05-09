---
afx: true
type: TASKS
status: Living
owner: "@rixrix"
version: "1.1"
created_at: "2026-04-26T04:32:48.000Z"
updated_at: "2026-05-09T12:21:59.000Z"
tags: [ci, publish, vsix]
spec: spec.md
design: design.md
---

# CI Publish — Implementation Tasks

> Spec updated to v1.1: publish scope is now VSIX packaging + GitHub Release attachment only. Marketplace upload is manual.
> Phase 1 implemented. Phase 2 requires manual validation via a test release.

---

## Phase 1: Update Publish Workflow

<!-- scope: .github/workflows/ -->
<!-- @see docs/specs/520-ci-publish/spec.md [FR-1] [FR-2] [FR-3] -->
<!-- @see docs/specs/520-ci-publish/design.md [DES-ARCH] -->

- [x] 1.1 Rename `.github/workflows/marketplace-publish.yml` → `build-vsix.yml`
- [x] 1.2 Remove `vsce publish` step (step 4) from the workflow
- [x] 1.3 Remove `ovsx publish` step (step 5) from the workflow
- [x] 1.4 Remove `VSCE_PAT` and `OVSX_PAT` secret references from the workflow
- [x] 1.5 Confirm `gh release upload` step attaches the `.vsix` to the GitHub Release

## Phase 2: Validate VSIX Artifact

<!-- scope: .github/workflows/build-vsix.yml -->
<!-- @see docs/specs/520-ci-publish/spec.md [FR-3] [NFR-1] -->
<!-- @see docs/specs/520-ci-publish/design.md [DES-TEST] [DES-ROLLOUT] -->

- [ ] 2.1 Create a test release and confirm `build-vsix.yml` is triggered
- [ ] 2.2 Confirm `.vsix` artifact appears in GitHub Release assets
- [ ] 2.3 Download artifact and verify it installs correctly via `code --install-extension`

---

## Cross-Reference Index

| Task(s)  | Spec Requirement | Design Section        |
| -------- | ---------------- | --------------------- |
| 1.1, 1.2 | FR-1             | DES-ARCH              |
| 1.3, 1.4 | FR-2             | DES-ARCH              |
| 1.5      | FR-3             | DES-ARCH              |
| 2.1      | FR-3, NFR-1      | DES-TEST, DES-ROLLOUT |
| 2.2, 2.3 | FR-3             | DES-TEST, DES-ROLLOUT |

---

## Work Sessions

<!-- IMPORTANT: This section MUST remain the LAST section in tasks.md. Do not add content below it. -->

| Date       | Task      | Action    | Files Modified                                                                | Agent | Human |
| ---------- | --------- | --------- | ----------------------------------------------------------------------------- | ----- | ----- |
| 2026-04-26 | Phase 2   | Completed | docs/specs/520-ci-publish/ (scaffolded)                                       | [x]   | [x]   |
| 2026-04-26 | Spec v1.1 | Completed | spec.md, design.md, tasks.md — manual marketplace, build-vsix.yml scope       | [x]   | [x]   |
| 2026-04-26 | 1.1–1.5   | Coded     | .github/workflows/build-vsix.yml (created), marketplace-publish.yml (deleted) | [x]   | [x]   |
