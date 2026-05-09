---
afx: true
type: SPEC
status: Approved
owner: "@rixrix"
version: "1.0"
created_at: "2026-05-02T23:56:50.000Z"
updated_at: "2026-05-09T12:21:59.000Z"
tags: ["agent", "runtime", "manager"]
depends_on: ["100-package-shared", "200-app-vscode"]
---

# Agent Manager - Product Specification

## References

- **Pi Adapter**: [Agent Pi](../351-agent-pi/spec.md)

---

## Problem Statement

Agent runtime selection, status monitoring, multiplexing, provider/model contracts, and factory wiring are spread across shared types and the VSCode host. This spec owns the runtime abstraction so Pi-specific behavior does not get mixed with generic agent management.

---

## User Stories

### Primary Users

Developers adding runtimes/providers and agents changing runtime readiness behavior.

### Stories

**As a** developer
**I want** one runtime manager contract
**So that** adapters can be swapped or multiplexed without app code importing adapter internals

**As an** AI agent
**I want** runtime status and provider selection mapped to a spec
**So that** readiness/configuration changes avoid Pi-specific source reads unless needed

---

## Requirements

### Functional Requirements

| ID   | Requirement                                                                                                                | Priority  |
| ---- | -------------------------------------------------------------------------------------------------------------------------- | --------- |
| FR-1 | Own the `AgentManager` contract, runtime status model, provider/model catalog integration, and runtime readiness semantics | Must Have |
| FR-2 | Own VSCode host runtime factory, multiplex manager, and runtime monitor behavior                                           | Must Have |
| FR-3 | Keep adapter-specific RPC/bootstrap behavior in adapter child specs such as `351-agent-pi`                                 | Must Have |
| FR-4 | Keep webview settings/composer presentation in app child specs while providing shared runtime payloads                     | Must Have |

### Non-Functional Requirements

| ID    | Requirement                     | Target                                                                      |
| ----- | ------------------------------- | --------------------------------------------------------------------------- |
| NFR-1 | Adapter boundaries remain clean | VSCode host imports only shared contracts and adapter factories             |
| NFR-2 | Runtime readiness is observable | Webviews can display configuration/readiness without importing adapter code |

---

## Acceptance Criteria

### Runtime Abstraction

- [ ] Shared agent contracts and VSCode runtime manager files route here
- [ ] Pi adapter files route to `351-agent-pi`
- [ ] Webview settings/composer UI depends on this spec for runtime semantics only

---

## Non-Goals (Out of Scope)

- Pi JSONL/RPC implementation
- Chat settings layout
- Storybook/design-system behavior

---

## Open Questions

None.

---

## Dependencies

- `100-package-shared`
- `200-app-vscode`
- `351-agent-pi`

---

## Appendix

### Agent Entry Map

| Field           | Values                                                                                                                                                                                                  |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Owned surface   | Agent runtime abstraction, status, multiplex manager, factory, monitor                                                                                                                                  |
| Owned files     | `packages/shared/src/agent.ts`, `packages/shared/src/provider-catalog.ts`, `apps/vscode/src/agent-factory.ts`, `apps/vscode/src/multiplex-agent-manager.ts`, `apps/vscode/src/agent-runtime-monitor.ts` |
| Local anchors   | `AgentManager`, runtime status derivation, provider catalog entries, multiplex manager methods, runtime monitor interface/factory                                                                       |
| Bridge messages | Runtime status, provider/model catalog, settings/runtime snapshots                                                                                                                                      |
| Settings keys   | Runtime/provider/model/log settings that influence manager selection                                                                                                                                    |
| Commands        | Runtime start/stop/status/configuration commands if introduced                                                                                                                                          |
| Tests           | Shared agent status tests, multiplex manager tests, runtime monitor tests                                                                                                                               |
| Dependencies    | `351-agent-pi`, `214-app-chat-settings`, `211-app-chat-composer`                                                                                                                                        |
| Out of scope    | Pi RPC framing, SDK bundling, webview layout                                                                                                                                                            |
| Example prompts | "Change runtime readiness", "Add provider selection behavior", "Update multiplex manager fallback"                                                                                                      |

### Glossary

| Term          | Definition                                                                      |
| ------------- | ------------------------------------------------------------------------------- |
| Agent manager | Runtime-agnostic interface used by host/app code to interact with coding agents |
