---
afx: true
type: DESIGN
status: Draft
owner: "@rixrix"
version: "1.0"
created_at: "2026-05-02T23:56:50.000Z"
updated_at: "2026-05-03T00:34:22.000Z"
tags: ["agent", "pi", "rpc", "sdk"]
spec: spec.md
---

# Agent Pi - Technical Design

---

## [DES-OVR] Overview

The Pi adapter implements the agent manager contract through a Node subprocess RPC layer and bundled SDK/bootstrap assets.

---

## [DES-ARCH] Architecture

```text
VSCode host config/secrets
        │ injected options
        ▼
packages/agent/pi
        ├─ rpc-client JSONL subprocess transport
        ├─ rpc-manager AgentManager implementation
        └─ Pi SDK/bootstrap/skills assets
```

### Flow Map

```text
[AgentPi.Flow]
VSCode host config + SecretStore
  -> [AgentPi.FactoryInput] createConfiguredAgentInstances
  -> [AgentPi.RpcManager] createAgentManager
  -> [AgentPi.Lifecycle] ensureStarted / stop / dispose
  -> [AgentPi.RpcJsonl] createPiClient stdin/stdout JSONL
  -> pi --mode rpc subprocess
  -> [AgentPi.EventNormalize] PiEvent -> AgentEvent
  -> AgentManager listeners -> SidebarPanel -> chat webview
```

---

## [DES-UI] User Interface & UX

No direct UI is owned here. Readiness/configuration status is exposed to chat settings and composer through `350-agent-manager` payloads.

---

## [DES-DEC] Key Decisions

| Decision       | Options Considered                                  | Choice              | Rationale                                                |
| -------------- | --------------------------------------------------- | ------------------- | -------------------------------------------------------- |
| Pi ownership   | Keep in `300-infra-pi`, move to agent adapter child | Adapter child       | Pi is one runtime adapter among possible future adapters |
| VSCode imports | Adapter imports VSCode, host injects config         | Host injects config | Keeps adapter package reusable and testable              |

---

## [DES-DATA] Data Model

Pi RPC uses JSONL request/response frames, process lifecycle state, runtime capabilities, model metadata, and host-injected config/secrets.

---

## [DES-API] API Contracts

The Pi adapter implements `AgentManager` and exposes adapter factory/config options. RPC framing is internal to the adapter package.

### [DES-PI-RUNTIME-CONTROLS] Pi Runtime Controls

Inbound (from chat settings):

| Message                   | Trigger                           | Host action                                                 |
| ------------------------- | --------------------------------- | ----------------------------------------------------------- |
| `external/detectPiBinary` | Settings recovery button          | Probe `PATH` + common install paths; surface `binaryPath`   |
| `external/setRpcEnabled`  | Settings RPC toggle               | Update `afx.rpc.enabled`; restart active instance if needed |
| `external/setEphemeral`   | Settings ephemeral session toggle | Update `afx.agentEphemeralSession`; rebuild on next send    |

### [DES-PI-COMMAND-DETECT-BINARY]

The `afx.detectPiBinary` command (registered in `extension.ts`) runs the same probe as
`external/detectPiBinary` from a command-palette entry, useful when Settings is not open.

### [DES-PI-RPC-FLOW] Pi RPC Subprocess Flow

```text
[host: AgentManager.send(payload)]
    |
    v
[351 rpc-manager.send]
    encodes JSONL line, writes to subprocess stdin
    |
    v
[Pi subprocess]
    parses request, dispatches to runtime
    streams responses (delta events)
    |
    v
[host: rpc-client onData(buffer)]
    accumulates, splits by \n, parses JSONL
    |
    v
[rpc-client emit(event)]
    fans out to subscribers
    |
    v
[host: AgentManager listeners]
    bridge events back to webview
```

Failures: if the subprocess exits before completing a turn, `rpc-manager` emits a synthesized
`messageEnd` with `stopReason: "error"` plus `agent/status` -> `unhealthy`. Restart goes through
`runtimeMonitor.restart` (see `350-agent-manager [DES-AGENT-PHASE-MACHINE]`).

---

## [DES-FILES] File Structure

