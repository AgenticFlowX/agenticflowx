---
afx: true
type: DESIGN
status: Living
owner: "@rixrix"
version: "1.7"
created_at: "2026-05-02T23:56:50.000Z"
updated_at: "2026-05-21T12:36:36.000Z"
approved_at: "2026-05-05T11:45:45.000Z"
tags: ["app", "chat", "settings", "providers", "mode", "workspace-mode", "custom-models"]
spec: spec.md
---

# App Chat Settings - Technical Design

---

## [DES-OVR] Overview

The settings zone renders provider/runtime configuration state inside the chat webview. It consumes shared snapshots and sends configuration requests through the transport bridge. It also owns the workspace posture card, which is the canonical place to switch between Code (`default`, full access, Pi-backed), Explore (`experimental`, read-only, inspection/planning), and Spec (`planning-only`).

---

## [DES-ARCH] Architecture

```text
VSCode host runtime/settings → shared snapshot → chat settings view → provider/runtime UI actions
```

## [DES-SETTINGS-FLOW] Settings Snapshot And Mutation Flow

```text
Settings view
  -> bridgeSend(snapshot/provider/runtime/appearance/telemetry messages)
  -> @afx/transport webview bridge
  -> VSCode SidebarPanel.dispatchInbound
  -> VSCode settings / SecretStore / AgentManager
  -> agent/settingsSnapshot | agent/runtimeSettings | agent/appearanceUpdated
```

| Flow               | Source anchor                                                                                            | Bridge message                                                                                                                               | Host-owned result                                                                         | Returned state                                                                    |
| ------------------ | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Hydrate panel      | mount effect in `Settings`                                                                               | `chat/getSettingsSnapshot`, `chat/getCommands`, `chat/getState`                                                                              | Host broadcasts settings, commands, runtime settings                                      | `agent/settingsSnapshot`, `agent/commands`, `agent/runtimeSettings`               |
| Runtime controls   | `applyThinkingLevel`, `applySteeringMode`, `applyFollowUpMode`, `applyAutoCompaction`, `applyAutoRetry`  | `chat/setThinkingLevel`, `chat/setSteeringMode`, `chat/setFollowUpMode`, `chat/setAutoCompaction`, `chat/setAutoRetry`                       | Active `AgentManager` runtime setting update                                              | `agent/runtimeSettings` or `chat/error`                                           |
| Context preference | `applyIncludeActiveFileContext`                                                                          | `chat/setIncludeActiveFileContext`                                                                                                           | Host persists `afx.context.includeActiveFileContext` + snapshot                           | `agent/settingsSnapshot` or `chat/error`                                          |
| Workspace mode     | `applyMode`                                                                                              | `chat/setMode`                                                                                                                               | Host persists `afx.mode.active` globally by default, preserving workspace overrides       | `agent/settingsSnapshot` or `chat/error`                                          |
| Composer Intent    | `applyIntentSlot`, `applyIntentMinimized`, `applyIntentScope`                                            | `chat/setIntentSlot`, `chat/setIntentMinimized`, `chat/setIntentScope`                                                                       | Host persists `afx.composer.intent.*` globally by default or as a workspace override      | `agent/settingsSnapshot` or `chat/error`                                          |
| Appearance         | `applyTheme`, `applyStyle`                                                                               | `appearance/update`                                                                                                                          | Host persists `afx.theme` / `afx.style` and emits runtime appearance                      | `agent/appearanceUpdated` or `chat/error`                                         |
| API provider key   | `saveProviderKey`, `clearProviderKey`, `setProviderDefaultModel`                                         | `provider/setApiKey`, `provider/clearApiKey`, `provider/setDefaultModel`                                                                     | Host SecretStore/settings mutation                                                        | `agent/settingsSnapshot` or `chat/error`                                          |
| Pi RPC local agent | `detectPiBinary`, `setRpcEnabled`, `setEphemeralSession`                                                 | `external/detectPiBinary`, `external/setRpcEnabled`, `external/setEphemeral`                                                                 | Host config + runtime discovery                                                           | `agent/settingsSnapshot` or `chat/error`                                          |
| Diagnostics        | `openOutputLogs`, recovery buttons                                                                       | `chat/showLogs`, recovery callbacks                                                                                                          | VS Code AgenticFlowX Output channel and runtime recovery actions                          | Output panel, runtime status events                                               |
| Telemetry          | `setTelemetryEnabled`                                                                                    | `telemetry/setEnabled`                                                                                                                       | Host persists analytics preference                                                        | `agent/settingsSnapshot` or `chat/error`                                          |
| Custom Models      | `addCustomProvider`, `editCustomProvider`, `removeCustomProvider`, `addCustomModel`, `removeCustomModel` | `customModels/upsertProvider`, `customModels/removeProvider`, `customModels/upsertModel`, `customModels/removeModel`, `customModels/refresh` | `custom-providers-service` SecretStorage CRUD; FileSystemWatcher re-read for Pi RPC track | `agent/settingsSnapshot` (with `customModels` field) or `customModels/result` ack |

---

## [DES-SETTINGS-ONBOARDING] Connect A Model

Settings starts with a compact connection panel. If no runtime is usable it reads as first-run onboarding; otherwise it reads as a connected summary with the same actions.

- Hosted key opens Models → Built-in, filters to providers that need a key, expands one provider card, and focuses the masked API key input.
- Custom endpoint opens Models → Custom Models → Pi SDK and seeds the blank custom-provider form.
- Pi local runtime opens Runtimes so the user can enable Pi RPC or use recovery controls.
- These actions only change webview navigation state. They must not send `provider/setApiKey`, `customModels/upsertProvider`, or runtime mutations.
- Existing SecretStorage keys and custom provider records remain the source of truth and continue to hydrate their current cards.
- Support keeps Diagnostics, Privacy, and About visible. Skills & commands are default-collapsed.

```text
+----------------------------------------------------------------+
| Welcome to AFX                                                  |
| Choose how AFX should run. You can change this later.           |
|                                                                |
| [ Hosted API key ]  [ Custom endpoint ]  [ Pi local runtime ]  |
|   Anthropic/OpenAI     Ollama/OpenRouter     Local Pi CLI       |
|                                                                |
| Hosted keys: 0   Custom: 0   Pi RPC: off                       |
| Start with one: [Anthropic] [OpenAI] [Gemini] [DeepSeek]       |
+----------------------------------------------------------------+

Hosted key:
  Models / Built-in / Needs key
  > Anthropic
    API key [ focused masked input ] [ Save key ]

Custom endpoint:
  Models / Custom Models / Pi SDK
  Endpoint → Credential → Models → Advanced
```

---

## [DES-SETTINGS-CUSTOM-MODELS] Custom Models Sub-Tab

Custom Models sub-tab inside the Models tab carries a `Track: [Pi SDK] [Pi RPC]` selector. The two tracks have **different sources of truth** — not different views of the same data — and never alias.

