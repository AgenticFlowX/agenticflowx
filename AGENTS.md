# AGENTS.md

Operating instructions for coding agents working in this repository.

## Project identity

- Project: `agenticflowx`
- Purpose: VSCode extension monorepo for AgenticFlowX (AFX)
- Package manager: `pnpm@10.32.1`
- Build orchestration: Turbo
- Language: TypeScript throughout
- Runtime targets:
  - `apps/vscode`: VSCode extension host, Node.js target, bundled with esbuild
  - `apps/chat`: VSCode side panel webview, browser target, React + Vite
  - `apps/workbench`: VSCode bottom panel webview, browser target, React + Vite

## Current stack

Root:

- pnpm workspaces via `pnpm-workspace.yaml`
- Turbo via `turbo.json`
- Shared TypeScript base config in `tsconfig.base.json`

Apps:

- `apps/vscode`
  - TypeScript
  - esbuild
  - `@types/vscode`
  - output: `out/`
- `apps/chat`
  - React 18
  - Vite 5
  - Tailwind 4 via `@tailwindcss/vite`
  - output: `dist/`
- `apps/workbench`
  - React 18
  - Vite 5
  - Tailwind 4 via `@tailwindcss/vite`
  - output: `dist/`

Packages:

- `packages/ui` → `@afx/ui`
  - Shared UI primitives, composites, design system
  - Meridian tokens at `src/tokens/meridian.css`
  - No standalone build step; consumed directly through TypeScript/Vite path aliases
- `packages/shared` → `@afx/shared`
  - Shared types, constants, message protocol
  - Structured `Logger` contract: leveled (silent..trace), scoped child loggers, lazy callbacks, pluggable sinks (see ADR-0003)
  - Pure TypeScript
- `packages/parsers` → `@afx/parsers`
  - Markdown/frontmatter/spec/task/journal parsers
  - Pure TypeScript
  - Uses `gray-matter`
- `packages/transport` → `@afx/transport`
  - Transport abstraction (VSCode postMessage, mock with 13 scenarios)
  - Enables browser-based dev loop without VSCode
  - Pure TypeScript + React-free
- `packages/agent/pi` → `@afx/agent-pi`
  - Pi coding-agent adapter — RPC transport (subprocess JSONL)
  - Implements `AgentManager` from `@afx/shared`
  - Node.js only — no VSCode imports; config injected via `PiRpcManagerOptions`
  - Naming is transport-explicit (`rpc-client.ts`, `rpc-manager.ts`)

## Commands

Run commands from the repository root unless noted.

```bash
pnpm install
pnpm check:types
pnpm build
pnpm dev
pnpm check:lint
pnpm clean
```

Useful package-specific commands:

```bash
pnpm --filter "./apps/vscode" build
pnpm --filter "apps/chat" build
pnpm --filter "apps/workbench" build
pnpm --filter "apps/chat" dev
pnpm --filter "apps/workbench" dev
```

Turbo filters use package names such as `apps/chat` and `apps/workbench`; use the path filter
`./apps/vscode` for the extension host because its package name is `agenticflowx`.

## Verification

> **Canonical commands** (see `docs/specs/430-dx-enforcement/430-dx-enforcement.md` [FR-1] [FR-2] [FR-34] [DES-API]).
> Replaces the legacy `ci` / `health` / `health:full` script trio.

### Two-tier verification surface

```text
pnpm verify         Fast lifecycle (~30–90s on M-series, warm cache).
                    Runs in parallel via turbo --continue (full failure list, not fail-fast):
                      check:types · check:lint · check:format · check:md · check:knip · test
                    Pre-push hook also runs this.
                    Use after every change.

pnpm verify:full    Full PR lifecycle. Runs `verify` then build + size-limit + e2e (chat + vscode).
                    What CI runs.
                    Use before merging.
```

### The verify → fix → verify loop

```text
pnpm verify         If it fails on auto-fixable issues …
pnpm fix            … runs prettier + markdownlint --fix + eslint --fix in that order.
pnpm verify         Re-run. Anything still failing is a real issue you must address.
```

`pnpm fix` does NOT auto-resolve:

- TypeScript type errors (`check:types` failures need code changes).
- ESLint architecture-boundary violations (`no-restricted-imports`).
- Missing `@see` JSDoc anchors required by spec-driven files.
- Coverage threshold breaches (need new tests, not formatting).
- Conventional Commit / commitlint failures (handled by `commit-msg` hook, not lint).

