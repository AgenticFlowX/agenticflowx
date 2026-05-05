---
afx: true
type: DESIGN
status: Approved
owner: "@rixrix"
version: "1.3"
created_at: "2026-04-26T04:32:48.000Z"
updated_at: "2026-05-05T15:23:18.000Z"
approved_at: "2026-05-05T11:53:21.000Z"
tags: [app, vscode, extension, webview, commands, agent, settings, mode, workspace-mode]
spec: spec.md
---

# apps/vscode — Technical Design

---

## [DES-OVR] Overview

`apps/vscode` is the extension host entry point. It registers commands, creates sidebar and workbench webview providers, builds configured coding-agent instances, and serves compiled webview builds via a HTML generator. It also owns the durable active-file context preference and the workspace mode preference (`afx.mode.active`) that the chat composer and settings surfaces mirror when sending prompts and switching between Code and Explore. The `afx.setMode` command is the shared workspace-mode entry point for the command palette, settings card, and composer toggle.

---

## [DES-ARCH] Architecture

### System Context

```text
apps/vscode/src/
├── extension.ts               ← activate/deactivate, commands, AgentManager config injection
├── agent-factory.ts           ← creates configured AgentInstance[] (Pi CLI + API Providers when configured)
├── multiplex-agent-manager.ts ← routes model/runtime calls across configured instances
├── secret-store.ts            ← VS Code SecretStorage wrapper for provider API keys
├── panels/
│   ├── sidebar-panel.ts       ← createSidebarPanel() — AgentManager-backed chat webview provider
│   ├── workbench-panel.ts     ← createWorkbenchPanel() — bottom panel provider
│   └── webview-html.ts        ← generateWebviewHtml() — loads dist output
├── providers/                 ← @see providers and AFX right-click code actions
├── services/                  ← specs/sprint data services
└── utils/                     ← editor context helpers
```

### Webview Loading

```text
extension.ts
  ├── read afx.agentBinaryPath, afx.agentEphemeralSession, provider keys, workspace folder
  ├── createConfiguredAgentInstances({ logger, binaryPath, ephemeral, cwd, secretStore, bootstrapPath }) → Promise<AgentInstance[]>
  ├── wrap instances with MultiplexedAgentManager when multiple runtimes are available
  └── createSidebarPanel({ ..., agentManager })
        └── SidebarPanel.resolveWebviewView()
              └── generateWebviewHtml(webview, distPath)
                    └── loads apps/chat/dist/index.html via nonce + CSP
```

---

## [DES-DEC] Key Decisions

| Decision        | Options Considered                                 | Choice                                                                                            | Rationale                                               |
| --------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Webview loading | Load from extension resources, iframe, inline HTML | Load compiled Vite dist from extension resources                                                  | Standard VSCode pattern; supports fast reload in dev    |
| Agent ownership | Per-panel, per-extension                           | `AgentInstance[]` routed through a runtime-agnostic manager when multiple runtimes are configured | Keeps panels independent from Pi-specific details       |
| Host services   | Inline in panels, dedicated services               | Dedicated provider/service modules for editor traceability, specs data, and sprint operations     | Keeps panel providers focused on VS Code/webview wiring |

---

## [DES-UI] User Interface & UX

Extension contributes:

- Activity bar icon (sidebar panel entry point)
- AFX Workbench panel in the bottom container
- Status bar item (agent connection state)

---

## [DES-API] API Contracts

```typescript
// Activation entry point
export function activate(context: vscode.ExtensionContext): void;
export function deactivate(): void;

// Agent factory
type AgentRuntime = "pi" | "pi-sdk";
interface AgentInstance {
  id: string;
  label: string;
  runtime: AgentRuntime;
  manager: AgentManager;
}
function createConfiguredAgentInstances(opts): Promise<AgentInstance[]>;
function getDefaultAgentInstance(instances: readonly AgentInstance[]): AgentInstance;

// Panel factories
function createSidebarPanel(deps: SidebarPanelDeps): SidebarPanelProvider;
function createWorkbenchPanel(deps: WorkbenchPanelDeps): vscode.WebviewViewProvider;

// HTML generation
function loadWebviewHtml(webview: vscode.Webview, distPath: string): string;
```

The sidebar panel's webview message handler dispatches `ChatToAgent` variants to host services
(`AgentManager`, settings, telemetry, shell). One additional case lives here for the composer
modified-files strip and the mirrored active-file context preference:

