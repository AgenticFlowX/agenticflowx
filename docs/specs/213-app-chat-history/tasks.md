---
afx: true
type: TASKS
status: Draft
owner: "@rixrix"
version: "1.2"
created_at: "2026-05-02T23:56:50.000Z"
updated_at: "2026-07-19T00:48:00.000Z"
tags: ["app", "chat", "history", "sessions", "persistence", "reopen"]
spec: spec.md
design: design.md
---

# App Chat History - Implementation Tasks

---

## Task Numbering Convention

- **1.x** - Source retargeting
- **2.x** - Future history work
- **3.x** - Verification
- **4.x** - Shared persistent-session contract
- **5.x** - Managed Pi SDK and host history service
- **6.x** - Bridge routing and Chat rehydration
- **7.x** - History UI persistent list and transcript viewer
- **8.x** - Persistent-session verification
- **9.x** - Read-only conversation-timeline parity remediation

---

## Phase 1: Source Retargeting

### 1.1 Retarget History Files

- [ ] Replace retired chat refs in history view/helpers

---

## Phase 2: Future History Work

### 2.1 History View Updates

- [ ] Update requirements before changing history UI
- [ ] Add tests for history event mapping

---

## Phase 3: Verification

### 3.1 Verify History Routing

- [ ] Run stale-ref search for history files
- [ ] Run relevant chat tests

---

## Phase 4: Shared Persistent-Session Contract

### 4.1 Add Shared Session Types

<!-- files: packages/shared/src/agent.ts, packages/shared/src/messages.ts, packages/shared/src/messages.test.ts -->
<!-- @see docs/specs/213-app-chat-history/spec.md [FR-14] [FR-15] [FR-17] [FR-19] [FR-20] [NFR-6] -->
<!-- @see docs/specs/213-app-chat-history/design.md [DES-PERSISTENT-DATA] [DES-PERSISTENT-BRIDGE] -->

- [x] Add `AgentSessionInfo`, `AgentTranscriptEntry`, and role-based transcript entry types
- [x] Add typed `session/list`, `history/load`, `history/reopen`, `session/delete`, `session/revealCwd`, and `history/loaded` bridge variants
- [x] Cover the new message variants in the shared protocol test suite

### 4.2 Add AgentManager Optional Methods

<!-- files: packages/shared/src/agent.ts, apps/vscode/src/multiplex-agent-manager.ts -->
<!-- @see docs/specs/213-app-chat-history/spec.md [FR-14] [FR-15] [FR-16] [FR-19] [NFR-9] -->
<!-- @see docs/specs/213-app-chat-history/design.md [DES-PERSISTENT-API] -->

- [x] Add optional `listSessions?`, `getTranscript?`, `setSessionName?`, and `deleteSession?` to `AgentManager`
- [x] Guard-delegate through `MultiplexAgentManager`; unsupported runtimes are feature-detectable and throw clear errors

### 4.3 Decide Export/Delete/Rename Scope

<!-- files: spec.md, design.md, tasks.md -->
<!-- @see docs/specs/213-app-chat-history/spec.md [FR-12] [FR-19] [OQ-5] -->
<!-- @see docs/specs/213-app-chat-history/design.md [DES-PERSISTENT-BRIDGE] -->

- [x] Record owner decision: keep delete and rename support; defer export
- [x] Update requirements, bridge variants, and task rows to match the owner decision

### 4.4 Add Bridge Message Variants

<!-- files: packages/shared/src/messages.ts, packages/shared/src/messages.test.ts, packages/transport/src/mock.ts, packages/transport/src/mock.test.ts -->
<!-- @see docs/specs/213-app-chat-history/spec.md [FR-14] [FR-15] [FR-16] [FR-18] [FR-19] [FR-20] -->
<!-- @see docs/specs/213-app-chat-history/design.md [DES-PERSISTENT-BRIDGE] [DES-PERSISTENT-TEST] -->

- [x] Add outbound `session/list`, `history/load`, `history/reopen`, `session/delete`, and `session/revealCwd`
- [x] Add inbound `session/list` and `history/loaded`
- [x] Mock populated, empty, and unsupported persisted-history scenarios for browser/e2e verification

---

## Phase 5: Managed Pi SDK And Host History Service

### 5.1 Normalize Pi SDK Sessions

