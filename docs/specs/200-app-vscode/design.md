---
afx: true
type: DESIGN
status: Draft
owner: "@rixrix"
version: "1.1"
created_at: "2026-04-26T04:32:48.000Z"
updated_at: "2026-05-02T00:08:26.000Z"
tags: [app, vscode, extension, webview, commands, agent]
spec: spec.md
---

# apps/vscode — Technical Design

---

## [DES-OVR] Overview

`apps/vscode` is the extension host entry point. It registers commands, creates sidebar and workbench webview providers, builds configured coding-agent instances, and serves compiled webview builds via a HTML generator.

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

| Task | File                                        | Required @see                                           |
| ---- | ------------------------------------------- | ------------------------------------------------------- |
| —    | `apps/vscode/src/extension.ts`              | `spec.md [FR-1] [FR-4] [FR-6]` + `design.md [DES-ARCH]` |
| —    | `apps/vscode/src/agent-factory.ts`          | `spec.md [FR-6] [FR-8]` + `design.md [DES-ARCH]`        |
| —    | `apps/vscode/src/panels/sidebar-panel.ts`   | `spec.md [FR-2] [FR-7]` + `design.md [DES-ARCH]`        |
| —    | `apps/vscode/src/panels/workbench-panel.ts` | `spec.md [FR-3]` + `design.md [DES-ARCH]`               |
| —    | `apps/vscode/src/panels/webview-html.ts`    | `spec.md [FR-5]` + `design.md [DES-ARCH]`               |