| Message                            | Handler                                                                                                                                                              |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `chat/openFile`                    | `vscode.window.showTextDocument(uri, { selection })` — relative paths resolved against workspace; `line` (1-indexed) reveals row                                     |
| `chat/setIncludeActiveFileContext` | `vscode.workspace.getConfiguration("afx").update("context.includeActiveFileContext", enabled, vscode.ConfigurationTarget.Global)` then refresh the settings snapshot |

@see docs/specs/211-app-chat-composer/spec.md [FR-10]
@see docs/specs/211-app-chat-composer/spec.md [FR-11]
@see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-FILES-STRIP] [DES-COMPOSER-CONTEXT]
@see docs/specs/214-app-chat-settings/spec.md [FR-5]
@see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-SURFACE-CONTEXT]

---

## [DES-SETTINGS-CATALOG] Settings Catalog

Master index of every `afx.*` configuration key contributed by `apps/vscode/package.json`. Each
key lists its UI surface and the spec that owns the behavior driven by the value. Source of truth
is `package.json` `contributes.configuration.properties`; this table mirrors it for routing.

| Key                                    | Type    | Default                     | UI surface                                    | Owning spec                    |
| -------------------------------------- | ------- | --------------------------- | --------------------------------------------- | ------------------------------ |
| `afx.rpc.enabled`                      | boolean | `false`                     | chat settings panel                           | `351-agent-pi`                 |
| `afx.agentBinaryPath`                  | string  | `""`                        | chat settings panel                           | `351-agent-pi`                 |
| `afx.agentEphemeralSession`            | boolean | `false`                     | chat settings panel                           | `351-agent-pi`                 |
| `afx.sessionDir`                       | string  | `""`                        | none (host-managed)                           | `351-agent-pi`                 |
| `afx.sdk.enabled`                      | boolean | `true`                      | chat settings panel                           | `350-agent-manager`            |
| `afx.sdk.defaultModel`                 | string  | `anthropic:claude-opus-4-5` | chat settings provider card                   | `214-app-chat-settings`        |
| `afx.sdk.ollamaBaseUrl`                | string  | `""`                        | chat settings provider card                   | `214-app-chat-settings`        |
| `afx.context.includeActiveFileContext` | boolean | `true`                      | chat settings context card / composer toolbar | `214-app-chat-settings`        |
| `afx.mode.active`                      | enum    | `code`                      | chat settings mode card / composer toolbar    | `214-app-chat-settings`        |
| `afx.debugPerf`                        | boolean | `false`                     | composer footer (when on)                     | `211-app-chat-composer`        |
| `afx.theme`                            | enum    | `meridian`                  | chat settings appearance                      | `131-package-ui-design-system` |
| `afx.style`                            | enum    | `lyra`                      | chat settings appearance                      | `131-package-ui-design-system` |
| `afx.logLevel`                         | enum    | `info`                      | none (env `AFX_LOG_LEVEL`)                    | `200-app-vscode`               |
| `afx.telemetry.enabled`                | boolean | `true`                      | chat settings panel                           | `901-cross-telemetry`          |

`afx.style` enum: `lyra` | `luma` | `maia` | `nova` | `vega` | `mira` | `sera`.
`afx.logLevel` enum: `silent` | `error` | `warn` | `info` | `debug` | `trace`.

Adding a setting:

1. Add to `package.json` `contributes.configuration.properties`.
2. Add a row to this table with the owning spec.
3. Read it via `vscode.workspace.getConfiguration("afx")` in the owning spec's host code.

---

## [DES-COMMAND-CATALOG] Command Catalog

Master index of every `afx.*` command contributed by `package.json` and registered in
`extension.ts`. Each row lists the title, surfaces that trigger the command, the owning spec, and
the design node that should anchor the registration's `@see`.

### Top-level commands

