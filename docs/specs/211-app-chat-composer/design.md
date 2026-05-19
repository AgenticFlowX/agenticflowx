---
afx: true
type: DESIGN
status: Living
owner: "@rixrix"
version: "1.19"
created_at: "2026-05-02T23:56:50.000Z"
updated_at: "2026-05-19T13:55:39.000Z"
tags:
  ["app", "chat", "composer", "webview", "mode", "workspace-mode", "prompt", "host-guard", "intent"]
spec: spec.md
---

# App Chat Composer - Technical Design

---

## [DES-OVR] Overview

The composer is the bottom interaction surface of the chat webview. It coordinates local input state, runtime readiness, queued content, helper popups, the combined model/thinking control, and bridge-driven send/steer/abort actions.

System commands (FR-9) extend the composer with local shell execution: typing `!ls` and pressing Enter dispatches `chat/runCommand` instead of `chat/send`, executes the command in the extension host via `child_process.spawn`, and streams output back via `agent/commandOutput` events. UX uses an amber "Shell" badge and persistent footer warning (not blocking); a dangerous-pattern guard prompts confirmation for `rm -rf`, `del /f /s`, `format`, `mkfs`, `dd`.

The composer also mirrors the durable active-file context preference from Settings. That toggle stays compact and visible next to the workspace mode control so users can keep it on by default without leaving the chat surface.
The combined model/thinking control uses shadcn tooltips to explain what each choice does without relying on native browser titles.
Prompt shaping stays host-owned: the webview captures intent and explicit mentions, while the extension host decides whether to inject active-file context and when to inflate workspace file contents before the runtime ever sees the prompt.
The same toolbar now also carries the workspace posture control: Code is the default full-access Pi-backed mode, while Explore is the experimental read-only posture for inspection, tracing, and planning. The chip intentionally uses a sliders-style icon so it reads as posture selection rather than compact/session functionality.
When Explore rejects a shell command, the webview renders a blocked-command panel with copy, dismiss, and switch-to-Code affordances instead of silently failing.

Composer Intent is a lightweight, parent-aware prompt-control panel above the composer. It is visible only in Code and Explore modes, persists a slot index, and sends that slot with outbound turns. Default injects zero prompt text; non-default slots expose static token estimates, tooltip previews, and a full prompt popover while leaving host-owned guardrails dominant.

---

## [DES-ARCH] Architecture

```text
Chat view state
  ├─ composer input and keyboard policy
  ├─ helper popups: slash and mention
  ├─ controls: combined model/thinking, workspace mode, Intent slot, active-file context, send, steer, abort
  ├─ queue/footer/activity rendering
  └─ transport bridge messages to VSCode host
  └─ system command execution (! prefix → child_process.spawn)
  └─ host-blocked Explore command feedback (agent/actionBlocked)
```

Composer logic stays in the chat webview. The VSCode extension host owns command execution and runtime services. Shell commands are executed in a separate context from the LLM stream, enabling concurrent execution.
Prompt shaping for file context follows the same boundary: the webview stays UI-only, and the host performs mention normalization, workspace file expansion, and AgentManager dispatch so later prompt-injection features can plug in at one stable boundary.

Chat-window componentization routes composer placement and shallow file boundaries to `docs/specs/216-app-chat-window-componentization/design.md`. This composer spec remains the durable behavior owner for `ComposerDock`, `ComposerActivityBar`, `ComposerPanelStack` content, `ComposerInput`, `ComposerToolbar`, `ComposerActions`, and `ComposerFooter`.

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

| Flow                | Source anchor                                     | Bridge message                                  | Host/runtime result                                                       | Returned state                                                              |
| ------------------- | ------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Idle send           | `submit({ followUp: false })` when `!isStreaming` | `chat/send`                                     | Starts a user turn                                                        | `chat/messageStart`, `chat/messageDelta`, `chat/messageEnd`, `agent/status` |
| Streaming follow-up | `submit({ followUp: true })`                      | `chat/followUp`                                 | Queues content after active turn                                          | Local `queued` mirror plus future stream state                              |
| Streaming steer     | `submit({ followUp: false })` while streaming     | `chat/steer`                                    | Interrupts/redirects active turn                                          | Local `queued` mirror plus runtime stream state                             |
| Abort               | `abort()`                                         | `chat/abort`                                    | Stops active run                                                          | `chat/aborted`, `agent/status`                                              |
| Save note           | `saveAsNote()`                                    | `chat/saveNote`                                 | Host appends note                                                         | Local note event plus note bridge result                                    |
| Slash action        | `selectSlashAction()`                             | `chat/newSession`, `chat/abort`                 | Host action without textarea insertion                                    | New session/abort events                                                    |
| Mention picker      | `handleDraftChange()`, `openMentionPicker()`      | `chat/listFiles`                                | Host lists recent/workspace files                                         | `agent/files`                                                               |
| Slash picker        | mount hydration                                   | `chat/getCommands`                              | Host lists agent/extension commands                                       | `agent/commands`                                                            |
| Model picker        | `selectModel()`                                   | `chat/setModel`                                 | Runtime default/model changes                                             | `agent/modelChanged`                                                        |
| Thinking picker     | `setThinkingLevel()`                              | `chat/setThinkingLevel`                         | Runtime effort changes                                                    | `agent/runtimeSettings`                                                     |
| Context picker      | `applyIncludeActiveFileContext()`                 | `chat/setIncludeActiveFileContext`              | Durable active-file context preference changes                            | `agent/settingsSnapshot`                                                    |
| Intent picker       | `setIntentSlot()` / `setIntentMinimized()`        | `chat/setIntentSlot`, `chat/setIntentMinimized` | Durable Composer Intent slot/header state changes                         | `agent/settingsSnapshot.intent`                                             |
| System command      | `submit()` when draft starts with `!`             | `chat/runCommand`                               | Spawns shell in workspace root                                            | `agent/commandOutput` (delta / done / error)                                |
| Open modified file  | `modified-files` panel pill click                 | `chat/openFile`                                 | `vscode.window.showTextDocument(uri, { selection })` when `line` provided | Editor opens (and reveals first changed line if known)                      |

---

## [DES-UI] User Interface & UX

The composer must keep the primary action obvious while showing runtime readiness and queue state in compact footer copy. Keyboard instructions should be state-aware and avoid generic prompts when the runtime is unavailable or content is queued.

Visual placement source of truth: use `docs/specs/216-app-chat-window-componentization/design.md [DES-UI]` first for where composer regions appear in the chat window. This composer design owns how those regions behave once located: input states, toolbar controls, action routing, panel content, queue behavior, blocked-command feedback, and footer copy.

## [DES-COMPOSER-MOCKUPS] Composer ASCII UI State Mockups

### [DES-COMPOSER-MOCKUP-IDLE] Idle Ready State

The idle state renders one primary send action and keeps the combined model/thinking control compact enough for the VS Code side panel.

```text
+--------------------------------------------------------------------+
| [Composer.Activity]  dot idle  AFX ready                           |
+--------------------------------------------------------------------+
| [Composer.InputGroup]                                              |
|  [@] [Composer.Input: Ask AFX about this workspace ...]        [^] |
|      [Composer.Model: Model - Minimal ▾] | [Sliders] Code [FileText] [File ctx: On] |
+--------------------------------------------------------------------+
| [Composer.Footer] Pi/API status . usage . "Enter send . Cmd+Shift" |
+--------------------------------------------------------------------+
```

### [DES-COMPOSER-MOCKUP-RUNTIME-MENU] Combined Model And Thinking Menu

The root menu always exposes thinking levels first, then model groups inline in the same vertical
surface so provider and external-agent choices stay grouped without opening a sideways submenu.

