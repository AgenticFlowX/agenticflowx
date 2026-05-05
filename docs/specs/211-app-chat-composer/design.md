---
afx: true
type: DESIGN
status: Approved
owner: "@rixrix"
version: "1.1"
created_at: "2026-05-02T23:56:50.000Z"
updated_at: "2026-05-05T07:29:30.000Z"
approved_at: "2026-05-05T07:29:30.000Z"
tags: ["app", "chat", "composer", "webview"]
spec: spec.md
---

<!-- APPROVED: 2026-05-05T07:29:30.000Z - Do not edit without version bump -->

# App Chat Composer - Technical Design

---

## [DES-OVR] Overview

The composer is the bottom interaction surface of the chat webview. It coordinates local input state, runtime readiness, queued content, helper popups, and bridge-driven send/steer/abort actions.

System commands (FR-9) extend the composer with local shell execution: typing `!ls` and pressing Enter dispatches `chat/runCommand` instead of `chat/send`, executes the command in the extension host via `child_process.spawn`, and streams output back via `agent/commandOutput` events. UX uses an amber "Shell" badge and persistent footer warning (not blocking); a dangerous-pattern guard prompts confirmation for `rm -rf`, `del /f /s`, `format`, `mkfs`, `dd`.

---

## [DES-ARCH] Architecture

```text
Chat view state
  ├─ composer input and keyboard policy
  ├─ helper popups: slash and mention
  ├─ controls: model, thinking, send, steer, abort
  ├─ queue/footer/activity rendering
  └─ transport bridge messages to VSCode host
  └─ system command execution (! prefix → child_process.spawn)
```

Composer logic stays in the chat webview. The VSCode extension host owns command execution and runtime services. Shell commands are executed in a separate context from the LLM stream, enabling concurrent execution.

## [DES-COMPOSER-FLOW] Composer Event And Bridge Flow

```text
[Composer.Input] draft/keyboard/helper state
  -> submit/save/abort/select handlers in Chat
  -> bridgeSend(...)
  -> @afx/transport webview bridge
  -> VSCode SidebarPanel.dispatchInbound
  -> AgentManager or host service
  -> HostToChat events rehydrate Chat state
```

| Flow                | Source anchor                                     | Bridge message                  | Host/runtime result                    | Returned state                                                              |
| ------------------- | ------------------------------------------------- | ------------------------------- | -------------------------------------- | --------------------------------------------------------------------------- |
| Idle send           | `submit({ followUp: false })` when `!isStreaming` | `chat/send`                     | Starts a user turn                     | `chat/messageStart`, `chat/messageDelta`, `chat/messageEnd`, `agent/status` |
| Streaming follow-up | `submit({ followUp: true })`                      | `chat/followUp`                 | Queues content after active turn       | Local `queued` mirror plus future stream state                              |
| Streaming steer     | `submit({ followUp: false })` while streaming     | `chat/steer`                    | Interrupts/redirects active turn       | Local `queued` mirror plus runtime stream state                             |
| Abort               | `abort()`                                         | `chat/abort`                    | Stops active run                       | `chat/aborted`, `agent/status`                                              |
| Save note           | `saveAsNote()`                                    | `chat/saveNote`                 | Host appends note                      | Local note event plus note bridge result                                    |
| Slash action        | `selectSlashAction()`                             | `chat/newSession`, `chat/abort` | Host action without textarea insertion | New session/abort events                                                    |
| Mention picker      | `handleDraftChange()`, `openMentionPicker()`      | `chat/listFiles`                | Host lists recent/workspace files      | `agent/files`                                                               |
| Slash picker        | mount hydration                                   | `chat/getCommands`              | Host lists agent/extension commands    | `agent/commands`                                                            |
| Model picker        | `selectModel()`                                   | `chat/setModel`                 | Runtime default/model changes          | `agent/modelChanged`                                                        |
| Thinking picker     | `setThinkingLevel()`                              | `chat/setThinkingLevel`         | Runtime effort changes                 | `agent/runtimeSettings`                                                     |
| System command      | `submit()` when draft starts with `!`             | `chat/runCommand`               | Spawns shell in workspace root         | `agent/commandOutput` (delta / done / error)                                |

---

## [DES-UI] User Interface & UX

The composer must keep the primary action obvious while showing runtime readiness and queue state in compact footer copy. Keyboard instructions should be state-aware and avoid generic prompts when the runtime is unavailable or content is queued.

## [DES-COMPOSER-MOCKUPS] Composer ASCII UI State Mockups

### [DES-COMPOSER-MOCKUP-IDLE] Idle Ready State

The idle state renders one primary send action and keeps model/thinking controls compact enough for the VS Code side panel.

```text
+--------------------------------------------------------------------+
| [Composer.Activity]  dot idle  AFX ready                           |
+--------------------------------------------------------------------+
| [Composer.InputGroup]                                              |
|  [@] [Composer.Input: Ask AFX about this workspace ...]        [^] |
|      [Composer.Model: Anthropic . Claude] [Thinking: Medium]       |
+--------------------------------------------------------------------+
| [Composer.Footer] Pi/API status . usage . "Enter send . Cmd+Shift" |
+--------------------------------------------------------------------+
```

### [DES-COMPOSER-MOCKUP-STREAMING] Streaming Queued State

