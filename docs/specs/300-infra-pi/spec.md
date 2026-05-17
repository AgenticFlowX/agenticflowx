---
afx: true
type: SPEC
status: Living
owner: "@rixrix"
version: "1.2"
created_at: "2026-04-26T04:32:48.000Z"
updated_at: "2026-05-17T09:04:20.000Z"
tags: ["infra", "pi", "rpc", "subprocess", "engine", "adapter", "routing"]
depends_on: [100-package-shared]
---

# Pi Engine Integration — Product Specification

## References

- **ADR**: [ADR-0001 Pi Engine Integration](../../adr/ADR-0001-pi-engine-integration.md)
- **Research**: [Pi Integration Strategy](../../research/pi/res-pi-integration-strategy.md)
- **Architecture**: [AGENTS.md — apps/vscode engine](../../../AGENTS.md)

---

## Problem Statement

The extension host needs to spawn `pi --mode rpc` as a child process, communicate over JSONL, and manage the process lifecycle (lazy startup, restart on crash, disposal on deactivation).

This spec remains the migration source for older Pi integration requirements. New generic runtime-manager work routes to `350-agent-manager`; new Pi adapter, SDK, bootstrap, RPC, and skills-sync work routes to `351-agent-pi`.

---

## Migration Route Map

| Spec                | Start Here For                                                                    |
| ------------------- | --------------------------------------------------------------------------------- |
| `350-agent-manager` | Runtime abstraction, provider/model contracts, multiplexing, runtime monitoring   |
| `351-agent-pi`      | Pi RPC adapter, JSONL framing, SDK bootstrap, skills sync, auth/config injection  |
| `300-infra-pi`      | Legacy Pi integration requirements until child specs fully supersede this content |

---

## User Stories

### Primary Users

`apps/vscode` extension host; future AFX tool implementations.

### Stories

**As an** extension
**I want** Pi to start lazily on first use
**So that** activation is fast even when Pi is not needed immediately

**As a** user
**I want** Pi to restart automatically after a crash
**So that** I don't have to reload the window to recover

---

## Requirements

### Functional Requirements

| ID   | Requirement                                                                                                                                                                                             | Priority    |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| FR-1 | `createAgentManager(opts: PiRpcManagerOptions)` manages a single Pi subprocess per extension session; config injected via options, not read from VSCode inside the package                              | Must Have   |
| FR-2 | Pi process spawns lazily on first use                                                                                                                                                                   | Must Have   |
| FR-3 | JSONL framing over stdin/stdout using `StringDecoder` + `indexOf('\n')` (not readline, to avoid U+2028/U+2029 splitting)                                                                                | Must Have   |
| FR-4 | Request-response correlation via incrementing numeric ID                                                                                                                                                | Must Have   |
| FR-5 | `PiRpcManager` implements `AgentManager` from `@afx/shared`: `send()`, `abort()`, `newSession()`, `getStatus()`, `getUsage()`, `respondToUiRequest()`, `onEvent()`, `onStderr()`, `stop()`, `dispose()` | Must Have   |
| FR-6 | Ephemeral session controlled by `ephemeral` boolean injected via `PiRpcManagerOptions` (the VSCode caller reads `afx.agentEphemeralSession`)                                                            | Must Have   |
| FR-7 | Pi binary path injected via optional `binaryPath` in `PiRpcManagerOptions` (the VSCode caller reads `afx.agentBinaryPath`; adapter default remains internal)                                            | Must Have   |
| FR-8 | All lifecycle events logged via injected `Logger` interface (`{ appendLine(value: string): void }`) — no `vscode` import in `packages/agent/pi/`                                                        | Should Have |
| FR-9 | Pi-native event shapes, including `extension_ui_request`, are translated to normalized `AgentEvent` union from `@afx/shared` before emitting to `onEvent()` listeners                                   | Must Have   |

### Non-Functional Requirements

| ID    | Requirement                                                             | Target                        |
| ----- | ----------------------------------------------------------------------- | ----------------------------- |
| NFR-1 | `@mariozechner/pi-coding-agent` is a `devDependency` only — not bundled | Enforced by esbuild externals |
| NFR-2 | Pi subprocess startup completes in < 500ms                              | Measured in smoke test        |

---

## Acceptance Criteria

### Lifecycle

- [ ] First `request()` call starts Pi; subsequent calls reuse the running process
- [ ] `stop()` sends SIGTERM and waits for exit
- [ ] `dispose()` calls `stop()` and cleans up all event handlers

### JSONL Protocol

- [ ] Requests serialize to `{ id, type, …params }` + `\n`
- [ ] Responses correlate to pending requests by `id`
- [ ] Events with no matching `id` are emitted via `onEvent()` handlers

---

## Non-Goals

- No in-process Pi SDK calls (Pure RPC only — see ADR-0001)
- No Pi binary bundling inside the VSIX
- No VSCode API imports in `packages/agent/pi/` (VSCode concerns stay in `apps/vscode`)
- No generic runtime/provider abstraction changes; those belong in `350-agent-manager`

---

## Dependencies

- `@afx/shared` (workspace — `AgentManager`, `AgentEvent`, `Disposable`, `Logger` contracts)
- `@mariozechner/pi-coding-agent` (devDependency — RPC types only, not bundled)