These remain `pnpm verify` failures and require human or LLM judgement.

### Targeted checks (when the full suite is overkill)

For one-off, in-flight work it's still fine to run the underlying scripts directly:

- Type-only changes: `pnpm check:types`
- Single app/package: `pnpm --filter "apps/chat" build` etc.
- Markdown only: `pnpm check:md` (or `pnpm check:md:fix` to auto-fix)

But **never report a task complete without running `pnpm verify` and reading the output.**

## Commit log conventions

Commit headers must follow `type(scope): imperative summary`, with a mandatory scope from `scripts/generate-scope-enum.mjs`. For non-trivial commits, use the AFX body shape from `.gitmessage` and `docs/specs/400-dx-conventions/`:

```text
Why:
- What problem this solves.

Changed:
- What changed, grouped by surface.

Spec:
- docs/specs/XXX-name/spec.md [FR-X]
- docs/specs/XXX-name/design.md [DES-X]

Traceability:
- @see retargeting, map IDs, generated artifacts, or none.

Verification:
- pnpm verify
```

Use `docs(spec)` for living spec/design/tasks-only changes, `docs(dx)` for convention updates, `feat`/`fix` only for behavior changes, and `refactor` only when behavior is intentionally unchanged. Call out generated or vendored artifacts explicitly in the commit body.

## Layout rules

Keep this layout intact:

```txt
apps/
  vscode/
  chat/
  workbench/
packages/
  ui/
  parsers/
  shared/
  transport/
  agent/
    pi/
```

Rules:

- `chat` and `workbench` must live under `apps/`.
- Do not create root-level `chat/` or `workbench/` directories.
- Do not modify files under `packages/ui/src/`; treat Shadcn primitives/components there as read-only.
- Agent adapters live under `packages/agent/<runtime>/` and must not import `vscode`.
- Do not move shared UI into app folders.
- Do not make `apps/vscode` depend on browser-only packages.
- Do not make `packages/parsers` or `packages/shared` depend on React.

## Architecture boundaries

### `apps/vscode`

Extension host only.

Allowed:

- VSCode API integration
- command registration
- webview provider registration
- status bar wiring
- loading webview build output
- reading VSCode config and injecting values into `@afx/agent-pi` factory

Forbidden:

- React UI code
- engine implementation (lives in `packages/agent/*`)
- cloud/auth/telemetry integrations unless explicitly requested
- importing any adapter-specific type (use `AgentManager` from `@afx/shared`)

### `apps/chat`

Side panel webview only.

Allowed:

- React views for Chat, Explorer, History, Settings
- VSCode webview message bridge via `@afx/transport`
- imports from `@afx/ui`, `@afx/shared`, `@afx/transport`
- Mock transport + DevOverlay for browser-based development

Forbidden:

- VSCode extension host API usage
- engine implementation
- filesystem/process access

### `apps/workbench`

Bottom panel webview only.

Allowed:

- React views for Workbench, Pipeline, Documents, Analytics, Journal, Board, Notes
- VSCode webview message bridge stubs
- imports from `@afx/ui` and `@afx/shared`

Forbidden:

- VSCode extension host API usage
- engine implementation
- filesystem/process access

### `packages/ui`

Shared UI only.

Allowed:

- React components
- CSS tokens
- UI-only helpers such as `cn()`

Forbidden:

- VSCode API usage
- parser implementation logic
- engine implementation
- app-specific state machines

### `packages/shared`

Shared types/protocol/constants only.

Forbidden:

- React
- VSCode API
- Node filesystem/process APIs
- parser implementation logic

### `packages/parsers`

Pure parser utilities only.

Forbidden:

- React
- VSCode API
- UI components
- engine implementation

### `packages/transport`

Transport abstraction only.

Allowed:

- `Transport` interface
- `createVscodeTransport()` — wraps VSCode webview `acquireVsCodeApi`
- `createMockTransport()` — 13 named scenarios for dev/test

Forbidden:

- React
- VSCode extension host API (only webview `acquireVsCodeApi` is permitted)
- engine implementation

## TypeScript and import conventions

- Source files must be TypeScript: `.ts` or `.tsx`.
- Do not author new `.js` source files under `src/`.
- Existing generated `.js` files under `src/` are artifacts and should not be edited as source.
- Prefer type-only imports where appropriate: `import type { X } from ...`.
- Browser apps use Vite aliases for `@afx/ui`, `@afx/ui/tokens`, `@afx/shared`, and `@afx/transport`.

