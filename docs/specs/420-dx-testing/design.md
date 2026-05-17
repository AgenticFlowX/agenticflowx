---
afx: true
type: DESIGN
status: Living
owner: "@rixrix"
version: "1.1"
created_at: "2026-04-26T04:32:48.000Z"
updated_at: "2026-05-17T14:35:46.000Z"
tags: ["dx", "testing", "vitest", "playwright", "vscode-test", "traceability"]
spec: spec.md
---

# DX Testing — Technical Design

---

## [DES-OVR] Overview

Three test surfaces require three distinct runners: Vitest for package unit tests (Node.js, V8 coverage), Playwright for the `apps/chat` webview (Chromium headless), and `@vscode/test-electron` for `apps/vscode-e2e` extension host tests (full VSCode process). Each runner has its own config and process isolation.

---

## [DES-ARCH] Architecture

```text
vitest.workspace.ts
  → project: packages/shared      (vitest unit)
  → project: packages/transport   (vitest unit)
  → project: packages/parsers     (vitest unit)
  → project: packages/ui          (vitest unit)
  → coverage provider: v8 → coverage/

apps/chat/
  playwright.config.ts
  e2e/chat.spec.ts              → Playwright, Chromium only

apps/vscode-e2e/
  src/extension.test.ts         → TypeScript extension host tests
  out/extension.test.js         → compiled tests consumed by @vscode/test-cli
  .vscode-test.mjs              → electron test runner config
```

### [DES-DX-TESTING-RUNNER-ISOLATION] Runner Isolation

```text
vitest      → Node.js, in-process (per project config)
playwright  → spawns Chromium subprocess, tests run in browser context
vscode-e2e  → compiles tests, spawns full VSCode Electron process, extension loaded, tests run in extension host
```

---

## [DES-DEC] Key Decisions

| Decision          | Options Considered                    | Choice             | Rationale                                                                   |
| ----------------- | ------------------------------------- | ------------------ | --------------------------------------------------------------------------- |
| Unit runner       | Jest, Vitest, Mocha                   | Vitest workspace   | Native ESM, fast, shared config with Vite builds                            |
| Webview E2E       | Cypress, Playwright                   | Playwright         | Chromium-only install keeps CI image lean; `@playwright/test` fixture model |
| VSCode E2E runner | Manual `runTests`, `@vscode/test-cli` | `@vscode/test-cli` | Official CLI; handles Electron download, test discovery, reporter           |
| Coverage provider | istanbul, V8                          | V8                 | Built into Node.js; no transform overhead                                   |

---

## [DES-FILES] File Structure

| File                                    | Purpose                                     |
| --------------------------------------- | ------------------------------------------- |
| `vitest.workspace.ts`                   | Vitest workspace project definitions        |
| `apps/chat/playwright.config.ts`        | Playwright config (Chromium only, base URL) |
| `apps/chat/e2e/chat.spec.ts`            | Playwright tests for chat webview           |
| `apps/vscode-e2e/src/extension.test.ts` | VSCode extension host E2E test source       |
| `apps/vscode-e2e/out/extension.test.js` | Generated CommonJS test loaded by VSCode    |
| `apps/vscode-e2e/.vscode-test.mjs`      | `@vscode/test-cli` runner config            |

---

## [DES-DEPS] Dependencies

| Package                 | Purpose              |
| ----------------------- | -------------------- |
| `vitest`                | Unit test runner     |
| `@vitest/coverage-v8`   | V8 coverage provider |
| `@playwright/test`      | Webview E2E tests    |
| `@vscode/test-cli`      | VSCode E2E test CLI  |
| `@vscode/test-electron` | Electron test runner |

---

## [DES-SEC] Security Considerations

- Playwright runs in a sandboxed Chromium subprocess — no host file access
- `@vscode/test-electron` downloads a pinned VSCode version — verify download integrity via checksum in lockfile

---

## [DES-ERR] Error Handling

| Scenario                             | Handling                                                                |
| ------------------------------------ | ----------------------------------------------------------------------- |
| Vitest test failure                  | Non-zero exit; failing test + stack trace printed                       |
| Playwright browser not installed     | Error: "Chromium not found"; fix with `npx playwright install chromium` |
| VSCode Electron download fails in CI | `@vscode/test-electron` throws; CI step fails with network error        |

---

## [DES-TEST] Testing Strategy

The test infrastructure itself is validated by running the full test suite in CI on every PR (`code-qa.yml`). A failing test runner config fails the corresponding CI job.

---

## [DES-ROLLOUT] Migration / Rollout Plan

### [DES-DX-TESTING-ROLLOUT-UNIT] Phase 1: Add a new unit test

1. Create `*.test.ts` file in target package `src/`
2. Run `pnpm test` — Vitest picks it up automatically

### [DES-DX-TESTING-ROLLOUT-E2E] Phase 2: Add a new E2E test

1. Add `*.spec.ts` to `apps/chat/e2e/` (Playwright) **or** `*.test.ts` to `apps/vscode-e2e/src/` (vscode-test-electron has no `.spec` convention; see docs/specs/430-dx-enforcement/430-dx-enforcement.md [FR-5])
2. Run the appropriate runner (`pnpm --filter apps/chat test:e2e` or `pnpm --filter apps/vscode-e2e test:e2e`)

### [DES-DX-TESTING-ROLLOUT-ROLLBACK] Rollback Plan

Remove or skip the test file. The runner skips missing test files gracefully.

---

## [DES-DX-TESTING-LOC] Code Locator Map

| Test surface               | Source anchor                                                           | Design node                                           |
| -------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------- |
| Vitest workspace           | `vitest.workspace.ts`, `vitest.config.ts`                               | `[DES-DX-TESTING-RUNNER-ISOLATION]`                   |
| Package unit config        | `packages/*/vitest.config.ts`, `apps/*/vitest.config*.ts`               | `[DES-DX-TESTING-RUNNER-ISOLATION]`                   |
| Chat/workbench browser E2E | `apps/chat/playwright.config.ts`, `apps/workbench/playwright.config.ts` | `[DES-DX-TESTING-RUNNER-ISOLATION]`                   |
| VSCode extension E2E       | `apps/vscode-e2e/.vscode-test.mjs`, `apps/vscode-e2e/src/*.test.ts`     | `[DES-DX-TESTING-RUNNER-ISOLATION]`                   |
| CI enforcement             | `.github/workflows/code-qa.yml`                                         | `500-ci-code-qa/design.md [DES-CI-CODE-QA-JOB-GRAPH]` |

---

## [DES-DX-TESTING-REFS] File Reference Map

| Task | File                                    | Required @see                       |
| ---- | --------------------------------------- | ----------------------------------- |
| —    | `vitest.workspace.ts`                   | config only — no annotation needed  |
| —    | `apps/chat/e2e/chat.spec.ts`            | test file — no annotation needed    |
| —    | `apps/vscode-e2e/src/extension.test.ts` | `420-dx-testing` + covered app spec |
