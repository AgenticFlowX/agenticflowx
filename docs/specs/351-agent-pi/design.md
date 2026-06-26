---
afx: true
type: DESIGN
status: Living
owner: "@rixrix"
version: "1.4"
created_at: "2026-05-02T23:56:50.000Z"
updated_at: "2026-06-26T12:50:19.000Z"
tags: ["agent", "pi", "rpc", "sdk", "skills", "custom-providers", "project-trust"]
spec: spec.md
---

# Agent Pi - Technical Design

---

## [DES-OVR] Overview

The Pi adapter implements the agent manager contract through a Node subprocess RPC layer, bundled SDK/bootstrap assets, Pi 0.80-compatible startup arguments, and the host-side `sync:skills` utility that refreshes the vendored AFX skill pack from upstream before packaging.

---

## [DES-ARCH] Architecture

```text
VSCode host config/secrets
        │ injected options
        ▼
packages/agent/pi
        ├─ rpc-client JSONL subprocess transport
        ├─ rpc-manager AgentManager implementation
        └─ Pi SDK/bootstrap/skills/API assets
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

---

## [DES-PI-CUSTOM-PROVIDERS] Pi SDK Custom Providers Adapter

The Pi SDK adapter is the first concrete `HarnessAdapter` implementation (per `[ADR-0008]`). It bridges AFX-managed canonical `CustomProviderRecord` data from `100-package-shared` to pi-mono's in-process `ModelRegistry.registerProvider(name, config)` API.

### Bootstrap envelope protocol

The host injects two env vars at Pi SDK spawn:

- `AFX_CUSTOM_PROVIDERS_JSON` — JSON envelope `{ providers: Record<id, PiMonoProviderConfig> }`. Each provider config has `apiKey: "AFX_<SLUG>_KEY"` (env-var reference, never literal).
- `AFX_<SLUG>_KEY=<actual-secret>` — one entry per provider whose API key source is `vscode-secret`. Slug is uppercase, hyphens→underscores, validated `[A-Z][A-Z0-9_]*`.
- `AFX_PROVIDER_OVERRIDES_JSON` — optional JSON envelope `{ overrides: Record<providerId, { baseUrl?, apiKeyEnv? }> }` used for built-in provider request/base-URL overrides such as Copilot Enterprise and subscription env-key configuration.

The Pi SDK bootstrap (`packages/agent/pi-sdk/bootstrap/bootstrap.ts`) builds Pi extension factories from those envelopes, then delegates to Pi `main(...)` with the rewritten startup args:

```text
const factories = [
  buildAfxCustomProvidersExtensionFactory(env),
  buildAfxProviderOverridesExtensionFactory(env),
].filter(Boolean);

await main(buildBootstrapArgs(process.argv.slice(2)), { extensionFactories: factories });
```

### Adapter contract

`packages/agent/pi-sdk/src/custom-providers-adapter.ts` exports `createPiSdkCustomProvidersAdapter(): HarnessAdapter` with:

- `id: 'pi-sdk'`
- `displayName: 'Pi SDK'`
- `materialization: 'in-process-register'`
- `handEditedConfigPath()` — `~/.pi/agent/models.json` (used by host service for the Pi RPC track read-only display in `214-app-chat-settings`).
- `encodeForBootstrap(records)` — translates canonical records into the JSON envelope + env map shipped via `AFX_CUSTOM_PROVIDERS_JSON` and `AFX_<SLUG>_KEY` entries. Threads `record.displayName` into pi-mono `ProviderConfig.name` so the chat model picker labels groups with the user's chosen name. Layers pi-mono compat defaults onto the canonical compat (e.g. `supportsDeveloperRole: false` for Ollama / vLLM). When `apiKeyRef.source === "none"` (local providers like Ollama) the adapter emits `apiKey: "no-key"` + `authHeader: false` to satisfy pi-mono's `registerProvider` validation, which rejects providers that define `models[]` without `apiKey`. The placeholder is never sent over the wire because `authHeader: false` suppresses the Authorization header.
- `parseHandEdited(text)` — tolerant parse of pi-native `models.json`. Classifies entries: those with own `models[]` become canonical CUSTOM records; entries without `models[]` (OVERRIDE/TWEAKS patterns) are emitted as `warnings` and skipped — never surfaced in Pi SDK CRUD.

### Source-of-truth boundaries

```text
                                   ┌──────────────────────────────────────┐
Pi SDK track (AFX-managed)         │  VSCode SecretStorage                │
  └─ host service                  │  afx.customProvider.${id}            │
  └─ bootstrap envelope            │  afx.customProviders.index           │
  └─ pi-mono registry overlay      └──────────────────────────────────────┘

