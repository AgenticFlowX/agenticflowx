---
afx: true
type: DESIGN
status: Approved
owner: "@rixrix"
version: "1.0"
created_at: "2026-04-26T04:32:48.000Z"
updated_at: "2026-04-28T01:37:40.000Z"
tags: [app, chat, webview, streaming, devoverlay]
spec: spec.md
---

# apps/chat — Technical Design

---

## [DES-OVR] Overview

`apps/chat` is a React + Vite webview that renders chat conversations. It detects its environment at startup (VSCode vs browser) and injects the appropriate transport. DevOverlay is rendered only in browser mode with mock transport active.

---

## [DES-ARCH] Architecture

### System Context

```text
apps/chat/src/
├── main.tsx           ← entry; detects VSCode/browser; injects transport
├── app.tsx            ← root component; <Chat> + conditional <DevOverlay>
├── lib/
│   └── bridge.ts      ← initTransport(), bridgeSend(), bridgeOn(), getTransport()
├── views/
│   ├── chat.tsx        ← main chat view (message list + input)
│   ├── history.tsx     ← session history
│   ├── explorer.tsx    ← coming soon
│   └── settings.tsx    ← theme + provider settings
└── components/
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

## [DES-UI] User Interface & UX

Chat view layout:

- Top: Tab bar (Chat / History / Explorer / Settings)
- Center: Scrollable message list
- Bottom: Input area with send + abort buttons

DevOverlay (bottom-right, dev mode):

- Scenario button grid (13 buttons)
- Transport log panel (collapsible)
- Stream speed slider

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
function bridgeSend(msg: ChatToAgent): void;
function bridgeOn(handler: (msg: AgentToChat) => void): () => void;
function getTransport(): Transport;
```

---

## [DES-FILES] File Structure

| File                                            | Purpose                                       |
| ----------------------------------------------- | --------------------------------------------- |
| `apps/chat/src/main.tsx`                        | Entry point — transport detection + injection |
| `apps/chat/src/app.tsx`                         | root component — chat view + DevOverlay       |
| `apps/chat/src/lib/bridge.ts`                   | Transport singleton module                    |
| `apps/chat/src/views/chat.tsx`                  | Main chat view                                |
| `apps/chat/src/views/history.tsx`               | Session history                               |
| `apps/chat/src/views/explorer.tsx`              | Explorer (coming soon)                        |
| `apps/chat/src/views/settings.tsx`              | Settings panel                                |
| `apps/chat/src/components/debug-panel.tsx`      | DevOverlay                                    |
| `apps/chat/src/components/markdown-message.tsx` | Markdown renderer                             |
| `apps/chat/src/components/coming-soon.tsx`      | Stub placeholder                              |

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

| Task | File                                            | Required @see                                         |
| ---- | ----------------------------------------------- | ----------------------------------------------------- |
| —    | `apps/chat/src/main.tsx`                        | `spec.md [FR-1]` + `design.md [DES-ARCH]`             |
| —    | `apps/chat/src/app.tsx`                         | `spec.md [FR-5]` + `design.md [DES-ARCH]`             |
| —    | `apps/chat/src/lib/bridge.ts`                   | `spec.md [FR-1]` + `design.md [DES-API]`              |
| —    | `apps/chat/src/views/chat.tsx`                  | `spec.md [FR-2] [FR-3] [FR-4]` + `design.md [DES-UI]` |
| —    | `apps/chat/src/components/debug-panel.tsx`      | `spec.md [FR-5]` + `design.md [DES-UI]`               |
| —    | `apps/chat/src/components/markdown-message.tsx` | `spec.md [FR-2]` + `design.md [DES-DEC]`              |