| Command                   | Title                     | Surfaces                          | Owning spec             | Design anchor                          |
| ------------------------- | ------------------------- | --------------------------------- | ----------------------- | -------------------------------------- |
| `afx.openSidebar`         | Open Sidebar              | palette, keybinding `cmd+alt+a`   | `201-app-vscode-panels` | `[DES-PANELS-COMMAND-OPEN-SIDEBAR]`    |
| `afx.openWorkbench`       | Open Workbench            | palette                           | `201-app-vscode-panels` | `[DES-PANELS-COMMAND-OPEN-WORKBENCH]`  |
| `afx.setMode`             | Set Mode                  | palette, settings card, composer  | `214-app-chat-settings` | `[DES-COMMAND-SET-MODE]`               |
| `afx.showLogs`            | Show Logs (Output Panel)  | palette                           | `200-app-vscode`        | `[DES-COMMAND-SHOW-LOGS]`              |
| `afx.agentSmokeTest`      | Agent Smoke Test          | palette                           | `350-agent-manager`     | `[DES-AGENT-COMMAND-SMOKE-TEST]`       |
| `afx.agentRestart`        | Restart Agent Process     | palette, settings recovery button | `350-agent-manager`     | `[DES-AGENT-COMMAND-RESTART]`          |
| `afx.setProviderApiKey`   | Set Provider API Key      | palette, settings card            | `214-app-chat-settings` | `[DES-SETTINGS-COMMAND-SET-API-KEY]`   |
| `afx.clearProviderApiKey` | Clear Provider API Key    | palette, settings card            | `214-app-chat-settings` | `[DES-SETTINGS-COMMAND-CLEAR-API-KEY]` |
| `afx.detectPiBinary`      | Auto-detect Pi CLI Binary | palette, settings recovery        | `351-agent-pi`          | `[DES-PI-COMMAND-DETECT-BINARY]`       |

### Editor right-click / title menu actions (`afx.editorContext` submenu)

| Command                     | Title                | Group        | When                                                             | Owning spec                     | Design anchor                   |
| --------------------------- | -------------------- | ------------ | ---------------------------------------------------------------- | ------------------------------- | ------------------------------- |
| `afx.action.saveToNotes`    | Save to Notes        | `0_notes@1`  | always                                                           | `215-app-chat-notes`            | `[DES-NOTES-FLOW]`              |
| `afx.action.addToContext`   | Insert into Composer | `1_chat@1`   | always                                                           | `211-app-chat-composer`         | `[DES-COMPOSER-FLOW]`           |
| `afx.action.sendSelection`  | Send Selection       | `1_chat@2`   | always                                                           | `211-app-chat-composer`         | `[DES-COMPOSER-FLOW]`           |
| `afx.action.explain`        | Explain              | `1_chat@3`   | always                                                           | `202-app-vscode-editor-actions` | `[DES-ACTION-EXPLAIN]`          |
| `afx.action.review`         | Review               | `1_chat@4`   | always                                                           | `202-app-vscode-editor-actions` | `[DES-ACTION-REVIEW]`           |
| `afx.action.improveCode`    | Improve              | `1_chat@5`   | `editorLangId != markdown`                                       | `202-app-vscode-editor-actions` | `[DES-ACTION-IMPROVE-CODE]`     |
| `afx.action.generateTests`  | Generate Tests       | `1_chat@6`   | `editorLangId != markdown`                                       | `202-app-vscode-editor-actions` | `[DES-ACTION-GENERATE-TESTS]`   |
| `afx.action.addSeeLink`     | Add @see Link        | `2_trace@1`  | `editorLangId != markdown`                                       | `203-app-vscode-see-navigation` | `[DES-SEE-COMMAND-ADD-LINK]`    |
| `afx.action.verifyTrace`    | Verify Traceability  | `2_trace@2`  | always                                                           | `203-app-vscode-see-navigation` | `[DES-SEE-COMMAND-VERIFY]`      |
| `afx.action.specValidate`   | Spec - Validate      | `3_spec@1`   | `resourceFilename == spec.md \|\| afx.sprintSection == SPEC`     | `204-app-vscode-spec-services`  | `[DES-SPEC-COMMAND-VALIDATE]`   |
| `afx.action.specReview`     | Spec - Review        | `3_spec@2`   | `resourceFilename == spec.md \|\| afx.sprintSection == SPEC`     | `204-app-vscode-spec-services`  | `[DES-SPEC-COMMAND-REVIEW]`     |
| `afx.action.specApprove`    | Spec - Approve       | `3_spec@3`   | `resourceFilename == spec.md \|\| afx.sprintSection == SPEC`     | `204-app-vscode-spec-services`  | `[DES-SPEC-COMMAND-APPROVE]`    |
| `afx.action.designValidate` | Design - Validate    | `4_design@1` | `resourceFilename == design.md \|\| afx.sprintSection == DESIGN` | `204-app-vscode-spec-services`  | `[DES-DESIGN-COMMAND-VALIDATE]` |
| `afx.action.designReview`   | Design - Review      | `4_design@2` | `resourceFilename == design.md \|\| afx.sprintSection == DESIGN` | `204-app-vscode-spec-services`  | `[DES-DESIGN-COMMAND-REVIEW]`   |
| `afx.action.designApprove`  | Design - Approve     | `4_design@3` | `resourceFilename == design.md \|\| afx.sprintSection == DESIGN` | `204-app-vscode-spec-services`  | `[DES-DESIGN-COMMAND-APPROVE]`  |
| `afx.action.taskCode`       | Task - Code          | `5_tasks@1`  | `resourceFilename == tasks.md \|\| afx.sprintSection == TASKS`   | `204-app-vscode-spec-services`  | `[DES-TASK-COMMAND-CODE]`       |
| `afx.action.taskVerify`     | Task - Verify        | `5_tasks@2`  | `resourceFilename == tasks.md \|\| afx.sprintSection == TASKS`   | `204-app-vscode-spec-services`  | `[DES-TASK-COMMAND-VERIFY]`     |
| `afx.action.taskPick`       | Task - Pick Next     | `5_tasks@3`  | `resourceFilename == tasks.md \|\| afx.sprintSection == TASKS`   | `204-app-vscode-spec-services`  | `[DES-TASK-COMMAND-PICK]`       |