The streaming state replaces the single send action with follow-up, steer, and stop controls while showing local queued mirrors above the input group.

```text
+--------------------------------------------------------------------+
| [Composer.Activity]  pulsing dot  thinking: reading specs...          |
+--------------------------------------------------------------------+
| [Composer.Queue] Queued . 2                         [Clear all] [v]   |
|   [steer] -> tighten footer copy                                      |
|   [follow-up] 1. then update tests                                    |
+--------------------------------------------------------------------+
| [Composer.InputGroup]                                                 |
|  [@] [Composer.Input: Queue a follow-up... (Cmd+Enter to steer)]      |
|      [Composer.Model] [Thinking]         [Follow-up] [Steer] [Stop]   |
+--------------------------------------------------------------------+
| [Composer.Footer] streaming hint . Pi pill . token/cost tooltip       |
+--------------------------------------------------------------------+
```

### [DES-COMPOSER-MOCKUP-UNAVAILABLE] Runtime Unconfigured Or Unavailable

The unavailable state disables composer input/actions and uses placeholder/footer copy to route the user toward Settings or runtime recovery.

```text
+--------------------------------------------------------------------+
| [Composer.Activity]  disconnected / waiting                           |
+--------------------------------------------------------------------+
| [Composer.InputGroup disabled]                                        |
|  Configure an API provider or enable Pi RPC to continue...            |
|      [@ disabled] [Composer.Model disabled]                 [Send off] |
+--------------------------------------------------------------------+
| [Composer.Footer] "Configure provider or fix Pi RPC in Settings"      |
+--------------------------------------------------------------------+
```

### [DES-COMPOSER-MOCKUP-SYSTEM-COMMAND] System Command Active State

The "Shell" amber pill badge replaces the `@` mention button and the model/thinking labels shift to accommodate it. The footer shows a persistent warning `"⚠ Shell · output is local only"`. These cues are visible while the draft starts with `!` and do not block execution.

```text
+--------------------------------------------------------------------+
| [Composer.Activity]  dot idle  AFX ready                           |
+--------------------------------------------------------------------+
| [Composer.InputGroup]                                              |
|  [Shell] [!] [Composer.Input: pnpm build]                     [^]   |
|      ⚠ Shell · output is local only                               |
|      [Composer.Model: Anthropic . Claude] [Thinking: Medium]       |
+--------------------------------------------------------------------+
| [Composer.Footer] Pi/API status . usage . "Enter send . Cmd+Shift" |
+--------------------------------------------------------------------+
```

### [DES-COMPOSER-MOCKUP-DANGEROUS-GUARD] Dangerous Pattern Confirm Dialog

Triggered when the command matches known destructive patterns (`rm -rf`, `del /f /s`, `format`, `mkfs`, `dd`). Requires explicit user acknowledgment before execution. Not shown for safe commands.

```text
+--------------------------------------------------------------------+
|  ⚠  Destructive command detected                                  |
+--------------------------------------------------------------------+
|  "rm -rf" will delete files in the workspace.                     |
|                                                                     |
|                                    [Cancel]  [Run anyway]          |
+--------------------------------------------------------------------+
```

## [DES-COMPOSER-COMPONENTS] Composer Component And Control Anatomy

```text
Chat
  StatusBar                    -> parent chat/runtime action strip, not composer-owned
  Timeline / EmptyState         -> message zone, composer inserts quick-command text only
  ComposerRoot
    ActivityBar                 -> [Composer.Activity]
    SlashPopup                  -> [Composer.Helpers.Slash]
    MentionPopup                -> [Composer.Helpers.Mention]
    QueueStrip                  -> [Composer.Queue]
      ComposerStrip             -> reusable chrome for collapsible strips
      QueueRow                  -> steer/follow-up row, local mirror only
    InputGroup                  -> [Composer.InputGroup]
      InputGroupTextarea        -> [Composer.Input]
      Toolbar
        mention button          -> opens MentionPopup and lists files
        ModelCombobox           -> API/external model selector
        ThinkingLevelToggle     -> runtime thinking dropdown
      Actions
        Send                    -> idle send
        Follow-up               -> streaming follow-up
        Steer                   -> streaming interrupt
        Stop                    -> abort active turn
    FooterStrip                 -> [Composer.Footer]
```

| Surface               | Owned behavior                                                             | Not owned here                        |
| --------------------- | -------------------------------------------------------------------------- | ------------------------------------- |
| `[Composer.Activity]` | Live thinking preview and idle/busy strip above composer                   | Full timeline thinking blocks         |
| `[Composer.Queue]`    | Local display of messages already sent as steer/follow-up                  | Engine-authoritative queue scheduling |
| `[Composer.Input]`    | Draft text, placeholder, keyboard routing, prompt-history recall           | Message timeline rendering            |
| `[Composer.Helpers]`  | Slash/mention trigger detection, picker display, insertion/action dispatch | Command implementation in host        |
| `[Composer.Toolbar]`  | Mention button, model selector, thinking level selector                    | Provider setup forms                  |
| `[Composer.Actions]`  | Send/follow-up/steer/stop affordances                                      | Agent implementation                  |
| `[Composer.Footer]`   | Compact runtime readiness, Pi state, usage hints                           | Full settings diagnostics             |

