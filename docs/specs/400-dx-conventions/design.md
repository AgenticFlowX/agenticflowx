---
afx: true
type: DESIGN
status: Approved
owner: "@rixrix"
version: "1.1"
created_at: "2026-04-26T04:32:48.000Z"
updated_at: "2026-05-09T12:21:59.000Z"
tags: ["dx", "conventions", "commitlint", "commit-log", "editorconfig", "husky"]
spec: spec.md
---

# DX Conventions — Technical Design

---

## [DES-OVR] Overview

Conventions are enforced at commit time via Husky + commitlint (message format) and at lint time via ESLint unicorn plugin (file/variable naming). Editor-level consistency is handled by `.editorconfig`. The `.gitmessage` template surfaces the Conventional Commit format and the AFX commit-log body contract in `git commit` without requiring memorisation.

---

## [DES-ARCH] Architecture

```text
commitlint.config.mjs
  → @commitlint/config-conventional (type rules)
  → scripts/commitlint-scopes.mjs   (scope-enum, generated)

.husky/commit-msg
  → pnpm exec commitlint --edit $1

.husky/pre-commit
  → pnpm lint-staged (lint changed files only)

eslint.config.mjs  (see 410-dx-quality)
  → eslint-plugin-unicorn (kebab-case filenames, variable conventions)

.editorconfig
  → indent_style = space, indent_size = 2
  → end_of_line = lf
  → trim_trailing_whitespace = true
  → insert_final_newline = true

.gitmessage
  → header template + body sections for future-agent-readable history

.github/PULL_REQUEST_TEMPLATE.md
  → reminds authors to make PR title commitlint-valid and commit body/context useful
```

### [DES-DX-CONVENTIONS-COMMIT-TYPES] Conventional Commit Types

| Type                                      | Semver Impact | Use                 |
| ----------------------------------------- | ------------- | ------------------- |
| `feat`                                    | minor         | New feature         |
| `fix`                                     | patch         | Bug fix             |
| `BREAKING CHANGE` footer                  | major         | Breaking API change |
| `chore`, `docs`, `refactor`, `test`, `ci` | none          | Non-releasing work  |

### [DES-DX-CONVENTIONS-COMMIT-BODY] AFX Commit Body Contract

Commitlint enforces the header, but the AFX convention asks non-trivial commits to carry a compact, labeled body. This is advisory, not machine-enforced, because tiny mechanical commits should stay lightweight and body quality requires judgement.

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

### [DES-DX-CONVENTIONS-SCOPE-SELECTION] Type And Scope Selection

| Scenario                                      | Header Rule                                                                                    |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| User-facing/runtime behavior changes          | Use `feat` or `fix`; scope is the app/package surface that owns the behavior                   |
| Living spec, design, tasks, ADR, or docs only | Use `docs(scope)`; `scope` should be `spec`, `docs`, or the owning surface                     |
| Behavior-preserving code movement             | Use `refactor(scope)` and state "behavior unchanged" in the body                               |
| Tests only                                    | Use `test(scope)` and name the tested contract                                                 |
| CI or workflow changes                        | Use `ci(scope)` for GitHub Actions or release flow                                             |
| Dependencies, generated assets, vendoring     | Use `chore(scope)` and call out generated/vendored artifacts in `Traceability` or `Changed`    |
| Cross-surface commits                         | Scope by the primary owner; list secondary surfaces in `Changed` and governing specs in `Spec` |
| Breaking API or message contract changes      | Use `!` after scope or `BREAKING CHANGE:` footer; include migration note in body               |

### [DES-DX-CONVENTIONS-RELEASE-PLEASE] Release-Please Notes

Release-please reads Conventional Commit headers and breaking-change footers. The AFX body sections are for humans and agents; they must not replace the Conventional Commit header.

---

## [DES-DEC] Key Decisions

| Decision          | Options Considered                              | Choice                             | Rationale                                                                |
| ----------------- | ----------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------ |
| Commit validation | Manual convention, commitlint, semantic-release | commitlint + Husky                 | Machine-enforceable; integrates with release-please semver detection     |
| Scope list source | Hand-maintained, generated                      | Generated from workspace + extras  | Stays in sync with package additions automatically                       |
| File naming       | PascalCase, camelCase, kebab-case               | kebab-case (unicorn)               | Uniform across TS and TSX; avoids case-sensitivity bugs on macOS/Windows |
| Import order      | Manual, eslint-plugin-import                    | eslint-plugin-import (via unicorn) | Consistent grouping: built-ins → external → internal → relative          |
| Commit body depth | Header only, free-form body, labeled AFX body   | Labeled AFX body                   | Makes git history useful for future surgical agent work                  |

---

## [DES-FILES] File Structure