<!-- files: packages/agent/pi/src/session-store.ts, packages/agent/pi/src/session-store.test.ts, packages/agent/pi/src/rpc-manager.ts, packages/agent/pi-sdk/src/options.ts, packages/agent/pi-sdk/src/sdk-rpc-manager.ts -->
<!-- @see docs/specs/213-app-chat-history/spec.md [FR-13] [FR-14] [FR-15] [FR-17] [FR-19] [NFR-5] [NFR-6] [NFR-7] [NFR-8] -->
<!-- @see docs/specs/213-app-chat-history/design.md [DES-PERSISTENT-STORE] [DES-PERSISTENT-DATA] [DES-PERSISTENT-FLOW] -->

- [x] Implement dependency-free `node:fs` JSONL session reader; do not import Pi SDK runtime values into the host bundle
- [x] Merge AFX session dir, injected Pi agent dir, and Pi default session roots; dedupe and cap parsed files by newest mtime
- [x] Normalize list rows to `AgentSessionInfo` epoch-ms fields (`path`, `createdAt`, `updatedAt`, `cwd`, `forkedFrom`)
- [x] Parse the active leaf transcript from the last message entry, ignoring trailing metadata rows
- [x] Guard read, switch, and delete paths with `assertSessionPathAllowed`
- [x] Add fixture coverage for empty, simple, branched, nested, multi-root, metadata-tail, and path-guard cases

### 5.2 Add Host HistoryService

<!-- files: apps/vscode/src/services/history/history-service.ts, apps/vscode/src/services/history/history-service.test.ts -->
<!-- @see docs/specs/213-app-chat-history/spec.md [FR-14] [FR-15] [FR-16] [NFR-8] [NFR-9] -->
<!-- @see docs/specs/213-app-chat-history/design.md [DES-PERSISTENT-API] [DES-PERSISTENT-FLOW] -->

- [x] Wrap active `AgentManager` history methods and normalize unsupported-runtime errors to `supported: false`
- [x] Read fresh on every `listSessions` call; cache/progress remain deferred under NFR-8
- [x] Return `[]` for transcript load failures so one bad file does not break the History view

---

## Phase 6: Bridge Routing And Chat Rehydration

### 6.1 Route Persistent History Messages

<!-- files: apps/vscode/src/panels/sidebar-panel.ts -->
<!-- @see docs/specs/213-app-chat-history/spec.md [FR-14] [FR-15] [FR-16] [FR-19] [FR-20] [NFR-9] -->
<!-- @see docs/specs/213-app-chat-history/design.md [DES-PERSISTENT-BRIDGE] [DES-PERSISTENT-FLOW] -->

- [x] Dispatch `session/list`, `history/load`, `history/reopen`, `session/delete`, and `session/revealCwd`
- [x] Dispatch `history/reopen` through `switchSession` plus transcript load
- [x] Re-list after delete and guard reveal to only discovered session `cwd` values

### 6.2 Rehydrate Chat State After Reopen

<!-- files: apps/vscode/src/panels/sidebar-panel.ts, apps/vscode/src/services/history/history-service.ts -->
<!-- @see docs/specs/213-app-chat-history/spec.md [FR-16] [NFR-7] -->
<!-- @see docs/specs/213-app-chat-history/design.md [DES-PERSISTENT-FLOW] -->

- [x] Map `AgentTranscriptEntry[]` to `ChatTimelineItem[]` / `ChatToolView[]`
- [x] Post `chat/state` after successful reopen so Chat shows the reopened conversation
- [x] Preserve read-only load as non-mutating; only `history/reopen` may switch sessions

---

## Phase 7: History UI Persistent List And Transcript Viewer

### 7.1 Render Persisted Session List

<!-- files: apps/chat/src/app.tsx, apps/chat/src/views/session-browser.tsx -->
<!-- @see docs/specs/213-app-chat-history/spec.md [FR-14] [FR-17] [FR-18] [NFR-1] [NFR-8] [NFR-9] -->
<!-- @see docs/specs/213-app-chat-history/design.md [DES-PERSISTENT-UI] -->

- [x] Request `session/list` whenever the Past sessions surface becomes active
- [x] Render loading, empty, unsupported-harness, no-match, and populated list states
- [x] Filter sessions by label, first message, and date
- [x] Keep the live work-log under the Current session sub-tab

### 7.2 Render Read-Only Transcript And Reopen

