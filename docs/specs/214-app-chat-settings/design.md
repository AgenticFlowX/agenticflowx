---
afx: true
type: DESIGN
status: Draft
owner: "@rixrix"
version: "1.0"
created_at: "2026-05-02T23:56:50.000Z"
updated_at: "2026-05-03T02:54:23.000Z"
tags: ["app", "chat", "settings", "providers"]
spec: spec.md
---

# App Chat Settings - Technical Design

---

## [DES-OVR] Overview

The settings zone renders provider/runtime configuration state inside the chat webview. It consumes shared snapshots and sends configuration requests through the transport bridge.

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

| Flow               | Source anchor                                                                                           | Bridge message                                                                                                         | Host-owned result                                                    | Returned state                                                      |
| ------------------ | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Hydrate panel      | mount effect in `Settings`                                                                              | `chat/getSettingsSnapshot`, `chat/getCommands`, `chat/getState`                                                        | Host broadcasts settings, commands, runtime settings                 | `agent/settingsSnapshot`, `agent/commands`, `agent/runtimeSettings` |
| Runtime controls   | `applyThinkingLevel`, `applySteeringMode`, `applyFollowUpMode`, `applyAutoCompaction`, `applyAutoRetry` | `chat/setThinkingLevel`, `chat/setSteeringMode`, `chat/setFollowUpMode`, `chat/setAutoCompaction`, `chat/setAutoRetry` | Active `AgentManager` runtime setting update                         | `agent/runtimeSettings` or `chat/error`                             |
| Appearance         | `applyTheme`, `applyStyle`                                                                              | `appearance/update`                                                                                                    | Host persists `afx.theme` / `afx.style` and emits runtime appearance | `agent/appearanceUpdated` or `chat/error`                           |
| API provider key   | `saveProviderKey`, `clearProviderKey`, `setProviderDefaultModel`                                        | `provider/setApiKey`, `provider/clearApiKey`, `provider/setDefaultModel`                                               | Host SecretStore/settings mutation                                   | `agent/settingsSnapshot` or `chat/error`                            |
| Pi RPC local agent | `detectPiBinary`, `setRpcEnabled`, `setEphemeralSession`                                                | `external/detectPiBinary`, `external/setRpcEnabled`, `external/setEphemeral`                                           | Host config + runtime discovery                                      | `agent/settingsSnapshot` or `chat/error`                            |
| Diagnostics        | `requestStderr`, recovery buttons                                                                       | `chat/getStderr`, recovery callbacks                                                                                   | Runtime log/recovery actions                                         | `agent/stderr`, runtime status events                               |
| Telemetry          | `setTelemetryEnabled`                                                                                   | `telemetry/setEnabled`                                                                                                 | Host persists analytics preference                                   | `agent/settingsSnapshot` or `chat/error`                            |

---

## [DES-UI] User Interface & UX

Settings copy must be concrete about readiness, missing credentials, active provider/model, and recovery actions. Theme preview may demonstrate app appearance, but shared tokens remain owned by the design-system spec.

## [DES-SETTINGS-MOCKUPS] ASCII UI Mockups

### [DES-SETTINGS-MOCKUP-RUNTIME] Runtime Setup And Controls

```text
+----------------------------------------------------------------+
| Settings                                                       |
| Runtime paths, providers, appearance                           |
| [Run] [ID] [Look] [Models] [Skills] [Logs] [About]             |
+----------------------------------------------------------------+
| Runtime Setup                                                  |
| +--------------------------+ +-------------------------------+ |
| | API Provider SDK Default | | Pi RPC On/Off                 | |
| | Ready 2  Needs key 4     | | Enable Pi RPC [toggle]        | |
| | [Manage keys] [Setting]  | | Missing/connected status      | |
| +--------------------------+ +-------------------------------+ |
| [Advanced paths and defaults v]                                |
+----------------------------------------------------------------+
| Runtime                                                        |
| Thinking level       [Medium v]                                |
| Steering mode        [All v]                                   |
| Follow-up mode       [One at a time v]                         |
| Auto-compaction      [toggle]                                  |
| Auto-retry           [toggle]                                  |
+----------------------------------------------------------------+
```

