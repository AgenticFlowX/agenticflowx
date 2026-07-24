---
afx: true
type: DESIGN
status: Approved
owner: "@rixrix"
version: "2.3"
created_at: "2026-04-26T04:32:48.000Z"
updated_at: "2026-07-19T03:39:36.000Z"
tags:
  [
    "package",
    "shared",
    "protocol",
    "types",
    "agent",
    "logging",
    "traceability",
    "revisions",
    "mutations",
    "canvas",
    "multi-root",
  ]
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
    ├── intent.ts       ← Composer Intent modes, slots, state
    ├── intent-prompts.ts ← parent-aware Composer Intent prompt registry
    ├── intent-copy.ts  ← human-facing Composer Intent labels/tooltips
    ├── workbench-types.ts ← source identities, revisions, Canvas and Workbench domain types
    ├── workbench-protocol.ts ← typed host/webview Workbench message unions
    ├── types.ts        ← domain types: Task, Spec, Phase, Feature, Discussion …
    └── constants.ts    ← shared string constants
```

`@afx/shared` has no dependencies. All packages and apps import from it.

---

## [DES-UI] User Interface & UX

`@afx/shared` renders no UI. It defines the state and result vocabulary that
lets Workbench consumers render truthful pending, success, conflict, dirty,
stale, disabled, and recovery states without inferring host behavior. Human
copy and component layout remain owned by the consuming app specs.

---

## [DES-DEC] Key Decisions

| Decision              | Options Considered                                          | Choice              | Rationale                                                                                 |
| --------------------- | ----------------------------------------------------------- | ------------------- | ----------------------------------------------------------------------------------------- |
| Message typing        | Plain `{ type: string, payload: any }`, discriminated union | Discriminated union | TypeScript narrows on `type` field; no runtime schema needed                              |
| Domain types location | Per-package, shared library                                 | Shared library      | Single source of truth; prevents drift between extension host and webview                 |
| View types            | Inline in app, shared                                       | Shared              | `ChatMessageView` used by both the extension host (to construct) and chat app (to render) |

Additional approved decisions:

- Mutation completion uses a correlated terminal result rather than
  fire-and-forget success, so revision conflicts remain explicit.
- Source identity uses a canonical workspace root plus relative path rather
  than falling back to the first workspace folder.
- View persistence stores hidden IDs rather than a visible allowlist, so new
  views appear by default and all-hidden recovery is deterministic.
- Canvas uses a plural descriptor/document protocol so Workbench and multiple
  editor-area instances share one contract.

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
  // Composer modified-files strip pill click defaults to the source editor; if
  // `line` is provided (1-indexed), the host reveals that line via the editor
  // selection. Composer preview actions may pass `mode: "afxPreview"` to open
  // the editor-area AFX Preview instead. Optional, harness-agnostic.
  // @see docs/specs/211-app-chat-composer/spec.md [FR-10]
  // @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-FILES-STRIP]
  | { type: "chat/openFile"; path: string; line?: number; mode?: "editor" | "afxPreview" };

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

`chat/activeDocContext` carries the active AFX document identity used by the chat composer.

| Stable field     | Purpose                                         |
| ---------------- | ----------------------------------------------- |
| `format`         | Distinguishes sprint, 4-file SDD, journal, etc. |
| `section`        | Current in-document workflow section.           |
| `docKind`        | Action catalog key for the active document.     |
| `feature`        | Feature identity used for sibling lookup.       |
| `approvalStatus` | Current lifecycle state for the active doc.     |

Optional fields are additive so older hosts/webviews can safely omit them:

| Optional field(s)                                             | Producer                                         | Consumer / UI                                | Notes                                                                                      |
| ------------------------------------------------------------- | ------------------------------------------------ | -------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `parsedFocuses?: FocusOption[]`                               | Focus parser                                     | Doc-action focus menus                       | Drives FR-15 scoped refine/discuss menus.                                                  |
| `taskPhases?: PhaseRow[]`, `signOff?: SignOffSummary`         | Standard `tasks.md` parser                       | FR-19 brass `Sign Off` button                | Sprint files leave `signOff` undefined because Work Sessions live in the SESSIONS slice.   |
| `specStatus`, `designStatus`, `tasksStatus`                   | Sibling frontmatter or sprint `approval` block   | Stepper pills 1-3                            | Cache invalidates on `onDidSaveTextDocument`; no terminal `Code` pill.                     |
| `tasksCompleted?: number`, `tasksTotal?: number`              | Task checkbox summary                            | Tasks pill fraction                          | Represents task body checkboxes only.                                                      |
| `workSessionsTotal?: number`, `workSessionsSigned?: number`   | `summarizeWorkSessions()` in `tasks-signoff.ts`  | Fourth `Work n/m` pill                       | Counts Work Sessions rows and ticked Human cells; never reuses `tasksCompleted/Total`.     |
| `siblingPaths?: { spec?, design?, tasks?, journal?: string }` | `collectSiblingPaths(featureDir)`                | Standard-mode stepper click-to-open          | Webview may derive `<dirname>/<key>.md` when status proves a sibling exists.               |
| `sectionOffsets?: { spec?, design?, tasks?, sessions? }`      | Sprint/standard Work Sessions heading extractors | Sprint and Work Sessions click-to-line jumps | Values are 1-indexed lines for `chat/openFile { path, line }`; SESSIONS remains `section`. |

| Supporting type   | Shape                                                                                                                       |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `FocusOption`     | Stable `id`, display `label`, markdown `slug`, 1-indexed `line`, optional `commandSuffix`, optional body `excerpt`.         |
| `SignOffSummary`  | All-task checkbox state, all-Agent-cell state, pending Human sign-off count, and whether frontmatter is already `Living`.   |
| Stepper glyph set | Plain text only (`✓ … ! ·`) to preserve the `font-mono text-[10px]` pill metric; emoji rendered too tall in prior attempts. |

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

#### Editor-Area Preview Message (FR-16)

The host can drive a standalone editor-area preview that reuses the Workbench bundle
(`data-afx-view="preview"` boot mode) rather than the bottom-panel tab shell. Two protocol
additions support this:

- **Inbound** `afxPreviewShow` (host -> webview) — pushes the full document text into the preview
  panel. `content` is the in-memory editor buffer (so unsaved/live-on-type edits render); `filePath`
  is workspace-relative for display only; `isAfxHint` is an optional, non-authoritative first-paint
  hint to avoid layout flicker (the webview re-derives AFX-vs-generic from `content`). The preview
  panel never calls `afxFetchDocContent`; content always arrives inside this message.

  ```typescript
  type WorkbenchInbound =
    | …
    | { type: "afxPreviewShow"; filePath: string; content: string; isAfxHint?: boolean };
  ```

- **Outbound** `afxOpenFile.mode` gains an `"afxPreview"` value alongside the existing
  `"editor" | "preview"`. Workbench-originated "Open AFX Preview" clicks send
  `afxOpenFile { path, mode: "afxPreview" }`; the host resolves the workspace-relative path and opens
  the same singleton editor-area preview panel used by the `afx.openAfxPreview` command. `"editor"`
  still opens the file in the editor and `"preview"` still opens the native markdown preview.

  ```typescript
  // WorkbenchOutbound
  | { type: "afxOpenFile"; path: string; mode: "editor" | "preview" | "afxPreview" };
  ```

The host-side panel lifecycle, `afxReady`->`afxPreviewShow` handshake, and live-on-type push are
owned by `202-app-vscode-editor-actions` (`[DES-ACTION-PREVIEW-PANEL]`); the standalone webview boot
mode is owned by `227-app-workbench-shell` (`[DES-SHELL-PREVIEW-MODE]`); the `<DocPreview>` rendering
contract is owned by `222-app-workbench-documents` (`[DES-DOCS-PREVIEW-STANDALONE]`).

#### Preview-Side Outbound Mutations (FR-16)

The preview panel adds three outbound messages so the standalone webview can drive deterministic
document mutations without binding to VSCode APIs. The host is the single point of write — the
webview never touches the filesystem:

- **`afxCopyMarkdown { content; label? }`** — copies the raw markdown source through
  `vscode.env.clipboard.writeText`. Driven by the `<CopyMarkdownButton>` in the reader. Falls back
  to the browser Clipboard API outside the webview (mock dev), so the message is webview-only.
- **`afxToggleSession { filePath; sessionIndex; column: "agent" | "human"; completed; line? }`** —
  tightens the existing toggle: `column` is a literal union (`"agent" | "human"`) and an optional
  `line` (1-indexed source line of the row) lets the preview path toggle by exact source line to
  avoid row-index drift after markdown cleanup/normalization. The legacy `sessionIndex` path remains
  for callers that count rows.
- **`afxToggleAllSessions { filePath; column: "agent" | "human"; completed }`** — bulk-toggle every
  row's Agent or Human cell, used by the `<SessionSignoffToolbar>` "Select all" controls.
- **`afxApproveSessions { filePath }`** — for every row where Agent is checked and Human is not,
  check Human. The session signoff "Approve" affordance routes through this.

```typescript
type WorkbenchOutbound =
  | …
  | { type: "afxCopyMarkdown"; content: string; label?: string }
  | {
      type: "afxToggleSession";
      filePath: string;
      sessionIndex: number;
      column: "agent" | "human";
      completed: boolean;
      line?: number;
    }
  | {
      type: "afxToggleAllSessions";
      filePath: string;
      column: "agent" | "human";
      completed: boolean;
    }
  | { type: "afxApproveSessions"; filePath: string };