### Pi SDK track — full CRUD over SecretStorage

- **Source of truth:** VSCode SecretStorage records keyed `afx.customProvider.${id}` (full `CustomProviderRecord` JSON, including apiKey value). Index entry `afx.customProviders.index` enumerates ids.
- **Reads `~/.pi/agent/models.json`?** Never.
- **Writes `~/.pi/agent/models.json`?** Never.
- **Runtime delivery:** at Pi SDK spawn, the host calls `customProvidersService.buildEnvForPiSdkSpawn()` which reads SecretStorage and uses the active `HarnessAdapter` (Pi SDK adapter) to produce a JSON envelope plus an env map. The envelope is shipped as `AFX_CUSTOM_PROVIDERS_JSON` and the env map carries `AFX_<PROVIDER>_KEY=<value>` entries. The Pi SDK bootstrap reads these, builds an empty `ModelRegistry`, calls `registerProvider(...)` per record, and hands the registry to `createAgentSessionRuntime({ modelRegistry })` followed by `runRpcMode(runtime)`. See `[351-agent-pi DES-PI-CUSTOM-PROVIDERS]`.
- **UI:** Add/Edit/Delete cards (`apps/chat/src/components/custom-model-card.tsx` mode `editable`) backed by `customModels/upsertProvider` / `customModels/removeProvider` bridge messages. Preset picker for new providers, structured form for edit, model sub-form for add-model. All using `@afx/ui/components/*` and Lucide React icons.

### Pi RPC track — read-only display of `~/.pi/agent/models.json`

- **Source of truth:** the user's hand-edited file at `~/.pi/agent/models.json` (or `${PI_CODING_AGENT_DIR}/models.json` if set).
- **Reads:** yes, via `vscode.workspace.createFileSystemWatcher` in the host service, parsed by the active adapter's `parseHandEdited(text)`.
- **Writes:** never. AFX has zero write paths into this file.
- **UI:** Read-only cards (mode `readonly`) listing each entry's id / baseUrl / api kind / model count, with an "Open in editor" button per row that re-uses the existing `chat/openModelsJson` handler. A top-of-track button opens the whole file. A parse-error banner with file path + error message and the same CTA appears when the file is malformed.
- **Provided as user awareness:** Pi RPC reads this file directly at runtime regardless of AFX. The track is informational so users see what Pi RPC will load.

### Snapshot shape (from `[100-package-shared]`)

```ts
SettingsSnapshot.customModels?: {
  activeHarness: 'pi-sdk' | 'oh-my-pi' | 'opencode';
  piSdk: { providers: CustomProviderSummary[] };          // from SecretStorage
  piRpc?: {
    path: string;
    status: 'ready' | 'parse-error' | 'missing';
    error?: string;
    providers: CustomProviderSummary[];                   // from ~/.pi/agent/models.json
  };
}
```

`CustomProviderSummary` is the **only** shape the webview ever sees: `{ id, displayName?, baseUrl, api, modelCount, models[], apiKeySource, apiKeyLabel?, hasApiKey, authHeader?, compatFlags?, origin, hasLiteralApiKeyOnDisk? }`. The redacted `models[]` carries non-secret structural fields per entry (`id, name, api?, contextWindow?, maxTokens?, capabilities?`); `compatFlags` carries booleans only for keys listed in `COMPAT_FLAGS_BY_API[provider.api]`. The apiKey value, full opaque `compat`, headers, and per-model cost never cross the bridge. Verified by `assertNoSecretLeak` runtime guard in tests + `~/.pi/agent/models.json` mtime check in e2e.

### Refresh contract

| Trigger                                                                | Host action                                                    | Pi SDK restart?                                 |
| ---------------------------------------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------- |
| SecretStorage CRUD on `afx.customProvider.*` (UI mutation OR external) | Recompute Pi SDK summaries; broadcast `agent/settingsSnapshot` | Yes (debounced — `scheduleAgentRuntimeRebuild`) |
| `~/.pi/agent/models.json` watcher fires                                | Recompute Pi RPC summaries; broadcast `agent/settingsSnapshot` | No                                              |
| UI mutation that doesn't alter apiKey or schema (display name only)    | Update record; broadcast                                       | No                                              |

Hot-reload during an active Pi SDK turn is out of scope — restart deferred until idle.

---

## [DES-UI] User Interface & UX

Settings copy must be concrete about readiness, missing credentials, active provider/model, and recovery actions. Theme preview may demonstrate app appearance, but shared tokens remain owned by the design-system spec.

## [DES-SETTINGS-MOCKUPS] ASCII UI Mockups

### [DES-SETTINGS-MOCKUP-HEADER] Sticky Header Strip + Tabs

```text
+----------------------------------------------------------------+
|  Settings                                                      |
|  Configure AFX in this workspace                               |
|  ---------------------------------------------------------     |
|  ● API SDK · ● Pi RPC          [↻ Active]   [⚙ File ctx ✓]    |
|  Active: Pi RPC · claude-opus-4-5                              |
|  ---------------------------------------------------------     |
|  [Workspace] [Runtimes] [Models] [Look]          [Support]     |
+----------------------------------------------------------------+
```

### [DES-SETTINGS-MOCKUP-WORKSPACE] Workspace Group

```text
+----------------------------------------------------------------+
| Workspace                                                      |
| How AFX behaves in this workspace, across all runtimes         |
+----------------------------------------------------------------+
| Mode                                                           |
| Permission gate applied before tool calls reach any runtime.   |
|                                                                |
| (●) Code     [?]                                               |
|     Full access. Runtimes can read, write, run shells, edit.   |
|                                                                |
| ( ) Explore  [?]                                               |
|     Read-only. Can inspect files/folders/source/web pages;     |
|     writes and mutating shell commands are blocked.            |
|                                                                |
| ( ) Spec     [?]                                               |
|     Planning-only. Docs/specs guardrails are injected.         |
+----------------------------------------------------------------+
| Composer Intent                                                |
|                                                                |
| (●) Default  ( ) Ask  ( ) Architect  ( ) Code/PRD              |
| [ ] Minimize Intent strip                                      |
| Scope: (●) Global default  ( ) This workspace                  |
+----------------------------------------------------------------+
| Default context                                                |
|                                                                |
| Active-file context                          ( ●———)   [?]     |
| Include the file you're editing in the prompt context.        |
| Default: on. Mirrored in the chat composer toolbar.            |
+----------------------------------------------------------------+
```

### [DES-SETTINGS-MOCKUP-RUNTIMES] Runtimes Group (Per-instance cards + Behaviour)