## Generated files and artifacts

Do not edit generated artifacts manually:

- `node_modules/`
- `.turbo/`
- `apps/*/.turbo/`
- `apps/*/dist/`
- `apps/vscode/out/`
- `*.tsbuildinfo`
- generated `.js` files in `src/`

If generated files are stale, clean and regenerate them with package scripts.

## Logging conventions

Use the structured logger from `@afx/shared`. Do not call `output.appendLine`, `console.log/info/warn/error`, or invent local `log()` wrappers.

```typescript
import { type Logger, createLogger, outputChannelSink } from "@afx/shared";

// Extension entry creates the root once.
const logger = createLogger({ scope: "afx", level: "info", sinks: [outputChannelSink(channel)] });

// Modules accept Logger and derive a child for their scope.
const log = parentLogger.child("rpc-manager");
log.info("started");
log.debug(() => `expensive: ${JSON.stringify(payload)}`); // skipped if level > debug
log.error("send failed", err); // err.stack rendered by sink
```

**Rules:**

- **Scope**: `<package-or-module>:<subscope>` — e.g. `afx:rpc-manager`, `afx:chat:agent-event`. Use `child(name)` to derive sub-scopes.
- **Lazy callbacks** for any message that builds work (`JSON.stringify`, `.join`, error extraction): pass `() => ...` so the level gate skips the work.
- **Errors**: `log.error("message", err)` — sinks render the stack. Don't pre-format `err.message` into a template literal.
- **Levels**: `silent`, `error`, `warn`, `info`, `debug`, `trace`. Default is `info`. Override at runtime via VSCode setting `afx.logLevel` or env var `AFX_LOG_LEVEL`.
- **Webview/browser code** (`packages/transport`, `apps/chat/src/lib/bridge.ts`, `apps/workbench/src/lib/bridge.ts`) creates a module-level logger backed by `consoleSink()`. No host setting/env is read in the webview — defaults to `info`.

See ADR-0003 (`docs/adr/ADR-0003-structured-logger.md`) and the contract at `packages/shared/src/logger.ts`.

## Coding rules

- Make the smallest change that satisfies the request.
- Read files before editing them.
- Preserve this architecture boundary unless the user explicitly asks to change it.
- Do not introduce Next.js, cloud/auth/telemetry packages, MCP-specific code, Marketplace UI, Framer Motion, or engine implementation code unless explicitly requested.
- Do not do drive-by refactors.
- If a request conflicts with this architecture, stop and call out the conflict.

## Communication rules

- Be direct and concise.
- Do not claim a command passed unless you ran it and read the output.
- If there are multiple plausible interpretations, ask before editing.
- Summaries should list changed files and verification run.

---

## AFX Documentation Conventions

This repo uses **AFX spec-driven development**. All substantive changes are gated by a spec or ADR written before code is written.

### Change Gate

> **Rule**: any change to this repo that introduces new behaviour, modifies an existing feature, or affects architecture MUST start with a spec (feature work) or ADR (cross-cutting decision) in `docs/specs/` or `docs/adr/` **before** code is written.

Exploratory work and bug fixes under an existing spec are exempt. Anything that would require a new spec folder is not.

### AFX Frontmatter Schema

All AFX-managed files use YAML frontmatter. The `afx: true` marker identifies AFX-owned documents.

**Full schema (SPEC, DESIGN, TASKS):**

```yaml
---
afx: true
type: SPEC # SPEC | DESIGN | TASKS | JOURNAL | ADR | RES
status: Draft # Draft | Approved | Living | Accepted (ADR only)
owner: "@handle"
version: "1.0"
created_at: YYYY-MM-DDTHH:MM:SS.mmmZ # ISO 8601, millisecond precision
updated_at: YYYY-MM-DDTHH:MM:SS.mmmZ
tags: [feature, topic]
# DESIGN and TASKS only:
spec: spec.md
# TASKS only:
design: design.md
# Add after tags when cross-spec dependencies exist (SPEC only):
depends_on: [100-package-shared, 110-package-transport]
---
```

**Timestamp rule**: always run `date -u +"%Y-%m-%dT%H:%M:%S.000Z"` to get the current time. Never guess. Never use midnight (`T00:00:00.000Z`).

**YAML is the single source of truth** for status, version, date, owner, and cross-references. Do NOT duplicate these as `**Status:**`, `**Version:**`, `**Date:**`, or `**Author:**` lines in the markdown body.

