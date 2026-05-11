---
afx: true
type: TASKS
status: Living
owner: "@rixrix"
version: "1.3"
created_at: "2026-05-02T23:56:50.000Z"
updated_at: 2026-05-11T08:57:59.901Z
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
```

---

## Cross-Reference Index

| Task | Spec Requirement         | Design Section                                                                                            |
| ---- | ------------------------ | --------------------------------------------------------------------------------------------------------- |
| 1.1  | [FR-1], [FR-2], [FR-3]   | [DES-FILES], [DES-UI]                                                                                     |
| 2.1  | [FR-2], [FR-4]           | [DES-UI], [DES-TEST]                                                                                      |
| 4.1  | [FR-9]                   | [DES-API]                                                                                                 |
| 5.1  | [FR-9]                   | [DES-COMPOSER-SYSTEM-COMMAND]                                                                             |
| 5.2  | [NFR-6]                  | [DES-UI]                                                                                                  |
| 5.3  | [NFR-6]                  | [DES-ERR]                                                                                                 |
| 5.4  | [FR-9]                   | [DES-COMPOSER-SYSTEM-COMMAND]                                                                             |
| 5.5  | [FR-9]                   | [DES-COMPOSER-SYSTEM-COMMAND]                                                                             |
| 6.1  | [FR-9]                   | [DES-TEST]                                                                                                |
| 6.2  | [FR-9]                   | [DES-TEST]                                                                                                |
| 7.1  | [FR-9], [NFR-6]          | [DES-COMPOSER-TRACE]                                                                                      |
| 8.1  | [FR-11]                  | [DES-COMPOSER-CONTEXT]                                                                                    |
| 8.2  | [FR-11], [NFR-7]         | [DES-COMPOSER-CONTEXT]                                                                                    |
| 9.1  | [FR-3]                   | [DES-COMPOSER-COMPONENT-SLASH-POPUP]                                                                      |
| 9.2  | [FR-3]                   | [DES-COMPOSER-COMPONENT-SLASH-POPUP] [DES-COMPOSER-KEYS]                                                  |
| 9.3  | [FR-3]                   | [DES-COMPOSER-MOCKUP-SLASH-FILTER]                                                                        |
| 9.4  | [FR-3]                   | [DES-TEST]                                                                                                |
| 10.1 | [FR-12], [FR-14]         | [DES-COMPOSER-COMPONENT-MODE-TOGGLE]                                                                      |
| 10.2 | [FR-14]                  | [DES-COMPOSER-COMPONENT-MODE-TOGGLE]                                                                      |
| 10.3 | [FR-14]                  | [DES-COMPOSER-COMPONENT-MODE-TOGGLE]                                                                      |
| 11.1 | [FR-13]                  | [DES-COMPOSER-COMPONENT-BLOCKED-COMMAND-STRIP]                                                            |
| 12.1 | [FR-15], [FR-16]         | [DES-COMPOSER-COMPONENT-STRIP]                                                                            |
| 12.2 | [FR-17]                  | [DES-COMPOSER-COMPONENT-STRIP]                                                                            |
| 12.3 | [FR-18]                  | [DES-COMPOSER-COMPONENT-STRIP]                                                                            |
| 12.4 | [FR-19]                  | [DES-COMPOSER-COMPONENT-STRIP]                                                                            |
| 12.5 | [FR-5], [FR-15], [NFR-7] | [DES-COMPOSER-MOCKUP-RUNTIME-MENU] [DES-COMPOSER-COMPONENT-MODEL-COMBOBOX] [DES-COMPOSER-COMPONENT-STRIP] |
| 13.1 | [NFR-5]                  | [DES-COMPOSER-REFS] [DES-COMPOSER-TRACE]                                                                  |
| 13.2 | [NFR-5]                  | [DES-TEST]                                                                                                |

---

## Notes

- This spec is the starting point for chat box footer instructions.

---

## Work Sessions

<!-- IMPORTANT: This section MUST remain the LAST section in tasks.md. Do not add content below it. -->
<!-- Task execution log — append-only, updated by /afx-task pick, /afx-task code, /afx-task complete -->

| Date                     | Task    | Action     | Files Modified                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Agent | Human |
| ------------------------ | ------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 2026-05-02               | 0.1     | Scaffolded | docs/specs/211-app-chat-composer/                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | [x]   | [x]   |
| 2026-05-03               | 0.2     | Coded      | design.md, apps/chat/src/views/chat.tsx                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | [x]   | [x]   |
| 2026-05-04               | 4.1     | Picked     | -                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | [x]   | [x]   |
| 2026-05-04               | 4.1     | Coded      | packages/shared/src/messages.ts                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | [x]   | [x]   |
| 2026-05-04               | 4.1     | Completed  | packages/shared/src/messages.ts                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | [x]   | [x]   |
| 2026-05-04               | 5.4     | Picked     | -                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | [x]   | [x]   |
| 2026-05-04               | 5.4     | Coded      | sidebar-panel.ts, sidebar-panel.test.ts                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | [x]   | [x]   |
| 2026-05-04               | 5.4     | Completed  | sidebar-panel.ts, sidebar-panel.test.ts                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | [x]   | [x]   |
| 2026-05-04               | 5.1     | Picked     | -                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | [x]   | [x]   |
| 2026-05-04               | 5.1     | Coded      | chat.tsx                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | [x]   | [x]   |
| 2026-05-04               | 5.1     | Completed  | chat.tsx                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | [x]   | [x]   |
| 2026-05-04               | 5.2     | Coded      | chat.tsx                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | [x]   | [x]   |
| 2026-05-04               | 5.2     | Completed  | chat.tsx                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | [x]   | [x]   |
| 2026-05-04               | 5.3     | Picked     | -                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | [x]   | [x]   |
| 2026-05-04               | 5.3     | Coded      | chat.tsx, sidebar-panel.ts, messages.ts                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | [x]   | [x]   |
| 2026-05-04               | 5.3     | Completed  | chat.tsx, sidebar-panel.ts, messages.ts                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | [x]   | [x]   |
| 2026-05-05T11:53:21.000Z | 8.1/8.2 | Coded      | apps/chat/src/views/chat.tsx, apps/chat/src/views/settings.tsx, apps/chat/src/lib/settings-snapshot.ts, apps/chat/src/app.test.tsx, apps/chat/src/lib/settings-snapshot.test.ts, packages/shared/src/messages.ts, packages/shared/src/messages.test.ts, apps/vscode/src/panels/sidebar-panel.ts, apps/vscode/src/panels/sidebar-panel.test.ts, apps/vscode/package.json                                                                                                                                    | [x]   | [x]   |
| 2026-05-05T12:03:56.000Z | 8.1/8.2 | Completed  | apps/chat/src/views/chat.tsx, apps/chat/src/views/settings.tsx, apps/chat/src/lib/settings-snapshot.ts, apps/chat/src/app.test.tsx, apps/chat/src/lib/settings-snapshot.test.ts, packages/shared/src/messages.ts, packages/shared/src/messages.test.ts, apps/vscode/src/panels/sidebar-panel.ts, apps/vscode/src/panels/sidebar-panel.test.ts, apps/vscode/package.json                                                                                                                                    | [x]   | [x]   |
| 2026-05-05T12:23:25.000Z | 8.1/8.2 | Coded      | apps/chat/src/views/chat.tsx, docs/specs/211-app-chat-composer/design.md, docs/specs/211-app-chat-composer/spec.md                                                                                                                                                                                                                                                                                                                                                                                         | [x]   | [x]   |
| 2026-05-05T12:27:26.000Z | 8.1/8.2 | Coded      | apps/chat/src/views/chat.tsx, docs/specs/211-app-chat-composer/design.md, docs/specs/211-app-chat-composer/spec.md                                                                                                                                                                                                                                                                                                                                                                                         | [x]   | [x]   |
| 2026-05-05T12:29:44.000Z | 8.1/8.2 | Completed  | apps/chat/src/views/chat.tsx, docs/specs/211-app-chat-composer/design.md, docs/specs/211-app-chat-composer/spec.md, docs/specs/211-app-chat-composer/tasks.md                                                                                                                                                                                                                                                                                                                                              | [x]   | [x]   |
| 2026-05-05T12:33:26.000Z | 8.1/8.2 | Coded      | apps/chat/src/views/chat.tsx, apps/chat/src/components/model-combobox.tsx, apps/chat/src/app.test.tsx, docs/specs/211-app-chat-composer/design.md, docs/specs/211-app-chat-composer/spec.md                                                                                                                                                                                                                                                                                                                | [x]   | [x]   |
| 2026-05-05T13:09:28.000Z | 8.1/8.2 | Coded      | apps/chat/src/views/chat.tsx, apps/chat/package.json, pnpm-lock.yaml                                                                                                                                                                                                                                                                                                                                                                                                                                       | [x]   | [x]   |
| 2026-05-05T13:13:33.000Z | 8.1/8.2 | Coded      | apps/chat/src/views/chat.tsx, apps/chat/src/app.test.tsx                                                                                                                                                                                                                                                                                                                                                                                                                                                   | [x]   | [x]   |
| 2026-05-06T04:37:30.000Z | 8.1/8.2 | Coded      | apps/chat/src/views/chat.tsx, apps/chat/src/app.test.tsx                                                                                                                                                                                                                                                                                                                                                                                                                                                   | [x]   | [x]   |
| 2026-05-06T04:47:55.000Z | 8.1/8.2 | Coded      | apps/chat/src/views/chat.tsx, docs/specs/211-app-chat-composer/tasks.md                                                                                                                                                                                                                                                                                                                                                                                                                                    | [x]   | [x]   |
| 2026-05-06T05:25:34.000Z | 8.1/8.2 | Coded      | apps/chat/src/views/chat.tsx, apps/chat/src/app.test.tsx, docs/specs/211-app-chat-composer/design.md, docs/specs/211-app-chat-composer/tasks.md                                                                                                                                                                                                                                                                                                                                                            | [x]   | [x]   |
| 2026-05-04               | 5.5     | Picked     | -                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | [x]   | [x]   |
| 2026-05-04               | 5.5     | Coded      | chat.tsx, output-card.tsx                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | [x]   | [x]   |
| 2026-05-04               | 5.5     | Completed  | chat.tsx, output-card.tsx                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | [x]   | [x]   |
| 2026-05-04               | 5.5     | Coded      | chat.tsx, output-card.tsx, sidebar-panel.ts, messages.ts                                                                                                                                                                                                                                                                                                                                                                                                                                                   | [x]   | [x]   |
| 2026-05-04               | 5.5     | Coded      | chat.tsx, sidebar-panel.ts                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | [x]   | [x]   |
| 2026-05-04               | 5.5     | Coded      | chat.tsx                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | [x]   | [x]   |
| 2026-05-04               | 6.1     | Coded      | system-command.ts, system-command.test.ts                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | [x]   | [x]   |
| 2026-05-04               | 6.2     | Coded      | sidebar-panel.test.ts                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | [x]   | [x]   |
| 2026-05-06T07:58:27.000Z | 8.1/8.2 | Coded      | apps/chat/src/views/chat.tsx, apps/chat/src/app.test.tsx, docs/specs/211-app-chat-composer/tasks.md                                                                                                                                                                                                                                                                                                                                                                                                        | [x]   | [x]   |
| 2026-05-06T08:03:09.000Z | 8.1/8.2 | Coded      | apps/chat/src/views/chat.tsx, apps/chat/src/app.test.tsx, docs/specs/211-app-chat-composer/tasks.md                                                                                                                                                                                                                                                                                                                                                                                                        | [x]   | [x]   |
| 2026-05-06T08:05:49.000Z | 8.1/8.2 | Coded      | apps/chat/src/views/chat.tsx, apps/chat/src/app.test.tsx, docs/specs/211-app-chat-composer/tasks.md                                                                                                                                                                                                                                                                                                                                                                                                        | [x]   | [x]   |
| 2026-05-06T08:59:51.000Z | 8.1/8.2 | Coded      | apps/chat/src/views/chat.tsx, apps/chat/src/components/model-combobox.tsx, apps/chat/src/app.test.tsx, docs/specs/211-app-chat-composer/design.md, docs/specs/211-app-chat-composer/spec.md, docs/specs/211-app-chat-composer/tasks.md                                                                                                                                                                                                                                                                     | [x]   | [x]   |
| 2026-05-09T13:31:49.000Z | 10.1    | Verified   | apps/chat/src/views/chat.tsx                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | [x]   | [x]   |
| 2026-05-09T13:31:49.000Z | 10.1    | Completed  | apps/chat/src/views/chat.tsx                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | [x]   | [x]   |
| 2026-05-09T13:31:49.000Z | 10.2    | Verified   | apps/chat/src/views/chat.tsx, apps/chat/src/index.css                                                                                                                                                                                                                                                                                                                                                                                                                                                      | [x]   | [x]   |
| 2026-05-09T13:31:49.000Z | 10.2    | Completed  | apps/chat/src/views/chat.tsx, apps/chat/src/index.css                                                                                                                                                                                                                                                                                                                                                                                                                                                      | [x]   | [x]   |
| 2026-05-09T13:31:49.000Z | 10.3    | Verified   | apps/chat/src/views/chat.tsx                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | [x]   | [x]   |
| 2026-05-09T13:31:49.000Z | 10.3    | Completed  | apps/chat/src/views/chat.tsx                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | [x]   | [x]   |
| 2026-05-09T13:31:49.000Z | 11.1    | Verified   | apps/chat/src/views/chat.tsx, apps/chat/src/app.test.tsx                                                                                                                                                                                                                                                                                                                                                                                                                                                   | [x]   | [x]   |
| 2026-05-09T13:31:49.000Z | 11.1    | Completed  | apps/chat/src/views/chat.tsx, apps/chat/src/app.test.tsx                                                                                                                                                                                                                                                                                                                                                                                                                                                   | [x]   | [x]   |
| 2026-05-09T13:31:49.000Z | 12.1    | Verified   | apps/chat/src/components/chat-doc-actions-strip.tsx, apps/chat/src/components/chat-doc-actions-strip.test.tsx                                                                                                                                                                                                                                                                                                                                                                                              | [x]   | [x]   |
| 2026-05-09T13:31:49.000Z | 12.1    | Completed  | apps/chat/src/components/chat-doc-actions-strip.tsx, apps/chat/src/components/chat-doc-actions-strip.test.tsx                                                                                                                                                                                                                                                                                                                                                                                              | [x]   | [x]   |
| 2026-05-09T13:31:49.000Z | 12.2    | Verified   | apps/chat/src/components/chat-doc-actions-strip.tsx                                                                                                                                                                                                                                                                                                                                                                                                                                                        | [x]   | [x]   |
| 2026-05-09T13:31:49.000Z | 12.2    | Completed  | apps/chat/src/components/chat-doc-actions-strip.tsx                                                                                                                                                                                                                                                                                                                                                                                                                                                        | [x]   | [x]   |
| 2026-05-09T13:31:49.000Z | 12.3    | Verified   | apps/chat/src/components/chat-doc-actions-strip.tsx, apps/chat/src/components/memory-dropdown.tsx, apps/chat/src/components/chat-memory-menu-button.tsx, apps/chat/src/lib/doc-actions.ts                                                                                                                                                                                                                                                                                                                  | [x]   | [x]   |
| 2026-05-09T13:31:49.000Z | 12.3    | Completed  | apps/chat/src/components/chat-doc-actions-strip.tsx, apps/chat/src/components/memory-dropdown.tsx, apps/chat/src/components/chat-memory-menu-button.tsx, apps/chat/src/lib/doc-actions.ts                                                                                                                                                                                                                                                                                                                  | [x]   | [x]   |
| 2026-05-09T13:31:49.000Z | 12.4    | Verified   | apps/chat/src/components/chat-doc-actions-strip.tsx                                                                                                                                                                                                                                                                                                                                                                                                                                                        | [x]   | [x]   |
| 2026-05-09T13:31:49.000Z | 12.4    | Completed  | apps/chat/src/components/chat-doc-actions-strip.tsx                                                                                                                                                                                                                                                                                                                                                                                                                                                        | [x]   | [x]   |
| 2026-05-09T13:40:25.000Z | 9.1     | Coded      | apps/chat/src/components/slash-popup.tsx, apps/chat/src/views/chat.tsx                                                                                                                                                                                                                                                                                                                                                                                                                                     | [x]   | [x]   |
| 2026-05-09T13:40:25.000Z | 9.1     | Completed  | apps/chat/src/components/slash-popup.tsx, apps/chat/src/views/chat.tsx                                                                                                                                                                                                                                                                                                                                                                                                                                     | [x]   | [x]   |
| 2026-05-09T13:43:10.000Z | 9.2     | Coded      | apps/chat/src/views/chat.tsx                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | [x]   | [x]   |
| 2026-05-09T13:43:10.000Z | 9.2     | Completed  | apps/chat/src/views/chat.tsx                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | [x]   | [x]   |
| 2026-05-09T13:46:09.000Z | 9.3     | Coded      | apps/chat/src/components/slash-popup.tsx                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | [x]   | [x]   |
| 2026-05-09T13:46:09.000Z | 9.3     | Completed  | apps/chat/src/components/slash-popup.tsx                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | [x]   | [x]   |
| 2026-05-09T13:50:37.000Z | 9.4     | Coded      | apps/chat/src/components/slash-popup.test.tsx                                                                                                                                                                                                                                                                                                                                                                                                                                                              | [x]   | [x]   |
| 2026-05-09T13:50:37.000Z | 9.4     | Completed  | apps/chat/src/components/slash-popup.test.tsx                                                                                                                                                                                                                                                                                                                                                                                                                                                              | [x]   | [x]   |
| 2026-05-09T13:55:29.000Z | 13.1    | Coded      | apps/chat/src/views/chat.tsx, apps/chat/src/components/markdown-message.tsx                                                                                                                                                                                                                                                                                                                                                                                                                                | [x]   | [x]   |
| 2026-05-09T13:55:29.000Z | 13.1    | Completed  | apps/chat/src/views/chat.tsx, apps/chat/src/components/markdown-message.tsx                                                                                                                                                                                                                                                                                                                                                                                                                                | [x]   | [x]   |
| 2026-05-09T14:07:38.000Z | 13.2    | Verified   | apps/chat/src/views/chat.tsx, docs/specs/211-app-chat-composer/tasks.md                                                                                                                                                                                                                                                                                                                                                                                                                                    | [x]   | [x]   |
| 2026-05-09T14:07:38.000Z | 13.2    | Completed  | apps/chat/src/views/chat.tsx, docs/specs/211-app-chat-composer/tasks.md                                                                                                                                                                                                                                                                                                                                                                                                                                    | [x]   | [x]   |
| 2026-05-09T14:14:33.000Z | 12.1    | Coded      | apps/chat/src/components/result-actions.tsx, apps/chat/src/components/result-actions.test.tsx, apps/chat/src/views/chat.tsx, apps/chat/src/app.test.tsx, apps/chat/e2e/spec-mode.spec.ts, docs/specs/211-app-chat-composer/spec.md, docs/specs/211-app-chat-composer/design.md, docs/specs/211-app-chat-composer/tasks.md                                                                                                                                                                                  | [x]   | [x]   |
| 2026-05-11T08:40:29.000Z | 12.5    | Coded      | apps/chat/src/components/model-combobox.tsx, apps/chat/src/components/model-combobox.test.tsx, apps/chat/src/components/chat-memory-menu-button.tsx, apps/chat/src/components/composer-strip.tsx, apps/chat/src/components/chat-doc-actions-strip.tsx, apps/chat/src/components/chat-doc-actions-strip.test.tsx, apps/chat/src/views/chat.tsx, apps/chat/src/app.test.tsx, docs/specs/211-app-chat-composer/spec.md, docs/specs/211-app-chat-composer/design.md, docs/specs/211-app-chat-composer/tasks.md | [x]   | [x]   |
| 2026-05-11T08:53:28.000Z | 12.5    | Verified   | pnpm verify:full                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | [x]   | [x]   |
