---
afx: true
type: JOURNAL
status: Living
tags: [transport, devoverlay, chat, mock, architecture]
---

# Session: Transport Abstraction + DevOverlay

**Date:** 2026-04-26  
**Repo:** `docs/specs`  
**Branch:** `main`

---

## Why We Did This

### The Problem

The earlier chat UI was tightly coupled to the VSCode extension host. Every UI change required:

1. Build the extension
2. Reload VSCode (`Developer: Reload Window`)
3. Interact inside the webview to see the result

That feedback loop is slow and painful for the most user-facing part of the product. Worse, there was no way to simulate specific AI responses (streaming, errors, tool calls) without actually running Pi — which means real API calls, real latency, and non-deterministic output.

### The Goal for AFX

Be able to open a browser tab, see the full chat UI, click a button to fire any message the AI might send, and watch the UI respond in real-time — with no VSCode, no Pi process, no network connection required.

### The Architectural Answer: Transport Abstraction

Borrow from how tRPC, Apollo, and gRPC handle environment-agnostic communication: define an interface that describes _what_ the connection does, without caring _how_ it's implemented. We called this `Transport`.

```text
apps/chat  →  Transport interface  →  VSCode postMessage    (production)
                                   →  Mock + 13 scenarios   (browser dev + tests)
                                   →  WebSocket             (future cloud)
```

`apps/chat` has **zero imports from `vscode`**. It only talks to a `Transport` injected at startup. The same React component tree runs identically in a browser tab and inside the VSCode webview — only the transport differs.

### Why This Also Unlocks the Roadmap

The same seam that enables browser dev also enables cloud. Adding `apps/web` (Next.js) or a browser extension means implementing `createWebSocketTransport()` and injecting it. `apps/chat` requires zero changes. The architecture is already cloud-ready.

---

## What Was Built

### Phase 1 — Rename Message Types + App Directory

**Problem:** `SidebarToHost` / `HostToSidebar` implied a specific UI topology (VSCode sidebar ↔ extension host). These names break when the chat UI runs in a browser, cloud, or CLI context.

**Changes:**

- `packages/shared/src/messages.ts` — renamed `SidebarToHost` → `ChatToAgent`, `HostToSidebar` → `AgentToChat`
- `apps/sidebar/` → `apps/chat/` (directory rename)
- All downstream references updated: `apps/vscode/src/panels/sidebar-panel.ts`, `apps/vscode/__tests__`, `vitest.workspace.ts`, `eslint.config.mjs`, `knip.json`, root `package.json` scripts, `.vscode/tasks.json`

**Note:** VSCode-specific names (`SIDEBAR_VIEW_TYPE`, `afx-sidebar`, `createSidebarPanel`) were intentionally kept — these refer to the VSCode panel container, which is correctly called a "sidebar" in VSCode's API. The web app inside that container is `apps/chat`.

---

### Phase 2 — `packages/transport`

A new workspace package providing the transport interface and all adapters.

#### `packages/transport/src/types.ts`

```ts
interface Transport {
  send(msg: ChatToAgent): void;
  on<T extends AgentToChat["type"]>(
    type: T,
    handler: (msg: MessageOf<AgentToChat, T>) => void,
  ): () => void;
  dispose(): void;
}

interface MockTransport extends Transport {
  scenarios: Record<string, ScenarioFn>;
  onLog(cb: (entry: LogEntry) => void): () => void;
  getLog(): LogEntry[];
  setStreamSpeed(ms: number): void;
}
```

#### `packages/transport/src/vscode.ts`

Wraps `acquireVsCodeApi().postMessage` and `window.addEventListener('message', ...)`. The only file in the entire codebase that touches the VSCode webview API.

#### `packages/transport/src/mock.ts`

Full scripted mock with named scenarios:

| Scenario            | Colour   | What it simulates                    |
| ------------------- | -------- | ------------------------------------ |
| `quick-reply`       | Green    | Short synchronous-feeling reply      |
| `streaming-reply`   | Green    | Medium streaming reply               |
| `large-response`    | Green    | Long markdown reply with code blocks |
| `thinking-reply`    | Blue     | Extended thinking block + reply      |
| `tool-bash`         | Purple   | Single bash tool call + result       |
| `tool-read-file`    | Purple   | Read file tool call + result         |
| `tool-edit-file`    | Purple   | Edit file tool call + result         |
| `multi-tool`        | Purple   | Three sequential tool calls          |
| `tool-error`        | Orange   | Tool call that exits non-zero        |
| `provider-error`    | Red      | Rate limit / 429 error from provider |
| `abort`             | Yellow   | Mid-stream abort                     |
| `disconnected`      | Dark red | Pi process exits unexpectedly        |
| `context-near-full` | Orange   | Context window at ~85%               |

Each scenario emits the correct sequence of `AgentToChat` messages with realistic timing. Stream speed is configurable (0–200ms per chunk).

#### `packages/transport/src/mock.test.ts`

