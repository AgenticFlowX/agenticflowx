---
afx: true
type: TASKS
status: Living
owner: "@rixrix"
version: "1.5"
created_at: "2026-05-02T23:56:50.000Z"
updated_at: "2026-07-19T00:48:00.000Z"
tags:
  [
    "app",
    "chat",
    "composer",
    "webview",
    "system-command",
    "slash-auto-complete",
    "workspace-mode",
    "doc-actions",
    "git",
  ]
spec: spec.md
design: design.md
---

# App Chat Composer - Implementation Tasks

---

## Task Numbering Convention

- **0.x** - Migration preparation
- **1.x** - Composer source retargeting
- **2.x** - Future composer behavior changes
- **3.x** - Verification
- **4.x** - System command protocol
- **5.x** - System command implementation
- **6.x** - System command testing
- **7.x** - Verification
- **8.x** - Active file context toggle
- **9.x** - Slash command auto-complete
- **10.x** - Workspace mode and posture
- **11.x** - Blocked command and guardrails
- **12.x** - Doc-actions and workflow
- **13.x** - Verification and retargeting
- **14.x** - Modified files and SDD UX remediation
- **15.x** - SDD workflow-action grouping remediation

---

## Phase 0: Migration Preparation

### 0.1 Confirm Composer Scope

- [ ] Identify composer-owned blocks in `apps/chat/src/views/chat.tsx`
- [ ] Identify helper components and parsing helpers

---

## Phase 1: Source Retargeting

### 1.1 Retarget Composer Files

<!-- files: apps/chat/src/views/chat.tsx, apps/chat/src/components/model-combobox.tsx, apps/chat/src/components/slash-popup.tsx, apps/chat/src/components/mention-popup.tsx, apps/chat/src/lib/composer-detect.ts, apps/chat/src/lib/mentions.ts -->
<!-- @see docs/specs/211-app-chat-composer/design.md [DES-FILES] | docs/specs/211-app-chat-composer/spec.md [FR-1] -->

- [ ] Replace retired chat spec references with composer spec references
- [ ] Keep non-composer refs pointed at their owning zones

---

## Phase 2: Future Composer Work

### 2.1 Footer And Queue Updates

- [ ] Update footer/queue requirements before source edits
- [ ] Add targeted tests for changed behavior

---

## Phase 3: Verification

### 3.1 Verify Composer Traceability

- [ ] Run stale-ref search for chat composer files
- [ ] Run relevant chat tests

## Phase 8: Active File Context Toggle

### 8.1 Add Toolbar Preference Mirror

<!-- files: apps/chat/src/views/chat.tsx, apps/chat/src/views/settings.tsx, apps/chat/src/lib/settings-snapshot.ts -->
<!-- @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-CONTEXT] | docs/specs/211-app-chat-composer/spec.md [FR-11] -->

- [x] Add the active-file context toggle after Thinking with a literal `|` divider
- [x] Mirror the persisted Settings preference via `agent/settingsSnapshot`
- [x] Persist toggle changes through `chat/setIncludeActiveFileContext`

### 8.2 Add Context Toggle Tests

<!-- files: apps/chat/src/app.test.tsx, apps/chat/src/lib/settings-snapshot.test.ts, packages/shared/src/messages.test.ts -->
<!-- @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-CONTEXT] | docs/specs/211-app-chat-composer/spec.md [FR-11] -->

- [x] Add narrow-width composer coverage for the icon-first toggle
- [x] Add snapshot hydration and persistence tests for the mirrored preference
- [x] Keep the new toggle covered by the shared protocol tests

## Phase 4: System Command Protocol

### 4.1 Add System Command Message Types

<!-- files: packages/shared/src/messages.ts -->
<!-- @see docs/specs/211-app-chat-composer/design.md [DES-API] | docs/specs/211-app-chat-composer/spec.md [FR-9] -->

- [x] Add `chat/runCommand` variant to `ChatToAgent` union
- [x] Add `agent/commandOutput` variant to `AgentToChat` union

## Phase 5: System Command Implementation

### 5.1 Client-Side Prefix Detection

<!-- files: apps/chat/src/views/chat.tsx -->
<!-- @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-SYSTEM-COMMAND] | docs/specs/211-app-chat-composer/spec.md [FR-9] -->

- [x] Update `submit()` to detect `trimmed.startsWith("!")`
- [x] Strip `!` prefix before bridge send
- [x] Dispatch `chat/runCommand` instead of `chat/send`

### 5.2 Shell Badge and Footer Warning UX

<!-- files: apps/chat/src/views/chat.tsx -->
<!-- @see docs/specs/211-app-chat-composer/design.md [DES-UI] | docs/specs/211-app-chat-composer/spec.md [NFR-6] -->

- [x] Add `isSystemCommand` state derived from `draft.startsWith("!")`
- [x] Render amber "Shell" badge when `isSystemCommand === true`
- [x] Show persistent footer: `"⚠ Shell · output is local only"`

### 5.3 Dangerous Pattern Guard

<!-- files: apps/chat/src/views/chat.tsx -->
<!-- @see docs/specs/211-app-chat-composer/design.md [DES-ERR] | docs/specs/211-app-chat-composer/spec.md [NFR-6] -->

- [x] Implement dangerous pattern regex: `/^(rm\s+-rf|del\s+.*\/f|format\s|mkfs|dd\s)/i`
- [x] Show VSCode confirm dialog before execution for dangerous commands

### 5.4 Extension Host Shell Execution

<!-- files: apps/vscode/src/panels/sidebar-panel.ts -->
<!-- @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-SYSTEM-COMMAND] | docs/specs/211-app-chat-composer/spec.md [FR-9] -->

- [x] Add `case "chat/runCommand"` in `dispatchInbound`
- [x] Implement `handleRunCommand()` with `child_process.spawn`
- [x] Platform-aware shell: `bash` on Unix, `cmd` on Windows
- [x] CWD: `vscode.workspace.workspaceFolders?.[0]?.uri.fsPath`
- [x] Timeout: 30 seconds with termination
- [x] Stream stdout/stderr via `agent/commandOutput { delta }`
- [x] Emit `done: true, exitCode` on close

### 5.5 Output Card Rendering

