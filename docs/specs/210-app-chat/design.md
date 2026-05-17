---
afx: true
type: DESIGN
status: Living
owner: "@rixrix"
version: "1.2"
created_at: "2026-04-26T04:32:48.000Z"
updated_at: "2026-05-15T09:13:06.000Z"
tags:
  [
    "app",
    "chat",
    "webview",
    "streaming",
    "devoverlay",
    "code-spec-alignment",
    "hydration",
    "componentization",
    "feature-inventory",
  ]
spec: spec.md
---

# apps/chat — Technical Design

---

## [DES-OVR] Overview

`apps/chat` is a React + Vite webview that renders chat conversations. It detects its environment at startup (VSCode vs browser) and injects the appropriate transport. When the webview remounts, it rehydrates the last visible transcript from persisted webview state so the chat surface does not flash a fresh-session shell. DevOverlay is rendered only in browser mode with mock transport active.

---

## [DES-ARCH] Architecture

### System Context

```text
apps/chat/src/
├── main.tsx           ← entry; detects VSCode/browser; injects transport
├── app.tsx            ← root component; <Chat> + conditional <DevOverlay>
├── lib/
│   └── bridge.ts      ← initTransport(), bridgeGetState(), bridgeSetState(), bridgeSend(), bridgeOn()
├── views/
│   ├── chat.tsx        ← stable Chat route shell; componentized by spec 216
│   ├── history.tsx     ← session history
│   ├── explorer.tsx    ← coming soon
│   └── settings.tsx    ← theme + provider settings
└── components/
    ├── chat/               ← ChatWindow region components; owned by spec 216
    ├── debug-panel.tsx     ← DevOverlay (scenario grid + logs + speed slider)
    ├── markdown-message.tsx← renders assistant markdown with remark-gfm
    └── coming-soon.tsx     ← placeholder for unimplemented views
```

### Transport Detection

```typescript
// main.tsx
const transport =
  typeof acquireVsCodeApi !== "undefined"
    ? createVscodeTransport()
    : createMockTransport("streaming-reply");

initTransport(transport);
```

### DevOverlay

Rendered by `app.tsx` when `import.meta.env.DEV && transport instanceof MockTransport`.

---

## [DES-DEV] Development Server And Browser Harness

The chat app supports a browser development loop through Vite while preserving the VSCode webview runtime path. `apps/chat/vite.config.ts` owns the browser-facing dev/build harness for this app: React plugin setup, Tailwind integration, aliases for workspace packages, and test/build configuration that keeps the webview source runnable outside VSCode.

This section exists as a stable traceability node for app-level development harness code. UI behavior still routes to child specs such as `211-app-chat-composer`, `212-app-chat-messages`, `213-app-chat-history`, and `214-app-chat-settings`; shared design-system tokens and future Storybook work route to `131-package-ui-design-system`.

---

## [DES-UI] User Interface & UX

Chat view layout now routes detailed chat-window componentization to `docs/specs/216-app-chat-window-componentization/design.md`. This parent spec remains the app-shell source of truth: transport bootstrap, tab strip, route selection, persisted app-level state, toasts, and DevOverlay.

Durable region names for the Chat tab are:

- App tab strip: Chat / History / Settings, owned by `app.tsx`.
- Chat root: `ChatWindow`, owned by `components/chat/chat-window.tsx`.
- Top action row: `ChatTopBar`.
- Conversation area: `ConversationPane`, `ConversationTimeline`, `ConversationEmptyStates`, `ConversationScrollButton`.
- Composer area: `ComposerDock`, `ComposerActivityBar`, `ComposerPanelStack`, `ComposerPanel`, `ComposerAttachmentTray`, `ComposerInput`, `ComposerToolbar`, `ComposerActions`, `ComposerFooter`.
- Global overlays: toast stack and DevOverlay remain app-level overlays.

Source-code `@see` annotations for Chat tab componentization should point to `docs/specs/216-app-chat-window-componentization/design.md`, not to fleet/sprint planning documents.

### Remount Hydration

When the user leaves the webview and returns, the chat surface should repaint the last visible
transcript immediately from persisted webview state. The loading/logo shell remains only for the
truly cold-start case where no transcript snapshot has ever been received.

```text
webview mount
    |
    v
bridgeGetState()
    |
    +--> cached transcript exists? ---- yes ---> render timeline immediately
    |                                        |
    |                                        v
    |                                wait for host chat/state
    |                                        |
    |                                        v
    |                               replace cache with live snapshot
    |
    +--> no cache yet ------------------ no ---> show setup/loading shell
                                             |
                                             v
                                   first host chat/state arrives
                                             |
                                             v
                                   render transcript or empty state
```

### [DES-UI-COMPONENTIZATION-ROUTE] Componentization Route

| UI Region                | Durable Owner                                                                                        |
| ------------------------ | ---------------------------------------------------------------------------------------------------- |
| App shell tab strip      | `210-app-chat/design.md [DES-ARCH]`                                                                  |
| Chat window shell        | `216-app-chat-window-componentization/design.md [DES-ARCH] [DES-UI]`                                 |
| Controller/state owner   | `216-app-chat-window-componentization/design.md [DES-STATE]`                                         |
| Conversation timeline    | `212-app-chat-messages/design.md [DES-MESSAGES-COMPONENTS]` + `216` component boundary               |
| Composer behavior        | `211-app-chat-composer/design.md [DES-COMPOSER-COMPONENTS]` + `216` component boundary               |
| History load/export slot | `216-app-chat-window-componentization/design.md [DES-HISTORY]`; future persistence remains in `213`. |
| DevOverlay/toasts        | `210-app-chat/design.md [DES-ARCH] [DES-UI]`                                                         |

