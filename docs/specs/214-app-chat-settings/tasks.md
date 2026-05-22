---
afx: true
type: TASKS
status: Living
owner: "@rixrix"
version: "1.5"
created_at: "2026-05-02T23:56:50.000Z"
updated_at: "2026-05-22T06:20:53.000Z"
tags: ["app", "chat", "settings", "providers", "custom-models"]
spec: spec.md
design: design.md
---

# App Chat Settings - Implementation Tasks

---

## Task Numbering Convention

- **1.x** - Source retargeting
- **2.x** - Future settings work
- **3.x** - Verification

---

## Phase 1: Source Retargeting

### 1.1 Retarget Settings Files

- [ ] Replace retired chat/runtime refs in settings view, provider cards, and snapshot helpers
- [ ] Keep shared theme refs pointed at `131-package-ui-design-system`

---

## Phase 2: Future Settings Work

### 2.1 Provider Runtime UX Updates

- [ ] Update requirements before changing provider/API key behavior
- [ ] Add focused settings tests

### 2.2 Active File Context Preference

- [x] Add the default-on active-file context switch to the Settings view
- [x] Mirror the same setting through the chat composer quick toggle
- [x] Add tests for snapshot hydration, persistence, and small-screen behavior

### 2.3 First-Run Connection UX

- [x] Add a top Settings connection panel for hosted API keys, custom endpoints, and Pi RPC
- [x] Keep connection actions navigation-only until explicit Save
- [x] Focus hosted provider API key input from setup entry points
- [x] Collapse Skills & commands under Support by default
- [x] Merge bundled AFX skills into the Support command catalogue

### 2.4 Runtime Timeout Visibility

- [x] Show the effective model warm-up timeout in Runtimes
- [x] Open `afx.runtime.responseStartTimeoutMs` from the row's Configure action
- [x] Describe the timeout as a slow-start warning for providers, proxies, and local runtimes
- [x] Cover the row with unit, e2e, and screenshot tests

---

## Phase 3: Verification

### 3.1 Verify Settings Routing

- [x] Run stale-ref search for settings files
- [x] Run relevant chat tests

---

## Phase 4: Custom Models (harness-agnostic, Pi SDK adapter first)

### 4.1 Canonical types in `@afx/shared`

- [ ] Add `packages/shared/src/custom-providers/types.ts` — `CustomProviderRecord`, `CustomProviderModel`, `CustomProviderSummary`, `CustomProviderApiKind`
- [ ] Add `packages/shared/src/custom-providers/harness-adapter.ts` — `HarnessAdapter` interface
- [ ] Add `packages/shared/src/custom-providers/presets.ts` — 9 canonical presets
- [ ] Add `packages/shared/src/custom-providers/redact.ts` — `summarizeForWebview`, `assertNoSecretLeak`
- [ ] Extend `packages/shared/src/messages.ts` — `SettingsSnapshot.customModels` and `customModels/*` bridge messages
- [ ] Unit tests for redaction guard, preset shapes, schema validation

### 4.2 Pi SDK adapter

- [ ] Add `packages/agent/pi-sdk/src/custom-providers-adapter.ts` — implements `HarnessAdapter`, `materialization: 'in-process-register'`
- [ ] Add `packages/agent/pi-sdk/src/secret-env.ts` — `secretEnvVarFor(providerId)` helper
- [ ] Unit tests with `~/.pi/agent/models.json` fixture (kimi/moonshot-open) for `parseHandEdited`

### 4.3 Pi SDK bootstrap modification

- [ ] Modify `packages/agent/pi-sdk/bootstrap/bootstrap.ts` — branch on `AFX_CUSTOM_PROVIDERS_JSON`; use `createAgentSessionRuntime({ modelRegistry })` + `runRpcMode(runtime)` when present, fall through to `main(args)` otherwise
- [ ] Add `packages/agent/pi-sdk/bootstrap/custom-providers-bootstrap.ts` — pure helpers (parse envelope, build registry)
- [ ] Bootstrap regression tests: behaviour unchanged when env var absent; `registerProvider` called per record when present

### 4.4 Host integration

- [ ] Extend `apps/vscode/src/secret-store.ts` — `getCustomProviderRecord` / `setCustomProviderRecord` / `deleteCustomProviderRecord` / `listCustomProviderRecords` using `afx.customProvider.${id}` keys
- [ ] Add `apps/vscode/src/services/custom-providers-service.ts` — factory function returning a service object (no class) with `getSnapshot`, `applyMutation`, `buildEnvForPiSdkSpawn`
- [ ] Wire `customProvidersService` into `apps/vscode/src/agent-factory.ts` Pi SDK env path
- [ ] Wire activation in `apps/vscode/src/extension.ts`; hook `secretStore.onDidChange` for `afx.customProvider.*`
- [ ] Add `customModels/*` cases to `apps/vscode/src/panels/sidebar-panel.ts` dispatchInbound switch
- [ ] Host-side tests covering snapshot composition and mutation dispatch

