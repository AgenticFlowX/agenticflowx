---
afx: true
type: SPRINT
status: Living
owner: "@rixrix"
version: "1.0"
created_at: "2026-04-28T02:36:26.000Z"
updated_at: "2026-04-28T05:17:39.000Z"
tags: ["430-dx-enforcement", "sprint", "dx", "security", "enforcement"]
approval:
  spec: Approved
  design: Approved
  tasks: Approved
---

# Repo Enforcement Hardening — Sprint Brief

> **Format**: Single-document SDD. Carries spec + design + tasks in one file for fast, surgical feature work.
> **Approval gates**: Sections must be approved in order — Spec → Design → Tasks → Code. Track via the `approval` block in frontmatter.
> **Graduation**: Run `/afx-sprint graduate` to split into `spec.md` / `design.md` / `tasks.md` when scope grows. Section structure below mirrors the parent templates (demoted one heading level) so graduation is a clean extract + heading-level promote + `@see` path retarget.

---

<!-- SPRINT-SECTION-START: SPEC (maps to spec.md on graduation — includes References + Section 1 body; drop `## 1. Spec` wrapper, promote ### → ##) -->

## References

> **Upstream Context**: Existing DX/quality specs that this sprint extends.

- **Predecessor specs**:
  - `docs/specs/400-dx-conventions/spec.md` (commitlint, kebab-case, editorconfig)
  - `docs/specs/410-dx-quality/spec.md` (eslint, prettier, knip, size-limit, markdownlint)
  - `docs/specs/420-dx-testing/spec.md` (vitest workspace, playwright, vscode-test-electron)
  - `docs/specs/500-ci-code-qa/spec.md` (PR gate jobs)
- **Architecture invariants** (currently doc-only, not lint-enforced):
  - `AGENTS.md` § "Architecture boundaries" — forbidden imports per package
  - `AGENTS.md` § "TypeScript and import conventions"
  - `AGENTS.md` § "Logging conventions" — structured logger only
- **Triggering audit**: 2026-04-28 conversation surfaced gaps between documented invariants and machine-checkable rules.

---

## 1. Spec

> The WHAT — requirements, acceptance, scope. Mirrors `afx-spec/assets/spec-template.md`.

### Problem Statement

Repository enforcement is partial. Existing primitives are wired (ESLint flat, Prettier, commitlint, husky pre-commit, knip, size-limit reporting, markdownlint, basic kebab-case filenames), but the most consequential invariants — architecture boundaries between packages, security hygiene (secrets, supply chain, application code), TypeScript strictness opt-outs, test/folder naming, and bundle budgets — are documented in `AGENTS.md` and `CLAUDE.md` but not enforced by any tool. With most coding done by AI agents, "documented but not checked" silently drifts into "broken." This sprint closes the gap while the codebase is small (~25 source modules across 4 apps + 5 packages, single feature integrated) so that the cost of catching up is bounded and every future PR has a single, deterministic gate.

### User Stories

#### Primary Users

- **AI coding agents** (Claude Code, Copilot, Codex, Gemini) — need a single `pnpm verify` that confirms their changes don't violate any invariant, runs locally in <90s, and surfaces violations as standard tool output (eslint diagnostics, vitest failures, exit codes) rather than prose review.
- **Human maintainers** — need a deterministic CI gate that catches the same violations in the same way, without trusting that an agent ran the local check.
- **Future contributors** — need machine-checkable guard rails so onboarding is "read AGENTS.md, run `pnpm verify`, you're done" rather than "memorize all the unwritten rules."

#### Stories

**As an** AI coding agent
**I want** a single command that runs every enforcement check the project has
**So that** I can validate my own changes before claiming a task is complete.

**As a** human maintainer
**I want** every documented architectural invariant to fail CI when violated
**So that** I do not have to manually catch boundary-crossing imports during review.

**As a** security-conscious owner
**I want** secrets, supply-chain, and application-code vulnerabilities flagged at commit time and on every PR
**So that** the marketplace-published VSIX cannot regress its security posture.

### Requirements

#### Functional Requirements

| ID    | Requirement                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Priority    |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| FR-1  | Provide a single `pnpm verify` command that runs the fast-path lifecycle: types + lint + format + md + knip + unit tests + naming guards. Replaces existing `ci`/`health`/`health:full` script trio.                                                                                                                                                                                                                                                                                                                                                          | Must Have   |
| FR-2  | Provide `pnpm verify:full` that extends `verify` with build + size-limit budgets + e2e (chat + vscode) + security suite. This is the CI default.                                                                                                                                                                                                                                                                                                                                                                                                              | Must Have   |
| FR-3  | Wire a `.husky/pre-push` hook that runs `pnpm verify`, blocking pushes that fail. Fast-path only — no e2e/build at push time.                                                                                                                                                                                                                                                                                                                                                                                                                                 | Must Have   |
| FR-4  | Enforce `AGENTS.md` "Forbidden imports" via ESLint `no-restricted-imports` per package: vscode→no React/transport; chat+workbench→no `vscode` or `@afx/agent-*`; agent/\*→no `vscode`/React; shared+parsers→no `vscode`/React; webviews→no `node:child_process`/`node:fs`.                                                                                                                                                                                                                                                                                    | Must Have   |
| FR-5  | Enforce file naming. Unit tests use `*.test.ts(x)` colocated next to source. `*.spec.ts` is reserved for **Playwright** webview e2e in `apps/chat/e2e/**` only. `apps/vscode-e2e/src/**` keeps `*.test.ts` (vscode-test-electron has no `.spec` convention; renaming would be churn for no gain).                                                                                                                                                                                                                                                             | Must Have   |
| FR-6  | Forbid `__tests__/` directories anywhere in the repo. Test fixtures use `__fixtures__/`. Enforced via guard test + lint rule.                                                                                                                                                                                                                                                                                                                                                                                                                                 | Must Have   |
| FR-7  | Enforce **lowercase kebab-case** for every folder name in the workspace (any length — single-word like `ui`/`pi` is fine, hyphenated like `agent-runtime` is fine; reject `camelCase`, `PascalCase`, `SCREAMING_SNAKE`, `snake_case`, mixed-case). Numbered prefixes like `100-package-shared` are kebab-compliant and allowed. Allowlist: double-underscore conventions (`__fixtures__`, `__mocks__`, `__snapshots__`) and managed dirs (`node_modules`, `.turbo`, `.vscode-test`, `.husky`, `.github`, `.vscode`, `.afx`, `.claude`, `.agents`).            | Must Have   |
| FR-8  | Restore TypeScript `strict` in `packages/ui` and re-enable `noUnusedLocals`/`noUnusedParameters` in `apps/chat`. Shadcn-generated files (`packages/ui/src/components/**`, `packages/ui/src/hooks/**`) keep their relaxation, scoped to those paths only.                                                                                                                                                                                                                                                                                                      | Must Have   |
| FR-9  | Add `noImplicitOverride` and `noPropertyAccessFromIndexSignature` to `tsconfig.base.json`. Skip `exactOptionalPropertyTypes`.                                                                                                                                                                                                                                                                                                                                                                                                                                 | Must Have   |
| FR-10 | Switch ESLint to `typescript-eslint/recommended-type-checked` and enable: `no-floating-promises`, `no-misused-promises`, `consistent-type-imports`, `switch-exhaustiveness-check`.                                                                                                                                                                                                                                                                                                                                                                            | Must Have   |
| FR-11 | Add `eslint-plugin-import` with `import/no-cycle` and `import/no-extraneous-dependencies`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Must Have   |
| FR-12 | Add `eslint-plugin-vitest` with `no-focused-tests`, `no-disabled-tests` enabled as errors.                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Must Have   |
| FR-13 | Add `vitest-fail-on-console` to fail tests that emit `console.warn`/`error`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Must Have   |
| FR-14 | Set vitest coverage thresholds: 70% lines, 60% branches per package. Threshold failures break CI.                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Must Have   |
| FR-15 | Wire `gitleaks` in `.husky/pre-commit` (staged-only, fast) and as a CI job (`history` mode, weekly schedule + per-PR). Add `eslint-plugin-no-secrets` to lint stack.                                                                                                                                                                                                                                                                                                                                                                                          | Must Have   |
| FR-16 | Add CI step `pnpm audit --audit-level=high --prod` that fails the PR on high/critical vulnerabilities.                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Must Have   |
| FR-17 | Add OSV-Scanner CI job — supplements `pnpm audit` with broader OSV.dev coverage.                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Must Have   |
| FR-18 | Add license check (`license-checker-rseidelsohn` or equivalent) that fails CI on GPL-3.0/AGPL/unknown licenses in production deps. Maintain an explicit allowlist.                                                                                                                                                                                                                                                                                                                                                                                            | Must Have   |
| FR-19 | Pin all GitHub Actions in `.github/workflows/*.yml` to commit SHAs (not version tags). Configure Dependabot to keep them current.                                                                                                                                                                                                                                                                                                                                                                                                                             | Must Have   |
| FR-20 | Add `actionlint` CI job — lints workflow YAML for shellcheck issues, expression mistakes, missing permissions.                                                                                                                                                                                                                                                                                                                                                                                                                                                | Must Have   |
| FR-21 | Add `eslint-plugin-security` (warn-then-error rollout) and `eslint-plugin-no-unsanitized` (immediate error) for webview packages.                                                                                                                                                                                                                                                                                                                                                                                                                             | Must Have   |
| FR-22 | Add a CSP guard test in `apps/vscode/src/panels/webview-html.test.ts` that asserts both dev and prod HTML contain `Content-Security-Policy` meta tags and that prod CSP contains no `unsafe-eval`/`unsafe-inline-script`.                                                                                                                                                                                                                                                                                                                                     | Must Have   |
| FR-23 | Restrict `process.env` access via `no-restricted-syntax` to bootstrap files (`apps/vscode/src/extension.ts`, `apps/vscode/src/agent-factory.ts`, `scripts/**`). Other files must receive config via injection.                                                                                                                                                                                                                                                                                                                                                | Must Have   |
| FR-24 | Add `syncpack` (or `@manypkg/cli`) to enforce version-range consistency across workspace packages. Run as part of `pnpm verify`.                                                                                                                                                                                                                                                                                                                                                                                                                              | Must Have   |
| FR-25 | Add `.nvmrc` pinned to `22` and set `engineStrict=true` in `.npmrc` (or `package.json` `engines`-strict equivalent).                                                                                                                                                                                                                                                                                                                                                                                                                                          | Must Have   |
| FR-26 | Add `cspell` with custom dictionary (`.cspell.json` + `.cspell-dict.txt`) covering project-specific terms. Run on `**/*.{ts,tsx,md}`.                                                                                                                                                                                                                                                                                                                                                                                                                         | Should Have |
| FR-27 | Add `lychee` link checker for `**/*.md` — runs weekly in CI, not per-PR (to avoid flake on transient external links).                                                                                                                                                                                                                                                                                                                                                                                                                                         | Should Have |
| FR-28 | Add `.github/dependabot.yml` for npm + GitHub Actions ecosystems, weekly schedule, grouped updates.                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Must Have   |
| FR-29 | Add `.github/pull_request_template.md`, `CODEOWNERS`, and `.gitmessage` (closes 400-dx-conventions FR-5).                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Should Have |
| FR-30 | Add explicit size-limit budgets (replace `continue-on-error: true`): vscode-extension ≤ 500KB, chat-webview ≤ 800KB, workbench-webview ≤ 800KB. Initial budgets set at current size + 15%.                                                                                                                                                                                                                                                                                                                                                                    | Must Have   |
| FR-31 | Add an AGENTS.md "Verification" section documenting `pnpm verify` and `pnpm verify:full` as the canonical commands agents must run.                                                                                                                                                                                                                                                                                                                                                                                                                           | Must Have   |
| FR-32 | Add `eslint-plugin-jsdoc` rule that requires `@see` JSDoc on every `*.repository.ts`, `*.service.ts`, `*.action.ts`, `*.model.ts`, `*.constants.ts` (matches the AFX traceability table in CLAUDE.md).                                                                                                                                                                                                                                                                                                                                                        | Should Have |
| FR-33 | Enforce variable-naming convention via `@typescript-eslint/naming-convention`. Module-level (`const + global`) non-function values use **`UPPER_CASE`** (e.g. `const TOTAL_COUNT = 5`). Module-level `const` bound to a function (anonymous arrow, function expression, or React component) keeps `camelCase` / `PascalCase`. Function-local `const` and destructured imports are unconstrained. Type-likes (type/interface/class/enum) stay `PascalCase`. Warn-then-error rollout (PR 5 lands as `warn`; same-week follow-up flips to `error` after triage). | Must Have   |
| FR-34 | Provide auto-fix scripts so contributors and agents do not hand-fix mechanical markdownlint / prettier / eslint violations. Add `check:md:fix` (`markdownlint-cli2 --fix`) and an aggregate `pnpm fix` that runs `check:format:fix && check:md:fix && check:lint:fix` in sequence. Pairs with `pnpm verify` — the documented loop is "run `pnpm verify`; if it fails on auto-fixable issues, run `pnpm fix` and verify again." MD040 (fenced-code-language) stays disabled (intentional — language hints are author judgement, not auto-inferable).           | Must Have   |

#### Non-Functional Requirements

| ID    | Requirement                       | Target                                                                                      |
| ----- | --------------------------------- | ------------------------------------------------------------------------------------------- |
| NFR-1 | Local fast-path latency           | `pnpm verify` completes in < 90s on M-series Mac with warm cache                            |
| NFR-2 | Determinism                       | Same input produces same output — no flake from network, transient registry, or RNG         |
| NFR-3 | Atomic rollback                   | Every PR in this sprint reverts cleanly without affecting earlier or later PRs              |
| NFR-4 | No bypass paths                   | Zero new ESLint disables, `// @ts-ignore`, `eslint-disable`, or `skip` test markers added   |
| NFR-5 | Existing opt-outs scoped narrowly | `packages/ui` shadcn relaxation lives only in `src/components/**` and `src/hooks/**`        |
| NFR-6 | CI fail signal-to-noise           | Each layer's failure mode is unambiguous (one actionable error, not a wall of stack traces) |
| NFR-7 | Agent-readability                 | Tool output is parseable (eslint JSON formatter, vitest TAP) so agents can self-correct     |

### Acceptance Criteria

- [ ] `pnpm verify` runs and exits 0 on a clean checkout of `main`
- [ ] `pnpm verify:full` runs and exits 0 on a clean checkout of `main` (in CI environment with playwright + vscode-test deps)
- [ ] Fresh clone → `pnpm install` → `pnpm verify` works without reading any other doc
- [ ] Removing any `no-restricted-imports` block and reintroducing a forbidden import from `AGENTS.md` causes `pnpm verify` to fail with a specific rule citation
- [ ] Adding a `*.spec.ts` outside an e2e dir fails the naming guard test
- [ ] Adding a `__tests__/` directory fails the naming guard test
- [ ] Adding a `process.env.X` reference outside the allowlisted bootstrap files fails lint
- [ ] Adding a known-CVE dependency fails CI in the `security` job
- [ ] Removing the CSP from `webview-html.ts` prod path fails the CSP guard test
- [ ] Bundle size growing >15% over current baseline fails the `bundle-size` job
- [ ] Vitest coverage dropping below 70% lines fails CI
- [ ] An unsigned-prefix GitHub Action ref (e.g. `actions/checkout@v4` instead of pinned SHA) fails `actionlint`
- [ ] `gitleaks` initial history scan reports zero secrets (or a documented allowlist)
- [ ] An agent can read `AGENTS.md`'s new "Verification" section, run `pnpm verify`, and successfully validate their work without further guidance

### Non-Goals (Out of Scope)

- **CodeQL**: deferred — repo visibility (private vs public) and pricing decisions out of scope. Revisit when shipping.
- **Mutation testing (Stryker)**: high CI cost, marginal payoff at current coverage maturity.
- **Visual regression (Percy/Chromatic)**: webviews aren't pixel-critical yet; out of scope until UI ships externally.
- **SBOM generation (CycloneDX/SPDX)**: defer until customer or marketplace policy explicitly requires it.
- **Semgrep**: overlaps with `eslint-plugin-security` + future CodeQL; pick one when it matters.
- **Snyk / Socket.dev (paid tiers)**: free `pnpm audit` + OSV-Scanner cover the high-value 80%.
- **`exactOptionalPropertyTypes`**: famously painful for marginal payoff; declined.
- **Webview message schema validation (zod)**: bigger refactor, separate sprint when next touching the message protocol.
- **Automated secret rotation / vault integration**: out of scope; gitleaks catches new leaks, rotation is operational.
- **Renaming existing `apps/vscode/__tests__/` files in this sprint**: that file move is part of FR-6 implementation but is not its own goal.
- **Replacing pnpm with another package manager**: pnpm is canonical.

### Open Questions

| #   | Question                                                                                                                                                                                                                         | Status   | Blocking | Resolution                                                                                                                               |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | TS-strict recovery in `packages/ui`: option A is `// @ts-nocheck` headers on shadcn-generated files; option B is split tsconfig with project references. Which?                                                                  | Resolved | Yes      | Option A — `// @ts-nocheck` headers on `packages/ui/src/{components,hooks}/**` + `scripts/shadcn-postadd.mjs`. See [DES-DEC], Phase 4.2. |
| 2   | `pnpm audit` failure threshold — fail on `high+` or `critical-only`? (`high` is the conventional baseline; `critical-only` is more permissive.)                                                                                  | Resolved | No       | `high+`. Industry baseline; `critical-only` ignores real risks.                                                                          |
| 3   | `syncpack` vs `@manypkg/cli` — both solve workspace version drift. Pick by ergonomics.                                                                                                                                           | Resolved | No       | `syncpack`. More configurable rule system; richer semver-group config; broader 2026 monorepo adoption.                                   |
| 4   | `lychee` cadence: weekly only, or also per-PR (with retry)? Per-PR adds ~30s to CI but catches docs link rot fast.                                                                                                               | Resolved | No       | Weekly (Mondays 06:00 UTC) + `workflow_dispatch`. Per-PR flakes on transient external 5xx.                                               |
| 5   | Should `pnpm verify` invoke turbo (parallel, `--continue` for full failure list) or a sequential script (fail-fast for shorter feedback)? Turbo is parallel, but `--continue` makes it slower-overall when one check fails fast. | Resolved | No       | Turbo `--continue` (parallel, full failure list). Agent loops need a complete punch list per run, not fail-fast.                         |
| 6   | `eslint-plugin-jsdoc` `@see` enforcement: error or warn during initial rollout? The AFX traceability convention is documented but unverified — error may surface dozens of violations.                                           | Resolved | No       | Warn-then-error. Land at `warn` in PR 11, fix surfaced violations in a same-week follow-up, flip to `error`.                             |
| 7   | `eslint-plugin-security` rules are heuristic and noisy; warn-then-error rollout, or accept noise upfront and triage?                                                                                                             | Resolved | No       | Warn-then-error (matches DES-DEC). Land at `warn` in PR 8, triage in same-week follow-up, flip to `error`.                               |
| 8   | Bundle-size 15% headroom — agreed baseline, or stricter (10%) to catch creep earlier?                                                                                                                                            | Resolved | No       | 15%. Balances catching regressions with normal growth tolerance; 10% flakes on small repos.                                              |

### Dependencies

- **No external blockers.** Everything is greenfield additive config or new dev-dependencies.
- **Lockstep with future work**: any feature PR landing during this sprint must rebase against the new ESLint config block-by-block; coordination via this sprint's branch order.

<!-- SPRINT-SECTION-END: SPEC -->

---

<!-- SPRINT-SECTION-START: DESIGN (maps to design.md on graduation; promote ### → ##) -->

## 2. Plan

> The HOW — architecture, decisions, file changes. Mirrors `afx-design/assets/design-template.md`.

### [DES-OVR] Overview

Layer enforcement vertically — fastest, cheapest checks closest to the developer; expensive/external checks furthest out. Eleven independent PRs land in sequence, each one atomic and revertible. Early PRs set up the consolidated command surface (`pnpm verify` / `verify:full`); middle PRs add architecture, naming, and TS strictness rules; later PRs layer security and supply-chain hardening. The PR sequence is ordered to minimize churn — each PR surfaces violations only in the layer it adds.

### [DES-ARCH] Architecture

#### Defense-in-depth feedback layers

```text
┌─────────────────────────────────────────────────────────────────────────┐
│ LAYER 1 — Editor (LSP)                                                  │
│  • TypeScript strict (LSP)        • ESLint inline diagnostics            │
│  • Prettier on save (recommended) • cspell red squiggle                  │
└─────────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ LAYER 2 — Pre-commit (.husky/pre-commit)                                 │
│  • lint-staged (Prettier --write + ESLint --fix on STAGED files)         │
│  • gitleaks --staged    (NEW)                                            │
└─────────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ LAYER 3 — Commit-msg (.husky/commit-msg)                                 │
│  • commitlint (Conventional Commits, scope-enum)                          │
└─────────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ LAYER 4 — Pre-push (.husky/pre-push)                                  NEW│
│  • pnpm verify  (types + lint + format + md + knip + unit + naming)     │
│  • Target: <90s on M-series Mac with warm cache                          │
└─────────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ LAYER 5 — PR CI (.github/workflows/code-qa.yml)                          │
│  • pnpm verify:full (everything in verify + build + e2e + size + sec)    │
│  • New jobs: gitleaks, pnpm-audit, osv-scanner, license-check,           │
│              actionlint                                                  │
└─────────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ LAYER 6 — Scheduled (.github/workflows/security-scheduled.yml)        NEW│
│  • trufflehog history scan (weekly)                                       │
│  • lychee link check (weekly)                                             │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Single-command lifecycle (FR-1, FR-2)

```text
pnpm verify          → check:types
                       check:lint
                       check:format
                       check:md
                       check:knip
                       check:syncpack            (NEW)
                       check:cspell              (NEW; FR-26)
                       test (no coverage, no e2e)
                       test:naming-guard         (NEW; FR-5, FR-6)
                       Implementation: turbo run with --continue (parallel; show all failures)

pnpm verify:full     → pnpm verify
                       build
                       size-limit  (with budgets; FR-30)
                       test:coverage (with thresholds; FR-14)
                       test:e2e
                       test:e2e:vscode
                       check:security            (NEW; pnpm audit + license-check)
                       Implementation: chained — fail-fast on the cheap stuff,
                       only run e2e/security if cheap stuff passes
```

The legacy scripts `ci`, `health`, `health:full` are renamed/aliased: `health` and `health:full` keep parallel turbo behavior; `ci` is removed. AGENTS.md documents `verify` / `verify:full` as the canonical names.

### [DES-UI] User Interface & UX

N/A — this sprint changes tooling, not UI.

### [DES-DEC] Key Decisions

| Decision                               | Options Considered                                                                         | Choice                                                                                                                     | Rationale                                                                                                                                                                                                                                                            |
| -------------------------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Single command surface                 | Keep `ci`/`health`/`health:full`; rename to `verify`/`verify:full`; add yet-another tier   | Rename to `verify` / `verify:full`; remove `ci`                                                                            | Two tiers cover the two use cases (fast feedback vs. CI). Three names was confusing; agents had no canonical entry point.                                                                                                                                            |
| Pre-push hook scope                    | Run `verify` (fast); run `verify:full` (slow); none                                        | Run `verify` only                                                                                                          | `verify:full` includes e2e; runs in minutes; would block iterative push. `verify` is <90s — acceptable for a hook.                                                                                                                                                   |
| Architecture boundaries: lint vs. test | Custom guard test (existing `no-pi-imports` pattern); ESLint `no-restricted-imports`; both | ESLint `no-restricted-imports` for forbidden-import rules; guard tests for path/folder shape (test naming, no `__tests__`) | Lint catches at edit time and is per-line specific; guard tests catch shape-of-tree violations that lint can't see. Use each for what it's good at.                                                                                                                  |
| TS strict in `packages/ui` recovery    | (A) `// @ts-nocheck` on shadcn files; (B) split tsconfig + project references; (C) leave   | (A), with regeneration script that re-adds the header on `shadcn add`                                                      | Project references add 1 config file + 1 build target per package; over-engineering for ~20 generated files. `@ts-nocheck` is one line per file; the existing eslint ignore for the same paths confirms shadcn-generated code is treated as opaque. Open Question 1. |
| `eslint-plugin-security` rollout       | Error from day 1; warn-then-error                                                          | Warn-then-error: land as `warn`, fix existing violations in a follow-up, flip to `error`                                   | Plugin is heuristic; landing as `error` would block PR with potentially-false positives. Open Question 7.                                                                                                                                                            |
| `pnpm audit` threshold                 | `low+`, `moderate+`, `high+`, `critical-only`                                              | `high+`                                                                                                                    | Industry baseline. `moderate+` is too noisy on transitive deps; `critical-only` ignores real risks. Open Question 2.                                                                                                                                                 |
| Coverage thresholds                    | Per-package custom; uniform 70/60                                                          | Uniform 70% lines / 60% branches initially                                                                                 | Easier to enforce uniformly; per-package tuning is premature. Tighten later if some package consistently exceeds.                                                                                                                                                    |
| GitHub Actions pinning                 | Tag refs (`@v4`); commit SHAs; immutable releases (GH-native, beta)                        | Commit SHAs maintained by Dependabot                                                                                       | Mitigates supply-chain attacks (`tj-actions/changed-files` 2025 incident). Dependabot's GitHub Actions ecosystem auto-PRs SHA bumps weekly.                                                                                                                          |
| Workspace version consistency          | `syncpack`; `@manypkg/cli`                                                                 | `syncpack` (pending Open Q3 confirmation)                                                                                  | Both work; `syncpack` is more configurable; `@manypkg` is opinionated and faster. Either is fine — pick during PR 10.                                                                                                                                                |
| Bundle-size headroom                   | 10%; 15%; 20%                                                                              | 15% from current baseline (Open Q8)                                                                                        | 10% catches creep but flakes on small repos. 15% balances catching regressions with acceptance of normal growth.                                                                                                                                                     |

### [DES-SHADCN] Shadcn-generated code — exemption charter

**Policy**: shadcn-generated code is treated as **opaque, registry-owned**. The team does not modify it. Every enforcement layer added by this sprint MUST exempt the canonical shadcn paths so a `shadcn add` regen never fails CI and contributors are never tempted to "fix" upstream-owned code.

**Canonical exempt globs** (single source of truth — every block below must use exactly these):

```text
packages/ui/src/components/**
packages/ui/src/hooks/**
```

**Layers that must exempt shadcn** (cross-references — each block in the spec carries the same ignore list):

| Layer                                           | Mechanism                                         | Where in spec            |
| ----------------------------------------------- | ------------------------------------------------- | ------------------------ |
| ESLint global ignores (existing)                | `eslint.config.mjs` top-level `ignores`           | already in repo          |
| Architecture-boundary `no-restricted-imports`   | N/A — globs target other packages                 | DES-LINT (boundaries)    |
| Folder/filename naming + test naming            | `ignores` in plugin block                         | DES-NAMING               |
| `process.env` restriction                       | `ignores` in plugin block                         | DES-LINT (process.env)   |
| Type-aware lint (`recommended-type-checked`)    | `ignores` in plugin block                         | DES-LINT (type-aware)    |
| Import hygiene (`import/no-cycle`, etc.)        | `ignores` in plugin block                         | DES-LINT (import)        |
| Variable naming (`@typescript-eslint/naming-*`) | `ignores` in plugin block                         | DES-VARS                 |
| `eslint-plugin-security`                        | `ignores` in plugin block                         | DES-APPSEC               |
| `eslint-plugin-no-unsanitized`                  | `ignores` in plugin block (with explicit comment) | DES-APPSEC               |
| TypeScript strictness                           | `// @ts-nocheck` headers + regen helper           | DES-TS, Phase 4.2        |
| Vitest coverage measurement                     | `coverage.exclude` in vitest config               | DES-TEST                 |
| `knip` workspace config                         | `ignore: ["src/components/**","src/hooks/**"]`    | DES-WORKSPACE / Phase 11 |

**Lifecycle**:

- New shadcn files arrive via `pnpm dlx shadcn@latest add <component>`.
- Immediately after, `scripts/shadcn-postadd.mjs` (created in Phase 4.2) re-applies `// @ts-nocheck` headers — runs as a `postadd` hook or is invoked manually by the contributor and documented in CONTRIBUTING.md.
- The eslint plugin globs above are static and do not need updating per-component because they match the parent dirs.
- The `no-unsanitized` exemption for shadcn is the one place this policy genuinely trades safety for ergonomics: shadcn components occasionally use `dangerouslySetInnerHTML` for icons or markdown rendering. Because the team can't fix shadcn-gen code, the risk is accepted; the offsetting controls are CSP (FR-22 guard test) and the registry's own review.
- **No exceptions** to the exempt globs. If a future "owned-by-team" component lives in `packages/ui/src/components/`, it must move to `packages/ui/src/composites/` (or similar) so the shadcn rule continues to apply to genuinely-generated files only.

**Cross-reference**: NFR-5 enforces the _narrowness_ of this exemption — relaxations live only at these two paths and nowhere else.

### [DES-DATA] Data Model

N/A — no schema or persistent data introduced.

### [DES-API] API Contracts

N/A — no external interfaces. Internal "API" is the script names exposed in `package.json`:

```json
{
  "scripts": {
    "verify": "turbo run check:types check:lint check:format check:md check:knip check:syncpack check:cspell test test:naming-guard --continue",
    "verify:full": "pnpm verify && pnpm build && size-limit && pnpm test:coverage && pnpm test:e2e:all && pnpm check:security",
    "fix": "pnpm check:format:fix && pnpm check:md:fix && pnpm check:lint:fix",
    "check:md:fix": "markdownlint-cli2 --fix \"**/*.md\" \"!**/node_modules/**\" \"!**/.turbo/**\" \"!**/.vscode-test/**\" \"!**/.claude/**\" \"!**/docs/agenticflowx/**\" \"!**/.agents/**\" \"!**/.afx/**\" \"!**/apps/vscode/resources/skills/**\"",
    "check:syncpack": "syncpack lint",
    "check:cspell": "cspell '**/*.{ts,tsx,md}' --no-progress",
    "check:security": "pnpm audit --audit-level=high --prod && license-checker-rseidelsohn --production --onlyAllow 'MIT;ISC;Apache-2.0;BSD-2-Clause;BSD-3-Clause;CC0-1.0;CC-BY-4.0;0BSD;Unlicense;Python-2.0'",
    "test:naming-guard": "vitest run tests/conventions"
  }
}
```

**`pnpm fix` execution order matters**:

1. `check:format:fix` first — prettier normalizes whitespace, table alignment, import order. Reflows source so eslint sees the canonical layout.
2. `check:md:fix` next — markdownlint-cli2 auto-fixes MD009/MD012/MD030/MD047 etc. on prettier's normalized output.
3. `check:lint:fix` last — eslint runs `--fix` on the prettier-normalized source. Has the final word on JS/TS.

Run `pnpm verify` again after `pnpm fix` to confirm only non-auto-fixable issues remain (real bugs, missing types, architecture violations) — those still need human attention.

**What `pnpm fix` does NOT do**:

- Add ` ```text ` language hints to fenced code blocks (MD040 disabled by design — language is author judgement).
- Add missing `@see` annotations.
- Add missing test coverage.
- Resolve TypeScript type errors.
- Resolve ESLint architecture-boundary violations (`no-restricted-imports`).

These all require human (or LLM) judgement and would still surface as `pnpm verify` failures even after `pnpm fix`.

### [DES-LINT] ESLint additions

#### Architecture boundaries (FR-4)

```js
// New blocks in eslint.config.mjs (added before the prettier block).
{
  // apps/vscode — extension host: no React, no webview-only packages
  files: ["apps/vscode/**/*.{ts,tsx}"],
  rules: {
    "no-restricted-imports": ["error", {
      paths: [{ name: "react" }, { name: "react-dom" }],
      patterns: [
        { group: ["@afx/ui", "@afx/ui/*", "@afx/transport", "@afx/transport/*"],
          message: "apps/vscode is the extension host — webview-only packages forbidden." },
        { group: ["@afx/agent-*"],
          message: "Use AgentManager from @afx/shared; do not import adapters directly. Only agent-factory.ts may." },
      ],
    }],
  },
},
{
  // apps/vscode/src/agent-factory.ts — the ONE file allowed to import the adapter
  files: ["apps/vscode/src/agent-factory.ts"],
  rules: { "no-restricted-imports": "off" },
},
{
  // apps/chat & apps/workbench — webviews: no extension host, no agent adapters, no node fs/process
  files: ["apps/chat/**/*.{ts,tsx}", "apps/workbench/**/*.{ts,tsx}"],
  rules: {
    "no-restricted-imports": ["error", {
      paths: [{ name: "vscode" }],
      patterns: [
        { group: ["@afx/agent-*", "@mariozechner/*"],
          message: "Webviews must not import agent adapters; route through @afx/transport." },
        { group: ["node:child_process", "node:fs", "node:fs/*", "node:path", "child_process", "fs", "fs/promises"],
          message: "Webviews run in a sandboxed iframe — no Node FS/process access." },
      ],
    }],
  },
},
{
  // packages/agent/** — Node-only adapters
  files: ["packages/agent/**/*.{ts,tsx}"],
  rules: {
    "no-restricted-imports": ["error", {
      paths: [
        { name: "vscode", message: "Agent adapters must not import vscode." },
        { name: "react" }, { name: "react-dom" },
      ],
    }],
  },
},
{
  // packages/{shared,parsers} — pure
  files: ["packages/{shared,parsers}/**/*.{ts,tsx}"],
  rules: {
    "no-restricted-imports": ["error", {
      paths: [{ name: "vscode" }, { name: "react" }, { name: "react-dom" }],
    }],
  },
},
```

#### Folder naming + test naming (FR-5, FR-6, FR-7)

```js
// Add `eslint-plugin-check-file` plugin block.
// `KEBAB_CASE` enforces /^[a-z0-9]+(-[a-z0-9]+)*$/ — lowercase only, hyphenated, any length.
{
  files: ["**/*.{ts,tsx,js,mjs}"],
  ignores: [
    // Shadcn-generated (existing)
    "packages/ui/src/components/**",
    "packages/ui/src/hooks/**",
    // Managed/tool dirs and double-underscore conventions — exempt from folder rule
    "**/node_modules/**",
    "**/.turbo/**",
    "**/.vscode-test/**",
    "**/.husky/**",
    "**/.github/**",
    "**/.vscode/**",
    "**/.afx/**",
    "**/.claude/**",
    "**/.agents/**",
    "**/__fixtures__/**",
    "**/__mocks__/**",
    "**/__snapshots__/**",
  ],
  plugins: { "check-file": checkFilePlugin },
  rules: {
    "check-file/folder-naming-convention": ["error", {
      "**/*": "KEBAB_CASE", // every folder under linted glob must be lowercase kebab
    }],
    "check-file/filename-naming-convention": ["error", {
      "apps/chat/e2e/**/*.{ts,tsx}": "*.spec.{ts,tsx}",
      "apps/vscode-e2e/src/**/*.{ts,tsx}": "*.test.{ts,tsx}",
      "**/src/**/*.test.{ts,tsx}": "KEBAB_CASE",
    }],
  },
},
```

A guard test (below) catches the `__tests__/` and shape-of-tree concerns that filename rules can't.

#### `process.env` access (FR-23)

```js
{
  files: ["**/*.{ts,tsx}"],
  ignores: [
    "apps/vscode/src/extension.ts",
    "apps/vscode/src/agent-factory.ts",
    "scripts/**",
    "**/vitest.config.*",
    "**/vite.config.*",
    "**/*.test.{ts,tsx}",
    // Shadcn (per [DES-SHADCN])
    "packages/ui/src/components/**",
    "packages/ui/src/hooks/**",
  ],
  rules: {
    "no-restricted-syntax": ["error", {
      selector: "MemberExpression[object.object.name='process'][object.property.name='env']",
      message: "Direct process.env access is restricted. Inject config via factory parameters.",
    }, {
      selector: "MemberExpression[object.name='process'][property.name='env']",
      message: "Direct process.env access is restricted. Inject config via factory parameters.",
    }],
  },
},
```

#### Type-aware lint (FR-10)

```js
// Replace `...tseslint.configs.recommended` with `...tseslint.configs.recommendedTypeChecked`.
// Add parserOptions.project for type-aware rules.
{
  files: ["**/*.{ts,tsx}"],
  ignores: [
    // Shadcn (per [DES-SHADCN]) — owned by registry, has @ts-nocheck headers
    "packages/ui/src/components/**",
    "packages/ui/src/hooks/**",
  ],
  languageOptions: {
    parserOptions: {
      project: ["./tsconfig.base.json", "./apps/*/tsconfig.json", "./packages/*/tsconfig.json", "./packages/agent/*/tsconfig.json"],
    },
  },
  rules: {
    "@typescript-eslint/no-floating-promises": "error",
    "@typescript-eslint/no-misused-promises": "error",
    "@typescript-eslint/consistent-type-imports": ["error", { prefer: "type-imports" }],
    "@typescript-eslint/switch-exhaustiveness-check": "error",
  },
},
```

#### Import hygiene (FR-11)

```js
{
  files: ["**/*.{ts,tsx}"],
  ignores: [
    // Shadcn (per [DES-SHADCN]) — registry-owned import shape; cycles aren't ours to fix
    "packages/ui/src/components/**",
    "packages/ui/src/hooks/**",
  ],
  plugins: { import: importPlugin },
  rules: {
    "import/no-cycle": ["error", { maxDepth: 4 }],
    "import/no-extraneous-dependencies": "error",
  },
  settings: {
    "import/resolver": { typescript: { project: ["./apps/*/tsconfig.json", "./packages/**/tsconfig.json"] } },
  },
},
```

### [DES-NAMING] Naming-guard test (FR-6)

New file `tests/conventions/test-naming-and-folders.test.ts` — runs as part of `pnpm verify` via `test:naming-guard`. Pattern matches existing `apps/vscode/__tests__/no-pi-imports-panels.test.ts` so the implementation feels native.

```ts
/**
 * Naming and folder-shape guard — enforces conventions documented in AGENTS.md
 * that lint rules cannot see (tree shape, presence of forbidden directories).
 *
 * @see docs/specs/430-dx-enforcement/430-dx-enforcement.md [FR-5] [FR-6]
 */
import { readdirSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const REPO_ROOT = path.resolve(__dirname, "..", "..");
// Only Playwright dirs are .spec.ts; vscode-e2e uses .test.ts despite being e2e.
const SPEC_ONLY_DIRS = [/\/apps\/chat\/e2e\//];
const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  "out",
  ".turbo",
  "coverage",
  ".vscode-test",
  ".git",
]);

describe("test-naming and folder conventions", () => {
  it("has no __tests__ directories", () => {
    const offenders = walkDirs(REPO_ROOT).filter((d) => path.basename(d) === "__tests__");
    expect(offenders).toEqual([]);
  });

  it("has no .spec.ts(x) outside Playwright dirs", () => {
    const offenders = walkFiles(REPO_ROOT)
      .filter((f) => /\.spec\.tsx?$/.test(f))
      .filter((f) => !SPEC_ONLY_DIRS.some((re) => re.test(f)));
    expect(offenders).toEqual([]);
  });

  it("has no .test.ts(x) inside Playwright dirs", () => {
    const offenders = walkFiles(REPO_ROOT)
      .filter((f) => /\.test\.tsx?$/.test(f))
      .filter((f) => SPEC_ONLY_DIRS.some((re) => re.test(f)));
    expect(offenders).toEqual([]);
  });
});

function walkDirs(root: string): string[] {
  /* fs traversal, skip SKIP_DIRS */ return [];
}
function walkFiles(root: string): string[] {
  /* fs traversal, skip SKIP_DIRS */ return [];
}
```

#### File moves required by FR-6

```text
apps/vscode/__tests__/agent-factory.spec.ts        → apps/vscode/src/agent-factory.test.ts
apps/vscode/__tests__/extension.spec.ts            → apps/vscode/src/extension.test.ts
apps/vscode/__tests__/webview-html.spec.ts         → apps/vscode/src/panels/webview-html.test.ts
apps/vscode/__tests__/no-pi-imports-panels.test.ts → apps/vscode/src/panels/no-pi-imports.test.ts
apps/vscode/__tests__/fixtures/                    → apps/vscode/src/__fixtures__/
apps/chat/src/__tests__/no-pi-imports.test.ts      → apps/chat/src/no-pi-imports.test.ts
```

Each moved file's `import` paths are rewritten (relative `../src/foo` → `./foo`). Vitest config globs simplified:

```diff
# apps/vscode/vitest.config.ts
-    include: ["src/**/*.{test,spec}.ts", "__tests__/**/*.{test,spec}.ts"],
+    include: ["src/**/*.test.ts"],
-    exclude: ["src/**/*.{test,spec}.ts", "__tests__/**", "src/**/*.d.ts"],
+    exclude: ["src/**/*.test.ts", "src/__fixtures__/**", "src/**/*.d.ts"],
```

### [DES-VARS] Variable naming convention (FR-33)

`@typescript-eslint/naming-convention` rule block. Lands in PR 5 alongside the other typescript-eslint rules. Severity is `warn` initially (FR-33 mandates warn-then-error rollout) — surfaces existing violations without blocking PR 5.

```js
{
  files: ["**/*.{ts,tsx}"],
  ignores: [
    "packages/ui/src/components/**", // shadcn-generated
    "packages/ui/src/hooks/**",      // shadcn-generated
  ],
  rules: {
    "@typescript-eslint/naming-convention": [
      "warn", // flip to "error" in same-week follow-up after PR 5 lands
      // Module-level const NOT bound to a function → UPPER_CASE only
      {
        selector: "variable",
        modifiers: ["const", "global"],
        types: ["boolean", "string", "number", "array"],
        format: ["UPPER_CASE"],
      },
      // Module-level const bound to a function (anonymous arrow, fn expr, React comp) → camelCase | PascalCase
      {
        selector: "variable",
        modifiers: ["const", "global"],
        types: ["function"],
        format: ["camelCase", "PascalCase"],
      },
      // Exported destructured const (e.g., `export const { foo } = bar`) → unconstrained
      {
        selector: "variable",
        modifiers: ["destructured"],
        format: null,
      },
      // All other variables (local consts, lets, params) → camelCase or UPPER_CASE
      { selector: "variable", format: ["camelCase", "UPPER_CASE"] },
      // Function declarations → camelCase (helpers) or PascalCase (React components)
      { selector: "function", format: ["camelCase", "PascalCase"] },
      // Method-like (object methods, class methods) → camelCase
      { selector: "memberLike", format: ["camelCase", "PascalCase", "UPPER_CASE"] },
      // typeAlias / interface / class / enum → PascalCase
      { selector: "typeLike", format: ["PascalCase"] },
      // Enum members → PascalCase or UPPER_CASE (both common in TS)
      { selector: "enumMember", format: ["PascalCase", "UPPER_CASE"] },
      // `_`-prefixed unused variables/params → no format check
      {
        selector: ["variable", "parameter"],
        modifiers: ["unused"],
        format: null,
        leadingUnderscore: "allow",
      },
      // Imported bindings: external libs may use any case → unconstrained
      {
        selector: "import",
        format: null,
      },
    ],
  },
},
```

**Known edge cases / triage during warn period:**

- **Computed-at-startup instances**: `const queryClient = new QueryClient()` will warn under this rule. Per FR-33, the strict policy applies — rename to `QUERY_CLIENT` or extract to a factory function.
- **Tagged template literals stored at module scope**: e.g., `const sql = sql\`...\`` — rare, rename if encountered.
- **Re-exports of camelCase identifiers**: `export { foo } from "./bar"` — handled by `import` selector with `format: null`.
- **Property keys**: not affected (this rule is about identifiers, not object keys); JSON-shaped configs stay readable.

`scripts/**` and `vitest.config.*` files inherit the same rule; if the strict policy turns out to be too aggressive for tooling code, scope a relaxation in the same warn-period follow-up rather than landing now.

### [DES-TS] TypeScript strictness recovery (FR-8, FR-9)

#### `tsconfig.base.json` additions

```diff
   "noFallthroughCasesInSwitch": true,
+  "noImplicitOverride": true,
+  "noPropertyAccessFromIndexSignature": true,
```

#### `packages/ui/tsconfig.json`

```diff
-  "strict": false,
+  "strict": true,
+  "noUncheckedIndexedAccess": true,
+  "noUnusedLocals": true,
+  "noUnusedParameters": true,
+  "noImplicitReturns": true,
+  "noFallthroughCasesInSwitch": true,
+  "noImplicitOverride": true,
```

Shadcn-generated files under `packages/ui/src/components/**` and `packages/ui/src/hooks/**` get a `// @ts-nocheck` header (option A from DES-DEC). A regeneration helper script (`scripts/shadcn-postadd.mjs`) re-adds the header after `shadcn add`.

#### `apps/chat/tsconfig.json`

```diff
-  "noUnusedLocals": false,
-  "noUnusedParameters": false,
+  "noUnusedLocals": true,
+  "noUnusedParameters": true,
```

Expected violations after flipping: 5–15 unused vars/params (mostly in `apps/chat/src/lib/`). Fix them in the same PR as the flip.

### [DES-SECRETS] Secret scanning (FR-15)

#### Pre-commit (.husky/pre-commit)

```diff
 #!/usr/bin/env sh
+gitleaks protect --staged --redact || exit 1
 pnpm exec lint-staged
```

#### Per-PR CI job (.github/workflows/code-qa.yml — new job)

```yaml
secrets:
  name: Secret scan
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@<sha>
      with: { fetch-depth: 0 }
    - uses: gitleaks/gitleaks-action@<sha>
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

#### Weekly history scan (.github/workflows/security-scheduled.yml — new file)

```yaml
name: security-scheduled
on:
  schedule: [{ cron: "0 6 * * 1" }] # Mondays 06:00 UTC
  workflow_dispatch:
jobs:
  trufflehog:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@<sha>
        with: { fetch-depth: 0 }
      - uses: trufflesecurity/trufflehog@<sha>
        with: { extra_args: --only-verified }
```

### [DES-SUPPLY] Supply chain (FR-16, FR-17, FR-18, FR-19, FR-20, FR-28)

| Tool                          | Mechanism                                                                                  | Failure mode                            |
| ----------------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------- |
| `pnpm audit`                  | CI step in `security` job: `pnpm audit --audit-level=high --prod`                          | Exit non-zero on high/critical CVE      |
| OSV-Scanner                   | CI job `osv-scan` using `google/osv-scanner-action`                                        | Exit non-zero on any vuln               |
| `license-checker-rseidelsohn` | CI step in `security` job, allowlist of permissive licenses                                | Exit non-zero on disallowed license     |
| GH Actions SHA pinning        | Edit all `.github/workflows/*.yml` to use commit SHAs; comment `# v<x>` next to each       | One-time edit, maintained by Dependabot |
| `actionlint`                  | New CI job `actionlint` using `reviewdog/action-actionlint`                                | Exit non-zero on workflow YAML issues   |
| Dependabot                    | New `.github/dependabot.yml`: npm + github-actions ecosystems, weekly cadence, grouped PRs | Auto-PRs                                |
| Frozen lockfile               | Already in CI (`pnpm install --frozen-lockfile`)                                           | (existing)                              |

### [DES-APPSEC] Application-code security (FR-21, FR-22, FR-23)

#### `eslint-plugin-security` (warn-then-error, per DES-DEC)

```js
{
  files: ["**/*.{ts,tsx}"],
  ignores: [
    // Shadcn (per [DES-SHADCN]) — registry-owned; security heuristics on shadcn produce noise
    "packages/ui/src/components/**",
    "packages/ui/src/hooks/**",
  ],
  plugins: { security: securityPlugin },
  rules: { ...securityPlugin.configs.recommended.rules },
}
```

#### `eslint-plugin-no-unsanitized` (immediate error in webviews)

```js
{
  files: ["apps/chat/**/*.{ts,tsx}", "apps/workbench/**/*.{ts,tsx}", "packages/ui/**/*.{ts,tsx}"],
  ignores: [
    // Shadcn (per [DES-SHADCN]) — registry-owned; uses dangerouslySetInnerHTML for icons/markdown.
    // Risk is accepted; offsetting controls are CSP (FR-22) + registry review.
    "packages/ui/src/components/**",
    "packages/ui/src/hooks/**",
  ],
  plugins: { "no-unsanitized": noUnsanitized },
  rules: {
    "no-unsanitized/method": "error",
    "no-unsanitized/property": "error",
  },
}
```

#### CSP guard test (FR-22)

New file `apps/vscode/src/panels/webview-html.test.ts` (and removal of `apps/vscode/__tests__/webview-html.spec.ts` per FR-6 file moves):

```ts
/**
 * CSP guard — webview HTML must always carry a Content-Security-Policy meta tag,
 * and prod CSP must not include unsafe-eval or unsafe-inline for scripts.
 *
 * @see docs/specs/430-dx-enforcement/430-dx-enforcement.md [FR-22]
 */
import { describe, expect, it } from "vitest";

describe("webview-html CSP", () => {
  it("prod html contains a CSP meta tag", () => {
    const html = renderProdHtml(); // helper around prodHtml() with mocked webview/extensionUri
    expect(html).toMatch(/<meta http-equiv="Content-Security-Policy"/);
    expect(html).not.toMatch(/'unsafe-eval'/);
    expect(html).not.toMatch(/script-src[^;]*'unsafe-inline'/);
  });

  it("dev html contains a CSP meta tag with nonce", () => {
    const html = renderDevHtml(); // helper around tryDevModeHtml()
    expect(html).toMatch(/<meta http-equiv="Content-Security-Policy"/);
    expect(html).toMatch(/script-src[^;]*'nonce-[A-Za-z0-9]+'/);
  });
});
```

`prodHtml`/`tryDevModeHtml` are currently file-scoped functions in `apps/vscode/src/panels/webview-html.ts`. Refactor: export them (named) so the test can import without going through `loadWebviewHtml`.

### [DES-TEST] Test quality (FR-12, FR-13, FR-14)

#### Coverage thresholds

Edit each per-package `vitest.config.ts` to add:

```diff
   test: {
     name: "...",
+    coverage: {
+      provider: "v8",
+      thresholds: { lines: 70, branches: 60, functions: 70, statements: 70 },
+      // packages/ui only — exclude shadcn-generated code from coverage measurement (per [DES-SHADCN]).
+      // Including it would drag line/branch coverage below threshold without team-actionable signal.
+      exclude: [
+        "src/components/**",
+        "src/hooks/**",
+        "src/**/*.test.{ts,tsx}",
+        "src/**/*.d.ts",
+      ],
+    },
   },
```

The `exclude` list above is for `packages/ui/vitest.config.ts` specifically. Other packages get only the `*.test.*` and `*.d.ts` exclusions (no shadcn paths) — apply per-package.

#### `eslint-plugin-vitest`

```js
{
  files: ["**/*.test.{ts,tsx}", "**/*.spec.{ts,tsx}"],
  plugins: { vitest: vitestPlugin },
  rules: {
    "vitest/no-focused-tests": "error",   // catches it.only / describe.only
    "vitest/no-disabled-tests": "error",  // catches it.skip / describe.skip
    "vitest/expect-expect": "error",
  },
}
```

#### `vitest-fail-on-console`

Add to each per-package `vitest.setup.ts`:

```ts
import failOnConsole from "vitest-fail-on-console";

failOnConsole({ silenceMessage: () => false });
```

### [DES-WORKSPACE] Workspace consistency (FR-24, FR-25)

- `syncpack` config: `.syncpackrc.json` — defaults plus `dependencyTypes: ["prod", "dev", "peer"]`, `semverGroups` to allow `workspace:*` for internal packages.
- `.nvmrc` containing `22`.
- `.npmrc` adds `engine-strict=true` (already covered in `package.json` `engines`, but `.npmrc` flag forces refusal).

### [DES-DOCS] Spelling + link checking (FR-26, FR-27)

#### `.cspell.json`

```json
{
  "version": "0.2",
  "language": "en",
  "dictionaryDefinitions": [{ "name": "afx", "path": "./.cspell-dict.txt", "addWords": true }],
  "dictionaries": ["afx"],
  "ignorePaths": [
    "node_modules/**",
    "dist/**",
    "out/**",
    "coverage/**",
    "pnpm-lock.yaml",
    ".turbo/**",
    ".vscode-test/**"
  ],
  "files": ["**/*.{ts,tsx,md}"]
}
```

`.cspell-dict.txt` seeded with: `afx`, `agenticflowx`, `meridian`, `lyra`, `shadcn`, `pnpm`, `vscode`, `webview`, `webviews`, `vsix`, `pi`, `mariozechner`, `turborepo`, `vitest`, `playwright`, `kebab`, `repo`, `monorepo`, `tsconfig`, `eslint`, `gitleaks`, `actionlint`, `osv`, `cspell`, `lychee`, `syncpack`, `husky`, `unicorn`, `commitlint`, `markdownlint`, `knip`, `changelogen`, `trufflehog`, `Dependabot`, `Sentino`, `richard`, `rix`, `jsdom`, `tsbuildinfo`, `Codex`, `Antigravity`.

#### `lychee` (weekly)

`.github/workflows/security-scheduled.yml` adds a job:

```yaml
links:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@<sha>
    - uses: lycheeverse/lychee-action@<sha>
      with: { args: "--no-progress --exclude-mail '**/*.md'" }
```

### [DES-FILES] File Structure

| File                                                               | Purpose                                                                                                                                                         | Status           |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| `package.json` (root)                                              | Add `verify`, `verify:full`, `check:syncpack`, `check:cspell`, `check:security`, `test:naming-guard` scripts. Remove `ci`, `health`, `health:full`.             | Modified         |
| `eslint.config.mjs`                                                | Add 6 architecture-boundary blocks, naming/folder rules, type-aware preset, import hygiene, security plugins, jsdoc plugin, process.env restriction             | Modified         |
| `tsconfig.base.json`                                               | Add `noImplicitOverride`, `noPropertyAccessFromIndexSignature`                                                                                                  | Modified         |
| `packages/ui/tsconfig.json`                                        | Restore `strict`; scope shadcn relaxation via `@ts-nocheck` headers                                                                                             | Modified         |
| `apps/chat/tsconfig.json`                                          | Re-enable `noUnusedLocals` / `noUnusedParameters`                                                                                                               | Modified         |
| `.husky/pre-commit`                                                | Prepend `gitleaks protect --staged --redact`                                                                                                                    | Modified         |
| `.husky/pre-push`                                                  | New — runs `pnpm verify`                                                                                                                                        | New              |
| `.github/workflows/code-qa.yml`                                    | Add jobs: `secrets`, `osv-scan`, `actionlint`, `security` (audit + license-check). Pin all action SHAs. Replace `bundle-size` `continue-on-error` with budgets. | Modified         |
| `.github/workflows/security-scheduled.yml`                         | New — trufflehog history scan, lychee link check (weekly)                                                                                                       | New              |
| `.github/dependabot.yml`                                           | New — npm + github-actions ecosystems                                                                                                                           | New              |
| `.github/pull_request_template.md`                                 | New — Summary / Test plan / Risk template                                                                                                                       | New              |
| `.github/CODEOWNERS`                                               | New — path-based reviewer assignment                                                                                                                            | New              |
| `.gitmessage`                                                      | New — Conventional Commits template (closes 400-conventions FR-5)                                                                                               | New              |
| `.nvmrc`                                                           | New — `22`                                                                                                                                                      | New              |
| `.npmrc`                                                           | Add `engine-strict=true`                                                                                                                                        | Modified         |
| `.cspell.json`, `.cspell-dict.txt`                                 | New — spelling config + project dictionary                                                                                                                      | New              |
| `.syncpackrc.json`                                                 | New — workspace version-consistency config                                                                                                                      | New              |
| `.size-limit.json`                                                 | Replace with budgeted version (current size + 15%)                                                                                                              | Modified         |
| `tests/conventions/test-naming-and-folders.test.ts`                | New — guard test for `__tests__` absence + suffix rules                                                                                                         | New              |
| `apps/vscode/src/agent-factory.test.ts`                            | Renamed from `apps/vscode/__tests__/agent-factory.spec.ts`                                                                                                      | Moved            |
| `apps/vscode/src/extension.test.ts`                                | Renamed from `apps/vscode/__tests__/extension.spec.ts`                                                                                                          | Moved            |
| `apps/vscode/src/panels/webview-html.test.ts`                      | Renamed from `apps/vscode/__tests__/webview-html.spec.ts`; CSP assertions added                                                                                 | Moved + extended |
| `apps/vscode/src/panels/no-pi-imports.test.ts`                     | Renamed from `apps/vscode/__tests__/no-pi-imports-panels.test.ts`                                                                                               | Moved            |
| `apps/vscode/src/__fixtures__/{mock-agent-manager,mock-logger}.ts` | Moved from `apps/vscode/__tests__/fixtures/`                                                                                                                    | Moved            |
| `apps/chat/src/no-pi-imports.test.ts`                              | Renamed from `apps/chat/src/__tests__/no-pi-imports.test.ts`                                                                                                    | Moved            |
| `apps/vscode/vitest.config.ts`, `apps/chat/vitest.config.unit.ts`  | Simplify glob to `*.test.ts(x)`; add coverage thresholds                                                                                                        | Modified         |
| `packages/*/vitest.config.ts`                                      | Add coverage thresholds                                                                                                                                         | Modified         |
| `packages/*/vitest.setup.ts` (and `apps/*/vitest.setup.ts`)        | Add `vitest-fail-on-console` import                                                                                                                             | Modified         |
| `apps/vscode/src/panels/webview-html.ts`                           | Export `prodHtml` and `tryDevModeHtml` for the new CSP guard test                                                                                               | Modified         |
| `scripts/shadcn-postadd.mjs`                                       | New — re-applies `// @ts-nocheck` to regenerated shadcn files                                                                                                   | New              |
| `AGENTS.md`                                                        | Add "Verification" section documenting `pnpm verify` / `verify:full`                                                                                            | Modified         |
| `CLAUDE.md`                                                        | Cross-reference the new "Verification" section                                                                                                                  | Modified         |
| `docs/specs/420-dx-testing/design.md`                              | Update line 121 (`*.spec.ts` for vscode-e2e — wrong) to match `*.test.ts` reality                                                                               | Modified         |

### [DES-DEPS] Dependencies

New dev-dependencies (alphabetical, all `devDependencies`):

```text
@manypkg/cli           (alternative; may be replaced by syncpack — Open Q3)
cspell                 ^8.x
eslint-plugin-check-file ^2.x
eslint-plugin-import   ^2.x
eslint-plugin-jsdoc    ^50.x
eslint-plugin-no-secrets ^1.x
eslint-plugin-no-unsanitized ^4.x
eslint-plugin-security ^3.x
eslint-plugin-vitest   ^0.5.x
license-checker-rseidelsohn ^4.x
syncpack               ^13.x
vitest-fail-on-console ^0.7.x
```

System tools (CI / pre-commit; not npm deps):

```text
gitleaks               (binary; via gitleaks-action in CI; brew/apt for local pre-commit)
trufflehog             (binary; via action only; CI-only)
```

### [DES-SEC] Security Considerations

- **Lockfile integrity**: `pnpm install --frozen-lockfile` already in CI; this sprint does not weaken that.
- **Workflow privilege**: each new CI job declares minimal `permissions:` (default `contents: read`). The `bundle-size` job needs `pull-requests: write` to comment; preserve.
- **Pinned actions**: each action ref becomes a 40-char SHA. Comment `# v4` next to it for human readability. Dependabot maintains.
- **Local gitleaks**: pre-commit hook depends on `gitleaks` being installed locally. Add a soft-fail (`command -v gitleaks >/dev/null || { echo "gitleaks not installed; skipping local scan — CI will catch"; exit 0; }`) so contributors without the binary aren't blocked. CI is the hard gate.
- **License allowlist**: explicit allowlist (`MIT;ISC;Apache-2.0;BSD-2-Clause;BSD-3-Clause;CC0-1.0;CC-BY-4.0;0BSD;Unlicense;Python-2.0`) — adding GPL/AGPL deps fails CI. Manual exception process: append to `.license-allowlist.txt` with rationale comment.
- **Secrets allowlist**: `.gitleaks.toml` may need entries for known false positives (test fixtures with fake JWTs). Audit on first run and add only documented exceptions.

### [DES-ERR] Error Handling

| Scenario                                            | Handling                                                                                                               |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Local `gitleaks` binary missing                     | Skip with informational message; CI catches                                                                            |
| `pnpm verify` partial pass under turbo `--continue` | All failures shown; exit non-zero; agents see complete list, not just first failure                                    |
| Type-aware ESLint slow on huge file                 | Mitigated by `parserOptions.project` scoped to the actual tsconfigs; turbo cache hits when files unchanged             |
| Coverage threshold flake (e.g., test removed)       | Threshold breach is the test author's responsibility; tightening requires same-PR coverage replacement                 |
| `actionlint` false positive                         | Workflow files allow `# actionlint disable=<rule>` annotations on the offending line; require PR description rationale |
| `eslint-plugin-security` false positive (heuristic) | Inline `// eslint-disable-next-line security/<rule> -- reason: ...` with a rationale; review explicit                  |
| Lychee transient external 503                       | Job runs weekly only — single failure does not block PRs. Add link to issue tracker on chronic failures.               |

### [DES-TESTPLAN] Testing Strategy

- **Naming guard test** — verifies the convention itself; runs on every `pnpm verify`.
- **Architecture boundary tests** — existing `no-pi-imports*.test.ts` continues to run as belt-and-suspenders alongside the new `no-restricted-imports` ESLint rules. Different mechanism, same outcome.
- **CSP guard test** — new; covers the prod and dev HTML render paths.
- **Each restored TS strict flag** — verified by `pnpm check:types` exiting 0 on the post-fix tree.
- **Bundle budget breach** — verifiable by adding a synthetic 100KB import in a side branch and observing CI failure.

### [DES-ROLLOUT] Migration / Rollout Plan

Eleven sequential PRs. Each is independently revertible.

1. **PR 1 — Single command + pre-push.** Rename scripts, add pre-push hook, AGENTS.md doc.
2. **PR 2 — Architecture boundaries.** ESLint `no-restricted-imports` blocks; fix any surfaced violations.
3. **PR 3 — Naming convention enforcement.** Folder/file rules, guard test, file moves, vitest config simplification.
4. **PR 4 — TS strict cleanup.** Re-enable strict in `packages/ui` and `apps/chat`; fix violations; `noImplicitOverride` + `noPropertyAccessFromIndexSignature` in base.
5. **PR 5 — Type-aware lint + import hygiene.** `recommended-type-checked`, `consistent-type-imports`, `no-floating-promises`, `no-misused-promises`, `import/no-cycle`, `import/no-extraneous-dependencies`, `eslint-plugin-vitest`.
6. **PR 6 — Secrets.** gitleaks pre-commit + CI job, `eslint-plugin-no-secrets`, `.gitleaks.toml` allowlist if needed.
7. **PR 7 — Supply chain.** `pnpm audit` CI step, OSV-Scanner, license-checker, Dependabot, GH Actions SHA pinning, actionlint.
8. **PR 8 — App security.** `eslint-plugin-security` (warn), `eslint-plugin-no-unsanitized` (error), CSP guard test, `process.env` restriction.
9. **PR 9 — Test quality.** Coverage thresholds, `vitest-fail-on-console`, `eslint-plugin-vitest` rules, size-limit budgets.
10. **PR 10 — Workspace consistency.** `syncpack` (or `@manypkg/cli`), `.nvmrc`, `engine-strict`.
11. **PR 11 — Polish.** `cspell`, lychee scheduled, PR template, CODEOWNERS, `.gitmessage`, `eslint-plugin-jsdoc`.

#### Rollback plan

Each PR is one revert. Layer 1 (Editor LSP) is unaffected by reverts; layers 2–6 each have a single config or workflow file that reverts cleanly. No data migration, no schema, no production fallout.

#### Branch protection update (post-PR-11)

After PR 11 lands:

1. Update GitHub branch-protection rule for `main` to add the new required CI jobs: `secrets`, `osv-scan`, `actionlint`, `security`, `bundle-size`.
2. Confirm `Require signed commits` toggle.
3. Confirm `Require linear history` (no merge commits) — preserves git log readability.

### Open Technical Questions

| #   | Question                                                                                                                                                                                              | Status   |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | Final pick: `syncpack` vs `@manypkg/cli`. Test both during PR 10 and pick by ergonomics. Default: `syncpack`.                                                                                         | Open     |
| 2   | `eslint-plugin-jsdoc` rollout: error or warn? Will surface unknown # of violations on existing source. Prefer `warn`-then-`error` mirroring `eslint-plugin-security` strategy.                        | Open     |
| 3   | Type-aware ESLint adds ~30s to `pnpm check:lint`. With turbo cache, repeat runs are fast — but cold runs slow agent loops. Acceptable, or tier into `verify:full` only? Default: in `verify`.         | Open     |
| 4   | Should `apps/vscode-e2e/src/extension.test.ts` rename to `*.spec.ts` (Playwright/electron-test convention) or stay `*.test.ts`? Existing file is `.test.ts`. Keep as-is for minimal churn (Decision). | Resolved |
| 5   | `gitleaks` local install — recommend brew/apt instructions in CONTRIBUTING.md, or auto-install via husky? Default: doc-only; husky should not modify the user's system.                               | Open     |

<!-- SPRINT-SECTION-END: DESIGN -->

---

<!-- SPRINT-SECTION-START: TASKS (maps to tasks.md on graduation; promote ### → ##, #### → ###) -->

## 3. Tasks

> The WHEN — hierarchical implementation checklist. Mirrors `afx-task/assets/tasks-template.md`. Every task group references the FR/DES it implements via an `@see` comment using the full project-relative sprint brief path while sprint mode is active.

### Task Numbering Convention

- **0.x** — Pre-implementation cleanup (none — this sprint is greenfield additive)
- **1.x** — PR 1: single command + pre-push
- **2.x** — PR 2: architecture boundaries
- **3.x** — PR 3: naming + folder convention
- **4.x** — PR 4: TS strictness
- **5.x** — PR 5: type-aware lint + import hygiene
- **6.x** — PR 6: secrets
- **7.x** — PR 7: supply chain
- **8.x** — PR 8: application code security
- **9.x** — PR 9: test quality
- **10.x** — PR 10: workspace consistency
- **11.x** — PR 11: polish

References use Node IDs: `[FR-X]`, `[NFR-X]` (Spec section), `[DES-X]` (Plan section), `[X.Y]` (this Tasks section).

### Phase 1: PR 1 — Single command + pre-push

> Ref: [FR-1], [FR-2], [FR-3], [FR-31], [FR-34], [DES-OVR], [DES-ARCH], [DES-API]

#### 1.1 Consolidate root scripts

<!-- files: package.json -->
<!-- @see docs/specs/430-dx-enforcement/430-dx-enforcement.md [FR-1] [FR-2] [FR-34] [NFR-1] [NFR-3] [NFR-6] [NFR-7] [DES-API] -->

- [ ] Add `verify` script: `turbo run check:types check:lint check:format check:md check:knip test --continue`
- [ ] Add `verify:full` script: `pnpm verify && pnpm build && size-limit && pnpm test:coverage && pnpm test:e2e:all`
- [ ] Add `check:md:fix` script: `markdownlint-cli2 --fix "**/*.md"` with the same exclude list as `check:md`
- [ ] Add `fix` aggregate script: `pnpm check:format:fix && pnpm check:md:fix && pnpm check:lint:fix` (order matters — see DES-API note)
- [ ] Remove `ci` script (replaced by `verify`)
- [ ] Remove `health` and `health:full` scripts (consolidated into `verify`/`verify:full`)
- [ ] Confirm `turbo.json` has the necessary task definitions for the merged pipeline

#### 1.2 Pre-push hook

<!-- files: .husky/pre-push -->
<!-- @see docs/specs/430-dx-enforcement/430-dx-enforcement.md [FR-3] [DES-ARCH] -->

- [ ] Create `.husky/pre-push` that runs `pnpm verify`
- [ ] `chmod +x .husky/pre-push`
- [ ] Verify hook runs by inducing a lint failure and attempting `git push`

#### 1.3 Document in AGENTS.md

<!-- files: AGENTS.md, CLAUDE.md -->
<!-- @see docs/specs/430-dx-enforcement/430-dx-enforcement.md [FR-31] [NFR-4] [DES-OVR] -->

- [ ] Add new "## Verification" section to AGENTS.md documenting `pnpm verify`, `pnpm verify:full`, and `pnpm fix` (the verify→fix→verify loop, plus what `pnpm fix` cannot fix)
- [ ] Add cross-reference from CLAUDE.md
- [ ] Update CI workflow `code-qa.yml` to run `pnpm verify:full` instead of the chained step list (preserves existing job split)

### Phase 2: PR 2 — Architecture boundaries

> Ref: [FR-4], [FR-23], [DES-LINT]

#### 2.1 ESLint no-restricted-imports — apps/vscode

<!-- files: eslint.config.mjs -->
<!-- @see docs/specs/430-dx-enforcement/430-dx-enforcement.md [FR-4] [DES-LINT] -->

- [ ] Add `apps/vscode/**/*.{ts,tsx}` block forbidding React/transport/agent-\* imports
- [ ] Add `apps/vscode/src/agent-factory.ts` exception block (only file allowed to import adapters)
- [ ] Run `pnpm check:lint` — fix any surfaced violations

#### 2.2 ESLint no-restricted-imports — webviews

<!-- files: eslint.config.mjs -->
<!-- @see docs/specs/430-dx-enforcement/430-dx-enforcement.md [FR-4] [DES-LINT] -->

- [ ] Add `apps/{chat,workbench}/**/*.{ts,tsx}` block forbidding `vscode`, `@afx/agent-*`, `@mariozechner/*`, `node:child_process`, `node:fs`, `node:path`
- [ ] Run `pnpm check:lint` — fix any violations

#### 2.3 ESLint no-restricted-imports — packages

<!-- files: eslint.config.mjs -->
<!-- @see docs/specs/430-dx-enforcement/430-dx-enforcement.md [FR-4] [DES-LINT] -->

- [ ] Add `packages/agent/**/*.{ts,tsx}` block forbidding `vscode`, `react`, `react-dom`
- [ ] Add `packages/{shared,parsers}/**/*.{ts,tsx}` block forbidding `vscode`, `react`, `react-dom`
- [ ] Run `pnpm check:lint` — fix any violations

#### 2.4 process.env access restriction

<!-- files: eslint.config.mjs -->
<!-- @see docs/specs/430-dx-enforcement/430-dx-enforcement.md [FR-23] [DES-LINT] -->

- [ ] Add `no-restricted-syntax` rule with allowlist: `apps/vscode/src/extension.ts`, `apps/vscode/src/agent-factory.ts`, `scripts/**`, vitest/vite configs, test files
- [ ] Run `pnpm check:lint` — refactor any direct `process.env` reads outside allowlisted files into config injection

### Phase 3: PR 3 — Naming + folder convention

> Ref: [FR-5], [FR-6], [FR-7], [DES-NAMING]

#### 3.1 ESLint folder + filename rules

<!-- files: eslint.config.mjs, package.json -->
<!-- @see docs/specs/430-dx-enforcement/430-dx-enforcement.md [FR-5] [FR-7] [DES-NAMING] -->

- [ ] Install `eslint-plugin-check-file` (devDep)
- [ ] Add `check-file/folder-naming-convention` rule with `KEBAB_CASE` (lowercase, hyphenated, any length); exempt `__fixtures__`, `__mocks__`, `__snapshots__`, plus managed dirs (`node_modules`, `.turbo`, `.vscode-test`, `.husky`, `.github`, `.vscode`, `.afx`, `.claude`, `.agents`)
- [ ] Add `check-file/filename-naming-convention` rule scoping `.spec.ts` to e2e dirs
- [ ] Run `pnpm check:lint` — should be clean (existing kebab-case is consistent)

#### 3.2 Naming guard test

<!-- files: tests/conventions/test-naming-and-folders.test.ts, package.json, vitest.workspace.ts -->
<!-- @see docs/specs/430-dx-enforcement/430-dx-enforcement.md [FR-6] [DES-NAMING] -->

- [ ] Create `tests/conventions/test-naming-and-folders.test.ts` with three guards: no `__tests__`, no `.spec.ts` outside e2e, no `.test.ts` inside e2e
- [ ] Add `tests/conventions/vitest.config.ts` and reference it from `vitest.workspace.ts`
- [ ] Add root `test:naming-guard` script
- [ ] Wire into `verify` script

#### 3.3 File moves — apps/vscode/**tests**/

<!-- files: apps/vscode/src/agent-factory.test.ts, apps/vscode/src/extension.test.ts, apps/vscode/src/panels/webview-html.test.ts, apps/vscode/src/panels/no-pi-imports.test.ts, apps/vscode/src/__fixtures__/*.ts -->
<!-- @see docs/specs/430-dx-enforcement/430-dx-enforcement.md [FR-6] [DES-NAMING] -->

- [ ] Move `apps/vscode/__tests__/agent-factory.spec.ts` → `apps/vscode/src/agent-factory.test.ts`; rewrite imports
- [ ] Move `apps/vscode/__tests__/extension.spec.ts` → `apps/vscode/src/extension.test.ts`; rewrite imports
- [ ] Move `apps/vscode/__tests__/webview-html.spec.ts` → `apps/vscode/src/panels/webview-html.test.ts`; rewrite imports
- [ ] Move `apps/vscode/__tests__/no-pi-imports-panels.test.ts` → `apps/vscode/src/panels/no-pi-imports.test.ts`; rewrite imports + path constants
- [ ] Move `apps/vscode/__tests__/fixtures/` → `apps/vscode/src/__fixtures__/`; rewrite consumers
- [ ] Delete `apps/vscode/__tests__/` directory
- [ ] Simplify `apps/vscode/vitest.config.ts` glob to `src/**/*.test.ts`; update exclude to add `src/__fixtures__/**`

#### 3.4 File moves — apps/chat/

<!-- files: apps/chat/src/no-pi-imports.test.ts -->
<!-- @see docs/specs/430-dx-enforcement/430-dx-enforcement.md [FR-6] [DES-NAMING] -->

- [ ] Move `apps/chat/src/__tests__/no-pi-imports.test.ts` → `apps/chat/src/no-pi-imports.test.ts`; rewrite imports
- [ ] Delete `apps/chat/src/__tests__/` directory
- [ ] Simplify `apps/chat/vitest.config.unit.ts` include glob to `src/**/*.test.{ts,tsx}`

#### 3.5 Verify naming compliance

<!-- files: tests/conventions/test-naming-and-folders.test.ts -->
<!-- @see docs/specs/430-dx-enforcement/430-dx-enforcement.md [FR-5] [FR-6] -->

- [ ] Run `pnpm verify` — all checks green
- [ ] Manually re-introduce a `__tests__/` dir in a scratch branch and confirm guard test fails
- [ ] Manually re-introduce a `.spec.ts` outside e2e and confirm guard test fails

### Phase 4: PR 4 — TS strictness recovery

> Ref: [FR-8], [FR-9], [DES-TS]

#### 4.1 Base tsconfig additions

<!-- files: tsconfig.base.json -->
<!-- @see docs/specs/430-dx-enforcement/430-dx-enforcement.md [FR-9] [DES-TS] -->

- [ ] Add `noImplicitOverride: true`
- [ ] Add `noPropertyAccessFromIndexSignature: true`
- [ ] Run `pnpm check:types` — fix any surfaced violations across packages

#### 4.2 packages/ui restoration (with shadcn exemption)

<!-- files: packages/ui/tsconfig.json, packages/ui/src/components/**/*.tsx, packages/ui/src/hooks/**/*.ts, scripts/shadcn-postadd.mjs, knip.json, packages/ui/vitest.config.ts -->
<!-- @see docs/specs/430-dx-enforcement/430-dx-enforcement.md [FR-8] [NFR-5] [DES-TS] [DES-SHADCN] -->

- [ ] Flip `strict: false` → `strict: true` in `packages/ui/tsconfig.json`
- [ ] Add `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, `noImplicitOverride`
- [ ] Add `// @ts-nocheck` header to every `packages/ui/src/components/**/*.tsx` and `packages/ui/src/hooks/**/*.ts` (one-time bulk edit)
- [ ] Create `scripts/shadcn-postadd.mjs` to re-apply `// @ts-nocheck` headers after `shadcn add` regenerates files; document the workflow in CONTRIBUTING.md (also: add a `postadd` lifecycle hook reminder)
- [ ] Add `ignore: ["src/components/**", "src/hooks/**"]` to the `packages/ui` workspace block in `knip.json` (per [DES-SHADCN]) — prevents knip from flagging registry-owned exports as unused
- [ ] Add `coverage.exclude: ["src/components/**", "src/hooks/**", "src/**/*.test.{ts,tsx}", "src/**/*.d.ts"]` to `packages/ui/vitest.config.ts` (per [DES-SHADCN] / DES-TEST coverage block) — keeps shadcn out of coverage measurement
- [ ] Run `pnpm check:types --filter @afx/ui` — clean
- [ ] Verify: re-run `pnpm dlx shadcn@latest add button` end-to-end (overwriting `button.tsx`) and confirm `pnpm verify` still passes — proves the exemption charter survives a regen

#### 4.3 apps/chat restoration

<!-- files: apps/chat/tsconfig.json, apps/chat/src/**/*.{ts,tsx} -->
<!-- @see docs/specs/430-dx-enforcement/430-dx-enforcement.md [FR-8] [DES-TS] -->

- [ ] Flip `noUnusedLocals: true`, `noUnusedParameters: true`
- [ ] Run `pnpm check:types --filter apps/chat`; fix unused vars/params (~5–15 expected)

### Phase 5: PR 5 — Type-aware lint + import hygiene

> Ref: [FR-10], [FR-11], [FR-12], [FR-33], [DES-LINT], [DES-VARS]

#### 5.1 Type-aware preset switch

<!-- files: eslint.config.mjs, package.json -->
<!-- @see docs/specs/430-dx-enforcement/430-dx-enforcement.md [FR-10] [DES-LINT] [DES-DEPS] -->

- [ ] Replace `tseslint.configs.recommended` with `tseslint.configs.recommendedTypeChecked`
- [ ] Add `parserOptions.project` with all tsconfig paths
- [ ] Add `@typescript-eslint/no-floating-promises`, `no-misused-promises`, `consistent-type-imports`, `switch-exhaustiveness-check`
- [ ] Run `pnpm check:lint`; fix violations (expected: missing `await`s, missing `import type`)

#### 5.2 Import hygiene

<!-- files: eslint.config.mjs, package.json -->
<!-- @see docs/specs/430-dx-enforcement/430-dx-enforcement.md [FR-11] [DES-LINT] -->

- [ ] Install `eslint-plugin-import` (devDep)
- [ ] Add `import/no-cycle`, `import/no-extraneous-dependencies`
- [ ] Add `import/resolver` with typescript settings
- [ ] Run `pnpm check:lint`; fix any cycles

#### 5.3 Vitest lint plugin

<!-- files: eslint.config.mjs, package.json -->
<!-- @see docs/specs/430-dx-enforcement/430-dx-enforcement.md [FR-12] [DES-LINT] -->

- [ ] Install `eslint-plugin-vitest` (devDep)
- [ ] Add `vitest/no-focused-tests`, `no-disabled-tests`, `expect-expect` errors
- [ ] Run `pnpm check:lint`; ensure no `.only` / `.skip` in repo

#### 5.4 Variable naming convention

<!-- files: eslint.config.mjs -->
<!-- @see docs/specs/430-dx-enforcement/430-dx-enforcement.md [FR-33] [DES-VARS] -->

- [ ] Add `@typescript-eslint/naming-convention` rule per [DES-VARS] block — severity `warn` for initial rollout
- [ ] Run `pnpm check:lint`; capture full violation list (expected: many existing module-level camelCase consts)
- [ ] Open follow-up issue "FR-33 cleanup: rename module-level consts to UPPER_CASE" tracking the violation count
- [ ] After follow-up rename PR lands, flip severity from `warn` to `error` in a one-line config change (separate PR, same week as PR 5)

### Phase 6: PR 6 — Secrets

> Ref: [FR-15], [DES-SECRETS]

#### 6.1 Pre-commit gitleaks

<!-- files: .husky/pre-commit, .gitleaks.toml -->
<!-- @see docs/specs/430-dx-enforcement/430-dx-enforcement.md [FR-15] [DES-SECRETS] [DES-ERR] -->

- [ ] Add `gitleaks protect --staged --redact || exit 1` to top of `.husky/pre-commit` with soft-fail when binary missing (per DES-ERR row "Local gitleaks binary missing")
- [ ] Create `.gitleaks.toml` (default config); document allowlist process
- [ ] Run a test commit with a fake secret; confirm hook blocks

#### 6.2 CI gitleaks job

<!-- files: .github/workflows/code-qa.yml -->
<!-- @see docs/specs/430-dx-enforcement/430-dx-enforcement.md [FR-15] [DES-SECRETS] -->

- [ ] Add `secrets` job using `gitleaks/gitleaks-action@<sha>` with `fetch-depth: 0`
- [ ] Run on PR; confirm green on clean PR

#### 6.3 Scheduled trufflehog history scan

<!-- files: .github/workflows/security-scheduled.yml -->
<!-- @see docs/specs/430-dx-enforcement/430-dx-enforcement.md [FR-15] [DES-SECRETS] -->

- [ ] Create `.github/workflows/security-scheduled.yml` (Mondays 06:00 UTC)
- [ ] Add `trufflehog` job with `--only-verified`
- [ ] Run via `workflow_dispatch` to validate; tune allowlist if needed

#### 6.4 ESLint no-secrets

<!-- files: eslint.config.mjs, package.json -->
<!-- @see docs/specs/430-dx-enforcement/430-dx-enforcement.md [FR-15] [DES-LINT] -->

- [ ] Install `eslint-plugin-no-secrets` (devDep)
- [ ] Add rule with reasonable entropy threshold; run `pnpm check:lint`; tune ignored values for known fixtures

### Phase 7: PR 7 — Supply chain

> Ref: [FR-16], [FR-17], [FR-18], [FR-19], [FR-20], [FR-28], [DES-SUPPLY]

#### 7.1 pnpm audit + license check

<!-- files: .github/workflows/code-qa.yml, package.json -->
<!-- @see docs/specs/430-dx-enforcement/430-dx-enforcement.md [FR-16] [FR-18] [NFR-2] [DES-SUPPLY] -->

- [ ] Add `check:security` script: `pnpm audit --audit-level=high --prod && license-checker-rseidelsohn --production --onlyAllow '<allowlist>'`
- [ ] Install `license-checker-rseidelsohn` (devDep)
- [ ] Wire into `verify:full`
- [ ] Add CI `security` job invoking `pnpm check:security`

#### 7.2 OSV-Scanner

<!-- files: .github/workflows/code-qa.yml -->
<!-- @see docs/specs/430-dx-enforcement/430-dx-enforcement.md [FR-17] [DES-SUPPLY] -->

- [ ] Add `osv-scan` job using `google/osv-scanner-action@<sha>`
- [ ] Configure to scan `pnpm-lock.yaml`

#### 7.3 GitHub Actions SHA pinning

<!-- files: .github/workflows/*.yml -->
<!-- @see docs/specs/430-dx-enforcement/430-dx-enforcement.md [FR-19] [DES-SUPPLY] -->

- [ ] Replace every `uses: <action>@v<x>` with `uses: <action>@<40-char-SHA>` and add `# v<x>` comment
- [ ] Files: `code-qa.yml`, `release-please.yml`, `build-vsix.yml`, plus new `security-scheduled.yml`

#### 7.4 actionlint

<!-- files: .github/workflows/code-qa.yml -->
<!-- @see docs/specs/430-dx-enforcement/430-dx-enforcement.md [FR-20] [DES-SUPPLY] -->

- [ ] Add `actionlint` job using `reviewdog/action-actionlint@<sha>`
- [ ] Fix any reported issues (likely zero on existing workflows)

#### 7.5 Dependabot config

<!-- files: .github/dependabot.yml -->
<!-- @see docs/specs/430-dx-enforcement/430-dx-enforcement.md [FR-28] [DES-SUPPLY] [DES-SEC] -->

- [ ] Create `.github/dependabot.yml` with npm + github-actions ecosystems, weekly cadence, grouped updates
- [ ] Confirm Dependabot opens its first PRs after merge

### Phase 8: PR 8 — Application code security

> Ref: [FR-21], [FR-22], [FR-23], [DES-APPSEC]

#### 8.1 eslint-plugin-security (warn)

<!-- files: eslint.config.mjs, package.json -->
<!-- @see docs/specs/430-dx-enforcement/430-dx-enforcement.md [FR-21] [DES-APPSEC] -->

- [ ] Install `eslint-plugin-security` (devDep)
- [ ] Add recommended rules at `warn` level
- [ ] Run `pnpm check:lint`; document violations for fix in follow-up
- [ ] Note in `[DES-DEC]`: flip to `error` in a follow-up PR after triage

#### 8.2 eslint-plugin-no-unsanitized (error)

<!-- files: eslint.config.mjs, package.json -->
<!-- @see docs/specs/430-dx-enforcement/430-dx-enforcement.md [FR-21] [DES-APPSEC] -->

- [ ] Install `eslint-plugin-no-unsanitized` (devDep)
- [ ] Add `no-unsanitized/method` and `/property` rules at `error` for webview packages
- [ ] Run `pnpm check:lint`; fix any direct `innerHTML` usage

#### 8.3 CSP guard test

<!-- files: apps/vscode/src/panels/webview-html.test.ts, apps/vscode/src/panels/webview-html.ts -->
<!-- @see docs/specs/430-dx-enforcement/430-dx-enforcement.md [FR-22] [DES-APPSEC] -->

- [ ] Export `prodHtml` and `tryDevModeHtml` from `webview-html.ts` (named exports)
- [ ] Extend `webview-html.test.ts` (already moved in 3.3) with CSP assertions
- [ ] Confirm: prod has no `unsafe-eval`/`unsafe-inline-script`; dev has nonce-based script-src

### Phase 9: PR 9 — Test quality

> Ref: [FR-13], [FR-14], [FR-30], [DES-TEST]

#### 9.1 Coverage thresholds

<!-- files: packages/*/vitest.config.ts, apps/*/vitest.config*.ts -->
<!-- @see docs/specs/430-dx-enforcement/430-dx-enforcement.md [FR-14] [DES-TEST] -->

- [ ] Add `coverage.thresholds: { lines: 70, branches: 60, functions: 70, statements: 70 }` to each per-package vitest config
- [ ] Run `pnpm test:coverage`; ensure each package meets threshold (some may need additional unit tests)

#### 9.2 vitest-fail-on-console

<!-- files: packages/*/vitest.setup.ts, apps/*/vitest.setup.ts, package.json -->
<!-- @see docs/specs/430-dx-enforcement/430-dx-enforcement.md [FR-13] [DES-TEST] -->

- [ ] Install `vitest-fail-on-console` (devDep)
- [ ] Import and configure in each `vitest.setup.ts`
- [ ] Run `pnpm test`; fix any tests that emit console output

#### 9.3 size-limit budgets

<!-- files: .size-limit.json, .github/workflows/code-qa.yml -->
<!-- @see docs/specs/430-dx-enforcement/430-dx-enforcement.md [FR-30] [DES-TEST] [DES-TESTPLAN] -->

- [ ] Run `pnpm build && pnpm size-limit` on `main` to capture current sizes
- [ ] Add `limit` field per entry: current size + 15% (rounded to KB)
- [ ] Remove `continue-on-error: true` from the bundle-size CI job

### Phase 10: PR 10 — Workspace consistency

> Ref: [FR-24], [FR-25], [DES-WORKSPACE]

#### 10.1 syncpack (or @manypkg/cli)

<!-- files: .syncpackrc.json, package.json, eslint.config.mjs -->
<!-- @see docs/specs/430-dx-enforcement/430-dx-enforcement.md [FR-24] [DES-WORKSPACE] -->

- [ ] Resolve Open Question 1: pick `syncpack` or `@manypkg/cli`
- [ ] Install chosen tool (devDep)
- [ ] Create config (`.syncpackrc.json` or `.manypkgrc`)
- [ ] Add `check:syncpack` script; wire into `verify`
- [ ] Run; fix any version drift

#### 10.2 Node + pnpm version pinning

<!-- files: .nvmrc, .npmrc, package.json -->
<!-- @see docs/specs/430-dx-enforcement/430-dx-enforcement.md [FR-25] [DES-WORKSPACE] -->

- [ ] Create `.nvmrc` containing `22`
- [ ] Add `engine-strict=true` to `.npmrc` (or create the file)
- [ ] Verify `pnpm install` refuses on wrong Node version

### Phase 11: PR 11 — Polish

> Ref: [FR-26], [FR-27], [FR-29], [FR-32], [DES-DOCS]

#### 11.1 cspell

<!-- files: .cspell.json, .cspell-dict.txt, package.json, .github/workflows/code-qa.yml -->
<!-- @see docs/specs/430-dx-enforcement/430-dx-enforcement.md [FR-26] [DES-DOCS] -->

- [ ] Install `cspell` (devDep)
- [ ] Create `.cspell.json` and `.cspell-dict.txt` (seeded list per [DES-DOCS])
- [ ] Add `check:cspell` script; wire into `verify`
- [ ] Run; populate dictionary with project-specific terms surfaced
- [ ] Optional: add CI step to surface in PR comment

#### 11.2 lychee link checking

<!-- files: .github/workflows/security-scheduled.yml -->
<!-- @see docs/specs/430-dx-enforcement/430-dx-enforcement.md [FR-27] [DES-DOCS] -->

- [ ] Add `links` job to `security-scheduled.yml` using `lycheeverse/lychee-action@<sha>`
- [ ] Configure to scan `**/*.md`, exclude mailto links
- [ ] Trigger via `workflow_dispatch`; fix any broken links surfaced

#### 11.3 PR template + CODEOWNERS + .gitmessage

<!-- files: .github/pull_request_template.md, .github/CODEOWNERS, .gitmessage -->
<!-- @see docs/specs/430-dx-enforcement/430-dx-enforcement.md [FR-29] -->

- [ ] Create `.github/pull_request_template.md` (Summary / Test plan / Risk)
- [ ] Create `.github/CODEOWNERS` (path-based assignment to `@rix`)
- [ ] Create `.gitmessage` (Conventional Commits template — closes 400-conventions FR-5)
- [ ] Document `git config commit.template .gitmessage` in CONTRIBUTING.md

#### 11.4 eslint-plugin-jsdoc — @see traceability

<!-- files: eslint.config.mjs, package.json -->
<!-- @see docs/specs/430-dx-enforcement/430-dx-enforcement.md [FR-32] -->

- [ ] Install `eslint-plugin-jsdoc` (devDep)
- [ ] Add custom rule (or `jsdoc/require-jsdoc` with custom contexts) requiring `@see` on `*.{repository,service,action,model,constants}.ts`
- [ ] Land at `warn` severity initially (Open Q2)
- [ ] Document in AGENTS.md the lint enforcement of the AFX traceability convention

#### 11.5 Update predecessor specs

<!-- files: docs/specs/420-dx-testing/design.md, docs/specs/410-dx-quality/spec.md, docs/specs/500-ci-code-qa/spec.md -->
<!-- @see docs/specs/430-dx-enforcement/430-dx-enforcement.md [FR-31] -->

- [ ] Fix `docs/specs/420-dx-testing/design.md` line 121 (vscode-e2e files are `.test.ts`, not `.spec.ts`)
- [ ] Add cross-reference notes in 410-dx-quality and 500-ci-code-qa specs pointing at 430

#### 11.6 Branch protection update + final file-set audit (post-merge)

<!-- files: (GitHub UI — no file change), entire file structure under [DES-FILES] -->
<!-- @see docs/specs/430-dx-enforcement/430-dx-enforcement.md [DES-ROLLOUT] [DES-FILES] -->

- [ ] Add the new required CI jobs to GitHub branch protection: `secrets`, `osv-scan`, `actionlint`, `security`, `bundle-size` (no longer continue-on-error)
- [ ] Confirm `Require signed commits`, `Require linear history`
- [ ] Final file-set audit: verify every row in [DES-FILES] is present (or moved/renamed as specified) — diff against the `main` branch baseline, confirm no in-flight modifications dropped

### Cross-Reference Index

| Phase / Tasks | Spec Requirements                        | Design Sections                         |
| ------------- | ---------------------------------------- | --------------------------------------- |
| 1.1 – 1.3     | FR-1, FR-2, FR-3, FR-31, FR-34           | DES-OVR, DES-ARCH, DES-API              |
| 2.1 – 2.4     | FR-4, FR-23                              | DES-LINT                                |
| 3.1 – 3.5     | FR-5, FR-6, FR-7                         | DES-NAMING                              |
| 4.1 – 4.3     | FR-8, FR-9                               | DES-TS, DES-SHADCN (4.2)                |
| 5.1 – 5.4     | FR-10, FR-11, FR-12, FR-33               | DES-LINT, DES-VARS, DES-DEPS (5.1)      |
| 6.1 – 6.4     | FR-15                                    | DES-SECRETS, DES-LINT, DES-ERR (6.1)    |
| 7.1 – 7.5     | FR-16, FR-17, FR-18, FR-19, FR-20, FR-28 | DES-SUPPLY, DES-SEC (7.5)               |
| 8.1 – 8.3     | FR-21, FR-22, FR-23                      | DES-APPSEC                              |
| 9.1 – 9.3     | FR-13, FR-14, FR-30                      | DES-TEST, DES-TESTPLAN (9.3)            |
| 10.1 – 10.2   | FR-24, FR-25                             | DES-WORKSPACE                           |
| 11.1 – 11.6   | FR-26, FR-27, FR-29, FR-31, FR-32        | DES-DOCS, DES-ROLLOUT, DES-FILES (11.6) |

NFR coverage: NFR-1 enforced by 1.1 (`turbo run --continue` parallel design); NFR-2 by deterministic tooling choices in DES-DEC; NFR-3 by the 11-PR atomic-revert plan in DES-ROLLOUT; NFR-4 by review during each PR; NFR-5 by 4.2 scope; NFR-6 by per-tool standard output (eslint, vitest, gitleaks); NFR-7 by tooling choices that emit machine-readable output (eslint JSON, vitest TAP, gitleaks SARIF).

DES anchors not referenced by any task `@see` (intentionally — sections are documented as N/A for this sprint):

- **DES-DATA** — section content: "N/A — no schema or persistent data introduced." Sprint changes tooling, not data shape.
- **DES-UI** — section content: "N/A — this sprint changes tooling, not UI." Sprint introduces no user-facing surface.

These two anchors exist as scaffolding-completeness markers (`afx-design/assets/design-template.md` always emits them) and are explicitly waived from the per-task coverage rule. All 20 substantive `[DES-X]` anchors have at least one task `@see` reference.

<!-- SPRINT-SECTION-END: TASKS -->

---

<!-- SPRINT-SECTION-START: SESSIONS (appended to tasks.md on graduation — tasks-template.md requires Work Sessions as the last section) -->

## 4. Work Sessions

<!-- IMPORTANT: This section MUST remain the LAST section in {feature}.md. Do not add content below it. -->
<!-- Task execution log — append-only, updated by /afx-sprint code, /afx-task pick, /afx-task code, /afx-task complete -->
<!-- Columns: Date (YYYY-MM-DD) | Task (WBS ID) | Action (Picked/Coded/Completed/Verified/Reviewed) | Files Modified | Agent ([x] or []) | Human ([x] or []) -->

| Date       | Task       | Action   | Files Modified                                                                                                                                                   | Agent | Human |
| ---------- | ---------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 2026-04-28 | 1.1        | Coded    | package.json                                                                                                                                                     | [x]   | [ ]   |
| 2026-04-28 | 1.2        | Coded    | .husky/pre-push                                                                                                                                                  | [x]   | [ ]   |
| 2026-04-28 | 1.3        | Coded    | AGENTS.md, CLAUDE.md, .github/workflows/code-qa.yml                                                                                                              | [x]   | [ ]   |
| 2026-04-28 | 1          | Verified | smoke-test pnpm verify (2 pre-existing failures, scoped to Phase 9+11)                                                                                           | [x]   | [ ]   |
| 2026-04-28 | 2.1        | Coded    | eslint.config.mjs (apps/vscode boundary + agent-factory exception)                                                                                               | [x]   | [ ]   |
| 2026-04-28 | 2.2        | Coded    | eslint.config.mjs (apps/chat + apps/workbench webview boundary, scoped to src/\*\*)                                                                              | [x]   | [ ]   |
| 2026-04-28 | 2.3        | Coded    | eslint.config.mjs (packages/agent + shared + parsers boundaries)                                                                                                 | [x]   | [ ]   |
| 2026-04-28 | 2.4        | Coded    | eslint.config.mjs (process.env restriction); packages/agent/pi/src/rpc-client.ts (inline disable for child env)                                                  | [x]   | [ ]   |
| 2026-04-28 | 2          | Verified | pnpm check:lint clean — 0 errors, 0 warnings                                                                                                                     | [x]   | [ ]   |
| 2026-04-28 | 3.3        | Coded    | git mv 4 vscode tests + 2 fixtures from `__tests__` to `src/`; patched imports + dynamic imports + vi.mock paths                                                 | [x]   | [ ]   |
| 2026-04-28 | 3.4        | Coded    | git mv apps/chat/src/`__tests__`/no-pi-imports.test.ts → apps/chat/src/; updated walk-root path                                                                  | [x]   | [ ]   |
| 2026-04-28 | 3          | Coded    | apps/vscode/vitest.config.ts + apps/chat/vitest.config.unit.ts: drop `__tests__` from globs, add `__fixtures__` to coverage exclude                              | [x]   | [ ]   |
| 2026-04-28 | 3.2        | Coded    | tests/conventions/test-naming-and-folders.test.ts + vitest.config.ts; vitest.workspace.ts ref; package.json test:naming-guard                                    | [x]   | [ ]   |
| 2026-04-28 | 3.1        | Coded    | eslint.config.mjs (eslint-plugin-check-file: folder-naming-convention KEBAB_CASE; filename basename via unicorn)                                                 | [x]   | [ ]   |
| 2026-04-28 | 3          | Fixed    | apps/vscode/src/{agent-factory,extension}.test.ts type errors surfaced by tsc include change (MockInstance, Object.defineProperty, partial-cast, non-null check) | [x]   | [ ]   |
| 2026-04-28 | 3.5        | Verified | pnpm check:lint + check-types clean; 6/6 vscode test files pass (39 tests); naming-guard 3/3 green                                                               | [x]   | [ ]   |
| 2026-04-28 | 6.1-6.4    | Coded    | .husky/pre-commit + .gitleaks.toml + code-qa.yml secrets job + security-scheduled.yml (trufflehog + lychee) + eslint-plugin-no-secrets                           | [x]   | [ ]   |
| 2026-04-28 | 7.1-7.5    | Coded    | check:security script + CI security/osv-scan/actionlint jobs + dependabot.yml @see (SHA pinning 7.3 deferred)                                                    | [x]   | [ ]   |
| 2026-04-28 | 8.1-8.3    | Coded    | eslint-plugin-security tuned + eslint-plugin-no-unsanitized + CSP guard test (3 new tests pass)                                                                  | [x]   | [ ]   |
| 2026-04-28 | 10.1-10.2  | Coded    | syncpack installed + .syncpackrc.json + check:syncpack manual script + .npmrc engine-strict (verify-integration deferred for vendor leak)                        | [x]   | [ ]   |
| 2026-04-28 | 11.3, 11.5 | Coded    | .gitmessage @see + 420-dx-testing/design.md line 121 fix (vscode-e2e \*.test.ts)                                                                                 | [x]   | [ ]   |
| 2026-04-28 | 4,5,9      | Deferred | High-violation TS strict + type-aware lint + FR-33 naming + size-limit budgets — need dedicated PRs                                                              | [ ]   | [ ]   |
| 2026-04-28 | ALL        | Verified | pnpm verify exits non-zero only on 2 pre-existing failures (parsers coverage + knip orphan); ALL new enforcement layers pass                                     | [x]   | [ ]   |

<!-- SPRINT-SECTION-END: SESSIONS -->