```

The host-side mutation helpers (`toggleMarkdownCheckboxLine`,
`toggleWorkSessionCheckbox(Line)`, `toggleAllWorkSessionCheckboxes`,
`approveWorkSessionCheckboxes`) live in `apps/vscode/src/panels/markdown-checkbox-toggle.ts` and are
shared by `workbench-panel.ts` and `afx-preview-panel.ts`. The preview workflow surface is owned by
`222-app-workbench-documents` (`[DES-DOCS-PREVIEW-STANDALONE]`) and the workbench surface by
`227-app-workbench-shell` (`[DES-SHELL-FEATURE-COLUMNS]`).

### [DES-SHARED-WORKBENCH-IDENTITY] Source Identity And Revision (FR-17, FR-18)

Workbench payloads use a canonical identity instead of assuming the first
workspace folder. Paths shown to users remain relative, while `rootUri` and
`relativePath` form the host-owned lookup key. `revision` represents the exact
content projected to the webview; an open unsaved document may therefore carry
a `documentVersion` and `dirty: true` even when its disk fingerprint is older.

```typescript
interface WorkbenchSourceIdentity {
  rootUri: string;
  rootName: string;
  relativePath: string;
}

interface WorkbenchSourceRevision {
  contentRevision: string;
  diskRevision?: string;
  documentVersion?: number;
  dirty: boolean;
}

