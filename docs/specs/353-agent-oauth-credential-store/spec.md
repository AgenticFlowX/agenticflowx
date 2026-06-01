---
afx: true
type: SPEC
status: Draft
owner: "@rixrix"
version: "1.0"
created_at: "2026-06-01T10:08:49.000Z"
updated_at: "2026-06-01T10:08:49.000Z"
tags: ["agent", "oauth", "secret-storage", "credentials", "refresh"]
depends_on: ["200-app-vscode", "352-agent-managed-oauth"]
---

# Agent OAuth Credential Store - Product Specification

## References

- **Managed OAuth Policy**: [Agent Managed OAuth](../352-agent-managed-oauth/spec.md)
- **VSCode Host**: [App VSCode](../200-app-vscode/spec.md)
- **Provider Flows**: [Agent OAuth Provider Flows](../354-agent-oauth-provider-flows/spec.md)
- **Model State Consumer**: [App VSCode Model Selection State](../205-app-vscode-model-selection-state/spec.md)

---

## Problem Statement

Subscription credentials need secure storage, active-method state, redacted status, refresh coordination, and safe deletion. Keeping these concerns separate from provider UI and SDK injection makes future credential fixes small and auditable.

---

## User Stories

### Primary Users

Developers maintaining VS Code SecretStorage integration and users who expect sign-in state to persist safely.

### Stories

**As a** user
**I want** sign-in state to survive reloads without leaking tokens
**So that** subscription-backed models are reliable and safe.

**As a** developer
**I want** one active-method source of truth
**So that** Settings and model selection route the same credential.

---

## Requirements

### Functional Requirements

| ID   | Requirement                                                                                          | Priority  |
| ---- | ---------------------------------------------------------------------------------------------------- | --------- |
| FR-1 | Store OAuth records in VS Code SecretStorage under `afx.oauth.{provider}`.                           | Must Have |
| FR-2 | Store active method records under `afx.authMethod.{provider}` with only `subscription` or `api-key`. | Must Have |
| FR-3 | Maintain indexes for OAuth and active-method records so Settings snapshots can enumerate state.      | Must Have |
| FR-4 | Return redacted status and safe metadata only over bridge messages.                                  | Must Have |
| FR-5 | Refresh expiring records proactively and refresh once after provider auth failure.                   | Must Have |
| FR-6 | Lock refresh operations so concurrent windows do not corrupt credential state.                       | Must Have |
| FR-7 | Sign-out deletes OAuth records and fails closed when no fallback credential exists.                  | Must Have |

### Non-Functional Requirements

| ID    | Requirement   | Target                                                                                                   |
| ----- | ------------- | -------------------------------------------------------------------------------------------------------- |
| NFR-1 | Secret safety | No token in settings, logs, bridge messages, telemetry, or args.                                         |
| NFR-2 | Fail closed   | Missing/failed subscription credentials never silently use API key unless active method changes visibly. |
| NFR-3 | Traceability  | SecretStore and OAuthService point to this spec/design.                                                  |
| NFR-4 | Concurrency   | Refresh failure backs off rather than spinning.                                                          |

---

## Acceptance Criteria

### Storage And Status

- [ ] OAuth records persist only in SecretStorage.
- [ ] Settings snapshots expose connected/expiry/method status without tokens.
- [ ] Sign-out removes stored OAuth state.

### Refresh

- [ ] Expired or near-expired records refresh before SDK spawn when possible.
- [ ] Refresh failure does not loop forever.
- [ ] Concurrent refresh attempts serialize or dedupe safely.

---

## Non-Goals (Out of Scope)

- Provider-specific browser/device exchange details.
- Provider card rendering.
- SDK env/bootstrap injection.

---

## Open Questions

| #   | Question                                        | Status   | Resolution                            |
| --- | ----------------------------------------------- | -------- | ------------------------------------- |
| 1   | Should plan labels be stored in OAuth metadata? | Deferred | Only if proven safe and needed by UI. |

---

## Dependencies

- VS Code SecretStorage.
- Provider flow adapters that return normalized OAuth records.
- Runtime injection code that consumes access tokens without logging them.

---

## Appendix

### Agent Entry Map

| Field           | Entries                                                                                                  |
| --------------- | -------------------------------------------------------------------------------------------------------- |
| Owned surface   | OAuth records, active method, redacted status, refresh lifecycle                                         |
| Owned files     | `apps/vscode/src/secret-store.ts`, `apps/vscode/src/services/oauth/oauth-service.ts`, shared OAuth types |
| Bridge messages | `oauth/status`, `oauth/progress`, status portions of `agent/settingsSnapshot`                            |
| Settings keys   | `afx.oauth.{provider}`, `afx.oauth.index`, `afx.authMethod.{provider}`, `afx.authMethod.index`           |
| Tests           | `secret-store.test.ts`, `oauth-service.test.ts`, redaction tests                                         |
| Out of scope    | Browser/device flow mechanics, provider-card layout, SDK bootstrap                                       |
