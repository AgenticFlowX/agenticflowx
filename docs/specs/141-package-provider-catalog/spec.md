---
afx: true
type: SPEC
status: Draft
owner: "@rixrix"
version: "1.0"
created_at: "2026-06-01T10:08:49.000Z"
updated_at: "2026-06-01T10:08:49.000Z"
tags: ["package", "shared", "provider-catalog", "providers", "models"]
depends_on: ["100-package-shared", "351-agent-pi"]
---

# Package Provider Catalog - Product Specification

## References

- **Parent Package**: [Package Shared](../100-package-shared/spec.md)
- **Pi Adapter**: [Agent Pi](../351-agent-pi/spec.md)
- **Settings UI Consumer**: [App Chat Provider Settings](../218-app-chat-provider-settings/spec.md)
- **SDK Injection Consumer**: [Agent SDK Credential Injection](../355-agent-sdk-credential-injection/spec.md)

---

## Problem Statement

AFX needs one shared catalog for built-in hosted providers, default model choices, credential aliases, OAuth capability metadata, and provider setup fields. Without a focused catalog spec, provider drift against bundled Pi packages spreads across Settings, host runtime setup, and model discovery.

---

## User Stories

### Primary Users

Developers maintaining built-in provider support, Settings provider cards, and runtime credential setup.

### Stories

**As a** developer adding a built-in provider
**I want** provider names, defaults, env aliases, and setup fields in one catalog
**So that** Settings and runtime discovery stay aligned.

**As a** developer checking Pi drift
**I want** AFX defaults to mirror bundled Pi provider ids and model ids
**So that** a model shown in the UI can be selected by the runtime.

---

## Requirements

### Functional Requirements

| ID   | Requirement                                                                                                               | Priority  |
| ---- | ------------------------------------------------------------------------------------------------------------------------- | --------- |
| FR-1 | Own the shared built-in provider details used by host runtime setup and chat Settings cards.                              | Must Have |
| FR-2 | Expose API-key env aliases for every built-in provider that AFX can configure through the managed SDK path.               | Must Have |
| FR-3 | Expose startup/default model ids that match the bundled Pi provider registry.                                             | Must Have |
| FR-4 | Expose OAuth capability metadata: `oauthCapable`, `oauthFlow`, and `dualMethod`.                                          | Must Have |
| FR-5 | Expose provider setup fields, including Cloudflare account/gateway requirements, without treating partial setup as ready. | Must Have |
| FR-6 | Keep subscription-only providers distinct from metered API-key siblings, for example `openai-codex` vs `openai`.          | Must Have |

### Non-Functional Requirements

| ID    | Requirement         | Target                                                                    |
| ----- | ------------------- | ------------------------------------------------------------------------- |
| NFR-1 | Traceability        | Catalog exports carry `@see` links to this spec/design after migration.   |
| NFR-2 | Runtime correctness | Defaults must be validated against bundled Pi before release.             |
| NFR-3 | Secret safety       | Catalog metadata must never contain literal user credentials.             |
| NFR-4 | UX consistency      | Settings copy and cards derive grouping/capability from catalog metadata. |

---

## Acceptance Criteria

### Provider Coverage

- [ ] The catalog includes all built-in Pi API-key providers AFX chooses to surface.
- [ ] Cloudflare providers expose required setup fields and do not appear ready when required fields are missing.
- [ ] Xiaomi/MiMo, Moonshot, Together, Cloudflare, and subscription providers have Pi-compatible defaults.

### Runtime Alignment

- [ ] Every catalog default can be selected by the bundled Pi SDK when the provider is configured.
- [ ] Subscription-only provider ids do not collide with API-key provider ids.

---

## Non-Goals (Out of Scope)

- User-created custom providers; those remain under chat Settings and the Pi custom-provider adapter.
- OAuth token storage, refresh, or provider sign-in flows.
- Generic provider marketplace discovery.

---

## Open Questions

| #   | Question                                                       | Status | Resolution |
| --- | -------------------------------------------------------------- | ------ | ---------- |
| 1   | Should AFX surface every Pi provider or only tested providers? | Open   | -          |

---

## Dependencies

- Bundled Pi provider ids and default model ids.
- Settings provider-card grouping and readiness rules.
- SDK credential injection env alias handling.

---

## Appendix

### Agent Entry Map

| Field         | Entries                                                                                   |
| ------------- | ----------------------------------------------------------------------------------------- |
| Owned surface | Shared built-in provider catalog and defaults                                             |
| Owned files   | `packages/shared/src/provider-catalog.ts`, `packages/shared/src/provider-catalog.test.ts` |
| Consumers     | Settings provider cards, agent factory, Pi SDK env/bootstrap setup                        |
| Settings keys | Provider setup fields map to host-secret records owned by Settings/host                   |
| Tests         | `packages/shared/src/provider-catalog.test.ts`                                            |
| Out of scope  | Token storage, OAuth flows, custom-provider editor                                        |

### Glossary

| Term              | Definition                                                     |
| ----------------- | -------------------------------------------------------------- |
| setup field       | Additional provider value required beyond the API key          |
| dual method       | One provider id supports both subscription and API-key methods |
| subscription-only | A provider id that exists only for subscription-backed auth    |
