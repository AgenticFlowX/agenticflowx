---
afx: true
type: DESIGN
status: Living
owner: "@rixrix"
version: "1.2"
created_at: "2026-05-02T23:56:50.000Z"
updated_at: "2026-05-22T05:56:29.000Z"
tags: ["agent", "runtime", "manager"]
spec: spec.md
---

# Agent Manager - Technical Design

---

## [DES-OVR] Overview

The agent manager zone defines runtime-agnostic agent contracts and host orchestration. Runtime adapters plug into this layer; app/webview code consumes status and configuration payloads.

---

## [DES-ARCH] Architecture

```text
packages/shared AgentManager contract
        ▲
        │
VSCode agent factory and runtime monitor
        │
        ├─ Pi adapter (`351-agent-pi`)
        └─ future adapters
```

### Flow Map

```text
[Bridge.ChatToAgent]
[AgentManager.Flow]
chat webview
  -> @afx/transport postMessage
  -> [AgentManager.HostBridge] SidebarPanel.dispatchInbound
  -> [AgentManager.RuntimeMonitor] health polling/status derivation
  -> [AgentManager.Multiplexer] active AgentInstance routing
  -> [AgentManager.AdapterContract] AgentManager interface
  -> runtime adapter (`351-agent-pi` today)
  -> AgentEvent/status/settings back to SidebarPanel
  -> chat webview render state
```

---

## [DES-UI] User Interface & UX

No direct UI is owned here. Webviews use runtime status/configuration payloads to render readiness and settings UX.

---

## [DES-DEC] Key Decisions

| Decision         | Options Considered                                                                                                       | Choice                             | Rationale                                                                                                                                                      |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pi split         | Keep all in `300-infra-pi`, manager/adapters split                                                                       | Manager/adapters split             | Prevents generic runtime behavior from duplicating Pi-specific docs                                                                                            |
| Adapter imports  | Host imports adapter internals, host uses factory/contracts                                                              | Factory/contracts                  | Preserves architecture boundary                                                                                                                                |
| AFX host overlay | Mutate `/afx-*` prompts in multiplexer, synced skill edits, host-loaded Pi extension, conditional appended system prompt | Conditional appended system prompt | Preserves Pi skill expansion, keeps workflow skills portable, avoids brittle runtime extension loaders, and lets future harnesses reuse the same host guidance |

---

## [DES-DATA] Data Model

Core data includes `AgentManager`, runtime status, provider/model catalog entries, runtime events, and settings snapshots.

---

## [DES-API] API Contracts

The `AgentManager` interface and runtime status/provider contracts are the public API between host code, adapters, and webviews.

### [DES-AGENT-LIFECYCLE] Lifecycle Messages

Inbound (from chat webview / settings):

| Message             | Trigger                           | Host action                                                       |
| ------------------- | --------------------------------- | ----------------------------------------------------------------- |
| `agent/checkStatus` | Webview boot, periodic monitor    | `runtimeMonitor.check(requestId)`                                 |
| `agent/restart`     | Settings recovery button, command | `runtimeMonitor.restart(requestId)` (rebuilds active instance)    |
| `agent/reload`      | Settings, manual                  | `vscode.commands.executeCommand("workbench.action.reloadWindow")` |
| `chat/getStderr`    | Settings diagnostics              | `getStderr(maxLines)` for the active instance                     |

When `agent/restart` is received while the chat panel is streaming, the panel first abandons the
local turn state: finish any active assistant row as interrupted, clear queued steer/follow-up
mirrors, clear pending recovery timers, and publish a non-streaming `chat/state`. The runtime monitor
then stops and rechecks the active instance so the next `chat/send` is not blocked by stale host
state.

Outbound (to webview):