```text
+----------------------------------------------------------------+
| Runtimes                                                       |
| Coding-agent instances available in this workspace.            |
+----------------------------------------------------------------+
|                                                                |
| ┌── API Providers (bundled SDK) ─────────── ●Active ───────┐  |
| │ In-process. Calls cloud APIs using your saved keys.       │  |
| │                                                           │  |
| │ Status: 2 keys configured · 4 models available            │  |
| │ Active model: claude-opus-4-5  [change in composer →]     │  |
| │                                                           │  |
| │ [↻ Restart] [?]                                           │  |
| │ [Troubleshoot ▾]                                          │  |
| │   [Reconnect] [↻ Restart] [Reload]                        │  |
| └───────────────────────────────────────────────────────────┘  |
|                                                                |
| ┌── Pi RPC (subprocess) ──────────────── ○Off ──────────────┐  |
| │ Enable Pi RPC                              ( ○———) [?]    │  |
| │ Default: off. Turn on to add Pi RPC alongside the SDK.    │  |
| └───────────────────────────────────────────────────────────┘  |
|                                                                |
+----------------------------------------------------------------+
| Behaviour                                                      |
| How the agent reasons, queues, and recovers.                   |
|                                                                |
| ⓘ Active: ● Pi RPC · claude-opus-4-5                          |
|   These settings apply to the runtime that owns your model.    |
|                                                                |
| Thinking level                            (also in composer)   |
| [ off                                                  ▾ ]    |
|                                                                |
| Steering mode                              (settings only)     |
| [ one-at-a-time                                        ▾ ]    |
|                                                                |
| Follow-up mode                             (settings only)     |
| [ one-at-a-time                                        ▾ ]    |
|                                                                |
| Auto-compaction                ( ●———)     (settings only)     |
| Auto-retry                     ( ●———)     (settings only)     |
+----------------------------------------------------------------+
```

### [DES-SETTINGS-MOCKUP-MODELS] Models Group (Built-in + Custom Models two-track)

```text
+----------------------------------------------------------------+
| Models                                                         |
| API providers and credentials. Used by the API SDK runtime.    |
+----------------------------------------------------------------+
| [ Built-in ]  [ Custom Models · — ]                            |
+----------------------------------------------------------------+
| Providers 7 · Ready 2 · Models 14                              |
| [ 🔍 Find provider or model…                              ]    |
| [All 7] [Ready 2] [Needs key 5]                                |
|                                                                |
| +---------------------------+ +---------------------------+   |
| | ● Anthropic       Active  | | ● OpenAI          Ready   |   |
| | claude-opus-4-5           | | 3 models                ▸ |   |
| | 4 models                ▸ | +---------------------------+   |
| +---------------------------+                                   |
+----------------------------------------------------------------+

Custom Models sub-tab — Pi SDK track active:
+----------------------------------------------------------------+
| Custom Models                                                  |
| Track:  ( ● Pi SDK )    ( ○ Pi RPC )                           |
+----------------------------------------------------------------+
| AFX-managed custom providers for the Pi SDK runtime.           |
| Stored in VSCode SecretStorage. Injected into the runtime      |
| in-process — your ~/.pi/agent/models.json is not touched.      |
|                                                                |
|                                       [ + Add Provider ]      |
| +-------------------------------------------------------------+|
| | ⊕ ollama                  AFX-MANAGED          ✎    ✕      ||
| |   http://localhost:11434/v1               2 models          ||
| |   🔓 No key needed                                          ||
| +-------------------------------------------------------------+|
| +-------------------------------------------------------------+|
| | ⊕ openrouter              AFX-MANAGED          ✎    ✕      ||
| |   https://openrouter.ai/api/v1            5 models          ||
| |   🔐 VSCode Secret · AFX_OPENROUTER_KEY                     ||
| +-------------------------------------------------------------+|
+----------------------------------------------------------------+

Custom Models sub-tab — Pi RPC track active (read-only):
+----------------------------------------------------------------+
| Track:  ( ○ Pi SDK )    ( ● Pi RPC )                           |
+----------------------------------------------------------------+
| Custom providers in ~/.pi/agent/models.json (read-only).       |
| Pi RPC reads this file directly at runtime. Edit in editor —   |
| AFX never modifies this file.                                  |
|                                                                |
|                       [ Open models.json ]    [ ⟳ Refresh ]   |
| +-------------------------------------------------------------+|
| | ⊕ moonshot-open           READ-ONLY        ↗ Open in editor||
| |   https://api.moonshot.ai/v1              2 models          ||
| |   ⚠️  Literal API key on disk                                ||
| +-------------------------------------------------------------+|
+----------------------------------------------------------------+
```

### [DES-SETTINGS-MOCKUP-CUSTOM-PRESET] Add Provider preset picker (Pi SDK track)

```text
+----------------------------------------------------------------+
| Add Provider · Pi SDK Track                                    |
| Choose a preset to start with:                                 |
+----------------------------------------------------------------+
| [   Ollama   ]  [ LM Studio ]  [    vLLM    ]                  |
| no key needed   no key needed   no key needed                  |
|                                                                |
| [ OpenRouter ]  [Vercel Gw.  ]  [  Moonshot  ]                 |
|                                                                |
| [  Anthropic  ]  [  Google   ]  [   Custom   ]                 |
| proxy            AI Studio       blank                         |
|                                                                |
| Each preset fills baseUrl, api type, sensible compat defaults. |
| You provide URL, key, and at least one model.                  |
|                                                                |
|                            [ Cancel ]   [ Continue ]           |
+----------------------------------------------------------------+
```

### [DES-SETTINGS-MOCKUP-CUSTOM-PROVIDER-FORM] Edit custom provider (Pi SDK track)

```text
+----------------------------------------------------------------+
| Edit · ⊕ openrouter (Pi SDK)                                   |
+----------------------------------------------------------------+
| Provider id     [ openrouter                              ]    |
| Display name    [ OpenRouter                              ]    |
| Base URL        [ https://openrouter.ai/api/v1            ]    |
| API type        ( ● openai-completions  )                      |
|                 ( ○ openai-responses    )                      |
|                 ( ○ anthropic-messages  )                      |
|                 ( ○ google-generative-ai)                      |
|                                                                |
| API key                                                        |
| Source          [ VSCode Secret ▾ ]                            |
|                                                                |
|                 [ ●●●●●●●●●●●●●●●●●●●●●●● ]   👁                |
|                 Stored in OS keychain · injected as            |
|                 AFX_OPENROUTER_KEY at runtime                  |
|                                                                |
| Models                                       [ + Add Model ]   |
| +------------------------------------------------------------+ |
| | anthropic/claude-sonnet-4   200k ctx       ✎    ✕         | |
| | anthropic/claude-opus-4-5   200k ctx       ✎    ✕         | |
| +------------------------------------------------------------+ |
|                                                                |
| ▸ Custom headers      ▸ Advanced compat                        |
|                                                                |
|                            [ Cancel ]   [ Save ]               |
+----------------------------------------------------------------+
```

### [DES-SETTINGS-MOCKUP-CUSTOM-MODEL-FORM] Add / Edit custom model

