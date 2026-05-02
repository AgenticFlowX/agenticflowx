---
afx: true
type: DESIGN
status: Approved
owner: "@rixrix"
version: "1.1"
created_at: "2026-04-26T04:32:48.000Z"
updated_at: "2026-04-28T01:37:40.000Z"
tags: [ci, publish, vsix]
spec: spec.md
---

# CI Publish — Technical Design

---

## [DES-OVR] Overview

`build-vsix.yml` triggers on GitHub Release published events matching `v*` tags. It builds all packages, packages a VSIX with `vsce`, and attaches the VSIX as a GitHub Release asset. Marketplace upload (VS Code Marketplace, OpenVSX) is performed manually by the developer by downloading the VSIX artifact from the release.

---

## [DES-ARCH] Architecture

```text
.github/workflows/build-vsix.yml
  trigger: release published (tags matching v*)

  jobs:
    build-vsix:
      1. pnpm install
      2. pnpm build               ← build all packages + apps
      3. pnpm exec vsce package   ← produces afx-agenticflowx-*.vsix
      4. gh release upload        ← attach VSIX to GitHub Release
```

### Distribution

```text
GitHub Release       → github.com release assets    (via gh CLI, automated)
VS Code Marketplace  → manual upload by developer after downloading VSIX
OpenVSX Registry     → manual upload by developer after downloading VSIX
```

---

## [DES-DEC] Key Decisions

| Decision            | Options Considered                               | Choice              | Rationale                                                           |
| ------------------- | ------------------------------------------------ | ------------------- | ------------------------------------------------------------------- |
| Trigger             | `workflow_dispatch`, `release published`         | `release published` | Fully automated; release-please creates the release automatically   |
| VSIX packaging      | `vsce package` in workflow vs pre-built artifact | Package in workflow | Ensures VSIX matches the tagged commit exactly                      |
| Marketplace publish | Automated (`vsce publish`), manual upload        | Manual upload       | No PAT secrets needed; developer downloads VSIX and uploads by hand |

---

## [DES-FILES] File Structure

| File                               | Purpose                                    |
| ---------------------------------- | ------------------------------------------ |
| `.github/workflows/build-vsix.yml` | VSIX packaging + GitHub Release attachment |

---

## [DES-DEPS] Dependencies

| Package / Action     | Purpose                              |
| -------------------- | ------------------------------------ |
| `@vscode/vsce`       | VSIX packaging (`vsce package`)      |
| `actions/checkout`   | Clone tagged commit                  |
| `actions/setup-node` | Node.js + pnpm cache                 |
| `pnpm/action-setup`  | pnpm install                         |
| `gh` CLI             | Attach VSIX to GitHub Release assets |

---

## [DES-SEC] Security Considerations

- No PAT secrets required — VSIX packaging uses only `GITHUB_TOKEN` (auto-provided, free)
- Workflow uses `release` event (not `push`) — only fires when a real release is published, not on every commit
- No `pull_request_target` trigger — `GITHUB_TOKEN` cannot be exfiltrated by fork PRs

---

## [DES-ERR] Error Handling

| Scenario                  | Handling                                                                 |
| ------------------------- | ------------------------------------------------------------------------ |
| VSIX packaging fails      | `vsce package` exits non-zero; `gh release upload` step skipped          |
| `gh release upload` fails | VSIX not attached to release; re-run workflow or upload `.vsix` manually |

---

## [DES-TEST] Testing Strategy

The publish workflow is validated by creating a test release and confirming the VSIX file appears as a GitHub Release asset. No automated tests for the workflow itself.

---

## [DES-ROLLOUT] Migration / Rollout Plan

### Phase 1: First VSIX build

1. Merge the release PR created by release-please
2. Confirm the GitHub Release triggers `build-vsix.yml`
3. Download the `.vsix` from the GitHub Release assets
4. Upload to VS Code Marketplace and/or OpenVSX manually

### Rollback Plan

Delete the GitHub Release if the VSIX is incorrect. Re-tag and re-release with a patch version. Re-upload the corrected VSIX to the marketplace manually.

---

## File Reference Map

| Task | File                               | Required @see                             |
| ---- | ---------------------------------- | ----------------------------------------- |
| —    | `.github/workflows/build-vsix.yml` | `spec.md [FR-1]` + `design.md [DES-ARCH]` |
