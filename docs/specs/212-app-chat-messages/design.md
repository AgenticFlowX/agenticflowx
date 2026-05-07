---
afx: true
type: DESIGN
status: Draft
owner: "@rixrix"
version: "1.0"
created_at: "2026-05-02T23:56:50.000Z"
updated_at: "2026-05-05T08:37:39.000Z"
tags: ["app", "chat", "messages", "streaming"]
spec: spec.md
---

# App Chat Messages - Technical Design

---

## [DES-OVR] Overview

The message zone renders the live chat transcript. It owns the conversation rail,
message row anatomy, streamed assistant markdown, thinking trace display, tool
cards, assistant metadata, and live transcript event rows that are not composer
input or settings configuration.

---

## [DES-ARCH] Architecture

```text
@afx/shared ChatTimelineItem[]
        |
        v
apps/chat/src/views/chat.tsx
  bridgeOn(chat/message*, chat/tool*, chat/usage, chat/error)
  -> messages React state
  -> Timeline event flattening
  -> TimelineRow / EventHeader / EventBody / ToolEvent
        |
        +--> apps/chat/src/components/markdown-message.tsx
        +--> apps/chat/src/lib/tool-descriptor.ts
```

---

## [DES-UI] User Interface & UX

Messages should preserve readability during streaming and make tool/thinking states legible without overwhelming the conversation.

## [DES-MESSAGES-MOCKUPS] ASCII UI Mockups

### [DES-MESSAGES-MOCKUP-ASSISTANT] User And Assistant Turn

```text
+------------------------------------------------------------------+
| o You                                             14:02           |
|   +------------------------------------------------------------+ |
|   | Update the chat footer instruction                         | |
|   +------------------------------------------------------------+ |
|       |                                                         |
|       o AFX                                      14:03  [live]   |
|         The footer now says ...                                |
|                                                                  |
|         Used 8.4k actual . Context 41% . Cost $0.0123           |
+------------------------------------------------------------------+
```

### [DES-MESSAGES-MOCKUP-THINKING] Live Thinking Trace

```text
+------------------------------------------------------------------+
|       * thinking ...                                              |
|         reading current specs and matching source anchors         |
|         [>] expands to full reasoning preview                     |
+------------------------------------------------------------------+
```

### [DES-MESSAGES-MOCKUP-TOOL] Tool Call Card

```text
+------------------------------------------------------------------+
|       $ cmd | pnpm verify                                        |
|       -----+---------------------------------------------------- |
|       out  | Packages: +41, tests passed                         |
|            | [>] expands multiline output                         |
+------------------------------------------------------------------+
```

### [DES-MESSAGES-MOCKUP-SYSTEM] Error, Info, Compaction, And Note Rows

System rows are durable timeline content. The compaction summary row owns the full summary text and token delta; transient notifications must not render the full summary.

```text
+------------------------------------------------------------------+
|       ! Error                                                     |
|         Agent runtime error: provider key missing                  |
|                                                                  |
|       i retrying runtime connection                               |
|                                                                  |
|       < Session compacted                         -12.5k tokens   |
|         Summary of previous context...                            |
|         (full compacted-context summary stays in the timeline)     |
|                                                                  |
|       / Note                                      14:05           |
|         remember to update specs first                            |
+------------------------------------------------------------------+
```

### [DES-MESSAGES-MOCKUP-COMPACTION-TOAST] Transient Compaction Confirmation

The toast confirms completion only. It never uses `result.summary` as its description, because long summaries can obscure the transcript.

```text
+------------------------------------------+
| ✓ Session compacted                      |
|   History compacted into a summary.      |
+------------------------------------------+
```

## [DES-MESSAGES-WELCOME-SPEC] Spec Mode Empty State

When `workspaceMode === "spec"` AND the chat thread is empty, the messages surface
replaces the default welcome with a Spec-tailored card:

- Heading: `Spec mode.`
- Subtext (idle): `Planning-only mode. Pick an entry point — or open a sprint/spec file to surface contextual actions.`
- Subtext (doc-active): `I'll stay in your docs. Switch modes if you need code changes.`
- Quick-start buttons (idle): `Next` → `/afx-next`, `Start Sprint` → `/afx-sprint new`,
  `Open Planner` → `/afx-discover capabilities`, `Review Docs` → `/afx-spec review`
- Quick-start buttons (doc-active): doc-aware `Refine` / `Validate` / `Review` (or
  `Pick Next` / `Code` / `Verify` for tasks) routed to `/afx-spec`, `/afx-design`,
  `/afx-task` for standard 4-file docs, or `/afx-sprint` for sprint single-files

Buttons dispatch as draft inserts (`onInsert`) rather than auto-sent commands so the
user can review before sending. The default empty-state component remains untouched
for Code and Explore modes.

## [DES-MESSAGES-COMPONENTS] Timeline Component Anatomy

```text
Timeline
|-- TimelineEvent[] flattening
|   |-- user message
|   |-- assistant tools before assistant content
|   |-- error/info from message prefixes
|   |-- compaction summary
|   `-- note event append
|-- TimelineRow
|   |-- Marker
|   |-- ToolEvent
|   |   `-- ToolEventRow
|   |-- EventHeader
|   |   `-- Eyebrow
|   `-- EventBody
|       |-- MarkdownMessage
|       |   `-- CodeFence
|       |-- ThinkingTrace
|       |-- CompactionCard
|       `-- AssistantMeta
```

| Component/helper             | Owned functionality                                                                          |
| ---------------------------- | -------------------------------------------------------------------------------------------- |
| `Timeline`                   | Flattens transcript messages plus note events into renderable live event rows                |
| `TimelineRow`                | Controls vertical rail layout, reply indentation, and row body dispatch                      |
| `Marker`                     | Maps event kind to avatar/icon tone                                                          |
| `EventHeader` / `Eyebrow`    | Renders compact labels, timestamps, and streaming pulse                                      |
| `EventBody`                  | Routes each event kind to body UI                                                            |
| `MarkdownMessage`            | Renders assistant markdown and delegates fenced code to `CodeFence`                          |
| `ToolEvent` / `ToolEventRow` | Renders compact tool input/output table, running/error state, and multiline output expansion |
| `ThinkingTrace`              | Renders collapsible live thinking preview                                                    |
| `AssistantMeta`              | Renders usage, context, cost, and friendly stop reasons                                      |

### [DES-MESSAGES-COMPONENT-TIMELINE] Timeline And Rows

| Code anchor   | Component contract                                                                                   |
| ------------- | ---------------------------------------------------------------------------------------------------- |
| `Timeline`    | Converts `ChatTimelineItem[]` plus local note events into ordered `TimelineEvent[]` rows             |
| `TimelineRow` | Owns rail grid layout, reply indentation, marker column, and body dispatch                           |
| `Marker`      | Maps row kind to avatar/icon tone and keeps system/tool events visually quieter than human/AFX turns |
| `EventHeader` | Renders row label, timestamp, and streaming pulse for non-tool rows                                  |
| `EventBody`   | Owns per-kind body rendering for user, assistant, error, info, thinking, compaction, and note rows   |

### [DES-MESSAGES-COMPONENT-MARKDOWN] MarkdownMessage And CodeFence

| Code anchor                           | Component contract                                                           |
| ------------------------------------- | ---------------------------------------------------------------------------- |
| `MarkdownMessage`                     | Owns assistant markdown layout and ReactMarkdown component overrides         |
| `components.p/ul/ol/li/blockquote/hr` | Keeps prose compact and readable in side-panel width                         |
| `components.table/thead/th/td`        | Wraps GFM tables in horizontal overflow with compact cell chrome             |
| `components.a`                        | Opens links externally with `target="_blank"` and `rel="noreferrer"`         |
| `components.code`                     | Splits inline code from fenced/block code based on language class or newline |
| `CodeFence`                           | Renders language label, copy button, and scrollable monospace content        |
| `CodeFence.onCopy`                    | Copies code to clipboard and ignores restricted-webview clipboard failures   |