```text
+----------------------------------------------------------------+
| Add Model · openrouter                                         |
+----------------------------------------------------------------+
| Model id *      [ anthropic/claude-sonnet-4               ]    |
| Display name    [ Claude Sonnet 4                         ]    |
|                                                                |
| API             ( ● Use provider · openai-completions )        |
|                 ( ○ Override for this model           )        |
|                     [ openai-completions ▾ ]                   |
|                                                                |
| Capabilities    [✓] reasoning   [✓] image input                |
| Context window  [ 200,000 ] tokens                             |
| Max output      [  16,000 ] tokens                             |
| Cost per 1M     in [ 3.00  ]   out [ 15.00 ]                   |
|                 cR [ 0.30  ]   cW [ 3.75  ]                    |
|                                                                |
| ▸ Compat overrides                                             |
|                                                                |
|                            [ Cancel ]   [ Add ]                |
+----------------------------------------------------------------+
```

### [DES-SETTINGS-MOCKUP-LOOK] Look Group

```text
+----------------------------------------------------------------+
| Look                                                           |
| Theme and visual treatment for the chat webview                |
+----------------------------------------------------------------+
| Theme                                                [?]       |
| Color palette for chat surfaces.                               |
| Meridian  (only theme available)                               |
|                                                                |
| Style                                                [?]       |
| Visual treatment: density, corners, shadows.                   |
| Lyra  (only style available)                                   |
+----------------------------------------------------------------+
```

### [DES-SETTINGS-MOCKUP-SUPPORT] Support Group

```text
+----------------------------------------------------------------+
| Support                                                        |
| Skills, diagnostics, privacy, version                          |
+----------------------------------------------------------------+
| Skills & commands                                              |
| AFX skills (12)               [Show ▾]               [?]       |
| Pi skills (5)                 [Show ▾]               [?]       |
| Extension commands (5)        [Show ▾]               [?]       |
+----------------------------------------------------------------+
| Diagnostics                                                    |
| Log level: info                            [open setting]      |
| [ Open AgenticFlowX output ]                         [?]       |
+----------------------------------------------------------------+
| Privacy                                                        |
| Anonymous UI analytics                      ( ●———)  [?]       |
| On by default. Helps improve AFX with anonymous UI events.     |
| Analytics status: enabled                                      |
+----------------------------------------------------------------+
| About                                                          |
| AFX VSCode extension v2.x                                      |
| Bundled Pi npm v1.x                                            |
| Report an issue → github.com/anthropics/afx-vscode/issues      |
+----------------------------------------------------------------+
```

## [DES-SETTINGS-SURFACE-MAP] Settings Surface Map

```text
[ChatSettings.Root]
+----------------------------------------------------------------+
| [ChatSettings.Header] sticky title + per-instance status pills  |
|                       + Active line + Restart-active + File-ctx |
+----------------------------------------------------------------+
| [ChatSettings.Nav] [Workspace][Runtimes][Models][Look][Support] |
+----------------------------------------------------------------+
| [ChatSettings.Readiness] setup/recovery cards when unavailable  |
+----------------------------------------------------------------+
| [ChatSettings.Workspace]                                        |
|   Mode (Code/Explore/Spec) + Composer Intent scope              |
|   + Active-file context default                                 |
+----------------------------------------------------------------+
| [ChatSettings.Runtimes]                                         |
|   [ChatSettings.Runtimes.Sdk]   API Providers (SDK) instance    |
|   [ChatSettings.Runtimes.Rpc]   Pi RPC instance (toggle + body) |
|   [ChatSettings.Runtimes.Behaviour] Thinking/Steering/etc.      |
|     scoped to active instance per                               |
|     350-agent-manager [DES-AGENT-BEHAVIOUR-ROUTING]             |
+----------------------------------------------------------------+
| [ChatSettings.Models]                                           |
|   [ChatSettings.Models.Builtin]  API providers tile grid        |
|   [ChatSettings.Models.Custom]   sub-tabbed:                    |
|     Track [Pi SDK] (v1 placeholder)                             |
|     Track [Pi RPC] (Open models.json deep-link)                 |
+----------------------------------------------------------------+
| [ChatSettings.Look]   Theme + Style                             |
+----------------------------------------------------------------+
| [ChatSettings.Support]                                          |
|   Skills/commands + Diagnostics + Privacy + About               |
+----------------------------------------------------------------+
```

### [DES-SETTINGS-SURFACE-NAV] Sticky Navigation

| Code anchor         | UI/functionality                                                                                     |
| ------------------- | ---------------------------------------------------------------------------------------------------- |
| `SETTINGS_SECTIONS` | Defines workspace, runtimes, models, look, support section ids/labels (5 groups)                     |
| Sticky header JSX   | Keeps the settings title, per-instance pills, active line, restart-active, and file-ctx chip visible |
| `jumpToSection`     | Updates active nav state and scrolls to `settings-<id>` cards                                        |

### [DES-SETTINGS-SURFACE-MODE] Workspace Posture

| Code anchor                     | UI/functionality                                                                                |
| ------------------------------- | ----------------------------------------------------------------------------------------------- |
| `SettingsCard`                  | Mode card chrome with icon, title, description, and compact radio-group layout                  |
| `RadioGroup` / `RadioGroupItem` | Code/Explore/Spec selection rows with custom click targets and checked state                    |
| `applyMode`                     | Sends `chat/setMode`, updates local optimistic state, and reuses the shared host command        |
| `pendingModeMutations`          | RequestId-to-toast-label map for mode success/error feedback                                    |
| `agent/settingsSnapshot`        | Rehydrates `mode.active` so the settings card stays in sync after the effective setting changes |

### [DES-SETTINGS-SURFACE-INTENT] Composer Intent Defaults

| Code anchor                     | UI/functionality                                                                                         |
| ------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `SettingsCard`                  | Composer Intent block inside the Workspace group                                                         |
| `RadioGroup` / `RadioGroupItem` | Four slot choices plus the global-default vs workspace-override scope choice                             |
| `applyIntentSlot`               | Sends `chat/setIntentSlot` and optimistically updates the effective/global-or-workspace slot             |
| `applyIntentMinimized`          | Sends `chat/setIntentMinimized` and optimistically updates the effective/global-or-workspace strip state |
| `applyIntentScope`              | Sends `chat/setIntentScope`; `global` writes global defaults and clears workspace overrides              |
| `agent/settingsSnapshot.intent` | Rehydrates effective/global/workspace Intent state and the `hasWorkspaceOverride` flag after host writes |

#### Cross-mode doc-actions strip behavior

The `mode.active` value also drives the composer doc-actions strip variants
(`211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-STRIP]`):

- **Spec mode** — full strip with the per-docKind 3–4 primary actions, the
  three-pill spec stepper inside the strip body
  (`[1 Spec ✓] [2 Design …] [3 Tasks 3/8]`) plus its `Related · Journal · Work
Sessions n/m` tier-2 row, and the strip-header Memory ▾ anchor next to the
  dismiss control. The stepper itself is no longer mode-gated — it renders in
  every workspace mode so the SDD pivot affordance survives mode switches.
