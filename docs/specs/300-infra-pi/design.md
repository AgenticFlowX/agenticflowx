---
afx: true
type: DESIGN
status: Approved
owner: "@rixrix"
version: "1.1"
created_at: "2026-04-26T04:32:48.000Z"
updated_at: "2026-05-09T12:21:59.000Z"
tags: [infra, pi, rpc, subprocess, engine, adapter]
spec: spec.md
---

# Pi Engine Integration — Technical Design

---

## [DES-OVR] Overview

Pi is spawned as a child process (`pi --mode rpc`). `rpc-client.ts` manages the JSONL protocol layer (framing, request correlation, event streaming). `rpc-manager.ts` owns the process lifecycle (lazy startup, restart, disposal) and exposes a typed API to the extension host.

---

## [DES-ARCH] Architecture

### System Context

```text
packages/agent/pi/src/
├── rpc-manager.ts  ← PiRpcManager: implements AgentManager, process lifecycle, event normalisation
├── rpc-client.ts   ← PiClient: JSONL protocol, request correlation, event streaming
└── index.ts        ← barrel re-export

apps/vscode
└── injects config into `packages/agent/pi`; no Pi implementation code lives in the extension host
```

```text
extension host (extension.ts)
  reads VSCode config → injects binaryPath, ephemeral, cwd, Logger
  createAgentManager(opts) → AgentManager

  agentManager.send(message)
    → PiRpcManager: rpcClient.request({ type: 'prompt', message })
    → rpc-client: serialize to JSONL → stdin
    → pi process: handles RPC command
    → pi process: JSONL response → stdout
    → rpc-client: deserialize → correlate by id → resolve Promise

  agentManager.onEvent(handler)
    → PiRpcManager: subscribes to rpc-client raw events
    → normalises Pi-native shapes → AgentEvent union
    → handler(AgentEvent)
```

### JSONL Framing

```text
Outbound: JSON.stringify(cmd) + '\n'
Inbound:  StringDecoder + buffer.indexOf('\n') loop (avoids readline U+2028/U+2029 split bug)
```

---

## [DES-DEC] Key Decisions

| Decision                  | Options Considered                                          | Choice                                                      | Rationale                                                                                                             |
| ------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Framing                   | readline module, split('\n'), StringDecoder+indexOf         | StringDecoder + indexOf('\n')                               | readline splits on U+2028/U+2029 (Unicode line separators), breaking valid JSON                                       |
| Request correlation       | UUID, incrementing int                                      | Incrementing int                                            | Simpler, no UUID dep, sufficient for sequential requests                                                              |
| Lifecycle                 | Eager start, lazy start                                     | Lazy (on first use)                                         | Extension activation is fast; Pi startup deferred until needed                                                        |
| Manager/client split      | Single class                                                | Separate `PiClient` (protocol) + `PiRpcManager` (lifecycle) | PiRpcManager can restart PiClient on crash without re-implementing protocol                                           |
| Config injection          | Read VSCode config inside manager, inject via opts          | Inject via `PiRpcManagerOptions`                            | Keeps `packages/agent/pi/` free of VSCode imports; caller owns config resolution; enables testing without VSCode host |
| Transport-explicit naming | Runtime-named (`pi-client`), transport-named (`rpc-client`) | Transport-named (`rpc-client.ts`, `rpc-manager.ts`)         | Signals the mechanism, not the runtime; leaves room for other adapters alongside                                      |

---

## [DES-API] API Contracts