The submenu `afx.editorContext` is contributed to both `editor/context` (right-click) and
`editor/title` (when the active file is a sprint/spec/design/tasks document, controlled by
`afx.isSprint` and filename matchers).

Adding a command:

1. Add to `package.json` `contributes.commands` and (if menu-bound) `contributes.menus.afx.editorContext`.
2. Register the handler in `extension.ts` with a top-of-handler `@see` to the design anchor above.
3. Add a row to this table with the owning spec.

## [DES-COMMAND-SET-MODE] `afx.setMode` Command

`afx.setMode` is the workspace-posture mutation path shared by the command palette, the settings
card, and the composer toggle. The command writes `afx.mode.active` at workspace scope, then the
sidebar/settings snapshots rehydrate from that persisted value.

| Aspect     | Value                                                                                                                                                     |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Registered | `apps/vscode/src/extension.ts`                                                                                                                            |
| Title      | `Set Mode`                                                                                                                                                |
| Keybinding | None in v1; use the command palette or in-app mode controls                                                                                               |
| Behavior   | Reads the current `afx.mode.active` workspace setting, optionally shows a quick-pick, and persists the chosen posture back to the workspace configuration |
| Surfaces   | command palette, Settings `Mode` card, composer `Mode` toggle                                                                                             |

Quick-pick copy:

| Option    | Description                                 |
| --------- | ------------------------------------------- |
| `Code`    | Default. Full access. Pi can act and edit.  |
| `Explore` | Experimental. Read-only investigation mode. |

---

## [DES-KEYBINDING-CATALOG] Keybinding Catalog

Combines global keybindings contributed via `package.json` `contributes.keybindings` and the
webview-internal keyboard policy owned by `211-app-chat-composer` and `215-app-chat-notes`.

### Global (host-level)

| Key              | Where                     | Triggers          | Owning spec             |
| ---------------- | ------------------------- | ----------------- | ----------------------- |
| `Ctrl/Cmd+Alt+A` | global, `editorTextFocus` | `afx.openSidebar` | `201-app-vscode-panels` |

### Webview-internal (composer)

These are not contributed via `package.json`; they are handled inside `apps/chat/src/views/chat.tsx`
`onKeyDown`. Listed here so global bindings can be checked for conflicts against composer
expectations.

| Key                    | Composer state        | Triggers                               | Owning spec             |
| ---------------------- | --------------------- | -------------------------------------- | ----------------------- |
| `Enter`                | idle, no helper popup | `submit({ followUp: false })`          | `211-app-chat-composer` |
| `Shift+Enter`          | any                   | newline                                | `211-app-chat-composer` |
| `Cmd/Ctrl+Enter`       | idle                  | `submit({ followUp: false })` (compat) | `211-app-chat-composer` |
| `Enter`                | streaming             | `submit({ followUp: true })` (queue)   | `211-app-chat-composer` |
| `Cmd/Ctrl+Enter`       | streaming             | `submit({ followUp: false })` (steer)  | `211-app-chat-composer` |
| `Cmd/Ctrl+Shift+Enter` | any                   | `saveAsNote()`                         | `215-app-chat-notes`    |
| `ArrowUp`/`ArrowDown`  | textarea at start     | prompt-history navigation              | `211-app-chat-composer` |
| `Escape`               | helper picker open    | close picker, retain draft             | `211-app-chat-composer` |
| `Arrow*`/`Home`/`End`  | helper picker open    | forwarded to `[cmdk-root]`             | `211-app-chat-composer` |

