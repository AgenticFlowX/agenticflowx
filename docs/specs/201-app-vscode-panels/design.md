---
afx: true
type: DESIGN
status: Approved
owner: "@rixrix"
version: "1.2"
created_at: "2026-05-03T07:46:18.000Z"
updated_at: "2026-05-05T15:23:18.000Z"
tags:
  ["app", "vscode", "panels", "webview", "host", "mode", "workspace-mode", "prompt", "host-guard"]
spec: spec.md
---

# App VSCode Panels - Technical Design

---

## [DES-OVR] Overview

`apps/vscode/src/panels/` owns webview registration, the HTML shell, and inbound message
dispatch for both the sidebar (chat) and bottom (workbench) panels. The sidebar panel is the
busiest: its `dispatchInbound` is the host-side seam every chat-webview message flows through.
It also owns the workspace posture bridge (`afx.mode.active`), the strict Explore prompt prefix,
and the host guardrail that blocks shell commands before they can spawn.

---

## [DES-ARCH] Architecture

```text
extension.ts activate()
  ├─ vscode.window.registerWebviewViewProvider("afx-sidebar", createSidebarPanel(...))
  ├─ vscode.window.registerWebviewViewProvider("afx-workbench", createWorkbenchPanel(...))
  ├─ context.subscriptions.push(vscode.commands.registerCommand("afx.openSidebar", ...))
  └─ context.subscriptions.push(vscode.commands.registerCommand("afx.openWorkbench", ...))

createSidebarPanel
  ├─ resolveWebviewView({ webview })
  │     ├─ webview.options = { enableScripts, localResourceRoots }
  │     ├─ webview.html = loadWebviewHtml(context, webview, "chat")
  │     ├─ webview.onDidReceiveMessage(handleInbound -> dispatchInbound)
  │     └─ webview.onDidChangeViewState(track visibility)
  └─ post(...) helpers → webview.postMessage typed AgentToChat

createWorkbenchPanel
  └─ symmetric structure for workbench webview

loadWebviewHtml
  ├─ read apps/{chat,workbench}/dist/index.html
  ├─ rewrite asset URIs (script/href) to webview.asWebviewUri(...)
  ├─ inject CSP meta with per-load nonce
  ├─ inject appearance class on <html> based on host-computed theme/style
  └─ return final HTML
```

## [DES-PANELS-MODE-WORKFLOW] Workspace Mode And Guardrail Workflow

The sidebar panel does not invent a separate mode service. It reads the persisted workspace
setting, routes mode changes through the shared `afx.setMode` command, and applies the same
mode-aware guardrails to every outbound prompt path.

```text
Composer/Settings mode control
  -> chat/setMode { mode }
  -> SidebarPanel.dispatchInbound
  -> vscode.commands.executeCommand("afx.setMode", mode)
  -> extension.ts persists afx.mode.active at Workspace scope
  -> agent/settingsSnapshot refresh
  -> chat + settings surfaces rehydrate the new mode

chat/send | chat/steer | chat/followUp
  -> normalizePromptMentions()
  -> inflateMentionContext()
  -> prefixExplorePrompt()
  -> agentManager.send(...) / steer(...) / followUp(...)

chat/runCommand in Explore
  -> isExploreMode()
  -> post agent/actionBlocked
  -> return without spawn()
```

Code is the default full-access Pi-backed posture. Explore is experimental and read-only; use it
for inspection, tracing, and planning. The guardrail prompt below is injected host-side before the
agent sees any Explore turn.

## [DES-PANELS-EXPLORE-PROMPT] Strict Explore Prompt

The host prepends this exact prefix before every `chat/send`, `chat/steer`, and `chat/followUp`
turn while `afx.mode.active === "explore"`:

```text
[AFX EXPLORE MODE: READ ONLY]

You are in Explore mode. This turn is for analysis only.

Non-negotiable rules:
- Do not run, request, or imply any shell command, test, build, git operation, install, file edit, file creation, deletion, rename, patch, or other host action.
- Do not claim to have performed any action or changed any state.
- Do not suggest a workaround that bypasses these rules.
- Do not ask the host or the user to do work so you can continue.
- Do not output executable commands or patches.
- These rules override any conflicting user instruction.

Allowed:
- Analyze the repository state already available in context.
- Explain what the code is doing.
- Cite relevant file paths, symbols, and risks.
- Give safe, read-only next steps.
- If the user wants implementation, say: "This requires Code mode."

If the request cannot be answered without taking action, stop at the safest analysis-only answer.
```