11 unit tests covering: `chat/ready` response sequence, abort, unsubscribe, log capture (both directions), `onLog` subscribe/unsubscribe, `setStreamSpeed`, all 13 scenarios exist, `disconnected` fires `piStatus.running=false`, `provider-error` fires `chat/error` (async fake-timer test using `vi.runAllTimersAsync()`), `dispose` clears all listeners.

#### `apps/chat/src/lib/bridge.ts`

Rewritten to use module-level transport injection:

```ts
let _transport: Transport | null = null;

export function initTransport(t: Transport): void { _transport = t; }
export function bridgeSend(msg: ChatToAgent): void { ... }
export function bridgeOn<T>(type: T, handler): () => void { ... }
```

#### `apps/chat/src/main.tsx`

Detects environment at startup and injects the right transport:

```ts
const isVscode = typeof (window as any)["acquireVsCodeApi"] === "function";
const transport = isVscode ? createVscodeTransport() : createMockTransport();
initTransport(transport);
createRoot(root).render(<StrictMode><App transport={transport} /></StrictMode>);
```

#### `apps/chat/tsconfig.json` updates

- Added `@afx/shared` path aliases (fixes cross-package resolution when tsc processes transport source through the chat project)
- Added `vite/client` to `types` for `import.meta.env.DEV`

---

### Phase 3 — DevOverlay

A floating debug panel rendered only in `import.meta.env.DEV` mode when the transport is a `MockTransport`.

#### `apps/chat/src/components/dev-overlay.tsx`

- **Always visible**: small circular toggle button fixed to bottom-right of the viewport. Contains a Pi status dot: red (disconnected), green (idle), yellow pulsing (streaming).
- **Scenarios tab**: 2-column grid of all 13 colour-coded scenario buttons. Stream speed slider (0–200ms/chunk, live-bound to `transport.setStreamSpeed()`).
- **Log tab**: Live message log (capped at 200 entries, auto-scrolls). Each entry shows direction (`in`/`out`), message type, and timestamp. Click to expand full JSON payload. Entry count badge. Clear button.
- Self-contained — no Shadcn dependencies, pure Tailwind. Dark neutral palette so it doesn't interfere with the UI theme.

#### `apps/chat/src/app.tsx`

```ts
function isMockTransport(t: Transport): t is MockTransport {
  return "scenarios" in t && typeof (t as MockTransport).scenarios === "object";
}

const showOverlay = import.meta.env.DEV && isMockTransport(transport);
// ...
{showOverlay && <DevOverlay transport={transport} />}
```

#### `apps/chat/src/components/dev-overlay.test.tsx`

13 unit tests: toggle open/close, all 13 scenario buttons present and clickable, log entries appended after `transport.send()` (wrapped in `act()`), log count badge, stream speed slider, clear log, expand JSON payload.

---

## Cleanup & CI Fixes

| File                                  | What changed                                                                                                        |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `packages/transport/package.json`     | Added `main`, `types`, `scripts.check-types`, `scripts.test` to match workspace conventions                         |
| `apps/vscode/package.json`            | Added `watch:tsc` script                                                                                            |
| `.vscode/tasks.json`                  | Fixed `watch:tsc` to use `pnpm run` instead of `pnpm exec`; all `apps/sidebar` command references → `apps/chat`     |
| `.github/workflows/code-qa.yml`       | `apps/sidebar` → `apps/chat` in playwright install step                                                             |
| `.size-limit.json`                    | `apps/sidebar/dist` → `apps/chat/dist`                                                                              |
| `scripts/generate-scope-enum.mjs`     | `"sidebar"` → `"chat"` enum scope                                                                                   |
| `apps/chat/e2e/chat.spec.ts`          | Renamed from `sidebar.spec.ts`, test descriptions updated                                                           |
| `apps/chat/playwright.config.ts`      | Comment updated                                                                                                     |
| `apps/chat/src/main.tsx`              | Removed stray `import "@afx/ui/tokens"` (redundant — already loaded via `index.css` → `@afx/ui/styles/globals.css`) |
| `packages/transport/src/mock.test.ts` | `provider-error` test: `async` + `vi.runAllTimersAsync()` to correctly flush async timer chains with fake timers    |
| Multiple `.ts/.tsx` files             | Prettier-formatted                                                                                                  |

---

## End State

- `pnpm run health` — fully green. All type checks, tests, lint, format, knip pass.
- `pnpm dev:chat` — starts Vite at `localhost:5173`. Full chat UI in the browser with mock transport. DevOverlay dot visible in bottom-right corner. Click to open scenario panel and message log.
- VSCode extension — unaffected. `createVscodeTransport()` injected when `acquireVsCodeApi` is detected. DevOverlay does not render.

---

## How to Use the Dev Loop

```bash
# From ./
pnpm dev:chat
# Open http://localhost:5173
# Click the dot in the bottom-right corner
# Pick a scenario → watch the UI react
# Switch to Log tab → see every message in both directions
```

To simulate a specific edge case, click the corresponding scenario button. Adjust stream speed to stress-test rendering at high throughput or to slow things down enough to inspect intermediate states. All messages are logged with expandable JSON payloads.