<!-- files: apps/chat/src/app.tsx, apps/chat/src/views/session-browser.tsx -->
<!-- @see docs/specs/213-app-chat-history/spec.md [FR-15] [FR-16] [FR-17] [NFR-7] -->
<!-- @see docs/specs/213-app-chat-history/design.md [DES-PERSISTENT-UI] [DES-PERSISTENT-FLOW] -->

- [x] Open selected row with `history/load` and render `history/loaded` entries
- [x] Show fork marker from `forkedFrom` while rendering the active leaf branch only
- [x] Add explicit Reopen action that sends `history/reopen`, clears the transcript, and jumps back to Chat

### 7.3 Add Provenance, Delete, And Narrow-Width Polish

<!-- files: apps/chat/src/app.tsx, apps/chat/src/views/session-browser.tsx, apps/chat/e2e/history-narrow-width.spec.ts -->
<!-- @see docs/specs/213-app-chat-history/spec.md [FR-19] [FR-20] [FR-21] [NFR-1] [NFR-2] -->
<!-- @see docs/specs/213-app-chat-history/design.md [DES-PERSISTENT-UI] [DES-PERSISTENT-BRIDGE] -->

- [x] Add aggregate stats bar (`N sessions`, `M messages`, `K projects`)
- [x] Add per-row project chip from `cwd` basename and host-side reveal action
- [x] Add hover-reveal row delete and transcript-header delete
- [x] Add container-query label swaps and truncation guards for ~230px sidebar widths

### 7.4 Add Copy Session Recap

<!-- files: apps/chat/src/views/session-browser.tsx, apps/chat/e2e/session-history.spec.ts -->
<!-- @see docs/specs/213-app-chat-history/spec.md [FR-22] [NFR-2] [NFR-3] -->
<!-- @see docs/specs/213-app-chat-history/design.md [DES-PERSISTENT-UI] [DES-PERSISTENT-TEST] -->

- [x] Add transcript-header Copy session recap action with copied/failure feedback
- [x] Format deterministic Markdown from loaded `AgentSessionInfo` + `AgentTranscriptEntry[]`
- [x] Omit session file handles and full `cwd` values; use project basename only
- [x] Cover clipboard output in Playwright e2e

---

## Phase 8: Persistent-Session Verification

### 8.1 Verify Persistent History End To End

<!-- files: packages/shared/src/messages.test.ts, packages/agent/pi/src/session-store.test.ts, apps/vscode/src/services/history/history-service.test.ts, apps/vscode/src/services/history/transcript-to-timeline.test.ts, packages/transport/src/mock.test.ts, apps/chat/src/app.test.tsx, apps/chat/e2e/session-history.spec.ts, apps/chat/e2e/history-narrow-width.spec.ts -->
<!-- @see docs/specs/213-app-chat-history/spec.md [FR-13] [FR-14] [FR-15] [FR-16] [FR-19] [FR-20] [FR-21] [FR-22] [NFR-5] [NFR-6] [NFR-7] [NFR-8] [NFR-9] -->
<!-- @see docs/specs/213-app-chat-history/design.md [DES-PERSISTENT-TEST] -->

- [x] Run shared protocol/type tests
- [x] Run fs-reader normalization and HistoryService tests
- [x] Run History UI list/load/reopen/delete tests
- [x] Run boundary checks for adapter-type leakage
- [x] Run visual Playwright coverage for list, search, transcript, reopen, empty, and narrow-width states
- [x] Run clipboard/recap assertion for Copy session recap

---

## Phase 9: Read-Only Conversation-Timeline Parity Remediation

### 9.1 Share Persisted Transcript Mapping

<!-- files: packages/shared/src/transcript-to-timeline.ts, packages/shared/src/transcript-to-timeline.test.ts, apps/vscode/src/services/history/transcript-to-timeline.ts, apps/vscode/src/services/history/transcript-to-timeline.test.ts -->
<!-- @see docs/specs/213-app-chat-history/spec.md [FR-15] [FR-16] [NFR-6] | docs/specs/213-app-chat-history/design.md [DES-PERSISTENT-FLOW] [DES-PERSISTENT-DATA] -->

- [x] Export one pure `transcriptToTimeline` mapper from `@afx/shared` for read-only History and reopen rehydration
- [x] Pair matching tool calls/results into one tool view while retaining unmatched results, bash output, and bash executions in chronological order
- [x] Keep a tool call without a persisted result incomplete instead of presenting it as successfully completed
- [x] Keep the VS Code history mapper as a compatibility re-export and prove identical host/webview mapping semantics