interface WorkbenchSourceSnapshot {
  source: WorkbenchSourceIdentity;
  revision: WorkbenchSourceRevision;
}
```

The webview treats the identity as opaque and always returns it unchanged.
Only the host resolves it to a `vscode.Uri`; this prevents accidental
cross-root writes and keeps `@afx/shared` free of VS Code and Node APIs.

### [DES-SHARED-WORKBENCH-MUTATIONS] Acknowledged Mutation Result (FR-17)

Every mutating `WorkbenchOutbound` variant carries `requestId`, `target`, and
`expectedRevision`. The host emits exactly one terminal `afxMutationResult` for
that request. Success returns the confirmed source revision; conflict and error
preserve an actionable message and stable machine-readable code.

```typescript
interface WorkbenchMutationTarget {
  source: WorkbenchSourceIdentity;
  expectedRevision: string;
}

type WorkbenchMutationResult =
  | {
      type: "afxMutationResult";
      requestId: string;
      outcome: "success";
      target: WorkbenchSourceIdentity;
      revision: WorkbenchSourceRevision;
    }
  | {
      type: "afxMutationResult";
      requestId: string;
      outcome: "conflict" | "error";
      target: WorkbenchSourceIdentity;
      code:
        | "stale-revision"
        | "dirty-document"
        | "outside-workspace"
        | "not-found"
        | "parse-error"
        | "write-failed";
      message: string;
      revision?: WorkbenchSourceRevision;
      retryable: boolean;
    };
