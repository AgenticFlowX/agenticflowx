---
afx: true
type: RES
status: Living
owner: "@rixrix"
version: "0.1.0"
created_at: "2026-04-26T06:00:34.000Z"
updated_at: "2026-04-28T01:37:40.000Z"
tags: ["research", "chat-ui", "pi", "telemetry"]
---

# AFX Chat Display Surface from Pi RPC

## Context

AFX aims to keep the VS Code extension thin, fast, and simple while using Pi as the runtime. Pi RPC exposes enough state and telemetry to make the chat feel transparent without copying heavy sidebars or rebuilding runtime internals.

This research translates Pi RPC capabilities into practical UI elements for the AFX chat experience.

Primary question: **what should AFX display in chat, and what should stay hidden or advanced?**

---

## Findings

### High-Value Data Available from RPC

The most useful display inputs are:

| RPC source                        | Display value                        |
| --------------------------------- | ------------------------------------ |
| `get_state.model`                 | Current provider/model               |
| `get_state.thinkingLevel`         | Current thinking level               |
| `get_state.isStreaming`           | Running/idle state                   |
| `get_state.isCompacting`          | Compaction state                     |
| `get_state.pendingMessageCount`   | Queued input count                   |
| `get_session_stats.tokens`        | Total input/output/cache tokens      |
| `get_session_stats.cost`          | Estimated total session cost         |
| `get_session_stats.contextUsage`  | Context used vs available            |
| `get_session_stats.toolCalls`     | Tool activity count                  |
| `get_session_stats.totalMessages` | Conversation size                    |
| `get_available_models`            | Model picker options                 |
| `get_commands`                    | Skill/command picker options         |
| `get_messages`                    | Per-turn detail and usage drill-down |

These are enough for a compact but informative chat UI.

### Minimal First-Release Surface

The first visible surface should stay small:

| UI element         | Source                                  | Why it matters                                |
| ------------------ | --------------------------------------- | --------------------------------------------- |
| Model selector     | `get_available_models`, `set_model`     | Users can switch model without editing config |
| Thinking selector  | `get_state`, `set_thinking_level`       | Users can tune speed/cost/depth               |
| Context meter      | `get_session_stats.contextUsage`        | Prevent surprise context exhaustion           |
| Cost indicator     | `get_session_stats.cost`                | Makes spending visible                        |
| Run state          | `get_state.isStreaming`, `isCompacting` | Clarifies whether Pi is busy                  |
| Abort button       | `abort`                                 | Essential control during long runs            |
| Compact button     | `compact`                               | Useful escape hatch near context limits       |
| AFX command picker | `get_commands` + AFX mapping            | Makes bundled skills discoverable             |

This gives AFX an immediately useful shape without becoming a dashboard-heavy clone.

### Recommended Status Strip

A compact status strip can be built from one `get_state` call plus periodic `get_session_stats` refreshes:

```text
gpt-5.2 | high | 82k / 400k ctx | $0.42 | 18 tools
```

Suggested fields:

| Segment  | Example      | Source                           |
| -------- | ------------ | -------------------------------- |
| Model    | `gpt-5.2`    | `get_state.model.id`             |
| Thinking | `high`       | `get_state.thinkingLevel`        |
| Context  | `82k / 400k` | `get_session_stats.contextUsage` |
| Cost     | `$0.42`      | `get_session_stats.cost`         |
| Tools    | `18 tools`   | `get_session_stats.toolCalls`    |

If values are unavailable, show less rather than inventing estimates:

```text
gpt-5.2 | high | context unknown | cost unavailable
```

### Message-Level Display

Per-message details can come from `get_messages`. For assistant messages, Pi stores usage data. AFX can expose this as a collapsible detail row:

```text
Input 12.4k | Output 1.2k | Cache read 38k | Cost $0.07
```

Recommended default:

- do not show per-turn cost inline by default
- show it in hover, tooltip, or details expansion
- keep the main transcript focused on the conversation

This keeps the chat calm while still allowing power users to inspect cost.

### Model Picker

`get_available_models` can drive a picker grouped by provider:

```text
OpenAI
  gpt-5.2
  gpt-5.4

Anthropic
  claude-sonnet-4.5
```

Useful model metadata from Pi's model objects may include:

| Metadata        | UI use                        |
| --------------- | ----------------------------- |
| `provider`      | group label                   |
| `id`            | stable selection value        |
| `name`          | friendly label when available |
| `reasoning`     | show thinking support         |
| `contextWindow` | show context capacity         |
| `maxTokens`     | show output limit             |
| `cost`          | optional cost preview         |

Recommended behavior:

- apply model changes to the next prompt when a response is streaming
- show current model in the input bar
- avoid requiring users to edit `settings.json`