<!-- files: apps/chat/src/views/chat.tsx, apps/chat/src/components/output-card.tsx -->
<!-- @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-SYSTEM-COMMAND] | docs/specs/211-app-chat-composer/spec.md [FR-9] -->

- [x] Add `bridgeOn("agent/commandOutput")` handler
- [x] Render `<OutputCard>` in message timeline
- [x] stdout: muted text color
- [x] stderr: red text
- [x] exitCode: amber badge
- [x] **Output persists across multiple commands** (not a single ephemeral slot)
- [x] **Output visible on first load / new session** (not masked by `<EmptyState>`)
- [x] **Silent commands show exit badge** (`touch`, `rm` with no stdout/stderr)
- [x] **Previous outputs remain visible** when a new `!` command starts

## Phase 6: System Command Testing

### 6.1 Unit Tests

<!-- files: apps/chat/src/lib/system-command.test.ts (new) -->
<!-- @see docs/specs/211-app-chat-composer/design.md [DES-TEST] -->

- [x] Test prefix detection: `!ls` → `ls`, `!` alone → empty command
- [x] Test dangerous pattern matching
- [x] Test submit() bypasses LLM when `!` prefix present

### 6.2 Integration Tests

<!-- files: apps/vscode/src/panels/sidebar-panel.test.ts -->
<!-- @see docs/specs/211-app-chat-composer/design.md [DES-TEST] -->

- [x] Test shell execution: stdout/stderr streaming
- [x] Test non-zero exit code handling
- [x] Test timeout termination (SIGTERM → explicit error)
- [x] Test spawn failure (ENOENT → error message)

## Phase 7: Verification

### 7.1 Verify System Command Traceability

<!-- files: All modified files -->
<!-- @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-TRACE] -->

- [x] Run stale-ref search for @see annotations
- [x] Verify badge visible when draft starts with `!`
- [x] Verify guard shown for `rm -rf`
- [x] Verify output renders in timeline

## Phase 9: Slash Command Auto-Complete

### 9.1 Add Filter Query State And Derivation

<!-- files: apps/chat/src/components/slash-popup.tsx, apps/chat/src/lib/composer-detect.ts -->
<!-- @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-SLASH-POPUP] | docs/specs/211-app-chat-composer/spec.md [FR-3] -->

- [x] Add `filterQuery` state to `SlashPopup` (substring after `/` trigger)
- [x] Derive `filteredCommands` from `AgentCommand[]` by matching `displayCommandName` against `filterQuery` (case-insensitive prefix/substring)
- [x] Wire `onFilterChange` to update `filterQuery` from draft changes without closing popup

### 9.2 Implement Tab Focus Transfer

<!-- files: apps/chat/src/views/chat.tsx, apps/chat/src/components/slash-popup.tsx -->
<!-- @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-SLASH-POPUP] [DES-COMPOSER-KEYS] | docs/specs/211-app-chat-composer/spec.md [FR-3] -->

- [x] Add `Tab` handling in `onKeyDown` when slash popup is open
- [x] Move focus from textarea to first `CommandRow` in the popup
- [x] Keep popup open after focus transfer

### 9.3 Add Empty State Rendering

<!-- files: apps/chat/src/components/slash-popup.tsx -->
<!-- @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-MOCKUP-SLASH-FILTER] | docs/specs/211-app-chat-composer/spec.md [FR-3] -->

- [x] Show "No commands match" empty state when `filteredCommands` is empty
- [x] Popup stays open so user can keep typing or press Escape to close

### 9.4 Add Slash Popup Tests

<!-- files: apps/chat/src/components/slash-popup.test.tsx -->
<!-- @see docs/specs/211-app-chat-composer/design.md [DES-TEST] | docs/specs/211-app-chat-composer/spec.md [FR-3] -->

- [x] Test incremental filter narrowing (`/afx-s` → `/afx-spec`, `/afx-sprint`)
- [x] Test empty state rendering
- [x] Test Tab focus transfer from textarea to first command row
- [x] Test arrow navigation and Enter selection after focus transfer

## Phase 10: Workspace Mode And Posture

### 10.1 Implement ModeToggle

<!-- files: apps/chat/src/views/chat.tsx -->
<!-- @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-MODE-TOGGLE] | docs/specs/211-app-chat-composer/spec.md [FR-12] [FR-14] -->

- [x] Add `ModeToggle` with Code/Explore/Spec dropdown
- [x] Send `chat/setMode` on selection
- [x] Handle `agent/settingsSnapshot` echo to keep local state in sync

### 10.2 Add CSS Accent Per Mode

<!-- files: apps/chat/src/views/chat.tsx -->
<!-- @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-MODE-TOGGLE] | docs/specs/211-app-chat-composer/spec.md [FR-14] -->

- [x] Add `data-workspace-mode` attribute to `InputGroup` wrapper
- [x] Drive CSS-only border/ring accent: Code (default), Explore (amber), Spec (violet)

### 10.3 Add Spec Footer Hint

<!-- files: apps/chat/src/views/chat.tsx -->
<!-- @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-MODE-TOGGLE] | docs/specs/211-app-chat-composer/spec.md [FR-14] -->

- [x] Render `Planning / Docs only · ⌘⇧M to switch` footer hint when mode is Spec

## Phase 11: Blocked Command And Guardrails

### 11.1 Implement BlockedCommandStrip

<!-- files: apps/chat/src/views/chat.tsx -->
<!-- @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-BLOCKED-COMMAND-STRIP] | docs/specs/211-app-chat-composer/spec.md [FR-13] -->

- [x] Render strip when `agent/actionBlocked` arrives
- [x] Show warning copy, original command text, and explanation
- [x] Add `Switch to Code`, `Copy command`, and `Dismiss` affordances
- [x] `restoreBlockedCommand` restores the `!` command into draft when switching to Code

## Phase 12: Doc-Actions And Workflow

### 12.1 Implement ChatDocActionsStrip

<!-- files: apps/chat/src/components/chat-doc-actions-strip.tsx -->
<!-- @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-STRIP] | docs/specs/211-app-chat-composer/spec.md [FR-15] [FR-16] -->

- [x] Surface catalog-verified SDD intent buttons routed by detected doc format
- [x] Spec mode: full 3–4 button set; Code/Explore: compact per-docKind set
- [x] Group compose/draft actions before `|` divider, run-now actions after

