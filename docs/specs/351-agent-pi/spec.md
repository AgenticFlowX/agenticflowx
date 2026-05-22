---
afx: true
type: SPEC
status: Living
owner: "@rixrix"
version: "1.1"
created_at: "2026-05-02T23:56:50.000Z"
updated_at: "2026-05-22T08:05:29.000Z"
tags: ["agent", "pi", "rpc", "sdk", "custom-providers"]
depends_on: ["100-package-shared", "300-infra-pi", "350-agent-manager"]
---

# Agent Pi - Product Specification

## References

- **Previous Parent**: [Infra Pi](../300-infra-pi/spec.md)
- **Agent Manager**: [Agent Manager](../350-agent-manager/spec.md)

---

## Problem Statement

Pi-specific RPC, JSONL framing, SDK bootstrap, skills sync, auth/config injection, and subprocess lifecycle need a spec separate from generic agent management. This prevents `300-infra-pi` and `350-agent-manager` from splitting Pi behavior inconsistently.

---

## User Stories

### Primary Users

Developers maintaining the Pi adapter and host runtime integration.

### Stories

**As a** developer
**I want** Pi RPC and SDK bootstrap to have one source of truth
**So that** Windows/macOS/Linux adapter work can be changed safely

**As an** AI agent
**I want** Pi-specific files separated from runtime manager files
**So that** adapter changes do not require broad runtime abstraction edits

---

## Requirements

### Functional Requirements

| ID   | Requirement                                                                                                                                                                                                                                                                                                                                           | Priority    |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| FR-1 | Own Pi RPC client/manager behavior, JSONL framing, subprocess lifecycle, and lazy startup                                                                                                                                                                                                                                                             | Must Have   |
| FR-2 | Own Pi SDK bundle/bootstrap behavior and config injection from the VSCode host                                                                                                                                                                                                                                                                        | Must Have   |
| FR-3 | Own Pi skills sync and adapter-specific capability/model behavior                                                                                                                                                                                                                                                                                     | Must Have   |
| FR-4 | Implement the `350-agent-manager` contract without importing VSCode APIs from adapter packages                                                                                                                                                                                                                                                        | Must Have   |
| FR-5 | When the host sets `AFX_CUSTOM_PROVIDERS_JSON`, the Pi SDK bootstrap parses the envelope, builds an empty `ModelRegistry`, calls `registerProvider(...)` for each AFX-managed canonical record, and starts the runtime via `createAgentSessionRuntime({ modelRegistry })` followed by `runRpcMode(runtime)` — bypassing the default `main(args)` path | Should Have |
| FR-6 | When `AFX_CUSTOM_PROVIDERS_JSON` is unset, the Pi SDK bootstrap falls through to `main(args)` with current behaviour. AFX never overrides `PI_CODING_AGENT_DIR` for custom-providers purposes; existing session-dir handling stays put                                                                                                                | Must Have   |

### Non-Functional Requirements

| ID    | Requirement                                                         | Target                                                                                                                   |
| ----- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| NFR-1 | Adapter remains Node-only and VSCode-free                           | No `vscode` imports in `packages/agent/pi`                                                                               |
| NFR-2 | RPC failures are recoverable                                        | Process/JSONL failures surface as manager errors/status                                                                  |
| NFR-3 | SDK bootstrap remains portable                                      | Windows support is considered when bundling/executing Pi SDK assets                                                      |
| NFR-4 | Bundled Pi SDK runs only on Node >=22.19.0 (upstream engines floor) | VS Code engine floor `^1.105.0` (extension-host Node `>=22.19.0`); e2e asserts the SDK startup executable's Node version |

---

## Acceptance Criteria

### Pi Adapter Ownership

- [ ] Pi adapter and SDK files route to this spec
- [ ] Runtime manager files route to `350-agent-manager`
- [ ] `300-infra-pi` content is treated as migration source until fully superseded
- [ ] Pi SDK bootstrap branches on `AFX_CUSTOM_PROVIDERS_JSON` env var: with envelope present, runs through the SDK API; without envelope, runs through `main(args)` unchanged
- [ ] The Pi SDK custom-providers adapter (`packages/agent/pi-sdk/src/custom-providers-adapter.ts`) implements the harness-agnostic `HarnessAdapter` contract from `100-package-shared` per `[ADR-0008]`
- [ ] `~/.pi/agent/models.json` is read only for the Pi RPC track read-only display in `214-app-chat-settings`; AFX never writes it from any code path

---

## Non-Goals (Out of Scope)

- Generic runtime selection policy
- Chat/webview settings UI
- Non-Pi agent adapters

---

## Open Questions

| #   | Question                                                                            | Status | Resolution |
| --- | ----------------------------------------------------------------------------------- | ------ | ---------- |
| 1   | What Windows-specific SDK bootstrap checks are required before enabling Pi broadly? | Open   | -          |

---

## Dependencies

- `350-agent-manager`
- `100-package-shared`
- `300-infra-pi` during migration

---

## Appendix

### Agent Entry Map

| Field           | Values                                                                                                                                                                                                      |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Owned surface   | Pi adapter, RPC transport, SDK bundle/bootstrap, Pi skills sync                                                                                                                                             |
| Owned files     | `packages/agent/pi/src/`, `packages/agent/pi-sdk/src/`, `apps/vscode/src/pi-sdk-bundle.test.ts`, `apps/vscode/src/session-dir.ts`, `apps/vscode/src/secret-store.ts`, `apps/vscode/scripts/sync-skills.mjs` |
| Local anchors   | RPC client/manager factories, JSONL frame handlers, SDK path/bootstrap helpers, skills sync functions, secret/session helpers                                                                               |
| Bridge messages | Pi/runtime status payloads via `350-agent-manager`                                                                                                                                                          |
| Settings keys   | Pi SDK/runtime/provider/secret settings injected by host                                                                                                                                                    |
| Commands        | Pi runtime bootstrap/sync commands if introduced                                                                                                                                                            |
| Tests           | Pi RPC manager/client tests, SDK bundle tests, secret/session tests                                                                                                                                         |
| Dependencies    | `350-agent-manager`, `214-app-chat-settings`                                                                                                                                                                |
| Out of scope    | Runtime abstraction, chat settings layout, non-Pi adapters                                                                                                                                                  |
| Example prompts | "Bundle Pi SDK for Windows", "Fix Pi JSONL framing", "Change Pi lazy startup", "Update skills sync"                                                                                                         |

### Glossary

| Term       | Definition                                                      |
| ---------- | --------------------------------------------------------------- |
| Pi adapter | Node-only runtime package that implements `AgentManager` for Pi |
