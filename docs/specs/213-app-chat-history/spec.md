---
afx: true
type: SPEC
status: Living
owner: "@rixrix"
version: "1.3"
created_at: "2026-05-02T23:56:50.000Z"
updated_at: "2026-06-02T10:07:25.000Z"
tags: ["app", "chat", "history", "sessions", "persistence", "reopen"]
depends_on:
  [
    "100-package-shared",
    "110-package-transport",
    "200-app-vscode",
    "210-app-chat",
    "212-app-chat-messages",
    "216-app-chat-window-componentization",
    "300-infra-pi",
    "350-agent-manager",
    "351-agent-pi",
  ]
---

# App Chat History - Product Specification

## References

- **Parent Spec**: [App Chat](../210-app-chat/spec.md)

---

## Problem Statement

The History tab is the active-session work log for the chat webview. It renders
current transcript activity as scannable event rows, keeps runtime readiness
states visible, and derives narrative/trace/audit history events from shared
chat timeline data.

This spec gives History its own route so changes to work-log filtering, event
classification, context copy, recovery states, and row rendering do not require
reading composer or live message-rendering code first.

Chat-window componentization reserves future history load/export slots in
`216-app-chat-window-componentization`; this spec remains the owner for any
persistence format, load UX, export schema, and reload semantics.

The persistent-session counter-spec extends that ownership: History must become
a browsable session store for the managed bundled Pi runtime by listing Pi's
on-disk sessions, opening a read-only transcript, and reopening a selected
session so the next prompt continues that conversation.

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

| ID    | Requirement                                                                                                                                                                                                                                                       | Priority    |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| FR-1  | Own the History tab root, visible work-log layout, header, context card, filter bar, body state branches, section grouping, and event rows                                                                                                                        | Must Have   |
| FR-2  | Subscribe to chat/runtime bridge events and request initial chat state with `chat/getState`                                                                                                                                                                       | Must Have   |
| FR-3  | Render session header metadata, event/message/queue/compaction/live chips, and refresh behavior with runtime-aware disabled states                                                                                                                                | Must Have   |
| FR-4  | Render the Context card with agent-session copy, workspace-context copy, and `/afx-context save` insertion affordance                                                                                                                                             | Must Have   |
| FR-5  | Provide local density filtering for `narrative`, `trace`, and `audit`, plus search filtering with runtime-specific placeholder and disabled states                                                                                                                | Must Have   |
| FR-6  | Render the body state matrix for checking runtime, unconfigured runtime, unavailable runtime with cached rows, no active events, no matching events, and rows                                                                                                     | Must Have   |
| FR-7  | Group filtered history events by day and render sticky section headings plus row icons, action, target, detail, live status, compaction, usage, and timestamp                                                                                                     | Must Have   |
| FR-8  | Derive history events from chat timeline items, including user messages, assistant messages, usage rows, tool rows, and compaction summaries                                                                                                                      | Must Have   |
| FR-9  | Classify tools into file read/edit, command, search, list, failed, and generic activity rows without exposing raw secrets                                                                                                                                         | Must Have   |
| FR-10 | Keep live composer input, live message rendering, and provider setup outside this child spec unless the visible History surface changes                                                                                                                           | Must Have   |
| FR-11 | Maintain ASCII UI mockups, component overlays, locator maps, and 1:1 trace rows for History code before future surgical work relies on this zone                                                                                                                  | Must Have   |
| FR-12 | Own follow-on chat-history persistence behavior after `216-app-chat-window-componentization` reserves load/export slots                                                                                                                                           | Should Have |
| FR-13 | Read persisted sessions from the managed Pi session store resolved by AFX, not from the volatile active-session buffer                                                                                                                                            | Must Have   |
| FR-14 | List persisted sessions discovered from known local Pi session roots newest-first with stable id, display label, message count, created timestamp, modified timestamp, and optional workspace provenance                                                          | Must Have   |
| FR-15 | Open a selected session in a read-only transcript viewer without changing the active live Chat session                                                                                                                                                            | Must Have   |
| FR-16 | Reopen a selected session by switching the active runtime session and rehydrating Chat state so the next prompt continues that conversation                                                                                                                       | Must Have   |
| FR-17 | Surface branch presence for persisted sessions while rendering only the active leaf branch in this version                                                                                                                                                        | Should Have |
| FR-18 | Filter the persisted session list by label, first-message text, id, and date while preserving the existing live-log density/search behavior                                                                                                                       | Should Have |
| FR-19 | Delete a persisted session from the list and from the read-only transcript view; deletion removes the underlying `.jsonl` file and re-lists                                                                                                                       | Should Have |
| FR-20 | Surface session provenance: a per-row project chip (workspace basename from the session `cwd`) that reveals that folder in the OS file manager, plus an aggregate stats bar (session count, total messages, distinct projects) over the listed sessions           | Should Have |
| FR-21 | The History surface stays single-line and legible at narrow sidebar widths (down to ~230px container) — segmented sub-tab labels, row meta, project chips, and transcript rows never wrap or clip, using container queries that mirror the Settings gold standard | Should Have |
| FR-22 | Copy a selected read-only transcript as a concise Markdown session recap for release notes, marketing captions, screenshots, and team updates without including session file handles or full local workspace paths                                                | Should Have |

