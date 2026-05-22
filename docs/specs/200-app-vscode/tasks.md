---
afx: true
type: TASKS
status: Living
owner: "@rixrix"
version: "1.3"
created_at: "2026-04-26T04:32:48.000Z"
updated_at: "2026-05-22T04:58:50.000Z"
tags: [app, vscode, extension, webview, commands, agent]
spec: spec.md
design: design.md
---

# apps/vscode — Implementation Tasks

---

## Phase 1 — Extension scaffold

- [x] Register commands: `afx.openSidebar`, `afx.openWorkbench`, `afx.showLogs`, `afx.agentSmokeTest`, `afx.agentRestart`
- [x] Sidebar webview provider — loads `apps/chat` dist output
- [x] Workbench webview provider — loads `apps/workbench` dist output
- [x] Webview HTML generator with CSP + nonce

## Phase 2 — AgentManager decoupling (ADR-0002)

- [x] Update `extension.ts`: read `afx.agentBinaryPath`, `afx.agentEphemeralSession`, workspace folder from VSCode config; inject into the agent factory; type `agentManager` as `AgentManager` from `@afx/shared`
- [x] Update `sidebar-panel.ts`: accept `agentManager: AgentManager` (was `piManager: PiManager`); replace `handlePiEvent`/`dispatchPiEvent` with `handleAgentEvent`/`dispatchAgentEvent` over `AgentEvent` union; remove Pi-specific parsing
- [x] Remove `piManager.request(...)` call sites; replace with `agentManager.send()`, `.abort()`, `.newSession()`, `.getStatus()`
- [x] Update `package.json`: add `@afx/agent-pi: workspace:*`; remove `@mariozechner/pi-coding-agent` devDep
- [x] Bump spec to v1.1, add FR-6 and FR-7
- [x] Verify: `pnpm --filter "./apps/vscode" build` — esbuild succeeds, zero type errors
- [x] Review fixes: restore `chat/usage`, handle extension UI prompts, and fail smoke test when the agent is not running
- [x] AFX cleanup: rename public command/config IDs to the `afx.agent*` surface
- [x] Multi-agent prep: add `agent-factory.ts` returning one Pi-backed `AgentInstance` today

## Phase 3 — Active File Context Toggle

- [x] Add `afx.context.includeActiveFileContext` with a default-on configuration contribution
- [x] Extend the host snapshot and composer/settings bridge with `chat/setIncludeActiveFileContext`
- [x] Attach the active editor file context to `chat/send`, `chat/steer`, and `chat/followUp` when enabled
- [x] Add unit coverage for the shared protocol, host attachment path, and UI mirroring
- [x] Run `pnpm verify` and `pnpm build`

## Phase 4 — Runtime Watchdog

- [x] Add `afx.runtime.responseStartTimeoutMs` with a 60s default and safe min/max
- [x] Use the clamped value for the sidebar first model response watchdog
- [x] Refresh the open settings snapshot when the timeout changes in VS Code settings
- [x] Keep slow first-response timeouts warning-only so active turns can continue
- [x] Treat nonfatal stderr as diagnostics while preserving fatal stderr turn failures
- [x] Add host unit coverage for timeout defaults, clamping, cancellation, stderr, and retry-toast rate limiting

---

## Work Sessions

<!-- IMPORTANT: This section MUST remain the LAST section in tasks.md. Do not add content below it. -->

| Date                     | Task                                         | Action    | Files Modified                                                                                                                                                    | Agent | Human |
| ------------------------ | -------------------------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| 2026-04-26               | Phase 1 — scaffold                           | Completed | docs/specs/200-app-vscode/ (scaffolded)                                                                                                                           | [x]   | [x]   |
| 2026-04-26               | Phase 2 — AgentManager decoupling (ADR-0002) | Completed | apps/vscode/src/extension.ts, apps/vscode/src/panels/sidebar-panel.ts, apps/vscode/package.json, spec.md (v1.1 FR-6/FR-7)                                         | [x]   | [x]   |
| 2026-04-26               | Review fixes                                 | Completed | apps/vscode/src/extension.ts, apps/vscode/src/panels/sidebar-panel.ts, apps/vscode/**tests**/extension.spec.ts                                                    | [x]   | [x]   |
| 2026-04-26               | AFX command/config cleanup                   | Completed | apps/vscode/package.json, apps/vscode/src/extension.ts, apps/vscode/**tests**/extension.spec.ts, apps/vscode-e2e/src/extension.test.ts                            | [x]   | [x]   |
| 2026-04-26               | Multi-agent prep                             | Completed | apps/vscode/src/agent-factory.ts, apps/vscode/src/extension.ts, apps/vscode/**tests**/agent-factory.spec.ts                                                       | [x]   | [x]   |
| 2026-04-27T07:22:14.000Z | Preserve early tool activity                 | Completed | apps/vscode/src/panels/sidebar-panel.ts, apps/vscode/src/panels/sidebar-panel.test.ts                                                                             | [x]   | [x]   |
| 2026-05-05T11:53:21.000Z | Active file context toggle                   | Coded     | apps/vscode/package.json, apps/vscode/src/panels/sidebar-panel.ts, apps/vscode/src/panels/sidebar-panel.test.ts, docs/specs/200-app-vscode/design.md              | [x]   | [x]   |
| 2026-05-05T12:03:56.000Z | Active file context toggle                   | Completed | apps/vscode/package.json, apps/vscode/src/panels/sidebar-panel.ts, apps/vscode/src/panels/sidebar-panel.test.ts, docs/specs/200-app-vscode/design.md              | [x]   | [x]   |
| 2026-05-21T21:22:08.000Z | Runtime first model response watchdog        | Coded     | apps/vscode/package.json, apps/vscode/src/panels/sidebar-panel.ts, apps/vscode/src/panels/sidebar-panel.test.ts, docs/specs/200-app-vscode/{spec,design,tasks}.md | [x]   | [ ]   |
| 2026-05-21T22:05:40.000Z | Runtime timeout setting copy                 | Copy      | apps/vscode/package.json, docs/specs/200-app-vscode/{spec,design,tasks}.md                                                                                        | [x]   | [ ]   |
| 2026-05-22T04:32:30.000Z | Runtime timeout settings refresh             | Coded     | apps/vscode/src/extension.ts, apps/vscode/src/extension.test.ts, docs/specs/200-app-vscode/tasks.md                                                               | [x]   | [ ]   |
| 2026-05-22T04:58:50.000Z | Runtime slow-start warning                   | Coded     | apps/vscode/src/panels/sidebar-panel.ts, apps/vscode/src/panels/sidebar-panel.test.ts, apps/vscode/package.json, docs/specs/200-app-vscode/{spec,design,tasks}.md | [x]   | [ ]   |