### [DES-MESSAGES-COMPONENT-TOOL-EVENT] ToolEvent And ToolEventRow

| Code anchor              | Component contract                                                        |
| ------------------------ | ------------------------------------------------------------------------- |
| `toolDescriptor`         | Converts raw tool name/args/status into icon, action, and target labels   |
| `ToolEvent`              | Owns compact two-row input/output table card and running/error state      |
| `ToolEventRow`           | Owns label gutter and content cell chrome shared by input and output rows |
| `details/summary` branch | Collapses multiline output into one preview row with expandable full text |

### [DES-MESSAGES-COMPONENT-META] AssistantMeta

| Code anchor             | Component contract                                                                     |
| ----------------------- | -------------------------------------------------------------------------------------- |
| `AssistantMeta`         | Renders only meaningful usage/context/cost/stop metadata under assistant text          |
| `FRIENDLY_STOP_REASONS` | Hides normal stop reasons and exposes only user-relevant interruption/limit/end labels |

## [DES-MESSAGES-EVENT-FLOW] Stream Event To Timeline Flow

| Inbound event        | Source anchor            | Local effect                                         | Rendered by                                                                  |
| -------------------- | ------------------------ | ---------------------------------------------------- | ---------------------------------------------------------------------------- |
| `chat/state`         | bridge effect in `Chat`  | Replace `messages` and streaming flag                | `Timeline`                                                                   |
| `chat/messageStart`  | bridge effect in `Chat`  | Append user/assistant placeholder if missing         | `TimelineRow`                                                                |
| `chat/messageDelta`  | bridge effect in `Chat`  | Append assistant text delta                          | `MarkdownMessage`                                                            |
| `chat/thinkingDelta` | bridge effect in `Chat`  | Accumulate live thinking preview                     | `ActivityBar`; timeline thinking support remains message-owned when rendered |
| `chat/messageEnd`    | bridge effect in `Chat`  | Mark message non-streaming and store stop reason     | `AssistantMeta`                                                              |
| `chat/toolStart`     | bridge effect in `Chat`  | Attach running tool to most recent assistant message | `ToolEvent`                                                                  |
| `chat/toolEnd`       | bridge effect in `Chat`  | Mark tool ok/error and summary                       | `ToolEvent`                                                                  |
| `chat/usage`         | bridge effect in `Chat`  | Attach usage to message and footer state             | `AssistantMeta`                                                              |
| `chat/error`         | bridge effect in `Chat`  | Optional transcript-visible error row                | `EventBody` error branch                                                     |
| local note event     | `saveAsNote` in composer | Append note event after messages                     | `EventHeader`/`EventBody` note branch                                        |

## [DES-MESSAGES-MARKDOWN] Markdown And Code Fence Rendering

| Markdown surface             | Source anchor                                  | Behavior                                                            |
| ---------------------------- | ---------------------------------------------- | ------------------------------------------------------------------- |
| Paragraph/list/blockquote/hr | `MarkdownMessage` components map               | Tight message spacing and readable default text                     |
| GFM table                    | `MarkdownMessage` table/thead/th/td components | Horizontal overflow wrapper and bordered rows                       |
| Link                         | `MarkdownMessage` `a` component                | Opens external target with `target="_blank"` and `rel="noreferrer"` |
| Inline code                  | `MarkdownMessage` `code` inline branch         | Muted rounded monospace chip                                        |
| Fenced code                  | `CodeFence`                                    | Language label, scrollable code block, copy button                  |
| Clipboard failure            | `CodeFence.onCopy`                             | Ignore restricted-webview failures without breaking transcript      |

## [DES-MESSAGES-TOOLS] Tool Card And Descriptor Map