### [DES-SETTINGS-MOCKUP-PROVIDERS] API And External Provider Tabs

```text
+----------------------------------------------------------------+
| Providers                                                      |
| [API Providers] [External Agents]                              |
| API Provider SDK hint                                          |
| Providers 7 | Ready 2 | Models 14                              |
| [Find provider or model...]                                    |
| [All 7] [Ready 2] [Needs key 5]                                |
|                                                                |
| +---------------- ProviderCard: Anthropic -------------------+ |
| | Claude models available        [2 models] [Collapse v]      | |
| | ******** saved                         [Remove]             | |
| | Default model [claude-opus-4-5 v]                           | |
| | [Get a key]                                                 | |
| +-------------------------------------------------------------+ |
+----------------------------------------------------------------+
| External Agents tab                                            |
| +---------------- ExternalAgentCard: Pi CLI -----------------+ |
| | 3 models / Missing / Off                                    | |
| | Enable Pi RPC [toggle]                                      | |
| | Binary path [Auto-detect from PATH] [Detect] [folder]       | |
| | Ephemeral sessions [toggle]                                 | |
| +-------------------------------------------------------------+ |
+----------------------------------------------------------------+
```

### [DES-SETTINGS-MOCKUP-RECOVERY] Readiness, Diagnostics, And Telemetry

```text
+----------------------------------------------------------------+
| No active runtime configured                                    |
| API Provider SDK is enabled, but no provider key is configured. |
| [API Providers] [External Agents]                               |
| Pi RPC recovery controls when RPC is enabled                    |
| [Reconnect] [Restart] [View logs] [Reload]                      |
+----------------------------------------------------------------+
| Diagnostics                                                     |
| Log level info                         [open setting]           |
| Runtime recovery controls                                      |
| [View buffered stderr] [New session]                            |
| Runtime stderr                                                 |
| +------------------------------------------------------------+ |
| | stderr lines...                                             | |
| +------------------------------------------------------------+ |
+----------------------------------------------------------------+
| About                                                          |
| Anonymous UI analytics [toggle]                                |
| Analytics status enabled              [open setting]           |
| Version 0.x                                                   |
+----------------------------------------------------------------+
```

## [DES-SETTINGS-SURFACE-MAP] Settings Surface Map

```text
[ChatSettings.Root]
+----------------------------------------------------------------+
| [ChatSettings.Nav] sticky title + section shortcuts             |
+----------------------------------------------------------------+
| [ChatSettings.Readiness] setup/recovery cards when unavailable  |
+----------------------------------------------------------------+
| [ChatSettings.RuntimeSetup] API Provider SDK + Pi RPC choice    |
| [ChatSettings.RuntimeControls] thinking, queue, compaction      |
+----------------------------------------------------------------+
| [ChatSettings.Appearance] identity/theme + style treatment      |
+----------------------------------------------------------------+
| [ChatSettings.Providers]                                       |
|   [ChatSettings.Providers.Api] provider cards/search/filter     |
|   [ChatSettings.Providers.External] Pi CLI/local agent cards    |
+----------------------------------------------------------------+
| [ChatSettings.ChatSkills] composer behavior + available skills  |
| [ChatSettings.Diagnostics] stderr/log/debug actions             |
| [ChatSettings.AboutTelemetry] about copy + telemetry toggle     |
+----------------------------------------------------------------+
```

### [DES-SETTINGS-SURFACE-NAV] Sticky Navigation

| Code anchor                         | UI/functionality                                                                               |
| ----------------------------------- | ---------------------------------------------------------------------------------------------- |
| `SETTINGS_SECTIONS`                 | Defines runtime, identity, style, providers, skills, diagnostics, and about section ids/labels |
| Sticky header JSX                   | Keeps the settings title and section shortcuts visible while scrolling                         |
| `jumpToSection` / `jumpToProviders` | Updates active nav state and scrolls to `settings-<id>` cards                                  |

