---
afx: true
type: DESIGN
status: Draft
owner: "@rixrix"
version: "1.0"
created_at: "2026-05-02T23:56:50.000Z"
updated_at: "2026-05-03T02:59:14.000Z"
tags: ["app", "chat", "history"]
spec: spec.md
---

# App Chat History - Technical Design

---

## [DES-OVR] Overview

The history zone renders the chat webview's active-session work log. It owns the
visible History tab, local filtering/search, runtime state branches, context
save affordance, and the data adapter that converts current chat timeline items
into narrative/trace/audit event rows.

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

<!-- @see spec.md [FR-1] [NFR-1] -->

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

<!-- @see spec.md [FR-1] [FR-2] [NFR-1] -->

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

<!-- @see spec.md [FR-1] [NFR-1] -->

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

| Decision      | Options Considered                       | Choice        | Rationale                                 |
| ------------- | ---------------------------------------- | ------------- | ----------------------------------------- |
| History split | Message spec, chat parent, history child | History child | History is navigation, not live rendering |

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

| Dependency              | Use                                                                                          |
| ----------------------- | -------------------------------------------------------------------------------------------- |
| `100-package-shared`    | `AgentStatus`, `AgentRuntimeStatus`, `ChatTimelineItem`, `ChatMessageView`, usage/tool types |
| `110-package-transport` | Chat webview bridge subscription/send surface through `apps/chat/src/lib/bridge.ts`          |
| `210-app-chat`          | Parent chat app shell and tab routing                                                        |
| `212-app-chat-messages` | Shared tool descriptor behavior used by both live message timeline and History rows          |

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

<!-- @see spec.md [FR-1] [FR-2] [NFR-1] -->

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

<!-- @see spec.md [FR-1] [FR-2] [FR-3] [FR-4] [FR-5] [FR-6] [FR-7] [FR-8] [FR-9] [FR-10] [FR-11] -->

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

---

## [DES-HISTORY-REFS] File Reference Map

| Task | File                                  | Required @see                                                         |
| ---- | ------------------------------------- | --------------------------------------------------------------------- |
| 1.x  | `apps/chat/src/views/history.tsx`     | `design.md [DES-HISTORY-MOCKUP-LIVE] [DES-HISTORY-COMPONENT-OVERLAY]` |
| 1.x  | `apps/chat/src/lib/history-events.ts` | `design.md [DES-DATA]`                                                |

---

## [DES-HISTORY-QUESTIONS] Open Technical Questions

None.
