---
afx: true
type: DESIGN
status: Draft
owner: "@rixrix"
version: "1.3"
created_at: "2026-05-02T23:56:50.000Z"
updated_at: "2026-07-19T00:25:48.000Z"
tags: ["app", "chat", "history", "sessions", "persistence", "reopen"]
spec: spec.md
---

# App Chat History - Technical Design

---

## [DES-OVR] Overview

The history zone renders the chat webview's active-session work log. It owns the
visible History tab, local filtering/search, runtime state branches, context
save affordance, and the data adapter that converts current chat timeline items
into narrative/trace/audit event rows.

Chat-window componentization reserves future load/export slots in `docs/specs/216-app-chat-window-componentization/design.md [DES-HISTORY]`. This history spec remains the behavior owner for persistence format, load UX, export schema, and reload semantics in a follow-on pass.

---

## [DES-ARCH] Architecture

```text
@afx/shared ChatTimelineItem[]
        |
        v
apps/chat/src/lib/history-events.ts
  deriveHistoryEvents()
  -> ChatHistoryEvent[]
        |
        v
apps/chat/src/views/history.tsx
  bridgeOn(...) + bridgeSend("chat/getState")
  -> local density/search/grouping state
  -> History tab UI states and rows
```

---

## [DES-UI] User Interface & UX

History should be scannable, compact, and clear about empty/error states.

---

## [DES-HISTORY-MOCKUPS] ASCII UI Mockups

<!-- @see docs/specs/213-app-chat-history/spec.md [FR-1] [NFR-1] -->

These mockups are screen-like wireframes for implementation planning. They are
not pixel-perfect, but should stay close enough that a future agent can point at
one visible region or state and make a surgical change in `history.tsx`.

### [DES-HISTORY-MOCKUP-LIVE] Populated Active Session

```text
+------------------------------------------------------------------+
| [msg] History                                      [Refresh]      |
|       Active session work log  a1b2c3d4                          |
|       [12 events] [8 messages] [2 queued] [live]                 |
+------------------------------------------------------------------+
| Context                                                          |
|                                                                  |
| Agent session                                                    |
| The agent manages conversation history, tool calls, and          |
| compaction automatically. Session a1b2c3d4                       |
|                                                                  |
| --------------------------------------------------------------   |
|                                                                  |
| AFX workspace context                                  [Save]    |
| No workspace context saved yet. Run /afx-context save to         |
| capture a summary you can reload in future sessions.             |
+------------------------------------------------------------------+
| [narrative] [trace] [audit]                                      |
| [ Search work log...                                           ] |
+------------------------------------------------------------------+
| Today                                                            |
| ---------------------------------------------------------------- |
| [user] Asked       Update the chat footer hint             14:02 |
| [edit] Edited      apps/chat/src/views/chat.tsx            14:04 |
|        replace_string                                            |
| [cmd ] Used        12.5k tokens                            14:05 |
|        Context 42%                                               |
| [bot ] Answered    Updated footer copy and tests           14:06 |
+------------------------------------------------------------------+
```

### [DES-HISTORY-MOCKUP-EMPTY] Empty Or Setup State

```text
+------------------------------------------------------------------+
| [msg] History                                      [Refresh]      |
|       Start a thread to build the work log                       |
|       [0 events] [0 messages] [setup]                            |
+------------------------------------------------------------------+
| Context                                                          |
| AFX workspace context                                  [Save]    |
| No workspace context saved yet. Run /afx-context save.            |
+------------------------------------------------------------------+
| [narrative] [trace] [audit]                                      |
| [ Configure a runtime to load the work log...                  ] |
+------------------------------------------------------------------+
|                                                                  |
|          No runtime configured yet.                              |
|          Connect a provider in Settings to build the work log.   |
|                                                                  |
+------------------------------------------------------------------+
```

### [DES-HISTORY-MOCKUP-RECOVERY] Runtime Unavailable With Cached Rows

```text
+------------------------------------------------------------------+
| [msg] History                                      [Refresh]      |
|       Active session work log  a1b2c3d4                          |
|       [9 events] [6 messages] [cached]                           |
+------------------------------------------------------------------+
| [narrative] [trace] [audit]                                      |
| [ Search cached active-session rows...                         ] |
+------------------------------------------------------------------+
| Runtime needs attention                                          |
| The current agent runtime is disconnected.                       |
| [Retry] [Open Settings]                                          |
+------------------------------------------------------------------+
| Today (cached)                                                   |
| ---------------------------------------------------------------- |
| [user] Asked       Diagnose Pi startup                     13:48 |
| [fail] Failed      run_shell                               13:49 |
|        bash                                                        |
| [bot ] Answered    Pi runtime needs configuration           13:50 |
+------------------------------------------------------------------+
```

Source files that render the visible History UI should point at this section:
`@see docs/specs/213-app-chat-history/design.md [DES-HISTORY-MOCKUP-LIVE]`.

---

## [DES-HISTORY-COMPONENTS] ASCII Component Representation

<!-- @see docs/specs/213-app-chat-history/spec.md [FR-1] [FR-2] [NFR-1] -->

This section overlays the rendered History UI with the React component and helper
boundaries that implement it. Use this when the request names a component,
control group, row type, or state branch rather than a whole screen.

### [DES-HISTORY-COMPONENT-OVERLAY] Visible Component Ownership

```text
History()
+------------------------------------------------------------------+
| Inline header JSX                                                |
| +-- h2 "History"                                                 |
| +-- runtime subtitle + session id                                |
| +-- TraceChip x events/messages/queued/compacting/live           |
| +-- Button[Refresh] -> bridgeSend({ type: "chat/getState" })     |
+------------------------------------------------------------------+
| ContextPreviewCard                                               |
| +-- Agent session copy + runtime.sessionId                       |
| +-- AFX workspace context copy                                   |
| +-- Save button -> onInsertCommand("/afx-context save")          |
+------------------------------------------------------------------+
| Inline filter bar JSX                                            |
| +-- density buttons: narrative | trace | audit                   |
| +-- Input search query                                           |
+------------------------------------------------------------------+
| Inline body state switch                                         |
| +-- HistorySetupState                                            |
| +-- Empty setup/no-events/no-matches branches                    |
| +-- AgentRecoveryCard + cached HistorySection list               |
| +-- HistorySection[]                                             |
+------------------------------------------------------------------+
```

### [DES-HISTORY-COMPONENT-TREE] Code Ownership Tree

