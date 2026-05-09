---
afx: true
type: DESIGN
status: Approved
owner: "@rixrix"
version: "1.11"
created_at: "2026-05-02T23:56:50.000Z"
updated_at: "2026-05-09T13:19:54.000Z"
tags: ["app", "chat", "composer", "webview", "mode", "workspace-mode", "prompt", "host-guard"]
spec: spec.md
approved_at: "2026-05-09T13:19:54.000Z"
---

<!-- APPROVED: 2026-05-05T08:37:39.000Z - Do not edit without version bump -->

# App Chat Composer - Technical Design

---

## [DES-OVR] Overview

The composer is the bottom interaction surface of the chat webview. It coordinates local input state, runtime readiness, queued content, helper popups, the combined model/thinking control, and bridge-driven send/steer/abort actions.

System commands (FR-9) extend the composer with local shell execution: typing `!ls` and pressing Enter dispatches `chat/runCommand` instead of `chat/send`, executes the command in the extension host via `child_process.spawn`, and streams output back via `agent/commandOutput` events. UX uses an amber "Shell" badge and persistent footer warning (not blocking); a dangerous-pattern guard prompts confirmation for `rm -rf`, `del /f /s`, `format`, `mkfs`, `dd`.

The composer also mirrors the durable active-file context preference from Settings. That toggle stays compact and visible next to the workspace mode control so users can keep it on by default without leaving the chat surface.
The combined model/thinking control uses shadcn tooltips to explain what each choice does without relying on native browser titles.
Prompt shaping stays host-owned: the webview captures intent and explicit mentions, while the extension host decides whether to inject active-file context and when to inflate workspace file contents before the runtime ever sees the prompt.
The same toolbar now also carries the workspace posture control: Code is the default full-access Pi-backed mode, while Explore is the experimental read-only posture for inspection, tracing, and planning. The chip intentionally uses a sliders-style icon so it reads as posture selection rather than compact/session functionality.
When Explore rejects a shell command, the webview renders a blocked-command strip with copy, dismiss, and switch-to-Code affordances instead of silently failing.

---

## [DES-ARCH] Architecture

```text
Chat view state
  ├─ composer input and keyboard policy
  ├─ helper popups: slash and mention
  ├─ controls: combined model/thinking, workspace mode, active-file context, send, steer, abort
  ├─ queue/footer/activity rendering
  └─ transport bridge messages to VSCode host
  └─ system command execution (! prefix → child_process.spawn)
  └─ host-blocked Explore command feedback (agent/actionBlocked)
```

Composer logic stays in the chat webview. The VSCode extension host owns command execution and runtime services. Shell commands are executed in a separate context from the LLM stream, enabling concurrent execution.
Prompt shaping for file context follows the same boundary: the webview stays UI-only, and the host performs mention normalization, workspace file expansion, and AgentManager dispatch so later prompt-injection features can plug in at one stable boundary.

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

| Flow                | Source anchor                                     | Bridge message                     | Host/runtime result                                                       | Returned state                                                              |
| ------------------- | ------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Idle send           | `submit({ followUp: false })` when `!isStreaming` | `chat/send`                        | Starts a user turn                                                        | `chat/messageStart`, `chat/messageDelta`, `chat/messageEnd`, `agent/status` |
| Streaming follow-up | `submit({ followUp: true })`                      | `chat/followUp`                    | Queues content after active turn                                          | Local `queued` mirror plus future stream state                              |
| Streaming steer     | `submit({ followUp: false })` while streaming     | `chat/steer`                       | Interrupts/redirects active turn                                          | Local `queued` mirror plus runtime stream state                             |
| Abort               | `abort()`                                         | `chat/abort`                       | Stops active run                                                          | `chat/aborted`, `agent/status`                                              |
| Save note           | `saveAsNote()`                                    | `chat/saveNote`                    | Host appends note                                                         | Local note event plus note bridge result                                    |
| Slash action        | `selectSlashAction()`                             | `chat/newSession`, `chat/abort`    | Host action without textarea insertion                                    | New session/abort events                                                    |
| Mention picker      | `handleDraftChange()`, `openMentionPicker()`      | `chat/listFiles`                   | Host lists recent/workspace files                                         | `agent/files`                                                               |
| Slash picker        | mount hydration                                   | `chat/getCommands`                 | Host lists agent/extension commands                                       | `agent/commands`                                                            |
| Model picker        | `selectModel()`                                   | `chat/setModel`                    | Runtime default/model changes                                             | `agent/modelChanged`                                                        |
| Thinking picker     | `setThinkingLevel()`                              | `chat/setThinkingLevel`            | Runtime effort changes                                                    | `agent/runtimeSettings`                                                     |
| Context picker      | `applyIncludeActiveFileContext()`                 | `chat/setIncludeActiveFileContext` | Durable active-file context preference changes                            | `agent/settingsSnapshot`                                                    |
| System command      | `submit()` when draft starts with `!`             | `chat/runCommand`                  | Spawns shell in workspace root                                            | `agent/commandOutput` (delta / done / error)                                |
| Open modified file  | `FilesStrip` pill click                           | `chat/openFile`                    | `vscode.window.showTextDocument(uri, { selection })` when `line` provided | Editor opens (and reveals first changed line if known)                      |

---

## [DES-UI] User Interface & UX

The composer must keep the primary action obvious while showing runtime readiness and queue state in compact footer copy. Keyboard instructions should be state-aware and avoid generic prompts when the runtime is unavailable or content is queued.

## [DES-COMPOSER-MOCKUPS] Composer ASCII UI State Mockups

### [DES-COMPOSER-MOCKUP-IDLE] Idle Ready State

The idle state renders one primary send action and keeps the combined model/thinking control compact enough for the VS Code side panel.

```text
+--------------------------------------------------------------------+
| [Composer.Activity]  dot idle  AFX ready                           |
+--------------------------------------------------------------------+
| [Composer.InputGroup]                                              |
|  [@] [Composer.Input: Ask AFX about this workspace ...]        [^] |
|      [Composer.Model: GPT-5.4 mini - Minimal ▾] | [Sliders] Code [FileText] [File ctx: On] |
+--------------------------------------------------------------------+
| [Composer.Footer] Pi/API status . usage . "Enter send . Cmd+Shift" |
+--------------------------------------------------------------------+
```

### [DES-COMPOSER-MOCKUP-RUNTIME-MENU] Combined Model And Thinking Menu

The root menu always exposes thinking levels first, then nests model selection under `Model >` so
provider and external-agent choices stay grouped without taking extra toolbar width.

```text
┌──────────────────────────────── Combined menu ───────────────────────────────┐
│ Thinking Level                                                               │
│ • Minimal                                                                    │
│ • Low                                                                        │
│ • Medium                                                                     │
│ • High                                                                       │
│ • Extra High                                                                 │
│                                                                              │
│ Model >                                                                      │
│   Provider                                                                   │
│     • OpenAI · GPT-5.4 mini                                                 │
│     • Anthropic · Claude Sonnet                                             │
│   External Agents                                                            │
│     • Pi CLI                                                                │
│     • OpenCode                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### [DES-COMPOSER-MOCKUP-STREAMING] Streaming Queued State

The streaming state replaces the single send action with follow-up, steer, and stop controls while showing local queued mirrors above the input group.

```text
+--------------------------------------------------------------------+
| [Composer.Activity]  pulsing dot  thinking: reading specs...       |
+--------------------------------------------------------------------+
| [Composer.Queue] Queued . 2                       [Clear all] [v]   |
|   [Steer] -> tighten footer copy                                   |
|   [Follow-up] 1. then update tests                                 |
+--------------------------------------------------------------------+
| [Composer.InputGroup]                                              |
|  [@] [Composer.Input: Queue a follow-up... (⌘⏎ to steer)]          |
|      [Composer.Model: GPT-5.4 mini - High ▾] | [Sliders] Code [FileText] [File ctx: On] [Follow-up ⏎] [Steer ⌘⏎] [Stop] |
+--------------------------------------------------------------------+
| [Composer.Footer] ⏎ follow-up . ⌘⏎ steer . Pi pill . usage         |
+--------------------------------------------------------------------+
```

### [DES-COMPOSER-MOCKUP-COMPACTING] Manual Compaction Locked State

Manual compaction is a runtime-busy state. It disables text entry, send/follow-up/steer actions, and duplicate compact requests until the host reports `agent/compacted` or an error.

```text
+--------------------------------------------------------------------+
| [Composer.Activity]  pulsing dot  Compacting session...            |
+--------------------------------------------------------------------+
| [Composer.InputGroup disabled]                                     |
|  [@ disabled] [Composer.Input disabled]                            |
|      "Compacting session — wait for it to finish…"                 |
|      [Composer.Model disabled] | [Sliders disabled] [Send off]     |
+--------------------------------------------------------------------+
| [Composer.Footer] Compacting history . wait for completion         |
| [Header.Action] Compact session disabled / pulsing                 |
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
|      [@ disabled] [Composer.Model disabled] | [Sliders disabled] [Send off] |
+--------------------------------------------------------------------+
| [Composer.Footer] "Configure provider or fix Pi RPC in Settings"      |
+--------------------------------------------------------------------+
```

### [DES-COMPOSER-MOCKUP-SYSTEM-COMMAND] System Command Active State

The "Shell" amber pill badge replaces the `@` mention button and the combined model/thinking control shifts to accommodate it. The footer shows a persistent warning `"⚠ Shell · output is local only"`. These cues are visible while the draft starts with `!` and do not block execution.

```text
+--------------------------------------------------------------------+
| [Composer.Activity]  dot idle  AFX ready                           |
+--------------------------------------------------------------------+
| [Composer.InputGroup]                                              |
|  [Shell] [!] [Composer.Input: pnpm build]                     [^]   |
|      ⚠ Shell · output is local only                               |
|      [Composer.Model: Anthropic . Claude - Medium] | [FileText] [File ctx: On] |
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