Adding a keybinding:

1. Global: add to `package.json` `contributes.keybindings` and update this table.
2. Webview-internal: implement in the owning view's `onKeyDown` and update the per-zone Keys
   matrix in that zone's design.md (e.g., `[DES-COMPOSER-KEYS]`); reflect here.
3. Always check this table for conflicts before adding.

---

## [DES-FILES] File Structure

| File                                         | Purpose                                             |
| -------------------------------------------- | --------------------------------------------------- |
| `apps/vscode/src/extension.ts`               | Extension activate/deactivate, command registration |
| `apps/vscode/src/agent-factory.ts`           | Configured coding-agent instance factory            |
| `apps/vscode/src/multiplex-agent-manager.ts` | Multi-runtime routing behind `AgentManager`         |
| `apps/vscode/src/secret-store.ts`            | Provider API key SecretStorage access               |
| `apps/vscode/src/panels/sidebar-panel.ts`    | Chat webview provider                               |
| `apps/vscode/src/panels/workbench-panel.ts`  | Workbench webview provider                          |
| `apps/vscode/src/panels/webview-html.ts`     | HTML generator with CSP nonce                       |
| `apps/vscode/src/providers/*.ts`             | @see navigation and AFX right-click code actions    |
| `apps/vscode/src/services/*.ts`              | Specs and sprint data services                      |
| `apps/vscode/src/utils/editor-utils.ts`      | Editor selection/context helpers                    |
| `apps/vscode/esbuild.mjs`                    | esbuild config (bundles extension host for Node.js) |

---

## [DES-DEPS] Dependencies

| Package             | Purpose                      |
| ------------------- | ---------------------------- |
| `@types/vscode`     | VSCode API type declarations |
| `@afx/shared`       | Message types, AgentManager  |
| `@afx/agent-pi`     | Pi CLI adapter factory       |
| `@afx/agent-pi-sdk` | API-provider runtime adapter |

---

## [DES-SEC] Security Considerations

- Webview CSP enforced via nonce in `webview-html.ts`
- Only local resource URIs allowed in webview (`localResourceRoots`)

---

## [DES-ERR] Error Handling

| Scenario              | Handling                                                                    |
| --------------------- | --------------------------------------------------------------------------- |
| Agent startup failure | Logged to OutputChannel; webview shows disconnected state; smoke test fails |
| Extension UI request  | Sidebar maps request to VSCode UI and sends `respondToUiRequest()` response |
| Webview dist missing  | Extension logs error; panel shows blank                                     |

---

## [DES-TEST] Testing Strategy

### E2E Tests

- `apps/vscode-e2e/src/extension.test.ts` — extension activation, command registration, webview provider registration (covered by `420-dx-testing`)
- `apps/vscode/src/agent-factory.test.ts` — configured runtime factory contract
- `apps/vscode/src/multiplex-agent-manager.test.ts` — multi-runtime routing and session handoff
- `apps/vscode/src/providers/*.test.ts` — @see navigation and right-click action behavior

---

## [DES-ROLLOUT] Migration / Rollout Plan

### Adding Commands

1. Add to `package.json` `contributes.commands`
2. Register handler in `extension.ts`
3. Update spec FR table

---

## File Reference Map

| Task | File                                        | Required @see                                                                          |
| ---- | ------------------------------------------- | -------------------------------------------------------------------------------------- |
| —    | `apps/vscode/src/extension.ts`              | `spec.md [FR-1] [FR-4] [FR-6] [FR-12]` + `design.md [DES-ARCH] [DES-COMMAND-SET-MODE]` |
| —    | `apps/vscode/src/agent-factory.ts`          | `spec.md [FR-6] [FR-8]` + `design.md [DES-ARCH]`                                       |
| —    | `apps/vscode/src/panels/sidebar-panel.ts`   | `spec.md [FR-2] [FR-7]` + `design.md [DES-ARCH]`                                       |
| —    | `apps/vscode/src/panels/workbench-panel.ts` | `spec.md [FR-3]` + `design.md [DES-ARCH]`                                              |
| —    | `apps/vscode/src/panels/webview-html.ts`    | `spec.md [FR-5]` + `design.md [DES-ARCH]`                                              |