```text
apps/chat/src/views/history.tsx
History
|-- bridgeOn/bridgeSend state wiring
|-- useMemo derive/filter/group
|-- Header inline JSX
|   |-- TraceChip
|   `-- Button Refresh
|-- ContextPreviewCard
|-- FilterBar inline JSX
|   |-- density Button group
|   `-- Input search
|-- Body inline state switch
|   |-- HistorySetupState
|   |-- AgentRecoveryCard
|   `-- HistorySection
|       `-- HistoryEventRow
|           `-- renderEventIcon
|-- attachTool / toolArgs
|-- groupByDay / formatDay / formatTime / formatCompact
`-- eventMatches

apps/chat/src/lib/history-events.ts
deriveHistoryEvents
|-- toolEvent
|-- classifyTool
|-- compact
`-- formatCompact
```

Component-level source annotations should point at this section when the code
node exists to implement one named piece of the rendered History surface:
`@see docs/specs/213-app-chat-history/design.md [DES-HISTORY-COMPONENT-OVERLAY]`.

---

## [DES-HISTORY-SURFACE-MAP] ASCII Surface Map

<!-- @see docs/specs/213-app-chat-history/spec.md [FR-1] [NFR-1] -->

The History view is the active-session work log surface rendered by `apps/chat/src/views/history.tsx`.
Map IDs are stable local anchors for React comments, source `@see` links, and future Impact Lens rows.

```text
[History.Root]
+--------------------------------------------------------------+
| [History.Header] title, session subtitle, chips, refresh     |
|   History | Active session work log | events/messages/live   |
+--------------------------------------------------------------+
| [History.Context] agent session + AFX workspace context      |
|   Agent session state | Save -> /afx-context save            |
+--------------------------------------------------------------+
| [History.FilterBar] density toggles + search input           |
|   narrative | trace | audit | Search work log                |
+--------------------------------------------------------------+
| [History.Body] scrollable active-session event region        |
|   [History.SetupState] checking runtime card                 |
|   [History.EmptyState] setup/no events/no matches            |
|   [History.Recovery] recovery card + cached sections         |
|   [History.Section] sticky day heading                       |
|     [History.Row] icon, action, target, detail, timestamp    |
+--------------------------------------------------------------+
```

Dense React files should mirror these IDs with sparse JSX comments such as
`{/* Surface: [History.FilterBar] */}`. Source files that implement the visible
surface can point directly at this section:
`@see docs/specs/213-app-chat-history/design.md [DES-HISTORY-SURFACE-MAP]`.

### [DES-HISTORY-SURFACE-HEADER] Header And Trace Chips

| Code anchor          | UI/functionality                                           | State inputs                                                                  |
| -------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `History` header JSX | Title, active-session subtitle, session id, Refresh button | `runtime.sessionName`, `runtime.sessionId`, `isCheckingAgent`                 |
| `TraceChip`          | Compact metrics/status chips                               | event count, message count, pending count, compacting/live/setup/cached state |
| Refresh button       | Requests a fresh host state snapshot                       | `bridgeSend({ type: "chat/getState" })`, disabled while checking              |

### [DES-HISTORY-SURFACE-CONTEXT] Context Preview Card

| Code anchor                      | UI/functionality                                             | State/action                                        |
| -------------------------------- | ------------------------------------------------------------ | --------------------------------------------------- |
| `ContextPreviewCard`             | Explains the runtime-managed agent session                   | `runtime.sessionId` short id display                |
| `ContextPreviewCard` Save button | Inserts the context-save slash command into Chat             | `onInsertCommand?.("/afx-context save")`            |
| Workspace context copy           | Keeps cross-session context separate from runtime transcript | Static copy until a workspace context reader exists |

### [DES-HISTORY-SURFACE-FILTERS] Density And Search Controls

| Code anchor          | UI/functionality                    | Behavior                                                              |
| -------------------- | ----------------------------------- | --------------------------------------------------------------------- |
| Density button group | `narrative`, `trace`, `audit` modes | Drives `deriveHistoryEvents(messages, density)`                       |
| Search input         | Local active-session row search     | Filters action, target, detail, and event kind through `eventMatches` |
| Filtered state       | Empty match branch                  | Shows no-match copy without clearing underlying events                |

### [DES-HISTORY-SURFACE-BODY] Body State Matrix

`HistoryBody` owns the scrollable event region below the filter bar. The parent
`History` component keeps the callsite annotated so agents can jump from the
visible body surface to this branch contract without reading the header,
context, or filter implementation first.

```text
--------------------------------------------------------------+
| [History.Body] <HistoryBody />                              |
|   props: agentStatus, eventCount, isCheckingAgent           |
|          runtimeUnconfigured, runtimeUnavailable, sections  |
|                                                              |
|   if isCheckingAgent                                        |
|     -> [History.SetupState] runtime handshake card           |
|                                                              |
|   else if runtimeUnconfigured                               |
|     -> [History.EmptyState] configure provider/runtime copy  |
|                                                              |
|   else if runtimeUnavailable                                |
|     -> [History.Recovery] AgentRecoveryCard                  |
|     -> cached [History.Section]* when rows exist             |
|                                                              |
|   else if sections.length === 0                             |
|     -> [History.EmptyState] no events or no search matches   |
|                                                              |
|   else                                                       |
|     -> [History.Section]* sticky day groups                  |
+--------------------------------------------------------------+
```

Code-side notation:

```tsx
{/*
  Surface: [History.Body]
  @see docs/specs/213-app-chat-history/design.md [DES-HISTORY-SURFACE-BODY]
*/}
<HistoryBody ... />
```

| Branch                       | Code anchor                           | UI/functionality                                                 |
| ---------------------------- | ------------------------------------- | ---------------------------------------------------------------- |
| Checking                     | `HistorySetupState`                   | Runtime handshake card with disabled refresh/search              |
| Unconfigured                 | inline empty branch                   | Setup copy prompting provider/runtime configuration              |
| Unavailable with cached rows | `AgentRecoveryCard` plus section list | Recovery card stays visible while previous rows remain scannable |
| No events                    | inline empty branch                   | Explains that chatting will build the active-session log         |
| No search matches            | inline empty branch                   | Explains the active query produced no visible rows               |
| Populated                    | `HistorySection[]`                    | Sticky day groups and compact rows                               |

### [DES-HISTORY-SURFACE-SECTIONS] Day Sections And Event Rows

| Code anchor       | UI/functionality                                  | Data                                                                                        |
| ----------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `groupByDay`      | Groups filtered events into day buckets           | `createdAt` local date                                                                      |
| `HistorySection`  | Sticky day heading and event list                 | section label and `ChatHistoryEvent[]`                                                      |
| `HistoryEventRow` | Icon, action, target, detail, metadata, timestamp | `ChatHistoryEvent`                                                                          |
| `renderEventIcon` | Stable visual vocabulary for event kinds          | user, assistant, file read/edit, command, search, list, usage, failed, compaction, activity |

---

## [DES-DEC] Key Decisions

| Decision                | Options Considered                                                          | Choice                                                         | Rationale                                                                                                                                                                                                                                                                        |
| ----------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| History split           | Message spec, chat parent, history child                                    | History child                                                  | History is navigation, not live rendering                                                                                                                                                                                                                                        |
| Store reader            | Import Pi SDK `SessionManager` value; reuse RPC; dependency-free `node:fs`  | Dependency-free `node:fs` reader (`session-store.ts`)          | Importing a Pi SDK _value_ into the host bundle regressed bundle size ~670KB → ~13MB and was reverted (commit `b17ccce`). `parseSessionInfo` / `parseTranscript` are pure string→shape functions; only `node:fs/promises` is used.                                               |
| Session root resolution | Read `$PI_CODING_AGENT_DIR` inside the reader; single hard-coded store path | Injected `agentDir` via `piSessionRoots(sessionDir, agentDir)` | The reader is env-free and multi-root: it merges the AFX-managed dir, the host-resolved `<agentDir>/sessions`, and the `~/.pi/agent/sessions` default, deduped. The host owns env resolution; the package stays portable/testable.                                               |
| Per-row project action  | Open a new VS Code window on the folder; copy path; reveal in OS            | Reveal in OS file manager (`session/revealCwd`)                | The project chip calls `vscode.env.openExternal(vscode.Uri.file(msg.cwd))` (sidebar-panel.ts `case "session/revealCwd"`) — a low-friction "show me where this ran" without disrupting the current workspace.                                                                     |
| List freshness          | In-memory cache keyed by `path + updatedAt`; `onProgress` streaming list    | Read fresh on every `listSessions` call (no cache)             | `HistoryService.listSessions` always re-reads (test: "reads the list fresh on every call (no caching)"); `MAX_PARSED_SESSIONS = 400` bounds the scan. The cache + progress payloads remain deferred under `[NFR-8]`.                                                             |
| History tab structure   | Single flat past-session list; modal overlay; two sub-tabs                  | `PAST SESSIONS \| CURRENT SESSION` sub-tabs                    | `apps/chat/src/app.tsx` hosts the History shell with two sub-tabs; `session-browser.tsx` renders the persistent past-session list, search, transcript, and reopen — separating navigation of history from the in-flight session.                                                 |
| Narrow-width robustness | JS width listener; fixed breakpoint; CSS container queries                  | CSS container queries (sub-tab label swap, single-line meta)   | Mirrors the Settings container-query gold standard: sub-tab labels swap `PAST SESSIONS`↔`PAST` (full label preserved via `aria-label`), header subtitle and row meta stay single-line, and the footer action collapses to `Reopen`, all driven by container width down to 220px. |

---

## [DES-DATA] Data Model

History data is UI-local and derived from current chat state; it is not persisted
by this zone.

| Type / State             | Owner                                 | Notes                                                                                 |
| ------------------------ | ------------------------------------- | ------------------------------------------------------------------------------------- |
| `RuntimeSettings`        | `apps/chat/src/views/history.tsx`     | Picked from `AgentStatus` for session metadata, queue counts, compaction, and live UI |
| `HistoryDensity`         | `apps/chat/src/lib/history-events.ts` | `narrative`, `trace`, or `audit`; used by the History filter bar                      |
| `ChatHistoryEventKind`   | `apps/chat/src/lib/history-events.ts` | Event row taxonomy for messages, tools, usage, failures, activity, and compaction     |
| `ChatHistoryEvent`       | `apps/chat/src/lib/history-events.ts` | Render-ready row model consumed by `HistorySection` and `HistoryEventRow`             |
| `messages` React state   | `apps/chat/src/views/history.tsx`     | Updated by chat bridge messages and converted with `deriveHistoryEvents()`            |
| `query` / `density`      | `apps/chat/src/views/history.tsx`     | Local-only search and display filtering; no persisted setting yet                     |
| `sections` derived state | `apps/chat/src/views/history.tsx`     | `groupByDay(filtered)` output for sticky day headings                                 |

---

## [DES-API] API Contracts

History mirrors the current chat transcript by subscribing to bridge events. It
does not own persistence or cross-session conversation storage.

| Direction | Message / action           | Code path                              | Requirement |
| --------- | -------------------------- | -------------------------------------- | ----------- |
| inbound   | `chat/state`               | Replace local `messages` state         | `[FR-2]`    |
| inbound   | `chat/messageStart`        | Append a new timeline item if missing  | `[FR-2]`    |
| inbound   | `chat/messageDelta`        | Append assistant text deltas           | `[FR-2]`    |
| inbound   | `chat/messageEnd`          | Mark streaming item complete           | `[FR-2]`    |
| inbound   | `chat/toolStart`           | Attach a running tool to latest reply  | `[FR-2]`    |
| inbound   | `chat/toolEnd`             | Mark tool status and summary           | `[FR-2]`    |
| inbound   | `chat/error`               | Append transcript-visible error row    | `[FR-2]`    |
| inbound   | `agent/runtimeSettings`    | Update header/context runtime metadata | `[FR-2]`    |
| outbound  | `chat/getState`            | Initial load and Refresh button        | `[FR-2]`    |
| callback  | `/afx-context save` insert | `ContextPreviewCard` Save button       | `[FR-4]`    |

---

## [DES-FILES] File Structure

| File                                  | Purpose                      |
| ------------------------------------- | ---------------------------- |
| `apps/chat/src/views/history.tsx`     | History panel UI             |
| `apps/chat/src/lib/history-events.ts` | History event labels/mapping |

---

## [DES-DEPS] Dependencies

| Dependency                             | Use                                                                                          |
| -------------------------------------- | -------------------------------------------------------------------------------------------- |
| `100-package-shared`                   | `AgentStatus`, `AgentRuntimeStatus`, `ChatTimelineItem`, `ChatMessageView`, usage/tool types |
| `110-package-transport`                | Chat webview bridge subscription/send surface through `apps/chat/src/lib/bridge.ts`          |
| `200-app-vscode`                       | Sidebar bridge dispatch and host HistoryService                                              |
| `210-app-chat`                         | Parent chat app shell and tab routing                                                        |
| `212-app-chat-messages`                | Shared tool descriptor behavior used by both live message timeline and History rows          |
| `216-app-chat-window-componentization` | Reserved ChatTopBar/ComposerPanelStack slots for future history load/export surfaces         |
| `300-infra-pi`                         | Managed Pi runtime and session-store adapter behavior                                        |
| `350-agent-manager`                    | Optional AgentManager methods and Multiplex guard delegation                                 |
| `351-agent-pi`                         | Pi SDK/RPC adapter contracts, session dir injection, and switch-session support              |

---

## [DES-SEC] Security Considerations

History labels must not expose secrets or API keys.

---

## [DES-ERR] Error Handling

| Scenario                               | Handling                                                                                 |
| -------------------------------------- | ---------------------------------------------------------------------------------------- |
| Runtime is still being checked         | Show `HistorySetupState` and disable refresh/search                                      |
| Runtime is not configured              | Show setup empty copy and disable refresh                                                |
| Runtime is disconnected or errored     | Show `AgentRecoveryCard`; keep cached sections visible with reduced opacity when present |
| No active-session events exist         | Show "No active-session events yet" empty state                                          |
| Search returns no matching rows        | Show "No matching active-session events" empty state                                     |
| Tool call has an unknown tool name     | Classify as generic `activity` and render with fallback hammer/check icon                |
| Tool call failed                       | Classify as `failed`, keep it visible at `trace` density, and show error tone            |
| Bridge error is not transcript-visible | Ignore it in History when `displayInTranscript === false`                                |

---

## [DES-TEST] Testing Strategy

| Coverage target              | Current test anchor                        | Notes                                                                      |
| ---------------------------- | ------------------------------------------ | -------------------------------------------------------------------------- |
| History tab reachable        | `apps/chat/src/app.test.tsx`               | Checks tab navigation, heading, Refresh button, and search placeholder     |
| Runtime readiness state      | `apps/chat/src/app.test.tsx`               | Checks disabled Refresh/search while runtime is connecting                 |
| Recovery availability        | `apps/chat/src/app.test.tsx`               | Checks recovery remains reachable from History/Settings on disconnect      |
| Event derivation             | `apps/chat/src/lib/history-events.test.ts` | Covers transcript, tool, usage, failed-tool rows                           |
| Compaction event derivation  | Future targeted unit test                  | Current source supports it; direct assertion should be added when touched  |
| Density filtering/search     | Future targeted History view test          | Current source supports it; add direct test before changing filter policy  |
| Context save insertion       | Future targeted History view test          | Current source supports it; add direct test before changing context action |
| Section/row visual rendering | Future targeted History view test          | Current source supports it; add direct test before changing row layout     |

---

## [DES-ROLLOUT] Migration / Rollout Plan

Retarget history refs from retired chat docs and add targeted tests on future behavior changes.

### [DES-HISTORY-ROLLOUT-ROLLBACK] Rollback Plan

Route files back to `210-app-chat` only if this child spec is no longer useful.

---

## [DES-HISTORY-LOC] Code Locator Map

<!-- @see docs/specs/213-app-chat-history/spec.md [FR-1] [FR-2] [NFR-1] -->

| Map ID                            | Code anchor                                                              | Messages/settings/commands                                                                                            | Tests                                      |
| --------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `[History.Root]`                  | `apps/chat/src/views/history.tsx` `History`                              | Receives chat timeline and runtime settings; sends `chat/getState`                                                    | `apps/chat/src/app.test.tsx`               |
| `[DES-HISTORY-COMPONENT-OVERLAY]` | `apps/chat/src/views/history.tsx` React component boundaries             | Maps visible UI regions to History, ContextPreviewCard, HistorySetupState, HistorySection, and HistoryEventRow        | `apps/chat/src/app.test.tsx`               |
| `[DES-HISTORY-COMPONENT-TREE]`    | `apps/chat/src/views/history.tsx`, `apps/chat/src/lib/history-events.ts` | Maps component/helper ownership from rendered UI down to event derivation                                             | `apps/chat/src/lib/history-events.test.ts` |
| `[History.Header]`                | `apps/chat/src/views/history.tsx` `Surface: [History.Header]`            | Reads runtime session name/id, message counts, queue count, live/setup/cached status; refresh sends `chat/getState`   | `apps/chat/src/app.test.tsx`               |
| `[History.Context]`               | `apps/chat/src/views/history.tsx` `ContextPreviewCard`                   | Inserts `/afx-context save` through `onInsertCommand`                                                                 | Future history/context view test           |
| `[History.FilterBar]`             | `apps/chat/src/views/history.tsx` `Surface: [History.FilterBar]`         | Local density state: `narrative`, `trace`, `audit`; local search query                                                | `apps/chat/src/app.test.tsx`               |
| `[History.Body]`                  | `apps/chat/src/views/history.tsx` `Surface: [History.Body]`              | Branches on runtime checking, unconfigured, unavailable, empty, and populated sections                                | `apps/chat/src/app.test.tsx`               |
| `[History.SetupState]`            | `apps/chat/src/views/history.tsx` `HistorySetupState`                    | Uses `agentStatus` readiness inputs                                                                                   | `apps/chat/src/app.test.tsx`               |
| `[History.EmptyState]`            | `apps/chat/src/views/history.tsx` `[History.Body]` empty-state branches  | Uses runtime configured/unavailable state plus filtered event count                                                   | `apps/chat/src/app.test.tsx`               |
| `[History.Recovery]`              | `apps/chat/src/views/history.tsx` `AgentRecoveryCard` usage              | Uses `recoveryActions` when runtime is disconnected/error                                                             | `apps/chat/src/app.test.tsx`               |
| `[History.Section]`               | `apps/chat/src/views/history.tsx` `HistorySection`, `groupByDay`         | Groups events by local day labels                                                                                     | Future history view test                   |
| `[History.Row]`                   | `apps/chat/src/views/history.tsx` `HistoryEventRow`, `renderEventIcon`   | Renders event kind, status, detail, usage/compaction metadata                                                         | Future history view test                   |
| `[History.Events]`                | `apps/chat/src/lib/history-events.ts` `deriveHistoryEvents`, `toolEvent` | Maps `ChatTimelineItem` values into narrative/trace/audit rows and classifies message, tool, usage, compaction events | `apps/chat/src/lib/history-events.test.ts` |

---

## [DES-HISTORY-TRACE] 1:1 Code/Spec Matrix

<!-- @see docs/specs/213-app-chat-history/spec.md [FR-1] [FR-2] [FR-3] [FR-4] [FR-5] [FR-6] [FR-7] [FR-8] [FR-9] [FR-10] [FR-11] -->

| Behavior                    | Requirement | Design node                                                                | Source anchor                                                                            | Tests                                      |
| --------------------------- | ----------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------ |
| History root visible layout | `[FR-1]`    | `[DES-HISTORY-MOCKUP-LIVE]`, `[DES-HISTORY-COMPONENT-OVERLAY]`             | `apps/chat/src/views/history.tsx` `History`                                              | `apps/chat/src/app.test.tsx`               |
| Bridge sync and refresh     | `[FR-2]`    | `[DES-API]`                                                                | `apps/chat/src/views/history.tsx` `bridgeOn(...)`, `bridgeSend("chat/getState")`         | `apps/chat/src/app.test.tsx`               |
| Header chips and status     | `[FR-3]`    | `[DES-HISTORY-SURFACE-HEADER]`                                             | `apps/chat/src/views/history.tsx` `Surface: [History.Header]`, `TraceChip`               | `apps/chat/src/app.test.tsx`               |
| Context save affordance     | `[FR-4]`    | `[DES-HISTORY-SURFACE-CONTEXT]`                                            | `apps/chat/src/views/history.tsx` `ContextPreviewCard`                                   | Future context-action test                 |
| Density/search filtering    | `[FR-5]`    | `[DES-DATA]`, `[DES-HISTORY-SURFACE-FILTERS]`                              | `apps/chat/src/views/history.tsx` `filtered`, `eventMatches`                             | Future filter/search test                  |
| Body runtime state matrix   | `[FR-6]`    | `[DES-HISTORY-MOCKUP-EMPTY]`, `[DES-HISTORY-MOCKUP-RECOVERY]`, `[DES-ERR]` | `apps/chat/src/views/history.tsx` `Surface: [History.Body]`, `HistorySetupState`         | `apps/chat/src/app.test.tsx`               |
| Day sections and rows       | `[FR-7]`    | `[DES-HISTORY-SURFACE-SECTIONS]`                                           | `apps/chat/src/views/history.tsx` `HistorySection`, `HistoryEventRow`, `renderEventIcon` | Future section/row test                    |
| Event derivation            | `[FR-8]`    | `[DES-DATA]`                                                               | `apps/chat/src/lib/history-events.ts` `deriveHistoryEvents`                              | `apps/chat/src/lib/history-events.test.ts` |
| Tool classification         | `[FR-9]`    | `[DES-DATA]`                                                               | `apps/chat/src/lib/history-events.ts` `toolEvent`, `classifyTool`                        | `apps/chat/src/lib/history-events.test.ts` |
| Boundary from live chat     | `[FR-10]`   | `[DES-DEC]`                                                                | `212-app-chat-messages` owns live timeline rendering                                     | Child spec boundary                        |
| Traceability assets         | `[FR-11]`   | `[DES-HISTORY-MOCKUPS]`, `[DES-HISTORY-COMPONENTS]`, `[DES-HISTORY-LOC]`   | This design plus `@see` and `Surface:` comments                                          | `rg` trace spot-check                      |
| Fast scan and compact rows  | `[NFR-1]`   | `[DES-HISTORY-MOCKUP-LIVE]`, `[DES-HISTORY-SURFACE-SECTIONS]`              | `HistoryEventRow`, `TraceChip`, compact formatting helpers                               | Future visual density test                 |
| Safe summaries              | `[NFR-2]`   | `[DES-SEC]`                                                                | `toolDescriptor`, `toolEvent`, `compact`                                                 | `apps/chat/src/lib/history-events.test.ts` |
| Memoized derivation         | `[NFR-4]`   | `[DES-DATA]`                                                               | `useMemo` for `events`, `filtered`, and `sections`                                       | Type/lint coverage                         |
| Persisted store source      | `[FR-13]`   | `[DES-PERSISTENT-STORE]`                                                   | `packages/agent/pi/src/session-store.ts`, `piSessionRoots`, both Pi adapters             | `session-store.test.ts`                    |
| Session list                | `[FR-14]`   | `[DES-PERSISTENT-FLOW]`, `[DES-PERSISTENT-UI]`                             | `HistoryService.listSessions`, `session/list` bridge, `SessionBrowser`                   | HistoryService, app, and e2e tests         |
| Read-only transcript        | `[FR-15]`   | `[DES-PERSISTENT-FLOW]`, `[DES-PERSISTENT-DATA]`, `[DES-PERSISTENT-UI]`    | `getTranscript`, shared transcript-to-timeline mapper, read-only `ConversationTimeline`  | Mapper, component, and e2e parity tests    |
| Reopen and rehydrate        | `[FR-16]`   | `[DES-PERSISTENT-FLOW]`, `[DES-PERSISTENT-BRIDGE]`                         | guarded `switchSession`, `transcript-to-timeline.ts`, `chat/state` rehydration           | Reopen integration and e2e tests           |
| Branch marker               | `[FR-17]`   | `[DES-PERSISTENT-STORE]`, `[DES-PERSISTENT-UI]`                            | `forkedFrom` marker in `SessionRow`; full `hasBranches` deferred                         | fixture and e2e coverage                   |
| Persisted list search       | `[FR-18]`   | `[DES-PERSISTENT-UI]`                                                      | `SessionBrowser` local query filter                                                      | app and Playwright tests                   |
| Copy session recap          | `[FR-22]`   | `[DES-PERSISTENT-UI]`                                                      | `buildSessionRecap`, `TranscriptView` Copy session recap button                          | Playwright clipboard test                  |
| Session-dir coherence       | `[NFR-5]`   | `[DES-PERSISTENT-STORE]`                                                   | `resolveAfxSessionDir` -> factory -> adapters; injected `agentDir`; guarded roots        | Host/adapter unit tests                    |
| Runtime boundary            | `[NFR-6]`   | `[DES-PERSISTENT-DATA]`, `[DES-PERSISTENT-API]`                            | Shared types only outside adapter                                                        | Boundary lint                              |
| Non-destructive reads       | `[NFR-7]`   | `[DES-PERSISTENT-FLOW]`                                                    | Read-only load avoids `switchSession`                                                    | mtime fixture assertion                    |
| Large-history usability     | `[NFR-8]`   | `[DES-PERSISTENT-API]`, `[DES-PERSISTENT-TEST]`                            | `MAX_PARSED_SESSIONS=400`, fresh reads; progress/cache deferred                          | fs-reader and HistoryService tests         |
| Harness fallback            | `[NFR-9]`   | `[DES-PERSISTENT-OVR]`, `[DES-PERSISTENT-UI]`                              | Optional method detection and unsupported state                                          | Multiplex/History UI tests                 |

---

## [DES-PERSISTENT-OVR] Persistent Session Overview

<!-- @see docs/specs/213-app-chat-history/spec.md [FR-13] [FR-14] [FR-15] [FR-16] [FR-17] [FR-18] [FR-19] [FR-20] [FR-21] [FR-22] [NFR-6] [NFR-8] [NFR-9] -->

Persistent History is an **additive** mode layered on top of the active-session
work log, not a replacement. Two distinct components live side by side under the
History tab:

- `apps/chat/src/views/history.tsx` — the **CURRENT SESSION** view, which still
  owns live event derivation from the active timeline.
- `apps/chat/src/views/session-browser.tsx` — the **PAST SESSIONS** view, which
  lists persisted Pi JSONL sessions, opens a selected session as a read-only
  transcript, reopens one as the active runtime session, and deletes one.

`apps/chat/src/app.tsx` is the History tab shell. It holds
`const [historyTab, setHistoryTab] = useState<"past" | "current">("past")` and
renders `<SessionBrowser>` for the `past` sub-tab and `<History>` for the
`current` sub-tab, toggling visibility (both stay mounted; the inactive one is
`hidden`). `SessionBrowser` receives `active={activeTab === "history" && historyTab === "past"}`
and re-issues `session/list` each time that surface becomes active, because the
agent writes new sessions to disk between visits.

### Data path (as built)

The browser owns its bridge subscriptions (`session/list`, `history/loaded`) and
sends `session/list`, `history/load`, `history/reopen`, `session/delete`, and
`session/revealCwd`. The host resolves each request through the active
`AgentManager`'s **optional** session methods down to a dependency-free
`node:fs` JSONL reader — there is no Pi SDK `SessionManager` in this path:

```text
apps/chat/src/views/session-browser.tsx
  |  bridgeSend({ type: "session/list" | "history/load" | "history/reopen"
  |               | "session/delete" | "session/revealCwd", ... })
  v