### [DES-COMPOSER-MOCKUP-MODE-COLLAPSED] Workspace Mode Chip

The mode chip sits after the toolbar divider and before the file-context toggle. Code stays visually
quiet; Explore uses the warning tone and an `Experimental` badge in the dropdown.

```text
+--------------------------------------------------------------------+
| [Composer.Activity]  dot idle  AFX ready                           |
+--------------------------------------------------------------------+
| [Composer.InputGroup]                                              |
|  [@] [Composer.Input: Ask AFX about this workspace ...]        [^] |
|      [Composer.Model: Anthropic . Claude - Medium] | [Sliders] Code [FileText] [File ctx: On] |
+--------------------------------------------------------------------+
| [Composer.Footer] Pi/API status . usage . "Enter send . Cmd+Shift" |
+--------------------------------------------------------------------+
```

### [DES-COMPOSER-MOCKUP-MODE-DROPDOWN] Explore Dropdown Open

Hovering the chip shows a tooltip; clicking it opens a compact posture menu with Code default and
Explore labeled as experimental read-only.

```text
+------------------------------ Mode --------------------------------+
| Code                                                               |
|   Default. Full access. Pi can act and edit.                       |
| Explore                                                            |
|   Experimental. Read-only. Inspect code, trace behavior, plan.     |
|                                                                    |
|               [selected]                                            |
+--------------------------------------------------------------------+
```

### [DES-COMPOSER-MOCKUP-BLOCKED-COMMAND] Explore Blocked Command Strip

When the host rejects `!` in Explore mode, the composer shows the rejected command, an explanation,
and the switch/copy/dismiss affordances.

```text
+--------------------------------------------------------------------+
| [Blocked command]                                                  |
| ⚠ Shell command blocked in Explore mode                            |
| ! pnpm test                                                        |
| Explore mode is read-only. Switch to Code to run shell commands.   |
| [Switch to Code] [Copy command] [Dismiss]                          |
+--------------------------------------------------------------------+
```

### [DES-COMPOSER-MOCKUP-SLASH-FILTER] Slash Command Auto-Complete

Typing `/` opens the full command list; each subsequent keystroke narrows the list in real time.
Pressing `Tab` while the popup is open moves focus from the textarea into the dropdown so the
user can navigate with arrow keys and select with `Enter`. The popup stays open until the user
selects a command, presses `Escape`, or clears the `/` trigger.

```text
+--------------------------------------------------------------------+
| [Composer.InputGroup]                                              |
|  [@] [Composer.Input: /afx-s                                   ]   |
|      +----------------------------------------------------------+  |
|      | AFX skills                                               |  |
|      |   /afx-spec    Validate and manage spec lifecycle        |  |
|      |   /afx-sprint  Single-document SDD for fast feature work |  |
|      |   /afx-session Capture session context and notes         |  |
|      |                                                          |  |
|      | Other commands                                           |  |
|      |   /abort       Stop the current agent run                |  |
|      |                                                          |  |
|      | Actions                                                  |  |
|      |   /new         Start a new chat session                  |  |
|      +----------------------------------------------------------+  |
|                                                                    |
|  [Tab] focuses first row · [↑↓] navigate · [Enter] select          |
+--------------------------------------------------------------------+
```

When no commands match the typed filter, the popup shows an empty state instead of closing:

```text
+--------------------------------------------------------------------+
|  [@] [Composer.Input: /xyz                                      ]  |
|      +----------------------------------------------------------+  |
|      | No commands match "/xyz"                                 |  |
|      +----------------------------------------------------------+  |
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
    BlockedCommandStrip         -> host-blocked runCommand feedback and switch/copy/dismiss affordances
    InputGroup                  -> [Composer.InputGroup]
      InputGroupTextarea        -> [Composer.Input]
      Toolbar
        mention button          -> opens MentionPopup and lists files
        ModelCombobox           -> combined model/thinking selector with API/external groups
        ModeToggle              -> workspace posture selector (Code default / Explore experimental)
        ActiveFileContextToggle -> durable active-file context toggle mirrored in Settings
      Actions
        Send                    -> idle send
        Follow-up               -> streaming follow-up
        Steer                   -> streaming interrupt
        Stop                    -> abort active turn
    FooterStrip                 -> [Composer.Footer]
```

| Surface                    | Owned behavior                                                                              | Not owned here                         |
| -------------------------- | ------------------------------------------------------------------------------------------- | -------------------------------------- |
| `[Composer.Activity]`      | Live thinking preview and idle/busy strip above composer                                    | Full timeline thinking blocks          |
| `[Composer.Queue]`         | Local display of messages already sent as steer/follow-up                                   | Engine-authoritative queue scheduling  |
| `[Composer.Input]`         | Draft text, placeholder, keyboard routing, prompt-history recall                            | Message timeline rendering             |
| `[Composer.Helpers]`       | Slash/mention trigger detection, picker display, insertion/action dispatch                  | Command implementation in host         |
| `[Composer.Toolbar]`       | Mention button, combined model/thinking selector, mode selector, active-file context toggle | Workspace posture and context controls |
| `[Composer.Actions]`       | Send/follow-up/steer/stop affordances                                                       | Agent implementation                   |
| `[Composer.Footer]`        | Compact runtime readiness, Pi state, usage hints                                            | Full settings diagnostics              |
| `[Composer.BlockedAction]` | Host-blocked shell command strip, command copy, dismiss, switch to Code affordance          | Host shell guardrail handling          |

### [DES-COMPOSER-COMPONENT-MODE-TOGGLE] ModeToggle

| Code anchor             | Component contract                                                                                                 |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `ModeToggle`            | Owns the workspace posture chip, tooltip, dropdown menu, and current selection echo in the narrow composer toolbar |
| `WORKSPACE_MODES`       | Defines the Code/Explore option copy and the Explore `Experimental` badge                                          |
| `setMode`               | Sends `chat/setMode` with the selected `WorkspaceMode` and keeps the local toolbar state in sync                   |
| `restoreBlockedCommand` | When the blocked strip switches back to Code, restores the exact command into the draft before focus returns       |

### [DES-COMPOSER-COMPONENT-BLOCKED-COMMAND-STRIP] BlockedCommandStrip

| Code anchor             | Component contract                                                                                       |
| ----------------------- | -------------------------------------------------------------------------------------------------------- |
| `BlockedCommandStrip`   | Renders the host-blocked Explore action strip with warning copy, command copy, switch, and dismiss hooks |
| `BlockedActionView`     | Host-only payload describing the blocked command, title, message, and mode                               |
| `copyBlockedCommand`    | Copies the original `!` command text to the clipboard                                                    |
| `restoreBlockedCommand` | Restores the blocked command into the textarea and switches workspace mode back to Code                  |

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

| Code anchor               | Component contract                                                                                       |
| ------------------------- | -------------------------------------------------------------------------------------------------------- |
| `ModelCombobox`           | Owns composer model/thinking chrome, selected trigger label, nested model submenu, and Settings fallback |
| `groupModels`             | Splits API-provider models from external-agent models and sorts both groups by provider/instance id      |
| `renderModelItem`         | Shows display name, raw model id, and compact context window                                             |
| `isSameModel`             | Uses provider, id, and instance id so API and external models do not collide                             |
| `THINKING_LEVELS`         | Maps runtime effort values to the always-visible thinking section and closed trigger label               |
| `formatComposerSelection` | Displays selected model name plus thinking label in the narrow toolbar trigger                           |

### [DES-COMPOSER-COMPONENT-SLASH-POPUP] SlashPopup

