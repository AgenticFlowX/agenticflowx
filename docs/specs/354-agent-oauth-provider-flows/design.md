---
afx: true
type: DESIGN
status: Draft
owner: "@rixrix"
version: "1.0"
created_at: "2026-06-01T10:08:49.000Z"
updated_at: "2026-06-01T10:08:49.000Z"
tags: ["agent", "oauth", "pkce", "device-code", "providers"]
spec: spec.md
---

# Agent OAuth Provider Flows - Technical Design

## [DES-OVR] Overview

Provider flows normalize Anthropic/OpenAI Codex PKCE and GitHub Copilot device-code sign-in into shared OAuth records and redacted progress events.

---

## [DES-PKCE] PKCE Loopback Flow

```
oauth/signIn(provider)
  -> generate verifier/challenge/state
  -> bind loopback server
  -> open provider authorization URL
  -> receive callback or paste code
  -> validate state
  -> exchange code for tokens
  -> normalize OAuth record
```

The loopback redirect URL uses localhost semantics while the listener binds local interfaces that work in the extension host. Paste-code fallback is exposed when callback completion may not reach the extension host.

---

## [DES-DEVICE] Device Code Flow

```
oauth/signIn(github-copilot)
  -> request device/user code
  -> emit verification URL and code
  -> poll respecting interval and slow_down
  -> derive Copilot token/base URL metadata
  -> normalize OAuth record
```

Polling stops on success, cancel, expiry, or terminal provider error.

---

## [DES-PROVIDERS] Provider Adapters

| Provider         | Flow          | Notes                                                           |
| ---------------- | ------------- | --------------------------------------------------------------- |
| `anthropic`      | PKCE loopback | Produces Anthropic OAuth token metadata consumed by Pi provider |
| `openai-codex`   | PKCE loopback | Produces ChatGPT/Codex subscription record and account metadata |
| `github-copilot` | Device code   | Produces Copilot token and optional base URL metadata           |

---

## [DES-SEC] Security Considerations

- State mismatch, missing verifier, malformed callback, or expired device code fail the flow.
- Progress events never include access or refresh tokens.
- Provider-specific metadata is minimized to what downstream injection needs.

---

## [DES-TEST] Testing Strategy

- PKCE tests cover verifier/challenge, callback, state mismatch, timeout, paste fallback, and cancellation.
- Device-code tests cover pending, slow_down, success, cancel, expiry, and error states.
- Provider tests cover token exchange mapping and safe metadata.

---

## File Reference Map

| Task | File                                              | Required @see                                                         |
| ---- | ------------------------------------------------- | --------------------------------------------------------------------- |
| 1.1  | `apps/vscode/src/services/oauth/pkce.ts`          | `docs/specs/354-agent-oauth-provider-flows/design.md [DES-PKCE]`      |
| 1.2  | `apps/vscode/src/services/oauth/pkce-loopback.ts` | `docs/specs/354-agent-oauth-provider-flows/design.md [DES-PKCE]`      |
| 1.3  | `apps/vscode/src/services/oauth/device-code.ts`   | `docs/specs/354-agent-oauth-provider-flows/design.md [DES-DEVICE]`    |
| 1.4  | `apps/vscode/src/services/oauth/providers/*.ts`   | `docs/specs/354-agent-oauth-provider-flows/design.md [DES-PROVIDERS]` |

---

## Open Technical Questions

| #   | Question                                                                    | Status |
| --- | --------------------------------------------------------------------------- | ------ |
| 1   | Should browser-open failure fall back immediately to copy URL + paste code? | Open   |