packages/shared/src/messages.ts  (typed bridge protocol)
  |
  v
apps/vscode/src/panels/sidebar-panel.ts  ->  handleHistoryCommand(msg)
  |    session/list      -> historyService.listSessions({ allWorkspaces? })
  |    history/load      -> historyService.getTranscript(sessionPath)
  |    history/reopen    -> agentManager.switchSession(sessionPath) + getTranscript
  |    session/delete    -> historyService.deleteSession(sessionPath) + re-list
  |    session/revealCwd -> re-list sessions, then open only a discovered cwd
  v
apps/vscode/src/services/history/history-service.ts  (HistoryService)
  |    feature-detects manager.listSessions / getTranscript / deleteSession;
  |    maps "no session store" to { supported: false, sessions: [] }
  v
AgentManager optional methods (packages/shared/src/agent.ts)
  |    listSessions?(opts?) · getTranscript?(path) · deleteSession?(path)
  |    setSessionName?(name) · switchSession?(path)
  v
Pi adapter:  packages/agent/pi/src/rpc-manager.ts   (external `pi` runtime)
  OR         packages/agent/pi-sdk/src/sdk-rpc-manager.ts  (managed runtime)
  |    both call the SAME reader; no engine value is imported for listing:
  |      piSessionRoots(sessionDir, agentDir)
  |      listSessionsFromDisk(roots, cwd?)
  |      readTranscriptFromDisk(sessionPath)
  v
packages/agent/pi/src/session-store.ts  (node:fs JSONL reader)
  |    scans each root's `*.jsonl` tree (depth-limited), parses header + entries,
  |    walks the parentId chain to the active leaf branch
  v
piSessionRoots() merges, newest-first, de-duped:
  1. <sessionDir>                       (afx.sessionDir / <globalStorage>/sessions, if set)
  2. <agentDir>/sessions                ($PI_CODING_AGENT_DIR, host-resolved)
  3. ~/.pi/agent/sessions               (Pi default, always included as fallback)