### Thinking Selector

Thinking can be a simple segmented/dropdown control:

```text
off | minimal | low | medium | high | xhigh
```

Recommended behavior:

- hide unsupported levels when known
- if Pi clamps the value, reflect the effective value after `get_state`
- use plain labels, not explanatory text in the main UI

### AFX Command Picker

Pi exposes skills as `skill:<name>`, for example:

```text
skill:afx-task
skill:afx-next
skill:afx-check
```

AFX should present these as AFX-native commands:

```text
/afx-task
/afx-next
/afx-check
```

and rewrite before sending to Pi:

```text
/afx-task code T-001
```

to:

```text
/skill:afx-task code T-001
```

This keeps the AFX user experience stable without forking Pi.

### Session Controls

Useful session actions:

| UI action          | RPC command        |
| ------------------ | ------------------ |
| New chat           | `new_session`      |
| Rename chat        | `set_session_name` |
| Export chat        | `export_html`      |
| Fork from message  | `fork`             |
| Clone current chat | `clone`            |
| Switch session     | `switch_session`   |

For AFX, only new chat and rename/export need to be prominent. Fork/clone/session switching can wait until the chat UX is stable.

### Compaction Display

Recommended behavior:

- show context percentage when known
- show a compact button when context is above a threshold, such as 70%
- show compaction running state from `get_state.isCompacting`
- expose auto-compaction as an advanced setting, not a main control

Suggested display:

```text
Context 72% | Compact
```

If context usage is unknown after compaction, show:

```text
Context recalculating
```

Pi explicitly treats context usage as unknown immediately after some compaction boundaries until another model response provides reliable usage.

### Extension UI Requests

Pi extensions can ask the host UI for:

- select
- confirm
- input
- editor
- notify
- status
- widget
- title
- editor text update

AFX should map these to native VS Code UI primitives where possible. This lets skill flows ask for input without exposing Pi's terminal UI.

---

## Analysis

The chat UI should be transparent, not busy. Pi RPC makes it tempting to show everything, but the product goal is performance and simplicity.

The best first release is a compact control surface:

- what model is running
- how hard it is thinking
- whether it is busy
- how much context is left
- roughly what it costs
- what AFX commands are available

Everything else should be secondary.

This positioning matters because AFX is not trying to win by having the most panels. Its advantage is a clean chat experience plus spec-aware workflows. Telemetry should reinforce trust, not become the product.

### Suggested Display Priority

| Priority | Display                                       |
| -------- | --------------------------------------------- |
| P0       | Model, thinking, run state, abort             |
| P1       | Context usage, compact, estimated cost        |
| P2       | Tool count, token breakdown, command picker   |
| P3       | Per-turn usage detail, export, fork/clone     |
| Later    | Full session browser, detailed cost analytics |

### Refresh Strategy

Recommended refresh pattern:

- call `get_state` after startup, prompt submit, abort, model change, thinking change, compaction, and session change
- call `get_session_stats` after assistant response completes
- optionally poll `get_state` lightly during streaming
- avoid polling `get_messages` during streaming unless needed for transcript repair

This keeps the extension responsive without turning RPC into a noisy telemetry loop.

### UX Caveats

Cost should be labeled as estimated. Some providers may return incomplete usage, and Pi's cost depends on model registry pricing.

Model/thinking changes over RPC may update Pi defaults. The UI should treat this as a runtime-level selection unless AFX later introduces its own profile system through the SDK/hybrid path.

---

## Recommendations

- Build the first chat display around model, thinking, run state, context, cost, abort, compact, and AFX commands.
- Use `get_session_stats` as the source for cost/context/token display.
- Use `get_messages` only for transcript restoration and per-turn detail, not as a constantly polled stats feed.
- Present Pi skill commands as AFX-native `/afx-*` commands and rewrite to `/skill:afx-*` internally.
- Keep fork/clone/export as secondary actions.
- Label monetary values as estimates.
- Defer SDK-backed AFX-local model profiles until the basic RPC UX proves insufficient.

---

## References

- `docs/research/pi/res-pi-rpc-features.md`
- `pi-mono/packages/coding-agent/src/modes/rpc/rpc-types.ts`
- `pi-mono/packages/coding-agent/src/modes/rpc/rpc-mode.ts`
- `pi-mono/packages/coding-agent/src/core/agent-session.ts`

---

## Next Steps

- [ ] Add a small chat status strip spec to the AFX VS Code design docs.
- [ ] Decide whether model/thinking controls are always visible or tucked into the input toolbar.
- [ ] Add command-picker behavior for bundled AFX skills.
- [ ] Define a later "advanced telemetry" view only if users ask for it.