Pi RPC track (read-only display)   ┌──────────────────────────────────────┐
  └─ host FileSystemWatcher        │  ~/.pi/agent/models.json (user-      │
  └─ adapter.parseHandEdited       │  edited; AFX never writes)           │
                                   └──────────────────────────────────────┘
```

The Pi SDK runtime path **never** reads `~/.pi/agent/models.json` for AFX-managed records. AFX registers those records through the Pi SDK bootstrap extension factory. Pi RPC's runtime path is unchanged and continues to read the file directly.

When the host rebuilds Pi SDK with AFX-managed custom providers, the spawn
descriptor receives the saved `afx.sdk.defaultModel`. If that default references
a configured custom provider/model, it becomes the initial Pi SDK provider and
model; otherwise the first configured custom model remains the fallback.

### Refresh contract

| Trigger                                                            | Pi SDK action                                                                                                       |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `secretStore.onDidChange('afx.customProvider.*')` (UI or external) | Host re-reads SecretStorage; rebuilds runtime (`scheduleAgentRuntimeRebuild('custom providers updated')`) debounced |
| `~/.pi/agent/models.json` watcher fires                            | Pi RPC track display recomputed; **Pi SDK runtime untouched**                                                       |
| Display-only field edit (display name, etc.)                       | Snapshot rebroadcast; no runtime restart                                                                            |

---

### [DES-PI-RUNTIME-CONTROLS] Pi Runtime Controls

Inbound (from chat settings):

| Message                   | Trigger                           | Host action                                                 |
| ------------------------- | --------------------------------- | ----------------------------------------------------------- |
| `external/detectPiBinary` | Settings recovery button          | Probe `PATH` + common install paths; surface `binaryPath`   |
| `external/setRpcEnabled`  | Settings RPC toggle               | Update `afx.rpc.enabled`; restart active instance if needed |
| `external/setEphemeral`   | Settings ephemeral session toggle | Update `afx.agentEphemeralSession`; rebuild on next send    |

### [DES-PI-080-STARTUP] Pi 0.80 Startup Compatibility

Both the external Pi RPC manager and bundled Pi SDK manager construct startup args from host settings:

| Host setting / source                   | Runtime effect                                                                                           |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| bundled `resources/skills/agenticflowx` | Passed as `--skill <path>` so bundled AFX skills load in both runtimes                                   |
| `afx.skills.extraPaths`                 | Normalized relative to workspace / `~` / absolute paths and appended as additional `--skill <path>` args |
| `afx.pi.projectTrust = trust`           | Passed as `--approve`                                                                                    |
| `afx.pi.projectTrust = ignore`          | Passed as `--no-approve`                                                                                 |
| `afx.pi.projectTrust = ask` + resources | Host starts Pi with project resources ignored until the user chooses trust or ignore in AFX Settings     |
| `afx.pi.excludedTools`                  | Passed as comma-separated `--exclude-tools`                                                              |
| `afx.network.httpProxy`                 | Injected as `HTTP_PROXY` and `HTTPS_PROXY` in spawned runtime env                                        |
| host overlay markdown                   | Passed as `--append-system-prompt resources/harness-overlays/common/agenticflowx-vscode.md`              |

Only the host overlay markdown is appended as a system prompt. AFX project trust is host-owned: choosing trust or ignore writes the workspace `afx.pi.projectTrust` setting and restarts runtimes; AFX does not write Pi global `trust.json`.

The bundled SDK build includes Pi's Bedrock raw API implementation at `resources/pi-sdk/api/bedrock-converse-stream.js` so the packaged bootstrap can satisfy Pi's lazy import at runtime.

Adapter normalization preserves Pi 0.80 metadata:

- `AgentCommand.sourceInfo` keeps Pi provenance (`path`, `scope`, `origin`, `source`) for Settings grouping and duplicate warnings.
- Compaction events/results preserve `estimatedTokensAfter`, `reason`, and `willRetry`.

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

### [DES-PI-CUSTOM-PROVIDERS-RPC-SDK] Pi Custom Providers (RPC vs SDK)

Pi RPC and Pi SDK resolve custom providers (DeepSeek, Together, Groq, Ollama, LM Studio, vLLM, proxies, …) through _different_ mechanisms. Both end up running Pi's model-resolution logic, but the configuration source diverges.

#### Pi RPC

The Pi binary reads `~/.pi/agent/models.json` natively via `getAgentDir()` (pi-mono `packages/coding-agent/src/config.ts` lines 402-417). Pi's documented auth resolution applies (env-var name, `!shell-cmd`, or literal in the file).

**AFX's role**: deep-link only. AFX does not read or write this file. The Settings UI provides an "Open models.json" button (with create-if-missing) that opens it in VSCode for direct editing. See `214-app-chat-settings [DES-SETTINGS-CUSTOM-MODELS]`.

#### Pi SDK

The SDK process is a Node bootstrap subprocess (not the Pi binary). At spawn, AFX injects active provider/model, credential env, custom provider envelopes, provider override envelopes, and runtime args through `buildBootstrapEnv` and `buildBootstrapArgs`:

| Env var                                                    | Purpose                                                                                            |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `AFX_PROVIDER`                                             | Active provider id                                                                                 |
| `AFX_MODEL_ID`                                             | Active model id                                                                                    |
| `AFX_API_KEY_<PROVIDER>` (and aliases)                     | Per-provider key/token sourced from VSCode SecretStorage or OAuth service                          |
| `AFX_AUTH_METHOD_<PROVIDER>`                               | Distinguishes subscription/OAuth credentials from API keys so secrets stay out of `--api-key` args |
| `AFX_CUSTOM_PROVIDERS_JSON`                                | AFX-managed custom providers registered through the bootstrap extension factory                    |
| `AFX_PROVIDER_OVERRIDES_JSON`                              | Built-in provider base-URL/env-key overrides applied through the bootstrap extension factory       |
| `AFX_OLLAMA_BASE_URL`                                      | Ollama base URL shortcut                                                                           |
| `PI_PACKAGE_DIR`, `AFX_SESSION_DIR`, `PI_CODING_AGENT_DIR` | Path injection                                                                                     |

#### Why two tracks, not one shared list

Conflating them would force AFX to either (a) duplicate Pi's secret resolution logic and race with Pi on writes to `models.json`, or (b) abandon SecretStorage for SDK custom providers (regression vs the chosen secret strategy). The Settings UI separates the two via a `Track: [ Pi SDK ] [ Pi RPC ]` selector under Custom Models.

**Contract:**

- AFX deep-link to `~/.pi/agent/models.json` for the Pi RPC track.
- Full Pi SDK track CRUD for AFX-managed custom providers backed by VSCode SecretStorage.
- Runtime registration through Pi extension factories instead of writing Pi config files.

@see `docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-CUSTOM-MODELS]`
@see `docs/research/pi/res-pi-models-json-settings-ui.md`

---

## [DES-FILES] File Structure

| File                                                               | Purpose                                                                                                                                  |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/agent/pi/src/rpc-client.ts`                              | JSONL subprocess transport                                                                                                               |
| `packages/agent/pi/src/rpc-manager.ts`                             | Pi `AgentManager` implementation                                                                                                         |
| `packages/agent/pi-sdk/src/index.ts`                               | SDK bundle/bootstrap surface                                                                                                             |
| `apps/vscode/src/pi-sdk-bundle.test.ts`                            | Host bundle verification                                                                                                                 |
| `apps/vscode/scripts/sync-skills.mjs`                              | Skills sync utility (`pnpm sync:skills`) that fetches upstream AFX skills and refreshes the vendored bundle                              |
| `packages/agent/pi-sdk/src/sdk-rpc-manager.ts` `buildBootstrapEnv` | Bootstrap env injection for SDK custom providers, provider overrides, auth methods, proxy env, project trust, excluded tools, and skills |

---

## [DES-DEPS] Dependencies

`350-agent-manager`, `100-package-shared`, and `300-infra-pi`.

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

- **Runtime-floor e2e assertion** (tied to `spec.md [NFR-4]` and `engines.vscode ^1.105.0`): the e2e suite asserts that the extension-host `process.versions.node` satisfies `>=22.19.0`. This is required because the bundled Pi SDK is spawned using the extension-host `process.execPath`; running on a VS Code whose bundled Node is older than `22.19.0` would silently break Pi SDK startup even if the VSIX installs successfully. The `engines.vscode ^1.105.0` floor prevents installation on affected VS Code versions, and the e2e assertion guards against regressions to that floor. See `ADR-0009`.

---

## [DES-MAINT] Maintenance Plan

1. Pi-specific `@see` refs point to this spec.
2. Runtime-neutral refs point to `350-agent-manager`.
3. `pnpm sync:skills` refreshes the vendored AFX skill bundle whenever upstream AFX skills change.
4. `300-infra-pi` remains reference material for shared Pi context.

### Fallback

If routing changes, update the spec references before moving source ownership.

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