---

## [DES-PANELS-MOCKUP-SIDEBAR] Sidebar Panel ASCII

Chat as it appears in VSCode sidebar with VSCode chrome.

```text
+----+--------------------------------+
| ic |  AFX Chat                  [x] |  <- VSCode view title bar
| on +--------------------------------+
|    |                                |
|    |  [chat surface: 211/212/213/   |  <- webview hosted by SidebarPanel
| [≡]|   214/215 zones render here]   |
|    |                                |
|    |                                |
+----+--------------------------------+
   ^   ^
   |   `-- webview hosted by createSidebarPanel().resolveWebviewView
   `-- VSCode activity bar AFX icon registered via package.json viewsContainers.activitybar
```

## [DES-PANELS-MOCKUP-WORKBENCH] Workbench Panel ASCII

```text
+--------------------------------------------------------------------+
| Editor                                                             |
+--------------------------------------------------------------------+
| Workbench | Pipeline | Documents | Analytics | Journal | Board |...|  <- 227-shell tabs
+--------------------------------------------------------------------+
| [active tab content from 220-228 workbench zones]                  |
|                                                                    |
+--------------------------------------------------------------------+
| Status bar                                                         |
+--------------------------------------------------------------------+
   ^
   `-- webview hosted by createWorkbenchPanel().resolveWebviewView
       227 owns tab routing inside the webview
```

## [DES-PANELS-LIFECYCLE] Panel Lifecycle

```text
activate()
   |
   v
registerWebviewViewProvider()
   |
   | (user clicks AFX icon)
   v
resolveWebviewView({ webview })
   |
   +-- options = { enableScripts: true, localResourceRoots: [...] }
   +-- html = loadWebviewHtml(...)
   +-- onDidReceiveMessage(handleInbound)
   +-- onDidChangeViewState(track focus/visibility)
   |
   v
[webview iframe loads]
   |
   v
apps/chat/src/index.tsx mounts -> createVscodeTransport.acquireVsCodeApi()
   |
   v
Webview posts "chat/ready"
   |
   v
SidebarPanel.dispatchInbound case "chat/ready":
   +-- markChatReady()
   +-- runtimeMonitor.start()
   +-- postSnapshot()
   +-- broadcastRuntimeSettings()
   |
   v
[webview state hydrates]
   |
   | (later, on dispose)
   v