- **Code / Explore** — compact strip with the per-docKind 2-button primary set
  documented by the fleeting sprint `[DES-MODES]` table (e.g. tasks compact =
  `[Code|▾] [Review|▾] | [Verify] [Pick|▾]`). The stepper still renders above
  these compact actions; Memory ▾ tucks under `···` More so the workspace-level
  Memory anchors remain reachable through the top-right and composer-toolbar
  triggers.

The doc-actions strip now owns the non-Spec `Switch to Spec` affordance inline
when the active editor is an AFX doc, so the composer does not stack a second
detector panel above the stepper.

### [DES-SETTINGS-SURFACE-RUNTIME] Runtime Setup And Runtime Controls

| Code anchor                  | UI/functionality                                                                  |
| ---------------------------- | --------------------------------------------------------------------------------- |
| `SettingsSetupCard`          | Loading state while agent/runtime metadata is being checked                       |
| `RuntimeConfigurationNotice` | No-runtime setup copy plus provider/Pi recovery actions                           |
| `RuntimeChoiceBlock`         | First-run API Provider SDK vs opt-in Pi RPC choice cards                          |
| `RuntimePathBlock`           | Advanced SDK/RPC/session/bundled skills configuration detail                      |
| `SelectRow` / `SwitchRow`    | Narrow-safe runtime control rows for thinking, queue modes, compaction, and retry |

### [DES-SETTINGS-SURFACE-CONTEXT] Active File Context Preference

| Code anchor                          | UI/functionality                                                                          |
| ------------------------------------ | ----------------------------------------------------------------------------------------- |
| `applyIncludeActiveFileContext`      | Mirrors the durable active-file context preference to the host and optimistic local state |
| Context `SettingsCard`               | SwitchRow-based card for the default-on active-file context preference                    |
| `bridgeOn("agent/settingsSnapshot")` | Hydrates and keeps the Settings switch aligned with the host snapshot                     |
| `chat/setIncludeActiveFileContext`   | Bridge message shared with the composer quick toggle and host persistence path            |

### [DES-SETTINGS-SURFACE-PROVIDERS] Provider Management

| Code anchor                        | UI/functionality                                                                  |
| ---------------------------------- | --------------------------------------------------------------------------------- |
| Provider stats/search/filter block | Counts providers/models, filters ready vs needs-key, searches provider/model text |
| `ProviderCard`                     | API key form, masked saved-key state, clear/update key, default model, help link  |
| `ExternalAgentCard`                | Pi RPC status, enable toggle, binary path detection/settings, ephemeral toggle    |
| `composeSettingsSnapshot`          | Normalizes available models into provider and external-agent entries              |

### [DES-SETTINGS-COMPONENT-PROVIDER-CARD] ProviderCard

| Code anchor              | Component contract                                                                                              |
| ------------------------ | --------------------------------------------------------------------------------------------------------------- |
| `ProviderCard`           | Owns one API provider card, expandable details, key form, saved-key mask, default model selector, and help link |
| `saveKey`                | Trims empty key input, sets local pending state, calls `onSaveKey`, and clears local input afterward            |
| `clearKey`               | Sets pending state, calls `onClearKey`, and clears local input afterward                                        |
| `ProviderBadge`          | Maps provider connection state to compact badge copy/tone: models, invalid, local, needs key                    |
| `data-clarity-mask` rows | Ensures sensitive key fields/saved-key display are masked for analytics                                         |

### [DES-SETTINGS-COMPONENT-EXTERNAL-AGENT-CARD] ExternalAgentCard

| Code anchor                              | Component contract                                                                                         |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `ExternalAgentCard`                      | Owns one local-agent card, Pi RPC enablement, binary status/path controls, ephemeral toggle, and docs link |
| `status` branch                          | Renders connected, disabled, unavailable, and coming-soon states without needing provider card logic       |
| `onDetectBinary` / `onOpenBinarySetting` | Bridges discovery and setting-opening actions to the host                                                  |
| `onToggleEnabled` / `onToggleEphemeral`  | Bridges Pi RPC and session-mode settings to the host                                                       |

### [DES-SETTINGS-COMPONENT-RECOVERY-CARD] AgentRecoveryCard

| Code anchor                 | Component contract                                                                     |
| --------------------------- | -------------------------------------------------------------------------------------- |
| `AgentRecoveryActions`      | Shared action contract for retry, restart, settings, and reload                        |
| `AgentRecoveryCard`         | Renders confirmed long-disconnect/error state and gates retry when restart is required |
| `RuntimeRecoveryButtonGrid` | Settings-local compact recovery grid for diagnostics and setup cards                   |

### [DES-SETTINGS-INSTANCE-CARDS] Per-Instance Runtime Cards

The Runtimes group renders one card per registered `AgentInstance` from `MultiplexedAgentManager.instances` ([apps/vscode/src/multiplex-agent-manager.ts](apps/vscode/src/multiplex-agent-manager.ts)). v1 has up to two:

| Card                | Renders when                                                                         | Body                                                                                                       |
| ------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| API Providers (SDK) | Always rendered. Status flips between `Ready` (key configured) and `No keys` (none). | Active model line, Restart, link to Models tab for credentials, Troubleshoot disclosure.                   |
| Pi RPC              | Always rendered (toggle is discoverable). Body collapses when toggle is off.         | Enable toggle, status pill, Restart, Reconnect, Session controls, Advanced paths, Troubleshoot disclosure. |

Below the cards, a single **Behaviour** card hosts the five Pi knobs (Thinking, Steering, Follow-up, Auto-compaction, Auto-retry). It carries a scope label `Active: ● <instance> · model <id>` that updates live when the user switches model in the composer. The label exists because behaviour mutations route to `requireActive()` only — see `350-agent-manager [DES-AGENT-BEHAVIOUR-ROUTING]`.

**Plural-readiness:** the card list iterates `instances[]`. A future third instance simply registers and gets a third card.

@see `apps/vscode/src/multiplex-agent-manager.ts`
@see `apps/vscode/src/agent-factory.ts` `createConfiguredAgentInstances`

### [DES-SETTINGS-COPY] Copy Source-of-Truth

All visible labels, descriptions, dropdown sub-labels, and tooltips live in `apps/chat/src/lib/settings-copy.ts` as named exports keyed by surface ID. The Settings view imports these and renders them without inlining strings.

This satisfies NFR-3 (self-documentation) and gives copy editors a single file to change without diffing JSX. Verified Pi-runtime values (Thinking enum, default reserveTokens, retry-backoff numbers) are captured here with source citations to `pi-mono/packages/coding-agent/src/`.

@see `apps/chat/src/lib/settings-copy.ts`

### [DES-SETTINGS-CUSTOM-MODELS] Custom Models Sub-Tab (Two Tracks)

