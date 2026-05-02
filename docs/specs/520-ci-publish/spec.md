---
afx: true
type: SPEC
status: Approved
owner: "@rixrix"
version: "1.1"
created_at: "2026-04-26T04:32:48.000Z"
updated_at: "2026-04-28T01:37:40.000Z"
tags: [ci, publish, vsix]
depends_on: [510-ci-release]
---

# CI Publish — Product Specification

## References

- **Architecture**: `.github/workflows/marketplace-publish.yml`

---

## Problem Statement

When a GitHub Release is published, the extension VSIX must be packaged and attached to the GitHub Release as a downloadable artifact. Marketplace upload is performed manually by the developer.

---

## Requirements

### Functional Requirements

| ID   | Requirement                                                                               | Priority  |
| ---- | ----------------------------------------------------------------------------------------- | --------- |
| FR-1 | `build-vsix.yml` triggers on GitHub Release published (v\* tag)                           | Must Have |
| FR-2 | Build all packages, then package VSIX via `pnpm exec vsce package`                        | Must Have |
| FR-3 | Attach VSIX artifact to the GitHub Release for manual marketplace upload by the developer | Must Have |

### Non-Functional Requirements

| ID    | Requirement                           | Target                             |
| ----- | ------------------------------------- | ---------------------------------- |
| NFR-1 | VSIX packaging is idempotent on retry | `vsce package` overwrites the file |

---

## Non-Goals

- No automated marketplace publish (developer downloads VSIX and uploads manually)
- No OpenVSX automated publish
- No pre-release or nightly publishing
- No self-hosted marketplace

---

## Dependencies

- `510-ci-release` (triggers via GitHub Release created by release-please)
- `@vscode/vsce` CLI (VSIX packaging only)
