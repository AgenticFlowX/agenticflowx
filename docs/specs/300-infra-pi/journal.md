---
afx: true
type: JOURNAL
status: Living
tags: [infra, pi, rpc, subprocess, engine, adapter]
---

# Pi Engine Integration — Journal

## Discussion: packages/agent/pi extraction + AgentManager abstraction (2026-04-26T08:13:49.000Z)

### Context

The Pi integration was originally planned to live in `apps/vscode/src/engine/` as a bridge stub. During early implementation, it became clear that:

1. `pi-manager.ts` was tightly coupled to `vscode` — importing `vscode.workspace.getConfiguration`, `vscode.workspace.workspaceFolders`, and `vscode.Disposable` directly.
2. `sidebar-panel.ts` imported `PiManager` directly, making Pi the only possible agent runtime.
3. Future runtime swaps would require touching both the panel and the engine module — a sign of wrong abstraction boundaries.

### Decision

Extract Pi RPC into `packages/agent/pi/` (`@afx/agent-pi`) as a thin, transport-explicit adapter:

- Files renamed from Pi-named (`pi-client.ts`, `pi-manager.ts`) to transport-named (`rpc-client.ts`, `rpc-manager.ts`). Naming signals the mechanism, not the runtime — leaves room for other adapters alongside.
- VSCode coupling removed from the package. Config (`binaryPath`, `ephemeral`, `cwd`, `Logger`) injected via `PiRpcManagerOptions`. Extension host reads VSCode settings and passes values in.
- `PiRpcManager` implements `AgentManager` from `@afx/shared` — the runtime-agnostic contract. Sidebar panel and extension host depend only on `AgentManager`, never on `PiManager`.
- Event normalisation moved from `sidebar-panel.ts` into `rpc-manager.ts`. Pi-native event shapes → `AgentEvent` union before reaching any consumer.

### Links

- FR-1, FR-5, FR-6, FR-7, FR-8, FR-9 updated in `spec.md`
- `design.md` fully updated: DES-ARCH file paths, DES-DEC config injection + transport naming rows, DES-API contracts, DES-FILES table, DES-DEPS, File Reference Map
- Related: `100-package-shared` spec + design updated (AgentManager FR-6), ADR created

---

## Implementation complete (2026-04-26T11:35:05.000Z)

Phase 3 tasks shipped. `packages/agent/pi/` fully extracted — `rpc-client.ts`, `rpc-manager.ts`, `src/index.ts`, `package.json`, `tsconfig.json`, `vitest.config.ts`. Old engine files (`pi-client.ts`, `pi-manager.ts`) deleted from `apps/vscode/src/engine/`. All quality gates pass: `pnpm check:types` (6/6), `pnpm check:lint` (0 warnings), `pnpm check:format` (clean), `pnpm build:vscode` (3/3 Turbo tasks), `pnpm test` (56/56 tests).

Additional decisions recorded during session close:

- `currentMsgId` tracked in rpc-manager: generated on `text_start`, used for `text_delta`/`thinking_delta` (mint-on-first-delta pattern in sidebar)
- Usage stats (`get_session_stats`) exposed through `AgentManager.getUsage()` — no raw `request()` escape hatch
- Extension UI requests (`extension_ui_request`) normalized to `ui_request` events and answered through `respondToUiRequest()`
- `passWithNoTests: true` in `packages/agent/pi/vitest.config.ts` — placeholder until unit tests mock `child_process.spawn`

AFX compliance correction: tasks.md files across 4 specs (100-package-shared, 200-app-vscode, 300-infra-pi, 310-infra-build) had no Phase sections or Work Session rows. Retroactively added. `journal.md` created for 200-app-vscode and 310-infra-build. `afx-task verify ADR-0002` — all [OK].

**Participants**: @rix, claude-code (claude-sonnet-4-6)