```text
┌──────────────────────────────── Combined menu ───────────────────────────────┐
│ Thinking Level                                                               │
│ • Minimal                                                                    │
│ • Low                                                                        │
│ • Medium                                                                     │
│ • High                                                                       │
│ • Extra High                                                                 │
│                                                                              │
│ Model                                                                        │
│ Provider                                                                     │
│   • OpenAI · GPT-5.4 mini                                                   │
│   • Anthropic · Claude Sonnet                                               │
│ External Agents                                                              │
│   • Pi CLI                                                                  │
│   • OpenCode                                                                │
└──────────────────────────────────────────────────────────────────────────────┘
```

### [DES-COMPOSER-MOCKUP-INTENT] Composer Intent Panel

The Intent panel is a `ComposerPanelStack` workflow panel rendered above the input group in Code and Explore modes only. It uses the shared panel collapse chrome; the header remains a one-line chip when minimized and includes the active Intent label, the `Intent guide` prompt-preview badge for non-default slots, prompt-preview icon, and minimize button. There is intentionally no dismiss `✕`.

```text
+----------------------------- 🧭 Intent ----------- [Ask] [Intent guide] [i] [-] +
| [Default]━━━━[Ask]━━━━━━━━━━━━━━━━[Architect]━━━━━━━━━━━━━━━━[Code|PRD]        |
| Ask — direct, concise answers. Explanation, examples, trade-offs.             |
+--------------------------------------------------------------------------------+
```

Slot identity is persisted by index, not raw intent id. Slot `4` renders `Code` under parent mode Code and `PRD` under parent mode Explore, so switching parent modes preserves the user's stance position while remapping the parent-specific label/prefix.

### [DES-COMPOSER-MOCKUP-NOTICE] Composer Notice Panel

`ComposerNoticePanelBody` is the reusable body shell for low-noise product messages.

| Aspect      | Contract                                                                |
| ----------- | ----------------------------------------------------------------------- |
| Panel id    | Feature-owned, domain-specific id such as `afx-command-suggest`.        |
| Chrome      | Standard `ComposerPanel` owns title, border tone, dismiss, and actions. |
| Variants    | `tip`, `info`, `alert`, `news`, `success`.                              |
| Duplication | Do not duplicate a more specific workflow panel such as `doc-actions`.  |

```text
+----------------------------- Product Tip ---------------------- [Action] [x] +
| Tip                                                                        |
| That command worked here. Switch to Spec mode for the action rail.          |
+----------------------------------------------------------------------------+
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
|      [Composer.Model: Model - High ▾] | [Sliders] Code [FileText] [File ctx: On] [Follow-up ⏎] [Steer ⌘⏎] [Stop] |
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
|      [Composer.Model: Model - Medium] | [FileText] [File ctx: On] |
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
|      [Composer.Model: Model - Medium] | [Sliders] Code [FileText] [File ctx: On] |
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

### [DES-COMPOSER-MOCKUP-BLOCKED-COMMAND] Explore Blocked Command Panel

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
ChatWindow
  ChatTopBar                    -> parent chat/runtime action row, not composer-owned
  ConversationPane              -> message zone, composer inserts quick-command text only
  ComposerDock
    ComposerActivityBar         -> [Composer.Activity]
    ComposerPanelStack          -> [Composer.Queue], modified files, blocked actions, doc actions, suggestions
      ComposerPanel             -> reusable chrome for optional composer panels
      QueueRow                  -> steer/follow-up row, local mirror only
      BlockedCommandPanelBody   -> host-blocked runCommand feedback and switch/copy/dismiss affordances
    ComposerInput               -> [Composer.InputGroup]
      SlashPopup                -> [Composer.Helpers.Slash]
      MentionPopup              -> [Composer.Helpers.Mention]
      InputGroupTextarea        -> [Composer.Input]
    ComposerToolbar
      mention button            -> opens MentionPopup and lists files
      ModelCombobox             -> combined model/thinking selector with inline API/external groups
      ModeToggle                -> workspace posture selector (Code default / Explore experimental)
      ActiveFileContextToggle   -> durable active-file context toggle mirrored in Settings
    ComposerActions
      Send                      -> idle send
      Follow-up                 -> streaming follow-up
      Steer                     -> streaming interrupt
      Stop                      -> abort active turn
    ComposerFooter              -> [Composer.Footer]
```

| Surface                    | Owned behavior                                                                              | Not owned here                         |
| -------------------------- | ------------------------------------------------------------------------------------------- | -------------------------------------- |
| `[Composer.Activity]`      | Live thinking preview and idle/busy row above composer                                      | Full timeline thinking blocks          |
| `[Composer.Queue]`         | Local display of messages already sent as steer/follow-up                                   | Engine-authoritative queue scheduling  |
| `[Composer.Input]`         | Draft text, placeholder, keyboard routing, prompt-history recall                            | Message timeline rendering             |
| `[Composer.Helpers]`       | Slash/mention trigger detection, picker display, insertion/action dispatch                  | Command implementation in host         |
| `[Composer.Toolbar]`       | Mention button, combined model/thinking selector, mode selector, active-file context toggle | Workspace posture and context controls |
| `[Composer.Actions]`       | Send/follow-up/steer/stop affordances                                                       | Agent implementation                   |
| `[Composer.Footer]`        | Compact runtime readiness, Pi state, usage hints                                            | Full settings diagnostics              |
| `[Composer.BlockedAction]` | Host-blocked shell command panel, command copy, dismiss, switch to Code affordance          | Host shell guardrail handling          |

### ModeToggle Code Contract

| Code anchor             | Component contract                                                                                                 |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `ModeToggle`            | Owns the workspace posture chip, tooltip, dropdown menu, and current selection echo in the narrow composer toolbar |
| `WORKSPACE_MODES`       | Defines the Code/Explore option copy and the Explore `Experimental` badge                                          |
| `setMode`               | Sends `chat/setMode` with the selected `WorkspaceMode` and keeps the local toolbar state in sync                   |
| `restoreBlockedCommand` | When the blocked panel switches back to Code, restores the exact command into the draft before focus returns       |

### [DES-COMPOSER-COMPONENT-BLOCKED-COMMAND-STRIP] Blocked Command Panel

| Code anchor               | Component contract                                                                                       |
| ------------------------- | -------------------------------------------------------------------------------------------------------- |
| `BlockedCommandPanelBody` | Renders the host-blocked Explore action panel with warning copy, command copy, switch, and dismiss hooks |
| `BlockedActionView`       | Host-only payload describing the blocked command, title, message, and mode                               |
| `copyBlockedCommand`      | Copies the original `!` command text to the clipboard                                                    |
| `restoreBlockedCommand`   | Restores the blocked command into the textarea and switches workspace mode back to Code                  |

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
  -> chat-controller bridge subscription for "agent/commandOutput"
  -> <OutputCard> rendered by ConversationTimeline
```

### Step-by-step responsibilities

| Step             | Who                                             | What                                                                                            |
| ---------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Draft input      | User                                            | Types `!ls -la src/` in composer                                                                |
| Prefix detection | `ComposerInput` / `ComposerActions` submit path | `draft.trim().startsWith("!")` — client-side, before any bridge call                            |
| Bridge dispatch  | `chat-controller.tsx` action via `bridgeSend()` | Sends `{ type: "chat/runCommand", requestId, command }`; **`!` is stripped**; never sent to LLM |
| Bridge reception | `sidebar-panel.ts` `dispatchInbound`            | Switches on `"chat/runCommand"` case                                                            |
| Shell execution  | `sidebar-panel.ts` `handleRunCommand()`         | `child_process.spawn()` with platform shell, workspace CWD, 30s timeout                         |
| Output streaming | `sidebar-panel.ts` → `transport.emit()`         | Streams `agent/commandOutput { delta, done, exitCode, error }` back to webview                  |
| Timeline render  | `chat-controller.tsx` + `ConversationTimeline`  | `<OutputCard>` shows monospace stdout (muted), stderr (red), exit badge (amber)                 |

### Client-side prefix detection (snippet)

```typescript
// apps/chat/src/components/chat/composer-actions.tsx + chat-controller.tsx - submit()
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
// apps/chat/src/components/chat/conversation-timeline.tsx
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