### 12.2 Add Breadcrumb Header

<!-- files: apps/chat/src/components/chat-doc-actions-strip.tsx -->
<!-- @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-STRIP] | docs/specs/211-app-chat-composer/spec.md [FR-17] -->

- [x] Render `Spec ✓ → Design ⏳ → Tasks 3/8 → Code` in Spec mode
- [x] Click auto-sends `/afx-next` (deterministic read)
- [x] Compact mode hides breadcrumb

### 12.3 Add Memory Dropdown Anchor

<!-- files: apps/chat/src/components/chat-doc-actions-strip.tsx -->
<!-- @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-STRIP] | docs/specs/211-app-chat-composer/spec.md [FR-18] -->

- [x] Render icon-only Memory ▾ in strip header (Spec mode only)
- [x] Share `MEMORY_CATALOG` with composer-toolbar and top-right anchors
- [x] Compact mode: tuck under `···` More

### 12.4 Add Sign Off Button

<!-- files: apps/chat/src/components/chat-doc-actions-strip.tsx -->
<!-- @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-STRIP] | docs/specs/211-app-chat-composer/spec.md [FR-19] -->

- [x] Surface brass `[Sign Off ▾]` when tasks.md sign-off conditions are met
- [x] Confirm popover previews atomic edit (rows ticked + status promotion + updated_at)
- [x] Dispatch `chat/hostAction { action: "tasks.signOff", uri }` on confirm
- [x] Handle `agent/signOffComplete` toast UX

### 12.5 Compact Sidebar Overflow

<!-- files: apps/chat/src/components/model-combobox.tsx, apps/chat/src/components/chat-memory-menu-button.tsx, apps/chat/src/components/composer-strip.tsx, apps/chat/src/components/chat-doc-actions-strip.tsx, apps/chat/src/views/chat.tsx -->
<!-- @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-MOCKUP-RUNTIME-MENU] [DES-COMPOSER-COMPONENT-MODEL-COMBOBOX] [DES-COMPOSER-COMPONENT-STRIP] | docs/specs/211-app-chat-composer/spec.md [FR-5] [FR-15] [NFR-7] -->

- [x] Flatten model selection into the root model/thinking menu so it cannot clip sideways in VS Code sidebars
- [x] Keep the selected model in tooltip/accessibility copy while the footer trigger uses compact `Model - <thinking>` text
- [x] Collapse model, workspace mode, memory, and footer separators to icon-first affordances at the smallest composer widths
- [x] Collapse doc-action primary buttons into one ellipsis-backed Document actions menu at narrow strip widths

## Phase 13: Verification And Retargeting

### 13.1 Retire Stale Spec References