### 4.5 Webview UI

- [ ] Add Custom Models sub-tab + Track selector in `apps/chat/src/views/settings.tsx`
- [ ] Add `apps/chat/src/components/custom-model-card.tsx` (editable + readonly modes)
- [ ] Add `apps/chat/src/components/preset-picker.tsx`
- [ ] Add `apps/chat/src/components/api-key-source-input.tsx`
- [ ] Add `apps/chat/src/components/custom-provider-form.tsx`
- [ ] Add `apps/chat/src/components/custom-model-form.tsx`
- [ ] Extend `apps/chat/src/lib/settings-snapshot.ts` to thread `customModels`
- [ ] Component tests: no apiKey persists in component state once submitted; readonly cards never expose apiKey or non-public fields

### 4.6 E2E coverage

- [ ] Add `apps/vscode-e2e/src/custom-providers.test.ts` — exercises Pi SDK track add/edit/remove via test API; verifies `~/.pi/agent/models.json` is never modified

### 4.7 Verification

- [ ] `pnpm verify` clean across all packages
- [ ] Webview leakage check: bridge payloads never contain apiKey, models[], compat, or headers
- [ ] Tmp file check: no temp `models.json` materialized anywhere on disk

---

## Implementation Flow

```text
Retarget settings refs
    ↓
Update provider/runtime UX
    ↓
Add active-file context preference
    ↓
Verify settings behavior
    ↓
Custom Models (Pi SDK + Pi RPC tracks)
    ↓
E2E + verify
```

---

## Cross-Reference Index

| Task | Spec Requirement        | Design Section                                                                                                |
| ---- | ----------------------- | ------------------------------------------------------------------------------------------------------------- |
| 1.1  | [FR-1], [FR-2]          | [DES-FILES], [DES-DATA]                                                                                       |
| 2.1  | [FR-1], [FR-4]          | [DES-UI], [DES-API]                                                                                           |
| 2.2  | [FR-5]                  | [DES-SETTINGS-CONTEXT]                                                                                        |
| 2.3  | [FR-12]                 | [DES-SETTINGS-ONBOARDING], [DES-SETTINGS-SURFACE-SKILLS]                                                      |
| 2.4  | [FR-13]                 | [DES-SETTINGS-SURFACE-RUNTIME], [DES-DATA], [DES-API]                                                         |
| 4.1  | [FR-8], [FR-9], [FR-10] | [DES-SETTINGS-CUSTOM-MODELS]                                                                                  |
| 4.2  | [FR-9], [FR-10]         | [DES-SETTINGS-CUSTOM-MODELS] · `351-agent-pi [DES-PI-CUSTOM-PROVIDERS]`                                       |
| 4.3  | [FR-9], [FR-10]         | `351-agent-pi [DES-PI-CUSTOM-PROVIDERS]`                                                                      |
| 4.4  | [FR-8], [FR-9], [FR-10] | [DES-SETTINGS-CUSTOM-MODELS]                                                                                  |
| 4.5  | [FR-8], [FR-9]          | [DES-SETTINGS-CUSTOM-MODELS], [DES-SETTINGS-MOCKUP-CUSTOM-PRESET], [DES-SETTINGS-MOCKUP-CUSTOM-PROVIDER-FORM] |
| 4.6  | [NFR-1]                 | [DES-SETTINGS-CUSTOM-MODELS]                                                                                  |
| 4.7  | [NFR-1], [NFR-2]        | [DES-SETTINGS-CUSTOM-MODELS]                                                                                  |

---

## Notes

- Shared token/theme contracts remain in `131-package-ui-design-system`.
- Active-file context is a durable preference mirrored by the composer quick toggle.

---

## Work Sessions

<!-- IMPORTANT: This section MUST remain the LAST section in tasks.md. Do not add content below it. -->
<!-- Task execution log — append-only, updated by /afx-task pick, /afx-task code, /afx-task complete -->

