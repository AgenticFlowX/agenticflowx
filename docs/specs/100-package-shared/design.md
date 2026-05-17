---
afx: true
type: DESIGN
status: Living
owner: "@rixrix"
version: "1.9"
created_at: "2026-04-26T04:32:48.000Z"
updated_at: "2026-05-17T09:04:20.000Z"
approved_at: "2026-05-05T11:45:45.000Z"
tags: ["package", "shared", "protocol", "types", "agent", "logging", "traceability"]
spec: spec.md
---

# @afx/shared — Technical Design

---

## [DES-OVR] Overview

`@afx/shared` is a zero-dependency TypeScript library that owns the message protocol between the extension host and webview apps, plus domain types used across the monorepo.

---

## [DES-ARCH] Architecture

### [DES-SHARED-SYSTEM-CONTEXT] System Context

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

### [DES-SHARED-CHAT-PROTOCOL] Chat Message Protocol

```typescript
// Chat → Extension host direction
type ChatToAgent =
  | { type: "chat/ready" }
  | { type: "chat/send"; requestId: string; content: string }
  | { type: "chat/abort" }
  | { type: "chat/newSession" }
  | { type: "chat/getState" }
  // Durable preference toggle shared by Settings and the chat composer toolbar.
  // @see docs/specs/214-app-chat-settings/spec.md [FR-5]
  // @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-FLOW]
  // @see docs/specs/211-app-chat-composer/spec.md [FR-11]
  // @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-CONTEXT]
  | { type: "chat/setIncludeActiveFileContext"; requestId: string; enabled: boolean }
  // Composer modified-files strip pill click — host opens path in editor; if
  // `line` is provided (1-indexed), the host reveals that line via the editor
  // selection. Optional, harness-agnostic.
  // @see docs/specs/211-app-chat-composer/spec.md [FR-10]
  // @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-FILES-STRIP]
  | { type: "chat/openFile"; path: string; line?: number };

// Extension host → Chat direction (streaming-aware event protocol)
type AgentToChat =
  | { type: "chat/state"; isStreaming: boolean; messages: ChatMessageView[]; tools: ChatToolView[] }
  | { type: "chat/messageStart"; id: string; role: ChatRole; createdAt: number; content?: string }
  | { type: "chat/messageDelta"; id: string; delta: string }
  | { type: "chat/thinkingDelta"; id: string; delta: string }
  | { type: "chat/messageEnd"; id: string; stopReason?: string }
  | { type: "chat/toolStart"; toolCallId: string; toolName: string; args: unknown }
  | {
      type: "chat/toolEnd";
      toolCallId: string;
      ok: boolean;
      summary?: string;
      // 1-indexed first-changed line forwarded from the tool result when the
      // harness reports one (e.g. pi-mono `edit.result.details.firstChangedLine`).
      // The composer modified-files strip reads this to jump the editor
      // selection on pill click. Optional and harness-agnostic.
      // @see docs/specs/211-app-chat-composer/spec.md [FR-10]
      // @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-FILES-STRIP]
      firstChangedLine?: number;
    }
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

`chat/activeDocContext` carries the active AFX document identity used by the chat composer. The
required stable fields are `format`, `section`, `docKind`, `feature`, and `approvalStatus`. Optional
fields are additive for old host/webview compatibility:

- `parsedFocuses?: FocusOption[]` for doc-action focus menus (FR-15)
- `taskPhases?: PhaseRow[]` and `signOff?: SignOffSummary` for the FR-19 brass Sign Off button on
  standard `tasks.md` — sprint files keep `signOff` undefined since their Work Sessions table lives
  in the SESSIONS slice
- `specStatus?: string | null`, `designStatus?: string | null`, `tasksStatus?: string | null`,
  `tasksCompleted?: number`, `tasksTotal?: number` drive the FR-16/FR-17 spec stepper pills
  (`[1 Spec ✓] [2 Design …] [3 Tasks 3/8]`). Standard 4-file features read sibling
  spec/design/tasks frontmatter on activation and cache the result; sprint files derive the same
  shape from the in-file `approval` block. `onDidSaveTextDocument` invalidates the cache so the
  stepper stays fresh when a sibling is approved/refined in another tab. The terminal `Code`
  pseudo-pill was dropped — the action row covers the implementation phase. Glyphs are plain
  text (`✓ … ! ·`) so they match the `font-mono text-[10px]` pill metric (the previous emoji
  `⏳ ⚠` rendered too tall and broke the pill's vertical bounds)
- `workSessionsTotal?: number`, `workSessionsSigned?: number` — row counts for the
  `## Work Sessions` table in standard `tasks.md` (or the SESSIONS slice of a sprint file).
  `total` = data rows, `signed` = rows with a ticked Human cell. Drives the stepper's tier-2
  `Work Sessions n/m` chip label so the number reflects actual session-log progress, NOT the
  unrelated body-checkbox `tasksCompleted/Total` fraction. Computed host-side via
  `summarizeWorkSessions()` in `services/tasks-signoff.ts`