<!-- files: apps/chat/src/views/chat.tsx, apps/chat/src/components/*.tsx, apps/chat/src/lib/*.ts -->
<!-- @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-REFS] [DES-COMPOSER-TRACE] | docs/specs/211-app-chat-composer/spec.md [NFR-5] -->

- [x] Replace retired `210-app-chat` / `chat-foundation` @see refs with `211-app-chat-composer`
- [x] Keep non-composer refs (messages, timeline, settings) pointed at owning zones

### 13.2 Run Full Verification

- [x] Run `pnpm verify` for chat package
- [x] Confirm no stale `@see` annotations remain

## Phase 14: Modified Files And SDD UX Remediation

### 14.1 Derive The Latest Edit Batch

<!-- files: apps/chat/src/lib/derive-modified-files.ts, apps/chat/src/components/chat/chat-controller.tsx, apps/chat/src/lib/derive-modified-files.test.ts, apps/chat/src/components/chat/chat-controller.test.tsx -->
<!-- @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-FILES-STRIP] | docs/specs/211-app-chat-composer/spec.md [FR-10] -->

- [x] Replace transcript-wide accumulation with the newest assistant edit batch
- [x] Order repeated paths by the newest tool call and preserve status/line metadata
- [x] Prevent historical SDD files from auto-opening after a non-SDD edit batch

### 14.2 Bound And Clarify Modified File Actions

<!-- files: apps/chat/src/components/files-panel.tsx, apps/chat/src/components/files-panel.test.tsx, apps/chat/e2e/files-strip.spec.ts -->
<!-- @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-FILES-STRIP] [DES-COMPOSER-MOCKUP-FILES-COMPACT] | docs/specs/211-app-chat-composer/spec.md [FR-10] [NFR-7] -->

- [x] Render at most two non-SDD controls on one compact row and de-duplicate the SDD summary
- [x] Add collision-aware labels, bounded All-files browsing, and accessible source/Preview/Git actions
- [x] Assert narrow geometry, overflow containment, keyboard behavior, and high-volume mixed batches

### 14.3 Route Native Git Changes

<!-- files: packages/shared/src/messages.ts, apps/vscode/src/panels/sidebar-panel.ts, apps/vscode/src/panels/sidebar-panel.test.ts -->
<!-- @see docs/specs/211-app-chat-composer/design.md [DES-API] [DES-COMPOSER-FILES-STRIP] | docs/specs/211-app-chat-composer/spec.md [FR-10] -->

- [x] Add the backward-compatible `gitChanges` open-file mode
- [x] Resolve paths across workspace folders and open changed Git resources through `git.openChange`
- [x] Provide explicit unavailable, non-repository, clean-file, and command-failure fallbacks

### 14.4 Verify And Capture The Release Surface

<!-- files: apps/chat/e2e/files-strip.spec.ts, apps/chat/e2e/extension-capture.spec.ts, apps/vscode-e2e/src/extension.test.ts -->
<!-- @see docs/specs/211-app-chat-composer/design.md [DES-TEST] [DES-COMPOSER-FILES-STRIP] | docs/specs/211-app-chat-composer/spec.md [FR-10] [NFR-5] [NFR-7] -->

- [x] Run focused unit, protocol, host, and responsive E2E regression suites
- [x] Generate dedicated 34/21 mixed, narrow, Markdown-action, and All-files captures
- [x] Run workspace verification, complete E2E, extension-host smoke, and traceability checks

---

## Phase 15: SDD Workflow-Action Grouping Remediation

### 15.1 Group SDD `More` Actions By Owner

<!-- files: apps/chat/src/components/files-panel.tsx, apps/chat/src/components/files-panel.test.tsx -->
<!-- @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-FILES-STRIP] [DES-COMPOSER-MOCKUP-SDD-ACTIONS-GROUPED] | docs/specs/211-app-chat-composer/spec.md [FR-10] [NFR-7] -->

- [x] Derive actions only from successful SDD documents and group standard spec/design/tasks/journal files by normalized parent-directory owner
- [x] Keep sprint, ADR, and research documents as document-path singleton owners; order standard actions Spec, Design, Tasks, Journal and dedupe owner/command pairs
- [x] Render shortest-unique owner suffixes with full owner paths in accessible names/tooltips and one identified Journal footer targeting the newest successful owner
- [x] Give an error status priority over running when one SDD batch contains both states

### 15.2 Bound And Verify The Single-Level Workflow List

<!-- files: apps/chat/src/components/files-panel.tsx, apps/chat/src/components/files-panel.test.tsx, apps/chat/e2e/files-strip.spec.ts -->
<!-- @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-FILES-STRIP] [DES-COMPOSER-MOCKUP-SDD-ACTIONS-GROUPED] [DES-TEST] | docs/specs/211-app-chat-composer/spec.md [FR-10] [NFR-5] [NFR-7] -->

- [x] Keep `More` as one portalled list with no submenu, capped at `min(45vh, 320px)`, internally scrollable, and width-bounded to the sidebar viewport
- [x] Cover multiple/nested owners, owner-label collisions, mixed standard/singleton groups, duplicate commands, running/error exclusion, singular Journal targeting, and Escape focus restoration
- [x] Add narrow high-volume E2E proof that first/last groups remain reachable, owner-specific actions dispatch the correct command, and opening the menu creates no horizontal overflow or composer reflow
- [x] Activate focused SDD actions with Space as well as Enter while preserving menu close and focus behavior

---

## Implementation Flow

```text
Confirm route
    ↓
Retarget source refs
    ↓
Add system command message types
    ↓
Implement client-side prefix detection + UX
    ↓
Implement extension host shell execution
    ↓
Implement output card rendering
    ↓
Add tests
    ↓
Verify traceability
    ↓
Group SDD workflow actions by owner
    ↓
Verify bounded single-list behavior at narrow width
```

---

## Cross-Reference Index

| Task | Spec Requirement          | Design Section                                                                                            |
| ---- | ------------------------- | --------------------------------------------------------------------------------------------------------- |
| 1.1  | [FR-1], [FR-2], [FR-3]    | [DES-FILES], [DES-UI]                                                                                     |
| 2.1  | [FR-2], [FR-4]            | [DES-UI], [DES-TEST]                                                                                      |
| 4.1  | [FR-9]                    | [DES-API]                                                                                                 |
| 5.1  | [FR-9]                    | [DES-COMPOSER-SYSTEM-COMMAND]                                                                             |
| 5.2  | [NFR-6]                   | [DES-UI]                                                                                                  |
| 5.3  | [NFR-6]                   | [DES-ERR]                                                                                                 |
| 5.4  | [FR-9]                    | [DES-COMPOSER-SYSTEM-COMMAND]                                                                             |
| 5.5  | [FR-9]                    | [DES-COMPOSER-SYSTEM-COMMAND]                                                                             |
| 6.1  | [FR-9]                    | [DES-TEST]                                                                                                |
| 6.2  | [FR-9]                    | [DES-TEST]                                                                                                |
| 7.1  | [FR-9], [NFR-6]           | [DES-COMPOSER-TRACE]                                                                                      |
| 8.1  | [FR-11]                   | [DES-COMPOSER-CONTEXT]                                                                                    |
| 8.2  | [FR-11], [NFR-7]          | [DES-COMPOSER-CONTEXT]                                                                                    |
| 9.1  | [FR-3]                    | [DES-COMPOSER-COMPONENT-SLASH-POPUP]                                                                      |
| 9.2  | [FR-3]                    | [DES-COMPOSER-COMPONENT-SLASH-POPUP] [DES-COMPOSER-KEYS]                                                  |
| 9.3  | [FR-3]                    | [DES-COMPOSER-MOCKUP-SLASH-FILTER]                                                                        |
| 9.4  | [FR-3]                    | [DES-TEST]                                                                                                |
| 10.1 | [FR-12], [FR-14]          | [DES-COMPOSER-COMPONENT-MODE-TOGGLE]                                                                      |
| 10.2 | [FR-14]                   | [DES-COMPOSER-COMPONENT-MODE-TOGGLE]                                                                      |
| 10.3 | [FR-14]                   | [DES-COMPOSER-COMPONENT-MODE-TOGGLE]                                                                      |
| 11.1 | [FR-13]                   | [DES-COMPOSER-COMPONENT-BLOCKED-COMMAND-STRIP]                                                            |
| 12.1 | [FR-15], [FR-16]          | [DES-COMPOSER-COMPONENT-STRIP]                                                                            |
| 12.2 | [FR-17]                   | [DES-COMPOSER-COMPONENT-STRIP]                                                                            |
| 12.3 | [FR-18]                   | [DES-COMPOSER-COMPONENT-STRIP]                                                                            |
| 12.4 | [FR-19]                   | [DES-COMPOSER-COMPONENT-STRIP]                                                                            |
| 12.5 | [FR-5], [FR-15], [NFR-7]  | [DES-COMPOSER-MOCKUP-RUNTIME-MENU] [DES-COMPOSER-COMPONENT-MODEL-COMBOBOX] [DES-COMPOSER-COMPONENT-STRIP] |
| 13.1 | [NFR-5]                   | [DES-COMPOSER-REFS] [DES-COMPOSER-TRACE]                                                                  |
| 13.2 | [NFR-5]                   | [DES-TEST]                                                                                                |
| 14.1 | [FR-10]                   | [DES-COMPOSER-FILES-STRIP]                                                                                |
| 14.2 | [FR-10], [NFR-7]          | [DES-COMPOSER-FILES-STRIP] [DES-COMPOSER-MOCKUP-FILES-COMPACT]                                            |
| 14.3 | [FR-10]                   | [DES-API] [DES-COMPOSER-FILES-STRIP]                                                                      |
| 14.4 | [FR-10], [NFR-5], [NFR-7] | [DES-TEST] [DES-COMPOSER-FILES-STRIP]                                                                     |
| 15.1 | [FR-10], [NFR-7]          | [DES-COMPOSER-FILES-STRIP] [DES-COMPOSER-MOCKUP-SDD-ACTIONS-GROUPED]                                      |
| 15.2 | [FR-10], [NFR-5], [NFR-7] | [DES-TEST] [DES-COMPOSER-FILES-STRIP] [DES-COMPOSER-MOCKUP-SDD-ACTIONS-GROUPED]                           |

---

## Notes

- This spec is the starting point for chat box footer instructions.

---

## Work Sessions

<!-- IMPORTANT: This section MUST remain the LAST section in tasks.md. Do not add content below it. -->
<!-- Task execution log — append-only, updated by /afx-task pick, /afx-task code, /afx-task complete -->

| Date                     | Task      | Action     | Files Modified                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Agent | Human |
| ------------------------ | --------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 2026-05-02               | 0.1       | Scaffolded | docs/specs/211-app-chat-composer/                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | [x]   | [x]   |
| 2026-05-03               | 0.2       | Coded      | design.md, apps/chat/src/views/chat.tsx                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | [x]   | [x]   |
| 2026-05-04               | 4.1       | Picked     | -                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | [x]   | [x]   |
| 2026-05-04               | 4.1       | Coded      | packages/shared/src/messages.ts                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | [x]   | [x]   |
| 2026-05-04               | 4.1       | Completed  | packages/shared/src/messages.ts                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | [x]   | [x]   |
| 2026-05-04               | 5.4       | Picked     | -                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | [x]   | [x]   |
| 2026-05-04               | 5.4       | Coded      | sidebar-panel.ts, sidebar-panel.test.ts                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | [x]   | [x]   |
| 2026-05-04               | 5.4       | Completed  | sidebar-panel.ts, sidebar-panel.test.ts                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | [x]   | [x]   |
| 2026-05-04               | 5.1       | Picked     | -                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | [x]   | [x]   |
| 2026-05-04               | 5.1       | Coded      | chat.tsx                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | [x]   | [x]   |
| 2026-05-04               | 5.1       | Completed  | chat.tsx                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | [x]   | [x]   |
| 2026-05-04               | 5.2       | Coded      | chat.tsx                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | [x]   | [x]   |
| 2026-05-04               | 5.2       | Completed  | chat.tsx                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | [x]   | [x]   |
| 2026-05-04               | 5.3       | Picked     | -                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | [x]   | [x]   |
| 2026-05-04               | 5.3       | Coded      | chat.tsx, sidebar-panel.ts, messages.ts                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | [x]   | [x]   |
| 2026-05-04               | 5.3       | Completed  | chat.tsx, sidebar-panel.ts, messages.ts                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | [x]   | [x]   |
| 2026-05-05T11:53:21.000Z | 8.1/8.2   | Coded      | apps/chat/src/views/chat.tsx, apps/chat/src/views/settings.tsx, apps/chat/src/lib/settings-snapshot.ts, apps/chat/src/app.test.tsx, apps/chat/src/lib/settings-snapshot.test.ts, packages/shared/src/messages.ts, packages/shared/src/messages.test.ts, apps/vscode/src/panels/sidebar-panel.ts, apps/vscode/src/panels/sidebar-panel.test.ts, apps/vscode/package.json                                                                                                                                    | [x]   | [x]   |
| 2026-05-05T12:03:56.000Z | 8.1/8.2   | Completed  | apps/chat/src/views/chat.tsx, apps/chat/src/views/settings.tsx, apps/chat/src/lib/settings-snapshot.ts, apps/chat/src/app.test.tsx, apps/chat/src/lib/settings-snapshot.test.ts, packages/shared/src/messages.ts, packages/shared/src/messages.test.ts, apps/vscode/src/panels/sidebar-panel.ts, apps/vscode/src/panels/sidebar-panel.test.ts, apps/vscode/package.json                                                                                                                                    | [x]   | [x]   |
| 2026-05-05T12:23:25.000Z | 8.1/8.2   | Coded      | apps/chat/src/views/chat.tsx, docs/specs/211-app-chat-composer/design.md, docs/specs/211-app-chat-composer/spec.md                                                                                                                                                                                                                                                                                                                                                                                         | [x]   | [x]   |
| 2026-05-05T12:27:26.000Z | 8.1/8.2   | Coded      | apps/chat/src/views/chat.tsx, docs/specs/211-app-chat-composer/design.md, docs/specs/211-app-chat-composer/spec.md                                                                                                                                                                                                                                                                                                                                                                                         | [x]   | [x]   |
| 2026-05-05T12:29:44.000Z | 8.1/8.2   | Completed  | apps/chat/src/views/chat.tsx, docs/specs/211-app-chat-composer/design.md, docs/specs/211-app-chat-composer/spec.md, docs/specs/211-app-chat-composer/tasks.md                                                                                                                                                                                                                                                                                                                                              | [x]   | [x]   |
| 2026-05-05T12:33:26.000Z | 8.1/8.2   | Coded      | apps/chat/src/views/chat.tsx, apps/chat/src/components/model-combobox.tsx, apps/chat/src/app.test.tsx, docs/specs/211-app-chat-composer/design.md, docs/specs/211-app-chat-composer/spec.md                                                                                                                                                                                                                                                                                                                | [x]   | [x]   |
| 2026-05-05T13:09:28.000Z | 8.1/8.2   | Coded      | apps/chat/src/views/chat.tsx, apps/chat/package.json, pnpm-lock.yaml                                                                                                                                                                                                                                                                                                                                                                                                                                       | [x]   | [x]   |
| 2026-05-05T13:13:33.000Z | 8.1/8.2   | Coded      | apps/chat/src/views/chat.tsx, apps/chat/src/app.test.tsx                                                                                                                                                                                                                                                                                                                                                                                                                                                   | [x]   | [x]   |
| 2026-05-06T04:37:30.000Z | 8.1/8.2   | Coded      | apps/chat/src/views/chat.tsx, apps/chat/src/app.test.tsx                                                                                                                                                                                                                                                                                                                                                                                                                                                   | [x]   | [x]   |
| 2026-05-06T04:47:55.000Z | 8.1/8.2   | Coded      | apps/chat/src/views/chat.tsx, docs/specs/211-app-chat-composer/tasks.md                                                                                                                                                                                                                                                                                                                                                                                                                                    | [x]   | [x]   |
| 2026-05-06T05:25:34.000Z | 8.1/8.2   | Coded      | apps/chat/src/views/chat.tsx, apps/chat/src/app.test.tsx, docs/specs/211-app-chat-composer/design.md, docs/specs/211-app-chat-composer/tasks.md                                                                                                                                                                                                                                                                                                                                                            | [x]   | [x]   |
| 2026-05-04               | 5.5       | Picked     | -                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | [x]   | [x]   |
| 2026-05-04               | 5.5       | Coded      | chat.tsx, output-card.tsx                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | [x]   | [x]   |
| 2026-05-04               | 5.5       | Completed  | chat.tsx, output-card.tsx                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | [x]   | [x]   |
| 2026-05-04               | 5.5       | Coded      | chat.tsx, output-card.tsx, sidebar-panel.ts, messages.ts                                                                                                                                                                                                                                                                                                                                                                                                                                                   | [x]   | [x]   |
| 2026-05-04               | 5.5       | Coded      | chat.tsx, sidebar-panel.ts                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | [x]   | [x]   |
| 2026-05-04               | 5.5       | Coded      | chat.tsx                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | [x]   | [x]   |
| 2026-05-04               | 6.1       | Coded      | system-command.ts, system-command.test.ts                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | [x]   | [x]   |
| 2026-05-04               | 6.2       | Coded      | sidebar-panel.test.ts                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | [x]   | [x]   |
| 2026-05-06T07:58:27.000Z | 8.1/8.2   | Coded      | apps/chat/src/views/chat.tsx, apps/chat/src/app.test.tsx, docs/specs/211-app-chat-composer/tasks.md                                                                                                                                                                                                                                                                                                                                                                                                        | [x]   | [x]   |
| 2026-05-06T08:03:09.000Z | 8.1/8.2   | Coded      | apps/chat/src/views/chat.tsx, apps/chat/src/app.test.tsx, docs/specs/211-app-chat-composer/tasks.md                                                                                                                                                                                                                                                                                                                                                                                                        | [x]   | [x]   |
| 2026-05-06T08:05:49.000Z | 8.1/8.2   | Coded      | apps/chat/src/views/chat.tsx, apps/chat/src/app.test.tsx, docs/specs/211-app-chat-composer/tasks.md                                                                                                                                                                                                                                                                                                                                                                                                        | [x]   | [x]   |
| 2026-05-06T08:59:51.000Z | 8.1/8.2   | Coded      | apps/chat/src/views/chat.tsx, apps/chat/src/components/model-combobox.tsx, apps/chat/src/app.test.tsx, docs/specs/211-app-chat-composer/design.md, docs/specs/211-app-chat-composer/spec.md, docs/specs/211-app-chat-composer/tasks.md                                                                                                                                                                                                                                                                     | [x]   | [x]   |
| 2026-05-09T13:31:49.000Z | 10.1      | Verified   | apps/chat/src/views/chat.tsx                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | [x]   | [x]   |
| 2026-05-09T13:31:49.000Z | 10.1      | Completed  | apps/chat/src/views/chat.tsx                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | [x]   | [x]   |
| 2026-05-09T13:31:49.000Z | 10.2      | Verified   | apps/chat/src/views/chat.tsx, apps/chat/src/index.css                                                                                                                                                                                                                                                                                                                                                                                                                                                      | [x]   | [x]   |
| 2026-05-09T13:31:49.000Z | 10.2      | Completed  | apps/chat/src/views/chat.tsx, apps/chat/src/index.css                                                                                                                                                                                                                                                                                                                                                                                                                                                      | [x]   | [x]   |
| 2026-05-09T13:31:49.000Z | 10.3      | Verified   | apps/chat/src/views/chat.tsx                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | [x]   | [x]   |
| 2026-05-09T13:31:49.000Z | 10.3      | Completed  | apps/chat/src/views/chat.tsx                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | [x]   | [x]   |
| 2026-05-09T13:31:49.000Z | 11.1      | Verified   | apps/chat/src/views/chat.tsx, apps/chat/src/app.test.tsx                                                                                                                                                                                                                                                                                                                                                                                                                                                   | [x]   | [x]   |
| 2026-05-09T13:31:49.000Z | 11.1      | Completed  | apps/chat/src/views/chat.tsx, apps/chat/src/app.test.tsx                                                                                                                                                                                                                                                                                                                                                                                                                                                   | [x]   | [x]   |
| 2026-05-09T13:31:49.000Z | 12.1      | Verified   | apps/chat/src/components/chat-doc-actions-strip.tsx, apps/chat/src/components/chat-doc-actions-strip.test.tsx                                                                                                                                                                                                                                                                                                                                                                                              | [x]   | [x]   |
| 2026-05-09T13:31:49.000Z | 12.1      | Completed  | apps/chat/src/components/chat-doc-actions-strip.tsx, apps/chat/src/components/chat-doc-actions-strip.test.tsx                                                                                                                                                                                                                                                                                                                                                                                              | [x]   | [x]   |
| 2026-05-09T13:31:49.000Z | 12.2      | Verified   | apps/chat/src/components/chat-doc-actions-strip.tsx                                                                                                                                                                                                                                                                                                                                                                                                                                                        | [x]   | [x]   |
| 2026-05-09T13:31:49.000Z | 12.2      | Completed  | apps/chat/src/components/chat-doc-actions-strip.tsx                                                                                                                                                                                                                                                                                                                                                                                                                                                        | [x]   | [x]   |
| 2026-05-09T13:31:49.000Z | 12.3      | Verified   | apps/chat/src/components/chat-doc-actions-strip.tsx, apps/chat/src/components/memory-dropdown.tsx, apps/chat/src/components/chat-memory-menu-button.tsx, apps/chat/src/lib/doc-actions.ts                                                                                                                                                                                                                                                                                                                  | [x]   | [x]   |
| 2026-05-09T13:31:49.000Z | 12.3      | Completed  | apps/chat/src/components/chat-doc-actions-strip.tsx, apps/chat/src/components/memory-dropdown.tsx, apps/chat/src/components/chat-memory-menu-button.tsx, apps/chat/src/lib/doc-actions.ts                                                                                                                                                                                                                                                                                                                  | [x]   | [x]   |
| 2026-05-09T13:31:49.000Z | 12.4      | Verified   | apps/chat/src/components/chat-doc-actions-strip.tsx                                                                                                                                                                                                                                                                                                                                                                                                                                                        | [x]   | [x]   |
| 2026-05-09T13:31:49.000Z | 12.4      | Completed  | apps/chat/src/components/chat-doc-actions-strip.tsx                                                                                                                                                                                                                                                                                                                                                                                                                                                        | [x]   | [x]   |
| 2026-05-09T13:40:25.000Z | 9.1       | Coded      | apps/chat/src/components/slash-popup.tsx, apps/chat/src/views/chat.tsx                                                                                                                                                                                                                                                                                                                                                                                                                                     | [x]   | [x]   |
| 2026-05-09T13:40:25.000Z | 9.1       | Completed  | apps/chat/src/components/slash-popup.tsx, apps/chat/src/views/chat.tsx                                                                                                                                                                                                                                                                                                                                                                                                                                     | [x]   | [x]   |
| 2026-05-09T13:43:10.000Z | 9.2       | Coded      | apps/chat/src/views/chat.tsx                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | [x]   | [x]   |
| 2026-05-09T13:43:10.000Z | 9.2       | Completed  | apps/chat/src/views/chat.tsx                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | [x]   | [x]   |
| 2026-05-09T13:46:09.000Z | 9.3       | Coded      | apps/chat/src/components/slash-popup.tsx                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | [x]   | [x]   |
| 2026-05-09T13:46:09.000Z | 9.3       | Completed  | apps/chat/src/components/slash-popup.tsx                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | [x]   | [x]   |
| 2026-05-09T13:50:37.000Z | 9.4       | Coded      | apps/chat/src/components/slash-popup.test.tsx                                                                                                                                                                                                                                                                                                                                                                                                                                                              | [x]   | [x]   |
| 2026-05-09T13:50:37.000Z | 9.4       | Completed  | apps/chat/src/components/slash-popup.test.tsx                                                                                                                                                                                                                                                                                                                                                                                                                                                              | [x]   | [x]   |
| 2026-05-09T13:55:29.000Z | 13.1      | Coded      | apps/chat/src/views/chat.tsx, apps/chat/src/components/markdown-message.tsx                                                                                                                                                                                                                                                                                                                                                                                                                                | [x]   | [x]   |
| 2026-05-09T13:55:29.000Z | 13.1      | Completed  | apps/chat/src/views/chat.tsx, apps/chat/src/components/markdown-message.tsx                                                                                                                                                                                                                                                                                                                                                                                                                                | [x]   | [x]   |
| 2026-05-09T14:07:38.000Z | 13.2      | Verified   | apps/chat/src/views/chat.tsx, docs/specs/211-app-chat-composer/tasks.md                                                                                                                                                                                                                                                                                                                                                                                                                                    | [x]   | [x]   |
| 2026-05-09T14:07:38.000Z | 13.2      | Completed  | apps/chat/src/views/chat.tsx, docs/specs/211-app-chat-composer/tasks.md                                                                                                                                                                                                                                                                                                                                                                                                                                    | [x]   | [x]   |
| 2026-05-09T14:14:33.000Z | 12.1      | Coded      | apps/chat/src/components/result-actions.tsx, apps/chat/src/components/result-actions.test.tsx, apps/chat/src/views/chat.tsx, apps/chat/src/app.test.tsx, apps/chat/e2e/spec-mode.spec.ts, docs/specs/211-app-chat-composer/spec.md, docs/specs/211-app-chat-composer/design.md, docs/specs/211-app-chat-composer/tasks.md                                                                                                                                                                                  | [x]   | [x]   |
| 2026-05-11T08:40:29.000Z | 12.5      | Coded      | apps/chat/src/components/model-combobox.tsx, apps/chat/src/components/model-combobox.test.tsx, apps/chat/src/components/chat-memory-menu-button.tsx, apps/chat/src/components/composer-strip.tsx, apps/chat/src/components/chat-doc-actions-strip.tsx, apps/chat/src/components/chat-doc-actions-strip.test.tsx, apps/chat/src/views/chat.tsx, apps/chat/src/app.test.tsx, docs/specs/211-app-chat-composer/spec.md, docs/specs/211-app-chat-composer/design.md, docs/specs/211-app-chat-composer/tasks.md | [x]   | [x]   |
| 2026-05-11T08:53:28.000Z | 12.5      | Verified   | pnpm verify:full                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | [x]   | [x]   |
| 2026-05-17T12:45:57.000Z | FR-15     | Fixed      | apps/chat/src/lib/result-actions.ts, apps/chat/src/lib/result-actions.test.ts, apps/chat/src/app.test.tsx                                                                                                                                                                                                                                                                                                                                                                                                  | [x]   | [ ]   |
| 2026-05-17T12:59:12.000Z | FR-15     | Fixed      | apps/chat/src/lib/result-actions.ts, apps/chat/src/lib/result-actions.test.ts, apps/chat/e2e/result-actions.spec.ts, packages/transport/src/mock.ts, docs/specs/211-app-chat-composer/spec.md, docs/specs/211-app-chat-composer/design.md, docs/specs/211-app-chat-composer/tasks.md                                                                                                                                                                                                                       | [x]   | [ ]   |
| 2026-05-17T13:11:29.000Z | FR-16     | Fixed      | apps/chat/src/lib/result-actions.ts, apps/chat/src/lib/result-actions.test.ts, apps/chat/src/components/chat/conversation-timeline.tsx, apps/chat/src/components/chat/conversation-timeline.test.tsx, apps/chat/src/components/chat/chat-controller.tsx, apps/chat/src/components/chat/chat-controller.test.tsx, docs/specs/211-app-chat-composer/spec.md, docs/specs/211-app-chat-composer/design.md, docs/specs/211-app-chat-composer/tasks.md                                                           | [x]   | [ ]   |
| 2026-05-22T05:56:29.000Z | FR-11     | Fixed      | apps/chat/src/components/chat/composer-toolbar.tsx, apps/chat/src/components/chat/composer-toolbar.test.tsx, apps/chat/e2e/chat.spec.ts, apps/chat/e2e/screenshots.spec.ts, packages/transport/src/mock.ts, packages/transport/src/mock.test.ts, docs/specs/211-app-chat-composer/spec.md, docs/specs/211-app-chat-composer/design.md, docs/specs/211-app-chat-composer/tasks.md                                                                                                                           | [x]   | [ ]   |
| 2026-07-18T16:59:49.000Z | 14.1      | Picked     | -                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | [x]   | [ ]   |
| 2026-07-18T16:59:49.000Z | 14.2      | Picked     | -                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | [x]   | [ ]   |
| 2026-07-18T16:59:49.000Z | 14.3      | Picked     | -                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | [x]   | [ ]   |
| 2026-07-18T16:59:49.000Z | 14.4      | Picked     | -                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | [x]   | [ ]   |
| 2026-07-18T17:37:43.000Z | 14.1      | Coded      | apps/chat/src/lib/derive-modified-files.ts, apps/chat/src/components/chat/chat-controller.tsx, focused unit tests                                                                                                                                                                                                                                                                                                                                                                                          | [x]   | [ ]   |
| 2026-07-18T17:37:43.000Z | 14.1      | Verified   | latest-batch replacement, recency, dedupe, dismissal reset, and stale-SDD negative coverage                                                                                                                                                                                                                                                                                                                                                                                                                | [x]   | [ ]   |
| 2026-07-18T17:37:43.000Z | 14.1      | Completed  | apps/chat/src/lib/derive-modified-files.ts, apps/chat/src/components/chat/chat-controller.tsx                                                                                                                                                                                                                                                                                                                                                                                                              | [x]   | [ ]   |
| 2026-07-18T17:37:43.000Z | 14.2      | Coded      | apps/chat/src/components/files-panel.tsx, apps/chat/e2e/files-strip.spec.ts, files-panel unit tests                                                                                                                                                                                                                                                                                                                                                                                                        | [x]   | [ ]   |
| 2026-07-18T17:37:43.000Z | 14.2      | Verified   | 13/13 responsive Modified-files E2E; 5/5 repeated hover stability; 34/21 mixed and 50-file reachability                                                                                                                                                                                                                                                                                                                                                                                                    | [x]   | [ ]   |
| 2026-07-18T17:37:43.000Z | 14.2      | Completed  | two-file compact row, bounded All inventory, collision labels, compound actions, and de-duplicated SDD row                                                                                                                                                                                                                                                                                                                                                                                                 | [x]   | [ ]   |
| 2026-07-18T17:37:43.000Z | 14.3      | Coded      | packages/shared/src/messages.ts, apps/vscode/src/panels/sidebar-panel.ts, host protocol tests                                                                                                                                                                                                                                                                                                                                                                                                              | [x]   | [ ]   |
| 2026-07-18T17:37:43.000Z | 14.3      | Verified   | 17 open-file/Git route cases, 135/135 sidebar tests, 475/475 VS Code tests, real vscode.git/git.openChange extension-host smoke                                                                                                                                                                                                                                                                                                                                                                            | [x]   | [ ]   |
| 2026-07-18T17:37:43.000Z | 14.3      | Completed  | multi-root source resolution, native Git changes, and explicit capability fallbacks                                                                                                                                                                                                                                                                                                                                                                                                                        | [x]   | [ ]   |
| 2026-07-18T17:37:43.000Z | 14.4      | Coded      | apps/chat/e2e/extension-capture.spec.ts, packages/transport/src/mock.ts, apps/vscode-e2e/src/extension.test.ts                                                                                                                                                                                                                                                                                                                                                                                             | [x]   | [ ]   |
| 2026-07-18T17:37:43.000Z | 14.4      | Verified   | pnpm run verify; pnpm run test:e2e:all; pnpm run capture:extension:chat; git diff --check                                                                                                                                                                                                                                                                                                                                                                                                                  | [x]   | [ ]   |
| 2026-07-18T17:37:43.000Z | 14.4      | Completed  | four dedicated review captures under apps/vscode-e2e/artifacts/extension-captures/chat                                                                                                                                                                                                                                                                                                                                                                                                                     | [x]   | [ ]   |
| 2026-07-19T00:22:41.000Z | 15.1      | Coded      | apps/chat/src/components/files-panel.tsx, apps/chat/src/components/files-panel.test.tsx                                                                                                                                                                                                                                                                                                                                                                                                                    | [x]   | [ ]   |
| 2026-07-19T00:22:41.000Z | 15.1      | Verified   | 16/16 files-panel tests; seven-owner fixture, grouping, ordering, dedupe, collision labels, Journal targeting, mixed-status error priority, and Space activation                                                                                                                                                                                                                                                                                                                                           | [x]   | [ ]   |
| 2026-07-19T00:22:41.000Z | 15.2      | Verified   | 14/14 files-strip Playwright; 40/40 transport; Chat typecheck, focused lint/format, and diff-check                                                                                                                                                                                                                                                                                                                                                                                                         | [x]   | [ ]   |
| 2026-07-19T00:22:41.000Z | 15.1-15.2 | Completed  | owner-grouped SDD actions with bounded narrow behavior, error-over-running priority, Space activation, and focus restoration                                                                                                                                                                                                                                                                                                                                                                               | [x]   | [ ]   |
| 2026-07-19T00:48:00.000Z | 15.2      | Verified   | `pnpm verify` 22/22: Chat 500/500, Shared 103/103, VS Code 475/475; build 4/4                                                                                                                                                                                                                                                                                                                                                                                                                              | [x]   | [ ]   |
| 2026-07-19T00:48:00.000Z | 15.2      | Verified   | full E2E: Chat 72/72, Workbench 64 passed + 1 intentional optional-corpus skip, VS Code 31/31; curated capture 2/2                                                                                                                                                                                                                                                                                                                                                                                         | [x]   | [ ]   |
