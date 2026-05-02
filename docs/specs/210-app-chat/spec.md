---
afx: true
type: SPEC
status: Approved
owner: "@rixrix"
version: "1.0"
created_at: "2026-04-26T04:32:48.000Z"
updated_at: "2026-05-02T00:08:26.000Z"
tags: [app, chat, webview, streaming, devoverlay]
depends_on: [100-package-shared, 110-package-transport, 130-package-ui]
---

# apps/chat — Product Specification

## References

- **Architecture**: [AGENTS.md — apps/chat](../../../AGENTS.md)

---

## Problem Statement

The chat webview renders streaming AI conversations with markdown, tool call UI, and thinking blocks. It must work identically inside VSCode (via postMessage) and in a browser (via mock transport) to enable fast UI iteration.

---

## User Stories

### Primary Users

Users of the AgenticFlowX sidebar panel; developers iterating on the chat UI.

### Stories

**As a** user
**I want** to see streaming assistant messages with markdown formatting
**So that** I can read responses as they arrive

**As a** developer
**I want** to run the chat UI in a browser with mock scenarios
**So that** I can iterate on the UI without launching VSCode

---

## Requirements

### Functional Requirements

| ID   | Requirement                                                                    | Priority    |
| ---- | ------------------------------------------------------------------------------ | ----------- |
| FR-1 | Detect VSCode vs browser at startup; inject correct transport                  | Must Have   |
| FR-2 | Render streaming assistant messages with markdown (remark-gfm)                 | Must Have   |
| FR-3 | Render tool calls with status (pending, running, done, error)                  | Must Have   |
| FR-4 | Render thinking blocks inline with messages                                    | Must Have   |
| FR-5 | DevOverlay in browser mode: scenario selector, log viewer, stream speed slider | Must Have   |
| FR-6 | Views: Chat (primary), History, Explorer, Settings                             | Should Have |
| FR-7 | Settings view allows theme switching (Meridian / Lyra)                         | Should Have |

### Non-Functional Requirements

| ID    | Requirement                       | Target             |
| ----- | --------------------------------- | ------------------ |
| NFR-1 | Zero direct VSCode API imports    | Enforced by ESLint |
| NFR-2 | Bundle size tracked by size-limit | Reported in CI     |

---

## Acceptance Criteria

### Chat View

- [ ] Streaming messages render character-by-character without layout shift
- [ ] Tool calls show name, input, and output when complete
- [ ] Thinking blocks are collapsible
- [ ] Abort button cancels in-progress stream

### DevOverlay

- [ ] Visible only when mock transport is active (browser mode)
- [ ] Scenario buttons trigger named mock scenarios
- [ ] Log panel shows transport messages in real time

---

## Non-Goals

- No VSCode API calls
- No filesystem or process access
- No engine implementation

---

## Dependencies

- `@afx/shared` (message types)
- `@afx/transport` (transport abstraction)
- `@afx/ui` (component library and design tokens)