## [DES-COMPOSER-SYSTEM-COMMAND] System Command Execution

<!-- @see spec.md [FR-9] [NFR-6] -->

This section details the end-to-end system command flow: client-side prefix detection, bridge dispatch, extension-host execution via `child_process.spawn`, output streaming back to the webview, and rendering as a timeline card.

### Flow: Prefix Detection → Bridge → Host → Spawn → Stream → Render

```text
[Composer.Input] "!ls -la src/"
  -> onKeyDown Enter
  -> submit()
  -> draft.startsWith("!") detected
  -> bridgeSend({ type: "chat/runCommand", requestId, command: "ls -la src/" })
  -> @afx/transport webview bridge
  -> VSCode SidebarPanel.dispatchInbound: case "chat/runCommand"
  -> handleRunCommand(requestId, "ls -la src/")
  -> child_process.spawn(shell, ["-c", "ls -la src/"], { cwd: workspaceRoot, timeout: 30000 })
  -> stdout "drwxr-xr-x ...\n" -> emit({ type: "agent/commandOutput", streamId, delta: "..." })
  -> stderr "" -> emit done
  -> exitCode 0 -> emit({ type: "agent/commandOutput", done: true, exitCode: 0 })
  -> chat.tsx bridgeOn("agent/commandOutput")
  -> <OutputCard> rendered in message timeline
```

### Step-by-step responsibilities

| Step             | Who                                          | What                                                                                            |
| ---------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Draft input      | User                                         | Types `!ls -la src/` in composer                                                                |
| Prefix detection | `chat.tsx` `submit()`                        | `draft.trim().startsWith("!")` — client-side, before any bridge call                            |
| Bridge dispatch  | `chat.tsx` `bridgeSend()`                    | Sends `{ type: "chat/runCommand", requestId, command }`; **`!` is stripped**; never sent to LLM |
| Bridge reception | `sidebar-panel.ts` `dispatchInbound`         | Switches on `"chat/runCommand"` case                                                            |
| Shell execution  | `sidebar-panel.ts` `handleRunCommand()`      | `child_process.spawn()` with platform shell, workspace CWD, 30s timeout                         |
| Output streaming | `sidebar-panel.ts` → `transport.emit()`      | Streams `agent/commandOutput { delta, done, exitCode, error }` back to webview                  |
| Timeline render  | `chat.tsx` `bridgeOn("agent/commandOutput")` | `<OutputCard>` shows monospace stdout (muted), stderr (red), exit badge (amber)                 |

### Client-side prefix detection (snippet)

```typescript
// apps/chat/src/views/chat.tsx — submit()
function submit(opts?: { followUp?: boolean }) {
  const trimmed = draft.trim();
  if (trimmed.length === 0 || isCheckingAgent || runtimeUnavailable) return;

  // System command: bypass LLM entirely
  if (trimmed.startsWith("!")) {
    const command = trimmed.slice(1).trimStart();
    const dangerous = /^(rm\s+-rf|del\s+.*\/f|format\s|mkfs|dd\s)/i.test(command);
    if (dangerous) {
      // Show DangerousPatternGuard confirm dialog
      return;
    }
    bridgeSend({ type: "chat/runCommand", requestId: uid(), command });
    onDraftChange("");
    return;
  }

  // Normal LLM path
  bridgeSend({ type: "chat/send", requestId: uid(), content: trimmed, mentions: mentionsArg });
  // ...
}
```

### Extension host shell execution (snippet)

```typescript
// apps/vscode/src/panels/sidebar-panel.ts — handleRunCommand()
import { spawn } from "child_process";
import * as vscode from "vscode";

async function handleRunCommand(requestId: string, command: string): Promise<void> {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspaceRoot) {
    bridgeSend({ type: "agent/commandOutput", requestId, error: "No workspace folder open" });
    return;
  }

  const shell = process.platform === "win32" ? "cmd" : "/bin/bash";
  const shellArgs = process.platform === "win32" ? ["/c", command] : ["-c", command];
  const proc = spawn(shell, shellArgs, { cwd: workspaceRoot, timeout: 30_000 });

  proc.stdout.on("data", (chunk: Buffer) => {
    bridgeSend({
      type: "agent/commandOutput",
      requestId,
      streamId: requestId,
      delta: chunk.toString(),
    });
  });
  proc.stderr.on("data", (chunk: Buffer) => {
    bridgeSend({
      type: "agent/commandOutput",
      requestId,
      streamId: requestId,
      delta: chunk.toString(),
    });
  });

  proc.on("close", (code: number | null) => {
    bridgeSend({ type: "agent/commandOutput", requestId, done: true, exitCode: code ?? -1 });
  });
  proc.on("error", (err: Error) => {
    bridgeSend({ type: "agent/commandOutput", requestId, error: err.message });
  });
}
```

### Output card rendering (snippet)

```typescript
// apps/chat/src/views/chat.tsx
function OutputCard({ streamId, lines, exitCode, error }: OutputCardProps) {
  return (
    <div className="border border-afx-border rounded-md p-3 font-mono text-sm">
      {error ? (
        <p className="text-red-500">{error}</p>
      ) : (
        <>
          {lines.map((l, i) => (
            <p key={i} className={l.kind === "stderr" ? "text-red-500" : "text-afx-muted"}>
              {l.text}
            </p>
          ))}
          {exitCode != null && (
            <span className="inline-block mt-2 px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 text-xs">
              exit {exitCode}
            </span>
          )}
        </>
      )}
    </div>
  );
}
```