| Message                 | Trigger                                 | Payload                                         |
| ----------------------- | --------------------------------------- | ----------------------------------------------- |
| `agent/status`          | Status check result, periodic           | `AgentRuntimeStatus`                            |
| `agent/runtimeSettings` | After mutation (`chat/set*`) or restart | `AgentStatus` slice with thinking/queue/session |
| `agent/stderr`          | Stderr request                          | Captured `content` + `truncated` flag           |

### [DES-AGENT-RUNTIME-STATUS] Runtime Status Shape

`AgentRuntimeStatus` carries:
`phase` (state), `runtime` (`pi` / `pi-sdk` / future), `runtimeConfigured`, `rpcEnabled`,
`message` (optional human reason), `binaryPath`, `versionLabel`, optional `lastError`.

The phase machine below is the source of truth.

### [DES-AGENT-PHASE-MACHINE] Runtime Phase State Machine

```text
            initial
               |
               v
        +-------------+
        |  unknown    |
        +------+------+
               |  startProbe()
               v
        +-------------+   tick (interval)   +-------------+
        |  checking   +-------------------->|   ready     |
        +------+------+                     +------+------+
               | exit(>0) / parseError             | runtime err / exit
               v                                   v
        +-------------+   restart()         +-------------+
        | unsupported |<--------------------|  unhealthy  |
        +-------------+                     +------+------+
                                                   | restart()
                                                   v
                                               (back to checking)
```

Phase transitions are driven by `agent-runtime-monitor.ts` polling the active instance and
mapping exit codes / status payloads into one of the five states above.

### [DES-AGENT-MULTIPLEX-FLOW] AgentManager Multiplex Flow

`MultiplexAgentManager` selects the active instance from a configured set and forwards
calls + listeners to it. Switching the active instance via `replaceInstances` rebuilds the
listener fan-out.

```text
[host: createConfiguredAgentInstances(config)]
    |
    v
+------------------------+   +-----------------------+
| AgentInstance "claude" |   | AgentInstance "pi"    |
|   manager: pi-rpc      |   |   manager: pi-rpc     |
+-----------+------------+   +----------+------------+
            |                            |
            +-------------+--------------+
                          |
                          v
                +------------------+
                | MultiplexAgentMgr|
                +--------+---------+
                         | active = "pi"
                         |
   send(payload)         | listeners (event/stderr)
   -----------+          |
              |          v
              |    +-------------+
              +--->| forwards to |
                   | active mgr  |
                   +-------------+
```

### [DES-AGENT-BEHAVIOUR-ROUTING] Behaviour-Knob Routing

The five behaviour mutations route to the **currently active instance only**, not to all configured instances:

- `setThinkingLevel(level)`
- `setSteeringMode(mode)`
- `setFollowUpMode(mode)`
- `setAutoCompaction(enabled)`
- `setAutoRetry(enabled)`

Implementation: `MultiplexedAgentManager` forwards each call via `requireActive().manager.<setter>(...)` ([apps/vscode/src/multiplex-agent-manager.ts](apps/vscode/src/multiplex-agent-manager.ts) lines 212-229). When the user switches model in the composer (which switches the active instance via `setModel({ instanceId })`), subsequent behaviour mutations target the new instance.

**Consequence for UI:** each `AgentInstance` keeps its own copy of these values internally. Settings UI must surface the active-instance scope so users understand why a value set against one instance does not propagate to another (see `214-app-chat-settings [DES-SETTINGS-INSTANCE-CARDS]`).

**Not changed by this routing decision:** `setModel`, `abort`, `newSession`, `compact` already target the active instance per the existing flow. `getAvailableModels` is the one explicit fan-out (it aggregates from all instances) — see `[DES-AGENT-MULTIPLEX-FLOW]`.

---

### [DES-AGENT-AFX-HOST-OVERLAY] AFX Skill Host Overlay

