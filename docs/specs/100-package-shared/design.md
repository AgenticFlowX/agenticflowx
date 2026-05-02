---
afx: true
type: DESIGN
status: Approved
owner: "@rixrix"
version: "1.2"
created_at: "2026-04-26T04:32:48.000Z"
updated_at: "2026-04-28T01:37:40.000Z"
tags: [package, shared, protocol, types, agent, logging]
spec: spec.md
---

# @afx/shared — Technical Design

---

## [DES-OVR] Overview

`@afx/shared` is a zero-dependency TypeScript library that owns the message protocol between the extension host and webview apps, plus domain types used across the monorepo.

---

## [DES-ARCH] Architecture

### System Context

```text
packages/shared/
└── src/
    ├── index.ts        ← barrel re-export
    ├── agent.ts        ← AgentManager, AgentEvent, AgentStatus, Disposable
    ├── logger.ts       ← Logger contract + sinks (DES-LOG, ADR-0003)
    ├── messages.ts     ← ChatToAgent, AgentToChat, WorkbenchToHost, HostToWorkbench
    ├── types.ts        ← domain types: Task, Spec, Phase, Feature, Discussion …
    └── constants.ts    ← shared string constants
```

`@afx/shared` has no dependencies. All packages and apps import from it.

---

## [DES-DEC] Key Decisions

| Decision              | Options Considered                                          | Choice              | Rationale                                                                                 |
| --------------------- | ----------------------------------------------------------- | ------------------- | ----------------------------------------------------------------------------------------- |
| Message typing        | Plain `{ type: string, payload: any }`, discriminated union | Discriminated union | TypeScript narrows on `type` field; no runtime schema needed                              |
| Domain types location | Per-package, shared library                                 | Shared library      | Single source of truth; prevents drift between extension host and webview                 |
| View types            | Inline in app, shared                                       | Shared              | `ChatMessageView` used by both the extension host (to construct) and chat app (to render) |

---

## [DES-DATA] Data Model

### Message Protocol

```typescript
// Chat → Extension host direction
type ChatToAgent =
  | { type: "chat/ready" }
  | { type: "chat/send"; requestId: string; content: string }
  | { type: "chat/abort" }
  | { type: "chat/newSession" }
  | { type: "chat/getState" };

// Extension host → Chat direction (streaming-aware event protocol)
type AgentToChat =
  | { type: "chat/state"; isStreaming: boolean; messages: ChatMessageView[]; tools: ChatToolView[] }
  | { type: "chat/messageStart"; id: string; role: ChatRole; createdAt: number; content?: string }
  | { type: "chat/messageDelta"; id: string; delta: string }
  | { type: "chat/thinkingDelta"; id: string; delta: string }
  | { type: "chat/messageEnd"; id: string; stopReason?: string }
  | { type: "chat/toolStart"; toolCallId: string; toolName: string; args: unknown }
  | { type: "chat/toolEnd"; toolCallId: string; ok: boolean; summary?: string }
  | { type: "chat/error"; message: string; requestId?: string }
  | { type: "chat/aborted" }
  | { type: "chat/piStatus"; running: boolean; isStreaming: boolean; model?: string; info?: string }
  | {
      type: "chat/usage";
      messageId?: string;
      tokens: {
        input: number;
        output: number;
        cacheRead: number;
        cacheWrite: number;
        total: number;
      };
      cost: number;
      contextUsage?: { tokens: number | null; contextWindow: number; percent: number | null };
    };
```

### View Types

```typescript
type ChatRole = "user" | "assistant";

interface ChatMessageView {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
  streaming?: boolean;
  stopReason?: string;
  tools?: ChatToolView[];
  thinking?: string;
  usage?: ChatUsageView;
}

interface ChatToolView {
  toolCallId: string;
  toolName: string;
  status: "running" | "ok" | "error";
  summary?: string;
  args?: Record<string, unknown>;
}

interface ChatUsageView {
  tokens: { input: number; output: number; cacheRead: number; cacheWrite: number; total: number };
  cost: number;
  contextUsage?: { tokens: number | null; contextWindow: number; percent: number | null };
}
```

### Agent Contract