### Non-Functional Requirements

| ID    | Requirement                        | Target                                                                                                                                                                   |
| ----- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| NFR-1 | History remains fast to scan       | Lists avoid excessive visual noise and keep dense rows compact                                                                                                           |
| NFR-2 | History data remains safe          | No secrets or raw credentials in history entries                                                                                                                         |
| NFR-3 | History remains traceable 1:1      | Each stable visible component/helper has a spec/design/source anchor                                                                                                     |
| NFR-4 | History remains cheap to recompute | Derived rows use local memoized transformations of current state                                                                                                         |
| NFR-5 | Session storage remains coherent   | History listing/reading scan the AFX-resolved session dir, injected Pi agent dir, and Pi default root; read/reopen/delete handles are realpath-guarded under those roots |
| NFR-6 | Adapter boundaries remain clean    | Webview and VS Code host code consume `@afx/shared` types only; Pi SDK types stay inside managed Pi adapter code                                                         |
| NFR-7 | Read/open remains non-destructive  | Listing and read-only transcript load never mutate `.jsonl` session files; reopen only changes the active runtime session                                                |
| NFR-8 | Large histories remain usable      | Shipped v1 caps parsed JSONL files at newest `MAX_PARSED_SESSIONS=400` and reads fresh; progress/cache are deferred follow-up behavior                                   |
| NFR-9 | Harness support degrades safely    | External/unsupported harnesses hide persisted-session affordances or show a harness-owned-history state instead of throwing                                              |

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

### Persistent Sessions

- [x] After a VS Code window reload, History lists saved sessions read from the AFX-resolved Pi session directory (and the other known Pi session roots), grouped by day
- [x] Session rows show label or first-message fallback, message count, relative modified time, and a fork marker when the session has a `forkedFrom` parent
- [x] Selecting a session opens a read-only transcript using the active leaf branch without modifying the live Chat timeline
- [x] Reopen switches the active runtime session, posts a rehydrated `chat/state`, and jumps to the Chat tab so Chat visibly continues the reopened conversation
- [x] Persisted-session search filters by label, first message, and date
- [x] Unsupported external harnesses do not throw; persisted-session controls are replaced with a "managed by the runtime" state
- [x] Listing / opening / reopening does not mutate the selected session file on disk

### Session Management, Provenance & Responsiveness

- [x] A session can be deleted from the list (hover-reveal trash) and from the transcript view; deletion removes the `.jsonl` file and re-lists _(FR-19)_
- [x] Each row shows a clickable project chip (workspace basename) that reveals that folder in the OS file manager; an aggregate stats bar shows session count, total messages, and distinct project count _(FR-20)_
- [x] At ~230–320px container width the sub-tab labels, row meta, project chips, and transcript rows stay single-line (no wrap/clip), proven by a narrow-width e2e _(FR-21)_
- [x] The transcript header exposes Copy session recap; it copies deterministic Markdown containing title, project basename, message count, first prompt, and transcript outline while omitting session file paths and full `cwd` values _(FR-22, NFR-2)_

---

## Non-Goals (Out of Scope)

- Composer input behavior
- Live streaming rendering
- Provider/API settings
- Chat-window component boundary implementation, except reserved history slots
- True revert/rewind to an earlier turn in a conversation tree
- Restoring workspace files to an earlier point
- Server/cloud sync of local conversation history
- AI-generated session summaries; Copy session recap is deterministic formatting only

---

## Open Questions

| #    | Question                                                                                             | Status   | Blocking | Resolution / Next Step                                                                                                                                                                                                                     |
| ---- | ---------------------------------------------------------------------------------------------------- | -------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| OQ-1 | Should `hasBranches` be computed eagerly during list or lazily when a transcript opens?              | Resolved | No       | Neither in v1: the list shows only the `forkedFrom` marker (a fork pointer in the header) via a GitBranch icon; full multi-branch `hasBranches` detection is deferred (no eager tree scan). See `design.md [DES-PERSISTENT-STORE]`.        |
| OQ-2 | Should transcript-to-Chat rehydration reuse the live normalizer or use a dedicated persisted mapper? | Resolved | Yes      | Dedicated mapper `apps/vscode/src/services/history/transcript-to-timeline.ts` maps `AgentTranscriptEntry[]` → `ChatTimelineItem[]`/`ChatToolView[]`, mirroring the live shapes without coupling to the live normalizer.                    |
| OQ-3 | What exact transcript depth appears in read-only mode: messages only, or messages plus tools/usage?  | Resolved | No       | Renders user / assistant (text + thinking + tool calls) / tool-result / bash / compaction rows along the active leaf branch.                                                                                                               |
| OQ-4 | Should external `pi` get list/read support?                                                          | Resolved | No       | Both the bundled `pi-sdk` and the external `pi` adapters list via the shared `node:fs` reader over `piSessionRoots`; truly remote/container runtimes the host `fs` cannot read stay harness-owned. See `design.md [DES-PERSISTENT-STORE]`. |
| OQ-5 | Are export, delete, and rename part of this sprint, P2 in this sprint, or future/backlog?            | Resolved | Yes      | Owner kept **delete** (FR-19, `session/delete` → `fs.unlink`) and **rename** (adapter `setSessionName`; list/transcript rename UI is a follow-up); **export** is deferred to backlog.                                                      |