### `@see` Traceability

Every `.ts` and `.tsx` source file that implements spec-driven behaviour MUST have a top-level JSDoc with dual `@see` links.

**Format:**

```typescript
/**
 * Brief description of what this file does.
 *
 * @see docs/specs/XXX-category-name/spec.md [FR-X]
 * @see docs/specs/XXX-category-name/design.md [DES-SECTION]
 */
```

**Node ID reference:**

| Syntax        | Meaning                                 |
| ------------- | --------------------------------------- |
| `[FR-X]`      | Functional requirement from spec.md     |
| `[NFR-X]`     | Non-functional requirement from spec.md |
| `[DES-OVR]`   | Overview section from design.md         |
| `[DES-ARCH]`  | Architecture section from design.md     |
| `[DES-API]`   | API contracts section from design.md    |
| `[DES-UI]`    | UI/UX section from design.md            |
| `[DES-DATA]`  | Data model section from design.md       |
| `[DES-FILES]` | File structure section from design.md   |
| `[DES-DEPS]`  | Dependencies section from design.md     |
| `[DES-SEC]`   | Security considerations from design.md  |

For cross-cutting files that implement two specs, add one `@see` line per spec.

Scripts (`.mjs`) and YAML workflows use inline comments: `// @see` and `# @see` respectively.

**Validation:** run `/afx-check trace <path>` to confirm no orphaned files.

### Spec Document Structure

Each feature has exactly three files scaffolded by `/afx-scaffold spec <name>`:

```text
docs/specs/XXX-category-name/
├── spec.md      # Requirements (WHAT)
├── design.md    # Architecture (HOW)
└── tasks.md     # Implementation log (WHEN — append-only Work Sessions table at end)
```

Never hand-craft these files. Use `/afx-scaffold spec <name>` — the VSCode workbench parser and `/afx-check` validate against the exact template structure.

---

## Spec Map

Canonical spec folders for this repository. Naming convention: 3-digit ranged numbering; child surface specs may use adjacent numbers inside a parent range for surgical routing.

```text
001        — overview (singleton)
100–199    — packages
200–299    — apps
300–399    — infra
400–499    — dx
500–599    — ci
```

| Folder                          | Covers                                                                        | Source                                     |
| ------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------ |
| `001-overview`                  | Project overview, spec-naming convention, architecture summary                | —                                          |
| `100-package-shared`            | `@afx/shared` — types, message protocol, constants                            | `packages/shared/`                         |
| `110-package-transport`         | `@afx/transport` — transport abstraction, VSCode adapter, mock (13 scenarios) | `packages/transport/`                      |
| `120-package-parsers`           | `@afx/parsers` — spec/tasks/journal/frontmatter parsers                       | `packages/parsers/`                        |
| `130-package-ui`                | `@afx/ui` — design system, Shadcn components, Meridian/Lyra themes            | `packages/ui/`                             |
| `200-app-vscode`                | Extension host — commands, webview providers, VSCode integration              | `apps/vscode/`                             |
| `210-app-chat`                  | Chat webview — message UI, streaming, tool calls, DevOverlay                  | `apps/chat/`                               |
| `220-app-workbench`             | Workbench webview parent — bottom-panel shell boundary and child routes       | `apps/workbench/`                          |
| `221-app-workbench-board`       | Workbench Board tab — markdown-backed Kanban boards                           | `apps/workbench/src/views/board.tsx`       |
| `222-app-workbench-documents`   | Workbench Documents tab — docs tree, reader, markdown helpers                 | `apps/workbench/src/views/documents.tsx`   |
| `223-app-workbench-journal`     | Workbench Journal tab — session timeline and preview                          | `apps/workbench/src/views/journal.tsx`     |
| `224-app-workbench-notes`       | Workbench Notes tab — capture, timeline, edit/delete, time labels             | `apps/workbench/src/views/notes.tsx`       |
| `225-app-workbench-pipeline`    | Workbench Pipeline tab — feature progress and next actions                    | `apps/workbench/src/views/pipeline.tsx`    |
| `226-app-workbench-analytics`   | Workbench Analytics tab — dashboard metrics and heatmap                       | `apps/workbench/src/views/analytics.tsx`   |
| `227-app-workbench-shell`       | Workbench shell — tabs, provider, bridge, feature 4-column tab                | `apps/workbench/src/`                      |
| `228-app-workbench-impact-lens` | Workbench Impact Lens — planned reverse traceability surface                  | `apps/workbench/src/views/impact-lens.tsx` |
| `300-infra-pi`                  | Pi RPC client — subprocess lifecycle, JSONL framing, lazy startup             | `packages/agent/pi/`                       |
| `310-infra-build`               | Build system — Turbo pipelines, esbuild, Vite, tsconfig.base                  | root config files                          |
| `320-infra-scripts`             | Scripts — dynamic commitlint scope-enum generation                            | `scripts/`                                 |
| `400-dx-conventions`            | DX conventions — commitlint, kebab-case, editorconfig, import order           | root config files                          |
| `410-dx-quality`                | DX quality — ESLint flat config, Prettier, markdownlint, knip, size-limit     | root config files                          |
| `420-dx-testing`                | Testing — Vitest workspace, Playwright (webview), vscode-test-electron (e2e)  | test config + e2e                          |
| `500-ci-code-qa`                | CI gate — PR lint/types/unit/e2e/bundle-size/pr-title jobs                    | `.github/workflows/code-qa.yml`            |
| `510-ci-release`                | CI release — release-please CHANGELOG + version bump                          | `.github/workflows/release-please.yml`     |
| `520-ci-publish`                | CI publish — build VSIX on release; attach to GitHub Release                  | `.github/workflows/build-vsix.yml`         |

