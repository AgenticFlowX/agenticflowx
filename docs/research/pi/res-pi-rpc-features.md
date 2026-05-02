---
afx: true
type: RES
status: Living
owner: "@rixrix"
version: "0.1.0"
created_at: "2026-04-26T06:00:34.000Z"
updated_at: "2026-04-28T01:37:40.000Z"
tags: ["research", "pi", "rpc", "runtime"]
---

# AFX Pi RPC Features

## Context

AFX currently treats Pi as its runtime and launches it in JSONL RPC mode from the VS Code extension. The open question is how far AFX can go while staying RPC-first, before needing Pi's SDK.

This research captures the available Pi RPC surface verified from the local Pi mono repo and identifies what AFX can use directly in the extension.

Primary question: **what can AFX control or observe through Pi RPC without embedding the SDK?**

---

## Findings

### RPC Transport Shape

Pi RPC runs as a headless process using JSON lines over stdin/stdout.

AFX can start Pi with:

```text
pi --mode rpc
```

and then send command objects such as:

```json
{ "id": "1", "type": "get_state" }
```

Responses use:

```json
{
  "id": "1",
  "type": "response",
  "command": "get_state",
  "success": true,
  "data": {}
}
```

This is enough for a VS Code extension to stay out-of-process, lightweight, and runtime-swappable.

### Prompting and Run Control

Available prompt/control commands:

| RPC command   | Purpose                                                 |
| ------------- | ------------------------------------------------------- |
| `prompt`      | Submit a user prompt                                    |
| `steer`       | Add steering input to an active or queued run           |
| `follow_up`   | Queue follow-up input                                   |
| `abort`       | Abort the active run                                    |
| `new_session` | Start a fresh session, optionally from a parent session |

This covers the minimum viable chat loop without SDK involvement.

### State Inspection

`get_state` returns session and runtime state:

| Field                   | Use                                     |
| ----------------------- | --------------------------------------- |
| `model`                 | Current selected model                  |
| `thinkingLevel`         | Current reasoning/thinking setting      |
| `isStreaming`           | Whether a response is currently running |
| `isCompacting`          | Whether compaction is running           |
| `steeringMode`          | Steering queue behavior                 |
| `followUpMode`          | Follow-up queue behavior                |
| `sessionFile`           | Backing session file, when present      |
| `sessionId`             | Stable active session identifier        |
| `sessionName`           | User-facing session name, when present  |
| `autoCompactionEnabled` | Whether automatic compaction is on      |
| `messageCount`          | Total visible message count             |
| `pendingMessageCount`   | Queued message count                    |

This gives AFX enough information to render a live status bar and guard UI actions while Pi is busy.

### Model Control

Pi RPC supports:

| RPC command            | Purpose                                              |
| ---------------------- | ---------------------------------------------------- |
| `get_available_models` | List configured/authenticated models available to Pi |
| `set_model`            | Set model by `provider` and `modelId`                |
| `cycle_model`          | Move to the next available/scoped model              |

`set_model` validates that Pi has configured auth for the selected provider/model. In the current Pi implementation, changing models also persists Pi's default provider/model in Pi settings.

Implication: RPC model switching works well for AFX, but it is not purely ephemeral. If AFX wants extension-local model profiles that do not mutate Pi defaults, that is a later SDK/hybrid concern.

### Thinking Control

Pi RPC supports:

| RPC command            | Purpose                                |
| ---------------------- | -------------------------------------- |
| `set_thinking_level`   | Set current thinking level             |
| `cycle_thinking_level` | Move through supported thinking levels |

Known thinking levels:

```text
off, minimal, low, medium, high, xhigh
```

Pi clamps thinking levels to model capability. For models that do not support reasoning/thinking, the effective level becomes `off`.

Like model selection, thinking-level changes can persist as Pi defaults when they change.

### Usage, Tokens, Cost, and Context

`get_session_stats` returns aggregate session telemetry:

| Field                        | Meaning                                 |
| ---------------------------- | --------------------------------------- |
| `userMessages`               | Count of user messages                  |
| `assistantMessages`          | Count of assistant messages             |
| `toolCalls`                  | Count of assistant-requested tool calls |
| `toolResults`                | Count of tool result messages           |
| `totalMessages`              | Total session messages                  |
| `tokens.input`               | Total input tokens                      |
| `tokens.output`              | Total output tokens                     |
| `tokens.cacheRead`           | Total cache-read tokens                 |
| `tokens.cacheWrite`          | Total cache-write tokens                |
| `tokens.total`               | Aggregate token count                   |
| `cost`                       | Estimated total cost                    |
| `contextUsage.tokens`        | Estimated current context tokens        |
| `contextUsage.contextWindow` | Current model context window            |
| `contextUsage.percent`       | Context used percentage                 |

This is a strong signal for AFX because cost and context visibility can be provided without rebuilding provider accounting.

Important caveat: cost accuracy depends on provider usage reporting and Pi's model registry pricing. Local/custom providers may return incomplete or zero cost data.

### Conversation and Session Operations

