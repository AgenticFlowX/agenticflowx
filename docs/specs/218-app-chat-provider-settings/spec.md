---
afx: true
type: SPEC
status: Draft
owner: "@rixrix"
version: "1.0"
created_at: "2026-06-01T10:08:49.000Z"
updated_at: "2026-06-01T10:08:49.000Z"
tags: ["app", "chat", "settings", "providers", "subscription-accounts"]
depends_on:
  [
    "141-package-provider-catalog",
    "214-app-chat-settings",
    "352-agent-managed-oauth",
    "353-agent-oauth-credential-store",
    "354-agent-oauth-provider-flows",
  ]
---

# App Chat Provider Settings - Product Specification

## References

- **Parent Settings**: [App Chat Settings](../214-app-chat-settings/spec.md)
- **Provider Catalog**: [Package Provider Catalog](../141-package-provider-catalog/spec.md)
- **Managed OAuth**: [Agent Managed OAuth](../352-agent-managed-oauth/spec.md)
- **OAuth Flows**: [Agent OAuth Provider Flows](../354-agent-oauth-provider-flows/spec.md)

---

## Problem Statement

Settings -> Models now includes API-key providers, subscription-backed accounts, setup-field providers, and custom models. The built-in provider cards need a focused spec so sign-in states, grouping, readiness, and setup-field copy can evolve without bloating the general Settings spec.

---

## User Stories

### Primary Users

Users connecting hosted models and developers maintaining Settings provider UX.

### Stories

**As a** user with ChatGPT, Claude, or Copilot subscription access
**I want** subscription accounts grouped separately from API-key providers
**So that** I can find sign-in based accounts quickly.

**As a** user configuring Cloudflare
**I want** required account/gateway fields shown clearly
**So that** the provider is not treated as ready until setup is complete.

---

## Requirements

### Functional Requirements

| ID   | Requirement                                                                                      | Priority  |
| ---- | ------------------------------------------------------------------------------------------------ | --------- |
| FR-1 | Group subscription-capable account cards separately from API-key provider cards.                 | Must Have |
| FR-2 | Render subscription-only providers with sign-in actions, not API-key paste actions.              | Must Have |
| FR-3 | Render dual-method providers with a method chooser only when catalog metadata says `dualMethod`. | Must Have |
| FR-4 | Render connected, unconnected, signing-in, device-code, paste-code, and sign-out states.         | Must Have |
| FR-5 | Render provider setup fields and block ready state until required setup fields are saved.        | Must Have |
| FR-6 | Keep safe Settings snapshots and mock transport parity for browser/Playwright verification.      | Must Have |
| FR-7 | Keep user-facing copy free of implementation terms except in developer diagnostics.              | Must Have |

### Non-Functional Requirements

| ID    | Requirement   | Target                                                                |
| ----- | ------------- | --------------------------------------------------------------------- |
| NFR-1 | Secret safety | Webview receives only redacted status, never raw credentials.         |
| NFR-2 | UX clarity    | Primary actions say "Sign in" for subscription accounts.              |
| NFR-3 | Traceability  | Provider card, settings view, snapshot, and copy files point here.    |
| NFR-4 | Testability   | Browser mocks mirror OAuth/provider metadata used by production host. |

---

## Acceptance Criteria

### Provider Cards

- [ ] ChatGPT/Codex, Anthropic, and GitHub Copilot appear in the subscription account group.
- [ ] Unconnected subscription cards show "Sign in" affordances.
- [ ] API-key providers keep paste/manage key affordances.
- [ ] Cloudflare cards ask for required Account ID/Gateway ID fields before ready.

### Safety

- [ ] Settings snapshots contain only redacted OAuth/API-key state.
- [ ] Playwright screenshots exercise subscription, API-key, and empty-provider states.

---

## Non-Goals (Out of Scope)

- Model selector row grouping.
- SecretStorage implementation details.
- Pi SDK env injection.
- Custom model editor overhaul.

---

## Open Questions

| #   | Question                                           | Status | Resolution                       |
| --- | -------------------------------------------------- | ------ | -------------------------------- |
| 1   | Should subscription account cards show plan names? | Open   | Only after safe metadata exists. |

---

## Dependencies

- Shared provider catalog metadata.
- OAuth status/progress bridge payloads.
- Existing Settings shell and custom-models tab.

---

## Appendix

### Agent Entry Map

| Field           | Entries                                                                                                                                                          |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Owned surface   | Settings -> Models built-in provider cards and subscription account grouping                                                                                     |
| Owned files     | `apps/chat/src/views/settings.tsx`, `apps/chat/src/components/provider-card.tsx`, `apps/chat/src/lib/settings-copy.ts`, `apps/chat/src/lib/settings-snapshot.ts` |
| Bridge messages | `agent/settingsSnapshot`, `provider/setApiKey`, `provider/clearApiKey`, `provider/setDefaultModel`, `oauth/*`                                                    |
| Settings keys   | Consumes redacted provider status; host owns secret keys                                                                                                         |
| Tests           | `provider-card.test.tsx`, settings/app tests, Playwright screenshots                                                                                             |
| Out of scope    | Selector trigger/menu, token refresh internals, SDK bootstrap                                                                                                    |
