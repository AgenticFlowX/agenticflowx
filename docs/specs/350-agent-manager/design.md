---
afx: true
type: DESIGN
status: Approved
owner: "@rixrix"
version: "1.1"
created_at: "2026-05-02T23:56:50.000Z"
updated_at: "2026-05-09T12:21:59.000Z"
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

| Decision        | Options Considered                                          | Choice                 | Rationale                                                           |
| --------------- | ----------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------- |
| Pi split        | Keep all in `300-infra-pi`, manager/adapters split          | Manager/adapters split | Prevents generic runtime behavior from duplicating Pi-specific docs |
| Adapter imports | Host imports adapter internals, host uses factory/contracts | Factory/contracts      | Preserves architecture boundary                                     |

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

### [DES-AGENT-DIAGNOSTICS] Diagnostics Flow

Stderr buffer is captured by the runtime adapter and surfaced in chat settings on demand
(`chat/getStderr` -> `agent/stderr`). The buffer is bounded; older lines drop with `truncated:
true`.

### [DES-AGENT-COMMAND-RESTART] / [DES-AGENT-COMMAND-SMOKE-TEST]

VSCode commands `afx.agentRestart` and `afx.agentSmokeTest` registered in `extension.ts` route
into `runtimeMonitor.restart()` and `runtimeMonitor.check()` respectively. Both surface results
through `agent/status` rather than command return values.

---

## [DES-FILES] File Structure

| File                                         | Purpose                          |
| -------------------------------------------- | -------------------------------- |
| `packages/shared/src/agent.ts`               | Runtime contracts                |
| `packages/shared/src/provider-catalog.ts`    | Provider/model catalog contracts |
| `apps/vscode/src/agent-factory.ts`           | Runtime factory                  |
| `apps/vscode/src/multiplex-agent-manager.ts` | Runtime multiplexing             |
| `apps/vscode/src/agent-runtime-monitor.ts`   | Runtime readiness monitor        |

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

Test shared contracts, runtime monitor transitions, multiplex fallback, and provider selection behavior.

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

| Map ID                           | Code anchor                                                                   | Messages/settings/commands                                          | Tests                                              |
| -------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------- |
| `[AgentManager.AdapterContract]` | `packages/shared/src/agent.ts` `AgentManager`, status/event types             | `AgentManager` methods, `AgentEvent`, `AgentRuntimeStatus`          | `packages/shared/src/agent-runtime-status.test.ts` |
| `[AgentManager.Factory]`         | `apps/vscode/src/agent-factory.ts` `createConfiguredAgentInstances`           | `afx.rpc.enabled`, `afx.sdk.*`, provider key availability           | `apps/vscode/src/agent-factory.test.ts`            |
| `[AgentManager.Multiplexer]`     | `apps/vscode/src/multiplex-agent-manager.ts`                                  | active runtime selection, model tagging, session switching          | `multiplex-agent-manager.test.ts`                  |
| `[AgentManager.RuntimeMonitor]`  | `apps/vscode/src/agent-runtime-monitor.ts`                                    | `agent/checkStatus`, `agent/restart`, runtime status events         | `agent-runtime-monitor.test.ts`                    |
| `[AgentManager.HostBridge]`      | `apps/vscode/src/panels/sidebar-panel.ts` inbound dispatch and event handlers | `chat/send`, `chat/steer`, `chat/followUp`, `agent/runtimeSettings` | `sidebar-panel.test.ts`, `extension.test.ts`       |
| `[Bridge.ChatToAgent]`           | `apps/chat/src/lib/bridge.ts`, `apps/vscode/src/panels/sidebar-panel.ts`      | `ChatToAgent`, `HostToChat`, `@afx/transport` postMessage bridge    | `sidebar-panel.test.ts`, chat bridge tests         |

---

## Open Technical Questions

None.