### Bypass LLM guarantee

System commands **never reach the LLM**. The `!` prefix is detected before any `bridgeSend({ type: "chat/send" })`. The client dispatches `chat/runCommand` instead, which the extension host handles entirely in the VSCode process without forwarding to the agent runtime.

### [DES-COMPOSER-COMPONENT-MODEL-COMBOBOX] ModelCombobox

| Code anchor               | Component contract                                                                                  |
| ------------------------- | --------------------------------------------------------------------------------------------------- |
| `ModelCombobox`           | Owns composer model picker chrome, selected trigger label, popover grouping, and Settings fallback  |
| `groupModels`             | Splits API-provider models from external-agent models and sorts both groups by provider/instance id |
| `renderModelItem`         | Shows display name, raw model id, and compact context window                                        |
| `isSameModel`             | Uses provider, id, and instance id so API and external models do not collide                        |
| `formatModelTriggerLabel` | Displays runtime/provider label plus model name in the narrow toolbar trigger                       |

### [DES-COMPOSER-COMPONENT-SLASH-POPUP] SlashPopup

| Code anchor          | Component contract                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------------------ |
| `SlashPopup`         | Owns command popover placement, command groups, empty state, and action group                          |
| `SlashAction`        | Only host actions that bypass textarea insertion: `chat/newSession`, `chat/abort`                      |
| `CommandRow`         | Renders command name and optional description as a selectable cmdk row                                 |
| `displayCommandName` | Converts skill ids like `skill:afx-task` to `/afx-task` and normalizes plain commands with leading `/` |

### [DES-COMPOSER-COMPONENT-MENTION-POPUP] MentionPopup

| Code anchor             | Component contract                                                                              |
| ----------------------- | ----------------------------------------------------------------------------------------------- |
| `MentionPopup`          | Owns file mention popover placement, filter input, empty state, and recent/workspace grouping   |
| `FileRow`               | Renders one `AgentFileView` path with recent/workspace icon and passes the selected path upward |
| `detectComposerTrigger` | Decides when the popup should open based on current caret/token state                           |
| `insertAtTrigger`       | Performs the actual text replacement in the parent `Chat` component                             |

### [DES-COMPOSER-COMPONENT-STRIP] ComposerStrip And Queue Rows

| Code anchor     | Component contract                                                                                    |
| --------------- | ----------------------------------------------------------------------------------------------------- |
| `ComposerStrip` | Generic collapsible strip chrome above the composer; visibility is controlled by parent mount/unmount |
| `QueueStrip`    | Composer-owned queue container that separates steer rows from follow-up rows                          |
| `QueueRow`      | Renders one local queue mirror row and dismiss button; dismissal does not cancel engine work          |

## [DES-COMPOSER-KEYS] Keyboard, Draft, And Trigger Policy

| Input state                                | Key/gesture                | Source anchor                                | Behavior                                                                            |
| ------------------------------------------ | -------------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------- |
| Slash/mention popup open                   | `Escape`                   | `onKeyDown`                                  | Close both helper popups and keep draft                                             |
| Slash/mention popup open                   | Arrow/Home/End/plain Enter | `onKeyDown`                                  | Forward keydown to `[cmdk-root]`; plain Enter selects helper item                   |
| Textarea at start or history cursor active | `ArrowUp`/`ArrowDown`      | `navigatePromptHistory`, `applyHistoryDraft` | Recall prior submitted/user prompts and restore original draft on forward traversal |
| Idle composer                              | `Enter`                    | `onKeyDown`, `submit`                        | Send `chat/send`                                                                    |
| Idle composer                              | `Shift+Enter`              | `onKeyDown`                                  | Insert newline                                                                      |
| Idle composer                              | `Cmd/Ctrl+Enter`           | `onKeyDown`, `submit`                        | Compatibility send                                                                  |
| Streaming composer                         | `Enter`                    | `onKeyDown`, `submit({ followUp: true })`    | Queue polite follow-up                                                              |
| Streaming composer                         | `Cmd/Ctrl+Enter`           | `onKeyDown`, `submit({ followUp: false })`   | Steer active turn                                                                   |
| Any composer                               | `Cmd/Ctrl+Shift+Enter`     | `saveAsNote`                                 | Send `chat/saveNote` and add local note event                                       |
| Mention button                             | click                      | `openMentionPicker`                          | Open mention picker at draft end and request `chat/listFiles`                       |
| Composer with `!` prefix                   | `Enter`                    | `submit()` → `chat/runCommand`               | Strip `!`, exec locally in extension host via `child_process.spawn`                 |

## [DES-COMPOSER-HELPERS] Slash And Mention Helper Anatomy

```text
[Composer.Helpers.Slash]
draft before caret -> detectComposerTrigger("/", not inside fence, slash at command position)
  -> SlashPopup
     AFX skills group
     Other commands group
     Actions: /new, /abort
  -> selectCommand inserts text OR selectSlashAction dispatches host message

[Composer.Helpers.Mention]
draft before caret -> detectComposerTrigger("@", not escaped, not inside fence)
  -> chat/listFiles
  -> MentionPopup
     Recently opened
     Workspace
  -> selectMention inserts @path at trigger range
```

