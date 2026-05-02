---
afx: true
type: SPEC
status: Approved
owner: "@rixrix"
version: "1.0"
created_at: "2026-04-26T04:32:48.000Z"
updated_at: "2026-04-28T01:37:40.000Z"
tags: [dx, conventions, commitlint, kebab-case, editorconfig]
---

# DX Conventions — Product Specification

## References

- **Architecture**: [AGENTS.md — TypeScript and import conventions](../../../AGENTS.md)

---

## Problem Statement

Inconsistent commit messages, filenames, and editor settings cause churn in PRs and make git history harder to parse. A single set of enforced conventions eliminates these classes of noise.

---

## Requirements

### Functional Requirements

| ID   | Requirement                                                                               | Priority    |
| ---- | ----------------------------------------------------------------------------------------- | ----------- |
| FR-1 | Commitlint enforces Conventional Commits format with mandatory scope (from scope-enum)    | Must Have   |
| FR-2 | Scope-enum includes all workspace packages plus hand-maintained supplementary scopes      | Must Have   |
| FR-3 | ESLint unicorn plugin enforces kebab-case filenames across all `src/` files               | Must Have   |
| FR-4 | `.editorconfig` enforces UTF-8, 2-space indent, LF line endings, trim trailing whitespace | Must Have   |
| FR-5 | `.gitmessage` template guides conventional commit format                                  | Should Have |
| FR-6 | husky pre-commit and commit-msg hooks enforce lint and commitlint locally                 | Must Have   |

### Non-Functional Requirements

| ID    | Requirement                       | Target           |
| ----- | --------------------------------- | ---------------- |
| NFR-1 | Commitlint runs in < 1s on commit | Git hook latency |

---

## Non-Goals

- No semantic release tooling (that's in `510-ci-release`)
- No branch naming enforcement

---

## Dependencies

- `@commitlint/config-conventional`, `commitlint`
- `husky`
- `eslint-plugin-unicorn` (part of `410-dx-quality`)