| Tool behavior             | Source anchor               | Functionality                                                  |
| ------------------------- | --------------------------- | -------------------------------------------------------------- |
| Descriptor classification | `toolDescriptor`            | Converts raw tool names/args to action label, target, and icon |
| Input row                 | `ToolEvent`, `ToolEventRow` | Shows compact action gutter and target/no-arguments copy       |
| Running state             | `ToolEvent`                 | Shows pulsing dot on input row                                 |
| Output row                | `ToolEvent`                 | Shows `out` or `err` gutter based on status                    |
| Multiline output          | `ToolEvent` `details` block | Collapsed summary plus expandable full output                  |
| Error output              | `ToolEvent`                 | Uses destructive tone for failed tool output                   |

## [DES-MESSAGES-META] Assistant Metadata And Stop Reasons

| Metadata             | Source anchor           | Display rule                                                                            |
| -------------------- | ----------------------- | --------------------------------------------------------------------------------------- |
| Token usage          | `AssistantMeta`         | Show `Used <n> actual` only when usage exists                                           |
| Context percentage   | `AssistantMeta`         | Show rounded context percent when available                                             |
| Cost                 | `AssistantMeta`         | Show cost with small-value precision                                                    |
| Friendly stop reason | `FRIENDLY_STOP_REASONS` | Hide natural/tool stop reasons; show interruptions/max tokens/stop sequence/session end |

---

## [DES-MESSAGES-LIFECYCLE] Message Lifecycle State Machine

A single chat message moves through five states. Tool calls and thinking deltas are sub-events
within `streaming`.

```text
+--------+  send   +-----------+   delta   +-----------+   end    +-----------+
|  idle  |-------->|messageStart|--------->| streaming |--------->| completed |
+--------+         +-----------+           +-----+-----+          +-----------+
    ^                                            |
    |                                            | abort
    |                                            v
    |                                      +-----------+
    +--------------------------------------|  aborted  |
                                           +-----------+
```

| State          | Triggered by                                                    | Timeline render                                             |
| -------------- | --------------------------------------------------------------- | ----------------------------------------------------------- |
| `idle`         | Initial; after `messageEnd`/`aborted`                           | Empty timeline tail or last completed message               |
| `messageStart` | `chat/messageStart`                                             | New row inserted with role + createdAt                      |
| `streaming`    | `chat/messageDelta` / `thinkingDelta` / `toolStart` / `toolEnd` | Delta appended; thinking block updated; tool cards render   |
| `completed`    | `chat/messageEnd`                                               | Streaming flag cleared; stopReason rendered if non-friendly |
| `aborted`      | `chat/aborted`                                                  | Streaming flag cleared; "interrupted" badge rendered        |

Compaction (`agent/compacted`) inserts a `compactionSummary` row in the timeline and may show the short `[DES-MESSAGES-MOCKUP-COMPACTION-TOAST]` confirmation; it is not part of the per-message lifecycle.

---

## [DES-DEC] Key Decisions

| Decision   | Options Considered                               | Choice        | Rationale                                                    |
| ---------- | ------------------------------------------------ | ------------- | ------------------------------------------------------------ |
| Zone split | Composer-owned, chat-parent-owned, message child | Message child | Output rendering changes are independent from input controls |

---

## [DES-DATA] Data Model

Message data comes from shared chat protocol events and local render state for streaming/tool status.

| Data shape              | Owner                                  | Purpose                                                                                                  |
| ----------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `ChatTimelineItem`      | `@afx/shared`                          | Source transcript item stream consumed by `Timeline`                                                     |
| `ChatMessageView`       | `@afx/shared`                          | User/assistant/error/info message shape with content, tools, usage, streaming, and stop reason           |
| `ChatToolView`          | `@afx/shared`                          | Tool call id, name, args, status, and summary                                                            |
| `TimelineEvent`         | `apps/chat/src/views/chat.tsx`         | UI-local flattened row union for user, assistant, tool, thinking, error, info, compaction, and note rows |
| `UsageStats`            | `apps/chat/src/views/chat.tsx`         | Token/cost/context metadata rendered by footer and assistant metadata                                    |
| `ToolDescriptor` result | `apps/chat/src/lib/tool-descriptor.ts` | Action label, target detail, and icon for live tool cards and history rows                               |

