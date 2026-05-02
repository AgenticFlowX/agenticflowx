---
afx: true
type: JOURNAL
status: Living
tags: [infra, build, turbo, esbuild, vite, tsconfig]
---

# Build System — Journal

## Discussion: pnpm workspace expansion for nested adapter packages (2026-04-26T08:15:14.000Z)

### Context

When `packages/agent/pi/` was extracted as `@afx/agent-pi` (ADR-0002), `pnpm-workspace.yaml` only declared `apps/*` and `packages/*`. The `packages/*` glob does not recurse into subdirectories, so `packages/agent/pi/` was not discovered as a workspace package. `pnpm install` would not link `@afx/agent-pi` as a workspace dep for consumers.

### Decision

Add `packages/agent/*` as a third entry in `pnpm-workspace.yaml`. This is the standard pnpm pattern for nested adapter packages; each future runtime adapter gets discovered automatically without further changes to the workspace file.

`vitest.workspace.ts` was also updated to include `packages/agent/pi/vitest.config.ts` so the agent-pi package participates in the workspace-level test run (`pnpm test`).

### Links

- FR-5 updated, FR-6 added to `spec.md` (v1.1)
- Related: ADR-0002, `300-infra-pi` Phase 3

---

## Implementation complete (2026-04-26T11:35:05.000Z)

Phase 2 tasks shipped. `pnpm-workspace.yaml` and `vitest.workspace.ts` updated. `pnpm install` resolves `@afx/agent-pi` as a workspace package. `pnpm test` runs 11 test files (56 tests) including the `agent-pi` suite with `passWithNoTests: true`.