```typescript
// Minimal structural interface — VSCode types satisfy this structurally
interface Disposable {
  dispose(): void;
}

// Logger contract lives in `./logger.ts` — see [DES-LOG] for the leveled/scoped/lazy contract.

interface AgentStatus {
  running: boolean;
  isStreaming: boolean;
  model?: string;
}

interface AgentUsageStats {
  tokens: { input: number; output: number; cacheRead: number; cacheWrite: number; total: number };
  cost: number;
  contextUsage?: { tokens: number | null; contextWindow: number; percent: number | null };
}

// Normalized event union — adapters translate their native shapes to this
type AgentEvent =
  | { type: "agent_start" }
  | { type: "agent_end" }
  | { type: "message_start"; role: "user" | "assistant"; content?: string; errorMessage?: string }
  | { type: "text_delta"; id: string; delta: string }
  | { type: "thinking_delta"; id: string; delta: string }
  | { type: "tool_start"; toolCallId: string; toolName: string; args?: Record<string, unknown> }
  | { type: "tool_end"; toolCallId: string; ok: boolean; result?: unknown }
  | { type: "ui_request"; id: string; method: string }
  | { type: "error"; message: string };

type AgentUiResponse =
  | { id: string; value: string }
  | { id: string; confirmed: boolean }
  | { id: string; cancelled: true };

type AgentEventListener = (event: AgentEvent) => void;
type AgentStderrListener = (chunk: string) => void;

interface AgentManager {
  send(message: string): Promise<void>;
  abort(): Promise<void>;
  newSession(): Promise<void>;
  getStatus(): Promise<AgentStatus>;
  getUsage(): Promise<AgentUsageStats | null>;
  respondToUiRequest(response: AgentUiResponse): Promise<void>;
  onEvent(listener: AgentEventListener): Disposable;
  onStderr(listener: AgentStderrListener): Disposable;
  stop(): Promise<void>;
  dispose(): Promise<void>;
}
```

### Domain Types

```typescript
type TaskStatus = "todo" | "in-progress" | "done" | "blocked";
type SpecStatus = "draft" | "approved" | "living";
type Mode = "spec" | "design" | "dev" | "check" | "report" | "session" | "task" | "discover";
type Provider = "openai" | "anthropic" | "google" | "ollama" | "lmstudio" | "custom";

interface TaskStats {
  total: number;
  done: number;
  inProgress: number;
  blocked: number;
}
interface Feature {
  id: string;
  name: string;
  status: SpecStatus;
  owner?: string;
}
interface Spec {
  id: string;
  name: string;
  status: SpecStatus;
  requirements: string[];
  nonGoals: string[];
  phases: Phase[];
  createdAt: string;
  updatedAt: string;
}
interface Phase {
  id: string;
  name: string;
  tasks: Task[];
}
interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  phase: string;
  assignee?: string;
}
interface Discussion {
  id: string;
  timestamp: string;
  status: "open" | "resolved" | "promoted";
  summary: string;
}
```

---

## [DES-API] API Contracts

All types are exported from `src/index.ts`:

```typescript
export type { ChatToAgent, AgentToChat, ChatMessageView, ChatToolView, ChatUsageView };
export type { WorkbenchToHost, HostToWorkbench };
export type { Task, Spec, Phase, Feature, Discussion, TaskStatus, SpecStatus };
export type { Mode, Provider, TaskStats };
export type { AgentManager, AgentEvent, AgentStatus, AgentUsageStats };
export type { AgentUiRequest, AgentUiResponse, AgentEventListener, AgentStderrListener };
export type { Disposable };
export type { Logger, LogLevel, LogRecord, LogSink, MemorySink };
export { createLogger, outputChannelSink, onErrorAutoShowSink, consoleSink, memorySink };
```

---

## [DES-LOG] Logger Contract

Structured leveled logger — `packages/shared/src/logger.ts`. See ADR-0003 for full rationale.

**Levels** (descending verbosity): `silent`, `error`, `warn`, `info`, `debug`, `trace`. The configured level emits records at that level and any below it (e.g. `info` emits info/warn/error).

**Lazy evaluation**: every level method accepts `string | (() => string)`. The callback is invoked only after the level gate passes — `silent` short-circuits before any work.

**Scoped child loggers**: `parent.child(name, fields?)` produces a logger with scope `"parent:name"`. Children share the parent's mutable level reference, so `root.setLevel(...)` propagates to all existing children. Field bindings are shallow-merged: child wins on key collision (pino convention).