| File                                    | Purpose                          |
| --------------------------------------- | -------------------------------- |
| `packages/agent/pi/src/rpc-client.ts`   | JSONL subprocess transport       |
| `packages/agent/pi/src/rpc-manager.ts`  | Pi `AgentManager` implementation |
| `packages/agent/pi-sdk/src/index.ts`    | SDK bundle/bootstrap surface     |
| `apps/vscode/src/pi-sdk-bundle.test.ts` | Host bundle verification         |
| `apps/vscode/scripts/sync-skills.mjs`   | Skills sync utility              |

---

## [DES-DEPS] Dependencies

`350-agent-manager`, `100-package-shared`, and existing `300-infra-pi` during migration.

---

## [DES-SEC] Security Considerations

- Host secrets are injected into adapter options and must not be logged.
- Adapter subprocess arguments/environment must avoid exposing secrets unnecessarily.

---

## [DES-ERR] Error Handling

| Scenario             | Handling                                                |
| -------------------- | ------------------------------------------------------- |
| SDK missing/unusable | Surface runtime unavailable status                      |
| RPC frame malformed  | Reject the pending request and keep manager recoverable |
| Subprocess exits     | Update runtime status and allow restart/lazy startup    |

---

## [DES-TEST] Testing Strategy

Run Pi RPC manager/client tests, SDK bundle tests, no-VSCode-import tests, and host config injection tests.

---

## [DES-ROLLOUT] Migration / Rollout Plan

1. Move Pi-specific `@see` refs from retired chat/Pi plan docs to this spec.
2. Keep runtime-neutral refs on `350-agent-manager`.
3. Decide whether `300-infra-pi` becomes retired after migration.

### Rollback Plan

If adapter split is rejected, keep `300-infra-pi` as the parent while preserving the manager/adapters distinction in source comments.

---

## File Reference Map

| Task | File                                  | Required @see           |
| ---- | ------------------------------------- | ----------------------- |
| 1.x  | `packages/agent/pi/src/*.ts`          | `design.md [DES-API]`   |
| 1.x  | `packages/agent/pi-sdk/src/index.ts`  | `design.md [DES-FILES]` |
| 1.x  | `apps/vscode/scripts/sync-skills.mjs` | `design.md [DES-FILES]` |

## Code Locator Map

| Map ID                     | Code anchor                                                           | Messages/settings/commands                                  | Tests                                               |
| -------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------- | --------------------------------------------------- |
| `[AgentPi.FactoryInput]`   | `apps/vscode/src/agent-factory.ts`, `apps/vscode/src/extension.ts`    | `afx.rpc.enabled`, `afx.agentBinaryPath`, `afx.sdk.*`       | `agent-factory.test.ts`, `pi-sdk-bundle.test.ts`    |
| `[AgentPi.RpcManager]`     | `packages/agent/pi/src/rpc-manager.ts` `createAgentManager`           | `send`, `steer`, `followUp`, `compact`, runtime settings    | `rpc-manager*.test.ts`                              |
| `[AgentPi.Lifecycle]`      | `rpc-manager.ts` `ensureStarted`, `stop`, start retry state           | lazy start, restart-required status, shutdown               | `rpc-manager.test.ts`                               |
| `[AgentPi.RpcJsonl]`       | `packages/agent/pi/src/rpc-client.ts` `createPiClient`                | `prompt`, `abort`, `set_model`, `get_state`, JSONL frames   | `rpc-client.test.ts`                                |
| `[AgentPi.EventNormalize]` | `rpc-manager.ts` `normalizePiEvent`, `normalizeUiRequest`             | Pi event stream, `extension_ui_request`, tool/status events | `rpc-manager-unwrap.test.ts`                        |
| `[AgentPi.SdkBootstrap]`   | `packages/agent/pi-sdk/src/index.ts`, `bootstrap/*.ts`                | SDK provider runtime bootstrap                              | `packages/agent/pi-sdk/src/sdk-rpc-manager.test.ts` |
| `[AgentPi.SkillBundle]`    | `apps/vscode/scripts/sync-skills.mjs`, `apps/vscode/resources/pi-sdk` | bundled AFX skills and bootstrap assets                     | `apps/vscode-e2e/src/skills.test.ts`                |

---

## Open Technical Questions

| #   | Question                                                              | Status |
| --- | --------------------------------------------------------------------- | ------ |
| 1   | Which Pi SDK assets must be executable or path-normalized on Windows? | Open   |
