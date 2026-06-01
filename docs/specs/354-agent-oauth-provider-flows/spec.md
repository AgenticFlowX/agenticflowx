---
afx: true
type: SPEC
status: Draft
owner: "@rixrix"
version: "1.0"
created_at: "2026-06-01T10:08:49.000Z"
updated_at: "2026-06-01T10:08:49.000Z"
tags: ["agent", "oauth", "pkce", "device-code", "providers"]
depends_on: ["352-agent-managed-oauth", "353-agent-oauth-credential-store"]
---

# Agent OAuth Provider Flows - Product Specification

## References

- **Managed OAuth Policy**: [Agent Managed OAuth](../352-agent-managed-oauth/spec.md)
- **Credential Store**: [Agent OAuth Credential Store](../353-agent-oauth-credential-store/spec.md)
- **Provider Settings UI**: [App Chat Provider Settings](../218-app-chat-provider-settings/spec.md)

---

## Problem Statement

Anthropic, OpenAI Codex, and GitHub Copilot use different sign-in mechanics but must produce one normalized credential record and one redacted progress contract. This spec isolates provider exchange behavior from storage and UI rendering.

---

## User Stories

### Primary Users

Users signing in to subscription providers and developers maintaining provider-specific OAuth adapters.

### Stories

**As a** user
**I want** browser sign-in or device-code sign-in to finish with clear progress
**So that** I can connect subscription-backed models without handling tokens.

**As a** developer
**I want** provider adapters to normalize their outputs
**So that** storage, Settings, and SDK injection do not special-case each flow.

---

## Requirements

### Functional Requirements

| ID   | Requirement                                                                                   | Priority  |
| ---- | --------------------------------------------------------------------------------------------- | --------- |
| FR-1 | Implement PKCE loopback support for browser-based providers.                                  | Must Have |
| FR-2 | Support proactive paste-code fallback when loopback completion is blocked or remote-hosted.   | Must Have |
| FR-3 | Implement GitHub Copilot device-code polling with cancel/expiry handling.                     | Must Have |
| FR-4 | Normalize provider outputs into shared OAuth record metadata.                                 | Must Have |
| FR-5 | Derive provider-specific metadata needed by SDK injection, such as Copilot base URL.          | Must Have |
| FR-6 | Emit redacted progress events for waiting, paste-code, device-code, success, failure, cancel. | Must Have |
| FR-7 | Validate state/PKCE inputs and surface safe failure messages.                                 | Must Have |

### Non-Functional Requirements

| ID    | Requirement    | Target                                                                      |
| ----- | -------------- | --------------------------------------------------------------------------- |
| NFR-1 | Security       | State mismatch and malformed callback fail the sign-in.                     |
| NFR-2 | Remote support | Loopback binds local dual-stack where supported and exposes paste fallback. |
| NFR-3 | Traceability   | Provider adapters point to this spec/design after migration.                |
| NFR-4 | Token hygiene  | Tokens never appear in progress messages or logs.                           |

---

## Acceptance Criteria

### Provider Sign-In

- [ ] Anthropic PKCE happy path completes through browser callback.
- [ ] OpenAI Codex PKCE happy path stores a connected provider record.
- [ ] GitHub Copilot device-code flow shows user code, verification URL, waiting, cancel, and success.

### Failure Handling

- [ ] PKCE state mismatch fails safely.
- [ ] Loopback timeout exposes paste-code fallback.
- [ ] Device-code expiry/cancel stops polling.

---

## Non-Goals (Out of Scope)

- SecretStorage persistence implementation.
- Provider-card component layout.
- SDK runtime injection and model registration.

---

## Open Questions

| #   | Question                                       | Status   | Resolution                                  |
| --- | ---------------------------------------------- | -------- | ------------------------------------------- |
| 1   | Which remote hosts need first-class copy text? | Deferred | Validate through manual WSL/remote testing. |

---

## Dependencies

- Shared OAuth record types.
- OAuthService orchestration.
- Settings provider-card progress rendering.

---

## Appendix

### Agent Entry Map

| Field           | Entries                                                                                                      |
| --------------- | ------------------------------------------------------------------------------------------------------------ |
| Owned surface   | Provider-specific sign-in/exchange strategies                                                                |
| Owned files     | `apps/vscode/src/services/oauth/pkce*.ts`, `device-code.ts`, `apps/vscode/src/services/oauth/providers/*.ts` |
| Bridge messages | `oauth/signIn`, `oauth/submitCode`, `oauth/cancel`, `oauth/progress`                                         |
| Settings keys   | None directly; writes normalized records through credential store                                            |
| Tests           | PKCE, device-code, provider adapter tests                                                                    |
| Out of scope    | SecretStorage internals, provider-card JSX, SDK bootstrap                                                    |