Custom providers are runtime-specific: Pi RPC reads its own `models.json`; Pi SDK uses AFX-managed env-var injection. The sub-tab carries a `Track: [ Pi SDK ] [ Pi RPC ]` selector accordingly. See `351-agent-pi [DES-PI-CUSTOM-PROVIDERS]` for the full architecture rationale.

| Track      | v1 (this PR)                                                                                                            | Phase-1 (follow-up PR)                                                                                                  |
| ---------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Pi SDK** | Read-only placeholder explaining the upcoming AFX-managed config. Default selected.                                     | Full editor: preset picker, structured forms, raw JSON editor. Secrets in VSCode SecretStorage via env-var indirection. |
| **Pi RPC** | Working `[ Open models.json ]` deep-link. Create-if-missing seeds canonical empty shape. Honours `PI_CODING_AGENT_DIR`. | Optional parsed read-only view; AFX still doesn't write Pi's file.                                                      |

Track selection persists per webview via localStorage.

@see `docs/research/pi/res-pi-models-json-settings-ui.md`
@see `351-agent-pi/design.md [DES-PI-CUSTOM-PROVIDERS]`

### [DES-SETTINGS-COMPONENT-FORM-ROWS] Narrow Form Rows

| Code anchor    | Component contract                                                                             |
| -------------- | ---------------------------------------------------------------------------------------------- |
| `SettingsCard` | Shared section card chrome with icon, title, description, optional badge, and scroll target id |
| `ConfigField`  | Read-only key/value row with optional VS Code setting open button                              |
| `SwitchRow`    | Narrow-safe label/description plus right-aligned switch                                        |
| `SelectRow`    | Narrow-safe label/description plus full-width native select                                    |

### [DES-SETTINGS-SURFACE-APPEARANCE] Appearance Preview

| Code anchor              | UI/functionality                                               |
| ------------------------ | -------------------------------------------------------------- |
| Identity card            | Theme identity dropdown backed by `snapshot.appearance.themes` |
| Style card               | Runtime style dropdown backed by `snapshot.appearance.styles`  |
| `applyRuntimeAppearance` | Applies body theme/style classes for immediate preview         |
| `ConfigField`            | Opens relevant VS Code setting keys                            |

### [DES-SETTINGS-SURFACE-SKILLS] Chat Skills And Commands

| Code anchor       | UI/functionality                                                                        |
| ----------------- | --------------------------------------------------------------------------------------- |
| `groupCommands`   | Splits commands into AFX skills, other skills, extension commands, and prompt templates |
| Skills disclosure | Collapsed by default so first-run Settings focuses on connection and diagnostics        |
| `CommandGroup`    | Inserts slash command text into composer via `onInsertCommand` after disclosure opens   |
| `ACTIONS`         | Direct `/new` and `/abort` extension actions                                            |

`SidebarPanel.handleGetCommands` merges runtime commands with the bundled skill folders under
`resources/skills/agenticflowx`. Runtime metadata wins for duplicate names, but missing bundled
`afx-*` skills are still shown so Support does not look empty when a runtime reports a small set.

### [DES-SETTINGS-SURFACE-DIAGNOSTICS] Diagnostics, Recovery, And Telemetry

| Code anchor                 | UI/functionality                                                                    |
| --------------------------- | ----------------------------------------------------------------------------------- |
| `RuntimeRecoveryButtonGrid` | Shared reconnect/restart/reload action grid                                         |
| Diagnostics card            | Open AgenticFlowX Output, log setting, new session action                           |
| About card                  | Telemetry toggle, effective telemetry status, version and bundled Pi npm info       |
| `toast` pending maps        | Success/failure feedback for runtime, provider, appearance, and telemetry mutations |

---

## [DES-SETTINGS-MUTATION-MACHINE] Settings Mutation Lifecycle

Every Settings mutation (`provider/setApiKey`, `appearance/update`, `chat/setSteeringMode`, etc.)
travels through the same five-state lifecycle. The `requestId` carried in the outbound message is
the correlation token used by `useMemo` in `settings.tsx` to map host responses back to the row
that initiated them.

```text
   +-------+ user edits +----------+ requestId out +----------+ ack +----------+
   | clean +----------->| dirty    +-------------->| pending  +---->| success  |
   +-------+            +----------+               +----+-----+     +----------+
                                                        |
                                                        | error
                                                        v
                                                   +----------+
                                                   |  error   |---retry---+
                                                   +----------+           |
                                                                          v
                                                                     (back to pending)
```

| State     | UI cue                                        | Driven by                                           |
| --------- | --------------------------------------------- | --------------------------------------------------- |
| `clean`   | Form values match snapshot; controls enabled  | Snapshot received from host                         |
| `dirty`   | User edited a field; "Save" enabled           | Local input change                                  |
| `pending` | Spinner/disabled control; row marked "saving" | Outbound message dispatched with `requestId`        |
| `success` | Toast "Saved" + reset to `clean`              | Inbound ack matching `requestId` (snapshot or echo) |
| `error`   | Inline error + Retry; preserves user input    | `chat/error` matching `requestId`                   |

Mutation -> ack mapping for the most common flows:

| Mutation                    | Ack message                                       |
| --------------------------- | ------------------------------------------------- |
| `provider/setApiKey`        | `agent/settingsSnapshot` (snapshot refresh)       |
| `provider/clearApiKey`      | `agent/settingsSnapshot`                          |
| `provider/setDefaultModel`  | `agent/settingsSnapshot`                          |
| `appearance/update`         | `agent/appearanceUpdated`                         |
| `chat/setThinkingLevel`     | `agent/runtimeSettings`                           |
| `chat/setSteeringMode` etc. | `agent/runtimeSettings`                           |
| `chat/setMode`              | `agent/settingsSnapshot`                          |
| `telemetry/setEnabled`      | `agent/settingsSnapshot` + `agent/telemetryState` |

---

## [DES-DEC] Key Decisions

| Decision                 | Options Considered                       | Choice         | Rationale                                                                       |
| ------------------------ | ---------------------------------------- | -------------- | ------------------------------------------------------------------------------- |
| Settings ownership       | Composer, parent chat, settings child    | Settings child | Provider/runtime UX is dense and separate from message composition              |
| Theme preview ownership  | Design-system only, settings only, split | Split          | Settings owns preview UX; design-system owns shared contract                    |
| Workspace mode ownership | Composer, parent chat, settings child    | Settings child | Code default and Explore read-only posture are host-owned and global by default |

---

## [DES-DATA] Data Model

Settings state includes provider catalog entries, active provider/model, runtime readiness, API key status, appearance selections, diagnostics, telemetry, and pending mutation request ids.