### [DES-SETTINGS-SURFACE-RUNTIME] Runtime Setup And Runtime Controls

| Code anchor                  | UI/functionality                                                                  |
| ---------------------------- | --------------------------------------------------------------------------------- |
| `SettingsSetupCard`          | Loading state while agent/runtime metadata is being checked                       |
| `RuntimeConfigurationNotice` | No-runtime setup copy plus provider/Pi recovery actions                           |
| `RuntimeChoiceBlock`         | First-run API Provider SDK vs opt-in Pi RPC choice cards                          |
| `RuntimePathBlock`           | Advanced SDK/RPC/session/bundled skills configuration detail                      |
| `SelectRow` / `SwitchRow`    | Narrow-safe runtime control rows for thinking, queue modes, compaction, and retry |

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
| `AgentRecoveryActions`      | Shared action contract for retry, restart, settings, logs, and reload                  |
| `AgentRecoveryCard`         | Renders confirmed long-disconnect/error state and gates retry when restart is required |
| `RuntimeRecoveryButtonGrid` | Settings-local compact recovery grid for diagnostics and setup cards                   |

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

| Code anchor     | UI/functionality                                                                        |
| --------------- | --------------------------------------------------------------------------------------- |
| `groupCommands` | Splits commands into AFX skills, other skills, extension commands, and prompt templates |
| `CommandGroup`  | Inserts slash command text into composer via `onInsertCommand`                          |
| `ACTIONS`       | Direct `/new` and `/abort` extension actions                                            |

### [DES-SETTINGS-SURFACE-DIAGNOSTICS] Diagnostics, Recovery, And Telemetry

| Code anchor                 | UI/functionality                                                                    |
| --------------------------- | ----------------------------------------------------------------------------------- |
| `RuntimeRecoveryButtonGrid` | Shared reconnect/restart/logs/reload action grid                                    |
| Diagnostics card            | Stderr request/copy, log setting, new session action                                |
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
| `telemetry/setEnabled`      | `agent/settingsSnapshot` + `agent/telemetryState` |

---

## [DES-DEC] Key Decisions

| Decision                | Options Considered                       | Choice         | Rationale                                                          |
| ----------------------- | ---------------------------------------- | -------------- | ------------------------------------------------------------------ |
| Settings ownership      | Composer, parent chat, settings child    | Settings child | Provider/runtime UX is dense and separate from message composition |
| Theme preview ownership | Design-system only, settings only, split | Split          | Settings owns preview UX; design-system owns shared contract       |

---

## [DES-DATA] Data Model

Settings state includes provider catalog entries, active provider/model, runtime readiness, API key status, appearance selections, diagnostics, telemetry, and pending mutation request ids.

| Data shape                        | Owner                                    | Purpose                                                                                    |
| --------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------ |
| `SettingsSnapshot`                | `@afx/shared` and `settings-snapshot.ts` | Webview-ready host/settings/provider snapshot                                              |
| `RuntimeSettings`                 | `settings.tsx`                           | Active runtime controls for thinking, queue modes, compaction, retry, and session metadata |
| `ProviderFilter`                  | `settings.tsx`                           | Local API provider filter state: all, ready, needs-key                                     |
| `pending*Mutations` maps          | `settings.tsx`                           | RequestId-to-toast-label maps for success/error feedback                                   |
| `SettingsSnapshotInput`           | `settings-snapshot.ts`                   | Host-normalized inputs used to compose the snapshot                                        |
| `ProviderConnectionState`         | `@afx/shared` / `ProviderCard`           | API provider credential/model state                                                        |
| `ExternalAgentCardProps.status`   | `ExternalAgentCard`                      | Pi/local-agent state: connected, disabled, unavailable, coming-soon                        |
| `HostModeClass` / theme/style ids | `theme-preview.ts`                       | Browser-only preview classes for settings/debug surfaces                                   |

---

## [DES-API] API Contracts

Settings uses shared settings snapshot and provider update bridge messages. Secret persistence remains in the VSCode host.