---

## [DES-API] API Contracts

The zone consumes shared chat message and agent event payloads. It does not define host commands.

| Direction       | Message/event        | Message-zone responsibility                      |
| --------------- | -------------------- | ------------------------------------------------ |
| Host to webview | `chat/state`         | Replace transcript view model                    |
| Host to webview | `chat/messageStart`  | Create visible row placeholder                   |
| Host to webview | `chat/messageDelta`  | Append streamed assistant markdown               |
| Host to webview | `chat/thinkingDelta` | Preserve thinking content for live thinking UI   |
| Host to webview | `chat/messageEnd`    | Clear streaming state and expose stop reason     |
| Host to webview | `chat/toolStart`     | Attach running tool card                         |
| Host to webview | `chat/toolEnd`       | Finalize tool card state and output summary      |
| Host to webview | `chat/usage`         | Render assistant metadata                        |
| Host to webview | `chat/error`         | Render transcript-visible error row when allowed |

---

## [DES-FILES] File Structure

| File                                            | Purpose                                     |
| ----------------------------------------------- | ------------------------------------------- |
| `apps/chat/src/views/chat.tsx`                  | Timeline composition                        |
| `apps/chat/src/components/markdown-message.tsx` | Assistant markdown and code-fence rendering |
| `apps/chat/src/lib/tool-descriptor.ts`          | Tool display metadata                       |

---

## [DES-DEPS] Dependencies

| Dependency                     | Purpose                                                          |
| ------------------------------ | ---------------------------------------------------------------- |
| `100-package-shared`           | Message, tool, runtime, and usage payload types                  |
| `110-package-transport`        | Host/webview stream event delivery                               |
| `131-package-ui-design-system` | Buttons, tokens, rail/card styling, and accessible UI primitives |

---

## [DES-SEC] Security Considerations

Rendered markdown/tool content must not execute arbitrary scripts or expose secrets in logs.

---

## [DES-ERR] Error Handling

| Scenario               | Handling                                               |
| ---------------------- | ------------------------------------------------------ |
| Malformed stream event | Render a safe error event and keep the timeline usable |
| Unknown tool status    | Render a generic tool event state                      |

---

## [DES-TEST] Testing Strategy

| Coverage target                          | Current/Future test anchor                                  |
| ---------------------------------------- | ----------------------------------------------------------- |
| Timeline tab/root rendering              | `apps/chat/src/app.test.tsx`                                |
| Stream state transitions                 | `apps/chat/src/app.test.tsx`; future focused timeline tests |
| Markdown/code fence rendering            | Future `markdown-message.test.tsx`                          |
| Tool descriptor mapping                  | Future `tool-descriptor.test.ts`                            |
| Tool card running/error/multiline states | Future `chat.tsx` focused component test                    |
| Assistant metadata and stop reasons      | Future `chat.tsx` focused component test                    |

---

## [DES-ROLLOUT] Migration / Rollout Plan

Retarget message rendering refs from retired chat docs, then add focused tests as message behavior changes.

### [DES-MESSAGES-ROLLOUT-ROLLBACK] Rollback Plan

Route files back to `210-app-chat` only if this child spec stops providing clearer ownership.

---

## [DES-MESSAGES-REFS] File Reference Map

| Task | File                                            | Required @see                                                   |
| ---- | ----------------------------------------------- | --------------------------------------------------------------- |
| 1.x  | `apps/chat/src/views/chat.tsx`                  | `design.md [DES-MESSAGES-COMPONENTS] [DES-MESSAGES-EVENT-FLOW]` |
| 1.x  | `apps/chat/src/components/markdown-message.tsx` | `design.md [DES-MESSAGES-MARKDOWN]`                             |
| 1.x  | `apps/chat/src/lib/tool-descriptor.ts`          | `design.md [DES-MESSAGES-TOOLS]`                                |