| Code anchor          | Component contract                                                                                                          |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `SlashPopup`         | Owns command popover placement, command groups, empty state, action group, and live incremental filter                      |
| `filterQuery`        | Substring after the `/` trigger; narrows groups in real time as the user types                                              |
| `filteredCommands`   | Derived from `AgentCommand[]` by matching `displayCommandName` against `filterQuery` (case-insensitive prefix or substring) |
| `SlashAction`        | Only host actions that bypass textarea insertion: `chat/newSession`, `chat/abort`                                           |
| `CommandRow`         | Renders command name and optional description as a selectable cmdk row                                                      |
| `displayCommandName` | Converts skill ids like `skill:afx-task` to `/afx-task` and normalizes plain commands with leading `/`                      |
| `onFilterChange`     | Updates `filterQuery` from draft changes after the `/` trigger without closing the popup                                    |
| `focusPopupOnTab`    | When `Tab` is pressed while slash popup is open, moves focus from textarea to first `CommandRow`                            |

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
| Slash/mention popup open                   | `Tab`                      | `onKeyDown`                                  | Move focus from textarea to first `CommandRow` in the open popup; popup stays open  |
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
  -> SlashPopup opens with full command list
  -> each keystroke after "/" updates filterQuery
     AFX skills group (filtered live)
     Other commands group (filtered live)
     Actions: /new, /abort (filtered live)
     Empty state shown when no match
  -> Tab moves focus into popup for keyboard selection
  -> selectCommand inserts text OR selectSlashAction dispatches host message

[Composer.Helpers.Mention]
draft before caret -> detectComposerTrigger("@", not escaped, not inside fence)
  -> chat/listFiles
  -> MentionPopup
     Recently opened
     Workspace
  -> selectMention inserts @path at trigger range
```

| Function/component      | Functionality                                                                                                                                                 |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `detectComposerTrigger` | Finds `/` or `@` token before the caret, rejects fenced code blocks, escaped mentions, and slash commands that are not at command position                    |
| `filterQuery`           | Live substring after `/` used to incrementally narrow `SlashPopup` command groups                                                                             |
| `extractMentions`       | Extracts unique `@path` mentions from sent content, strips trailing punctuation, and passes `mentions` to host send/queue messages                            |
| `insertAtTrigger`       | Replaces the active trigger range with command or `@file` text, appends a space, and restores caret/focus                                                     |
| `SlashPopup`            | Renders command groups from `AgentCommand`, formats AFX skills as slash commands, distinguishes host actions from text insertions, and applies live filtering |
| `MentionPopup`          | Splits files into recent/workspace groups and inserts the chosen path                                                                                         |
| `focusPopupOnTab`       | Transfers focus from textarea to the first selectable item in `SlashPopup` when `Tab` is pressed while the popup is open                                      |

## [DES-COMPOSER-RUNTIME] Combined Model, Thinking, And Runtime Control Map

| Control             | Source anchor                | Data                                                        | Behavior                                                                 |
| ------------------- | ---------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------ |
| Combined trigger    | `ModelCombobox`              | `AgentModel[]`, `ThinkingLevel`, active `agentStatus.model` | Shows model name plus thinking label and opens the nested menu           |
| Empty model list    | `ModelCombobox`              | no `models`                                                 | Keeps thinking choices visible and offers Settings fallback              |
| Model item          | `renderModelItem`            | `name`, `id`, `contextWindow`                               | Shows compact display name and context window                            |
| Model select        | `selectModel`                | `provider`, `id`, `instanceId`                              | Sends `chat/setModel`, resets prompt-history cursor, focuses textarea    |
| Thinking select     | `selectThinkingLevel`        | `ThinkingLevel`                                             | Sends `chat/setThinkingLevel` and optimistically updates runtime state   |
| Workspace mode      | `ModeToggle`                 | `WorkspaceMode`, `snapshot.mode.active`                     | Sends `chat/setMode`, keeps Code default, Explore experimental/read-only |
| Blocked action      | `BlockedCommandStrip`        | `BlockedActionView`                                         | Renders Explore rejection strip; Switch to Code restores the draft       |
| Runtime unavailable | `canSend`, placeholder logic | `agentStatus.phase`, `runtimeConfigured`, `rpcEnabled`      | Disables textarea/actions and routes user to setup copy                  |

## [DES-COMPOSER-CONTEXT] Active File Context Toggle

The active-file context toggle is a mirrored preference, not a separate data source. Settings owns
the durable value, the composer renders the quick toggle, and the extension host remains the source
of truth for persistence and prompt shaping. The composer control stays compact: switch first,
filename label second, and the full path exposed in the hover tooltip. The webview never reads the
workspace file contents itself; it sends intent, and the host performs the injection.

Workspace mode follows the same host-owned pattern. The composer sends `chat/setMode`, the host
routes that to `afx.setMode`, and the persisted `afx.mode.active` value rehydrates both the chat
toolbar and the settings card. The toolbar trigger displays only the active value (`Code` or
`Explore`) to match the combined model/thinking control's compact active-value style.

### Flow: Settings Snapshot → Toolbar Toggle → Host Persistence → Snapshot Echo

```text
[Composer.Toolbar] switch + filename label
  -> applyIncludeActiveFileContext(enabled)
  -> bridgeSend({ type: "chat/setIncludeActiveFileContext", requestId, enabled })
  -> @afx/transport webview bridge
  -> VSCode SidebarPanel.dispatchInbound
  -> workspace configuration update (afx.context.includeActiveFileContext)
  -> agent/settingsSnapshot
  -> Chat + Settings rehydrate the mirrored preference
```

### Flow: Chat Draft -> Host Prompt Shaping -> AgentManager -> Pi

```text
[Composer.Input]
  draft text
  + explicit @file mentions
  + active-file context toggle
  + workspace mode (Code / Explore)
  + combined model/thinking selection
        │
        ├─ 1. User types a draft in the chat box
        ├─ 2. User may click @ to insert an explicit workspace file mention
        ├─ 3. User may toggle active-file context ON/OFF
        ├─ 4. User may switch between Code and Explore mode
        ├─ 5. Chat submit() packages content + mentions
        ├─ 6. bridgeSend({ type: "chat/send" | "chat/steer" | "chat/followUp" })
        ├─ 7. VS Code host receives the inbound message
        ├─ 8. normalizePromptMentions(content, mentions)
        │      - parses explicit @mentions from the draft
        │      - appends the current editor file when the toggle is ON
        ├─ 9. inflateMentionContext(content, mentions)
        │      - reads workspace files
        │      - builds the final prompt preamble / file context block
        ├─ 10. prefixExplorePrompt(content)
        │      - prepends the strict read-only guardrail only when mode is Explore
        ├─ 11. agentManager.send(...) / steer(...) / followUp(...)
        ├─ 12. Pi Rpc Manager serializes the request
        ├─ 13. Pi subprocess receives the final text prompt
        └─ 14. Model generates from the already-shaped prompt
```

| Layer                    | Responsibility                                                                         | What it must not do                                 |
| ------------------------ | -------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Webview composer         | Capture the user's draft, explicit mentions, and toggle state                          | Read workspace files or assemble injected file text |
| Transport bridge         | Move messages between webview and host                                                 | Interpret or mutate prompt content                  |
| VS Code host             | Normalize mentions, resolve active-file preference, and inflate workspace file context | Hide prompt shaping inside the webview              |
| `AgentManager` interface | Carry the final request through send / steer / follow-up paths                         | Decide which workspace files get injected           |
| Pi runtime adapter       | Serialize the already-shaped request to the Pi process                                 | Re-run webview context logic                        |
| Pi subprocess / model    | Generate a response from final prompt text                                             | Reach back into the editor or workspace directly    |

The workspace mode control uses the same host boundary. `chat/setMode` never mutates the model
directly; it routes to `afx.setMode`, which persists `afx.mode.active` at workspace scope and then
refreshes the shared settings snapshot for both Settings and the composer toolbar.

### Why The Host Owns Injection

The host owns injection because it is the only layer with safe workspace access, runtime context, and a stable place for future prompt shaping. Keeping the webview UI-only gives us a few benefits:

- The chat surface stays portable and easier to reason about.
- Send, steer, and follow-up all share the same shaped prompt path.
- Active-file context stays consistent whether the user sends a fresh prompt or continues a streaming turn.
- Future prompt injection features can slot in before `AgentManager` without changing the composer UI contract.

### Future Prompt Injection Slot

Future prompt-injection features should live alongside `normalizePromptMentions()` and `inflateMentionContext()` in the host, not inside the webview. That gives us one place to add later enrichers such as:

- policy-based prompt prefixes
- session-scoped hints
- agent-specific metadata
- workspace-aware snippets

The composer should continue to send intent, not constructed prompt text.

### Composer Toolbar Mockup

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Chat                                                                         │
│                                                                              │
│ ┌──────────────────────────────────────────────────────────────────────────┐ │
│ │ Inspect the active file and explain the failing test                   │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
│  [@]   [GPT-5.4 mini - Minimal ▾]   |   [○] journal.md   [Send]            │
│   │        │                         │                                       │
│   │        │                         └─ active-file context toggle          │
│   │        └─ combined model/thinking selector                               │
│   └─ file mention helper                                                    │
│                                                                              │
│ Hovering `journal.md` shows the full path, for example                     │
│ `src/notes/journal.md`                                                       │
└──────────────────────────────────────────────────────────────────────────────┘
```

