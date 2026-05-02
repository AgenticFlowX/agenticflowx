---
afx: true
type: DESIGN
status: Approved
owner: "@rixrix"
version: "1.0"
created_at: "2026-04-26T04:32:48.000Z"
updated_at: "2026-04-28T01:37:40.000Z"
tags: [infra, build, turbo, esbuild, vite, tsconfig]
spec: spec.md
---

# Build System — Technical Design

---

## [DES-OVR] Overview

Turbo orchestrates the task graph across all workspace packages and apps. The extension host (`apps/vscode`) is bundled with esbuild for Node.js target; both webview apps (`apps/chat`, `apps/workbench`) are built with Vite 5. A shared `tsconfig.base.json` enforces uniform TypeScript compiler options.

---

## [DES-ARCH] Architecture

### System Context

```text
turbo.json                  ← task graph (build, dev, check-types, lint, clean)
tsconfig.base.json          ← shared TS options (strict, moduleResolution: bundler)
pnpm-workspace.yaml         ← workspace roots: apps/*, packages/*

apps/vscode/
  esbuild.mjs               ← extension host bundler (node, cjs, external: vscode)
  tsconfig.json             ← extends ../../tsconfig.base.json

apps/chat/
  vite.config.ts            ← webview bundler (browser, react, @tailwindcss/vite)

apps/workbench/
  vite.config.ts            ← webview bundler (browser, react, @tailwindcss/vite)
```

### Turbo Task Graph

```text
build
  packages/shared    → tsc --noEmit (type-check only, no emit needed)
  packages/transport → tsc --noEmit
  packages/parsers   → tsc --noEmit
  packages/ui        → tsc --noEmit
  apps/vscode        → node esbuild.mjs  → out/
  apps/chat          → vite build        → dist/
  apps/workbench     → vite build        → dist/
```

---

## [DES-DEC] Key Decisions

| Decision               | Options Considered                            | Choice                                 | Rationale                                                                          |
| ---------------------- | --------------------------------------------- | -------------------------------------- | ---------------------------------------------------------------------------------- |
| Extension host bundler | tsc, webpack, esbuild                         | esbuild                                | Fast, single-file output, external: vscode keeps bundle lean                       |
| Webview bundler        | webpack, parcel, vite                         | Vite 5                                 | Native ESM dev server, Tailwind 4 plugin (`@tailwindcss/vite`), minimal config     |
| tsconfig strategy      | Per-package full config, path alias re-export | Shared base + per-package extends      | Single place for strict/moduleResolution changes; packages only override `include` |
| Package types          | Emit `.js` + `.d.ts`, path aliases only       | Path aliases via Vite + `tsc --noEmit` | UI and shared packages are consumed by type aliases — no runtime emit step needed  |

---

## [DES-FILES] File Structure

| File                            | Purpose                                                                            |
| ------------------------------- | ---------------------------------------------------------------------------------- |
| `turbo.json`                    | Task graph, pipeline dependencies, cache outputs                                   |
| `tsconfig.base.json`            | Shared compiler options (`strict`, `moduleResolution: bundler`, `jsx: react-jsx`)  |
| `pnpm-workspace.yaml`           | Workspace glob: `apps/*`, `packages/*`                                             |
| `apps/vscode/esbuild.mjs`       | esbuild config: `entryPoints`, `outfile`, `external: ['vscode']`, `platform: node` |
| `apps/chat/vite.config.ts`      | Vite config: React plugin, Tailwind 4 plugin, path aliases                         |
| `apps/workbench/vite.config.ts` | Vite config: React plugin, Tailwind 4 plugin, path aliases                         |

---

## [DES-DEPS] Dependencies

| Package                | Purpose                        |
| ---------------------- | ------------------------------ |
| `turbo`                | Task orchestration and caching |
| `esbuild`              | Extension host bundling        |
| `vite`                 | Webview bundling + dev server  |
| `@vitejs/plugin-react` | JSX transform for Vite         |
| `@tailwindcss/vite`    | Tailwind 4 Vite integration    |
| `typescript`           | Type checking (`tsc --noEmit`) |

---

## [DES-SEC] Security Considerations

- Extension host bundle sets `external: ['vscode']` — VSCode API is never bundled, preventing version conflicts
- No eval or dynamic require in build scripts

---

## [DES-ERR] Error Handling

| Scenario                  | Handling                                                          |
| ------------------------- | ----------------------------------------------------------------- |
| Type error in any package | `pnpm check-types` fails; Turbo reports which package task failed |
| esbuild error             | Non-zero exit; error printed to stdout with file and line         |
| Vite build error          | Non-zero exit; full stack trace with module resolution details    |

---

## [DES-TEST] Testing Strategy

### Unit Tests

Build system config is not unit-tested. Correctness verified by successful build output and CI green.

### Integration Tests

`pnpm build` in CI serves as the integration test for the full build pipeline.

---

## [DES-ROLLOUT] Migration / Rollout Plan

### Phase 1: Config changes

1. Edit `turbo.json` task graph or `tsconfig.base.json`
2. Run `pnpm check-types && pnpm build`
3. Verify all app outputs under `out/` and `dist/`

### Rollback Plan

Revert config file. `turbo` caches prior successful builds — clean with `pnpm clean` if cache is stale.

---

## File Reference Map

| Task | File                      | Required @see                             |
| ---- | ------------------------- | ----------------------------------------- |
| —    | `apps/vscode/esbuild.mjs` | `spec.md [FR-2]` + `design.md [DES-ARCH]` |