| Function/component      | Functionality                                                                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `detectComposerTrigger` | Finds `/` or `@` token before the caret, rejects fenced code blocks, escaped mentions, and slash commands that are not at command position |
| `extractMentions`       | Extracts unique `@path` mentions from sent content, strips trailing punctuation, and passes `mentions` to host send/queue messages         |
| `insertAtTrigger`       | Replaces the active trigger range with command or `@file` text, appends a space, and restores caret/focus                                  |
| `SlashPopup`            | Renders command groups from `AgentCommand`, formats AFX skills as slash commands, and distinguishes host actions from text insertions      |
| `MentionPopup`          | Splits files into recent/workspace groups and inserts the chosen path                                                                      |

## [DES-COMPOSER-RUNTIME] Model, Thinking, And Runtime Control Map

| Control             | Source anchor                | Data                                                   | Behavior                                                               |
| ------------------- | ---------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------- |
| Model trigger       | `ModelCombobox`              | `AgentModel[]`, active `agentStatus.model`             | Groups API models by provider and external-agent models by instance    |
| Empty model list    | `ModelCombobox`              | no `models`                                            | Offers Settings fallback instead of showing a dead picker              |
| Model item          | `renderModelItem`            | `name`, `id`, `contextWindow`                          | Shows compact display name and context window                          |
| Model select        | `selectModel`                | `provider`, `id`, `instanceId`                         | Sends `chat/setModel`, resets prompt-history cursor, focuses textarea  |
| Thinking trigger    | `ThinkingLevelToggle`        | `ThinkingLevel`                                        | Sends `chat/setThinkingLevel` and optimistically updates runtime state |
| Runtime unavailable | `canSend`, placeholder logic | `agentStatus.phase`, `runtimeConfigured`, `rpcEnabled` | Disables textarea/actions and routes user to setup copy                |

## [DES-COMPOSER-QUEUE] Queue Strip Behavior

| Queue state     | Source anchor                         | UI/functionality                                                       |
| --------------- | ------------------------------------- | ---------------------------------------------------------------------- |
| No queued items | `QueueStrip`                          | Returns `null`; composer layout collapses naturally                    |
| Steer items     | `QueueStrip`, `QueueRow`              | Render before follow-ups with `Zap` icon and arrow/ordinal marker      |
| Follow-up items | `QueueStrip`, `QueueRow`              | Render after steer items with `CornerDownLeft` icon and ordinal marker |
| Clear all       | `clearAllQueued`                      | Removes local mirror rows only; content may already be in engine queue |
| Dismiss row     | `dismissQueued`                       | Hides local mirror row only and explains it was already sent to engine |
| Debug injection | dev `afx:debug:inject-queue` listener | Allows visual iteration without manually queueing content              |

## [DES-COMPOSER-STATE-MACHINE] Composer State Machine

The composer transitions between five states. State transitions are driven by `agentStatus.phase`,
`isStreaming`, and local input state.

```text
                +----------------+
                |  unavailable   |  (rpc + provider both off)
                +-------+--------+
                        ^
        runtimeOff      |    runtimeReady
                        v
+----------+   focus  +-------+   submit   +-----------+
|  empty   +--------->| idle  +----------->| streaming |
+----------+          +---+---+            +-----+-----+
   ^                      ^                       |
   | clear                | typing                | followUp
   |                      v                       v
   |                  +-------+              +-----------+
   +------------------+typing |              |  queued   |
                      +-------+              +-----------+
```

| State         | Visible cue                                                           | Allowed actions                                |
| ------------- | --------------------------------------------------------------------- | ---------------------------------------------- |
| `unavailable` | Disabled controls + setup copy in `[DES-COMPOSER-MOCKUP-UNAVAILABLE]` | Open settings only                             |
| `empty`       | Placeholder text, send disabled                                       | Type to enter `typing`                         |
| `typing`      | Active draft, send enabled when non-empty                             | Submit, slash/mention triggers, history recall |
| `idle`        | Steady state, no streaming                                            | Submit (transitions to `streaming`)            |
| `streaming`   | Stop / Steer / Follow-up actions visible                              | Steer, follow-up (queue), abort                |
| `queued`      | Local mirror rows shown above input (queued for after current turn)   | Add more, dismiss row, clear all               |

## [DES-COMPOSER-FOOTER] Activity And Footer Copy Matrix

| State input                | Source anchor                   | User-facing result                                                 |
| -------------------------- | ------------------------------- | ------------------------------------------------------------------ |
| `thinking` + `isStreaming` | `ActivityBar`                   | Shows first 120 characters as live thinking preview                |
| Idle/no thinking           | `ActivityBar`                   | Shows compact idle strip without consuming message timeline space  |
| `usage` present            | `FooterStrip`, `usageTooltip`   | Shows token/cost/context tooltip with only meaningful values       |
| Runtime checking           | `FooterStrip`                   | Explains the agent runtime is still handshaking                    |
| Runtime unconfigured       | `FooterStrip`                   | Routes user toward provider/Pi setup copy                          |
| Runtime unavailable        | `FooterStrip`, Pi warning click | Surfaces recovery/settings affordance without full-screen takeover |
| Streaming                  | `FooterStrip`                   | Shows follow-up/steer keyboard hint before idle send/note hints    |