The toolbar stays narrow-screen friendly by keeping the switch small, the filename short, and the
tooltip as the place where the full path lives. That matches the compact combined model/thinking
control instead of introducing a heavier "file context" box.

### Concrete Payload Example

This example shows the full path from the chat box to Pi with one active-file selection and one
explicit file mention.

Composer state:

- draft: `Please compare this with @docs/specs/211-app-chat-composer/design.md and confirm the flow.`
- active-file toggle: `ON`
- active editor file: `apps/vscode/src/panels/sidebar-panel.ts`
- explicit mentions: `["docs/specs/211-app-chat-composer/design.md"]`

Webview payload to host:

```json
{
  "type": "chat/send",
  "requestId": "req-42",
  "content": "Please compare this with @docs/specs/211-app-chat-composer/design.md and confirm the flow.",
  "mentions": ["docs/specs/211-app-chat-composer/design.md"]
}
```

Host normalization result:

```text
normalizePromptMentions(content, mentions)
-> [
     "apps/vscode/src/panels/sidebar-panel.ts",
     "docs/specs/211-app-chat-composer/design.md"
   ]
```

Host-inflated prompt passed to `agentManager.send(...)`:

```text
The user referenced these files:

### apps/vscode/src/panels/sidebar-panel.ts
[ts file content block]

### docs/specs/211-app-chat-composer/design.md
[md file content block]

Then asked:
Please compare this with @docs/specs/211-app-chat-composer/design.md and confirm the flow.
```

Pi RPC request:

```json
{
  "type": "prompt",
  "message": "<inflated prompt text from above>"
}
```

What Pi receives:

- the injected file blocks
- the user's original question
- no webview state, no host file paths beyond the shaped prompt text
- no active-file toggle concept, because that choice has already been resolved before the runtime call

If the active-file toggle is OFF, step 2 returns only the explicit mention array, and step 3 only
injects the files the user explicitly referenced in the draft.

| Step                 | Source anchor                        | Bridge message                     | Host/runtime result                                                 | Returned state                        |
| -------------------- | ------------------------------------ | ---------------------------------- | ------------------------------------------------------------------- | ------------------------------------- |
| Hydrate toggle       | `bridgeOn("agent/settingsSnapshot")` | `agent/settingsSnapshot`           | Host snapshot includes durable context preference                   | Composer/settings toggle state        |
| Toggle click         | `applyIncludeActiveFileContext()`    | `chat/setIncludeActiveFileContext` | Persist `afx.context.includeActiveFileContext`                      | Updated snapshot and optimistic UI    |
| Toolbar render       | toolbar block                        | none                               | Keeps the compact switch and filename label aligned on small widths | `aria-pressed`/title reflect state    |
| Host consume setting | `sidebar-panel.ts` settings handler  | none                               | Active-file context is attached to send/steer/follow-up content     | Inflated prompt text with active file |

## [DES-COMPOSER-COMPONENT-STRIP] Composer Strip Variants

The composer strip slot above the InputGroup hosts a small set of conditional banner
variants. Each variant is a pure presentational component sharing the generic
`ComposerStrip` chrome (title row, content slot, optional CTA, dismiss icon).

| Variant          | Trigger                                                                       | Purpose                                                                                                                                                     |
| ---------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `queue`          | One or more queued steer/follow-up rows                                       | Show queued composer messages awaiting acceptance                                                                                                           |
| `files`          | `agent/modifiedFiles` payload                                                 | Surface files the agent modified during a turn                                                                                                              |
| `blocked`        | `agent/actionBlocked` payload                                                 | Show the rejected Explore-mode shell command with copy/switch affordances                                                                                   |
| `doc-actions`    | Active editor is an AFX doc (sprint, 4-file, journal, ADR, research, context) | SDD intent buttons routed by detected format; Spec mode shows more primaries, non-Spec modes keep the strip compact and optional                            |
| `mode-suggest`   | Active editor is an AFX doc AND `workspaceMode !== "spec"` AND not dismissed  | One-time Spec-mode onboarding offer; dismissal persisted via `afx.specModeOfferDismissed` workspaceState memento                                            |
| `result-actions` | Completed assistant message includes supported `/afx-*` follow-up commands    | Composer-adjacent `Next` action chips parsed from AFX output; unknown/draft-only commands insert into draft, deterministic supported commands can auto-send |

`doc-actions` and `mode-suggest` reuse the same chrome — no new primitives. They render
in the slot order: queue → files → blocked → doc-actions → mode-suggest, directly above
the InputGroup wrapper.

Doc-action overflow uses a `More` icon button backed by shadcn/Radix dropdown primitives. The menu groups
draft-first Compose commands before deterministic Run Now commands, with parsed focus targets from
`chat/activeDocContext.parsedFocuses`, and command-context presets from
`COMMAND_CONTEXT_PRESETS`. Actions with scoped choices render as one cohesive dropdown pill with an inline
lucide `ChevronDown`; do not render a detached caret beside a separate action button. Spec/design `Refine`
opens a focus menu when targets are available. The menu starts with `Insert In Chat Box` → `Refine all`,
then exposes `From This Doc`, `Common Focuses`, and spec-only `Discuss`.
Dropdown rows stay compact: long visible labels and command previews may ellipsize, but hover/focus uses
shadcn Tooltip content to expose the full target title, source line when known, command, draft/auto mode,
and the parsed section excerpt when the host provides one.
The shared Memory catalog follows the same tooltip rule for `/afx-context` and `/afx-session`
commands, using workflow-derived details for Save, Load, History, Impact, Note, Log, Recap,
Promote, and Capture so first-time users can understand what each memory action does before
running it.
On tasks.md, the visible strip is split by behavior, not by command family: Compose controls (`Code`,
task-phase `Review` / sprint `Refine`) render first, followed by a literal `|` divider and Run Now
controls (`Verify`, `Pick`, `Approve`/state actions where applicable). `Code` always opens a draft-first
menu; even before phase rows are available, the menu exposes `Insert In Chat Box` → `Code all`.
For standard tasks this inserts `/afx-task code all <feature>`; for sprint tasks it inserts
`/afx-sprint code <feature>`. Parsed task rows come from `### N.N Task group` headings, with the
checkboxes underneath used as completion evidence, so the dropdown shows human-facing WBS labels such as
`Code 1.1` instead of leaf checklist text. WBS choices use `/afx-task code <WBS>` or
`/afx-sprint code <feature> <WBS>`, and completed task groups are hidden after stable WBS IDs are
computed. `Pick` uses the same single-pill pattern when task rows exist, but because Pick is deterministic
it stays in the Run Now group and WBS-specific selections auto-send. Whole-document standard verification
uses `/afx-task verify all <feature>`, never `/afx-task verify <feature>`. Icon grammar is consistent
across the row: `PenLine` marks compose/draft actions and `Zap` marks run-now actions. Full Spec-mode task
strips stay bounded to four primary actions plus `More`; lower-priority catalog commands such as
Status/Brief/Complete/Sync remain one menu away. Presets resolve only when all placeholders have safe local
values (`feature`, `featurePath`, real active-editor `filePath`, `WBS`, `desId`, `topic`, `change`) and
fail closed when the base command is not in the verified catalog.

Memory actions render from `MEMORY_CATALOG` via the shared `MemoryDropdown` component. The top-right
toolbar and composer toolbar use `ChatMemoryMenuButton`: a single compact trigger opens the same catalog
for Save/Load/History/Impact and session Note/Log/Recap/Promote/Capture, so the right-side composer
controls do not spend space on a separate Save half and caret half. Save/Log/Promote/Capture remain
draft-first; Load/History/Recap can auto-send. The trigger must use the same quiet `ghost` treatment as
the model selector: mono label, subtle hover/focus only, no boxed segmented borders, inline lucide
`Archive` + `ChevronDown`, and a label that can collapse at the tiny top-bar size. Both anchors use
shadcn Tooltip copy instead of raw browser `title` strings.

All icons in this composer workflow surface come from `lucide-react`. Use intent-matching icons (`Archive`
for session memory, `MoreHorizontal` for overflow, `Zap` for auto-send, `PenLine` for draft, `Scissors`
for focus, `BadgeCheck` for sign-off) instead of introducing bespoke SVGs.

### Strip-header header extras (FR-17, FR-18, FR-19)

The doc-actions strip's `ComposerStrip` chrome accepts a `headerExtras` slot rendered between the
title button and the dismiss control. Two affordances live there:

1. **Workflow-position breadcrumb** — `Spec ✓ → Design ⏳ → Tasks 3/8 → Code`, derived client-side
   from `chat/activeDocContext.{specStatus, designStatus, tasksStatus, tasksCompleted, tasksTotal}`.
   Standard 4-file features read sibling frontmatter on activation (cached, invalidated on save);
   sprint files derive the shape from the in-file `approval` block. The button's click handler
   auto-sends `/afx-next` (deterministic read per FR-15 autoSend rules). The breadcrumb only renders
   in Spec mode; compact mode hides it to keep the strip narrow.
2. **Strip-header Memory ▾ anchor** — reuses `ChatMemoryMenuButton` with `size="tiny"` so the
   `MEMORY_CATALOG` content matches the top-right and composer-toolbar anchors byte-for-byte
   (NFR-12). Renders only when `onMemorySelect` is wired AND workspace mode is `spec`; compact mode
   tucks the anchor into `···` More.

Both surfaces live inside a `TooltipProvider delayDuration={250}` so hover hints render with the
same latency as the strip body buttons.

### Brass `[Sign Off ▾]` action (FR-19)

When `tasks.md` is the active editor and the host's `SignOffSummary` reports `ready === true`, a
brass-amber `[Sign Off ▾]` button surfaces alongside the run-now action group. Click opens a shadcn
`Popover` that previews the atomic edit:

```
SIGN OFF — TASKS.MD
This will atomically:
  ✓ Tick 3 Human cells
  ✓ Promote status: Approved → Living     (or: Status already Living — keep as-is)
  ✓ Update updated_at to now
⌘Z reverts in one step.
[Cancel]  [Confirm Sign Off]
```

Confirm dispatches the host-action envelope from `100-package-shared`'s `[DES-SHARED-CHAT-PROTOCOL]`:

```
chat/hostAction { type, requestId, action: "tasks.signOff", uri }
   ↓
host: applyTasksSignOff(uri)
   ├ openTextDocument(uri)
   ├ buildTasksSignOffEdit(...)         // single WorkspaceEdit — atomic, one undo entry
   ├ vscode.workspace.applyEdit(edit)
   ├ document.save()
   ↓
agent/signOffComplete { ok, rowsTicked, newStatus, error? }
   ↓
webview: success / error toast
```

The button hides when `signOff.ready === false` (e.g. an unchecked task, an Agent cell still `[ ]`,
or every Human cell already `[x]`). The host re-parses the document on every dispatch, so the
button's click is safe even if the file changed between detection and confirmation.

### Compact-mode primary actions per [DES-MODES] (FR-15)

Outside Spec mode the strip falls back to a per-docKind compact set instead of slicing the first
two actions. The compact mapping is verified against the fleeting-sprint `[DES-MODES]` table:

| docKind  | Compact primaries                                          |
| -------- | ---------------------------------------------------------- |
| spec     | `[Refine \| ▾]` `[⚡Validate]`                             |
| design   | `[Refine \| ▾]` `[⚡Validate]`                             |
| tasks    | `[Code \| ▾]` `[Review \| ▾]` `\|` `[⚡Verify]` `[⚡Pick]` |
| journal  | `[Note]` `[⚡Recap]`                                       |
| adr      | `[Review]` `[⚡List]`                                      |
| research | `[Compare]` `[Finalize]`                                   |
| context  | unchanged from full set                                    |

Anything not in the compact list collapses into `···` More so the strip stays narrow at the 205px
sidebar minimum width. The full Spec-mode set (3–4 buttons + More) renders unchanged.

## [DES-COMPOSER-COMPONENT-MODE-TOGGLE] Workspace Mode Control

The composer toolbar exposes a single Mode dropdown that drives `chat/setMode`. The
dropdown items map 1:1 to entries in `WORKSPACE_MODES` in `chat.tsx`. The `data-workspace-mode`
attribute on the InputGroup wrapper drives a CSS-only border/ring accent:

| Mode    | Accent token (CSS)              | Footer hint                            |
| ------- | ------------------------------- | -------------------------------------- |
| Code    | default `--ring`                | `⏎ follow-up · ⌘⏎ steer · …`           |
| Explore | amber (`oklch(0.83 0.16 80)`)   | `Read-only / Safe · ⌘⇧M to switch`     |
| Spec    | violet (`oklch(0.72 0.19 295)`) | `Planning / Docs only · ⌘⇧M to switch` |

A `200ms` `border-color`/`box-shadow` transition smooths mode switches. Border colors are
defined as CSS custom properties — no runtime JS color computation.

## [DES-COMPOSER-QUEUE] Queue Strip Behavior

| Queue state     | Source anchor                         | UI/functionality                                                       |
| --------------- | ------------------------------------- | ---------------------------------------------------------------------- |
| No queued items | `QueueStrip`                          | Returns `null`; composer layout collapses naturally                    |
| Steer items     | `QueueStrip`, `QueueRow`              | Render before follow-ups with `Zap` icon and arrow/ordinal marker      |
| Follow-up items | `QueueStrip`, `QueueRow`              | Render after steer items with `CornerDownLeft` icon and ordinal marker |
| Clear all       | `clearAllQueued`                      | Removes local mirror rows only; content may already be in engine queue |
| Dismiss row     | `dismissQueued`                       | Hides local mirror row only and explains it was already sent to engine |
| Debug injection | dev `afx:debug:inject-queue` listener | Allows visual iteration without manually queueing content              |

## [DES-COMPOSER-FILES-STRIP] Modified Files Strip

The Modified Files strip surfaces files touched by agent edit/write tool calls during the current chat
transcript. It reuses the generic `ComposerStrip` chrome (the same primitive used by the queue strip) and
mirrors the queue dismissal model: dismissing only hides local display, the underlying tool calls remain
in the transcript.

### Source

State is **derived** from `timeline` in `chat.tsx`. There is no protocol message that pushes "modified
files" — the helper `deriveModifiedFiles(timeline)` walks `ChatMessageView.tools[]` for assistant
messages and extracts file paths from tool calls whose `toolName` (case-insensitive) matches
`edit | write | patch | create | notebookedit`. Path keys probed in order: `path`, `filePath`,
`file_path`, `notebook_path`. Files are deduped by path with most-recent-win ordering.

`ChatToolView.firstChangedLine` carries the 1-indexed first-changed line from the tool result when
the harness reports one. The derive helper threads it onto `ModifiedFile.line`; the pill click
handler includes it in `chat/openFile { path, line }`; the host translates it to a 0-indexed
`vscode.Range` for the editor selection. Adapters that don't report the field leave it undefined,
and pills open the file at the top.

> **Reference adapter**: pi-mono's `edit` tool populates `result.details.firstChangedLine` —
> the 1-indexed line number of the first change in the new file. Other harnesses populate the
> same field to opt into line-aware navigation.

The strip survives webview hydration without extra plumbing — the rehydrated transcript regenerates
the same `ModifiedFile[]` deterministically.

### Dismiss-gate (per assistant turn)

The strip's ✕ button records the **current** `latestEditingAssistantMessageId`. The strip stays hidden
as long as that ID remains the latest. The next assistant message that produces an edit/write tool call
advances `latestEditingAssistantMessageId`, the equality check flips, and the strip reappears
(expanded with the latest pill list). Mid-turn edits do **not** reopen a dismissed strip — once a
turn is dismissed, the user has acknowledged the whole turn's batch.

### Stacking

The Modified Files strip renders **above** the Queue strip. Files are persistent session context;
queued messages are transient per-turn. This ordering keeps the most stable surface highest.

### State table

| State                             | Source anchor              | UI                                                                                                         |
| --------------------------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------- |
| No edits in transcript            | `FilesStrip`               | Returns `null`; composer layout collapses naturally                                                        |
| First edit lands                  | `FilesStrip`, `FilePill`   | Renders **expanded** with header `MODIFIED · 1` + horizontal pill list (basename + status dot) + ✕ control |
| User clicks chevron               | `ComposerStrip`            | Toggles strip between expanded (default) and collapsed (header-only)                                       |
| Pill click                        | `FilePill`, `bridgeSend`   | Sends `chat/openFile { path, line? }`; host opens file (and reveals line) via `showTextDocument`           |
| Repeated edit to same path        | `deriveModifiedFiles`      | Dedup keeps the most recent tool call's status and toolCallId                                              |
| ✕ dismiss                         | `handleDismissFiles`       | Records `dismissedAtAssistantMessageId`; strip hides                                                       |
| Mid-turn additional edit          | derived state              | Strip stays hidden while `latestEditingAssistantMessageId === dismissedAtAssistantMessageId`               |
| Next assistant turn produces edit | `latestEditingAssistantId` | `dismissedAt !== latestEditing` → strip reappears expanded with updated pill list                          |

### ASCII UI mockups

#### [DES-COMPOSER-MOCKUP-FILES-EMPTY] Empty (strip hidden)

