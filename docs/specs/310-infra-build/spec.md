---
afx: true
type: SPEC
status: Approved
owner: "@rixrix"
version: "1.2"
created_at: "2026-04-26T04:32:48.000Z"
updated_at: "2026-05-01T23:04:01.000Z"
tags: [infra, build, turbo, esbuild, vite, tsconfig]
---

# Build System — Product Specification

## References

- **Architecture**: [AGENTS.md — Current stack](../../../AGENTS.md)

---

## Problem Statement

The monorepo contains a Node.js extension host and browser-target React webviews. These require different bundlers (esbuild vs Vite) with separate configs, orchestrated consistently by Turbo.

---

## Requirements

### Functional Requirements

| ID   | Requirement                                                                                                                                                                                                                                               | Priority  |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| FR-1 | Turbo orchestrates build, dev, check-types, lint, test, knip, clean across all packages                                                                                                                                                                   | Must Have |
| FR-2 | esbuild bundles `apps/vscode` for Node.js target with externals for native modules                                                                                                                                                                        | Must Have |
| FR-3 | Vite 5 builds `apps/chat` and `apps/workbench` for browser target                                                                                                                                                                                         | Must Have |
| FR-4 | `tsconfig.base.json` provides shared TypeScript strict config inherited by all packages                                                                                                                                                                   | Must Have |
| FR-5 | pnpm workspaces declare `apps/*`, `packages/*`, and `packages/agent/*`                                                                                                                                                                                    | Must Have |
| FR-6 | `@mariozechner/pi-coding-agent` does not appear in the `apps/vscode` bundle (it is a devDependency of `@afx/agent-pi`, used only for type imports, and never reached from the extension entry; explicit esbuild externalization is therefore unnecessary) | Must Have |

### Non-Functional Requirements

| ID    | Requirement                                                            | Target                                                          |
| ----- | ---------------------------------------------------------------------- | --------------------------------------------------------------- |
| NFR-1 | Turbo caches build outputs in `.turbo/`                                | Enabled by default                                              |
| NFR-2 | Extension host bundle excludes `@mariozechner/pi-coding-agent` runtime | Verified via bundle inspection (devDep + type-only import path) |

---

## Non-Goals

- No Webpack or Rollup
- No SSR or server-side builds

---

## Dependencies

- `turbo` (build orchestration)
- `esbuild` (`apps/vscode` bundler)
- `vite` (`apps/chat`, `apps/workbench` bundler)
