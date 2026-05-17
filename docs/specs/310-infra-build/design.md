---
afx: true
type: DESIGN
status: Living
owner: "@rixrix"
version: "1.1"
created_at: "2026-04-26T04:32:48.000Z"
updated_at: "2026-05-17T09:04:20.000Z"
tags: ["infra", "build", "turbo", "esbuild", "vite", "tsconfig", "traceability"]
spec: spec.md
---

# Build System — Technical Design

---

## [DES-OVR] Overview

Turbo orchestrates the task graph across all workspace packages and apps. The extension host (`apps/vscode`) is bundled with esbuild for Node.js target; both webview apps (`apps/chat`, `apps/workbench`) are built with Vite 5. A shared `tsconfig.base.json` enforces uniform TypeScript compiler options.

---

## [DES-ARCH] Architecture

### [DES-INFRA-BUILD-SYSTEM-CONTEXT] System Context

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

### [DES-INFRA-BUILD-TURBO-GRAPH] Turbo Task Graph

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

## [DES-BUILD-TOPOLOGY] Bundle Topology

What code goes into which bundle. With size-limit gates, this matters.

```text
+--------------------------------------------------------------------+
| Extension host bundle (apps/vscode/out/extension.js, esbuild)      |
| - extension.ts entry                                               |
| - panels/, providers/, services/, utils/                           |
| - imports: @afx/shared, @afx/transport (vscode adapter),           |
|            @afx/parsers, @afx/agent-pi, vscode API                 |
| - excludes: React, browser-only code                               |
+--------------------------------------------------------------------+
| Chat webview bundle (apps/chat/dist/, Vite)                        |
| - index.tsx entry, app.tsx, views/, components/, lib/, hooks/      |
| - imports: @afx/ui, @afx/shared, @afx/transport (mock+vscode),     |
|            React, lucide-react                                     |
| - excludes: vscode API, fs, process                                |
+--------------------------------------------------------------------+
| Workbench webview bundle (apps/workbench/dist/, Vite)              |
| - index.tsx entry, app.tsx, views/, lib/, context/                 |
| - imports: @afx/ui, @afx/shared, @afx/transport (mock+vscode),     |
|            React                                                   |
| - excludes: vscode API, fs, process                                |
+--------------------------------------------------------------------+
| Resources (apps/vscode/resources/, copied)                         |
| - pi-sdk/ bundled SDK payload                                      |
| - icons, themes                                                    |
+--------------------------------------------------------------------+
```

Architecture lints enforce the boundaries:

- `apps/vscode/src/no-pi-imports.test.ts` (extension host)
- `apps/chat/src/no-pi-imports.test.ts` (chat webview)
- `apps/vscode/src/panels/no-pi-imports.test.ts` (panel layer)
- ESLint `no-restricted-imports` rules in shared/ui packages forbid VSCode/Node APIs

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

### [DES-INFRA-BUILD-TEST-UNIT] Unit Tests

Build system config is not unit-tested. Correctness verified by successful build output and CI green.

### [DES-INFRA-BUILD-TEST-INTEGRATION] Integration Tests

`pnpm build` in CI serves as the integration test for the full build pipeline.

---

## [DES-ROLLOUT] Migration / Rollout Plan

### [DES-INFRA-BUILD-ROLLOUT-CONFIG] Phase 1: Config changes

1. Edit `turbo.json` task graph or `tsconfig.base.json`
2. Run `pnpm check-types && pnpm build`
3. Verify all app outputs under `out/` and `dist/`

### [DES-INFRA-BUILD-ROLLOUT-ROLLBACK] Rollback Plan

Revert config file. `turbo` caches prior successful builds — clean with `pnpm clean` if cache is stale.

---

## [DES-INFRA-BUILD-LOC] Code Locator Map

| Build surface            | Source anchor                   | Design node                        |
| ------------------------ | ------------------------------- | ---------------------------------- |
| Turbo task graph         | `turbo.json`                    | `[DES-INFRA-BUILD-TURBO-GRAPH]`    |
| Workspace roots          | `pnpm-workspace.yaml`           | `[DES-INFRA-BUILD-SYSTEM-CONTEXT]` |
| Shared TS config         | `tsconfig.base.json`            | `[DES-INFRA-BUILD-SYSTEM-CONTEXT]` |
| Extension host bundle    | `apps/vscode/esbuild.mjs`       | `[DES-INFRA-BUILD-SYSTEM-CONTEXT]` |
| Chat webview bundle      | `apps/chat/vite.config.ts`      | `[DES-INFRA-BUILD-SYSTEM-CONTEXT]` |
| Workbench webview bundle | `apps/workbench/vite.config.ts` | `[DES-INFRA-BUILD-SYSTEM-CONTEXT]` |

---

## [DES-INFRA-BUILD-REFS] File Reference Map

| Task | File                      | Required @see                                                   |
| ---- | ------------------------- | --------------------------------------------------------------- |
| —    | `apps/vscode/esbuild.mjs` | `spec.md [FR-2]` + `design.md [DES-INFRA-BUILD-SYSTEM-CONTEXT]` |