- `siblingPaths?: { spec?, design?, tasks?, journal?: string }` — absolute paths to sibling SDD
  files for the current feature, populated by `collectSiblingPaths(featureDir)` only when each
  file exists on disk. Powers the spec stepper's per-pill click-to-open in standard mode. When
  the host misses populating an entry but the corresponding sibling status proves the file
  exists, the webview falls back to deriving `<dirname>/<key>.md` from the active doc's path so
  the pill stays clickable
- `sectionOffsets?: { spec?, design?, tasks?, sessions?: number }` — 1-indexed line numbers for
  in-file section headings. Sprint files populate all four (via `extractSprintSectionOffsets()`);
  standard `tasks.md` populates only `sessions` (via `extractStandardWorkSessionsOffset()`). The
  spec stepper dispatches `chat/openFile { path, line }` so clicking a pill scrolls the editor to
  the matching `## SPEC` / `## DESIGN` / `## TASKS` / `## Work Sessions` heading. Sprint cursor
  in the SESSIONS slice rolls up to `section: "TASKS"` so the strip + stepper stay visible
  while the user edits the work-log table

`FocusOption` uses stable `id`, display `label`, markdown `slug`, optional `commandSuffix`, optional
body `excerpt`, and 1-indexed `line`. `SignOffSummary` reports whether all tasks are checked, all
Agent cells are checked, how many Human sign-off rows are pending, and whether the frontmatter is
already `Living`.

#### Host-Action Envelope (FR-14)

The composer surfaces a single deterministic mutation today — `tasks.signOff` — through an
explicit `chat/hostAction` outbound message rather than an LLM round-trip. The host re-parses the
target document, applies a single `vscode.WorkspaceEdit` (Human cells + status promotion +
`updated_at` bump), saves, and posts a separate `agent/signOffComplete` event back so the webview
can render a toast. This pattern matches the existing fire-and-forget dispatch convention; new
host actions land here as additional discriminator values rather than callback envelopes:

```typescript
type ChatToAgent =
  | …
  | { type: "chat/hostAction"; requestId: string; action: "tasks.signOff"; uri: string };

type AgentToChat =
  | …
  | {
      type: "agent/signOffComplete";
      requestId: string;
      uri: string;
      ok: boolean;
      rowsTicked?: number;
      newStatus?: string;
      error?: string;
    };
```

### [DES-SHARED-CHAT-VIEW-TYPES] Chat View Types

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
  /**
   * 1-indexed first-changed line from the underlying tool result. Populated by
   * `chat/toolEnd` when the harness reports it. The composer modified-files
   * strip reads this field to jump the editor selection on pill click.
   */
  firstChangedLine?: number;
}