---

## Dependencies

- `100-package-shared`
- `110-package-transport`
- `200-app-vscode`
- `210-app-chat`
- `212-app-chat-messages`
- `216-app-chat-window-componentization`
- `300-infra-pi`
- `350-agent-manager`
- `351-agent-pi`

---

## Appendix

### Agent Entry Map

| Field           | Values                                                                                                                                                                                                                                                                                                                                                            |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Owned surface   | History tab, active-session work log, context card, filters, runtime states, event rows                                                                                                                                                                                                                                                                           |
| Owned files     | Live log: `apps/chat/src/views/history.tsx`, `apps/chat/src/lib/history-events.ts`. Persistent: `apps/chat/src/views/session-browser.tsx`, History-tab shell in `apps/chat/src/app.tsx`; host `apps/vscode/src/services/history/{history-service,transcript-to-timeline}.ts`; reader `packages/agent/pi/src/session-store.ts`                                     |
| Local anchors   | Live: `History`, `ContextPreviewCard`, `HistorySetupState`, `HistorySection`, `HistoryEventRow`, `deriveHistoryEvents`, `toolEvent`, `classifyTool`. Persistent: `SessionBrowser`, `SessionRow`, `TranscriptView`, `TranscriptRow`, `StatusBlock`, `projectName`, `piSessionRoots`, `listSessionsFromDisk`, `parseTranscript`                                     |
| Bridge messages | Inbound `chat/state`, `chat/messageStart`, `chat/messageDelta`, `chat/messageEnd`, `chat/toolStart`, `chat/toolEnd`, `chat/error`, `agent/runtimeSettings`, `session/list`, `history/loaded`; outbound `chat/getState`, `session/list`, `history/load`, `history/reopen`, `session/delete`, `session/revealCwd`; local-only clipboard action `Copy session recap` |
| Settings keys   | No persisted keys yet; local `density`, `query`, and `historyTab` (`past`/`current`) state only                                                                                                                                                                                                                                                                   |
| Commands        | Refresh via `chat/getState` / `session/list`; persistent session list/load/reopen/delete/reveal via bridge messages; context save insertion via `/afx-context save`                                                                                                                                                                                               |
| Tests           | `apps/chat/src/app.test.tsx`, `apps/chat/src/lib/history-events.test.ts`, `apps/chat/e2e/session-history.spec.ts`, `apps/chat/e2e/history-narrow-width.spec.ts`, `packages/agent/pi/src/session-store.test.ts`, `apps/vscode/src/services/history/{history-service,transcript-to-timeline}.test.ts`                                                               |
| Dependencies    | `100-package-shared`, `110-package-transport`, `200-app-vscode`, `210-app-chat`, `212-app-chat-messages`, `216-app-chat-window-componentization`, `300-infra-pi`, `350-agent-manager`, `351-agent-pi`                                                                                                                                                             |
| Out of scope    | Live response streaming, composer queue, provider setup, true revert, file restore; export and listed-session rename UI remain follow-up work; AI-generated summaries are not part of Copy session recap                                                                                                                                                          |
| Example prompts | "Change History cached-state copy", "Add a density mode", "Fix failed tool event labels"                                                                                                                                                                                                                                                                          |

### Counter-Spec Transfer Map

| Source sprint area                                             | Canonical target                                                                                             |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Persistent session requirements                                | `spec.md` [FR-13] through [FR-22], [NFR-5] through [NFR-9]                                                   |
| Shared types and bridge protocol                               | `100-package-shared`, `design.md` [DES-PERSISTENT-DATA] [DES-PERSISTENT-BRIDGE]                              |
| Pi session listing + transcript reading (`node:fs`)            | `300-infra-pi` / `351-agent-pi`, `design.md` [DES-PERSISTENT-STORE] [DES-PERSISTENT-API]                     |
| VS Code host routing and Chat rehydration                      | `200-app-vscode`, `design.md` [DES-PERSISTENT-FLOW]                                                          |
| History UI list/view/reopen surfaces                           | This spec, `design.md` [DES-PERSISTENT-UI]; owner file `apps/chat/src/views/session-browser.tsx` + `app.tsx` |
| Provenance chip, stats bar, reveal-in-OS, delete, narrow-width | This spec [FR-19] [FR-20] [FR-21], `design.md` [DES-PERSISTENT-UI] [DES-PERSISTENT-BRIDGE]                   |

### Glossary

| Term               | Definition                                                                               |
| ------------------ | ---------------------------------------------------------------------------------------- |
| History            | Active work log plus persisted conversation list and transcript viewer                   |
| Persistent session | Pi JSONL session file under the AFX-resolved session directory                           |
| Reopen             | Switch the active runtime to an existing session file and rehydrate Chat state           |
| Revert             | Future workstream for rewinding to an earlier turn and restoring workspace files, not v1 |
