---
afx: true
type: SPEC
status: Living
owner: "@rixrix"
version: "1.0"
created_at: "2026-04-26T04:32:48.000Z"
updated_at: "2026-05-17T09:04:20.000Z"
tags: [ci, code-qa, pr-gate, lint, types, e2e]
depends_on: [410-dx-quality, 420-dx-testing, 310-infra-build]
---

# CI Code QA — Product Specification

## References

- **Architecture**: [AGENTS.md — Verification requirements](../../../AGENTS.md)

---

## Problem Statement

PRs need an automated gate that catches lint errors, type errors, broken tests, bundle regressions, and malformed commit messages before merge.

---

## Requirements

### Functional Requirements

| ID   | Requirement                                                                   | Priority    |
| ---- | ----------------------------------------------------------------------------- | ----------- |
| FR-1 | `code-qa.yml` runs on every PR to `main`                                      | Must Have   |
| FR-2 | `lint` job: ESLint, Prettier, markdownlint checks                             | Must Have   |
| FR-3 | `types` job: `pnpm check:types` (turbo run check-types)                       | Must Have   |
| FR-4 | `unit` job: Vitest coverage across workspace                                  | Must Have   |
| FR-5 | `e2e-webview` job: Playwright tests for `apps/chat`                           | Must Have   |
| FR-6 | `e2e-vscode` job: vscode-test-electron matrix (ubuntu-latest, windows-latest) | Must Have   |
| FR-7 | `bundle-size` job: size-limit reporting                                       | Should Have |
| FR-8 | `pr-title` job: Conventional Commit format validation on PR title             | Must Have   |
| FR-9 | All jobs must pass before merge (branch protection)                           | Must Have   |

### Non-Functional Requirements

| ID    | Requirement                           | Target            |
| ----- | ------------------------------------- | ----------------- |
| NFR-1 | Full CI run completes in < 15 minutes | Parallelised jobs |

---

## Non-Goals

- No deployment in this workflow (see `520-ci-publish`)
- No scheduled runs

---

## Dependencies

- `410-dx-quality` (lint + types tooling)
- `420-dx-testing` (unit + e2e runners)
- `310-infra-build` (build step)
