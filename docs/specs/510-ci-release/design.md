---
afx: true
type: DESIGN
status: Draft
owner: "@rixrix"
version: "1.2"
created_at: "2026-04-26T04:32:48.000Z"
updated_at: "2026-05-03T03:07:51.000Z"
tags: ["ci", "release", "release-please", "changelog", "semver", "changelogen", "traceability"]
spec: spec.md
---

# CI Release — Technical Design

---

## [DES-OVR] Overview

`release-please.yml` is triggered manually via `workflow_dispatch` (full automation via `push: main` is a one-line toggle for later). `googleapis/release-please-action@v4` reads Conventional Commit history since the last release tag, updates `CHANGELOG.md`, bumps `version` in `package.json`, and opens or updates a single release PR. Merging that PR creates a git tag and a GitHub Release — which then triggers the publish workflow. Locally, `pnpm changelog` runs `changelogen --dry` for a no-network CHANGELOG preview.

---

## [DES-ARCH] Architecture

```text
.github/workflows/release-please.yml
  trigger: workflow_dispatch  ← manual now; switch to push → main for full automation

  jobs:
    release-please
      → googleapis/release-please-action@v4
      → config:  release-please-config.json
      → manifest: .release-please-manifest.json

release-please-config.json
  → packages: { ".": { "release-type": "node" } }
  → changelog-sections, bump-minor-pre-major, etc.

.release-please-manifest.json
  → { ".": "0.0.1" }   ← current version; updated by release-please on each release
```

### [DES-CI-RELEASE-FLOW-GHA] Release Flow (GHA)

```text
developer triggers workflow_dispatch on release-please.yml
  → release-please reads commits since last tag
  → opens/updates PR: "chore(main): release 0.x.y"
  → PR body: generated CHANGELOG diff

merge release PR
  → release-please creates git tag v0.x.y
  → release-please creates GitHub Release with CHANGELOG content
  → triggers build-vsix.yml (on: release published)
```

### [DES-CI-RELEASE-FLOW-LOCAL] Local Preview Flow

```text
developer runs: pnpm changelog
  → changelogen --dry reads local git log since last tag
  → prints CHANGELOG diff to stdout
  → no network, no token, no side effects
```

---

## [DES-CHANGELOG] Changelog Section Mapping

> See `400-dx-conventions/design.md [DES-ARCH]` for commit format rules and husky enforcement.

release-please maps Conventional Commit types to CHANGELOG sections as configured in `release-please-config.json`. Only releasable types appear in the generated CHANGELOG.

| Commit Type                    | CHANGELOG Section  | Semver Impact | Included in CHANGELOG |
| ------------------------------ | ------------------ | ------------- | --------------------- |
| `feat`                         | Features           | minor         | Yes                   |
| `fix`                          | Bug Fixes          | patch         | Yes                   |
| `perf`                         | Performance        | patch         | Yes                   |
| `revert`                       | Reverts            | patch         | Yes                   |
| `docs`                         | Documentation      | none          | No (default)          |
| `refactor`                     | Code Refactoring   | none          | No                    |
| `test`, `ci`, `chore`, `build` | (omitted)          | none          | No                    |
| `BREAKING CHANGE` footer       | ⚠ Breaking Changes | major         | Yes                   |

`changelogen --dry` (local) reads the same git log and produces the same section groupings without network access.

---

## [DES-DEC] Key Decisions

