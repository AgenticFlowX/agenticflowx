---
afx: true
type: SPEC
status: Draft
owner: "@rixrix"
version: "1.0"
created_at: "2026-06-01T10:08:49.000Z"
updated_at: "2026-06-01T10:08:49.000Z"
tags: ["agent", "oauth", "managed-sdk", "subscription"]
depends_on: ["350-agent-manager", "351-agent-pi"]
---

# Agent Managed OAuth - Product Specification

## References

- **Agent Manager**: [Agent Manager](../350-agent-manager/spec.md)
- **Pi Adapter**: [Agent Pi](../351-agent-pi/spec.md)
- **Governing ADR**: [ADR-0010 OAuth Managed SDK Scope](../../adr/ADR-0010-afx-oauth-managed-sdk-scope.md)

---

## Problem Statement

AFX-owned OAuth should apply only to AFX-managed bundled SDK runtimes, not to externally-run user harnesses. This policy needs a small canonical spec that separates product/runtime ownership from storage, provider flow, UI, and injection details.

---

## User Stories

### Primary Users

Developers deciding whether a runtime should receive AFX-owned credentials and users connecting subscription-backed managed models.

### Stories

**As a** user of bundled Pi SDK models
**I want** AFX to manage supported subscription sign-ins
**So that** I can use subscription-backed providers without manually configuring Pi.

**As a** user of an external Pi/RPC runtime
**I want** AFX to defer to my external runtime configuration
**So that** AFX does not inject credentials into processes I own.

---

## Requirements

### Functional Requirements

| ID   | Requirement                                                                                   | Priority    |
| ---- | --------------------------------------------------------------------------------------------- | ----------- |
| FR-1 | Scope AFX-owned OAuth to AFX-managed bundled SDK runtimes.                                    | Must Have   |
| FR-2 | Treat externally-run RPC/HTTP harnesses as user-configured and credential-isolated.           | Must Have   |
| FR-3 | Support built-in Pi OAuth providers consumed by the bundled Pi SDK.                           | Must Have   |
| FR-4 | Provide shared policy consumed by credential store, provider flows, SDK injection, and UI.    | Must Have   |
| FR-5 | Leave future managed SDKs able to reuse provider flows through a new injection adapter later. | Should Have |

### Non-Functional Requirements

| ID    | Requirement        | Target                                                                               |
| ----- | ------------------ | ------------------------------------------------------------------------------------ |
| NFR-1 | Isolation          | AFX credentials are never injected into external user-owned runtime processes.       |
| NFR-2 | Minimal generality | Do not create a generic harness credential broker before a second adapter proves it. |
| NFR-3 | Traceability       | Runtime policy code and docs route here after migration.                             |

---

## Acceptance Criteria

### Managed SDK Policy

- [ ] Bundled Pi SDK can use AFX-owned OAuth for supported providers.
- [ ] External Pi/RPC surfaces show user-configuration guidance rather than AFX sign-in buttons.
- [ ] Runtime docs distinguish policy from storage, provider flows, and SDK env injection.

---

## Non-Goals (Out of Scope)

- Implementing new OAuth providers.
- Designing Settings provider cards.
- Generic credential brokering for arbitrary external harnesses.

---

## Open Questions

| #   | Question                                   | Status   | Resolution                         |
| --- | ------------------------------------------ | -------- | ---------------------------------- |
| 1   | Which future bundled SDK adopts this next? | Deferred | Wait for a second managed adapter. |

---

## Dependencies

- ADR-0010.
- Agent manager runtime ownership.
- Pi SDK adapter behavior.

---

## Appendix

### Agent Entry Map

| Field           | Entries                                                                                                  |
| --------------- | -------------------------------------------------------------------------------------------------------- |
| Owned surface   | Managed-SDK OAuth scope and external-runtime deferral policy                                             |
| Owned files     | Policy appears in agent factory/runtime setup and Settings guidance; concrete files owned by child specs |
| Bridge messages | None directly; child specs own `oauth/*` messages                                                        |
| Settings keys   | None directly; child specs own SecretStorage keys                                                        |
| Tests           | Policy verified through credential injection and external RPC env-scrub tests                            |
| Out of scope    | Concrete token storage, flow exchange, provider card UI                                                  |
