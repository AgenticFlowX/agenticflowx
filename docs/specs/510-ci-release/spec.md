---
afx: true
type: SPEC
status: Living
owner: "@rixrix"
version: "1.1"
created_at: "2026-04-26T04:32:48.000Z"
updated_at: "2026-05-17T09:04:20.000Z"
tags: [ci, release, release-please, changelog, semver, changelogen]
depends_on: [310-infra-build]
---

# CI Release — Product Specification

## References

- **Architecture**: `.release-please-manifest.json`, `release-please-config.json`

---

## Problem Statement

Releases need an automated CHANGELOG and version bump driven by Conventional Commit history, without requiring manual version management.

---

## Requirements

### Functional Requirements

| ID   | Requirement                                                                                                                                            | Priority  |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- |
| FR-1 | `release-please.yml` is triggered manually via `workflow_dispatch`; trigger is designed to be switched to `push: branches: [main]` for full automation | Must Have |
| FR-2 | release-please v4 (config-file driven) opens or updates a release PR with CHANGELOG                                                                    | Must Have |
| FR-3 | Merging the release PR creates a git tag and GitHub Release                                                                                            | Must Have |
| FR-4 | Version follows semver derived from Conventional Commit types (`feat` = minor, `fix` = patch, `BREAKING CHANGE` = major)                               | Must Have |
| FR-5 | Developer can preview the CHANGELOG locally via `pnpm changelog` (`changelogen --dry`) without any network access or token                             | Must Have |

### Non-Functional Requirements

| ID    | Requirement                                                   | Target                   |
| ----- | ------------------------------------------------------------- | ------------------------ |
| NFR-1 | Release PR is idempotent — repeated pushes update the same PR | release-please behaviour |

---

## Non-Goals

- No package publishing (see `520-ci-publish`)
- No pre-release channels

---

## Dependencies

- `310-infra-build` (version source in package.json)
- `googleapis/release-please-action`
- `changelogen` (local changelog preview, dev dependency)