| Code anchor               | Component contract                                                                                                                    |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `ModelCombobox`           | Owns composer model/thinking chrome, compact trigger label, inline vertical model groups, and Settings fallback                       |
| `groupModels`             | Splits API-provider models from external-agent models and sorts both groups by provider/instance id                                   |
| `renderModelItem`         | Shows display name, raw model id, and compact context window                                                                          |
| `isSameModel`             | Uses provider, id, and instance id so API and external models do not collide                                                          |
| `THINKING_LEVELS`         | Maps runtime effort values to the always-visible thinking section and closed trigger label                                            |
| `formatComposerSelection` | Displays generic Model plus thinking label in the narrow toolbar trigger; full selected model moves to tooltip and accessibility copy |

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

### [DES-COMPOSER-COMPONENT-QUEUE] QueuePanel And Queue Rows

| Code anchor  | Component contract                                                                           |
| ------------ | -------------------------------------------------------------------------------------------- |
| `QueuePanel` | Composer-owned queue panel body that separates steer rows from follow-up rows                |
| `QueueRow`   | Renders one local queue mirror row and dismiss button; dismissal does not cancel engine work |

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

| Control             | Source anchor                | Data                                                        | Behavior                                                                                                               |
| ------------------- | ---------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Combined trigger    | `ModelCombobox`              | `AgentModel[]`, `ThinkingLevel`, active `agentStatus.model` | Shows compact Model plus thinking label, exposes full model in tooltip/accessibility copy, and opens one vertical menu |
| Empty model list    | `ModelCombobox`              | no `models`                                                 | Keeps thinking choices visible and offers Settings fallback                                                            |
| Model item          | `renderModelItem`            | `name`, `id`, `contextWindow`                               | Shows compact display name and context window                                                                          |
| Model select        | `selectModel`                | `provider`, `id`, `instanceId`                              | Sends `chat/setModel`, resets prompt-history cursor, focuses textarea                                                  |
| Thinking select     | `selectThinkingLevel`        | `ThinkingLevel`                                             | Sends `chat/setThinkingLevel` and optimistically updates runtime state                                                 |
| Workspace mode      | `ModeToggle`                 | `WorkspaceMode`, `snapshot.mode.active`                     | Sends `chat/setMode`, keeps Code default, Explore experimental/read-only                                               |
| Blocked action      | `BlockedCommandPanelBody`    | `BlockedActionView`                                         | Renders Explore rejection panel; Switch to Code restores the draft                                                     |
| Runtime unavailable | `canSend`, placeholder logic | `agentStatus.phase`, `runtimeConfigured`, `rpcEnabled`      | Disables textarea/actions and routes user to setup copy                                                                |

## [DES-COMPOSER-CONTEXT] Active File Context Toggle

The active-file context toggle is a mirrored preference, not a separate data source. Settings owns
the durable value, the composer renders the quick toggle, and the extension host remains the source
of truth for persistence and prompt shaping. The composer control stays compact: switch first,
filename label second, and the full path exposed in the hover tooltip. The webview never reads the
workspace file contents itself; it sends intent, and the host performs the injection.

Workspace mode follows the same host-owned pattern. The composer sends `chat/setMode`, the host
routes that to `afx.setMode`, and the persisted `afx.mode.active` value rehydrates both the chat
toolbar and the settings card. The toolbar trigger displays only the active value (`Code`,
`Explore`, or `Spec`) to match the combined model/thinking control's compact active-value style.

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
  + workspace mode (Code / Explore / Spec)
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
directly; it routes to `afx.setMode`, which persists `afx.mode.active` globally by default, preserves
an existing workspace override when one is already configured, and then refreshes the shared settings
snapshot for both Settings and the composer toolbar.

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
│  [@]   [Model - Minimal ▾]   |   [○] journal.md   [Send]                   │
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

## [DES-COMPOSER-COMPONENT-STRIP] Composer Panel Variants

The anchor keeps its historical `STRIP` name for existing `@see` links, but the current implementation
uses `ComposerPanelStack` + `ComposerPanel` chrome. Each panel registers through
`controller.composerPanelStackConfig`; body components render content only, while `ComposerPanel`
supplies title, count, tone, collapse, dismiss, header actions, and error-boundary behavior. The parent
visual placement map is `216-app-chat-window-componentization/design.md [DES-UI]`.

Completed-message `result-actions` remain the timeline exception: they use the same command catalog
policy but render as lightweight inline buttons under assistant output, not as composer panels.

### [DES-COMPOSER-NOTICE-PANEL] Generic Notice Body

| Concern      | Owner / Rule                                                                   |
| ------------ | ------------------------------------------------------------------------------ |
| Body content | `ComposerNoticePanelBody` renders icon, variant label, and caller copy.        |
| Panel chrome | Registering feature owns title, id, tone, actions, dismiss, and collapse.      |
| Fit          | Use for small product messages; avoid one-off body components for simple tips. |
| Non-goal     | Not a replacement for specific workflow panels or assistant result actions.    |

| Panel / Variant       | Trigger                                                                                                              | Current Surface                                                                                             | Purpose                                                                                                                                                                                                                                                                                                           |
| --------------------- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `modified-files`      | `agent/modifiedFiles` payload                                                                                        | `FilesPanelBody` inside `ComposerPanel(id="modified-files")`                                                | Surface files the agent modified during a turn                                                                                                                                                                                                                                                                    |
| `queue`               | One or more queued steer/follow-up rows                                                                              | `QueuePanel` inside `ComposerPanel(id="queue")`; header action `Clear all`                                  | Show queued composer messages awaiting acceptance                                                                                                                                                                                                                                                                 |
| `blocked-command`     | `agent/actionBlocked` payload                                                                                        | `BlockedCommandPanelBody` inside `ComposerPanel(id="blocked-command")`; action `Switch to Code`             | Show the rejected Explore-mode shell command with copy/switch affordances                                                                                                                                                                                                                                         |
| `doc-actions`         | Active editor is an AFX doc (sprint, 4-file, journal, ADR, research, context)                                        | `ChatDocActionsPanelBody` inside `ComposerPanel(id="doc-actions")`; non-Spec header action `Switch to Spec` | SDD intent buttons routed by detected format; Spec mode shows more primaries, non-Spec modes keep the panel compact and optional; no separate detector panel renders when the stepper is already visible                                                                                                          |
| notice panels         | Feature-owned tips, information, alerts, news, or success messages                                                   | `ComposerNoticePanelBody` inside `ComposerPanel(id=<domain-specific id>)`                                   | Reusable body shell for low-noise product messages. Header actions, collapse, dismiss, title, and border tone remain owned by `ComposerPanel`                                                                                                                                                                     |
| `afx-command-suggest` | Successful AFX command in Code mode, not dismissed                                                                   | `ComposerNoticePanelBody kind="tip"` inside `ComposerPanel(id="afx-command-suggest")`                       | Suggests Spec mode after a command-driven workflow succeeds                                                                                                                                                                                                                                                       |
| `result-actions`      | Completed assistant message includes an explicit `Next:` / `Next (ranked):` section with `/afx-*` follow-up commands | Host-owned assistant-message `RUN NEXT` rail                                                                | History-adjacent buttons parsed from AFX prose only; the parsed `Next` prose is hidden after extraction, top three commands render, separator rows stop parsing, auto-send commands run immediately, draft-first commands insert into the composer, and long commands stay available via tooltip/accessible names |

Above-composer panels render in the order built by `chat-controller.tsx`: modified-files, queue,
blocked-command, doc-actions, then feedback notices such as afx-command-suggest. The registry may omit invisible
panels without changing the surrounding composer layout.

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

At narrow sidebar widths, `ComposerPanel` acts as a container boundary for doc-action compaction:
the document title/status truncate in the header, the primary action row stays on one physical line,
and the row measures available width before moving lower-priority buttons into a single
ellipsis-backed `Document actions` dropdown. This prevents the panel from leaving unused space while
buttons are hidden, and prevents controls from wrapping into stacked button columns when the chat
view is placed in either VS Code sidebar.

