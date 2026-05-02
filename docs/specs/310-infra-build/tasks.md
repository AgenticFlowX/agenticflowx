---
afx: true
type: TASKS
status: Living
owner: "@rixrix"
version: "1.1"
created_at: "2026-04-26T04:32:48.000Z"
updated_at: "2026-04-28T01:37:40.000Z"
tags: [infra, build, turbo, esbuild, vite, tsconfig]
spec: spec.md
design: design.md
---

# Build System — Implementation Tasks

---

## Phase 1 — Initial build setup

- [x] `tsconfig.base.json` — shared strict TypeScript config inherited by all packages
- [x] `turbo.json` — orchestrates `build`, `dev`, `check-types`, `lint`, `test`, `knip`, `clean`
- [x] `apps/vscode` — esbuild bundle (Node.js target, externals for native modules)
- [x] `apps/chat` + `apps/workbench` — Vite 5 (browser target)
- [x] `pnpm-workspace.yaml` — `apps/*`, `packages/*`

## Phase 2 — Workspace expansion for nested adapter packages (ADR-0002)

- [x] Add `packages/agent/*` glob to `pnpm-workspace.yaml` (FR-5) — required for `@afx/agent-pi` discovery
- [x] Add `packages/agent/pi/vitest.config.ts` to `vitest.workspace.ts`
- [x] Confirm esbuild externals exclude `@mariozechner/pi-coding-agent` (FR-6) — now owned by `@afx/agent-pi` devDeps
- [x] Bump spec to v1.1, update FR-5 description, add FR-6
- [x] Verify: `pnpm install && pnpm build:vscode` — 3 Turbo tasks successful

---

## Work Sessions

<!-- IMPORTANT: This section MUST remain the LAST section in tasks.md. Do not add content below it. -->

| Date       | Task                                     | Action    | Files Modified                                                                               | Agent | Human |
| ---------- | ---------------------------------------- | --------- | -------------------------------------------------------------------------------------------- | ----- | ----- |
| 2026-04-26 | Phase 1 — scaffold                       | Completed | docs/specs/310-infra-build/ (scaffolded)                                                     | [x]   | []    |
| 2026-04-26 | Phase 2 — workspace expansion (ADR-0002) | Completed | pnpm-workspace.yaml (packages/agent/\* added), vitest.workspace.ts, spec.md (v1.1 FR-5/FR-6) | [x]   | []    |