| Decision             | Options Considered                                         | Choice                                     | Rationale                                                                             |
| -------------------- | ---------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------- |
| Release tool         | semantic-release, standard-version, release-please         | release-please v4                          | PR-based review gate; config-file driven (v4); `GITHUB_TOKEN` auto-provided, free     |
| Release trigger      | `push: main` (auto), `workflow_dispatch` (manual)          | `workflow_dispatch` for now                | Manual gives control during early development; flip to auto in one line when ready    |
| Local changelog      | release-please CLI (needs GitHub API), changelogen (local) | `changelogen --dry` via `pnpm changelog`   | No token, no network — pure git log read; fast local feedback without touching GitHub |
| Config mode          | Bootstrap (single-package), config-file                    | Config-file (`release-please-config.json`) | Explicit, reviewable, supports multi-package expansion later                          |
| Release type         | `simple`, `node`, `python`                                 | `node`                                     | Updates `package.json` version field automatically                                    |
| Pre-release channels | alpha/beta channel                                         | None (out of scope)                        | Adds complexity without current need                                                  |

---

## [DES-FILES] File Structure

| File                                   | Purpose                                                            |
| -------------------------------------- | ------------------------------------------------------------------ |
| `.github/workflows/release-please.yml` | Workflow — `workflow_dispatch` trigger; runs release-please action |
| `release-please-config.json`           | release-please package config (release type, sections)             |
| `.release-please-manifest.json`        | Current released version per package (updated by action)           |

---

## [DES-DEPS] Dependencies

| Package / Action                      | Purpose                                                          |
| ------------------------------------- | ---------------------------------------------------------------- |
| `googleapis/release-please-action@v4` | Opens/updates release PR, creates tag + GitHub Release (GHA)     |
| `changelogen` (dev)                   | Local CHANGELOG preview (`pnpm changelog` → `changelogen --dry`) |

---

## [DES-SEC] Security Considerations

- Requires `GITHUB_TOKEN` with `contents: write` and `pull-requests: write` permissions
- Permissions are scoped to the workflow job only — no org-wide token
- `.release-please-manifest.json` is committed to the repo — version state is auditable in git history

---

## [DES-ERR] Error Handling

| Scenario                                 | Handling                                                |
| ---------------------------------------- | ------------------------------------------------------- |
| No releasable commits since last tag     | release-please makes no PR; workflow exits successfully |
| Release PR already open                  | release-please updates the existing PR (idempotent)     |
| `GITHUB_TOKEN` missing write permissions | Action fails with 403; release PR not created           |

---

## [DES-TEST] Testing Strategy

The release flow is validated by inspecting the release PR after a conventional commit lands on `main`. No automated tests for the workflow itself.

---

## [DES-ROLLOUT] Migration / Rollout Plan

### [DES-CI-RELEASE-ROLLOUT-CUT] Phase 1: Cut a release

1. Write conventional commits and merge to `main`
2. Run `pnpm changelog` locally to preview the CHANGELOG diff
3. Trigger `release-please.yml` manually via `gh workflow run release-please.yml` or GitHub UI
4. Review CHANGELOG diff in the opened release PR
5. Merge to create git tag + GitHub Release

### [DES-CI-RELEASE-ROLLOUT-ROLLBACK] Rollback Plan

If a bad release is tagged: delete the GitHub Release and the git tag manually, then revert the version bump commit. release-please will re-open a corrected PR on next push.

---

## [DES-CI-RELEASE-LOC] Code Locator Map

| Release surface     | Source anchor                          | Design node                    |
| ------------------- | -------------------------------------- | ------------------------------ |
| Release PR workflow | `.github/workflows/release-please.yml` | `[DES-CI-RELEASE-FLOW-GHA]`    |
| Release config      | `release-please-config.json`           | `[DES-CHANGELOG]`, `[DES-DEC]` |
| Version manifest    | `.release-please-manifest.json`        | `[DES-ARCH]`                   |
| Local preview       | `package.json` `changelog` script      | `[DES-CI-RELEASE-FLOW-LOCAL]`  |

---

## [DES-CI-RELEASE-REFS] File Reference Map

| Task | File                                   | Required @see                                            |
| ---- | -------------------------------------- | -------------------------------------------------------- |
| —    | `.github/workflows/release-please.yml` | `spec.md [FR-1]` + `design.md [DES-CI-RELEASE-FLOW-GHA]` |
