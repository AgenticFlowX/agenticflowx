---
afx: true
type: TASKS
status: Living
owner: "@rixrix"
version: "1.3"
created_at: "2026-04-26T04:32:48.000Z"
updated_at: "2026-05-05T12:03:56.000Z"
tags: ["package", "shared", "protocol", "types", "agent", "logging"]
spec: spec.md
design: design.md
---

# @afx/shared — Implementation Tasks

---

## Phase 1 — Initial package scaffold

- [x] Create `packages/shared/src/` structure
- [x] Define message protocol types (`WebviewMessage`, `ExtensionMessage`)
- [x] Export from `packages/shared/src/index.ts`
- [x] Wire into `apps/vscode`, `apps/chat`, `apps/workbench`

## Phase 2 — AgentManager abstraction (ADR-0002)

- [x] Add `packages/shared/src/agent.ts` — `AgentManager`, `AgentEvent`, `AgentStatus`, `Disposable`, `Logger`
- [x] Export `agent.ts` from `packages/shared/src/index.ts`
- [x] Bump spec to v1.1, add FR-6; update design.md (DES-ARCH, DES-DATA, DES-API, DES-FILES, File Reference Map)
- [x] Create `docs/adr/ADR-0002-afx-agent-manager-abstraction.md`
- [x] Verify: `pnpm check:types` passes with zero errors
- [x] Review fixes: add usage stats and extension UI request/response to `AgentManager`

## Phase 3 — Structured logger (ADR-0003)

- [x] Add `packages/shared/src/logger.ts` — `Logger`, `LogLevel`, `LogRecord`, `LogSink`, `createLogger`, sinks
- [x] Add `packages/shared/src/logger.test.ts` — 25 tests covering level gating, lazy callbacks, child scope/field merge, sink formats, error+stack, faulty-sink isolation
- [x] Drop the old `Logger { appendLine }` from `agent.ts`; re-export the new `Logger` from `./logger`
- [x] Export logger contract + sinks from `packages/shared/src/index.ts`
- [x] Bump spec to v1.2, add FR-6 (Logger contract); add DES-LOG section; update File Reference Map
- [x] Create `docs/adr/ADR-0003-afx-structured-logger.md`
- [x] Migrate consumers: `apps/vscode/src/extension.ts`, `agent-factory.ts`, `panels/sidebar-panel.ts`; `packages/agent/pi/src/rpc-{manager,client}.ts`; `packages/transport/{mock,vscode}.ts`; `apps/chat/src/lib/bridge.ts`; `apps/workbench/src/lib/bridge.ts`
- [x] Add `afx.logLevel` VSCode setting (enum, default `info`); wire `onDidChangeConfiguration`; resolve initial level from env > setting > default
- [x] Add test fixture `apps/vscode/__tests__/fixtures/mock-logger.ts`; update `agent-factory.spec.ts` and `extension.spec.ts`
- [x] Verify: `pnpm check-types` and `pnpm test` clean (29 tests in `@afx/shared`; 82 tests monorepo-wide)

## Phase 4 — Active File Context Snapshot

- [x] Extend `SettingsSnapshot` with the durable active-file context preference
- [x] Add `chat/setIncludeActiveFileContext` to the chat-to-host protocol
- [x] Update shared protocol/design tests for the new snapshot field and toggle message

---

## Work Sessions

<!-- IMPORTANT: This section MUST remain the LAST section in tasks.md. Do not add content below it. -->

| Date                     | Task                                   | Action      | Files Modified                                                                                                 | Agent | Human |
| ------------------------ | -------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 2026-04-26               | Phase 1 — scaffold                     | Completed   | docs/specs/100-package-shared/ (scaffolded)                                                                    | [x]   | [x]   |
| 2026-04-26               | Phase 2 — AgentManager (ADR-002)       | Completed   | packages/shared/src/agent.ts (created), packages/shared/src/index.ts, spec.md (v1.1 FR-6), design.md, ADR-0002 | [x]   | [x]   |
| 2026-04-26               | Review fixes                           | Completed   | packages/shared/src/agent.ts, spec.md, design.md                                                               | [x]   | [x]   |
| 2026-05-05               | Phase 4 — active file context          | In progress | spec.md, design.md, packages/shared/src/messages.ts, messages.test.ts                                          | [x]   | [x]   |
| 2026-05-05T11:53:21.000Z | Phase 4 — active file context snapshot | Coded       | spec.md, design.md, packages/shared/src/messages.ts, packages/shared/src/messages.test.ts                      | [x]   | [x]   |
| 2026-05-05T12:03:56.000Z | Phase 4 — active file context snapshot | Completed   | spec.md, design.md, packages/shared/src/messages.ts, packages/shared/src/messages.test.ts                      | [x]   | [x]   |
