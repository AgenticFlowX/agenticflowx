---
afx: true
type: DESIGN
status: Draft
owner: "@rixrix"
version: "1.0"
created_at: "2026-06-01T10:08:49.000Z"
updated_at: "2026-06-01T10:08:49.000Z"
tags: ["agent", "pi-sdk", "credentials", "bootstrap", "provider-overrides"]
spec: spec.md
---

# Agent SDK Credential Injection - Technical Design

## [DES-OVR] Overview

The injection boundary resolves selected credentials in the VS Code host, serializes safe env/bootstrap inputs for the managed Pi SDK, and keeps OAuth tokens out of CLI args and external RPC spawns.

---

## [DES-FLOW] Managed SDK Spawn Flow

```
Agent factory
  -> determine configured providers
  -> resolve selected auth method
  -> fetch OAuth/API-key/setup-field values from SecretStore
  -> build SDK manager options
       -> buildBootstrapEnv()
       -> AFX_PROVIDER_OVERRIDES_JSON
       -> AFX_AUTH_METHOD_{PROVIDER}
       -> provider env aliases
  -> Pi SDK bootstrap registers providers
  -> Pi SDK discovers/selects model
```

Subscription credentials are env-only. API keys keep existing `--api-key` behavior when the SDK path requires it.

---

## [DES-OVERRIDES] Provider Overrides

`AFX_PROVIDER_OVERRIDES_JSON` registers built-in provider records when the upstream Pi registry would not otherwise treat an AFX-owned subscription provider as configured. It also carries Copilot base URL overrides and Cloudflare setup-derived env references.

---

## [DES-EXTERNAL] External Runtime Isolation

External Pi RPC uses user-owned auth. The spawn environment is scrubbed of inherited provider credential vars before launching `pi --mode rpc`, including common provider aliases and AFX-owned aliases.

---

## [DES-SEC] Security Considerations

- OAuth access tokens are never appended to process arguments.
- Provider override JSON references env var names rather than embedding token values.
- External runtime env scrub prevents accidental host-env credential leakage.

---

## [DES-TEST] Testing Strategy

- Agent factory tests cover configured-provider detection, Cloudflare required setup, OAuth-only providers, and external env scrub.
- SDK manager tests cover provider override generation and subscription/API-key spawn behavior.
- Bootstrap tests cover env alias application, no subscription `--api-key`, and provider registration.

---

## File Reference Map

| Task | File                                                              | Required @see                                                                        |
| ---- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 1.1  | `apps/vscode/src/agent-factory.ts`                                | `docs/specs/355-agent-sdk-credential-injection/design.md [DES-FLOW] [DES-EXTERNAL]`  |
| 1.2  | `packages/agent/pi-sdk/src/sdk-rpc-manager.ts`                    | `docs/specs/355-agent-sdk-credential-injection/design.md [DES-FLOW] [DES-OVERRIDES]` |
| 1.3  | `packages/agent/pi-sdk/src/options.ts`                            | `docs/specs/355-agent-sdk-credential-injection/design.md [DES-FLOW]`                 |
| 1.4  | `packages/agent/pi-sdk/bootstrap/bootstrap.ts`                    | `docs/specs/355-agent-sdk-credential-injection/design.md [DES-FLOW]`                 |
| 1.5  | `packages/agent/pi-sdk/bootstrap/provider-overrides-bootstrap.ts` | `docs/specs/355-agent-sdk-credential-injection/design.md [DES-OVERRIDES]`            |

---

## Open Technical Questions

| #   | Question                                                                                         | Status   |
| --- | ------------------------------------------------------------------------------------------------ | -------- |
| 1   | Should provider override JSON become a reusable adapter envelope once another managed SDK lands? | Deferred |