```

The result envelope is shared by Notes, Board, Canvas, document task/session
toggles, and future Workbench writers. Feature-specific mutation payloads stay
discriminated; only completion semantics are common.

### [DES-SHARED-CANVAS-PROTOCOL] Canvas Library And Editor Protocol (FR-19)

Canvas is plural and document-addressed. Shared types include
`CanvasDescriptor`, `CanvasDocumentSnapshot`, `CanvasKind`, standard JSON
Canvas node/edge shapes, namespaced optional AFX metadata/actions, and the
source/revision fields above. Unknown extension properties remain representable
and must survive parse/serialize cycles.

Outbound messages are discriminated variants for:

- `afxCanvasList`, `afxCanvasSelect`, `afxCanvasCreate`, `afxCanvasRename`,
  `afxCanvasDuplicate`, and `afxCanvasDelete`;
- `afxCanvasSave` and `afxCanvasRefreshDependencies` with request correlation
  and expected revision;
- `afxOpenCanvasEditor` for `vscode.openWith` routing;
- `afxCanvasEditorReady`, `afxCanvasApplyMutation`, and
  `afxCanvasEditorSetViewState` for the editor-area custom-editor boot target.

Inbound messages include:

- `afxCanvasLibrary` and `afxCanvasDocument` for descriptor/document hydration;
- `afxCanvasEditorDocument` for editor-area content/version updates;
- the common `afxMutationResult` for create/rename/duplicate/delete/save and
  dependency refresh;
- `afxCanvasEditorState` for view-local selection/viewport restoration only.

Document content is never embedded in generic settings snapshots. Canvas
descriptor messages carry identity and metadata; document messages carry one
selected document and its revision. View state is not persisted into portable
JSON Canvas unless the user performs a document mutation.

### [DES-SHARED-VIEW-VISIBILITY] Workbench View Visibility (FR-20)

```typescript
type WorkbenchViewId =
  | "workbench"
  | "pipeline"
  | "documents"
  | "analytics"
  | "journal"
  | "board"
  | "notes"
  | "canvas";

