---
afx: true
type: SPEC
status: Approved
owner: "@rixrix"
version: "1.4"
created_at: "2026-04-26T04:32:48.000Z"
updated_at: "2026-05-05T15:15:37.000Z"
approved_at: "2026-05-05T15:15:37.000Z"
tags: [app, vscode, extension, webview, commands, agent, routing, settings, mode, workspace-mode]
depends_on: [100-package-shared, 110-package-transport, 300-infra-pi]
---

# apps/vscode — Product Specification

## References

- **ADR**: [ADR-0001 Pi Engine Integration](../../adr/ADR-0001-pi-engine-integration.md)
- **Architecture**: [AGENTS.md — apps/vscode](../../../AGENTS.md)

---

## Problem Statement

The VSCode extension is the host process that registers commands, manages webview panels, and bridges the chat UI to the configured coding agent. It must integrate with the VSCode API while keeping engine and UI code in their respective packages.

This parent spec owns the extension-host boundary. Dense editor surfaces route to child specs so right-click menu, title menu, code action, and `@see` navigation work can start surgically.

---

## Child Zone Route Map

| Spec                            | Start Here For                                                                |
| ------------------------------- | ----------------------------------------------------------------------------- |
| `201-app-vscode-panels`         | Sidebar/workbench provider registration, panel HTML shells, webview lifecycle |
| `202-app-vscode-editor-actions` | Editor context menu, editor title menu, code actions, command dispatch        |
| `203-app-vscode-see-navigation` | `@see` completion, links, definition, hover, CodeLens, resolver behavior      |
| `204-app-vscode-spec-services`  | Spec cache, sprint context, parser/document services                          |

---

## User Stories

### Primary Users

VSCode users running the AgenticFlowX extension.

### Stories

**As a** user
**I want** to open the AFX chat sidebar with a keyboard shortcut
**So that** I can start a conversation without leaving the keyboard

**As a** user
**I want** the AFX workbench panel in the bottom area
**So that** I can see tasks and journal alongside my code

---

## Requirements

### Functional Requirements

| ID    | Requirement                                                                                                                                                                                                                                | Priority    |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------- |
| FR-1  | Extension activates lazily via VSCode view contributions (sidebar/workbench panels) and registers all commands during `activate()`; `activationEvents` may stay empty since the panel views themselves are activation events               | Must Have   |
| FR-2  | Sidebar webview provider loads `apps/chat` dist output                                                                                                                                                                                     | Must Have   |
| FR-3  | Workbench webview provider loads `apps/workbench` dist output                                                                                                                                                                              | Must Have   |
| FR-4  | Commands: `afx.openSidebar`, `afx.openWorkbench`, `afx.showLogs`, `afx.agentSmokeTest`, `afx.agentRestart`, `afx.setMode`                                                                                                                  | Must Have   |
| FR-5  | Webview HTML generator loads compiled Vite dist with correct CSP and nonce                                                                                                                                                                 | Must Have   |
| FR-6  | `extension.ts` reads `afx.agentBinaryPath`, `afx.agentEphemeralSession`, and workspace folder from VSCode settings and injects them into `agent-factory.ts`; the active `AgentManager` is disposed on deactivation                         | Must Have   |
| FR-7  | `sidebar-panel.ts` depends on `AgentManager` from `@afx/shared` — not on `PiManager` or any adapter-specific type; it handles normalized agent events, usage stats, and extension UI requests without referencing Pi-native shapes         | Must Have   |
| FR-8  | `agent-factory.ts` models configured coding agents as `AgentInstance[]`; AFX can return Pi CLI and API-provider runtimes while keeping webview panels runtime-agnostic                                                                     | Should Have |
| FR-9  | `package.json` contributes `afx.context.includeActiveFileContext` with a default-on setting that the host snapshots for the settings panel and composer quick toggle                                                                       | Must Have   |
| FR-10 | `sidebar-panel.ts` auto-attaches the active workspace file context to `chat/send`, `chat/steer`, and `chat/followUp` when the preference is enabled                                                                                        | Must Have   |
| FR-11 | `package.json` contributes `afx.mode.active` with a default `code` workspace setting plus `explore` and `spec` alternatives; the status bar surfaces the active mode with a colored dot and a click handler that opens the mode quick-pick | Must Have   |
| FR-12 | `extension.ts` registers `afx.setMode` (also bound to `Cmd/Ctrl+Shift+M`), persists workspace mode updates at workspace scope, and refreshes the open sidebar settings snapshot when the mode changes                                      | Must Have   |