### 9.2 Render Past Sessions Through The Read-Only Chat Timeline

<!-- files: apps/chat/src/views/session-browser.tsx, apps/chat/src/components/chat/conversation-timeline.tsx, apps/chat/src/components/chat/conversation-timeline.test.tsx -->
<!-- @see docs/specs/213-app-chat-history/spec.md [FR-15] [FR-21] [NFR-1] [NFR-7] | docs/specs/213-app-chat-history/design.md [DES-PERSISTENT-UI] -->

- [x] Replace the bespoke transcript-row renderer with `ConversationTimeline` in explicit read-only mode
- [x] Preserve Chat-supported prose, compaction, tool status/output, unmatched results, and bash while suppressing result actions, SDD guides, error alerts, and live announcements
- [x] Keep sticky History controls reachable, the read-only footer bottom-aligned for short transcripts, and timeline content horizontally contained at narrow widths

### 9.3 Verify Transcript Parity And Regression Boundaries

<!-- files: packages/shared/src/transcript-to-timeline.test.ts, apps/chat/src/components/chat/conversation-timeline.test.tsx, apps/chat/e2e/session-history.spec.ts, apps/chat/e2e/history-narrow-width.spec.ts -->
<!-- @see docs/specs/213-app-chat-history/spec.md [FR-15] [FR-16] [FR-21] [NFR-1] [NFR-6] [NFR-7] | docs/specs/213-app-chat-history/design.md [DES-PERSISTENT-TEST] -->

- [x] Assert one visible execution per matched tool call/result and one visible row for each unmatched result or bash execution
- [x] Assert read-only suppression, recorded Next-prose retention, reopen parity, and active-session non-mutation
- [x] Assert narrow wrapping, no horizontal overflow, stable transcript/header/footer geometry, and keyboard-reachable controls

---

## Implementation Flow

```text
Retarget history refs
    ↓
Update history behavior
    ↓
Add shared persistent-session contract
    ↓
Wire managed Pi SDK + host service
    ↓
Route bridge + rehydrate Chat
    ↓
Render persistent History UI
    ↓
Verify live + persisted History states
    ↓
Unify read-only and reopened transcript mapping
    ↓
Verify Chat renderer parity and narrow containment
```

---

## Cross-Reference Index

| Task | Spec Requirement                                                                                                    | Design Section                                                       |
| ---- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 1.1  | [FR-1], [FR-2]                                                                                                      | [DES-FILES]                                                          |
| 2.1  | [FR-1]                                                                                                              | [DES-UI], [DES-TEST]                                                 |
| 4.x  | [FR-14], [FR-15], [FR-16], [FR-17], [FR-18]                                                                         | [DES-PERSISTENT-DATA], [DES-PERSISTENT-API], [DES-PERSISTENT-BRIDGE] |
| 5.x  | [FR-13], [FR-14], [FR-15], [FR-17]                                                                                  | [DES-PERSISTENT-STORE], [DES-PERSISTENT-FLOW]                        |
| 6.x  | [FR-15], [FR-16], [FR-19], [FR-20]                                                                                  | [DES-PERSISTENT-BRIDGE], [DES-PERSISTENT-FLOW]                       |
| 7.x  | [FR-14], [FR-15], [FR-16], [FR-17], [FR-18], [FR-19], [FR-20], [FR-21], [FR-22]                                     | [DES-PERSISTENT-UI]                                                  |
| 8.x  | [FR-13], [FR-14], [FR-15], [FR-16], [FR-19], [FR-20], [FR-21], [FR-22], [NFR-5], [NFR-6], [NFR-7], [NFR-8], [NFR-9] | [DES-PERSISTENT-TEST]                                                |
| 9.x  | [FR-15], [FR-16], [FR-21], [NFR-1], [NFR-6], [NFR-7]                                                                | [DES-PERSISTENT-FLOW], [DES-PERSISTENT-UI], [DES-PERSISTENT-TEST]    |

---

## Notes

- This spec owns conversation history navigation.
- True rewind/revert and file restore are out of this sprint.
- Export is deferred; delete and rename support are retained per [4.3].
- NFR-8 cache/progress is deferred; the shipped reader reads fresh and caps parsed sessions at `MAX_PARSED_SESSIONS = 400`.

---

## Work Sessions