| Date                     | Task  | Action      | Files Modified                                                                                                                                                                                                                                                                                                                                                                                                                              | Agent | Human |
| ------------------------ | ----- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 2026-05-02               | 1.1   | Scaffolded  | docs/specs/214-app-chat-settings/                                                                                                                                                                                                                                                                                                                                                                                                           | [x]   | [x]   |
| 2026-05-03               | 1.2   | Coded       | design.md, apps/chat/src/views/settings.tsx                                                                                                                                                                                                                                                                                                                                                                                                 | [x]   | [x]   |
| 2026-05-05               | 2.2   | In progress | spec.md, design.md                                                                                                                                                                                                                                                                                                                                                                                                                          | [x]   | [x]   |
| 2026-05-05T11:53:21.000Z | 2.2   | Coded       | apps/chat/src/views/settings.tsx, apps/chat/src/lib/settings-snapshot.ts, apps/chat/src/lib/settings-snapshot.test.ts, apps/chat/src/app.test.tsx                                                                                                                                                                                                                                                                                           | [x]   | [x]   |
| 2026-05-05T12:03:56.000Z | 2.2   | Completed   | apps/chat/src/views/settings.tsx, apps/chat/src/lib/settings-snapshot.ts, apps/chat/src/lib/settings-snapshot.test.ts, apps/chat/src/app.test.tsx                                                                                                                                                                                                                                                                                           | [x]   | [x]   |
| 2026-05-07T08:58:58.000Z | UX    | In progress | docs/specs/350-agent-manager/design.md, docs/specs/351-agent-pi/design.md, docs/specs/214-app-chat-settings/{spec,design,tasks}.md, apps/chat/src/lib/settings-copy.ts, apps/chat/src/views/settings.tsx, apps/chat/src/components/{provider-card,external-agent-card,agent-recovery-card}.tsx, apps/chat/src/lib/settings-snapshot.ts                                                                                                      | [x]   | [x]   |
| 2026-05-08T12:18:59.000Z | 4.x   | Scaffolded  | docs/specs/214-app-chat-settings/{spec,design,tasks}.md, docs/research/pi/res-pi-models-json-settings-ui.md, docs/adr/ADR-0008-afx-custom-providers-adapter-pattern.md (planned)                                                                                                                                                                                                                                                            | [x]   | [x]   |
| 2026-05-17T13:48:20.000Z | UX    | Coded       | apps/chat/src/views/settings.tsx, apps/chat/src/components/agent-recovery-card.tsx, apps/chat/src/app.tsx, apps/chat/src/lib/settings-copy.ts, apps/chat/src/app.test.tsx, apps/vscode/src/panels/sidebar-panel.ts, apps/vscode/src/panels/sidebar-panel.test.ts, apps/vscode/package.json, packages/shared/src/messages.ts, packages/transport/src/{mock,mock.test}.ts, docs/specs/214-app-chat-settings/{design,tasks}.md                 | [x]   | [ ]   |
| 2026-05-21T11:34:14.000Z | 2.3   | Coded       | apps/chat/src/{app.tsx,views/settings.tsx,lib/settings-copy.ts,lib/settings-navigation.ts}, apps/chat/src/components/{provider-card.tsx,custom-provider-form.tsx}, apps/chat/src/components/chat/{chat-window.tsx,composer-toolbar.tsx,conversation-empty-states.tsx}, apps/chat/{src/app.test.tsx,src/components/provider-card.test.tsx,e2e/chat.spec.ts,e2e/screenshots.spec.ts}, docs/specs/214-app-chat-settings/{spec,design,tasks}.md | [x]   | [ ]   |
| 2026-05-21T12:36:36.000Z | 2.3   | Coded       | apps/vscode/src/panels/sidebar-panel.ts, apps/vscode/src/panels/sidebar-panel.test.ts, packages/transport/src/mock.ts, apps/chat/e2e/chat.spec.ts, docs/specs/214-app-chat-settings/{spec,design,tasks}.md                                                                                                                                                                                                                                  | [x]   | [ ]   |
| 2026-05-21T21:22:08.000Z | 2.4   | Coded       | apps/vscode/{package.json,src/panels/sidebar-panel.ts,src/panels/sidebar-panel.test.ts}, apps/chat/src/{views/settings.tsx,lib/settings-copy.ts,app.test.tsx}, apps/chat/e2e/{chat.spec.ts,screenshots.spec.ts}, packages/shared/src/messages.ts, docs/specs/214-app-chat-settings/{spec,design,tasks}.md                                                                                                                                   | [x]   | [ ]   |
| 2026-05-21T22:05:40.000Z | 2.4   | Copy polish | apps/chat/src/lib/settings-copy.ts, apps/chat/{src/app.test.tsx,e2e/chat.spec.ts,e2e/screenshots.spec.ts}, docs/specs/214-app-chat-settings/{spec,design,tasks}.md                                                                                                                                                                                                                                                                          | [x]   | [ ]   |
| 2026-05-22T06:20:53.000Z | FR-10 | Fixed       | apps/vscode/src/{extension.ts,services/custom-providers-service.ts,services/custom-providers-service.test.ts}, apps/vscode/src/panels/sidebar-panel.test.ts, docs/specs/214-app-chat-settings/{spec,design,tasks}.md, docs/specs/351-agent-pi/design.md                                                                                                                                                                                     | [x]   | [ ]   |
