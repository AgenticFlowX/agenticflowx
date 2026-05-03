---
afx: true
type: SPEC
status: Draft
owner: "@rixrix"
version: "1.0"
created_at: "2026-05-02T23:56:50.000Z"
updated_at: "2026-05-03T02:14:15.000Z"
tags: ["app", "chat", "history"]
depends_on: ["100-package-shared", "110-package-transport", "210-app-chat", "212-app-chat-messages"]
---

# App Chat History - Product Specification

## References

- **Parent Spec**: [App Chat](../210-app-chat/spec.md)
- **Migration Blueprint**: [Spec Restructuring Migration Blueprint](../specs-refactor.md)

---

## Problem Statement

The History tab is the active-session work log for the chat webview. It renders
current transcript activity as scannable event rows, keeps runtime readiness
states visible, and derives narrative/trace/audit history events from shared
chat timeline data.

This spec gives History its own route so changes to work-log filtering, event
classification, context copy, recovery states, and row rendering do not require
reading composer or live message-rendering code first.

---

## User Stories

### Primary Users

Users navigating previous conversations and agents changing history behavior.

### Stories

**As a** user
**I want** conversation history to be easy to browse and reopen
**So that** I can continue earlier work

**As an** AI agent
**I want** history event ownership separated from message rendering
**So that** list/timeline changes do not affect composer behavior

---

## Requirements

### Functional Requirements

| ID    | Requirement                                                                                                                                                   | Priority  |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| FR-1  | Own the History tab root, visible work-log layout, header, context card, filter bar, body state branches, section grouping, and event rows                    | Must Have |
| FR-2  | Subscribe to chat/runtime bridge events and request initial chat state with `chat/getState`                                                                   | Must Have |
| FR-3  | Render session header metadata, event/message/queue/compaction/live chips, and refresh behavior with runtime-aware disabled states                            | Must Have |
| FR-4  | Render the Context card with agent-session copy, workspace-context copy, and `/afx-context save` insertion affordance                                         | Must Have |
| FR-5  | Provide local density filtering for `narrative`, `trace`, and `audit`, plus search filtering with runtime-specific placeholder and disabled states            | Must Have |
| FR-6  | Render the body state matrix for checking runtime, unconfigured runtime, unavailable runtime with cached rows, no active events, no matching events, and rows | Must Have |
| FR-7  | Group filtered history events by day and render sticky section headings plus row icons, action, target, detail, live status, compaction, usage, and timestamp | Must Have |
| FR-8  | Derive history events from chat timeline items, including user messages, assistant messages, usage rows, tool rows, and compaction summaries                  | Must Have |
| FR-9  | Classify tools into file read/edit, command, search, list, failed, and generic activity rows without exposing raw secrets                                     | Must Have |
| FR-10 | Keep live composer input, live message rendering, provider setup, and persistence outside this child spec unless the visible History surface changes          | Must Have |
| FR-11 | Maintain ASCII UI mockups, component overlays, locator maps, and 1:1 trace rows for History code before future surgical work relies on this zone              | Must Have |

### Non-Functional Requirements

| ID    | Requirement                        | Target                                                               |
| ----- | ---------------------------------- | -------------------------------------------------------------------- |
| NFR-1 | History remains fast to scan       | Lists avoid excessive visual noise and keep dense rows compact       |
| NFR-2 | History data remains safe          | No secrets or raw credentials in history entries                     |
| NFR-3 | History remains traceable 1:1      | Each stable visible component/helper has a spec/design/source anchor |
| NFR-4 | History remains cheap to recompute | Derived rows use local memoized transformations of current state     |

---

## Acceptance Criteria

### History Ownership

- [ ] History view files point at this spec
- [ ] History event helpers point at this spec
- [ ] `apps/chat/src/views/history.tsx` points at `DES-MOCKUP` and `DES-COMP`
- [ ] `apps/chat/src/lib/history-events.ts` points at `DES-DATA`
- [ ] Live timeline rendering remains in `212-app-chat-messages`

### UI States

- [ ] Header shows History, session subtitle/id, event/message chips, queue/compaction chips when present, and live/setup/cached status
- [ ] Refresh sends `chat/getState` only when the runtime state allows it
- [ ] Context card exposes agent session copy and `/afx-context save`
- [ ] Density filters cover `narrative`, `trace`, and `audit`
- [ ] Search placeholder changes for checking, unconfigured, unavailable, and ready runtime states
- [ ] Body renders checking, unconfigured, unavailable/recovery, empty, no-match, and populated states

### Event Mapping

- [ ] User messages map to narrative `message.user` rows
- [ ] Assistant content and streaming state map to narrative `message.assistant` rows
- [ ] Usage payloads map to trace `usage` rows
- [ ] Tool calls map to audit rows unless failed, where failed rows remain visible in trace
- [ ] Compaction summaries map to narrative `compaction` rows with token reduction metadata
- [ ] Tool targets prefer args-derived path/command, then summary, then tool name

---

## Non-Goals (Out of Scope)

- Composer input behavior
- Live streaming rendering
- Provider/API settings

---

## Open Questions

None.

---

## Dependencies

- `100-package-shared`
- `110-package-transport`
- `210-app-chat`

---

## Appendix

### Agent Entry Map

| Field           | Values                                                                                                                                                                               |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Owned surface   | History tab, active-session work log, context card, filters, runtime states, event rows                                                                                              |
| Owned files     | `apps/chat/src/views/history.tsx`, `apps/chat/src/lib/history-events.ts`                                                                                                             |
| Local anchors   | `History`, `ContextPreviewCard`, `HistorySetupState`, `HistorySection`, `HistoryEventRow`, `deriveHistoryEvents`, `toolEvent`, `classifyTool`                                        |
| Bridge messages | Inbound `chat/state`, `chat/messageStart`, `chat/messageDelta`, `chat/messageEnd`, `chat/toolStart`, `chat/toolEnd`, `chat/error`, `agent/runtimeSettings`; outbound `chat/getState` |
| Settings keys   | No persisted keys yet; local `density` and `query` state only                                                                                                                        |
| Commands        | Refresh via `chat/getState`; context save insertion via `/afx-context save`                                                                                                          |
| Tests           | `apps/chat/src/app.test.tsx`, `apps/chat/src/lib/history-events.test.ts`                                                                                                             |
| Dependencies    | `100-package-shared`, `110-package-transport`, `210-app-chat`, `212-app-chat-messages`                                                                                               |
| Out of scope    | Live response streaming, composer queue, provider setup                                                                                                                              |
| Example prompts | "Change History cached-state copy", "Add a density mode", "Fix failed tool event labels"                                                                                             |

### Glossary

| Term    | Definition                                                              |
| ------- | ----------------------------------------------------------------------- |
| History | Saved conversation list and metadata used to reopen prior chat sessions |