---

## [DES-DEC] Key Decisions

| Decision                | Options Considered                            | Choice                  | Rationale                                                                             |
| ----------------------- | --------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------- |
| Composer split          | Keep in `210-app-chat`, create child spec     | Child spec              | Footer/input changes are frequent and surgical                                        |
| Footer ownership        | Settings, runtime, composer                   | Composer                | Footer copy appears in composer and depends on composer actions                       |
| Helper ownership        | Shared UI, messages, composer                 | Composer                | Slash/mention helpers are input-driven                                                |
| System command routing  | Client detection, server detection            | Client detection        | Webview knows the draft text; extension host executes                                 |
| Shell selection         | Hardcoded `bash`, detect `$SHELL`, prompt     | Platform-aware spawn    | `bash` on macOS/Linux, `cmd`/`powershell` on Windows                                  |
| Concurrent execution    | Block while streaming, queue, allow           | Allow                   | Separate execution context from LLM stream; user can run `!top` while LLM writes code |
| Dangerous-pattern guard | Block all, allow all, confirm for destructive | Confirm for destructive | Catches common accidents (`rm -rf`) without blocking safe commands                    |

---

## [DES-DATA] Data Model

Composer state includes input text, queued content metadata, selected model, thinking level, runtime readiness, busy/sending state, helper popup candidates, prompt-history cursor state, usage stats, and ephemeral note confirmations.

| Data shape        | Source anchor                      | Purpose                                                                                                      |
| ----------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `RuntimeSettings` | `chat.tsx`                         | Composer-visible subset of `AgentStatus` for thinking, queue modes, compaction/retry, session, and RPC state |
| `QueuedMessage`   | `chat.tsx`                         | Local display mirror for steer/follow-up content that was already sent while streaming                       |
| `UsageStats`      | `chat.tsx`                         | Footer tooltip and assistant metadata token/cost/context display                                             |
| `ComposerTrigger` | `composer-detect.ts`               | Active slash/mention token location and query                                                                |
| `AgentCommand`    | `SlashPopup`, `displayCommandName` | Slash command list and action labels                                                                         |
| `AgentFileView`   | `MentionPopup`                     | Mention candidate list split by recent/workspace                                                             |
| `AgentModel`      | `ModelCombobox`                    | API/external model groups and selection identity                                                             |

---

## [DES-API] API Contracts

Composer actions use the chat webview transport. Message payloads are defined in shared packages; this spec owns how those payloads are surfaced in the composer.

| Direction       | Message/event                           | Composer owner                                                                                                                       |
| --------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Webview to host | `chat/send`                             | Idle send with content and extracted mentions                                                                                        |
| Webview to host | `chat/steer`                            | Streaming interrupt with content and extracted mentions                                                                              |
| Webview to host | `chat/followUp`                         | Streaming follow-up with content and extracted mentions                                                                              |
| Webview to host | `chat/abort`                            | Stop active turn                                                                                                                     |
| Webview to host | `chat/saveNote`                         | Save draft as note via note capture spec                                                                                             |
| Webview to host | `chat/getCommands`                      | Populate slash popup                                                                                                                 |
| Webview to host | `chat/listFiles`                        | Populate mention popup                                                                                                               |
| Webview to host | `chat/setModel`                         | Update active runtime model                                                                                                          |
| Webview to host | `chat/setThinkingLevel`                 | Update runtime reasoning effort                                                                                                      |
| Webview to host | `chat/runCommand`                       | System command: stripped `!` prefix, shell command string, requestId                                                                 |
| Host to webview | `agent/commandOutput`                   | Shell output stream: `requestId`, `streamId`, `delta` (partial line), `done` (final), `exitCode` (0–255), `error` (exception string) |
| Host to webview | `agent/commands`                        | Slash popup candidates                                                                                                               |
| Host to webview | `agent/files`                           | Mention popup candidates                                                                                                             |
| Host to webview | `agent/models`, `agent/modelChanged`    | Model picker candidates and active model                                                                                             |
| Host to webview | `agent/runtimeSettings`, `agent/status` | Thinking/footer/readiness state                                                                                                      |
| Host to webview | `chat/usage`                            | Footer usage tooltip state                                                                                                           |

---

## [DES-FILES] File Structure

| File                                          | Purpose                                                     |
| --------------------------------------------- | ----------------------------------------------------------- |
| `apps/chat/src/views/chat.tsx`                | Composer layout, footer, queue/activity/control composition |
| `apps/chat/src/components/model-combobox.tsx` | Composer model picker                                       |
| `apps/chat/src/components/slash-popup.tsx`    | Slash command helper                                        |
| `apps/chat/src/components/mention-popup.tsx`  | Mention helper                                              |
| `apps/chat/src/lib/composer-detect.ts`        | Composer helper detection                                   |
| `apps/chat/src/lib/mentions.ts`               | Mention candidate logic                                     |

---

## [DES-DEPS] Dependencies

| Dependency                     | Purpose                           |
| ------------------------------ | --------------------------------- |
| `110-package-transport`        | Webview bridge abstraction        |
| `100-package-shared`           | Message/runtime payload contracts |
| `131-package-ui-design-system` | Shared UI tokens/components       |

