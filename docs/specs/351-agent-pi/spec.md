---
afx: true
type: SPEC
status: Living
owner: "@rixrix"
version: "1.3"
created_at: "2026-05-02T23:56:50.000Z"
updated_at: "2026-06-26T12:50:19.000Z"
tags: ["agent", "pi", "rpc", "sdk", "custom-providers", "skills", "project-trust"]
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

| ID   | Requirement                                                                                                                                                                                                                                                                                                                                                         | Priority    |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| FR-1 | Own Pi RPC client/manager behavior, JSONL framing, subprocess lifecycle, and lazy startup                                                                                                                                                                                                                                                                           | Must Have   |
| FR-2 | Own Pi SDK bundle/bootstrap behavior, Pi 0.80.x entrypoint compatibility, and config injection from the VSCode host                                                                                                                                                                                                                                                 | Must Have   |
| FR-3 | Own Pi skills sync, bundled AFX skill loading, custom skill path loading, and adapter-specific capability/model behavior                                                                                                                                                                                                                                            | Must Have   |
| FR-4 | Implement the `350-agent-manager` contract without importing VSCode APIs from adapter packages                                                                                                                                                                                                                                                                      | Must Have   |
| FR-5 | When the host sets `AFX_CUSTOM_PROVIDERS_JSON`, the Pi SDK bootstrap installs an extension factory that calls `pi.registerProvider(...)` for each AFX-managed canonical record before delegating to Pi `main(...)`; provider override factories apply env-key/base-URL overrides for built-in subscription providers without exposing secret values in process args | Should Have |
| FR-6 | When `AFX_CUSTOM_PROVIDERS_JSON` and `AFX_PROVIDER_OVERRIDES_JSON` are unset, the Pi SDK bootstrap delegates to `main(args)` with current behaviour. AFX never writes Pi's global `auth.json`, `trust.json`, or `models.json` from the SDK path; existing session-dir handling stays put                                                                            | Must Have   |
| FR-7 | Own Pi 0.80.2 compatibility surfaces: package pins, Node `>=22.19.0` runtime floor, `@earendil-works/pi-ai/api/*` bootstrap assets, provider-scoped auth/env compatibility, command `sourceInfo`, and compaction `estimatedTokensAfter` / `reason` / `willRetry` metadata normalization for both external Pi RPC and bundled SDK runtimes                           | Must Have   |
| FR-8 | Own Pi project-local resource controls from the AFX host: `afx.pi.projectTrust` maps to `--approve` / `--no-approve`, unresolved `ask` starts with project resources ignored when workspace Pi resources exist, and AFX persists only its workspace setting rather than Pi global trust state                                                                       | Must Have   |
| FR-9 | Own Pi runtime knobs that are surfaced by Settings but consumed by Pi startup: `afx.skills.extraPaths` becomes additional `--skill` args, `afx.pi.excludedTools` becomes `--exclude-tools`, and `afx.network.httpProxy` becomes `HTTP_PROXY` / `HTTPS_PROXY` in spawned runtime env                                                                                 | Must Have   |

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
- [ ] `300-infra-pi` remains reference material for shared Pi context while this spec owns Pi adapter behavior
- [ ] Pi SDK bootstrap reads `AFX_CUSTOM_PROVIDERS_JSON`: with an envelope present, installs a provider extension factory before delegating to Pi `main(...)`; without an envelope, delegates to `main(args)` with no custom-provider factory
- [ ] The Pi SDK custom-providers adapter (`packages/agent/pi-sdk/src/custom-providers-adapter.ts`) implements the harness-agnostic `HarnessAdapter` contract from `100-package-shared` per `[ADR-0008]`
- [ ] `~/.pi/agent/models.json` is read only for the Pi RPC track read-only display in `214-app-chat-settings`; AFX never writes it from any code path
- [ ] Pi RPC and Pi SDK startup args include bundled AFX skills, configured custom skill paths, project trust choice, excluded tools, proxy env, and only the host overlay markdown as an appended system prompt
- [ ] Pi SDK bundled assets include the Pi 0.80 Bedrock API implementation under `resources/pi-sdk/api/bedrock-converse-stream.js`
- [ ] Pi command provenance (`sourceInfo`) and compaction metadata (`estimatedTokensAfter`, `reason`, `willRetry`) survive adapter normalization into shared contracts

---

## Non-Goals (Out of Scope)

- Generic runtime selection policy
- Chat/webview settings UI
- Non-Pi agent adapters
- Writing Pi global `trust.json`, `auth.json`, or `~/.pi/agent/models.json`
- Exposing Pi CLI `--session-id` or `--name` as first-class AFX controls

---

## Open Questions

| #   | Question                                                                            | Status | Resolution |
| --- | ----------------------------------------------------------------------------------- | ------ | ---------- |
| 1   | What Windows-specific SDK bootstrap checks are required before enabling Pi broadly? | Open   | -          |

---

## Dependencies

- `350-agent-manager`
- `100-package-shared`
- `300-infra-pi`

---

## Appendix

### Agent Entry Map

| Field           | Values                                                                                                                                                                                                      |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Owned surface   | Pi adapter, RPC transport, SDK bundle/bootstrap, Pi skills sync, Pi 0.80 runtime startup args                                                                                                               |
| Owned files     | `packages/agent/pi/src/`, `packages/agent/pi-sdk/src/`, `apps/vscode/src/pi-sdk-bundle.test.ts`, `apps/vscode/src/session-dir.ts`, `apps/vscode/src/secret-store.ts`, `apps/vscode/scripts/sync-skills.mjs` |
| Local anchors   | RPC client/manager factories, JSONL frame handlers, SDK path/bootstrap helpers, skills sync functions, secret/session helpers                                                                               |
| Bridge messages | Pi/runtime status payloads via `350-agent-manager`                                                                                                                                                          |
| Settings keys   | `afx.skills.extraPaths`, `afx.pi.projectTrust`, `afx.pi.excludedTools`, `afx.network.httpProxy`, Pi SDK/runtime/provider/secret settings injected by host                                                   |
| Commands        | Pi runtime bootstrap/sync commands if introduced                                                                                                                                                            |
| Tests           | Pi RPC manager/client tests, SDK bundle tests, secret/session tests                                                                                                                                         |
| Dependencies    | `350-agent-manager`, `214-app-chat-settings`                                                                                                                                                                |
| Out of scope    | Runtime abstraction, chat settings layout, non-Pi adapters                                                                                                                                                  |
| Example prompts | "Bundle Pi SDK for Windows", "Fix Pi JSONL framing", "Change Pi lazy startup", "Update skills sync"                                                                                                         |

### Glossary

| Term       | Definition                                                      |
| ---------- | --------------------------------------------------------------- |
| Pi adapter | Node-only runtime package that implements `AgentManager` for Pi |