---

## [DES-DEC] Key Decisions

| Decision              | Options Considered                       | Choice                                   | Rationale                                                              |
| --------------------- | ---------------------------------------- | ---------------------------------------- | ---------------------------------------------------------------------- |
| Transport injection   | Context, prop drilling, module singleton | Module singleton (`bridge.ts`)           | Single init point; components call `bridgeSend` without prop threading |
| Markdown rendering    | Custom, react-markdown                   | react-markdown + remark-gfm              | Handles GFM (tables, strikethrough, task lists) out of the box         |
| DevOverlay visibility | Env flag + transport type check          | `import.meta.env.DEV && isMockTransport` | Guarantees overlay never appears in VSCode even if env detection fails |

---

## [DES-API] API Contracts

```typescript
// bridge.ts
function initTransport(t: Transport): void;
function bridgeGetState(): unknown;
function bridgeSetState(state: unknown): void;
function bridgeSend(msg: ChatToAgent): void;
function bridgeOn<T extends AgentToChat["type"]>(
  type: T,
  handler: (msg: MessageOf<AgentToChat, T>) => void,
): () => void;
```

---

## [DES-FILES] File Structure

| File                                            | Purpose                                                                                           |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `apps/chat/src/main.tsx`                        | Entry point — transport detection + injection                                                     |
| `apps/chat/src/app.tsx`                         | root component — chat view + DevOverlay                                                           |
| `apps/chat/src/lib/bridge.ts`                   | Transport singleton module                                                                        |
| `apps/chat/src/views/chat.tsx`                  | Stable Chat route shell; componentization details route to `216-app-chat-window-componentization` |
| `apps/chat/src/components/chat/*`               | Chat window region components owned by `216-app-chat-window-componentization`                     |
| `apps/chat/src/views/history.tsx`               | Session history                                                                                   |
| `apps/chat/src/views/explorer.tsx`              | Explorer (coming soon)                                                                            |
| `apps/chat/src/views/settings.tsx`              | Settings panel                                                                                    |
| `apps/chat/src/components/debug-panel.tsx`      | DevOverlay                                                                                        |
| `apps/chat/src/components/markdown-message.tsx` | Markdown renderer                                                                                 |
| `apps/chat/src/components/coming-soon.tsx`      | Stub placeholder                                                                                  |

---

## [DES-DEPS] Dependencies

| Package                         | Purpose                        |
| ------------------------------- | ------------------------------ |
| `@afx/shared`                   | Message types                  |
| `@afx/transport`                | Transport interface + adapters |
| `@afx/ui`                       | Components and design tokens   |
| `react-markdown` + `remark-gfm` | Markdown rendering             |

---

## [DES-SEC] Security Considerations

- `react-markdown` renders sanitised HTML — no `dangerouslySetInnerHTML`
- DevOverlay is dev-mode only and never bundled in production VSIX

---

## [DES-ERR] Error Handling

| Scenario                  | Handling                                          |
| ------------------------- | ------------------------------------------------- |
| `provider-error` scenario | `agent/error` message renders error state in chat |
| `disconnected` scenario   | Connection error rendered as chat system message  |

---

## [DES-TEST] Testing Strategy

### Unit Tests

- `app.test.tsx` — root component render
- `components/debug-panel.test.tsx` — 13 DevOverlay scenario tests

### E2E Tests

- `e2e/chat.spec.ts` — Playwright browser tests (covered by `420-dx-testing`)

---

## [DES-ROLLOUT] Migration / Rollout Plan

### Adding a View

1. Create `src/views/<name>.tsx`
2. Add tab entry in `app.tsx` nav
3. Update spec FR table

---

## File Reference Map

| Task | File                                            | Required @see                                                                                          |
| ---- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| —    | `apps/chat/src/main.tsx`                        | `spec.md [FR-1]` + `design.md [DES-ARCH]`                                                              |
| —    | `apps/chat/src/app.tsx`                         | `spec.md [FR-5]` + `design.md [DES-ARCH]`                                                              |
| —    | `apps/chat/src/lib/bridge.ts`                   | `spec.md [FR-1]` + `design.md [DES-API]`                                                               |
| —    | `apps/chat/vite.config.ts`                      | `spec.md [FR-1]` + `design.md [DES-DEV]`                                                               |
| —    | `apps/chat/src/views/chat.tsx`                  | `spec.md [FR-2] [FR-3] [FR-4]` + `docs/specs/216-app-chat-window-componentization/design.md [DES-API]` |
| —    | `apps/chat/src/components/debug-panel.tsx`      | `spec.md [FR-5]` + `design.md [DES-UI]`                                                                |
| —    | `apps/chat/src/components/markdown-message.tsx` | `spec.md [FR-2]` + `docs/specs/212-app-chat-messages/design.md [DES-MESSAGES-MARKDOWN]`                |