| Data shape                        | Owner                                    | Purpose                                                                                    |
| --------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------ |
| `SettingsSnapshot`                | `@afx/shared` and `settings-snapshot.ts` | Webview-ready host/settings/provider snapshot                                              |
| `ContextPreference`               | `settings.tsx`                           | Default-on active-file context toggle mirrored from host snapshot                          |
| `WorkspaceMode`                   | `settings.tsx`                           | Workspace posture state: Code default, Explore read-only, Spec planning-only               |
| `SettingsSnapshot.intent`         | `settings.tsx`                           | Composer Intent effective/global/workspace defaults plus `hasWorkspaceOverride` scope flag |
| `RuntimeSettings`                 | `settings.tsx`                           | Active runtime controls for thinking, queue modes, compaction, retry, and session metadata |
| `ProviderFilter`                  | `settings.tsx`                           | Local API provider filter state: all, ready, needs-key                                     |
| `pending*Mutations` maps          | `settings.tsx`                           | RequestId-to-toast-label maps for success/error feedback                                   |
| `pendingModeMutations`            | `settings.tsx`                           | RequestId-to-toast-label map for Code / Explore mutation feedback                          |
| `SettingsSnapshotInput`           | `settings-snapshot.ts`                   | Host-normalized inputs used to compose the snapshot                                        |
| `ProviderConnectionState`         | `@afx/shared` / `ProviderCard`           | API provider credential/model state                                                        |
| `ExternalAgentCardProps.status`   | `ExternalAgentCard`                      | Pi/local-agent state: connected, disabled, unavailable, coming-soon                        |
| `HostModeClass` / theme/style ids | `theme-preview.ts`                       | Browser-only preview classes for settings/debug surfaces                                   |

---

## [DES-API] API Contracts

Settings uses shared settings snapshot and provider update bridge messages. Secret persistence remains in the VSCode host.

| Direction       | Message/event                                                                                                          | Settings responsibility                                                                      |
| --------------- | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Webview to host | `chat/getSettingsSnapshot`                                                                                             | Request full settings snapshot                                                               |
| Webview to host | `chat/getCommands`                                                                                                     | Populate skills/commands list                                                                |
| Webview to host | `chat/getState`                                                                                                        | Re-broadcast runtime settings after tab switch                                               |
| Webview to host | `chat/setThinkingLevel`, `chat/setSteeringMode`, `chat/setFollowUpMode`, `chat/setAutoCompaction`, `chat/setAutoRetry` | Runtime control mutations                                                                    |
| Webview to host | `chat/setIncludeActiveFileContext`                                                                                     | Persist the active-file context default                                                      |
| Webview to host | `chat/setMode`                                                                                                         | Persist the posture default globally unless a workspace override exists                      |
| Webview to host | `chat/setIntentSlot`, `chat/setIntentMinimized`, `chat/setIntentScope`                                                 | Persist Composer Intent defaults and switch between global-default and workspace override    |
| Webview to host | `appearance/update`                                                                                                    | Persist theme/style choice                                                                   |
| Webview to host | `provider/setApiKey`, `provider/clearApiKey`, `provider/setDefaultModel`                                               | Provider credential/default model mutations                                                  |
| Webview to host | `external/detectPiBinary`, `external/setRpcEnabled`, `external/setEphemeral`                                           | Pi RPC local-agent mutations                                                                 |
| Webview to host | `chat/openSettings`                                                                                                    | Open specific VS Code setting key                                                            |
| Webview to host | `chat/showLogs`                                                                                                        | Open VS Code's Output panel with the AgenticFlowX channel selected                           |
| Webview to host | `telemetry/setEnabled`                                                                                                 | Persist analytics preference                                                                 |
| Host to webview | `agent/settingsSnapshot`                                                                                               | Replace snapshot, including `mode.active`, and resolve provider/telemetry/mode pending state |
| Host to webview | `agent/appearanceUpdated`                                                                                              | Replace appearance and resolve appearance pending state                                      |
| Host to webview | `agent/runtimeSettings`                                                                                                | Replace runtime controls and resolve runtime pending state                                   |
| Host to webview | `agent/commands`                                                                                                       | Populate skills list                                                                         |
| Host to webview | `chat/error`                                                                                                           | Resolve pending mutation failure with toast                                                  |

---

## [DES-FILES] File Structure

| File                                               | Purpose                      |
| -------------------------------------------------- | ---------------------------- |
| `apps/chat/src/views/settings.tsx`                 | Settings panel composition   |
| `apps/chat/src/components/provider-card.tsx`       | Provider option UI           |
| `apps/chat/src/components/external-agent-card.tsx` | External/runtime provider UI |
| `apps/chat/src/lib/settings-snapshot.ts`           | Snapshot normalization       |
| `apps/chat/src/lib/theme-preview.ts`               | Settings preview helpers     |

---

## [DES-DEPS] Dependencies

| Dependency                     | Purpose                                                          |
| ------------------------------ | ---------------------------------------------------------------- |
| `100-package-shared`           | Settings snapshot, provider, model, runtime, telemetry contracts |
| `110-package-transport`        | Host/webview bridge                                              |
| `131-package-ui-design-system` | Settings cards, form controls, tabs, badges, tokens              |
| `350-agent-manager`            | Runtime status/control contracts                                 |
| `351-agent-pi`                 | Pi RPC/local-agent status and settings meaning                   |

---

## [DES-SEC] Security Considerations

- Never log or render raw API key values.
- Secret storage and validation happen in the VSCode host, not the webview.

---

## [DES-ERR] Error Handling

| Scenario             | Handling                                          |
| -------------------- | ------------------------------------------------- |
| Snapshot unavailable | Render recoverable loading/error state            |
| Provider save fails  | Keep form editable and show actionable error copy |

---

## [DES-TEST] Testing Strategy

| Coverage target                               | Current/Future test anchor                    |
| --------------------------------------------- | --------------------------------------------- |
| Settings panel tab/root rendering             | `apps/chat/src/app.test.tsx`                  |
| Snapshot normalization                        | `apps/chat/src/lib/settings-snapshot.test.ts` |
| Provider card masked key/default model states | future `provider-card.test.tsx`               |
| External agent/Pi RPC states                  | future `external-agent-card.test.tsx`         |
| Runtime controls and pending toasts           | future settings view test                     |
| Theme/style preview class updates             | future `theme-preview.test.ts`                |

---

## [DES-ROLLOUT] Migration / Rollout Plan

Retarget settings source refs from retired chat docs, then update provider/runtime UX through this child spec.

### [DES-SETTINGS-ROLLOUT-ROLLBACK] Rollback Plan

Route files back to `210-app-chat` only if this child spec stops improving routing.

---

## [DES-SETTINGS-REFS] File Reference Map