Pi RPC supports session and message operations:

| RPC command               | Purpose                                    |
| ------------------------- | ------------------------------------------ |
| `get_messages`            | Return all session messages                |
| `get_last_assistant_text` | Return the latest assistant text           |
| `get_fork_messages`       | Return user messages available for forking |
| `get_session_stats`       | Return aggregate session telemetry         |
| `set_session_name`        | Rename the current session                 |
| `switch_session`          | Switch to a session by path                |
| `fork`                    | Fork from a given entry                    |
| `clone`                   | Clone current leaf/session state           |
| `export_html`             | Export the session to HTML                 |

This enables session history, fork/clone affordances, export, and per-turn usage inspection from `get_messages`.

### Compaction and Retry

Pi RPC supports:

| RPC command           | Purpose                                                      |
| --------------------- | ------------------------------------------------------------ |
| `compact`             | Compact current context, optionally with custom instructions |
| `set_auto_compaction` | Enable/disable automatic compaction                          |
| `set_auto_retry`      | Enable/disable automatic retry                               |
| `abort_retry`         | Abort an active retry                                        |

This lets AFX expose compaction as a simple control rather than implementing summarization itself.

### Bash

Pi RPC supports:

| RPC command  | Purpose                            |
| ------------ | ---------------------------------- |
| `bash`       | Execute a shell command through Pi |
| `abort_bash` | Abort the active bash command      |

For AFX, direct user-facing bash execution should still be mediated by the AFX safety policy. The raw RPC command exists, but the extension should avoid turning it into an unrestricted UI shortcut.

### Commands and Skills

`get_commands` returns available slash commands from:

| Source           | Example                      |
| ---------------- | ---------------------------- |
| Pi extensions    | `some-extension-command`     |
| Prompt templates | prompt-backed slash commands |
| Skills           | `skill:afx-task`             |

This matters for bundled AFX skills. Pi exposes skills as `/skill:<name>`, so AFX can either show that directly or map AFX-style commands:

```text
/afx-task
```

to Pi's native invocation:

```text
/skill:afx-task
```

### Extension UI Bridge

Pi RPC can emit `extension_ui_request` events. Supported UI methods include:

| Method            | Purpose                                |
| ----------------- | -------------------------------------- |
| `select`          | Ask the host UI to select from options |
| `confirm`         | Ask for confirmation                   |
| `input`           | Ask for one-line input                 |
| `editor`          | Ask for editor-style text input        |
| `notify`          | Show notification                      |
| `setStatus`       | Set a status value                     |
| `setWidget`       | Set widget lines                       |
| `setTitle`        | Set UI title                           |
| `set_editor_text` | Prefill editor/chat text               |

This creates a path for Pi extensions and AFX skill flows to ask VS Code for input without requiring a terminal TUI.

---

## Analysis

Pi RPC already covers the core current needs:

- prompt/abort lifecycle
- current state
- model and thinking selection
- session stats
- token/cost/context telemetry
- message/session operations
- compaction
- skill command discovery
- extension UI request bridging

This is enough to build a credible, fast, thin VS Code chat experience without embedding the SDK.

The main limitation is ownership of configuration state. RPC model and thinking changes call Pi session methods that also update Pi defaults. That is acceptable if AFX is intentionally using Pi as the user's runtime. It is less ideal if AFX wants extension-local model profiles or per-workspace model settings that never affect standalone Pi.

The SDK is therefore not needed for the basic chat surface. It becomes relevant when AFX needs:

- extension-local model profiles
- auth fallback or SecretStorage integration
- custom resource-loader behavior
- tool-call policy hooks
- runtime-owned prompt transforms
- deeper provider/auth introspection

---

## Recommendations

- Keep AFX RPC-first for the initial clean implementation.
- Add typed wrappers in the AFX Pi client for `get_state`, `get_available_models`, `set_model`, `set_thinking_level`, `get_session_stats`, `get_messages`, `compact`, `abort`, and `get_commands`.
- Treat `get_session_stats` as the primary telemetry source for the chat status bar.
- Treat `get_messages` as the source for per-turn usage/cost drill-down.
- Clearly document that RPC model/thinking changes may update Pi's own defaults.
- Defer SDK integration until AFX needs local profiles, auth bridging, or runtime policy hooks.

---

## References

- `pi-mono/packages/coding-agent/src/modes/rpc/rpc-types.ts`
- `pi-mono/packages/coding-agent/src/modes/rpc/rpc-mode.ts`
- `pi-mono/packages/coding-agent/src/modes/rpc/rpc-client.ts`
- `pi-mono/packages/coding-agent/src/core/agent-session.ts`
- `pi-mono/packages/coding-agent/src/core/settings-manager.ts`

---

## Next Steps

- [ ] Add AFX client wrapper methods for the high-value RPC calls.
- [ ] Decide whether AFX model selection should intentionally update Pi defaults.
- [ ] Add a runtime info command that reports Pi binary source, version, model, and thinking level.
- [ ] Revisit SDK only when a concrete requirement cannot be expressed over RPC.