<!-- IMPORTANT: This section MUST remain the LAST section in tasks.md. Do not add content below it. -->
<!-- Task execution log — append-only, updated by /afx-task pick, /afx-task code, /afx-task complete -->

| Date                     | Task          | Action     | Files Modified                                                                                                                                                                                                                                                                                                                                                                                                                              | Agent | Human |
| ------------------------ | ------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 2026-05-02               | 1.1           | Scaffolded | docs/specs/213-app-chat-history/                                                                                                                                                                                                                                                                                                                                                                                                            | [x]   | [x]   |
| 2026-06-02               | 4.1-8.1       | Coded      | packages/shared/src/{agent,messages,messages.test}.ts, packages/agent/pi/src/{session-store,rpc-manager}.ts, packages/agent/pi-sdk/src/{options,sdk-rpc-manager}.ts, apps/vscode/src/{agent-factory,extension,multiplex-agent-manager,panels/sidebar-panel,services/history/\*}.ts, apps/chat/src/{app,views/session-browser}.tsx, packages/transport/src/{mock,mock.test}.ts, apps/chat/e2e/{session-history,history-narrow-width}.spec.ts | [x]   | [x]   |
| 2026-06-02               | 5.1, 6.1, 8.1 | Reviewed   | packages/agent/pi/src/session-store.ts, packages/agent/pi/src/session-store.test.ts, packages/agent/pi/src/rpc-manager.ts, packages/agent/pi-sdk/src/sdk-rpc-manager.ts, apps/vscode/src/panels/sidebar-panel.ts, packages/shared/src/messages.test.ts, packages/transport/src/mock.ts                                                                                                                                                      | [x]   | [x]   |
| 2026-06-02               | 8.1           | Verified   | docs/specs/213-app-chat-history/{spec,design,tasks}.md, sprint archival record, artifacts/chat/screenshots/\*.png                                                                                                                                                                                                                                                                                                                           | [x]   | [x]   |
| 2026-06-02               | 8.1           | Reviewed   | docs/specs/213-app-chat-history/{spec,design,tasks}.md, sprint archival record                                                                                                                                                                                                                                                                                                                                                              | [x]   | [x]   |
| 2026-06-02               | 7.4, 8.1      | Coded      | apps/chat/src/views/session-browser.tsx, apps/chat/e2e/session-history.spec.ts, docs/specs/213-app-chat-history/{spec,design,tasks}.md                                                                                                                                                                                                                                                                                                      | [x]   | [x]   |
| 2026-07-19T00:25:48.000Z | 9.1           | Coded      | packages/shared/src/transcript-to-timeline.ts, host compatibility re-export, shared/host/transport tests                                                                                                                                                                                                                                                                                                                                    | [x]   | [ ]   |
| 2026-07-19T00:25:48.000Z | 9.1           | Verified   | shared mapper 2/2 (bash output retained; incomplete calls stay non-green); host 3/3; transport 40/40                                                                                                                                                                                                                                                                                                                                        | [x]   | [ ]   |
| 2026-07-19T00:25:48.000Z | 9.2           | Coded      | apps/chat/src/views/session-browser.tsx, apps/chat/src/components/chat/conversation-timeline.tsx, component tests                                                                                                                                                                                                                                                                                                                           | [x]   | [ ]   |
| 2026-07-19T00:25:48.000Z | 9.2-9.3       | Verified   | focused History 5/5 at desktop, 240px, and 320px; full Chat 500/500; curated capture 2/2                                                                                                                                                                                                                                                                                                                                                    | [x]   | [ ]   |
| 2026-07-19T00:25:48.000Z | 9.1-9.3       | Completed  | shared mapper, read-only Chat parity, bash-output retention, incomplete-call status, bottom-aligned footer, and narrow containment                                                                                                                                                                                                                                                                                                          | [x]   | [ ]   |
| 2026-07-19T00:48:00.000Z | 9.3           | Verified   | `pnpm verify` 22/22: Chat 500/500, Shared 103/103, VS Code 475/475; build 4/4                                                                                                                                                                                                                                                                                                                                                               | [x]   | [ ]   |
| 2026-07-19T00:48:00.000Z | 9.3           | Verified   | full E2E: Chat 72/72, Workbench 64 passed + 1 intentional optional-corpus skip, VS Code 31/31; curated capture 2/2                                                                                                                                                                                                                                                                                                                          | [x]   | [ ]   |
