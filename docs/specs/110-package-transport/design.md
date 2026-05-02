---
afx: true
type: DESIGN
status: Approved
owner: "@rixrix"
version: "1.0"
created_at: "2026-04-26T04:32:48.000Z"
updated_at: "2026-05-02T00:08:26.000Z"
tags: [package, transport, vscode, mock, devoverlay]
spec: spec.md
---

# @afx/transport — Technical Design

---

## [DES-OVR] Overview

`@afx/transport` abstracts the message channel between the chat webview and its host. Two implementations exist: VSCode postMessage (production) and a scripted mock transport for development. `apps/chat` imports only the `Transport` interface — zero VSCode-specific code in the app.

---

## [DES-ARCH] Architecture

### System Context

```text
packages/transport/
└── src/
    ├── index.ts     ← barrel
    ├── types.ts     ← Transport interface, MockTransport, LogEntry, ScenarioFn
    ├── vscode.ts    ← createVscodeTransport() wraps acquireVsCodeApi
    └── mock.ts      ← createMockTransport() with named scenarios
```

### Transport Interface

```text
apps/chat → Transport.send() → [VSCode adapter] → extension host
                                [Mock adapter]   → simulated response
```

### Mock Scenarios

| Scenario family   | Behaviour                                                       |
| ----------------- | --------------------------------------------------------------- |
| Chat replies      | Quick, streaming, large, and thinking responses                 |
| Tool calls        | Bash/read/edit/multi-tool success and tool-error flows          |
| Runtime control   | Abort, steering, follow-up, compaction, settings, and recovery  |
| Provider/settings | Provider configuration, model lists, settings snapshots, stderr |
| UI state          | Appearance preview, startup/disconnect, and context-near-full   |

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

### Unit Tests

- `mock.test.ts` covers scenario presence, abort, logging, stream speed, runtime/settings flows, and `dispose()`

---

## [DES-ROLLOUT] Migration / Rollout Plan

### Phase 1: Interface + VSCode Adapter

1. Define `Transport` interface in `types.ts`
2. Implement `createVscodeTransport()` in `vscode.ts`
3. Wire into `apps/chat/src/lib/bridge.ts`

### Phase 2: Mock + Scenarios

1. Implement `createMockTransport()` in `mock.ts`
2. Add named scenarios
3. Expose DevOverlay in `apps/chat` for scenario switching

---

## File Reference Map

| Task | File                               | Required @see                                          |
| ---- | ---------------------------------- | ------------------------------------------------------ |
| —    | `packages/transport/src/index.ts`  | `spec.md [FR-1]` + `design.md [DES-API]`               |
| —    | `packages/transport/src/types.ts`  | `spec.md [FR-1] [FR-5] [FR-6]` + `design.md [DES-API]` |
| —    | `packages/transport/src/vscode.ts` | `spec.md [FR-2]` + `design.md [DES-ARCH]`              |
| —    | `packages/transport/src/mock.ts`   | `spec.md [FR-3] [FR-4]` + `design.md [DES-ARCH]`       |