onDidDispose -> stop runtimeMonitor, dispose listeners
```

## [DES-PANELS-WEBVIEW-HTML] HTML Shell Contract

`loadWebviewHtml(context, webview, app)` returns a string built from `apps/{app}/dist/index.html`.

| Step | Transformation                                                                 |
| ---- | ------------------------------------------------------------------------------ |
| 1    | Read `dist/index.html` from extension resources                                |
| 2    | Replace `src=` and `href=` URIs with `webview.asWebviewUri(...)` results       |
| 3    | Inject `<meta http-equiv="Content-Security-Policy">` with per-load `nonce-XXX` |
| 4    | Add `nonce` attributes to all script tags (inline + external)                  |
| 5    | Compute appearance class via `getAppearanceClass(...)` and set on `<html>`     |
| 6    | Return final HTML to assign to `webview.html`                                  |

CSP shape:

```text
default-src 'none';
img-src ${webview.cspSource} https: data:;
style-src ${webview.cspSource} 'unsafe-inline';
font-src ${webview.cspSource};
script-src 'nonce-${nonce}';
connect-src https://www.clarity.ms https://*.clarity.ms;
```

`connect-src` is widened only for the Clarity telemetry origins documented in `901-cross-telemetry`.

## [DES-PANELS-DISPATCH] Inbound Dispatch Contract

`dispatchInbound(msg: ChatToAgent)` is a type-exhaustive switch. Each `case` carries an inline
`@see` to the design anchor of the message-owning zone. The `default: const _never: never = msg;`
clause makes it impossible to add a `ChatToAgent` variant without updating the dispatcher (NFR-5).

The full per-case anchor table is the source of truth in `apps/vscode/src/panels/sidebar-panel.ts`
itself; this design lists only the routing rule:

> Each new `ChatToAgent` variant arrives with its design anchor in `messages.ts`. The dispatcher
> case must point at the same anchor. If they disagree, the message-side anchor wins; update the
> dispatcher comment to match.

Mode-aware routing shares the same rule: `chat/setMode` routes to the shared `afx.setMode`
command, `chat/send` / `chat/steer` / `chat/followUp` are prefixed in Explore before they reach the
agent runtime, and `chat/runCommand` in Explore emits `agent/actionBlocked` instead of spawning a
shell process.

---

## [DES-PANELS-COMMAND-OPEN-SIDEBAR] `afx.openSidebar` Command

| Aspect     | Value                                                                                                  |
| ---------- | ------------------------------------------------------------------------------------------------------ |
| Registered | `apps/vscode/src/extension.ts`                                                                         |
| Title      | `AgenticFlowX: Open Sidebar`                                                                           |
| Keybinding | `Ctrl/Cmd+Alt+A` (when `editorTextFocus`)                                                              |
| Behavior   | Focuses the AFX sidebar view (`afx-sidebar`) via `vscode.commands.executeCommand("afx-sidebar.focus")` |
| Surfaces   | Command palette, keybinding                                                                            |

## [DES-PANELS-COMMAND-OPEN-WORKBENCH] `afx.openWorkbench` Command

| Aspect     | Value                                                                                                          |
| ---------- | -------------------------------------------------------------------------------------------------------------- |
| Registered | `apps/vscode/src/extension.ts`                                                                                 |
| Title      | `AgenticFlowX: Open Workbench`                                                                                 |
| Keybinding | None                                                                                                           |
| Behavior   | Opens the bottom panel and focuses the workbench view (`workbench.action.togglePanel` + `afx-workbench.focus`) |
| Surfaces   | Command palette                                                                                                |

---

## [DES-DEC] Key Decisions

| Decision           | Options Considered                             | Choice                            | Rationale                                                                |
| ------------------ | ---------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------ |
| Panel scope split  | Live in `200-app-vscode`, dedicated child      | Dedicated child (`201`)           | Webview registration + dispatch is a surgical surface                    |
| HTML shell source  | Custom HTML, transform built `dist/index.html` | Transform built `dist/index.html` | Vite produces hash-busted asset names; rewriting beats hand-writing HTML |
| Dispatcher style   | Object map, switch                             | `switch` with exhaustive `never`  | TypeScript catches new variants at compile time                          |
| Lazy runtime start | Start at activation, on `chat/ready`           | On `chat/ready`                   | Avoids spinning up Pi subprocess for users who never open the sidebar    |

---

## [DES-DATA] Data Model

The panel layer carries no domain state. Local state is restricted to:

- `state` snapshot (kept in sync with webview via `chat/state`).
- `isChatReady` flag (gates broadcasts until first `chat/ready`).
- View visibility flag (set by `onDidChangeViewState`).

---

## [DES-API] API Contracts

```typescript
export function createSidebarPanel(deps: SidebarPanelDeps): SidebarPanelProvider;
export function createWorkbenchPanel(deps: WorkbenchPanelDeps): vscode.WebviewViewProvider;
export function loadWebviewHtml(
  context: vscode.ExtensionContext,
  webview: vscode.Webview,
  app: "chat" | "workbench",
): string;
```

`SidebarPanelDeps` includes `agentManager`, `runtimeMonitor`, `secretStore`, `logger`, plus the
notes-utils and telemetry helpers.

The panel keeps only a small amount of local state:

- `workspaceMode()` reads `afx.mode.active` from workspace configuration and normalizes it to the
  `WorkspaceMode` union.
- `prefixExplorePrompt()` applies the strict guardrail prompt above only when `workspaceMode() ===
"explore"`.
- `BlockedActionView` is an ephemeral host-only shape used to tell the webview that a command was
  rejected in Explore.

---

## [DES-FILES] File Structure

| File                                        | Purpose                                                    |
| ------------------------------------------- | ---------------------------------------------------------- |
| `apps/vscode/src/panels/sidebar-panel.ts`   | Chat webview provider + inbound dispatcher                 |
| `apps/vscode/src/panels/workbench-panel.ts` | Workbench webview provider + workbench inbound dispatcher  |
| `apps/vscode/src/panels/webview-html.ts`    | HTML generator with CSP nonce + appearance class injection |

---

## [DES-DEPS] Dependencies

| Dependency                        | Purpose                                           |
| --------------------------------- | ------------------------------------------------- |
| `@types/vscode`                   | VSCode API for webview registration               |
| `@afx/shared`                     | `ChatToAgent`, `AgentToChat` typed protocol       |
| `@afx/transport` (vscode adapter) | Webview-side transport (used inside the webview)  |
| `131-package-ui-design-system`    | Appearance class contract for `loadWebviewHtml`   |
| `350-agent-manager`               | `agentManager.send/abort/...` invoked by handlers |

---

## [DES-SEC] Security Considerations

- CSP nonce regenerated per `resolveWebviewView` call.
- `localResourceRoots` is the smallest set that allows `dist/` and `tokens/` loads.
- `appearance/update` payloads validate against `AFX_THEME_IDS` / `AFX_STYLE_IDS` before applying.

---

## [DES-ERR] Error Handling

| Scenario                     | Handling                                                                          |
| ---------------------------- | --------------------------------------------------------------------------------- |
| Inbound handler throws       | `handleInbound` catches, logs via `inboundLog.error`, posts `chat/error` toast    |
| Webview dist missing         | `loadWebviewHtml` throws; extension logs and surface stays blank with diagnostic  |
| `chat/ready` never received  | Runtime monitor stays stopped; safe — no agent process spawned                    |
| Unknown inbound message type | `default` clause logs `unknown inbound`; type-checker prevents this in production |

---

## [DES-TEST] Testing Strategy

- `apps/vscode/src/panels/sidebar-panel.test.ts` — dispatch behavior with stub `AgentManager`
- `apps/vscode/src/panels/no-pi-imports.test.ts` — architecture lint (no Pi adapter inside dispatcher)
- `apps/vscode-e2e/src/extension.test.ts` — extension activation + provider registration

---

## [DES-ROLLOUT] Migration / Rollout Plan

1. Move panel-related FRs and DES nodes from `200-app-vscode` into this spec.
2. Retarget panel-file `@see` headers to point at `201-app-vscode-panels`.
3. Run `pnpm verify` and `/afx-check trace apps/vscode/src/panels`.

### Rollback Plan

If the panel split adds friction without improving routing, fold content back into
`200-app-vscode` and remove the 201 folder. No source code changes required.

---

## [DES-PANELS-LOC] Code Locator Map

| Map ID                           | Code anchor                                                                                | Messages/settings/commands                       | Tests                                          |
| -------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------ | ---------------------------------------------- |
| `[Panels.Sidebar.Provider]`      | `apps/vscode/src/panels/sidebar-panel.ts` `createSidebarPanel`                             | All `ChatToAgent` cases                          | `apps/vscode/src/panels/sidebar-panel.test.ts` |
| `[Panels.Sidebar.Dispatcher]`    | `dispatchInbound` switch                                                                   | Per-case anchors documented inline               | `apps/vscode/src/panels/sidebar-panel.test.ts` |
| `[Panels.Workbench.Provider]`    | `apps/vscode/src/panels/workbench-panel.ts` `createWorkbenchPanel`                         | All `WorkbenchInbound`/`WorkbenchOutbound` cases | future workbench-panel tests                   |
| `[Panels.Html.Shell]`            | `apps/vscode/src/panels/webview-html.ts` `loadWebviewHtml`                                 | `appearance/update`, `agent/appearanceUpdated`   | future webview HTML smoke tests                |
| `[Panels.Command.OpenSidebar]`   | `apps/vscode/src/extension.ts` `vscode.commands.registerCommand("afx.openSidebar", ...)`   | `afx.openSidebar`                                | `apps/vscode-e2e/src/extension.test.ts`        |
| `[Panels.Command.OpenWorkbench]` | `apps/vscode/src/extension.ts` `vscode.commands.registerCommand("afx.openWorkbench", ...)` | `afx.openWorkbench`                              | `apps/vscode-e2e/src/extension.test.ts`        |

---

## [DES-PANELS-TRACE] Functional Trace Matrix

| Requirement | Design nodes                                                    | Code anchors                                                | Verification                    |
| ----------- | --------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------- |
| FR-1        | `[DES-PANELS-COMMAND-OPEN-SIDEBAR]`, `[DES-PANELS-LIFECYCLE]`   | `createSidebarPanel`, `afx.openSidebar` registration        | e2e activation test             |
| FR-2        | `[DES-PANELS-COMMAND-OPEN-WORKBENCH]`, `[DES-PANELS-LIFECYCLE]` | `createWorkbenchPanel`, `afx.openWorkbench` registration    | e2e activation test             |
| FR-3        | `[DES-PANELS-WEBVIEW-HTML]`                                     | `loadWebviewHtml`, CSP nonce + asset rewrite                | manual + future HTML smoke test |
| FR-4        | `[DES-PANELS-LIFECYCLE]`                                        | `resolveWebviewView`, `onDidReceiveMessage`, `onDidDispose` | sidebar-panel.test.ts           |
| FR-5        | `[DES-PANELS-LIFECYCLE]`                                        | `dispatchInbound case "chat/ready"`                         | sidebar-panel.test.ts           |
| FR-6        | `[DES-SEC]`                                                     | webview-side architecture lint (`no-pi-imports.test.ts`)    | architecture lint test          |
| FR-7        | `[DES-PANELS-DISPATCH]`                                         | `dispatchInbound` switch in sidebar-panel.ts                | sidebar-panel.test.ts           |
| FR-8        | `[DES-PANELS-DISPATCH]`                                         | `handleMessage` in workbench-panel.ts                       | future workbench-panel tests    |
| FR-9        | `[DES-PANELS-MODE-WORKFLOW]`, `[DES-PANELS-EXPLORE-PROMPT]`     | `chat/setMode`, `workspaceMode()`, `prefixExplorePrompt()`  | sidebar-panel.test.ts           |
| FR-10       | `[DES-PANELS-MODE-WORKFLOW]`, `[DES-PANELS-EXPLORE-PROMPT]`     | `chat/send`, `chat/steer`, `chat/followUp` guardrail prefix | sidebar-panel.test.ts           |
| FR-11       | `[DES-PANELS-MODE-WORKFLOW]`                                    | `handleRunCommand`, `agent/actionBlocked`                   | sidebar-panel.test.ts           |
| NFR-1       | `[DES-PANELS-WEBVIEW-HTML]`                                     | nonce regeneration in `loadWebviewHtml`                     | manual review                   |
| NFR-3       | `[DES-PANELS-WEBVIEW-HTML]`                                     | appearance class injected in HTML head                      | visual smoke (no FOUC)          |
| NFR-5       | `[DES-PANELS-DISPATCH]`                                         | `default: const _never: never = msg;`                       | TypeScript exhaustive check     |

---

## [DES-PANELS-REFS] File Reference Map

| File                                        | Required @see                                                                                                                                                    |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/vscode/src/panels/sidebar-panel.ts`   | `spec.md [FR-1] [FR-7] [FR-9] [FR-10] [FR-11]` + `design.md [DES-PANELS-LIFECYCLE] [DES-PANELS-DISPATCH] [DES-PANELS-MODE-WORKFLOW] [DES-PANELS-EXPLORE-PROMPT]` |
| `apps/vscode/src/panels/workbench-panel.ts` | `spec.md [FR-2] [FR-8]` + `design.md [DES-PANELS-LIFECYCLE] [DES-PANELS-DISPATCH]`                                                                               |
| `apps/vscode/src/panels/webview-html.ts`    | `spec.md [FR-3] [FR-5]` + `design.md [DES-PANELS-WEBVIEW-HTML]` + `131-package-ui-design-system [DES-APPEARANCE-BRIDGE]`                                         |
| `apps/vscode/src/extension.ts`              | `spec.md [FR-9] [FR-12]` + `design.md [DES-COMMAND-SET-MODE]`                                                                                                    |

---

## [DES-PANELS-QUESTIONS] Open Technical Questions

None.