| File                               | Purpose                                        |
| ---------------------------------- | ---------------------------------------------- |
| `commitlint.config.mjs`            | commitlint rules: type + scope-enum            |
| `.husky/commit-msg`                | Hook: runs commitlint on commit message        |
| `.husky/pre-commit`                | Hook: runs lint-staged on staged files         |
| `.editorconfig`                    | Editor whitespace and EOL settings             |
| `.gitmessage`                      | Commit header/body template                    |
| `.github/PULL_REQUEST_TEMPLATE.md` | PR checklist for title and commit-log context  |
| `AGENTS.md`                        | Agent-facing commit-log summary                |
| `scripts/commitlint-scopes.mjs`    | Generated scope enum (see `320-infra-scripts`) |

---

## [DES-DEPS] Dependencies

| Package                           | Purpose                                  |
| --------------------------------- | ---------------------------------------- |
| `@commitlint/cli`                 | Commit message linting                   |
| `@commitlint/config-conventional` | Conventional Commit ruleset              |
| `husky`                           | Git hook management                      |
| `lint-staged`                     | Run linters on staged files only         |
| `eslint-plugin-unicorn`           | kebab-case filenames, naming conventions |

---

## [DES-SEC] Security Considerations

- Husky hooks run locally only; not a security gate for CI (CI has its own `pr-title` job)
- `lint-staged` runs only on staged files — no full-repo scan on commit

---

## [DES-ERR] Error Handling

| Scenario                        | Handling                                                                                        |
| ------------------------------- | ----------------------------------------------------------------------------------------------- |
| Commit message fails commitlint | Hook exits non-zero; commit aborted with error message                                          |
| Husky not installed             | Hooks silently absent; `pnpm prepare` installs husky automatically post-install                 |
| Commit body omitted             | Allowed for tiny mechanical commits; reviewers can request body context for non-trivial changes |
| Generated artifact included     | Commit body must name the generator/source command or state why the artifact is committed       |

---

## [DES-TEST] Testing Strategy

### [DES-DX-CONVENTIONS-TEST-MANUAL] Manual Tests

Convention tooling is not unit-tested. Correctness validated by attempting a commit with an invalid message and observing rejection.

Template changes are validated by Markdown/format checks and by manually inspecting `.gitmessage` for:

- Conventional Commit header shape
- Allowed type/scope hints
- AFX body sections
- Breaking-change footer guidance

---

## [DES-ROLLOUT] Migration / Rollout Plan

### [DES-DX-CONVENTIONS-ROLLOUT-SCOPE] Phase 1: Add a new allowed scope

1. Add the scope to `EXTRA_SCOPES` in `scripts/generate-scope-enum.mjs` (or add a new workspace package)
2. Run `node scripts/generate-scope-enum.mjs`
3. Commit: `chore(scripts): add <scope> to commitlint scope-enum`

### [DES-DX-CONVENTIONS-ROLLOUT-COMMIT-BODY] Phase 2: Author a non-trivial commit

1. Use a commitlint-valid header: `<type>(<scope>): <imperative summary>`
2. Fill the AFX body sections when the change affects behavior, specs, architecture, traceability, generated assets, or multiple surfaces
3. Include verification commands that were actually run
4. Keep tiny mechanical commits body-free when the header fully explains the change

### [DES-DX-CONVENTIONS-ROLLOUT-ROLLBACK] Rollback Plan

Revert `.gitmessage`, `.github/PULL_REQUEST_TEMPLATE.md`, and this spec/design update if the expanded body convention proves too heavy. Revert `commitlint-scopes.mjs` only when rolling back allowed scopes.

---

## [DES-DX-CONVENTIONS-LOC] Code Locator Map

| Convention surface     | Source anchor                                                      | Design node                                                                 |
| ---------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| Commit header lint     | `commitlint.config.mjs`, `.husky/commit-msg`                       | `[DES-DX-CONVENTIONS-COMMIT-TYPES]`, `[DES-DX-CONVENTIONS-SCOPE-SELECTION]` |
| Generated scopes       | `scripts/commitlint-scopes.mjs`, `scripts/generate-scope-enum.mjs` | `[DES-DX-CONVENTIONS-SCOPE-SELECTION]`                                      |
| Commit body template   | `.gitmessage`                                                      | `[DES-DX-CONVENTIONS-COMMIT-BODY]`                                          |
| PR title/body guidance | `.github/PULL_REQUEST_TEMPLATE.md`                                 | `[DES-DX-CONVENTIONS-RELEASE-PLEASE]`, `[DES-DX-CONVENTIONS-COMMIT-BODY]`   |
| Editor defaults        | `.editorconfig`                                                    | `[DES-FILES]`                                                               |