### Non-Functional Requirements

| ID    | Requirement                                           | Target                  |
| ----- | ----------------------------------------------------- | ----------------------- |
| NFR-1 | No React code in extension host                       | Enforced by ESLint      |
| NFR-2 | Extension bundle size controlled by esbuild externals | Monitored by size-limit |

---

## Acceptance Criteria

### Webview Panels

- [x] Sidebar panel shows `apps/chat` webview content
- [x] Workbench panel shows `apps/workbench` webview content
- [x] Both panels reload when webview dist changes during development

### Commands

- [x] `afx.agentSmokeTest` returns agent status without error
- [x] `afx.agentRestart` stops and restarts the agent process
- [x] `afx.setMode` is contributed and updates the workspace-scoped mode setting
- [ ] Editor action work routes to `202-app-vscode-editor-actions`
- [ ] `@see` navigation work routes to `203-app-vscode-see-navigation`
- [ ] Active-file context preference routes through host config and composer send paths
- [ ] Workspace mode preference routes through host config and the settings snapshot refresh path

---

## Non-Goals

- No React or UI code in this app
- No engine implementation — runtime abstraction is in `350-agent-manager`; Pi adapter specifics are in `351-agent-pi`
- No additional cloud/auth/telemetry outside dedicated specs

---

## Dependencies

- `@afx/shared` (message types, `AgentManager` contract)
- `@afx/agent-pi` (Pi RPC adapter — `createAgentManager()`)
- `@afx/agent-pi-sdk` (bundled API-provider runtime adapter)
- `@afx/transport` (VSCode transport adapter — used by webview, not host)
- `300-infra-pi` (existing Pi migration source until adapter retargeting completes)
- `350-agent-manager` (runtime abstraction and host manager behavior)
- `351-agent-pi` (Pi adapter, SDK, bootstrap behavior)

---

## Appendix

### Agent Entry Map (routing-only parent)

This is a parent spec. It owns app-level boundaries (entry point, file layout, build config, the
overall extension surface) and **does not** own per-zone functional requirements. The table below
routes incoming requests to the right child zone before reading any source file.

| Field           | Values                                                                                                                                                                                                                                                                                   |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Owned surface   | Extension entry point, agent factory, multiplex manager, status bar wiring; **routing only** for everything else                                                                                                                                                                         |
| Owned files     | `apps/vscode/src/extension.ts`, `apps/vscode/src/agent-factory.ts`, `apps/vscode/src/multiplex-agent-manager.ts`, `apps/vscode/src/agent-runtime-monitor.ts`, `apps/vscode/src/secret-store.ts`, `apps/vscode/src/session-dir.ts`, `apps/vscode/esbuild.mjs`, `apps/vscode/package.json` |
| Children        | `201-app-vscode-panels`, `202-app-vscode-editor-actions`, `203-app-vscode-see-navigation`, `204-app-vscode-spec-services`, `350-agent-manager`, `351-agent-pi`                                                                                                                           |
| Routing rules   | "panel/webview/HTML/CSP" -> 201; "right-click/code-action/save-to-notes/explain/review" -> 202; "@see/CodeLens/hover/definition/completion" -> 203; "spec data/sprint context/specs cache" -> 204; "AgentManager/multiplex/runtime status" -> 350; "Pi binary/RPC/JSONL/SDK" -> 351      |
| Catalogs        | `[DES-SETTINGS-CATALOG]`, `[DES-COMMAND-CATALOG]`, `[DES-KEYBINDING-CATALOG]` in `200-app-vscode/design.md` are the master indexes for every `afx.*` setting/command/keybinding                                                                                                          |
| Out of scope    | Functional requirements for any specific zone; those live in the child specs                                                                                                                                                                                                             |
| Example prompts | "Open AFX Chat command misbehaves" -> 201; "Add an editor right-click action" -> 202; "Why does CodeLens render here?" -> 203; "Spec scan misses a folder" -> 204                                                                                                                        |