| Direction       | Message/event                                                                                                          | Settings responsibility                                       |
| --------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Webview to host | `chat/getSettingsSnapshot`                                                                                             | Request full settings snapshot                                |
| Webview to host | `chat/getCommands`                                                                                                     | Populate skills/commands list                                 |
| Webview to host | `chat/getState`                                                                                                        | Re-broadcast runtime settings after tab switch                |
| Webview to host | `chat/setThinkingLevel`, `chat/setSteeringMode`, `chat/setFollowUpMode`, `chat/setAutoCompaction`, `chat/setAutoRetry` | Runtime control mutations                                     |
| Webview to host | `appearance/update`                                                                                                    | Persist theme/style choice                                    |
| Webview to host | `provider/setApiKey`, `provider/clearApiKey`, `provider/setDefaultModel`                                               | Provider credential/default model mutations                   |
| Webview to host | `external/detectPiBinary`, `external/setRpcEnabled`, `external/setEphemeral`                                           | Pi RPC local-agent mutations                                  |
| Webview to host | `chat/openSettings`                                                                                                    | Open specific VS Code setting key                             |
| Webview to host | `chat/getStderr`                                                                                                       | Request buffered runtime stderr                               |
| Webview to host | `telemetry/setEnabled`                                                                                                 | Persist analytics preference                                  |
| Host to webview | `agent/settingsSnapshot`                                                                                               | Replace snapshot and resolve provider/telemetry pending state |
| Host to webview | `agent/appearanceUpdated`                                                                                              | Replace appearance and resolve appearance pending state       |
| Host to webview | `agent/runtimeSettings`                                                                                                | Replace runtime controls and resolve runtime pending state    |
| Host to webview | `agent/commands`                                                                                                       | Populate skills list                                          |
| Host to webview | `agent/stderr`                                                                                                         | Show stderr viewer                                            |
| Host to webview | `chat/error`                                                                                                           | Resolve pending mutation failure with toast                   |

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

| Task | File                                               | Required @see                                                                                |
| ---- | -------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 1.x  | `apps/chat/src/views/settings.tsx`                 | `design.md [DES-SETTINGS-MOCKUP-RUNTIME] [DES-SETTINGS-SURFACE-RUNTIME] [DES-SETTINGS-FLOW]` |
| 1.x  | `apps/chat/src/components/provider-card.tsx`       | `design.md [DES-SETTINGS-SURFACE-PROVIDERS]`                                                 |
| 1.x  | `apps/chat/src/components/external-agent-card.tsx` | `design.md [DES-SETTINGS-SURFACE-PROVIDERS]`                                                 |
| 1.x  | `apps/chat/src/components/agent-recovery-card.tsx` | `design.md [DES-SETTINGS-SURFACE-DIAGNOSTICS]`                                               |
| 1.x  | `apps/chat/src/components/debug-panel.tsx`         | `design.md [DES-SETTINGS-SURFACE-DIAGNOSTICS]`                                               |
| 1.x  | `apps/chat/src/components/toast.tsx`               | `design.md [DES-SETTINGS-FLOW]`                                                              |
| 1.x  | `apps/chat/src/lib/settings-snapshot.ts`           | `design.md [DES-DATA] [DES-SETTINGS-SURFACE-PROVIDERS]`                                      |
| 1.x  | `apps/chat/src/lib/theme-preview.ts`               | `design.md [DES-SETTINGS-SURFACE-APPEARANCE]`                                                |

## [DES-SETTINGS-LOC] Code Locator Map