```

`deleteSession` in the `pi` adapter is itself an `fs` operation (`unlink(sessionPath)`);
only `switchSession` (reopen) and `setSessionName` (rename) go over RPC to the
running engine. Listing and transcript reads never start or touch the subprocess.

### Why node:fs, not the SDK SessionManager

The listing/read path is intentionally a self-contained `node:fs/promises`
reader (`readFile`, `readdir`, `stat`) with a minimal local mirror of the
on-disk JSONL shapes — **no `@earendil-works/*` runtime import**. Importing a Pi
SDK _value_ into the extension-host bundle was tried and reverted because it
regressed the host bundle from roughly 670&nbsp;KB to roughly 13&nbsp;MB
(commit `b17ccce`). Pi-specific parsing therefore stays inside the adapter /
`session-store.ts` and crosses the bridge only as the shared `AgentSessionInfo`
and `AgentTranscriptEntry` types — no app or webview code reads JSONL directly.

### Managed runtime + harness fallback

The managed bundled `pi-sdk` runtime is the v1 source of truth and the external
`pi` RPC adapter shares the identical disk reader, so both expose full History.
External and future remote harnesses are not assumed to write readable local
session files, so the optional `AgentManager` methods (`listSessions?`,
`getTranscript?`, `deleteSession?`, `setSessionName?`, `switchSession?`) are
feature-detected. When the active manager omits them, `HistoryService` returns
`{ supported: false, sessions: [] }` and `SessionBrowser` renders a
harness-owned unsupported state rather than an empty list (NFR-9).

> **Deferred (NFR-8):** `HistoryService` holds no cache — every `session/list`
> reads the disk fresh (`listSessions` is documented as "always reads fresh"),
> and there is no `onProgress(loaded, total)` streaming of partial results. Both
> are deferred, not implemented; `MAX_PARSED_SESSIONS = 400` bounds the per-call
> parse cost in the meantime.

---

## [DES-PERSISTENT-STORE] Pi Session Store (as-built node:fs reader)

<!-- @see docs/specs/213-app-chat-history/spec.md [FR-13] [FR-14] [FR-15] [FR-17] [FR-19] [NFR-6] [NFR-9] -->

History reads Pi's persisted sessions **directly off disk** with a dependency-free
`node:fs` reader — `packages/agent/pi/src/session-store.ts`. The header comment states the
constraint verbatim:

> Reads Pi's on-disk session JSONL store with `node:fs` — no `@earendil-works/*` runtime import.

No Pi SDK _value_ is imported into the host bundle. Importing Pi's `SessionManager` (or any
runtime value from the Pi registry) was reverted because it dragged Pi's provider SDK registry
into the extension host and regressed bundle size from ~670KB to ~13MB
(commit `b17ccce` _fix(pi-sdk): remove Pi registry from extension bundle_). The reader depends
only on `node:fs/promises` (`readFile`, `readdir`, `realpath`, `stat`), `node:os` (`homedir`), and
`node:path` (`join`, `sep`), plus **type-only** imports of `AgentSessionInfo` / `AgentTranscriptEntry`
from `@afx/shared`. No app or webview code reads JSONL directly — `apps/chat` and the webviews
only ever see the normalized `@afx/shared` shapes returned across the transport boundary.

### On-disk layout

Each session is a single JSONL file. Line 1 is the session header; every subsequent line is an
entry forming a `parentId` tree (a session can fork, producing multiple leaf branches in one
file). Pi nests files per project:

```text
<root>/sessions/<encoded-cwd>/<iso>_<id>.jsonl     # nested, per-project (current Pi)
<root>/sessions/<id>.jsonl                          # some legacy files sit flat
```

The reader treats both as valid — it walks the tree recursively rather than assuming a fixed
depth, and derives the workspace from the header `cwd` (not the directory name), so it does not
depend on the encoding of `<encoded-cwd>`.

The on-disk JSON is mirrored by **local** interfaces (no SDK import), kept deliberately minimal:

| Interface     | Role                       | Fields read                                                                                                                |
| ------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `DiskHeader`  | line 1 (`type: "session"`) | `id`, `timestamp`, `cwd?`, `parentSession?`                                                                                |
| `DiskEntry`   | one line per node          | `type`, `id`, `parentId: string \| null`, `timestamp?`, `message?`, `name?` (`session_info` entries)                       |
| `DiskMessage` | `entry.message`            | `role`, `content?`, `timestamp?`, `toolCallId?`, `toolName?`, `isError?`, `command?`, `exitCode?`, `summary?`, `thinking?` |

### Read roots (multi-root, host-injected)

`piSessionRoots(sessionDir?: string, agentDir?: string): string[]` returns every directory a Pi
runtime may keep sessions in, deduped via `[...new Set(roots)]`, so history is found wherever the
configured Pi actually writes — not only where AFX points it:

```text
1. sessionDir              AFX-managed dir (afx.sessionDir / <globalStorage>/sessions), if set
2. <agentDir>/sessions     agentDir = caller-resolved Pi agent dir
                           ($PI_CODING_AGENT_DIR when set, else ~/.pi/agent)
3. ~/.pi/agent/sessions    Pi default, always appended as a fallback
```

`agentDir` is **injected by the host** (the host owns env resolution); the store never reads
`process.env` itself. Both `createAgentManager` (`packages/agent/pi/src/rpc-manager.ts`) and
`createPiSdkAgentManager` (`packages/agent/pi-sdk/src/sdk-rpc-manager.ts`) wire it the same way
in their `listSessions()`:

```typescript
const roots = piSessionRoots(sessionDir, agentDir); // pi: opts.sessionDir / opts.agentDir
const sessions = await listSessionsFromDisk(roots);
```

### Exported surface

The store exports pure parse functions plus two disk-reading entry points and the root resolver.
This table replaces the prior plan-state "SDK symbol" table — there is no SDK symbol; these are
the real exports of `session-store.ts`:

| Export                                                                 | Kind      | Responsibility                                                                                                                           |
| ---------------------------------------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `piSessionRoots(sessionDir?, agentDir?): string[]`                     | fn        | Resolve + dedupe the read roots (AFX dir, `<agentDir>/sessions`, `~/.pi/agent/sessions`). `agentDir` injected, never from `process.env`. |
| `listSessionsFromDisk(roots, cwd?): Promise<AgentSessionInfo[]>`       | fn        | Scan every root, merge + dedupe files, mtime-cap, parse, filter by `cwd` when given, sort by `updatedAt` desc.                           |
| `readTranscriptFromDisk(sessionPath): Promise<AgentTranscriptEntry[]>` | fn        | Read one file and return its active leaf-branch transcript. Returns `[]` on any read error.                                              |
| `parseSessionInfo(content, path): ParsedSession \| null`               | fn (pure) | Parse one file's content into a list row + scoping `cwd`. `null` if empty or header `type !== "session"`.                                |
| `parseTranscript(content): AgentTranscriptEntry[]`                     | fn (pure) | Parse a file into the active leaf-branch transcript (role-mapped entries).                                                               |
| `isSessionPathAllowed(sessionPath, roots): Promise<boolean>`           | fn        | Validate a webview-supplied handle as an existing `.jsonl` whose real path is under a known Pi session root.                             |
| `assertSessionPathAllowed(sessionPath, roots): Promise<void>`          | fn        | Throws before read, switch, or delete when the session path is outside configured roots.                                                 |
| `MAX_PARSED_SESSIONS`                                                  | const     | `= 400` — most-recent cap on sessions parsed per list.                                                                                   |
| `ParsedSession`                                                        | type      | `{ info: AgentSessionInfo; cwd: string }` — `cwd` is `header.cwd`, used to scope the list.                                               |

Internal (not exported) helpers: `findSessionFiles(dir, depth = 4)` (recursive `*.jsonl` collector),
`parseJsonl(content)` (line-by-line `JSON.parse`, skips malformed lines), and
`contentToText(content)` (joins `type: "text"` blocks; ignores images/thinking/tools).

### `listSessionsFromDisk` — scan, cap, parse, scope, sort

```text
roots ──► findSessionFiles(root)  for each root, depth 4, recurse subdirs
      ──► [...new Set(fileSets.flat())]                 dedupe overlapping roots
      ──► if files.length > MAX_PARSED_SESSIONS (400):
              stat each → sort by mtimeMs desc → slice(0, 400)   bound work on large histories
      ──► parseSessionInfo(readFile(path)) per file    (try/catch → null on failure)
      ──► filter(p !== null)
      ──► filter(!cwd || p.cwd === cwd)                 optional workspace scoping
      ──► map(p.info)
      ──► sort((a, b) => b.updatedAt - a.updatedAt)     newest-first
```

The `cwd` argument is the workspace-scoping filter. Note that both manager `listSessions()` call
sites currently pass **no** `cwd`, so the default surface lists every workspace's sessions; the
parameter is wired through for the per-workspace default but not yet exercised by the host.

`findSessionFiles(dir, depth = 4)` catches a missing directory (`readdir` throws) and returns `[]`
— so an absent root is silently skipped rather than failing the whole list.

### `parseSessionInfo` — file → `AgentSessionInfo`

Reads the header (line 1) and walks all entries to count messages, capture the first user message,
pick up a `session_info` `name`, and track the latest activity timestamp. It emits the real
`@afx/shared` field names (not the plan's `sessionPath`/`modifiedAt`/`source`):

| `AgentSessionInfo` field | Source                                                                   |
| ------------------------ | ------------------------------------------------------------------------ |
| `id`                     | `header.id`                                                              |
| `path`                   | the file path argument (the handle for open / switch / delete)           |
| `messageCount`           | count of `type === "message"` entries with a `message`                   |
| `createdAt`              | epoch ms from `Date.parse(header.timestamp)`, else `0`                   |
| `updatedAt`              | latest message `timestamp` (`lastActivity`), falling back to `createdAt` |
| `label?`                 | `session_info` name, else `firstMessage` (omitted when neither exists)   |
| `firstMessage?`          | first `role === "user"` message text (omitted when empty)                |
| `cwd?`                   | `header.cwd` when a non-empty string (omitted otherwise)                 |
| `forkedFrom?`            | `header.parentSession` when present                                      |

Optional fields use `...(x ? { x } : {})` spreads, so they are **absent** rather than `undefined`
when empty. `hasBranches` is part of the `@afx/shared` shape but is not currently populated by this
reader (branch detection is display-only and deferred under NFR-8).

### `parseTranscript` — active leaf-branch walk

The transcript is reconstructed by resolving the **active leaf branch**, not by reading entries in
file order. The leaf is the last `type: "message"` entry, not necessarily the last JSONL line:
metadata rows such as `session_info` can be appended after messages. The reader indexes entries by
`id` and walks `parentId` toward the root, `unshift`-ing each onto the branch:

```text
byId = Map<id, DiskEntry>
current = entries.findLast(entry => entry.type === "message")   # leaf
while current:
    branch.unshift(current)
    current = current.parentId ? byId.get(current.parentId) : undefined
```

Each `message` entry on that branch is mapped to a role-based `AgentTranscriptEntry`
(`role: "user" | "assistant" | "tool" | "bash" | "compaction"`) — **not** the plan-state
`kind`/`title`/`detail`/`status` shape:

| Disk `message.role`   | `AgentTranscriptEntry`                                                                                                                                                                           |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `"user"`              | `{ role: "user", text, createdAt }`                                                                                                                                                              |
| `"assistant"`         | `{ role: "assistant", createdAt, text?, thinking?, toolCalls? }` — `thinking` from `type: "thinking"` blocks; `toolCalls` from `type: "toolCall"` blocks (`id`, `name`, `args` from `arguments`) |
| `"toolResult"`        | `{ role: "tool", createdAt, toolResult: { toolCallId, toolName, ok: !isError, summary? } }`                                                                                                      |
| `"bashExecution"`     | `{ role: "bash", createdAt, bash: { command, exitCode? }, text? }`                                                                                                                               |
| `"compactionSummary"` | `{ role: "compaction", text: summary, createdAt }`                                                                                                                                               |

`createdAt` is the numeric `message.timestamp` when present, else `Date.parse(entry.timestamp)`,
else `0`. Optional fields again use conditional spreads so empty values are omitted.

### Deferred (NFR-8): caching

- **No cache.** `listSessionsFromDisk` / `readTranscriptFromDisk` read fresh from disk on every
  call; there is no in-memory `HistoryService` cache and no invalidation. Acceptable at current
  list sizes given the `MAX_PARSED_SESSIONS = 400` cap.
- **No `onProgress`.** Listing and transcript reads resolve a single promise; there is no
  streaming/progress callback for large histories.
- **`hasBranches` not populated.** Branch awareness is display-only and the leaf-branch reader
  does not yet set the marker.

---

## [DES-PERSISTENT-DATA] Shared Session Types (as-built)

<!-- @see docs/specs/213-app-chat-history/spec.md [FR-13] [FR-14] [FR-15] [FR-17] [FR-19] [FR-20] [NFR-6] [NFR-9] -->

Two runtime-agnostic types carry persisted-session data across the harness boundary: `AgentSessionInfo` (one list row) and `AgentTranscriptEntry` (one rendered transcript line). Both live in `@afx/shared` (`packages/shared/src/agent.ts`) so the host, the Pi adapter, the mock transport, and the chat webview share one shape and the webview never imports an engine type (NFR-6, NFR-9).

All timestamps are **epoch milliseconds**, not `Date`. Engine `Date`/ISO fields are converted at the adapter (`packages/agent/pi/src/session-store.ts`) so the shape survives the webview `postMessage` boundary.

> **As-built note:** These are the exact current interfaces. The earlier plan-state shapes — a `key`/`sessionPath`/`modifiedAt`/`source` session row and a `kind`/`title`/`detail`/`status` transcript entry — never shipped and are not part of the contract. The transcript entry is **role-based**, mirroring the engine message roles.

### `AgentSessionInfo` — one list row

Verbatim from `packages/shared/src/agent.ts`:

```ts
/**
 * A persisted conversation as listed in History. Runtime-agnostic; normalized
 * from the engine's native session metadata (e.g. Pi `SessionInfo`). All
 * timestamps are epoch milliseconds so the shape survives the webview
 * postMessage boundary (engine `Date` fields are converted at the adapter).
 *
 * @see docs/specs/213-app-chat-history/spec.md [FR-14] [FR-20]
 * @see docs/specs/213-app-chat-history/design.md [DES-PERSISTENT-DATA]
 */
