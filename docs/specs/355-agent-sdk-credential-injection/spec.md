---
afx: true
type: SPEC
status: Draft
owner: "@rixrix"
version: "1.0"
created_at: "2026-06-01T10:08:49.000Z"
updated_at: "2026-06-01T10:08:49.000Z"
tags: ["agent", "pi-sdk", "credentials", "bootstrap", "provider-overrides"]
depends_on:
  [
    "141-package-provider-catalog",
    "351-agent-pi",
    "352-agent-managed-oauth",
    "353-agent-oauth-credential-store",
    "354-agent-oauth-provider-flows",
  ]
---

# Agent SDK Credential Injection - Product Specification

## References

- **Provider Catalog**: [Package Provider Catalog](../141-package-provider-catalog/spec.md)
- **Pi Adapter**: [Agent Pi](../351-agent-pi/spec.md)
- **Managed OAuth**: [Agent Managed OAuth](../352-agent-managed-oauth/spec.md)
- **OAuth Store**: [Agent OAuth Credential Store](../353-agent-oauth-credential-store/spec.md)

---

## Problem Statement

The bundled Pi SDK must receive the selected credential method at spawn time without leaking OAuth tokens into process args, logs, or external RPC runtimes. This spec owns the injection boundary between host credential resolution and Pi SDK bootstrap/model registration.

---

## User Stories

### Primary Users

Developers maintaining the managed Pi SDK runtime and users selecting subscription/API-key model variants.

### Stories

**As a** user
**I want** the selected credential method to be used by the next SDK turn
**So that** model selection reliably controls billing/source path.

**As a** developer
**I want** subscription credentials passed env-only
**So that** tokens cannot leak through CLI arguments or external runtime spawns.

---

## Requirements

### Functional Requirements

| ID   | Requirement                                                                                           | Priority  |
| ---- | ----------------------------------------------------------------------------------------------------- | --------- |
| FR-1 | Resolve selected credential method for Pi SDK providers before spawn.                                 | Must Have |
| FR-2 | Treat OAuth-only providers as configured when a valid OAuth record exists.                            | Must Have |
| FR-3 | Pass subscription credentials through environment references, never through `--api-key` process args. | Must Have |
| FR-4 | Register built-in subscription provider overrides so Pi can discover and select those models.         | Must Have |
| FR-5 | Inject Copilot base URL override when provider metadata requires a non-default endpoint.              | Must Have |
| FR-6 | Scrub inherited provider credential env vars from external Pi RPC spawns.                             | Must Have |
| FR-7 | Include required provider setup fields, such as Cloudflare account/gateway ids, in managed SDK env.   | Must Have |

### Non-Functional Requirements

| ID    | Requirement     | Target                                                                             |
| ----- | --------------- | ---------------------------------------------------------------------------------- |
| NFR-1 | Token hygiene   | No OAuth access/refresh token in process args, logs, settings, or bridge payloads. |
| NFR-2 | Runtime parity  | Models shown by selector can be selected by Pi SDK runtime.                        |
| NFR-3 | External safety | External RPC runtime receives no AFX-owned provider credentials.                   |
| NFR-4 | Traceability    | Agent factory, SDK manager, and bootstrap files point here after migration.        |

---

## Acceptance Criteria

### Managed SDK Injection

- [ ] Subscription-backed providers spawn without `--api-key` containing OAuth tokens.
- [ ] API-key providers preserve existing API-key behavior.
- [ ] `openai-codex` model rows discovered by the selector can be selected by Pi without "Model not found".
- [ ] Cloudflare setup fields are present before Cloudflare providers count as configured.

### External Isolation

- [ ] External Pi RPC spawn env is scrubbed of inherited provider credential variables.
- [ ] External Pi Settings cards guide users to `pi /login` instead of AFX OAuth sign-in.

---

## Non-Goals (Out of Scope)

- Provider card rendering.
- OAuth browser/device flow implementation.
- Generic managed SDK abstraction before a second adapter exists.

---

## Open Questions

| #   | Question                                              | Status | Resolution                     |
| --- | ----------------------------------------------------- | ------ | ------------------------------ |
| 1   | Should provider overrides be generalized for OMP SDK? | Open   | Wait for a second managed SDK. |

---

## Dependencies

- Shared provider catalog defaults and env aliases.
- OAuth credential store and active method.
- Pi SDK bootstrap provider override support.

---

## Appendix

### Agent Entry Map

| Field           | Entries                                                                                                                                                                                                                                       |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Owned surface   | Host-to-managed-SDK credential resolution and bootstrap injection                                                                                                                                                                             |
| Owned files     | `apps/vscode/src/agent-factory.ts`, `packages/agent/pi-sdk/src/sdk-rpc-manager.ts`, `packages/agent/pi-sdk/src/options.ts`, `packages/agent/pi-sdk/bootstrap/bootstrap.ts`, `packages/agent/pi-sdk/bootstrap/provider-overrides-bootstrap.ts` |
| Bridge messages | Indirectly affects `agent/models`, `chat/setModel`, runtime status                                                                                                                                                                            |
| Settings keys   | Reads `afx.oauth.*`, `afx.authMethod.*`, API-key records, provider setup records                                                                                                                                                              |
| Tests           | Agent factory tests, SDK manager tests, bootstrap/provider-overrides tests                                                                                                                                                                    |
| Out of scope    | Settings cards, provider flow exchange, selector rendering                                                                                                                                                                                    |