## [DES-MESSAGES-LOC] Code Locator Map

| Map ID                      | Code anchor                                                                | Messages/settings/commands                                                                                           | Tests                        |
| --------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| `[DES-MESSAGES-COMPONENTS]` | `chat.tsx` `Timeline`, `TimelineRow`, `EventHeader`, `EventBody`, `Marker` | `chat/message*`, local note events                                                                                   | `apps/chat/src/app.test.tsx` |
| `[DES-MESSAGES-EVENT-FLOW]` | `chat.tsx` bridge handlers and timeline flattening                         | `chat/state`, `chat/messageStart`, `chat/messageDelta`, `chat/toolStart`, `chat/toolEnd`, `chat/usage`, `chat/error` | `apps/chat/src/app.test.tsx` |
| `[DES-MESSAGES-MARKDOWN]`   | `markdown-message.tsx` `MarkdownMessage`, `CodeFence`                      | assistant markdown content                                                                                           | future markdown tests        |
| `[DES-MESSAGES-TOOLS]`      | `tool-descriptor.ts`, `chat.tsx` `ToolEvent`, `ToolEventRow`               | tool args/status/summary                                                                                             | future tool-card tests       |
| `[DES-MESSAGES-META]`       | `chat.tsx` `AssistantMeta`, `FRIENDLY_STOP_REASONS`                        | usage and stop reasons                                                                                               | future metadata tests        |

## [DES-MESSAGES-TRACE] Functional Trace Matrix

| Requirement | Design nodes                                                         | Code anchors                                                    | Verification                                 |
| ----------- | -------------------------------------------------------------------- | --------------------------------------------------------------- | -------------------------------------------- |
| FR-1        | `DES-MESSAGES-MOCKUP-ASSISTANT`, `DES-MESSAGES-COMPONENTS`           | `Timeline`, `TimelineRow`, `Marker`, `EventHeader`, `EventBody` | `apps/chat/src/app.test.tsx`                 |
| FR-2        | `DES-MESSAGES-EVENT-FLOW`, `DES-MESSAGES-MOCKUP-THINKING`            | `chat/messageDelta`, `chat/thinkingDelta`, `ThinkingTrace`      | future focused timeline tests                |
| FR-3        | `DES-MESSAGES-MARKDOWN`                                              | `MarkdownMessage`, `CodeFence`                                  | future markdown tests                        |
| FR-4        | `DES-MESSAGES-MOCKUP-TOOL`, `DES-MESSAGES-TOOLS`                     | `ToolEvent`, `ToolEventRow`, `toolDescriptor`                   | future tool-card tests                       |
| FR-5        | `DES-MESSAGES-META`                                                  | `AssistantMeta`, `FRIENDLY_STOP_REASONS`                        | future metadata tests                        |
| FR-6        | `DES-MESSAGES-MOCKUP-SYSTEM`, `DES-MESSAGES-MOCKUP-COMPACTION-TOAST` | `EventHeader`, `EventBody`, `CompactionCard`, note event branch | `apps/chat/src/app.test.tsx`                 |
| FR-7        | `DES-DEC`                                                            | Composer behavior routed to `211-app-chat-composer`             | child spec boundary                          |
| NFR-1       | `DES-MESSAGES-EVENT-FLOW`                                            | incremental React state updates                                 | `apps/chat/src/app.test.tsx`                 |
| NFR-2       | `DES-MESSAGES-MARKDOWN`, `DES-MESSAGES-TOOLS`                        | semantic markdown, buttons, details/summary                     | future accessibility assertions              |
| NFR-3       | `DES-MESSAGES-MOCKUPS`                                               | compact rail/table/meta layouts                                 | visual review/e2e when layout changes        |
| NFR-4       | `DES-MESSAGES-REFS`, `DES-MESSAGES-LOC`                              | local `@see` anchors                                            | `rg "@see docs/specs/212-app-chat-messages"` |

---

## [DES-MESSAGES-QUESTIONS] Open Technical Questions

None.