Completed-message `Next:` actions do not reuse composer panel chrome. They sit under
the assistant markdown as one compact `RUN NEXT` rail so the history does not gain a second
table-like panel. Buttons are tall enough for pointer/touch hit targets but remain visually
tight: one physical row where space allows, wrapped rows only at narrow widths, and command
text clipped inside stable button bounds. The parser only reads explicit `Next:` /
`Next (ranked):` sections, accepts ranked list items and unlisted bare `/afx-*`
command lines from model variants, stops at separator rows such as `──`, renders at
most three actions, and hides the parsed prose once button extraction succeeds.
Before markdown rendering, stale obsolete machine-action marker blocks are stripped
as display garbage only; they are not parsed into actions:

```text
+--------------------------------------------------------------------+
| Assistant 01:41                                                   |
| Reviewed the active task.                                         |
|                                                                    |
| RUN NEXT  [Verify /afx-sprint verify dapi-394-warm-contain... Run] |
|           [Design /afx-sprint design dapi-394-warm-contai... Draft]|
|           [Tasks  /afx-sprint task dapi-394-warm-containe... Draft]|
|                                                                    |
| · IDLE                                                            |
+--------------------------------------------------------------------+
```

Narrow sidebar layout keeps the same compact rail shape and lets only the label/command text
truncate:

```text
+----------------------------------------------+
| RUN NEXT                                     |
| [Verify /afx-sprint verify dapi-394-w... Run]|
| [Design /afx-sprint design dapi-394-w...    ]|
| [Tasks  /afx-sprint task dapi-394-war...    ]|
+----------------------------------------------+
```