**Dependency graph** (depends_on relationships):

```text
100-package-shared ──────────────────► 200-app-vscode
110-package-transport ───────────────► 200-app-vscode
300-infra-pi ────────────────────────► 200-app-vscode

100-package-shared ──────────────────► 210-app-chat
110-package-transport ───────────────► 210-app-chat
130-package-ui ──────────────────────► 210-app-chat

100-package-shared ──────────────────► 220-app-workbench
130-package-ui ──────────────────────► 220-app-workbench

400-dx-conventions ──────────────────► 410-dx-quality
400-dx-conventions ──────────────────► 320-infra-scripts

410-dx-quality ──────────────────────┐
420-dx-testing ──────────────────────┼──► 500-ci-code-qa
310-infra-build ─────────────────────┘

310-infra-build ─────────────────────► 510-ci-release
510-ci-release ──────────────────────► 520-ci-publish
```

<!-- AFX-CODEX:START - Managed by AFX. Do not edit manually. -->
<!-- AFX Version: 2.5.4 -->

## AgenticFlowX - AI Commands

This project uses **AgenticFlowX (AFX)**. Use the appropriate command format for your platform:

### Codex Skills

Use `afx-xxx` command names to run the matching AFX workflow:

- `afx-next`, `afx-discover`, `afx-design`, `afx-dev`, `afx-check`, `afx-task`, `afx-session`, `afx-scaffold`, `afx-adr`, `afx-context`, `afx-spec`, `afx-report`, `afx-help`, `afx-hello`.

### Gemini CLI Commands

Use `/afx-xxx` slash commands to run AFX workflows:

- `/afx-next`, `/afx-discover`, `/afx-design`, `/afx-dev`, `/afx-check`, `/afx-task`, `/afx-session`, `/afx-scaffold`, `/afx-adr`, `/afx-context`, `/afx-spec`, `/afx-report`, `/afx-help`, `/afx-hello`.

### GitHub Copilot Prompts

Use `afx-xxx` prompt files in `.github/agents/`:

- `afx-next`, `afx-discover`, `afx-design`, `afx-dev`, `afx-check`, `afx-task`, `afx-session`, `afx-scaffold`, `afx-adr`, `afx-context`, `afx-spec`, `afx-report`, `afx-help`, `afx-hello`.

### Timestamp Rule (ISO 8601)

All timestamps in AFX-generated documents — frontmatter (`created_at`, `updated_at`), inline metadata, journal entries, session captures — MUST use **ISO 8601 with millisecond precision**: `YYYY-MM-DDTHH:MM:SS.mmmZ` (e.g., `2025-12-17T14:30:00.000Z`). To get the current timestamp, run `date -u +"%Y-%m-%dT%H:%M:%S.000Z"` via shell. Never guess or use midnight (`T00:00:00.000Z`).

### Source of Truth

All agent platforms delegate to canonical skill definitions in:

- `skills/agenticflowx/` (canonical workflow skills)
- `.claude/skills/` (Claude Code skill target)
- `.agents/skills/` (Codex, Copilot, Antigravity skill target)
<!-- AFX-CODEX:END -->
