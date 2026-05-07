---
afx: true
type: DESIGN
status: Draft
owner: "@rixrix"
version: "1.1"
created_at: "2026-05-02T23:56:50.000Z"
updated_at: "2026-05-07T08:58:58.000Z"
tags: ["agent", "pi", "rpc", "sdk", "skills"]
spec: spec.md
---

# Agent Pi - Technical Design

---

## [DES-OVR] Overview

The Pi adapter implements the agent manager contract through a Node subprocess RPC layer, bundled SDK/bootstrap assets, and the host-side `sync:skills` utility that refreshes the vendored AFX skill pack from upstream before packaging.

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

### [DES-PI-CUSTOM-PROVIDERS] Pi Custom Providers (RPC vs SDK)

Pi RPC and Pi SDK resolve custom providers (DeepSeek, Together, Groq, Ollama, LM Studio, vLLM, proxies, …) through _different_ mechanisms. Both end up running Pi's model-resolution logic, but the configuration source diverges.

#### Pi RPC

The Pi binary reads `~/.pi/agent/models.json` natively via `getAgentDir()` (pi-mono `packages/coding-agent/src/config.ts` lines 402-417). Pi's documented auth resolution applies (env-var name, `!shell-cmd`, or literal in the file).

**AFX's role**: deep-link only. AFX does not read or write this file. The Settings UI provides an "Open models.json" button (with create-if-missing) that opens it in VSCode for direct editing. See `214-app-chat-settings [DES-SETTINGS-CUSTOM-MODELS]`.

#### Pi SDK

The SDK process is a Node bootstrap subprocess (not the Pi binary). At spawn, AFX injects provider config via env vars in `buildBootstrapEnv` ([packages/agent/pi-sdk/src/sdk-rpc-manager.ts](packages/agent/pi-sdk/src/sdk-rpc-manager.ts) lines 676-712):

| Env var                                                    | Purpose                                                           |
| ---------------------------------------------------------- | ----------------------------------------------------------------- |
| `AFX_PROVIDER`                                             | Active provider id                                                |
| `AFX_MODEL_ID`                                             | Active model id                                                   |
| `AFX_API_KEY_<PROVIDER>` (and aliases)                     | Per-provider API key sourced from VSCode SecretStorage            |
| `AFX_OLLAMA_BASE_URL`                                      | Ollama base URL (the only custom-provider shortcut shipped today) |
| `PI_PACKAGE_DIR`, `AFX_SESSION_DIR`, `PI_CODING_AGENT_DIR` | Path injection                                                    |

**Today's gap**: SDK users cannot configure DeepSeek or other custom OpenAI-compat endpoints — only Ollama is parameterisable. The interim path is to enable Pi RPC and use its track of the Settings → Models → Custom Models UI.

**Phase-1 (follow-up PR, not this PR)**: extend `buildBootstrapEnv` to accept `secretEnv: Record<string, string>` and inject `AFX_API_KEY_<PROVIDER>` for each AFX-managed custom provider. AFX writes a **`models.json`-shaped config** (its own file under workspace `.afx/` or VSCode global state) where `apiKey` fields use env-var indirection (`"apiKey": "AFX_API_KEY_DEEPSEEK"`). Pi's documented env-var resolution then resolves the key at request time. Secrets stay in VSCode SecretStorage; the on-disk config carries only the env-var _name_.

#### Why two tracks, not one shared list

Conflating them would force AFX to either (a) duplicate Pi's secret resolution logic and race with Pi on writes to `models.json`, or (b) abandon SecretStorage for SDK custom providers (regression vs the chosen secret strategy). The Settings UI separates the two via a `Track: [ Pi SDK ] [ Pi RPC ]` selector under Custom Models.

**v1 deliverables (this PR):**

- AFX deep-link to `~/.pi/agent/models.json` for the Pi RPC track.
- Placeholder for the Pi SDK track explaining the upcoming AFX-managed config + JSON ↔ Mapped UI editor.
- Pi-side code unchanged.

