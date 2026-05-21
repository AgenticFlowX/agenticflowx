---
afx: true
type: SPEC
status: Living
owner: "@rixrix"
version: "1.2"
created_at: "2026-05-03T07:46:18.000Z"
updated_at: "2026-05-21T08:53:29.000Z"
approved_at: "2026-05-05T15:15:37.000Z"
tags: ["app", "vscode", "panels", "webview", "host", "mode", "workspace-mode", "composer", "intent"]
depends_on: ["100-package-shared", "110-package-transport", "200-app-vscode"]
---

# App VSCode Panels - Product Specification

## References

- **Parent Spec**: [App VSCode](../200-app-vscode/spec.md)

---

## Problem Statement

The extension host registers two webview panels (sidebar chat, bottom workbench) plus the
HTML shell that bootstraps each one. Today this lives inside the broad `200-app-vscode` parent
spec, which makes "change panel registration", "fix CSP nonce", or "adjust webview boot" route
through unrelated host concerns. Panel work is its own surgical area.

---

## User Stories

### Primary Users

Extension engineers, AFX agents updating webview boot, and reviewers verifying CSP / asset
loading behavior.

### Stories

**As a** developer
**I want** one spec for sidebar/workbench panel registration and the webview HTML shell
**So that** "open AFX Chat", "open AFX Workbench", and "fix CSP" route here, not into a 1700-line file

**As an** AFX agent
**I want** an explicit panel boot sequence
**So that** changes to the appearance class, CSP nonce, or transport handshake have a known order

---

## Requirements

### Functional Requirements

| ID    | Requirement                                                                                                                                                                                                                                                                                   | Priority  |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| FR-1  | Register the sidebar webview view (`afx-sidebar`) under the AFX activity-bar container; expose `afx.openSidebar` command                                                                                                                                                                      | Must Have |
| FR-2  | Register the workbench webview view (`afx-workbench`) under the bottom panel container; expose `afx.openWorkbench` command                                                                                                                                                                    | Must Have |
| FR-3  | Generate webview HTML with CSP nonce, restricted `localResourceRoots`, asset URI rewriting, and appearance class injection                                                                                                                                                                    | Must Have |
| FR-4  | Panel lifecycle: handle resolveWebviewView, onDidReceiveMessage, onDidChangeViewState, dispose                                                                                                                                                                                                | Must Have |
| FR-5  | Boot sequence: webview HTML applies appearance class before scripts execute; chat sends `chat/ready` to start runtime monitor; workbench sends `afxReady` to start data                                                                                                                       | Must Have |
| FR-6  | Webviews must not access fs/process/VSCode APIs directly; they use only `acquireVsCodeApi` plus the transport bridge                                                                                                                                                                          | Must Have |
| FR-7  | The sidebar panel acts as the message dispatcher for the chat webview (`dispatchInbound` switch)                                                                                                                                                                                              | Must Have |
| FR-8  | The workbench panel acts as the message dispatcher for the workbench webview                                                                                                                                                                                                                  | Must Have |
| FR-9  | The sidebar panel includes `mode.active` in the settings snapshot and routes `chat/setMode` requests to the host `afx.setMode` command                                                                                                                                                        | Must Have |
| FR-10 | In Explore, prefix outbound turns with a read-only prompt: file/folder/source/web/simple shell inspection is allowed; mutation is blocked                                                                                                                                                     | Must Have |
| FR-11 | In Explore, `chat/runCommand` may spawn only allowlisted read-only shell commands; mutating commands emit `agent/actionBlocked` before spawn                                                                                                                                                  | Must Have |
| FR-12 | When workspace mode is Spec, the sidebar dispatcher prepends a planning-only guardrail prompt to outbound agent messages and emits a transient exit-prompt when the user leaves Spec mode for another mode                                                                                    | Must Have |
| FR-13 | The sidebar dispatcher reads optional `intentSlot` from `chat/send`, `chat/steer`, and `chat/followUp`, resolves the parent-aware Composer Intent prefix, and composes it after any reset prompt and parent-mode guardrail. Slot 1 is zero-injection and Spec mode suppresses Intent entirely | Must Have |
| FR-14 | In Explore, runtime tool events may render only for read-only inspection; write/edit/git/build/test/install/mutation output is suppressed                                                                                                                                                     | Must Have |

### Non-Functional Requirements

| ID    | Requirement                                                         | Target                                                                                                         |
| ----- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| NFR-1 | CSP must allow only nonce-tagged inline scripts and trusted origins | No inline-script-src '\*'; nonces are regenerated per-load                                                     |
| NFR-2 | Local resource roots restrict the webview to extension-owned assets | Includes `apps/{chat,workbench}/dist`, `packages/ui/src/tokens`, optional theme assets                         |
| NFR-3 | First paint is appearance-correct                                   | Appearance DOM class applied in HTML head before any script tag executes (no FOUC)                             |
| NFR-4 | Webview lifecycle disposes cleanly                                  | Listeners and timers dispose in `onDidDispose`; runtime monitor is started lazily on `chat/ready`              |
| NFR-5 | Inbound dispatcher is type-exhaustive                               | `dispatchInbound`'s `switch` ends with `const _never: never = msg;` to enforce exhaustiveness on `ChatToAgent` |

---

## Acceptance Criteria