```text
┌──────────────────────────────────────────────────────────────┐
│  Type a message…                                             │
├──────────────────────────────────────────────────────────────┤
│  [@]  [Sonnet 4.6 ▾]  [Thinking · off ▾]              [↑]   │
└──────────────────────────────────────────────────────────────┘
   Pi · 0 tokens · 0%                          ⏎ send
```

#### [DES-COMPOSER-MOCKUP-FILES-EXPANDED] Edits present, default-expanded

```text
┌─ ▾ MODIFIED · 3 ───────────────────────────────────── [✕] ──┐
│  ● chat.tsx:142  ○ messages.ts  ○ sidebar-panel.ts           │
└──────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────┐
│  Refactor the open-file handler…                             │
├──────────────────────────────────────────────────────────────┤
│  [@]  [Sonnet 4.6 ▾]  [Thinking · low ▾]              [↑]   │
└──────────────────────────────────────────────────────────────┘

  ●  running   ○  ok   ▲  error
  basename shown; `:line` shown when firstChangedLine is reported;
  full path on hover; click → opens in editor (jumps to line if known)
```

#### [DES-COMPOSER-MOCKUP-FILES-COLLAPSED] User clicks chevron to collapse

```text
┌─ ▸ MODIFIED · 3 ───────────────────────────────────── [✕] ──┐
└──────────────────────────────────────────────────────────────┘
```

#### [DES-COMPOSER-MOCKUP-FILES-WITH-QUEUE] Streaming with both strips

```text
┌─ ▾ MODIFIED · 4 ───────────────────────────────────── [✕] ──┐
│  ● composer.tsx   ○ chat.tsx   ○ messages.ts   ○ files-      │
│  strip.tsx                                                   │
└──────────────────────────────────────────────────────────────┘
┌─ ▾ QUEUED · 2 ────────────────────── [Clear all 🗑] ──────── ┐
│  ⚡ →   STEER       also rename the prop to onOpenFile       │
│  ↵ 1.   FOLLOW-UP   then run pnpm verify and report back     │
└──────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────┐
│  ▍                                                           │
├──────────────────────────────────────────────────────────────┤
│  [⚡ Steering…]  [Sonnet 4.6 ▾]  [Thinking · low ▾]  [⏸]    │
└──────────────────────────────────────────────────────────────┘
   Pi · 31.4k · 17% · $0.11        ⏎ follow-up · ⌘⏎ steer
```

#### [DES-COMPOSER-MOCKUP-FILES-DISMISS-FLOW] Dismiss-and-reappear flow

```text
turn 1   agent: [Edit X] [Edit Y]      strip shows · MODIFIED · 2
                                        (expanded; pills X, Y visible)
                            user ✕
                            → strip hidden
                            dismissedAtAssistantMessageId = msg-1

turn 2   user: "now edit Z"
turn 2   agent: [Edit Z]                latestEditingAssistantMessageId
                                          advances to msg-2
                                        ≠ dismissedAt → strip pops back
                                        MODIFIED · 3 (X, Y, Z)
```

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
| `compacting`  | Disabled composer + `[DES-COMPOSER-MOCKUP-COMPACTING]` copy           | Wait for completion; no send/compact overlap   |
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
| Manual compaction          | `FooterStrip`, placeholder      | Locks input with `Compacting session — wait for it to finish…`     |

---

## [DES-DEC] Key Decisions

| Decision                | Options Considered                             | Choice                  | Rationale                                                                             |
| ----------------------- | ---------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------- |
| Composer split          | Keep in `210-app-chat`, create child spec      | Child spec              | Footer/input changes are frequent and surgical                                        |
| Footer ownership        | Settings, runtime, composer                    | Composer                | Footer copy appears in composer and depends on composer actions                       |
| Helper ownership        | Shared UI, messages, composer                  | Composer                | Slash/mention helpers are input-driven                                                |
| System command routing  | Client detection, server detection             | Client detection        | Webview knows the draft text; extension host executes                                 |
| Shell selection         | Hardcoded `bash`, detect `$SHELL`, prompt      | Platform-aware spawn    | `bash` on macOS/Linux, `cmd`/`powershell` on Windows                                  |
| Concurrent execution    | Block while streaming, queue, allow            | Allow                   | Separate execution context from LLM stream; user can run `!top` while LLM writes code |
| Dangerous-pattern guard | Block all, allow all, confirm for destructive  | Confirm for destructive | Catches common accidents (`rm -rf`) without blocking safe commands                    |
| Workspace mode          | Separate mode service, workspace config, host  | Workspace config + host | Keeps Code default, Explore experimental/read-only, and lets the host prefix prompts  |
| Guardrail prompt        | No prompt prefix, local-only copy, host prefix | Host-injected prefix    | The strict Explore prompt must be injected before the runtime sees any Explore turn   |

---

## [DES-DATA] Data Model

Composer state includes input text, queued content metadata, selected model, thinking level, runtime readiness, busy/sending state, helper popup candidates, prompt-history cursor state, usage stats, and ephemeral note confirmations.

| Data shape          | Source anchor                      | Purpose                                                                                                      |
| ------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `RuntimeSettings`   | `chat.tsx`                         | Composer-visible subset of `AgentStatus` for thinking, queue modes, compaction/retry, session, and RPC state |
| `QueuedMessage`     | `chat.tsx`                         | Local display mirror for steer/follow-up content that was already sent while streaming                       |
| `UsageStats`        | `chat.tsx`                         | Footer tooltip and assistant metadata token/cost/context display                                             |
| `ComposerTrigger`   | `composer-detect.ts`               | Active slash/mention token location and query                                                                |
| `AgentCommand`      | `SlashPopup`, `displayCommandName` | Slash command list and action labels                                                                         |
| `AgentFileView`     | `MentionPopup`                     | Mention candidate list split by recent/workspace                                                             |
| `AgentModel`        | `ModelCombobox`                    | API/external model groups and combined selection identity                                                    |
| `ModifiedFile`      | `derive-modified-files.ts`         | Files touched by edit/write tool calls; derived per-render from transcript                                   |
| `WorkspaceMode`     | `chat.tsx` / `settings.tsx`        | Workspace posture state: `code` default, `explore` experimental/read-only                                    |
| `BlockedActionView` | `chat.tsx`                         | Host-blocked Explore command payload rendered by `BlockedCommandStrip`                                       |

---

## [DES-API] API Contracts

Composer actions use the chat webview transport. Message payloads are defined in shared packages; this spec owns how those payloads are surfaced in the composer.

| Direction       | Message/event                           | Composer owner                                                                                                                                       |
| --------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Webview to host | `chat/send`                             | Idle send with content and extracted mentions                                                                                                        |
| Webview to host | `chat/steer`                            | Streaming interrupt with content and extracted mentions                                                                                              |
| Webview to host | `chat/followUp`                         | Streaming follow-up with content and extracted mentions                                                                                              |
| Webview to host | `chat/abort`                            | Stop active turn                                                                                                                                     |
| Webview to host | `chat/saveNote`                         | Save draft as note via note capture spec                                                                                                             |
| Webview to host | `chat/getCommands`                      | Populate slash popup                                                                                                                                 |
| Webview to host | `chat/listFiles`                        | Populate mention popup                                                                                                                               |
| Webview to host | `chat/setModel`                         | Update active runtime model                                                                                                                          |
| Webview to host | `chat/setThinkingLevel`                 | Update runtime reasoning effort                                                                                                                      |
| Webview to host | `chat/setMode`                          | Update workspace posture via the shared `afx.setMode` command                                                                                        |
| Webview to host | `chat/setIncludeActiveFileContext`      | Persist the mirrored active-file context preference                                                                                                  |
| Webview to host | `chat/runCommand`                       | System command: stripped `!` prefix, shell command string, requestId                                                                                 |
| Webview to host | `chat/openFile`                         | Modified files strip pill click: `{ path, line? }` (workspace-relative or absolute; line is 1-indexed) — host calls `vscode.window.showTextDocument` |
| Host to webview | `agent/commandOutput`                   | Shell output stream: `requestId`, `streamId`, `delta` (partial line), `done` (final), `exitCode` (0–255), `error` (exception string)                 |
| Host to webview | `agent/commands`                        | Slash popup candidates                                                                                                                               |
| Host to webview | `agent/files`                           | Mention popup candidates                                                                                                                             |
| Host to webview | `agent/models`, `agent/modelChanged`    | Model picker candidates and active model                                                                                                             |
| Host to webview | `agent/settingsSnapshot`                | Mirrors durable active-file context preference and any other persisted Settings values                                                               |
| Host to webview | `agent/actionBlocked`                   | Renders the host-blocked Explore command strip                                                                                                       |
| Host to webview | `agent/runtimeSettings`, `agent/status` | Thinking/footer/readiness state                                                                                                                      |
| Host to webview | `chat/usage`                            | Footer usage tooltip state                                                                                                                           |

---

## [DES-FILES] File Structure