---

## [DES-SEC] Security Considerations

<!-- @see spec.md [NFR-6] -->

- Composer input is user content; do not log raw prompts unless an approved diagnostic spec allows it.
- Webview code must not access filesystem/process APIs.
- **Shell execution risk**: System commands execute arbitrary shell strings passed by the user. The extension host spawns a subprocess; the webview never directly calls `child_process`.
- **Dangerous-pattern guard**: Commands matching `rm -rf`, `del /f /s`, `format`, `mkfs`, `dd` require user confirmation before execution. This guard is advisory — a knowledgeable user can still run destructive commands after confirming.
- **CWD bounded to workspace**: All shell commands run in the VSCode workspace root directory (`vscode.workspace.workspaceFolders?.[0].uri.fsPath`). Commands cannot escape the workspace unless the user has symlinks or bind mounts outside it.
- **Timeout enforcement**: Commands exceeding 30 seconds are terminated; the user receives an error with exit code `-1`.
- **No LLM injection**: System commands are never sent to the LLM. The `!` prefix is detected client-side and routed to `chat/runCommand` before any model call.

---

## [DES-ERR] Error Handling

| Scenario                       | Handling                                                                                                |
| ------------------------------ | ------------------------------------------------------------------------------------------------------- |
| Runtime unavailable            | Footer and send state explain configuration/readiness path                                              |
| Bridge send fails              | Composer returns to editable state and surfaces failure through chat error UI                           |
| Helper parsing fails           | Fall back to plain text input without blocking send                                                     |
| Shell command timeout (30s)    | Terminate subprocess; emit `agent/commandOutput { error: "Command timed out after 30s", exitCode: -1 }` |
| Shell non-zero exit            | Emit `agent/commandOutput { done: true, exitCode }`; output card shows exit code badge in amber         |
| Shell exception (ENOENT, etc.) | Emit `agent/commandOutput { error: <exception.message> }`; render error in red inline                   |
| Dangerous pattern before guard | Show `DangerousPatternGuard` confirm dialog; do not execute until user confirms                         |
| Workspace not open             | Show "No workspace folder open" error; disable system command input                                     |

---

## [DES-TEST] Testing Strategy

- Unit-test helper parsing where practical.
- Add chat view tests for footer/queue state when the surface changes.
- Use e2e tests for keyboard policy or queue affordance regressions.

---

## [DES-ROLLOUT] Migration / Rollout Plan

1. Retarget composer source `@see` refs from retired chat docs.
2. Keep broad chat app docs as a route map.
3. Add focused tests as composer behavior changes.

### [DES-COMPOSER-ROLLOUT-ROLLBACK] Rollback Plan

Retarget composer files back to `210-app-chat` only if this child zone stops providing routing value.

---

## [DES-COMPOSER-REFS] File Reference Map

| Task | File                                          | Required @see                                                                              |
| ---- | --------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 1.x  | `apps/chat/src/views/chat.tsx`                | `design.md [DES-COMPOSER-MOCKUP-IDLE] [DES-COMPOSER-MOCKUP-STREAMING] [DES-COMPOSER-FLOW]` |
| 1.x  | `apps/chat/src/components/model-combobox.tsx` | `design.md [DES-COMPOSER-RUNTIME]`                                                         |
| 1.x  | `apps/chat/src/components/slash-popup.tsx`    | `design.md [DES-COMPOSER-HELPERS]`                                                         |
| 1.x  | `apps/chat/src/components/mention-popup.tsx`  | `design.md [DES-COMPOSER-HELPERS]`                                                         |
| 1.x  | `apps/chat/src/components/composer-strip.tsx` | `design.md [DES-COMPOSER-QUEUE]`                                                           |
| 1.x  | `apps/chat/src/lib/composer-detect.ts`        | `design.md [DES-COMPOSER-HELPERS]`                                                         |
| 1.x  | `apps/chat/src/lib/mentions.ts`               | `design.md [DES-COMPOSER-HELPERS]`                                                         |

## [DES-COMPOSER-LOC] Code Locator Map

| Map ID                | Code anchor                                                                               | Messages/settings/commands                                    | Tests                                         |
| --------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------- | --------------------------------------------- |
| `[Composer.Activity]` | `apps/chat/src/views/chat.tsx` `ActivityBar`                                              | `thinking_delta`, runtime streaming state                     | `apps/chat/src/app.test.tsx`                  |
| `[Composer.Queue]`    | `apps/chat/src/views/chat.tsx` `QueueStrip`, `QueueRow`; `composer-strip.tsx`             | `chat/steer`, `chat/followUp`, `queue_update`                 | `apps/chat/src/app.test.tsx`                  |
| `[Composer.Input]`    | `apps/chat/src/views/chat.tsx` `InputGroupTextarea`, `handleDraftChange`, `onKeyDown`     | `chat/send`, `chat/saveNote`, `chat/listFiles`                | `apps/chat/src/app.test.tsx`                  |
| `[Composer.Helpers]`  | `slash-popup.tsx`, `mention-popup.tsx`, `composer-detect.ts`, `mentions.ts`               | `chat/getCommands`, `chat/listFiles`, `chat/newSession`       | `composer-detect.test.ts`, `mentions.test.ts` |
| `[Composer.Toolbar]`  | `apps/chat/src/views/chat.tsx` toolbar block; `model-combobox.tsx`; `ThinkingLevelToggle` | `chat/setModel`, `chat/setThinkingLevel`, `chat/openSettings` | `apps/chat/src/app.test.tsx`                  |
| `[Composer.Actions]`  | `apps/chat/src/views/chat.tsx` action buttons, `submit`, `abort`                          | `chat/send`, `chat/steer`, `chat/followUp`, `chat/abort`      | `apps/chat/src/app.test.tsx`                  |
| `[Composer.Footer]`   | `apps/chat/src/views/chat.tsx` `FooterStrip`, `PiPill`, `usageTooltip`                    | `agent/runtimeStatus`, usage stats, `afx.rpc.enabled`         | `apps/chat/src/app.test.tsx`                  |

