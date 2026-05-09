---
afx: true
type: TASKS
status: Living
owner: "@rixrix"
version: "1.1"
created_at: "2026-04-26T04:32:48.000Z"
updated_at: "2026-04-28T01:37:40.000Z"
tags: [infra, pi, rpc, subprocess, engine, adapter]
spec: spec.md
design: design.md
---

# Pi Engine Integration — Implementation Tasks

---

## Phase 1 — PiClient JSONL protocol (`rpc-client.ts`)

- [x] Implement `createPiClient()` — `start()`, `stop()`, `dispose()`
- [x] JSONL framing: `StringDecoder + indexOf('\n')` (avoids readline U+2028/U+2029 split bug)
- [x] Request correlation: incrementing int, pending `Map<id, {resolve, reject}>`
- [x] Event streaming: `onEvent`, `onExit`, `onStderr` listener sets
- [x] `getStderr()` — returns full captured stderr buffer

## Phase 2 — PiRpcManager lifecycle (`rpc-manager.ts`)

- [x] Implement `createAgentManager()` — lazy start, restart on crash, `ensureStarted()`
- [x] `AgentManager` interface: `send`, `abort`, `newSession`, `getStatus`, `onEvent`, `onStderr`, `stop`, `dispose`
- [x] Event normalization: Pi-native shapes → `AgentEvent` union inside the adapter
- [x] `currentMsgId` tracking: generated on `text_start`, used for `text_delta`/`thinking_delta`
- [x] No `vscode` import — config injected via `PiRpcManagerOptions`
- [x] Review fixes: `getUsage()` wraps `get_session_stats`; `respondToUiRequest()` sends `extension_ui_response`
- [x] AFX cleanup: expose agent-neutral `createAgentManager` factory for VSCode callers

## Phase 3 — Extract to `packages/agent/pi/` (ADR-0002)

- [x] Create `packages/agent/pi/` — `package.json`, `tsconfig.json`, `vitest.config.ts`, `src/index.ts`
- [x] Move `pi-client.ts` → `rpc-client.ts` (transport-explicit naming); update `@see` tags
- [x] Move `pi-manager.ts` → `rpc-manager.ts`; remove `vscode` import; inject config via options
- [x] Delete `apps/vscode/src/engine/pi-client.ts` and `apps/vscode/src/engine/pi-manager.ts`
- [x] Update `pnpm-workspace.yaml` — add `packages/agent/*` glob
- [x] Update `vitest.workspace.ts` — add `packages/agent/pi/vitest.config.ts`
- [x] Update `AGENTS.md` — packages list, layout block, architecture rules, spec map
- [x] Bump spec to v1.1 (FR-1/FR-5–FR-9); update design.md (all sections + File Reference Map)
- [x] Verify: `pnpm check:types && pnpm check:lint && pnpm check:format && pnpm build:vscode` — all pass

---

## Work Sessions

<!-- IMPORTANT: This section MUST remain the LAST section in tasks.md. Do not add content below it. -->

| Date       | Task                                   | Action    | Files Modified                                                                                                                                                        | Agent | Human |
| ---------- | -------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 2026-04-26 | Phase 1–2 — scaffold                   | Completed | docs/specs/300-infra-pi/ (scaffolded)                                                                                                                                 | [x]   | [x]   |
| 2026-04-26 | Phase 3 — packages/agent/pi (ADR-0002) | Completed | packages/agent/pi/ (created), apps/vscode/src/engine/pi-{client,manager}.ts (deleted), pnpm-workspace.yaml, vitest.workspace.ts, AGENTS.md, spec.md (v1.1), design.md | [x]   | [x]   |
| 2026-04-26 | Review fixes                           | Completed | packages/agent/pi/src/rpc-manager.ts, spec.md, design.md, journal.md                                                                                                  | [x]   | [x]   |
| 2026-04-26 | AFX command/config cleanup             | Completed | packages/agent/pi/src/rpc-manager.ts, spec.md, design.md, tasks.md                                                                                                    | [x]   | [x]   |