| Task | File                                               | Required @see                                                                                                                                       |
| ---- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.x  | `apps/chat/src/views/settings.tsx`                 | `design.md [DES-SETTINGS-MOCKUP-MODE] [DES-SETTINGS-MOCKUP-RUNTIME] [DES-SETTINGS-SURFACE-MODE] [DES-SETTINGS-SURFACE-RUNTIME] [DES-SETTINGS-FLOW]` |
| 1.x  | `apps/chat/src/components/provider-card.tsx`       | `design.md [DES-SETTINGS-SURFACE-PROVIDERS]`                                                                                                        |
| 1.x  | `apps/chat/src/components/external-agent-card.tsx` | `design.md [DES-SETTINGS-SURFACE-PROVIDERS]`                                                                                                        |
| 1.x  | `apps/chat/src/components/agent-recovery-card.tsx` | `design.md [DES-SETTINGS-SURFACE-DIAGNOSTICS]`                                                                                                      |
| 1.x  | `apps/chat/src/components/debug-panel.tsx`         | `design.md [DES-SETTINGS-SURFACE-DIAGNOSTICS]`                                                                                                      |
| 1.x  | `apps/chat/src/components/toast.tsx`               | `design.md [DES-SETTINGS-FLOW]`                                                                                                                     |
| 1.x  | `apps/chat/src/lib/settings-snapshot.ts`           | `design.md [DES-DATA] [DES-SETTINGS-SURFACE-PROVIDERS]`                                                                                             |
| 1.x  | `apps/chat/src/lib/theme-preview.ts`               | `design.md [DES-SETTINGS-SURFACE-APPEARANCE]`                                                                                                       |

## [DES-SETTINGS-LOC] Code Locator Map

| Map ID                              | Code anchor                                                                | Messages/settings/commands                                                                                                 | Tests                                                 |
| ----------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `[ChatSettings.Header]`             | `apps/chat/src/views/settings.tsx` sticky header                           | `agent/settingsSnapshot`, `chat/setIncludeActiveFileContext`, `agent/restart`                                              | `apps/chat/src/app.test.tsx`                          |
| `[ChatSettings.Nav]`                | `SETTINGS_SECTIONS`, sticky tab row                                        | section ids: workspace, runtimes, models, look, support                                                                    | `apps/chat/src/app.test.tsx`                          |
| `[ChatSettings.Workspace]`          | `SettingsCard` (Mode + Composer Intent), `SwitchRow` (Active-file context) | `chat/setMode`, `chat/setIntentSlot`, `chat/setIntentMinimized`, `chat/setIntentScope`, `chat/setIncludeActiveFileContext` | `apps/chat/src/app.test.tsx`                          |
| `[ChatSettings.Readiness]`          | `SettingsSetupCard`, `RuntimeConfigurationNotice`, `AgentRecoveryCard`     | `agent/runtimeStatus`, `agent/restart`, `external/detectPiBinary`                                                          | `external-agent-card.test.tsx`                        |
| `[ChatSettings.Runtimes.Sdk]`       | SDK instance card                                                          | `chat/setModel`                                                                                                            | future SDK card test                                  |
| `[ChatSettings.Runtimes.Rpc]`       | `ExternalAgentCard`                                                        | `external/setRpcEnabled`, `external/detectPiBinary`, `external/setEphemeral`                                               | `external-agent-card.test.tsx`                        |
| `[ChatSettings.Runtimes.Behaviour]` | Behaviour card (`SelectRow`, `SwitchRow`)                                  | `chat/setThinkingLevel`, `chat/setSteeringMode`, `chat/setFollowUpMode`, `chat/setAutoCompaction`, `chat/setAutoRetry`     | `apps/chat/src/app.test.tsx`                          |
| `[ChatSettings.Models.Builtin]`     | `ProviderCard` tile grid                                                   | `provider/setApiKey`, `provider/clearApiKey`, `provider/setDefaultModel`                                                   | `provider-card.test.tsx`, `settings-snapshot.test.ts` |
| `[ChatSettings.Models.Custom]`      | Custom Models sub-tab + track selector                                     | (v1) `chat/openSettings` for `~/.pi/agent/models.json`                                                                     | future custom-models tests                            |
| `[ChatSettings.Look]`               | identity/style cards, `theme-preview.ts`                                   | `appearance/update`, `afx.theme`, `afx.style`                                                                              | `theme-preview.ts` helper tests                       |
| `[ChatSettings.Support]`            | skills card, diagnostics card, privacy card, about card                    | `chat/getCommands`, `chat/showLogs`, `telemetry/setEnabled`                                                                | `apps/chat/src/app.test.tsx`                          |

## [DES-SETTINGS-TRACE] Functional Trace Matrix

| Requirement | Design nodes                                                                                    | Code anchors                                                                                   | Verification                                        |
| ----------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| FR-1        | `DES-SETTINGS-MOCKUP-RUNTIME`, `DES-SETTINGS-SURFACE-RUNTIME`, `DES-SETTINGS-SURFACE-PROVIDERS` | `Settings`, `SettingsCard`, `ProviderCard`, `RuntimeConfigurationNotice`, `AgentRecoveryCard`  | `apps/chat/src/app.test.tsx`; future provider tests |
| FR-2        | `DES-DATA`, `DES-SETTINGS-FLOW`                                                                 | `composeSettingsSnapshot`, `bridgeOn("agent/settingsSnapshot")`, snapshot-derived memos        | `settings-snapshot.test.ts`                         |
| FR-3        | `DES-SETTINGS-SURFACE-APPEARANCE`                                                               | `applyTheme`, `applyStyle`, `applyRuntimeAppearance`                                           | future theme-preview tests                          |
| FR-4        | `DES-SETTINGS-SURFACE-RUNTIME`, `DES-SETTINGS-SURFACE-PROVIDERS`                                | runtime mutation handlers, `ExternalAgentCard`, recovery actions                               | future runtime settings tests                       |
| FR-5        | `DES-SETTINGS-MOCKUP-MODE`, `DES-SETTINGS-SURFACE-MODE`, `DES-DATA`, `DES-SETTINGS-FLOW`        | `SettingsCard`, `RadioGroup`, `applyMode`, `pendingModeMutations`                              | `apps/chat/src/app.test.tsx`; mode snapshot tests   |
| FR-6        | `DES-SETTINGS-MOCKUP-MODE`, `DES-SETTINGS-SURFACE-MODE`, `DES-API`                              | `chat/setMode`, `agent/settingsSnapshot`, `chat/error`                                         | mode mutation coverage                              |
| FR-11       | `DES-SETTINGS-MOCKUP-WORKSPACE`, `DES-SETTINGS-SURFACE-INTENT`, `DES-DATA`, `DES-API`           | `applyIntentSlot`, `applyIntentMinimized`, `applyIntentScope`, `agent/settingsSnapshot.intent` | app/e2e settings coverage                           |
| NFR-1       | `DES-SEC`, `DES-SETTINGS-SURFACE-PROVIDERS`                                                     | masked provider key row, `data-clarity-mask`, no raw key render                                | provider-card tests/manual review                   |
| NFR-2       | `DES-ERR`, `DES-SETTINGS-MOCKUP-RECOVERY`                                                       | `RuntimeConfigurationNotice`, `AgentRecoveryCard`, pending mutation error toasts               | `apps/chat/src/app.test.tsx`; future recovery tests |

---

## [DES-SETTINGS-QUESTIONS] Open Technical Questions

None.