**Phase-1 (follow-up PR) deliverables:**

- `secretEnv` extension to `buildBootstrapEnv` (concrete file paths added at that time).
- AFX-managed config reader/writer/watcher (host-side, in `apps/vscode/src/`).
- Mapped UI editor + raw JSON editor in the Pi SDK track of `apps/chat/src/views/settings.tsx`.

@see `docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-CUSTOM-MODELS]`
@see `docs/research/pi/res-pi-models-json-settings-ui.md`

---

## [DES-FILES] File Structure

| File                                                               | Purpose                                                                                                                        |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `packages/agent/pi/src/rpc-client.ts`                              | JSONL subprocess transport                                                                                                     |
| `packages/agent/pi/src/rpc-manager.ts`                             | Pi `AgentManager` implementation                                                                                               |
| `packages/agent/pi-sdk/src/index.ts`                               | SDK bundle/bootstrap surface                                                                                                   |
| `apps/vscode/src/pi-sdk-bundle.test.ts`                            | Host bundle verification                                                                                                       |
| `apps/vscode/scripts/sync-skills.mjs`                              | Skills sync utility (`pnpm sync:skills`) that fetches upstream AFX skills and refreshes the vendored bundle                    |
| `packages/agent/pi-sdk/src/sdk-rpc-manager.ts` `buildBootstrapEnv` | Bootstrap env injection for SDK; `secretEnv` extension for custom providers lands in phase-1 (see `[DES-PI-CUSTOM-PROVIDERS]`) |

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
3. Use `pnpm sync:skills` whenever upstream AFX skills change, then commit the refreshed vendored bundle.
4. Decide whether `300-infra-pi` becomes retired after migration.

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

| Map ID                     | Code anchor                                                           | Messages/settings/commands                                           | Tests                                               |
| -------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------- |
| `[AgentPi.FactoryInput]`   | `apps/vscode/src/agent-factory.ts`, `apps/vscode/src/extension.ts`    | `afx.rpc.enabled`, `afx.agentBinaryPath`, `afx.sdk.*`                | `agent-factory.test.ts`, `pi-sdk-bundle.test.ts`    |
| `[AgentPi.RpcManager]`     | `packages/agent/pi/src/rpc-manager.ts` `createAgentManager`           | `send`, `steer`, `followUp`, `compact`, runtime settings             | `rpc-manager*.test.ts`                              |
| `[AgentPi.Lifecycle]`      | `rpc-manager.ts` `ensureStarted`, `stop`, start retry state           | lazy start, restart-required status, shutdown                        | `rpc-manager.test.ts`                               |
| `[AgentPi.RpcJsonl]`       | `packages/agent/pi/src/rpc-client.ts` `createPiClient`                | `prompt`, `abort`, `set_model`, `get_state`, JSONL frames            | `rpc-client.test.ts`                                |
| `[AgentPi.EventNormalize]` | `rpc-manager.ts` `normalizePiEvent`, `normalizeUiRequest`             | Pi event stream, `extension_ui_request`, tool/status events          | `rpc-manager-unwrap.test.ts`                        |
| `[AgentPi.SdkBootstrap]`   | `packages/agent/pi-sdk/src/index.ts`, `bootstrap/*.ts`                | SDK provider runtime bootstrap                                       | `packages/agent/pi-sdk/src/sdk-rpc-manager.test.ts` |
| `[AgentPi.SkillBundle]`    | `apps/vscode/scripts/sync-skills.mjs`, `apps/vscode/resources/pi-sdk` | bundled AFX skills refresh (`pnpm sync:skills`) and bootstrap assets | `apps/vscode-e2e/src/skills.test.ts`                |

---

## Open Technical Questions

| #   | Question                                                              | Status |
| --- | --------------------------------------------------------------------- | ------ |
| 1   | Which Pi SDK assets must be executable or path-normalized on Windows? | Open   |