- [ ] `afx.openSidebar` activates the AFX sidebar view and focuses chat
- [ ] `afx.openWorkbench` activates the bottom workbench panel
- [ ] Webview HTML loads compiled `dist/index.html` with CSP nonce + asset URIs rewritten to `vscode-resource:` form
- [ ] Theme switch (chat settings) does not cause FOUC on next webview boot
- [ ] Architecture lints (`no-pi-imports.test.ts`) confirm webview code never imports vscode/fs/process
- [ ] `dispatchInbound` exhaustively covers every `ChatToAgent` variant; new variants fail type-check until handled
- [ ] Workbench panel handles its inbound types and posts `afxUpdate` payloads back
- [ ] `chat/setMode` updates the effective mode preference and refreshes the settings snapshot
- [ ] Explore allows read-only inspection from prompts, runtime tools, and `!` commands; mutation paths produce `agent/actionBlocked` or a transcript error before output renders
- [ ] Composer Intent prefixes are applied once per outbound turn after parent guardrails; Default and Spec mode are zero-injection

---

## Non-Goals (Out of Scope)

- Chat or workbench feature UI behavior (those live in 210-219 / 220-228 zones)
- Agent runtime behavior (350/351)
- Editor right-click actions (202) or `@see` providers (203)

---

## Architecture Workflow

```text
Chat webview (browser or VSCode)
  ├─ chat/getSettingsSnapshot ───────► sidebar-panel.ts
  ├─ chat/setMode ───────────────────► afx.setMode (global default or workspace override)
  ├─ chat/send / chat/steer / chat/followUp
  │     └─ if mode = explore, prefix EXPLORE_GUARDRAIL_PROMPT
  │     └─ if mode = explore, allow read-only inspection tools and block mutations
  │     └─ if mode = spec, prefix SPEC_MODE_PROMPT and suppress Intent
  │     └─ if intentSlot != 1 and mode = code|explore, append Composer Intent prefix
  │     └─ otherwise forward unchanged
  └─ chat/runCommand
        ├─ if mode = explore and command is not allowlisted read-only, emit agent/actionBlocked
        └─ if mode = code, spawn a shell in the workspace root

Host bridge state
  ├─ reads effective afx.mode.active from VS Code configuration
  ├─ snapshots mode.active back to the webview
  └─ keeps the open settings snapshot in sync when the setting changes

Mock transport
  └─ mirrors chat/setMode into SettingsSnapshot so browser tests can flip between Code and Explore
```

---

## Explore Prompt

The host injects this exact prefix before `chat/send`, `chat/steer`, and `chat/followUp` while
workspace mode is `explore`:

```text
[AFX EXPLORE MODE: READ ONLY]

Read-only investigation policy:
- Runtime tools are allowed only for read-only inspection: read files, list folders, search source, read pages or websites, and run simple read-only shell commands for those actions.
- Do not edit, create, delete, rename, move, patch, save, upload, submit forms, run mutating shell/git/test/build/install commands, or change host/external state.
- Do not output commands or patches.
- If the next step needs a write, mutating shell command, test run, install, git operation, or other mutation, stop and say: "This requires Code mode."

Allowed:
- Explain, summarize, compare, trace behavior, cite files/symbols, identify risks, and propose safe next steps.
```

---

## Open Questions

None.

---

## Dependencies

- `100-package-shared` (`ChatToAgent`, `WorkbenchInbound`/`WorkbenchOutbound`, `RuntimeAppearanceSnapshot`)
- `110-package-transport` (webview transport adapter)
- `131-package-ui-design-system` (appearance bridge contract)
- `200-app-vscode` (extension entry point)
- `350-agent-manager` (sidebar dispatches into `AgentManager`)

---

## Appendix

### Agent Entry Map

| Field           | Values                                                                                                                                                                                         |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Owned surface   | Sidebar webview, workbench webview, webview HTML shell, panel lifecycle, inbound dispatch                                                                                                      |
| Owned files     | `apps/vscode/src/panels/sidebar-panel.ts`, `apps/vscode/src/panels/workbench-panel.ts`, `apps/vscode/src/panels/webview-html.ts`                                                               |
| Local anchors   | `createSidebarPanel`, `createWorkbenchPanel`, `loadWebviewHtml`, `dispatchInbound` (per-case `@see` to message-owning zones), `handleSend`/`handleAbort`/`handleNewSession` etc. host handlers |
| Bridge messages | All `ChatToAgent` and `WorkbenchInbound` variants (see message-owning zone for each variant)                                                                                                   |
| Settings keys   | None directly (`afx.theme`/`afx.style` consumed via host, owned by `131-package-ui-design-system`)                                                                                             |
| Commands        | `afx.openSidebar`, `afx.openWorkbench`                                                                                                                                                         |
| Tests           | `apps/vscode/src/panels/sidebar-panel.test.ts`, `apps/vscode/src/panels/no-pi-imports.test.ts`, `apps/vscode-e2e/src/extension.test.ts`                                                        |
| Dependencies    | `200-app-vscode`, `110-package-transport`, `100-package-shared`                                                                                                                                |
| Out of scope    | Chat/workbench feature UI behavior, agent runtime, editor providers                                                                                                                            |
| Example prompts | "Open AFX Chat command misbehaves", "CSP nonce regeneration", "Webview FOUC on boot", "Add a new inbound message handler", "Restrict additional localResourceRoots"                            |

### Glossary

| Term               | Definition                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------------ |
| Sidebar panel      | The chat webview hosted in the AFX activity bar via `WebviewViewProvider`                        |
| Workbench panel    | The bottom-panel webview hosting workbench tabs                                                  |
| Webview HTML shell | The HTML wrapper generated by `loadWebviewHtml`; injects CSP nonce, asset URIs, appearance class |
| Dispatcher         | The `dispatchInbound` switch routing typed messages to host handlers                             |
| Resource root      | A directory the webview is permitted to load assets from (`localResourceRoots` setting)          |
