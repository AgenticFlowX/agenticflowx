---
afx: true
type: SPEC
status: Approved
owner: "@rixrix"
version: "1.2"
created_at: "2026-04-26T04:32:48.000Z"
updated_at: "2026-05-02T00:08:26.000Z"
tags: [app, vscode, extension, webview, commands, agent]
depends_on: [100-package-shared, 110-package-transport, 300-infra-pi]
---

# apps/vscode — Product Specification

## References

- **ADR**: [ADR-0001 Pi Engine Integration](../../adr/ADR-0001-pi-engine-integration.md)
- **Architecture**: [AGENTS.md — apps/vscode](../../../AGENTS.md)

---

## Problem Statement

The VSCode extension is the host process that registers commands, manages webview panels, and bridges the chat UI to the configured coding agent. It must integrate with the VSCode API while keeping engine and UI code in their respective packages.

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

| ID   | Requirement                                                                                                                                                                                                                        | Priority    |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| FR-1 | Extension activates lazily via VSCode view contributions (sidebar/workbench panels) and registers all commands during `activate()`; `activationEvents` may stay empty since the panel views themselves are activation events       | Must Have   |
| FR-2 | Sidebar webview provider loads `apps/chat` dist output                                                                                                                                                                             | Must Have   |
| FR-3 | Workbench webview provider loads `apps/workbench` dist output                                                                                                                                                                      | Must Have   |
| FR-4 | Commands: `afx.openSidebar`, `afx.openWorkbench`, `afx.showLogs`, `afx.agentSmokeTest`, `afx.agentRestart`                                                                                                                         | Must Have   |
| FR-5 | Webview HTML generator loads compiled Vite dist with correct CSP and nonce                                                                                                                                                         | Must Have   |
| FR-6 | `extension.ts` reads `afx.agentBinaryPath`, `afx.agentEphemeralSession`, and workspace folder from VSCode settings and injects them into `agent-factory.ts`; the active `AgentManager` is disposed on deactivation                 | Must Have   |
| FR-7 | `sidebar-panel.ts` depends on `AgentManager` from `@afx/shared` — not on `PiManager` or any adapter-specific type; it handles normalized agent events, usage stats, and extension UI requests without referencing Pi-native shapes | Must Have   |
| FR-8 | `agent-factory.ts` models configured coding agents as `AgentInstance[]`; AFX can return Pi CLI and API-provider runtimes while keeping webview panels runtime-agnostic                                                             | Should Have |

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

---

## Non-Goals

- No React or UI code in this app
- No engine implementation — Pi RPC is in `300-infra-pi`
- No additional cloud/auth/telemetry outside dedicated specs

---

## Dependencies

- `@afx/shared` (message types, `AgentManager` contract)
- `@afx/agent-pi` (Pi RPC adapter — `createAgentManager()`)
- `@afx/agent-pi-sdk` (bundled API-provider runtime adapter)
- `@afx/transport` (VSCode transport adapter — used by webview, not host)
- `300-infra-pi` (Pi lifecycle management)
