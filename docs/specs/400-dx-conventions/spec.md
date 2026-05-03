---
afx: true
type: SPEC
status: Draft
owner: "@rixrix"
version: "1.1"
created_at: "2026-04-26T04:32:48.000Z"
updated_at: "2026-05-03T01:30:59.000Z"
tags: ["dx", "conventions", "commitlint", "commit-log", "kebab-case", "editorconfig"]
---

# DX Conventions — Product Specification

## References

- **Architecture**: [AGENTS.md — TypeScript and import conventions](../../../AGENTS.md)

---

## Problem Statement

Inconsistent commit messages, filenames, and editor settings cause churn in PRs and make git history harder to parse. A single set of enforced conventions eliminates these classes of noise.

The commit log must also be useful to future AI agents. Valid Conventional Commit headers are necessary, but not enough: non-trivial commits should explain the intent, changed surfaces, governing specs, traceability changes, generated artifacts, and verification run so future surgical work can start from the history without reconstructing context from scratch.

---

## Requirements

### Functional Requirements

| ID    | Requirement                                                                                          | Priority    |
| ----- | ---------------------------------------------------------------------------------------------------- | ----------- |
| FR-1  | Commitlint enforces Conventional Commits format with mandatory scope (from scope-enum)               | Must Have   |
| FR-2  | Scope-enum includes all workspace packages plus hand-maintained supplementary scopes                 | Must Have   |
| FR-3  | ESLint unicorn plugin enforces kebab-case filenames across all `src/` files                          | Must Have   |
| FR-4  | `.editorconfig` enforces UTF-8, 2-space indent, LF line endings, trim trailing whitespace            | Must Have   |
| FR-5  | `.gitmessage` template guides conventional commit format and the expanded AFX commit-log body        | Must Have   |
| FR-6  | husky pre-commit and commit-msg hooks enforce lint and commitlint locally                            | Must Have   |
| FR-7  | Non-trivial commits describe Why, Changed, Spec, Traceability, and Verification sections in the body | Should Have |
| FR-8  | Commit bodies call out generated artifacts, vendored assets, and docs-only/spec-only changes clearly | Should Have |
| FR-9  | Multi-surface commits identify the primary governing spec and each touched surface                   | Should Have |
| FR-10 | PR templates remind authors to provide commit-log-quality context, not just pass commitlint          | Should Have |
| FR-11 | Commit headers use type/scope combinations that match release impact and changed surface ownership   | Must Have   |

### Non-Functional Requirements

| ID    | Requirement                                            | Target                        |
| ----- | ------------------------------------------------------ | ----------------------------- |
| NFR-1 | Commitlint runs in < 1s on commit                      | Git hook latency              |
| NFR-2 | Expanded commit bodies stay scan-friendly              | 5 short labeled sections max  |
| NFR-3 | Commit guidance remains compatible with release-please | Conventional Commit compliant |

---

## Non-Goals

- No semantic release tooling (that's in `510-ci-release`)
- No branch naming enforcement
- No automated enforcement of body sections beyond commitlint header/footer rules
- No requirement that tiny mechanical commits include a long body

---

## Dependencies

- `@commitlint/config-conventional`, `commitlint`
- `husky`
- `eslint-plugin-unicorn` (part of `410-dx-quality`)

---

## Appendix

### AFX Commit Body Shape

Use this body shape for non-trivial commits, especially spec-driven work, multi-surface changes, traceability migrations, generated artifacts, and behavior changes.

```text
Why:
- What problem this solves.

Changed:
- What changed, grouped by surface.

Spec:
- docs/specs/XXX-name/spec.md [FR-X]
- docs/specs/XXX-name/design.md [DES-X]

Traceability:
- @see retargeting, map IDs, generated artifacts, or none.

Verification:
- pnpm verify
```

### Header Selection Rules

| Change Kind                          | Preferred Header Example                        |
| ------------------------------------ | ----------------------------------------------- |
| Living spec/design/tasks only        | `docs(spec): expand commit log convention`      |
| DX convention/tooling change         | `docs(dx): document commit body contract`       |
| Runtime/user-facing feature          | `feat(chat): add composer queue affordance`     |
| Bug fix                              | `fix(vscode): guard empty editor selection`     |
| Behavior-preserving source reshaping | `refactor(shared): split runtime status helper` |
| Tests only                           | `test(pi): cover rpc frame unwrap`              |
| CI/workflow change                   | `ci(repo): add verify gate`                     |
| Dependency or generated maintenance  | `chore(deps): update pnpm lockfile`             |