| File                                          | Purpose                                                     |
| --------------------------------------------- | ----------------------------------------------------------- |
| `apps/chat/src/views/chat.tsx`                | Composer layout, footer, queue/activity/control composition |
| `apps/chat/src/components/model-combobox.tsx` | Composer combined model/thinking picker                     |
| `apps/chat/src/components/slash-popup.tsx`    | Slash command helper                                        |
| `apps/chat/src/components/mention-popup.tsx`  | Mention helper                                              |
| `apps/chat/src/components/composer-strip.tsx` | Generic collapsible strip chrome (used by queue + files)    |
| `apps/chat/src/components/files-strip.tsx`    | Modified files strip + pill rendering (FR-10)               |
| `apps/chat/src/lib/composer-detect.ts`        | Composer helper detection                                   |
| `apps/chat/src/lib/derive-modified-files.ts`  | Pure helper: derives modified-file list from transcript     |
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
- **Explore guardrail**: The host prepends the strict read-only prompt before any Explore `send` / `steer` / `followUp` turn and blocks `chat/runCommand` before shell spawn, so no shell/edit/git operation can slip through the Explore path.
- **Explore guardrail**: When the workspace mode is Explore, the host prepends the strict read-only prompt before send/steer/follow-up turns and blocks `chat/runCommand` before any shell spawn occurs.

---

## [DES-ERR] Error Handling

| Scenario                       | Handling                                                                                                  |
| ------------------------------ | --------------------------------------------------------------------------------------------------------- |
| Runtime unavailable            | Footer and send state explain configuration/readiness path                                                |
| Bridge send fails              | Composer returns to editable state and surfaces failure through chat error UI                             |
| Helper parsing fails           | Fall back to plain text input without blocking send                                                       |
| Empty slash filter result      | Show "No commands match" empty state in popup; user can keep typing or press Escape to close              |
| Shell command timeout (30s)    | Terminate subprocess; emit `agent/commandOutput { error: "Command timed out after 30s", exitCode: -1 }`   |
| Shell non-zero exit            | Emit `agent/commandOutput { done: true, exitCode }`; output card shows exit code badge in amber           |
| Shell exception (ENOENT, etc.) | Emit `agent/commandOutput { error: <exception.message> }`; render error in red inline                     |
| Dangerous pattern before guard | Show `DangerousPatternGuard` confirm dialog; do not execute until user confirms                           |
| Workspace not open             | Show "No workspace folder open" error; disable system command input                                       |
| Explore command blocked        | Render `BlockedCommandStrip`, keep the draft available, and offer Switch to Code / Copy command / Dismiss |

---

## [DES-TEST] Testing Strategy

- Unit-test helper parsing where practical.
- Add chat view tests for footer/queue state when the surface changes.
- Add mode-specific tests for the toolbar posture chip, Explore prompt prefixing, and blocked-command strip.
- Add `slash-popup.test.tsx` for live filter narrowing, empty-state rendering, and Tab focus-transfer coverage.
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

| Task | File                                          | Required @see                                                                                                                                                                                                                                                                                                                      |
| ---- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.x  | `apps/chat/src/views/chat.tsx`                | `design.md [DES-COMPOSER-MOCKUP-IDLE] [DES-COMPOSER-MOCKUP-RUNTIME-MENU] [DES-COMPOSER-MOCKUP-STREAMING] [DES-COMPOSER-MOCKUP-MODE-COLLAPSED] [DES-COMPOSER-MOCKUP-MODE-DROPDOWN] [DES-COMPOSER-MOCKUP-BLOCKED-COMMAND] [DES-COMPOSER-CONTEXT] [DES-COMPOSER-FLOW] [DES-COMPOSER-RUNTIME] [DES-COMPOSER-COMPONENT-MODEL-COMBOBOX]` |
| 1.x  | `apps/chat/src/components/model-combobox.tsx` | `design.md [DES-COMPOSER-RUNTIME] [DES-COMPOSER-MOCKUP-RUNTIME-MENU]`                                                                                                                                                                                                                                                              |
| 1.x  | `apps/chat/src/components/slash-popup.tsx`    | `design.md [DES-COMPOSER-HELPERS] [DES-COMPOSER-COMPONENT-SLASH-POPUP] [DES-COMPOSER-MOCKUP-SLASH-FILTER]`                                                                                                                                                                                                                         |
| 1.x  | `apps/chat/src/components/mention-popup.tsx`  | `design.md [DES-COMPOSER-HELPERS]`                                                                                                                                                                                                                                                                                                 |
| 1.x  | `apps/chat/src/components/composer-strip.tsx` | `design.md [DES-COMPOSER-QUEUE] [DES-COMPOSER-FILES-STRIP]`                                                                                                                                                                                                                                                                        |
| 1.x  | `apps/chat/src/components/files-strip.tsx`    | `spec.md [FR-10]` + `design.md [DES-COMPOSER-FILES-STRIP]`                                                                                                                                                                                                                                                                         |
| 1.x  | `apps/chat/src/lib/composer-detect.ts`        | `design.md [DES-COMPOSER-HELPERS]`                                                                                                                                                                                                                                                                                                 |
| 1.x  | `apps/chat/src/lib/derive-modified-files.ts`  | `spec.md [FR-10]` + `design.md [DES-COMPOSER-FILES-STRIP]`                                                                                                                                                                                                                                                                         |
| 1.x  | `apps/chat/src/lib/mentions.ts`               | `design.md [DES-COMPOSER-HELPERS]`                                                                                                                                                                                                                                                                                                 |

## [DES-COMPOSER-LOC] Code Locator Map

| Map ID                     | Code anchor                                                                                                                                                         | Messages/settings/commands                                                                                        | Tests                                                                                                    |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `[Composer.Activity]`      | `apps/chat/src/views/chat.tsx` `ActivityBar`                                                                                                                        | `thinking_delta`, runtime streaming state                                                                         | `apps/chat/src/app.test.tsx`                                                                             |
| `[Composer.Queue]`         | `apps/chat/src/views/chat.tsx` `QueueStrip`, `QueueRow`; `composer-strip.tsx`                                                                                       | `chat/steer`, `chat/followUp`, `queue_update`                                                                     | `apps/chat/src/app.test.tsx`                                                                             |
| `[Composer.ModifiedFiles]` | `apps/chat/src/components/files-strip.tsx` `FilesStrip`, `FilePill`; `apps/chat/src/lib/derive-modified-files.ts`; `chat.tsx` integration                           | `chat/openFile`                                                                                                   | `derive-modified-files.test.ts`, `files-strip.test.tsx`, `apps/chat/src/app.test.tsx`                    |
| `[Composer.Input]`         | `apps/chat/src/views/chat.tsx` `InputGroupTextarea`, `handleDraftChange`, `onKeyDown`                                                                               | `chat/send`, `chat/saveNote`, `chat/listFiles`                                                                    | `apps/chat/src/app.test.tsx`                                                                             |
| `[Composer.Helpers]`       | `slash-popup.tsx`, `mention-popup.tsx`, `composer-detect.ts`, `mentions.ts`                                                                                         | `chat/getCommands`, `chat/listFiles`, `chat/newSession`, live filter query, Tab focus transfer                    | `composer-detect.test.ts`, `mentions.test.ts`, `slash-popup.test.tsx`                                    |
| `[Composer.Toolbar]`       | `apps/chat/src/views/chat.tsx` toolbar block; `model-combobox.tsx`; `ModeToggle`; `ActiveFileContextToggle`                                                         | `chat/setModel`, `chat/setThinkingLevel`, `chat/setMode`, `chat/openSettings`, `chat/setIncludeActiveFileContext` | `apps/chat/src/app.test.tsx`                                                                             |
| `[Composer.DocActions]`    | `apps/chat/src/components/chat-doc-actions-strip.tsx`; `chat-doc-kind-visual.ts`; `doc-actions.ts`; `command-catalog.ts`; `context-presets.ts`; `result-actions.ts` | `chat/activeDocContext`, draft insertion, `chat/send` / `chat/followUp` for deterministic commands                | `doc-actions.test.ts`, `command-catalog.test.ts`, `context-presets.test.ts`, `result-actions.test.ts(x)` |
| `[Composer.BlockedAction]` | `apps/chat/src/views/chat.tsx` `BlockedCommandStrip`, `copyBlockedCommand`, `restoreBlockedCommand`                                                                 | `agent/actionBlocked`, `chat/setMode`                                                                             | `apps/chat/src/app.test.tsx`                                                                             |
| `[Composer.Actions]`       | `apps/chat/src/views/chat.tsx` action buttons, `submit`, `abort`                                                                                                    | `chat/send`, `chat/steer`, `chat/followUp`, `chat/abort`                                                          | `apps/chat/src/app.test.tsx`                                                                             |
| `[Composer.Footer]`        | `apps/chat/src/views/chat.tsx` `FooterStrip`, `PiPill`, `usageTooltip`                                                                                              | `agent/runtimeStatus`, usage stats, `afx.rpc.enabled`                                                             | `apps/chat/src/app.test.tsx`                                                                             |

