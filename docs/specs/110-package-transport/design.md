---
afx: true
type: DESIGN
status: Approved
owner: "@rixrix"
version: "1.1"
created_at: "2026-04-26T04:32:48.000Z"
updated_at: "2026-05-09T12:21:59.000Z"
tags: ["package", "transport", "vscode", "mock", "devoverlay", "traceability"]
spec: spec.md
---

# @afx/transport — Technical Design

---

## [DES-OVR] Overview

`@afx/transport` abstracts the message channel between the chat webview and its host. Two implementations exist: VSCode postMessage (production) and a scripted mock transport for development. `apps/chat` imports only the `Transport` interface — zero VSCode-specific code in the app.

---

## [DES-ARCH] Architecture

### [DES-TRANSPORT-SYSTEM-CONTEXT] System Context

```text
packages/transport/
└── src/
    ├── index.ts     ← barrel
    ├── types.ts     ← Transport interface, MockTransport, LogEntry, ScenarioFn
    ├── vscode.ts    ← createVscodeTransport() wraps acquireVsCodeApi
    └── mock.ts      ← createMockTransport() with named scenarios
```

### [DES-TRANSPORT-INTERFACE] Transport Interface

```text
apps/chat → Transport.send() → [VSCode adapter] → extension host
                                [Mock adapter]   → simulated response
```

### [DES-TRANSPORT-MOCK-SCENARIOS] Mock Scenarios

| Scenario family   | Behaviour                                                       |
| ----------------- | --------------------------------------------------------------- |
| Chat replies      | Quick, streaming, large, and thinking responses                 |
| Tool calls        | Bash/read/edit/multi-tool success and tool-error flows          |
| Runtime control   | Abort, steering, follow-up, compaction, settings, and recovery  |
| Provider/settings | Provider configuration, model lists, settings snapshots, stderr |
| UI state          | Appearance preview, startup/disconnect, and context-near-full   |

---

## [DES-TRANSPORT-MOCKUPS] ASCII Flow Mockups

<!-- @see spec.md [FR-1] [FR-2] [FR-3] [FR-4] [FR-5] [FR-6] -->

### [DES-TRANSPORT-MOCKUP-VSCODE] Production VSCode Flow

```text
apps/chat/src/lib/bridge.ts
  -> createVscodeTransport()
  -> acquireVsCodeApi().postMessage(ChatToAgent)
  -> apps/vscode SidebarPanel
  -> AgentToChat message
  -> window message listener
  -> transport.on(type, handler)
```

### [DES-TRANSPORT-MOCKUP-MOCK] Browser Development Flow

```text
apps/chat/src/lib/bridge.ts
  -> createMockTransport()
  -> send(ChatToAgent)
  -> scenario dispatcher / scripted async events
  -> emit(AgentToChat)
  -> onLog(direction, timestamp, payload)
  -> DevOverlay scenario/log panes
```

### [DES-TRANSPORT-VSCODE-ADAPTER] VSCode Adapter

`packages/transport/src/vscode.ts` is the only transport file that touches the
webview `acquireVsCodeApi` global. It mirrors VSCode state helpers through
optional `getState`/`setState` methods and logs listener failures without
throwing across the bridge.

### [DES-TRANSPORT-MOCK-ADAPTER] Mock Adapter

`packages/transport/src/mock.ts` owns named scenarios, streaming timers, abort
state, runtime/settings snapshots, and log replay. It must remain deterministic
enough for tests and DevOverlay reproduction.

### [DES-TRANSPORT-LOGGING] Transport Log Entries

`LogEntry` records direction, timestamp, message type, and payload. Mock
transport emits both outbound user messages and inbound simulated host messages
so UI debugging can follow the exact sequence.

---

## [DES-DEC] Key Decisions

| Decision          | Options Considered                                | Choice                          | Rationale                                                                         |
| ----------------- | ------------------------------------------------- | ------------------------------- | --------------------------------------------------------------------------------- |
| Abstraction level | Wrap individual postMessage calls, full interface | Full `Transport` interface      | Enables complete mock substitution; apps don't know which transport they're using |
| Scenario delivery | Randomised, named                                 | Named                           | Test scenarios must be deterministic and selectable via DevOverlay                |
| Stream speed      | Fixed, configurable                               | Configurable on `MockTransport` | Needed to test both fast and slow streaming UI states                             |

---

## [DES-API] API Contracts

```typescript
interface Transport {
  send(msg: ChatToAgent): void;
  // Typed by discriminant — subscribe to a specific event type, not all messages
  on<T extends AgentToChat["type"]>(
    type: T,
    handler: (msg: MessageOf<AgentToChat, T>) => void,
  ): () => void;
  dispose(): void;
}

interface MockTransport extends Transport {
  scenarios: Record<string, ScenarioFn>; // call a named scenario directly
  onLog(cb: (entry: LogEntry) => void): () => void;
  getLog(): LogEntry[];
  setStreamSpeed(ms: number): void; // ms between word chunks (default 40)
}

function createVscodeTransport(): Transport;
function createMockTransport(): MockTransport; // scenario selected via DevOverlay, not constructor arg
```

---

## [DES-FILES] File Structure

| File                               | Purpose                                                          |
| ---------------------------------- | ---------------------------------------------------------------- |
| `packages/transport/src/index.ts`  | Barrel — all public exports                                      |
| `packages/transport/src/types.ts`  | `Transport` interface, `MockTransport`, `LogEntry`, `ScenarioFn` |
| `packages/transport/src/vscode.ts` | `createVscodeTransport()` — wraps VSCode webview API             |
| `packages/transport/src/mock.ts`   | `createMockTransport()` — named scenario implementations         |