The VS Code host can add small UI-specific guidance to AFX skill turns, but it
must not alter the user prompt before a harness expands `/skill:afx-*`.
`extension.ts` therefore resolves reusable markdown overlays from
`resources/harness-overlays/common/` and passes them to Pi runtimes as additional
`--append-system-prompt` files. The overlay text is conditional: it applies its
compact `Next:` guidance only when the current turn is an AFX skill invocation,
and it explicitly opts out for non-AFX turns. Deprecated UI action marker tokens
must not be spelled out in the overlay because some models echo negative examples
from system instructions.

The directory rule is strict:

- `apps/vscode/resources/harness-overlays/common/` contains reusable plain overlay content.
- Future harnesses such as `opencode/` or `oh-my-pi/` add sibling overlay/adaptor folders only when a harness cannot consume the common prompt file directly.
- The AFX host overlay must not use Pi `--extension` loading, because extension module resolution can fail before the provider request is created.
- `MultiplexedAgentManager` forwards `/afx-*` and `/skill:afx-*` text unchanged.

```text
User input
  |
  |  /afx-hello
  v
MultiplexedAgentManager
  |  forwards unchanged
  v
Pi RPC adapter
  |  rewrites /afx-hello -> /skill:afx-hello
  |  starts Pi with:
  |    --skill resources/skills/agenticflowx
  |    --append-system-prompt resources/defaults/.afx.yaml
  |    --append-system-prompt resources/harness-overlays/common/agenticflowx-vscode.md
  v
Pi skill expansion
  |  prompt becomes <skill name="afx-hello">...
  v
System prompt append
  |  contains conditional VS Code host overlay guidance
  v
Provider request
  |  contains skill XML + VS Code host overlay guidance
  v
Model response
```

The rejected shape is:

```text
/afx-hello

<afx_vscode_host_overlay>...</afx_vscode_host_overlay>
```

That shape makes the overlay look like user task arguments and can prevent Pi's
skill command expansion. Tests must keep this regression covered by asserting
both the expanded `<skill name="afx-...">` block and the overlay marker reach the
provider payload in the bundled-skill e2e.

---

### [DES-AGENT-DIAGNOSTICS] Diagnostics Flow

Stderr buffer is captured by the runtime adapter and surfaced in chat settings on demand
(`chat/getStderr` -> `agent/stderr`). The buffer is bounded; older lines drop with `truncated:
true`.

The VS Code host filters stderr before posting transcript errors. Fatal-looking lines (JSON error
payloads, `Fatal:`, `Error:`, and JavaScript error-class prefixes) fail the active turn. Warning
or status lines stay diagnostic-only so local backend warmup noise does not spam the transcript.

The first-response watchdog is also host-owned. It waits for a real response-bearing runtime event
instead of `agent_start`, and reads `afx.runtime.responseStartTimeoutMs` from VS Code settings.

### [DES-AGENT-COMMAND-RESTART] / [DES-AGENT-COMMAND-SMOKE-TEST]

VSCode commands `afx.agentRestart` and `afx.agentSmokeTest` registered in `extension.ts` route
into `runtimeMonitor.restart()` and `runtimeMonitor.check()` respectively. Both surface results
through `agent/status` rather than command return values.

---

## [DES-FILES] File Structure

| File                                                                   | Purpose                               |
| ---------------------------------------------------------------------- | ------------------------------------- |
| `packages/shared/src/agent.ts`                                         | Runtime contracts                     |
| `packages/shared/src/provider-catalog.ts`                              | Provider/model catalog contracts      |
| `apps/vscode/src/agent-factory.ts`                                     | Runtime factory                       |
| `apps/vscode/src/multiplex-agent-manager.ts`                           | Runtime multiplexing                  |
| `apps/vscode/src/agent-runtime-monitor.ts`                             | Runtime readiness monitor             |
| `apps/vscode/resources/harness-overlays/common/agenticflowx-vscode.md` | Reusable VS Code overlay instructions |

---

## [DES-DEPS] Dependencies

`100-package-shared`, `200-app-vscode`, and adapter specs such as `351-agent-pi`.

---

## [DES-SEC] Security Considerations

