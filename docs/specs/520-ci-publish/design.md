---
afx: true
type: DESIGN
status: Approved
owner: "@rixrix"
version: "1.3"
created_at: "2026-04-26T04:32:48.000Z"
updated_at: "2026-07-19T03:56:24.000Z"
tags: ["ci", "publish", "vsix", "traceability", "licensing", "third-party-notices"]
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
      3. pnpm legal:check         ← verify artifact-aware notices are current
      4. pnpm exec vsce package   ← produces afx-agenticflowx-*.vsix
      5. inspect VSIX legal files ← LICENSE.txt + NOTICE + THIRD_PARTY_NOTICES.md
      6. gh release upload        ← attach VSIX to GitHub Release
```

### [DES-CI-PUBLISH-DISTRIBUTION] Distribution

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

| File                                    | Purpose                                                                    |
| --------------------------------------- | -------------------------------------------------------------------------- |
| `.github/workflows/build-vsix.yml`      | VSIX packaging + GitHub Release attachment                                 |
| `NOTICE`                                | Concise named project acknowledgments copied into the extension package    |
| `THIRD_PARTY_NOTICES.md`                | Generated exact shipped third-party license and NOTICE evidence            |
| `scripts/legal/third-party-notices.mjs` | Artifact-aware deterministic inventory/check owned by `430-dx-enforcement` |

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

| Scenario                                  | Handling                                                                     |
| ----------------------------------------- | ---------------------------------------------------------------------------- |
| VSIX packaging fails                      | `vsce package` exits non-zero; `gh release upload` step skipped              |
| Notice inventory is stale/unknown/missing | Legal check exits non-zero before packaging; no release artifact is uploaded |
| Packaged legal file missing               | Archive assertion fails and blocks upload even when source files exist       |
| `gh release upload` fails                 | VSIX not attached to release; re-run workflow or upload `.vsix` manually     |

---

## [DES-TEST] Testing Strategy

Before any upload, CI opens the produced VSIX and asserts the exact archive paths
`extension/LICENSE.txt`, `extension/NOTICE`, and
`extension/THIRD_PARTY_NOTICES.md`. The artifact-aware generator is run in
check mode against the tagged lockfile and built source-map/copied-asset inputs.
A test release still verifies the final GitHub Release attachment and install.

---

## [DES-ROLLOUT] Migration / Rollout Plan

### [DES-CI-PUBLISH-ROLLOUT-FIRST-BUILD] Phase 1: First VSIX build

1. Merge the release PR created by release-please
2. Confirm the GitHub Release triggers `build-vsix.yml`
3. Download the `.vsix` from the GitHub Release assets
4. Upload to VS Code Marketplace and/or OpenVSX manually

### [DES-CI-PUBLISH-ROLLOUT-ROLLBACK] Rollback Plan

Delete the GitHub Release if the VSIX is incorrect. Re-tag and re-release with a patch version. Re-upload the corrected VSIX to the marketplace manually.

---

## [DES-CI-PUBLISH-LOC] Code Locator Map

| Publish surface             | Source anchor                                               | Design node                                   |
| --------------------------- | ----------------------------------------------------------- | --------------------------------------------- |
| VSIX workflow               | `.github/workflows/build-vsix.yml`                          | `[DES-ARCH]`, `[DES-CI-PUBLISH-DISTRIBUTION]` |
| VSIX packaging command      | `.github/workflows/build-vsix.yml` `pnpm exec vsce package` | `[DES-ARCH]`                                  |
| GitHub Release asset upload | `.github/workflows/build-vsix.yml` `gh release upload`      | `[DES-CI-PUBLISH-DISTRIBUTION]`               |
| Legal artifact gate         | `.github/workflows/build-vsix.yml`, VSIX archive assertion  | `[DES-ARCH]`, `[DES-TEST]`                    |
| Manual marketplace upload   | release asset download step                                 | `[DES-CI-PUBLISH-DISTRIBUTION]`               |

---

## [DES-CI-PUBLISH-REFS] File Reference Map

| Task | File                               | Required @see                                                |
| ---- | ---------------------------------- | ------------------------------------------------------------ |
| —    | `.github/workflows/build-vsix.yml` | `spec.md [FR-1]` + `design.md [DES-CI-PUBLISH-DISTRIBUTION]` |
| —    | `NOTICE`, `THIRD_PARTY_NOTICES.md` | `spec.md [FR-4]` + `design.md [DES-TEST]`                    |