```typescript
// rpc-manager.ts
// Config is injected by the caller.
// No vscode import in this package.
interface PiRpcManagerOptions {
  logger: Logger;
  binaryPath?: string; // from caller configuration, optional
  ephemeral: boolean; // from caller configuration
  sessionDir?: string;
  cwd?: string; // from vscode.workspace.workspaceFolders[0]
  additionalSkillPaths?: readonly string[];
  defaultConfigPath?: string;
  env?: Record<string, string>;
}

// Implements AgentManager from @afx/shared — runtime-agnostic contract
function createAgentManager(opts: PiRpcManagerOptions): AgentManager;

interface PiRpcManager extends AgentManager {
  getUsage(): Promise<AgentUsageStats | null>; // wraps get_session_stats
  respondToUiRequest(response: AgentUiResponse): Promise<void>; // sends extension_ui_response
}

// rpc-client.ts
interface PiClientOptions {
  binaryPath?: string; // default: "pi"
  cwd?: string;
  args?: readonly string[];
  env?: Record<string, string>;
  logger?: { info(msg: string): void; warn(msg: string): void; error(msg: string): void };
}

interface PiClient {
  readonly isRunning: boolean;
  start(): Promise<void>;
  stop(signal?: NodeJS.Signals): Promise<void>;
  dispose(): Promise<void>;
  request<T>(cmd: RpcCommand): Promise<T>;
  send(cmd: RpcCommand): void;
  onEvent(listener: PiEventListener): () => void;
  onExit(listener: PiExitListener): () => void;
  onStderr(listener: PiStderrListener): () => void;
  getStderr(): string; // returns full stderr buffer as a single string
}

function createPiClient(opts?: PiClientOptions): PiClient;
```

---

## [DES-FILES] File Structure

| File                                   | Purpose                                                            |
| -------------------------------------- | ------------------------------------------------------------------ |
| `packages/agent/pi/src/rpc-manager.ts` | Process lifecycle, AgentManager impl, event normalisation, logging |
| `packages/agent/pi/src/rpc-client.ts`  | JSONL protocol, request correlation, event streaming               |
| `packages/agent/pi/src/index.ts`       | Barrel re-export                                                   |

---

## [DES-DEPS] Dependencies

| Package                          | Purpose                                                                     |
| -------------------------------- | --------------------------------------------------------------------------- |
| `@afx/shared`                    | `AgentManager`, `AgentEvent`, usage, UI bridge, `Disposable`, `Logger`      |
| `@mariozechner/pi-coding-agent`  | `RpcCommand`, `RpcResponse` type declarations (devDependency — not bundled) |
| `string_decoder` (Node built-in) | JSONL frame decoding                                                        |

---

## [DES-SEC] Security Considerations

- Pi binary path comes from caller configuration — user-controlled, not from workspace
- No command injection: Pi is spawned with explicit `args` array, not shell string
- stderr captured and displayed in OutputChannel — no eval of stderr content

---

## [DES-ERR] Error Handling

| Scenario                      | Handling                                                                    |
| ----------------------------- | --------------------------------------------------------------------------- |
| Pi binary not found           | `ensureStarted()` rejects; error logged to OutputChannel                    |
| Pi process exits unexpectedly | `onExit` handler fires; `PiRpcManager` marks the runtime as stopped         |
| Request times out             | Pending Promise left unresolved (no timeout currently — future improvement) |
| Malformed JSONL frame         | Frame discarded; warning logged to OutputChannel                            |

---

## [DES-TEST] Testing Strategy

### Unit Tests

Covered by unit tests around manager response mapping, send/session behavior, and unwrap/status behavior. Subprocess spawning remains isolated behind `createPiClient()` mocks in package tests.

### Manual Testing

- `afx.agentSmokeTest` command calls `AgentManager.getStatus()` and logs the response

---

## [DES-ROLLOUT] Migration / Rollout Plan

### Phase 1: JSONL Protocol (`rpc-client.ts`)

1. Implement `createPiClient()` with `start()`, `stop()`, request correlation, JSONL framing
2. Verify with smoke test

### Phase 2: Lifecycle Manager (`rpc-manager.ts`)

1. Implement `createAgentManager()` wrapping `PiClient`
2. Wire into `extension.ts`

### Rollback Plan

Revert `rpc-client.ts` and `rpc-manager.ts`; webview shows disconnected state.

---

## File Reference Map

| Task | File                                   | Required @see                                                 |
| ---- | -------------------------------------- | ------------------------------------------------------------- |
| —    | `packages/agent/pi/src/rpc-manager.ts` | `spec.md [FR-1] [FR-5] [FR-8] [FR-9]` + `design.md [DES-API]` |
| —    | `packages/agent/pi/src/rpc-client.ts`  | `spec.md [FR-3] [FR-4]` + `design.md [DES-ARCH]`              |
| —    | `packages/agent/pi/src/index.ts`       | `design.md [DES-FILES]`                                       |