## [DES-COMPOSER-TRACE] Functional Trace Matrix

| Requirement | Design nodes                                                                                                   | Code anchors                                                                                                                                                                  | Verification                                                                                                    |
| ----------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| FR-1        | `DES-COMPOSER-MOCKUP-IDLE`, `DES-COMPOSER-MOCKUP-STREAMING`, `DES-COMPOSER-COMPONENTS`, `DES-COMPOSER-KEYS`    | `Chat`, `InputGroupTextarea`, `submit`, `abort`, `onKeyDown`                                                                                                                  | `apps/chat/src/app.test.tsx`; future e2e keyboard coverage                                                      |
| FR-2        | `DES-COMPOSER-FOOTER`                                                                                          | `ActivityBar`, `FooterStrip`, `usageTooltip`, placeholder logic                                                                                                               | `apps/chat/src/app.test.tsx`                                                                                    |
| FR-3        | `DES-COMPOSER-HELPERS`                                                                                         | `detectComposerTrigger`, `SlashPopup`, `MentionPopup`, `insertAtTrigger`, `selectSlashAction`, `extractMentions`                                                              | `composer-detect.test.ts`, `mentions.test.ts`, `app.test.tsx`                                                   |
| FR-4        | `DES-COMPOSER-QUEUE`                                                                                           | `QueuedMessage`, `QueueStrip`, `QueueRow`, `dismissQueued`, `clearAllQueued`                                                                                                  | `apps/chat/src/app.test.tsx`                                                                                    |
| FR-5        | `DES-COMPOSER-RUNTIME`                                                                                         | `ModelCombobox`, `ThinkingLevelToggle`, `selectModel`, `setThinkingLevel`                                                                                                     | `app.test.tsx`; model-combobox tests when changed                                                               |
| FR-6        | `DES-COMPOSER-KEYS`                                                                                            | `navigatePromptHistory`, `collectPromptHistory`, `applyHistoryDraft`                                                                                                          | `app.test.tsx`; future dedicated history recall test                                                            |
| FR-7        | `DES-COMPOSER-FOOTER`                                                                                          | `ActivityBar`, `chat/thinkingDelta` handler                                                                                                                                   | `app.test.tsx`                                                                                                  |
| FR-8        | `DES-COMPOSER-FLOW`, `DES-API`                                                                                 | `bridgeSend` calls only; no VSCode API imports in chat webview                                                                                                                | architecture lint/no-restricted-imports                                                                         |
| FR-9        | `DES-COMPOSER-FLOW`, `DES-UI`, `DES-COMPOSER-COMPONENTS`, `DES-COMPOSER-KEYS`, `DES-API`, `DES-SEC`, `DES-ERR` | Prefix detection in `submit()`, `chat/runCommand` bridge send, `ShellBadge` badge state, `DangerousPatternGuard`, `OutputCard` timeline render, `agent/commandOutput` handler | Unit test: system command dispatched when draft starts with `!`; dangerous pattern blocks without guard confirm |
| NFR-6       | `DES-UI`, `DES-SEC`, `DES-ERR`                                                                                 | Amber "Shell" badge, persistent footer warning, dangerous-pattern guard, timeout enforcement, output card styling                                                             | E2E: badge visible when draft starts with `!`; guard shown for `rm -rf`; output renders in timeline             |
| NFR-1       | `DES-COMPOSER-KEYS`                                                                                            | `onKeyDown`                                                                                                                                                                   | e2e keyboard regression tests when changed                                                                      |
| NFR-2       | `DES-COMPOSER-FOOTER`                                                                                          | `FooterStrip`                                                                                                                                                                 | focused copy snapshot/assertions when changed                                                                   |
| NFR-3       | `DES-COMPOSER-MOCKUPS`, `DES-COMPOSER-QUEUE`                                                                   | stable bottom layout around `InputGroup`/`QueueStrip`                                                                                                                         | visual/e2e checks when layout changes                                                                           |
| NFR-4       | `DES-COMPOSER-HELPERS`                                                                                         | `detectComposerTrigger`, `extractMentions`                                                                                                                                    | helper unit tests                                                                                               |
| NFR-5       | `DES-COMPOSER-REFS`, `DES-COMPOSER-LOC`                                                                        | file/local `@see` anchors                                                                                                                                                     | `rg "@see docs/specs/211-app-chat-composer"` and `/afx-check trace`                                             |

---

## [DES-COMPOSER-QUESTIONS] Open Technical Questions

None.
