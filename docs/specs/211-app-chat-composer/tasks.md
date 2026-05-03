---
afx: true
type: TASKS
status: Draft
owner: "@rixrix"
version: "1.1"
created_at: "2026-05-02T23:56:50.000Z"
updated_at: "2026-05-03T14:07:18.000Z"
tags: ["app", "chat", "composer", "webview", "system-command"]
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

- [ ] Run stale-ref search for @see annotations
- [ ] Verify badge visible when draft starts with `!`
- [ ] Verify guard shown for `rm -rf`
- [ ] Verify output renders in timeline

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

| Task | Spec Requirement       | Design Section                |
| ---- | ---------------------- | ----------------------------- |
| 1.1  | [FR-1], [FR-2], [FR-3] | [DES-FILES], [DES-UI]         |
| 2.1  | [FR-2], [FR-4]         | [DES-UI], [DES-TEST]          |
| 4.1  | [FR-9]                 | [DES-API]                     |
| 5.1  | [FR-9]                 | [DES-COMPOSER-SYSTEM-COMMAND] |
| 5.2  | [NFR-6]                | [DES-UI]                      |
| 5.3  | [NFR-6]                | [DES-ERR]                     |
| 5.4  | [FR-9]                 | [DES-COMPOSER-SYSTEM-COMMAND] |
| 5.5  | [FR-9]                 | [DES-COMPOSER-SYSTEM-COMMAND] |
| 6.1  | [FR-9]                 | [DES-TEST]                    |
| 6.2  | [FR-9]                 | [DES-TEST]                    |
| 7.1  | [FR-9], [NFR-6]        | [DES-COMPOSER-TRACE]          |

---

## Notes

- This spec is the starting point for chat box footer instructions.

---

## Work Sessions

<!-- IMPORTANT: This section MUST remain the LAST section in tasks.md. Do not add content below it. -->
<!-- Task execution log — append-only, updated by /afx-task pick, /afx-task code, /afx-task complete -->

| Date       | Task | Action     | Files Modified                                           | Agent | Human |
| ---------- | ---- | ---------- | -------------------------------------------------------- | ----- | ----- |
| 2026-05-02 | 0.1  | Scaffolded | docs/specs/211-app-chat-composer/                        | [x]   | []    |
| 2026-05-03 | 0.2  | Coded      | design.md, apps/chat/src/views/chat.tsx                  | [x]   | []    |
| 2026-05-04 | 4.1  | Picked     | -                                                        | [x]   | []    |
| 2026-05-04 | 4.1  | Coded      | packages/shared/src/messages.ts                          | [x]   | []    |
| 2026-05-04 | 4.1  | Completed  | packages/shared/src/messages.ts                          | [x]   | []    |
| 2026-05-04 | 5.4  | Picked     | -                                                        | [x]   | []    |
| 2026-05-04 | 5.4  | Coded      | sidebar-panel.ts, sidebar-panel.test.ts                  | [x]   | []    |
| 2026-05-04 | 5.4  | Completed  | sidebar-panel.ts, sidebar-panel.test.ts                  | [x]   | []    |
| 2026-05-04 | 5.1  | Picked     | -                                                        | [x]   | []    |
| 2026-05-04 | 5.1  | Coded      | chat.tsx                                                 | [x]   | []    |
| 2026-05-04 | 5.1  | Completed  | chat.tsx                                                 | [x]   | []    |
| 2026-05-04 | 5.2  | Coded      | chat.tsx                                                 | [x]   | []    |
| 2026-05-04 | 5.2  | Completed  | chat.tsx                                                 | [x]   | []    |
| 2026-05-04 | 5.3  | Picked     | -                                                        | [x]   | []    |
| 2026-05-04 | 5.3  | Coded      | chat.tsx, sidebar-panel.ts, messages.ts                  | [x]   | []    |
| 2026-05-04 | 5.3  | Completed  | chat.tsx, sidebar-panel.ts, messages.ts                  | [x]   | []    |
| 2026-05-04 | 5.5  | Picked     | -                                                        | [x]   | []    |
| 2026-05-04 | 5.5  | Coded      | chat.tsx, output-card.tsx                                | [x]   | []    |
| 2026-05-04 | 5.5  | Completed  | chat.tsx, output-card.tsx                                | [x]   | []    |
| 2026-05-04 | 5.5  | Coded      | chat.tsx, output-card.tsx, sidebar-panel.ts, messages.ts | [x]   | []    |
| 2026-05-04 | 5.5  | Coded      | chat.tsx, sidebar-panel.ts                               | [x]   | []    |
| 2026-05-04 | 5.5  | Coded      | chat.tsx                                                 | [x]   | []    |
| 2026-05-04 | 6.1  | Coded      | system-command.ts, system-command.test.ts                | [x]   | []    |
| 2026-05-04 | 6.2  | Coded      | sidebar-panel.test.ts                                    | [x]   | []    |