Supported catalog commands in this history row follow their catalog policy: `autoSend` commands call
the direct send path, while draft-first commands insert into the textarea. Unsupported parsed commands
render disabled-looking buttons with tooltip guidance instead of silently inserting into the draft.
Long command text truncates visually but remains available through tooltip and accessible names.
On tasks.md, the visible doc-actions panel is split by behavior, not by command family: Compose controls (`Code`,
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
panels stay bounded to four primary actions plus `More`; lower-priority catalog commands such as
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

### Spec stepper inside the doc-actions panel body (FR-17, FR-18)

The doc-actions panel body renders a dedicated `<SpecStepper>` row above the action group whenever
the active doc is `spec.md` / `design.md` / `tasks.md` / `journal.md` or a sprint single-file SDD
doc. The stepper replaces the legacy 10px in-header breadcrumb and is visible regardless of
workspace mode (Spec / Code / Explore) so the SDD pivot affordance survives mode switches.

```
[1 Spec ✓]━━━━[2 Design ●]━━━━[3 Tasks 3/8]━━━━[4 Work 4/6]
Spec — clarify requirements, acceptance, and scope.
```

**Tier-1 — four numbered pills.** `buildBreadcrumbSegments()` returns four entries
(`spec`, `design`, `tasks`, `work`). `Work` represents the Work Sessions table, not code execution;
the implementation phase still lives in the action row via `Code ▾` / `Verify` / `Pick`. Each pill's background and border
encode state via the Meridian brass tokens (`bg-afx-brand` for completed/in-progress,
`bg-afx-brand-soft/15` for draft, dotted muted border for pending, amber for blocked). The
active pill receives a stronger ring halo (`ring-2 ring-afx-brand/60 ring-offset-2 shadow-sm`)
derived from `docKind` (standard) or `section` (sprint), so "currently viewing" reads at a glance.
Status copy avoids `…` because it reads as hidden/truncated content. Wider pills show explicit state
text (`Approved`, `Draft`, `Blocked`); compact pills keep only unambiguous markers (`✓`, `!`, or the
live `n/m` task fraction) and let pending/draft collapse to number-only when space is tight. Emoji
codepoints (`⏳ ⚠`) still stay out of the pill because they render via the OS emoji font at a larger
metric than `font-mono text-[10px]` and bust the pill's vertical bounds.

Click behavior is dispatched through `onOpenFile?: (path, line?) => void` on
`ChatDocActionsPanelBody` that wires through to `chat/openFile`:

- **Active pill** (any segment matching the open file): always re-focuses the editor on that file
  via `onOpenFile(filePath, …)` — no sibling-path resolution required, so it works even when the
  workspace is missing some siblings.
- **Standard 4-file mode (non-active)**: pill click → `onOpenFile(siblingPaths[key])` opens the
  sibling file. When the host's `siblingPaths` payload is missing an entry but the segment
  status proves the file exists (sibling status was successfully read host-side), the webview
  derives `<dirname>/<key>.md` from the active doc's path and dispatches that — keeps the pill
  clickable even when the host-side resolution glitched.
- **Sprint single-file mode**: pill click → `onOpenFile(filePath, sectionOffsets[key])` scrolls
  the editor to the matching SPEC / DESIGN / TASKS / SESSIONS heading inside the same sprint file.
  The 1-indexed offsets are produced host-side by `extractSprintSectionOffsets()` in
  `services/sprint-context.ts`, using canonical SPRINT-SECTION markers first and H1/H2 headings
  such as `# 2. Design` or `## 2. Design` as fallback anchors. If the section offset is missing
  but `filePath` exists, the pill remains clickable and opens the sprint file rather than showing a
  misleading `design.md not found`-style disabled state. Cursor in the SESSIONS slice stays
  `section: "SESSIONS"` so the panel highlights the fourth `Work` segment while retaining tasks
  command actions.
- **Genuinely missing standard sibling** (standard mode, no host path AND status `pending`): pill
  renders disabled, no dispatch, tooltip reads `"<segment>.md not found"`.

Connecting lines between pills carry the same brass progression: solid brass when the previous
pill is `approved` / `draft` / `blocked`, a `linear-gradient(brass {pct}%, muted 0)` when the
previous pill is `progress` (uses `tasksCompleted / tasksTotal`), and a dotted muted border when
the previous pill is `pending`. There is no `↻ next` button — `/afx-next` is one keystroke away in
the composer slash menu, and the action row already surfaces the contextual next moves.

**Second row — active Spec/SDD intent label.** A muted second row centered below the stepper carries a compact context label analogous to the Code/Explore Intent tagline, but owned by the Spec/SDD workflow chrome. It reads from the active step (`Spec`, `Design`, `Tasks`, `Work`) or `Journal` when `docContext.docKind === "journal"`, for example `Spec — clarify requirements, acceptance, and scope.` or `Journal — capture notes and decisions.` It is informational only: the old Journal chip is intentionally removed, and note capture remains available through the action row (`Note`) and session commands.

- The fourth `Work n/m` pill uses `workSessionsSigned` (rows with Human cell `[x]`) and
  `workSessionsTotal` (data rows in the `## Work Sessions` table). These are dedicated counts
  from `summarizeWorkSessions()` over the table itself — distinct from body-checkbox
  `tasksCompleted/Total`. Click opens the active tasks file scrolled to `## Work Sessions` via
  `sectionOffsets.sessions` (sprint = SESSIONS slice; standard = heading inside `tasks.md`).

The doc-actions panel does not render a Memory anchor. Memory is a workspace/turn tool, not a
feature-scoped sibling, so the current UI keeps it in `ChatTopBar` and `ComposerActions`. Both anchors
share the same `MEMORY_CATALOG` (NFR-12).

Compact mode collapses each pill to number-only or number+marker, hiding label/status text when
needed; tooltips carry the full label and state so the affordance stays discoverable without using
an ellipsis glyph.

The stepper data path:

```
host: createSprintContextSync (sprint-context.ts)
   ├ collectSiblingPaths(featureDir)         // standard: spec/design/tasks/journal that exist on disk
   ├ extractSprintSectionOffsets(text)        // sprint: 1-indexed line per section
   ├ extractStandardWorkSessionsOffset(text)  // standard tasks.md `## Work Sessions` line
   └ summarizeWorkSessions(text)              // {total, humanSigned} for Work pill n/m label
   ↓
chat/activeDocContext { …, siblingPaths, sectionOffsets, workSessionsTotal, workSessionsSigned }
   ↓
webview: ChatDocActionsPanelBody -> SpecStepper
   ↓ (pill click)
chat/openFile { path, line? }    ← stepper pills, including Work
   ↓
host: vscode.window.showTextDocument(uri, { selection })
```

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

Outside Spec mode the panel falls back to a per-docKind compact set instead of slicing the first
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

Anything not in the compact list collapses into `...` More so the panel stays narrow at the 205px
sidebar minimum width. The full Spec-mode set (3–4 buttons + More) renders unchanged.

## [DES-COMPOSER-COMPONENT-MODE-TOGGLE] Workspace Mode Control

The composer toolbar exposes a single Mode dropdown that drives `chat/setMode`. The
dropdown items map 1:1 to entries in `WORKSPACE_MODES` consumed by `ComposerToolbar`. The `data-workspace-mode`
attribute on the InputGroup wrapper drives a CSS-only border/ring accent:

| Mode    | Accent token (CSS)              | Footer hint                            |
| ------- | ------------------------------- | -------------------------------------- |
| Code    | default `--ring`                | `⏎ follow-up · ⌘⏎ steer · …`           |
| Explore | amber (`oklch(0.83 0.16 80)`)   | `Read-only / Safe · ⌘⇧M to switch`     |
| Spec    | violet (`oklch(0.72 0.19 295)`) | `Planning / Docs only · ⌘⇧M to switch` |

A `200ms` `border-color`/`box-shadow` transition smooths mode switches. Border colors are
defined as CSS custom properties — no runtime JS color computation.

## [DES-COMPOSER-QUEUE] Queue Panel Behavior

| Queue state     | Source anchor                         | UI/functionality                                                       |
| --------------- | ------------------------------------- | ---------------------------------------------------------------------- |
| No queued items | `QueuePanel`                          | Panel is omitted; composer layout collapses naturally                  |
| Steer items     | `QueuePanel`, `QueueRow`              | Render before follow-ups with `Zap` icon and arrow/ordinal marker      |
| Follow-up items | `QueuePanel`, `QueueRow`              | Render after steer items with `CornerDownLeft` icon and ordinal marker |
| Clear all       | `clearAllQueued`                      | Removes local mirror rows only; content may already be in engine queue |
| Dismiss row     | `dismissQueued`                       | Hides local mirror row only and explains it was already sent to engine |
| Debug injection | dev `afx:debug:inject-queue` listener | Allows visual iteration without manually queueing content              |

## [DES-COMPOSER-FILES-STRIP] Modified Files Panel

The Modified Files panel surfaces files touched by agent edit/write tool calls during the current chat
transcript. It renders through `ComposerPanel(id="modified-files")` and mirrors the queue dismissal
model: dismissing only hides local display, the underlying tool calls remain in the transcript.

### Source

State is **derived** from the controller-owned conversation timeline. There is no protocol message that pushes "modified
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

The panel survives webview hydration without extra plumbing — the rehydrated transcript regenerates
the same `ModifiedFile[]` deterministically.

### Dismiss-gate (per assistant turn)

The panel's dismiss button records the **current** `latestEditingAssistantMessageId`. The panel stays hidden
as long as that ID remains the latest. The next assistant message that produces an edit/write tool call
advances `latestEditingAssistantMessageId`, the equality check flips, and the panel reappears
(expanded with the latest pill list). Mid-turn edits do **not** reopen a dismissed panel — once a
turn is dismissed, the user has acknowledged the whole turn's batch.

### Stacking

The Modified Files panel renders **above** the Queue panel. Files are persistent session context;
queued messages are transient per-turn. This ordering keeps the most stable surface highest.

### State table

| State                             | Source anchor                | UI                                                                                                               |
| --------------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| No edits in transcript            | `FilesPanelBody`             | Panel is omitted; composer layout collapses naturally                                                            |
| First edit lands                  | `FilesPanelBody`, `FilePill` | Renders **expanded** with header `MODIFIED · 1` + horizontal pill list (basename + status dot) + dismiss control |
| User clicks chevron               | `ComposerPanel`              | Toggles panel between expanded (default) and collapsed (header-only)                                             |
| Pill click                        | `FilePill`, `bridgeSend`     | Sends `chat/openFile { path, line? }`; host opens file (and reveals line) via `showTextDocument`                 |
| Repeated edit to same path        | `deriveModifiedFiles`        | Dedup keeps the most recent tool call's status and toolCallId                                                    |
| Dismiss                           | `dismissModifiedFiles`       | Records `dismissedAtAssistantMessageId`; panel hides                                                             |
| Mid-turn additional edit          | derived state                | Panel stays hidden while `latestEditingAssistantMessageId === dismissedAtAssistantMessageId`                     |
| Next assistant turn produces edit | `latestEditingAssistantId`   | `dismissedAt !== latestEditing` -> panel reappears expanded with updated pill list                               |

### ASCII UI mockups

#### [DES-COMPOSER-MOCKUP-FILES-EMPTY] Empty (panel hidden)

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
│  ● composer-dock.tsx:142  ○ messages.ts  ○ sidebar-panel.ts  │
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

#### [DES-COMPOSER-MOCKUP-FILES-WITH-QUEUE] Streaming with both panels

```text
┌─ ▾ MODIFIED · 4 ───────────────────────────────────── [✕] ──┐
│  ● composer-input.tsx  ○ composer-dock.tsx  ○ messages.ts    │
│  ○ files-panel.tsx                                            │
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
turn 1   agent: [Edit X] [Edit Y]      panel shows · MODIFIED · 2
                                        (expanded; pills X, Y visible)
                            user ✕
                            -> panel hidden
                            dismissedAtAssistantMessageId = msg-1

turn 2   user: "now edit Z"
turn 2   agent: [Edit Z]                latestEditingAssistantMessageId
                                          advances to msg-2
                                        != dismissedAt -> panel pops back
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

| State input                | Source anchor                      | User-facing result                                                 |
| -------------------------- | ---------------------------------- | ------------------------------------------------------------------ |
| `thinking` + `isStreaming` | `ComposerActivityBar`              | Shows first 120 characters as live thinking preview                |
| Idle/no thinking           | `ComposerActivityBar`              | Shows compact idle row without consuming message timeline space    |
| `usage` present            | `ComposerFooter`, `usageTooltip`   | Shows token/cost/context tooltip with only meaningful values       |
| Runtime checking           | `ComposerFooter`                   | Explains the agent runtime is still handshaking                    |
| Runtime unconfigured       | `ComposerFooter`                   | Routes user toward provider/Pi setup copy                          |
| Runtime unavailable        | `ComposerFooter`, Pi warning click | Surfaces recovery/settings affordance without full-screen takeover |
| Streaming                  | `ComposerFooter`                   | Shows follow-up/steer keyboard hint before idle send/note hints    |
| Manual compaction          | `ComposerFooter`, placeholder      | Locks input with `Compacting session — wait for it to finish…`     |

---

## [DES-DEC] Key Decisions

| Decision                | Options Considered                             | Choice                                                         | Rationale                                                                             |
| ----------------------- | ---------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Composer split          | Keep in `210-app-chat`, create child spec      | Child spec                                                     | Footer/input changes are frequent and surgical                                        |
| Footer ownership        | Settings, runtime, composer                    | Composer                                                       | Footer copy appears in composer and depends on composer actions                       |
| Helper ownership        | Shared UI, messages, composer                  | Composer                                                       | Slash/mention helpers are input-driven                                                |
| System command routing  | Client detection, server detection             | Client detection                                               | Webview knows the draft text; extension host executes                                 |
| Shell selection         | Hardcoded `bash`, detect `$SHELL`, prompt      | Platform-aware spawn                                           | `bash` on macOS/Linux, `cmd`/`powershell` on Windows                                  |
| Concurrent execution    | Block while streaming, queue, allow            | Allow                                                          | Separate execution context from LLM stream; user can run `!top` while LLM writes code |
| Dangerous-pattern guard | Block all, allow all, confirm for destructive  | Confirm for destructive                                        | Catches common accidents (`rm -rf`) without blocking safe commands                    |
| Workspace mode          | Separate mode service, workspace config, host  | VS Code config + host (global default with workspace override) | Keeps Code default, Explore experimental/read-only, and lets the host prefix prompts  |
| Guardrail prompt        | No prompt prefix, local-only copy, host prefix | Host-injected prefix                                           | The strict Explore prompt must be injected before the runtime sees any Explore turn   |

---

## [DES-DATA] Data Model

Composer state includes input text, queued content metadata, selected model, thinking level, runtime readiness, busy/sending state, helper popup candidates, prompt-history cursor state, usage stats, and ephemeral note confirmations.

| Data shape          | Source anchor                                              | Purpose                                                                                                      |
| ------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `RuntimeSettings`   | `chat-controller.tsx` / composer slices                    | Composer-visible subset of `AgentStatus` for thinking, queue modes, compaction/retry, session, and RPC state |
| `QueuedMessage`     | `chat-controller.tsx` / `ComposerSlice`                    | Local display mirror for steer/follow-up content that was already sent while streaming                       |
| `UsageStats`        | `chat-controller.tsx` / footer slice                       | Footer tooltip and assistant metadata token/cost/context display                                             |
| `ComposerTrigger`   | `composer-detect.ts`                                       | Active slash/mention token location and query                                                                |
| `AgentCommand`      | `SlashPopup`, `displayCommandName`                         | Slash command list and action labels                                                                         |
| `AgentFileView`     | `MentionPopup`                                             | Mention candidate list split by recent/workspace                                                             |
| `AgentModel`        | `ModelCombobox`                                            | API/external model groups and combined selection identity                                                    |
| `ModifiedFile`      | `derive-modified-files.ts`                                 | Files touched by edit/write tool calls; derived per-render from transcript                                   |
| `WorkspaceMode`     | `chat-controller.tsx` / `ComposerToolbar` / `settings.tsx` | Workspace posture state: `code` default, `explore` read-only, `spec` planning-only                           |
| `BlockedActionView` | `chat-controller.tsx` / `ComposerPanelStack`               | Host-blocked Explore command payload rendered by the blocked-command panel                                   |

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
| Webview to host | `chat/setMode`                          | Update posture via the shared `afx.setMode` command (global default unless a workspace override exists)                                              |
| Webview to host | `chat/setIncludeActiveFileContext`      | Persist the mirrored active-file context preference                                                                                                  |
| Webview to host | `chat/runCommand`                       | System command: stripped `!` prefix, shell command string, requestId                                                                                 |
| Webview to host | `chat/openFile`                         | Modified-files panel pill click: `{ path, line? }` (workspace-relative or absolute; line is 1-indexed) — host calls `vscode.window.showTextDocument` |
| Host to webview | `agent/commandOutput`                   | Shell output stream: `requestId`, `streamId`, `delta` (partial line), `done` (final), `exitCode` (0–255), `error` (exception string)                 |
| Host to webview | `agent/commands`                        | Slash popup candidates                                                                                                                               |
| Host to webview | `agent/files`                           | Mention popup candidates                                                                                                                             |
| Host to webview | `agent/models`, `agent/modelChanged`    | Model picker candidates and active model                                                                                                             |
| Host to webview | `agent/settingsSnapshot`                | Mirrors durable active-file context preference and any other persisted Settings values                                                               |
| Host to webview | `agent/actionBlocked`                   | Renders the host-blocked Explore command panel                                                                                                       |
| Host to webview | `agent/runtimeSettings`, `agent/status` | Thinking/footer/readiness state                                                                                                                      |
| Host to webview | `chat/usage`                            | Footer usage tooltip state                                                                                                                           |

---

## [DES-FILES] File Structure

| File                                                         | Purpose                                                                                         |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| `apps/chat/src/views/chat.tsx`                               | Stable route shell; new component boundary refs route to `216-app-chat-window-componentization` |
| `apps/chat/src/components/chat/composer-dock.tsx`            | Composer bottom-region composition root                                                         |
| `apps/chat/src/components/chat/composer-activity-bar.tsx`    | Runtime/thinking/shell activity surface                                                         |
| `apps/chat/src/components/chat/composer-panel-stack.tsx`     | Ordered composer panel composition boundary                                                     |
| `apps/chat/src/components/chat/composer-panel.tsx`           | Standard panel chrome and panel-local lifecycle                                                 |
| `apps/chat/src/components/chat/composer-panels.tsx`          | Shared queue, blocked-command, and generic notice panel bodies                                  |
| `apps/chat/src/components/chat/composer-attachment-tray.tsx` | Reserved selected file/image attachment tray                                                    |
| `apps/chat/src/components/chat/composer-input.tsx`           | Textarea, popover anchors, prompt-history keyboard policy                                       |
| `apps/chat/src/components/chat/composer-toolbar.tsx`         | Mention/model/mode/file-context controls                                                        |
| `apps/chat/src/components/chat/composer-actions.tsx`         | Memory/send/follow-up/steer/stop actions                                                        |
| `apps/chat/src/components/chat/composer-footer.tsx`          | Pi/runtime, usage, and contextual hint footer                                                   |
| `apps/chat/src/components/model-combobox.tsx`                | Composer combined model/thinking picker                                                         |
| `apps/chat/src/components/slash-popup.tsx`                   | Slash command helper                                                                            |
| `apps/chat/src/components/mention-popup.tsx`                 | Mention helper                                                                                  |
| `apps/chat/src/components/chat/composer-panel.tsx`           | Generic collapsible panel chrome, header actions, and error boundary                            |
| `apps/chat/src/components/files-panel.tsx`                   | Modified files panel body + pill rendering (FR-10)                                              |
| `apps/chat/src/lib/composer-detect.ts`                       | Composer helper detection                                                                       |
| `apps/chat/src/lib/derive-modified-files.ts`                 | Pure helper: derives modified-file list from transcript                                         |
| `apps/chat/src/lib/mentions.ts`                              | Mention candidate logic                                                                         |

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

| Scenario                       | Handling                                                                                                      |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| Runtime unavailable            | Footer and send state explain configuration/readiness path                                                    |
| Bridge send fails              | Composer returns to editable state and surfaces failure through chat error UI                                 |
| Helper parsing fails           | Fall back to plain text input without blocking send                                                           |
| Empty slash filter result      | Show "No commands match" empty state in popup; user can keep typing or press Escape to close                  |
| Shell command timeout (30s)    | Terminate subprocess; emit `agent/commandOutput { error: "Command timed out after 30s", exitCode: -1 }`       |
| Shell non-zero exit            | Emit `agent/commandOutput { done: true, exitCode }`; output card shows exit code badge in amber               |
| Shell exception (ENOENT, etc.) | Emit `agent/commandOutput { error: <exception.message> }`; render error in red inline                         |
| Dangerous pattern before guard | Show `DangerousPatternGuard` confirm dialog; do not execute until user confirms                               |
| Workspace not open             | Show "No workspace folder open" error; disable system command input                                           |
| Explore command blocked        | Render `BlockedCommandPanelBody`, keep the draft available, and offer Switch to Code / Copy command / Dismiss |

---

## [DES-TEST] Testing Strategy

- Unit-test helper parsing where practical.
- Add chat view tests for footer/queue state when the surface changes.
- Add mode-specific tests for the toolbar posture chip, Explore prompt prefixing, and blocked-command panel.
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

| Task | File                                                     | Required @see                                                                                                                                        |
| ---- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.x  | `apps/chat/src/views/chat.tsx`                           | `docs/specs/216-app-chat-window-componentization/design.md [DES-API]`                                                                                |
| 1.x  | `apps/chat/src/components/chat/composer-dock.tsx`        | `docs/specs/216-app-chat-window-componentization/design.md [DES-UI]` + `docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENTS]`        |
| 1.x  | `apps/chat/src/components/chat/composer-panel-stack.tsx` | `docs/specs/216-app-chat-window-componentization/design.md [DES-DATA]` + `docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-STRIP]` |
| 1.x  | `apps/chat/src/components/chat/composer-input.tsx`       | `docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-KEYS] [DES-COMPOSER-HELPERS]`                                                              |
| 1.x  | `apps/chat/src/components/chat/composer-toolbar.tsx`     | `docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-RUNTIME] [DES-COMPOSER-CONTEXT]`                                                           |
| 1.x  | `apps/chat/src/components/chat/composer-actions.tsx`     | `docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-FLOW] [DES-COMPOSER-KEYS]`                                                                 |
| 1.x  | `apps/chat/src/components/chat/composer-footer.tsx`      | `docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-FOOTER]`                                                                                   |
| 1.x  | `apps/chat/src/components/model-combobox.tsx`            | `design.md [DES-COMPOSER-RUNTIME] [DES-COMPOSER-MOCKUP-RUNTIME-MENU]`                                                                                |
| 1.x  | `apps/chat/src/components/slash-popup.tsx`               | `design.md [DES-COMPOSER-HELPERS] [DES-COMPOSER-COMPONENT-SLASH-POPUP] [DES-COMPOSER-MOCKUP-SLASH-FILTER]`                                           |
| 1.x  | `apps/chat/src/components/mention-popup.tsx`             | `design.md [DES-COMPOSER-HELPERS]`                                                                                                                   |
| 1.x  | `apps/chat/src/components/chat/composer-panel.tsx`       | `docs/specs/216-app-chat-window-componentization/design.md [DES-DATA] [DES-A11Y]`                                                                    |
| 1.x  | `apps/chat/src/components/files-panel.tsx`               | `spec.md [FR-10]` + `design.md [DES-COMPOSER-FILES-STRIP]`                                                                                           |
| 1.x  | `apps/chat/src/lib/composer-detect.ts`                   | `design.md [DES-COMPOSER-HELPERS]`                                                                                                                   |
| 1.x  | `apps/chat/src/lib/derive-modified-files.ts`             | `spec.md [FR-10]` + `design.md [DES-COMPOSER-FILES-STRIP]`                                                                                           |
| 1.x  | `apps/chat/src/lib/mentions.ts`                          | `design.md [DES-COMPOSER-HELPERS]`                                                                                                                   |

## [DES-COMPOSER-LOC] Code Locator Map

| Map ID                     | Code anchor                                                                                                                                                         | Messages/settings/commands                                                                                        | Tests                                                                                                          |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `[Composer.Activity]`      | `apps/chat/src/components/chat/composer-activity-bar.tsx` `ComposerActivityBar`                                                                                     | `thinking_delta`, runtime streaming state                                                                         | `apps/chat/src/app.test.tsx`                                                                                   |
| `[Composer.Queue]`         | `apps/chat/src/components/chat/composer-panels.tsx` `QueuePanel`, `QueueRow`; `ComposerPanelStack` integration                                                      | `chat/steer`, `chat/followUp`, `queue_update`                                                                     | `apps/chat/src/components/chat/composer-panels.test.tsx`                                                       |
| `[Composer.ModifiedFiles]` | `apps/chat/src/components/files-panel.tsx` `FilesPanelBody`, `FilePill`; `apps/chat/src/lib/derive-modified-files.ts`; `ComposerPanelStack` integration             | `chat/openFile`                                                                                                   | `derive-modified-files.test.ts`, `files-panel.test.tsx`, `apps/chat/src/app.test.tsx`                          |
| `[Composer.Input]`         | `apps/chat/src/components/chat/composer-input.tsx` `ComposerInput`                                                                                                  | `chat/send`, `chat/saveNote`, `chat/listFiles`                                                                    | `apps/chat/src/app.test.tsx`                                                                                   |
| `[Composer.Helpers]`       | `slash-popup.tsx`, `mention-popup.tsx`, `composer-detect.ts`, `mentions.ts`                                                                                         | `chat/getCommands`, `chat/listFiles`, `chat/newSession`, live filter query, Tab focus transfer                    | `composer-detect.test.ts`, `mentions.test.ts`, `slash-popup.test.tsx`                                          |
| `[Composer.Toolbar]`       | `apps/chat/src/components/chat/composer-toolbar.tsx`; `model-combobox.tsx`; `ModeToggle`; `ActiveFileContextToggle`                                                 | `chat/setModel`, `chat/setThinkingLevel`, `chat/setMode`, `chat/openSettings`, `chat/setIncludeActiveFileContext` | `apps/chat/src/app.test.tsx`                                                                                   |
| `[Composer.DocActions]`    | `apps/chat/src/components/chat-doc-actions-panel.tsx`; `chat-doc-kind-visual.ts`; `doc-actions.ts`; `command-catalog.ts`; `context-presets.ts`; `result-actions.ts` | `chat/activeDocContext`, draft insertion, `chat/send` / `chat/followUp` for deterministic commands                | `chat-doc-actions-panel.test.tsx`, `doc-actions.test.ts`, `command-catalog.test.ts`, `context-presets.test.ts` |
| `[Composer.BlockedAction]` | `apps/chat/src/components/chat/composer-panels.tsx` `BlockedCommandPanelBody`; `ComposerPanelStack` integration                                                     | `agent/actionBlocked`, `chat/setMode`                                                                             | `apps/chat/src/components/chat/composer-panels.test.tsx`                                                       |
| `[Composer.Notice]`        | `apps/chat/src/components/chat/composer-panels.tsx` `ComposerNoticePanelBody`; `ComposerPanelStack` integration                                                     | Feature-owned panel ids such as `afx-command-suggest`                                                             | `apps/chat/src/components/chat/composer-panels.test.tsx`; `apps/chat/src/app.test.tsx`                         |
| `[Composer.Actions]`       | `apps/chat/src/components/chat/composer-actions.tsx` `ComposerActions`                                                                                              | `chat/send`, `chat/steer`, `chat/followUp`, `chat/abort`                                                          | `apps/chat/src/app.test.tsx`                                                                                   |
| `[Composer.Footer]`        | `apps/chat/src/components/chat/composer-footer.tsx` `ComposerFooter`                                                                                                | `agent/runtimeStatus`, usage stats, `afx.rpc.enabled`                                                             | `apps/chat/src/app.test.tsx`                                                                                   |

## [DES-COMPOSER-TRACE] Functional Trace Matrix

| Requirement | Design nodes                                                                                                                                                 | Code anchors                                                                                                                                                                              | Verification                                                                                                             |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| FR-1        | `DES-COMPOSER-MOCKUP-IDLE`, `DES-COMPOSER-MOCKUP-STREAMING`, `DES-COMPOSER-MOCKUP-COMPACTING`, `DES-COMPOSER-COMPONENTS`, `DES-COMPOSER-KEYS`                | `Chat`, `InputGroupTextarea`, `submit`, `abort`, `onKeyDown`                                                                                                                              | `apps/chat/src/app.test.tsx`; future e2e keyboard coverage                                                               |
| FR-2        | `DES-COMPOSER-FOOTER`, `DES-COMPOSER-MOCKUP-COMPACTING`                                                                                                      | `ComposerActivityBar`, `ComposerFooter`, `usageTooltip`, placeholder logic                                                                                                                | `apps/chat/src/app.test.tsx`                                                                                             |
| FR-3        | `DES-COMPOSER-HELPERS`, `DES-COMPOSER-COMPONENT-SLASH-POPUP`, `DES-COMPOSER-MOCKUP-SLASH-FILTER`                                                             | `detectComposerTrigger`, `filterQuery`, `SlashPopup`, `MentionPopup`, `insertAtTrigger`, `selectSlashAction`, `extractMentions`, `focusPopupOnTab`                                        | `composer-detect.test.ts`, `mentions.test.ts`, `slash-popup.test.tsx`, `app.test.tsx`                                    |
| FR-4        | `DES-COMPOSER-QUEUE`                                                                                                                                         | `QueuedMessage`, `QueuePanel`, `QueueRow`, `dismissQueued`, `clearAllQueued`                                                                                                              | `apps/chat/src/components/chat/composer-panels.test.tsx`                                                                 |
| FR-5        | `DES-COMPOSER-MOCKUP-IDLE`, `DES-COMPOSER-MOCKUP-RUNTIME-MENU`, `DES-COMPOSER-RUNTIME`                                                                       | `ModelCombobox`, `selectModel`, `setThinkingLevel`                                                                                                                                        | `app.test.tsx`; model-combobox tests when changed                                                                        |
| FR-6        | `DES-COMPOSER-KEYS`                                                                                                                                          | `navigatePromptHistory`, `collectPromptHistory`, `applyHistoryDraft`                                                                                                                      | `app.test.tsx`; future dedicated history recall test                                                                     |
| FR-7        | `DES-COMPOSER-FOOTER`                                                                                                                                        | `ComposerActivityBar`, `chat/thinkingDelta` handler                                                                                                                                       | `app.test.tsx`                                                                                                           |
| FR-8        | `DES-COMPOSER-FLOW`, `DES-API`                                                                                                                               | `bridgeSend` calls only; no VSCode API imports in chat webview                                                                                                                            | architecture lint/no-restricted-imports                                                                                  |
| FR-9        | `DES-COMPOSER-FLOW`, `DES-UI`, `DES-COMPOSER-COMPONENTS`, `DES-COMPOSER-KEYS`, `DES-API`, `DES-SEC`, `DES-ERR`                                               | Prefix detection in `submit()`, `chat/runCommand` bridge send, `ShellBadge` badge state, `DangerousPatternGuard`, `OutputCard` timeline render, `agent/commandOutput` handler             | Unit test: system command dispatched when draft starts with `!`; dangerous pattern blocks without guard confirm          |
| FR-10       | `DES-COMPOSER-FILES-STRIP`, `DES-COMPOSER-MOCKUP-FILES-COLLAPSED`, `DES-COMPOSER-MOCKUP-FILES-EXPANDED`, `DES-COMPOSER-MOCKUP-FILES-DISMISS-FLOW`            | `deriveModifiedFiles`, `FilesPanelBody`, `FilePill`, `bridgeSend({ type: "chat/openFile", path })`; host `case "chat/openFile":` calls `vscode.window.showTextDocument`                   | `derive-modified-files.test.ts`, `files-panel.test.tsx`; e2e: pill click opens file in extension dev host                |
| FR-11       | `DES-COMPOSER-CONTEXT`, `DES-COMPOSER-MOCKUP-IDLE`, `DES-COMPOSER-MOCKUP-STREAMING`, `DES-COMPOSER-KEYS`, `DES-API`, `DES-COMPOSER-REFS`                     | `ActiveFileContextToggle`, `applyIncludeActiveFileContext`, `chat/setIncludeActiveFileContext`, `agent/settingsSnapshot`                                                                  | `app.test.tsx`, settings snapshot tests, small-screen toolbar tests                                                      |
| FR-12       | `DES-COMPOSER-MOCKUP-MODE-COLLAPSED`, `DES-COMPOSER-MOCKUP-MODE-DROPDOWN`, `DES-COMPOSER-COMPONENT-MODE-TOGGLE`, `DES-COMPOSER-RUNTIME`, `DES-COMPOSER-REFS` | `ModeToggle`, `WORKSPACE_MODES`, `chat/setMode`, `WorkspaceMode`                                                                                                                          | `app.test.tsx`, mode snapshot tests, settings mode coverage                                                              |
| FR-13       | `DES-COMPOSER-MOCKUP-BLOCKED-COMMAND`, `DES-COMPOSER-COMPONENT-BLOCKED-COMMAND-STRIP`, `DES-COMPOSER-REFS`, `DES-API`, `DES-SEC`, `DES-ERR`                  | `BlockedCommandPanelBody`, `BlockedActionView`, `restoreBlockedCommand`, `copyBlockedCommand`, `agent/actionBlocked`                                                                      | `composer-panels.test.tsx`, blocked-command tests, Explore guardrail coverage                                            |
| FR-14       | `DES-COMPOSER-MOCKUP-MODE-COLLAPSED`, `DES-COMPOSER-MOCKUP-MODE-DROPDOWN`, `DES-COMPOSER-COMPONENT-MODE-TOGGLE`, `DES-COMPOSER-RUNTIME`                      | `ModeToggle`, `WORKSPACE_MODES`, `data-workspace-mode` CSS accent, Spec footer hint, `chat/setMode`                                                                                       | `app.test.tsx`, mode snapshot tests, settings mode coverage                                                              |
| FR-15/FR-16 | `DES-COMPOSER-COMPONENT-STRIP`, `DES-COMPOSER-MOCKUP-NOTICE`, `DES-COMPOSER-NOTICE-PANEL`                                                                    | `ChatDocActionsPanelBody`, `ComposerNoticePanelBody`, `ChatCommandPresetSubmenu`, `ResultActions`, `resolveDocActions`, `MEMORY_CATALOG`, `COMMAND_CONTEXT_PRESETS`, `parseResultActions` | Unit: command/doc/memory/preset/result parser + component tests; E2E required for doc-action menu and result-action rail |
| NFR-6       | `DES-UI`, `DES-SEC`, `DES-ERR`                                                                                                                               | Amber "Shell" badge, persistent footer warning, dangerous-pattern guard, timeout enforcement, output card styling                                                                         | E2E: badge visible when draft starts with `!`; guard shown for `rm -rf`; output renders in timeline                      |
| NFR-7       | `DES-COMPOSER-CONTEXT`, `DES-COMPOSER-MOCKUP-IDLE`, `DES-COMPOSER-MOCKUP-STREAMING`, `DES-COMPOSER-MOCKUP-RUNTIME-MENU`, `DES-COMPOSER-COMPONENT-STRIP`      | `ModelCombobox`, `ModeToggle`, `ActiveFileContextToggle`, `ChatMemoryMenuButton`, `ChatDocActionsPanelBody`, compact toolbar placement                                                    | `app.test.tsx`, `model-combobox.test.tsx`, `chat-doc-actions-panel.test.tsx`, narrow-width composer coverage             |
| NFR-1       | `DES-COMPOSER-KEYS`                                                                                                                                          | `onKeyDown`                                                                                                                                                                               | e2e keyboard regression tests when changed                                                                               |
| NFR-2       | `DES-COMPOSER-FOOTER`                                                                                                                                        | `ComposerFooter`                                                                                                                                                                          | focused copy snapshot/assertions when changed                                                                            |
| NFR-3       | `DES-COMPOSER-MOCKUPS`, `DES-COMPOSER-MOCKUP-COMPACTING`, `DES-COMPOSER-QUEUE`                                                                               | stable bottom layout around `ComposerInput`/`QueuePanel`                                                                                                                                  | visual/e2e checks when layout changes                                                                                    |
| NFR-4       | `DES-COMPOSER-HELPERS`, `DES-COMPOSER-COMPONENT-SLASH-POPUP`                                                                                                 | `detectComposerTrigger`, `filterQuery`, `extractMentions`, `focusPopupOnTab`                                                                                                              | helper unit tests, `slash-popup.test.tsx`                                                                                |
| NFR-5       | `DES-COMPOSER-REFS`, `DES-COMPOSER-LOC`                                                                                                                      | file/local `@see` anchors                                                                                                                                                                 | `rg "@see docs/specs/211-app-chat-composer"` and `/afx-check trace`                                                      |

---

## [DES-COMPOSER-QUESTIONS] Open Technical Questions

None.
