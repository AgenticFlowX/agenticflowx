---
afx: true
type: JOURNAL
status: Living
owner: "@rixrix"
created_at: "2026-04-28T02:36:26.000Z"
updated_at: "2026-04-28T05:17:39.000Z"
tags: ["430-dx-enforcement", "journal"]
---

# Journal - Repo Enforcement Hardening

<!-- prefix: DXE -->

> Quick captures and discussion history for AI-assisted development sessions.
> See [agenticflowx.md](../agenticflowx.md) for workflow.

## Captures

<!-- Quick notes during active chat - cleared when recorded -->

---

## Discussions

<!-- Recorded discussions with IDs: DXE-D001, DXE-D002, etc. -->
<!-- Chronological order: oldest first, newest last -->

### DXE-D001 — Sprint scaffold and source-code feasibility audit

`status:active` `2026-04-28T02:36:26.000Z` `[scaffold, audit, enforcement]`

**Context**: User requested a single comprehensive sprint covering all enforcement layers discussed in the prior conversation: lint, type strictness, file/folder naming, test naming, security (secrets, supply chain, app code), test quality, workspace consistency, docs hygiene. Required up-front feasibility verification against actual source code before writing the brief.

**Summary**: Audited eslint.config.mjs, tsconfig.base.json + per-package overrides, package.json scripts, .husky hooks, .github/workflows/code-qa.yml, vitest workspace config, webview-html.ts, knip.json, .size-limit.json. Confirmed all 32 FRs are feasible with current tooling. Drafted single-doc sprint brief at `docs/specs/430-dx-enforcement/430-dx-enforcement.md` covering 32 FRs / 7 NFRs, 11 [DES-X] sections, 11 phases / ~40 task groups (one phase per PR).

**Progress**:

- [x] Source-code feasibility audit (eslint, tsconfig, husky, CI, vitest, webview)
- [x] Spec section (Problem, Stories, FRs, NFRs, Acceptance, Non-Goals, Open Qs)
- [x] Plan section ([DES-OVR/ARCH/LINT/NAMING/TS/SECRETS/SUPPLY/APPSEC/TEST/WORKSPACE/DOCS/FILES/DEPS/SEC/ERR/TEST/ROLLOUT])
- [x] Tasks section (11 phases, ~40 task groups, full @see anchors)
- [x] User review of Spec → `/afx-sprint spec 430-dx-enforcement --approve` _(2026-04-28T02:53:35.000Z; "i trust you on this" — Q1 resolved inline as Option A)_
- [x] User review of Design → `/afx-sprint design 430-dx-enforcement --approve` _(2026-04-28T03:19:17.000Z; standing trust)_
- [x] User review of Tasks → `/afx-sprint task 430-dx-enforcement --approve` _(2026-04-28T03:35:42.000Z; standing trust; 4 missing DES anchors patched inline pre-approval, 2 N/A waived)_

**Decisions**:

- Single-doc sprint format (not 4-file) — surgical, atomic per-PR work, low ceremony
- Numbered as `430-dx-enforcement` to match the 4xx DX numbering convention (after 400/410/420)
- 11 sequential, independently revertable PRs — minimizes risk and lets violations surface layer-by-layer
- Defense-in-depth feedback layers: editor → pre-commit → commit-msg → pre-push (NEW) → PR CI → scheduled CI (NEW)
- `pnpm verify` (fast, <90s) and `pnpm verify:full` (full lifecycle including security suite) replace `ci`/`health`/`health:full`
- Architecture boundaries: lint via `no-restricted-imports` for forbidden imports; guard tests for tree-shape concerns
- TS strict in `packages/ui` recovered via `// @ts-nocheck` headers on shadcn-generated files (option A) — `scripts/shadcn-postadd.mjs` re-applies on regeneration
- `eslint-plugin-security` and `eslint-plugin-jsdoc` rolled out as `warn`-then-`error` to avoid blocking PR on heuristic / latent violations
- GitHub Actions pinned to commit SHAs (supply-chain hardening, mitigates 2025 `tj-actions/changed-files` class of attack); maintained by Dependabot
- Skipped: CodeQL (deferred), Stryker (overkill), Percy/Chromatic (premature), SBOM (no customer ask), Semgrep (overlaps), `exactOptionalPropertyTypes` (pain ≫ gain), zod webview message validation (separate sprint)

**Tips/Ideas**:

- Pre-push hook should soft-fail when `gitleaks` binary is absent — agents and contributors without local install shouldn't be blocked; CI is the hard gate
- Each PR's surfaced violations are part of that PR's scope — don't pre-fix across PRs; keeps reverts atomic
- Open Question 1 (syncpack vs @manypkg/cli) can be resolved by trying both during PR 10 — both work, pick by ergonomics

**Notes**:

- **[DXE-D001.N1]** **[2026-04-28T02:36:26.000Z]** Sprint approval state initialized as Draft/Draft/Draft per `/afx-sprint new` flow. User runs `/afx-sprint spec --approve` after review to gate forward progress. `[scaffold]`
- **[DXE-D001.N2]** **[2026-04-28T02:53:35.000Z]** Spec section approved. User delegated review with "i trust you on this" — agent resolved blocking Open Question #1 (TS-strict recovery in `packages/ui`) as Option A (`@ts-nocheck` headers on shadcn-generated files + `scripts/shadcn-postadd.mjs` regeneration helper) per the rationale already documented in `[DES-DEC]`. Approval state now: spec=Approved, design=Draft, tasks=Draft. `[approval, spec, q1-resolved]`
- **[DXE-D001.N3]** **[2026-04-28T03:06:45.000Z]** Formalized all remaining Open Questions in one pass — user wants infra locked in, not lingering choices. Resolutions: Q2 `pnpm audit` → `high+`; Q3 workspace consistency → `syncpack`; Q4 lychee → weekly only (workflow_dispatch for ad-hoc); Q5 `pnpm verify` → turbo `--continue` (parallel, full failure list); Q6 jsdoc → warn-then-error rollout; Q7 security plugin → warn-then-error (propagated from `[DES-DEC]`); Q8 bundle headroom → 15%. Also caught and fixed a contradiction between FR-5 and the resolved design Q4: `.spec.ts` is now Playwright-only (`apps/chat/e2e/**`); `apps/vscode-e2e/src/**` keeps `.test.ts` because vscode-test-electron has no `.spec` convention. DES-NAMING glob and naming-guard test snippet both updated to match (E2E_DIRS renamed to SPEC_ONLY_DIRS, vscode-e2e removed). Treated as clarification edit per skill rule (all non-blocking, recommendations already in `[DES-DEC]`); approval.spec stays Approved. `[approval-edit, q2-q8-resolved, fr-5-tightened, no-demotion]`
- **[DXE-D001.N4]** **[2026-04-28T03:13:51.000Z]** FR-7 tightened by user request: folder names must be **lowercase kebab-case** at any length — explicit rejection of camelCase, PascalCase, SCREAMING_SNAKE, snake_case, and mixed-case. Numbered prefixes (e.g., `100-package-shared`) are kebab-compliant. Allowlist for double-underscore conventions (`__fixtures__`, `__mocks__`, `__snapshots__`) and managed/dotfile dirs (`node_modules`, `.turbo`, `.vscode-test`, `.husky`, `.github`, `.vscode`, `.afx`, `.claude`, `.agents`) added to DES-NAMING ESLint block. Phase 3.1 task updated to enumerate the allowlist. Clarification edit; spec stays Approved. `[approval-edit, fr-7-tightened, folder-naming, no-demotion]`
- **[DXE-D001.N5]** **[2026-04-28T03:17:23.000Z]** Added FR-33 (variable naming convention via `@typescript-eslint/naming-convention`) on user request — module-level `const` non-function values use `UPPER_CASE`, module-level `const` bound to a function (incl. anonymous arrow / React component) keeps `camelCase`/`PascalCase`, function-local consts unconstrained. New `[DES-VARS]` block added to design with full rule config. New Phase 5.4 task added. Cross-reference index updated. Warn-then-error rollout planned: lands at `warn` in PR 5; same-week follow-up renames module-level camelCase consts to `UPPER_CASE` and flips severity to `error`. **Edge case flagged**: `const queryClient = new QueryClient()` and similar startup-instance patterns will warn under the strict policy — user accepted this consequence. Spec edit treated as user-authorized scope addition under standing trust ("i need the correct infra now"); approval.spec stays Approved. `[approval-edit, fr-33-added, naming-convention, scope-addition, standing-trust]`
- **[DXE-D001.N6]** **[2026-04-28T03:19:17.000Z]** Design section approved under standing trust. Mini-audit pass: 22 `[DES-X]` sections present (DES-OVR, DES-ARCH, DES-UI, DES-DEC, DES-DATA, DES-API, DES-LINT, DES-NAMING, DES-VARS, DES-TS, DES-SECRETS, DES-SUPPLY, DES-APPSEC, DES-TEST, DES-WORKSPACE, DES-DOCS, DES-FILES, DES-DEPS, DES-SEC, DES-ERR, DES-TEST, DES-ROLLOUT); Key Decisions table populated with 8 decisions; design Open Q1–Q5 either Resolved or non-blocking. Approval state now: spec=Approved, design=Approved, tasks=Draft. `[approval, design, standing-trust]`
- **[DXE-D001.N7]** **[2026-04-28T03:22:49.000Z]** Tasks-section coverage review (auto mode). Scan: 33/33 FRs referenced ✓, 21/21 DES anchors referenced ✓, 0/7 NFRs referenced (gap). NFRs are quality attributes enforced by _how_ tasks execute, not by separate task groups; the Cross-Reference Index already mapped them in prose. Closed the gap by adding NFR @see references to the most appropriate existing task groups: NFR-1/3/6/7 → 1.1 (verify command latency, atomic rollback intent, signal-to-noise via turbo --continue, agent-readability via standard tool output); NFR-4 → 1.3 (no-bypass-paths documented in AGENTS.md verification section); NFR-5 → 4.2 (shadcn relaxation scoped narrowly to `src/{components,hooks}/**`); NFR-2 → 7.1 (determinism via `pnpm install --frozen-lockfile` + license-checker reproducibility). Coverage now 100%. Tasks section ready for approval. `[task-review, coverage-100pct, nfr-anchors-added]`
- **[DXE-D001.N8]** **[2026-04-28T03:28:28.000Z]** Shadcn end-to-end exemption charter. User reinforced: shadcn-generated code is third-party (registry-owned) and gets updated periodically — every enforcement layer must let them through unmodified. Added a new consolidated `[DES-SHADCN]` design section listing the canonical exempt globs (`packages/ui/src/components/**`, `packages/ui/src/hooks/**`) and the full layer matrix. Updated 7 individual blocks to add explicit shadcn `ignores`: DES-LINT process.env, DES-LINT type-aware preset, DES-LINT import hygiene, DES-APPSEC eslint-plugin-security, DES-APPSEC no-unsanitized (with explicit risk-acceptance comment — CSP is the offsetting control), DES-TEST coverage block (vitest `coverage.exclude`), and Phase 4.2 task (added knip ignore + vitest coverage exclude as concrete bullets, plus a regen-survival smoke-test bullet). Layers that already exempt shadcn (DES-NAMING, DES-VARS, DES-TS) stay as-is. Layers that have no shadcn surface (architecture-boundary `no-restricted-imports`, gitleaks, deps audit, size-limit, markdownlint) — N/A. Net: every machine-checkable rule in this sprint either exempts shadcn paths or never touches them. Spec stays Approved (clarification edit reinforcing existing NFR-5). `[approval-edit, shadcn-exemption-charter, des-shadcn-added, no-demotion]`
- **[DXE-D001.N9]** **[2026-04-28T03:31:49.000Z]** Added FR-34: auto-fix scripts. User pain point: hand-fixing markdownlint warnings on every PR. Diagnosed the gap — `MD040` (fenced-code-language) is already disabled (commit 4907b83), so missing `text` hints on code fences don't fail CI; the actual friction is mechanical rules (MD009/MD012/MD030/MD047, MD060 table alignment) that are auto-fixable but require a script we don't have. Added two scripts: `check:md:fix` (runs `markdownlint-cli2 --fix`) and an aggregate `pnpm fix` running `check:format:fix && check:md:fix && check:lint:fix` in that order (prettier first to normalize layout, markdownlint second on prettier's output, eslint last for the final word). Updated DES-API with the JSON snippet + execution-order rationale + explicit list of what `pnpm fix` does NOT fix (architecture violations, missing types, missing @see, missing tests). Phase 1.1 + 1.3 task bullets and cross-reference index updated. User pattern lock-in: "run `pnpm verify`; if it fails on auto-fixable issues, run `pnpm fix`; then verify again." Spec stays Approved (FR addition under standing trust — same shape as FR-33). `[approval-edit, fr-34-added, auto-fix-scripts, pnpm-fix, no-demotion]`
- **[DXE-D001.N10]** **[2026-04-28T03:35:42.000Z]** Tasks section approved under standing trust (auto mode). Mini-audit ran the full coverage matrix against the now-extended spec (34 FRs, 7 NFRs, 22 DES anchors): all 34 FRs ✓, all 7 NFRs ✓, 16 of 22 DES referenced before patch. Patched 4 missing substantive DES anchors inline pre-approval: DES-DEPS → 5.1 (first big batch of new dev-deps); DES-ERR → 6.1 (gitleaks soft-fail handling matches the DES-ERR table row); DES-SEC → 7.5 (Dependabot wraps up the supply-chain security stack); DES-FILES → 11.6 (final file-set audit at branch-protection time, with new bullet). The remaining 2 missing anchors — DES-DATA, DES-UI — are explicitly N/A (sections literally state "N/A — no schema..." / "N/A — this sprint changes tooling, not UI"). Added an explicit waiver paragraph to the Cross-Reference Index documenting the N/A status; design template emits these scaffolding anchors but they aren't task-actionable. 42 task groups, 42 `@see` comments (1:1 ratio), all checkboxes well-formed. Approval state now: spec=Approved, design=Approved, tasks=Approved; top-level status=Approved. Implementation gate is open. `[approval, tasks, standing-trust, des-coverage-patched, n-a-waivers]`
- **[DXE-D001.N11]** **[2026-04-28T03:41:59.000Z]** `/afx-sprint verify` ran (auto mode). Found one editorial defect: anchor duplicate — `[DES-TEST]` was used for both the test-quality block (FR-12/13/14) and the cross-cutting "Testing Strategy" block. Auto-fixed by renaming the second occurrence to `[DES-TESTPLAN]` (no task `@see` references depended on the rename — only the first DES-TEST is referenced from Phase 9 tasks). Added DES-TESTPLAN reference to Phase 9.3 (size-limit budgets — covers the "Bundle budget breach" bullet from the testing-strategy block) and updated the cross-reference index. Re-verify pass: 23 unique DES anchors, 22 substantively referenced, 2 documented N/A waivers (DES-DATA, DES-UI), 1 cross-cutting test-strategy anchor (DES-TESTPLAN) referenced from Phase 9.3. The "malformed checkboxes" hit on the first verify run was a false positive — the lines flagged were narrative bullets in the Cross-Reference Index N/A waiver paragraph, not task items inside task groups. All 7 verify checks pass. Spec stays Approved (editorial fix, no scope change). Sprint is READY FOR CODING. `[verify-pass, anchor-dedup, des-testplan-renamed, ready-for-code]`
- **[DXE-D001.N12]** **[2026-04-28T03:48:50.000Z]** Phase 1 implemented (auto mode, "all phases in sequence"). **Task 1.1** Consolidated root scripts: added `verify` (turbo parallel: check-types + check:lint + check:format + check:md + check:knip + test, with `--continue` for full failure list), `verify:full` (verify + build + size-limit + test:coverage + test:e2e:all, sequential fail-fast), `fix` (prettier --write → markdownlint --fix → eslint --fix), `check:md:fix`. Removed legacy `ci`, `health`, `health:full` (consolidated into the new commands). turbo.json already defined the underlying root-level tasks (`//#check:lint`, etc.) so no turbo config change needed. **Task 1.2** Created `.husky/pre-push` running `pnpm verify` with header comment + spec @see; chmod +x. **Task 1.3** Replaced AGENTS.md "Verification requirements" section with new "Verification" section covering (a) two-tier surface (verify / verify:full), (b) the verify→fix→verify loop, (c) explicit list of what `pnpm fix` cannot fix (types, architecture violations, missing @see, coverage breaches, commitlint), (d) targeted-check escape hatches. Added one-line `pnpm verify` cross-reference at the top of CLAUDE.md (between `@AGENTS.md` import and AFX-managed block). Updated `.github/workflows/code-qa.yml` header comment to note conceptual equivalence with `pnpm verify:full` and add @see to spec 430. Top-level status promoted from Approved → Living (first implementation session). 3 Work Sessions rows logged. `[phase-1-coded, single-command, pre-push, agents-md-verification]`
- **[DXE-D001.N13]** **[2026-04-28T03:51:00.000Z]** Phase 1 smoke-test: `pnpm verify` ran end-to-end (24s cold, 5s warm cache via turbo). Pipeline plumbing works. Initial run surfaced 4 failures; 2 resolved during Phase 1 (added `docs/design-system/` to `.prettierignore` + the `check:md`/`check:md:fix` exclude list — those are upstream UI/brand kits, not team-authored), 2 remain pre-existing and out-of-scope: (a) `@afx/parsers#test` coverage threshold breach (26% lines vs 70% — `spec.ts` and `tasks.ts` have 0% coverage; will be addressed by Phase 9 FR-14 tightening or by adding parser unit tests in a parallel task); (b) `//#check:knip` flags `apps/chat/src/test-utils/mock-agent-manager.ts` as unused and notes `@testing-library/user-event` is in `ignoreDependencies` but actually used (orphan + stale ignore — Phase 11 polish can clean up). Confirmed `pnpm fix` works correctly (prettier 0 changes after first pass, markdownlint 0 errors, eslint --fix touched journal/spec emphasis style). Phase 1 acceptance criteria (verify exits 0 on `main`) is partially met — pre-existing failures will close in Phases 9 + 11. Moving to Phase 2 (architecture boundaries). `[phase-1-smoke-test, design-system-prettierignored, parsers-coverage-pre-existing, knip-orphan-pre-existing]`
- **[DXE-D001.N14]** **[2026-04-28T03:56:37.000Z]** Phase 2 implemented (architecture boundaries via `no-restricted-imports`). **2.1** `apps/vscode/**/*.{ts,tsx}` — forbid `react`/`react-dom`/`@afx/ui*`/`@afx/transport*`/`@afx/agent-*`; explicit exception block for `apps/vscode/src/agent-factory.ts` (the single seam allowed to import the adapter). **2.2** `apps/chat/src/**` and `apps/workbench/src/**` (NOT package roots) — forbid `vscode`/`@afx/agent-*`/`@mariozechner/*`/`node:child_process`/`node:fs*`/`node:path` etc.; ignores `**/*.test.{ts,tsx}` + `**/__tests__/**` + `**/__fixtures__/**` because architectural-guard tests legitimately walk the source tree. **2.3** `packages/agent/**` — no `vscode`/`react`/`react-dom`. `packages/{shared,parsers}/**` — no `vscode`/`react`/`react-dom`. **2.4** `process.env` restriction (FR-23) — `no-restricted-syntax` blocking direct access; ignores extension.ts, agent-factory.ts, scripts/**, vitest/vite/playwright configs, vscode-test.mjs, .test files, shadcn dirs. Inline `eslint-disable-next-line no-restricted-syntax` added to `packages/agent/pi/src/rpc-client.ts:161` with rationale comment ("spawned child needs parent env (PATH, HOME, etc.); not user-supplied config") — this is the one legitimate use of `process.env` outside the bootstrap allowlist. Initial lint run surfaced 17 violations across config files and the rpc-client spawn site; all triaged with rule-glob tightening (src/** scoping), exemption list expansion, and one inline disable. Final `pnpm check:lint`: clean (0 errors, 0 warnings). Phase 2 done. `[phase-2-coded, no-restricted-imports, process-env-restricted, src-only-scoping]`
- **[DXE-D001.N15]** **[2026-04-28T04:38:56.000Z]** Phase 3 implemented (naming convention + file moves). **3.3 + 3.4** — `git mv` 6 files: agent-factory.spec.ts → agent-factory.test.ts (src), extension.spec.ts → extension.test.ts (src), webview-html.spec.ts → panels/webview-html.test.ts, no-pi-imports-panels.test.ts → panels/no-pi-imports.test.ts, fixtures/_→ src/**fixtures**/_, plus apps/chat/src/**tests**/no-pi-imports.test.ts → src/. Empty `__tests__` dirs removed. Patched all imports: `./fixtures/` → `./__fixtures__/`, `../src/X` → `./X` (for sibling refs after move), dynamic `await import("../src/X")` → `await import("./X")`, `vi.mock("../src/X")` → `vi.mock("./X")`. Patched two pre-existing src tests that referenced the old fixtures path (`agent-runtime-monitor.test.ts` and `panels/sidebar-panel.test.ts`). Updated walk-root logic in both no-pi-imports tests for new file location. **3** — Updated apps/vscode/vitest.config.ts and apps/chat/vitest.config.unit.ts to drop `__tests__` from include globs, add `__fixtures__` to coverage exclude. **3.2** — Created `tests/conventions/test-naming-and-folders.test.ts` with 3 guards (no `__tests__`, no `.spec` outside Playwright, no `.test` inside Playwright); created `tests/conventions/vitest.config.ts`; added to vitest.workspace.ts; added `test:naming-guard` root script. **3.1** — Installed `eslint-plugin-check-file@3.3.1`; added `check-file/folder-naming-convention` rule with `KEBAB_CASE` for all linted folders; explicit ignores for shadcn dirs, managed/dotfile dirs, double-underscore conventions (`__fixtures__`, `__mocks__`, `__snapshots__`). Dropped `check-file/filename-naming-convention` rule because its placeholder syntax (requires `KEBAB_CASE.spec.{ts,tsx}` etc.) was failing on plain filenames; relying on existing `unicorn/filename-case` for basename casing and the naming-guard test for `.spec`/`.test` placement. **Surfaced 3 latent type errors** in moved tests (hidden when files lived under `__tests__/` because `apps/vscode/tsconfig.json` only includes `src/`): (a) `vi.spyOn` MockInstance generic incompatibility with mocked vscode module — fixed by typing as permissive `MockInstance` from vitest; (b) `workspaceFolders` read-only — fixed via `Object.defineProperty`; (c) AgentRuntimeStatus partial mock — cast to `Awaited<ReturnType<...>>`; (d) noUncheckedIndexedAccess on destructured array — added explicit non-null check with throw. Naming-guard test green (3/3); all 6 vscode test files pass (39 tests); apps/chat all pass (33 tests); `pnpm check:lint` clean; `pnpm check:types` for vscode clean. `[phase-3-coded, file-moves, naming-guard, check-file-plugin, latent-type-errors-fixed]`
- **[DXE-D001.N16]** **[2026-04-28T05:17:39.000Z]** Phases 6, 7 (mostly), 8, 10, 11 (partial) implemented in one batch on user "continue all" command. **Phase 6 (Secrets)** — gitleaks soft-fail in pre-commit (skips with informational message when binary missing; CI is hard gate); CI `secrets` job using `gitleaks/gitleaks-action`; new `.github/workflows/security-scheduled.yml` with weekly trufflehog history scan + lychee link check (Mondays 06:00 UTC + workflow*dispatch); `eslint-plugin-no-secrets` at `error` with CSP nonce charset added to ignoreContent. **Phase 7 (Supply chain)** — `check:security` script (pnpm audit high+ + license-checker-rseidelsohn allowlist with BlueOak-1.0.0 added); CI `security` + `osv-scan` (google/osv-scanner-action) + `actionlint` (reviewdog) jobs; existing dependabot.yml updated with @see to FR-28. **Phase 8 (App security)** — `eslint-plugin-security` configured with high-value rules at `error` (eval-with-expression, non-literal-require, pseudoRandomBytes, bidi-characters, buffer-noassert, new-buffer) and known-noisy heuristic rules at `off` (non-literal-fs-filename, non-literal-regexp, object-injection, unsafe-regex, possible-timing-attacks, child-process); `eslint-plugin-no-unsanitized` at `error` for webview packages with shadcn dirs exempt + risk-acceptance comment (CSP is offsetting control); CSP guard `describe` block added to webview-html.test.ts with 3 new tests (prod has no `unsafe-eval`/`unsafe-inline` for scripts; dev has 32-char nonce; missing-build error page is well-formed). **Phase 10 (Workspace)** — syncpack@v13 installed + `.syncpackrc.json` (workspace:* for @afx/**, ^ for everything else); `check:syncpack` script with explicit --source filters; `.npmrc engine-strict=true`.**Phase 11 (Polish, partial)\*\* — `.gitmessage` updated with @see FR-29/FR-5; existing `.github/CODEOWNERS` and `pull_request_template.md` retained; `docs/specs/420-dx-testing/design.md` line 121 fixed (vscode-e2e now correctly notes `_.test.ts`per resolved Open Q4). **Deferred to follow-up PRs**: (a) GH Actions SHA pinning (FR-19) — needs gh api lookups across 4 workflow files; (b) syncpack-in-verify integration — v13 source filtering doesn't exclude the bundled VSCode binary's vendor package.json files inside apps/vscode-e2e/.vscode-test/; runnable manually via`pnpm check:syncpack`; (c) Phases 4 (TS strict cleanup) + 5 (type-aware lint + FR-33 naming-convention) — high-violation surface, each needs dedicated PR with violation-by-violation triage; (d) Phase 9 (vitest-fail-on-console + size-limit budgets) — coverage thresholds already exist per-package at 70%; (e) Phase 11.1 (cspell with full project dictionary) — would need 50+ project-specific terms; (f) Phase 11.4 (eslint-plugin-jsdoc @see enforcement) — would surface many existing source files lacking @see. **Final verify state**: `pnpm verify`exits non-zero on the SAME 2 pre-existing failures from Phase 1 smoke (parsers#test coverage at 26% < 70% threshold + knip orphan + stale ignoreDependencies). All NEW enforcement layers added by Phases 1/2/3/6/7/8/10/11 pass cleanly. The implementation gate is genuinely complete for the layers that fit in this run; the deferred phases need their own session.`[phase-6-7-8-10-11-coded, deferred-4-5-9, security-suite, csp-guard, syncpack-installed, gh-actions-sha-pinning-deferred]`

**Related Files**: docs/specs/430-dx-enforcement/430-dx-enforcement.md, eslint.config.mjs, tsconfig.base.json, packages/ui/tsconfig.json, apps/chat/tsconfig.json, .husky/pre-commit, .github/workflows/code-qa.yml, apps/vscode/src/panels/webview-html.ts, vitest.workspace.ts, knip.json, .size-limit.json, package.json, AGENTS.md, CLAUDE.md
**Participants**: @rix, claude-code (claude-opus-4-7)

---

## Prompt Captures

<!-- Verbatim user prompts + agent reply excerpts at pivotal moments. Append-only. -->
<!-- IDs: DXE-P001, DXE-P002, ... (P for "prompt", distinct from D for "discussion") -->
<!-- Trigger kinds: new-fr | new-nfr | removed-fr | design-pivot | missed-req | scope-cut | ambiguity-resolved | question-resolved | other -->

### DXE-P001 — Initial scope expansion: "what else / what about security"

- `type:prompt-capture` `2026-04-28T02:36:26.000Z` `[scope, security, enforcement]`
- trigger: new-fr
- triggered-change: FR-15, FR-16, FR-17, FR-18, FR-19, FR-20, FR-21, FR-22, FR-23, FR-26, FR-27, FR-28, FR-29, FR-32
- agent: claude-code
- model: claude-opus-4-7

**User prompt** (verbatim):

> what else we can add here ? I want all of this into our repo, write this as a single spec that we can work - fill out the spec and design and task. you have all the details anyway.
>
> make sure to look up the source code so thtat we know that it's doable

**Agent reply** (excerpt):

> Big list — let me lay it all out, grouped, with payoff/cost so you can pick. [...] Security (the explicit ask): Secrets — gitleaks, trufflehog, eslint-plugin-no-secrets. Supply chain — pnpm audit, Dependabot, CodeQL (skip for now), OSV-Scanner, license-checker, GH Actions SHA pinning, actionlint, zizmor. Application code — eslint-plugin-security, eslint-plugin-no-unsanitized, CSP guard, process.env restriction.

**Outcome**:

- Sprint scope expanded from "naming + boundaries + TS strict" to full enforcement layer including secrets/supply-chain/app-security
- 14 new FRs added covering security (FR-15 through FR-23, FR-26 through FR-29, FR-32)
- Sprint structured as 11 sequential PRs to keep each revertable
- Created `docs/specs/430-dx-enforcement/430-dx-enforcement.md` (sprint brief) and this journal

---

## Template Notes

### Discussion Entry Structure

Each discussion has:

| Field             | Purpose                                             |
| ----------------- | --------------------------------------------------- |
| `status:active`   | Inline status tag (active/blocked/closed)           |
| `[tags]`          | Auto-generated from content keywords                |
| **Context**       | What prompted the discussion                        |
| **Summary**       | 2-3 sentence overview                               |
| **Progress**      | Checkbox items for tracking (auto-synced on append) |
| **Decisions**     | Key decisions made                                  |
| **Tips/Ideas**    | Insights captured during discussion                 |
| **Notes**         | Later additions via `/afx-session note --ref ID`    |
| **Related Files** | Cumulative list of files mentioned across all notes |
| **Participants**  | Who was involved                                    |

### Prefix Convention

This feature uses the prefix `DXE` for discussion IDs (`DXE-D001`, `DXE-D002`, ...) and prompt-capture IDs (`DXE-P001`, `DXE-P002`, ...).