export interface AgentSessionInfo {
  /** Stable session id (engine-assigned, e.g. uuidv7). */
  id: string;
  /** Session file path — the handle for open/switch/delete. */
  path: string;
  /** Display label (engine session name, else first-message snippet). */
  label?: string;
  /** First user message, used as a preview snippet. */
  firstMessage?: string;
  /** Total messages in the session. */
  messageCount: number;
  /** Creation time, epoch ms. */
  createdAt: number;
  /** Last-modified time, epoch ms. */
  updatedAt: number;
  /** Workspace directory the session ran in (header cwd) — for project grouping + reveal. */
  cwd?: string;
  /** Path of the session this one was forked from, if any. */
  forkedFrom?: string;
  /** True when the session tree has more than one branch (display marker). */
  hasBranches?: boolean;
}
```

Field provenance — how the Pi adapter populates each field in `parseSessionInfo(content, path)` (`packages/agent/pi/src/session-store.ts`):

| Field          | Type       | Required | Source (`parseSessionInfo`)                                                              | Consumed by                                                             |
| -------------- | ---------- | -------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `id`           | `string`   | yes      | `header.id` (JSONL line 1, `type: "session"`)                                            | Row key / dedupe                                                        |
| `path`         | `string`   | yes      | The `path` argument (session `.jsonl` file path) — the handle for open / resume / delete | `getTranscript`, `switchSession`, `deleteSession` (FR-15, FR-16, FR-19) |
| `label`        | `string?`  | no       | `name \|\| firstMessage \|\| undefined` (`name` = latest `session_info` entry, trimmed)  | Row title                                                               |
| `firstMessage` | `string?`  | no       | First `user` message text via `contentToText(...)`                                       | Preview snippet                                                         |
| `messageCount` | `number`   | yes      | Count of `type: "message"` entries                                                       | Row stats + browser footer stats (FR-20)                                |
| `createdAt`    | `number`   | yes      | `Date.parse(header.timestamp) \|\| 0` (epoch ms)                                         | Sort / relative time                                                    |
| `updatedAt`    | `number`   | yes      | `lastActivity \|\| createdAt` — max message timestamp, epoch ms                          | Newest-first sort, relative "updated" label                             |
| `cwd`          | `string?`  | no       | `header.cwd` when a non-empty string (omitted otherwise)                                 | Project chip, project count, reveal-in-OS (FR-20)                       |
| `forkedFrom`   | `string?`  | no       | `header.parentSession` when present                                                      | Branch-origin marker (FR-17)                                            |
| `hasBranches`  | `boolean?` | no       | _Declared, not yet populated by the store_ — reserved branch-count marker                | (deferred — see note)                                                   |

`cwd` is load-bearing for FR-20: the session browser derives the distinct-project count from it (`new Set(list.sessions.map((s) => s.cwd)...)`, `session-browser.tsx:133`), renders the per-row project chip via `projectName(session.cwd)` (`:301`), and wires the reveal-in-file-manager action to `revealCwd(s.cwd)` (`:261`, `:338`). When `cwd` is absent the chip and reveal action are omitted.

`forkedFrom` drives the display-only branch-awareness marker (FR-17): the browser renders a fork indicator when `session.forkedFrom` is set (`session-browser.tsx:317`). It is populated from the on-disk header (`header.parentSession`) — no tree walk is performed for it.

> **Deferred — `hasBranches`:** The field exists in the interface as a future branch-count display marker, but `parseSessionInfo` does not currently set it; only `forkedFrom` is derived from the header. Computing `hasBranches` would require scanning the entry tree for sibling `parentId`s, which the as-built list path (one header-only read per file) intentionally avoids. Tracked as a later enhancement, not a present capability.

### `AgentTranscriptEntry` — one transcript line (role-based)

Verbatim from `packages/shared/src/agent.ts`:

```ts
/**
 * One entry in a loaded transcript, normalized from the engine's native message
 * shape so the host can render history without importing engine types.
 *
 * @see docs/specs/213-app-chat-history/spec.md [FR-15]
 * @see docs/specs/213-app-chat-history/design.md [DES-PERSISTENT-DATA]
 */
export interface AgentTranscriptEntry {
  /** Source role of this entry. */
  role: "user" | "assistant" | "tool" | "bash" | "compaction";
  /** User content / joined assistant text blocks / summary text. */
  text?: string;
  /** Assistant reasoning content, when present. */
  thinking?: string;
  /** Tool calls requested in an assistant turn. */
  toolCalls?: { id: string; name: string; args: Record<string, unknown> }[];
  /** Result of a tool call (`ok` = `!isError`). */
  toolResult?: {
    toolCallId: string;
    toolName: string;
    ok: boolean;
    summary?: string;
  };
  /** Bash execution detail, for bash entries. */
  bash?: { command: string; exitCode?: number };
  /** Entry timestamp, epoch ms. */
  createdAt: number;
}
```

The entry is a **discriminated-by-`role`** shape — there is no `kind`/`title`/`detail`/`status`. Each role populates a different optional payload. `parseTranscript(content)` resolves the active leaf branch (walking `parentId` from the last entry to the root), then maps each on-disk message role to an entry:

| `role`         | From on-disk message role | Populated payload                                                                                                                              |
| -------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `"user"`       | `user`                    | `text` = `contentToText(m.content)` (joined `text` blocks)                                                                                     |
| `"assistant"`  | `assistant`               | `text` (joined text blocks), optional `thinking` (joined `thinking` blocks), optional `toolCalls[]` (`toolCall` blocks → `{ id, name, args }`) |
| `"tool"`       | `toolResult`              | `toolResult = { toolCallId, toolName, ok: !m.isError, summary? }`                                                                              |
| `"bash"`       | `bashExecution`           | `bash = { command, exitCode? }`, plus optional `text` (string command output)                                                                  |
| `"compaction"` | `compactionSummary`       | `text` = `m.summary`                                                                                                                           |

`createdAt` is `m.timestamp` (number) when present, else `Date.parse(entry.timestamp)`, else `0`. Optional payload fields are written conditionally (e.g. `...(thinking ? { thinking } : {})`), so an entry only carries the fields its role produced.

### Adapter contract surface

The optional `AgentManager` methods that move these types across the boundary (verbatim, `packages/shared/src/agent.ts`):

```ts
listSessions?(opts?: { allWorkspaces?: boolean }): Promise<AgentSessionInfo[]>;
getTranscript?(sessionPath: string): Promise<AgentTranscriptEntry[]>;
deleteSession?(sessionPath: string): Promise<void>;
switchSession?(sessionPath: string): Promise<{ cancelled: boolean }>;
setSessionName?(name: string): Promise<void>;
```

These are **optional** on `AgentManager`: adapters without a session store omit them, and callers feature-detect (the multiplexer throws for unsupported runtimes). The `path` carried by every `AgentSessionInfo` is the single handle threaded through `getTranscript` (FR-15), `switchSession` (FR-16), and `deleteSession` (FR-19).

---

## [DES-PERSISTENT-API] AgentManager And Host Service

<!-- @see docs/specs/213-app-chat-history/spec.md [FR-13] [FR-14] [FR-15] [FR-16] [FR-19] [FR-20] [NFR-6] [NFR-8] [NFR-9] -->

As-built. History is exposed through four **optional** methods on the
runtime-agnostic `AgentManager` interface (`packages/shared/src/agent.ts`).
Optional because adapters without a session store (e.g. external RPC harnesses)
simply omit them; every caller must feature-detect before invoking. The plan
listed only `listSessions?` / `getTranscript?` / `switchSession?`; the shipped
contract also carries `setSessionName?` and `deleteSession?` (the latter backs
the new FR-19 delete flow), and `listSessions?` takes **no** `onProgress`
callback — progress reporting is deferred (see NFR-8 below).

### AgentManager optional methods (verbatim)

From `packages/shared/src/agent.ts` (`interface AgentManager`):

```typescript
switchSession?(sessionPath: string): Promise<{ cancelled: boolean }>;
/**
 * List persisted past sessions for the active workspace (newest-first).
 * Optional — adapters without a session store omit it; callers must
 * feature-detect (the multiplexer throws for unsupported runtimes).
 */
listSessions?(opts?: { allWorkspaces?: boolean }): Promise<AgentSessionInfo[]>;
/**
 * Load a past session's transcript (active leaf branch) for read-only
 * display, without disturbing the live session.
 */
getTranscript?(sessionPath: string): Promise<AgentTranscriptEntry[]>;
/**
 * Rename the currently-loaded session.
 */
setSessionName?(name: string): Promise<void>;
/**
 * Delete a persisted session by path.
 */
deleteSession?(sessionPath: string): Promise<void>;
```

Notes on the real shapes:

- `listSessions?` is keyed by an options object `{ allWorkspaces?: boolean }`,
  not a positional flag, and returns `AgentSessionInfo[]` — whose real fields are
  `path` (the open/switch/delete handle), `updatedAt`, optional `cwd`, etc. (see
  `[DES-PERSISTENT-DATA]`). There is no `sessionPath` / `modifiedAt` / `source`
  field.
- `getTranscript?` / `deleteSession?` are keyed by `sessionPath: string` (the
  `path` from a listed `AgentSessionInfo`); `setSessionName?` renames the
  **currently-loaded** session and takes only `name`.
- Both managed adapters implement these by delegating to the dependency-free
  `node:fs` JSONL reader in `packages/agent/pi/src/session-store.ts`
  (`listSessionsFromDisk` / `readTranscriptFromDisk`). The `pi-sdk` adapter
  imports that same reader from the `pi` package rather than instantiating a Pi
  SDK `SessionManager`. Importing a Pi SDK _value_ into the host bundle was
  reverted for a bundle-size regression (~670 KB → ~13 MB, commit `b17ccce`); see
  `[DES-PERSISTENT-STORE]` and `[DES-DEC]`.

### MultiplexedAgentManager guard-delegation

`MultiplexedAgentManager` (`apps/vscode/src/multiplex-agent-manager.ts`)
implements `AgentManager` and routes every call to the **active** instance. For
history it promotes the optional methods to required on its own surface and
guard-delegates: if the active runtime lacks the method it throws a typed,
human-readable error instead of returning a silent empty result. This is the
seam that maps "runtime has no session store" into a thrown error the
`HistoryService` catches and converts to `supported: false`.

```typescript
// History — delegate to the active runtime; throw when it lacks the method.
async listSessions(opts?: { allWorkspaces?: boolean }): Promise<AgentSessionInfo[]> {
  const active = this.requireActive();
  if (!active.manager.listSessions) {
    throw new Error(`Runtime ${active.label} does not support session history`);
  }
  return active.manager.listSessions(opts);
}

async getTranscript(sessionPath: string): Promise<AgentTranscriptEntry[]> {
  const active = this.requireActive();
  if (!active.manager.getTranscript) {
    throw new Error(`Runtime ${active.label} does not support session history`);
  }
  return active.manager.getTranscript(sessionPath);
}

async setSessionName(name: string): Promise<void> {
  const active = this.requireActive();
  if (!active.manager.setSessionName) {
    throw new Error(`Runtime ${active.label} does not support renaming sessions`);
  }
  return active.manager.setSessionName(name);
}

async deleteSession(sessionPath: string): Promise<void> {
  const active = this.requireActive();
  if (!active.manager.deleteSession) {
    throw new Error(`Runtime ${active.label} does not support deleting sessions`);
  }
  return active.manager.deleteSession(sessionPath);
}
```

`requireActive()` itself throws `"No configured agent runtime"` when no instance
is selected, so callers never see a null active manager.

| Method on multiplexer | Guard condition (active instance) | Thrown message                                        |
| --------------------- | --------------------------------- | ----------------------------------------------------- |
| `listSessions`        | `!active.manager.listSessions`    | `Runtime ${label} does not support session history`   |
| `getTranscript`       | `!active.manager.getTranscript`   | `Runtime ${label} does not support session history`   |
| `setSessionName`      | `!active.manager.setSessionName`  | `Runtime ${label} does not support renaming sessions` |
| `deleteSession`       | `!active.manager.deleteSession`   | `Runtime ${label} does not support deleting sessions` |

### HistoryService (host)

`apps/vscode/src/services/history/history-service.ts` is the thin host wrapper
the bridge calls. It holds a single `AgentManager` (the multiplexer) plus a
scoped child `Logger` (`logger.child("history")`), and maps the multiplexer's
"unsupported" throw into a `supported: false` result the webview can render as a
harness-owned-history state (NFR-9) instead of an error.

Result shape and methods (verbatim):

```typescript
export interface SessionListResult {
  /** False when the active runtime has no session store (external harness). */
  supported: boolean;
  sessions: AgentSessionInfo[];
}

export class HistoryService {
  private readonly log: Logger;

  constructor(
    private readonly manager: AgentManager,
    logger: Logger,
  ) {
    this.log = logger.child("history");
  }

