---
afx: true
type: TASKS
status: Living
owner: "@rixrix"
version: "1.1"
created_at: "2026-04-26T04:32:48.000Z"
updated_at: "2026-05-02T00:08:26.000Z"
tags: [package, transport, vscode, mock]
spec: spec.md
design: design.md
---

# @afx/transport — Implementation Tasks

> Phases below were backfilled on 2026-04-27 to give a traceable record of the implementation that already shipped. Each task references the FR/DES anchor it implements.

---

## Phase 1 — Transport interface and adapters

### 1.1 Define the runtime-agnostic `Transport` contract

<!-- files: packages/transport/src/types.ts -->
<!-- @see docs/specs/110-package-transport/spec.md [FR-1] [DES-API] -->

- [x] Add `Transport` interface with `send(msg: ChatToAgent): void`, `on<T>(type, handler): () => void`, and `dispose(): void`.
- [x] Add `MockTransport extends Transport` with `scenarios: Record<string, ScenarioFn>`, `onLog(cb)`, `getLog()`, `setStreamSpeed(ms)`.
- [x] Add `LogDirection` and `LogEntry` types for the dev-overlay log capture.

### 1.2 VSCode webview adapter

<!-- files: packages/transport/src/vscode.ts -->
<!-- @see docs/specs/110-package-transport/spec.md [FR-2] [DES-OVR] -->

- [x] Implement `createVscodeTransport()` wrapping `acquireVsCodeApi().postMessage` and `window.addEventListener("message", ...)`.
- [x] Type the `acquireVsCodeApi` access defensively so the adapter is the single file that touches the VSCode webview API.

### 1.3 Mock adapter with named scenarios

<!-- files: packages/transport/src/mock.ts, packages/transport/src/mock.test.ts -->
<!-- @see docs/specs/110-package-transport/spec.md [FR-3] [FR-4] [FR-5] [FR-6] [DES-OVR] -->

- [x] Implement `createMockTransport()` returning a `MockTransport`.
- [x] Implement named scenarios per FR-4, covering chat replies, streaming, tools, runtime settings, provider setup, startup/recovery, settings snapshots, appearance, and context-near-full states.
- [x] Capture every `send`/receive in a bounded log buffer with `LogEntry` (direction, type, timestamp) per FR-5.
- [x] Expose `setStreamSpeed(ms)` to make streaming-cadence configurable per FR-6.
- [x] Add `mock.test.ts` covering: ready-response sequence, abort, unsubscribe, log capture (both directions), `onLog` subscribe/unsubscribe, `setStreamSpeed`, scenario presence, disconnected/provider-error flows, and `dispose`.

### 1.4 Barrel exports

<!-- files: packages/transport/src/index.ts -->
<!-- @see docs/specs/110-package-transport/spec.md [FR-1] [FR-2] [FR-3] -->

- [x] Re-export `Transport`, `MockTransport`, `ScenarioFn`, `LogDirection`, `LogEntry` from `./types`.
- [x] Re-export `createVscodeTransport` and `createMockTransport`.

## Phase 2 — chat-foundation extensions

### 2.1 New foundation scenarios

<!-- files: packages/transport/src/mock.ts -->
<!-- @see docs/specs/chat-foundation/chat-foundation.md [NFR-1] [DES-TESTABILITY] [8.1] -->

- [x] Add `modelsLoaded`, `modelsEmpty`, `commandsLoaded`, `filesListed`, `stderrLoaded`, `settingsSnapshotLoaded` scenarios driving the new `agent/*` reply messages introduced by chat-foundation Phase 2 (verified at `mock.ts:596-602`).

---

## Work Sessions

<!-- IMPORTANT: This section MUST remain the LAST section in tasks.md. Do not add content below it. -->

| Date       | Task    | Action    | Files Modified                                                                                                              | Agent | Human |
| ---------- | ------- | --------- | --------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 2026-04-26 | Phase 1 | Completed | packages/transport/src/{types,vscode,mock,index}.ts, packages/transport/src/mock.test.ts                                    | [x]   | [x]   |
| 2026-04-26 | 2.1     | Completed | packages/transport/src/mock.ts (added 6 chat-foundation scenarios)                                                          | [x]   | [x]   |
| 2026-04-27 | audit   | Reviewed  | Backfilled phase breakdown from `> Package is implemented` placeholder; all FRs cross-referenced to actual files and tests. | [x]   | [x]   |
