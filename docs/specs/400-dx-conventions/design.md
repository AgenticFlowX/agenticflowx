---
afx: true
type: DESIGN
status: Approved
owner: "@rixrix"
version: "1.0"
created_at: "2026-04-26T04:32:48.000Z"
updated_at: "2026-04-28T01:37:40.000Z"
tags: [dx, conventions, commitlint, editorconfig, husky]
spec: spec.md
---

# DX Conventions — Technical Design

---

## [DES-OVR] Overview

Conventions are enforced at commit time via Husky + commitlint (message format) and at lint time via ESLint unicorn plugin (file/variable naming). Editor-level consistency is handled by `.editorconfig`. The `.gitmessage` template surfaces the Conventional Commit format in `git commit` without requiring memorisation.

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
  → commit template shown in editor when `git commit` is run (no -m flag)
```

### Conventional Commit Types

| Type                                      | Semver Impact | Use                 |
| ----------------------------------------- | ------------- | ------------------- |
| `feat`                                    | minor         | New feature         |
| `fix`                                     | patch         | Bug fix             |
| `BREAKING CHANGE` footer                  | major         | Breaking API change |
| `chore`, `docs`, `refactor`, `test`, `ci` | none          | Non-releasing work  |

---

## [DES-DEC] Key Decisions

| Decision          | Options Considered                              | Choice                             | Rationale                                                                |
| ----------------- | ----------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------ |
| Commit validation | Manual convention, commitlint, semantic-release | commitlint + Husky                 | Machine-enforceable; integrates with release-please semver detection     |
| Scope list source | Hand-maintained, generated                      | Generated from workspace + extras  | Stays in sync with package additions automatically                       |
| File naming       | PascalCase, camelCase, kebab-case               | kebab-case (unicorn)               | Uniform across TS and TSX; avoids case-sensitivity bugs on macOS/Windows |
| Import order      | Manual, eslint-plugin-import                    | eslint-plugin-import (via unicorn) | Consistent grouping: built-ins → external → internal → relative          |

---

## [DES-FILES] File Structure

| File                            | Purpose                                        |
| ------------------------------- | ---------------------------------------------- |
| `commitlint.config.mjs`         | commitlint rules: type + scope-enum            |
| `.husky/commit-msg`             | Hook: runs commitlint on commit message        |
| `.husky/pre-commit`             | Hook: runs lint-staged on staged files         |
| `.editorconfig`                 | Editor whitespace and EOL settings             |
| `.gitmessage`                   | Commit message template                        |
| `scripts/commitlint-scopes.mjs` | Generated scope enum (see `320-infra-scripts`) |

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

| Scenario                        | Handling                                                                        |
| ------------------------------- | ------------------------------------------------------------------------------- |
| Commit message fails commitlint | Hook exits non-zero; commit aborted with error message                          |
| Husky not installed             | Hooks silently absent; `pnpm prepare` installs husky automatically post-install |

---

## [DES-TEST] Testing Strategy

### Unit Tests

Convention tooling is not unit-tested. Correctness validated by attempting a commit with an invalid message and observing rejection.

---

## [DES-ROLLOUT] Migration / Rollout Plan

### Phase 1: Add a new allowed scope

1. Add the scope to `EXTRA_SCOPES` in `scripts/generate-scope-enum.mjs` (or add a new workspace package)
2. Run `node scripts/generate-scope-enum.mjs`
3. Commit: `chore(scripts): add <scope> to commitlint scope-enum`

### Rollback Plan

Revert `commitlint-scopes.mjs`. The scope is immediately rejected again on next commit attempt.