interface SettingsSnapshot {
  experimental: {
    canvasEnabled: boolean;
    workbenchHiddenViews: WorkbenchViewId[];
  };
}
```

`experimental/setWorkbenchHiddenViews { requestId, hidden }` updates the
workspace/window-scoped hidden set. Consumers intersect this set with their
registered view IDs. A newly registered view therefore remains visible until a
user explicitly hides it. `canvasEnabled` is an independent capability flag:
hiding the Canvas tab does not disable the editor-area Canvas command.

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

New Workbench contracts in the same module are
`WorkbenchSourceSnapshot`, `CanvasDescriptor`, `CanvasDocumentSnapshot`, and
`WorkbenchViewId`. They serve live source-backed views, the Canvas library and
custom editor, selected Canvas revisions, and Settings/shell visibility.

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
export type {
  WorkbenchSourceIdentity,
  WorkbenchSourceRevision,
  WorkbenchSourceSnapshot,
  WorkbenchMutationTarget,
  WorkbenchMutationResult,
  WorkbenchViewId,
  CanvasDescriptor,
  CanvasDocumentSnapshot,
  CanvasKind,
};
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
| `onErrorAutoShowSink` | Optional diagnostic sink that calls `channel.show(true)` on the first error record                |
| `consoleSink`         | Routes records to `console.error/warn/info/debug` for webview / browser context                   |
| `memorySink`          | Test-only — captures records for assertion (`records()`, `clear()`)                               |

A faulty sink throws are caught and isolated; logging to other sinks continues.

AFX extension activation wires `outputChannelSink(channel)` only. Errors are still logged, but the
Output panel opens only through explicit diagnostics actions such as `afx.showLogs`.

**Level resolution at app entry** (`apps/vscode/src/extension.ts`):

1. `process.env.AFX_LOG_LEVEL` (highest priority — survives editor restarts)
2. `vscode.workspace.getConfiguration("afx").get("logLevel")` (live-reactive via `onDidChangeConfiguration`)
3. `"info"` (default)

**Webview asymmetry**: webviews use `consoleSink()` only. Module-level loggers in `packages/transport/{mock,vscode}.ts`, `apps/chat/src/lib/bridge.ts`, and `apps/workbench/src/lib/bridge.ts`. No host-→-webview level forwarding in v1; deferred behind a future `transportSink` (ADR amendment if needed).

---

## [DES-FILES] File Structure

| File                                    | Purpose                                                |
| --------------------------------------- | ------------------------------------------------------ |
| `packages/shared/src/index.ts`          | Barrel — all public exports                            |
| `packages/shared/src/agent.ts`          | Agent contract — AgentManager, AgentEvent, Disposable  |
| `packages/shared/src/logger.ts`         | Structured Logger contract + sinks (DES-LOG, ADR-0003) |
| `packages/shared/src/logger.test.ts`    | Logger unit tests                                      |
| `packages/shared/src/messages.ts`       | Chat + Workbench message protocol types                |
| `packages/shared/src/intent.ts`         | Composer Intent slots, parent modes, persisted state   |
| `packages/shared/src/intent-prompts.ts` | Parent-aware Composer Intent prompt registry           |
| `packages/shared/src/intent-copy.ts`    | Human-facing Composer Intent copy helpers              |
| `packages/shared/src/types.ts`          | Domain types (Task, Spec, etc.)                        |
| `packages/shared/src/constants.ts`      | Shared string constants                                |

`packages/shared/src/workbench-types.ts` owns source identity/revision, view
IDs, and Workbench/Canvas domain contracts.
`packages/shared/src/workbench-protocol.ts` owns host/webview messages and the
correlated mutation result.

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

Mutation results without a matching pending request are logged and ignored;
they never clear another request. Consumers preserve extension data where
required and safely ignore additive fields they do not understand.

---

## [DES-TEST] Testing Strategy

### [DES-SHARED-TEST-UNIT] Unit Tests

- `constants.test.ts` covers exported constants
- Types are structural — validated at compile time, not runtime
- protocol fixture tests cover every mutation result outcome and request correlation
- compile-time fixtures cover the eight `WorkbenchViewId` values and reject arbitrary view IDs
- Canvas fixtures cover plural library/document/custom-editor messages and unknown JSON extension fields
- import-boundary tests keep `workbench-types.ts` and `workbench-protocol.ts` free of VS Code, React, Node filesystem, and runtime dependencies

---

## [DES-ROLLOUT] Migration / Rollout Plan

### [DES-SHARED-ROLLOUT-INITIAL] Initial Implementation

1. Define message discriminated unions in `messages.ts`
2. Define domain types in `types.ts`
3. Re-export all from `index.ts`
4. Add source identity/revision and correlated Workbench mutation contracts additively.
5. Migrate Notes, Board, Canvas, and shell consumers one surface at a time; keep legacy fields until all consumers compile against the new contract.
6. Add plural Canvas/editor messages before enabling the custom editor contribution.

### [DES-SHARED-ROLLOUT-ROLLBACK] Rollback Plan

Revert `messages.ts` and `types.ts` to previous version; all consumers recompile.

---

## [DES-SHARED-LOC] Code Locator Map

<!-- @see spec.md [FR-1] [FR-2] [FR-3] [FR-4] [FR-5] [FR-6] -->

| Shared contract           | Source anchor                                                                                                  | Design node                       | Downstream consumers                     |
| ------------------------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------- | ---------------------------------------- |
| Barrel exports            | `packages/shared/src/index.ts`                                                                                 | `[DES-API]`                       | all apps/packages                        |
| Chat protocol             | `packages/shared/src/messages.ts`                                                                              | `[DES-SHARED-CHAT-PROTOCOL]`      | chat bridge, sidebar panel, transport    |
| Chat timeline view models | `packages/shared/src/messages.ts`, `packages/shared/src/agent.ts`                                              | `[DES-SHARED-CHAT-VIEW-TYPES]`    | chat timeline, history, mock transport   |
| Workbench protocol        | `packages/shared/src/workbench-protocol.ts`                                                                    | `[DES-SHARED-WORKBENCH-PROTOCOL]` | workbench bridge, workbench panel        |
| Workbench row models      | `packages/shared/src/workbench-types.ts`                                                                       | `[DES-SHARED-WORKBENCH-TYPES]`    | workbench views, specs-data service      |
| Agent contract            | `packages/shared/src/agent.ts`                                                                                 | `[DES-SHARED-AGENT-CONTRACT]`     | agent managers, extension host           |
| Domain constants/types    | `packages/shared/src/constants.ts`, `packages/shared/src/types.ts`                                             | `[DES-SHARED-DOMAIN-TYPES]`       | commands, parser/feature surfaces        |
| Composer Intent contracts | `packages/shared/src/intent.ts`, `packages/shared/src/intent-prompts.ts`, `packages/shared/src/intent-copy.ts` | `[DES-SHARED-CHAT-PROTOCOL]`      | chat composer, settings, extension host  |
| Provider catalog          | `packages/shared/src/provider-catalog.ts`                                                                      | `[DES-SHARED-PROVIDER-CATALOG]`   | settings/provider cards, agent factory   |
| Structured logger         | `packages/shared/src/logger.ts`                                                                                | `[DES-LOG]`                       | extension host, webviews, agent packages |

Realtime additions:

| Contract                  | Source                                        | Design node                        | Consumers                                 |
| ------------------------- | --------------------------------------------- | ---------------------------------- | ----------------------------------------- |
| Source identity/revisions | `workbench-types.ts`                          | `[DES-SHARED-WORKBENCH-IDENTITY]`  | Live host service and source-backed views |
| Mutation results          | `workbench-protocol.ts`                       | `[DES-SHARED-WORKBENCH-MUTATIONS]` | Host coordinator and child pending states |
| Canvas library/editor     | `workbench-types.ts`, `workbench-protocol.ts` | `[DES-SHARED-CANVAS-PROTOCOL]`     | Canvas view, custom editor, host service  |
| Workbench visibility      | `workbench-types.ts`, `messages.ts`           | `[DES-SHARED-VIEW-VISIBILITY]`     | Settings, sidebar host, shell             |

---

## [DES-SHARED-TRACE] 1:1 Code/Spec Matrix

| Requirement | Design node                                                       | Source anchor                                                                                                                                     |
| ----------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `[FR-1]`    | `[DES-SHARED-CHAT-PROTOCOL]`                                      | `packages/shared/src/messages.ts`                                                                                                                 |
| `[FR-2]`    | `[DES-SHARED-CHAT-VIEW-TYPES]`                                    | `packages/shared/src/messages.ts`, `packages/shared/src/agent.ts`                                                                                 |
| `[FR-3]`    | `[DES-SHARED-DOMAIN-TYPES]`                                       | `packages/shared/src/types.ts`, `packages/shared/src/constants.ts`                                                                                |
| `[FR-4]`    | `[DES-SHARED-WORKBENCH-PROTOCOL]`, `[DES-SHARED-WORKBENCH-TYPES]` | `packages/shared/src/workbench-protocol.ts`, `packages/shared/src/workbench-types.ts`                                                             |
| `[FR-5]`    | `[DES-SHARED-AGENT-CONTRACT]`                                     | `packages/shared/src/agent.ts`                                                                                                                    |
| `[FR-6]`    | `[DES-LOG]`                                                       | `packages/shared/src/logger.ts`                                                                                                                   |
| `[FR-15]`   | `[DES-SHARED-CHAT-PROTOCOL]`                                      | `packages/shared/src/intent.ts`, `packages/shared/src/intent-prompts.ts`, `packages/shared/src/intent-copy.ts`, `packages/shared/src/messages.ts` |
| `[NFR-1]`   | `[DES-DEPS]`                                                      | `packages/shared/src/no-react.test.ts`                                                                                                            |
| `[NFR-2]`   | `[DES-DEPS]`                                                      | `packages/shared/package.json`                                                                                                                    |

| Requirement | Design node                                                       | Source anchor                                                                         |
| ----------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `[FR-17]`   | `[DES-SHARED-WORKBENCH-MUTATIONS]`                                | `packages/shared/src/workbench-protocol.ts`                                           |
| `[FR-18]`   | `[DES-SHARED-WORKBENCH-IDENTITY]`, `[DES-SHARED-WORKBENCH-TYPES]` | `packages/shared/src/workbench-types.ts`                                              |
| `[FR-19]`   | `[DES-SHARED-CANVAS-PROTOCOL]`                                    | `packages/shared/src/workbench-types.ts`, `packages/shared/src/workbench-protocol.ts` |
| `[FR-20]`   | `[DES-SHARED-VIEW-VISIBILITY]`                                    | `packages/shared/src/workbench-types.ts`, `packages/shared/src/messages.ts`           |

---

## [DES-SHARED-REFS] File Reference Map

| Task | File                                        | Required @see                                                    |
| ---- | ------------------------------------------- | ---------------------------------------------------------------- |
| —    | `packages/shared/src/index.ts`              | `spec.md [FR-1]` + `design.md [DES-API]`                         |
| —    | `packages/shared/src/agent.ts`              | `spec.md [FR-5]` + `design.md [DES-SHARED-AGENT-CONTRACT]`       |
| —    | `packages/shared/src/logger.ts`             | `spec.md [FR-6]` + `design.md [DES-LOG]`                         |
| —    | `packages/shared/src/messages.ts`           | `spec.md [FR-1] [FR-2]` + `design.md [DES-SHARED-CHAT-PROTOCOL]` |
| —    | `packages/shared/src/intent.ts`             | `spec.md [FR-15]` + `design.md [DES-SHARED-CHAT-PROTOCOL]`       |
| —    | `packages/shared/src/intent-prompts.ts`     | `spec.md [FR-15]` + `design.md [DES-SHARED-CHAT-PROTOCOL]`       |
| —    | `packages/shared/src/intent-copy.ts`        | `spec.md [FR-15]` + `design.md [DES-SHARED-CHAT-PROTOCOL]`       |
| —    | `packages/shared/src/workbench-protocol.ts` | `spec.md [FR-4]` + `design.md [DES-SHARED-WORKBENCH-PROTOCOL]`   |
| —    | `packages/shared/src/workbench-types.ts`    | `spec.md [FR-4]` + `design.md [DES-SHARED-WORKBENCH-TYPES]`      |
| —    | `packages/shared/src/provider-catalog.ts`   | `design.md [DES-SHARED-PROVIDER-CATALOG]`                        |
| —    | `packages/shared/src/types.ts`              | `spec.md [FR-3]` + `design.md [DES-SHARED-DOMAIN-TYPES]`         |
| —    | `packages/shared/src/constants.ts`          | `spec.md [FR-3]` + `design.md [DES-SHARED-DOMAIN-TYPES]`         |

Realtime reference additions:

| File                                        | Required @see                                                                                                                            |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/shared/src/workbench-protocol.ts` | `spec.md [FR-17] [FR-19]`; `design.md [DES-SHARED-WORKBENCH-MUTATIONS] [DES-SHARED-CANVAS-PROTOCOL]`                                     |
| `packages/shared/src/workbench-types.ts`    | `spec.md [FR-18] [FR-19] [FR-20]`; `design.md [DES-SHARED-WORKBENCH-IDENTITY] [DES-SHARED-CANVAS-PROTOCOL] [DES-SHARED-VIEW-VISIBILITY]` |