  /** List persisted sessions for the active runtime (always reads fresh). */
  async listSessions(opts?: { allWorkspaces?: boolean }): Promise<SessionListResult> {
    if (!this.manager.listSessions) {
      return { supported: false, sessions: [] };
    }
    try {
      const sessions = await this.manager.listSessions(
        opts?.allWorkspaces ? { allWorkspaces: true } : undefined,
      );
      this.log.info("listSessions", { count: sessions.length });
      return { supported: true, sessions };
    } catch (err) {
      this.log.warn(
        `listSessions unsupported/failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return { supported: false, sessions: [] };
    }
  }

  /** Load a past session's transcript (read-only). */
  async getTranscript(sessionPath: string): Promise<AgentTranscriptEntry[]> {
    /* … */
  }

  /** Rename the currently-loaded session. */
  async setSessionName(name: string): Promise<void> {
    /* … */
  }

  /** Delete a persisted session by path. */
  async deleteSession(sessionPath: string): Promise<void> {
    /* … */
  }
}
```

Behavioral contract as shipped:

- **Two-level feature detection.** `listSessions` returns `supported: false`
  early if the method is absent on the manager, and _also_ catches the
  multiplexer's "unsupported runtime" throw (logged at `warn`) into the same
  `supported: false`. This is the NFR-9 graceful-degradation path.
- **`getTranscript`** is fail-soft: a missing method or a thrown error is logged
  (`error`) and returns `[]`, so a single bad session file cannot break the
  History view.
- **`setSessionName` / `deleteSession`** are no-ops when the underlying method is
  absent (`if (!this.manager.<method>) return;`); otherwise they delegate
  straight through and let the caller handle rejection.

### Deferred — no cache, no progress (NFR-8)

The plan-state `[DES-PERSISTENT-API]` claimed the `HistoryService` would "own
`sessionPath + modifiedAt` caching" and that `listSessions` would accept an
`onProgress(loaded, total)` callback. **Neither shipped.** The as-built service:

- **Reads fresh on every call** — there is no in-memory cache keyed by
  `path + mtime`, no memoization, and no invalidation. Each `listSessions`
  re-scans and re-derives rows via `listSessionsFromDisk`. (Its own JSDoc states
  "always reads fresh".)
- **Has no `onProgress` / progress payload.** The `AgentManager.listSessions?`
  signature carries no progress callback, and no `progress` field is emitted on
  the list response.

Both are tracked as NFR-8 follow-ups (large-history usability: cache normalized
rows by `path + mtime`; surface first-load progress) rather than as present
behavior. See `[DES-PERSISTENT-TEST]` for the `history-service.test.ts` coverage
that asserts the current fresh-read + degrade-safely behavior.

---

## [DES-PERSISTENT-BRIDGE] Bridge Protocol (as-built)

<!-- @see docs/specs/213-app-chat-history/spec.md [FR-13] [FR-14] [FR-15] [FR-16] [FR-19] [FR-20] [NFR-6] [NFR-9] -->

History rides the same discriminated-union bridge as the rest of chat — no
new transport, no side channel. Five `ChatToAgent` variants flow webview→host
and two `AgentToChat` variants flow host→webview, all namespaced `session/*` or
`history/*`. The variants live in the same `ChatToAgent` / `AgentToChat` unions
as every other chat message (`packages/shared/src/messages.ts`), so the
discriminated-`type` switch in `sidebar-panel.ts` routes them with no special
casing beyond a single fan-in `case` group.

The shared payload types (`AgentSessionInfo`, `AgentTranscriptEntry`) are
runtime-agnostic and epoch-ms-normalized so the shapes survive the webview
`postMessage` boundary unchanged — the host never imports an engine type into
the bundle (NFR-9; see [DES-PERSISTENT-DATA]).

### Webview → Host (`ChatToAgent`)

All five are routed by one fan-in `case` group in the inbound switch
(`apps/vscode/src/panels/sidebar-panel.ts:2252`):

```text
case "session/list":
case "history/load":
case "history/reopen":
case "session/delete":
case "session/revealCwd": {
  void handleHistoryCommand(msg);
  return;
}
```

| Variant `type`      | Payload fields (verbatim)                     | Purpose                                                   |
| ------------------- | --------------------------------------------- | --------------------------------------------------------- |
| `session/list`      | `requestId?: string; allWorkspaces?: boolean` | List persisted past sessions for the workspace (FR-14).   |
| `history/load`      | `requestId?: string; sessionPath: string`     | Load one session's transcript, read-only display (FR-15). |
| `history/reopen`    | `requestId?: string; sessionPath: string`     | Reopen a past session as the active session (FR-16).      |
| `session/delete`    | `requestId?: string; sessionPath: string`     | Delete a persisted session by path (FR-19).               |
| `session/revealCwd` | `requestId?: string; cwd: string`             | Reveal a session's workspace folder in the OS (FR-20).    |

> **Field-name note:** the on-the-wire handle is `sessionPath` (the bridge
> variant field), which carries the value of `AgentSessionInfo.path` (the
> shared-type field). `session/revealCwd` carries `cwd`
> (`AgentSessionInfo.cwd?`). `requestId` is optional on every History variant —
> unlike the request/response chat commands, History list/load responses are
> matched by `type` (and echo `sessionPath`), so a missing `requestId` is valid.

### Host → Webview (`AgentToChat`)

| Variant `type`   | Payload fields (verbatim)                                                  | Sent by                                                             |
| ---------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `session/list`   | `requestId?: string; supported: boolean; sessions: AgentSessionInfo[]`     | Response to `session/list`; also re-emitted after `session/delete`. |
| `history/loaded` | `requestId?: string; sessionPath: string; entries: AgentTranscriptEntry[]` | Response to `history/load`.                                         |

`supported: false` means the active runtime has no AFX-readable session store
(e.g. an external harness) — the History view renders an empty/unsupported state
rather than an error.

### Per-variant handler behavior

`handleHistoryCommand` (`apps/vscode/src/panels/sidebar-panel.ts:3240`) dispatches
on `msg.type`. Listing and reading are **out-of-band**: they touch only
`historyService`, never the live runtime. Only `history/reopen` repoints the
runtime.

```text
session/list      → historyService.listSessions({ allWorkspaces? })
                    → post session/list { requestId?, supported, sessions }

history/load      → historyService.getTranscript(sessionPath)
                    → post history/loaded { requestId?, sessionPath, entries }

history/reopen    → agentManager.switchSession?.(sessionPath)   // { cancelled: boolean }
                    if cancelled → return (no UI change)
                    → historyService.getTranscript(sessionPath)
                    → transcriptToTimeline(entries) → { messages, tools }
                    → state.messages/tools replaced, isStreaming=false,
                      lastUsageTotals=null
                    → postSnapshot()              // rehydrated chat/state snapshot
                    → void broadcastRuntimeSettings()

session/delete    → historyService.deleteSession(sessionPath)
                    → historyService.listSessions()
                    → post session/list { supported, sessions }   // fresh list, no requestId

session/revealCwd → if (!cwd.trim()) return
                    → result = historyService.listSessions({ allWorkspaces: true })
                    → if sessions.some(session.cwd === cwd):
                        void vscode.env.openExternal(vscode.Uri.file(cwd))
                    // fire-and-forget; no AgentToChat response
```

Key as-built behaviors:

- **`sessionPath` handles are validated in the adapters before filesystem or
  runtime actions.** Both Pi adapters call
  `assertSessionPathAllowed(sessionPath, piSessionRoots(...))` before
  `switchSession`, `getTranscript`, and `deleteSession`. The guard requires an
  existing `.jsonl` file whose resolved real path is under one of the known Pi
  session roots, so a crafted webview message cannot read, switch to, or unlink
  an arbitrary local path.
- **`history/reopen` posts a rehydrated snapshot, not a dedicated event.** After
  `switchSession` repoints the live runtime, the host runs the loaded entries
  through `transcriptToTimeline`, replaces `state.messages` / `state.tools`, and
  emits the standard `chat/state` snapshot via `postSnapshot()` — the same shape
  the Chat view already consumes on ready/reconnect. There is **no**
  `history/reopened` variant. `switchSession` is an optional `AgentManager`
  method (`switchSession?(sessionPath): Promise<{ cancelled: boolean }>`); when
  absent the host treats it as `{ cancelled: true }`, and a `cancelled` result
  returns early with no UI change.
- **`session/delete` reuses the `session/list` response shape.** After deleting,
  the host re-lists and posts a fresh `session/list` (no `requestId`); the
  webview reconciles its list from that broadcast rather than a delete-specific
  ack.
- **`session/revealCwd` is fire-and-forget but path-guarded.** The host trims
  `cwd`, re-lists sessions with `{ allWorkspaces: true }`, and opens the folder
  only if that cwd appears in a discovered session row. There is **no**
  corresponding `AgentToChat` response. Reveal is a pure host-OS action; the
  webview gets no confirmation message (NFR-9: only the host touches `vscode`).

### Resolved open question — delete / rename kept, export deferred

The earlier OQ over which session-mutation actions to ship is **resolved**: the
owner kept **delete** (`session/delete`, FR-19) and **rename**, while **export
is deferred**. There is consequently no `session/export` bridge variant; the
five `ChatToAgent` History variants above are the complete set.

### Deferred (NFR-8): progress streaming

- **No `onProgress` / streaming for History.** Every History exchange is a single
  request → single response (or fire-and-forget for reveal). There is no
  incremental/progress variant for list or transcript load.
- **No host-side cache.** `HistoryService` reads the on-disk store fresh on every
  `session/list` / `history/load` call; the bridge carries no cache-invalidation
  or staleness signal. Caching and progressive load are deferred under NFR-8.

---

## [DES-PERSISTENT-FLOW] List, Load, Reopen, Reveal, Delete (as-built)

<!-- @see docs/specs/213-app-chat-history/spec.md [FR-13] [FR-14] [FR-15] [FR-16] [FR-19] [FR-20] [NFR-7] -->

The persistent-session surface exposes five bridge commands — `session/list`, `history/load`,
`history/reopen`, `session/delete`, `session/revealCwd` — all dispatched from the webview's
`SessionBrowser` view (`apps/chat/src/views/session-browser.tsx`) to the host's single
`handleHistoryCommand` switch (`apps/vscode/src/panels/sidebar-panel.ts:3240`). The host routes each
through `HistoryService` (`apps/vscode/src/services/history/history-service.ts`), which delegates to
the active `AgentManager`'s optional session methods. For the bundled Pi RPC runtime those resolve to
the dependency-free `node:fs` helpers in `packages/agent/pi/src/session-store.ts` (`piSessionRoots`,
`listSessionsFromDisk`, `readTranscriptFromDisk`) plus `unlink` for delete.

Key invariant (NFR-7): **listing and read-only load never touch the live runtime** — both are
out-of-band disk reads. Only `history/reopen` calls `agentManager.switchSession` and re-points the
running session.

### List (`session/list`)

The browser re-sends `session/list` every time the Past-sessions surface becomes active (the agent
writes new `*.jsonl` files between visits), and on the explicit refresh button. The host reads fresh
each call — `HistoryService.listSessions` holds no cache.

```text
SessionBrowser (active || refresh)
  bridgeSend { type: "session/list" }
        │
        ▼  webview → host bridge
handleHistoryCommand("session/list")                 sidebar-panel.ts:3249
  historyService.listSessions(allWorkspaces?)         history-service.ts:28
    guard: manager.listSessions defined?
      ├─ no  → { supported: false, sessions: [] }     (external harness)
      └─ yes → manager.listSessions()                 rpc-manager.ts:636
                 roots = piSessionRoots(sessionDir, agentDir)      session-store.ts:262
                 listSessionsFromDisk(roots)                       session-store.ts:270
                   findSessionFiles(root) per root → merge + dedupe (Set)
                   cap to MAX_PARSED_SESSIONS by mtime
                   parseSessionInfo(readFile(path)) per file
                   → AgentSessionInfo[] sorted by updatedAt desc
        │
        ▼
post { type: "session/list", supported, sessions }   sidebar-panel.ts:3253
        │
        ▼  host → webview bridge
bridgeOn("session/list") → setList({ loading:false, supported, sessions })
  supported === false → "Managed by the runtime" StatusBlock
  sessions === []      → "No past conversations yet" StatusBlock
  else → group by dayLabel(updatedAt), filter by `query`, render SessionRow per session
```

`piSessionRoots` merges up to three roots so history is found wherever Pi actually wrote it:
the injected `sessionDir`, `<agentDir>/sessions`, and the `~/.pi/agent/sessions` default fallback
(deduped). Each `AgentSessionInfo` row carries `id`, `path`, optional `label` / `firstMessage`,
`messageCount`, `createdAt`, `updatedAt`, optional `cwd`, `forkedFrom`, and `hasBranches`.

### Read-only load (`history/load`)

Opening a row shows its transcript without disturbing the live session. The browser sets
`opened = { session, entries: null }` (rendering the loading state) and waits for `history/loaded`.

```text
SessionRow onOpen → openSession(session)              session-browser.tsx:112
  setOpened({ session, entries: null })
  bridgeSend { type: "history/load", sessionPath: session.path }
        │
        ▼  host bridge
handleHistoryCommand("history/load")                  sidebar-panel.ts:3261
  historyService.getTranscript(sessionPath)           history-service.ts:47
    guard: manager.getTranscript defined? (else [])
    manager.getTranscript(sessionPath)                rpc-manager.ts:643
      assertSessionPathAllowed(sessionPath, piSessionRoots(...))
      readTranscriptFromDisk(sessionPath)             session-store.ts:312
        parseTranscript(readFile(sessionPath, "utf8")) → active leaf-branch
        → AgentTranscriptEntry[]   (role: user|assistant|tool|bash|compaction)
        on any read/parse error → []
        │
        ▼
post { type: "history/loaded", sessionPath, entries } sidebar-panel.ts:3263
        │
        ▼  host → webview bridge
bridgeOn("history/loaded") → if opened.session.path === msg.sessionPath
                                setOpened({ ...prev, entries: msg.entries })
  shared transcript-to-timeline mapper pairs calls/results and preserves standalone activity
  TranscriptView renders the mapped items through ConversationTimeline in read-only mode
  (footer label "Read-only"; switchSession is NEVER called here — NFR-7)
```

The read-only and reopen paths consume the same pure transcript-to-timeline mapping. Assistant tool
calls are reconciled with matching results by `toolCallId`, so one execution appears once with its
final status/output. Unmatched tool results and standalone bash executions become synthetic,
content-empty assistant timeline items with attached `ChatToolView`s at their original chronological
position; they are never discarded merely because no assistant call row exists. The read-only path
passes those items to `ConversationTimeline` with `readOnly` enabled. That mode preserves the same
supported assistant prose, compaction, tool status, and output as Chat while suppressing result
actions, SDD guides, host commands, and live-region announcements.

### Reopen & continue (`history/reopen`)

Reopen is the only flow that mutates the live runtime. The host switches the running session, reads
the transcript, maps it into the Chat view's snapshot shape via `transcriptToTimeline`
(`apps/vscode/src/services/history/transcript-to-timeline.ts`), and pushes a standard `chat/state`
snapshot — the same surface the live stream produces. The webview's `onReopened` callback jumps the
shell back to the Chat tab (`apps/chat/src/app.tsx` — `onReopened={() => setActiveTab("chat")}`).

```text
TranscriptView footer "Reopen & continue" → reopen(session)   session-browser.tsx:117
  bridgeSend { type: "history/reopen", sessionPath: session.path }
  setOpened(null); onReopened?.()  → setActiveTab("chat")      app.tsx:267
        │
        ▼  host bridge
handleHistoryCommand("history/reopen")                sidebar-panel.ts:3271
  switched = agentManager.switchSession
               ? await agentManager.switchSession(sessionPath)  rpc-manager.ts:624
               : { cancelled: true }
    switchSession → assertSessionPathAllowed(sessionPath, piSessionRoots(...))
                  → RPC request { type: "switch_session", sessionPath }
    switched.cancelled === true → return (no rehydrate)
    thrown error → log + return
  entries  = historyService.getTranscript(sessionPath)          (read leaf branch)
  { messages, tools } = transcriptToTimeline(entries)           transcript-to-timeline.ts:16
        user      → ChatMessageView { role:"user", content: entry.text }
        assistant → ChatMessageView { content, thinking?, tools? } + ChatToolView per toolCall
        tool      → reconcile toolResult.ok onto matching ChatToolView (status ok|error)
        bash      → ChatToolView { toolName:"bash", status from exitCode }
        compaction→ compactionSummary row
  state.messages = messages; state.tools = tools
  state.isStreaming = false; state.lastUsageTotals = null
  postSnapshot()                  → post { type: "chat/state", messages, tools }
  void broadcastRuntimeSettings()
        │
        ▼
Chat tab renders rehydrated transcript; user continues the live session.
```

### Reveal in OS (`session/revealCwd`)

The project chip on a row (and the stats project count) derive from `session.cwd`. Reveal opens that
workspace folder in the OS file manager via VS Code's `env.openExternal`.

```text
SessionRow project chip onReveal → revealCwd(session.cwd ?? "")  session-browser.tsx:126
  cwd truthy → bridgeSend { type: "session/revealCwd", cwd }
        │
        ▼  host bridge
handleHistoryCommand("session/revealCwd")             sidebar-panel.ts:3297
  msg.cwd.trim()
  result = historyService.listSessions({ allWorkspaces: true })
  if result.sessions.some((session) => session.cwd === cwd):
    void vscode.env.openExternal(vscode.Uri.file(cwd))
```

### Delete (`session/delete`)

Delete unlinks the on-disk session file, then the host immediately re-lists and pushes a fresh
`session/list` so the row disappears without a client round-trip to re-request. Delete is reachable
from the row's hover trash affordance and from the open transcript's header/`onDelete`.

```text
SessionRow trash | TranscriptView onDelete → remove(session)    session-browser.tsx:123
  bridgeSend { type: "session/delete", sessionPath: session.path }
  (TranscriptView path also setOpened(null) to leave the read-only view)
        │
        ▼  host bridge
handleHistoryCommand("session/delete")                sidebar-panel.ts:3291
  historyService.deleteSession(sessionPath)           history-service.ts:64
    guard: manager.deleteSession defined?
    manager.deleteSession(sessionPath)                rpc-manager.ts:652
      assertSessionPathAllowed(sessionPath, piSessionRoots(...))
      await unlink(sessionPath)                       (node:fs/promises)
  result = historyService.listSessions()              (re-read fresh)
  post { type: "session/list", supported, sessions }  → browser re-renders
```

### Command → service → store mapping

| Bridge command      | Host handler (sidebar-panel.ts) | HistoryService method | AgentManager method (rpc-manager.ts)        | Disk primitive (session-store.ts)                                              | Touches live runtime |
| ------------------- | ------------------------------- | --------------------- | ------------------------------------------- | ------------------------------------------------------------------------------ | -------------------- |
| `session/list`      | `handleHistoryCommand` :3249    | `listSessions` :28    | `listSessions` :636                         | `piSessionRoots` + `listSessionsFromDisk`                                      | No                   |
| `history/load`      | `handleHistoryCommand` :3261    | `getTranscript` :47   | `getTranscript` :643                        | `assertSessionPathAllowed` + `readTranscriptFromDisk`                          | No (NFR-7)           |
| `history/reopen`    | `handleHistoryCommand` :3271    | `getTranscript` :47   | `switchSession` :624 + `getTranscript` :643 | `assertSessionPathAllowed` + `readTranscriptFromDisk` (+ RPC `switch_session`) | Yes                  |
| `session/delete`    | `handleHistoryCommand` :3291    | `deleteSession` :64   | `deleteSession` :652                        | `assertSessionPathAllowed` + `unlink`                                          | No                   |
| `session/revealCwd` | `handleHistoryCommand` :3297    | — (direct host)       | —                                           | — (`vscode.env.openExternal`)                                                  | No                   |

### Unsupported / deferred behaviours

- **External harness:** when the active `AgentManager` does not implement `listSessions`,
  `HistoryService.listSessions` returns `{ supported: false, sessions: [] }`; `getTranscript` /
  `deleteSession` no-op (return `[]` / nothing). The browser surfaces the "Managed by the runtime"
  StatusBlock.
- **No cache, no progress (NFR-8):** `HistoryService` reads fresh on every call and there is no
  `onProgress` streaming for large transcripts; both are deferred. Large histories are bounded only
  by `listSessionsFromDisk`'s `MAX_PARSED_SESSIONS` mtime cap.

---

## [DES-PERSISTENT-UI] Persistent History UI (as-built)

<!-- @see docs/specs/213-app-chat-history/spec.md [FR-14] [FR-15] [FR-16] [FR-17] [FR-18] [FR-19] [FR-20] [FR-21] [FR-22] -->

> **As-built — supersedes the plan-state UI sketch.** The persistent surface ships in
> `apps/chat/src/views/session-browser.tsx` (the component is `SessionBrowser`, **not**
> `history.tsx` — `history.tsx` renders the separate live work-log on the _Current session_
> sub-tab). The History tab shell that hosts both sub-tabs lives in `apps/chat/src/app.tsx`
> (the `TabsContent value="history"` block). Field names below are verbatim from
> `AgentSessionInfo` / `AgentTranscriptEntry` in `packages/shared/src/agent.ts`.

### Surface map

| Surface                      | Where                                                                           | Renders                                                                                                               |
| ---------------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| History tab shell + header   | `apps/chat/src/app.tsx` (`TabsContent value="history"`)                         | `History` heading, "Browse and reopen past conversations." sub-line, **Past sessions \| Current session** sub-tabs    |
| Past sessions surface        | `apps/chat/src/views/session-browser.tsx` (`SessionBrowser`)                    | search row + Refresh, stats bar, day-grouped session rows                                                             |
| Session row                  | `session-browser.tsx` (`SessionRow`)                                            | icon square, truncated label, fork marker, meta line, project chip, hover-reveal delete                               |
| Read-only transcript         | `session-browser.tsx` (`TranscriptView`) + shared `ConversationTimeline`        | back / title / Copy session recap / delete header, Chat-parity read-only timeline, sticky `Read-only` footer + Reopen |
| Status / empty / unsupported | `session-browser.tsx` (`StatusBlock`)                                           | loading, "Managed by the runtime", "No past conversations yet", "No sessions match …"                                 |
| Current session work-log     | `apps/chat/src/views/history.tsx` (`History`) — see `[DES-HISTORY-MOCKUP-LIVE]` | the live in-session timeline (separate feature, not persistent)                                                       |

### History tab shell (sub-tabs)

The History tab is a two-pane shell. `app.tsx` holds the sub-tab state
(`const [historyTab, setHistoryTab] = useState<"past" | "current">("past")`) and a header that
renders two Settings-style segmented buttons from
`[{ id: "past", label: "Past sessions", shortLabel: "Past" }, { id: "current", label: "Current session", shortLabel: "Current" }]`.

- The active button gets `border-border bg-muted text-foreground shadow-sm ring-1 ring-foreground/10`;
  inactive buttons are transparent-bordered with a hover treatment — the same visual idiom as the
  Settings sub-nav (uppercase `font-mono text-[9px] tracking-[0.06em]` pills).
- **Container-query short labels (FR-21):** each button renders both `{t.label}` and `{t.shortLabel}`;
  the long label is `hidden @[250px]:inline` and the short label is `@[250px]:hidden`. Below the
  `@container` width of 250px the tabs collapse to **PAST** / **CURRENT**. The button strip itself is
  `grid grid-cols-2 gap-1` at narrow width and switches to `@[280px]:flex @[280px]:flex-wrap` once there
  is room.
- The two panes are both mounted and toggled with `hidden`: the Past pane wraps `SessionBrowser`
  (`active={activeTab === "history" && historyTab === "past"}`, `onReopened={() => setActiveTab("chat")}`),
  the Current pane wraps `History`.

`SessionBrowser`'s `active` prop drives a fresh re-read: a `useEffect` keyed on `active` calls
`bridgeSend({ type: "session/list" })` every time the Past sub-tab becomes visible (the agent writes
new sessions to disk between visits, and there is **no** in-host cache — see NFR-8).

### Past-sessions surface (`SessionBrowser`)

Layout, top to bottom (`<section aria-label="Past sessions">`):

1. **Search row** — a `Search`-icon `Input` (`placeholder="Search…"`, `aria-label="Search sessions"`)
   bound to local `query` state, plus a ghost icon **Refresh** button (`RefreshCw`, spins via
   `list.loading && "animate-spin"`, `aria-label="Refresh sessions"`). Refresh re-issues
   `session/list`.
2. **Stats bar (FR-20)** — shown only when `!list.loading && list.supported && stats.sessions > 0`. A
   `font-mono text-[10px]` line reading `N sessions · M messages · K projects`, where
   `stats = { sessions: list.sessions.length, messages: Σ messageCount, projects: |unique cwd| }`
   (computed over the full list, not the filtered view). The projects segment is prefixed with a
   `Folder` glyph and is omitted when `stats.projects === 0`. The container is `flex flex-wrap` so the
   three segments wrap at narrow width.
3. **Day-grouped list** — sessions are filtered by `query` (case-insensitive match on
   `label ?? firstMessage`, `id`, **or** the localized `updatedAt` date string), sorted by `updatedAt`
   descending, then bucketed by `dayLabel(updatedAt)` into **Today / Yesterday / "MMM D"**. Each group
   has a **sticky band** (`sticky top-0 z-10 … bg-muted/80 backdrop-blur-sm`) with a `CalendarClock`
   glyph, the truncated day label, and `· {sessions.length}`.

**Session row (`SessionRow`):** a `group` flex row whose `data-testid` is `session-row-${session.id}`:

- **Icon square** — `MessageSquareText` in a `size-7` bordered square.
- **Label** — `session.label ?? session.firstMessage ?? session.id`, truncated, `text-[13px] font-medium`.
- **Fork marker (FR-17, display-only)** — a `GitBranch` glyph (`aria-label="Forked session"`) rendered
  only when `session.forkedFrom` is set. (Branch awareness is read-only; there is no branch navigation.)
- **Meta line** — `{messageCount} {message|messages} · {relativeTime(updatedAt)}`, where `relativeTime`
  yields `just now / Nm ago / Nh ago / Nd ago` and falls back to a locale date past 30 days.
- **Project chip (FR-20)** — present only when `session.cwd` is set. A clickable chip whose label is
  `projectName(cwd)` (the workspace basename = last path segment). Clicking sends
  `{ type: "session/revealCwd", cwd }` to reveal the folder in the OS file manager;
  `title`/`aria-label` are `Reveal project in file manager` / `Reveal {project} in file manager`. The chip prefixes a
  `Folder` glyph and the text label is `hidden … @[280px]:inline` — **icon-only below 280px** (FR-21).
- **Delete (FR-19)** — a trailing `Trash2` button that is collapsed (`w-0 opacity-0`) until the row is
  hovered (`group-hover:w-8 group-hover:opacity-100`), `aria-label="Delete {label}"`. Sends
  `{ type: "session/delete", sessionPath: session.path }`.

Opening a row calls `openSession`, which sets `opened` and sends
`{ type: "history/load", sessionPath: session.path }`.

**Status / empty states (`StatusBlock`):** the list region swaps to a centered card for:
loading (`LoaderCircle`, "Reading sessions…"); unsupported runtime
(`!list.supported` → `Cpu`, "Managed by the runtime", "This runtime keeps its own conversation
history; AFX lists sessions for the bundled runtime." — the **NFR-9 harness-boundary fallback**);
empty (`MessageSquareText`, "No past conversations yet"); and no-match
(`Search`, `No sessions match "{query}"`).

### Read-only transcript (`TranscriptView`)

Shown when `opened` is set. A `@container` section (`aria-label="Session transcript"`):

- **Sticky header** — back button (`ChevronLeft`, `aria-label="Back to sessions"` → clears `opened`),
  truncated title (`session.label ?? session.firstMessage ?? session.id`), a **Copy session recap**
  button (`Copy` → `Check` for 1.2s) that writes deterministic Markdown to the clipboard, and a
  `Trash2` delete button (`aria-label="Delete session"`) that removes the session and returns to the list.
- **Body** — `LoaderCircle` "Loading transcript…" while `entries === null`; "This session has no
  messages." when empty; otherwise map `AgentTranscriptEntry[]` through
  `@afx/shared`'s `transcriptToTimeline(entries)` and render its messages with
  `<ConversationTimeline readOnly />`. The host compatibility module
  `apps/vscode/src/services/history/transcript-to-timeline.ts` re-exports the same mapper for reopen,
  preventing preview/rehydration drift.
- **Execution cardinality** — a matching `toolResult.toolCallId` completes the originating assistant
  tool view, so the call/result pair renders once. Unmatched tool results and `bash` entries become
  content-empty assistant items carrying a tool at the original transcript position; bash uses
  `toolName: "bash"` with `args.command` and exit-code-derived status.
- **Read-only policy** — `ConversationTimeline` sets `aria-live="off"`, suppresses streaming/error live
  alerts, result actions, and SDD workflow guides. It retains supported assistant prose, including
  literal `Next:` sections, because History must display recorded content rather than turn it into
  runnable suggestions.

- **Sticky footer** — left: a mono `Read-only` tag; right: a primary **Reopen & continue** button
  (`ExternalLink`) that collapses to **Reopen** below the `@[280px]` width (FR-21). Reopen sends
  `{ type: "history/reopen", sessionPath: session.path }`, clears `opened`, and fires `onReopened`
  (which the shell uses to switch back to the Chat tab — FR-16).

The transcript body uses the same message-column containment as live Chat. At narrow container
widths, text and tool summaries wrap inside the available column, no row creates horizontal page
overflow, and the sticky header/footer remain reachable without changing the Past/Current sub-tab
geometry.

**Copy session recap (FR-22):** `buildSessionRecap(session, entries)` formats the already-loaded
read-only transcript into Markdown:

```text
# <session label>

## Session
- Project: <workspace basename or Unknown>
- Messages: <messageCount>
- Updated: <locale timestamp>
- First prompt: <firstMessage, single-line>

## Transcript Outline
- User: ...
- Assistant: ...
  - Tool call: edit
- Tool result: edit (ok)
- Bash: pnpm verify (exit 0)
```

The formatter is deterministic and local-only: it does not call an LLM, does not create storage, and
does not include `session.path` or full `cwd`; it uses `projectName(cwd)` for provenance. The outline
is capped at 24 entries with a trailing `...N more entries` marker for long transcripts. Copy failure
is caught and shown through the existing toast surface.

### ASCII mockups

These wireframes mirror the rendered `SessionBrowser` surfaces and follow the box-drawing style of
`[DES-HISTORY-MOCKUP-LIVE]`. Source files that render this surface should
`@see docs/specs/213-app-chat-history/design.md [DES-PERSISTENT-UI]` and the relevant sub-mockup below.

#### [DES-HISTORY-MOCKUP-PERSISTENT-LIST] Past Sessions (normal width)

```text
+------------------------------------------------------------------+
| [hist] History                                                   |
|        Browse and reopen past conversations.                     |
|        [ PAST SESSIONS ][ Current session ]                      |
+------------------------------------------------------------------+
| [search Search…                                  ]   [Refresh]   |
|                                                                  |
| 7 sessions · 184 messages · [folder] 3 projects                  |
+------------------------------------------------------------------+
| [cal] TODAY                                              · 2     |
| ---------------------------------------------------------------- |
| [msg] Wire the session-browser delete flow            [room-led] |
|       12 messages · 2h ago                                       |
| [msg] Fix narrow-width stats wrap [branch]            [afx-chat] |
|       6 messages · 4h ago                            [trash hov] |
+------------------------------------------------------------------+
| [cal] YESTERDAY                                          · 1     |
| ---------------------------------------------------------------- |
| [msg] Draft persistent history design                 [afx-docs]|
|       31 messages · 1d ago                                       |
+------------------------------------------------------------------+
| [cal] MAY 28                                             · 1     |
| ---------------------------------------------------------------- |
| [msg] Investigate Pi JSONL framing                    [agent-pi] |
|       44 messages · 5d ago                                       |
+------------------------------------------------------------------+

Legend: [msg]=MessageSquareText icon square · [branch]=GitBranch fork
marker (only when forkedFrom set) · [room-led]=clickable PROJECT CHIP
(projectName(cwd) = workspace basename; click → session/revealCwd) ·
[trash hov]=Trash2, revealed on row hover (session/delete).
```

#### [DES-HISTORY-MOCKUP-PERSISTENT-TRANSCRIPT] Read-only Transcript

```text
+------------------------------------------------------------------+
| [<]  Wire the session-browser delete flow       [copy]   [trash] |
+------------------------------------------------------------------+
| (o) Add a hover-reveal delete to each session row, and a         |
|     delete button in the transcript header.                      |
|                                                                  |
| (*) Done. The row delete collapses to w-0 until group-hover,     |
|     and the transcript header gets a Trash2 button.              |
|     [tool] Edit                                 complete          |
|     [tool] Read                                 complete          |
|     [tool] Bash  pnpm --filter apps/chat build  exit 1            |
| (cpu) Compacted earlier turns to free context.                   |
+------------------------------------------------------------------+
| READ-ONLY                                   [open] Reopen & cont.|
+------------------------------------------------------------------+

Legend: (o)=user · (*)=assistant · [tool]=the same Chat execution row used by
the live timeline. Matching calls/results appear once with final status; unmatched
results and bash remain visible once at their transcript position. There are no
runnable result/SDD actions or live announcements in read-only mode. (cpu)=compaction
summary. Footer = sticky `Read-only` tag + Reopen. Header back=[<], [trash]=delete.
```

#### [DES-HISTORY-MOCKUP-PERSISTENT-NARROW] Narrow Width (~230px container query)

```text
+----------------------------+
| [hist] History             |
|        Browse and reopen   |
|        [ PAST ][ CURRENT ] |
+----------------------------+
| [search Search… ] [Refrsh] |
|                            |
| 7 sessions · 184 messages  |
| · [folder] 3 projects      |
+----------------------------+
| [cal] TODAY          · 2   |
| -------------------------- |
| [msg] Wire the session-... |
|       12 messages · 2h ago |
|                     [fldr] |
| [msg] Fix narrow.. [branch]|
|       6 messages · 4h ago  |
|                     [fldr] |
+----------------------------+

Container queries (FR-21), all keyed on the @container width:
  - Sub-tabs collapse to PAST | CURRENT below @[250px]
    (label hidden @[250px]:inline / shortLabel @[250px]:hidden);
    button strip is grid-cols-2 below @[280px].
  - Project chip is ICON-ONLY ([fldr]) below @[280px]
    (chip text is hidden … @[280px]:inline).
  - Stats bar (flex flex-wrap) wraps the projects segment to a
    second line.
  - Timeline prose and tool summaries wrap inside the message column;
    the page has no horizontal overflow.
  - Transcript footer Reopen button shrinks "Reopen & continue"
    to "Reopen" below @[280px].
This is a per-surface @container query (Settings-style short
labels), NOT a viewport media query.
```

> **Note on file naming:** the persistent surface is `session-browser.tsx` (`SessionBrowser`), not the
> plan's `history.tsx`. `history.tsx` is the separate _Current session_ live work-log shown on the
> other History sub-tab and documented under `[DES-HISTORY-MOCKUP-LIVE]`.

---

## [DES-PERSISTENT-TEST] Persistent History Tests

<!-- @see docs/specs/213-app-chat-history/spec.md [FR-13] [FR-14] [FR-15] [FR-16] [FR-17] [FR-18] [FR-19] [FR-20] [FR-21] [FR-22] [NFR-6] [NFR-8] [NFR-9] -->

As-built test surface. The `pi-sdk/src/sdk-rpc-manager.test.ts` reference from the
plan does not exist; normalization is covered by the dependency-free fs reader test.
The "HistoryService cache" coverage target is deferred (`[NFR-8]`) — the service
reads fresh and has no cache to test.

| Coverage target                                                                                                                                      | Test path / approach                                                    |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| fs reader: list normalization, cwd scoping, multi-root merge/dedupe, newest-first, `piSessionRoots`                                                  | `packages/agent/pi/src/session-store.test.ts`                           |
| fs reader: transcript leaf-branch resolution, trailing metadata rows, role mapping (user/assistant/tool/bash), and session-path guard                | `packages/agent/pi/src/session-store.test.ts`                           |
| `HistoryService`: `supported:false` fallback, fresh reads (no cache), delete delegation, `getTranscript` error → `[]`                                | `apps/vscode/src/services/history/history-service.test.ts`              |
| Shared transcript mapping: paired call/result cardinality, unmatched results, bash command/exit status, compaction, and host compatibility re-export | `packages/shared/src/transcript-to-timeline.test.ts`, host mapper tests |
| Read-only timeline: Chat-renderer parity, no result/SDD actions, `aria-live=off`, no error alert, and recorded Next prose retained                   | `apps/chat/src/components/chat/conversation-timeline.test.tsx`          |
| History UI e2e: list, aggregate stats, reveal-in-OS chip, Chat-parity transcript cardinality, copy recap, reopen, delete → empty state               | `apps/chat/e2e/session-history.spec.ts`                                 |
| Narrow-width e2e: sub-tab label swap, contained timeline wrapping, no horizontal overflow, and reachable sticky controls down to 220px               | `apps/chat/e2e/history-narrow-width.spec.ts`                            |
| Boundary lint: no `@earendil-works/*` import in `apps/chat/src` or `apps/vscode/src`                                                                 | `pnpm verify` (`no-restricted-imports`)                                 |
| Deferred (`[NFR-8]`): HistoryService cache + `onProgress` streaming list — not implemented                                                           | — (no test; see `[DES-DEC]` List freshness row)                         |

---

---

## [DES-HISTORY-REFS] File Reference Map

| Task | File                                                                                                                                                                      | Required @see                                                                                                    |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| 1.x  | `apps/chat/src/views/history.tsx`                                                                                                                                         | `design.md [DES-HISTORY-MOCKUP-LIVE] [DES-HISTORY-COMPONENT-OVERLAY]`                                            |
| 1.x  | `apps/chat/src/lib/history-events.ts`                                                                                                                                     | `design.md [DES-DATA]`                                                                                           |
| 2.x  | `apps/chat/src/components/chat/chat-controller.tsx` future history store slot                                                                                             | `docs/specs/216-app-chat-window-componentization/design.md [DES-HISTORY]`                                        |
| 2.x  | future `ChatHistoryPanel` / `ChatHistoryLoadAction` / `ChatHistoryExportAction`                                                                                           | `docs/specs/216-app-chat-window-componentization/design.md [DES-HISTORY]`; persistence behavior TBD in this spec |
| 4.x  | `packages/shared/src/agent.ts`, `packages/shared/src/messages.ts`                                                                                                         | `design.md [DES-PERSISTENT-DATA] [DES-PERSISTENT-BRIDGE]`                                                        |
| 5.x  | `packages/agent/pi/src/{session-store,rpc-manager}.ts`, `packages/agent/pi-sdk/src/sdk-rpc-manager.ts`                                                                    | `design.md [DES-PERSISTENT-STORE] [DES-PERSISTENT-API] [DES-PERSISTENT-FLOW]`                                    |
| 5.x  | `apps/vscode/src/services/history/history-service.ts`                                                                                                                     | `design.md [DES-PERSISTENT-API] [DES-PERSISTENT-FLOW]`                                                           |
| 7.x  | `apps/chat/src/app.tsx`, `apps/chat/src/views/session-browser.tsx`, `apps/chat/src/components/chat/conversation-timeline.tsx` persistent session list/transcript surfaces | `design.md [DES-PERSISTENT-UI]`                                                                                  |
| 9.x  | `packages/shared/src/transcript-to-timeline.ts`, host compatibility re-export, History/timeline parity tests                                                              | `design.md [DES-PERSISTENT-FLOW] [DES-PERSISTENT-UI] [DES-PERSISTENT-TEST]`                                      |

---

## [DES-HISTORY-QUESTIONS] Open Technical Questions

Reserved-slot questions deferred from `216-app-chat-window-componentization`:

1. What serialized `ChatHistorySession` schema is reloadable and stable across versions?
2. Should load UX activate a composer panel, a top-bar picker, or both?
3. Should reload replace the current session, open a separate session, or present a split preview?

These questions do not block the componentization refactor; they block only the follow-on history persistence implementation.