interface ChatUsageView {
  tokens: { input: number; output: number; cacheRead: number; cacheWrite: number; total: number };
  cost: number;
  contextUsage?: { tokens: number | null; contextWindow: number; percent: number | null };
}
```

### [DES-SHARED-SETTINGS-SNAPSHOT] Settings Snapshot

`SettingsSnapshot` is the shared shape the extension host sends to webviews when they need durable
UI state. The active-file context toggle lives here so the settings panel and chat composer can
render and persist the same default.

```typescript
interface SettingsSnapshot {
  appearance: RuntimeAppearanceSnapshot;
  engine: {
    rpcEnabled: boolean;
    agentBinary: string;
    bundledSkillsPath: string;
    bundledSkillCount: number;
    ephemeral: boolean;
  };
  context: {
    includeActiveFileContext: boolean;
  };
  sdk?: SettingsSdkSnapshot;
  providers: SettingsProviderSnapshot[];
  externalAgents?: SettingsExternalAgentSnapshot[];
  diagnostics: { logLevel: string };
  telemetry: {
    enabled: boolean;
    effectiveEnabled: boolean;
    vscodeTelemetryEnabled: boolean;
  };
  about: { extensionVersion: string; bundledPiNpmVersion?: string };
}
```

### [DES-SHARED-AGENT-CONTRACT] Agent Contract

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

### [DES-SHARED-DOMAIN-TYPES] Domain Types

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

### [DES-SHARED-WORKBENCH-PROTOCOL] Workbench Protocol And Types

`packages/shared/src/workbench-protocol.ts` owns the host/webview protocol for
the Workbench bottom panel, while `packages/shared/src/workbench-types.ts` owns
the durable row models rendered by Workbench views.

```text
apps/vscode/src/panels/workbench-panel.ts
  -> WorkbenchInbound: afxUpdate | afxDocContent | afxAppearanceUpdated | afxTelemetryUpdated
  -> apps/workbench/src/lib/bridge.ts
  -> apps/workbench/src/context/workbench-context.tsx