---

## [DES-DEPS] Dependencies

| Package       | Purpose                                       |
| ------------- | --------------------------------------------- |
| `@afx/shared` | `ChatToAgent` and `AgentToChat` message types |

---

## [DES-SEC] Security Considerations

- Mock transport must never be active in production VSCode builds
- `apps/chat` detects VSCode via `typeof acquireVsCodeApi !== 'undefined'` — mock is only used in browser

---

## [DES-ERR] Error Handling

| Scenario                       | Handling                                                 |
| ------------------------------ | -------------------------------------------------------- |
| `acquireVsCodeApi` unavailable | Detected at startup; mock transport used in browser mode |
| Scenario `provider-error`      | Sends `chat/error` message to trigger error UI state     |

---

## [DES-TEST] Testing Strategy

### [DES-TRANSPORT-TEST-UNIT] Unit Tests

- `mock.test.ts` covers scenario presence, abort, logging, stream speed, runtime/settings flows, and `dispose()`

---

## [DES-ROLLOUT] Migration / Rollout Plan

### [DES-TRANSPORT-ROLLOUT-INTERFACE] Phase 1: Interface + VSCode Adapter

1. Define `Transport` interface in `types.ts`
2. Implement `createVscodeTransport()` in `vscode.ts`
3. Wire into `apps/chat/src/lib/bridge.ts`

### [DES-TRANSPORT-ROLLOUT-MOCK] Phase 2: Mock + Scenarios

1. Implement `createMockTransport()` in `mock.ts`
2. Add named scenarios
3. Expose DevOverlay in `apps/chat` for scenario switching

---

## [DES-TRANSPORT-LOC] Code Locator Map

<!-- @see spec.md [FR-1] [FR-2] [FR-3] [FR-4] [FR-5] [FR-6] -->

| Surface / behavior        | Source anchor                      | Design node                                                       | Tests                                 |
| ------------------------- | ---------------------------------- | ----------------------------------------------------------------- | ------------------------------------- |
| Public exports            | `packages/transport/src/index.ts`  | `[DES-API]`, `[DES-TRANSPORT-INTERFACE]`                          | package typecheck                     |
| Interface seam            | `packages/transport/src/types.ts`  | `[DES-TRANSPORT-INTERFACE]`, `[DES-TRANSPORT-LOGGING]`            | package typecheck                     |
| VSCode webview adapter    | `packages/transport/src/vscode.ts` | `[DES-TRANSPORT-VSCODE-ADAPTER]`, `[DES-TRANSPORT-MOCKUP-VSCODE]` | package typecheck                     |
| Browser/dev mock adapter  | `packages/transport/src/mock.ts`   | `[DES-TRANSPORT-MOCK-ADAPTER]`, `[DES-TRANSPORT-MOCK-SCENARIOS]`  | `packages/transport/src/mock.test.ts` |
| Mock log and stream speed | `packages/transport/src/mock.ts`   | `[DES-TRANSPORT-LOGGING]`                                         | `packages/transport/src/mock.test.ts` |

---

## [DES-TRANSPORT-TRACE] 1:1 Code/Spec Matrix

| Requirement | Design node                                                       | Source anchor                                                       |
| ----------- | ----------------------------------------------------------------- | ------------------------------------------------------------------- |
| `[FR-1]`    | `[DES-TRANSPORT-INTERFACE]`                                       | `packages/transport/src/types.ts`                                   |
| `[FR-2]`    | `[DES-TRANSPORT-VSCODE-ADAPTER]`, `[DES-TRANSPORT-MOCKUP-VSCODE]` | `packages/transport/src/vscode.ts`                                  |
| `[FR-3]`    | `[DES-TRANSPORT-MOCK-ADAPTER]`                                    | `packages/transport/src/mock.ts`                                    |
| `[FR-4]`    | `[DES-TRANSPORT-MOCK-SCENARIOS]`                                  | `packages/transport/src/mock.ts`                                    |
| `[FR-5]`    | `[DES-TRANSPORT-LOGGING]`                                         | `packages/transport/src/types.ts`, `packages/transport/src/mock.ts` |
| `[FR-6]`    | `[DES-TRANSPORT-MOCK-ADAPTER]`                                    | `packages/transport/src/mock.ts`                                    |
| `[NFR-1]`   | `[DES-SEC]`                                                       | chat app import boundary tests                                      |
| `[NFR-2]`   | `[DES-DEPS]`                                                      | package typecheck                                                   |

---

## [DES-TRANSPORT-REFS] File Reference Map

| Task | File                               | Required @see                                                                                     |
| ---- | ---------------------------------- | ------------------------------------------------------------------------------------------------- |
| —    | `packages/transport/src/index.ts`  | `spec.md [FR-1]` + `design.md [DES-TRANSPORT-INTERFACE]`                                          |
| —    | `packages/transport/src/types.ts`  | `spec.md [FR-1] [FR-5] [FR-6]` + `design.md [DES-TRANSPORT-INTERFACE] [DES-TRANSPORT-LOGGING]`    |
| —    | `packages/transport/src/vscode.ts` | `spec.md [FR-2]` + `design.md [DES-TRANSPORT-VSCODE-ADAPTER]`                                     |
| —    | `packages/transport/src/mock.ts`   | `spec.md [FR-3] [FR-4]` + `design.md [DES-TRANSPORT-MOCK-ADAPTER] [DES-TRANSPORT-MOCK-SCENARIOS]` |
