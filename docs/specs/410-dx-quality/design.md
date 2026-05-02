---
afx: true
type: DESIGN
status: Approved
owner: "@rixrix"
version: "1.0"
created_at: "2026-04-26T04:32:48.000Z"
updated_at: "2026-04-28T01:37:40.000Z"
tags: [dx, quality, eslint, prettier, knip, size-limit]
spec: spec.md
---

# DX Quality — Technical Design

---

## [DES-OVR] Overview

A single ESLint v9 flat config (`eslint.config.mjs`) composes TypeScript strict, React, React Hooks, Prettier compat, and unicorn rules. Prettier runs through ESLint via `eslint-config-prettier` (disables conflicting formatting rules) — no separate `prettier` CLI invocation is needed in the lint step. Markdownlint, knip, and size-limit are separate tools targeting markdown, unused exports, and bundle size respectively.

---

## [DES-ARCH] Architecture

```text
eslint.config.mjs           ← flat config composition
  → @eslint/js recommended
  → typescript-eslint strict
  → eslint-plugin-react + eslint-plugin-react-hooks
  → eslint-plugin-unicorn
  → eslint-config-prettier  (last: disables format rules)
  → ignore: generated outputs, .vscode-test, shadcn-generated UI

.prettierrc.json            ← single quotes, 2-space indent, trailing comma
markdownlint-cli2 config    ← .markdownlint.json + generated-output CLI excludes
knip.json                   ← entry points, ignore patterns per package
.size-limit.json            ← apps/chat dist/ bundle budget
```

### Lint Command Chain

```text
pnpm lint
  → eslint . --ext ts,tsx          (type errors, format, naming)
  → markdownlint-cli2 "**/*.md"   (markdown formatting)
  → knip                           (unused exports + deps)
```

---

## [DES-DEC] Key Decisions

| Decision             | Options Considered                                       | Choice                                            | Rationale                                                                                  |
| -------------------- | -------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| ESLint version       | v8 (legacy), v9 flat config                              | v9 flat config                                    | Future-psourcef; flat config eliminates `.eslintignore` file, inline ignores cleaner       |
| Prettier integration | Separate `prettier --check` step, ESLint prettier plugin | `eslint-config-prettier` (disable only)           | Avoids double-reporting; Prettier still runs via `pnpm format`; ESLint just won't conflict |
| Shadcn exclusion     | Per-rule disable comments, global ignore                 | Global ignore glob for `components/ui/`           | Shadcn regenerates these files — maintaining per-file overrides is fragile                 |
| knip scope           | root only, per-package                                   | Workspace root knip with per-package entry config | Single `knip` invocation covers all packages; entry points declared in `knip.json`         |

---

## [DES-FILES] File Structure

| File                 | Purpose                                     |
| -------------------- | ------------------------------------------- |
| `eslint.config.mjs`  | ESLint v9 flat config                       |
| `.prettierrc.json`   | Prettier formatting rules                   |
| `.markdownlint.json` | Markdownlint rule overrides (disable MD013) |
| `package.json`       | Quality command scripts and CLI excludes    |
| `knip.json`          | Unused export/dependency detection config   |
| `.size-limit.json`   | Bundle size budget for `apps/chat`          |

---

## [DES-DEPS] Dependencies

| Package                     | Purpose                                          |
| --------------------------- | ------------------------------------------------ |
| `eslint`                    | Core linter                                      |
| `@eslint/js`                | ESLint recommended ruleset                       |
| `typescript-eslint`         | TypeScript-aware rules                           |
| `eslint-plugin-react`       | React-specific rules                             |
| `eslint-plugin-react-hooks` | Hooks rules (exhaustive-deps)                    |
| `eslint-plugin-unicorn`     | Naming and modern JS conventions                 |
| `eslint-config-prettier`    | Disable ESLint rules that conflict with Prettier |
| `prettier`                  | Code formatter                                   |
| `markdownlint-cli2`         | Markdown linting                                 |
| `knip`                      | Unused exports and dead dependencies             |
| `@size-limit/preset-app`    | Bundle size reporting                            |

---

## [DES-SEC] Security Considerations

- ESLint unicorn rules flag `eval()`, `new Function()`, and similar dynamic constructs
- No security-specific ESLint plugins currently (out of scope per spec)

---

## [DES-ERR] Error Handling

| Scenario                 | Handling                                                               |
| ------------------------ | ---------------------------------------------------------------------- |
| ESLint parse error       | Reports file + line; non-zero exit                                     |
| knip finds unused export | Reports export path; non-zero exit in CI (`knip --no-exit-code=false`) |
| size-limit over budget   | Reports delta; non-zero exit                                           |

---

## [DES-TEST] Testing Strategy

### Unit Tests

Quality tooling configs are not unit-tested. Correctness verified by running `pnpm lint` and observing zero errors on a clean codebase.

---

## [DES-ROLLOUT] Migration / Rollout Plan

### Phase 1: Add a new ESLint rule

1. Add rule to `eslint.config.mjs`
2. Run `pnpm lint` to audit violations
3. Fix or suppress violations with inline `// eslint-disable-next-line` + rationale comment
4. Commit with `chore(dx): add <rule> to eslint config`

### Rollback Plan

Revert `eslint.config.mjs`. Lint step passes on next CI run.
