---
afx: true
type: DESIGN
status: Living
owner: "@rixrix"
version: "1.1"
created_at: "2026-04-26T04:32:48.000Z"
updated_at: "2026-05-17T09:04:20.000Z"
tags: ["ci", "code-qa", "pr-gate", "lint", "types", "e2e", "traceability"]
spec: spec.md
---

# CI Code QA — Technical Design

---

## [DES-OVR] Overview

`code-qa.yml` runs on every PR to `main`. Eight jobs execute in parallel after a shared `build` step: lint, types, unit, e2e-webview, e2e-vscode (matrix), bundle-size, and pr-title. All must pass before merge. The workflow sets `concurrency` to cancel superseded runs on the same PR branch.

---

## [DES-ARCH] Architecture

```text
.github/workflows/code-qa.yml
  trigger: pull_request → main (opened, synchronize, reopened)
  concurrency: cancel-in-progress per PR branch

  jobs:
    build       → pnpm install + pnpm build  (shared artifact)
    lint        → pnpm lint                  (ESLint + markdownlint + knip)
    types       → pnpm check-types           (tsc --noEmit across workspace)
    unit        → pnpm test                  (Vitest workspace, V8 coverage)
    e2e-webview → pnpm --filter apps/chat test:e2e  (Playwright, Chromium)
    e2e-vscode  → matrix [ubuntu-latest, windows-latest]
                  pnpm --filter apps/vscode-e2e test  (vscode-test-electron)
    bundle-size → pnpm size-limit            (apps/chat bundle budget)
    pr-title    → action: amannn/action-semantic-pull-request
```

### [DES-CI-CODE-QA-JOB-GRAPH] Job Dependency Graph

```text
build ──────► lint
         ├──► types
         ├──► unit
         ├──► e2e-webview
         ├──► e2e-vscode (matrix)
         ├──► bundle-size
         └──► pr-title (independent, no build artifact needed)
```

---

## [DES-DEC] Key Decisions

| Decision            | Options Considered              | Choice                                | Rationale                                                        |
| ------------------- | ------------------------------- | ------------------------------------- | ---------------------------------------------------------------- |
| Job parallelism     | Sequential, parallel            | Parallel after shared build           | Total runtime < 15 min; build output shared via `actions/cache`  |
| e2e-vscode matrix   | Ubuntu only, full matrix        | ubuntu + windows                      | Extension must work on both; Windows catches path separator bugs |
| PR title validation | commitlint in CI, GitHub Action | `amannn/action-semantic-pull-request` | Dedicated action; PR title drives release-please CHANGELOG entry |
| Concurrency         | No cancel, cancel-in-progress   | cancel-in-progress                    | Avoids wasted runner time on push-to-fix cycles                  |

---

## [DES-FILES] File Structure

| File                            | Purpose                          |
| ------------------------------- | -------------------------------- |
| `.github/workflows/code-qa.yml` | Full PR gate workflow definition |

---

## [DES-DEPS] Dependencies

| Action / Tool                         | Purpose                                             |
| ------------------------------------- | --------------------------------------------------- |
| `actions/checkout`                    | Clone repo                                          |
| `actions/setup-node`                  | Node.js setup with pnpm cache                       |
| `pnpm/action-setup`                   | pnpm install                                        |
| `amannn/action-semantic-pull-request` | PR title Conventional Commit validation             |
| `actions/cache`                       | Cache `node_modules` and Turbo outputs between jobs |

---

## [DES-SEC] Security Considerations

- Workflow uses `pull_request` trigger (not `pull_request_target`) — no secrets exposed to fork PRs
- No write permissions granted to CI jobs (read-only GITHUB_TOKEN)

---

## [DES-ERR] Error Handling

| Scenario                          | Handling                                                 |
| --------------------------------- | -------------------------------------------------------- |
| Any job fails                     | PR merge blocked; GitHub status check reports failed job |
| e2e-vscode matrix partial failure | Individual matrix leg fails; other legs continue         |
| bundle-size over limit            | Job fails with size delta report; merge blocked          |

---

## [DES-TEST] Testing Strategy

The workflow itself is validated by the PR process — any syntax error in the YAML surfaces as a workflow parse failure visible in the Actions tab.

---

## [DES-ROLLOUT] Migration / Rollout Plan

### [DES-CI-CODE-QA-ROLLOUT-JOB] Phase 1: Add a new CI job

1. Add job definition to `code-qa.yml` with `needs: [build]`
2. Test by opening a draft PR and observing the new job
3. Add job name to branch protection required checks

### [DES-CI-CODE-QA-ROLLOUT-ROLLBACK] Rollback Plan

Remove the job from `code-qa.yml`. Branch protection required checks must be updated to remove the job reference — otherwise PRs will be permanently blocked.

---

## [DES-CI-CODE-QA-LOC] Code Locator Map

| CI surface           | Source anchor                                               | Design node                                |
| -------------------- | ----------------------------------------------------------- | ------------------------------------------ |
| PR gate workflow     | `.github/workflows/code-qa.yml`                             | `[DES-ARCH]`, `[DES-CI-CODE-QA-JOB-GRAPH]` |
| Local equivalent     | `package.json` `verify:full`                                | `[DES-ARCH]`                               |
| Commit/PR title rule | `.github/workflows/code-qa.yml` `pr-title` job              | `[DES-DEC]`                                |
| Quality jobs         | `pnpm check:lint`, `check:format`, `check:md`, `check:knip` | `410-dx-quality/design.md`                 |

---

## [DES-CI-CODE-QA-REFS] File Reference Map

| Task | File                            | Required @see                                             |
| ---- | ------------------------------- | --------------------------------------------------------- |
| —    | `.github/workflows/code-qa.yml` | `spec.md [FR-1]` + `design.md [DES-CI-CODE-QA-JOB-GRAPH]` |