| Map ID                              | Code anchor                                                            | Messages/settings/commands                                                   | Tests                                                 |
| ----------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------- |
| `[ChatSettings.Nav]`                | `apps/chat/src/views/settings.tsx` sticky header, `SETTINGS_SECTIONS`  | section ids: runtime, identity, style, providers, skills, diagnostics        | `apps/chat/src/app.test.tsx`                          |
| `[ChatSettings.Readiness]`          | `SettingsSetupCard`, `RuntimeConfigurationNotice`, `AgentRecoveryCard` | `agent/runtimeStatus`, `agent/restart`, `external/detectPiBinary`            | `external-agent-card.test.tsx`                        |
| `[ChatSettings.RuntimeSetup]`       | `RuntimeChoiceBlock`, `RuntimePathBlock`, `ConfigField`                | `chat/openSettings`, `external/setRpcEnabled`, `external/setEphemeral`       | `settings-snapshot.test.ts`                           |
| `[ChatSettings.RuntimeControls]`    | `SelectRow`, `SwitchRow`, runtime mutation handlers                    | `chat/setThinkingLevel`, `chat/setSteeringMode`, `chat/setFollowUpMode`      | `apps/chat/src/app.test.tsx`                          |
| `[ChatSettings.Appearance]`         | identity/style cards, `theme-preview.ts`                               | `appearance/update`, `afx.theme`, `afx.style`                                | `theme-preview.ts` helper tests when introduced       |
| `[ChatSettings.Providers.Api]`      | `ProviderCard`, provider filter/search block, `settings-snapshot.ts`   | `provider/setApiKey`, `provider/clearApiKey`, `provider/setDefaultModel`     | `provider-card.test.tsx`, `settings-snapshot.test.ts` |
| `[ChatSettings.Providers.External]` | `ExternalAgentCard`, external agents tab                               | `external/detectPiBinary`, `external/setRpcEnabled`, `external/setEphemeral` | `external-agent-card.test.tsx`                        |
| `[ChatSettings.ChatSkills]`         | Chat settings card, skills card, command grouping                      | `chat/getCommands`, `/new`, `/abort`, `onInsertCommand`                      | `apps/chat/src/app.test.tsx`                          |
| `[ChatSettings.Diagnostics]`        | diagnostics card, stderr viewer, runtime debug actions                 | `chat/getStderr`, `agent/reload`, `agent/restart`                            | `apps/chat/src/app.test.tsx`                          |
| `[ChatSettings.AboutTelemetry]`     | about card and telemetry switch                                        | `telemetry/setEnabled`, `afx.telemetry.enabled`                              | telemetry tests when changed                          |

## [DES-SETTINGS-TRACE] Functional Trace Matrix

| Requirement | Design nodes                                                                                    | Code anchors                                                                                  | Verification                                        |
| ----------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| FR-1        | `DES-SETTINGS-MOCKUP-RUNTIME`, `DES-SETTINGS-SURFACE-RUNTIME`, `DES-SETTINGS-SURFACE-PROVIDERS` | `Settings`, `SettingsCard`, `ProviderCard`, `RuntimeConfigurationNotice`, `AgentRecoveryCard` | `apps/chat/src/app.test.tsx`; future provider tests |
| FR-2        | `DES-DATA`, `DES-SETTINGS-FLOW`                                                                 | `composeSettingsSnapshot`, `bridgeOn("agent/settingsSnapshot")`, snapshot-derived memos       | `settings-snapshot.test.ts`                         |
| FR-3        | `DES-SETTINGS-SURFACE-APPEARANCE`                                                               | `applyTheme`, `applyStyle`, `applyRuntimeAppearance`                                          | future theme-preview tests                          |
| FR-4        | `DES-SETTINGS-SURFACE-RUNTIME`, `DES-SETTINGS-SURFACE-PROVIDERS`                                | runtime mutation handlers, `ExternalAgentCard`, recovery actions                              | future runtime settings tests                       |
| NFR-1       | `DES-SEC`, `DES-SETTINGS-SURFACE-PROVIDERS`                                                     | masked provider key row, `data-clarity-mask`, no raw key render                               | provider-card tests/manual review                   |
| NFR-2       | `DES-ERR`, `DES-SETTINGS-MOCKUP-RECOVERY`                                                       | `RuntimeConfigurationNotice`, `AgentRecoveryCard`, pending mutation error toasts              | `apps/chat/src/app.test.tsx`; future recovery tests |

---

## [DES-SETTINGS-QUESTIONS] Open Technical Questions

None.