**Error API**: `error(msg, err?, fields?)`. When `err` is an `Error` the sink renders the stack on indented lines. Eliminates the `err instanceof Error ? err.message : String(err)` ternary at consumer sites.

**Sinks** (pluggable):

| Sink                  | Purpose                                                                                           |
| --------------------- | ------------------------------------------------------------------------------------------------- |
| `outputChannelSink`   | Writes `[ISO] [LEVEL] [scope] message {k=v} json={...}` to a `vscode.OutputChannel`-shaped object |
| `onErrorAutoShowSink` | Calls `channel.show(true)` on the first error record (preserves prior sidebar UX)                 |
| `consoleSink`         | Routes records to `console.error/warn/info/debug` for webview / browser context                   |
| `memorySink`          | Test-only — captures records for assertion (`records()`, `clear()`)                               |

A faulty sink throws are caught and isolated; logging to other sinks continues.

**Level resolution at app entry** (`apps/vscode/src/extension.ts`):

1. `process.env.AFX_LOG_LEVEL` (highest priority — survives editor restarts)
2. `vscode.workspace.getConfiguration("afx").get("logLevel")` (live-reactive via `onDidChangeConfiguration`)
3. `"info"` (default)

**Webview asymmetry**: webviews use `consoleSink()` only. Module-level loggers in `packages/transport/{mock,vscode}.ts`, `apps/chat/src/lib/bridge.ts`, and `apps/workbench/src/lib/bridge.ts`. No host-→-webview level forwarding in v1; deferred behind a future `transportSink` (ADR amendment if needed).

---

## [DES-FILES] File Structure

| File                                 | Purpose                                                |
| ------------------------------------ | ------------------------------------------------------ |
| `packages/shared/src/index.ts`       | Barrel — all public exports                            |
| `packages/shared/src/agent.ts`       | Agent contract — AgentManager, AgentEvent, Disposable  |
| `packages/shared/src/logger.ts`      | Structured Logger contract + sinks (DES-LOG, ADR-0003) |
| `packages/shared/src/logger.test.ts` | Logger unit tests                                      |
| `packages/shared/src/messages.ts`    | Chat + Workbench message protocol types                |
| `packages/shared/src/types.ts`       | Domain types (Task, Spec, etc.)                        |
| `packages/shared/src/constants.ts`   | Shared string constants                                |

---

## [DES-DEPS] Dependencies

| Package | Purpose                   |
| ------- | ------------------------- |
| None    | Zero runtime dependencies |

---

## [DES-SEC] Security Considerations

- No sensitive data flows through `@afx/shared` types at rest
- Message types carry no auth tokens; those are handled by the extension host

---

## [DES-ERR] Error Handling

| Scenario                      | Handling                                                         |
| ----------------------------- | ---------------------------------------------------------------- |
| Unknown message type received | Consumer switches on `type`; unknown cases fall through to no-op |

---

## [DES-TEST] Testing Strategy

### Unit Tests

- `constants.test.ts` covers exported constants
- Types are structural — validated at compile time, not runtime

---

## [DES-ROLLOUT] Migration / Rollout Plan

### Initial Implementation

1. Define message discriminated unions in `messages.ts`
2. Define domain types in `types.ts`
3. Re-export all from `index.ts`

### Rollback Plan

Revert `messages.ts` and `types.ts` to previous version; all consumers recompile.

---

## File Reference Map

| Task | File                               | Required @see                                    |
| ---- | ---------------------------------- | ------------------------------------------------ |
| —    | `packages/shared/src/index.ts`     | `spec.md [FR-1]` + `design.md [DES-API]`         |
| —    | `packages/shared/src/agent.ts`     | `spec.md [FR-5]` + `design.md [DES-DATA]`        |
| —    | `packages/shared/src/logger.ts`    | `spec.md [FR-6]` + `design.md [DES-LOG]`         |
| —    | `packages/shared/src/messages.ts`  | `spec.md [FR-1] [FR-4]` + `design.md [DES-DATA]` |
| —    | `packages/shared/src/types.ts`     | `spec.md [FR-3]` + `design.md [DES-DATA]`        |
| —    | `packages/shared/src/constants.ts` | `spec.md [FR-3]` + `design.md [DES-DATA]`        |