## [DES-COMPOSER-TRACE] Functional Trace Matrix

| Requirement | Design nodes                                                                                                                                                 | Code anchors                                                                                                                                                                  | Verification                                                                                                              |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| FR-1        | `DES-COMPOSER-MOCKUP-IDLE`, `DES-COMPOSER-MOCKUP-STREAMING`, `DES-COMPOSER-MOCKUP-COMPACTING`, `DES-COMPOSER-COMPONENTS`, `DES-COMPOSER-KEYS`                | `Chat`, `InputGroupTextarea`, `submit`, `abort`, `onKeyDown`                                                                                                                  | `apps/chat/src/app.test.tsx`; future e2e keyboard coverage                                                                |
| FR-2        | `DES-COMPOSER-FOOTER`, `DES-COMPOSER-MOCKUP-COMPACTING`                                                                                                      | `ActivityBar`, `FooterStrip`, `usageTooltip`, placeholder logic                                                                                                               | `apps/chat/src/app.test.tsx`                                                                                              |
| FR-3        | `DES-COMPOSER-HELPERS`, `DES-COMPOSER-COMPONENT-SLASH-POPUP`, `DES-COMPOSER-MOCKUP-SLASH-FILTER`                                                             | `detectComposerTrigger`, `filterQuery`, `SlashPopup`, `MentionPopup`, `insertAtTrigger`, `selectSlashAction`, `extractMentions`, `focusPopupOnTab`                            | `composer-detect.test.ts`, `mentions.test.ts`, `slash-popup.test.tsx`, `app.test.tsx`                                     |
| FR-4        | `DES-COMPOSER-QUEUE`                                                                                                                                         | `QueuedMessage`, `QueueStrip`, `QueueRow`, `dismissQueued`, `clearAllQueued`                                                                                                  | `apps/chat/src/app.test.tsx`                                                                                              |
| FR-5        | `DES-COMPOSER-MOCKUP-IDLE`, `DES-COMPOSER-MOCKUP-RUNTIME-MENU`, `DES-COMPOSER-RUNTIME`                                                                       | `ModelCombobox`, `selectModel`, `setThinkingLevel`                                                                                                                            | `app.test.tsx`; model-combobox tests when changed                                                                         |
| FR-6        | `DES-COMPOSER-KEYS`                                                                                                                                          | `navigatePromptHistory`, `collectPromptHistory`, `applyHistoryDraft`                                                                                                          | `app.test.tsx`; future dedicated history recall test                                                                      |
| FR-7        | `DES-COMPOSER-FOOTER`                                                                                                                                        | `ActivityBar`, `chat/thinkingDelta` handler                                                                                                                                   | `app.test.tsx`                                                                                                            |
| FR-8        | `DES-COMPOSER-FLOW`, `DES-API`                                                                                                                               | `bridgeSend` calls only; no VSCode API imports in chat webview                                                                                                                | architecture lint/no-restricted-imports                                                                                   |
| FR-9        | `DES-COMPOSER-FLOW`, `DES-UI`, `DES-COMPOSER-COMPONENTS`, `DES-COMPOSER-KEYS`, `DES-API`, `DES-SEC`, `DES-ERR`                                               | Prefix detection in `submit()`, `chat/runCommand` bridge send, `ShellBadge` badge state, `DangerousPatternGuard`, `OutputCard` timeline render, `agent/commandOutput` handler | Unit test: system command dispatched when draft starts with `!`; dangerous pattern blocks without guard confirm           |
| FR-10       | `DES-COMPOSER-FILES-STRIP`, `DES-COMPOSER-MOCKUP-FILES-COLLAPSED`, `DES-COMPOSER-MOCKUP-FILES-EXPANDED`, `DES-COMPOSER-MOCKUP-FILES-DISMISS-FLOW`            | `deriveModifiedFiles`, `FilesStrip`, `FilePill`, `bridgeSend({ type: "chat/openFile", path })`; host `case "chat/openFile":` calls `vscode.window.showTextDocument`           | `derive-modified-files.test.ts`, `files-strip.test.tsx`; e2e: pill click opens file in extension dev host                 |
| FR-11       | `DES-COMPOSER-CONTEXT`, `DES-COMPOSER-MOCKUP-IDLE`, `DES-COMPOSER-MOCKUP-STREAMING`, `DES-COMPOSER-KEYS`, `DES-API`, `DES-COMPOSER-REFS`                     | `ActiveFileContextToggle`, `applyIncludeActiveFileContext`, `chat/setIncludeActiveFileContext`, `agent/settingsSnapshot`                                                      | `app.test.tsx`, settings snapshot tests, small-screen toolbar tests                                                       |
| FR-12       | `DES-COMPOSER-MOCKUP-MODE-COLLAPSED`, `DES-COMPOSER-MOCKUP-MODE-DROPDOWN`, `DES-COMPOSER-COMPONENT-MODE-TOGGLE`, `DES-COMPOSER-RUNTIME`, `DES-COMPOSER-REFS` | `ModeToggle`, `WORKSPACE_MODES`, `chat/setMode`, `WorkspaceMode`                                                                                                              | `app.test.tsx`, mode snapshot tests, settings mode coverage                                                               |
| FR-13       | `DES-COMPOSER-MOCKUP-BLOCKED-COMMAND`, `DES-COMPOSER-COMPONENT-BLOCKED-COMMAND-STRIP`, `DES-COMPOSER-REFS`, `DES-API`, `DES-SEC`, `DES-ERR`                  | `BlockedCommandStrip`, `BlockedActionView`, `restoreBlockedCommand`, `copyBlockedCommand`, `agent/actionBlocked`                                                              | `app.test.tsx`, blocked-command tests, Explore guardrail coverage                                                         |
| FR-14       | `DES-COMPOSER-MOCKUP-MODE-COLLAPSED`, `DES-COMPOSER-MOCKUP-MODE-DROPDOWN`, `DES-COMPOSER-COMPONENT-MODE-TOGGLE`, `DES-COMPOSER-RUNTIME`                      | `ModeToggle`, `WORKSPACE_MODES`, `data-workspace-mode` CSS accent, Spec footer hint, `chat/setMode`                                                                           | `app.test.tsx`, mode snapshot tests, settings mode coverage                                                               |
| FR-15/FR-16 | `DES-COMPOSER-COMPONENT-STRIP`                                                                                                                               | `ChatDocActionsStrip`, `MemoryDropdown`, `ChatCommandPresetSubmenu`, `ResultActions`, `resolveDocActions`, `MEMORY_CATALOG`, `COMMAND_CONTEXT_PRESETS`, `parseResultActions`  | Unit: command/doc/memory/preset/result parser + component tests; E2E required for doc-action menu and result-action chips |
| NFR-6       | `DES-UI`, `DES-SEC`, `DES-ERR`                                                                                                                               | Amber "Shell" badge, persistent footer warning, dangerous-pattern guard, timeout enforcement, output card styling                                                             | E2E: badge visible when draft starts with `!`; guard shown for `rm -rf`; output renders in timeline                       |
| NFR-7       | `DES-COMPOSER-CONTEXT`, `DES-COMPOSER-MOCKUP-IDLE`, `DES-COMPOSER-MOCKUP-STREAMING`                                                                          | `ActiveFileContextToggle`, compact toolbar placement                                                                                                                          | `app.test.tsx` narrow-width composer coverage                                                                             |
| NFR-1       | `DES-COMPOSER-KEYS`                                                                                                                                          | `onKeyDown`                                                                                                                                                                   | e2e keyboard regression tests when changed                                                                                |
| NFR-2       | `DES-COMPOSER-FOOTER`                                                                                                                                        | `FooterStrip`                                                                                                                                                                 | focused copy snapshot/assertions when changed                                                                             |
| NFR-3       | `DES-COMPOSER-MOCKUPS`, `DES-COMPOSER-MOCKUP-COMPACTING`, `DES-COMPOSER-QUEUE`                                                                               | stable bottom layout around `InputGroup`/`QueueStrip`                                                                                                                         | visual/e2e checks when layout changes                                                                                     |
| NFR-4       | `DES-COMPOSER-HELPERS`, `DES-COMPOSER-COMPONENT-SLASH-POPUP`                                                                                                 | `detectComposerTrigger`, `filterQuery`, `extractMentions`, `focusPopupOnTab`                                                                                                  | helper unit tests, `slash-popup.test.tsx`                                                                                 |
| NFR-5       | `DES-COMPOSER-REFS`, `DES-COMPOSER-LOC`                                                                                                                      | file/local `@see` anchors                                                                                                                                                     | `rg "@see docs/specs/211-app-chat-composer"` and `/afx-check trace`                                                       |

---

## [DES-COMPOSER-QUESTIONS] Open Technical Questions

None.
