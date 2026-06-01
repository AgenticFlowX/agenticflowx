---
afx: true
type: DESIGN
status: Draft
owner: "@rixrix"
version: "1.0"
created_at: "2026-06-01T10:08:49.000Z"
updated_at: "2026-06-01T10:08:49.000Z"
tags: ["agent", "oauth", "secret-storage", "credentials", "refresh"]
spec: spec.md
---

# Agent OAuth Credential Store - Technical Design

## [DES-OVR] Overview

The credential store owns durable OAuth records, active auth method, redacted status, and refresh lifecycle. It exposes safe host APIs to Settings, model selection, and SDK injection.

---

## [DES-DATA] Data Model

SecretStorage keys:

| Key                         | Value                                                                                 |
| --------------------------- | ------------------------------------------------------------------------------------- |
| `afx.oauth.{provider}`      | Serialized OAuth record with access/refresh token, expiry, and safe provider metadata |
| `afx.oauth.index`           | Provider ids with OAuth records                                                       |
| `afx.authMethod.{provider}` | `"subscription"` or `"api-key"`                                                       |
| `afx.authMethod.index`      | Provider ids with active method records                                               |

Active-method derivation:

1. Use stored active method only when its backing credential exists.
2. Prefer OAuth when OAuth exists and no method is stored.
3. Use API key when only API key exists.
4. Return no credential when selected method has no backing record.

---

## [DES-API] Host APIs

| API                               | Purpose                                             |
| --------------------------------- | --------------------------------------------------- |
| `getOAuth(provider)`              | Return stored OAuth record to trusted host services |
| `setOAuth(provider, record)`      | Save normalized OAuth record                        |
| `clearOAuth(provider)`            | Delete OAuth record and update index                |
| `listOAuthProviders()`            | Enumerate OAuth provider ids                        |
| `getAuthMethod(provider)`         | Read selected method                                |
| `setAuthMethod(provider, method)` | Save selected method                                |
| `listAuthMethodProviders()`       | Enumerate active-method records                     |
| `getOAuthStatus(provider)`        | Return redacted status for UI                       |

---

## [DES-LOCK] Refresh Locking

Refresh operations use a provider-scoped lock and re-read SecretStorage after acquiring the lock. Failed refresh attempts record a backoff so the runtime monitor cannot spin on an already-due record.

---

## [DES-SEC] Security Considerations

- Only trusted extension-host services read full OAuth records.
- Webview messages receive redacted status and progress only.
- Sign-out deletes OAuth records and never leaves a stale active method pointing to a missing subscription credential.

---

## [DES-TEST] Testing Strategy

- SecretStore tests cover parse, index, active-method derivation, deletion, and redaction.
- OAuthService tests cover forced refresh, proactive refresh, failed-refresh backoff, and no silent fallback.
- Bridge tests assert token fields never appear in webview payloads.

---

## File Reference Map

| Task | File                                              | Required @see                                                                |
| ---- | ------------------------------------------------- | ---------------------------------------------------------------------------- |
| 1.1  | `apps/vscode/src/secret-store.ts`                 | `docs/specs/353-agent-oauth-credential-store/design.md [DES-DATA] [DES-API]` |
| 1.2  | `apps/vscode/src/services/oauth/oauth-service.ts` | `docs/specs/353-agent-oauth-credential-store/design.md [DES-LOCK]`           |
| 1.3  | `packages/shared/src/oauth/types.ts`              | `docs/specs/353-agent-oauth-credential-store/design.md [DES-DATA]`           |

---

## Open Technical Questions

| #   | Question                                                                                    | Status |
| --- | ------------------------------------------------------------------------------------------- | ------ |
| 1   | Should cross-window locking become a shared utility after another secret workflow needs it? | Open   |
