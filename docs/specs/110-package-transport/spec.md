---
afx: true
type: SPEC
status: Living
owner: "@rixrix"
version: "1.1"
created_at: "2026-04-26T04:32:48.000Z"
updated_at: "2026-05-17T09:04:20.000Z"
approved_at: "2026-05-05T15:15:37.000Z"
tags: [package, transport, vscode, mock, devoverlay, mode, workspace-mode]
depends_on: [100-package-shared]
---

# @afx/transport — Product Specification

## References

- **Architecture**: [AGENTS.md — packages/transport](../../../AGENTS.md)

---

## Problem Statement

`apps/chat` must run both inside VSCode (postMessage bridge) and in a standalone browser (for fast dev iteration). Without a transport abstraction, every app component would contain VSCode-specific imports that break in browser mode.

---

## User Stories

### Primary Users

`apps/chat` and developers iterating on the chat UI.

### Stories

**As a** developer
**I want** to run `apps/chat` in a browser without VSCode
**So that** I can iterate on UI without launching the Extension Development Host

**As a** tester
**I want** named mock scenarios
**So that** I can trigger specific UI states (streaming, tool calls, errors) reproducibly

**As a** `apps/chat` component
**I want** zero VSCode imports
**So that** the same component code works in VSCode and the browser

---

## Requirements

### Functional Requirements

| ID   | Requirement                                                                                                                                                                           | Priority    |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| FR-1 | `Transport` interface with `send()`, `on()`, `dispose()` methods                                                                                                                      | Must Have   |
| FR-2 | `createVscodeTransport()` wraps `acquireVsCodeApi()` postMessage bridge                                                                                                               | Must Have   |
| FR-3 | `createMockTransport()` provides named scenarios for dev/test                                                                                                                         | Must Have   |
| FR-4 | Mock scenarios cover chat replies, streaming, tools, runtime settings, provider setup, startup/recovery, settings snapshots, workspace mode, appearance, and context-near-full states | Must Have   |
| FR-5 | `MockTransport` logs all send/receive events with direction and timestamp                                                                                                             | Should Have |
| FR-6 | Stream speed is configurable on `MockTransport` for testing fast/slow streaming                                                                                                       | Should Have |
| FR-7 | Mock transport mirrors workspace mode changes into the settings snapshot so browser-mode tests can flip between Code and Explore                                                      | Should Have |

### Non-Functional Requirements

| ID    | Requirement                                    | Target                       |
| ----- | ---------------------------------------------- | ---------------------------- |
| NFR-1 | `apps/chat` has zero direct VSCode API imports | Enforced by ESLint           |
| NFR-2 | Transport is React-free and Node-free          | Enforced by package tsconfig |

---

## Acceptance Criteria

### VSCode Transport

- [ ] `createVscodeTransport()` correctly wraps `acquireVsCodeApi` window global
- [ ] Messages sent via `send()` reach the extension host via postMessage

### Mock Transport

- [ ] All named scenarios produce the correct message sequence
- [ ] `abort` scenario cancels an in-progress stream
- [ ] `disconnected` scenario results in a connection error UI state
- [ ] `dispose()` cleans up all listeners
- [ ] Workspace mode snapshots and `chat/setMode` updates round-trip through the mock transport

---

## Non-Goals

- No WebSocket or HTTP transport (future)
- No message queuing or retry logic
- No transport-package ownership of `apps/workbench` protocol; workbench keeps its own typed bridge in `apps/workbench/src/lib/bridge.ts`

---

## Dependencies

- `@afx/shared` (message types)
