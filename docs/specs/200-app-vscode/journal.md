---
afx: true
type: JOURNAL
status: Living
tags: [app, vscode, extension, webview, commands, agent]
---

# apps/vscode — Journal

## Discussion: AgentManager decoupling (2026-04-26T08:15:14.000Z)

### Context

`sidebar-panel.ts` was importing `PiManager` directly and handling raw `PiEvent` shapes. Any future runtime swap would require modifying the panel — the wrong abstraction boundary. Separately, `extension.ts` was expected to call the agent factory after the extraction to `packages/agent/pi/`, but it needed to read VSCode config and inject values rather than letting the adapter read config itself.

### Decision

- `SidebarPanelDeps.agentManager` typed as `AgentManager` from `@afx/shared` (was `piManager: PiManager`).
- `extension.ts` reads `afx.agentBinaryPath`, `afx.agentEphemeralSession`, and `workspaceFolders[0]` from VSCode config and injects them into the agent factory.
- `handlePiEvent`/`dispatchPiEvent` replaced with `handleAgentEvent`/`dispatchAgentEvent` over the `AgentEvent` union — Pi-specific parsing is gone from the panel entirely.
- Usage stats stay available through `AgentManager.getUsage()`; the panel does not use a raw Pi `request()` escape hatch.
- Pi extension UI requests are handled as normalized `ui_request` events and answered through `AgentManager.respondToUiRequest()`.
- `agent-factory.ts` owns the configured agent-instance list. In AFX it returns one Pi-backed instance; future multi-agent work can add more instances without changing the sidebar `AgentManager` boundary.

### Links

- FR-6 and FR-7 added to `spec.md` (v1.1)
- Related: ADR-0002, `300-infra-pi` Phase 3, `100-package-shared` FR-6

---

## Implementation complete (2026-04-26T11:35:05.000Z)

Phase 2 tasks shipped. `extension.ts` and `sidebar-panel.ts` updated. Extension builds cleanly via esbuild. `pnpm --filter "apps/vscode" build` passes.