apps/workbench/src/views/*
  -> WorkbenchOutbound: afxReady | afxOpenFile | afxFetchDocContent
                      | afxSelectFeature | afxChangeStatus
                      | afxToggleTask | afxToggleSession
                      | afxSaveFile | afxAppendNote | afxDeleteNote
```

### [DES-SHARED-WORKBENCH-TYPES] Workbench Row Models

| Type               | Source                                   | Consumers                                       |
| ------------------ | ---------------------------------------- | ----------------------------------------------- |
| `PipelineRow`      | `packages/shared/src/workbench-types.ts` | Pipeline, Analytics, Workbench feature selector |
| `FeatureTasksData` | `packages/shared/src/workbench-types.ts` | Workbench tasks/sessions columns                |
| `DocumentRow`      | `packages/shared/src/workbench-types.ts` | Documents browser and reader                    |
| `JournalEntry`     | `packages/shared/src/workbench-types.ts` | Journal view and Analytics activity metrics     |
| `KanbanData`       | `packages/shared/src/workbench-types.ts` | Board view                                      |
| `QuickNote`        | `packages/shared/src/workbench-types.ts` | Notes view                                      |
| `GhostTaskResult`  | `packages/shared/src/workbench-types.ts` | Analytics and Documents attention surfaces      |

### [DES-SHARED-PROVIDER-CATALOG] Provider Catalog

`packages/shared/src/provider-catalog.ts` is the shared provider registry used by
host/runtime settings and webview provider cards. It keeps provider display
metadata, default model IDs, and Pi-compatible environment variable aliases out
of UI-specific code.

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

### [DES-SHARED-TEST-UNIT] Unit Tests

- `constants.test.ts` covers exported constants
- Types are structural — validated at compile time, not runtime

---

## [DES-ROLLOUT] Migration / Rollout Plan

### [DES-SHARED-ROLLOUT-INITIAL] Initial Implementation

1. Define message discriminated unions in `messages.ts`
2. Define domain types in `types.ts`
3. Re-export all from `index.ts`

### [DES-SHARED-ROLLOUT-ROLLBACK] Rollback Plan

Revert `messages.ts` and `types.ts` to previous version; all consumers recompile.

---

## [DES-SHARED-LOC] Code Locator Map

<!-- @see spec.md [FR-1] [FR-2] [FR-3] [FR-4] [FR-5] [FR-6] -->

| Shared contract           | Source anchor                                                      | Design node                       | Downstream consumers                     |
| ------------------------- | ------------------------------------------------------------------ | --------------------------------- | ---------------------------------------- |
| Barrel exports            | `packages/shared/src/index.ts`                                     | `[DES-API]`                       | all apps/packages                        |
| Chat protocol             | `packages/shared/src/messages.ts`                                  | `[DES-SHARED-CHAT-PROTOCOL]`      | chat bridge, sidebar panel, transport    |
| Chat timeline view models | `packages/shared/src/messages.ts`, `packages/shared/src/agent.ts`  | `[DES-SHARED-CHAT-VIEW-TYPES]`    | chat timeline, history, mock transport   |
| Workbench protocol        | `packages/shared/src/workbench-protocol.ts`                        | `[DES-SHARED-WORKBENCH-PROTOCOL]` | workbench bridge, workbench panel        |
| Workbench row models      | `packages/shared/src/workbench-types.ts`                           | `[DES-SHARED-WORKBENCH-TYPES]`    | workbench views, specs-data service      |
| Agent contract            | `packages/shared/src/agent.ts`                                     | `[DES-SHARED-AGENT-CONTRACT]`     | agent managers, extension host           |
| Domain constants/types    | `packages/shared/src/constants.ts`, `packages/shared/src/types.ts` | `[DES-SHARED-DOMAIN-TYPES]`       | commands, parser/feature surfaces        |
| Provider catalog          | `packages/shared/src/provider-catalog.ts`                          | `[DES-SHARED-PROVIDER-CATALOG]`   | settings/provider cards, agent factory   |
| Structured logger         | `packages/shared/src/logger.ts`                                    | `[DES-LOG]`                       | extension host, webviews, agent packages |

---

## [DES-SHARED-TRACE] 1:1 Code/Spec Matrix

| Requirement | Design node                                                       | Source anchor                                                                         |
| ----------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `[FR-1]`    | `[DES-SHARED-CHAT-PROTOCOL]`                                      | `packages/shared/src/messages.ts`                                                     |
| `[FR-2]`    | `[DES-SHARED-CHAT-VIEW-TYPES]`                                    | `packages/shared/src/messages.ts`, `packages/shared/src/agent.ts`                     |
| `[FR-3]`    | `[DES-SHARED-DOMAIN-TYPES]`                                       | `packages/shared/src/types.ts`, `packages/shared/src/constants.ts`                    |
| `[FR-4]`    | `[DES-SHARED-WORKBENCH-PROTOCOL]`, `[DES-SHARED-WORKBENCH-TYPES]` | `packages/shared/src/workbench-protocol.ts`, `packages/shared/src/workbench-types.ts` |
| `[FR-5]`    | `[DES-SHARED-AGENT-CONTRACT]`                                     | `packages/shared/src/agent.ts`                                                        |
| `[FR-6]`    | `[DES-LOG]`                                                       | `packages/shared/src/logger.ts`                                                       |
| `[NFR-1]`   | `[DES-DEPS]`                                                      | `packages/shared/src/no-react.test.ts`                                                |
| `[NFR-2]`   | `[DES-DEPS]`                                                      | `packages/shared/package.json`                                                        |

---

## [DES-SHARED-REFS] File Reference Map

| Task | File                                        | Required @see                                                    |
| ---- | ------------------------------------------- | ---------------------------------------------------------------- |
| —    | `packages/shared/src/index.ts`              | `spec.md [FR-1]` + `design.md [DES-API]`                         |
| —    | `packages/shared/src/agent.ts`              | `spec.md [FR-5]` + `design.md [DES-SHARED-AGENT-CONTRACT]`       |
| —    | `packages/shared/src/logger.ts`             | `spec.md [FR-6]` + `design.md [DES-LOG]`                         |
| —    | `packages/shared/src/messages.ts`           | `spec.md [FR-1] [FR-2]` + `design.md [DES-SHARED-CHAT-PROTOCOL]` |
| —    | `packages/shared/src/workbench-protocol.ts` | `spec.md [FR-4]` + `design.md [DES-SHARED-WORKBENCH-PROTOCOL]`   |
| —    | `packages/shared/src/workbench-types.ts`    | `spec.md [FR-4]` + `design.md [DES-SHARED-WORKBENCH-TYPES]`      |
| —    | `packages/shared/src/provider-catalog.ts`   | `design.md [DES-SHARED-PROVIDER-CATALOG]`                        |
| —    | `packages/shared/src/types.ts`              | `spec.md [FR-3]` + `design.md [DES-SHARED-DOMAIN-TYPES]`         |
| —    | `packages/shared/src/constants.ts`          | `spec.md [FR-3]` + `design.md [DES-SHARED-DOMAIN-TYPES]`         |