Runtime manager code must not expose provider secrets to webviews. Secret values stay in host storage and only status metadata crosses the bridge.

---

## [DES-ERR] Error Handling

| Scenario               | Handling                                                      |
| ---------------------- | ------------------------------------------------------------- |
| Adapter unavailable    | Report runtime status and keep host responsive                |
| Provider misconfigured | Surface readiness/configuration state without leaking secrets |

---

## [DES-TEST] Testing Strategy

Test shared contracts, runtime monitor transitions, multiplex fallback, provider
selection behavior, and the host-overlay path. The overlay regression test must
prove the multiplexer leaves AFX slash prompts unchanged while the bundled-skill
e2e proves the provider request contains both expanded skill XML and
`<afx_vscode_host_overlay>`.

---

## [DES-ROLLOUT] Migration / Rollout Plan

Retarget runtime manager refs from `chat-foundation` and Pi plan docs. Keep Pi adapter specifics in `351-agent-pi`.

### Rollback Plan

If manager/adapters split is too early, route adapter-neutral files back to `300-infra-pi` only until `351-agent-pi` is accepted.

---

## File Reference Map

| Task | File                                         | Required @see          |
| ---- | -------------------------------------------- | ---------------------- |
| 1.x  | `packages/shared/src/agent.ts`               | `design.md [DES-API]`  |
| 1.x  | `apps/vscode/src/multiplex-agent-manager.ts` | `design.md [DES-ARCH]` |
| 1.x  | `apps/vscode/src/agent-runtime-monitor.ts`   | `design.md [DES-DATA]` |

## Code Locator Map

| Map ID                           | Code anchor                                                                                                | Messages/settings/commands                                                                        | Tests                                                                                                                |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `[AgentManager.AdapterContract]` | `packages/shared/src/agent.ts` `AgentManager`, status/event types                                          | `AgentManager` methods, `AgentEvent`, `AgentRuntimeStatus`                                        | `packages/shared/src/agent-runtime-status.test.ts`                                                                   |
| `[AgentManager.Factory]`         | `apps/vscode/src/agent-factory.ts` `createConfiguredAgentInstances`                                        | `afx.rpc.enabled`, `afx.sdk.*`, provider key availability                                         | `apps/vscode/src/agent-factory.test.ts`                                                                              |
| `[AgentManager.Multiplexer]`     | `apps/vscode/src/multiplex-agent-manager.ts`                                                               | active runtime selection, model tagging, session switching, unchanged AFX skill prompt forwarding | `multiplex-agent-manager.test.ts`                                                                                    |
| `[AgentManager.AfxHostOverlay]`  | `apps/vscode/resources/harness-overlays/common/agenticflowx-vscode.md`, `apps/vscode/src/agent-factory.ts` | conditional VS Code host guidance for AFX skill prompts, appended as system prompt files          | `agent-factory.test.ts`, `rpc-manager-send.test.ts`, `sdk-rpc-manager.test.ts`, `apps/vscode-e2e/src/skills.test.ts` |
| `[AgentManager.RuntimeMonitor]`  | `apps/vscode/src/agent-runtime-monitor.ts`                                                                 | `agent/checkStatus`, `agent/restart`, runtime status events                                       | `agent-runtime-monitor.test.ts`                                                                                      |
| `[AgentManager.HostBridge]`      | `apps/vscode/src/panels/sidebar-panel.ts` inbound dispatch and event handlers                              | `chat/send`, `chat/steer`, `chat/followUp`, `agent/runtimeSettings`                               | `sidebar-panel.test.ts`, `extension.test.ts`                                                                         |
| `[Bridge.ChatToAgent]`           | `apps/chat/src/lib/bridge.ts`, `apps/vscode/src/panels/sidebar-panel.ts`                                   | `ChatToAgent`, `HostToChat`, `@afx/transport` postMessage bridge                                  | `sidebar-panel.test.ts`, chat bridge tests                                                                           |

---

## Open Technical Questions

None.
