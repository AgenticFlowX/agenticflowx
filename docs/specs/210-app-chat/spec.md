---
afx: true
type: SPEC
status: Approved
owner: "@rixrix"
version: "1.2"
created_at: "2026-04-26T04:32:48.000Z"
updated_at: "2026-05-05T15:15:37.000Z"
approved_at: "2026-05-05T15:15:37.000Z"
tags: [app, chat, webview, streaming, devoverlay, routing, hydration, mode, workspace-mode]
depends_on: [100-package-shared, 110-package-transport, 130-package-ui]
---

# apps/chat — Product Specification

## References

- **Architecture**: [AGENTS.md — apps/chat](../../../AGENTS.md)

---

## Problem Statement

The chat webview renders streaming AI conversations with markdown, tool call UI, and thinking blocks. It must work identically inside VSCode (via postMessage) and in a browser (via mock transport) to enable fast UI iteration.

When the webview remounts after a panel switch, it should rehydrate the last visible transcript immediately so the user does not see a brief empty or welcome shell before the host snapshot lands.

This parent spec owns the chat app boundary. Composer, message timeline, history, settings, and notes work routes to child specs so small UI copy/control changes do not require reading the whole chat source.

---

## Child Zone Route Map

| Spec                    | Start Here For                                                                                                                               |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `211-app-chat-composer` | Composer input, footer hints, queue strip, activity bar, slash/mention helpers, model/thinking controls, mode control, blocked-command strip |
| `212-app-chat-messages` | Message timeline, markdown rendering, tool cards, thinking blocks, streaming output                                                          |
| `213-app-chat-history`  | History view, conversation list, history event mapping                                                                                       |
| `214-app-chat-settings` | Settings panel, provider cards, API key/runtime readiness UX, theme preview, workspace mode card                                             |
| `215-app-chat-notes`    | Save-to-notes, note capture bridge, chat/editor note entry points                                                                            |

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
| FR-8 | Hydrate the last visible transcript on remount before the first host snapshot  | Must Have   |

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
- [ ] Switching away and back restores the previous transcript immediately, without flashing the welcome shell
- [ ] A genuinely empty session still shows the loading shell until the first host snapshot arrives
- [ ] Composer-specific work routes to `211-app-chat-composer`
- [ ] Settings/provider work routes to `214-app-chat-settings`

### DevOverlay

- [ ] Visible only when mock transport is active (browser mode)
- [ ] Scenario buttons trigger named mock scenarios
- [ ] Log panel shows transport messages in real time

---

## Non-Goals

- No VSCode API calls
- No filesystem or process access
- No engine implementation
- No design-system token/component contract changes outside `131-package-ui-design-system`

---

## Dependencies

- `@afx/shared` (message types)
- `@afx/transport` (transport abstraction)
- `@afx/ui` (component library and design tokens)

---

## Appendix

### Agent Entry Map (routing-only parent)

This is a parent spec. It owns the chat webview boundary (shell, app entry, transport bridge) and
**does not** own per-zone functional requirements. The table below routes incoming requests to the
right child zone before reading any source file.

| Field           | Values                                                                                                                                                                                                                                                                                         |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Owned surface   | Chat webview shell (`apps/chat/src/index.tsx`, `apps/chat/src/app.tsx`, transport bootstrap); **routing only** for feature behavior                                                                                                                                                            |
| Owned files     | `apps/chat/src/index.tsx`, `apps/chat/src/app.tsx`, `apps/chat/src/lib/bridge.ts` (shared bridge entry), `apps/chat/vite.config.ts`                                                                                                                                                            |
| Children        | `211-app-chat-composer`, `212-app-chat-messages`, `213-app-chat-history`, `214-app-chat-settings`, `215-app-chat-notes`                                                                                                                                                                        |
| Routing rules   | "footer/composer/queue/slash/@-mention/send/abort/steer/follow-up" -> 211; "message stream/tool call/thinking block/markdown" -> 212; "history/conversation list/timeline" -> 213; "settings/provider/API key/model picker/runtime control" -> 214; "save to notes/composer note strip" -> 215 |
| Out of scope    | Functional requirements for any specific zone; those live in the child specs                                                                                                                                                                                                                   |
| Example prompts | "Update the composer footer" -> 211; "Render tool call card differently" -> 212; "Add filter to history" -> 213; "Add provider validation" -> 214; "Notes shortcut behavior" -> 215                                                                                                            |
